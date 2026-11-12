/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

use graphql_ir::FragmentDefinitionName;
use graphql_ir::OperationDefinitionName;
use graphql_ir::VariableName;
use intern::string_key::StringKey;
use thiserror::Error;

#[derive(Error, Debug, serde::Serialize)]
#[serde(tag = "type")]
pub(super) enum ValidationMessage {
    #[error(
        "Invalid use of @refetchable on fragment '{fragment_name}', only supported are fragments on:\n{descriptions}"
    )]
    UnsupportedRefetchableFragment {
        fragment_name: FragmentDefinitionName,
        descriptions: String,
    },

    #[error(
        "Invalid use of @refetchable on fragment `{fragment_name}`: client-defined types implement or belong to `{type_name}`, and a refetch query fetches server objects only, so refetching one of their objects would ask the server for a client id. Put @refetchable on a fragment on a server type, such as the parent that spreads `{fragment_name}`."
    )]
    RefetchableFragmentOnTypeWithClientImplementors {
        fragment_name: FragmentDefinitionName,
        type_name: StringKey,
    },

    #[error(
        "Invalid use of @refetchable on fragment `{fragment_name}`, fragments cannot be annotated with both @refetchable and @relay(plural: true)."
    )]
    InvalidRefetchableFragmentWithRelayPlural {
        fragment_name: FragmentDefinitionName,
    },

    #[error(
        "Duplicate definition for @refetchable operation '{query_name}' from fragments '{first_fragment_name}' and '{second_fragment_name}'"
    )]
    DuplicateRefetchableOperation {
        query_name: OperationDefinitionName,
        first_fragment_name: FragmentDefinitionName,
        second_fragment_name: FragmentDefinitionName,
    },

    #[error(
        "The `queryName` specified in `@refetchable` must be unique, a definition with the name `{definition_name}` already exists."
    )]
    RefetchableQueryConflictWithDefinition { definition_name: StringKey },

    #[error(
        "Invalid use of @refetchable with @connection in fragment '{fragment_name}', at most once @connection can appear in a refetchable fragment."
    )]
    RefetchableWithMultipleConnections {
        fragment_name: FragmentDefinitionName,
    },

    #[error(
        "Invalid use of @refetchable with @connection in fragment '{fragment_name}', refetchable connections cannot appear inside plural fields."
    )]
    RefetchableWithConnectionInPlural {
        fragment_name: FragmentDefinitionName,
    },

    #[error(
        "Invalid use of @refetchable with @connection in fragment '{fragment_name}', refetchable connections must use variables for the {arguments} arguments."
    )]
    RefetchableWithConstConnectionArguments {
        fragment_name: FragmentDefinitionName,
        arguments: &'static str,
    },

    #[error(
        r#"When provided, the `directives` argument to `@refetchable` needs to be a list of literal strings. Each string should be a server directive valid on queries. Example: `@refetchable(queryName: "ExampleQuery", directives: ["@owner(name: \"an owner\")"])"#
    )]
    RefetchableDirectivesArgRequiresLiteralStringList,

    #[error(
        "Invalid use of @refetchable on fragment `{fragment_name}`, this fragment already has an `$id` variable in scope."
    )]
    RefetchableFragmentOnNodeWithExistingID {
        fragment_name: FragmentDefinitionName,
    },

    #[error(
        "Invalid use of @refetchable on fragment '{fragment_name}', check that your schema defines a `Node {{ id: ID }}` interface and has a `node(id: ID): Node` field on the query type (the id argument may also be non-null)."
    )]
    InvalidNodeSchemaForRefetchableFragmentOnNode {
        fragment_name: FragmentDefinitionName,
    },

    #[error(
        "Invalid use of @refetchable on fragment '{fragment_name}', check that your schema defines a 'Viewer' object type and has a 'viewer: Viewer' field on the query type."
    )]
    InvalidViewerSchemaForRefetchableFragmentOnViewer {
        fragment_name: FragmentDefinitionName,
    },

    // T139416294 this error message doesn't appear to be accurate
    #[error(
        "Invalid use of @refetchable with @connection in fragment '{fragment_name}', check that your schema defines a `directive @fetchable(field_name: String!) on OBJECT` or on `INTERFACE`."
    )]
    InvalidRefetchDirectiveDefinition {
        fragment_name: FragmentDefinitionName,
    },

    #[error(
        "Invalid use of @refetchable on fragment '{fragment_name}', the type '{type_name}' is @fetchable but the identifying field '{identifier_field_name}' does not have type 'ID'."
    )]
    InvalidRefetchIdentifyingField {
        fragment_name: FragmentDefinitionName,
        identifier_field_name: StringKey,
        type_name: StringKey,
    },

    #[error(
        "Invalid use of @refetchable on fragment '{fragment_name}', the type '{type_name}' is @fetchable but there is no corresponding '{fetch_field_name}' field or it is invalid (expected '{fetch_field_name}(id: ID!): ${type_name}')."
    )]
    InvalidRefetchFetchField {
        fetch_field_name: StringKey,
        fragment_name: FragmentDefinitionName,
        type_name: StringKey,
    },

    #[error(
        "Expected the 'queryName' argument of @refetchable to be a string, got '{query_name_value}"
    )]
    ExpectQueryNameToBeString { query_name_value: String },

    #[error(
        "Expected the 'preferFetchable' argument of @refetchable to be a literal Boolean value, got '{prefer_fetchable_value}'"
    )]
    ExpectPreferFetchableToBeConstantBoolean { prefer_fetchable_value: String },

    #[error(
        "Fragment variable `${name}` conflicts with a global variable generated by the @refetchable generated query"
    )]
    LocalGlobalVariableConflict { name: VariableName },
}
