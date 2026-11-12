/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

use std::sync::Arc;

use common::NamedItem;
use common::PointerAddress;
use common::sync::*;
use dashmap::DashMap;
use graphql_ir::Condition;
use graphql_ir::FragmentDefinition;
use graphql_ir::InlineFragment;
use graphql_ir::LinkedField;
use graphql_ir::OperationDefinition;
use graphql_ir::Program;
use graphql_ir::Selection;
use graphql_ir::Transformed;
use graphql_ir::TransformedValue;
use graphql_ir::node_identifier::NodeIdentifier;
use intern::string_key::StringKey;
use relay_config::DeferStreamInterface;
use schema::SDLSchema;

use crate::ClientEdgeMetadataDirective;
use crate::RelayLocationAgnosticBehavior;
use crate::flatten::module_key;
use crate::util::is_relay_custom_inline_fragment_directive;

/**
 * A transform that removes redundant fields and fragment spreads. Redundancy is
 * defined in this context as any selection that is guaranteed to already be
 * fetched by an ancestor selection. This can occur in two cases:
 *
 * 1. Simple duplicates at the same level of the document can always be skipped:
 *
 *
 * fragment Foo on FooType {
 *   id
 *   id
 *   ...Bar
 *   ...Bar
 * }
 *
 *
 * Becomes
 *
 *
 * fragment Foo on FooType {
 *   id
 *   ...Bar
 * }
 *
 *
 * 2. Inline fragments and conditions introduce the possibility for duplication
 *    at different levels of the tree. Whenever a selection is fetched in a parent,
 *    it is redundant to also fetch it in a child:
 *
 *
 * fragment Foo on FooType {
 *   id
 *   ... on OtherType {
 *     id # 1
 *   }
 *   ... on FooType @include(if: $cond) {
 *     id # 2
 *   }
 * }
 *
 *
 * Becomes:
 *
 *
 * fragment Foo on FooType {
 *   id
 * }
 *
 *
 * In this example:
 * - 1 can be skipped because `id` is already fetched by the parent. Even
 *   though the type is different (FooType/OtherType), the inline fragment
 *   cannot match without the outer fragment matching so the outer `id` is
 *   guaranteed to already be fetched.
 * - 2 can be skipped for similar reasons: it doesn't matter if the condition
 *   holds, `id` is already fetched by the parent regardless.
 *
 * This transform also handles more complicated cases in which selections are
 * nested:
 *
 *
 * fragment Foo on FooType {
 *   a {
 *     bb
 *   }
 *   ... on OtherType {
 *     a {
 *       bb # 1
 *       cc
 *     }
 *   }
 *  }
 *
 *
 * Becomes
 *
 *
 * fragment Foo on FooType {
 *   a {
 *     bb
 *   }
 *   ... on OtherType {
 *     a {
 *       cc
 *     }
 *   }
 *  }
 *
 *
 * 1 can be skipped because it is already fetched at the outer level.
 */
pub fn skip_redundant_nodes(
    program: &Program,
    defer_stream_interface: DeferStreamInterface,
) -> Program {
    let transform = SkipRedundantNodesTransform::new(program, defer_stream_interface);
    transform
        .transform_program(program)
        .replace_or_else(|| program.clone())
}

/// A selection's identity, plus the key of an `@module` inline fragment: node
/// identity compares those by name only, but ones with different keys each
/// keep their own module import (see `flatten`).
type SelectionKey = (
    NodeIdentifier<RelayLocationAgnosticBehavior>,
    Option<StringKey>,
);

#[derive(Default, Clone, Debug)]
struct SelectionMap(VecMap<SelectionKey, Option<SelectionMap>>);

type SelectionMapEntry = (SelectionKey, Option<SelectionMap>);

/// `SelectionMap` nests as deeply as a selection set is *wide*, not as deeply as
/// it is nested: forking (see the inline-fragment and condition arms of
/// `transform_selection`) seeds a child with a clone of its parent and then
/// stores that child back into the parent, so each additional sibling adds a
/// level.
///
/// That width is reachable in practice. `relay_resolvers_abstract_types` rewrites
/// an interface-level selection into one inline fragment per implementing object
/// as soon as any implementor is a client extension, and `Node` has several in
/// the intern schema — so a lone `id` selected through a `Node`-typed field
/// becomes ~44k siblings. The derived recursive drop then overflowed the thread
/// stack, killing the process with `SIGSEGV` instead of reporting a diagnostic.
///
/// Tearing down with an explicit work list makes the depth irrelevant. Stealing
/// each child's entries before it goes out of scope is what keeps this from
/// recursing: the child is then dropped holding an empty `Vec`, which returns
/// immediately.
impl Drop for SelectionMap {
    fn drop(&mut self) {
        let mut pending: Vec<Vec<SelectionMapEntry>> = Vec::new();
        match Arc::get_mut(&mut self.0.data) {
            // Shared with another owner, so this drop only decrements a refcount
            // and cannot recurse. Whoever holds the last reference tears it down.
            None => return,
            Some(entries) if entries.is_empty() => return,
            Some(entries) => pending.push(std::mem::take(entries)),
        }
        while let Some(entries) = pending.pop() {
            for (_key, child) in entries {
                if let Some(mut child) = child
                    && let Some(grandchildren) = Arc::get_mut(&mut child.0.data)
                    && !grandchildren.is_empty()
                {
                    pending.push(std::mem::take(grandchildren));
                }
            }
        }
    }
}

type Cache = DashMap<PointerAddress, (Transformed<Selection>, SelectionMap)>;

pub struct SkipRedundantNodesTransform {
    schema: Arc<SDLSchema>,
    cache: Cache,
    defer_stream_interface: DeferStreamInterface,
}

impl SkipRedundantNodesTransform {
    fn new(program: &'_ Program, defer_stream_interface: DeferStreamInterface) -> Self {
        Self {
            schema: Arc::clone(&program.schema),
            cache: DashMap::new(),
            defer_stream_interface,
        }
    }

    pub fn from_schema(
        schema: &Arc<SDLSchema>,
        defer_stream_interface: DeferStreamInterface,
    ) -> Self {
        Self {
            schema: Arc::clone(schema),
            cache: DashMap::new(),
            defer_stream_interface,
        }
    }

    fn transform_selection(
        &self,
        selection: &Selection,
        selection_map: &mut SelectionMap,
    ) -> Transformed<Selection> {
        // This will optimize a traversal of the same subselections.
        // If it's the same node, and selection_map is empty
        // result of transform_selection has to be the same.
        let is_empty = selection_map.0.is_empty();
        let identifier = (
            NodeIdentifier::from_selection(&self.schema, selection, RelayLocationAgnosticBehavior),
            module_key(selection),
        );
        match selection {
            Selection::ScalarField(_) | Selection::FragmentSpread(_) => {
                if selection_map.0.contains_key(&identifier) {
                    Transformed::Delete
                } else {
                    selection_map.0.insert(identifier, None);
                    Transformed::Keep
                }
            }
            Selection::LinkedField(selection) => {
                let should_cache = is_empty && Arc::strong_count(selection) > 2;
                if should_cache {
                    let key = PointerAddress::new(selection);
                    if let Some(cached) = self.cache.get(&key) {
                        let (cached_result, cached_selection_map) = cached.clone();
                        *selection_map = cached_selection_map;
                        return cached_result;
                    }
                }
                let result = if let Some(Some(linked_selection_map)) =
                    selection_map.0.get_mut(&identifier)
                {
                    self.transform_linked_field(selection, linked_selection_map)
                        .map(Selection::LinkedField)
                } else {
                    let mut linked_selection_map = Default::default();
                    let result = self
                        .transform_linked_field(selection, &mut linked_selection_map)
                        .map(Selection::LinkedField);
                    if !matches!(result, Transformed::Delete) {
                        selection_map
                            .0
                            .insert(identifier, Some(linked_selection_map));
                    }
                    result
                };
                if should_cache {
                    let key = PointerAddress::new(selection);
                    self.cache
                        .insert(key, (result.clone(), selection_map.clone()));
                }
                result
            }
            Selection::Condition(selection) => {
                if let Some(Some(existing_selection_map)) = selection_map.0.get_mut(&identifier) {
                    self.transform_condition(selection, existing_selection_map)
                        .map(Selection::Condition)
                } else {
                    // Fork the selection map to prevent conditional selections from
                    // affecting the outer "guaranteed" selections.
                    let mut next_selection_map = selection_map.clone();
                    let result = self
                        .transform_condition(selection, &mut next_selection_map)
                        .map(Selection::Condition);
                    if !matches!(result, Transformed::Delete) {
                        selection_map.0.insert(identifier, Some(next_selection_map));
                    }
                    result
                }
            }
            Selection::InlineFragment(selection) => {
                let should_cache = is_empty && Arc::strong_count(selection) > 2;
                if should_cache {
                    let key = PointerAddress::new(selection);
                    if let Some(cached) = self.cache.get(&key) {
                        let (cached_result, cached_selection_map) = cached.clone();
                        *selection_map = cached_selection_map;
                        return cached_result;
                    }
                }
                let result = if let Some(Some(existing_selection_map)) =
                    selection_map.0.get_mut(&identifier)
                {
                    self.transform_inline_fragment(selection, existing_selection_map)
                        .map(Selection::InlineFragment)
                } else if selection
                    .directives
                    .iter()
                    .any(is_relay_custom_inline_fragment_directive)
                {
                    let mut linked_selection_map = Default::default();
                    let result = self
                        .transform_inline_fragment(selection, &mut linked_selection_map)
                        .map(Selection::InlineFragment);
                    if !matches!(result, Transformed::Delete) {
                        selection_map
                            .0
                            .insert(identifier, Some(linked_selection_map));
                    }
                    result
                } else {
                    // Fork for inline fragments for the same reason
                    let mut next_selection_map = selection_map.clone();
                    let result = self
                        .transform_inline_fragment(selection, &mut next_selection_map)
                        .map(Selection::InlineFragment);
                    if !matches!(result, Transformed::Delete) {
                        selection_map.0.insert(identifier, Some(next_selection_map));
                    }
                    result
                };
                if should_cache {
                    let key = PointerAddress::new(selection);
                    self.cache
                        .insert(key, (result.clone(), selection_map.clone()));
                }
                result
            }
        }
    }

    fn transform_linked_field(
        &self,
        field: &LinkedField,
        selection_map: &mut SelectionMap,
    ) -> Transformed<Arc<LinkedField>> {
        let selections = self.transform_selections(
            self.get_partitioned_selections(&field.selections),
            selection_map,
        );
        match selections {
            TransformedValue::Keep => Transformed::Keep,
            TransformedValue::Replace(selections) => {
                if selections.is_empty() {
                    Transformed::Delete
                } else {
                    Transformed::Replace(Arc::new(LinkedField {
                        selections,
                        ..field.clone()
                    }))
                }
            }
        }
    }

    fn transform_condition(
        &self,
        condition: &Condition,
        selection_map: &mut SelectionMap,
    ) -> Transformed<Arc<Condition>> {
        let selections = self.transform_selections(
            self.get_partitioned_selections(&condition.selections),
            selection_map,
        );
        match selections {
            TransformedValue::Keep => Transformed::Keep,
            TransformedValue::Replace(selections) => {
                if selections.is_empty() {
                    Transformed::Delete
                } else {
                    Transformed::Replace(Arc::new(Condition {
                        selections,
                        ..condition.clone()
                    }))
                }
            }
        }
    }

    fn transform_inline_fragment(
        &self,
        fragment: &InlineFragment,
        selection_map: &mut SelectionMap,
    ) -> Transformed<Arc<InlineFragment>> {
        let selections = self.transform_selections(
            // we must not change the order of selections within inline fragments with ClientEdgeMetadataDirective
            if fragment
                .directives
                .named(ClientEdgeMetadataDirective::directive_name())
                .is_some()
            {
                Vec::from_iter(&fragment.selections)
            } else {
                self.get_partitioned_selections(&fragment.selections)
            },
            selection_map,
        );
        match selections {
            TransformedValue::Keep => Transformed::Keep,
            TransformedValue::Replace(selections) => {
                if selections.is_empty() {
                    Transformed::Delete
                } else {
                    Transformed::Replace(Arc::new(InlineFragment {
                        selections,
                        ..fragment.clone()
                    }))
                }
            }
        }
    }

    // Mostly a copy from Transformer::transform_list, but with `selection_map` passed down
    fn transform_selections(
        &self,
        selections: Vec<&Selection>,
        selection_map: &mut SelectionMap,
    ) -> TransformedValue<Vec<Selection>> {
        if selections.is_empty() {
            return TransformedValue::Keep;
        }
        let mut result: Vec<Selection> = Vec::new();
        let mut has_changes = false;

        for (index, prev_item) in selections.iter().enumerate() {
            let next_item = self.transform_selection(prev_item, selection_map);
            match next_item {
                Transformed::Keep => {
                    if has_changes {
                        result.push((*prev_item).clone());
                    }
                }
                Transformed::Delete => {
                    if !has_changes {
                        debug_assert!(result.capacity() == 0);
                        // assume most items won't be skipped and allocate space for all items
                        result.reserve(selections.len());
                        result.extend(selections.iter().take(index).map(|&x| x.clone()));
                        has_changes = true;
                    }
                }
                Transformed::Replace(next_item) => {
                    if !has_changes {
                        debug_assert!(result.capacity() == 0);
                        // assume most items won't be skipped and allocate space for all items
                        result.reserve(selections.len());
                        result.extend(selections.iter().take(index).map(|&x| x.clone()));
                        has_changes = true;
                    }
                    result.push(next_item);
                }
            }
        }
        if has_changes {
            TransformedValue::Replace(result)
        } else {
            TransformedValue::Keep
        }
    }

    pub fn transform_operation(
        &self,
        operation: &OperationDefinition,
    ) -> Transformed<OperationDefinition> {
        let mut selection_map = Default::default();
        let selections = self.transform_selections(
            self.get_partitioned_selections(&operation.selections),
            &mut selection_map,
        );
        match selections {
            TransformedValue::Keep => Transformed::Keep,
            TransformedValue::Replace(selections) => Transformed::Replace(OperationDefinition {
                selections,
                ..operation.clone()
            }),
        }
    }

    pub fn transform_fragment(
        &self,
        fragment: &FragmentDefinition,
    ) -> Transformed<FragmentDefinition> {
        let mut selection_map = Default::default();
        let selections = self.transform_selections(
            self.get_partitioned_selections(&fragment.selections),
            &mut selection_map,
        );
        match selections {
            TransformedValue::Keep => Transformed::Keep,
            TransformedValue::Replace(selections) => Transformed::Replace(FragmentDefinition {
                selections,
                ..fragment.clone()
            }),
        }
    }

    fn transform_program(&self, program: &Program) -> TransformedValue<Program> {
        let operations: Vec<Arc<OperationDefinition>> = par_iter(&program.operations)
            .filter_map(|operation| match self.transform_operation(operation) {
                Transformed::Delete => None,
                Transformed::Keep => Some(Arc::clone(operation)),
                Transformed::Replace(replacement) => Some(Arc::new(replacement)),
            })
            .collect();
        let fragments: Vec<Arc<FragmentDefinition>> = par_iter(&program.fragments)
            .filter_map(|(_, fragment)| match self.transform_fragment(fragment) {
                Transformed::Delete => None,
                Transformed::Keep => Some(Arc::clone(fragment)),
                Transformed::Replace(replacement) => Some(Arc::new(replacement)),
            })
            .collect();
        let mut next_program = Program::new(Arc::clone(&program.schema));
        for operation in operations {
            next_program.insert_operation(operation);
        }
        for fragment in fragments {
            next_program.insert_fragment(fragment);
        }
        TransformedValue::Replace(next_program)
    }

    /* Selections are sorted with fields first, "conditionals"
     * (inline fragments & conditions) last. This means that all fields that are
     * guaranteed to be fetched are encountered prior to any duplicates that may be
     * fetched within a conditional.
     */
    fn get_partitioned_selections<'a>(&self, selections: &'a [Selection]) -> Vec<&'a Selection> {
        let mut result = Vec::with_capacity(selections.len());
        let mut non_field_selections = Vec::new();
        for sel in selections.iter() {
            if self.is_selection_linked_or_scalar(sel) {
                result.push(sel);
            } else {
                non_field_selections.push(sel);
            }
        }
        result.extend(non_field_selections);
        result
    }

    fn is_selection_linked_or_scalar(&self, selection: &Selection) -> bool {
        match selection {
            Selection::LinkedField(field) => field
                .directives
                .named(self.defer_stream_interface.stream_name)
                .is_none(),
            Selection::ScalarField(_) => true,
            _ => false,
        }
    }
}

/// NOTE: intentionally local to this file, this is not a fully-general purpose
/// immutable map. see comments on methods below.
#[derive(Debug)]
struct VecMap<K, V> {
    data: Arc<Vec<(K, V)>>,
}

impl<K, V> VecMap<K, V> {
    fn new() -> Self {
        Self {
            data: Arc::new(Vec::new()),
        }
    }
}

impl<K, V> VecMap<K, V>
where
    K: Eq + Clone,
    V: Clone,
{
    fn contains_key(&self, key: &K) -> bool {
        self.data.iter().any(|(k, _v)| k == key)
    }

    fn get_mut(&mut self, key: &K) -> Option<&mut V> {
        let data = Arc::make_mut(&mut self.data);
        data.iter_mut().find(|(k, _v)| k == key).map(|(_k, v)| v)
    }

    fn insert(&mut self, key: K, value: V) {
        // NOTE: this is intentionally *not* a general-purpose insert, which should
        // update the value for the existig key if present. skip_redundant_nodes
        // always checks for the key first, so any call to insert() is guaranteed to
        // be for a non-present key. thanks to that we can bypass the existence check
        // to make insert faster.
        debug_assert!(!self.contains_key(&key));
        let data = Arc::make_mut(&mut self.data);
        data.push((key, value));
    }

    fn is_empty(&self) -> bool {
        self.data.is_empty()
    }
}

impl<K, V> Clone for VecMap<K, V> {
    fn clone(&self) -> Self {
        Self {
            data: Arc::clone(&self.data),
        }
    }
}

impl<K, V> Default for VecMap<K, V> {
    fn default() -> Self {
        Self::new()
    }
}
