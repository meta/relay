/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

//! Cases are read at exec time only. The executor computes a case's resolvers
//! when the query runs and writes their values under the storage keys of the
//! interface's fields, which the reader reads. At read time nothing computes
//! them, so an object read there would have nothing. A client type's case
//! matters only where client objects can be: elsewhere normalization drops it.
//! A server type's case matters only for a field the type serves with a
//! resolver: a field the server sends is written where the reader reads it.
//! Such a case may only be reached by an operation that always runs at exec
//! time, or, in any other operation, under `@include(if: $__relay_exec_time)`.
//! A refetch passes a query generated for `@refetchable` the
//! `$__relay_exec_time` of the query that fetched the fragment, so there the
//! variable guards only when an `enabledProvider` binds it.

use std::collections::HashMap;
use std::collections::HashSet;
use std::mem;

use common::Diagnostic;
use common::DiagnosticsResult;
use common::FeatureFlags;
use common::InterfaceName;
use common::Location;
use common::NamedItem;
use common::ObjectName;
use graphql_ir::Condition;
use graphql_ir::ConditionValue;
use graphql_ir::FragmentDefinition;
use graphql_ir::FragmentDefinitionName;
use graphql_ir::OperationDefinition;
use graphql_ir::Program;
use graphql_ir::Selection;
use graphql_syntax::OperationKind;
use intern::string_key::StringKey;
use schema::FieldID;
use schema::SDLSchema;
use schema::Schema;
use schema::Type;

use super::ClientImplementorCaseDirective;
use super::Origin;
use super::linked_field_origin;
use super::refined_origin;
use super::resolver_directive;
use crate::EXEC_TIME_RESOLVERS_DIRECTIVE_NAME;
use crate::EXEC_TIME_RESOLVERS_ENABLED_PROVIDER_ARG;
use crate::EXEC_TIME_VARIABLE_NAME;
use crate::ExecTimeMode;
use crate::RefetchableDerivedFromMetadata;
use crate::ValidationMessage;
use crate::exec_time_mode;
use crate::get_resolver_fragment_dependency_name;

/// Reports every case that needs exec time and that an operation able to run
/// at read time reaches without a guard on its exec-time provider.
pub fn validate_client_implementor_cases_run_at_exec_time(
    program: &Program,
    feature_flags: &FeatureFlags,
) -> DiagnosticsResult<()> {
    let mut errors = vec![];
    // Fragment walks that reached no case needing exec time, shared by the
    // operations that spread the same fragments.
    let mut clean = HashSet::new();
    for operation in program.operations() {
        let provider = match exec_time_mode(&operation.directives, feature_flags) {
            // Every case it reaches is read by the executor.
            ExecTimeMode::ExecTime => continue,
            ExecTimeMode::Provider(provider) => Some(provider),
            ExecTimeMode::ReadTime => None,
        };
        let refetchable_fragment = RefetchableDerivedFromMetadata::find(&operation.directives);
        let mut walk = ReadTimeWalk {
            program,
            operation,
            provider,
            refetchable_fragment,
            trusts_exec_time_variable: refetchable_fragment.is_none() || provider.is_some(),
            has_exec_time_directive_without_flag: !feature_flags
                .enable_exec_time_resolvers_directive
                && operation
                    .directives
                    .named(*EXEC_TIME_RESOLVERS_DIRECTIVE_NAME)
                    .is_some(),
            exec_time_directive_has_provider: match operation
                .directives
                .named(*EXEC_TIME_RESOLVERS_DIRECTIVE_NAME)
            {
                Some(directive) => directive
                    .arguments
                    .named(*EXEC_TIME_RESOLVERS_ENABLED_PROVIDER_ARG)
                    .is_some(),
                None => false,
            },
            visited: HashMap::new(),
            reached_walk_in_progress: false,
            clean: &mut clean,
            reported: HashSet::new(),
            errors: &mut errors,
        };
        walk.visit_selections(
            &operation.selections,
            Position {
                guarded: false,
                origin: Origin::Server,
                fragment: None,
                resolver: None,
                guard_in_operation: true,
            },
        );
    }
    if errors.is_empty() {
        Ok(())
    } else {
        Err(errors)
    }
}

/// Where the walk is.
#[derive(Clone, Copy)]
struct Position<'program> {
    /// The selections only run while the operation's provider returns true,
    /// i.e. at exec time.
    guarded: bool,
    origin: Origin,
    /// The document of the selections, for the error.
    fragment: Option<&'program FragmentDefinition>,
    /// The resolver field whose root fragment holds the selections.
    resolver: Option<StringKey>,
    /// Whether what a guard would wrap, the selections or the resolver, is
    /// written in the operation itself, which cannot reference
    /// `$__relay_exec_time`.
    guard_in_operation: bool,
}

/// A fragment walked in a position. Whether the operation trusts
/// `$__relay_exec_time` changes what the walk reports, so operations share a
/// walk only when they agree on it.
#[derive(Clone, Copy, PartialEq, Eq, Hash)]
struct FragmentWalk {
    fragment: FragmentDefinitionName,
    guarded: bool,
    origin: Origin,
    trusts_exec_time_variable: bool,
}

struct ReadTimeWalk<'program, 'errors> {
    program: &'program Program,
    operation: &'program OperationDefinition,
    /// The module of the operation's `enabledProvider`; `None` for an operation
    /// that always runs at read time.
    provider: Option<StringKey>,
    /// The fragment whose `@refetchable` generated this operation.
    refetchable_fragment: Option<&'program RefetchableDerivedFromMetadata>,
    /// Whether `$__relay_exec_time` in this operation says how it runs.
    trusts_exec_time_variable: bool,
    /// `@exec_time_resolvers` without the feature flag that makes it apply.
    has_exec_time_directive_without_flag: bool,
    /// Whether the operation's `@exec_time_resolvers` has `enabledProvider`.
    exec_time_directive_has_provider: bool,
    /// Whether each fragment walk of this operation reached a case needing
    /// exec time; `None` while the walk is in progress.
    visited: HashMap<FragmentWalk, Option<bool>>,
    /// Whether a walk reached one still in progress, through a resolver cycle:
    /// its result is then not final, and is not shared.
    reached_walk_in_progress: bool,
    clean: &'errors mut HashSet<FragmentWalk>,
    /// One error per interface and document an operation reaches.
    reported: HashSet<(InterfaceName, Option<FragmentDefinitionName>)>,
    errors: &'errors mut Vec<Diagnostic>,
}

impl<'program> ReadTimeWalk<'program, '_> {
    /// Returns whether the selections reach a case needing exec time.
    fn visit_selections(
        &mut self,
        selections: &'program [Selection],
        position: Position<'program>,
    ) -> bool {
        let mut found = false;
        for selection in selections {
            match selection {
                Selection::Condition(condition) => {
                    let guarded = position.guarded
                        || (self.trusts_exec_time_variable && is_exec_time_guard(condition));
                    found |= self.visit_selections(
                        &condition.selections,
                        Position {
                            guarded,
                            ..position
                        },
                    );
                }
                Selection::InlineFragment(inline_fragment) => {
                    let Some(case) =
                        ClientImplementorCaseDirective::find(&inline_fragment.directives)
                    else {
                        let origin = refined_origin(
                            &self.program.schema,
                            inline_fragment.type_condition,
                            position.origin,
                        );
                        found |= self.visit_selections(
                            &inline_fragment.selections,
                            Position { origin, ..position },
                        );
                        continue;
                    };
                    // The reader never reads inside a case.
                    if !position.guarded
                        && let Some(type_condition) = inline_fragment.type_condition
                        && let Some((field_name, location)) = self.field_needing_exec_time(
                            type_condition,
                            &inline_fragment.selections,
                            position.origin,
                        )
                    {
                        found = true;
                        self.report_case(case, type_condition, field_name, location, position);
                    }
                }
                Selection::LinkedField(field) => {
                    found |= self.visit_root_fragment(field.definition.item, position);
                    let origin = linked_field_origin(
                        &self.program.schema,
                        self.program.schema.field(field.definition.item),
                        position.origin,
                    );
                    found |=
                        self.visit_selections(&field.selections, Position { origin, ..position });
                }
                Selection::FragmentSpread(spread) => {
                    found |= self.visit_fragment(spread.fragment.item, position);
                }
                Selection::ScalarField(field) => {
                    found |= self.visit_root_fragment(field.definition.item, position);
                }
            }
        }
        found
    }

    /// A resolver reads its root fragment on the record it is read on,
    /// wherever the resolver is read. On an interface, a type's own resolver
    /// is in that type's case or inline fragment, so only the field's own root
    /// fragment is read here.
    fn visit_root_fragment(&mut self, field_id: FieldID, position: Position<'program>) -> bool {
        let field = self.program.schema.field(field_id);
        let Some(fragment_name) = get_resolver_fragment_dependency_name(field) else {
            return false;
        };
        // A guard can only be put on the outermost resolver: a root fragment
        // cannot read `$__relay_exec_time`.
        self.visit_fragment(
            fragment_name,
            Position {
                resolver: position.resolver.or(Some(field.name.item)),
                ..position
            },
        )
    }

    fn visit_fragment(
        &mut self,
        fragment_name: FragmentDefinitionName,
        position: Position<'program>,
    ) -> bool {
        let Some(definition) = self.program.fragment(fragment_name) else {
            return false;
        };
        let origin = refined_origin(
            &self.program.schema,
            Some(definition.type_condition),
            position.origin,
        );
        let walk = FragmentWalk {
            fragment: fragment_name,
            guarded: position.guarded,
            origin,
            trusts_exec_time_variable: self.trusts_exec_time_variable,
        };
        if self.clean.contains(&walk) {
            return false;
        }
        match self.visited.get(&walk) {
            Some(Some(found)) => return *found,
            Some(None) => {
                self.reached_walk_in_progress = true;
                return false;
            }
            None => {}
        }
        self.visited.insert(walk, None);
        let reached_walk_in_progress = mem::replace(&mut self.reached_walk_in_progress, false);
        let found = self.visit_selections(
            &definition.selections,
            Position {
                origin,
                fragment: Some(definition),
                // Below a resolver, a guard still wraps that resolver.
                guard_in_operation: position.guard_in_operation && position.resolver.is_some(),
                ..position
            },
        );
        self.visited.insert(walk, Some(found));
        if !found && !self.reached_walk_in_progress {
            self.clean.insert(walk);
        }
        self.reached_walk_in_progress |= reached_walk_in_progress;
        found
    }

    /// The first field of a case on `type_condition` that only exec time reads
    /// here: any field of a client type's case where client objects can be,
    /// and a field a server type serves with a resolver.
    fn field_needing_exec_time(
        &self,
        type_condition: Type,
        selections: &[Selection],
        origin: Origin,
    ) -> Option<(StringKey, Location)> {
        let schema = &self.program.schema;
        if schema.is_extension_type(type_condition) {
            return match origin {
                Origin::Any => first_field(schema, selections, false),
                Origin::Server => None,
            };
        }
        first_field(schema, selections, true)
    }

    fn report_case(
        &mut self,
        case: &ClientImplementorCaseDirective,
        type_condition: Type,
        field_name: StringKey,
        location: Location,
        position: Position<'program>,
    ) {
        let schema = &self.program.schema;
        let interface_name = schema.interface(case.interface).name.item;
        if !self
            .reported
            .insert((interface_name, position.fragment.map(document_name)))
        {
            return;
        }
        let type_name = ObjectName(schema.get_type_name(type_condition));
        let operation_name = self.operation.name.item.0;
        let provider = match self.provider {
            None => String::new(),
            Some(provider) => format!(" when its provider `{provider}` returns false"),
        };
        let via = match position.resolver {
            None => String::new(),
            Some(resolver) => format!(" through the root fragment of `{resolver}`"),
        };
        let message = match self.refetchable_fragment {
            None => ValidationMessage::ClientImplementorCaseReachableAtReadTime {
                interface_name,
                type_name,
                field_name,
                operation_name,
                provider,
                via,
                remedy: self.remedy(position),
            },
            Some(RefetchableDerivedFromMetadata(fragment_name)) => {
                ValidationMessage::ClientImplementorCaseReachableFromRefetchQuery {
                    interface_name,
                    type_name,
                    field_name,
                    operation_name,
                    fragment_name: *fragment_name,
                    provider,
                    via,
                    guard_target: match position.resolver {
                        Some(resolver) => format!("`{resolver}`"),
                        None => "this".to_string(),
                    },
                }
            }
        };
        self.errors.push(Diagnostic::error(message, location));
    }

    /// How an operation that is not a refetch query can avoid reading the case
    /// at read time. Only a query takes `@exec_time_resolvers`.
    fn remedy(&self, position: Position<'program>) -> String {
        let operation_name = self.operation.name.item.0;
        let target = match position.resolver {
            Some(resolver) => format!("`{resolver}`"),
            None => "this".to_string(),
        };
        let guard = if position.guard_in_operation {
            format!(
                "Move {target} into a fragment and select it there under `@include(if: $__relay_exec_time)`"
            )
        } else {
            format!("Select {target} under `@include(if: $__relay_exec_time)`")
        };
        if self.operation.kind != OperationKind::Query {
            return format!("{guard}, or select this inside `... on` the server types.");
        }
        // With `enabledProvider`, the flag alone leaves the operation gated, so
        // the guard is still needed.
        if self.has_exec_time_directive_without_flag && self.exec_time_directive_has_provider {
            return format!("{guard}, or select this inside `... on` the server types.");
        }
        if self.has_exec_time_directive_without_flag {
            return format!(
                "{guard}, turn on `enable_exec_time_resolvers_directive` for this project so that normalization computes the resolvers of `{operation_name}`, or select this inside `... on` the server types."
            );
        }
        if self.provider.is_some() {
            return format!(
                "{guard}, remove `enabledProvider` from the `@exec_time_resolvers` of `{operation_name}`, or select this inside `... on` the server types."
            );
        }
        format!(
            "{guard}, add `@exec_time_resolvers` without `enabledProvider` to `{operation_name}`, or select this inside `... on` the server types."
        )
    }
}

fn document_name(fragment: &FragmentDefinition) -> FragmentDefinitionName {
    fragment.name.item
}

/// The name and authored location of the first field among `selections`, of
/// the first field served by a resolver when `resolvers_only`.
fn first_field(
    schema: &SDLSchema,
    selections: &[Selection],
    resolvers_only: bool,
) -> Option<(StringKey, Location)> {
    for selection in selections {
        let definition = match selection {
            Selection::ScalarField(field) => field.definition,
            Selection::LinkedField(field) => field.definition,
            Selection::Condition(condition) => {
                if let Some(found) = first_field(schema, &condition.selections, resolvers_only) {
                    return Some(found);
                }
                continue;
            }
            Selection::InlineFragment(fragment) => {
                if let Some(found) = first_field(schema, &fragment.selections, resolvers_only) {
                    return Some(found);
                }
                continue;
            }
            Selection::FragmentSpread(_) => continue,
        };
        let field = schema.field(definition.item);
        if !resolvers_only || resolver_directive(field).is_some() {
            return Some((field.name.item, definition.location));
        }
    }
    None
}

/// Whether `condition` includes its selections only at exec time:
/// `@include(if: $__relay_exec_time)`.
fn is_exec_time_guard(condition: &Condition) -> bool {
    matches!(&condition.value, ConditionValue::Variable(variable) if variable.name.item == *EXEC_TIME_VARIABLE_NAME)
        && condition.passing_value
}
