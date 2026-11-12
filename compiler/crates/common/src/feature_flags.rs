/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

use std::fmt::Display;
use std::fmt::Formatter;
use std::fmt::Result as FmtResult;

use indexmap::IndexSet;
use intern::Lookup;
use intern::string_key::StringKey;
use schemars::JsonSchema;
use schemars::Schema;
use schemars::SchemaGenerator;
use schemars::json_schema;
use serde::Deserialize;
use serde::Deserializer;
use serde::Serialize;
use serde::de;
use serde::de::MapAccess;
use serde::de::Visitor;
use serde::de::value::MapAccessDeserializer;

use crate::Rollout;
use crate::rollout::RolloutRange;

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct FeatureFlags {
    #[serde(default)]
    /// Enable returning interfaces from Relay Resolvers without @outputType
    pub relay_resolver_enable_interface_output_type: FeatureFlag,

    #[serde(default)]
    /// @outputType resolvers are a discontinued experimental feature. This flag
    /// allows users to allowlist old uses of this feature while they work to
    /// remove them. Weak types (types without an `id` field) returned by a Relay
    /// Resolver should be limited to types defined using `@RelayResolver` with `@weak`.
    ///
    /// If using the "limited" feature flag variant, users can allowlist a
    /// specific list of field names.
    ///
    /// https://relay.dev/docs/next/guides/relay-resolvers/defining-types/#defining-a-weak-type
    pub allow_output_type_resolvers: FeatureFlag,

    /// For now, this also disallows fragments with variable definitions
    /// This also makes @module to opt in using @no_inline internally
    /// NOTE that the presence of a fragment in this list only controls whether a fragment is *allowed* to
    /// use @no_inline: whether the fragment is inlined or not depends on whether it actually uses that
    /// directive.
    #[serde(default)]
    pub no_inline: FeatureFlag,

    #[serde(default)]
    pub enable_3d_branch_arg_generation: bool,

    /// Enable generation of text artifacts used to generate full query strings
    /// later.
    #[serde(default)]
    pub text_artifacts: FeatureFlag,

    /// Shard generated extra artifacts into subdirectories under
    /// `extraArtifactsOutput` that mirror the source file's relative path,
    /// honoring `shardOutput` / `shardStripRegex`.
    #[serde(default)]
    pub shard_extra_artifacts: FeatureFlag,

    #[serde(default)]
    pub skip_printing_nulls: FeatureFlag,

    /// Enforce that you must add `@alias` to a fragment if it may not match,
    /// due to type mismatch or `@skip`/`@include`
    #[serde(default = "enabled_feature_flag")]
    pub enforce_fragment_alias_where_ambiguous: FeatureFlag,

    /// Print queries in compact form
    #[serde(default)]
    pub compact_query_text: FeatureFlag,

    /// Fully build the normalization AST for Resolvers
    #[serde(default)]
    pub enable_resolver_normalization_ast: bool,

    /// Allow per-query opt in to normalization AST for Resolvers with exec_time_resolvers
    /// directive. In contrast to enable_resolver_normalization_ast, if this is true, a
    /// normalization AST can be generated for a query using the @exec_time_resolvers directive
    #[serde(default)]
    pub enable_exec_time_resolvers_directive: bool,

    /// Allow relay resolvers to extend the Mutation type
    #[serde(default)]
    pub enable_relay_resolver_mutations: bool,

    /// Enable Relay React Server Component compilation for this project.
    /// Host-specific behavior is configured through `relayRsc`.
    #[serde(default)]
    pub enable_relay_rsc: bool,

    /// Perform strict validations when custom scalar types are used
    #[serde(default)]
    pub enable_strict_custom_scalars: bool,

    /// Relay Resolvers are a read-time feature that are not actually handled in
    /// our mutation APIs. We are in the process of removing any existing
    /// examples, but this flag is part of a process of removing any existing
    /// examples.
    #[serde(default)]
    pub allow_resolvers_in_mutation_response: FeatureFlag,

    /// @required with an action of THROW is read-time feature that is not
    /// compatible with our mutation APIs. We are in the process of removing
    /// any existing examples, but this flag is part of a process of removing
    /// any existing examples.
    #[serde(default)]
    pub allow_required_in_mutation_response: FeatureFlag,

    /// Mirror of `enable_resolver_normalization_ast`
    /// excludes resolver metadata from reader ast
    #[serde(default)]
    pub disable_resolver_reader_ast: bool,

    /// Add support for parsing and transforming variable definitions on fragment
    /// definitions and arguments on fragment spreads.
    #[serde(default)]
    pub enable_fragment_argument_transform: bool,

    /// Allow non-nullable return types from resolvers.
    #[serde(default)]
    pub allow_resolver_non_nullable_return_type: FeatureFlag,

    /// Disable validating the composite schema (server, client schema
    /// extensions, Relay Resolvers) after it's built.
    ///
    /// The limited and rollout variants are keyed by schema coordinate and
    /// disable validation for those coordinates only: `Type` skips every check
    /// on that type, and `Type.field` skips the checks on that field, including
    /// whether it satisfies the interfaces `Type` implements. The rest of the
    /// schema is still validated.
    ///
    /// An entry of a limited allowlist that skips no error is reported as an
    /// error, so the allowlist shrinks as the errors behind it are fixed.
    ///
    /// `true` and `false` are accepted for the enabled and disabled variants.
    #[serde(default, deserialize_with = "deserialize_bool_or_feature_flag")]
    #[schemars(schema_with = "bool_or_feature_flag_schema")]
    pub disable_schema_validation: FeatureFlag,

    /// Feature flag to prefer `fetch_MyType()` generatior over `node()` query generator
    /// in @refetchable transform
    #[serde(default)]
    pub prefer_fetchable_in_refetch_queries: bool,

    /// Disable validation of the `edgeTypeName` argument on `@prependNode` and `@appendNode`.
    #[serde(default)]
    pub disable_edge_type_name_validation_on_declerative_connection_directives: FeatureFlag,

    /// Disable full GraphQL argument type validation. Historically, we only applied argument type
    /// validation to the query that was actually going to be persisted and sent
    /// to the server. This meant that we didn't typecheck arguments passed to
    /// Relay Resolvers or Client Schema Extensions.
    ///
    /// We also permitted an escape hatch of `uncheckedArguments_DEPRECATED` for
    /// defining fragment arguments which were not typechecked.
    ///
    /// We no-longer support `uncheckedArguments_DEPRECATED`, and we typecheck
    /// both client and server arguments. This flag allows you to opt out of
    /// this new behavior to enable gradual adoption of the new validations.
    ///
    /// This flag will be removed in a future version of Relay.
    #[serde(default)]
    pub disable_full_argument_type_validation: FeatureFlag,

    /// Generate the `moduleImports` field in the Reader AST.
    #[serde(default)]
    pub use_reader_module_imports: FeatureFlag,

    /// Skip generating resolver type assertions for resolvers which have
    /// been derived from TS/Flow types.
    #[serde(default)]
    pub omit_resolver_type_assertions_for_confirmed_types: FeatureFlag,

    /// Skip the optimization which extracts common JavaScript structures in
    /// generated artifacts into numbered variables and uses them by reference
    /// in each position in which they occur.
    ///
    /// This optimization can make it hard to follow changes to generated
    /// code, so being able to disable it can be helpful for debugging.
    ///
    /// To disable deduping for just one fragment or operation's generated
    /// artifacts:
    ///
    /// ```json
    /// "disable_deduping_common_structures_in_artifacts": {
    ///   { "kind": "limited", "allowList": ["<operation_or_fragment_name>"] }
    /// }
    /// ```
    #[serde(default)]
    pub disable_deduping_common_structures_in_artifacts: FeatureFlag,

    /// Temporarily gate the rollout of structural deduplication in generated
    /// raw response types. This flag can be removed once every project has
    /// regenerated its artifacts with the optimization enabled.
    #[serde(default)]
    pub dedupe_common_structures_in_raw_response_types: FeatureFlag,

    /// Skip the optimization which extracts common structures in generated
    /// raw response types into private type aliases and uses them by reference
    /// in each position in which they occur.
    ///
    /// This optimization can make it hard to follow changes to generated
    /// types, so being able to disable it can be helpful for debugging.
    #[serde(default)]
    pub disable_deduping_common_structures_in_raw_response_types: FeatureFlag,

    /// Disallow @required action THROW on semantically nullable fields.
    /// When enabled, this will prevent the use of THROW action on fields
    /// that are semantically nullable (e.g., fields that can legitimately
    /// be null in normal operation).
    #[serde(default)]
    pub disallow_required_action_throw_on_semantically_nullable_fields: FeatureFlag,

    /// Enable experimental support for shadow resolvers. Shadow resolvers allow
    /// defining a Relay Resolver that "shadows" an existing server field,
    /// providing an alternative implementation that can be used during
    /// migration or for client-side overrides.
    #[serde(default)]
    pub enable_shadow_resolvers: FeatureFlag,

    /// When enabled for a given name, allows `@RelayResolver` as a legacy
    /// alias for `@relayType` / `@relayField`.
    #[serde(default)]
    pub allow_legacy_relay_resolver_tag: FeatureFlag,

    /// Enforce that GraphQL operation and fragment names start with the file
    /// name. Haste projects have this enforcement automatically; this flag
    /// is only needed for non-Haste projects that want the same validation.
    #[serde(default)]
    pub enforce_module_name_prefix_for_non_haste: bool,

    /// Disable the generation of a more precise raw response type
    /// for selections on abstract types.
    #[serde(default)]
    pub disable_more_precise_abstract_selection_raw_response_type: FeatureFlag,

    /// Automatically add `__typename` selections that enable typegen to emit
    /// discriminated unions for selections on abstract types. Limited and
    /// rollout variants are keyed by operation or fragment definition name.
    #[serde(default)]
    pub enable_typename_discriminated_unions: FeatureFlag,

    /// TypeScript only. Changes how you write GraphQL documents, and in
    /// return gives you type safety without generics.
    ///
    /// Documents move to the call form, ``graphql(`...`)``, which becomes the
    /// required spelling for the project -- the tagged template
    /// `` graphql`...` `` becomes an error. `relay codemod fix-all` rewrites
    /// existing documents for you.
    ///
    /// In exchange, `useLazyLoadQuery` and `useFragment` take their variable
    /// and response types from the literal itself, so they no longer need an
    /// explicit type argument or an import of the generated artifact.
    ///
    /// Only the spelling has to change. A call site that already passes an
    /// explicit type argument, `useLazyLoadQuery<FooQuery>(...)`, keeps
    /// compiling as-is; the argument just stops being necessary. The one
    /// exception is `useFragment<Foo$key>(...)`, which has to drop its type
    /// argument -- `useFragment` infers the key from the ref it is given, so
    /// that argument was always redundant.
    ///
    /// Limited and rollout variants are keyed by operation or fragment
    /// definition name, and stage only the typing -- the call form is required
    /// throughout the project either way.
    #[serde(default)]
    pub emit_document_type_registry: FeatureFlag,

    /// Generate the `id` field of strong Relay Resolver model types as
    /// `ID @semanticNonNull` rather than `ID!`, so the model can implement an
    /// interface alongside server types whose `id` is `ID @semanticNonNull`.
    /// Limited and rollout variants are keyed by model type name.
    #[serde(default)]
    pub relay_resolver_model_semantic_non_null_id: FeatureFlag,

    /// Remove inline fragments on an object type from normalization ASTs when
    /// the record they apply to is known to be of a different object type,
    /// such as the branches for other implementors left when a fragment on an
    /// abstract type is spread into a field of an object type. Limited and
    /// rollout variants are keyed by operation name, which for a split
    /// operation is `<Fragment>$normalization`.
    #[serde(default)]
    pub skip_impossible_inline_fragments: FeatureFlag,

    /// Server interfaces and unions that client-defined types (Relay Resolver
    /// types and client schema extension types) implement or join. The
    /// compiler records those types in `clientAbstractTypes`, and in
    /// operations that run at exec time reads each type's own resolvers
    /// through the interface's fields; it never lists the server's members,
    /// which the server can add to without a client compile. Limited and
    /// rollout variants are keyed by the server interface or union name.
    #[serde(default)]
    pub enable_client_implementors_of_server_abstract_types: FeatureFlag,
}

impl Default for FeatureFlags {
    fn default() -> Self {
        FeatureFlags {
            relay_resolver_enable_interface_output_type: Default::default(),
            allow_output_type_resolvers: Default::default(),
            no_inline: Default::default(),
            enable_3d_branch_arg_generation: Default::default(),
            text_artifacts: Default::default(),
            shard_extra_artifacts: Default::default(),
            skip_printing_nulls: Default::default(),
            compact_query_text: Default::default(),
            enable_resolver_normalization_ast: Default::default(),
            enable_exec_time_resolvers_directive: Default::default(),
            enable_relay_resolver_mutations: Default::default(),
            enable_relay_rsc: Default::default(),
            enable_strict_custom_scalars: Default::default(),
            allow_resolvers_in_mutation_response: Default::default(),
            allow_required_in_mutation_response: Default::default(),
            disable_resolver_reader_ast: Default::default(),
            enable_fragment_argument_transform: Default::default(),
            allow_resolver_non_nullable_return_type: Default::default(),
            disable_schema_validation: Default::default(),
            prefer_fetchable_in_refetch_queries: Default::default(),
            disable_edge_type_name_validation_on_declerative_connection_directives:
                Default::default(),
            disable_full_argument_type_validation: Default::default(),
            use_reader_module_imports: Default::default(),
            omit_resolver_type_assertions_for_confirmed_types: Default::default(),
            disable_deduping_common_structures_in_artifacts: Default::default(),
            dedupe_common_structures_in_raw_response_types: Default::default(),
            disable_deduping_common_structures_in_raw_response_types: Default::default(),
            disallow_required_action_throw_on_semantically_nullable_fields: Default::default(),
            enable_shadow_resolvers: Default::default(),
            allow_legacy_relay_resolver_tag: Default::default(),
            enforce_module_name_prefix_for_non_haste: Default::default(),
            disable_more_precise_abstract_selection_raw_response_type: Default::default(),
            enable_typename_discriminated_unions: Default::default(),
            emit_document_type_registry: Default::default(),
            relay_resolver_model_semantic_non_null_id: Default::default(),
            skip_impossible_inline_fragments: Default::default(),
            enable_client_implementors_of_server_abstract_types: Default::default(),

            // enabled-by-default
            enforce_fragment_alias_where_ambiguous: FeatureFlag::Enabled,
        }
    }
}

#[derive(
    Debug,
    serde::Deserialize,
    Clone,
    Serialize,
    Default,
    PartialEq,
    JsonSchema
)]
#[serde(tag = "kind", rename_all = "lowercase")]
pub enum FeatureFlag {
    /// Fully disabled: developers may not use this feature
    #[default]
    Disabled,

    /// Fully enabled: developers may use this feature
    Enabled,

    /// Partially enabled: developers may only use this feature on the listed items (fragments, fields, types).
    Limited { allowlist: IndexSet<StringKey> },

    /// Partially enabled: used for gradual rollout of the feature
    Rollout { rollout: Rollout },

    /// Partially enabled: used for gradual rollout of the feature
    RolloutRange { rollout: RolloutRange },
}

/// Used for making feature flags enabled by default via Serde's default attribute.
fn enabled_feature_flag() -> FeatureFlag {
    FeatureFlag::Enabled
}

/// Deserializes a feature flag that also accepts `true` and `false` for the
/// enabled and disabled variants, so that a boolean flag can become a feature
/// flag without breaking existing configs.
fn deserialize_bool_or_feature_flag<'de, D>(deserializer: D) -> Result<FeatureFlag, D::Error>
where
    D: Deserializer<'de>,
{
    struct BoolOrFeatureFlagVisitor;

    impl<'de> Visitor<'de> for BoolOrFeatureFlagVisitor {
        type Value = FeatureFlag;

        fn expecting(&self, formatter: &mut Formatter<'_>) -> FmtResult {
            formatter.write_str("a boolean or a feature flag object")
        }

        fn visit_bool<E>(self, value: bool) -> Result<FeatureFlag, E>
        where
            E: de::Error,
        {
            Ok(if value {
                FeatureFlag::Enabled
            } else {
                FeatureFlag::Disabled
            })
        }

        fn visit_map<A>(self, map: A) -> Result<FeatureFlag, A::Error>
        where
            A: MapAccess<'de>,
        {
            FeatureFlag::deserialize(MapAccessDeserializer::new(map))
        }
    }

    deserializer.deserialize_any(BoolOrFeatureFlagVisitor)
}

/// JSON schema of the values `deserialize_bool_or_feature_flag` accepts.
fn bool_or_feature_flag_schema(generator: &mut SchemaGenerator) -> Schema {
    json_schema!({
        "anyOf": [
            { "type": "boolean" },
            generator.subschema_for::<FeatureFlag>(),
        ]
    })
}

impl FeatureFlag {
    pub fn is_enabled_for(&self, name: StringKey) -> bool {
        match self {
            FeatureFlag::Enabled => true,
            FeatureFlag::Limited { allowlist } => allowlist.contains(&name),
            FeatureFlag::Rollout { rollout } => rollout.check(name.lookup()),
            FeatureFlag::RolloutRange { rollout } => rollout.check(name.lookup()),
            FeatureFlag::Disabled => false,
        }
    }

    pub fn is_fully_enabled(&self) -> bool {
        matches!(self, FeatureFlag::Enabled)
    }
}

impl Display for FeatureFlag {
    fn fmt(&self, f: &mut Formatter<'_>) -> FmtResult {
        match self {
            FeatureFlag::Disabled => f.write_str("disabled"),
            FeatureFlag::Enabled => f.write_str("enabled"),
            FeatureFlag::Limited { allowlist } => {
                let items: Vec<_> = allowlist.iter().map(|x| x.lookup()).collect();
                f.write_str("limited to: ")?;
                f.write_str(&items.join(", "))
            }
            FeatureFlag::Rollout { rollout } => write!(f, "Rollout: {rollout:#?}"),
            FeatureFlag::RolloutRange { rollout } => write!(f, "RolloutRange: {rollout:#?}"),
        }
    }
}

#[cfg(test)]
mod tests {
    use intern::string_key::Intern;
    use serde_json::Value;
    use serde_json::json;

    use super::*;

    #[test]
    fn default_trait_sets_enforce_fragment_alias_enabled() {
        let flags = FeatureFlags::default();
        assert!(matches!(
            flags.enforce_fragment_alias_where_ambiguous,
            FeatureFlag::Enabled
        ));
        // A couple of quick sanity checks for other defaults
        assert!(matches!(flags.no_inline, FeatureFlag::Disabled));
        assert!(matches!(
            flags.enable_typename_discriminated_unions,
            FeatureFlag::Disabled
        ));
        assert!(!flags.enable_resolver_normalization_ast);
    }

    #[test]
    fn serde_empty_object_deserializes_to_default() {
        // When deserializing from an empty JSON object, serde applies per-field defaults.
        let flags: FeatureFlags = serde_json::from_str("{} ").expect("valid json");
        assert_eq!(flags, FeatureFlags::default());
    }

    fn deserialize_disable_schema_validation(value: Value) -> Result<FeatureFlag, String> {
        serde_json::from_value::<FeatureFlags>(json!({ "disable_schema_validation": value }))
            .map(|flags| flags.disable_schema_validation)
            .map_err(|error| error.to_string())
    }

    #[test]
    fn disable_schema_validation_accepts_booleans() {
        assert_eq!(
            deserialize_disable_schema_validation(json!(true)),
            Ok(FeatureFlag::Enabled),
            "`true` should mean the enabled variant"
        );
        assert_eq!(
            deserialize_disable_schema_validation(json!(false)),
            Ok(FeatureFlag::Disabled),
            "`false` should mean the disabled variant"
        );
    }

    #[test]
    fn disable_schema_validation_accepts_feature_flags() {
        let flag = deserialize_disable_schema_validation(json!({
            "kind": "limited",
            "allowlist": ["User.name"]
        }))
        .expect("a limited feature flag should be accepted");
        assert!(flag.is_enabled_for("User.name".intern()));
        assert!(
            !flag.is_enabled_for("User.id".intern()),
            "only the allowlisted coordinate should be enabled"
        );
    }

    #[test]
    fn disable_schema_validation_reports_invalid_values() {
        let error = deserialize_disable_schema_validation(json!({ "kind": "limited" }))
            .expect_err("a limited feature flag needs an allowlist");
        assert!(error.contains("missing field `allowlist`"), "{error}");

        let error = deserialize_disable_schema_validation(json!("yes"))
            .expect_err("a string is neither a boolean nor a feature flag");
        assert!(
            error.contains("expected a boolean or a feature flag object"),
            "{error}"
        );
    }

    #[test]
    fn disable_schema_validation_round_trips() {
        let flags = FeatureFlags {
            disable_schema_validation: FeatureFlag::Limited {
                allowlist: ["User.name".intern()].into_iter().collect(),
            },
            ..Default::default()
        };
        let serialized = serde_json::to_value(&flags).expect("flags should serialize");
        let deserialized: FeatureFlags =
            serde_json::from_value(serialized).expect("serialized flags should deserialize");
        assert_eq!(deserialized, flags);
    }
}
