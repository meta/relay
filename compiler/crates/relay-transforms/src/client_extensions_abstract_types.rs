/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

use std::collections::HashMap;
use std::collections::hash_map::Entry;
use std::mem;
use std::sync::Arc;

use graphql_ir::FragmentDefinition;
use graphql_ir::FragmentDefinitionName;
use graphql_ir::FragmentSpread;
use graphql_ir::InlineFragment;
use graphql_ir::OperationDefinition;
use graphql_ir::Program;
use graphql_ir::Selection;
use graphql_ir::Transformed;
use graphql_ir::Transformer;
use graphql_ir::associated_data_impl;
use intern::string_key::StringKey;
use intern::string_key::StringKeySet;
use relay_schema::client_implementors::client_implementors_of;
use schema::ObjectID;
use schema::Schema;
use schema::Type;

use crate::generate_abstract_type_refinement_key;

/// A transform collects data about which concrete types implement client schema
/// extension abstract types (interfaces and unions).
pub fn client_extensions_abstract_types(program: &Program) -> Program {
    let mut transform = ClientExtensionsAbstactTypesTransform::new(program);
    transform
        .transform_program(program)
        .replace_or_else(|| program.clone())
}

#[derive(Clone, Debug, PartialEq, Eq, Hash)]
pub struct AbstractTypeImplements {
    pub name: StringKey,
    pub concrete: Vec<StringKey>,
}

#[derive(Clone, Debug, PartialEq, Eq, Hash)]
pub struct ClientExtensionAbstractTypeMetadataDirective {
    pub abstract_types: Vec<AbstractTypeImplements>,
}
associated_data_impl!(ClientExtensionAbstractTypeMetadataDirective);

/// Maps an abstract type (union or interface) to a list of
/// concrete types which implement that interface.
type TypeMap = HashMap<StringKey, StringKeySet>;

#[derive(Clone)]
enum PendingFragment {
    Pending,
    Resolved(TypeMap),
}

struct ClientExtensionsAbstactTypesTransform<'program> {
    program: &'program Program,
    abstract_type_map: TypeMap,
    fragment_type_maps: HashMap<FragmentDefinitionName, PendingFragment>,
}

impl<'program> ClientExtensionsAbstactTypesTransform<'program> {
    fn new(program: &'program Program) -> Self {
        Self {
            program,
            abstract_type_map: Default::default(),
            fragment_type_maps: Default::default(),
        }
    }

    /// Records all nessesary type relationships for a fragment type condition.
    fn handle_type_condition(&mut self, type_condition: Type) {
        match type_condition {
            Type::Interface(interface_id) => {
                let interface = self.program.schema.interface(interface_id);
                if interface.is_extension {
                    self.add_abstract_type(type_condition, &interface.implementing_objects);
                } else {
                    // The server answers `__is<Interface>` for its own types
                    // only, so record the client-defined ones.
                    let client_implementors =
                        client_implementors_of(&self.program.schema, type_condition);
                    if !client_implementors.is_empty() {
                        self.add_abstract_type(type_condition, &client_implementors);
                    }
                }
            }
            Type::Union(union_id) => {
                let union = self.program.schema.union(union_id);
                if union.is_extension {
                    self.add_abstract_type(type_condition, &union.members)
                } else {
                    let client_members =
                        client_implementors_of(&self.program.schema, type_condition);
                    if !client_members.is_empty() {
                        self.add_abstract_type(type_condition, &client_members);
                    }
                }
            }
            Type::Object(_) => {
                // For concerete type conditions, we don't need to record any additional data.
            }
            _ => panic!("Expected type condition to be on an Interface, Object or Union"),
        };
    }

    /// Record that a list of concrete types match an abstract type
    fn add_abstract_type(&mut self, abstract_type: Type, object_ids: &[ObjectID]) {
        let abstract_type_name =
            generate_abstract_type_refinement_key(&self.program.schema, abstract_type);
        let names_iter = object_ids
            .iter()
            .map(|object_id| self.program.schema.object(*object_id).name.item.0);
        match self.abstract_type_map.entry(abstract_type_name) {
            Entry::Occupied(mut occupied) => {
                occupied.get_mut().extend(names_iter);
            }
            Entry::Vacant(vacant) => {
                vacant.insert(names_iter.collect::<StringKeySet>());
            }
        }
    }

    /// Add all type relationships that are referenced within a fragment definition.
    /// Caches on a per-definition basis so each fragment is explored at most once.
    fn traverse_into_fragment_spread(&mut self, fragment_definition: &Arc<FragmentDefinition>) {
        let pending_fragment = match self.fragment_type_maps.get(&fragment_definition.name.item) {
            Some(type_map) => type_map.clone(),
            None => {
                // Set aside the previously discovered types
                let parent_type_map = mem::take(&mut self.abstract_type_map);

                // Mark this fragment as pending so that we can detect cycles and avoid deadlock.
                self.fragment_type_maps
                    .insert(fragment_definition.name.item, PendingFragment::Pending);

                // Collect type information from the fragment definition
                self.default_transform_fragment(fragment_definition);

                // Reset back to the previously seen type information
                let fragment_type_map = mem::replace(&mut self.abstract_type_map, parent_type_map);

                let pending_fragment = PendingFragment::Resolved(fragment_type_map);

                // Cache fragment results
                self.fragment_type_maps
                    .insert(fragment_definition.name.item, pending_fragment.clone());

                // Return the fragment's type map
                pending_fragment
            }
        };

        match pending_fragment {
            PendingFragment::Pending => {
                panic!(
                    "Unexpected fragment cycle. We expect these to be caught earlier in the transform pipeline in apply_fragment_arguments."
                )
            }
            PendingFragment::Resolved(type_map) => {
                // Augment this query's type map with the type information from the fragment.
                for (key, value) in type_map.into_iter() {
                    match self.abstract_type_map.entry(key) {
                        Entry::Occupied(mut occupied) => {
                            occupied.get_mut().extend(value);
                        }
                        Entry::Vacant(vacant) => {
                            vacant.insert(value);
                        }
                    }
                }
            }
        };
    }
}

impl Transformer<'_> for ClientExtensionsAbstactTypesTransform<'_> {
    const NAME: &'static str = "ClientExtensionsAbstactTypesTransform";
    const VISIT_ARGUMENTS: bool = false;
    const VISIT_DIRECTIVES: bool = false;

    fn transform_operation(
        &mut self,
        operation: &OperationDefinition,
    ) -> Transformed<OperationDefinition> {
        self.default_transform_operation(operation);
        if self.abstract_type_map.is_empty() {
            Transformed::Keep
        } else {
            // Get this operation's type map, and also reset the state for the next operation.
            let abstract_type_map = mem::take(&mut self.abstract_type_map);

            let mut directives = operation.directives.clone();

            // Convert hashmap/hashset into Vecs in order to be compatible with
            // AssociatedData which must implmenent Hash.
            let mut abstract_types = abstract_type_map
                .into_iter()
                .map(|(name, concrete)| {
                    let mut concrete_vec = concrete.into_iter().collect::<Vec<_>>();
                    // Sort to ensure stable output
                    concrete_vec.sort();
                    AbstractTypeImplements {
                        name,
                        concrete: concrete_vec,
                    }
                })
                .collect::<Vec<_>>();

            // Sort to ensure stable output
            abstract_types.sort_by_key(|a| a.name);

            directives.push(ClientExtensionAbstractTypeMetadataDirective { abstract_types }.into());

            Transformed::Replace(OperationDefinition {
                directives,
                ..operation.clone()
            })
        }
    }

    fn transform_fragment(
        &mut self,
        _fragment: &FragmentDefinition,
    ) -> Transformed<FragmentDefinition> {
        // We don't care about fragment definitions themselves, only ones that
        // we encounter as fragment spreads. We traverse fragments only when we
        // encounter it being spread into an operation.
        Transformed::Keep
    }

    /// Record type information about inline fragments with type conditions, and
    /// traverse into the inline fragment's selections.
    fn transform_inline_fragment(&mut self, fragment: &InlineFragment) -> Transformed<Selection> {
        if let Some(type_condition) = fragment.type_condition {
            self.handle_type_condition(type_condition)
        }
        self.default_transform_inline_fragment(fragment)
    }

    /// Record type information about the type condition of a spread fragment,
    /// as well as any type information needed for the contents of the named fragment.
    fn transform_fragment_spread(&mut self, spread: &FragmentSpread) -> Transformed<Selection> {
        let maybe_fragment_definition = self.program.fragment(spread.fragment.item);

        if let Some(fragment_definition) = maybe_fragment_definition {
            self.handle_type_condition(fragment_definition.type_condition);

            self.traverse_into_fragment_spread(fragment_definition);
        }
        self.default_transform_fragment_spread(spread)
    }
}
