/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

use std::hash::Hash;
use std::sync::Arc;

use common::FeatureFlag;
use common::Location;
use common::PointerAddress;
use fnv::FnvHashMap;
use graphql_ir::Condition;
use graphql_ir::Directive;
use graphql_ir::FragmentDefinition;
use graphql_ir::FragmentSpread;
use graphql_ir::InlineFragment;
use graphql_ir::LinkedField;
use graphql_ir::OperationDefinition;
use graphql_ir::Program;
use graphql_ir::ScalarField;
use graphql_ir::Selection;
use graphql_ir::Transformed;
use graphql_ir::TransformedValue;
use graphql_ir::Transformer;
use graphql_ir::node_identifier::LocationAgnosticBehavior;
use graphql_ir::node_identifier::LocationAgnosticHash;
use graphql_ir::node_identifier::LocationAgnosticPartialEq;
use schema::FieldID;
use schema::ObjectID;
use schema::Schema;
use schema::Type;

use crate::NoInlineFragmentSpreadMetadata;
use crate::RelayLocationAgnosticBehavior;
use crate::RscSeamMetadata;

/// Expand fragment spreads into inline fragments containing the named
/// fragment's directives and selections. Used for constructing a Normalization
/// AST that contains all the selections that may be found in the query response.
///
/// In the operations that `skip_impossible_inline_fragments` enables, this also
/// leaves out inline fragments on an object type that the record they apply to
/// can never have. Inlining a fragment on an abstract type into a field of an
/// object type keeps the fragment's branches for the abstract type's other
/// implementors, such as the per-implementor arms
/// `relay_resolvers_abstract_types` creates. The normalizer only enters
/// `... on Other` when the record's type is `Other`, so once a field or an
/// enclosing refinement fixes the record's type to an object, a branch on any
/// other object is dead. Abstract refinements stay, emptied when all of their
/// branches are dead: the normalizer records on the type whether it implements
/// them, which readers depend on. Nothing is removed directly on an operation's
/// root record, where the runtime enters every refinement.
pub fn inline_fragments(
    program: &Program,
    skip_impossible_inline_fragments: &FeatureFlag,
) -> Program {
    let mut transform =
        InlineFragmentsTransform::new(program, true, skip_impossible_inline_fragments);
    transform
        .transform_program(program)
        .replace_or_else(|| program.clone())
}

pub fn inline_fragments_keep_fragments(program: &Program) -> Program {
    let mut transform = InlineFragmentsTransform::new(program, false, &FeatureFlag::Disabled);
    transform
        .transform_program(program)
        .replace_or_else(|| program.clone())
}

#[derive(Eq, Clone, Debug)]
struct FragmentSpreadKey(Arc<FragmentSpread>);
type Seen = FnvHashMap<FragmentSpreadKey, Arc<InlineFragment>>;

impl PartialEq for FragmentSpreadKey {
    fn eq(&self, other: &Self) -> bool {
        self.0.fragment.item == other.0.fragment.item
            && self
                .0
                .directives
                .location_agnostic_eq::<RelayLocationAgnosticBehavior>(&other.0.directives)
    }
}

impl Hash for FragmentSpreadKey {
    fn hash<H: std::hash::Hasher>(&self, state: &mut H) {
        self.0.fragment.item.hash(state);
        self.0
            .directives
            .location_agnostic_hash::<_, RelayLocationAgnosticBehavior>(state);
    }
}

/// Whether an inline fragment with these directives means more than its type
/// condition, such as `@defer` or Relay's metadata, and so keeps its selections
/// when they are all impossible. Directives that do not distinguish spreads
/// inlined to one node, such as `@dangerously_unaliased_fixme`, do not count.
fn has_identifying_directives(directives: &[Directive]) -> bool {
    directives.iter().any(|directive| {
        !RelayLocationAgnosticBehavior::should_skip_in_node_identifier(directive.name.item)
    })
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum RecordType {
    /// An operation's root record. The runtime enters every refinement on it,
    /// whether or not the type matches.
    Root,
    /// Known only from the response.
    Unknown,
    Object(ObjectID),
    /// The output type of this field, looked up only when a refinement on an
    /// object type needs it.
    OfField(FieldID),
}

impl RecordType {
    fn of(type_: Type) -> Self {
        match type_ {
            Type::Object(object) => Self::Object(object),
            _ => Self::Unknown,
        }
    }
}

/// Results for a selection that is reached more than once while leaving out
/// impossible inline fragments. A result depends on the record type it applies
/// to only if a refinement on an object type applies to that same record.
#[derive(Default)]
struct Cached {
    any_record_type: Option<Transformed<Selection>>,
    by_record_type: Vec<(RecordType, Transformed<Selection>)>,
}

impl Cached {
    /// The cached result with whether it depends on the record type, looking up
    /// the record type only if it does.
    fn get(
        &self,
        record_type: impl FnOnce() -> RecordType,
    ) -> Option<(Transformed<Selection>, bool)> {
        if let Some(transformed) = &self.any_record_type {
            return Some((transformed.clone(), false));
        }
        if self.by_record_type.is_empty() {
            return None;
        }
        let record_type = record_type();
        self.by_record_type
            .iter()
            .find(|(cached_record_type, _)| *cached_record_type == record_type)
            .map(|(_, transformed)| (transformed.clone(), true))
    }

    /// Caches a result for this record type, or for any if it is `None`.
    fn insert(&mut self, record_type: Option<RecordType>, transformed: Transformed<Selection>) {
        match record_type {
            Some(record_type) => self.by_record_type.push((record_type, transformed)),
            None => self.any_record_type = Some(transformed),
        }
    }
}

struct InlineFragmentsTransform<'s> {
    program: &'s Program,
    seen: Seen,
    remove_fragments: bool,
    skip_impossible_inline_fragments: &'s FeatureFlag,
    /// Whether the current operation leaves out impossible inline fragments.
    skip_impossible: bool,
    record_type: RecordType,
    /// Whether the current record has a refinement on an object type, the only
    /// selection whose result depends on the record type.
    depends_on_record_type: bool,
    /// `seen` for the operations that leave out impossible inline fragments.
    seen_skipping_impossible: FnvHashMap<FragmentSpreadKey, Cached>,
    /// Inline fragments shared between several parents in those operations.
    shared_fragments: FnvHashMap<PointerAddress, Cached>,
}

impl<'s> InlineFragmentsTransform<'s> {
    fn new(
        program: &'s Program,
        remove_fragments: bool,
        skip_impossible_inline_fragments: &'s FeatureFlag,
    ) -> Self {
        Self {
            program,
            seen: Default::default(),
            remove_fragments,
            skip_impossible_inline_fragments,
            skip_impossible: false,
            record_type: RecordType::Unknown,
            depends_on_record_type: false,
            seen_skipping_impossible: Default::default(),
            shared_fragments: Default::default(),
        }
    }

    fn transform_fragment_spread(&mut self, spread: &Arc<FragmentSpread>) -> Arc<InlineFragment> {
        let key = FragmentSpreadKey(Arc::clone(spread));
        // If we've already created an InlineFragment for this fragment name before,
        // share it
        if let Some(prev) = self.seen.get(&key) {
            return Arc::clone(prev);
        };
        // Otherwise create the InlineFragment equivalent of the fragment (recursively
        // inlining its contents). To guard against cycles, store a dummy value
        // that we overwrite once we finish.
        self.seen.insert(
            key.clone(),
            Arc::new(InlineFragment {
                type_condition: None,
                directives: Default::default(),
                selections: Default::default(),
                spread_location: Location::generated(),
            }),
        );
        let fragment = self
            .program
            .fragment(spread.fragment.item)
            .unwrap_or_else(|| {
                panic!(
                    "Fragment spread unable to resolve fragment `{}`.",
                    spread.fragment.item
                )
            });
        let selections = self.transform_selections(&fragment.selections);
        let result = Arc::new(InlineFragment {
            type_condition: Some(fragment.type_condition),
            directives: spread.directives.clone(),
            selections: selections.replace_or_else(|| fragment.selections.clone()),
            spread_location: Location::generated(),
        });
        self.seen.insert(key, Arc::clone(&result));
        result
    }

    fn resolve(&self, record_type: RecordType) -> RecordType {
        match record_type {
            RecordType::OfField(field) => {
                RecordType::of(self.program.schema.field(field).type_.inner())
            }
            resolved => resolved,
        }
    }

    fn document_record_type(&self, type_: Type) -> RecordType {
        let schema = &self.program.schema;
        let is_root_type = [
            schema.query_type(),
            schema.mutation_type(),
            schema.subscription_type(),
        ]
        .contains(&Some(type_));
        if is_root_type {
            RecordType::Root
        } else {
            RecordType::of(type_)
        }
    }

    fn without_skipping<T>(&mut self, transform: impl FnOnce(&mut Self) -> T) -> T {
        let skip_impossible = std::mem::replace(&mut self.skip_impossible, false);
        let transformed = transform(self);
        self.skip_impossible = skip_impossible;
        transformed
    }

    /// The selections of a record. A field or document needs a selection, so
    /// one whose selections are all impossible keeps them.
    fn transform_record_selections(
        &mut self,
        record_type: RecordType,
        selections: &[Selection],
    ) -> TransformedValue<Vec<Selection>> {
        let outer_record_type = std::mem::replace(&mut self.record_type, record_type);
        let outer_depends = std::mem::replace(&mut self.depends_on_record_type, false);
        let transformed = self.transform_selections(selections);
        self.record_type = outer_record_type;
        self.depends_on_record_type = outer_depends;
        match transformed {
            TransformedValue::Replace(next_selections) if next_selections.is_empty() => {
                self.without_skipping(|transform| transform.transform_selections(selections))
            }
            transformed => transformed,
        }
    }

    /// The record type inside a refinement on `type_condition`, whether that is
    /// still the current record, or `None` if the refinement can never match.
    fn refine(&mut self, type_condition: Option<Type>) -> Option<(RecordType, bool)> {
        match type_condition {
            Some(Type::Object(object)) => {
                self.depends_on_record_type = true;
                self.record_type = self.resolve(self.record_type);
                match self.record_type {
                    RecordType::Root => Some((RecordType::Root, false)),
                    RecordType::Object(record_object) if record_object != object => None,
                    _ => Some((RecordType::Object(object), false)),
                }
            }
            _ => Some((self.record_type, true)),
        }
    }

    /// Transforms selections under a refinement, returning them with whether
    /// they depend on the record type.
    fn transform_refined_selections(
        &mut self,
        inner_record_type: RecordType,
        same_record: bool,
        selections: &[Selection],
    ) -> (TransformedValue<Vec<Selection>>, bool, RecordType) {
        let outer_record_type = std::mem::replace(&mut self.record_type, inner_record_type);
        let outer_depends = std::mem::replace(&mut self.depends_on_record_type, false);
        let transformed = self.transform_selections(selections);
        let depends = self.depends_on_record_type;
        let inner_record_type = self.record_type;
        // A refinement on the same record may have looked up its type.
        self.record_type = if same_record {
            inner_record_type
        } else {
            outer_record_type
        };
        self.depends_on_record_type = outer_depends || (same_record && depends);
        (transformed, depends, inner_record_type)
    }

    fn transform_refinement(&mut self, fragment: &Arc<InlineFragment>) -> Transformed<Selection> {
        let Some((inner_record_type, same_record)) = self.refine(fragment.type_condition) else {
            return Transformed::Delete;
        };
        let shared_key =
            (Arc::strong_count(fragment) > 1).then(|| PointerAddress::new(Arc::as_ref(fragment)));
        if let Some(key) = shared_key
            && let Some((transformed, depends)) = self
                .shared_fragments
                .get(&key)
                .and_then(|cached| cached.get(|| self.resolve(inner_record_type)))
        {
            self.depends_on_record_type |= same_record && depends;
            return transformed;
        }

        let (selections, depends, inner_record_type) =
            self.transform_refined_selections(inner_record_type, same_record, &fragment.selections);
        let transformed = match selections {
            TransformedValue::Keep => Transformed::Keep,
            TransformedValue::Replace(selections) if selections.is_empty() => {
                if has_identifying_directives(&fragment.directives) {
                    self.without_skipping(|transform| {
                        transform.default_transform_inline_fragment(fragment)
                    })
                } else if fragment
                    .type_condition
                    .is_some_and(|type_condition| type_condition.is_abstract_type())
                {
                    Transformed::Replace(Selection::InlineFragment(Arc::new(InlineFragment {
                        selections,
                        ..fragment.as_ref().clone()
                    })))
                } else {
                    Transformed::Delete
                }
            }
            TransformedValue::Replace(selections) => {
                Transformed::Replace(Selection::InlineFragment(Arc::new(InlineFragment {
                    selections,
                    ..fragment.as_ref().clone()
                })))
            }
        };
        if let Some(key) = shared_key {
            let record_type = depends.then(|| self.resolve(inner_record_type));
            self.shared_fragments
                .entry(key)
                .or_default()
                .insert(record_type, transformed.clone());
        }
        transformed
    }

    /// `transform_fragment_spread` for the operations that leave out impossible
    /// inline fragments: a fragment is inlined once for each record type that
    /// changes the result.
    fn transform_fragment_spread_skipping_impossible(
        &mut self,
        spread: &Arc<FragmentSpread>,
    ) -> Transformed<Selection> {
        let fragment = self
            .program
            .fragment(spread.fragment.item)
            .unwrap_or_else(|| {
                panic!(
                    "Fragment spread unable to resolve fragment `{}`.",
                    spread.fragment.item
                )
            });
        let Some((inner_record_type, same_record)) = self.refine(Some(fragment.type_condition))
        else {
            return Transformed::Delete;
        };
        let key = FragmentSpreadKey(Arc::clone(spread));
        if let Some((transformed, depends)) = self
            .seen_skipping_impossible
            .get(&key)
            .and_then(|cached| cached.get(|| self.resolve(inner_record_type)))
        {
            self.depends_on_record_type |= same_record && depends;
            return transformed;
        }

        let (selections, depends, inner_record_type) =
            self.transform_refined_selections(inner_record_type, same_record, &fragment.selections);
        let inline = |selections| {
            Transformed::Replace(Selection::InlineFragment(Arc::new(InlineFragment {
                type_condition: Some(fragment.type_condition),
                directives: spread.directives.clone(),
                selections,
                spread_location: Location::generated(),
            })))
        };
        let transformed = match selections {
            TransformedValue::Replace(selections) if selections.is_empty() => {
                if has_identifying_directives(&spread.directives) {
                    self.without_skipping(|transform| {
                        Transformed::Replace(Selection::InlineFragment(
                            transform.transform_fragment_spread(spread),
                        ))
                    })
                } else if fragment.type_condition.is_abstract_type() {
                    inline(selections)
                } else {
                    Transformed::Delete
                }
            }
            selections => inline(selections.replace_or_else(|| fragment.selections.clone())),
        };
        let record_type = depends.then(|| self.resolve(inner_record_type));
        self.seen_skipping_impossible
            .entry(key)
            .or_default()
            .insert(record_type, transformed.clone());
        transformed
    }
}

impl Transformer<'_> for InlineFragmentsTransform<'_> {
    const NAME: &'static str = "InlineFragmentsTransform";
    const VISIT_ARGUMENTS: bool = false;
    const VISIT_DIRECTIVES: bool = false;

    fn transform_operation(
        &mut self,
        operation: &OperationDefinition,
    ) -> Transformed<OperationDefinition> {
        self.skip_impossible = self
            .skip_impossible_inline_fragments
            .is_enabled_for(operation.name.item.0);
        if !self.skip_impossible {
            return self.default_transform_operation(operation);
        }
        let record_type = self.document_record_type(operation.type_);
        match self.transform_record_selections(record_type, &operation.selections) {
            TransformedValue::Keep => Transformed::Keep,
            TransformedValue::Replace(selections) => Transformed::Replace(OperationDefinition {
                selections,
                ..operation.clone()
            }),
        }
    }

    fn transform_fragment(
        &mut self,
        fragment: &FragmentDefinition,
    ) -> Transformed<FragmentDefinition> {
        if self.remove_fragments {
            Transformed::Delete
        } else {
            self.default_transform_fragment(fragment)
        }
    }

    fn transform_selection(&mut self, selection: &Selection) -> Transformed<Selection> {
        match selection {
            Selection::FragmentSpread(selection) => {
                let should_skip_inline = selection.directives.iter().any(|directive| {
                    directive.name.item == NoInlineFragmentSpreadMetadata::directive_name()
                        || directive.name.item == RscSeamMetadata::directive_name()
                });
                if should_skip_inline {
                    Transformed::Keep
                } else if self.skip_impossible {
                    self.transform_fragment_spread_skipping_impossible(selection)
                } else {
                    Transformed::Replace(Selection::InlineFragment(
                        self.transform_fragment_spread(selection),
                    ))
                }
            }
            Selection::InlineFragment(fragment) if self.skip_impossible => {
                self.transform_refinement(fragment)
            }
            _ => self.default_transform_selection(selection),
        }
    }

    fn transform_linked_field(&mut self, field: &LinkedField) -> Transformed<Selection> {
        if !self.skip_impossible {
            return self.default_transform_linked_field(field);
        }
        match self.transform_record_selections(
            RecordType::OfField(field.definition.item),
            &field.selections,
        ) {
            TransformedValue::Keep => Transformed::Keep,
            TransformedValue::Replace(selections) => {
                Transformed::Replace(Selection::LinkedField(Arc::new(LinkedField {
                    selections,
                    ..field.clone()
                })))
            }
        }
    }

    fn transform_condition(&mut self, condition: &Condition) -> Transformed<Selection> {
        if !self.skip_impossible {
            return self.default_transform_condition(condition);
        }
        match self.transform_selections(&condition.selections) {
            TransformedValue::Keep => Transformed::Keep,
            TransformedValue::Replace(selections) if selections.is_empty() => Transformed::Delete,
            TransformedValue::Replace(selections) => {
                Transformed::Replace(Selection::Condition(Arc::new(Condition {
                    selections,
                    ..condition.clone()
                })))
            }
        }
    }

    fn transform_scalar_field(&mut self, _field: &ScalarField) -> Transformed<Selection> {
        Transformed::Keep
    }
}
