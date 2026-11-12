/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

use std::sync::Arc;

use common::Diagnostic;
use common::DiagnosticsResult;
use common::NamedItem;
use common::PointerAddress;
use common::sync::*;
use dashmap::DashMap;
use graphql_ir::Condition;
use graphql_ir::Directive;
use graphql_ir::FragmentDefinition;
use graphql_ir::FragmentDefinitionNameMap;
use graphql_ir::InlineFragment;
use graphql_ir::LinkedField;
use graphql_ir::OperationDefinition;
use graphql_ir::Program;
use graphql_ir::Selection;
use graphql_ir::TransformedValue;
use graphql_ir::node_identifier::LocationAgnosticPartialEq;
use graphql_ir::node_identifier::NodeIdentifier;
use intern::string_key::StringKey;
use parking_lot::Mutex;
use schema::SDLSchema;
use schema::Schema;
use schema::Type;

use crate::ModuleMetadata;
use crate::RelayLocationAgnosticBehavior;
use crate::ValidationMessage;
use crate::handle_fields::HANDLER_ARG_NAME;
use crate::handle_fields::KEY_ARG_NAME;
use crate::util::CustomMetadataDirectives;
use crate::util::is_relay_custom_inline_fragment_directive;

type SeenLinkedFields = DashMap<PointerAddress, TransformedValue<Arc<LinkedField>>>;
type SeenInlineFragments = DashMap<(PointerAddress, Type), TransformedValue<Arc<InlineFragment>>>;

/// Transform that flattens inline fragments, fragment spreads, merges linked fields selections.
///
/// Inline fragments are inlined (replaced with their selections) when:
/// - The fragment type matches the type of its parent, and it `is_for_codegen`,
///   or the inline fragment doesn't have directives .
///
/// with the exception that it never flattens the inline fragment with relay
/// directives (@defer, @__clientExtensions).
///
/// `should_validate_fragment_spreads` - This flag indicates that we need to
/// validate the fragment spreads selections, and if they can be
/// flattened with other selections. This flag should be passed when
/// we're generating query texts.
pub fn flatten(
    program: &mut Program,
    is_for_codegen: bool,
    should_validate_fragment_spreads: bool,
) -> DiagnosticsResult<()> {
    let mut fragment_for_validation = FragmentDefinitionNameMap::default();
    if should_validate_fragment_spreads {
        for (name, fragment) in &program.fragments {
            fragment_for_validation.insert(*name, Arc::clone(fragment));
        }
    }

    let transform = FlattenTransform::new(
        Arc::clone(&program.schema),
        fragment_for_validation,
        is_for_codegen,
        should_validate_fragment_spreads,
    );
    let errors = Arc::new(Mutex::new(Vec::new()));

    par_iter(&mut program.operations).for_each(|operation| {
        if let Err(err) = transform.transform_operation(operation) {
            errors.lock().extend(err);
        }
    });
    par_iter(&mut program.fragments).for_each(|(_, fragment)| {
        if let Err(err) = transform.transform_fragment(fragment) {
            errors.lock().extend(err);
        }
    });
    let is_errors_empty = { errors.lock().is_empty() };
    if is_errors_empty {
        Ok(())
    } else {
        Err(Arc::try_unwrap(errors).unwrap().into_inner())
    }
}

struct FlattenTransform {
    fragments: FragmentDefinitionNameMap<Arc<FragmentDefinition>>,
    schema: Arc<SDLSchema>,
    is_for_codegen: bool,
    should_validate_fragment_spreads: bool,
    seen_linked_fields: SeenLinkedFields,
    seen_inline_fragments: SeenInlineFragments,
}

impl FlattenTransform {
    fn new(
        schema: Arc<SDLSchema>,
        fragments: FragmentDefinitionNameMap<Arc<FragmentDefinition>>,
        is_for_codegen: bool,
        should_validate_fragment_spreads: bool,
    ) -> Self {
        Self {
            schema,
            fragments,
            is_for_codegen,
            should_validate_fragment_spreads,
            seen_linked_fields: Default::default(),
            seen_inline_fragments: Default::default(),
        }
    }

    fn transform_operation(
        &self,
        operation: &mut Arc<OperationDefinition>,
    ) -> DiagnosticsResult<()> {
        let next_selections = self.transform_selections(&operation.selections, operation.type_)?;
        if let TransformedValue::Replace(next_selections) = next_selections {
            Arc::make_mut(operation).selections = next_selections
        };
        Ok(())
    }

    fn transform_fragment(&self, fragment: &mut Arc<FragmentDefinition>) -> DiagnosticsResult<()> {
        let next_selections =
            self.transform_selections(&fragment.selections, fragment.type_condition)?;
        if let TransformedValue::Replace(next_selections) = next_selections {
            Arc::make_mut(fragment).selections = next_selections
        };
        Ok(())
    }

    fn transform_selections(
        &self,
        selections: &[Selection],
        parent_type: Type,
    ) -> DiagnosticsResult<TransformedValue<Vec<Selection>>> {
        let mut next_selections = Vec::new();
        let mut has_changes = false;
        for (index, selection) in selections.iter().enumerate() {
            let next_selection = self.transform_selection(selection, parent_type)?;
            if let TransformedValue::Replace(next_selection) = next_selection {
                if !has_changes {
                    has_changes = true;
                    next_selections.reserve(selections.len());
                    next_selections.extend(selections.iter().take(index).cloned())
                }
                next_selections.push(next_selection);
            } else if has_changes {
                next_selections.push(selection.clone());
            }
        }

        let mut flattened_selections_for_check = Vec::with_capacity(selections.len());
        self.can_flatten_selections(
            &mut flattened_selections_for_check,
            if has_changes {
                &next_selections
            } else {
                selections
            },
            parent_type,
        )?;

        let mut flattened_selections = Vec::with_capacity(selections.len());
        has_changes = self.flatten_selections(
            &mut flattened_selections,
            if has_changes {
                &next_selections
            } else {
                selections
            },
            parent_type,
        ) || has_changes;

        Ok(if has_changes {
            TransformedValue::Replace(flattened_selections)
        } else {
            TransformedValue::Keep
        })
    }

    fn transform_linked_field(
        &self,
        linked_field: &Arc<LinkedField>,
    ) -> DiagnosticsResult<TransformedValue<Arc<LinkedField>>> {
        let should_cache = Arc::strong_count(linked_field) > 1;
        let key = PointerAddress::new(Arc::as_ref(linked_field));
        if should_cache && let Some(prev) = self.seen_linked_fields.get(&key) {
            return Ok(prev.value().clone());
        }
        let type_ = self
            .schema
            .field(linked_field.definition.item)
            .type_
            .inner();
        let result = self
            .transform_selections(&linked_field.selections, type_)?
            .map(|next_selections| {
                Arc::new(LinkedField {
                    alias: linked_field.alias,
                    definition: linked_field.definition,
                    arguments: linked_field.arguments.clone(),
                    directives: linked_field.directives.clone(),
                    selections: next_selections,
                })
            });
        if should_cache {
            // If another thread computed this in the meantime, use that result
            if let Some(prev) = self.seen_linked_fields.get(&key) {
                return Ok(prev.value().clone());
            }
            self.seen_linked_fields.insert(key, result.clone());
        }
        Ok(result)
    }

    fn transform_inline_fragment(
        &self,
        fragment: &Arc<InlineFragment>,
        parent_type: Type,
    ) -> DiagnosticsResult<TransformedValue<Arc<InlineFragment>>> {
        let should_cache = Arc::strong_count(fragment) > 1;
        let key = (PointerAddress::new(Arc::as_ref(fragment)), parent_type);
        if should_cache && let Some(prev) = self.seen_inline_fragments.get(&key) {
            return Ok(prev.value().clone());
        }
        let next_parent_type = match fragment.type_condition {
            Some(type_condition) => type_condition,
            None => parent_type,
        };
        let result = self
            .transform_selections(&fragment.selections, next_parent_type)?
            .map(|next_selections| {
                Arc::new(InlineFragment {
                    type_condition: fragment.type_condition,
                    directives: fragment.directives.clone(),
                    selections: next_selections,
                    spread_location: fragment.spread_location,
                })
            });
        if should_cache {
            // If another thread computed this in the meantime, use that result
            if let Some(prev) = self.seen_inline_fragments.get(&key) {
                return Ok(prev.value().clone());
            }
            self.seen_inline_fragments.insert(key, result.clone());
        }
        Ok(result)
    }

    fn transform_selection(
        &self,
        selection: &Selection,
        parent_type: Type,
    ) -> DiagnosticsResult<TransformedValue<Selection>> {
        Ok(match selection {
            Selection::InlineFragment(node) => self
                .transform_inline_fragment(node, parent_type)?
                .map(Selection::InlineFragment),
            Selection::LinkedField(node) => self
                .transform_linked_field(node)?
                .map(Selection::LinkedField),
            Selection::Condition(node) => self
                .transform_selections(&node.selections, parent_type)?
                .map(|next_selections| {
                    Selection::Condition(Arc::new(Condition {
                        value: node.value.clone(),
                        passing_value: node.passing_value,
                        selections: next_selections,
                        location: node.location,
                    }))
                }),
            Selection::FragmentSpread(_) | Selection::ScalarField(_) => TransformedValue::Keep,
        })
    }

    /// Node identity compares `@module` inline fragments by name only, so that
    /// ones with the same key are merged (and conflicting modules reported).
    /// Ones with different keys write different `__module_*_<key>` fields, and
    /// each keeps its own module import.
    fn is_same_selection(&self, a: &Selection, b: &Selection) -> bool {
        NodeIdentifier::<RelayLocationAgnosticBehavior>::are_equal(&self.schema, a, b)
            && module_key(a) == module_key(b)
    }

    fn flatten_selections(
        &self,
        flattened_selections: &mut Vec<Selection>,
        selections: &[Selection],
        parent_type: Type,
    ) -> bool {
        let mut has_changes = false;
        for selection in selections {
            if let Selection::InlineFragment(inline_fragment) = selection
                && should_flatten_inline_fragment(inline_fragment, parent_type, self.is_for_codegen)
            {
                has_changes = true;
                self.flatten_selections(
                    flattened_selections,
                    &inline_fragment.selections,
                    parent_type,
                );
                continue;
            }

            let flattened_selection = flattened_selections
                .iter_mut()
                .find(|sel| sel.ptr_eq(selection) || self.is_same_selection(sel, selection));

            match flattened_selection {
                None => {
                    flattened_selections.push(selection.clone());
                }
                Some(flattened_selection) => {
                    has_changes = true;
                    if flattened_selection.ptr_eq(selection) {
                        continue;
                    }
                    match flattened_selection {
                        Selection::InlineFragment(flattened_node) => {
                            let node = match selection {
                                Selection::InlineFragment(node) => node,
                                _ => unreachable!("FlattenTransform: Expected an InlineFragment."),
                            };

                            let type_condition =
                                flattened_node.type_condition.unwrap_or(parent_type);

                            let flattened_node_mut = Arc::make_mut(flattened_node);
                            self.flatten_selections(
                                &mut flattened_node_mut.selections,
                                &node.selections,
                                type_condition,
                            );
                        }
                        Selection::LinkedField(flattened_node) => {
                            let node = match selection {
                                Selection::LinkedField(node) => node,
                                _ => unreachable!("FlattenTransform: Expected a LinkedField."),
                            };
                            let type_ = self
                                .schema
                                .field(flattened_node.definition.item)
                                .type_
                                .inner();
                            let should_merge_handles = selection.directives().iter().any(|d| {
                                CustomMetadataDirectives::is_handle_field_directive(d.name.item)
                            });

                            let flattened_node_mut = Arc::make_mut(flattened_node);
                            if should_merge_handles {
                                flattened_node_mut.directives = merge_handle_directives(
                                    &flattened_node_mut.directives,
                                    selection.directives(),
                                )
                            };
                            self.flatten_selections(
                                &mut flattened_node_mut.selections,
                                &node.selections,
                                type_,
                            );
                        }
                        Selection::Condition(flattened_node) => {
                            let node = match selection {
                                Selection::Condition(node) => node,
                                _ => unreachable!("FlattenTransform: Expected a Condition."),
                            };

                            let flattened_node_mut = Arc::make_mut(flattened_node);
                            self.flatten_selections(
                                &mut flattened_node_mut.selections,
                                &node.selections,
                                parent_type,
                            );
                        }
                        Selection::ScalarField(flattened_node) => {
                            let node = match selection {
                                Selection::ScalarField(node) => node,
                                _ => unreachable!("FlattenTransform: Expected a ScalarField."),
                            };
                            let should_merge_handles = node.directives.iter().any(|d| {
                                CustomMetadataDirectives::is_handle_field_directive(d.name.item)
                            });
                            if should_merge_handles {
                                let flattened_node_mut = Arc::make_mut(flattened_node);
                                flattened_node_mut.directives = merge_handle_directives(
                                    &flattened_node_mut.directives,
                                    selection.directives(),
                                );
                            }
                        }
                        Selection::FragmentSpread(_) => {}
                    };
                }
            }
        }

        has_changes
    }

    fn can_flatten_selections(
        &self,
        flattened_selections: &mut Vec<Selection>,
        selections: &[Selection],
        parent_type: Type,
    ) -> DiagnosticsResult<()> {
        for selection in selections {
            if self.should_validate_fragment_spreads
                && let Selection::FragmentSpread(spread) = selection
            {
                let fragment_definition =
                    self.fragments
                        .get(&spread.fragment.item)
                        .ok_or(Diagnostic::error(
                            ValidationMessage::UndefinedFragment(spread.fragment.item),
                            spread.fragment.location,
                        ))?;
                if fragment_definition.type_condition == parent_type {
                    self.can_flatten_selections(
                        flattened_selections,
                        &fragment_definition.selections,
                        fragment_definition.type_condition,
                    )?;
                }
                continue;
            }

            if let Selection::InlineFragment(inline_fragment) = selection {
                // We will iterate through a selection of inline fragments
                // (ignoring its directives) if this inline fragment doesn't
                // have a type condition or type condition is the same as `parent_type`.
                // The one exception for the latter case is @module directive.
                // These are specially validated: they don't have conflicts in selections
                // but may have conflicts in directive arguments.
                if inline_fragment.type_condition.is_none()
                    || (inline_fragment.type_condition == Some(parent_type)
                        && inline_fragment
                            .directives
                            .named(ModuleMetadata::directive_name())
                            .is_none())
                {
                    self.can_flatten_selections(
                        flattened_selections,
                        &inline_fragment.selections,
                        parent_type,
                    )?;
                    continue;
                }
            }

            let flattened_selection = flattened_selections
                .iter_mut()
                .find(|sel| sel.ptr_eq(selection) || self.is_same_selection(sel, selection));
            match flattened_selection {
                None => {
                    flattened_selections.push(selection.clone());
                }
                Some(flattened_selection) => {
                    if flattened_selection.ptr_eq(selection) {
                        continue;
                    }
                    match flattened_selection {
                        Selection::InlineFragment(flattened_node) => {
                            let node = match selection {
                                Selection::InlineFragment(node) => node,
                                _ => unreachable!("FlattenTransform: Expected an InlineFragment."),
                            };
                            if let Some(flattened_module_metadata) =
                                ModuleMetadata::find(&flattened_node.directives)
                                && let Some(module_metadata) =
                                    ModuleMetadata::find(&node.directives)
                            {
                                let modules_differ = flattened_module_metadata.key
                                    != module_metadata.key
                                    || flattened_module_metadata.module_name
                                        != module_metadata.module_name
                                    || flattened_module_metadata.fragment_name
                                        != module_metadata.fragment_name;

                                // If the modules have different keys they will materialize as different
                                // field names and thus willnot conflict.
                                if flattened_module_metadata.key == module_metadata.key
                                    && modules_differ
                                {
                                    let error = Diagnostic::error(
                                        ValidationMessage::ConflictingModuleSelections,
                                        module_metadata.location,
                                    )
                                    .annotate("conflicts with", flattened_module_metadata.location);
                                    return Err(vec![error]);
                                }
                            }
                            let type_condition =
                                flattened_node.type_condition.unwrap_or(parent_type);
                            let flattened_node_mut = Arc::make_mut(flattened_node);
                            self.can_flatten_selections(
                                &mut flattened_node_mut.selections,
                                &node.selections,
                                type_condition,
                            )?;
                        }
                        Selection::LinkedField(flattened_node) => {
                            let node = match selection {
                                Selection::LinkedField(node) => node,
                                _ => unreachable!("FlattenTransform: Expected a LinkedField."),
                            };
                            let type_ = self
                                .schema
                                .field(flattened_node.definition.item)
                                .type_
                                .inner();

                            let flattened_node_mut = Arc::make_mut(flattened_node);
                            self.can_flatten_selections(
                                &mut flattened_node_mut.selections,
                                &node.selections,
                                type_,
                            )?;
                        }
                        Selection::Condition(flattened_node) => {
                            let node = match selection {
                                Selection::Condition(node) => node,
                                _ => unreachable!("FlattenTransform: Expected a Condition."),
                            };

                            let flattened_node_mut = Arc::make_mut(flattened_node);
                            self.can_flatten_selections(
                                &mut flattened_node_mut.selections,
                                &node.selections,
                                parent_type,
                            )?;
                        }
                        Selection::ScalarField(_) | Selection::FragmentSpread(_) => {}
                    };
                }
            }
        }

        Ok(())
    }
}

pub(crate) fn module_key(selection: &Selection) -> Option<StringKey> {
    match selection {
        Selection::InlineFragment(fragment) => {
            ModuleMetadata::find(&fragment.directives).map(|metadata| metadata.key)
        }
        _ => None,
    }
}

fn should_flatten_inline_fragment(
    inline_fragment: &InlineFragment,
    parent_type: Type,
    is_for_codegen: bool,
) -> bool {
    if let Some(type_condition) = inline_fragment.type_condition
        && type_condition != parent_type
    {
        return false;
    }
    if is_for_codegen {
        !inline_fragment
            .directives
            .iter()
            .any(is_relay_custom_inline_fragment_directive)
    } else {
        inline_fragment.directives.is_empty()
    }
}

fn merge_handle_directives(
    directives_a: &[Directive],
    directives_b: &[Directive],
) -> Vec<Directive> {
    let (mut handles, mut directives): (Vec<_>, Vec<_>) =
        directives_a.iter().cloned().partition(|directive| {
            CustomMetadataDirectives::is_handle_field_directive(directive.name.item)
        });
    for directive in directives_b {
        if CustomMetadataDirectives::is_handle_field_directive(directive.name.item) {
            if handles.is_empty() {
                handles.push(directive.clone());
            } else {
                let current_handler_arg = directive.arguments.named(*HANDLER_ARG_NAME);
                let current_name_arg = directive.arguments.named(*KEY_ARG_NAME);
                let is_duplicate_handle = handles.iter().any(|handle| {
                    current_handler_arg.location_agnostic_eq::<RelayLocationAgnosticBehavior>(
                        &handle.arguments.named(*HANDLER_ARG_NAME),
                    ) && current_name_arg.location_agnostic_eq::<RelayLocationAgnosticBehavior>(
                        &handle.arguments.named(*KEY_ARG_NAME),
                    )
                });
                if !is_duplicate_handle {
                    handles.push(directive.clone());
                }
            }
        }
    }
    directives.extend(handles);
    directives
}
