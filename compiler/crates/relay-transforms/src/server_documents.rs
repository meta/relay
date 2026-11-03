/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

use std::mem::take;
use std::sync::Arc;
use std::sync::LazyLock;

use common::ArgumentName;
use common::Diagnostic;
use common::DiagnosticsResult;
use common::DirectiveName;
use common::Location;
use common::NamedItem;
use common::WithLocation;
use graphql_ir::Condition;
use graphql_ir::ConditionValue;
use graphql_ir::ConstantValue;
use graphql_ir::Directive;
use graphql_ir::FragmentDefinitionName;
use graphql_ir::FragmentDefinitionNameSet;
use graphql_ir::FragmentSpread;
use graphql_ir::LinkedField;
use graphql_ir::OperationDefinition;
use graphql_ir::OperationDefinitionName;
use graphql_ir::Program;
use graphql_ir::ScalarField;
use graphql_ir::Selection;
use graphql_ir::Transformed;
use graphql_ir::Transformer;
use graphql_ir::Value;
use graphql_ir::Visitor;
use intern::string_key::Intern;
use intern::string_key::StringKey;
use relay_config::DeferStreamInterface;
use rustc_hash::FxHashSet;
use schema::FieldID;
use schema::Schema;
use thiserror::Error;

use crate::ConnectionConstants;
use crate::INLINE_DIRECTIVE_NAME;
use crate::MATCH_CONSTANTS;
use crate::NO_INLINE_DIRECTIVE_NAME;
use crate::REFETCHABLE_NAME;
use crate::UPDATABLE_DIRECTIVE;
use crate::fragment_alias_directive::FRAGMENT_ALIAS_DIRECTIVE_NAME;
use crate::get_all_resolver_fragment_dependency_names;
use crate::get_resolver_fragment_dependency_name;
use crate::relay_directive::RELAY_DIRECTIVE_NAME;

pub static SERVER_DIRECTIVE: LazyLock<DirectiveName> =
    LazyLock::new(|| DirectiveName("server".intern()));
pub static SERVER_DIRECTIVE_FOR_TYPEGEN: LazyLock<DirectiveName> =
    LazyLock::new(|| DirectiveName("__server".intern()));
static PRELOADABLE_DIRECTIVE: LazyLock<DirectiveName> =
    LazyLock::new(|| DirectiveName("preloadable".intern()));
static RAW_RESPONSE_TYPE_DIRECTIVE: LazyLock<DirectiveName> =
    LazyLock::new(|| DirectiveName("raw_response_type".intern()));
static THROW_ON_FIELD_ERROR_DIRECTIVE: LazyLock<DirectiveName> =
    LazyLock::new(|| DirectiveName("throwOnFieldError".intern()));
static ALLOWED_SERVER_OPERATION_EXTENSION_DIRECTIVES: LazyLock<[DirectiveName; 2]> =
    LazyLock::new(|| [*SERVER_DIRECTIVE, *RAW_RESPONSE_TYPE_DIRECTIVE]);
static ALLOWED_SERVER_FRAGMENT_EXTENSION_DIRECTIVES: LazyLock<[DirectiveName; 3]> =
    LazyLock::new(|| {
        [
            *SERVER_DIRECTIVE,
            *NO_INLINE_DIRECTIVE_NAME,
            *THROW_ON_FIELD_ERROR_DIRECTIVE,
        ]
    });
// A server-owned operation normalizes and hands off connections like any other
// records. `@stream_connection` is admitted so that the incremental delivery
// validation owns its diagnostic.
static ALLOWED_SERVER_SELECTION_EXTENSION_DIRECTIVES: LazyLock<[DirectiveName; 3]> =
    LazyLock::new(|| {
        let connection_constants = ConnectionConstants::default();
        [
            *FRAGMENT_ALIAS_DIRECTIVE_NAME,
            connection_constants.connection_directive_name,
            connection_constants.stream_connection_directive_name,
        ]
    });

fn is_allowed_server_directive(
    program: &Program,
    directive_name: DirectiveName,
    allowed_extension_directives: &[DirectiveName],
) -> bool {
    program
        .schema
        .get_directive(directive_name)
        .is_none_or(|directive| !directive.is_extension)
        || allowed_extension_directives.contains(&directive_name)
}

pub(crate) fn annotate_server_fragment_spreads(program: &Program) -> Program {
    AnnotateServerFragmentSpreads { program }
        .transform_program(program)
        .replace_or_else(|| program.clone())
}

struct AnnotateServerFragmentSpreads<'program> {
    program: &'program Program,
}

impl Transformer<'_> for AnnotateServerFragmentSpreads<'_> {
    const NAME: &'static str = "AnnotateServerFragmentSpreads";
    const VISIT_ARGUMENTS: bool = false;
    const VISIT_DIRECTIVES: bool = false;

    fn transform_fragment_spread(
        &mut self,
        fragment_spread: &FragmentSpread,
    ) -> Transformed<Selection> {
        let Some(fragment_definition) = self.program.fragment(fragment_spread.fragment.item) else {
            return Transformed::Keep;
        };
        if fragment_definition
            .directives
            .named(*SERVER_DIRECTIVE)
            .is_none()
        {
            return Transformed::Keep;
        }

        let mut fragment_spread = fragment_spread.clone();
        fragment_spread.directives.push(Directive {
            name: WithLocation::generated(*SERVER_DIRECTIVE_FOR_TYPEGEN),
            arguments: vec![],
            data: None,
            location: Location::generated(),
        });
        Transformed::Replace(Selection::FragmentSpread(Arc::new(fragment_spread)))
    }
}

pub(crate) fn validate_server_documents(
    program: &Program,
    relay_rsc_enabled: bool,
) -> DiagnosticsResult<()> {
    let mut errors = Vec::new();
    for operation in program.operations() {
        let Some(server_directive) = operation.directives.named(*SERVER_DIRECTIVE) else {
            continue;
        };
        if !relay_rsc_enabled {
            errors.push(Diagnostic::error(
                ValidationMessage::RelayRscOperationDisabled {
                    operation_name: operation.name.item,
                },
                server_directive.name.location,
            ));
            continue;
        }
        for directive in operation.directives.iter().filter(|directive| {
            !is_allowed_server_directive(
                program,
                directive.name.item,
                ALLOWED_SERVER_OPERATION_EXTENSION_DIRECTIVES.as_slice(),
            )
        }) {
            let message = if directive.name.item == *PRELOADABLE_DIRECTIVE {
                ValidationMessage::ServerOperationPreloadable {
                    operation_name: operation.name.item,
                }
            } else if directive.name.item == *THROW_ON_FIELD_ERROR_DIRECTIVE {
                ValidationMessage::ServerOperationThrowOnFieldError {
                    operation_name: operation.name.item,
                }
            } else {
                ValidationMessage::UnsupportedServerOperationDirective {
                    operation_name: operation.name.item,
                    directive_name: directive.name.item,
                }
            };
            errors.push(Diagnostic::error(message, directive.name.location));
        }
        validate_server_selection_directives(
            program,
            operation.name.item.0,
            &operation.selections,
            &mut errors,
        );
    }
    for fragment in program.fragments() {
        let Some(server_directive) = fragment.directives.named(*SERVER_DIRECTIVE) else {
            continue;
        };
        if !relay_rsc_enabled {
            errors.push(Diagnostic::error(
                ValidationMessage::RelayRscDisabled {
                    fragment_name: fragment.name.item,
                },
                server_directive.name.location,
            ));
            continue;
        }
        for directive in fragment.directives.iter().filter(|directive| {
            !is_allowed_server_directive(
                program,
                directive.name.item,
                ALLOWED_SERVER_FRAGMENT_EXTENSION_DIRECTIVES.as_slice(),
            )
        }) {
            let message = if directive.name.item == *INLINE_DIRECTIVE_NAME {
                ValidationMessage::InlineFragment {
                    fragment_name: fragment.name.item,
                }
            } else if directive.name.item == *UPDATABLE_DIRECTIVE {
                ValidationMessage::UpdatableFragment {
                    fragment_name: fragment.name.item,
                }
            } else if directive.name.item == *REFETCHABLE_NAME {
                ValidationMessage::RefetchableFragment {
                    fragment_name: fragment.name.item,
                }
            } else {
                ValidationMessage::UnsupportedServerFragmentDirective {
                    fragment_name: fragment.name.item,
                    directive_name: directive.name.item,
                }
            };
            errors.push(Diagnostic::error(message, directive.name.location));
        }
        validate_server_selection_directives(
            program,
            fragment.name.item.0,
            &fragment.selections,
            &mut errors,
        );
    }

    if errors.is_empty() {
        Ok(())
    } else {
        Err(errors)
    }
}

/// Checks the Relay directives on the selections a server-owned document
/// authors directly. Spread server fragments are validated as their own
/// documents, and spread client fragments keep their client semantics.
fn validate_server_selection_directives(
    program: &Program,
    document_name: StringKey,
    selections: &[Selection],
    errors: &mut Vec<Diagnostic>,
) {
    for selection in selections {
        let (directives, children): (&[Directive], &[Selection]) = match selection {
            Selection::FragmentSpread(spread) => (&spread.directives, &[]),
            Selection::InlineFragment(fragment) => (&fragment.directives, &fragment.selections),
            Selection::LinkedField(field) => (&field.directives, &field.selections),
            Selection::ScalarField(field) => (&field.directives, &[]),
            Selection::Condition(condition) => (&[], &condition.selections),
        };
        errors.extend(
            directives
                .iter()
                .filter(|directive| {
                    !is_allowed_server_directive(
                        program,
                        directive.name.item,
                        ALLOWED_SERVER_SELECTION_EXTENSION_DIRECTIVES.as_slice(),
                    )
                })
                .map(|directive| {
                    let directive_name = directive.name.item;
                    let message = if directive_name == *RELAY_DIRECTIVE_NAME
                        && let Selection::FragmentSpread(spread) = selection
                    {
                        ValidationMessage::ServerDocumentUnmaskedSpread {
                            document_name,
                            fragment_name: spread.fragment.item,
                        }
                    } else if directive_name == MATCH_CONSTANTS.match_directive_name
                        || directive_name == MATCH_CONSTANTS.module_directive_name
                    {
                        ValidationMessage::ServerDocumentSelectsModule { document_name }
                    } else {
                        ValidationMessage::UnsupportedServerSelectionDirective {
                            document_name,
                            directive_name,
                        }
                    };
                    Diagnostic::error(message, directive.name.location)
                }),
        );
        validate_server_selection_directives(program, document_name, children, errors);
    }
}

pub(crate) fn validate_server_operation_incremental_delivery(
    program: &Program,
    defer_stream_interface: &DeferStreamInterface,
    allow_incremental_delivery: bool,
    base_fragment_names: &FragmentDefinitionNameSet,
) -> DiagnosticsResult<()> {
    let mut server_operations: Vec<_> = program
        .operations()
        .filter(|operation| operation.directives.named(*SERVER_DIRECTIVE).is_some())
        .collect();
    server_operations.sort_unstable_by_key(|operation| operation.name.item);
    if server_operations.is_empty()
        && !program
            .fragments()
            .any(|fragment| fragment.directives.named(*SERVER_DIRECTIVE).is_some())
    {
        return Ok(());
    }
    let resolver_root_fragments: FragmentDefinitionNameSet = program
        .schema
        .get_fields()
        .filter_map(get_resolver_fragment_dependency_name)
        .collect();

    let mut finder = IncrementalSelectionFinder {
        program,
        defer_stream_interface,
        connection_constants: ConnectionConstants::default(),
        resolver_root_fragments: &resolver_root_fragments,
        visited_fragments: Default::default(),
        allow_incremental_delivery,
        in_resolver_fragment: false,
    };
    let mut validated_fragments = FxHashSet::default();
    let mut errors: Vec<_> = server_operations
        .iter()
        .filter_map(|operation| {
            let found = finder.find(&operation.selections);
            validated_fragments.extend(take(&mut finder.visited_fragments));
            let (location, reason) = found?;
            let operation_name = operation.name.item;
            let message = match reason {
                Unsupported::Disabled => {
                    ValidationMessage::IncrementalDeliveryDisabled { operation_name }
                }
                Unsupported::ServerOwnedStream => {
                    ValidationMessage::ServerOwnedStreamUnsupported { operation_name }
                }
                Unsupported::InResolverFragment => {
                    ValidationMessage::IncrementalDeliveryInResolverFragment { operation_name }
                }
            };
            Some(Diagnostic::error(message, location))
        })
        .collect();
    finder.visited_fragments = validated_fragments;
    errors.extend(validate_standalone_server_fragments(
        program,
        &server_operations,
        base_fragment_names,
        finder,
    ));

    if errors.is_empty() {
        Ok(())
    } else {
        Err(errors)
    }
}

/// A local `@server` fragment that no `@server` operation selects may still be
/// selected by a server query in another project, or by one not written yet,
/// so it is validated as its own owner. Fragments an operation reaches are
/// left to that operation, and a fragment that another such fragment selects
/// is validated through it. The finder starts with the fragments and contexts
/// the operations already validated, so each rejected directive is reported
/// once.
fn validate_standalone_server_fragments(
    program: &Program,
    server_operations: &[&Arc<OperationDefinition>],
    base_fragment_names: &FragmentDefinitionNameSet,
    mut finder: IncrementalSelectionFinder<'_>,
) -> Vec<Diagnostic> {
    let mut reached = ReachedFragments {
        program,
        fragments: Default::default(),
    };
    for operation in server_operations {
        reached.visit_selections(&operation.selections);
    }
    let unreached: Vec<_> = program
        .fragments()
        .filter(|fragment| {
            fragment.directives.named(*SERVER_DIRECTIVE).is_some()
                && !base_fragment_names.contains(&fragment.name.item)
                && !reached.fragments.contains(&fragment.name.item)
        })
        .collect();
    if unreached.is_empty() {
        return Vec::new();
    }

    for fragment in &unreached {
        reached.visit_selections(&fragment.selections);
    }
    let mut owners: Vec<_> = unreached
        .into_iter()
        .filter(|fragment| !reached.fragments.contains(&fragment.name.item))
        .collect();
    owners.sort_unstable_by_key(|fragment| fragment.name.item);

    owners
        .into_iter()
        .filter_map(|fragment| {
            let fragment_name = fragment.name.item;
            let (location, reason) = finder.find_fragment(fragment_name)?;
            let message = match reason {
                Unsupported::Disabled => {
                    ValidationMessage::StandaloneFragmentIncrementalDeliveryDisabled {
                        fragment_name,
                    }
                }
                Unsupported::ServerOwnedStream => {
                    ValidationMessage::StandaloneFragmentServerOwnedStreamUnsupported {
                        fragment_name,
                    }
                }
                Unsupported::InResolverFragment => {
                    ValidationMessage::StandaloneFragmentIncrementalDeliveryInResolverFragment {
                        fragment_name,
                    }
                }
            };
            Some(Diagnostic::error(message, location))
        })
        .collect()
}

/// Collects the fragments that selections reach through fragment spreads and
/// Relay Resolver root fragments, outside statically false conditions.
struct ReachedFragments<'program> {
    program: &'program Program,
    fragments: FragmentDefinitionNameSet,
}

impl ReachedFragments<'_> {
    fn reach(&mut self, fragment_name: FragmentDefinitionName) {
        let program = self.program;
        if self.fragments.insert(fragment_name)
            && let Some(fragment) = program.fragment(fragment_name)
        {
            self.visit_selections(&fragment.selections);
        }
    }

    fn reach_resolver_fragments(&mut self, field_id: FieldID) {
        let schema = self.program.schema.as_ref();
        for fragment_name in
            get_all_resolver_fragment_dependency_names(schema.field(field_id), schema)
        {
            self.reach(fragment_name);
        }
    }
}

impl Visitor for ReachedFragments<'_> {
    const NAME: &'static str = "ReachedFragments";
    const VISIT_ARGUMENTS: bool = false;
    const VISIT_DIRECTIVES: bool = false;

    fn visit_fragment_spread(&mut self, spread: &FragmentSpread) {
        self.reach(spread.fragment.item);
    }

    fn visit_condition(&mut self, condition: &Condition) {
        if let ConditionValue::Constant(value) = condition.value
            && value != condition.passing_value
        {
            return;
        }
        self.default_visit_condition(condition);
    }

    fn visit_scalar_field(&mut self, field: &ScalarField) {
        self.reach_resolver_fragments(field.definition.item);
    }

    fn visit_linked_field(&mut self, field: &LinkedField) {
        self.reach_resolver_fragments(field.definition.item);
        self.default_visit_linked_field(field);
    }
}

/// Why an incremental directive is rejected.
#[derive(Clone, Copy)]
enum Unsupported {
    /// The project sets `relayRsc.allowIncrementalDelivery` to false.
    Disabled,
    /// `@stream` on a server-owned selection: a server component renders the
    /// list once, so items that arrive later would never render.
    ServerOwnedStream,
    /// Incremental delivery inside a Relay Resolver root fragment.
    InResolverFragment,
}

/// Finds rejected `@defer` and `@stream` in the authored documents, including
/// `@stream_connection`, deferred fragment spreads, and Resolver root
/// fragments, so the result does not depend on `transform_connections`,
/// `transform_defer_stream`, or Resolver lowering having run.
///
/// When incremental delivery is allowed, `@defer` is accepted and only
/// server-owned selections are searched: a client fragment may stream.
struct IncrementalSelectionFinder<'program> {
    program: &'program Program,
    defer_stream_interface: &'program DeferStreamInterface,
    connection_constants: ConnectionConstants,
    /// Entering one of these fragments, by a Resolver field or by a spread,
    /// enters a Resolver root fragment.
    resolver_root_fragments: &'program FragmentDefinitionNameSet,
    /// A fragment can be both server-owned and reached through a Resolver
    /// root fragment, so it is visited once in each context.
    visited_fragments: FxHashSet<(FragmentDefinitionName, bool)>,
    allow_incremental_delivery: bool,
    in_resolver_fragment: bool,
}

impl IncrementalSelectionFinder<'_> {
    fn reject(&self, location: Location, is_stream: bool) -> Option<(Location, Unsupported)> {
        if !self.allow_incremental_delivery {
            Some((location, Unsupported::Disabled))
        } else if self.in_resolver_fragment {
            Some((location, Unsupported::InResolverFragment))
        } else if is_stream {
            Some((location, Unsupported::ServerOwnedStream))
        } else {
            None
        }
    }

    fn find(&mut self, selections: &[Selection]) -> Option<(Location, Unsupported)> {
        let defer_stream = self.defer_stream_interface;
        selections.iter().find_map(|selection| match selection {
            Selection::LinkedField(field) => active_directive_location(
                &field.directives,
                defer_stream.stream_name,
                defer_stream.if_arg,
            )
            .or_else(|| {
                active_directive_location(
                    &field.directives,
                    self.connection_constants.stream_connection_directive_name,
                    self.connection_constants.stream_connection_if_arg,
                )
            })
            .and_then(|location| self.reject(location, true))
            .or_else(|| self.find_resolver_fragments(field.definition.item))
            .or_else(|| self.find(&field.selections)),
            Selection::InlineFragment(fragment) => active_directive_location(
                &fragment.directives,
                defer_stream.defer_name,
                defer_stream.if_arg,
            )
            .and_then(|location| self.reject(location, false))
            .or_else(|| self.find(&fragment.selections)),
            Selection::Condition(condition) => {
                if let ConditionValue::Constant(value) = condition.value
                    && value != condition.passing_value
                {
                    return None;
                }
                self.find(&condition.selections)
            }
            // Fragment arguments are not applied yet, so a directive gated by a
            // fragment argument is conservatively treated as reachable.
            Selection::FragmentSpread(spread) => active_directive_location(
                &spread.directives,
                defer_stream.defer_name,
                defer_stream.if_arg,
            )
            .and_then(|location| self.reject(location, false))
            .or_else(|| self.find_fragment(spread.fragment.item)),
            Selection::ScalarField(field) => self.find_resolver_fragments(field.definition.item),
        })
    }

    /// A Relay Resolver's root fragment is selected by the operation that
    /// selects the Resolver field.
    fn find_resolver_fragments(&mut self, field_id: FieldID) -> Option<(Location, Unsupported)> {
        let in_resolver_fragment = self.in_resolver_fragment;
        self.in_resolver_fragment = true;
        let found = get_all_resolver_fragment_dependency_names(
            self.program.schema.field(field_id),
            self.program.schema.as_ref(),
        )
        .into_iter()
        .find_map(|fragment_name| self.find_fragment(fragment_name));
        self.in_resolver_fragment = in_resolver_fragment;
        found
    }

    fn find_fragment(
        &mut self,
        fragment_name: FragmentDefinitionName,
    ) -> Option<(Location, Unsupported)> {
        let in_resolver_fragment =
            self.in_resolver_fragment || self.resolver_root_fragments.contains(&fragment_name);
        if !self
            .visited_fragments
            .insert((fragment_name, in_resolver_fragment))
        {
            return None;
        }
        let program = self.program;
        let fragment = program.fragment(fragment_name)?;
        if self.allow_incremental_delivery && fragment.directives.named(*SERVER_DIRECTIVE).is_none()
        {
            return None;
        }
        let outer_in_resolver_fragment = self.in_resolver_fragment;
        self.in_resolver_fragment = in_resolver_fragment;
        let found = self.find(&fragment.selections);
        self.in_resolver_fragment = outer_in_resolver_fragment;
        found
    }
}

/// `transform_defer_stream` drops an incremental directive whose `if` argument
/// is the literal `false`, so such a directive does not request incremental
/// delivery.
fn active_directive_location(
    directives: &[Directive],
    directive_name: DirectiveName,
    if_arg: ArgumentName,
) -> Option<Location> {
    let directive = directives.named(directive_name)?;
    let disabled = directive.arguments.named(if_arg).is_some_and(|argument| {
        matches!(
            argument.value.item,
            Value::Constant(ConstantValue::Boolean(false))
        )
    });
    (!disabled).then_some(directive.location)
}

#[derive(
    Clone,
    Debug,
    Eq,
    Error,
    Hash,
    Ord,
    PartialEq,
    PartialOrd,
    serde::Serialize
)]
#[serde(tag = "type")]
enum ValidationMessage {
    #[error(
        "Server-owned fragment `{fragment_name}` requires the `enable_relay_rsc` feature flag."
    )]
    RelayRscDisabled {
        fragment_name: FragmentDefinitionName,
    },

    #[error(
        "Server-owned operation `{operation_name}` requires the `enable_relay_rsc` feature flag."
    )]
    RelayRscOperationDisabled {
        operation_name: OperationDefinitionName,
    },

    #[error(
        "Server-owned operation `{operation_name}` cannot use `@{directive_name}` because this directive has not been validated for server-owned operations."
    )]
    UnsupportedServerOperationDirective {
        operation_name: OperationDefinitionName,
        directive_name: DirectiveName,
    },

    #[error(
        "Server-owned query `{operation_name}` cannot be `@preloadable`: a preloadable parameters artifact would expose the server operation's persisted id to client code."
    )]
    ServerOperationPreloadable {
        operation_name: OperationDefinitionName,
    },

    #[error(
        "Server-owned fragment `{fragment_name}` cannot use `@{directive_name}` because this directive has not been validated for server-owned fragments."
    )]
    UnsupportedServerFragmentDirective {
        fragment_name: FragmentDefinitionName,
        directive_name: DirectiveName,
    },

    #[error(
        "Server-owned fragment `{fragment_name}` cannot also use `@inline`; inline fragments do not have a standalone Reader artifact."
    )]
    InlineFragment {
        fragment_name: FragmentDefinitionName,
    },

    #[error(
        "Server-owned fragment `{fragment_name}` cannot also use `@updatable`; `useServerFragment` consumes read-only fragment keys."
    )]
    UpdatableFragment {
        fragment_name: FragmentDefinitionName,
    },

    #[error(
        "Server-owned fragment `{fragment_name}` cannot also use `@refetchable`; its generated query would not preserve server ownership."
    )]
    RefetchableFragment {
        fragment_name: FragmentDefinitionName,
    },

    #[error(
        "Server-owned operation `{operation_name}` cannot use `@throwOnFieldError` because a server-owned operation's own field errors are not raised when its data is read. Add `@throwOnFieldError` to the server-owned fragments that read those fields instead."
    )]
    ServerOperationThrowOnFieldError {
        operation_name: OperationDefinitionName,
    },

    #[error(
        "Server-owned document `{document_name}` cannot use `@{directive_name}` on a selection because this directive has not been validated inside server-owned documents."
    )]
    UnsupportedServerSelectionDirective {
        document_name: StringKey,
        directive_name: DirectiveName,
    },

    #[error(
        "Server-owned document `{document_name}` cannot unmask its spread of `{fragment_name}` with `@relay`: an unmasked spread inlines the fragment's selections into the server-owned document instead of crossing an aliased client-component boundary."
    )]
    ServerDocumentUnmaskedSpread {
        document_name: StringKey,
        fragment_name: FragmentDefinitionName,
    },

    #[error(
        "Server-owned Relay RSC document `{document_name}` cannot select `@match` or `@module`; place module selections in an aliased client-owned fragment until server-owned module execution is supported."
    )]
    ServerDocumentSelectsModule { document_name: StringKey },

    #[error(
        "Relay RSC operation `{operation_name}` cannot use `@defer` or `@stream`: this project sets `relayRsc.allowIncrementalDelivery` to false."
    )]
    IncrementalDeliveryDisabled {
        operation_name: OperationDefinitionName,
    },

    #[error(
        "Relay RSC operation `{operation_name}` cannot use `@stream` on a server-owned selection: a server component renders the list once, so items that arrive later would never render. Select the streamed field in a client fragment, where it re-renders as items arrive."
    )]
    ServerOwnedStreamUnsupported {
        operation_name: OperationDefinitionName,
    },

    #[error(
        "Relay RSC operation `{operation_name}` cannot use `@defer` or `@stream` inside a Relay Resolver root fragment: incremental delivery of Relay RSC Resolver fields is not supported yet."
    )]
    IncrementalDeliveryInResolverFragment {
        operation_name: OperationDefinitionName,
    },

    #[error(
        "Server-owned fragment `{fragment_name}`, which no server-owned operation in this project selects, cannot use `@defer` or `@stream`: this project sets `relayRsc.allowIncrementalDelivery` to false."
    )]
    StandaloneFragmentIncrementalDeliveryDisabled {
        fragment_name: FragmentDefinitionName,
    },

    #[error(
        "Server-owned fragment `{fragment_name}`, which no server-owned operation in this project selects, cannot use `@stream` on a server-owned selection: a server component renders the list once, so items that arrive later would never render. Select the streamed field in a client fragment, where it re-renders as items arrive."
    )]
    StandaloneFragmentServerOwnedStreamUnsupported {
        fragment_name: FragmentDefinitionName,
    },

    #[error(
        "Server-owned fragment `{fragment_name}`, which no server-owned operation in this project selects, cannot use `@defer` or `@stream` inside a Relay Resolver root fragment: incremental delivery of Relay RSC Resolver fields is not supported yet."
    )]
    StandaloneFragmentIncrementalDeliveryInResolverFragment {
        fragment_name: FragmentDefinitionName,
    },
}

#[cfg(test)]
mod tests {
    use std::sync::Arc;

    use common::SourceLocationKey;
    use graphql_ir::build;
    use graphql_syntax::parse_executable;
    use relay_test_schema::get_test_schema;

    use super::*;

    fn program(source: &str) -> Program {
        let schema = get_test_schema();
        let ast = parse_executable(source, SourceLocationKey::generated()).unwrap();
        let definitions = build(&schema, &ast.definitions).unwrap();
        Program::from_definitions(Arc::clone(&schema), definitions)
    }

    #[test]
    fn accepts_server_fragment_with_server_schema_directive_when_relay_rsc_is_enabled() {
        let program =
            program("fragment ServerUser on User @server @vulture(name: \"server\") { id }");

        assert!(validate_server_documents(&program, true).is_ok());
    }

    #[test]
    fn rejects_server_fragment_when_relay_rsc_is_disabled() {
        let program = program("fragment ServerUser on User @server { id }");

        assert_eq!(
            validate_server_documents(&program, false)
                .unwrap_err()
                .len(),
            1
        );
    }

    #[test]
    fn accepts_server_query_with_allowed_and_server_schema_directives_when_relay_rsc_is_enabled() {
        let program = program(
            "query ServerQuery @server @raw_response_type @vulture(name: \"server\") { me { id } }",
        );

        assert!(validate_server_documents(&program, true).is_ok());
    }

    #[test]
    fn rejects_only_feature_error_when_server_query_is_disabled() {
        let program = program("query ServerQuery @server @preloadable { me { id } }");

        assert_eq!(
            validate_server_documents(&program, false)
                .unwrap_err()
                .len(),
            1
        );
    }

    #[test]
    fn rejects_preloadable_server_query() {
        let program = program("query ServerQuery @server @preloadable { me { id } }");

        assert_eq!(
            validate_server_documents(&program, true)
                .expect_err("a server query cannot expose preloadable parameters")
                .len(),
            1
        );
    }

    #[test]
    fn rejects_unvalidated_server_query_extension_directives() {
        let program =
            program("query ServerQuery @server @updatable @throwOnFieldError { me { id } }");

        assert_eq!(
            validate_server_documents(&program, true)
                .expect_err("server queries must reject extension directives outside the allowlist")
                .len(),
            2
        );
    }

    #[test]
    fn rejects_fragment_kinds_without_a_standalone_reader_contract() {
        for source in [
            "fragment ServerUser on User @server @inline { id }",
            "fragment ServerUser on User @server @updatable { id }",
            "fragment ServerUser on User @server @refetchable(queryName: \"ServerUserRefetchQuery\") { id }",
        ] {
            let program = program(source);
            assert_eq!(
                validate_server_documents(&program, true).unwrap_err().len(),
                1
            );
        }
    }

    #[test]
    fn accepts_server_fragment_with_throw_on_field_error() {
        let program = program("fragment ServerUser on User @server @throwOnFieldError { id }");

        assert!(validate_server_documents(&program, true).is_ok());
    }

    #[test]
    fn rejects_unvalidated_server_fragment_extension_directives() {
        let program = program("fragment ServerUser on User @server @catch { id }");

        assert_eq!(
            validate_server_documents(&program, true)
                .expect_err(
                    "server fragments must reject extension directives outside the allowlist"
                )
                .len(),
            1
        );
    }

    #[test]
    fn accepts_validated_and_server_schema_selection_directives() {
        let program = program(
            r#"query ServerQuery @server {
              me {
                name @customDirective(level: 1)
                ...ClientUser_user @alias(as: "client")
                friends(first: 1) @stream_connection(key: "ServerQuery_friends", initial_count: 1) {
                  edges { node { id } }
                }
              }
            }
            fragment ClientUser_user on User { id }"#,
        );

        assert!(validate_server_documents(&program, true).is_ok());
    }

    #[test]
    fn rejects_unvalidated_selection_directives_in_server_documents() {
        let program = program(
            r#"query ServerQuery @server {
              me {
                name @required(action: LOG)
                ...ClientUser_user @relay(mask: false)
              }
            }
            fragment ServerUser on User @server {
              name @catch
              friends(first: 1) @connection(key: "ServerUser_friends") {
                edges { node { id } }
              }
            }
            fragment ClientUser_user on User {
              name @required(action: LOG)
            }"#,
        );

        assert_eq!(
            validate_server_documents(&program, true)
                .expect_err(
                    "server documents must reject selection directives outside the allowlist"
                )
                .len(),
            3,
            "only the two server documents' own selections are checked, and @connection is allowed"
        );
    }

    #[test]
    fn rejects_incremental_directives_before_they_are_transformed() {
        let program = program(
            r#"query ServerQuery @server {
              ...ServerUser_query @defer(label: "ServerQuery$user")
            }
            query ServerConnectionQuery @server {
              me {
                friends(first: 1) @stream_connection(key: "ServerConnectionQuery_friends", initial_count: 1) {
                  edges { node { id } }
                }
              }
            }
            fragment ServerUser_query on Query @server { me { id } }"#,
        );

        assert_eq!(
            validate_server_operation_incremental_delivery(
                &program,
                &DeferStreamInterface::default(),
                false,
                &Default::default(),
            )
            .expect_err(
                "a deferred spread and @stream_connection both request incremental delivery"
            )
            .len(),
            2
        );
    }

    #[test]
    fn allows_defer_but_rejects_server_owned_stream_when_incremental_delivery_is_allowed() {
        let program = program(
            r#"query ServerQuery @server {
              ...ServerUser_query @defer(label: "ServerQuery$user")
              me { friends { edges @stream(initialCount: 1, label: "ServerQuery$friends") { cursor } } }
            }
            fragment ServerUser_query on Query @server { me { id } }"#,
        );

        assert_eq!(
            validate_server_operation_incremental_delivery(
                &program,
                &DeferStreamInterface::default(),
                true,
                &Default::default(),
            )
            .expect_err("a server-owned @stream would render once and drop later items")
            .len(),
            1,
            "only the server-owned @stream is reported, not the @defer"
        );
    }

    #[test]
    fn allows_stream_in_client_fragments_when_incremental_delivery_is_allowed() {
        let program = program(
            r#"query ServerQuery @server {
              me { ...ClientFriends_user @alias(as: "friends") }
            }
            fragment ClientFriends_user on User {
              friends { edges @stream(initialCount: 1, label: "ClientFriends$friends") { cursor } }
            }"#,
        );

        assert!(
            validate_server_operation_incremental_delivery(
                &program,
                &DeferStreamInterface::default(),
                true,
                &Default::default(),
            )
            .is_ok(),
            "a client fragment re-renders as streamed items arrive"
        );
    }

    #[test]
    fn validates_server_fragments_no_server_operation_selects_once() {
        let program = program(
            r#"query ServerQuery @server {
              ...ServerReached_query
            }
            fragment ServerReached_query on Query @server {
              me { friends { edges @stream(initialCount: 1, label: "ServerReached$friends") { cursor } } }
            }
            fragment ServerOuter_query on Query @server {
              ...ServerReached_query
              ...ServerInner_query
            }
            fragment ServerInner_query on Query @server {
              me { friends { edges @stream(initialCount: 1, label: "ServerInner$friends") { cursor } } }
            }
            fragment ServerBase_query on Query @server {
              me { friends { edges @stream(initialCount: 1, label: "ServerBase$friends") { cursor } } }
            }"#,
        );
        let mut base_fragment_names = FragmentDefinitionNameSet::default();
        base_fragment_names.insert(FragmentDefinitionName("ServerBase_query".intern()));

        let errors = validate_server_operation_incremental_delivery(
            &program,
            &DeferStreamInterface::default(),
            true,
            &base_fragment_names,
        )
        .expect_err("server-owned @stream is rejected with or without a server operation");
        assert_eq!(
            errors
                .iter()
                .map(|error| error.message().to_string())
                .collect::<Vec<_>>(),
            vec![
                ValidationMessage::ServerOwnedStreamUnsupported {
                    operation_name: OperationDefinitionName("ServerQuery".intern()),
                }
                .to_string(),
                ValidationMessage::StandaloneFragmentServerOwnedStreamUnsupported {
                    fragment_name: FragmentDefinitionName("ServerOuter_query".intern()),
                }
                .to_string(),
            ],
            "the operation owns the fragment it reaches, the outer standalone fragment owns the inner one, and base fragments are validated by their own project"
        );
    }

    #[test]
    fn accepts_incremental_directives_disabled_with_a_literal_false() {
        let program = program(
            r#"query ServerQuery @server {
              ...ServerUser_query @defer(label: "ServerQuery$user", if: false)
            }
            fragment ServerUser_query on Query @server { me { id } }"#,
        );

        assert!(
            validate_server_operation_incremental_delivery(
                &program,
                &DeferStreamInterface::default(),
                false,
                &Default::default(),
            )
            .is_ok(),
            "`if: false` removes the @defer, so nothing is delivered incrementally"
        );
    }

    #[test]
    fn accepts_incremental_selections_under_statically_false_conditions() {
        let program = program(
            r#"query ServerQuery @server {
              included: nodes(ids: ["1"]) @include(if: false) @stream(initialCount: 1, label: "included") { id }
              skipped: nodes(ids: ["2"]) @skip(if: true) @stream(initialCount: 1, label: "skipped") { id }
            }"#,
        );

        assert!(
            validate_server_operation_incremental_delivery(
                &program,
                &DeferStreamInterface::default(),
                false,
                &Default::default(),
            )
            .is_ok(),
            "statically unreachable @stream cannot require incremental delivery"
        );
    }

    #[test]
    fn rejects_incremental_selections_under_variable_conditions() {
        let program = program(
            r#"query ServerQuery($cond: Boolean!) @server {
              nodes(ids: ["1"]) @include(if: $cond) @stream(initialCount: 1, label: "conditional") { id }
            }"#,
        );

        assert_eq!(
            validate_server_operation_incremental_delivery(
                &program,
                &DeferStreamInterface::default(),
                false,
                &Default::default(),
            )
            .expect_err("a runtime condition can still reach @stream")
            .len(),
            1
        );
    }
}
