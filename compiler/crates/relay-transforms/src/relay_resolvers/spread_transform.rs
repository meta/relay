/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

use std::collections::HashMap;
use std::sync::Arc;

use common::ArgumentName;
use common::Diagnostic;
use common::DiagnosticsResult;
use common::Location;
use common::NamedItem;
use common::WithLocation;
use graphql_ir::Argument;
use graphql_ir::Condition;
use graphql_ir::Directive;
use graphql_ir::Field as IrField;
use graphql_ir::FragmentDefinitionName;
use graphql_ir::FragmentSpread;
use graphql_ir::InlineFragment;
use graphql_ir::LinkedField;
use graphql_ir::Program;
use graphql_ir::ScalarField;
use graphql_ir::Selection;
use graphql_ir::Transformed;
use graphql_ir::TransformedValue;
use graphql_ir::Transformer;
use graphql_ir::Value;
use graphql_ir::VariableName;
use intern::string_key::StringKey;
use relay_schema::client_implementors::has_client_implementors;
use relay_schema::definitions::weak_object_instance_field;
use schema::FieldID;
use schema::InterfaceID;
use schema::SDLSchema;
use schema::Schema;
use schema::Type;

use super::RelayResolverFieldMetadata;
use super::RelayResolverMetadata;
use super::ResolversPipeline;
use super::ShadowReturnMarker;
use super::ValidationMessage;
use crate::ClientEdgeMetadata;
use crate::ClientImplementorCaseDirective;
use crate::NO_INLINE_DIRECTIVE_NAME;
use crate::client_implementor_cases::is_client_field;
use crate::client_implementor_cases::is_client_implementor_case;

/// Convert fields with attached Relay Resolver metadata into the fragment
/// spread of their data dependencies (root fragment). Their
/// `RelayResolverMetadata` IR directive is left attached to this fragment
/// spread.
///
/// For resolvers without a fragment (for example @live resolvers that read from
/// an external source, or resolvers which are simply a function of their
/// arguments) the field is transformed into a `__id` field with the
/// `RelayResolverMetadata` IR directive attached.
///
/// # Magic-fragment transplant
///
/// For a magic fragment (one declaring a `@returnFragment`), the consumer's
/// selections on the resolver field must be fetched from the *shadowed server
/// field* in the main operation -- not via a waterfall. To do that, this
/// transform transplants the consumer's selections onto a per-use-site copy of
/// the shadowed field from the resolver's (generic, shared) root fragment.
///
/// Concretely, when a client-edge use site backs a magic fragment, we keep the
/// backing field as the named spread of the generic root fragment (so the
/// resolver still reads `page { id __typename }` for its pointer) and *also*
/// emit a sibling copy of the shadowed field filled with `id __typename` plus
/// the consumer's selections (e.g. `page { id __typename title }`). After
/// fragment inlining and flatten, the generic `page { id __typename }` and the
/// transplanted `page { id __typename title }` merge into one server selection
/// in the main operation. The shared root fragment definition is never mutated,
/// so distinct consumers (one selecting `title`, another `name`) do not collide.
///
/// The transplant is **normalization-only**: it is emitted only when this
/// transform feeds the operation pipeline (`ResolversPipeline::ForOperation`).
/// In the reader/typegen pipeline (`ResolversPipeline::ForReader`) it is
/// suppressed, so the transplanted server field never reaches the consumer's
/// reader fragment or its public `$data` (which would defeat masking -- the
/// consumer selected only the resolver field, not `page`). The consumer reads
/// its selections off the resolver-returned pointer via the client-edge reader
/// selections.
pub(super) fn relay_resolvers_spread_transform(
    program: &Program,
    pipeline: ResolversPipeline,
    enable_shadow_resolvers: bool,
) -> DiagnosticsResult<Program> {
    let mut transform =
        RelayResolverSpreadTransform::new(program, pipeline, enable_shadow_resolvers);
    let next_program = transform
        .transform_program(program)
        .replace_or_else(|| program.clone());

    if transform.errors.is_empty() {
        Ok(next_program)
    } else {
        Err(transform.errors)
    }
}

struct RelayResolverSpreadTransform<'program> {
    program: &'program Program,
    pipeline: ResolversPipeline,
    /// Whether the magic-fragment feature is enabled for this project. When
    /// false, the shadow transplant is skipped entirely and this transform
    /// produces the same output as the default (lazy) selection transform.
    enable_shadow_resolvers: bool,
    errors: Vec<Diagnostic>,
}

impl<'program> RelayResolverSpreadTransform<'program> {
    fn new(
        program: &'program Program,
        pipeline: ResolversPipeline,
        enable_shadow_resolvers: bool,
    ) -> Self {
        Self {
            program,
            pipeline,
            enable_shadow_resolvers,
            errors: Default::default(),
        }
    }

    fn transformed_field(&self, field: &impl IrField) -> Option<Selection> {
        RelayResolverFieldMetadata::find(field.directives()).map(|field_metadata| {
            let fragment_definition = field_metadata.fragment_name.map(|fragment_name| {
                self.program
                    .fragment(fragment_name)
                    .expect("Previous validation passes ensured this exists.")
            });

            let (fragment_arguments, field_arguments) =
                field.arguments().iter().cloned().partition(|arg| {
                    if let Some(fragment_definition) = fragment_definition {
                        fragment_definition
                            .variable_definitions
                            .named(VariableName(arg.name.item.0))
                            .is_some()
                    } else {
                        false
                    }
                });

            let resolver_metadata = RelayResolverMetadata {
                import_path: field_metadata.import_path,
                import_name: field_metadata.import_name,
                field_alias: field.alias().map(|field_alias| field_alias.item),
                field_path: field_metadata.field_path,
                field_id: field.definition().item,
                field_arguments,
                fragment_arguments: fragment_arguments.clone(),
                live: field_metadata.live,
                output_type_info: field_metadata.output_type_info.clone(),
                fragment_data_injection_mode: field_metadata
                    .fragment_data_injection_mode
                    .as_ref()
                    .map(|injection_mode| {
                        (
                            self.program
                                .fragment(
                                    field_metadata
                                        .fragment_name
                                        .expect("Expected to have a fragment name."),
                                )
                                .expect("Expect to have a fragment node.")
                                .name,
                            *injection_mode,
                        )
                    }),
                type_confirmed: field_metadata.type_confirmed,
                resolver_type: field_metadata.resolver_type,
                return_fragment: field_metadata.return_fragment,
            };

            let mut new_directives: Vec<Directive> = vec![resolver_metadata.into()];

            for directive in field.directives() {
                if directive.name.item != RelayResolverFieldMetadata::directive_name() {
                    new_directives.push(directive.clone())
                }
            }
            if let Some(fragment_definition) = fragment_definition {
                Selection::FragmentSpread(Arc::new(FragmentSpread {
                    fragment: fragment_definition.name,
                    arguments: fragment_arguments,
                    signature: Some(fragment_definition.as_ref().into()),
                    directives: new_directives,
                }))
            } else {
                Selection::ScalarField(Arc::new(ScalarField {
                    alias: None,
                    definition: WithLocation::generated(self.program.schema.clientid_field()),
                    arguments: vec![],
                    directives: new_directives,
                }))
            }
        })
    }

    /// If `metadata` describes a magic-fragment client edge, build the
    /// per-use-site transplant: a clone of the **full root-fragment path** from
    /// the root fragment down to the shadowed server field, with the consumer's
    /// selections appended at the marked field. Returns `None` for non-magic-fragment
    /// edges, or an empty `Vec` only on a (validated) error.
    ///
    /// The returned selections are emitted as *siblings* of the client-edge
    /// inline fragment so the transplanted server path lands in the consumer
    /// operation's normalization and merges (via flatten) with the generic
    /// path contributed by the root-fragment spread.
    ///
    /// The whole ancestor path matters. For a root fragment
    /// `User { friend { page { ...Return } } }` the transplant must reproduce
    /// `friend { page { id __typename <consumer> } }`, not just `page { ... }`
    /// hoisted to the consumer parent (which would normalize the consumer's
    /// selections under the wrong record). Likewise every ancestor's directives
    /// and arguments (e.g. `page @include(if: $x)` for an incremental-migration
    /// gate, or `friend(first: 1)`) must be preserved -- dropping an `@include`
    /// would fetch the shadowed field unconditionally.
    ///
    /// At the marked (leaf) field we keep its own pointer selections
    /// (`id __typename`, auto-injected by the shadow-return conversion), append
    /// the consumer's selections re-bound onto the shadowed server type, and
    /// strip the `ShadowReturnMarker` so the transplant is a plain server path.
    ///
    /// The consumer authors its selections against the resolver's interface
    /// return type (e.g. `IPage`), so each field is re-bound by name onto the
    /// shadowed server type (e.g. `Page`). Without this the consumer's `title`
    /// would carry the client-extension `IPage.title` field id and be emitted as
    /// a `ClientExtension` (never fetched from the server).
    fn shadow_transplant_selection(
        &mut self,
        metadata: &ClientEdgeMetadata<'_>,
    ) -> Option<Vec<Selection>> {
        let field_metadata = RelayResolverFieldMetadata::find(metadata.backing_field.directives())?;
        let return_fragment = field_metadata.return_fragment?;

        // A shadow resolver whose return type is a concrete `@weak` model reads
        // its value INLINE off `<Type>____relay_model_instance` (the value is
        // produced by the resolver, not fetched from the server), so there is
        // nothing to transplant onto a shadowed server field. Skip the transplant
        // entirely: rebinding the consumer's selections (which are weak-model
        // resolver fields carrying `RelayResolverFieldMetadata`) onto the shadowed
        // server type would emit unlowerable resolver metadata on a server field.
        let edge_to_type = self
            .program
            .schema
            .field(metadata.linked_field.definition.item)
            .type_
            .inner();
        if weak_object_instance_field(self.program.schema.as_ref(), edge_to_type).is_some() {
            return None;
        }

        // The transplant runs whether or not the edge is in refetch mode (a
        // `@waterfall` magic fragment, whose client-edge transform produced a
        // non-empty `server_object_operations`). Transplanting the consumer's
        // selections onto the shadowed server field serves the common case --
        // where the resolver's returned pointer targets the same record the
        // shadowed field navigates to -- entirely from the store, with no network
        // roundtrip. When the pointer instead targets a different server object,
        // that record's selections are absent from the store and the runtime's
        // client-edge availability check fires the generated `ClientEdgeQuery`
        // refetch. The two arms are complementary: the transplant populates the
        // common case, the refetch backstops the cross-object case, and the
        // runtime selects between them per read based on what is in the store.

        // A magic fragment (one declaring a `@returnFragment`) is required to
        // also declare a `@rootFragment` (enforced by the
        // `ReturnFragmentRequiresRootFragment` validation), and that root fragment
        // must be present in the program by the time the spread transform runs. A
        // missing root fragment here is therefore a compiler bug, not a user
        // error -- fail loudly rather than silently skipping the transplant
        // (which would drop the consumer's selections from the main operation).
        let root_fragment_name = field_metadata
            .fragment_name
            .expect("shadow resolver with @returnFragment must declare a @rootFragment");
        let root_fragment = self.program.fragment(root_fragment_name).unwrap_or_else(|| {
            panic!("shadow resolver root fragment `{root_fragment_name}` must be present in the program")
        });

        // Clone the root-fragment path from the root down to the shadowed field
        // (the one carrying the `ShadowReturnMarker` for this resolver's return
        // fragment), preserving every ancestor linked field / inline fragment /
        // condition along with its directives and arguments. At the marked field
        // we splice in the consumer's selections (re-bound onto the shadowed
        // server type). Returns `None` (no marker found) only on an unvalidated
        // magic-fragment edge, which earlier validation passes prevent.
        // Build a substitution from the root fragment's local argument variables
        // (its `@argumentDefinitions`) to the values the consumer passed at the
        // resolver field call site. The transplanted path is spliced directly into
        // the consumer operation, so a reference to a root-fragment argument
        // variable (e.g. `nodes(ids: $ids)`) must be remapped to the consumer's
        // value (e.g. `$mixed_campaign_group_ids`); otherwise the operation would
        // reference an undefined variable. For the normal (non-transplanted)
        // resolver spread this remapping is done by `apply_fragment_arguments`.
        let no_field_arguments = Vec::new();
        let field_arguments = match metadata.backing_field {
            Selection::LinkedField(field) => &field.arguments,
            Selection::ScalarField(field) => &field.arguments,
            _ => &no_field_arguments,
        };
        let argument_substitutions: HashMap<VariableName, Value> = root_fragment
            .variable_definitions
            .iter()
            .filter_map(|variable_definition| {
                field_arguments
                    .named(ArgumentName(variable_definition.name.item.0))
                    .map(|argument| (variable_definition.name.item, argument.value.item.clone()))
            })
            .collect();

        self.clone_shadowed_path(
            &root_fragment.selections,
            return_fragment.item,
            &metadata.linked_field.selections,
            &argument_substitutions,
        )
    }

    /// Clone the path through `selections` that reaches the field marked with the
    /// `ShadowReturnMarker` for `return_fragment_name`, preserving every ancestor
    /// linked field / inline fragment / condition (and their directives and
    /// arguments). At the marked field, replace its selections with its own
    /// pointer selections (`id __typename`) plus the consumer's selections
    /// re-bound onto the shadowed server type, and strip the marker directive.
    ///
    /// Returns `Some` with the cloned path's top-level selections when the marked
    /// field is found on this branch, `None` otherwise. Only the path to the
    /// marker is cloned -- sibling selections that don't reach the marker are
    /// dropped (the resolver's own pointer read still comes from the generic
    /// root-fragment spread).
    fn clone_shadowed_path(
        &mut self,
        selections: &[Selection],
        return_fragment_name: FragmentDefinitionName,
        consumer_selections: &[Selection],
        argument_substitutions: &HashMap<VariableName, Value>,
    ) -> Option<Vec<Selection>> {
        for selection in selections {
            match selection {
                Selection::LinkedField(field) => {
                    if let Some(marker) = ShadowReturnMarker::find(&field.directives)
                        && marker.return_fragment_name == return_fragment_name
                    {
                        // This is the shadowed (leaf) field. Re-bind the
                        // consumer's selections onto the shadowed server type,
                        // append them to the field's own pointer selections
                        // (`id __typename`), and strip the marker.
                        let shadowed_type = self
                            .program
                            .schema
                            .field(field.definition.item)
                            .type_
                            .inner();
                        let rebound =
                            self.rebind_selections(consumer_selections, shadowed_type, false);

                        let mut new_selections = field.selections.clone();
                        new_selections.extend(rebound);

                        let directives = field
                            .directives
                            .iter()
                            .filter(|directive| {
                                directive.name.item != ShadowReturnMarker::directive_name()
                            })
                            .cloned()
                            .collect();

                        return Some(vec![Selection::LinkedField(Arc::new(LinkedField {
                            directives,
                            selections: new_selections,
                            arguments: substitute_arguments(
                                &field.arguments,
                                argument_substitutions,
                            ),
                            ..field.as_ref().clone()
                        }))]);
                    }
                    // Recurse: if the marker is somewhere below this linked
                    // field, clone this ancestor (keeping its directives and
                    // arguments) wrapping the cloned sub-path.
                    if let Some(inner) = self.clone_shadowed_path(
                        &field.selections,
                        return_fragment_name,
                        consumer_selections,
                        argument_substitutions,
                    ) {
                        return Some(vec![Selection::LinkedField(Arc::new(LinkedField {
                            selections: inner,
                            arguments: substitute_arguments(
                                &field.arguments,
                                argument_substitutions,
                            ),
                            ..field.as_ref().clone()
                        }))]);
                    }
                }
                Selection::InlineFragment(fragment) => {
                    if let Some(inner) = self.clone_shadowed_path(
                        &fragment.selections,
                        return_fragment_name,
                        consumer_selections,
                        argument_substitutions,
                    ) {
                        return Some(vec![Selection::InlineFragment(Arc::new(InlineFragment {
                            selections: inner,
                            ..fragment.as_ref().clone()
                        }))]);
                    }
                }
                Selection::Condition(condition) => {
                    if let Some(inner) = self.clone_shadowed_path(
                        &condition.selections,
                        return_fragment_name,
                        consumer_selections,
                        argument_substitutions,
                    ) {
                        return Some(vec![Selection::Condition(Arc::new(Condition {
                            selections: inner,
                            ..condition.as_ref().clone()
                        }))]);
                    }
                }
                Selection::ScalarField(_) | Selection::FragmentSpread(_) => {}
            }
        }
        None
    }

    /// Re-bind a consumer's selection set, authored against the resolver's
    /// interface return type, onto `parent_type` (the shadowed server type).
    /// Scalar and linked fields are looked up by name on `parent_type`; inline
    /// fragments and conditions recurse.
    ///
    /// `drop_incompatible` distinguishes two contexts. For a consumer's DIRECT
    /// selections (`false`) a server inline arm that cannot match the shadowed
    /// type is a genuine mistake and is a focused error. When inline-expanding a
    /// polymorphic INTERFACE spread's body (`true`) such arms are legitimately
    /// dead (the body is reused across every implementor of its interface, only
    /// some of which this field can be) and are silently dropped, and any inline
    /// fragment / condition left empty by dropping its children is pruned.
    fn rebind_selections(
        &mut self,
        selections: &[Selection],
        parent_type: Type,
        drop_incompatible: bool,
    ) -> Vec<Selection> {
        if let Some(interface_id) = client_implementor_cases_interface(selections) {
            return self.rebind_on_server_interface(selections, interface_id, parent_type);
        }
        let mut rebound = Vec::with_capacity(selections.len());
        for selection in selections {
            if let Some(selection) =
                self.rebind_selection(selection, parent_type, drop_incompatible)
            {
                rebound.push(selection);
            }
        }
        rebound
    }

    fn rebind_selection(
        &mut self,
        selection: &Selection,
        parent_type: Type,
        drop_incompatible: bool,
    ) -> Option<Selection> {
        match selection {
            Selection::ScalarField(field) => {
                let field_name = self.program.schema.field(field.definition.item).name.item;
                let definition =
                    self.rebind_field(field_name, parent_type, field.alias_or_name_location())?;
                Some(Selection::ScalarField(Arc::new(ScalarField {
                    definition: WithLocation::new(field.definition.location, definition),
                    ..field.as_ref().clone()
                })))
            }
            Selection::LinkedField(field) => {
                let field_name = self.program.schema.field(field.definition.item).name.item;
                let definition =
                    self.rebind_field(field_name, parent_type, field.alias_or_name_location())?;
                let inner_type = self.program.schema.field(definition).type_.inner();
                let selections =
                    self.rebind_selections(&field.selections, inner_type, drop_incompatible);
                // A linked field whose children all dropped (interface-spread
                // expansion) must be pruned: an empty selection set on a composite
                // field is invalid GraphQL and `flatten` will not remove it.
                if drop_incompatible && selections.is_empty() {
                    return None;
                }
                Some(Selection::LinkedField(Arc::new(LinkedField {
                    definition: WithLocation::new(field.definition.location, definition),
                    selections,
                    ..field.as_ref().clone()
                })))
            }
            Selection::InlineFragment(fragment) => {
                // Sort an explicit type condition before rebinding. The transplant
                // fetches from the shadowed SERVER field, so where an inline
                // fragment goes depends on how its type condition relates to that
                // server type:
                //
                // - A client-extension arm (e.g. `... on ClientPage`) is DROPPED
                //   from the transplant. Its data is read through the model edge
                //   minted in `client_edges` and stays in the client-edge reader
                //   selections; the server never returns that client-only
                //   refinement, so transplanting it would be meaningless.
                // - A server arm that overlaps the shadowed type is transplanted
                //   unchanged.
                // - A non-overlapping server arm (e.g. `... on Comment` under a
                //   `Page`) can never match: a genuine error in a direct selection,
                //   but a dead polymorphic arm (silently dropped) when expanding an
                //   interface spread's body (`drop_incompatible`).
                if let Some(type_condition) = fragment.type_condition {
                    match self.classify_inline_fragment_type(type_condition, parent_type) {
                        MagicFragmentInlineFragmentArm::DropClientExtension => return None,
                        MagicFragmentInlineFragmentArm::Incompatible => {
                            if drop_incompatible {
                                return None;
                            }
                            self.errors.push(Diagnostic::error(
                                ValidationMessage::ShadowReturnIncompatibleInlineFragmentType {
                                    type_condition_name: self
                                        .program
                                        .schema
                                        .get_type_name(type_condition),
                                    type_name: self.program.schema.get_type_name(parent_type),
                                },
                                fragment.spread_location,
                            ));
                            return None;
                        }
                        MagicFragmentInlineFragmentArm::TransplantServer => {}
                    }
                }
                // Keep the type condition; recurse using it (or the parent type
                // when there is no explicit condition).
                let inner_type = fragment.type_condition.unwrap_or(parent_type);
                let selections =
                    self.rebind_selections(&fragment.selections, inner_type, drop_incompatible);
                // When dropping dead arms (interface-spread expansion), an inline
                // fragment whose children all dropped is pruned -- a typed empty
                // inline fragment would otherwise survive `flatten` into the
                // normalized operation.
                if drop_incompatible && selections.is_empty() {
                    return None;
                }
                Some(Selection::InlineFragment(Arc::new(InlineFragment {
                    selections,
                    ..fragment.as_ref().clone()
                })))
            }
            Selection::Condition(condition) => {
                let selections =
                    self.rebind_selections(&condition.selections, parent_type, drop_incompatible);
                if drop_incompatible && selections.is_empty() {
                    return None;
                }
                Some(Selection::Condition(Arc::new(Condition {
                    selections,
                    ..condition.as_ref().clone()
                })))
            }
            Selection::FragmentSpread(spread) => {
                // A consumer fragment spread is INLINE-EXPANDED into the
                // transplanted server selection (so its fields are fetched in
                // the main operation), while the reader pipeline keeps the spread
                // verbatim (so masking / `$fragmentSpreads` / the child
                // `useFragment` are unaffected -- this transform's reader pass
                // never reaches here). Concrete-typed and interface-typed spreads
                // are supported; the gates below reject cases (`@arguments`,
                // `@no_inline`, union type conditions) that would miscompile.
                let Some(fragment) = self.program.fragment(spread.fragment.item) else {
                    // The fragment is guaranteed present once validation has run;
                    // a missing one here is a compiler bug. Drop the spread rather
                    // than panicking so a malformed program degrades gracefully.
                    return None;
                };

                // The inlined operation copy and the kept reader spread resolve
                // variables at different pipeline stages (`apply_fragment_arguments`
                // runs after this transform), so a parameterized spread can
                // silently miscompile. Reject any `@arguments` or argument
                // definitions.
                if !spread.arguments.is_empty() || !fragment.variable_definitions.is_empty() {
                    self.errors.push(Diagnostic::error(
                        ValidationMessage::ShadowReturnFragmentSpreadArgumentsUnsupported {
                            fragment_name: spread.fragment.item.0,
                        },
                        spread.fragment.location,
                    ));
                    return None;
                }

                // A `@no_inline` fragment is promoted to its own normalization
                // operation and never inlined, so its fields would not reach the
                // transplanted server selection.
                if fragment
                    .directives
                    .named(*NO_INLINE_DIRECTIVE_NAME)
                    .is_some()
                {
                    self.errors.push(Diagnostic::error(
                        ValidationMessage::ShadowReturnFragmentSpreadNoInlineUnsupported {
                            fragment_name: spread.fragment.item.0,
                        },
                        spread.fragment.location,
                    ));
                    return None;
                }

                // Route by the spread's type condition.
                //
                // - A CONCRETE (object) type condition classifies and routes
                //   exactly like the `InlineFragment` arm above.
                // - An INTERFACE type condition is inline-expanded. By the time
                //   this transform runs, `relay_resolvers_abstract_types` (run
                //   earlier, in `apply_common_transforms`) has already fanned a
                //   mixed-interface fragment's body into one concrete inline arm
                //   per implementor. Re-binding that body onto the shadowed server
                //   type lets the per-arm classification above transplant the
                //   server arms and drop the client-extension arms (which are read
                //   through the model edge minted in `client_edges`). A server
                //   interface with client implementors has cases instead
                //   (`rebind_on_server_interface`).
                // - A UNION type condition is not yet supported.
                match fragment.type_condition {
                    Type::Interface(_) => {
                        // The spread can be valid on the field while overlapping
                        // the return interface only through a client implementor
                        // (e.g. a fragment on an unrelated interface that shares
                        // just the client model). Transplant onto the server only
                        // when the spread's interface actually overlaps the
                        // shadowed server type; otherwise it contributes nothing to
                        // the server operation and is served entirely by the model
                        // edge.
                        if !self
                            .program
                            .schema
                            .are_overlapping_types(fragment.type_condition, parent_type)
                        {
                            return None;
                        }
                        // The body is polymorphic over the interface's implementors,
                        // so expand it in drop-incompatible mode: arms for other
                        // implementors (and client-extension arms) are dropped, only
                        // what applies to the shadowed server type is transplanted.
                        let selections = match fragment.type_condition {
                            Type::Interface(interface_id)
                                if has_client_implementors(
                                    &self.program.schema,
                                    fragment.type_condition,
                                ) =>
                            {
                                self.rebind_on_server_interface(
                                    &fragment.selections,
                                    interface_id,
                                    parent_type,
                                )
                            }
                            _ => self.rebind_selections(&fragment.selections, parent_type, true),
                        };
                        if selections.is_empty() {
                            return None;
                        }
                        // A type-condition-less inline fragment groups the
                        // (already concretely-typed) fanned arms into the single
                        // selection this arm returns; `flatten` dissolves it before
                        // codegen.
                        Some(Selection::InlineFragment(Arc::new(InlineFragment {
                            type_condition: None,
                            directives: vec![],
                            selections,
                            spread_location: spread.fragment.location,
                        })))
                    }
                    Type::Union(_) => {
                        self.errors.push(Diagnostic::error(
                            ValidationMessage::ShadowReturnFragmentSpreadUnionTypeUnsupported {
                                fragment_name: spread.fragment.item.0,
                                type_condition_name: self
                                    .program
                                    .schema
                                    .get_type_name(fragment.type_condition),
                            },
                            spread.fragment.location,
                        ));
                        None
                    }
                    _ => match self
                        .classify_inline_fragment_type(fragment.type_condition, parent_type)
                    {
                        MagicFragmentInlineFragmentArm::DropClientExtension => None,
                        MagicFragmentInlineFragmentArm::Incompatible => {
                            if drop_incompatible {
                                return None;
                            }
                            self.errors.push(Diagnostic::error(
                                ValidationMessage::ShadowReturnIncompatibleInlineFragmentType {
                                    type_condition_name: self
                                        .program
                                        .schema
                                        .get_type_name(fragment.type_condition),
                                    type_name: self.program.schema.get_type_name(parent_type),
                                },
                                spread.fragment.location,
                            ));
                            None
                        }
                        MagicFragmentInlineFragmentArm::TransplantServer => {
                            let selections = self.rebind_selections(
                                &fragment.selections,
                                fragment.type_condition,
                                drop_incompatible,
                            );
                            // Prune when expanding a polymorphic body left this
                            // concrete arm empty (its children all dropped) -- a
                            // typed empty inline fragment is invalid and survives
                            // `flatten`.
                            if drop_incompatible && selections.is_empty() {
                                return None;
                            }
                            Some(Selection::InlineFragment(Arc::new(InlineFragment {
                                type_condition: Some(fragment.type_condition),
                                directives: vec![],
                                selections,
                                spread_location: spread.fragment.location,
                            })))
                        }
                    },
                }
            }
        }
    }

    /// Look up `field_name` on `parent_type` (the shadowed server type),
    /// returning its `FieldID`. Reports a focused error if the shadowed type does
    /// not define the field.
    fn rebind_field(
        &mut self,
        field_name: StringKey,
        parent_type: Type,
        location: Location,
    ) -> Option<FieldID> {
        match self.program.schema.named_field(parent_type, field_name) {
            Some(field_id) => Some(field_id),
            None => {
                self.errors.push(Diagnostic::error(
                    ValidationMessage::ShadowReturnSelectionNotOnShadowedType {
                        field_name,
                        type_name: self.program.schema.get_type_name(parent_type),
                    },
                    location,
                ));
                None
            }
        }
    }

    /// Transplants selections on a server interface with client implementors.
    /// They go in a refinement on the interface, so the server answers whether
    /// its object implements it: the operation's `clientAbstractTypes` lists
    /// only the client implementors. A server type's case goes in a refinement
    /// on that type, without the plain fields the interface refinement already
    /// fetches; a client type's case is read through the model edge, so it is
    /// dropped. Both refinements are placed directly in the shadowed selection:
    /// a wrapping inline fragment with no type would make the server answer
    /// `__is<FieldType>` too.
    fn rebind_on_server_interface(
        &mut self,
        selections: &[Selection],
        interface_id: InterfaceID,
        parent_type: Type,
    ) -> Vec<Selection> {
        let interface_type = Type::Interface(interface_id);
        if !self
            .program
            .schema
            .are_overlapping_types(interface_type, parent_type)
        {
            return vec![];
        }
        let schema = Arc::clone(&self.program.schema);
        let mut on_interface = vec![];
        let mut cases = vec![];
        for selection in selections {
            if let Selection::InlineFragment(case) = selection
                && is_client_implementor_case(case)
            {
                cases.push(case);
                continue;
            }
            // The interface's client fields are never fetched.
            if let Some(rebound) = self.rebind_selection(selection, interface_type, true)
                && !is_client_field(&schema, &rebound)
            {
                on_interface.push(rebound);
            }
        }
        let mut case_refinements = vec![];
        for case in cases {
            let Some(case_type) = case.type_condition else {
                continue;
            };
            match self.classify_inline_fragment_type(case_type, parent_type) {
                MagicFragmentInlineFragmentArm::TransplantServer => {}
                MagicFragmentInlineFragmentArm::DropClientExtension
                | MagicFragmentInlineFragmentArm::Incompatible => continue,
            }
            let mut case_selections = vec![];
            for selection in self.rebind_selections(&case.selections, case_type, true) {
                if !fetches_same_plain_scalar(&schema, &on_interface, &selection) {
                    case_selections.push(selection);
                }
            }
            if !case_selections.is_empty() {
                case_refinements.push(refinement(case_type, case_selections, case.spread_location));
            }
        }
        let mut rebound = Vec::with_capacity(case_refinements.len() + 1);
        if !on_interface.is_empty() {
            rebound.push(refinement(
                interface_type,
                on_interface,
                Location::generated(),
            ));
        }
        rebound.extend(case_refinements);
        rebound
    }

    /// Classify how an inline fragment's `type_condition` relates to
    /// `parent_type` (the shadowed server type, e.g. `Page`) for the transplant.
    ///
    /// The shadowed return type is an interface that can be implemented by both
    /// server types and client-extension model types. `relay_resolvers_abstract_types`
    /// expands the consumer's selection into one typed inline arm per concrete
    /// implementor, so the transplant sees each arm separately:
    ///
    /// - A client-extension condition (e.g. `... on ClientPage`,
    ///   `is_extension_type`) is DROPPED from the transplant — it is satisfied by
    ///   the model edge minted in `client_edges` and read off the client-edge
    ///   reader selections, never fetched from the server.
    /// - A server condition that overlaps the shadowed type is TRANSPLANTED.
    /// - A server condition that can never match (e.g. `... on Comment` under a
    ///   `Page`) is INCOMPATIBLE — a genuine error.
    fn classify_inline_fragment_type(
        &self,
        type_condition: Type,
        parent_type: Type,
    ) -> MagicFragmentInlineFragmentArm {
        let schema = &self.program.schema;
        if schema.is_extension_type(type_condition) {
            MagicFragmentInlineFragmentArm::DropClientExtension
        } else if schema.are_overlapping_types(type_condition, parent_type) {
            MagicFragmentInlineFragmentArm::TransplantServer
        } else {
            MagicFragmentInlineFragmentArm::Incompatible
        }
    }
}

/// How a consumer inline-fragment arm relates to the shadowed server type during
/// the magic-fragment transplant. See `classify_inline_fragment_type`.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum MagicFragmentInlineFragmentArm {
    /// Client-extension refinement: dropped from the server transplant, served by
    /// the model edge minted in `client_edges`.
    DropClientExtension,
    /// Server refinement overlapping the shadowed type: transplanted unchanged.
    TransplantServer,
    /// Server refinement that can never match the shadowed type: a genuine error.
    Incompatible,
}

impl<'ir> Transformer<'ir> for RelayResolverSpreadTransform<'_> {
    const NAME: &'static str = "RelayResolversSpreadTransform";
    const VISIT_ARGUMENTS: bool = false;
    const VISIT_DIRECTIVES: bool = false;

    fn transform_selections(
        &mut self,
        selections: &'ir [Selection],
    ) -> TransformedValue<Vec<Selection>> {
        // Lazy strategy mirroring the base `Transformer::transform_list`: keep
        // `next_selections` as `None` until a change is actually produced, then
        // back-fill the already-kept prefix and switch to eager. This transform
        // runs over every selection set in the program on each of the
        // reader/operation/typegen passes, so the common no-op case must stay
        // zero-allocation (the previous `Vec::with_capacity` + per-`Keep` clone
        // allocated for every selection set regardless of whether anything
        // changed).
        let mut next_selections: Option<Vec<Selection>> = None;
        for (index, selection) in selections.iter().enumerate() {
            // For a magic-fragment client edge, emit the transplant copy of the
            // shadowed server field as a sibling of the (normally-transformed)
            // client-edge inline fragment, so the consumer's selections reach
            // the main operation's normalization (merging via flatten with the
            // generic `page { id __typename }` from the root-fragment spread).
            //
            // This is NORMALIZATION-ONLY: we only emit the transplant in the
            // operation pipeline (`ForOperation`). In the reader/typegen pipeline
            // (`ForReader`) the transplant is suppressed so it stays out of the
            // reader fragment and the consumer's public `$data` -- there the
            // consumer reads its selections off the resolver-returned pointer via
            // the client-edge reader selections, never off this sibling field.
            // Emitting it in the reader would pollute `$data` and defeat masking.
            //
            // Gated on `enable_shadow_resolvers` so non-adopting projects pay
            // nothing here (no `ClientEdgeMetadata::find` / transplant probe per
            // inline fragment): a valid magic fragment can only exist when the
            // feature is enabled.
            if self.enable_shadow_resolvers
                && self.pipeline == ResolversPipeline::ForOperation
                && let Selection::InlineFragment(fragment) = selection
                && let Some(metadata) = ClientEdgeMetadata::find(fragment)
                && let Some(transplant) = self.shadow_transplant_selection(&metadata)
            {
                let next = next_selections.get_or_insert_with(|| selections[..index].to_vec());
                let transformed = self
                    .transform_inline_fragment(fragment)
                    .unwrap_or_else(|| selection.clone());
                next.push(transformed);
                // `transplant` is the cloned root-fragment path (a single
                // top-level selection wrapping the shadowed field's ancestor
                // chain), spliced as a sibling so it normalizes into the
                // consumer operation alongside the generic root-fragment spread.
                // It copies the consumer's selections unlowered, so it gets the
                // visit every other selection gets: without it, a resolver on the
                // shadowed server type stays a bare client extension, which exec
                // time never computes and whose root fragment read time never
                // fetches.
                let transplant = self
                    .transform_selections(&transplant)
                    .replace_or_else(|| transplant);
                next.extend(transplant);
                continue;
            }
            match self.transform_selection(selection) {
                Transformed::Keep => {
                    if let Some(next) = next_selections.as_mut() {
                        next.push(selection.clone());
                    }
                }
                Transformed::Delete => {
                    next_selections.get_or_insert_with(|| selections[..index].to_vec());
                }
                Transformed::Replace(replacement) => {
                    next_selections
                        .get_or_insert_with(|| selections[..index].to_vec())
                        .push(replacement);
                }
            }
        }
        match next_selections {
            Some(next) => TransformedValue::Replace(next),
            None => TransformedValue::Keep,
        }
    }

    fn transform_scalar_field(&mut self, field: &ScalarField) -> Transformed<Selection> {
        match self.transformed_field(field) {
            Some(selection) => Transformed::Replace(selection),
            None => Transformed::Keep,
        }
    }

    fn transform_linked_field(&mut self, field: &'ir LinkedField) -> Transformed<Selection> {
        match self.transformed_field(field) {
            Some(selection) => Transformed::Replace(selection),
            None => self.default_transform_linked_field(field),
        }
    }

    fn transform_inline_fragment(
        &mut self,
        fragment: &'ir graphql_ir::InlineFragment,
    ) -> Transformed<Selection> {
        match ClientEdgeMetadata::find(fragment) {
            Some(client_edge_metadata) => {
                let backing_id_field = self
                    .transform_selection(client_edge_metadata.backing_field)
                    .unwrap_or_else(|| client_edge_metadata.backing_field.clone());

                let selections_field = self
                    .default_transform_linked_field(client_edge_metadata.linked_field)
                    .unwrap_or_else(|| {
                        Selection::LinkedField(Arc::new(client_edge_metadata.linked_field.clone()))
                    });

                let selections = vec![backing_id_field, selections_field];

                Transformed::Replace(Selection::InlineFragment(Arc::new(InlineFragment {
                    selections,
                    ..fragment.clone()
                })))
            }
            None => self.default_transform_inline_fragment(fragment),
        }
    }
}

/// Substitute references to a resolver root fragment's local argument variables
/// (declared via its `@argumentDefinitions`) with the values the consumer passed
/// at the resolver field call site. Used when the magic-fragment transplant
/// clones the root-fragment path into the consumer operation: a cloned field
/// argument such as `nodes(ids: $ids)` must be rewritten to the consumer's value
/// (e.g. `nodes(ids: $someConsumerVar)`), otherwise the operation references a
/// variable that is not defined there.
fn substitute_arguments(
    arguments: &[Argument],
    argument_substitutions: &HashMap<VariableName, Value>,
) -> Vec<Argument> {
    arguments
        .iter()
        .map(|argument| Argument {
            value: WithLocation::new(
                argument.value.location,
                substitute_value(&argument.value.item, argument_substitutions),
            ),
            ..argument.clone()
        })
        .collect()
}

fn substitute_value(value: &Value, argument_substitutions: &HashMap<VariableName, Value>) -> Value {
    match value {
        Value::Variable(variable) => argument_substitutions
            .get(&variable.name.item)
            .cloned()
            .unwrap_or_else(|| value.clone()),
        Value::Constant(_) => value.clone(),
        Value::List(items) => Value::List(
            items
                .iter()
                .map(|item| substitute_value(item, argument_substitutions))
                .collect(),
        ),
        Value::Object(arguments) => {
            Value::Object(substitute_arguments(arguments, argument_substitutions))
        }
    }
}

/// The interface of the first case among `selections`, when the compiler added
/// cases for a server interface with client implementors here.
fn client_implementor_cases_interface(selections: &[Selection]) -> Option<InterfaceID> {
    for selection in selections {
        if let Selection::InlineFragment(fragment) = selection
            && let Some(case) = ClientImplementorCaseDirective::find(&fragment.directives)
        {
            return Some(case.interface);
        }
    }
    None
}

fn refinement(type_: Type, selections: Vec<Selection>, location: Location) -> Selection {
    Selection::InlineFragment(Arc::new(InlineFragment {
        type_condition: Some(type_),
        directives: vec![],
        selections,
        spread_location: location,
    }))
}

/// Whether one of `fetched` is the same scalar field as `selection`, with no
/// arguments or directives, so fetching it already fetches `selection`.
fn fetches_same_plain_scalar(
    schema: &SDLSchema,
    fetched: &[Selection],
    selection: &Selection,
) -> bool {
    let Selection::ScalarField(field) = selection else {
        return false;
    };
    if !field.arguments.is_empty() || !field.directives.is_empty() {
        return false;
    }
    for fetched_selection in fetched {
        if let Selection::ScalarField(fetched_field) = fetched_selection
            && fetched_field.arguments.is_empty()
            && fetched_field.directives.is_empty()
            && fetched_field.alias_or_name(schema) == field.alias_or_name(schema)
            && schema.field(fetched_field.definition.item).name.item
                == schema.field(field.definition.item).name.item
        {
            return true;
        }
    }
    false
}
