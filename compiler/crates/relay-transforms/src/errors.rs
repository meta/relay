/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

use common::ArgumentName;
use common::DiagnosticDisplay;
use common::DirectiveName;
use common::InterfaceName;
use common::ObjectName;
use common::WithDiagnosticData;
use graphql_ir::FragmentDefinitionName;
use graphql_ir::VariableName;
use intern::string_key::StringKey;
use thiserror::Error;

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
pub enum ValidationMessage {
    #[error(
        "The Relay Resolver backing this field has an `@relay_resolver` directive with an invalid '{key}' argument. Expected a literal string value."
    )]
    InvalidRelayResolverKeyArg { key: ArgumentName },

    #[error(
        "The Relay Resolver backing this field is missing a '{key}' argument in its `@relay_resolver` directive."
    )]
    MissingRelayResolverKeyArg { key: ArgumentName },

    #[error(
        "Unexpected directive on Relay Resolver field. Relay Resolver fields do not currently support directives."
    )]
    RelayResolverUnexpectedDirective,

    #[error(
        "The Relay Resolver backing this field is defined with an invalid `fragment_name`. Could not find a fragment named '{fragment_name}'."
    )]
    InvalidRelayResolverFragmentName {
        fragment_name: FragmentDefinitionName,
    },
    #[error(
        "The usage of global variable `${variable_name}` is not supported in the Relay resolvers fragments. Please, add this variable to the `@argumentDefinitions` of the `{fragment_name}` fragment."
    )]
    UnsupportedGlobalVariablesInResolverFragment {
        variable_name: VariableName,
        fragment_name: FragmentDefinitionName,
    },

    #[error(
        "Expected fragment spread into Relay Resolver root fragment to be annotated with `@inline` or `@relay(mask: false)`. Relay Resolvers only support reading `@inline` fragments and unmasked fragments."
    )]
    UnsupportedFragmentSpreadInResolverFragment,

    #[error(
        "The '{fragment_name}' is transformed to use @no_inline implicitly by `@module`, but it's also used in a regular fragment spread. It's required to explicitly add `@no_inline` to the definition of '{fragment_name}'."
    )]
    RequiredExplicitNoInlineDirective {
        fragment_name: FragmentDefinitionName,
    },

    #[error(
        "The `@relay_test_operation` directive is only allowed within test \
        files because it creates larger generated files we don't want to \
        include in production. File does not match test regex: {test_path_regex}"
    )]
    TestOperationOutsideTestDirectory { test_path_regex: String },

    #[error("Undefined fragment '{0}'")]
    UndefinedFragment(FragmentDefinitionName),

    #[error(
        "Each selection can have only a single @module directive, but here there is more than one (perhaps within different inline fragments). To fix it, add an @alias to one of the @module fragments or put each @module fragment into its own aliased copy of the parent field."
    )]
    ConflictingModuleSelections,

    #[error(
        "Client Edges that reference client-defined interface types are not currently supported in Relay."
    )]
    ClientEdgeToClientInterface,

    #[error(
        "The client edge pointing to `{name}` with implementing object, `{type_name}`, is missing its corresponding model resolver. The concrete type `{type_name}` and its resolver fields should be defined with the newer dot notation resolver syntax. See https://relay.dev/docs/guides/relay-resolvers/."
    )]
    ClientEdgeImplementingObjectMissingModelResolver {
        name: StringKey,
        type_name: ObjectName,
    },

    #[error(
        "Unexpected Relay Resolver returning plual edge to type defined on the server. Relay Resolvers do not curretly support returning plural edges to server types. As a work around, consider defining a plural edge to a client type which has a singular edge to the server type."
    )]
    ClientEdgeToServerObjectList,

    #[error("Invalid directive combination. @alias may not be combined with other directives.")]
    FragmentAliasIncompatibleDirective,

    #[error(
        "Unexpected `@alias` on spread of plural fragment. @alias may not be used on fragments marked as `@relay(plural: true)`."
    )]
    PluralFragmentAliasNotSupported,

    #[error(
        "Unexpected dynamic argument. {field_name}'s '{argument_name}' argument must be a constant value because it is read by the Relay compiler."
    )]
    InvalidStaticArgument {
        field_name: StringKey,
        argument_name: ArgumentName,
    },

    #[error(
        "Unexpected directive on Client Edge field. The `@{directive_name}` directive is not currently supported on fields backed by Client Edges."
    )]
    ClientEdgeUnsupportedDirective { directive_name: DirectiveName },

    #[error(
        "Server-to-client resolver @rootFragment `{fragment_name}` runs at exec time, where it is projected from the normalized response rather than read from the store. Found disallowed selection: `{field_name}`. Allowed here: identity (`__typename`, `id`, `__id`), a field granted by `@UNSTABLE_key(fields: \"...\")` on the type that declares it, and the selections the resolver's own magic fragment transplants. Granting `{field_name}` asserts it is stable for the record's lifetime and always arrives in the same payload as the record; where that does not hold, read the field at read time instead."
    )]
    S2CRootFragmentInvalidSelection {
        fragment_name: StringKey,
        field_name: StringKey,
    },

    #[error(
        "Resolver `{parent_type}.{field_name}` is on a server type and is selected in an @exec_time_resolvers operation, but it declares no @rootFragment. At exec time a resolver on a server record runs once per record, scheduled by its root fragment; without one it never runs and the field reads `undefined`. Add a @rootFragment on `{parent_type}` that selects `id` or `__typename`, or move the field to `Query` if it does not depend on the record."
    )]
    S2CResolverMissingRootFragment {
        parent_type: StringKey,
        field_name: StringKey,
    },

    #[error(
        "Server-to-client resolver @rootFragment `{fragment_name}` cannot spread `{spread_name}`. At exec time the root fragment is checked selection by selection, and Relay does not follow a spread to see what it selects — so it cannot tell an identity-only fragment from one that reads server data. Inline the selections into `{fragment_name}` instead."
    )]
    S2CRootFragmentUnsupportedSpread {
        fragment_name: StringKey,
        spread_name: StringKey,
    },

    #[error(
        "Server-to-client resolver @rootFragment `{fragment_name}` cannot use `@{directive_name}`. At exec time the fragment is projected from the normalized response by copying the records it declares, and that copy does not evaluate conditions — so a conditional selection would be projected whether or not it applies. Select the field unconditionally, or read it at read time."
    )]
    S2CRootFragmentUnsupportedCondition {
        fragment_name: StringKey,
        directive_name: StringKey,
    },

    #[error(
        "`@UNSTABLE_key` cannot grant `{field_name}` on `{type_name}`: it is a CLIENT field. The grant exists so an exec-time server-to-client @rootFragment can read a field out of the normalized server response, and a client field is never in that response — it is resolved by composition instead. Remove it from the field set; if the resolver needs it, read it as an ordinary client field."
    )]
    KeyDirectiveClientField {
        type_name: StringKey,
        field_name: StringKey,
    },

    #[error(
        "`@UNSTABLE_key` cannot grant `{field_name}` on `{type_name}`: it TAKES ARGUMENTS. The grant asserts a field is stable for the record's lifetime and always arrives in the same payload as the record, which cannot hold for a field whose value depends on its arguments — two selections with different arguments are different values under one name. Remove it from the field set."
    )]
    KeyDirectiveFieldWithArguments {
        type_name: StringKey,
        field_name: StringKey,
    },

    #[error(
        "Unsupported `@UNSTABLE_key(fields: \"{field_set}\")` on `{type_name}`. Relay accepts only a space-separated list of field names on the annotated type — no nested selections, arguments or aliases. Parsing `{field_set}` by splitting it would grant fields that were only meant to qualify a selection, so it is rejected instead."
    )]
    KeyDirectiveUnsupportedFieldSet {
        type_name: StringKey,
        field_set: StringKey,
    },

    #[error(
        "Relay Resolver field `{field_name}` returns server type `{server_type_name}` which does not implement the `Node` interface and is not `@fetchable`. Server types returned by Relay Resolvers must be refetchable via the `Node` interface or the `@fetchable` directive."
    )]
    ClientEdgeServerTypeNotRefetchable {
        field_name: StringKey,
        server_type_name: ObjectName,
    },

    #[error(
        "Relay Resolver field `{field_name}` returns `{abstract_type_name}` which includes server type `{server_type_name}`. `{server_type_name}` does not implement the `Node` interface and is not `@fetchable`. Server types returned by Relay Resolvers must be refetchable via the `Node` interface or the `@fetchable` directive."
    )]
    ClientEdgeMixedInterfaceServerTypeNotRefetchable {
        field_name: StringKey,
        abstract_type_name: StringKey,
        server_type_name: ObjectName,
    },

    #[error(
        "Invalid @RelayResolver output type for field `{field_name}`. Got input object `{type_name}`."
    )]
    RelayResolverOutputTypeInvalidInputObjectType {
        field_name: StringKey,
        type_name: StringKey,
    },

    #[error(
        "@RelayResolver {type_kind} type `{type_name}` for field `{field_name}` is not supported as @outputType, yet."
    )]
    RelayResolverOutputTypeUnsupported {
        type_kind: StringKey,
        field_name: StringKey,
        type_name: StringKey,
    },

    #[error(
        "No types implement the client interface {interface_name}. Interfaces returned by a @RelayResolver must have at least one concrete implementation."
    )]
    RelayResolverClientInterfaceMustBeImplemented { interface_name: InterfaceName },

    #[error(
        "`{type_name}` implements the server interface `{interface_name}` but does not define `{field_name}`, which is selected here. An object of `{type_name}` read here would have no `{field_name}`: define it on `{type_name}`, or select it inside `... on` the server types that have it."
    )]
    ClientImplementorMissingInterfaceField {
        type_name: StringKey,
        interface_name: InterfaceName,
        field_name: StringKey,
    },

    #[error(
        "`{type_name}` is a client-defined type of `{parent_name}` that Relay does not list for `{abstract_type_name}`, so an object of `{type_name}` read through this refinement would read as missing data: the reader answers `__is{abstract_type_name}` for a client object only from the types the compiler lists. {remedy}"
    )]
    ClientImplementorRefinementOnUnlistedAbstractType {
        type_name: StringKey,
        parent_name: StringKey,
        abstract_type_name: StringKey,
        remedy: String,
    },

    #[error(
        "`{type_name}` implements the server interface `{interface_name}` and serves `{field_name}` with its own resolver, which only exec time reads: the executor computes it when the query runs. `{operation_name}` reaches this selection{via} and runs at read time{provider}, where an object of `{type_name}` would have no `{field_name}`. {remedy}"
    )]
    ClientImplementorCaseReachableAtReadTime {
        interface_name: InterfaceName,
        type_name: ObjectName,
        field_name: StringKey,
        operation_name: StringKey,
        provider: String,
        via: String,
        remedy: String,
    },

    #[error(
        "`{type_name}` implements the server interface `{interface_name}` and serves `{field_name}` with its own resolver, which only exec time reads: the executor computes it when the query runs. `{operation_name}`, the query Relay generates for `@refetchable` on `{fragment_name}`, reaches this selection{via} and runs at read time{provider}. A refetch passes it `$__relay_exec_time` from the query that fetched `{fragment_name}`, and only an `enabledProvider` in its `directives` overrides that. Add `directives: [\"@exec_time_resolvers\"]` to that `@refetchable`, use `@exec_time_resolvers(enabledProvider: ...)` there and select {guard_target} under `@include(if: $__relay_exec_time)`, or select this inside `... on` the server types."
    )]
    ClientImplementorCaseReachableFromRefetchQuery {
        interface_name: InterfaceName,
        type_name: ObjectName,
        field_name: StringKey,
        operation_name: StringKey,
        fragment_name: FragmentDefinitionName,
        provider: String,
        via: String,
        guard_target: String,
    },

    #[error(
        "`$__relay_exec_time` is reserved: the compiler sets it to whether the operation runs at exec time. Remove this declaration or argument."
    )]
    ReservedExecTimeVariable,

    #[error(
        "An @updatable query or fragment cannot select `{field_name}` of `{interface_name}` here: client types implement `{interface_name}` and serve `{field_name}` themselves, and an updatable proxy reads and writes the store fields of server objects only."
    )]
    ClientImplementorCasesInUpdatableDocument {
        interface_name: InterfaceName,
        field_name: StringKey,
    },

    #[error(
        "The @assignable fragment `{fragment_name}` is on `{type_name}`, which client-defined types implement or belong to: an assignment through it could link a client object into a server field. Use an @assignable fragment on a server type of `{type_name}` instead."
    )]
    AssignableFragmentOnTypeWithClientImplementors {
        fragment_name: FragmentDefinitionName,
        type_name: StringKey,
    },

    #[error(
        "The interface {interface_name} is being used as an @outputType of a @RelayResolver. For this to be valid, all Object types that implement the interface must be client types. However, the {object_name}, which implements {interface_name}, is a server type."
    )]
    RelayResolverClientInterfaceImplementingTypeMustBeClientTypes {
        interface_name: InterfaceName,
        object_name: ObjectName,
    },

    #[error(
        "@RelayResolver type recursion detected for the output type `{type_name}`. This is not supported for `@outputType` resolvers. If you want to model a connection between two entities of the same GraphQL type, consider creating a new Relay Resolver with `@edgeTo` annotation."
    )]
    RelayResolverTypeRecursionDetected { type_name: StringKey },

    #[error(
        "Field `{field_name}` has output type `{type_name}`. `{type_name}` is a server type, and server types cannot be used with @outputType on @RelayResolver. Edges to server types can be exposed with @edgeTo and @waterfall."
    )]
    RelayResolverServerTypeNotSupported {
        field_name: StringKey,
        type_name: StringKey,
    },

    #[error(
        "Field name `{id_name}` is reserved for strong objects (objects that implement Node interface). Defining `{id_name}` fields is not currently supported on @RelayResolver with @outputType."
    )]
    RelayResolverIDFieldNotSupported { id_name: StringKey },

    #[error(
        "Arguments are not supported in the fields on the @outputType in @RelayResolvers. You'll need to expose these fields using @RelayResolver for them."
    )]
    RelayResolverArgumentsNotSupported,

    #[error(
        "Disallowed selection of field `{}{field_name}`.{}",
        parent_name.map_or("".to_string(), |name| format!("{name}.")),
        reason.map_or("".to_string(), |reason| format!(" Reason: \"{reason}\"")),
    )]
    UnselectableField {
        field_name: StringKey,
        parent_name: Option<StringKey>,
        reason: Option<StringKey>,
    },

    #[error(
        "The @returnFragment docblock tag requires the 'enable_shadow_resolvers' feature flag to be enabled."
    )]
    ReturnFragmentRequiresFeatureFlag,

    #[error(
        "'{name}' is not a valid fragment name. Fragment names must match /[_A-Za-z][_0-9A-Za-z]*/."
    )]
    ReturnFragmentInvalidName { name: StringKey },

    #[error(
        "The @returnFragment name '{name}' conflicts with an existing fragment. The fragment referenced by @returnFragment will be generated by Relay."
    )]
    ReturnFragmentConflictsWithExistingFragment { name: StringKey },

    #[error(
        "The @returnFragment name must start with the module name ('{module_name}'). Got '{fragment_name}' instead."
    )]
    ReturnFragmentInvalidModuleName {
        module_name: String,
        fragment_name: StringKey,
    },

    #[error(
        "@returnFragment requires the resolver to define a @rootFragment. Resolvers with @returnFragment must read data from the graph using a root fragment."
    )]
    ReturnFragmentRequiresRootFragment,

    #[error(
        "The @returnFragment '{return_fragment_name}' must be spread within the @rootFragment '{root_fragment_name}'. Add `...{return_fragment_name}` to your root fragment."
    )]
    ReturnFragmentNotSpreadInRootFragment {
        return_fragment_name: FragmentDefinitionName,
        root_fragment_name: FragmentDefinitionName,
    },

    #[error(
        "The selection '{field_name}' on shadow resolver field cannot be transplanted onto the shadowed server type '{type_name}'. The shadowed server type must define a field with the same name so the consumer's selections can be fetched in the main query."
    )]
    ShadowReturnSelectionNotOnShadowedType {
        field_name: StringKey,
        type_name: StringKey,
    },

    #[error(
        "Fragment spread `{fragment_name}` in selections on a shadow resolver field cannot take `@arguments`, and its fragment cannot declare argument definitions. The spread is inlined into the main operation while the reader keeps the spread verbatim; because these resolve variables at different pipeline stages, a parameterized spread can silently miscompile. Remove the fragment's arguments, or inline the selection."
    )]
    ShadowReturnFragmentSpreadArgumentsUnsupported { fragment_name: StringKey },

    #[error(
        "Fragment spread `{fragment_name}` in selections on a shadow resolver field cannot be a `@no_inline` fragment. The spread's fields must be inlined into the main operation. Remove `@no_inline` from the fragment, or inline the selection."
    )]
    ShadowReturnFragmentSpreadNoInlineUnsupported { fragment_name: StringKey },

    #[error(
        "Fragment spread `{fragment_name}` in selections on a shadow resolver field has the union type condition `{type_condition_name}`. Only concrete-typed and interface-typed consumer spreads are supported. Use a fragment on a concrete type or an interface, or inline the selection."
    )]
    ShadowReturnFragmentSpreadUnionTypeUnsupported {
        fragment_name: StringKey,
        type_condition_name: StringKey,
    },

    #[error(
        "The inline fragment type condition '{type_condition_name}' cannot be transplanted onto the shadowed server type '{type_name}'. Shadow resolver selections are fetched from the shadowed server field, so a server type condition must overlap that type. (Client-extension type conditions are served separately by the model-resolver edge.)"
    )]
    ShadowReturnIncompatibleInlineFragmentType {
        type_condition_name: StringKey,
        type_name: StringKey,
    },

    #[error(
        "Plural shadow resolvers (whose return type is a list) are not yet supported. `@returnFragment` currently only supports singular shadow resolver fields. Remove the list from the resolver's return type, or split into a singular field."
    )]
    ShadowResolverPluralUnsupported,

    #[error(
        "Union shadow resolver return types are not yet supported. The shadow resolver field `{field_name}` returns the union `{union_name}`, which may have a client-extension member. Unions are not expanded into per-member typed inline fragments, so a client member's selections cannot be routed to its model resolver. Use an interface return type instead, or remove the client-extension member."
    )]
    MagicFragmentUnionReturnUnsupported {
        field_name: StringKey,
        union_name: StringKey,
    },

    #[error(
        "Magic fragment (`@returnFragment`) shadow resolver field `{field_name}` returns `{type_name}`, which is a concrete object type. A magic fragment's return type must be an interface: the consumer's selection is fanned per concrete implementor and dispatched at read time on the resolver's returned `__typename`, so a concrete object (which has no implementors to fan) would silently drop the magic-fragment routing. Use an interface return type."
    )]
    MagicFragmentConcreteObjectReturnUnsupported {
        field_name: StringKey,
        type_name: StringKey,
    },

    #[error(
        "The shadow resolver field `{field_name}` returns the interface `{interface_name}`, which has a client-extension implementor, so its client data is read through the model-resolver edge. That edge requires the consumer's interface selection to be expanded into per-implementor typed inline fragments, which only happens when `relay_resolver_enable_interface_output_type` is enabled. Enable `relay_resolver_enable_interface_output_type` for this project, or remove the client-extension implementor."
    )]
    MagicFragmentClientImplementorRequiresInterfaceOutputType {
        field_name: StringKey,
        interface_name: StringKey,
    },

    #[error(
        "The `@__relay_shadow_return` directive is internal to the Relay compiler and cannot be used in source. Shadow resolver return data is marked by spreading the resolver's `@returnFragment` placeholder inside its `@rootFragment`; the compiler generates this directive automatically."
    )]
    InternalShadowReturnDirectiveNotAllowed,

    #[error(
        "The `@returnFragment` placeholder `...{return_fragment_name}` must be spread directly inside the shadowed server field of the resolver's `@rootFragment`. It cannot appear at the top level of the fragment, or inside an inline fragment or condition."
    )]
    ShadowReturnPlaceholderMisplaced {
        return_fragment_name: FragmentDefinitionName,
    },

    #[error(
        "`@waterfall` on the plural shadow resolver field `{field_name}` is not currently supported. Remove `@waterfall` from this field."
    )]
    MagicFragmentPluralWaterfallUnsupported { field_name: StringKey },

    #[error(
        "A magic fragment returning interface `{interface_name}` that mixes inline (weak or non-Node value) implementors with refetchable server-object (Node) implementors is not yet supported. The inline arm reads in place while the server arm needs a `node(id:)` refetch, which requires per-`__typename` dispatch. Use an all-inline or all-server interface for now."
    )]
    MagicFragmentMixedInlineAndRefetchableUnsupported { interface_name: StringKey },
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
    #[error(
        "Expected a `@waterfall` directive on this field. Consuming a Client Edge field incurs a network roundtrip or \"waterfall\". To make this explicit, a `@waterfall` directive is required on this field."
    )]
    RelayResolversMissingWaterfall { field_name: StringKey },

    #[error(
        "Unexpected `@waterfall` directive. Only fields that are backed by a Client Edge and point to a server object should be annotated with the `@waterfall` directive."
    )]
    RelayResolversUnexpectedWaterfall,

    #[error(
        "Unexpected `@waterfall` directive on `{field_name}`. This magic-fragment field's resolver does not declare `@mayWaterfall`, so it only ever returns the shadowed record (served by the transplant, with no waterfall). Remove `@waterfall`, or add `@mayWaterfall` to the resolver's docblock if it may return a pointer to a different server object."
    )]
    MagicFragmentUnexpectedWaterfall { field_name: StringKey },

    #[error(
        "Unexpected `@required` directive on a non-null field. This field is already non-null and does not need the `@required` directive."
    )]
    RequiredOnNonNull,

    #[error(
        "Unexpected `@required` directive on a `@semanticNonNull` field within a `@throwOnFieldError` or `@catch` selection. Such fields are already non-null and do not need the `@required` directive."
    )]
    RequiredOnSemanticNonNull,

    #[error(
        "Expected `@alias` directive. `{fragment_name}` is defined on `{fragment_type_name}` which might not match this selection type of `{selection_type_name}`. Add `@alias` to this spread to expose the fragment reference as a nullable property."
    )]
    ExpectedAliasOnNonSubtypeSpread {
        fragment_name: FragmentDefinitionName,
        fragment_type_name: StringKey,
        selection_type_name: StringKey,
    },

    #[error(
        "Expected `@alias` directive. `{fragment_name}` is defined on `{fragment_type_name}` which might not match this selection type of `{selection_type_name}`. Add `@alias` to this spread to expose the fragment reference as a nullable property. NOTE: The selection type inferred here does not include inline fragments because Relay does not always model inline fragment type refinements in its generated types."
    )]
    ExpectedAliasOnNonSubtypeSpreadWithinTypedInlineFragment {
        fragment_name: FragmentDefinitionName,
        fragment_type_name: StringKey,
        selection_type_name: StringKey,
    },

    #[error(
        "Expected `@alias` directive. Fragment spreads with (or within an inline fragment with) `@{condition_name}` are conditionally fetched. Add `@alias` to this spread to expose the fragment reference as a nullable property."
    )]
    ExpectedAliasOnConditionalFragmentSpread {
        fragment_name: FragmentDefinitionName,
        condition_name: String,
    },

    #[error("The Codemod '{codemod_name}' wants to update the query at this location to '{fix}.")]
    CodemodCustomErrorWithFix {
        codemod_name: StringKey,
        fix: String,
    },
}

impl WithDiagnosticData for ValidationMessageWithData {
    fn get_data(&self) -> Vec<Box<dyn DiagnosticDisplay>> {
        match self {
            ValidationMessageWithData::RelayResolversMissingWaterfall { field_name } => {
                vec![Box::new(format!("{field_name} @waterfall",))]
            }
            ValidationMessageWithData::RelayResolversUnexpectedWaterfall => {
                vec![Box::new("")]
            }
            ValidationMessageWithData::MagicFragmentUnexpectedWaterfall { .. } => {
                vec![Box::new("")]
            }
            ValidationMessageWithData::RequiredOnNonNull => {
                vec![Box::new("")]
            }
            ValidationMessageWithData::RequiredOnSemanticNonNull => {
                vec![Box::new("")]
            }
            ValidationMessageWithData::ExpectedAliasOnNonSubtypeSpread {
                fragment_name, ..
            } => {
                // When used as a codemod, the first suggestion is used as the codemod's replacement text.
                // For that reason, the `@dangerously_unaliased_fixme` is first, since it requires no other changes.
                vec![
                    Box::new(format!("{fragment_name} @dangerously_unaliased_fixme")),
                    Box::new(format!("{fragment_name} @alias")),
                ]
            }
            ValidationMessageWithData::ExpectedAliasOnNonSubtypeSpreadWithinTypedInlineFragment {
                fragment_name, ..
            } => {
                vec![
                    Box::new(format!("{fragment_name} @dangerously_unaliased_fixme")),
                    Box::new(format!("{fragment_name} @alias")),
                ]
            }
            ValidationMessageWithData::ExpectedAliasOnConditionalFragmentSpread {
                fragment_name,
                ..
            } => {
                vec![
                    Box::new(format!("{fragment_name} @dangerously_unaliased_fixme")),
                    Box::new(format!("{fragment_name} @alias")),
                ]
            }
            ValidationMessageWithData::CodemodCustomErrorWithFix { fix, .. } => {
                vec![Box::new(fix.to_owned())]
            }
        }
    }
}
