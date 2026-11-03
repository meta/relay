/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

use intern::string_key::Intern;
use rustc_hash::FxHashSet;
use schema::build_schema;
use schema_diff::check::IncrementalBuildSchemaChange;
use schema_diff::check::SchemaChangeSafety;
use schema_diff::definitions::*;
use schema_diff::*;

fn diff(current: &str, previous: &str) -> SchemaChange {
    let mut change = detect_changes(&[current], &[previous]);
    sort_change(&mut change);
    change
}

fn get_safety(current: &str, previous: &str) -> SchemaChangeSafety {
    let schema = build_schema(current).unwrap();
    let change = detect_changes(&[current], &[previous]);
    change.get_safety(&schema, &Default::default())
}

fn diff_from_schemas(current: &str, previous: &str) -> SchemaChange {
    let current_schema = build_schema(current).unwrap();
    let previous_schema = build_schema(previous).unwrap();
    let mut change = detect_changes_from_schemas(&current_schema, &previous_schema);
    sort_change(&mut change);
    change
}

#[test]
fn test_same_text() {
    assert_eq!(
        diff(
            r"
         enum A {
             OK
             NOT_OK
             MAYBE
         }
         #",
            r"
         enum A {
             OK
             NOT_OK
             MAYBE
         }
         #",
        ),
        SchemaChange::None
    );
}

#[test]
fn test_invalid_text() {
    assert_eq!(
        diff(
            r"
         enum A {
             OK
             NOT_OK
             MAYBE

         #",
            r"
         enum A {
             OK
             NOT_OK
             MAYBE
         }
         #",
        ),
        SchemaChange::InvalidSchema
    );
}

#[test]
fn test_add_enum_value() {
    assert_eq!(
        diff(
            r"
         enum A {
             OK
             NOT_OK
             MAYBE
           }
         #",
            r"
         enum A {
             OK
             NOT_OK
           }
         #",
        ),
        SchemaChange::DefinitionChanges(vec![DefinitionChange::EnumChanged { name: "A".intern() }])
    );
}

#[test]
fn test_sort_enum_value() {
    assert_eq!(
        diff(
            r"
         enum A {
             OK
             NOT_OK
             MAYBE
           }
         #",
            r"
         enum A {
             OK
             MAYBE
             NOT_OK
           }
         #",
        ),
        SchemaChange::DefinitionChanges(vec![DefinitionChange::EnumChanged { name: "A".intern() }])
    );
}

#[test]
fn test_remove_enum_value() {
    assert_eq!(
        diff(
            r"
         enum A {
             OK
             NOT_OK
           }
         #",
            r"
         enum A {
             OK
             NOT_OK
             MAYBE
           }
         #",
        ),
        SchemaChange::DefinitionChanges(vec![DefinitionChange::EnumChanged { name: "A".intern() }])
    );
}

#[test]
fn test_add_remove_enum_value() {
    assert_eq!(
        diff(
            r"
         enum A {
             OK
             NOT_OK
             ZUCK
             NOT_ZUCK
           }
         #",
            r"
         enum A {
             OK
             MARK
             NOT_MARK
             NOT_OK
           }
         #",
        ),
        SchemaChange::DefinitionChanges(vec![DefinitionChange::EnumChanged { name: "A".intern() }])
    );
}

#[test]
fn test_add_comment_to_enum() {
    assert_eq!(
        diff(
            r"
            enum A {
                OK
                NOT_OK
            }
         #",
            r"
            # comment
            enum A {
                OK
                NOT_OK
            }
         #",
        ),
        SchemaChange::GenericChange
    );
}

#[test]
fn test_add_remove_enum_type() {
    assert_eq!(
        diff(
            r"
        enum A {
            OK
            NOT_OK
        }
        enum B {
            OK
        }
         #",
            r"
        enum A {
            OK
            NOT_OK
        }
        enum C {
            OK
        }
         #",
        ),
        SchemaChange::DefinitionChanges(vec![
            DefinitionChange::EnumAdded("B".intern()),
            DefinitionChange::EnumRemoved("C".intern()),
        ])
    );
}

#[test]
fn test_add_remove_union_value() {
    assert_eq!(
        diff(
            r"
           type A {
             key: String
           }

           type B {
             key: String
           }

           type C {
             key: String
           }

           type D {
             key: String
           }

           union AB = A | B | D
         #",
            r"
         type A {
             key: String
         }

         type B {
             key: String
         }

         type C {
             key: String
         }

         type D {
             key: String
         }

         union AB = A | C
         #",
        ),
        SchemaChange::DefinitionChanges(vec![DefinitionChange::UnionChanged {
            name: "AB".intern(),
            added: vec!["B".intern(), "D".intern()],
            removed: vec!["C".intern()],
        }])
    );
}

#[test]
fn test_add_remove_union_type() {
    assert_eq!(
        diff(
            r"
           type A {
             key: String
           }

           type B {
             key: String
           }

           type C {
             key: String
           }

           type D {
             key: String
           }

           union union1 = A | B | D
           union union2 = A | B | D
         #",
            r"
         type A {
             key: String
         }

         type B {
             key: String
         }

         type C {
             key: String
         }

         type D {
             key: String
         }

         union union3 = A | B | D
         union union4 = A | B | D
         #",
        ),
        SchemaChange::DefinitionChanges(vec![
            DefinitionChange::UnionAdded("union1".intern()),
            DefinitionChange::UnionAdded("union2".intern()),
            DefinitionChange::UnionRemoved("union3".intern()),
            DefinitionChange::UnionRemoved("union4".intern()),
        ])
    );
}

#[test]
fn test_add_remove_scalar_type() {
    assert_eq!(
        diff(
            r"
        scalar A
        scalar B
         #",
            r"
        scalar A
        scalar C
        scalar D
         #",
        ),
        SchemaChange::DefinitionChanges(vec![
            DefinitionChange::ScalarAdded("B".intern()),
            DefinitionChange::ScalarRemoved("C".intern()),
            DefinitionChange::ScalarRemoved("D".intern()),
        ])
    );
}

#[test]
fn test_add_remove_input_object() {
    assert_eq!(
        diff(
            r"
        input Add {
            value: Float
        }
         #",
            r"
        input Remove {
            name: String
        }
         #",
        ),
        SchemaChange::DefinitionChanges(vec![
            DefinitionChange::InputObjectAdded("Add".intern()),
            DefinitionChange::InputObjectRemoved("Remove".intern()),
        ])
    );
}

#[test]
fn test_add_remove_input_object_fields() {
    assert_eq!(
        diff(
            r"
        input Input {
            add: String
            value: Float
        }
         #",
            r"
        input Input {
            value: Float
            remove: Int
        }
         #",
        ),
        SchemaChange::DefinitionChanges(vec![DefinitionChange::InputObjectChanged {
            name: "Input".intern(),
            added: vec![TypeChange {
                name: "add".intern(),
                type_: Type::Named("String".intern()),
            }],
            removed: vec![TypeChange {
                name: "remove".intern(),
                type_: Type::Named("Int".intern()),
            }],
        },])
    );
}

#[test]
fn test_change_input_object_fields() {
    assert_eq!(
        diff(
            r"
        input Input {
           value: Float
           key: String
        }
         #",
            r"
        input Input {
            value: Float
            key: Int
        }
         #",
        ),
        SchemaChange::DefinitionChanges(vec![DefinitionChange::InputObjectChanged {
            name: "Input".intern(),
            added: vec![TypeChange {
                name: "key".intern(),
                type_: Type::Named("String".intern()),
            }],
            removed: vec![TypeChange {
                name: "key".intern(),
                type_: Type::Named("Int".intern()),
            }],
        },])
    );
}

#[test]
fn test_add_remove_interface() {
    assert_eq!(
        diff(
            r"
        interface Add {
           value: Float
           key: String
        }
         #",
            r"
        interface Remove {
            value: Float
            key: Int
        }
         #",
        ),
        SchemaChange::DefinitionChanges(vec![
            DefinitionChange::InterfaceAdded("Add".intern()),
            DefinitionChange::InterfaceRemoved("Remove".intern()),
        ])
    );
}

#[test]
fn test_add_remove_interface_fields() {
    assert_eq!(
        diff(
            r"
        interface I {
           value: Float
           key: String
        }
         #",
            r"
        interface I {
            value: Float
            key: Int
        }
         #",
        ),
        SchemaChange::DefinitionChanges(vec![DefinitionChange::InterfaceChanged {
            name: "I".intern(),
            added: vec![TypeChange {
                name: "key".intern(),
                type_: Type::Named("String".intern()),
            }],
            removed: vec![TypeChange {
                name: "key".intern(),
                type_: Type::Named("Int".intern()),
            }],
            changed: vec![],
        },])
    );
}

#[test]
fn test_add_remove_object() {
    assert_eq!(
        diff(
            r"
        type Add {
            value: Float
        }
         #",
            r"
        type Remove {
            name: String
        }
         #",
        ),
        SchemaChange::DefinitionChanges(vec![
            DefinitionChange::ObjectAdded("Add".intern()),
            DefinitionChange::ObjectRemoved {
                name: "Remove".intern(),
                interfaces: vec![],
            },
        ])
    );
}

#[test]
fn test_change_object_interfaces() {
    assert_eq!(
        diff(
            r"
        type User implements Node {
            id: ID
            value: Float
        }
         #",
            r"
        type User implements Actor {
            id: ID
            value: Float
        }
         #",
        ),
        SchemaChange::DefinitionChanges(vec![DefinitionChange::ObjectChanged {
            name: "User".intern(),
            added: vec![],
            removed: vec![],
            changed: vec![],
            interfaces_removed: vec!["Actor".intern()],
            interfaces_added: vec!["Node".intern()],
        }])
    );
}

#[test]
fn test_change_object_fields() {
    assert_eq!(
        diff(
            r"
        type User implements Actor {
            id: ID
            value: Float
        }
         #",
            r"
        type User implements Actor {
            id: ID!
        }
         #",
        ),
        SchemaChange::DefinitionChanges(vec![DefinitionChange::ObjectChanged {
            name: "User".intern(),
            added: vec![
                TypeChange {
                    name: "id".intern(),
                    type_: Type::Named("ID".intern()),
                },
                TypeChange {
                    name: "value".intern(),
                    type_: Type::Named("Float".intern()),
                },
            ],
            removed: vec![TypeChange {
                name: "id".intern(),
                type_: Type::NonNull(Box::new(Type::Named("ID".intern()))),
            }],
            changed: vec![],
            interfaces_removed: vec![],
            interfaces_added: vec![],
        }])
    );
}

#[test]
fn test_change_object_field_arguments() {
    assert_eq!(
        diff(
            r"
        type User implements Actor {
            key(a: ID): String
            name: String
            user(a: ID): String
        }
         #",
            r"
        type User implements Actor {
            key: String
            name(a: ID!): String
            user(a: ID!): String
        }
         #",
        ),
        SchemaChange::DefinitionChanges(vec![DefinitionChange::ObjectChanged {
            name: "User".intern(),
            added: vec![],
            removed: vec![],
            changed: vec![
                ArgumentChange {
                    name: "key".intern(),
                    added: vec![TypeChange {
                        name: "a".intern(),
                        type_: Type::Named("ID".intern()),
                    }],
                    removed: vec![],
                },
                ArgumentChange {
                    name: "name".intern(),
                    added: vec![],
                    removed: vec![TypeChange {
                        name: "a".intern(),
                        type_: Type::NonNull(Box::new(Type::Named("ID".intern()))),
                    }],
                },
                ArgumentChange {
                    name: "user".intern(),
                    added: vec![TypeChange {
                        name: "a".intern(),
                        type_: Type::Named("ID".intern()),
                    }],
                    removed: vec![TypeChange {
                        name: "a".intern(),
                        type_: Type::NonNull(Box::new(Type::Named("ID".intern()))),
                    }],
                }
            ],
            interfaces_removed: vec![],
            interfaces_added: vec![],
        }])
    );
}

#[test]
fn test_change_type_input_object() {
    assert_eq!(
        diff(
            r"
        input User {
            value: Float
        }
         #",
            r"
        type User {
            name: String
        }
         #",
        ),
        SchemaChange::DefinitionChanges(vec![
            DefinitionChange::InputObjectAdded("User".intern()),
            DefinitionChange::ObjectRemoved {
                name: "User".intern(),
                interfaces: vec![],
            },
        ])
    );
}

#[test]
fn test_change_type_object_interface() {
    assert_eq!(
        diff(
            r"
        type User {
            value: Float
        }
         #",
            r"
        interface User {
            name: String
        }
         #",
        ),
        SchemaChange::DefinitionChanges(vec![
            DefinitionChange::InterfaceRemoved("User".intern()),
            DefinitionChange::ObjectAdded("User".intern()),
        ])
    );
}

#[test]
fn test_change_type_enum_scalar() {
    assert_eq!(
        diff(
            r"
        scalar A
         #",
            r"
        enum A {
            OK
            NOT_OK
        }
         #",
        ),
        SchemaChange::DefinitionChanges(vec![
            DefinitionChange::EnumRemoved("A".intern()),
            DefinitionChange::ScalarAdded("A".intern()),
        ])
    );
}

#[test]
fn test_change_type_enum_union() {
    assert_eq!(
        diff(
            r"
        type A {
            id: ID
        }
        enum B {
            OK
            NOT_OK
        }
        union C = A
         #",
            r"
        type A {
            id: ID
        }
        enum C {
            OK
            NOT_OK
        }
        union B = A
         #",
        ),
        SchemaChange::DefinitionChanges(vec![
            DefinitionChange::EnumAdded("B".intern()),
            DefinitionChange::EnumRemoved("C".intern()),
            DefinitionChange::UnionAdded("C".intern()),
            DefinitionChange::UnionRemoved("B".intern()),
        ])
    );
}

#[test]
fn test_add_object_without_id() {
    assert_eq!(
        get_safety(
            r"
            type A {
                key: String
            }
            type B {
                key: String
            }
            #",
            r"
            type A {
                key: String
            }
            #"
        ),
        SchemaChangeSafety::Safe
    )
}

#[test]
fn test_change_object_interface() {
    assert_eq!(
        get_safety(
            r"
            type A implements B {
                key: String
            }
            interface B {
                id: ID!
            }
            #",
            r"
            type A {
                key: String
            }
            interface B {
                id: ID!
            }
            #"
        ),
        SchemaChangeSafety::SafeWithIncrementalBuild(FxHashSet::from_iter([
            IncrementalBuildSchemaChange::Object("A".intern())
        ]))
    )
}

#[test]
fn test_add_object_with_id_node_interface() {
    assert_eq!(
        get_safety(
            r"
            type A {
                key: String
            }
            type B implements Node {
                id: ID
                key: String
            }
            interface Node {
                id: ID!
            }
            #",
            r"
            type A {
                key: String
            }
            interface Node {
                id: ID!
            }
            #"
        ),
        SchemaChangeSafety::Safe
    )
}

#[test]
fn test_object_special_field_added() {
    assert_eq!(
        get_safety(
            r"
            type A {
                key: String
                foo: String # regular field is okay
            }
        #",
            r"
            type A {
                key: String
            }
        #",
        ),
        SchemaChangeSafety::Safe
    );
    assert_eq!(
        get_safety(
            r"
            type A {
                key: String
                id: String # id field is breaking
            }
        #",
            r"
            type A {
                key: String
            }
        #",
        ),
        SchemaChangeSafety::SafeWithIncrementalBuild(FxHashSet::from_iter([
            IncrementalBuildSchemaChange::Object("A".intern())
        ]))
    );
    assert_eq!(
        get_safety(
            r"
            type A {
                key: String
                js: String # js field is breaking
            }
        #",
            r"
            type A {
                key: String
            }
        #",
        ),
        SchemaChangeSafety::SafeWithIncrementalBuild(FxHashSet::from_iter([
            IncrementalBuildSchemaChange::Object("A".intern())
        ]))
    );
}

// Adding a type with id + non-Node interface needs an incremental rebuild
// because queries spreading on that interface may need updated inline spreads.
#[test]
fn test_add_type_with_id_actor_interface() {
    assert_eq!(
        get_safety(
            r"
            type A {
                key: String
            }
            type B implements Actor {
                id: ID
                key: String
            }
            interface Actor {
                name: String
            }
            #",
            r"
            type A {
                key: String
            }
            interface Actor {
                name: String
            }
            #"
        ),
        SchemaChangeSafety::SafeWithIncrementalBuild(FxHashSet::from_iter([
            IncrementalBuildSchemaChange::Object("B".intern()),
            IncrementalBuildSchemaChange::Interface("Actor".intern()),
        ]))
    )
}

// Adding a type with id + Node + non-Node interface skips Node in the
// incremental set because generate_id_field handles Node uniformly.
#[test]
fn test_add_type_with_id_node_and_actor_interface() {
    assert_eq!(
        get_safety(
            r"
            type A {
                key: String
            }
            type B implements Node & Actor {
                id: ID
                name: String
            }
            interface Node {
                id: ID
            }
            interface Actor {
                name: String
            }
            #",
            r"
            type A {
                key: String
            }
            interface Node {
                id: ID
            }
            interface Actor {
                name: String
            }
            #"
        ),
        SchemaChangeSafety::SafeWithIncrementalBuild(FxHashSet::from_iter([
            IncrementalBuildSchemaChange::Object("B".intern()),
            // Only Actor — Node is skipped because generate_id_field
            // handles it uniformly via `... on Node { id }`.
            IncrementalBuildSchemaChange::Interface("Actor".intern()),
        ]))
    )
}

#[test]
fn test_add_optional_field_arg() {
    assert_eq!(
        get_safety(
            r"
            type A {
                key(a: ID): String
            }

            #",
            r"
            type A {
                key: String
            }
            #"
        ),
        SchemaChangeSafety::Safe
    )
}

#[test]
fn test_add_required_field_arg() {
    assert_eq!(
        get_safety(
            r"
            type A {
                key(a: ID!): String
            }

            #",
            r"
            type A {
                key: String
            }
            #"
        ),
        SchemaChangeSafety::SafeWithIncrementalBuild(FxHashSet::from_iter([
            IncrementalBuildSchemaChange::Object("A".intern())
        ]))
    )
}

#[test]
fn test_remove_field_arg() {
    assert_eq!(
        get_safety(
            r"
            type A {
                key: String
            }

            #",
            r"
            type A {
                key(a: ID): String
            }
            #"
        ),
        SchemaChangeSafety::SafeWithIncrementalBuild(FxHashSet::from_iter([
            IncrementalBuildSchemaChange::Object("A".intern())
        ]))
    )
}

#[test]
fn test_add_safe_types() {
    assert_eq!(
        get_safety(
            r"
            type A {
                key: String
            }
            interface B {
                key: String
            }
            type C {
                key: String
            }
            union D = A
            enum E {
                OK
                NOT_OK
            }
            input F {
                key: String
            }
            scalar Mark
            #",
            r"
            type A {
                key: String
            }
            #"
        ),
        SchemaChangeSafety::Safe
    )
}

#[test]
fn test_unimplemented_changes() {
    assert_eq!(
        get_safety(
            r"
            type A {
                key: String
            }
            extend type A {
                name: String
            }
            #",
            r"
            type A {
                key: String
            }
            #"
        ),
        SchemaChangeSafety::Unsafe
    )
}

#[test]
fn test_add_enum() {
    assert_eq!(
        get_safety(
            r"
         enum A {
             OK
             MAYBE
             NOT_OK
         }
         enum B {
            OTHER
         }
         #",
            r"
         enum A {
             OK
             MAYBE
             NOT_OK
         }
         #",
        ),
        SchemaChangeSafety::Safe
    );
}

#[test]
fn test_enums_safe_with_incremental_build_changes() {
    // Change enum
    assert_eq!(
        get_safety(
            r"
         enum A {
             OK
             NOT_OK
             MAYBE
         }
         #",
            r"
         enum A {
             OK
             MAYBE
             NOT_OK
         }
         #",
        ),
        SchemaChangeSafety::SafeWithIncrementalBuild(FxHashSet::from_iter([
            IncrementalBuildSchemaChange::Enum("A".intern())
        ]))
    );

    // Add enum value
    assert_eq!(
        get_safety(
            r"
         enum A {
             OK
             NOT_OK
             MAYBE
         }
         #",
            r"
         enum A {
             OK
             NOT_OK
         }
         #",
        ),
        SchemaChangeSafety::SafeWithIncrementalBuild(FxHashSet::from_iter([
            IncrementalBuildSchemaChange::Enum("A".intern())
        ]))
    );

    // Delete enum
    assert_eq!(
        get_safety(
            r"
         enum B {
             OTHER
         }
         #",
            r"
         enum A {
             OK
             NOT_OK
             MAYBE
         }
         enum B {
             OTHER
         }
         #",
        ),
        SchemaChangeSafety::SafeWithIncrementalBuild(FxHashSet::from_iter([
            IncrementalBuildSchemaChange::Enum("A".intern())
        ]))
    );
}

#[test]
fn test_unions_safe_with_incremental_build_changes() {
    // Remove object in union
    assert_eq!(
        get_safety(
            r"
         union U = A | B
         type A {
            A1: String
         }
         type B {
            B1: String
         }
         type C {
            C1: String
         }
         #",
            r"
            union U = A | B | C
            type A {
               A1: String
            }
            type B {
               B1: String
            }
            type C {
               C1: String
            }
         #",
        ),
        SchemaChangeSafety::SafeWithIncrementalBuild(FxHashSet::from_iter([
            IncrementalBuildSchemaChange::Union("U".intern()),
        ]))
    );

    // Add object to union
    assert_eq!(
        get_safety(
            r"
         union U = A | B | C
         type A {
            A1: String
         }
         type B {
            B1: String
         }
         type C {
            C1: String
         }
         #",
            r"
         union U = A | B
         type A {
            A1: String
         }
         type B {
            B1: String
         }
         #",
        ),
        SchemaChangeSafety::SafeWithIncrementalBuild(FxHashSet::from_iter([
            IncrementalBuildSchemaChange::Union("U".intern()),
        ]))
    );

    // Change object in union
    assert_eq!(
        get_safety(
            r"
         union U = A | B
         type A {
            A1: String
         }
         type B {
            B1: String
         }
         #",
            r"
         union U = A | B
         type A {
            A1: String
         }
         type B {
            B1: String
            B2: String
         }
         #",
        ),
        SchemaChangeSafety::SafeWithIncrementalBuild(FxHashSet::from_iter([
            IncrementalBuildSchemaChange::Object("B".intern()),
            IncrementalBuildSchemaChange::Union("U".intern()),
        ]))
    );

    // Non-union objects don't affect the union
    assert_eq!(
        get_safety(
            r"
         union U = A | B
         type A {
            A1: String
         }
         type B {
            B1: String
         }
         type C {
            C1: String
         }
         #",
            r"
         union U = A | B
         type A {
            A1: String
         }
         type B {
            B1: String
         }
         type C {
            C1: String
            C2: String
         }
         #",
        ),
        SchemaChangeSafety::SafeWithIncrementalBuild(FxHashSet::from_iter([
            IncrementalBuildSchemaChange::Object("C".intern()),
        ]))
    );
}

#[test]
fn test_interfaces_safe_with_incremental_build_changes() {
    // Changing interfaces on an object without an id doesn't rebuild interfaces
    assert_eq!(
        get_safety(
            r"
         interface I {
            x: String
         }
         type A implements I {
            A1: String
            x: String
         }
         #",
            r"
         type A {
            A1: String
            x: String
         }
         #",
        ),
        SchemaChangeSafety::SafeWithIncrementalBuild(FxHashSet::from_iter([
            IncrementalBuildSchemaChange::Object("A".intern()),
        ]))
    );
    // Changing interfaces on an object with an id rebuilds the interface
    assert_eq!(
        get_safety(
            r"
         interface I {
            x: String
         }
         type A implements I {
            id: ID!
            x: String
         }
         #",
            r"
         interface I {
            x: String
         }
         type A {
            id: ID!
            x: String
         }
         #",
        ),
        SchemaChangeSafety::SafeWithIncrementalBuild(FxHashSet::from_iter([
            IncrementalBuildSchemaChange::Object("A".intern()),
            IncrementalBuildSchemaChange::Interface("I".intern()),
        ]))
    );
    assert_eq!(
        get_safety(
            r"
         interface I {
            x: String
         }
         type A {
            id: ID!
            x: String
         }
         #",
            r"
         interface I {
            x: String
         }
         type A implements I {
            id: ID!
            x: String
         }
         #",
        ),
        SchemaChangeSafety::SafeWithIncrementalBuild(FxHashSet::from_iter([
            IncrementalBuildSchemaChange::Object("A".intern()),
            IncrementalBuildSchemaChange::Interface("I".intern()),
        ]))
    );
    // Rebuild the correct interfaces
    assert_eq!(
        get_safety(
            r"
         interface I {
            x: String
         }
         interface I2 {
            y: String
         }
         interface I3 {
            z: String
         }
         type A implements I & I2 {
            id: ID!
            x: String
            y: String
         }
         #",
            r"
         interface I {
            x: String
         }
         interface I2 {
            y: String
         }
         interface I3 {
            z: String
         }
         type A implements I {
            id: ID!
            x: String
            y: String
         }
         #",
        ),
        SchemaChangeSafety::SafeWithIncrementalBuild(FxHashSet::from_iter([
            IncrementalBuildSchemaChange::Object("A".intern()),
            IncrementalBuildSchemaChange::Interface("I".intern()),
            IncrementalBuildSchemaChange::Interface("I2".intern()),
        ]))
    );
    // Adding an id to an object with interfaces rebuilds the interface
    assert_eq!(
        get_safety(
            r"
         interface I {
            x: String
         }
         type A implements I {
            id: ID!
            x: String
         }
         #",
            r"
         interface I {
            x: String
         }
         type A implements I {
            x: String
         }
         #",
        ),
        SchemaChangeSafety::SafeWithIncrementalBuild(FxHashSet::from_iter([
            IncrementalBuildSchemaChange::Object("A".intern()),
            IncrementalBuildSchemaChange::Interface("I".intern()),
        ]))
    );
    // Adding an id and interface together rebuilds the interface
    assert_eq!(
        get_safety(
            r"
         interface I {
            x: String
         }
         type A implements I {
            id: ID!
            x: String
         }
         #",
            r"
         interface I {
            x: String
         }
         type A {
            x: String
         }
         #",
        ),
        SchemaChangeSafety::SafeWithIncrementalBuild(FxHashSet::from_iter([
            IncrementalBuildSchemaChange::Object("A".intern()),
            IncrementalBuildSchemaChange::Interface("I".intern()),
        ]))
    );
    // Editing an id on an object with an interface rebuilds the interface
    // Note: this is treated as an id add + remove by the compiler
    assert_eq!(
        get_safety(
            r"
         interface I {
            x: String
         }
         type A implements I {
            id: ID!
            x: String
         }
         #",
            r"
         interface I {
            x: String
         }
         type A implements I {
            id: String
            x: String
         }
         #",
        ),
        SchemaChangeSafety::SafeWithIncrementalBuild(FxHashSet::from_iter([
            IncrementalBuildSchemaChange::Object("A".intern()),
            IncrementalBuildSchemaChange::Interface("I".intern()),
        ]))
    );
}

// Adding fields to an input object requires an incremental rebuild
// because Relay generates type definitions that include all fields.
#[test]
fn test_input_object_add_fields_is_safe_with_incremental_build() {
    assert_eq!(
        get_safety(
            r"
            input MyInput {
                key: String
                newField: Int
            }
            #",
            r"
            input MyInput {
                key: String
            }
            #"
        ),
        SchemaChangeSafety::SafeWithIncrementalBuild(FxHashSet::from_iter([
            IncrementalBuildSchemaChange::InputObject("MyInput".intern())
        ]))
    )
}

// Removing fields from an input object needs an incremental rebuild.
#[test]
fn test_input_object_remove_fields_is_safe_with_incremental_build() {
    assert_eq!(
        get_safety(
            r"
            input MyInput {
                key: String
            }
            #",
            r"
            input MyInput {
                key: String
                oldField: Int
            }
            #"
        ),
        SchemaChangeSafety::SafeWithIncrementalBuild(FxHashSet::from_iter([
            IncrementalBuildSchemaChange::InputObject("MyInput".intern())
        ]))
    )
}

// Mixed add+remove on an input object needs an incremental rebuild.
#[test]
fn test_input_object_add_and_remove_fields_is_safe_with_incremental_build() {
    assert_eq!(
        get_safety(
            r"
            input MyInput {
                key: String
                newField: Int
            }
            #",
            r"
            input MyInput {
                key: String
                oldField: Float
            }
            #"
        ),
        SchemaChangeSafety::SafeWithIncrementalBuild(FxHashSet::from_iter([
            IncrementalBuildSchemaChange::InputObject("MyInput".intern())
        ]))
    )
}

// Changing a field's type appears as remove+add and needs an incremental rebuild.
#[test]
fn test_input_object_change_field_type_is_safe_with_incremental_build() {
    assert_eq!(
        get_safety(
            r"
            input MyInput {
                key: String
            }
            #",
            r"
            input MyInput {
                key: Int
            }
            #"
        ),
        SchemaChangeSafety::SafeWithIncrementalBuild(FxHashSet::from_iter([
            IncrementalBuildSchemaChange::InputObject("MyInput".intern())
        ]))
    )
}

// Removing a plain object type (no interfaces) requires an incremental
// rebuild so queries referencing the type are recompiled.
#[test]
fn test_object_removed_is_safe_with_incremental_build() {
    assert_eq!(
        get_safety(
            r"
            type A {
                key: String
            }
            #",
            r"
            type A {
                key: String
            }
            type B {
                value: Int
            }
            #"
        ),
        SchemaChangeSafety::SafeWithIncrementalBuild(FxHashSet::from_iter([
            IncrementalBuildSchemaChange::Object("B".intern()),
        ]))
    )
}

// Removing an object that implements a non-Node interface requires an
// incremental rebuild of both the object and the interface.
#[test]
fn test_object_removed_with_interface_is_safe_with_incremental_build() {
    assert_eq!(
        get_safety(
            r"
            type A {
                key: String
            }
            interface Actor {
                name: String
            }
            #",
            r"
            type A {
                key: String
            }
            type B implements Actor {
                name: String
            }
            interface Actor {
                name: String
            }
            #"
        ),
        SchemaChangeSafety::SafeWithIncrementalBuild(FxHashSet::from_iter([
            IncrementalBuildSchemaChange::Object("B".intern()),
            IncrementalBuildSchemaChange::Interface("Actor".intern()),
        ]))
    )
}

// Removing an object that implements Node & Actor skips Node in the
// incremental set because generate_id_field handles Node uniformly.
#[test]
fn test_object_removed_with_node_and_actor_interface() {
    assert_eq!(
        get_safety(
            r"
            type A {
                key: String
            }
            interface Node {
                id: ID
            }
            interface Actor {
                name: String
            }
            #",
            r"
            type A {
                key: String
            }
            type B implements Node & Actor {
                id: ID
                name: String
            }
            interface Node {
                id: ID
            }
            interface Actor {
                name: String
            }
            #"
        ),
        SchemaChangeSafety::SafeWithIncrementalBuild(FxHashSet::from_iter([
            IncrementalBuildSchemaChange::Object("B".intern()),
            IncrementalBuildSchemaChange::Interface("Actor".intern()),
        ]))
    )
}

// Removing an input object requires an incremental rebuild.
#[test]
fn test_input_object_removed_is_safe_with_incremental_build() {
    assert_eq!(
        get_safety(
            r"
            type Query { me: User }
            type User { name: String }
            #",
            r"
            type Query { me: User }
            type User { name: String }
            input MyInput { key: String }
            #"
        ),
        SchemaChangeSafety::SafeWithIncrementalBuild(FxHashSet::from_iter([
            IncrementalBuildSchemaChange::InputObject("MyInput".intern())
        ]))
    )
}

#[test]
fn test_field_directive_added() {
    assert_eq!(
        diff(
            r"
            directive @d(a: String) on FIELD_DEFINITION
            type User {
                # The directive is added here
                name: String @d
            }
            #",
            r"
            directive @d(a: String) on FIELD_DEFINITION
            type User {
                name: String
            }
            #"
        ),
        SchemaChange::DefinitionChanges(vec![DefinitionChange::ObjectChanged {
            name: "User".intern(),
            added: vec![TypeChange {
                name: "name".intern(),
                type_: Type::Named("String".intern()),
            }],
            removed: vec![TypeChange {
                name: "name".intern(),
                type_: Type::Named("String".intern()),
            }],
            changed: vec![],
            interfaces_added: vec![],
            interfaces_removed: vec![],
        }])
    );
}

#[test]
fn test_field_directive_argument_changed() {
    assert_eq!(
        diff(
            r#"
            directive @d(a: String) on FIELD_DEFINITION
            type User {
                # Only the directive's argument value changes
                name: String @d(a: "new")
            }
            #"#,
            r#"
            directive @d(a: String) on FIELD_DEFINITION
            type User {
                name: String @d(a: "old")
            }
            #"#
        ),
        SchemaChange::DefinitionChanges(vec![DefinitionChange::ObjectChanged {
            name: "User".intern(),
            added: vec![TypeChange {
                name: "name".intern(),
                type_: Type::Named("String".intern()),
            }],
            removed: vec![TypeChange {
                name: "name".intern(),
                type_: Type::Named("String".intern()),
            }],
            changed: vec![],
            interfaces_added: vec![],
            interfaces_removed: vec![],
        }])
    );
}

#[test]
fn test_field_directive_moved_is_unchanged() {
    // Adding `Unrelated` first shifts the source position of `@d(a: "x")`
    // without changing it, so `User` must not be reported as changed.
    assert_eq!(
        diff(
            r#"
            directive @d(a: String) on FIELD_DEFINITION
            type Unrelated { x: String }
            type User {
                name: String @d(a: "x")
            }
            #"#,
            r#"
            directive @d(a: String) on FIELD_DEFINITION
            type User {
                name: String @d(a: "x")
            }
            #"#
        ),
        SchemaChange::DefinitionChanges(vec![DefinitionChange::ObjectAdded("Unrelated".intern())])
    );
}

#[test]
fn test_field_directive_arguments_reordered_is_unchanged() {
    // No definition changes are found, so the text-only difference falls
    // through to `GenericChange`.
    assert_eq!(
        diff(
            r#"
            directive @d(a: String, b: String) on FIELD_DEFINITION
            type User {
                # Same arguments as before, in a different order
                name: String @d(b: "y", a: "x")
            }
            #"#,
            r#"
            directive @d(a: String, b: String) on FIELD_DEFINITION
            type User {
                name: String @d(a: "x", b: "y")
            }
            #"#
        ),
        SchemaChange::GenericChange
    );
}

#[test]
fn test_field_directive_reordered() {
    // Directive order is significant (spec §2.12), so swapping two directives
    // is a change.
    assert_eq!(
        diff(
            r"
            directive @a on FIELD_DEFINITION
            directive @b on FIELD_DEFINITION
            type User {
                name: String @b @a
            }
            #",
            r"
            directive @a on FIELD_DEFINITION
            directive @b on FIELD_DEFINITION
            type User {
                name: String @a @b
            }
            #"
        ),
        SchemaChange::DefinitionChanges(vec![DefinitionChange::ObjectChanged {
            name: "User".intern(),
            added: vec![TypeChange {
                name: "name".intern(),
                type_: Type::Named("String".intern()),
            }],
            removed: vec![TypeChange {
                name: "name".intern(),
                type_: Type::Named("String".intern()),
            }],
            changed: vec![],
            interfaces_added: vec![],
            interfaces_removed: vec![],
        }])
    );
}

// Tests verifying that detect_changes_from_schemas produces the same results
// as detect_changes for all type-definition-level changes.

#[test]
fn test_schema_diff_same_text() {
    let current = r"
        enum A {
            OK
            NOT_OK
            MAYBE
        }
    ";
    assert_eq!(diff(current, current), diff_from_schemas(current, current));
    assert_eq!(diff_from_schemas(current, current), SchemaChange::None);
}

#[test]
fn test_schema_diff_add_enum_value() {
    let current = r"
        enum A {
            OK
            NOT_OK
            MAYBE
        }
    ";
    let previous = r"
        enum A {
            OK
            NOT_OK
        }
    ";
    assert_eq!(
        diff(current, previous),
        diff_from_schemas(current, previous)
    );
}

#[test]
fn test_schema_diff_sort_enum_value() {
    let current = r"
        enum A {
            OK
            NOT_OK
            MAYBE
        }
    ";
    let previous = r"
        enum A {
            OK
            MAYBE
            NOT_OK
        }
    ";
    assert_eq!(
        diff(current, previous),
        diff_from_schemas(current, previous)
    );
}

#[test]
fn test_schema_diff_remove_enum_value() {
    let current = r"
        enum A {
            OK
            NOT_OK
        }
    ";
    let previous = r"
        enum A {
            OK
            NOT_OK
            MAYBE
        }
    ";
    assert_eq!(
        diff(current, previous),
        diff_from_schemas(current, previous)
    );
}

#[test]
fn test_schema_diff_add_remove_enum_value() {
    let current = r"
        enum A {
            OK
            NOT_OK
            ZUCK
            NOT_ZUCK
        }
    ";
    let previous = r"
        enum A {
            OK
            MARK
            NOT_MARK
            NOT_OK
        }
    ";
    assert_eq!(
        diff(current, previous),
        diff_from_schemas(current, previous)
    );
}

#[test]
fn test_schema_diff_add_remove_enum_type() {
    let current = r"
        enum A {
            OK
            NOT_OK
        }
        enum B {
            OK
        }
    ";
    let previous = r"
        enum A {
            OK
            NOT_OK
        }
        enum C {
            OK
        }
    ";
    assert_eq!(
        diff(current, previous),
        diff_from_schemas(current, previous)
    );
}

#[test]
fn test_schema_diff_add_remove_union_value() {
    let current = r"
        type A { key: String }
        type B { key: String }
        type C { key: String }
        type D { key: String }
        union AB = A | B | D
    ";
    let previous = r"
        type A { key: String }
        type B { key: String }
        type C { key: String }
        type D { key: String }
        union AB = A | C
    ";
    assert_eq!(
        diff(current, previous),
        diff_from_schemas(current, previous)
    );
}

#[test]
fn test_schema_diff_add_remove_union_type() {
    let current = r"
        type A { key: String }
        type B { key: String }
        type C { key: String }
        type D { key: String }
        union union1 = A | B | D
        union union2 = A | B | D
    ";
    let previous = r"
        type A { key: String }
        type B { key: String }
        type C { key: String }
        type D { key: String }
        union union3 = A | B | D
        union union4 = A | B | D
    ";
    assert_eq!(
        diff(current, previous),
        diff_from_schemas(current, previous)
    );
}

#[test]
fn test_schema_diff_add_remove_scalar_type() {
    let current = r"
        scalar A
        scalar B
    ";
    let previous = r"
        scalar A
        scalar C
        scalar D
    ";
    assert_eq!(
        diff(current, previous),
        diff_from_schemas(current, previous)
    );
}

#[test]
fn test_schema_diff_add_remove_input_object() {
    let current = r"
        input Add {
            value: Float
        }
    ";
    let previous = r"
        input Remove {
            name: String
        }
    ";
    assert_eq!(
        diff(current, previous),
        diff_from_schemas(current, previous)
    );
}

#[test]
fn test_schema_diff_add_remove_input_object_fields() {
    let current = r"
        input Input {
            add: String
            value: Float
        }
    ";
    let previous = r"
        input Input {
            value: Float
            remove: Int
        }
    ";
    assert_eq!(
        diff(current, previous),
        diff_from_schemas(current, previous)
    );
}

#[test]
fn test_schema_diff_change_input_object_fields() {
    let current = r"
        input Input {
            value: Float
            key: String
        }
    ";
    let previous = r"
        input Input {
            value: Float
            key: Int
        }
    ";
    assert_eq!(
        diff(current, previous),
        diff_from_schemas(current, previous)
    );
}

#[test]
fn test_schema_diff_add_remove_interface() {
    let current = r"
        interface Add {
            value: Float
            key: String
        }
    ";
    let previous = r"
        interface Remove {
            value: Float
            key: Int
        }
    ";
    assert_eq!(
        diff(current, previous),
        diff_from_schemas(current, previous)
    );
}

#[test]
fn test_schema_diff_add_remove_interface_fields() {
    let current = r"
        interface I {
            value: Float
            key: String
        }
    ";
    let previous = r"
        interface I {
            value: Float
            key: Int
        }
    ";
    assert_eq!(
        diff(current, previous),
        diff_from_schemas(current, previous)
    );
}

#[test]
fn test_schema_diff_add_remove_object() {
    let current = r"
        type Add {
            value: Float
        }
    ";
    let previous = r"
        type Remove {
            name: String
        }
    ";
    assert_eq!(
        diff(current, previous),
        diff_from_schemas(current, previous)
    );
}

#[test]
fn test_schema_diff_change_object_interfaces() {
    let current = r"
        interface Node { id: ID }
        interface Actor { name: String }
        type User implements Node {
            id: ID
            value: Float
        }
    ";
    let previous = r"
        interface Node { id: ID }
        interface Actor { name: String }
        type User implements Actor {
            id: ID
            value: Float
        }
    ";
    assert_eq!(
        diff(current, previous),
        diff_from_schemas(current, previous)
    );
}

#[test]
fn test_schema_diff_change_object_fields() {
    let current = r"
        interface Actor { name: String }
        type User implements Actor {
            id: ID
            value: Float
        }
    ";
    let previous = r"
        interface Actor { name: String }
        type User implements Actor {
            id: ID!
        }
    ";
    assert_eq!(
        diff(current, previous),
        diff_from_schemas(current, previous)
    );
}

#[test]
fn test_schema_diff_change_object_field_arguments() {
    let current = r"
        interface Actor { name: String }
        type User implements Actor {
            key(a: ID): String
            name: String
            user(a: ID): String
        }
    ";
    let previous = r"
        interface Actor { name: String }
        type User implements Actor {
            key: String
            name(a: ID!): String
            user(a: ID!): String
        }
    ";
    assert_eq!(
        diff(current, previous),
        diff_from_schemas(current, previous)
    );
}

#[test]
fn test_schema_diff_field_directive_added() {
    let current = r"
        directive @d(a: String) on FIELD_DEFINITION
        type User {
            # The directive is added here
            name: String @d
        }
    ";
    let previous = r"
        directive @d(a: String) on FIELD_DEFINITION
        type User {
            name: String
        }
    ";
    assert_eq!(
        diff(current, previous),
        diff_from_schemas(current, previous)
    );
}

#[test]
fn test_schema_diff_field_directive_argument_changed() {
    let current = r#"
        directive @d(a: String) on FIELD_DEFINITION
        type User {
            # Only the directive's argument value changes
            name: String @d(a: "new")
        }
    "#;
    let previous = r#"
        directive @d(a: String) on FIELD_DEFINITION
        type User {
            name: String @d(a: "old")
        }
    "#;
    assert_eq!(
        diff(current, previous),
        diff_from_schemas(current, previous)
    );
}

#[test]
fn test_schema_diff_field_directive_moved_is_unchanged() {
    // Adding `Unrelated` first shifts the source position of `@d(a: "x")`
    // without changing it, so `User` must not be reported as changed.
    let current = r#"
        directive @d(a: String) on FIELD_DEFINITION
        type Unrelated { x: String }
        type User {
            name: String @d(a: "x")
        }
    "#;
    let previous = r#"
        directive @d(a: String) on FIELD_DEFINITION
        type User {
            name: String @d(a: "x")
        }
    "#;
    assert_eq!(
        diff(current, previous),
        diff_from_schemas(current, previous)
    );
}

#[test]
fn test_schema_diff_field_directive_arguments_reordered_is_unchanged() {
    let current = r#"
        directive @d(a: String, b: String) on FIELD_DEFINITION
        type User {
            # Same arguments as before, in a different order
            name: String @d(b: "y", a: "x")
        }
    "#;
    let previous = r#"
        directive @d(a: String, b: String) on FIELD_DEFINITION
        type User {
            name: String @d(a: "x", b: "y")
        }
    "#;
    assert_eq!(diff_from_schemas(current, previous), SchemaChange::None);
}

#[test]
fn test_schema_diff_field_directive_object_fields_reordered_is_unchanged() {
    let current = r#"
        input I { a: String, b: String }
        directive @d(i: I) on FIELD_DEFINITION
        type User {
            # Same input-object fields as before, in a different order
            name: String @d(i: {b: "y", a: "x"})
        }
    "#;
    let previous = r#"
        input I { a: String, b: String }
        directive @d(i: I) on FIELD_DEFINITION
        type User {
            name: String @d(i: {a: "x", b: "y"})
        }
    "#;
    assert_eq!(diff_from_schemas(current, previous), SchemaChange::None);
}

#[test]
fn test_schema_diff_field_directive_reordered() {
    // Directive order is significant (spec §2.12), so swapping two directives
    // is a change.
    let current = r"
        directive @a on FIELD_DEFINITION
        directive @b on FIELD_DEFINITION
        type User {
            name: String @b @a
        }
    ";
    let previous = r"
        directive @a on FIELD_DEFINITION
        directive @b on FIELD_DEFINITION
        type User {
            name: String @a @b
        }
    ";
    assert_eq!(
        diff(current, previous),
        diff_from_schemas(current, previous)
    );
}

#[test]
fn test_schema_diff_change_type_kind() {
    // input object <-> object
    let current = r"
        input User {
            value: Float
        }
    ";
    let previous = r"
        type User {
            name: String
        }
    ";
    assert_eq!(
        diff(current, previous),
        diff_from_schemas(current, previous)
    );
}

#[test]
fn test_schema_diff_change_type_object_interface() {
    let current = r"
        type User {
            value: Float
        }
    ";
    let previous = r"
        interface User {
            name: String
        }
    ";
    assert_eq!(
        diff(current, previous),
        diff_from_schemas(current, previous)
    );
}

#[test]
fn test_schema_diff_change_type_enum_scalar() {
    let current = r"
        scalar A
    ";
    let previous = r"
        enum A {
            OK
            NOT_OK
        }
    ";
    assert_eq!(
        diff(current, previous),
        diff_from_schemas(current, previous)
    );
}

#[test]
fn test_schema_diff_change_type_enum_union() {
    let current = r"
        type A { id: ID }
        enum B { OK NOT_OK }
        union C = A
    ";
    let previous = r"
        type A { id: ID }
        enum C { OK NOT_OK }
        union B = A
    ";
    assert_eq!(
        diff(current, previous),
        diff_from_schemas(current, previous)
    );
}

// Test that comment-only changes produce None from schema diff
// (structurally identical schemas).
#[test]
fn test_schema_diff_comment_only_change() {
    let current = r"
        enum A {
            OK
            NOT_OK
        }
    ";
    let previous = r"
        # comment
        enum A {
            OK
            NOT_OK
        }
    ";
    // Text-based diff sees different text but no definition changes → GenericChange
    assert_eq!(diff(current, previous), SchemaChange::GenericChange);
    // Schema-based diff sees identical schemas → None
    assert_eq!(diff_from_schemas(current, previous), SchemaChange::None);
}

// Test that extensions produce field-level changes in schema diff
// (since build_schema merges extensions into base types).
#[test]
fn test_schema_diff_extension_merged() {
    let current = r"
        type A {
            key: String
        }
        extend type A {
            name: String
        }
    ";
    let previous = r"
        type A {
            key: String
        }
    ";
    // Text-based diff skips extensions → GenericChange
    assert_eq!(diff(current, previous), SchemaChange::GenericChange);
    // Schema-based diff sees the merged field difference
    let schema_result = diff_from_schemas(current, previous);
    match &schema_result {
        SchemaChange::DefinitionChanges(changes) => {
            assert!(changes.iter().any(|c| matches!(c,
                DefinitionChange::ObjectChanged { name, .. } if *name == "A".intern()
            )));
        }
        other => panic!("Expected DefinitionChanges, got {other:?}"),
    }
}

// Test with list and non-null type modifiers.
#[test]
fn test_schema_diff_complex_type_modifiers() {
    let current = r"
        type User {
            friends: [String!]!
            name: String
        }
    ";
    let previous = r"
        type User {
            friends: [String]
            name: String
        }
    ";
    assert_eq!(
        diff(current, previous),
        diff_from_schemas(current, previous)
    );
}

// Test with multiple types changing simultaneously.
#[test]
fn test_schema_diff_multiple_changes() {
    let current = r"
        type A { key: String }
        enum B { X Y Z }
        input C { value: Int }
        union D = A
        scalar E
    ";
    let previous = r"
        type A { key: Int }
        enum B { X Y }
        input C { value: String }
        scalar E
        interface F { id: ID }
    ";
    assert_eq!(
        diff(current, previous),
        diff_from_schemas(current, previous)
    );
}

// Test that identical schemas produce None.
#[test]
fn test_schema_diff_identical_complex_schema() {
    let schema = r"
        interface Node { id: ID! }
        type User implements Node {
            id: ID!
            name: String
            friends: [User]
        }
        enum Status { ACTIVE INACTIVE }
        union SearchResult = User
        input CreateUserInput { name: String! }
        scalar DateTime
    ";
    assert_eq!(diff_from_schemas(schema, schema), SchemaChange::None);
}

fn sort_change(change: &mut SchemaChange) {
    if let SchemaChange::DefinitionChanges(changes) = change {
        changes.sort();
        for c in changes {
            match c {
                DefinitionChange::UnionChanged { added, removed, .. } => {
                    added.sort();
                    removed.sort();
                }
                DefinitionChange::InputObjectChanged { added, removed, .. } => {
                    added.sort_by_key(|item| item.name);
                    removed.sort_by_key(|item| item.name);
                }
                DefinitionChange::InterfaceChanged { added, removed, .. } => {
                    added.sort_by_key(|item| item.name);
                    removed.sort_by_key(|item| item.name);
                }
                DefinitionChange::ObjectChanged {
                    added,
                    removed,
                    changed,
                    interfaces_added,
                    interfaces_removed,
                    ..
                } => {
                    added.sort_by_key(|item| item.name);
                    removed.sort_by_key(|item| item.name);
                    changed.sort_by_key(|item| item.name);
                    interfaces_added.sort();
                    interfaces_removed.sort();
                }
                DefinitionChange::ObjectRemoved { interfaces, .. } => {
                    interfaces.sort();
                }
                _ => {}
            }
        }
    }
}

fn diff_per_document(current: &[&str], previous: &[&str]) -> Option<SchemaChange> {
    let mut change = try_detect_changes_per_document(current, previous)?;
    sort_change(&mut change);
    Some(change)
}

fn diff_joined(current: &[&str], previous: &[&str]) -> SchemaChange {
    let mut change = detect_changes(current, previous);
    sort_change(&mut change);
    change
}

#[test]
fn test_per_document_matches_joined_documents() {
    let current = [
        "type A { x: Int }",
        "type B { y: Int z: String }\nenum E { ONE }",
        "union U = A",
        "",
        "# comment only",
    ];
    let previous = [
        "type A { x: Int }",
        "type B { y: Int }\nenum E { ONE TWO }",
        "input I { a: Int }",
    ];

    let change = diff_per_document(&current, &previous);

    assert!(
        matches!(change, Some(SchemaChange::DefinitionChanges(_))),
        "expected definition changes, got {change:?}",
    );
    assert_eq!(change, Some(diff_joined(&current, &previous)));
}

#[test]
fn test_per_document_is_none_for_definition_split_across_documents() {
    assert_eq!(
        diff_per_document(&["type A {", "x: Int }"], &["type A {", "y: Int }"]),
        None,
        "neither half of `A` parses on its own",
    );
}

#[test]
fn test_per_document_same_text() {
    assert_eq!(
        diff_per_document(&["type A { x: Int }"], &["type A { x: Int }"]),
        Some(SchemaChange::None)
    );
}
