/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

use common::DiagnosticDisplay;
use common::InterfaceName;
use common::ObjectName;
use common::WithDiagnosticData;
use intern::string_key::StringKey;
use schema::suggestion_list::did_you_mean;
use thiserror::Error;

use crate::RELAY_FIELD_FIELD;
use crate::RELAY_TYPE_FIELD;
use crate::untyped_representation::AllowedFieldName;

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
pub enum UntypedRepresentationErrorMessages {
    #[error("Unexpected docblock field `@{field_name}`")]
    UnknownField { field_name: StringKey },

    #[error("Unexpected duplicate docblock field `@{field_name}`")]
    DuplicateField { field_name: AllowedFieldName },

    #[error(
        "Unexpected free text. Free text in a resolver docblock is treated as the field's human-readable description. Only one description is permitted."
    )]
    MultipleDescriptions,
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
pub enum IrParsingErrorMessages {
    // The rest of this sentence is expected to be supplied by `.annotate`.
    #[error("Unexpected conflicting argument name. This field argument")]
    ConflictingArguments,

    #[error(
        "Relay Resolver-authored RSC argument `{argument_name}` has incompatible types: the public field declares `{field_type}`, but the root fragment expects `{fragment_type}`."
    )]
    RscResolverFieldArgumentTypeMismatch {
        argument_name: StringKey,
        field_type: String,
        fragment_type: String,
    },

    #[error(
        "Relay Resolver-authored RSC argument `{argument_name}` cannot retain root fragment default `{default_value}` because it is invalid for the public field type `{field_type}`."
    )]
    RscResolverFieldArgumentDefaultValueMismatch {
        argument_name: StringKey,
        default_value: String,
        field_type: String,
    },

    #[error(
        "The compiler attempted to parse \"{user_provided}\" as a GraphQL type (e.g. `Viewer` or `User`), but had unparsed characters remaining. Try removing everything after \"{parsed}\"."
    )]
    RemainingCharsWhenParsingIdentifier {
        user_provided: StringKey,
        parsed: StringKey,
    },

    #[error(
        "The resolver field `@{field_name}` does not accept data. Remove everything after `@{field_name}`."
    )]
    FieldWithUnexpectedData { field_name: AllowedFieldName },

    #[error("The resolver field `@{field_name}` requires data.")]
    FieldWithMissingData { field_name: AllowedFieldName },

    #[error(
        "Unexpected Relay Resolver field with non-nullable type. Relay expects all Resolver fields to be nullable since errors thrown by Resolvers are turned into `null` values."
    )]
    FieldWithNonNullType,

    #[error(
        "The compiler attempted to parse this resolver block as a {resolver_type}, but there were unexpected fields: {field_string}."
    )]
    LeftoverFields {
        resolver_type: &'static str,
        field_string: String,
    },

    #[error("Defining arguments with default values for resolver fields is not supported, yet.")]
    ArgumentDefaultValuesNoSupported,

    #[error(
        "The type specified in the fragment (`{fragment_type_condition}`) and the parent type (`{type_name}`) are different. Please make sure these are exactly the same."
    )]
    MismatchRootFragmentTypeConditionTerseSyntax {
        fragment_type_condition: StringKey,
        type_name: StringKey,
    },

    #[error(
        "Unexpected character \"{found}\". Expected resolver field to either be a GraphQL typename, or a field definition of the form `ParentType.field_name: ReturnType`."
    )]
    UnexpectedNonDot { found: char },

    #[error(
        "Legacy verbose resolver syntax (@onType, @onInterface, @fieldName) is deprecated. Use the terse syntax instead: @relayField ParentType.fieldName: ReturnType"
    )]
    LegacyVerboseSyntaxDeprecated,

    #[error(
        "Unexpected multiple resolver tags. Expected exactly one of `@RelayResolver`, `@relayType`, or `@relayField`."
    )]
    MultipleResolverTags,

    #[error(
        "The `@mayWaterfall` docblock tag requires `@returnFragment`. `@mayWaterfall` declares that a shadow resolver may return a pointer to a different server object, so it is only meaningful on a resolver that returns a fragment."
    )]
    MayWaterfallRequiresReturnFragment,

    #[error(
        "Relay Resolver-authored RSC field `{field_name}` requires the `enable_relay_rsc` feature flag."
    )]
    RscResolverFieldFeatureDisabled { field_name: StringKey },

    #[error(
        "Relay Resolver-authored RSC field `{field_name}` must use the nullable scalar type `RelayRscValue` exactly; lists and `RelayRscValue!` are not supported."
    )]
    RscResolverFieldInvalidType { field_name: StringKey },

    #[error(
        "Relay Resolver-authored RSC field `{field_name}` requires exactly one `@rootFragment`."
    )]
    RscResolverFieldRequiresRootFragment { field_name: StringKey },

    #[error(
        "Root fragment `{fragment_name}` for Relay Resolver-authored RSC field `{field_name}` must be marked `@server`."
    )]
    RscResolverFieldRequiresServerFragment {
        field_name: StringKey,
        fragment_name: StringKey,
    },

    #[error(
        "Relay Resolver-authored RSC field `{field_name}` cannot use plural root fragment `{fragment_name}`."
    )]
    RscResolverFieldPluralRootFragment {
        field_name: StringKey,
        fragment_name: StringKey,
    },

    #[error(
        "Relay Resolver-authored RSC field `{field_name}` derives an empty component prop name from root fragment `{fragment_name}`. Rename the fragment to end with a non-empty suffix."
    )]
    RscResolverFieldEmptyFragmentProp {
        field_name: StringKey,
        fragment_name: StringKey,
    },

    #[error(
        "Relay Resolver-authored RSC field `{field_name}` derives reserved component prop name `args` from root fragment `{fragment_name}`. Rename the fragment suffix."
    )]
    RscResolverFieldReservedFragmentProp {
        field_name: StringKey,
        fragment_name: StringKey,
    },

    #[error("Relay Resolver-authored RSC field `{field_name}` cannot be `@live`.")]
    RscResolverFieldLiveUnsupported { field_name: StringKey },

    #[error(
        "Relay Resolver-authored RSC field `{field_name}` cannot use `@returnFragment` or `@mayWaterfall`."
    )]
    RscResolverFieldReturnFragmentUnsupported { field_name: StringKey },
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
pub enum SchemaValidationErrorMessages {
    #[error("Relay Resolvers may not be used to implement the `{id_field_name}` field.")]
    ResolversCantImplementId { id_field_name: StringKey },

    #[error(
        "The interface `{interface_name}` is not defined in a client schema extension. Resolver types can implement a server interface only where the project enables `enable_client_implementors_of_server_abstract_types` for it."
    )]
    UnexpectedServerInterface { interface_name: InterfaceName },

    #[error(
        "`{object_name}` implements the server interface `{super_interface_name}` through `{interface_name}`, so `enable_client_implementors_of_server_abstract_types` must enable `{super_interface_name}` too."
    )]
    ClientImplementorServerSuperInterfaceNotEnabled {
        object_name: ObjectName,
        interface_name: InterfaceName,
        super_interface_name: InterfaceName,
    },

    #[error("Expected interface `{interface_name}` to define an `id: ID!` field.")]
    InterfaceWithNoIdField { interface_name: InterfaceName },

    #[error(
        "Expected interface `{interface_name}` to define an `id: ID!` field. It defines an id field, but its type is `{invalid_type_string}`."
    )]
    InterfaceWithWrongIdField {
        interface_name: InterfaceName,
        invalid_type_string: String,
    },

    #[error(
        "Resolvers on the mutation type {mutation_type_name} are disallowed without the enable_relay_resolver_mutations feature flag"
    )]
    DisallowedMutationResolvers { mutation_type_name: StringKey },

    #[error(
        "Mutation resolver {resolver_field_name} must return a scalar or enum type, got {actual_return_type}"
    )]
    MutationResolverNonScalarReturn {
        resolver_field_name: StringKey,
        actual_return_type: StringKey,
    },

    #[error(
        "Relay Resolvers that return weak types defined in client schema extensions are not supported. Prefer defining the return type using a `@weak` Relay Resolver type: https://relay.dev/docs/next/guides/relay-resolvers/defining-types/#defining-a-weak-type"
    )]
    ClientEdgeToClientWeakType,
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
pub enum ErrorMessagesWithData {
    #[error("Fragment `{fragment_name}` not found.{suggestions}", suggestions = did_you_mean(suggestions))]
    FragmentNotFound {
        fragment_name: StringKey,
        suggestions: Vec<StringKey>,
    },

    #[error("The type `{type_name}` is not an existing GraphQL type.{suggestions}", suggestions = did_you_mean(suggestions))]
    TypeNotFound {
        type_name: StringKey,
        suggestions: Vec<StringKey>,
    },

    #[error(
        "Unexpected `@RelayResolver` for a type definition. Expected `@relayType`. The legacy `@RelayResolver` tag can be enabled with the `allow_legacy_relay_resolver_tag` feature flag."
    )]
    UseRelayTypeTag,

    #[error(
        "Unexpected `@RelayResolver` for a field definition. Expected `@relayField`. The legacy `@RelayResolver` tag can be enabled with the `allow_legacy_relay_resolver_tag` feature flag."
    )]
    UseRelayFieldTag,

    #[error("Unexpected `@relayType` for a field definition. Expected `@relayField`.")]
    RelayTypeTagUsedForField,

    #[error("Unexpected `@relayField` for a type definition. Expected `@relayType`.")]
    RelayFieldTagUsedForType,
}

impl WithDiagnosticData for ErrorMessagesWithData {
    fn get_data(&self) -> Vec<Box<dyn DiagnosticDisplay>> {
        match self {
            ErrorMessagesWithData::FragmentNotFound { suggestions, .. }
            | ErrorMessagesWithData::TypeNotFound { suggestions, .. } => suggestions
                .iter()
                .map(|suggestion| into_box(*suggestion))
                .collect::<_>(),
            ErrorMessagesWithData::UseRelayTypeTag => vec![into_box(*RELAY_TYPE_FIELD)],
            ErrorMessagesWithData::UseRelayFieldTag => vec![into_box(*RELAY_FIELD_FIELD)],
            ErrorMessagesWithData::RelayTypeTagUsedForField => vec![into_box(*RELAY_FIELD_FIELD)],
            ErrorMessagesWithData::RelayFieldTagUsedForType => vec![into_box(*RELAY_TYPE_FIELD)],
        }
    }
}

fn into_box(item: StringKey) -> Box<dyn DiagnosticDisplay> {
    Box::new(item)
}
