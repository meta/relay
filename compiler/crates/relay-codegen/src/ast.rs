/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

use fnv::FnvBuildHasher;
use graphql_ir::ExecutableDefinitionName;
use graphql_syntax::FloatValue;
use graphql_syntax::OperationKind;
use indexmap::IndexSet;
use intern::string_key::StringKey;
use relay_config::ModuleProvider;

#[derive(Eq, PartialEq, Hash, Debug)]
pub struct ObjectEntry {
    pub key: StringKey,
    pub value: Primitive,
}

/// A helper for creating `Vec<ObjectEntry>`
/// For now, field names are defined in `CODEGEN_CONSTANTS
#[macro_export]
macro_rules! object {
    { $ ( $(:$func: expr,)* $key:ident: $value:expr,)* } => ({
        vec![
            $(
                $(
                    $func,
                )*
                ObjectEntry {
                    key: CODEGEN_CONSTANTS.$key,
                    value: $value,
                },
            )*
        ]
    })
}

/// An interned codegen AST
#[derive(Eq, PartialEq, Hash, Debug)]
pub enum Ast {
    Object(Vec<ObjectEntry>),
    Array(Vec<Primitive>),
}

impl Ast {
    pub fn assert_object(&self) -> &[ObjectEntry] {
        match self {
            Ast::Object(result) => result,
            Ast::Array(_) => panic!("Expected an object"),
        }
    }

    pub fn assert_array(&self) -> &[Primitive] {
        match self {
            Ast::Object(_) => panic!("Expected an array"),
            Ast::Array(result) => result,
        }
    }
}

#[derive(Clone, PartialEq, Eq, PartialOrd, Ord, Hash, Debug)]
pub enum ModuleImportName {
    Default(StringKey),
    Named {
        name: StringKey,
        import_as: Option<StringKey>,
    },
}

#[derive(Eq, PartialEq, Hash, PartialOrd, Ord, Debug, Clone)]
pub struct JSModuleDependency {
    pub path: StringKey,
    pub import_name: ModuleImportName,
}

#[derive(Eq, PartialEq, Hash, PartialOrd, Ord, Debug, Clone)]
pub struct ResolverModuleReference {
    pub field_type: StringKey,
    pub resolver_function_name: ModuleImportName,
}

#[derive(Eq, PartialEq, Hash, Debug)]
pub enum JSModule {
    Reference(ResolverModuleReference),
    Dependency(JSModuleDependency),
}

#[derive(Eq, PartialEq, Hash, PartialOrd, Ord, Debug, Clone)]
pub enum GraphQLModuleDependency {
    Name(ExecutableDefinitionName),
    Path {
        name: ExecutableDefinitionName,
        path: StringKey,
    },
}

#[derive(Eq, PartialEq, Hash, Debug)]
pub enum Primitive {
    Key(AstKey),
    Variable(StringKey),
    String(StringKey),
    Float(FloatValue),
    Int(i64),
    Bool(bool),
    Null,
    StorageKey(StringKey, AstKey),
    RawString(String),
    GraphQLModuleDependency(GraphQLModuleDependency),
    JSModuleDependency(JSModuleDependency),
    ResolverModuleReference(ResolverModuleReference),

    // Don't include the value in the output when
    // skip_printing_nulls is enabled
    SkippableNull,
    DynamicImport {
        provider: ModuleProvider,
        module: StringKey,
    },
    /// An accessor function for a property on the model object.
    /// Printed as `(o) => o.{property_name}`.
    PropertyAccessor(String),
    RelayResolverModel {
        graphql_module_name: StringKey,
        graphql_module_path: StringKey,
        resolver_fn: Box<Primitive>,
        injected_field_name_details: Option<(StringKey, bool)>,
    },
}

impl Primitive {
    pub fn assert_string(&self) -> StringKey {
        if let Primitive::String(key) = self {
            *key
        } else {
            panic!("Expected a string");
        }
    }

    pub fn assert_key(&self) -> AstKey {
        if let Primitive::Key(key) = self {
            *key
        } else {
            panic!("Expected a key");
        }
    }

    pub fn string_or_null(str: Option<StringKey>) -> Primitive {
        match str {
            None => Primitive::Null,
            Some(str) => Primitive::String(str),
        }
    }
}

#[derive(Eq, PartialEq, Hash, Copy, Clone, Debug)]
pub struct AstKey(usize);

impl AstKey {
    pub fn as_usize(self) -> usize {
        self.0
    }
}

#[derive(Default)]
pub struct AstBuilder {
    table: IndexSet<Ast, FnvBuildHasher>,
}

impl AstBuilder {
    pub fn intern(&mut self, ast: Ast) -> AstKey {
        AstKey(self.table.insert_full(ast).0)
    }

    pub fn lookup(&self, key: AstKey) -> &Ast {
        self.table.get_index(key.as_usize()).unwrap()
    }
}

#[derive(Clone)]
pub enum QueryID {
    Persisted { id: String, text_hash: String },
    External(StringKey),
}

pub struct RequestParameters<'a> {
    pub id: Option<&'a QueryID>,
    pub name: StringKey,
    pub operation_kind: OperationKind,
    /// For an `@exec_time_resolvers` operation with server text: the variables
    /// that text declares, in declaration order. The text's transforms strip
    /// client selections and then unused variables, so an input that only
    /// client code reads is never listed. Empty when the text declares none.
    pub server_variables: Option<&'a [StringKey]>,
    pub text: Option<String>,
}

impl RequestParameters<'_> {
    pub fn is_client_request(&self) -> bool {
        self.id.is_none() && self.text.is_none()
    }
}
