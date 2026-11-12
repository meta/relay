/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::LazyLock;

use ::intern::Lookup;
use ::intern::intern;
use ::intern::string_key::Intern;
use ::intern::string_key::StringKey;
use common::ArgumentName;
use common::Diagnostic;
use common::DiagnosticsResult;
use common::DirectiveName;
use common::Location;
use common::NamedItem;
use common::SourceLocationKey;
use common::WithLocation;
use errors::par_try_map;
use errors::try3;
use schema::SDLSchema;
use schema::Schema;
use schema::Type;
use schema::TypeReference;
use schema::suggestion_list::GraphQLSuggestions;

use crate::VariableName;
use crate::associated_data_impl;
use crate::build::ValidationLevel;
use crate::build::build_constant_value;
use crate::build::build_directives;
use crate::build::build_type_annotation;
use crate::build::build_variable_definitions;
use crate::build_directive;
use crate::constants::ARGUMENT_DEFINITION;
use crate::errors::MachineMetadataKey;
use crate::errors::ValidationMessage;
use crate::errors::ValidationMessageWithData;
use crate::ir::ConstantValue;
use crate::ir::FragmentDefinition;
use crate::ir::FragmentDefinitionName;
use crate::ir::FragmentDefinitionNameMap;
use crate::ir::VariableDefinition;
use crate::ir::alias_arg_as;

static TYPE: LazyLock<StringKey> = LazyLock::new(|| "type".intern());
static DEFAULT_VALUE: LazyLock<StringKey> = LazyLock::new(|| "defaultValue".intern());
static PROVIDER: LazyLock<StringKey> = LazyLock::new(|| "provider".intern());
pub static UNUSED_LOCAL_VARIABLE_DEPRECATED: LazyLock<DirectiveName> =
    LazyLock::new(|| DirectiveName("unusedLocalVariable_DEPRECATED".intern()));
static DIRECTIVES: LazyLock<StringKey> = LazyLock::new(|| "directives".intern());

pub type FragmentSignatures = FragmentDefinitionNameMap<FragmentSignature>;

#[derive(Clone, Debug, PartialEq, Eq, Hash)]
pub struct ProvidedVariableMetadata {
    pub module_name: StringKey,
    pub original_variable_name: VariableName,
    fragment_source_location: SourceLocationKey,
}

impl ProvidedVariableMetadata {
    /// A provided variable the compiler declares itself, read from
    /// `module_name` by the document at `source_location`.
    pub fn new(
        module_name: StringKey,
        original_variable_name: VariableName,
        source_location: SourceLocationKey,
    ) -> Self {
        Self {
            module_name,
            original_variable_name,
            fragment_source_location: source_location,
        }
    }

    /// Returns true if the provider module's path is a bare identifier (i.e.
    /// doesn't start with './' nor '../' nor '/'), otherwise false.
    pub fn is_bare(&self) -> bool {
        let module_name = self.module_name.lookup();
        !(module_name.starts_with("./")
            || module_name.starts_with("../")
            || module_name.starts_with("/"))
    }

    /// Return a path to the provider module, based on the fragment location
    /// where this provider is used.
    pub fn module_path(&self) -> PathBuf {
        let mut fragment_path = PathBuf::from(self.fragment_source_location.path());
        fragment_path.pop();
        fragment_path.push(PathBuf::from(self.module_name.lookup()));

        fragment_path
    }
}

associated_data_impl!(ProvidedVariableMetadata);

/// Describes the public API of a fragment, excluding its selections.
/// When translating ASTs to IR, fragment spread arguments must be
/// checked against the corresponding fragment definition. However,
/// this process can't use the IR fragment definition, since that
/// would depend on having checked its body! Since recursive fragments
/// are allowed, we break the cycle by first computing signatures
/// and using these to type check fragment spreads in selections.
#[derive(Clone, Debug, Eq, PartialEq, Hash)]
pub struct FragmentSignature {
    pub name: WithLocation<FragmentDefinitionName>,
    pub variable_definitions: Vec<VariableDefinition>,
    pub type_condition: Type,
    pub directives: Vec<crate::Directive>,
}

impl FragmentSignature {
    // Get the alias of this fragment signature from the optional `@alias` directive.
    // If the `as` argument is not specified, the fragment name is used as the fallback.
    pub fn alias(&self) -> DiagnosticsResult<Option<WithLocation<StringKey>>> {
        if let Some(directive) = self.directives.named(DirectiveName(intern!("alias"))) {
            Ok(alias_arg_as(directive)?
                .or_else(|| Some(WithLocation::new(directive.name.location, self.name.item.0))))
        } else {
            Ok(None)
        }
    }
}

impl From<&FragmentDefinition> for FragmentSignature {
    fn from(fragment: &FragmentDefinition) -> Self {
        Self {
            name: fragment.name,
            variable_definitions: fragment.variable_definitions.clone(),
            type_condition: fragment.type_condition,
            directives: fragment.directives.clone(),
        }
    }
}

pub fn build_signatures(
    schema: &SDLSchema,
    definitions: &[graphql_syntax::ExecutableDefinition],
) -> DiagnosticsResult<FragmentSignatures> {
    let suggestions = GraphQLSuggestions::new(schema);
    let mut seen_signatures: FragmentDefinitionNameMap<FragmentSignature> =
        HashMap::with_capacity_and_hasher(definitions.len(), Default::default());
    let signatures = par_try_map(definitions, |definition| match definition {
        graphql_syntax::ExecutableDefinition::Fragment(fragment) => Ok(Some(
            build_fragment_signature(schema, fragment, &suggestions)?,
        )),
        graphql_syntax::ExecutableDefinition::Operation(_) => Ok(None),
    })?;
    let mut errors = Vec::new();
    for signature in signatures.into_iter().flatten() {
        let previous_signature = seen_signatures.get(&signature.name.item);
        if let Some(previous_signature) = previous_signature {
            errors.push(
                Diagnostic::error(
                    ValidationMessage::DuplicateDefinition(signature.name.item.0),
                    previous_signature.name.location,
                )
                .annotate("also defined here", signature.name.location),
            );
            continue;
        }
        seen_signatures.insert(signature.name.item, signature);
    }
    if errors.is_empty() {
        Ok(seen_signatures)
    } else {
        Err(errors)
    }
}

fn build_fragment_signature(
    schema: &SDLSchema,
    fragment: &graphql_syntax::FragmentDefinition,
    suggestions: &GraphQLSuggestions<'_>,
) -> DiagnosticsResult<FragmentSignature> {
    let type_name = fragment.type_condition.type_.value;
    let type_condition = match schema.get_type(type_name) {
        Some(type_condition) => match type_condition {
            Type::Interface(..) | Type::Object(..) | Type::Union(..) => Ok(type_condition),
            _ => Err(Diagnostic::error(
                ValidationMessage::ExpectedCompositeType(type_condition),
                fragment
                    .location
                    .with_span(fragment.type_condition.type_.span),
            )
            .into()),
        },
        None => Err(Diagnostic::error_with_data(
            ValidationMessageWithData::UnknownType {
                type_name,
                suggestions: suggestions.composite_type_suggestions(type_name),
            },
            fragment
                .location
                .with_span(fragment.type_condition.type_.span),
        )
        .metadata_for_machine(MachineMetadataKey::UnknownType, type_name.lookup())
        .into()),
    };
    let argument_definition_directives = fragment
        .directives
        .iter()
        .filter(|x| DirectiveName(x.name.value) == *ARGUMENT_DEFINITION)
        .collect::<Vec<_>>();
    if fragment.variable_definitions.is_some() && !argument_definition_directives.is_empty() {
        return Err(Diagnostic::error(
            ValidationMessage::VariableDefinitionsAndArgumentDirective,
            fragment
                .location
                .with_span(argument_definition_directives[0].span),
        )
        .annotate(
            "variables are previously defined here",
            fragment.location.with_span(
                fragment
                    .variable_definitions
                    .as_ref()
                    .map(|list| list.span)
                    .unwrap(),
            ),
        )
        .into());
    } else if argument_definition_directives.len() > 1 {
        return Err(Diagnostic::error(
            ValidationMessage::ExpectedOneArgumentDefinitionsDirective,
            fragment
                .location
                .with_span(argument_definition_directives[1].span),
        )
        .into());
    }
    let variable_definitions = fragment
        .variable_definitions
        .as_ref()
        .map(|variable_definitions| {
            build_variable_definitions(
                schema,
                &variable_definitions.items,
                fragment.location,
                graphql_syntax::DirectiveLocation::FragmentVariableDefinition,
            )
        })
        .or_else(|| {
            argument_definition_directives
                .first()
                .map(|x| build_fragment_variable_definitions(schema, fragment, x))
        })
        .unwrap_or_else(|| Ok(Default::default()));

    let directives = build_directives(
        schema,
        &fragment.directives,
        graphql_syntax::DirectiveLocation::FragmentDefinition,
        fragment.location,
    );

    let (type_condition, variable_definitions, directives) =
        try3(type_condition, variable_definitions, directives)?;

    Ok(FragmentSignature {
        name: WithLocation::from_span(
            fragment.location.source_location(),
            fragment.name.span,
            FragmentDefinitionName(fragment.name.value),
        ),
        type_condition,
        variable_definitions,
        directives,
    })
}

fn build_fragment_variable_definitions(
    schema: &SDLSchema,
    fragment: &graphql_syntax::FragmentDefinition,
    directive: &graphql_syntax::Directive,
) -> DiagnosticsResult<Vec<VariableDefinition>> {
    if let Some(arguments) = &directive.arguments {
        Ok(arguments
            .items
            .iter()
            .map(|variable_arg| {
                if let graphql_syntax::Value::Constant(graphql_syntax::ConstantValue::Object(
                    object,
                )) = &variable_arg.value
                {
                    let mut type_arg = None;
                    let mut default_arg = None;
                    let mut unused_local_variable_arg = None;
                    let mut provider_arg = None;
                    let mut directives_arg = None;
                    let mut extra_items = Vec::new();
                    for item in &object.items {
                        let name = item.name.value;
                        if name == *TYPE {
                            type_arg = Some(item);
                        } else if name == *DEFAULT_VALUE {
                            default_arg = Some(item);
                        } else if DirectiveName(name) == *UNUSED_LOCAL_VARIABLE_DEPRECATED {
                            unused_local_variable_arg = Some(item);
                        } else if name == *DIRECTIVES {
                            directives_arg = Some(item);
                        } else if name == *PROVIDER {
                            provider_arg = Some(item);
                        } else {
                            extra_items.push(item);
                        }
                    }
                    // Check that no extraneous keys were supplied
                    if !extra_items.is_empty() {
                        return Err(extra_items
                            .iter()
                            .map(|item| {
                                Diagnostic::error(
                                    ValidationMessage::InvalidArgumentDefinitionsKey(
                                        item.name.value,
                                    ),
                                    fragment.location.with_span(item.span),
                                )
                            })
                            .collect());
                    }

                    let variable_name = &variable_arg.name;
                    let mut directives = Vec::new();

                    // Convert variable type, validate that it's an input type
                    let type_ = get_argument_type(schema, fragment.location, type_arg, object)?;
                    if !type_.inner().is_input_type() {
                        return Err(Diagnostic::error(
                            ValidationMessage::ExpectedFragmentArgumentToHaveInputType(
                                schema.get_type_name(type_.inner()),
                            ),
                            fragment.location.with_span(variable_arg.value.span()),
                        )
                        .into());
                    }

                    if let Some(unused_local_variable_arg) = unused_local_variable_arg {
                        if !matches!(
                            unused_local_variable_arg,
                            graphql_syntax::ConstantArgument {
                                value: graphql_syntax::ConstantValue::Boolean(
                                    graphql_syntax::BooleanNode { value: true, .. }
                                ),
                                ..
                            }
                        ) {
                            return Err(vec![Diagnostic::error(
                                ValidationMessage::InvalidUnusedFragmentVariableSuppressionArg,
                                fragment
                                    .location
                                    .with_span(unused_local_variable_arg.value.span()),
                            )]);
                        }
                        directives.push(crate::Directive {
                            name: WithLocation::new(
                                fragment.location.with_span(unused_local_variable_arg.span),
                                *UNUSED_LOCAL_VARIABLE_DEPRECATED,
                            ),
                            arguments: Vec::new(),
                            data: None,
                            location: fragment.location.with_span(unused_local_variable_arg.span)
                        });
                    }

                    if let Some(provider_arg) = provider_arg {
                        let provider_module_name = provider_arg.value.get_string_literal().ok_or_else(|| {
                            vec![Diagnostic::error(
                                ValidationMessage::LiteralStringArgumentExpectedForDirective{arg_name: ArgumentName(*PROVIDER), directive_name: *ARGUMENT_DEFINITION },
                                fragment
                                    .location
                                    .with_span(provider_arg.value.span()),
                            )]
                        })?;
                        if let Some(default_arg_) = default_arg {
                            return Err(vec![Diagnostic::error(
                                ValidationMessage::ProvidedVariableIncompatibleWithDefaultValue{argument_name: variable_name.value},
                                fragment
                                    .location
                                    .with_span(provider_arg.span),
                            ).annotate("Default value declared here",
                            fragment
                            .location
                            .with_span(default_arg_.span))]);
                        }
                        directives.push(crate::Directive {
                            name: WithLocation::new(
                                fragment.location.with_span(provider_arg.span),
                                ProvidedVariableMetadata::directive_name(),
                            ),
                            arguments: Vec::new(),
                            data: Some(Box::new(ProvidedVariableMetadata {
                                module_name: provider_module_name,
                                original_variable_name: VariableName(variable_name.value),
                                fragment_source_location: fragment.location.source_location(),
                            })),
                            location: fragment.location.with_span(provider_arg.span),
                        });
                    }

                    if let Some(directives_arg) = directives_arg {
                        if let graphql_syntax::ConstantValue::List(items) = &directives_arg.value {
                            for item in &items.items {
                                if let graphql_syntax::ConstantValue::String(directive_string) = item {
                                    let ast_directive = graphql_syntax::parse_directive(
                                        directive_string.value.lookup(),
                                        fragment.location.source_location(),
                                        // Add 1 to account for the leading quote
                                        directive_string.token.span.start + 1
                                    )?;
                                    let directive = build_directive(
                                        schema,
                                        &ast_directive,
                                        graphql_syntax::DirectiveLocation::FragmentVariableDefinition,
                                        // We currently don't have the ability to pass offset locations
                                        // to the parser call, so we first use a generated location and
                                        // later override it with an approximation.
                                        Location::generated(),
                                    )
                                    .map_err(|mut diagnostics| {
                                        for diagnostic in &mut diagnostics {
                                            diagnostic.override_location(fragment.location.with_span(directive_string.token.span));
                                        }
                                        diagnostics
                                    })?;
                                    directives.push(directive);
                                } else {
                                    return Err(vec![Diagnostic::error(
                                        ValidationMessage::ArgumentDefinitionsDirectivesNotStringListLiteral,
                                        fragment.location.with_span(item.span()),
                                    )]);
                                }
                            }
                        } else {
                            return Err(vec![Diagnostic::error(
                                ValidationMessage::ArgumentDefinitionsDirectivesNotStringListLiteral,
                                fragment.location.with_span(directives_arg.value.span()),
                            )]);
                        }
                    }

                    let default_value =
                        get_default_value(schema, fragment.location, default_arg, &type_)?;

                    Ok(VariableDefinition {
                        name: variable_name
                        .name_with_location(fragment.location.source_location()).map(VariableName),
                        type_,
                        directives,
                        default_value,
                    })
                } else {
                    Err(Diagnostic::error(
                        ValidationMessage::ExpectedArgumentDefinitionToBeObject,
                        fragment.location.with_span(variable_arg.value.span()),
                    )
                    .into())
                }
            })
            .collect::<DiagnosticsResult<Vec<VariableDefinition>>>()?)
    } else {
        Ok(Default::default())
    }
}

fn get_argument_type(
    schema: &SDLSchema,
    location: Location,
    type_arg: Option<&graphql_syntax::ConstantArgument>,
    object: &graphql_syntax::List<graphql_syntax::ConstantArgument>,
) -> DiagnosticsResult<TypeReference<Type>> {
    let type_name_and_offset = match type_arg {
        Some(graphql_syntax::ConstantArgument {
            value: graphql_syntax::ConstantValue::String(type_name_node),
            ..
        }) => Some((
            type_name_node.value,
            // Add 1 to account for the leading quote
            type_name_node.token.span.start + 1,
        )),
        Some(graphql_syntax::ConstantArgument {
            value: graphql_syntax::ConstantValue::Enum(type_name_node),
            ..
        }) => Some((type_name_node.value, type_name_node.token.span.start)),
        _ => None,
    };
    if let Some((type_name, offset)) = type_name_and_offset {
        let type_ast =
            graphql_syntax::parse_type(type_name.lookup(), location.source_location(), offset)?;
        let type_ = build_type_annotation(schema, &type_ast, location)?;
        Ok(type_)
    } else {
        Err(Diagnostic::error(
            ValidationMessage::ExpectedArgumentDefinitionLiteralType,
            location.with_span(type_arg.map_or(object.span, |x| x.span)),
        )
        .into())
    }
}

fn get_default_value(
    schema: &SDLSchema,
    location: Location,
    default_arg: Option<&graphql_syntax::ConstantArgument>,
    type_: &TypeReference<Type>,
) -> DiagnosticsResult<Option<WithLocation<ConstantValue>>> {
    default_arg
        .map(|x| {
            let constant_value_span = x.value.span();
            build_constant_value(schema, &x.value, type_, location, ValidationLevel::Strict).map(
                |constant_value| {
                    WithLocation::from_span(
                        location.source_location(),
                        constant_value_span,
                        constant_value,
                    )
                },
            )
        })
        .transpose()
}
