/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

use std::sync::LazyLock;

use common::ArgumentName;
use common::DirectiveName;
use common::WithLocation;
use graphql_ir::ARGUMENT_DEFINITION;
use graphql_ir::Argument;
use graphql_ir::Directive;
use graphql_ir::FragmentDefinition;
use graphql_ir::FragmentDefinitionName;
use graphql_ir::ProvidedVariableMetadata;
use graphql_ir::UNUSED_LOCAL_VARIABLE_DEPRECATED;
use graphql_ir::Value;
use graphql_ir::Variable;
use graphql_ir::VariableDefinition;
use graphql_ir::VariableName;
use intern::Lookup;
use intern::string_key::Intern;
use intern::string_key::StringKey;
use regex::Regex;
use schema::SDLSchema;
use schema::Schema;
use schema::Type;

use crate::ClientComponentBoundaryMetadata;
use crate::ClientEdgeGeneratedQueryMetadataDirective;
use crate::ClientEdgeMetadataDirective;
use crate::ClientRscSeamMetadata;
use crate::DIRECTIVE_SPLIT_OPERATION;
use crate::FragmentAliasMetadata;
use crate::INTERNAL_METADATA_DIRECTIVE;
use crate::ModuleMetadata;
use crate::PrefetchablePaginationEdgesFragmentMetadata;
use crate::RefetchableDerivedFromMetadata;
use crate::RelayResolverMetadata;
use crate::RequiredMetadataDirective;
use crate::RscSeamMetadata;
use crate::ServerOperationHandoffMetadata;
use crate::ShadowReturnMarker;
use crate::catch_directive::CATCH_DIRECTIVE_NAME;
use crate::client_extensions::CLIENT_EXTENSION_DIRECTIVE_NAME;
use crate::connections::ConnectionMetadataDirective;
use crate::fragment_alias_directive::FRAGMENT_DANGEROUSLY_UNALIAS_DIRECTIVE_NAME;
use crate::generate_relay_resolvers_root_fragment_split_operation::IsResolverRootFragment;
use crate::handle_fields::HANDLE_FIELD_DIRECTIVE_NAME;
use crate::inline_data_fragment::InlineDirectiveMetadata;
use crate::raw_text::RAW_TEXT_DIRECTIVE_NAME;
use crate::refetchable_fragment::RefetchableMetadata;
use crate::required_directive::CHILDREN_CAN_BUBBLE_METADATA_KEY;
use crate::required_directive::REQUIRED_DIRECTIVE_NAME;

/// This function will return a new Vec[...] of directives,
/// where one will be missing. The one with `remove_directive_name` name
pub fn remove_directive(
    directives: &[Directive],
    remove_directive_name: DirectiveName,
) -> Vec<Directive> {
    let mut next_directives = Vec::with_capacity(directives.len() - 1);
    for directive in directives {
        if directive.name.item != remove_directive_name {
            next_directives.push(directive.clone());
        }
    }
    next_directives
}

/// Function will create a new Vec[...] of directives
/// when one of them will be replaced with the `replacement`. If the name of
/// `replacement` is matched with the item in the list
pub fn replace_directive(directives: &[Directive], replacement: Directive) -> Vec<Directive> {
    directives
        .iter()
        .map(|directive| {
            if directive.name.item == replacement.name.item {
                return replacement.to_owned();
            }
            directive.to_owned()
        })
        .collect()
}

/// The function that will return a variable name for an argument
/// if it uses a variable (and if the argument is available)
pub fn extract_variable_name(argument: Option<&Argument>) -> Option<StringKey> {
    match argument {
        Some(arg) => match &arg.value.item {
            Value::Variable(var) => Some(var.name.item.0),
            _ => None,
        },
        None => None,
    }
}

static CUSTOM_METADATA_DIRECTIVES: LazyLock<[DirectiveName; 27]> = LazyLock::new(|| {
    [
        *CATCH_DIRECTIVE_NAME,
        *CLIENT_EXTENSION_DIRECTIVE_NAME,
        ConnectionMetadataDirective::directive_name(),
        *HANDLE_FIELD_DIRECTIVE_NAME,
        ModuleMetadata::directive_name(),
        PrefetchablePaginationEdgesFragmentMetadata::directive_name(),
        *DIRECTIVE_SPLIT_OPERATION,
        RefetchableMetadata::directive_name(),
        RefetchableDerivedFromMetadata::directive_name(),
        *INTERNAL_METADATA_DIRECTIVE,
        *ARGUMENT_DEFINITION,
        *REQUIRED_DIRECTIVE_NAME,
        RequiredMetadataDirective::directive_name(),
        ClientEdgeMetadataDirective::directive_name(),
        ClientEdgeGeneratedQueryMetadataDirective::directive_name(),
        ClientComponentBoundaryMetadata::directive_name(),
        ClientRscSeamMetadata::directive_name(),
        RscSeamMetadata::directive_name(),
        *CHILDREN_CAN_BUBBLE_METADATA_KEY,
        RelayResolverMetadata::directive_name(),
        *UNUSED_LOCAL_VARIABLE_DEPRECATED,
        ProvidedVariableMetadata::directive_name(),
        FragmentAliasMetadata::directive_name(),
        *RAW_TEXT_DIRECTIVE_NAME,
        ShadowReturnMarker::directive_name(),
        ServerOperationHandoffMetadata::directive_name(),
        IsResolverRootFragment::directive_name(),
    ]
});

static DIRECTIVES_SKIPPED_IN_NODE_IDENTIFIER: LazyLock<[DirectiveName; 11]> = LazyLock::new(|| {
    [
        *CATCH_DIRECTIVE_NAME,
        *CLIENT_EXTENSION_DIRECTIVE_NAME,
        ConnectionMetadataDirective::directive_name(),
        *HANDLE_FIELD_DIRECTIVE_NAME,
        RefetchableMetadata::directive_name(),
        RefetchableDerivedFromMetadata::directive_name(),
        *INTERNAL_METADATA_DIRECTIVE,
        *ARGUMENT_DEFINITION,
        *REQUIRED_DIRECTIVE_NAME,
        *FRAGMENT_DANGEROUSLY_UNALIAS_DIRECTIVE_NAME,
        // The shadow-return marker is internal metadata on the shadowed server
        // field; it must not affect field identity so the generic spread-derived
        // `page { id __typename }` merges with the transplanted consumer copy.
        ShadowReturnMarker::directive_name(),
    ]
});

static RELAY_CUSTOM_INLINE_FRAGMENT_DIRECTIVES: LazyLock<[DirectiveName; 7]> =
    LazyLock::new(|| {
        [
            *CLIENT_EXTENSION_DIRECTIVE_NAME,
            ModuleMetadata::directive_name(),
            InlineDirectiveMetadata::directive_name(),
            ClientEdgeMetadataDirective::directive_name(),
            DirectiveName("defer".intern()),
            FragmentAliasMetadata::directive_name(),
            RelayResolverMetadata::directive_name(),
        ]
    });

static VALID_PROVIDED_VARIABLE_NAME: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r#"^[A-Za-z0-9_]*$"#).unwrap());

pub static INTERNAL_RELAY_VARIABLES_PREFIX: LazyLock<StringKey> =
    LazyLock::new(|| "__relay_internal".intern());

pub struct CustomMetadataDirectives;

impl CustomMetadataDirectives {
    pub fn is_custom_metadata_directive(name: DirectiveName) -> bool {
        CUSTOM_METADATA_DIRECTIVES.contains(&name)
    }

    pub fn should_skip_in_node_identifier(name: DirectiveName) -> bool {
        DIRECTIVES_SKIPPED_IN_NODE_IDENTIFIER.contains(&name)
    }

    pub fn is_handle_field_directive(name: DirectiveName) -> bool {
        name == *HANDLE_FIELD_DIRECTIVE_NAME
    }
}

pub fn is_relay_custom_inline_fragment_directive(directive: &Directive) -> bool {
    RELAY_CUSTOM_INLINE_FRAGMENT_DIRECTIVES.contains(&directive.name.item)
}

pub fn generate_abstract_type_refinement_key(schema: &SDLSchema, type_: Type) -> StringKey {
    format!("__is{}", schema.get_type_name(type_).lookup()).intern()
}

/// The variable definitions and arguments of an operation that spreads
/// `fragment` with its own variables, named by `variable_name`. Provided
/// variables stay provided, so they are neither declared nor passed.
pub fn pass_through_fragment_variables(
    fragment: &FragmentDefinition,
    variable_name: impl Fn(VariableName) -> VariableName,
) -> (Vec<VariableDefinition>, Vec<Argument>) {
    fragment
        .variable_definitions
        .iter()
        .filter(|definition| ProvidedVariableMetadata::find(&definition.directives).is_none())
        .map(|definition| {
            let name = WithLocation::new(
                definition.name.location,
                variable_name(definition.name.item),
            );
            let argument = Argument {
                name: WithLocation::new(
                    definition.name.location,
                    ArgumentName(definition.name.item.0),
                ),
                value: WithLocation::new(
                    definition.name.location,
                    Value::Variable(Variable {
                        name,
                        type_: definition.type_.clone(),
                    }),
                ),
            };
            (
                VariableDefinition {
                    name,
                    ..definition.clone()
                },
                argument,
            )
        })
        .unzip()
}

pub fn get_normalization_operation_name(name: StringKey) -> String {
    format!("{name}$normalization")
}

pub fn get_normalization_fragment_filename(fragment_name: FragmentDefinitionName) -> StringKey {
    format!(
        "{}.graphql",
        get_normalization_operation_name(fragment_name.0)
    )
    .intern()
}

pub fn format_provided_variable_name(module_name: StringKey) -> VariableName {
    let x = if VALID_PROVIDED_VARIABLE_NAME.is_match(module_name.lookup()) {
        format!(
            "{}__pv__{}",
            *INTERNAL_RELAY_VARIABLES_PREFIX,
            module_name.lookup()
        )
        .intern()
    } else {
        let transformed_name = module_name
            .lookup()
            .chars()
            .filter(|c| c.is_ascii_alphanumeric() || *c == '_')
            .collect::<String>();
        format!(
            "{}__pv__{}",
            *INTERNAL_RELAY_VARIABLES_PREFIX, transformed_name
        )
        .intern()
    };
    VariableName(x)
}
