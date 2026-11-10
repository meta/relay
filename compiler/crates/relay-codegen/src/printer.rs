/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

use std::borrow::Borrow;
use std::borrow::Cow;
use std::fmt::Result as FmtResult;
use std::fmt::Write;
use std::path::Path;

use fnv::FnvBuildHasher;
use fnv::FnvHashSet;
use graphql_ir::ExecutableDefinitionName;
use graphql_ir::FragmentDefinition;
use graphql_ir::OperationDefinition;
use graphql_ir::reexport::Intern;
use indexmap::IndexMap;
use intern::Lookup;
use intern::string_key::StringKey;
use relay_config::ModuleProvider;
use relay_config::ProjectConfig;
use schema::SDLSchema;

use crate::CodegenBuilder;
use crate::CodegenVariant;
use crate::JsModuleFormat;
use crate::ast::Ast;
use crate::ast::AstBuilder;
use crate::ast::AstKey;
use crate::ast::GraphQLModuleDependency;
use crate::ast::JSModuleDependency;
use crate::ast::ModuleImportName;
use crate::ast::ObjectEntry;
use crate::ast::Primitive;
use crate::ast::RequestParameters;
use crate::ast::ResolverModuleReference;
use crate::build_ast::build_fragment;
use crate::build_ast::build_operation;
use crate::build_ast::build_preloadable_request;
use crate::build_ast::build_provided_variables;
use crate::build_ast::build_request;
use crate::build_ast::build_request_params_ast_key;
use crate::build_ast::build_resolvers_schema;
use crate::constants::CODEGEN_CONSTANTS;
use crate::indentation::print_indentation;
use crate::object;
use crate::top_level_statements::TopLevelStatement;
use crate::top_level_statements::TopLevelStatements;
use crate::utils::escape;

pub fn print_operation(
    schema: &SDLSchema,
    operation: &OperationDefinition,
    project_config: &ProjectConfig,
    top_level_statements: &mut TopLevelStatements,
) -> String {
    Printer::without_dedupe(project_config).print_operation(schema, operation, top_level_statements)
}

pub fn print_fragment(
    schema: &SDLSchema,
    fragment: &FragmentDefinition,
    project_config: &ProjectConfig,
    top_level_statements: &mut TopLevelStatements,
) -> String {
    Printer::without_dedupe(project_config).print_fragment(schema, fragment, top_level_statements)
}

pub fn print_request(
    schema: &SDLSchema,
    operation: &OperationDefinition,
    fragment: &FragmentDefinition,
    request_parameters: RequestParameters<'_>,
    project_config: &ProjectConfig,
    top_level_statements: &mut TopLevelStatements,
) -> String {
    Printer::without_dedupe(project_config).print_request(
        schema,
        operation,
        fragment,
        request_parameters,
        top_level_statements,
    )
}

pub fn print_request_params(
    schema: &SDLSchema,
    operation: &OperationDefinition,
    request_parameters: RequestParameters<'_>,
    project_config: &ProjectConfig,
    top_level_statements: &mut TopLevelStatements,
) -> String {
    let mut builder: AstBuilder = AstBuilder::default();
    let request_parameters_ast_key = build_request_params_ast_key(
        schema,
        request_parameters,
        &mut builder,
        operation,
        operation.name.map(|x| x.0),
        project_config,
    );
    let printer = JSONPrinter::new(
        &builder,
        project_config,
        top_level_statements,
        Some(operation.name.item.0),
    );
    printer.print(request_parameters_ast_key, false)
}

pub fn print_provided_variables(
    schema: &SDLSchema,
    operation: &OperationDefinition,
    project_config: &ProjectConfig,
) -> Option<String> {
    Printer::without_dedupe(project_config).print_provided_variables(schema, operation)
}

pub fn print_resolvers_schema(
    schema: &SDLSchema,
    project_config: &ProjectConfig,
    top_level_statements: &mut TopLevelStatements,
) -> String {
    Printer::without_dedupe(project_config).print_resolvers_schema(schema, top_level_statements)
}

pub struct Printer<'p> {
    project_config: &'p ProjectConfig,
    builder: AstBuilder,
    dedupe: bool,
}

impl<'p> Printer<'p> {
    pub fn with_dedupe(project_config: &'p ProjectConfig) -> Self {
        Self {
            project_config,
            builder: Default::default(),
            dedupe: true,
        }
    }

    pub fn without_dedupe(project_config: &'p ProjectConfig) -> Self {
        Self {
            project_config,
            builder: Default::default(),
            dedupe: false,
        }
    }

    pub fn print_provided_variables(
        &mut self,
        schema: &SDLSchema,
        operation: &OperationDefinition,
    ) -> Option<String> {
        // We do not expect the generate of provided variables object
        // to mutate any top-level statements
        let mut top_level_statements = Default::default();
        let provided_variables = build_provided_variables(
            schema,
            &mut self.builder,
            operation,
            operation.name.map(|x| x.0),
            self.project_config,
        )?;
        let printer = JSONPrinter::new(
            &self.builder,
            self.project_config,
            &mut top_level_statements,
            Some(operation.name.item.0),
        );
        Some(printer.print(
            provided_variables,
            self.should_dedupe(operation.name.item.0),
        ))
    }

    pub fn print_updatable_query(
        &mut self,
        schema: &SDLSchema,
        fragment_definition: &FragmentDefinition,
    ) -> String {
        let mut fragment_builder = CodegenBuilder::new(
            schema,
            CodegenVariant::Reader,
            &mut self.builder,
            self.project_config,
            fragment_definition.name.map(|x| x.0),
        );
        let fragment =
            Primitive::Key(fragment_builder.build_fragment(fragment_definition, true, false));
        let key = self.builder.intern(Ast::Object(object! {
            fragment: fragment,
            kind: Primitive::String(CODEGEN_CONSTANTS.updatable_query),
        }));

        let mut top_level_statements = Default::default();
        let printer = JSONPrinter::new(
            &self.builder,
            self.project_config,
            &mut top_level_statements,
            Some(fragment_definition.name.item.0),
        );
        printer.print(key, self.should_dedupe(fragment_definition.name.item.0))
    }

    pub fn print_request(
        &mut self,
        schema: &SDLSchema,
        operation: &OperationDefinition,
        fragment: &FragmentDefinition,
        request_parameters: RequestParameters<'_>,
        top_level_statements: &mut TopLevelStatements,
    ) -> String {
        let request_parameters = build_request_params_ast_key(
            schema,
            request_parameters,
            &mut self.builder,
            operation,
            operation.name.map(|x| x.0),
            self.project_config,
        );
        let key = build_request(
            schema,
            &mut self.builder,
            operation,
            fragment,
            request_parameters,
            fragment.name.map(|x| x.0),
            self.project_config,
        );
        let printer = JSONPrinter::new(
            &self.builder,
            self.project_config,
            top_level_statements,
            Some(operation.name.item.0),
        );
        printer.print(key, self.should_dedupe(operation.name.item.0))
    }

    pub fn print_preloadable_request(
        &mut self,
        schema: &SDLSchema,
        request_parameters: RequestParameters<'_>,
        operation: &OperationDefinition,
        top_level_statements: &mut TopLevelStatements,
    ) -> String {
        let request_parameters = build_request_params_ast_key(
            schema,
            request_parameters,
            &mut self.builder,
            operation,
            operation.name.map(|x| x.0),
            self.project_config,
        );
        let key = build_preloadable_request(&mut self.builder, request_parameters);
        let printer = JSONPrinter::new(
            &self.builder,
            self.project_config,
            top_level_statements,
            Some(operation.name.item.0),
        );
        printer.print(key, self.should_dedupe(operation.name.item.0))
    }

    pub fn print_operation(
        &mut self,
        schema: &SDLSchema,
        operation: &OperationDefinition,
        top_level_statements: &mut TopLevelStatements,
    ) -> String {
        let key = build_operation(
            schema,
            &mut self.builder,
            operation,
            operation.name.map(|x| x.0),
            self.project_config,
        );
        let printer = JSONPrinter::new(
            &self.builder,
            self.project_config,
            top_level_statements,
            Some(operation.name.item.0),
        );
        printer.print(key, self.should_dedupe(operation.name.item.0))
    }

    pub fn print_fragment(
        &mut self,
        schema: &SDLSchema,
        fragment: &FragmentDefinition,
        top_level_statements: &mut TopLevelStatements,
    ) -> String {
        let key = build_fragment(
            schema,
            &mut self.builder,
            fragment,
            fragment.name.map(|x| x.0),
            self.project_config,
        );
        let printer = JSONPrinter::new(
            &self.builder,
            self.project_config,
            top_level_statements,
            Some(fragment.name.item.0),
        );
        printer.print(key, self.should_dedupe(fragment.name.item.0))
    }

    pub fn print_request_params(
        &mut self,
        schema: &SDLSchema,
        request_parameters: RequestParameters<'_>,
        operation: &OperationDefinition,
        top_level_statements: &mut TopLevelStatements,
    ) -> String {
        let key = build_request_params_ast_key(
            schema,
            request_parameters,
            &mut self.builder,
            operation,
            operation.name.map(|x| x.0),
            self.project_config,
        );
        let printer = JSONPrinter::new(
            &self.builder,
            self.project_config,
            top_level_statements,
            Some(operation.name.item.0),
        );
        printer.print(key, self.should_dedupe(operation.name.item.0))
    }

    pub fn print_resolvers_schema(
        &mut self,
        schema: &SDLSchema,
        top_level_statements: &mut TopLevelStatements,
    ) -> String {
        let key = build_resolvers_schema(&mut self.builder, schema, self.project_config);
        let printer = JSONPrinter::new(
            &self.builder,
            self.project_config,
            top_level_statements,
            None,
        );
        printer.print(key, self.dedupe)
    }

    fn should_dedupe(&self, name: StringKey) -> bool {
        self.dedupe
            && !self
                .project_config
                .feature_flags
                .disable_deduping_common_structures_in_artifacts
                .is_enabled_for(name)
    }
}

type VariableDefinitions = IndexMap<AstKey, String, FnvBuildHasher>;

pub struct JSONPrinter<'b> {
    variable_definitions: VariableDefinitions,
    duplicates: FnvHashSet<AstKey>,
    builder: &'b AstBuilder,
    eager_es_modules: bool,
    js_module_format: JsModuleFormat,
    top_level_statements: &'b mut TopLevelStatements,
    skip_printing_nulls: bool,
    relativize_js_module_paths: bool,
}

impl<'b> JSONPrinter<'b> {
    pub fn new(
        builder: &'b AstBuilder,
        project_config: &ProjectConfig,
        top_level_statements: &'b mut TopLevelStatements,
        _name: Option<StringKey>,
    ) -> Self {
        Self {
            variable_definitions: Default::default(),
            top_level_statements,
            duplicates: Default::default(),
            builder,
            js_module_format: project_config.js_module_format,
            relativize_js_module_paths: project_config.relativize_js_module_paths,
            eager_es_modules: project_config.typegen_config.eager_es_modules,
            skip_printing_nulls: project_config
                .feature_flags
                .skip_printing_nulls
                .is_fully_enabled(),
        }
    }

    pub fn print(mut self, root_key: AstKey, dedupe: bool) -> String {
        if dedupe {
            let mut visited = Default::default();
            self.collect_value_duplicates(&mut visited, root_key);
        }
        let mut result = String::new();
        self.print_ast(&mut result, root_key, 0, false);
        if self.variable_definitions.is_empty() {
            result
        } else {
            let mut with_variables = String::new();
            with_variables.push_str("(function(){\nvar ");
            let last = self.variable_definitions.len() - 1;
            for (i, (_, value)) in self.variable_definitions.drain(..).enumerate() {
                writeln!(
                    &mut with_variables,
                    "v{} = {}{}",
                    i,
                    value,
                    if i == last { ";" } else { "," }
                )
                .unwrap();
            }
            write!(&mut with_variables, "return {result};\n}})()").unwrap();
            with_variables
        }
    }

    /// We don't dedupe in an already deduped AST unless the duplicate
    /// also appears on a subtree that's not a duplicate
    /// Input:
    /// [
    ///     [{a: 1}, {b:2}],
    ///     [{a: 1}, {b:2}],
    ///     {b: 2}
    /// ]
    /// Output:
    /// v0 = {b: 2};
    /// v1 = [{a: 1}, v0];
    fn collect_value_duplicates(&mut self, visited: &mut FnvHashSet<AstKey>, key: AstKey) {
        match self.builder.lookup(key) {
            Ast::Array(array) => {
                if array.is_empty() {
                    return;
                }
                if !visited.insert(key) {
                    self.duplicates.insert(key);
                    return;
                }
                for val in array {
                    if let Primitive::Key(key) = val {
                        self.collect_value_duplicates(visited, *key);
                    }
                }
            }
            Ast::Object(object) => {
                if object.is_empty() {
                    return;
                }
                if !visited.insert(key) {
                    self.duplicates.insert(key);
                    return;
                }
                for entry in object {
                    if let Primitive::Key(key) = entry.value {
                        self.collect_value_duplicates(visited, key);
                    }
                }
            }
        }
    }

    fn print_ast(&mut self, f: &mut String, key: AstKey, indent: usize, is_dedupe_var: bool) {
        // Only use variable references at depth beyond the top level.
        if indent > 0 && self.duplicates.contains(&key) {
            let v = if self.variable_definitions.contains_key(&key) {
                self.variable_definitions.get_full(&key).unwrap().0
            } else {
                let mut variable = String::new();
                self.print_ast(&mut variable, key, 0, true);
                let v = self.variable_definitions.len();
                self.variable_definitions.insert(key, variable);
                v
            };
            return write!(f, "(v{v}/*:: as any*/)").unwrap();
        }

        let ast = self.builder.lookup(key);
        match ast {
            Ast::Object(object) => {
                if object.is_empty() {
                    f.push_str("{}");
                } else {
                    let next_indent = indent + 1;
                    f.push('{');
                    for ObjectEntry { key, value } in object {
                        match value {
                            Primitive::SkippableNull if self.skip_printing_nulls => continue,
                            _ => {}
                        }
                        f.push('\n');
                        print_indentation(f, next_indent);
                        write!(f, "\"{key}\": ").unwrap();
                        self.print_primitive(f, value, next_indent, is_dedupe_var)
                            .unwrap();
                        f.push(',');
                    }
                    f.pop();
                    f.push('\n');
                    print_indentation(f, indent);
                    f.push('}');
                }
            }
            Ast::Array(array) => {
                if array.is_empty() {
                    if is_dedupe_var {
                        // Empty arrays can only have one inferred flow type and then conflict if
                        // used in different places, this is unsound if we would write to them but
                        // this whole module is based on the idea of a read only JSON tree.
                        f.push_str("([]/*:: as any*/)");
                    } else {
                        f.push_str("[]");
                    }
                } else {
                    f.push('[');
                    let next_indent = indent + 1;
                    for value in array {
                        match value {
                            Primitive::SkippableNull if self.skip_printing_nulls => continue,
                            _ => {}
                        }
                        f.push('\n');
                        print_indentation(f, next_indent);
                        self.print_primitive(f, value, next_indent, is_dedupe_var)
                            .unwrap();
                        f.push(',');
                    }
                    f.pop();
                    f.push('\n');
                    print_indentation(f, indent);
                    f.push(']');
                }
            }
        }
    }

    fn print_primitive(
        &mut self,
        f: &mut String,
        primitive: &Primitive,
        indent: usize,
        is_dedupe_var: bool,
    ) -> FmtResult {
        match primitive {
            Primitive::Null | Primitive::SkippableNull => write!(f, "null"),
            Primitive::Bool(b) => write!(f, "{}", if *b { "true" } else { "false" }),
            Primitive::RawString(str) => {
                f.push('\"');
                escape(str, f);
                f.push('\"');
                Ok(())
            }
            Primitive::String(key) => write!(f, "\"{key}\""),
            Primitive::Float(value) => write!(f, "{}", value.as_float()),
            Primitive::Int(value) => write!(f, "{value}"),
            Primitive::Variable(variable_name) => write!(f, "{variable_name}"),
            Primitive::Key(key) => {
                self.print_ast(f, *key, indent, is_dedupe_var);
                Ok(())
            }
            Primitive::StorageKey(field_name, key) => {
                write_static_storage_key(f, self.builder, *field_name, *key)
            }
            Primitive::GraphQLModuleDependency(dependency) => {
                let (variable_name, key): (&ExecutableDefinitionName, &StringKey) = match dependency
                {
                    GraphQLModuleDependency::Name(name) => (
                        name,
                        match name {
                            ExecutableDefinitionName::OperationDefinitionName(operation_name) => {
                                &operation_name.0
                            }
                            ExecutableDefinitionName::FragmentDefinitionName(fragment_name) => {
                                &fragment_name.0
                            }
                        },
                    ),
                    GraphQLModuleDependency::Path { name, path } => (name, path),
                };
                // TODO(sbarag): this specific codepath needs to force-relativize under commonjs.
                // There are likely others.
                self.write_js_dependency(
                    f,
                    ModuleImportName::Default(format!("{variable_name}_graphql").intern()),
                    Cow::Owned(format!(
                        "{}.graphql",
                        self.get_module_path(*key, ModuleOrigin::Artifact)
                    )),
                )
            }
            Primitive::JSModuleDependency(JSModuleDependency { path, import_name }) => self
                .write_js_dependency(
                    f,
                    import_name.clone(),
                    self.get_module_path(*path, ModuleOrigin::SourceFile),
                ),
            Primitive::ResolverModuleReference(ResolverModuleReference {
                field_type,
                resolver_function_name,
            }) => {
                self.write_resolver_module_reference(f, resolver_function_name.clone(), field_type)
            }
            Primitive::DynamicImport { provider, module } => match provider {
                ModuleProvider::JSResource => {
                    self.top_level_statements.insert(
                        "JSResource".to_string(),
                        TopLevelStatement::ImportStatement(JSModuleDependency {
                            path: "JSResource".intern(),
                            import_name: ModuleImportName::Default("JSResource".intern()),
                        }),
                    );
                    write!(f, "() => JSResource('m#{module}')")
                }
                ModuleProvider::Custom { statement } => {
                    f.push_str(&statement.lookup().replace(
                        "<$module>",
                        &self.get_module_path(*module, ModuleOrigin::SourceFile),
                    ));
                    Ok(())
                }
            },
            Primitive::PropertyAccessor(property) => {
                write_arrow_fn(f, &["o/*: any*/"], &format!("o.{property}"))
            }
            Primitive::RelayResolverModel {
                graphql_module_path,
                graphql_module_name,
                resolver_fn,
                injected_field_name_details,
            } => self.write_relay_resolver_model(
                f,
                *graphql_module_name,
                *graphql_module_path,
                resolver_fn,
                injected_field_name_details.as_ref().copied(),
            ),
        }
    }

    fn write_resolver_module_reference(
        &mut self,
        f: &mut String,
        resolver_function_name: ModuleImportName,
        field_type: &StringKey,
    ) -> FmtResult {
        match resolver_function_name {
            ModuleImportName::Default(_) => {
                panic!("Expected a named import for Relay Resolvers")
            }
            ModuleImportName::Named { name, .. } => {
                write!(
                    f,
                    "{{ resolverFunctionName: \"{name}\", fieldType: \"{field_type}\" }}"
                )
            }
        }
    }

    fn write_js_dependency(
        &mut self,
        f: &mut String,
        module_import_name: ModuleImportName,
        path: Cow<'_, str>,
    ) -> FmtResult {
        if self.eager_es_modules {
            let path = path.into_owned();
            let key = match module_import_name {
                ModuleImportName::Default(ref name) => name.to_string(),
                ModuleImportName::Named {
                    ref name,
                    ref import_as,
                } => import_as
                    .map_or_else(|| name.to_string(), |import_name| import_name.to_string()),
            };
            self.top_level_statements.insert(
                key.to_string(),
                TopLevelStatement::ImportStatement(JSModuleDependency {
                    path: path.intern(),
                    import_name: module_import_name,
                }),
            );
            write!(f, "{key}")
        } else {
            match module_import_name {
                ModuleImportName::Default(_) => {
                    write!(f, "require('{path}')")
                }
                ModuleImportName::Named { name, .. } => {
                    write!(f, "require('{path}').{name}")
                }
            }
        }
    }

    fn write_relay_resolver_model(
        &mut self,
        f: &mut String,
        graphql_module_name: StringKey,
        graphql_module_path: StringKey,
        resolver_fn: &Primitive,
        injected_field_name_details: Option<(StringKey, bool)>,
    ) -> FmtResult {
        let relay_runtime_experimental = "relay-runtime/experimental";
        let resolver_data_injector = "resolverDataInjector";

        self.write_js_dependency(
            f,
            ModuleImportName::Named {
                name: resolver_data_injector.intern(),
                import_as: None,
            },
            Cow::Borrowed(relay_runtime_experimental),
        )?;
        write!(f, "(")?;
        self.write_js_dependency(
            f,
            ModuleImportName::Default(format!("{graphql_module_name}_graphql").intern()),
            Cow::Owned(format!(
                "{}.graphql",
                self.get_module_path(graphql_module_path, ModuleOrigin::Artifact)
            )),
        )?;
        write!(f, ", ")?;
        self.print_primitive(f, resolver_fn, 0, false)?;
        if let Some((field_name, is_required_field)) = injected_field_name_details {
            write!(f, ", '{field_name}'")?;
            write!(f, ", {is_required_field}")?;
        }
        write!(f, ")")
    }

    fn get_module_path(&self, key: StringKey, origin: ModuleOrigin) -> Cow<'static, str> {
        match self.js_module_format {
            JsModuleFormat::CommonJS => {
                let path = Path::new(key.lookup());
                let extension = path.extension();

                let has_path_prefix =
                    path.starts_with("./") || path.starts_with("../") || path.starts_with("/");
                // Files generated by Relay must always be relativized, since authors aren't
                // expected to predict the output path.
                let should_relativize = matches!(origin, ModuleOrigin::Artifact)
                    || (self.relativize_js_module_paths && !has_path_prefix);

                if let Some(extension) = extension
                    && (extension == "ts" || extension == "tsx" || extension == "js")
                {
                    let path_without_extension = path.with_extension("");

                    let path_without_extension = path_without_extension
                        .to_str()
                        .expect("could not convert `path_without_extension` to a str");

                    return Cow::Owned(if should_relativize {
                        format!("./{path_without_extension}")
                    } else {
                        path_without_extension.to_string()
                    });
                }
                Cow::Owned(if should_relativize {
                    format!("./{}", key.borrow())
                } else {
                    key.borrow().to_string()
                })
            }
            JsModuleFormat::Haste => Cow::Borrowed(key.lookup()),
        }
    }
}

/// Describes
#[derive(Debug)]
enum ModuleOrigin {
    /// A file maintained outside of Relay.
    SourceFile,
    /// A file generated by the Relay compiler.
    Artifact,
}

fn write_arrow_fn(f: &mut String, params: &[&str], body: &str) -> FmtResult {
    write!(f, "({}) => {}", params.join(", "), body)?;
    Ok(())
}

fn write_static_storage_key(
    f: &mut String,
    builder: &AstBuilder,
    field_name: StringKey,
    args_key: AstKey,
) -> FmtResult {
    write!(f, "\"{field_name}(")?;
    let args = builder.lookup(args_key).assert_array();
    for arg_key in args {
        let arg = builder.lookup(arg_key.assert_key()).assert_object();
        let name = &arg
            .iter()
            .find(|ObjectEntry { key, value: _ }| *key == CODEGEN_CONSTANTS.name)
            .expect("Expected `name` to exist")
            .value;
        let name = name.assert_string();
        write!(f, "{name}:")?;
        write_argument_value(f, builder, arg)?;
        f.push(',');
    }
    f.pop(); // args won't be empty
    f.push_str(")\"");
    Ok(())
}

fn write_argument_value(f: &mut String, builder: &AstBuilder, arg: &[ObjectEntry]) -> FmtResult {
    let key = &arg
        .iter()
        .find(|entry| entry.key == CODEGEN_CONSTANTS.kind)
        .expect("Expected `kind` to exist")
        .value;
    let key = key.assert_string();
    // match doesn't allow `CODEGEN_CONSTANTS.<>` on the match arm, falling back to if statements
    if key == CODEGEN_CONSTANTS.literal {
        let literal = &arg
            .iter()
            .find(|entry| entry.key == CODEGEN_CONSTANTS.value)
            .expect("Expected `name` to exist")
            .value;
        write_constant_value(f, builder, literal)?;
    } else if key == CODEGEN_CONSTANTS.list_value {
        let items = &arg
            .iter()
            .find(|entry| entry.key == CODEGEN_CONSTANTS.items)
            .expect("Expected `items` to exist")
            .value;
        let array = builder.lookup(items.assert_key()).assert_array();

        f.push('[');
        let mut after_first = false;
        for key_or_null in array {
            match key_or_null {
                Primitive::Null => {}
                Primitive::Key(key) => {
                    if after_first {
                        f.push(',');
                    } else {
                        after_first = true;
                    }
                    let object = builder.lookup(*key).assert_object();
                    write_argument_value(f, builder, object)?;
                }
                _ => panic!("Expected an object key or null"),
            }
        }
        f.push(']');
    } else {
        // We filtered out Variables, here it should only be ObjectValue
        let fields = &arg
            .iter()
            .find(|entry| entry.key == CODEGEN_CONSTANTS.fields)
            .expect("Expected `fields` to exist")
            .value;
        let fields = builder.lookup(fields.assert_key()).assert_array();

        f.push('{');
        for field in fields {
            let field = builder.lookup(field.assert_key()).assert_object();
            let name = &field
                .iter()
                .find(|entry| entry.key == CODEGEN_CONSTANTS.name)
                .expect("Expected `name` to exist")
                .value;
            let name = name.assert_string();
            write!(f, "\\\"{name}\\\":")?;
            write_argument_value(f, builder, field)?;
            f.push(',');
        }
        if !fields.is_empty() {
            f.pop();
        }
        f.push('}');
    }
    Ok(())
}

fn write_constant_value(f: &mut String, builder: &AstBuilder, value: &Primitive) -> FmtResult {
    match value {
        Primitive::Bool(b) => write!(f, "{}", if *b { "true" } else { "false" }),
        Primitive::String(key) => write!(f, "\\\"{key}\\\""),
        Primitive::Float(value) => write!(f, "{}", value.as_float()),
        Primitive::Int(value) => write!(f, "{value}"),
        Primitive::Variable(variable_name) => write!(f, "{variable_name}"),
        Primitive::Key(key) => {
            let ast = builder.lookup(*key);
            match ast {
                Ast::Array(arr) => {
                    f.push('[');
                    for value in arr {
                        write_constant_value(f, builder, value)?;
                        f.push(',');
                    }
                    if !arr.is_empty() {
                        f.pop();
                    }
                    f.push(']');
                    Ok(())
                }
                Ast::Object(obj) => {
                    f.push('{');
                    for ObjectEntry { key: name, value } in obj {
                        write!(f, "\\\"{name}\\\":")?;
                        write_constant_value(f, builder, value)?;
                        f.push(',');
                    }
                    if !obj.is_empty() {
                        f.pop();
                    }
                    f.push('}');
                    Ok(())
                }
            }
        }
        Primitive::Null | Primitive::SkippableNull => {
            f.push_str("null");
            Ok(())
        }
        Primitive::StorageKey(_, _) => panic!("Unexpected StorageKey"),
        Primitive::RawString(_) => panic!("Unexpected RawString"),
        Primitive::GraphQLModuleDependency(_) => panic!("Unexpected GraphQLModuleDependency"),
        Primitive::JSModuleDependency { .. } => panic!("Unexpected JSModuleDependency"),
        Primitive::ResolverModuleReference { .. } => panic!("Unexpected ResolverModuleReference"),
        Primitive::PropertyAccessor(_) => panic!("Unexpected PropertyAccessor"),
        Primitive::DynamicImport { .. } => panic!("Unexpected DynamicImport"),
        Primitive::RelayResolverModel { .. } => panic!("Unexpected RelayResolver"),
    }
}
