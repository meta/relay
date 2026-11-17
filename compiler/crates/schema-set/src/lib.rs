/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

mod build_in_memory_schema;
mod build_schema_document;
mod builtin_scalars;
pub mod directive_policies;
pub mod find_subset_violations;
mod from_schema;
mod ir_collector;
mod macros;
mod merge_sdl_document;
mod partition_base_extensions;
pub mod print_schema_set;
mod schema_set;
mod schema_set_collection_options;
mod schema_set_collector;
mod set_exclude;
mod set_merges;
mod set_remove_defined_references;
mod set_type_reference;
pub mod transform;

use std::sync::LazyLock;

use common::ArgumentName;
use common::DirectiveName;
use intern::string_key::Intern;
use intern::string_key::StringKey;
use schema_coordinates::SchemaCoordinate;

pub use crate::build_in_memory_schema::build_in_memory_schema;
pub use crate::build_in_memory_schema::build_sdl_schema;
pub use crate::build_schema_document::ToSDLDefinition;
pub use crate::build_schema_document::ToTypeSystemDefinition;
pub use crate::builtin_scalars::add_built_in_scalars;
pub use crate::builtin_scalars::remove_built_in_scalars;
pub use crate::directive_policies::DirectivePolicies;
pub use crate::directive_policies::DirectivePolicy;
pub use crate::directive_policies::DirectivePolicyError;
pub use crate::directive_policies::DivergentArgs;
pub use crate::from_schema::SchemaDefault;
pub use crate::from_schema::SchemaInsertArgument;
pub use crate::from_schema::SchemaInsertDirectiveValue;
pub use crate::from_schema::SchemaInsertField;
pub use crate::from_schema::SchemaInsertInterface;
pub use crate::from_schema::SetEmptyClone;
pub use crate::from_schema::convert_schema_output_type_reference;
pub use crate::ir_collector::UsedSchemaIRCollector;
pub use crate::merge_sdl_document::ToSetDefinition;
pub use crate::merge_sdl_document::set_type_from_definition;
pub use crate::partition_base_extensions::partition_schema_set_base_and_extensions;
pub use crate::schema_set::CanHaveDirectives;
pub use crate::schema_set::FieldName;
pub use crate::schema_set::HasCoordinate;
pub use crate::schema_set::HasDefinitionItem;
pub use crate::schema_set::HasDescription;
pub use crate::schema_set::SchemaDefinitionItem;
pub use crate::schema_set::SchemaSet;
pub use crate::schema_set::SetArgument;
pub use crate::schema_set::SetArgumentValue;
pub use crate::schema_set::SetDirective;
pub use crate::schema_set::SetDirectiveValue;
pub use crate::schema_set::SetEnum;
pub use crate::schema_set::SetEnumValue;
pub use crate::schema_set::SetField;
pub use crate::schema_set::SetInputObject;
pub use crate::schema_set::SetInterface;
pub use crate::schema_set::SetMemberType;
pub use crate::schema_set::SetObject;
pub use crate::schema_set::SetScalar;
pub use crate::schema_set::SetType;
pub use crate::schema_set::SetUnion;
pub use crate::schema_set::StringKeyNamed;
pub use crate::schema_set_collection_options::UsedSchemaCollectionOptions;
pub use crate::schema_set_collector::overlapping_types;
pub use crate::set_type_reference::OutputNonNull;
pub use crate::set_type_reference::OutputTypeReference;
pub use crate::transform::Transformer;

static DIVERGENCE: LazyLock<DirectiveName> = LazyLock::new(|| DirectiveName("divergence".intern()));
static SEMANTIC_NON_NULL: LazyLock<DirectiveName> =
    LazyLock::new(|| DirectiveName("semanticNonNull".intern()));
static SEMANTIC_NON_NULL_LEVELS_ARG: LazyLock<ArgumentName> =
    LazyLock::new(|| ArgumentName("levels".intern()));

// GraphQL Spec built-in directives (https://spec.graphql.org/draft/#sec-Type-System.Directives.Built-in-Directives)
static DEPRECATED: LazyLock<DirectiveName> = LazyLock::new(|| DirectiveName("deprecated".intern()));
static SPECIFIED_BY: LazyLock<DirectiveName> =
    LazyLock::new(|| DirectiveName("specifiedBy".intern()));
static ONE_OF: LazyLock<DirectiveName> = LazyLock::new(|| DirectiveName("oneOf".intern()));

fn is_graphql_builtin_directive(name: DirectiveName) -> bool {
    name == *DEPRECATED || name == *SPECIFIED_BY || name == *ONE_OF
}

fn build_child_coordinate(
    parent_coordinate: Option<&SchemaCoordinate>,
    child_name: StringKey,
) -> Option<SchemaCoordinate> {
    parent_coordinate.and_then(|parent| match parent {
        SchemaCoordinate::Type { name } => Some(SchemaCoordinate::Member {
            parent_name: *name,
            member_name: child_name,
        }),
        SchemaCoordinate::Directive { name } => Some(SchemaCoordinate::DirectiveArgument {
            directive_name: *name,
            argument_name: child_name,
        }),
        SchemaCoordinate::Member {
            parent_name,
            member_name,
        } => Some(SchemaCoordinate::Argument {
            parent_name: *parent_name,
            member_name: *member_name,
            argument_name: child_name,
        }),

        // Arguments have no child coordinates
        SchemaCoordinate::DirectiveArgument { .. } => None,
        SchemaCoordinate::Argument { .. } => None,
    })
}
