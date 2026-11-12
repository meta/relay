/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

use common::NamedItem;
use docblock_shared::FRAGMENT_KEY_ARGUMENT_NAME;
use docblock_shared::GENERATED_FRAGMENT_ARGUMENT_NAME;
use docblock_shared::RELAY_RESOLVER_DIRECTIVE_NAME;
use docblock_shared::RETURN_FRAGMENT_ARGUMENT_NAME;
use graphql_ir::FragmentDefinitionName;
use schema::Field;
use schema::SDLSchema;
use schema::Schema;
use schema::Type;

/// If the field is a resolver, return its user defined fragment name. Does not
/// return generated fragment names.
pub fn get_resolver_fragment_dependency_name(field: &Field) -> Option<FragmentDefinitionName> {
    if !field.is_extension {
        return None;
    }

    field
        .directives
        .named(*RELAY_RESOLVER_DIRECTIVE_NAME)
        .filter(|resolver_directive| {
            let generated = resolver_directive
                .arguments
                .named(*GENERATED_FRAGMENT_ARGUMENT_NAME)
                .and_then(|arg| arg.value.get_bool_literal())
                .unwrap_or(false);
            !generated
        })
        .and_then(|resolver_directive| {
            resolver_directive
                .arguments
                .named(*FRAGMENT_KEY_ARGUMENT_NAME)
        })
        .and_then(|arg| arg.value.get_string_literal().map(FragmentDefinitionName))
}

/// If the field is a shadow resolver (a resolver that declares a
/// `@returnFragment`), return the name of that return
/// fragment. This is the placeholder spread (`...Bar`) that the product authors
/// inside the resolver's `@rootFragment` to mark the shadowed server field.
pub fn get_resolver_return_fragment_name(field: &Field) -> Option<FragmentDefinitionName> {
    if !field.is_extension {
        return None;
    }

    field
        .directives
        .named(*RELAY_RESOLVER_DIRECTIVE_NAME)
        .and_then(|resolver_directive| {
            resolver_directive
                .arguments
                .named(*RETURN_FRAGMENT_ARGUMENT_NAME)
        })
        .and_then(|arg| arg.value.get_string_literal().map(FragmentDefinitionName))
}

/// If the field is a resolver, return its user defined fragment names. Does not
/// return generated fragment names. For abstract types, returns all fragment names
/// from concrete implementations.
pub fn get_all_resolver_fragment_dependency_names(
    field: &Field,
    schema: &SDLSchema,
) -> Vec<FragmentDefinitionName> {
    if !field.is_extension {
        return vec![];
    }

    let name = field
        .directives
        .named(*RELAY_RESOLVER_DIRECTIVE_NAME)
        .filter(|resolver_directive| {
            let generated = resolver_directive
                .arguments
                .named(*GENERATED_FRAGMENT_ARGUMENT_NAME)
                .and_then(|arg| arg.value.get_bool_literal())
                .unwrap_or(false);
            !generated
        })
        .and_then(|resolver_directive| {
            resolver_directive
                .arguments
                .named(*FRAGMENT_KEY_ARGUMENT_NAME)
        })
        .and_then(|arg| arg.value.get_string_literal().map(FragmentDefinitionName));

    if let Some(name) = name {
        return vec![name];
    }

    let mut fragment_names = Vec::new();
    // For a resolver field on an abstract type, we currently need to include rootFragments for all implementations,
    // because compiling resolvers don't have incremental mode
    if let Some(Type::Interface(interface_type)) = field.parent_type {
        let interface = schema.interface(interface_type);
        let implementing_objects = interface.recursively_implementing_objects(schema);

        // Collect all fragment names from concrete implementations
        for object_id in implementing_objects.iter() {
            // An implementor without the field has no resolver to depend on: a
            // client type implementing a server interface may leave out the
            // fields no document reads on its objects, and a server type can
            // lack one through a schema validation exemption.
            let Some(concrete_field_id) =
                schema.named_field(Type::Object(*object_id), field.name.item)
            else {
                continue;
            };
            let concrete_field = schema.field(concrete_field_id);

            if let Some(fragment_name) = concrete_field
                .directives
                .named(*RELAY_RESOLVER_DIRECTIVE_NAME)
                .filter(|resolver_directive| {
                    let generated = resolver_directive
                        .arguments
                        .named(*GENERATED_FRAGMENT_ARGUMENT_NAME)
                        .and_then(|arg| arg.value.get_bool_literal())
                        .unwrap_or(false);
                    !generated
                })
                .and_then(|resolver_directive| {
                    resolver_directive
                        .arguments
                        .named(*FRAGMENT_KEY_ARGUMENT_NAME)
                })
                .and_then(|arg| arg.value.get_string_literal().map(FragmentDefinitionName))
            {
                fragment_names.push(fragment_name);
            }
        }
    }
    fragment_names
}
