/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

use std::fmt::Display;

use common::ArgumentName;
use common::DiagnosticDisplay;
use common::DirectiveName;
use common::ScalarName;
use common::WithDiagnosticData;
use graphql_syntax::OperationKind;
use intern::Lookup;
use intern::string_key::StringKey;
use schema::Type;
use schema::TypeReference;
use schema::suggestion_list::did_you_mean;
use serde::Deserialize;
use thiserror::Error;

use crate::VariableName;
use crate::ir::FragmentDefinitionName;

#[derive(
    Debug,
    Deserialize,
    Eq,
    Hash,
    Ord,
    PartialEq,
    PartialOrd,
    strum::AsRefStr,
    strum::Display,
    strum::EnumString
)]
pub enum MachineMetadataKey {
    UnknownType,
    UnknownField,
    ParentType,
}

struct ErrorLink(&'static str);

impl Display for ErrorLink {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        writeln!(f)?;
        write!(f, "See https://relay.dev/docs/error-reference/{}/", self.0)
    }
}

/// Fixed set of validation errors with custom display messages
#[derive(
    Clone,
    Debug,
    Error,
    Eq,
    PartialEq,
    Ord,
    PartialOrd,
    Hash,
    serde::Serialize
)]
#[serde(tag = "type", content = "args")]
pub enum ValidationMessage {
    #[error("Duplicate definitions for '{0}'")]
    DuplicateDefinition(StringKey),

    #[error("Expected an object, interface, or union, found '{0:?}'")]
    ExpectedCompositeType(Type),

    #[error("Expected type '{0:?}")]
    ExpectedType(TypeReference<Type>),

    #[error("Expected no selections on scalar field `{field_name}` of type `{type_name}`")]
    InvalidSelectionsOnScalarField {
        field_name: StringKey,
        type_name: StringKey,
    },

    #[error("Unknown directive '{0}'")]
    UnknownDirective(DirectiveName),

    #[error(
        "Invalid use of @uncheckedArguments_DEPRECATED: all arguments are defined and of correct type, use @arguments instead."
    )]
    UnnecessaryUncheckedArgumentsDirective,

    #[error("Expected operation to have a name (e.g. 'query <Name>')")]
    ExpectedOperationName,

    #[error("The schema does not support '{0}' operations")]
    UnsupportedOperation(OperationKind),

    #[error("Nested lists ('[[T]]' etc) are not supported")]
    UnsupportedNestListType,

    #[error("Expected a value of type '{0}'")]
    ExpectedValueMatchingType(StringKey),

    #[error(
        "Expected value of type '{0}' to be a valid enum value, got string. Consider removing quotes."
    )]
    ExpectedEnumValueGotString(StringKey),

    #[error("Duplicate values found for field '{0}'")]
    DuplicateInputField(StringKey),

    #[error("Missing required fields '{0:?}' of type '{1}'")] // TODO: print joined
    MissingRequiredFields(Vec<StringKey>, StringKey),

    #[error("Unsupported (user-defined) scalar type '{0}'")]
    UnsupportedCustomScalarType(StringKey),

    #[error("Expected at-most one '@arguments' directive per fragment spread")]
    ExpectedOneArgumentsDirective,

    #[error("Expected at-most one '@argumentDefinitions' directive per fragment spread")]
    ExpectedOneArgumentDefinitionsDirective,

    #[error(
        "Cannot combine fragment variable definitions syntax with the '@argumentDefinitions' directive"
    )]
    VariableDefinitionsAndArgumentDirective,

    #[error("Cannot combine fragment arguments syntax with the '@arguments' directive")]
    FragmentArgumentsAndArgumentDirective,

    #[error("Unexpected fragment argument. Fragment argument syntax is not enabled.")]
    OutsidePassedArgumentsMode,

    #[error(
        "Expected `@argumentDefinitions` value to have a `type` field with a literal string value (e.g. `type: \"Int!\"`)"
    )]
    ExpectedArgumentDefinitionLiteralType,

    #[error(
        "Expected `@argumentDefinitions` value to be an object with `type` and (optionally) `defaultValue` properties"
    )]
    ExpectedArgumentDefinitionToBeObject,

    #[error("Expected '@argumentDefinitions' directive to be used on fragment definitions only.")]
    ExpectedArgumentDefinitionsDirectiveOnFragmentDefinition,

    #[error(
        "Expected the `directives` argument to `@argumentDefinition` to be a list of literal strings in the form `directives: [\"@example\"]`."
    )]
    ArgumentDefinitionsDirectivesNotStringListLiteral,

    #[error("Non-nullable variable '{variable_name}' has a default value.")]
    NonNullableVariableHasDefaultValue { variable_name: VariableName },

    #[error("Variable of type '{defined_type}' cannot be used where '{used_type}' is expected.")]
    InvalidVariableUsage {
        defined_type: String,
        used_type: String,
    },

    #[error(
        "Variable was previously used as type '{prev_type}' but later used where type '{next_type}' is expected."
    )]
    IncompatibleVariableUsage {
        prev_type: String,
        next_type: String,
    },

    #[error("Expected variable `${0}` to be defined on the operation")]
    ExpectedOperationVariableToBeDefinedOnUnnamedQuery(VariableName),

    #[error("Expected variable `${0}` to be defined on the operation '{1}'")]
    ExpectedOperationVariableToBeDefined(VariableName, StringKey),

    #[error(
        "Expected argument definition to have an input type (scalar, enum, or input object), found type '{0}'"
    )]
    ExpectedFragmentArgumentToHaveInputType(StringKey),

    #[error(
        "Expected variable definition to have an input type (scalar, enum, or input object), found type '{0}'"
    )]
    ExpectedVariablesToHaveInputType(StringKey),

    #[error(
        "Invalid type '{type_condition}' in inline fragment, this type can never occur for parent type '{parent_type}'"
    )]
    InvalidInlineFragmentTypeCondition {
        parent_type: StringKey,
        type_condition: StringKey,
    },

    #[error(
        "Invalid fragment spread '{fragment_name}', the type of this fragment ('{type_condition}') can never occur for parent type '{parent_type}'"
    )]
    InvalidFragmentSpreadType {
        fragment_name: FragmentDefinitionName,
        parent_type: StringKey,
        type_condition: StringKey,
    },

    #[error(
        "Directive '{directive_name}' not supported in this location. Supported location(s): {valid_locations}"
    )]
    InvalidDirectiveUsageUnsupportedLocation {
        directive_name: DirectiveName,
        valid_locations: String,
    },

    #[error(
        "Invalid value passed to `@argumentDefinitions`, supported options include `type` and `defaultValue`, got `{0}`"
    )]
    InvalidArgumentDefinitionsKey(StringKey),

    #[error("Unexpected arguments on `__typename` field")]
    InvalidArgumentsOnTypenameField,

    #[error("Unexpected arguments on '__token' field")]
    InvalidArgumentsOnFetchTokenField,

    #[error(
        "Invalid type `{id_type_string}` of field `{id_field_name}` on parent type `{parent_type_name}`. Fields named `{id_field_name}` can only have `ID` or `String`-like types (e.g. custom scalars or enums)."
    )]
    InvalidIdFieldType {
        parent_type_name: StringKey,
        id_field_name: StringKey,
        id_type_string: String,
    },

    #[error(
        "Disallowed type `{id_type_string}` of field `{id_field_name}` on parent type `{parent_type_name}` cannot be used by Relay to identify entities. For a detailed explanation, check out https://relay.dev/docs/debugging/disallowed-id-types-error"
    )]
    DisallowNonNodeIdFieldType {
        parent_type_name: StringKey,
        id_field_name: StringKey,
        id_type_string: String,
    },

    #[error("Relay does not allow aliasing fields to `{0}`.")]
    DisallowReservedAliasError(StringKey),

    #[error("Relay does not allow `__typename` field on Query, Mutation or Subscription.")]
    DisallowTypenameOnRoot,

    #[error(
        "Unexpected directive: '{0}'. This directive can only be used on fields/fragments that are fetched from the server schema, but it is used inside a client-only selection."
    )]
    InvalidServerOnlyDirectiveInClientFields(DirectiveName),

    #[error(
        "@{connection_directive_name} used on invalid field '{connection_field_name}'. Expected the return type to be a non-plural interface or object, got '{connection_type_string}'."
    )]
    InvalidConnectionFieldType {
        connection_directive_name: DirectiveName,
        connection_field_name: StringKey,
        connection_type_string: String,
    },

    #[error(
        "Expected field '{connection_field_name}' to be passed a '{first_arg}' or '{last_arg}' argument."
    )]
    ExpectedConnectionToHaveCountArgs {
        connection_field_name: StringKey,
        first_arg: ArgumentName,
        last_arg: ArgumentName,
    },

    #[error(
        "Expected '{connection_field_name}' to be passed a '{edges_selection_name}' selection."
    )]
    ExpectedConnectionToHaveEdgesSelection {
        connection_field_name: StringKey,
        edges_selection_name: StringKey,
    },

    #[error(
        "@{connection_directive_name} used on invalid field '{connection_field_name}'. Expected the field type '{connection_type_name}' to expose a '{edges_selection_name}' field that returns a list of objects."
    )]
    ExpectedConnectionToExposeValidEdgesField {
        connection_directive_name: DirectiveName,
        connection_field_name: StringKey,
        connection_type_name: StringKey,
        edges_selection_name: StringKey,
    },

    #[error(
        "@{connection_directive_name} used on invalid field '{connection_field_name}'. Expected the field type '{connection_type_name}' to expose a '{edges_selection_name} {{ {node_selection_name} }}' field that returns an object, interface or union."
    )]
    ExpectedConnectionToExposeValidNodeField {
        connection_directive_name: DirectiveName,
        connection_field_name: StringKey,
        connection_type_name: StringKey,
        edges_selection_name: StringKey,
        node_selection_name: StringKey,
    },

    #[error(
        "@{connection_directive_name} used on invalid field '{connection_field_name}'. Expected the field type '{connection_type_name}' to expose a '{edges_selection_name} {{ {cursor_selection_name} }}' field that returns a scalar."
    )]
    ExpectedConnectionToExposeValidCursorField {
        connection_directive_name: DirectiveName,
        connection_field_name: StringKey,
        connection_type_name: StringKey,
        cursor_selection_name: StringKey,
        edges_selection_name: StringKey,
    },

    #[error(
        "@{connection_directive_name} used on invalid field '{connection_field_name}'. Expected the field type '{connection_type_name}' to expose a '{page_info_selection_name}' field that returns an object."
    )]
    ExpectedConnectionToExposeValidPageInfoField {
        connection_directive_name: DirectiveName,
        connection_field_name: StringKey,
        connection_type_name: StringKey,
        page_info_selection_name: StringKey,
    },

    #[error(
        "@{connection_directive_name} used on invalid field '{connection_field_name}'. Expected the field type '{connection_type_name}' to expose a '{page_info_selection_name} {{ {page_info_sub_field_name} }}' field that returns a scalar."
    )]
    ExpectedConnectionToExposeValidPageInfoSubField {
        connection_directive_name: DirectiveName,
        connection_field_name: StringKey,
        connection_type_name: StringKey,
        page_info_selection_name: StringKey,
        page_info_sub_field_name: StringKey,
    },

    #[error(
        "Expected the {handler_arg_name} argument to @{connection_directive_name} to be a string literal for field '{connection_field_name}'."
    )]
    InvalidConnectionHandlerArg {
        connection_directive_name: DirectiveName,
        connection_field_name: StringKey,
        handler_arg_name: ArgumentName,
    },

    #[error(
        "Expected the {key_arg_name} argument to @{connection_directive_name} to be a string literal for field '{connection_field_name}'."
    )]
    InvalidConnectionKeyArg {
        connection_directive_name: DirectiveName,
        connection_field_name: StringKey,
        key_arg_name: ArgumentName,
    },

    #[error(
        "Expected the {dynamic_key_arg_name} argument to @{connection_directive_name} to be a variable for field '{connection_field_name}'."
    )]
    InvalidConnectionDynamicKeyArg {
        connection_directive_name: DirectiveName,
        connection_field_name: StringKey,
        dynamic_key_arg_name: ArgumentName,
    },

    #[error(
        "Expected the {key_arg_name} argument to @{connection_directive_name} to be of form '<SomeName>_{postfix}', got '{key_arg_value}'. For a detailed explanation, check out https://relay.dev/docs/tutorial/connections-pagination/"
    )]
    InvalidConnectionKeyArgPostfix {
        connection_directive_name: DirectiveName,
        connection_field_name: StringKey,
        key_arg_name: ArgumentName,
        key_arg_value: StringKey,
        postfix: String,
    },

    #[error(
        "Expected the {filters_arg_name} argument to @{connection_directive_name} to be a list of string literals for field '{connection_field_name}'."
    )]
    InvalidConnectionFiltersArg {
        connection_directive_name: DirectiveName,
        connection_field_name: StringKey,
        filters_arg_name: ArgumentName,
    },

    #[error(
        "Expected the `{filters_arg_name}` argument to `@{connection_directive_name}` to be a list of argument names to the connection field to use to identify the connection, got `{invalid_name}`. Not specifying `filters` is often recommended and will use all fields."
    )]
    InvalidConnectionFiltersArgNotAnArgument {
        connection_directive_name: DirectiveName,
        connection_field_name: StringKey,
        filters_arg_name: ArgumentName,
        invalid_name: StringKey,
    },

    #[error("@stream_connection does not support aliasing the '{field_name}' field.")]
    UnsupportedAliasingInStreamConnection { field_name: StringKey },

    #[error("Expected the `{0}` argument to @relay to be a boolean literal if specified.")]
    InvalidRelayDirectiveArg(ArgumentName),

    #[error("Cannot use @relay(mask: false) on fragment spreads for fragments with directives.")]
    InvalidUnmaskOnFragmentWithDirectives,

    #[error(
        "Cannot use @relay(mask: false) on fragment spreads for fragments with @argumentDefinitions."
    )]
    InvalidUnmaskOnFragmentWithArguments,

    #[error("Cannot combine global and local variables when applying @relay(mask: false")]
    InvalidUnmaskOnLocalAndGloablVariablesWithSameName,

    #[error(
        "Cannot combine variables with incompatible types {prev_arg_type} and {next_arg_type} when applying @relay(mask: false"
    )]
    InvalidUnmaskOnVariablesOfIncompatibleTypesWithSameName {
        prev_arg_type: String,
        next_arg_type: String,
    },

    #[error(
        "Expected the '{arg_name}' value to @{directive_name} to be a string literal if provided."
    )]
    LiteralStringArgumentExpectedForDirective {
        arg_name: ArgumentName,
        directive_name: DirectiveName,
    },

    #[error("Variable `${variable_name}` is never used in operation `{operation_name}`")]
    UnusedVariable {
        variable_name: VariableName,
        operation_name: StringKey,
    },

    #[error(
        "Variable `${variable_name}` is never used in fragment `{fragment_name}`. `@argumentDefinitions` defines local variables, global variables are implicitly available."
    )]
    UnusedFragmentVariable {
        variable_name: VariableName,
        fragment_name: FragmentDefinitionName,
    },

    #[error(
        "Variable `${variable_name}` of fragment `{fragment_name}` is marked as unused using `unusedLocalVariable_DEPRECATED: true`, but is actually used. `unusedLocalVariable_DEPRECATED: true` should be removed."
    )]
    UselessUnusedFragmentVariableAnnotation {
        variable_name: VariableName,
        fragment_name: FragmentDefinitionName,
    },

    #[error(
        "`unusedLocalVariable_DEPRECATED` can only be set to a constant `true` value. Remove the `unusedLocalVariable_DEPRECATED` or update the value."
    )]
    InvalidUnusedFragmentVariableSuppressionArg,

    #[error(
        "Invalid usage of '@DEPRECATED__relay_ignore_unused_variables_error'. No unused variables found in the query '{operation_name}'."
    )]
    UnusedIgnoreUnusedVariablesDirective { operation_name: StringKey },

    #[error("Operation '{operation_name}' references undefined variable{variables_string}.")]
    GlobalVariables {
        operation_name: StringKey,
        variables_string: String,
    },

    #[error("Subscription '{subscription_name}' must have a single selection")]
    GenerateSubscriptionNameSingleSelectionItem { subscription_name: StringKey },

    #[error("The directive `@{name}` can only be used once at this location.")]
    RepeatedNonRepeatableDirective { name: DirectiveName },

    #[error("Module-provided variable ('{argument_name}') may not declare a default value")]
    ProvidedVariableIncompatibleWithDefaultValue { argument_name: StringKey },

    #[error("The field `{parent_name}.{field_name}` is deprecated.{}",
        match deprecation_reason {
            Some(reason) => format!(" Deprecation reason: \"{reason}\""),
            None => "".to_string()
        }
    )]
    DeprecatedField {
        parent_name: StringKey,
        field_name: StringKey,
        deprecation_reason: Option<StringKey>,
    },

    #[error("The argument `{argument_name}` of the field `{parent_name}.{field_name}` is deprecated.{}",
    match deprecation_reason {
        Some(reason) => format!(" Deprecation reason: \"{reason}\""),
        None => "".to_string()
    })]
    DeprecatedFieldArgument {
        argument_name: ArgumentName,
        parent_name: StringKey,
        field_name: StringKey,
        deprecation_reason: Option<StringKey>,
    },

    #[error("The argument `{argument_name}` of the directive `@{directive_name}` is deprecated.{}",
    match deprecation_reason {
        Some(reason) => format!(" Deprecation reason: \"{reason}\""),
        None => "".to_string()
    })]
    DeprecatedDirectiveArgument {
        argument_name: ArgumentName,
        directive_name: DirectiveName,
        deprecation_reason: Option<StringKey>,
    },

    #[error("The enum value `{enum_value}` of type `{enum_name}` is deprecated.{}",
    match deprecation_reason {
        Some(reason) => format!(" Deprecation reason: \"{reason}\""),
        None => "".to_string()
    })]
    DeprecatedEnumValue {
        enum_value: StringKey,
        enum_name: StringKey,
        deprecation_reason: Option<StringKey>,
    },

    #[error("Missing required {}: `{}`",
        if missing_arg_names.len() > 1 { "arguments" } else { "argument" },
        missing_arg_names
            .iter()
            .map(|arg| arg.lookup())
            .collect::<Vec<_>>()
            .join("`, `"))
    ]
    MissingRequiredArguments { missing_arg_names: Vec<StringKey> },

    #[error("Duplicate argument `{name}`")]
    DuplicateArgument { name: StringKey },

    #[error(
        "Required argument '{argument_name}: {type_string}' is missing on '{node_name}' in '{root_name}'."
    )]
    MissingRequiredArgument {
        argument_name: ArgumentName,
        type_string: String,
        node_name: StringKey,
        root_name: StringKey,
    },

    #[error("Missing required argument `{argument_name}` on this fragment spread.")]
    MissingRequiredFragmentArgument { argument_name: StringKey },

    #[error("Duplicate variable `{name}`")]
    DuplicateVariable { name: StringKey },

    #[error(
        "The `raw_response_type` argument should be set to `true` for the @no_inline fragment `{fragment_name}` used in the query with @raw_response_type."
    )]
    RequiredRawResponseTypeOnNoInline {
        fragment_name: FragmentDefinitionName,
    },

    #[error("No fields or fragments can have an alias that starts with two underscores.")]
    NoDoubleUnderscoreAlias,

    #[error(
        "Unexpected scalar literal `{literal_value}` provided in a position expecting custom scalar type `{scalar_type_name}`. This value should come from a variable."
    )]
    UnexpectedCustomScalarLiteral {
        literal_value: String,
        scalar_type_name: ScalarName,
    },

    #[error(
        "Unexpected {literal_kind} literal provided in a position expecting custom scalar type `{scalar_type_name}`."
    )]
    UnexpectedNonScalarLiteralForCustomScalar {
        literal_kind: String,
        scalar_type_name: ScalarName,
    },

    #[error(
        "Unexpected `@required(action: THROW)` directive in mutation response. The use of `@required(action: THROW)` is not supported in mutations."
    )]
    RequiredInMutation,

    #[error(
        "Unexpected `@RelayResolver` field referenced in mutation response. Relay Resolver fields may not be read as part of a mutation response."
    )]
    ResolverInMutation,

    #[error(
        "Unexpected `@throwOnFieldError` directive on a mutation. Mutations do not support `@throwOnFieldError`. Consider using `@catch(to: RESULT)` instead."
    )]
    ThrowOnFieldErrorInMutation,

    #[error("Expected the `as` argument of the @alias directive to be a static string.")]
    FragmentAliasDirectiveDynamicNameArg,

    #[error(
        "Unexpected empty string supplied for `as` argument of the @alias directive. If provided, the `as` argument of the `@alias` directive must be a non-empty string literal."
    )]
    FragmentAliasIsEmptyString,

    #[error(
        "Missing required argument `as`. The `as` argument of the @alias directive is required on inline fragments without a type condition."
    )]
    FragmentAliasDirectiveMissingAs,
}

#[derive(
    Clone,
    Debug,
    Error,
    Eq,
    PartialEq,
    Ord,
    PartialOrd,
    Hash,
    serde::Serialize
)]
#[serde(tag = "type")]
pub enum ValidationMessageWithData {
    #[error("Unknown type '{type_name}'.{suggestions}", suggestions = did_you_mean(suggestions))]
    UnknownType {
        type_name: StringKey,
        suggestions: Vec<StringKey>,
    },

    #[error("The type `{type_}` has no field `{field}`.{suggestions}{error_link}",
        suggestions = did_you_mean(suggestions),
        error_link = ErrorLink("unknown-field"))]
    UnknownField {
        type_: StringKey,
        field: StringKey,
        suggestions: Vec<StringKey>,
    },

    #[error("Expected selections on field `{field_name}` of type `{type_name}`")]
    ExpectedSelectionsOnObjectField {
        field_name: StringKey,
        type_name: StringKey,
    },

    #[error("Undefined fragment '{fragment_name}'.{suggestions}", suggestions = did_you_mean(suggestions))]
    UndefinedFragment {
        fragment_name: FragmentDefinitionName,
        suggestions: Vec<StringKey>,
    },

    #[error("Unknown argument '{argument_name}'.{suggestions}", suggestions = did_you_mean(suggestions))]
    UnknownFragmentArgument {
        argument_name: StringKey,
        suggestions: Vec<StringKey>,
    },

    #[error("Unknown argument '{argument_name}' on directive '@{directive_name}'.{suggestions}", suggestions = did_you_mean(suggestions))]
    UnknownDirectiveArgument {
        directive_name: StringKey,
        argument_name: StringKey,
        suggestions: Vec<StringKey>,
    },

    #[error("Unknown argument '{argument_name}' on field '{parent_type_name}.{field_name}'.{suggestions}", suggestions = did_you_mean(suggestions))]
    UnknownFieldArgument {
        parent_type_name: StringKey,
        field_name: StringKey,
        argument_name: StringKey,
        suggestions: Vec<StringKey>,
    },

    #[error(
        "The directive `@dangerously_unaliased_fixme` is unsafe and should be replaced with `@alias`."
    )]
    DeprecatedDangerouslyUnaliasedDirective,
}

impl WithDiagnosticData for ValidationMessageWithData {
    fn get_data(&self) -> Vec<Box<dyn DiagnosticDisplay>> {
        match self {
            ValidationMessageWithData::UnknownFragmentArgument { suggestions, .. }
            | ValidationMessageWithData::UnknownFieldArgument { suggestions, .. }
            | ValidationMessageWithData::UnknownDirectiveArgument { suggestions, .. }
            | ValidationMessageWithData::UnknownType { suggestions, .. }
            | ValidationMessageWithData::UnknownField { suggestions, .. }
            | ValidationMessageWithData::UndefinedFragment { suggestions, .. } => suggestions
                .iter()
                .map(|suggestion| into_box(*suggestion))
                .collect::<_>(),
            ValidationMessageWithData::ExpectedSelectionsOnObjectField { field_name, .. } => {
                vec![Box::new(format!("{field_name} {{ }}"))]
            }
            ValidationMessageWithData::DeprecatedDangerouslyUnaliasedDirective => {
                vec![Box::new("@alias".to_string())]
            }
        }
    }
}

fn into_box(item: StringKey) -> Box<dyn DiagnosticDisplay> {
    Box::new(item)
}
