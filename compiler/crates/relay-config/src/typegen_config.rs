/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

use std::path::PathBuf;

use common::ScalarName;
use fnv::FnvBuildHasher;
use indexmap::IndexMap;
use intern::string_key::Intern;
use intern::string_key::StringKey;
use schemars::JsonSchema;
use serde::Deserialize;
use serde::Serialize;
use strum::EnumIter;
use strum::IntoEnumIterator;

type FnvIndexMap<K, V> = IndexMap<K, V, FnvBuildHasher>;

#[derive(
    EnumIter,
    strum::Display,
    Debug,
    Copy,
    Clone,
    Serialize,
    Deserialize,
    PartialEq,
    JsonSchema
)]
#[serde(deny_unknown_fields, rename_all = "lowercase")]
pub enum TypegenLanguage {
    JavaScript,
    TypeScript,
    Flow,
}

impl TypegenLanguage {
    pub fn get_variants_as_string() -> Vec<String> {
        let mut res = vec![];
        for lang in Self::iter() {
            res.push(lang.to_string().to_lowercase());
        }
        res
    }
}

#[derive(
    EnumIter,
    strum::Display,
    Debug,
    Default,
    Clone,
    Copy,
    Serialize,
    Deserialize,
    PartialEq,
    Eq,
    JsonSchema
)]
#[serde(deny_unknown_fields, rename_all = "lowercase")]
pub enum OneOfGeneration {
    /// Will generate a union type, which can have only a single property set
    #[default]
    Strict,
    /// Will exhibit previous behaviour, where @oneOf types would generate a
    /// permissive object type that may include all, none, or some of the
    /// properties set
    Ignore,
}

/// Defines a custom GraphQL
/// descrbing a custom scalar.
#[derive(Debug, Serialize, Deserialize, Clone, JsonSchema, Hash, PartialEq, Eq)]
#[serde(untagged)]
pub enum CustomType {
    /// A string representing the name of a custom type. e.g. "string" or "number"
    Name(StringKey),
    /// A module which defines the custom type. e.g. { "name": "MyCustomType", "path": "./Types.ts" }
    Path(CustomTypeImport),
}

/// Defines a module path and export name of the Flow or TypeScript type
/// descrbing a GraphQL custom scalar.
#[derive(Debug, Serialize, Deserialize, Clone, JsonSchema, Hash, PartialEq, Eq)]
pub struct CustomTypeImport {
    /// The name under which the type is exported from the module
    pub name: StringKey,
    /// The path to the module relative to the project root
    pub path: PathBuf,
}

/// Describes the type to import and use as the context for Relay Resolvers.
#[derive(Debug, Serialize, Deserialize, Clone, JsonSchema)]
#[serde(untagged)]
pub enum ResolverContextTypeInput {
    /// The type imported using a relative path
    Path(ResolverContextTypeInputPath),
    /// The type imported using a named package
    Package(ResolverContextTypeInputPackage),
}

/// Specifies how Relay can import the Resolver context type from a path
#[derive(Debug, Serialize, Deserialize, Clone, JsonSchema)]
pub struct ResolverContextTypeInputPath {
    /// The name under which the type is exported from the module
    pub name: StringKey,
    /// The path to the module relative to the project root
    pub path: PathBuf,
}

/// Specifies how Relay can import the Resolver context type from a named package
#[derive(Debug, Serialize, Deserialize, Clone, JsonSchema)]
pub struct ResolverContextTypeInputPackage {
    /// The name under which the type is exported from the package
    pub name: StringKey,
    /// The name of the package
    pub package: StringKey,
}

#[derive(Debug, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub struct TypegenConfig {
    /// The desired output language, "flow" or "typescript".
    pub language: TypegenLanguage,

    /// # For Flow type generation
    /// When set, enum values are imported from a module with this suffix.
    /// For example, an enum Foo and this property set to ".test" would be
    /// imported from "Foo.test".
    /// Note: an empty string is allowed and different from not setting the
    /// value, in the example above it would just import from "Foo".
    pub enum_module_suffix: Option<String>,

    /// # For Flow type generation
    /// When set, generated input types will have the listed fields optional
    /// even if the schema defines them as required.
    #[serde(default)]
    pub optional_input_fields: Vec<StringKey>,

    /// # For Typescript type generation
    /// Whether to use the `import type` syntax introduced in Typescript
    /// version 3.8. This will prevent warnings from `importsNotUsedAsValues`.
    #[serde(default)]
    pub use_import_type_syntax: bool,

    /// A map from GraphQL scalar types to a custom JS type, example:
    /// { "Url": "String" }
    /// { "Url": {"name:: "MyURL", "path": "../src/MyUrlTypes"} }
    #[serde(default)]
    pub custom_scalar_types: FnvIndexMap<ScalarName, CustomType>,

    /// Require all GraphQL scalar types mapping to be defined, will throw
    /// if a GraphQL scalar type doesn't have a JS type
    #[serde(default)]
    pub require_custom_scalar_types: bool,

    /// This option controls whether or not a catch-all entry is added to enum type definitions
    /// for values that may be added in the future. Enabling this means you will have to update
    /// your application whenever the GraphQL server schema adds new enum values to prevent it
    /// from breaking.
    #[serde(default)]
    pub no_future_proof_enums: bool,

    /// This option enables opting out of emitting es modules artifacts. When
    /// set to false, Relay will emit CommonJS modules.
    #[serde(default = "get_true")]
    pub eager_es_modules: bool,

    /// Keep the previous compiler behavior by outputting an union
    /// of the raw type and null, and not the **correct** behavior
    /// of an union with the raw type, null and undefined.
    #[serde(default)]
    pub typescript_exclude_undefined_from_nullable_union: bool,

    /// A map from GraphQL error name to import path, example:
    /// {"name:: "MyErrorName", "path": "../src/MyError"}
    pub custom_error_type: Option<CustomTypeImport>,

    /// The consumer-visible type of a Resolver-authored `RelayRscValue`.
    /// For example: "unknown" or {"name": "ReactNode", "path": "react"}.
    /// Defaults to `ReactNode` imported from `react` when omitted; Flow output
    /// uses the equivalent global `React$Node` for that default.
    #[serde(default = "default_rsc_node_type")]
    pub rsc_node_type: Option<CustomType>,

    /// Indicates the type to import and use as the context for Relay Resolvers.
    #[serde(default)]
    pub resolver_context_type: Option<ResolverContextTypeInput>,

    /// How to generate a type for an input object marked as @oneOf.
    /// Defaults to "strict", which is to generate a union type which
    /// permits only a single property being set at a time. "ignore"
    /// generates the type as if the @oneOf annotation does not exist.
    #[serde(default)]
    pub one_of_type: OneOfGeneration,
}

fn get_true() -> bool {
    true
}

fn default_rsc_node_type() -> Option<CustomType> {
    Some(CustomType::Path(CustomTypeImport {
        name: "ReactNode".intern(),
        path: "react".into(),
    }))
}

impl Default for TypegenConfig {
    fn default() -> Self {
        TypegenConfig {
            language: TypegenLanguage::JavaScript,
            enum_module_suffix: Default::default(),
            optional_input_fields: Default::default(),
            use_import_type_syntax: Default::default(),
            custom_scalar_types: Default::default(),
            require_custom_scalar_types: Default::default(),
            no_future_proof_enums: Default::default(),
            eager_es_modules: Default::default(),
            typescript_exclude_undefined_from_nullable_union: Default::default(),
            custom_error_type: None,
            rsc_node_type: default_rsc_node_type(),
            resolver_context_type: Default::default(),
            one_of_type: Default::default(),
        }
    }
}
