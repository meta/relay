/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

use std::collections::HashSet;
use std::fmt;
use std::sync::LazyLock;

use common::InterfaceName;
use intern::string_key::Intern;
use intern::string_key::StringKey;
use relay_config::SchemaConfig;
use rustc_hash::FxHashSet;
use schema::SDLSchema;
use schema::Schema;

use crate::definitions::ArgumentChange;
use crate::definitions::DefinitionChange;
use crate::definitions::SchemaChange;
use crate::definitions::Type;
use crate::definitions::TypeChange;

// This enum is very similar to the schema Type enum but uses StringKey instead of id
#[derive(Eq, PartialEq, Hash)]
pub enum IncrementalBuildSchemaChange {
    Enum(StringKey),
    InputObject(StringKey),
    Object(StringKey),
    Union(StringKey),
    Interface(StringKey),
}

impl fmt::Debug for IncrementalBuildSchemaChange {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            IncrementalBuildSchemaChange::Enum(name) => write!(f, "enum({name})"),
            IncrementalBuildSchemaChange::InputObject(name) => write!(f, "input_object({name})"),
            IncrementalBuildSchemaChange::Object(name) => write!(f, "object({name})"),
            IncrementalBuildSchemaChange::Union(name) => write!(f, "union({name})"),
            IncrementalBuildSchemaChange::Interface(name) => write!(f, "interface({name})"),
        }
    }
}

#[derive(PartialEq)]
pub enum SchemaChangeSafety {
    Unsafe,
    SafeWithIncrementalBuild(FxHashSet<IncrementalBuildSchemaChange>),
    Safe,
}

impl fmt::Debug for SchemaChangeSafety {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            SchemaChangeSafety::Unsafe => write!(f, "Unsafe"),
            SchemaChangeSafety::SafeWithIncrementalBuild(changes) => {
                write!(f, "SafeWithIncrementalBuild({changes:?})")
            }
            SchemaChangeSafety::Safe => write!(f, "Safe"),
        }
    }
}

// Return if the changes are safe to skip full rebuild or need an incremental build.
impl SchemaChange {
    pub fn get_safety(
        self: SchemaChange,
        schema: &SDLSchema,
        schema_config: &SchemaConfig,
    ) -> SchemaChangeSafety {
        let mut needs_incremental_build: FxHashSet<IncrementalBuildSchemaChange> =
            HashSet::default();
        match self {
            SchemaChange::None => SchemaChangeSafety::Safe,
            SchemaChange::GenericChange => SchemaChangeSafety::Unsafe,
            SchemaChange::InvalidSchema => SchemaChangeSafety::Unsafe,
            SchemaChange::DefinitionChanges(changes) => {
                for change in changes {
                    match change {
                        DefinitionChange::ObjectChanged {
                            name,
                            changed,
                            added,
                            removed,
                            interfaces_added,
                            interfaces_removed,
                        } => {
                            let id_name = schema_config.node_interface_id_field;
                            if !interfaces_added.is_empty()
                                || !interfaces_removed.is_empty()
                                || !is_field_changes_safe(&added, &removed, &changed, id_name)
                            {
                                needs_incremental_build
                                    .insert(IncrementalBuildSchemaChange::Object(name));

                                // Also mark the return types of changed fields
                                // so the finder can discover affected operations
                                // via visit_linked_field. This is essential for
                                // root types (Query, Mutation, Subscription)
                                // where Object("Mutation") alone won't match
                                // any linked field, but also improves precision
                                // for non-root types.
                                add_field_return_types_for_incremental_build(
                                    schema,
                                    &mut needs_incremental_build,
                                    &added,
                                    &removed,
                                );

                                let interfaces_changed: Vec<StringKey> = interfaces_added
                                    .into_iter()
                                    .chain(interfaces_removed)
                                    .collect();
                                add_interfaces_for_incremental_build(
                                    schema,
                                    &mut needs_incremental_build,
                                    name,
                                    &interfaces_changed,
                                    &added,
                                    &removed,
                                    id_name,
                                );
                            }
                        }
                        DefinitionChange::InterfaceChanged {
                            changed,
                            added,
                            removed,
                            ..
                        } => {
                            if !is_field_changes_safe(
                                &added,
                                &removed,
                                &changed,
                                schema_config.node_interface_id_field,
                            ) {
                                return SchemaChangeSafety::Unsafe;
                            }
                        }
                        DefinitionChange::ObjectAdded(name) => {
                            if !is_object_add_safe(name, schema, schema_config) {
                                // The new type has an id field and implements
                                // non-Node interfaces. Queries spreading on
                                // those interfaces may need updated inline
                                // spreads. Mark the object and its interfaces
                                // for incremental rebuild.
                                needs_incremental_build
                                    .insert(IncrementalBuildSchemaChange::Object(name));
                                if let Some(schema::Type::Object(id)) = schema.get_type(name) {
                                    let object = schema.object(id);
                                    for iface_id in &object.interfaces {
                                        let iface = schema.interface(*iface_id);
                                        // Skip Node: generate_id_field handles all Node
                                        // implementors via a single `... on Node { id }`
                                        // fragment, so adding a new Node implementor
                                        // never changes Node-only operations' output.
                                        if iface.name.item == *NODE_INTERFACE_KEY {
                                            continue;
                                        }
                                        needs_incremental_build.insert(
                                            IncrementalBuildSchemaChange::Interface(
                                                iface.name.item.0,
                                            ),
                                        );
                                    }
                                }
                            }
                        }
                        // The types that implement a server interface include the
                        // implementors of its sub-interfaces, which artifacts
                        // record (`clientAbstractTypes` lists client types
                        // through server super-interfaces).
                        DefinitionChange::InterfaceImplementsChanged {
                            name,
                            added,
                            removed,
                        } => {
                            needs_incremental_build
                                .insert(IncrementalBuildSchemaChange::Interface(name));
                            for interface_name in added.into_iter().chain(removed) {
                                add_interface_and_super_interfaces(
                                    schema,
                                    &mut needs_incremental_build,
                                    interface_name,
                                );
                            }
                        }
                        // safe changes
                        DefinitionChange::InterfaceAdded(_)
                        | DefinitionChange::EnumAdded(_)
                        | DefinitionChange::ScalarAdded(_)
                        | DefinitionChange::UnionAdded(_)
                        | DefinitionChange::InputObjectAdded(_) => {}

                        // safe with incremental build changes
                        DefinitionChange::EnumChanged { name }
                        | DefinitionChange::EnumRemoved(name) => {
                            needs_incremental_build
                                .insert(IncrementalBuildSchemaChange::Enum(name));
                        }
                        DefinitionChange::UnionChanged { name, .. }
                        | DefinitionChange::UnionRemoved(name) => {
                            needs_incremental_build
                                .insert(IncrementalBuildSchemaChange::Union(name));
                        }

                        // Input object changes need an incremental rebuild because
                        // generated type definitions include all fields of the
                        // input object.
                        DefinitionChange::InputObjectChanged {
                            name,
                            added: _,
                            removed: _,
                        } => {
                            needs_incremental_build
                                .insert(IncrementalBuildSchemaChange::InputObject(name));
                        }

                        // Object removals need an incremental rebuild
                        // because queries spreading on the removed
                        // object's interfaces may need updated inline
                        // spreads. The interface names come from the
                        // previous schema since the object no longer
                        // exists in the current schema.
                        DefinitionChange::ObjectRemoved { name, interfaces } => {
                            needs_incremental_build
                                .insert(IncrementalBuildSchemaChange::Object(name));
                            for iface_name in &interfaces {
                                if *iface_name == NODE_INTERFACE_KEY.0 {
                                    continue;
                                }
                                needs_incremental_build
                                    .insert(IncrementalBuildSchemaChange::Interface(*iface_name));
                            }
                        }

                        // Input object removals need an incremental
                        // rebuild so queries referencing the removed
                        // type are recompiled. In practice this is a
                        // no-op: the type no longer exists in the new
                        // schema, so the dependency analyzer won't
                        // find any references. Co-occurring ObjectChanged
                        // entries (e.g. for Mutation) handle the actual
                        // output changes, and build_ir_in_relay_mode
                        // validates all definitions regardless.
                        DefinitionChange::InputObjectRemoved(name) => {
                            needs_incremental_build
                                .insert(IncrementalBuildSchemaChange::InputObject(name));
                        }

                        // unsafe changes
                        DefinitionChange::ScalarRemoved(_)
                        | DefinitionChange::InterfaceRemoved(_) => {
                            return SchemaChangeSafety::Unsafe;
                        }
                    }
                }
                if needs_incremental_build.is_empty() {
                    SchemaChangeSafety::Safe
                } else {
                    add_unions_for_incremental_build(schema, &mut needs_incremental_build);
                    SchemaChangeSafety::SafeWithIncrementalBuild(needs_incremental_build)
                }
            }
        }
    }
}

static JS_FIELD_KEY: LazyLock<StringKey> = LazyLock::new(|| "js".intern());
static NODE_INTERFACE_KEY: LazyLock<InterfaceName> =
    LazyLock::new(|| InterfaceName("Node".intern()));

/// If the type has an `id` field and the type implements interfaces
/// other than `Node`, then the change isn't safe:
/// If the object type implements an `Actor` interfaces (for example).
/// We may need to add an inline spread with
///   ... on ThisNewType {
///     id
///   }
/// But we have a special case for `Node`. The `id` field is automatically
/// added to the selection for all types that implements `Node`.
fn is_object_add_safe(name: StringKey, schema: &SDLSchema, schema_config: &SchemaConfig) -> bool {
    let id_name = schema_config.node_interface_id_field;

    if let Some(schema::Type::Object(id)) = schema.get_type(name) {
        let object = schema.object(id);
        if object
            .fields
            .iter()
            .any(|id| schema.field(*id).name.item == id_name)
            && object
                .interfaces
                .iter()
                .any(|id| schema.interface(*id).name.item != *NODE_INTERFACE_KEY)
        {
            return false;
        }
    } else {
        panic!("The object '{name}' was not found in the schema during schema change detection.");
    }
    true
}

fn is_field_changes_safe(
    added: &[TypeChange],
    removed: &[TypeChange],
    changed: &[ArgumentChange],
    id_name: StringKey,
) -> bool {
    if !removed.is_empty() {
        return false;
    }

    // Special fields might change the compile output:
    // - `id` added to an object makes the compiler select that field
    // - `js` field added to a type might change 3D code generation
    if added
        .iter()
        .any(|add| add.name == id_name || add.name == *JS_FIELD_KEY)
    {
        return false;
    }

    // Addition of optional field arg is safe
    for change in changed {
        if !change.removed.is_empty() {
            return false;
        }
        for add in &change.added {
            if let Type::NonNull(_) = add.type_ {
                return false;
            }
        }
    }
    true
}

fn add_interfaces_for_incremental_build(
    schema: &SDLSchema,
    needs_incremental_build: &mut FxHashSet<IncrementalBuildSchemaChange>,
    obj_name: StringKey,
    interfaces_changed: &[StringKey],
    added: &[TypeChange],
    removed: &[TypeChange],
    id_name: StringKey,
) {
    if let Some(schema::Type::Object(id)) = schema.get_type(obj_name) {
        let object = schema.object(id);

        let is_id_added = added.iter().any(|field| field.name == id_name);
        let is_id_removed = removed.iter().any(|field| field.name == id_name);
        let has_id = object
            .fields
            .iter()
            .any(|field_id| schema.field(*field_id).name.item == id_name);
        if !is_id_added && !is_id_removed && !has_id {
            // no id on this object so no changes to interfaces needed
            return;
        }

        let object_interfaces = object
            .interfaces
            .iter()
            .map(|id| &schema.interface(*id).name.item.0);
        let all_interfaces = interfaces_changed
            .iter()
            .chain(object_interfaces)
            .map(|interface| IncrementalBuildSchemaChange::Interface(*interface));
        needs_incremental_build.extend(all_interfaces);
    }
}

fn inner_type_name(type_: &Type) -> Option<StringKey> {
    match type_ {
        Type::Named(name) => Some(*name),
        Type::NonNull(inner) | Type::List(inner) => inner_type_name(inner),
    }
}

fn schema_change_for_type_name(
    schema: &SDLSchema,
    type_name: StringKey,
) -> Option<IncrementalBuildSchemaChange> {
    schema
        .get_type(type_name)
        .and_then(|schema_type| match schema_type {
            schema::Type::Object(_) => Some(IncrementalBuildSchemaChange::Object(type_name)),
            schema::Type::Interface(_) => Some(IncrementalBuildSchemaChange::Interface(type_name)),
            schema::Type::Union(_) => Some(IncrementalBuildSchemaChange::Union(type_name)),
            schema::Type::Enum(_) => Some(IncrementalBuildSchemaChange::Enum(type_name)),
            schema::Type::InputObject(_) => {
                Some(IncrementalBuildSchemaChange::InputObject(type_name))
            }
            schema::Type::Scalar(_) => None,
        })
}

/// Add the return types of added/removed fields to `needs_incremental_build`.
/// This lets the finder discover affected operations via `visit_linked_field`.
fn add_field_return_types_for_incremental_build(
    schema: &SDLSchema,
    needs_incremental_build: &mut FxHashSet<IncrementalBuildSchemaChange>,
    added: &[TypeChange],
    removed: &[TypeChange],
) {
    for type_change in added.iter().chain(removed.iter()) {
        if let Some(type_name) = inner_type_name(&type_change.type_)
            && let Some(change) = schema_change_for_type_name(schema, type_name)
        {
            needs_incremental_build.insert(change);
        }
    }
}

/// Marks `interface_name` and every interface it implements in the current
/// schema, directly or through other interfaces.
fn add_interface_and_super_interfaces(
    schema: &SDLSchema,
    needs_incremental_build: &mut FxHashSet<IncrementalBuildSchemaChange>,
    interface_name: StringKey,
) {
    let mut visited: FxHashSet<StringKey> = HashSet::default();
    let mut pending = vec![interface_name];
    while let Some(name) = pending.pop() {
        if !visited.insert(name) {
            continue;
        }
        needs_incremental_build.insert(IncrementalBuildSchemaChange::Interface(name));
        if let Some(schema::Type::Interface(interface_id)) = schema.get_type(name) {
            for super_interface_id in &schema.interface(interface_id).interfaces {
                pending.push(schema.interface(*super_interface_id).name.item.0);
            }
        }
    }
}

fn add_unions_for_incremental_build(
    schema: &SDLSchema,
    needs_incremental_build: &mut FxHashSet<IncrementalBuildSchemaChange>,
) {
    for u in schema.unions() {
        if u.members.iter().any(|obj_id| {
            let obj_name = schema.object(*obj_id).name.item.0;
            needs_incremental_build.contains(&IncrementalBuildSchemaChange::Object(obj_name))
        }) {
            needs_incremental_build.insert(IncrementalBuildSchemaChange::Union(u.name.item.0));
        }
    }
}
