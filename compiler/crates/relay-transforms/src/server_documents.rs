/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

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
use rustc_hash::FxHashMap;
use schema::FieldID;
use schema::Schema;
use thiserror::Error;

use crate::CATCH_DIRECTIVE_NAME;
use crate::ConnectionConstants;
use crate::INLINE_DIRECTIVE_NAME;
use crate::MATCH_CONSTANTS;
use crate::ModuleMetadata;
use crate::NO_INLINE_DIRECTIVE_NAME;
use crate::REFETCHABLE_NAME;
use crate::RefetchableDerivedFromMetadata;
use crate::SplitOperationMetadata;
use crate::UPDATABLE_DIRECTIVE;
use crate::fragment_alias_directive::FRAGMENT_ALIAS_DIRECTIVE_NAME;
use crate::get_all_resolver_fragment_dependency_names;
use crate::relay_directive::RELAY_DIRECTIVE_NAME;
use crate::rsc_resolver_fields::is_rsc_value_field;

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
// Host schemas declare the live delivery directives, so the extension
// directive allowlists below do not see them.
static LIVE_DIRECTIVE: LazyLock<DirectiveName> = LazyLock::new(|| DirectiveName("live".intern()));
static LIVE_OPERATION_DIRECTIVES: LazyLock<[DirectiveName; 3]> = LazyLock::new(|| {
    [
        *LIVE_DIRECTIVE,
        DirectiveName("live_query".intern()),
        DirectiveName("client_polling".intern()),
    ]
});
static LIVE_FRAGMENT_DIRECTIVES: LazyLock<[DirectiveName; 1]> =
    LazyLock::new(|| [DirectiveName("live_fragment".intern())]);
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
    if relay_rsc_enabled {
        validate_server_owned_live_delivery(program, &mut errors);
    }

    if errors.is_empty() {
        Ok(())
    } else {
        Err(errors)
    }
}

/// A server-owned document's data is fetched and handed off once, so neither
/// it nor any fragment it selects can request live delivery. Each definition
/// is checked once for the live directives it authors.
fn validate_server_owned_live_delivery(program: &Program, errors: &mut Vec<Diagnostic>) {
    let mut server_operations: Vec<_> = program
        .operations()
        .filter(|operation| operation.directives.named(*SERVER_DIRECTIVE).is_some())
        .collect();
    server_operations.sort_unstable_by_key(|operation| operation.name.item);
    let mut reached = ReachedFragments {
        program,
        fragments: Default::default(),
    };
    for operation in &server_operations {
        reached.visit_selections(&operation.selections);
    }
    for fragment in program.fragments() {
        if fragment.directives.named(*SERVER_DIRECTIVE).is_some() {
            reached.reach(fragment.name.item);
        }
    }
    let mut fragments: Vec<_> = reached
        .fragments
        .iter()
        .filter_map(|fragment_name| program.fragment(*fragment_name))
        .collect();
    fragments.sort_unstable_by_key(|fragment| fragment.name.item);

    for operation in server_operations {
        errors.extend(
            live_directive_names(
                &operation.directives,
                LIVE_OPERATION_DIRECTIVES.as_slice(),
                &operation.selections,
            )
            .into_iter()
            .map(|directive_name| {
                Diagnostic::error(
                    ValidationMessage::ServerOwnedLiveDelivery {
                        document_name: operation.name.item.0,
                        directive_name: directive_name.item,
                    },
                    directive_name.location,
                )
            }),
        );
    }
    for fragment in fragments {
        let is_server_owned = fragment.directives.named(*SERVER_DIRECTIVE).is_some();
        errors.extend(
            live_directive_names(
                &fragment.directives,
                LIVE_FRAGMENT_DIRECTIVES.as_slice(),
                &fragment.selections,
            )
            .into_iter()
            .map(|directive_name| {
                let message = if is_server_owned {
                    ValidationMessage::ServerOwnedLiveDelivery {
                        document_name: fragment.name.item.0,
                        directive_name: directive_name.item,
                    }
                } else {
                    ValidationMessage::ServerSelectedFragmentLiveDelivery {
                        fragment_name: fragment.name.item,
                        directive_name: directive_name.item,
                    }
                };
                Diagnostic::error(message, directive_name.location)
            }),
        );
    }
}

/// The live directives a definition authors on itself and on its own
/// selections.
fn live_directive_names(
    directives: &[Directive],
    live_directives: &[DirectiveName],
    selections: &[Selection],
) -> Vec<WithLocation<DirectiveName>> {
    let mut names: Vec<_> = directives
        .iter()
        .filter(|directive| live_directives.contains(&directive.name.item))
        .map(|directive| directive.name)
        .collect();
    collect_live_selection_directives(selections, &mut names);
    names
}

/// Collects `@live` on the selections a definition authors directly, outside
/// statically false conditions.
fn collect_live_selection_directives(
    selections: &[Selection],
    locations: &mut Vec<WithLocation<DirectiveName>>,
) {
    for selection in selections {
        let (directives, children): (&[Directive], &[Selection]) = match selection {
            Selection::FragmentSpread(spread) => (&spread.directives, &[]),
            Selection::InlineFragment(fragment) => (&fragment.directives, &fragment.selections),
            Selection::LinkedField(field) => (&field.directives, &field.selections),
            Selection::ScalarField(field) => (&field.directives, &[]),
            Selection::Condition(condition) => {
                if let ConditionValue::Constant(value) = condition.value
                    && value != condition.passing_value
                {
                    continue;
                }
                (&[], &condition.selections)
            }
        };
        if let Some(live) = directives.named(*LIVE_DIRECTIVE) {
            locations.push(live.name);
        }
        collect_live_selection_directives(children, locations);
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
                    ) && !is_rsc_field_catch(program, selection, directive)
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

/// An RSC field's value is an ordinary field value, with an ordinary field
/// error when it fails, so it may be caught.
fn is_rsc_field_catch(program: &Program, selection: &Selection, directive: &Directive) -> bool {
    directive.name.item == *CATCH_DIRECTIVE_NAME
        && matches!(selection, Selection::ScalarField(field)
            if is_rsc_value_field(&program.schema, program.schema.field(field.definition.item)))
}

/// Validates, after `transform_match` and `transform_refetchable_fragment`:
/// - that only server queries read Relay RSC fields: every other operation
///   that reaches one (a client query, mutation or subscription, or a
///   generated refetch or pagination query) is rejected, whatever
///   `relayRsc.allowClientRootedOperations` says, and so is a fragment
///   selected with `@module` that reaches one;
/// - the incremental delivery and `@match`/`@module` the server would read,
///   for each server query and each local server fragment.
pub(crate) fn validate_server_operation_incremental_delivery(
    program: &Program,
    defer_stream_interface: &DeferStreamInterface,
    allow_incremental_delivery: bool,
    base_fragment_names: &FragmentDefinitionNameSet,
) -> DiagnosticsResult<()> {
    let has_rsc_fields = program
        .schema
        .get_fields()
        .any(|field| is_rsc_value_field(&program.schema, field));
    let mut server_operations: Vec<_> = program
        .operations()
        .filter(|operation| operation.directives.named(*SERVER_DIRECTIVE).is_some())
        .collect();
    server_operations.sort_unstable_by_key(|operation| operation.name.item);
    let mut owners: Vec<_> = program
        .fragments()
        .filter(|fragment| {
            fragment.directives.named(*SERVER_DIRECTIVE).is_some()
                && !base_fragment_names.contains(&fragment.name.item)
        })
        .collect();
    owners.sort_unstable_by_key(|fragment| fragment.name.item);
    if !has_rsc_fields && server_operations.is_empty() && owners.is_empty() {
        return Ok(());
    }
    let mut finder = IncrementalSelectionFinder {
        program,
        defer_stream_interface,
        connection_constants: ConnectionConstants::default(),
        has_rsc_fields,
        results: Default::default(),
        errors: Vec::new(),
        allow_incremental_delivery,
    };
    let mut errors = Vec::new();
    if has_rsc_fields {
        program.fragments().for_each(|fragment| {
            finder.find_fragment(fragment.name.item, Context::Client);
        });
        // Client-rooted operations cannot execute Relay RSC fields or server
        // values yet, so one that reaches one is rejected whatever
        // `relayRsc.allowClientRootedOperations` says. Once that path works,
        // this check can honor the flag; hosts with it off (Next.js's
        // default) keep it.
        // In source order: generated refetch queries are added in no fixed
        // order.
        let mut operations: Vec<_> = program.operations().collect();
        operations.sort_by_key(|operation| operation.name.location);
        errors.extend(operations.into_iter().filter_map(|operation| {
            if operation.directives.named(*SERVER_DIRECTIVE).is_some()
                || SplitOperationMetadata::find(&operation.directives).is_some()
            {
                return None;
            }
            let field_location = finder
                .find(&operation.selections, Context::Client, false)
                .rsc?;
            let message = match RefetchableDerivedFromMetadata::find(&operation.directives) {
                Some(RefetchableDerivedFromMetadata(fragment_name)) => {
                    ValidationMessage::RefetchQueryReadsRscField {
                        operation_name: operation.name.item,
                        fragment_name: *fragment_name,
                    }
                }
                None => ValidationMessage::ClientOperationReadsRscField {
                    operation_name: operation.name.item,
                },
            };
            Some(
                Diagnostic::error(message, operation.name.location)
                    .annotate("the Relay RSC field", field_location),
            )
        }));
    }
    errors.extend(server_operations.iter().filter_map(|operation| {
        let (location, reason) = finder
            .find(&operation.selections, Context::Server, true)
            .unsupported?;
        let operation_name = operation.name.item;
        let message = match reason {
            Unsupported::Disabled => {
                ValidationMessage::IncrementalDeliveryDisabled { operation_name }
            }
            Unsupported::ServerOwnedStream => {
                ValidationMessage::ServerOwnedStreamUnsupported { operation_name }
            }
            Unsupported::ServerReadModule => ValidationMessage::ServerReadModule { operation_name },
        };
        Some(Diagnostic::error(message, location))
    }));
    // A server fragment may also be selected by a server query in another
    // project, or by one not written yet, so it is validated as its own owner.
    errors.extend(owners.into_iter().filter_map(|fragment| {
        let fragment_name = fragment.name.item;
        let (location, reason) = finder
            .find_fragment(fragment_name, Context::Server)
            .unsupported?;
        let message = match reason {
            Unsupported::Disabled => {
                ValidationMessage::StandaloneFragmentIncrementalDeliveryDisabled { fragment_name }
            }
            Unsupported::ServerOwnedStream => {
                ValidationMessage::StandaloneFragmentServerOwnedStreamUnsupported { fragment_name }
            }
            Unsupported::ServerReadModule => {
                ValidationMessage::StandaloneFragmentServerReadModule { fragment_name }
            }
        };
        Some(Diagnostic::error(message, location))
    }));
    errors.append(&mut finder.errors);
    if errors.is_empty() {
        Ok(())
    } else {
        Err(errors)
    }
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

/// Why a selection is rejected.
#[derive(Clone, Copy)]
enum Unsupported {
    /// The project sets `relayRsc.allowIncrementalDelivery` to false.
    Disabled,
    /// `@stream` on a server-owned selection: a server-owned read consumes
    /// the list once, so items that arrive later would never be read.
    ServerOwnedStream,
    /// `@match` or `@module` in a fragment the server reads.
    ServerReadModule,
}

/// Who reads a fragment's data.
#[derive(Clone, Copy, Debug, Eq, Hash, PartialEq)]
enum Context {
    /// The server: the selections of a server query or of a server fragment
    /// it selects, of an `@inline` fragment spread there, and of the root
    /// fragments of the Relay Resolvers (RSC fields included) it reads.
    Server,
    /// A client component: a client fragment that a server document hands
    /// off. Only the root fragments of its Relay RSC fields are read on the
    /// server again.
    Client,
}

/// What a selection set, or a fragment in a context, reaches: its first Relay
/// RSC field, and its first rejected selection.
#[derive(Clone, Copy, Default)]
struct RscFacts {
    rsc: Option<Location>,
    unsupported: Option<(Location, Unsupported)>,
}

impl RscFacts {
    fn merge(self, next: Self) -> Self {
        Self {
            rsc: self.rsc.or(next.rsc),
            unsupported: self.unsupported.or(next.unsupported),
        }
    }
}

/// Finds Relay RSC fields, rejected `@defer` and `@stream` (including
/// `@stream_connection`, deferred fragment spreads, and Resolver root
/// fragments), and the `@match` and `@module` the server would read. Every
/// sibling is searched, so each `@module` fragment is checked.
///
/// When incremental delivery is allowed, `@defer` is accepted and only
/// server-owned selections are searched: a client fragment may stream.
struct IncrementalSelectionFinder<'program> {
    program: &'program Program,
    defer_stream_interface: &'program DeferStreamInterface,
    connection_constants: ConnectionConstants,
    /// Without Relay RSC fields, nothing in a client fragment is read on the
    /// server.
    has_rsc_fields: bool,
    /// A fragment can be both server-owned and reached through a client
    /// fragment, so it is searched once in each context, for every owner
    /// (empty while it is being searched).
    results: FxHashMap<(FragmentDefinitionName, Context), RscFacts>,
    errors: Vec<Diagnostic>,
    allow_incremental_delivery: bool,
}

impl IncrementalSelectionFinder<'_> {
    /// `owned`: whether a server component owns the selection. When
    /// incremental delivery is allowed, a client fragment's own incremental
    /// directives, and those of an ordinary Resolver's root fragment, are
    /// left to it.
    fn reject(
        &self,
        location: Location,
        is_stream: bool,
        context: Context,
        owned: bool,
    ) -> Option<(Location, Unsupported)> {
        if !self.allow_incremental_delivery {
            Some((location, Unsupported::Disabled))
        } else if !owned || context == Context::Client {
            None
        } else if is_stream {
            Some((location, Unsupported::ServerOwnedStream))
        } else {
            None
        }
    }

    fn find(&mut self, selections: &[Selection], context: Context, owned: bool) -> RscFacts {
        selections
            .iter()
            .map(|selection| {
                let mut facts = match selection {
                    Selection::LinkedField(field) => self
                        .find_resolver_fragments(field.definition.item, context)
                        .merge(self.find(&field.selections, context, owned)),
                    Selection::InlineFragment(fragment) => {
                        let mut facts = self.find(&fragment.selections, context, owned);
                        // A separate unsupported shape: the client's operation
                        // loader loads an `@module` branch. Lift this only
                        // once that path executes server fields; client-rooted
                        // support alone does not enable it. `RscFacts::rsc`
                        // serves this check and the one for operations.
                        if let Some(module) = ModuleMetadata::find(&fragment.directives) {
                            let branch = self.find_fragment(module.fragment_name, Context::Client);
                            if context == Context::Client
                                && let Some(field_location) = branch.rsc
                            {
                                let message = ValidationMessage::ModuleFragmentReachesRscField {
                                    fragment_name: module.fragment_name,
                                };
                                self.errors.push(
                                    Diagnostic::error(message, module.location)
                                        .annotate("the Relay RSC field", field_location),
                                );
                            }
                            facts = facts.merge(branch);
                        }
                        facts
                    }
                    Selection::Condition(condition) => match condition.value {
                        ConditionValue::Constant(value) if value != condition.passing_value => {
                            RscFacts::default()
                        }
                        _ => self.find(&condition.selections, context, owned),
                    },
                    // Fragment arguments are not applied yet, so a directive gated
                    // by a fragment argument is conservatively treated as reachable.
                    Selection::FragmentSpread(spread) => {
                        self.find_spread(spread.fragment.item, context)
                    }
                    Selection::ScalarField(field) => RscFacts {
                        rsc: is_rsc_value_field(
                            &self.program.schema,
                            self.program.schema.field(field.definition.item),
                        )
                        .then_some(field.definition.location),
                        unsupported: None,
                    }
                    .merge(self.find_resolver_fragments(field.definition.item, context)),
                };
                facts.unsupported = self
                    .reject_selection(selection, context, owned)
                    .or(facts.unsupported);
                facts
            })
            .fold(RscFacts::default(), RscFacts::merge)
    }

    fn reject_selection(
        &self,
        selection: &Selection,
        context: Context,
        owned: bool,
    ) -> Option<(Location, Unsupported)> {
        let interface = self.defer_stream_interface;
        let (directive, is_stream) = match selection {
            Selection::LinkedField(_) => (interface.stream_name, true),
            Selection::InlineFragment(_) | Selection::FragmentSpread(_) => {
                (interface.defer_name, false)
            }
            _ => return None,
        };
        let directives = selection.directives();
        active_directive_location(directives, directive, interface.if_arg)
            .or_else(|| {
                is_stream
                    .then(|| {
                        active_directive_location(
                            directives,
                            self.connection_constants.stream_connection_directive_name,
                            self.connection_constants.stream_connection_if_arg,
                        )
                    })
                    .flatten()
            })
            .and_then(|location| self.reject(location, is_stream, context, owned))
            .or_else(|| {
                if context == Context::Client {
                    return None;
                }
                if let Some(module) = ModuleMetadata::find(directives) {
                    return Some((module.location, Unsupported::ServerReadModule));
                }
                directives
                    .iter()
                    .find(|directive| {
                        directive.name.item == MATCH_CONSTANTS.match_directive_name
                            || directive.name.item == MATCH_CONSTANTS.module_directive_name
                    })
                    .map(|directive| (directive.name.location, Unsupported::ServerReadModule))
            })
    }

    /// A spread in server context of a fragment no server document owns is a
    /// client boundary, unless it is `@inline`: the server reads that data.
    fn find_spread(&mut self, fragment_name: FragmentDefinitionName, context: Context) -> RscFacts {
        let Some(fragment) = self.program.fragment(fragment_name) else {
            return RscFacts::default();
        };
        let context = if context == Context::Client
            || fragment.directives.named(*SERVER_DIRECTIVE).is_some()
            || fragment.directives.named(*INLINE_DIRECTIVE_NAME).is_some()
        {
            context
        } else {
            Context::Client
        };
        self.find_fragment(fragment_name, context)
    }

    /// A Relay Resolver's root fragment is selected by the operation that
    /// selects the Resolver field. A Relay RSC field's root fragment is read
    /// on the server wherever the field is selected; another Resolver's root
    /// fragment is read where the Resolver runs.
    fn find_resolver_fragments(&mut self, field_id: FieldID, context: Context) -> RscFacts {
        let field = self.program.schema.field(field_id);
        let context = if is_rsc_value_field(&self.program.schema, field) {
            Context::Server
        } else {
            context
        };
        get_all_resolver_fragment_dependency_names(field, self.program.schema.as_ref())
            .into_iter()
            .map(|name| self.find_fragment(name, context))
            .fold(RscFacts::default(), RscFacts::merge)
    }

    fn find_fragment(
        &mut self,
        fragment_name: FragmentDefinitionName,
        context: Context,
    ) -> RscFacts {
        if context == Context::Client && self.allow_incremental_delivery && !self.has_rsc_fields {
            return RscFacts::default();
        }
        let key = (fragment_name, context);
        if let Some(result) = self.results.get(&key) {
            return *result;
        }
        self.results.insert(key, RscFacts::default());
        let program = self.program;
        let Some(fragment) = program.fragment(fragment_name) else {
            return RscFacts::default();
        };
        // A server component reads an `@inline` fragment's data itself.
        let owned = fragment.directives.named(*SERVER_DIRECTIVE).is_some()
            || (context != Context::Client
                && fragment.directives.named(*INLINE_DIRECTIVE_NAME).is_some());
        let result = self.find(&fragment.selections, context, owned);
        self.results.insert(key, result);
        result
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
        "Operation `{operation_name}` reaches a server-resolved field, but client-rooted execution of that field is not supported here. Select it in a client fragment that a `@server` query hands off."
    )]
    ClientOperationReadsRscField {
        operation_name: OperationDefinitionName,
    },

    #[error(
        "Fragment `{fragment_name}` cannot be refetched or paginated from the client (`@refetchable`, `@connection`): its generated query `{operation_name}` reaches a Relay RSC field, and client-rooted execution of that field is not supported yet. Read the new data with a `@server` query instead."
    )]
    RefetchQueryReadsRscField {
        operation_name: OperationDefinitionName,
        fragment_name: FragmentDefinitionName,
    },

    #[error("Fragment `{fragment_name}` selected with `@module` cannot reach a Relay RSC field.")]
    ModuleFragmentReachesRscField {
        fragment_name: FragmentDefinitionName,
    },

    #[error(
        "Relay RSC operation `{operation_name}` cannot use `@defer` or `@stream`: this project sets `relayRsc.allowIncrementalDelivery` to false."
    )]
    IncrementalDeliveryDisabled {
        operation_name: OperationDefinitionName,
    },

    #[error(
        "Relay RSC operation `{operation_name}` cannot use `@stream` on a server-owned selection: a server-owned read consumes the list once, so items that arrive later would never be read or rendered. Select the streamed field in a client fragment, where it re-renders as items arrive."
    )]
    ServerOwnedStreamUnsupported {
        operation_name: OperationDefinitionName,
    },

    #[error(
        "Relay RSC operation `{operation_name}` cannot read `@match` or `@module` selections on the server: a server component reads this fragment through `@inline` or a Relay Resolver. Place module selections in an aliased client-owned fragment."
    )]
    ServerReadModule {
        operation_name: OperationDefinitionName,
    },

    #[error(
        "Server-owned fragment `{fragment_name}` cannot use `@defer` or `@stream`: this project sets `relayRsc.allowIncrementalDelivery` to false."
    )]
    StandaloneFragmentIncrementalDeliveryDisabled {
        fragment_name: FragmentDefinitionName,
    },

    #[error(
        "Server-owned fragment `{fragment_name}` cannot use `@stream` on a server-owned selection: a server-owned read consumes the list once, so items that arrive later would never be read or rendered. Select the streamed field in a client fragment, where it re-renders as items arrive."
    )]
    StandaloneFragmentServerOwnedStreamUnsupported {
        fragment_name: FragmentDefinitionName,
    },

    #[error(
        "Server-owned fragment `{fragment_name}` cannot read `@match` or `@module` selections on the server: a server component reads this fragment through `@inline` or a Relay Resolver. Place module selections in an aliased client-owned fragment."
    )]
    StandaloneFragmentServerReadModule {
        fragment_name: FragmentDefinitionName,
    },

    #[error(
        "Server-owned document `{document_name}` cannot use `@{directive_name}`: a server-owned document's data is fetched and handed off once, so live updates would never be delivered."
    )]
    ServerOwnedLiveDelivery {
        document_name: StringKey,
        directive_name: DirectiveName,
    },

    #[error(
        "Fragment `{fragment_name}` cannot use `@{directive_name}` because a server-owned document selects it: a server-owned document's data is fetched and handed off once, so live updates would never be delivered."
    )]
    ServerSelectedFragmentLiveDelivery {
        fragment_name: FragmentDefinitionName,
        directive_name: DirectiveName,
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
    fn validates_each_local_server_fragment_as_an_owner() {
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
                    fragment_name: FragmentDefinitionName("ServerInner_query".intern()),
                }
                .to_string(),
                ValidationMessage::StandaloneFragmentServerOwnedStreamUnsupported {
                    fragment_name: FragmentDefinitionName("ServerOuter_query".intern()),
                }
                .to_string(),
                ValidationMessage::StandaloneFragmentServerOwnedStreamUnsupported {
                    fragment_name: FragmentDefinitionName("ServerReached_query".intern()),
                }
                .to_string(),
            ],
            "the operation and each local server fragment own what they reach, and base fragments are validated by their own project"
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
