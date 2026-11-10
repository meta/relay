/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

#![deny(warnings)]
#![deny(rust_2018_idioms)]
#![deny(clippy::all)]

pub mod check;
pub mod definitions;
use std::hash::Hash;
use std::hash::Hasher;

use common::SourceLocationKey;
use fnv::FnvHashMap;
use fnv::FnvHashSet;
use graphql_syntax::ConstantDirective;
use graphql_syntax::ConstantValue;
use graphql_syntax::EnumTypeDefinition;
use graphql_syntax::FieldDefinition;
use graphql_syntax::Identifier;
use graphql_syntax::InputObjectTypeDefinition;
use graphql_syntax::InputValueDefinition;
use graphql_syntax::InterfaceTypeDefinition;
use graphql_syntax::List;
use graphql_syntax::ObjectTypeDefinition;
use graphql_syntax::ScalarTypeDefinition;
use graphql_syntax::TypeSystemDefinition;
use graphql_syntax::UnionTypeDefinition;
use graphql_syntax::parse_schema_document;
use intern::string_key::StringKey;
use rayon::prelude::*;
use schema::DirectiveValue;
use schema::SDLSchema;
use schema::Schema;
use schema::Type as SchemaType;
use schema::TypeReference;

use crate::definitions::*;

fn add_definition(changes: &mut Vec<DefinitionChange>, def: &TypeSystemDefinition) -> bool {
    use DefinitionChange::*;

    match def {
        TypeSystemDefinition::ScalarTypeDefinition(ScalarTypeDefinition { name, .. }) => {
            changes.push(ScalarAdded(name.value));
            true
        }
        TypeSystemDefinition::UnionTypeDefinition(UnionTypeDefinition { name, .. }) => {
            changes.push(UnionAdded(name.value));
            true
        }
        TypeSystemDefinition::EnumTypeDefinition(EnumTypeDefinition { name, .. }) => {
            changes.push(EnumAdded(name.value));
            true
        }
        TypeSystemDefinition::InputObjectTypeDefinition(InputObjectTypeDefinition {
            name, ..
        }) => {
            changes.push(InputObjectAdded(name.value));
            true
        }
        TypeSystemDefinition::InterfaceTypeDefinition(InterfaceTypeDefinition { name, .. }) => {
            changes.push(InterfaceAdded(name.value));
            true
        }
        TypeSystemDefinition::ObjectTypeDefinition(ObjectTypeDefinition { name, .. }) => {
            changes.push(ObjectAdded(name.value));
            true
        }
        // We currently don't handle changes of unsupported types,
        // If those type changes occur, we should return early for a full rebuild.
        TypeSystemDefinition::InterfaceTypeExtension(..)
        | TypeSystemDefinition::ObjectTypeExtension(..)
        | TypeSystemDefinition::SchemaDefinition(..)
        | TypeSystemDefinition::DirectiveDefinition(..)
        | TypeSystemDefinition::DirectiveDefinitionExtension(..)
        | TypeSystemDefinition::SchemaExtension(..)
        | TypeSystemDefinition::EnumTypeExtension(..)
        | TypeSystemDefinition::UnionTypeExtension(..)
        | TypeSystemDefinition::InputObjectTypeExtension(..)
        | TypeSystemDefinition::ScalarTypeExtension(..) => false,
    }
}

fn build_current_map(
    current: &[TypeSystemDefinition],
) -> FnvHashMap<&StringKey, &TypeSystemDefinition> {
    let mut current_map = FnvHashMap::default();

    for def in current {
        match def {
            TypeSystemDefinition::EnumTypeDefinition(EnumTypeDefinition { name, .. })
            | TypeSystemDefinition::UnionTypeDefinition(UnionTypeDefinition { name, .. })
            | TypeSystemDefinition::InputObjectTypeDefinition(InputObjectTypeDefinition {
                name,
                ..
            })
            | TypeSystemDefinition::InterfaceTypeDefinition(InterfaceTypeDefinition {
                name, ..
            })
            | TypeSystemDefinition::ObjectTypeDefinition(ObjectTypeDefinition { name, .. })
            | TypeSystemDefinition::ScalarTypeDefinition(ScalarTypeDefinition { name, .. }) => {
                current_map.insert(&name.value, def);
            }
            // We skip diffing the following definitions
            TypeSystemDefinition::EnumTypeExtension(..)
            | TypeSystemDefinition::UnionTypeExtension(..)
            | TypeSystemDefinition::InputObjectTypeExtension(..)
            | TypeSystemDefinition::InterfaceTypeExtension(..)
            | TypeSystemDefinition::ObjectTypeExtension(..)
            | TypeSystemDefinition::ScalarTypeExtension(..)
            | TypeSystemDefinition::SchemaDefinition(..)
            | TypeSystemDefinition::SchemaExtension(..)
            | TypeSystemDefinition::DirectiveDefinition(..)
            | TypeSystemDefinition::DirectiveDefinitionExtension(..) => {}
        }
    }
    current_map
}

fn compare_fields(
    optional_current_fields: Option<&List<FieldDefinition>>,
    optional_previous_fields: Option<List<FieldDefinition>>,
) -> (Vec<TypeChange>, Vec<TypeChange>, Vec<ArgumentChange>) {
    let mut added: Vec<TypeChange> = vec![];
    let mut removed: Vec<TypeChange> = vec![];
    let mut field_changed: Vec<ArgumentChange> = vec![];

    match (optional_current_fields, optional_previous_fields) {
        (Some(current_fields), Some(previous_fields)) => {
            let mut previous_values = previous_fields
                .items
                .into_iter()
                .map(|input| (input.name.value, input))
                .collect::<FnvHashMap<_, _>>();

            for field in &current_fields.items {
                match previous_values.remove(&field.name.value) {
                    None => {
                        added.push(TypeChange {
                            name: field.name.value,
                            type_: Type::from(field.type_.clone()),
                        });
                    }
                    Some(previous_field) => {
                        let previous_field_type = Type::from(previous_field.type_.clone());
                        let field_type = Type::from(field.type_.clone());
                        // A directive change is reported like a type change, as an
                        // `added`/`removed` pair, so `check::is_field_changes_safe` marks
                        // the enclosing type for an incremental rebuild.
                        if previous_field_type != field_type
                            || directives_differ(&field.directives, &previous_field.directives)
                        {
                            added.push(TypeChange {
                                name: field.name.value,
                                type_: field_type,
                            });
                            removed.push(TypeChange {
                                name: previous_field.name.value,
                                type_: previous_field_type,
                            });
                        } else {
                            match (field.arguments.as_ref(), previous_field.arguments) {
                                (Some(current_field_arguments), Some(previous_field_arguments)) => {
                                    let (args_added, args_removed) = compare_input_value_definition(
                                        &current_field_arguments.items,
                                        previous_field_arguments.items,
                                    );
                                    if !args_added.is_empty() || !args_removed.is_empty() {
                                        field_changed.push(ArgumentChange {
                                            name: field.name.value,
                                            added: args_added,
                                            removed: args_removed,
                                        });
                                    }
                                }
                                (Some(current_field_arguments), None) => {
                                    let current_field_arguments = current_field_arguments.clone();
                                    let args_added = current_field_arguments
                                        .items
                                        .into_iter()
                                        .map(|InputValueDefinition { name, type_, .. }| {
                                            TypeChange {
                                                name: name.value,
                                                type_: Type::from(type_),
                                            }
                                        })
                                        .collect();
                                    let args_removed = vec![];
                                    field_changed.push(ArgumentChange {
                                        name: field.name.value,
                                        added: args_added,
                                        removed: args_removed,
                                    });
                                }
                                (None, Some(previous_field_arguments)) => {
                                    let args_added = vec![];
                                    let args_removed = previous_field_arguments
                                        .items
                                        .into_iter()
                                        .map(|InputValueDefinition { name, type_, .. }| {
                                            TypeChange {
                                                name: name.value,
                                                type_: Type::from(type_),
                                            }
                                        })
                                        .collect();
                                    field_changed.push(ArgumentChange {
                                        name: field.name.value,
                                        added: args_added,
                                        removed: args_removed,
                                    });
                                }
                                (None, None) => {}
                            }
                        }
                    }
                }
            }
            removed.extend(previous_values.drain().map(|(_, field)| TypeChange {
                name: field.name.value,
                type_: Type::from(field.type_),
            }));
        }
        (None, Some(previous_fields)) => {
            removed.extend(previous_fields.items.into_iter().map(
                |FieldDefinition { name, type_, .. }| TypeChange {
                    name: name.value,
                    type_: Type::from(type_),
                },
            ));
        }
        (Some(current_fields), None) => {
            let current_field_items = current_fields.items.clone();
            added.extend(current_field_items.into_iter().map(
                |FieldDefinition { name, type_, .. }| TypeChange {
                    name: name.value,
                    type_: Type::from(type_),
                },
            ));
        }
        (None, None) => {}
    }

    (added, removed, field_changed)
}

fn compare_input_value_definition(
    current: &[InputValueDefinition],
    previous: Vec<InputValueDefinition>,
) -> (Vec<TypeChange>, Vec<TypeChange>) {
    let mut previous_values = previous
        .into_iter()
        .map(|value_def| (value_def.name.value, value_def.type_))
        .collect::<FnvHashMap<_, _>>();

    let mut added = vec![];
    let mut removed = vec![];

    for field in current {
        let previous_type = previous_values.remove(&field.name.value);
        match previous_type {
            None => {
                added.push(TypeChange {
                    name: field.name.value,
                    type_: Type::from(field.type_.clone()),
                });
            }
            Some(previous_type) => {
                let previous_type = Type::from(previous_type);
                let field_type = Type::from(field.type_.clone());
                if previous_type != field_type {
                    removed.push(TypeChange {
                        name: field.name.value,
                        type_: previous_type,
                    });
                    added.push(TypeChange {
                        name: field.name.value,
                        type_: field_type,
                    });
                }
            }
        }
    }
    removed.extend(previous_values.drain().map(|(name, type_)| TypeChange {
        name,
        type_: Type::from(type_),
    }));

    (added, removed)
}

/// Whether two directive lists differ, ignoring source positions (the derived
/// `PartialEq` on syntax nodes compares spans and tokens). Directive order is
/// significant (spec §2.12); argument order is not (§2.6).
fn directives_differ(current: &[ConstantDirective], previous: &[ConstantDirective]) -> bool {
    current.len() != previous.len()
        || current.iter().zip(previous).any(|(current, previous)| {
            current.name.value != previous.name.value
                || arguments_differ(
                    current
                        .arguments
                        .iter()
                        .flat_map(|list| &list.items)
                        .map(|argument| (argument.name.value, &argument.value)),
                    previous
                        .arguments
                        .iter()
                        .flat_map(|list| &list.items)
                        .map(|argument| (argument.name.value, &argument.value)),
                )
        })
}

/// `directives_differ` for directives read from an `SDLSchema`.
fn directive_values_differ(current: &[DirectiveValue], previous: &[DirectiveValue]) -> bool {
    current.len() != previous.len()
        || current.iter().zip(previous).any(|(current, previous)| {
            current.name != previous.name
                || arguments_differ(
                    current
                        .arguments
                        .iter()
                        .map(|argument| (argument.name.0, &argument.value)),
                    previous
                        .arguments
                        .iter()
                        .map(|argument| (argument.name.0, &argument.value)),
                )
        })
}

/// Arguments, or input-object literal fields, matched by name.
fn arguments_differ<'a>(
    current: impl Iterator<Item = (StringKey, &'a ConstantValue)>,
    previous: impl Iterator<Item = (StringKey, &'a ConstantValue)>,
) -> bool {
    let mut previous_values = previous.collect::<FnvHashMap<_, _>>();

    for (name, value) in current {
        match previous_values.remove(&name) {
            Some(previous_value) if !constant_values_differ(value, previous_value) => {}
            _ => return true,
        }
    }
    !previous_values.is_empty()
}

fn constant_values_differ(current: &ConstantValue, previous: &ConstantValue) -> bool {
    match (current, previous) {
        (ConstantValue::Int(current), ConstantValue::Int(previous)) => {
            current.value != previous.value
        }
        (ConstantValue::Float(current), ConstantValue::Float(previous)) => {
            current.value != previous.value
        }
        (ConstantValue::String(current), ConstantValue::String(previous)) => {
            current.value != previous.value
        }
        (ConstantValue::Boolean(current), ConstantValue::Boolean(previous)) => {
            current.value != previous.value
        }
        (ConstantValue::Null(_), ConstantValue::Null(_)) => false,
        (ConstantValue::Enum(current), ConstantValue::Enum(previous)) => {
            current.value != previous.value
        }
        (ConstantValue::List(current), ConstantValue::List(previous)) => {
            current.items.len() != previous.items.len()
                || current
                    .items
                    .iter()
                    .zip(&previous.items)
                    .any(|(current, previous)| constant_values_differ(current, previous))
        }
        (ConstantValue::Object(current), ConstantValue::Object(previous)) => arguments_differ(
            current
                .items
                .iter()
                .map(|field| (field.name.value, &field.value)),
            previous
                .items
                .iter()
                .map(|field| (field.name.value, &field.value)),
        ),
        _ => true,
    }
}

fn compare_string_keys(
    current: &[Identifier],
    previous: Vec<Identifier>,
) -> (Vec<StringKey>, Vec<StringKey>) {
    let mut previous_values = previous
        .into_iter()
        .map(|ident| ident.value)
        .collect::<FnvHashSet<_>>();
    let mut added: Vec<StringKey> = vec![];
    for key in current {
        if !previous_values.remove(&key.value) {
            added.push(key.value);
        }
    }
    let removed: Vec<StringKey> = previous_values.drain().collect();
    (added, removed)
}

fn diff(current: Vec<TypeSystemDefinition>, previous: Vec<TypeSystemDefinition>) -> SchemaChange {
    into_schema_change(diff_definitions(current, previous))
}

/// The definition changes, or `None` for a change `diff` reports as generic
/// right away (a definition replaced by one of an unsupported kind).
fn diff_definitions(
    current: Vec<TypeSystemDefinition>,
    previous: Vec<TypeSystemDefinition>,
) -> Option<Vec<DefinitionChange>> {
    let mut changes = vec![];
    let mut current_map = build_current_map(&current);

    for definition in previous {
        match definition {
            TypeSystemDefinition::EnumTypeDefinition(EnumTypeDefinition {
                name,
                values: previous_values,
                ..
            }) => {
                let def = current_map.remove(&name.value);
                match (def, previous_values) {
                    (
                        Some(TypeSystemDefinition::EnumTypeDefinition(EnumTypeDefinition {
                            values: Some(values),
                            ..
                        })),
                        Some(previous_values),
                    ) => {
                        if values.items.len() != previous_values.items.len() {
                            changes.push(DefinitionChange::EnumChanged { name: name.value });
                        } else {
                            for i in 0..values.items.len() {
                                if values.items[i].name.value != previous_values.items[i].name.value
                                {
                                    changes
                                        .push(DefinitionChange::EnumChanged { name: name.value });
                                    break;
                                }
                            }
                        }
                    }
                    (None, _) => {
                        changes.push(DefinitionChange::EnumRemoved(name.value));
                    }
                    (Some(def), _) => {
                        if !add_definition(&mut changes, def) {
                            return None;
                        }
                        changes.push(DefinitionChange::EnumRemoved(name.value));
                    }
                }
            }

            TypeSystemDefinition::UnionTypeDefinition(UnionTypeDefinition {
                name,
                members: previous_members,
                ..
            }) => {
                let def = current_map.remove(&name.value);
                match def {
                    Some(TypeSystemDefinition::UnionTypeDefinition(UnionTypeDefinition {
                        members,
                        ..
                    })) => {
                        let (added, removed) = compare_string_keys(members, previous_members);
                        if !added.is_empty() || !removed.is_empty() {
                            changes.push(DefinitionChange::UnionChanged {
                                name: name.value,
                                added,
                                removed,
                            });
                        }
                    }
                    None => {
                        changes.push(DefinitionChange::UnionRemoved(name.value));
                    }
                    Some(def) => {
                        if !add_definition(&mut changes, def) {
                            return None;
                        }
                        changes.push(DefinitionChange::UnionRemoved(name.value));
                    }
                }
            }

            TypeSystemDefinition::InputObjectTypeDefinition(InputObjectTypeDefinition {
                name,
                fields: previous_fields,
                ..
            }) => {
                let def = current_map.remove(&name.value);
                match def {
                    Some(TypeSystemDefinition::InputObjectTypeDefinition(
                        InputObjectTypeDefinition {
                            fields: Some(fields),
                            ..
                        },
                    )) => {
                        let (added, removed) = compare_input_value_definition(
                            &fields.items,
                            previous_fields
                                .into_iter()
                                .flat_map(|list| list.items)
                                .collect(),
                        );
                        if !added.is_empty() || !removed.is_empty() {
                            changes.push(DefinitionChange::InputObjectChanged {
                                name: name.value,
                                added,
                                removed,
                            });
                        }
                    }
                    None
                    | Some(TypeSystemDefinition::InputObjectTypeDefinition(
                        InputObjectTypeDefinition { fields: None, .. },
                    )) => {
                        changes.push(DefinitionChange::InputObjectRemoved(name.value));
                    }
                    Some(def) => {
                        if !add_definition(&mut changes, def) {
                            return None;
                        }
                        changes.push(DefinitionChange::InputObjectRemoved(name.value));
                    }
                }
            }

            TypeSystemDefinition::InterfaceTypeDefinition(InterfaceTypeDefinition {
                name,
                fields: optional_previous_fields,
                ..
            }) => {
                let def = current_map.remove(&name.value);
                match def {
                    Some(TypeSystemDefinition::InterfaceTypeDefinition(
                        InterfaceTypeDefinition {
                            fields: optional_current_fields,
                            ..
                        },
                    )) => {
                        let (added, removed, changed) = compare_fields(
                            optional_current_fields.as_ref(),
                            optional_previous_fields,
                        );
                        if !added.is_empty() || !removed.is_empty() || !changed.is_empty() {
                            changes.push(DefinitionChange::InterfaceChanged {
                                name: name.value,
                                added,
                                removed,
                                changed,
                            });
                        }
                    }
                    None => {
                        changes.push(DefinitionChange::InterfaceRemoved(name.value));
                    }
                    Some(def) => {
                        if !add_definition(&mut changes, def) {
                            return None;
                        }
                        changes.push(DefinitionChange::InterfaceRemoved(name.value));
                    }
                }
            }

            TypeSystemDefinition::ObjectTypeDefinition(ObjectTypeDefinition {
                name,
                interfaces: previous_interfaces,
                fields: optional_previous_fields,
                ..
            }) => {
                let def = current_map.remove(&name.value);
                match def {
                    Some(TypeSystemDefinition::ObjectTypeDefinition(ObjectTypeDefinition {
                        interfaces: current_interfaces,
                        fields: optional_current_fields,
                        ..
                    })) => {
                        let (added, removed, changed) = compare_fields(
                            optional_current_fields.as_ref(),
                            optional_previous_fields,
                        );
                        let (interfaces_added, interfaces_removed) =
                            compare_string_keys(current_interfaces, previous_interfaces);
                        if !added.is_empty()
                            || !removed.is_empty()
                            || !changed.is_empty()
                            || !interfaces_added.is_empty()
                            || !interfaces_removed.is_empty()
                        {
                            changes.push(DefinitionChange::ObjectChanged {
                                name: name.value,
                                added,
                                removed,
                                changed,
                                interfaces_added,
                                interfaces_removed,
                            });
                        }
                    }
                    None => {
                        changes.push(DefinitionChange::ObjectRemoved {
                            name: name.value,
                            interfaces: previous_interfaces
                                .iter()
                                .map(|ident| ident.value)
                                .collect(),
                        });
                    }
                    Some(def) => {
                        if !add_definition(&mut changes, def) {
                            return None;
                        }
                        changes.push(DefinitionChange::ObjectRemoved {
                            name: name.value,
                            interfaces: previous_interfaces
                                .iter()
                                .map(|ident| ident.value)
                                .collect(),
                        });
                    }
                }
            }

            TypeSystemDefinition::ScalarTypeDefinition(ScalarTypeDefinition { name, .. }) => {
                let def = current_map.remove(&name.value);
                match def {
                    None => {
                        changes.push(DefinitionChange::ScalarRemoved(name.value));
                    }
                    Some(TypeSystemDefinition::ScalarTypeDefinition(ScalarTypeDefinition {
                        ..
                    })) => {}
                    Some(def) => {
                        if !add_definition(&mut changes, def) {
                            return None;
                        }
                        changes.push(DefinitionChange::ScalarRemoved(name.value));
                    }
                }
            }

            // We skip diffing the following definitions
            TypeSystemDefinition::InterfaceTypeExtension(..)
            | TypeSystemDefinition::ObjectTypeExtension(..)
            | TypeSystemDefinition::SchemaDefinition(..)
            | TypeSystemDefinition::DirectiveDefinition(..)
            | TypeSystemDefinition::DirectiveDefinitionExtension(..)
            | TypeSystemDefinition::SchemaExtension(_)
            | TypeSystemDefinition::EnumTypeExtension(_)
            | TypeSystemDefinition::UnionTypeExtension(_)
            | TypeSystemDefinition::InputObjectTypeExtension(_)
            | TypeSystemDefinition::ScalarTypeExtension(_) => {}
        }
    }

    for (_, definition) in current_map.drain() {
        add_definition(&mut changes, definition);
    }

    Some(changes)
}

fn into_schema_change(changes: Option<Vec<DefinitionChange>>) -> SchemaChange {
    match changes {
        // The schema has changed, but we currently don't detect directive definition changes,
        // schema definition changes, and we don't parse client extensions.
        // But we can add them later if some of the changes don't require full rebuilds.
        None => SchemaChange::GenericChange,
        Some(changes) if changes.is_empty() => SchemaChange::GenericChange,
        Some(changes) => SchemaChange::DefinitionChanges(changes),
    }
}

/// [`diff`] split by type name across threads. A named definition is only
/// ever compared with the same name on the other side, and `diff` skips
/// unnamed definitions and extensions, so each name's partition diffs on its
/// own; any partition's generic change makes the whole change generic.
fn diff_in_parallel(
    current: Vec<TypeSystemDefinition>,
    previous: Vec<TypeSystemDefinition>,
) -> SchemaChange {
    let partition_count = rayon::current_num_threads().max(1);
    let partition = |definitions: Vec<TypeSystemDefinition>| {
        let mut partitions: Vec<Vec<TypeSystemDefinition>> =
            (0..partition_count).map(|_| Vec::new()).collect();
        for definition in definitions {
            if let Some(name) = definition_name(&definition) {
                let mut hasher = fnv::FnvHasher::default();
                name.hash(&mut hasher);
                partitions[hasher.finish() as usize % partition_count].push(definition);
            }
        }
        partitions
    };
    let (current, previous) = rayon::join(|| partition(current), || partition(previous));

    let changes: Option<Vec<Vec<DefinitionChange>>> = current
        .into_par_iter()
        .zip(previous)
        .map(|(current, previous)| diff_definitions(current, previous))
        .collect();
    into_schema_change(changes.map(|changes| changes.into_iter().flatten().collect()))
}

/// The name `diff` matches a type definition by; `None` for definitions it
/// skips.
fn definition_name(definition: &TypeSystemDefinition) -> Option<StringKey> {
    match definition {
        TypeSystemDefinition::EnumTypeDefinition(EnumTypeDefinition { name, .. })
        | TypeSystemDefinition::UnionTypeDefinition(UnionTypeDefinition { name, .. })
        | TypeSystemDefinition::InputObjectTypeDefinition(InputObjectTypeDefinition {
            name, ..
        })
        | TypeSystemDefinition::InterfaceTypeDefinition(InterfaceTypeDefinition { name, .. })
        | TypeSystemDefinition::ObjectTypeDefinition(ObjectTypeDefinition { name, .. })
        | TypeSystemDefinition::ScalarTypeDefinition(ScalarTypeDefinition { name, .. }) => {
            Some(name.value)
        }
        TypeSystemDefinition::EnumTypeExtension(..)
        | TypeSystemDefinition::UnionTypeExtension(..)
        | TypeSystemDefinition::InputObjectTypeExtension(..)
        | TypeSystemDefinition::InterfaceTypeExtension(..)
        | TypeSystemDefinition::ObjectTypeExtension(..)
        | TypeSystemDefinition::ScalarTypeExtension(..)
        | TypeSystemDefinition::SchemaDefinition(..)
        | TypeSystemDefinition::SchemaExtension(..)
        | TypeSystemDefinition::DirectiveDefinition(..)
        | TypeSystemDefinition::DirectiveDefinitionExtension(..) => None,
    }
}

pub fn detect_changes(current_text: &[&str], previous_text: &[&str]) -> SchemaChange {
    if current_text == previous_text {
        return SchemaChange::None;
    }

    let current_joined = current_text.join("\n");
    let previous_joined = previous_text.join("\n");

    let (current_result, previous_result) = rayon::join(
        || parse_schema_document(&current_joined, SourceLocationKey::Generated),
        || parse_schema_document(&previous_joined, SourceLocationKey::Generated),
    );

    match (current_result, previous_result) {
        (Ok(current_schema), Ok(previous_schema)) => {
            diff(current_schema.definitions, previous_schema.definitions)
        }
        (_, _) => SchemaChange::InvalidSchema,
    }
}

/// [`detect_changes`] for documents that each parse on their own: parses them
/// independently and in parallel instead of as one joined document on a
/// single thread per side. `None` when any document does not parse on its own.
///
/// A document that parses on its own ends with a complete definition, and the
/// next one starts a new definition, so the joined parse yields the same
/// definitions; the diff ignores their source positions.
pub fn try_detect_changes_per_document(
    current_text: &[&str],
    previous_text: &[&str],
) -> Option<SchemaChange> {
    if current_text == previous_text {
        return Some(SchemaChange::None);
    }

    let (current_definitions, previous_definitions) = rayon::join(
        || parse_documents_parallel(current_text),
        || parse_documents_parallel(previous_text),
    );

    Some(diff_in_parallel(
        current_definitions?,
        previous_definitions?,
    ))
}

/// The definitions of all documents in order, or `None` if any of them fails
/// to parse on its own.
fn parse_documents_parallel(texts: &[&str]) -> Option<Vec<TypeSystemDefinition>> {
    let documents = texts
        .par_iter()
        .map(|text| parse_schema_document(text, SourceLocationKey::Generated).ok())
        .collect::<Option<Vec<_>>>()?;
    Some(
        documents
            .into_iter()
            .flat_map(|document| document.definitions)
            .collect(),
    )
}

fn type_ref_to_diff_type(schema: &SDLSchema, type_ref: &TypeReference<SchemaType>) -> Type {
    match type_ref {
        TypeReference::Named(t) => Type::Named(schema.get_type_name(*t)),
        TypeReference::NonNull(inner) => {
            Type::NonNull(Box::new(type_ref_to_diff_type(schema, inner)))
        }
        TypeReference::List(inner) => Type::List(Box::new(type_ref_to_diff_type(schema, inner))),
    }
}

fn compare_schema_fields(
    current_schema: &SDLSchema,
    current_field_ids: &[schema::FieldID],
    previous_schema: &SDLSchema,
    previous_field_ids: &[schema::FieldID],
) -> (Vec<TypeChange>, Vec<TypeChange>, Vec<ArgumentChange>) {
    let mut added = vec![];
    let mut removed = vec![];
    let mut field_changed = vec![];

    let mut previous_fields: FnvHashMap<StringKey, &schema::Field> = previous_field_ids
        .iter()
        .map(|id| {
            let f = previous_schema.field(*id);
            (f.name.item, f)
        })
        .collect();

    for field_id in current_field_ids {
        let current_field = current_schema.field(*field_id);
        let name = current_field.name.item;

        match previous_fields.remove(&name) {
            None => {
                added.push(TypeChange {
                    name,
                    type_: type_ref_to_diff_type(current_schema, &current_field.type_),
                });
            }
            Some(prev_field) => {
                let curr_type = type_ref_to_diff_type(current_schema, &current_field.type_);
                let prev_type = type_ref_to_diff_type(previous_schema, &prev_field.type_);
                // Reported like a type change; see `compare_fields`.
                if curr_type != prev_type
                    || directive_values_differ(&current_field.directives, &prev_field.directives)
                {
                    added.push(TypeChange {
                        name,
                        type_: curr_type,
                    });
                    removed.push(TypeChange {
                        name,
                        type_: prev_type,
                    });
                } else {
                    let (args_added, args_removed) = compare_schema_arguments(
                        current_schema,
                        &current_field.arguments,
                        previous_schema,
                        &prev_field.arguments,
                    );
                    if !args_added.is_empty() || !args_removed.is_empty() {
                        field_changed.push(ArgumentChange {
                            name,
                            added: args_added,
                            removed: args_removed,
                        });
                    }
                }
            }
        }
    }

    removed.extend(previous_fields.drain().map(|(name, f)| TypeChange {
        name,
        type_: type_ref_to_diff_type(previous_schema, &f.type_),
    }));

    (added, removed, field_changed)
}

fn compare_schema_arguments(
    current_schema: &SDLSchema,
    current_args: &schema::ArgumentDefinitions,
    previous_schema: &SDLSchema,
    previous_args: &schema::ArgumentDefinitions,
) -> (Vec<TypeChange>, Vec<TypeChange>) {
    let mut previous_map: FnvHashMap<StringKey, &schema::Argument> = previous_args
        .iter()
        .map(|arg| (arg.name.item.0, arg))
        .collect();

    let mut added = vec![];
    let mut removed = vec![];

    for arg in current_args.iter() {
        let name = arg.name.item.0;
        match previous_map.remove(&name) {
            None => {
                added.push(TypeChange {
                    name,
                    type_: type_ref_to_diff_type(current_schema, &arg.type_),
                });
            }
            Some(prev_arg) => {
                let curr_type = type_ref_to_diff_type(current_schema, &arg.type_);
                let prev_type = type_ref_to_diff_type(previous_schema, &prev_arg.type_);
                if curr_type != prev_type {
                    added.push(TypeChange {
                        name,
                        type_: curr_type,
                    });
                    removed.push(TypeChange {
                        name,
                        type_: prev_type,
                    });
                }
            }
        }
    }

    removed.extend(previous_map.drain().map(|(name, arg)| TypeChange {
        name,
        type_: type_ref_to_diff_type(previous_schema, &arg.type_),
    }));

    (added, removed)
}

/// Detects schema changes by comparing two `SDLSchema` objects directly,
/// without requiring SDL text or re-parsing. Works with both in-memory and
/// flatbuffer-backed schemas.
///
/// Returns the same `SchemaChange` variants as `detect_changes`:
/// - `SchemaChange::None` if no type definition differences are found
/// - `SchemaChange::DefinitionChanges(changes)` with specific per-type changes
pub fn detect_changes_from_schemas(current: &SDLSchema, previous: &SDLSchema) -> SchemaChange {
    let mut changes = vec![];

    let current_types: FnvHashMap<StringKey, SchemaType> =
        current.get_type_map().map(|(k, v)| (*k, *v)).collect();
    let mut unmatched_current: FnvHashSet<StringKey> = current_types.keys().copied().collect();

    for (prev_name, prev_type) in previous.get_type_map() {
        let prev_name = *prev_name;
        let prev_type = *prev_type;
        unmatched_current.remove(&prev_name);

        match current_types.get(&prev_name) {
            None => match prev_type {
                SchemaType::Enum(_) => changes.push(DefinitionChange::EnumRemoved(prev_name)),
                SchemaType::Union(_) => changes.push(DefinitionChange::UnionRemoved(prev_name)),
                SchemaType::InputObject(_) => {
                    changes.push(DefinitionChange::InputObjectRemoved(prev_name))
                }
                SchemaType::Interface(_) => {
                    changes.push(DefinitionChange::InterfaceRemoved(prev_name))
                }
                SchemaType::Object(id) => {
                    let prev_obj = previous.object(id);
                    changes.push(DefinitionChange::ObjectRemoved {
                        name: prev_name,
                        interfaces: prev_obj
                            .interfaces
                            .iter()
                            .map(|id| previous.get_type_name(SchemaType::Interface(*id)))
                            .collect(),
                    });
                }
                SchemaType::Scalar(_) => changes.push(DefinitionChange::ScalarRemoved(prev_name)),
            },
            Some(curr_type) => match (prev_type, *curr_type) {
                (SchemaType::Enum(prev_id), SchemaType::Enum(curr_id)) => {
                    let prev_enum = previous.enum_(prev_id);
                    let curr_enum = current.enum_(curr_id);
                    if prev_enum.values.len() != curr_enum.values.len() {
                        changes.push(DefinitionChange::EnumChanged { name: prev_name });
                    } else {
                        for i in 0..prev_enum.values.len() {
                            if prev_enum.values[i].value != curr_enum.values[i].value {
                                changes.push(DefinitionChange::EnumChanged { name: prev_name });
                                break;
                            }
                        }
                    }
                }
                (SchemaType::Union(prev_id), SchemaType::Union(curr_id)) => {
                    let prev_union = previous.union(prev_id);
                    let curr_union = current.union(curr_id);
                    let prev_members: FnvHashSet<StringKey> = prev_union
                        .members
                        .iter()
                        .map(|id| previous.get_type_name(SchemaType::Object(*id)))
                        .collect();
                    let curr_members: FnvHashSet<StringKey> = curr_union
                        .members
                        .iter()
                        .map(|id| current.get_type_name(SchemaType::Object(*id)))
                        .collect();
                    let added: Vec<StringKey> =
                        curr_members.difference(&prev_members).copied().collect();
                    let removed: Vec<StringKey> =
                        prev_members.difference(&curr_members).copied().collect();
                    if !added.is_empty() || !removed.is_empty() {
                        changes.push(DefinitionChange::UnionChanged {
                            name: prev_name,
                            added,
                            removed,
                        });
                    }
                }
                (SchemaType::InputObject(prev_id), SchemaType::InputObject(curr_id)) => {
                    let prev_input = previous.input_object(prev_id);
                    let curr_input = current.input_object(curr_id);
                    let (added, removed) = compare_schema_arguments(
                        current,
                        &curr_input.fields,
                        previous,
                        &prev_input.fields,
                    );
                    if !added.is_empty() || !removed.is_empty() {
                        changes.push(DefinitionChange::InputObjectChanged {
                            name: prev_name,
                            added,
                            removed,
                        });
                    }
                }
                (SchemaType::Interface(prev_id), SchemaType::Interface(curr_id)) => {
                    let prev_iface = previous.interface(prev_id);
                    let curr_iface = current.interface(curr_id);
                    let (added, removed, changed) = compare_schema_fields(
                        current,
                        &curr_iface.fields,
                        previous,
                        &prev_iface.fields,
                    );
                    if !added.is_empty() || !removed.is_empty() || !changed.is_empty() {
                        changes.push(DefinitionChange::InterfaceChanged {
                            name: prev_name,
                            added,
                            removed,
                            changed,
                        });
                    }
                }
                (SchemaType::Object(prev_id), SchemaType::Object(curr_id)) => {
                    let prev_obj = previous.object(prev_id);
                    let curr_obj = current.object(curr_id);
                    let (added, removed, changed) = compare_schema_fields(
                        current,
                        &curr_obj.fields,
                        previous,
                        &prev_obj.fields,
                    );
                    let prev_interfaces: FnvHashSet<StringKey> = prev_obj
                        .interfaces
                        .iter()
                        .map(|id| previous.get_type_name(SchemaType::Interface(*id)))
                        .collect();
                    let curr_interfaces: FnvHashSet<StringKey> = curr_obj
                        .interfaces
                        .iter()
                        .map(|id| current.get_type_name(SchemaType::Interface(*id)))
                        .collect();
                    let interfaces_added: Vec<StringKey> = curr_interfaces
                        .difference(&prev_interfaces)
                        .copied()
                        .collect();
                    let interfaces_removed: Vec<StringKey> = prev_interfaces
                        .difference(&curr_interfaces)
                        .copied()
                        .collect();
                    if !added.is_empty()
                        || !removed.is_empty()
                        || !changed.is_empty()
                        || !interfaces_added.is_empty()
                        || !interfaces_removed.is_empty()
                    {
                        changes.push(DefinitionChange::ObjectChanged {
                            name: prev_name,
                            added,
                            removed,
                            changed,
                            interfaces_added,
                            interfaces_removed,
                        });
                    }
                }
                (SchemaType::Scalar(_), SchemaType::Scalar(_)) => {
                    // Scalars are identified by name only; already matched.
                }
                // Type kind changed — record as removal of old kind + addition of new kind.
                (prev, curr) => {
                    match prev {
                        SchemaType::Enum(_) => {
                            changes.push(DefinitionChange::EnumRemoved(prev_name))
                        }
                        SchemaType::Union(_) => {
                            changes.push(DefinitionChange::UnionRemoved(prev_name))
                        }
                        SchemaType::InputObject(_) => {
                            changes.push(DefinitionChange::InputObjectRemoved(prev_name))
                        }
                        SchemaType::Interface(_) => {
                            changes.push(DefinitionChange::InterfaceRemoved(prev_name))
                        }
                        SchemaType::Object(id) => {
                            let prev_obj = previous.object(id);
                            changes.push(DefinitionChange::ObjectRemoved {
                                name: prev_name,
                                interfaces: prev_obj
                                    .interfaces
                                    .iter()
                                    .map(|id| previous.get_type_name(SchemaType::Interface(*id)))
                                    .collect(),
                            })
                        }
                        SchemaType::Scalar(_) => {
                            changes.push(DefinitionChange::ScalarRemoved(prev_name))
                        }
                    }
                    match curr {
                        SchemaType::Enum(_) => changes.push(DefinitionChange::EnumAdded(prev_name)),
                        SchemaType::Union(_) => {
                            changes.push(DefinitionChange::UnionAdded(prev_name))
                        }
                        SchemaType::InputObject(_) => {
                            changes.push(DefinitionChange::InputObjectAdded(prev_name))
                        }
                        SchemaType::Interface(_) => {
                            changes.push(DefinitionChange::InterfaceAdded(prev_name))
                        }
                        SchemaType::Object(_) => {
                            changes.push(DefinitionChange::ObjectAdded(prev_name))
                        }
                        SchemaType::Scalar(_) => {
                            changes.push(DefinitionChange::ScalarAdded(prev_name))
                        }
                    }
                }
            },
        }
    }

    // Types that exist only in the current schema are additions.
    for name in unmatched_current {
        if let Some(curr_type) = current_types.get(&name) {
            match curr_type {
                SchemaType::Enum(_) => changes.push(DefinitionChange::EnumAdded(name)),
                SchemaType::Union(_) => changes.push(DefinitionChange::UnionAdded(name)),
                SchemaType::InputObject(_) => {
                    changes.push(DefinitionChange::InputObjectAdded(name))
                }
                SchemaType::Interface(_) => changes.push(DefinitionChange::InterfaceAdded(name)),
                SchemaType::Object(_) => changes.push(DefinitionChange::ObjectAdded(name)),
                SchemaType::Scalar(_) => changes.push(DefinitionChange::ScalarAdded(name)),
            }
        }
    }

    if changes.is_empty() {
        SchemaChange::None
    } else {
        SchemaChange::DefinitionChanges(changes)
    }
}
