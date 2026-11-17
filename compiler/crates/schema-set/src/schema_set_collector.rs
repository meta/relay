/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

use std::collections::BTreeMap;
use std::collections::VecDeque;

use common::ArgumentName;
use common::NamedItem;
use graphql_syntax::OperationKind;
use intern::string_key::StringKey;
use intern::string_key::StringKeyIndexMap;
use intern::string_key::StringKeyMap;
use schema::DirectiveValue;
use schema::EnumID;
use schema::FieldID;
use schema::InputObjectID;
use schema::InterfaceID;
use schema::ObjectID;
use schema::SDLSchema;
use schema::ScalarID;
use schema::Schema;
use schema::Type;
use schema::TypeReference;
use schema::UnionID;
use schema_coordinates::SchemaCoordinate;

use crate::OutputNonNull;
use crate::OutputTypeReference;
use crate::SEMANTIC_NON_NULL;
use crate::SEMANTIC_NON_NULL_LEVELS_ARG;
use crate::is_graphql_builtin_directive;
use crate::schema_set::FieldName;
use crate::schema_set::SchemaDefinitionItem;
use crate::schema_set::SchemaSet;
use crate::schema_set::SetArgument;
use crate::schema_set::SetDirective;
use crate::schema_set::SetDirectiveValue;
use crate::schema_set::SetEnum;
use crate::schema_set::SetEnumValue;
use crate::schema_set::SetField;
use crate::schema_set::SetInputObject;
use crate::schema_set::SetInterface;
use crate::schema_set::SetMemberType;
use crate::schema_set::SetObject;
use crate::schema_set::SetScalar;
use crate::schema_set::SetType;
use crate::schema_set::SetUnion;
use crate::schema_set_collection_options::UsedSchemaCollectionOptions;

/**
 * Methods that allow us to "touch" used types from the parent schema.
 */
impl SchemaSet {
    pub fn touch_operation_kind(&mut self, schema: &SDLSchema, operation_kind: OperationKind) {
        match operation_kind {
            OperationKind::Query => {
                self.root_schema.query_type =
                    schema.query_type().map(|type_| schema.get_type_name(type_));
            }
            OperationKind::Mutation => {
                self.root_schema.mutation_type = schema
                    .mutation_type()
                    .map(|type_| schema.get_type_name(type_));
            }
            OperationKind::Subscription => {
                self.root_schema.subscription_type = schema
                    .subscription_type()
                    .map(|type_| schema.get_type_name(type_));
            }
        }
    }

    // Add the output type to the correct type map, if it is not already there.
    pub fn touch_output_type(
        &mut self,
        schema: &SDLSchema,
        type_: &Type,
        options: &UsedSchemaCollectionOptions,
    ) {
        match type_ {
            Type::Object(id) => self.touch_object_type(schema, id, options),
            Type::Interface(id) => self.touch_interface_type(schema, id, options),
            Type::Union(id) => self.touch_union_type(schema, id, options),
            Type::Scalar(id) => self.touch_scalar(schema, id, options),
            Type::Enum(id) => {
                self.touch_enum(schema, id, options);
                if options.include_implicit_output_enum_values {
                    // This is an enum used as an output, so must include all values
                    self.update_all_enum_values(schema, id);
                }
            }
            Type::InputObject(_) => panic!(
                "Trying to add an input object {:?} to the used schema from an output type",
                type_
            ),
        }
    }

    // Add the type plus all of its fields/values to the used types map, recursively.
    // This should only be used for types that can be used as variable values.
    pub fn touch_variable_type(
        &mut self,
        schema: &SDLSchema,
        type_: &Type,
        options: &UsedSchemaCollectionOptions,
    ) {
        match type_ {
            Type::Object(_) => panic!(
                "Should never recursively use composite types, trying to touch whole {:?}.",
                type_
            ),
            Type::Interface(_) => panic!(
                "Should never recursively use composite types, trying to touch whole {:?}.",
                type_
            ),
            Type::Union(_) => panic!(
                "Should never recursively use composite types, trying to touch whole {:?}.",
                type_
            ),
            Type::Scalar(id) => self.touch_scalar(schema, id, options),
            Type::Enum(id) => {
                self.touch_enum(schema, id, options);
                // This is an enum used as an output, so must include all values
                if options.include_implicit_input_fields_and_enum_values {
                    self.update_all_enum_values(schema, id);
                }
            }
            Type::InputObject(id) => {
                let used_input_object = self.touch_input_object(schema, id, options);
                if used_input_object.fully_recursively_visited
                    || !options.include_implicit_input_fields_and_enum_values
                {
                    return;
                }
                used_input_object.fully_recursively_visited = true;
                for field in schema.input_object(*id).fields.iter() {
                    self.touch_input_object_field(schema, id, field.name.item.0, options);
                    self.touch_variable_type(schema, &field.type_.inner(), options);
                }
            }
        }
    }

    pub fn touch_input_type(
        &mut self,
        schema: &SDLSchema,
        type_: &Type,
        options: &UsedSchemaCollectionOptions,
    ) {
        match type_ {
            Type::Object(_) => panic!(
                "Should never have use composite input types, trying to touch {:?}.",
                type_
            ),
            Type::Interface(_) => panic!(
                "Should never have use composite input types, trying to touch {:?}.",
                type_
            ),
            Type::Union(_) => panic!(
                "Should never have use composite input types, trying to touch {:?}.",
                type_
            ),
            Type::Scalar(id) => self.touch_scalar(schema, id, options),
            Type::Enum(id) => self.touch_enum(schema, id, options),
            Type::InputObject(id) => {
                self.touch_input_object(schema, id, options);
            }
        }
    }

    pub fn touch_object_type(
        &mut self,
        schema: &SDLSchema,
        id: &ObjectID,
        options: &UsedSchemaCollectionOptions,
    ) {
        let from_schema = schema.object(*id);
        if !self.types.contains_key(&from_schema.name.item.0) {
            // We always mark ALL interfaces. Because the used schemas are sharded, we don't want
            // a situation where an interface is used in a different library, but this type is not,
            // and when merging we can't recognize that there should be a link between the two.
            let all_interfaces = from_schema
                .interfaces
                .iter()
                .map(|id| {
                    let schema_interface = schema.interface(*id);
                    (
                        schema_interface.name.item.0,
                        SetMemberType {
                            definition: SchemaDefinitionItem {
                                locations: vec![schema_interface.name.location],
                                is_client_definition: schema_interface.is_extension,
                                description: None,
                                hack_source: None,
                            },
                            name: schema_interface.name.item.0,
                            is_extension: schema_interface.is_extension,
                        },
                    )
                })
                .collect();
            self.types
                .entry(from_schema.name.item.0)
                .or_insert_with(|| {
                    SetType::Object(SetObject {
                        definition: SchemaDefinitionItem {
                            locations: vec![from_schema.name.location],
                            is_client_definition: from_schema.is_extension,
                            description: None,
                            hack_source: None,
                        },
                        coordinate: Some(SchemaCoordinate::Type {
                            name: from_schema.name.item.0,
                        }),
                        fields: StringKeyMap::default(),
                        interfaces: all_interfaces,
                        name: from_schema.name.item,
                        directives: copy_sdl_directives(
                            schema,
                            &from_schema.directives,
                            options,
                            from_schema.is_extension,
                        ),
                    })
                });
            // Any schema-level directives must also be inserted
            self.touch_directive_values(schema, &from_schema.directives, options);
        }
    }

    pub fn touch_interface_type(
        &mut self,
        schema: &SDLSchema,
        id: &InterfaceID,
        options: &UsedSchemaCollectionOptions,
    ) {
        let from_schema = schema.interface(*id);
        if !self.types.contains_key(&from_schema.name.item.0) {
            // We always mark ALL interfaces. Because the used schemas are sharded, we don't want
            // a situation where an interface is used in a different library, but this type is not,
            // and when merging we can't recognize that there should be a link between the two.
            let all_interfaces = from_schema
                .interfaces
                .iter()
                .map(|id| {
                    let schema_interface = schema.interface(*id);
                    (
                        schema_interface.name.item.0,
                        SetMemberType {
                            definition: SchemaDefinitionItem {
                                locations: vec![schema_interface.name.location],
                                is_client_definition: schema_interface.is_extension,
                                description: None,
                                hack_source: None,
                            },
                            name: schema_interface.name.item.0,
                            is_extension: schema_interface.is_extension,
                        },
                    )
                })
                .collect();

            self.types
                .entry(from_schema.name.item.0)
                .or_insert_with(|| {
                    SetType::Interface(SetInterface {
                        definition: SchemaDefinitionItem {
                            locations: vec![from_schema.name.location],
                            is_client_definition: from_schema.is_extension,
                            description: None,
                            hack_source: None,
                        },
                        coordinate: Some(SchemaCoordinate::Type {
                            name: from_schema.name.item.0,
                        }),
                        fields: StringKeyMap::default(),
                        interfaces: all_interfaces,
                        name: from_schema.name.item,
                        directives: copy_sdl_directives(
                            schema,
                            &from_schema.directives,
                            options,
                            from_schema.is_extension,
                        ),
                    })
                });
            self.touch_directive_values(schema, &from_schema.directives, options);
        }
    }

    pub fn touch_union_type(
        &mut self,
        schema: &SDLSchema,
        id: &UnionID,
        options: &UsedSchemaCollectionOptions,
    ) {
        let from_schema = schema.union(*id);
        if !self.types.contains_key(&from_schema.name.item.0) {
            self.types
                .entry(from_schema.name.item.0)
                .or_insert_with(|| {
                    let members = from_schema
                        .members
                        .iter()
                        .map(|id| {
                            let member = schema.object(*id);
                            (
                                member.name.item.0,
                                SetMemberType {
                                    definition: SchemaDefinitionItem {
                                        locations: vec![member.name.location],
                                        is_client_definition: member.is_extension,
                                        description: None,
                                        hack_source: None,
                                    },
                                    name: member.name.item.0,
                                    is_extension: member.is_extension,
                                },
                            )
                        })
                        .collect();
                    SetType::Union(SetUnion {
                        definition: SchemaDefinitionItem {
                            locations: vec![from_schema.name.location],
                            is_client_definition: from_schema.is_extension,
                            description: None,
                            hack_source: None,
                        },
                        coordinate: Some(SchemaCoordinate::Type {
                            name: from_schema.name.item.0,
                        }),
                        // We always include ALL members of the union.
                        // This is the same logic as always including all implements
                        // on an Object: the schemas are sharded, and we don't want
                        // to miss a member that is used in another library.
                        members,
                        name: from_schema.name.item,
                        directives: copy_sdl_directives(
                            schema,
                            &from_schema.directives,
                            options,
                            from_schema.is_extension,
                        ),
                    })
                });
            self.touch_directive_values(schema, &from_schema.directives, options);
        }
    }

    pub fn touch_input_object(
        &mut self,
        schema: &SDLSchema,
        id: &InputObjectID,
        options: &UsedSchemaCollectionOptions,
    ) -> &mut SetInputObject {
        let schema_input = schema.input_object(*id);
        self.touch_directive_values(schema, &schema_input.directives, options);
        let name = schema_input.name.item.0;
        self.types.entry(name).or_insert_with(|| {
            SetType::InputObject(SetInputObject {
                definition: SchemaDefinitionItem {
                    locations: vec![schema_input.name.location],
                    // WTF schema does not allow input objects as extensions yet?
                    is_client_definition: false,
                    description: None,
                    hack_source: None,
                },
                coordinate: Some(SchemaCoordinate::Type { name }),
                fields: StringKeyIndexMap::default(),
                name: schema_input.name.item,
                directives: copy_sdl_directives(
                    schema,
                    &schema_input.directives,
                    options,
                    false, /* SDLSchema InputObject does not support extensions yet */
                ),
                fully_recursively_visited: false,
            })
        });
        if let SetType::InputObject(input_object) = self.types.get_mut(&name).unwrap() {
            input_object
        } else {
            unreachable!(
                "We just put the input object {} into the SchemaSet types map, how is it not found?",
                name
            )
        }
    }

    // Return the existing set of SetArguments for this field.
    // If there are none, then
    pub fn touch_field(
        &mut self,
        schema: &SDLSchema,
        field_id: &FieldID,
        options: &UsedSchemaCollectionOptions,
    ) {
        let schema_field = schema.field(*field_id);
        self.touch_directive_values(schema, &schema_field.directives, options);
        let field_name = schema_field.name.item;
        self.touch_output_type(schema, &schema_field.type_.inner(), options);
        // Fields without parent types should be meta-fields, so do not need to be included in the
        // used schema.
        if let Some(parent_type) = schema_field.parent_type {
            // You might be wondering: didn't we *already* touch the parent type during the IR visit?
            // You'd be correct! except: @fixme_fat_interface means there might be fields under
            // a *union*. The Schema's lookup() function will just find *some* field with the name
            // that is on *some* type that is a member of the current abstract type. So we need to
            // touch *that* arbitrary type, too!
            self.touch_output_type(schema, &parent_type, options);
            match parent_type {
                Type::Object(id) => {
                    let schema_object = schema.object(id);
                    let object_name = schema_object.name.item.0;
                    if let Some(SetType::Object(used_object)) = self.types.get_mut(&object_name) {
                        used_object
                            .fields
                            .entry(field_name)
                            .or_insert_with(|| SetField {
                                definition: SchemaDefinitionItem {
                                    locations: vec![schema_field.name.location],
                                    is_client_definition: schema_field.is_extension,
                                    description: None,
                                    hack_source: None,
                                },
                                coordinate: Some(SchemaCoordinate::Member {
                                    parent_name: object_name,
                                    member_name: field_name,
                                }),
                                arguments: StringKeyIndexMap::default(),
                                type_: stringkey_output_type_ref_from_schema_type(
                                    schema,
                                    &schema_field.type_,
                                    &schema_field.directives,
                                    options,
                                ),
                                name: FieldName(field_name),
                                directives: copy_sdl_directives(
                                    schema,
                                    &schema_field.directives,
                                    options,
                                    schema_field.is_extension,
                                ),
                            });
                    }
                }
                Type::Interface(id) => {
                    let schema_interface = schema.interface(id);
                    let interface_name = schema_interface.name.item.0;
                    if let Some(SetType::Interface(used_interface)) =
                        self.types.get_mut(&interface_name)
                    {
                        used_interface
                            .fields
                            .entry(field_name)
                            .or_insert_with(|| SetField {
                                definition: SchemaDefinitionItem {
                                    locations: vec![schema_field.name.location],
                                    is_client_definition: schema_field.is_extension,
                                    description: None,
                                    hack_source: None,
                                },
                                coordinate: Some(SchemaCoordinate::Member {
                                    parent_name: interface_name,
                                    member_name: field_name,
                                }),
                                arguments: StringKeyIndexMap::default(),
                                type_: stringkey_output_type_ref_from_schema_type(
                                    schema,
                                    &schema_field.type_,
                                    &schema_field.directives,
                                    options,
                                ),
                                name: FieldName(field_name),
                                directives: copy_sdl_directives(
                                    schema,
                                    &schema_field.directives,
                                    options,
                                    schema_field.is_extension,
                                ),
                            });
                    }
                }
                _ => panic!("Unexpected parent type for field {:?}.", schema_field),
            }
        }

        // TODO: handle legacy style @connection fields with client-defined schema extensions.
        // Plus any other non-meta fields that are inserted via transform.
    }

    pub fn touch_fragment_spread(
        &mut self,
        schema: &SDLSchema,
        parent_type: Type,
        spread_type: Type,
        options: &UsedSchemaCollectionOptions,
    ) {
        self.touch_output_type(schema, &spread_type, options);

        // When encountering an abstract => abstract spread, we must include all
        // implementations that intersect between the two types.
        // If the *last* intersecting type is removed, direct spreads between those two types
        // are now invalid.
        if options.include_all_overlapping_concrete_types && parent_type != spread_type {
            for intersecting_type in overlapping_types(schema, parent_type, spread_type) {
                self.touch_output_type(schema, &intersecting_type, options);
            }
        }
    }

    pub fn touch_directive(
        &mut self,
        schema: &SDLSchema,
        directive_name: StringKey,
        options: &UsedSchemaCollectionOptions,
    ) {
        if !options.include_directive_definitions {
            return;
        }
        let Some(schema_directive) = schema.get_directive(common::DirectiveName(directive_name))
        else {
            return;
        };

        // Guard against infinite recursion: a directive can apply other
        // directives (or itself) on its definition, and `touch_directive_values`
        // below calls back into `touch_directive`.
        if self.directives.contains_key(&directive_name) {
            return;
        }

        self.directives.insert(
            directive_name,
            SetDirective {
                definition: SchemaDefinitionItem {
                    locations: vec![schema_directive.name.location],
                    is_client_definition: schema_directive.is_extension,
                    description: None,
                    hack_source: None,
                },
                coordinate: Some(SchemaCoordinate::Directive {
                    name: directive_name,
                }),
                arguments: StringKeyIndexMap::default(),
                locations: schema_directive.locations.clone(),
                name: common::DirectiveName(directive_name),
                repeatable: schema_directive.repeatable,
                directives: schema_directive
                    .directives
                    .iter()
                    .map(|d| SetDirectiveValue::from_schema_value(d, schema_directive.is_extension))
                    .collect(),
            },
        );

        // Pull the definitions of directives applied to this directive's
        // definition into the schema set, for parity with the other touch_*
        // collectors.
        self.touch_directive_values(schema, &schema_directive.directives, options);
    }

    pub fn touch_directive_values(
        &mut self,
        schema: &SDLSchema,
        directive_values: &[DirectiveValue],
        options: &UsedSchemaCollectionOptions,
    ) {
        for directive_value in directive_values {
            self.touch_directive(schema, directive_value.name.0, options);
        }
    }

    pub fn touch_field_argument(
        &mut self,
        schema: &SDLSchema,
        field_id: &FieldID,
        argument_name: StringKey,
        options: &UsedSchemaCollectionOptions,
    ) {
        let schema_field = schema.field(*field_id);
        if let Some(parent_type) = schema_field.parent_type {
            if let Some(schema_arg) = schema_field.arguments.named(ArgumentName(argument_name)) {
                self.touch_directive_values(schema, &schema_arg.directives, options);
                self.touch_input_type(schema, &schema_arg.type_.inner(), options);

                let maybe_used_field: Option<&mut SetField> = match parent_type {
                    Type::Object(id) => self
                        .types
                        .get_mut(&schema.object(id).name.item.0)
                        .and_then(|used_object| {
                            if let SetType::Object(used_object) = used_object {
                                used_object.fields.get_mut(&schema_field.name.item)
                            } else {
                                None
                            }
                        }),
                    Type::Interface(id) => self
                        .types
                        .get_mut(&schema.interface(id).name.item.0)
                        .and_then(|used_interface| {
                            if let SetType::Interface(used_interface) = used_interface {
                                used_interface.fields.get_mut(&schema_field.name.item)
                            } else {
                                None
                            }
                        }),
                    _ => None,
                };

                if let Some(used_field) = maybe_used_field {
                    used_field
                        .arguments
                        .entry(argument_name)
                        .or_insert_with(|| SetArgument {
                            definition: SchemaDefinitionItem {
                                locations: vec![schema_arg.name.location],
                                is_client_definition: schema_field.is_extension,
                                description: None,
                                hack_source: None,
                            },
                            coordinate: Some(SchemaCoordinate::Argument {
                                parent_name: schema.get_type_name(parent_type),
                                member_name: used_field.name.0,
                                argument_name,
                            }),
                            name: argument_name,
                            type_: stringkey_type_ref_from_schema_type(schema, &schema_arg.type_),
                            default_value: schema_arg.default_value.clone(),
                            directives: copy_sdl_directives(
                                schema,
                                &schema_arg.directives,
                                options,
                                schema_field.is_extension,
                            ),
                        });
                }
            }
        }
    }

    pub fn touch_input_object_field(
        &mut self,
        schema: &SDLSchema,
        input_object_id: &InputObjectID,
        field_name: StringKey,
        options: &UsedSchemaCollectionOptions,
    ) {
        let schema_input = schema.input_object(*input_object_id);
        if let Some(schema_input_field) = schema_input.fields.named(ArgumentName(field_name)) {
            self.touch_directive_values(schema, &schema_input_field.directives, options);
            self.touch_input_type(schema, &schema_input_field.type_.inner(), options);

            if let Some(SetType::InputObject(used_input)) =
                self.types.get_mut(&schema_input.name.item.0)
            {
                used_input
                    .fields
                    .entry(field_name)
                    .or_insert_with(|| SetArgument {
                        definition: SchemaDefinitionItem {
                            locations: vec![schema_input.name.location],
                            is_client_definition: false,
                            description: None,
                            hack_source: None,
                        },
                        coordinate: Some(SchemaCoordinate::Member {
                            parent_name: schema_input.name.item.0,
                            member_name: field_name,
                        }),
                        name: field_name,
                        type_: stringkey_type_ref_from_schema_type(
                            schema,
                            &schema_input_field.type_,
                        ),
                        default_value: schema_input_field.default_value.clone(),
                        directives: copy_sdl_directives(
                            schema,
                            &schema_input_field.directives,
                            options,
                            false, /* SDLSchema InputObject does not support extensions yet */
                        ),
                    });
            }
        }
    }

    pub fn touch_directive_argument(
        &mut self,
        schema: &SDLSchema,
        schema_directive: &schema::Directive,
        argument_name: StringKey,
        options: &UsedSchemaCollectionOptions,
    ) {
        if let Some(schema_arg) = schema_directive
            .arguments
            .named(ArgumentName(argument_name))
        {
            self.touch_directive_values(schema, &schema_arg.directives, options);
            self.touch_input_type(schema, &schema_arg.type_.inner(), options);

            if let Some(used_directive) = self.directives.get_mut(&schema_directive.name.item.0) {
                used_directive
                    .arguments
                    .entry(argument_name)
                    .or_insert_with(|| SetArgument {
                        definition: SchemaDefinitionItem {
                            locations: vec![schema_arg.name.location],
                            is_client_definition: schema_directive.is_extension,
                            description: None,
                            hack_source: None,
                        },
                        coordinate: Some(SchemaCoordinate::DirectiveArgument {
                            directive_name: schema_directive.name.item.0,
                            argument_name,
                        }),
                        name: argument_name,
                        type_: stringkey_type_ref_from_schema_type(schema, &schema_arg.type_),
                        default_value: schema_arg.default_value.clone(),
                        directives: copy_sdl_directives(
                            schema,
                            &schema_arg.directives,
                            options,
                            schema_directive.is_extension,
                        ),
                    });
            }
        }
    }

    pub fn touch_scalar(
        &mut self,
        schema: &SDLSchema,
        scalar_id: &ScalarID,
        options: &UsedSchemaCollectionOptions,
    ) {
        let from_schema = schema.scalar(*scalar_id);
        self.touch_directive_values(schema, &from_schema.directives, options);

        self.types
            .entry(from_schema.name.item.0)
            .or_insert_with(|| {
                SetType::Scalar(SetScalar {
                    definition: SchemaDefinitionItem {
                        locations: vec![from_schema.name.location],
                        is_client_definition: from_schema.is_extension,
                        description: None,
                        hack_source: None,
                    },
                    coordinate: Some(SchemaCoordinate::Type {
                        name: from_schema.name.item.0,
                    }),
                    name: from_schema.name.item,
                    directives: copy_sdl_directives(
                        schema,
                        &from_schema.directives,
                        options,
                        from_schema.is_extension,
                    ),
                })
            });
    }

    pub fn touch_enum(
        &mut self,
        schema: &SDLSchema,
        enum_id: &EnumID,
        options: &UsedSchemaCollectionOptions,
    ) {
        let from_schema = schema.enum_(*enum_id);
        self.touch_directive_values(schema, &from_schema.directives, options);

        self.types
            .entry(from_schema.name.item.0)
            .or_insert_with(|| {
                SetType::Enum(SetEnum {
                    definition: SchemaDefinitionItem {
                        locations: vec![from_schema.name.location],
                        is_client_definition: from_schema.is_extension,
                        description: None,
                        hack_source: None,
                    },
                    coordinate: Some(SchemaCoordinate::Type {
                        name: from_schema.name.item.0,
                    }),
                    values: BTreeMap::default(),
                    name: from_schema.name.item,
                    directives: copy_sdl_directives(
                        schema,
                        &from_schema.directives,
                        options,
                        from_schema.is_extension,
                    ),
                })
            });
    }

    pub fn touch_enum_value(
        &mut self,
        schema: &SDLSchema,
        enum_id: &EnumID,
        enum_value: StringKey,
        options: &UsedSchemaCollectionOptions,
    ) {
        let schema_enum = schema.enum_(*enum_id);
        if let Some(schema_value) = schema_enum.values.iter().find(|v| v.value == enum_value) {
            self.touch_directive_values(schema, &schema_value.directives, options);
            if let Some(SetType::Enum(used_enum)) = self.types.get_mut(&schema_enum.name.item.0) {
                used_enum.values.entry(enum_value).or_insert_with(|| {
                    // Don't copy description - used schemas should be minimal
                    SetEnumValue {
                        definition: SchemaDefinitionItem {
                            locations: Vec::new(),
                            is_client_definition: schema_enum.is_extension,
                            description: None,
                            hack_source: None,
                        },
                        coordinate: Some(SchemaCoordinate::Member {
                            parent_name: schema_enum.name.item.0,
                            member_name: enum_value,
                        }),
                        value: schema_value.value,
                        directives: schema_value
                            .directives
                            .iter()
                            .map(|dv| {
                                SetDirectiveValue::from_schema_value(dv, schema_enum.is_extension)
                            })
                            .collect(),
                        description: None,
                    }
                });
            }
        }
    }

    fn update_all_enum_values(&mut self, schema: &SDLSchema, enum_id: &EnumID) {
        let schema_enum = schema.enum_(*enum_id);
        if let Some(SetType::Enum(used_enum)) = self.types.get_mut(&schema_enum.name.item.0) {
            for value in schema_enum.values.iter() {
                used_enum.values.entry(value.value).or_insert_with(|| {
                    // Don't copy description - used schemas should be minimal
                    SetEnumValue {
                        definition: SchemaDefinitionItem {
                            locations: Vec::new(),
                            is_client_definition: schema_enum.is_extension,
                            description: None,
                            hack_source: None,
                        },
                        coordinate: Some(SchemaCoordinate::Member {
                            parent_name: schema_enum.name.item.0,
                            member_name: value.value,
                        }),
                        value: value.value,
                        directives: value
                            .directives
                            .iter()
                            .map(|dv| {
                                SetDirectiveValue::from_schema_value(dv, schema_enum.is_extension)
                            })
                            .collect(),
                        description: None,
                    }
                });
            }
        }
    }
}

fn stringkey_type_ref_from_schema_type(
    schema: &SDLSchema,
    schema_type: &TypeReference<Type>,
) -> TypeReference<StringKey> {
    match schema_type {
        TypeReference::Named(type_) => TypeReference::Named(schema.get_type_name(*type_)),
        TypeReference::NonNull(inner) => {
            TypeReference::NonNull(Box::new(stringkey_type_ref_from_schema_type(schema, inner)))
        }
        TypeReference::List(inner) => {
            TypeReference::List(Box::new(stringkey_type_ref_from_schema_type(schema, inner)))
        }
    }
}

fn stringkey_output_type_ref_from_schema_type(
    schema: &SDLSchema,
    schema_type: &TypeReference<Type>,
    directives: &[DirectiveValue],
    options: &UsedSchemaCollectionOptions,
) -> OutputTypeReference<StringKey> {
    // Following logic for how @semanticNonNull(levels: [Int] = [0]) is defined here:
    // https://relay.dev/docs/guides/semantic-nullability/#proposed-solution
    let mut semantic_non_null_levels: VecDeque<i64> =
        if options.include_directives_on_schema_definitions {
            directives.named(*SEMANTIC_NON_NULL).map_or_else(
                Default::default,
                |semantic_non_null_directive| {
                    semantic_non_null_directive
                        .arguments
                        .iter()
                        .find_map(|arg| {
                            if arg.name == *SEMANTIC_NON_NULL_LEVELS_ARG {
                                Some(match &arg.value {
                                    graphql_syntax::ConstantValue::List(_) => {
                                        arg.expect_int_list().into_iter().collect()
                                    }
                                    single => [single.unwrap_int()].into_iter().collect(),
                                })
                            } else {
                                None
                            }
                        })
                        .unwrap_or_else(|| [0].into_iter().collect())
                },
            )
        } else {
            // If we aren't including directives then we don't need semantic non null either.
            Default::default()
        };
    stringkey_output_type_ref_from_schema_type_with_semantic_nonnull(
        schema,
        schema_type,
        &mut semantic_non_null_levels,
    )
}

fn stringkey_output_type_ref_from_schema_type_with_semantic_nonnull(
    schema: &SDLSchema,
    schema_type: &TypeReference<Type>,
    // sorted where 0 is at the front of the queue
    semantic_non_null_levels: &mut VecDeque<i64>,
) -> OutputTypeReference<StringKey> {
    if let Some(next_semantic_non_null_level) = semantic_non_null_levels.pop_front() {
        if next_semantic_non_null_level == 0 {
            // This level is @semanticNonNull, but it might ALSO be strictly NonNull, in which case just take the strictly NonNull.
            return if let TypeReference::NonNull(_) = schema_type {
                stringkey_output_type_ref_from_schema_type_with_semantic_nonnull(
                    schema,
                    schema_type,
                    semantic_non_null_levels,
                )
            } else {
                OutputTypeReference::NonNull(OutputNonNull::Semantic(Box::new(
                    stringkey_output_type_ref_from_schema_type_with_semantic_nonnull(
                        schema,
                        schema_type,
                        semantic_non_null_levels,
                    ),
                )))
            };
        } else {
            // Put the value back: it is not 0, so we still need it.
            semantic_non_null_levels.push_front(next_semantic_non_null_level);
            // If we're stepping into a list, then reduce all levels by 1.
            if let TypeReference::List(_) = schema_type {
                for level in semantic_non_null_levels.iter_mut() {
                    *level -= 1;
                }
            }
        }
    }
    match schema_type {
        TypeReference::Named(type_) => OutputTypeReference::Named(schema.get_type_name(*type_)),
        TypeReference::NonNull(inner) => {
            OutputTypeReference::NonNull(OutputNonNull::KillsParent(Box::new(
                stringkey_output_type_ref_from_schema_type_with_semantic_nonnull(
                    schema,
                    inner,
                    semantic_non_null_levels,
                ),
            )))
        }
        TypeReference::List(inner) => OutputTypeReference::List(Box::new(
            stringkey_output_type_ref_from_schema_type_with_semantic_nonnull(
                schema,
                inner,
                semantic_non_null_levels,
            ),
        )),
    }
}

/// This probably should live in the Relay graphql_schema.rs methods
/// It is veeeery similar to are_overlapping_types, but it's a *bit* more expensive
/// due to allocating new vectors.
pub fn overlapping_types(schema: &SDLSchema, a: Type, b: Type) -> Vec<Type> {
    fn overlapping_objects(a: &[ObjectID], b: &[ObjectID]) -> Vec<Type> {
        a.iter()
            .filter(|item| b.contains(item))
            .map(|item| Type::Object(*item))
            .collect()
    }

    fn overlapping_interfaces(a: &[InterfaceID], b: &[InterfaceID]) -> Vec<Type> {
        a.iter()
            .filter(|item| b.contains(item))
            .map(|item| Type::Interface(*item))
            .collect()
    }

    match (a, b) {
        (Type::Interface(a), Type::Interface(b)) => {
            let mut overlapping = overlapping_objects(
                &schema.interface(a).implementing_objects,
                &schema.interface(b).implementing_objects,
            );
            overlapping.extend(overlapping_interfaces(
                &schema.interface(a).implementing_interfaces,
                &schema.interface(b).implementing_interfaces,
            ));
            overlapping
        }

        (Type::Union(a), Type::Union(b)) => {
            overlapping_objects(&schema.union(a).members, &schema.union(b).members)
        }

        (Type::Union(union_id), Type::Interface(interface_id))
        | (Type::Interface(interface_id), Type::Union(union_id)) => overlapping_objects(
            &schema.union(union_id).members,
            &schema.interface(interface_id).implementing_objects,
        ),

        (Type::Interface(interface_id), Type::Object(object_id))
        | (Type::Object(object_id), Type::Interface(interface_id)) => {
            if schema
                .interface(interface_id)
                .implementing_objects
                .contains(&object_id)
            {
                vec![Type::Object(object_id)]
            } else {
                Vec::new()
            }
        }

        (Type::Union(union_id), Type::Object(object_id))
        | (Type::Object(object_id), Type::Union(union_id)) => {
            if schema.union(union_id).members.contains(&object_id) {
                vec![Type::Object(object_id)]
            } else {
                Vec::new()
            }
        }

        _ => Vec::new(),
    }
}

fn copy_sdl_directives(
    schema: &SDLSchema,
    schema_directives: &[DirectiveValue],
    options: &UsedSchemaCollectionOptions,
    is_client_definition: bool,
) -> Vec<SetDirectiveValue> {
    if options.include_directives_on_schema_definitions {
        schema_directives
            .iter()
            .filter(|d| d.name != *SEMANTIC_NON_NULL)
            .map(|dv| {
                // If the directive definition can't be found, or is itself a client definition, then the directive is a client definition.
                // Exception: GraphQL spec built-in directives (@deprecated, @specifiedBy, @oneOf) are never extensions.
                let value_is_client_definition = !is_graphql_builtin_directive(dv.name)
                    && schema
                        .get_directive(dv.name)
                        .is_none_or(|directive_value_def| directive_value_def.is_extension);
                let is_client = is_client_definition || value_is_client_definition;
                SetDirectiveValue::from_schema_value(dv, is_client)
            })
            .collect()
    } else {
        Vec::new()
    }
}

#[cfg(test)]
mod tests {
    use std::sync::Arc;

    use common::DirectiveName;
    use common::SourceLocationKey;
    use graphql_syntax::OperationKind;
    use intern::string_key::Intern;
    use schema::DirectiveValue;
    use schema::SDLSchema;
    use schema::Schema;
    use schema::build_schema_with_extensions_parallel;

    use super::*;
    use crate::UsedSchemaCollectionOptions;
    use crate::schema_set::HasDefinitionItem;

    fn build_sdl_schema(sdl: &str) -> Arc<SDLSchema> {
        schema::build_schema(sdl).unwrap().into()
    }

    #[test]
    fn test_client_source_directive_always_marked_as_client_definition() {
        // Build a schema where @base is a server directive and
        // @extension is defined in the client extension schema.
        let schema = build_schema_with_extensions_parallel(
            &[(
                r#"
                    directive @base on ENUM
                "#,
                SourceLocationKey::generated(),
            )],
            &[(
                r#"
                    directive @extension on ENUM
                "#,
                SourceLocationKey::generated(),
            )],
        )
        .unwrap();

        let directives = vec![
            DirectiveValue {
                name: DirectiveName("base".intern()),
                arguments: vec![],
            },
            DirectiveValue {
                name: DirectiveName("extension".intern()),
                arguments: vec![],
            },
        ];

        let options = UsedSchemaCollectionOptions {
            include_directives_on_schema_definitions: true,
            include_implementations_when_typename_requested: None,
            include_all_overlapping_concrete_types: false,
            include_directive_definitions: false,
            include_implicit_output_enum_values: false,
            include_implicit_input_fields_and_enum_values: false,
        };

        // Even with is_client_definition=false (server-defined type),
        // @extension should be marked as a client definition because
        // its directive definition lives in the extension schema.
        let result = copy_sdl_directives(&schema, &directives, &options, false);

        assert_eq!(result.len(), 2);
        assert!(!result[0].is_client_definition(), "@base should be base");
        assert!(
            result[1].is_client_definition(),
            "@extension should be client even on a server type"
        );
    }

    #[test]
    fn test_graphql_builtin_directives_never_considered_extensions() {
        // Build a minimal schema — built-in directives like @deprecated
        // are NOT in builtins.graphql and may not be in the schema at all.
        let schema = build_schema_with_extensions_parallel::<&str, &str>(
            &[(
                r#"
                    type Query { id: ID }
                "#,
                SourceLocationKey::generated(),
            )],
            &[],
        )
        .unwrap();

        let directives = vec![
            DirectiveValue {
                name: DirectiveName("deprecated".intern()),
                arguments: vec![],
            },
            DirectiveValue {
                name: DirectiveName("specifiedBy".intern()),
                arguments: vec![],
            },
            DirectiveValue {
                name: DirectiveName("oneOf".intern()),
                arguments: vec![],
            },
        ];

        let options = UsedSchemaCollectionOptions {
            include_directives_on_schema_definitions: true,
            include_implementations_when_typename_requested: None,
            include_all_overlapping_concrete_types: false,
            include_directive_definitions: false,
            include_implicit_output_enum_values: false,
            include_implicit_input_fields_and_enum_values: false,
        };

        // GraphQL spec built-in directives should never be client extensions,
        // even if they're not found in the schema definition.
        let result = copy_sdl_directives(&schema, &directives, &options, false);

        assert_eq!(result.len(), 3);
        assert!(
            !result[0].is_client_definition(),
            "@deprecated is a built-in and should never be a client extension"
        );
        assert!(
            !result[1].is_client_definition(),
            "@specifiedBy is a built-in and should never be a client extension"
        );
        assert!(
            !result[2].is_client_definition(),
            "@oneOf is a built-in and should never be a client extension"
        );
    }

    #[test]
    fn test_touch_operation_kind_query() {
        let sdl_schema = build_sdl_schema("type Query { name: String }");
        let mut set = SchemaSet::new();
        set.touch_operation_kind(&sdl_schema, OperationKind::Query);
        assert_eq!(set.root_schema.query_type, Some("Query".intern()));
    }

    #[test]
    fn test_touch_operation_kind_mutation() {
        let sdl_schema =
            build_sdl_schema("type Query { id: ID } type Mutation { doThing: Boolean }");
        let mut set = SchemaSet::new();
        set.touch_operation_kind(&sdl_schema, OperationKind::Mutation);
        assert_eq!(set.root_schema.mutation_type, Some("Mutation".intern()));
    }

    #[test]
    fn test_touch_output_type_scalar() {
        let sdl_schema = build_sdl_schema("type Query { name: String }");
        let options =
            UsedSchemaCollectionOptions::only_explicitly_used_without_directives_options();
        let mut set = SchemaSet::new();
        let string_type = sdl_schema.get_type("String".intern()).unwrap();
        set.touch_output_type(&sdl_schema, &string_type, &options);
        assert!(set.types.contains_key(&"String".intern()));
    }

    #[test]
    fn test_touch_output_type_object() {
        let sdl_schema = build_sdl_schema("type Query { id: ID } type User { name: String }");
        let options =
            UsedSchemaCollectionOptions::only_explicitly_used_without_directives_options();
        let mut set = SchemaSet::new();
        let user_type = sdl_schema.get_type("User".intern()).unwrap();
        set.touch_output_type(&sdl_schema, &user_type, &options);
        assert!(set.types.contains_key(&"User".intern()));
    }

    #[test]
    fn test_touch_input_type() {
        let sdl_schema =
            build_sdl_schema("type Query { id: ID } input CreateInput { name: String! }");
        let options =
            UsedSchemaCollectionOptions::only_explicitly_used_without_directives_options();
        let mut set = SchemaSet::new();
        let input_type = sdl_schema.get_type("CreateInput".intern()).unwrap();
        set.touch_input_type(&sdl_schema, &input_type, &options);
        assert!(set.types.contains_key(&"CreateInput".intern()));
    }

    #[test]
    fn test_touch_directive_pulls_in_applied_directive_definitions() {
        // `@foo`'s definition applies `@bar`. Touching `@foo` must also pull in
        // `@bar`'s definition, for parity with the other touch_* collectors —
        // otherwise the printed schema set could reference an undefined directive.
        let sdl_schema = build_sdl_schema(
            r#"
                type Query { id: ID }
                directive @bar on DIRECTIVE_DEFINITION
                directive @foo @bar on FIELD
            "#,
        );
        let options = UsedSchemaCollectionOptions {
            include_directives_on_schema_definitions: true,
            include_implementations_when_typename_requested: None,
            include_all_overlapping_concrete_types: false,
            include_directive_definitions: true,
            include_implicit_output_enum_values: false,
            include_implicit_input_fields_and_enum_values: false,
        };
        let mut set = SchemaSet::new();

        set.touch_directive(&sdl_schema, "foo".intern(), &options);

        assert!(
            set.directives.contains_key(&"foo".intern()),
            "@foo should be collected"
        );
        assert!(
            set.directives.contains_key(&"bar".intern()),
            "@bar's definition should be pulled in because @foo's definition applies it"
        );
    }

    #[test]
    fn test_touch_field() {
        let sdl_schema = build_sdl_schema("type Query { name: String }");
        let options =
            UsedSchemaCollectionOptions::only_explicitly_used_without_directives_options();
        let mut set = SchemaSet::new();

        let query_type = sdl_schema.get_type("Query".intern()).unwrap();
        // First touch the output type to create the entry
        set.touch_output_type(&sdl_schema, &query_type, &options);

        // Now touch a specific field
        if let schema::Type::Object(obj_id) = query_type {
            let obj = sdl_schema.object(obj_id);
            let field_id = obj.fields[0];
            set.touch_field(&sdl_schema, &field_id, &options);
            if let SetType::Object(set_obj) = set.types.get(&"Query".intern()).unwrap() {
                assert!(
                    set_obj.fields.contains_key(&"name".intern()),
                    "Should have 'name' field after touch_field"
                );
            } else {
                panic!("Expected Object type");
            }
        } else {
            panic!("Query should be Object type");
        }
    }

    #[test]
    fn test_touch_enum_value() {
        let sdl_schema = build_sdl_schema("type Query { id: ID } enum Color { RED GREEN BLUE }");
        let options =
            UsedSchemaCollectionOptions::only_explicitly_used_without_directives_options();
        let mut set = SchemaSet::new();

        let color_type = sdl_schema.get_type("Color".intern()).unwrap();
        set.touch_output_type(&sdl_schema, &color_type, &options);

        if let schema::Type::Enum(enum_id) = color_type {
            set.touch_enum_value(&sdl_schema, &enum_id, "RED".intern(), &options);
            if let SetType::Enum(set_enum) = set.types.get(&"Color".intern()).unwrap() {
                assert!(
                    set_enum.values.contains_key(&"RED".intern()),
                    "Should have RED value after touch_enum_value"
                );
            } else {
                panic!("Expected Enum type");
            }
        } else {
            panic!("Color should be Enum type");
        }
    }
}
