/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

use std::path::MAIN_SEPARATOR;
use std::path::Path;
use std::path::PathBuf;
use std::sync::LazyLock;

use ::intern::Lookup;
use ::intern::intern;
use ::intern::string_key::Intern;
use ::intern::string_key::StringKey;
use common::ArgumentName;
use common::DirectiveName;
use common::NamedItem;
use common::WithLocation;
use docblock_shared::RELAY_RESOLVER_MODEL_INSTANCE_FIELD;
use graphql_ir::Argument;
use graphql_ir::Condition;
use graphql_ir::ConditionValue;
use graphql_ir::ConstantValue;
use graphql_ir::Directive;
use graphql_ir::ExecutableDefinitionName;
use graphql_ir::FragmentDefinition;
use graphql_ir::FragmentDefinitionName;
use graphql_ir::FragmentSpread;
use graphql_ir::InlineFragment;
use graphql_ir::LinkedField;
use graphql_ir::OperationDefinition;
use graphql_ir::OperationDefinitionName;
use graphql_ir::ProvidedVariableMetadata;
use graphql_ir::ScalarField;
use graphql_ir::Selection;
use graphql_ir::Value;
use graphql_ir::VariableDefinition;
use graphql_syntax::OperationKind;
use md5::Digest;
use md5::Md5;
use relay_config::JsModuleFormat;
use relay_config::ModuleProvider;
use relay_config::ProjectConfig;
use relay_config::Surface;
use relay_transforms::CLIENT_EXTENSION_DIRECTIVE_NAME;
use relay_transforms::CatchMetadataDirective;
use relay_transforms::ClientComponentBoundaryMetadata;
use relay_transforms::ClientEdgeMetadata;
use relay_transforms::ClientEdgeMetadataDirective;
use relay_transforms::ClientEdgeModelResolver;
use relay_transforms::ClientExtensionAbstractTypeMetadataDirective;
use relay_transforms::ClientRscSeamMetadata;
use relay_transforms::ConnectionConstants;
use relay_transforms::ConnectionMetadata;
use relay_transforms::DIRECTIVE_SPLIT_OPERATION;
use relay_transforms::DeferDirective;
use relay_transforms::FragmentAliasMetadata;
use relay_transforms::FragmentDataInjectionMode;
use relay_transforms::INLINE_DIRECTIVE_NAME;
use relay_transforms::INTERNAL_METADATA_DIRECTIVE;
use relay_transforms::InlineDirectiveMetadata;
use relay_transforms::IsResolverRootFragmentSplitOperation;
use relay_transforms::ModuleMetadata;
use relay_transforms::NoInlineFragmentSpreadMetadata;
use relay_transforms::RESOLVER_BELONGS_TO_BASE_SCHEMA_DIRECTIVE;
use relay_transforms::RefetchableMetadata;
use relay_transforms::RelayDirective;
use relay_transforms::RelayResolverMetadata;
use relay_transforms::RequiredMetadataDirective;
use relay_transforms::ResolverOutputTypeInfo;
use relay_transforms::RscSeamMetadata;
use relay_transforms::SERVER_DIRECTIVE;
use relay_transforms::ServerOperationHandoffMetadata;
use relay_transforms::StreamDirective;
use relay_transforms::TYPE_DISCRIMINATOR_DIRECTIVE_NAME;
use relay_transforms::extract_connection_metadata_from_directive;
use relay_transforms::extract_handle_field_directives;
use relay_transforms::extract_values_from_handle_field_directive;
use relay_transforms::fragment_prop_name;
use relay_transforms::generate_abstract_type_refinement_key;
use relay_transforms::get_normalization_fragment_filename;
use relay_transforms::get_normalization_operation_name;
use relay_transforms::get_resolver_fragment_dependency_name;
use relay_transforms::raw_text::get_raw_text_value;
use relay_transforms::relay_resolvers::ResolverInfo;
use relay_transforms::relay_resolvers::ResolverSchemaGenType;
use relay_transforms::relay_resolvers::get_resolver_info;
use relay_transforms::relay_resolvers::resolver_import_alias;
use relay_transforms::remove_directive;
use relay_transforms::rsc_fragment_prop_name;
use relay_transforms::rsc_seam_arguments;
use schema::Field;
use schema::SDLSchema;
use schema::Schema;
use schema::Type;

use crate::ast::Ast;
use crate::ast::AstBuilder;
use crate::ast::AstKey;
use crate::ast::GraphQLModuleDependency;
use crate::ast::JSModuleDependency;
use crate::ast::ModuleImportName;
use crate::ast::ObjectEntry;
use crate::ast::Primitive;
use crate::ast::QueryID;
use crate::ast::RequestParameters;
use crate::ast::ResolverModuleReference;
use crate::constants::CODEGEN_CONSTANTS;
use crate::object;

pub static THROW_ON_FIELD_ERROR_DIRECTIVE_NAME: LazyLock<DirectiveName> =
    LazyLock::new(|| DirectiveName("throwOnFieldError".intern()));
pub static EXEC_TIME_RESOLVERS: LazyLock<DirectiveName> =
    LazyLock::new(|| DirectiveName("exec_time_resolvers".intern()));
pub static EXEC_TIME_RESOLVERS_ENABLED_ARGUMENT: LazyLock<ArgumentName> =
    LazyLock::new(|| ArgumentName("enabledProvider".intern()));
static FRAGMENT_KEY: LazyLock<StringKey> = LazyLock::new(|| "fragment".intern());

fn rsc_field_name(definition_id: StringKey) -> StringKey {
    format!("rsc${}", definition_id.lookup()).intern()
}

pub fn build_request_params_ast_key(
    schema: &SDLSchema,
    request_parameters: RequestParameters<'_>,
    ast_builder: &mut AstBuilder,
    operation: &OperationDefinition,
    definition_source_location: WithLocation<StringKey>,
    project_config: &ProjectConfig,
) -> AstKey {
    let mut operation_builder = CodegenBuilder::new(
        schema,
        CodegenVariant::Normalization,
        ast_builder,
        project_config,
        definition_source_location,
    );
    operation_builder.build_request_parameters(operation, request_parameters)
}

pub fn build_provided_variables(
    schema: &SDLSchema,
    ast_builder: &mut AstBuilder,
    operation: &OperationDefinition,
    definition_source_location: WithLocation<StringKey>,
    project_config: &ProjectConfig,
) -> Option<AstKey> {
    let mut operation_builder = CodegenBuilder::new(
        schema,
        CodegenVariant::Normalization,
        ast_builder,
        project_config,
        definition_source_location,
    );

    operation_builder.build_operation_provided_variables(operation)
}

pub fn build_request(
    schema: &SDLSchema,
    ast_builder: &mut AstBuilder,
    operation: &OperationDefinition,
    fragment: &FragmentDefinition,
    request_parameters: AstKey,
    definition_source_location: WithLocation<StringKey>,
    project_config: &ProjectConfig,
) -> AstKey {
    let mut operation_builder = CodegenBuilder::new(
        schema,
        CodegenVariant::Normalization,
        ast_builder,
        project_config,
        definition_source_location,
    );
    let server_handoff = operation_builder.build_server_handoff(operation);
    let operation_primitive = Primitive::Key(operation_builder.build_operation(operation));
    let mut fragment_builder = CodegenBuilder::new(
        schema,
        CodegenVariant::Reader,
        ast_builder,
        project_config,
        definition_source_location,
    );
    let fragment = Primitive::Key(fragment_builder.build_fragment(fragment, true, false));

    let mut request = object! {
        fragment: fragment,
        kind: Primitive::String(CODEGEN_CONSTANTS.request),
        operation: operation_primitive,
        params: Primitive::Key(request_parameters),
    };
    if let Some(server_handoff) = server_handoff {
        request.push(ObjectEntry {
            key: CODEGEN_CONSTANTS.server_handoff,
            value: server_handoff,
        });
    }

    ast_builder.intern(Ast::Object(request))
}

pub fn build_preloadable_request(
    ast_builder: &mut AstBuilder,
    request_parameters: AstKey,
) -> AstKey {
    ast_builder.intern(Ast::Object(object! {
        kind: Primitive::String(CODEGEN_CONSTANTS.preloadable_concrete_request),
        params: Primitive::Key(request_parameters),
    }))
}

pub fn build_request_params(operation: &OperationDefinition) -> RequestParameters<'_> {
    RequestParameters {
        name: operation.name.item.0,
        operation_kind: operation.kind,
        id: None,
        server_variables: None,
        text: None,
    }
}

pub fn build_operation(
    schema: &SDLSchema,
    ast_builder: &mut AstBuilder,
    operation: &OperationDefinition,
    definition_source_location: WithLocation<StringKey>,
    project_config: &ProjectConfig,
) -> AstKey {
    let mut builder = CodegenBuilder::new(
        schema,
        CodegenVariant::Normalization,
        ast_builder,
        project_config,
        definition_source_location,
    );
    builder.build_operation(operation)
}

pub fn build_fragment(
    schema: &SDLSchema,
    ast_builder: &mut AstBuilder,
    fragment: &FragmentDefinition,
    definition_source_location: WithLocation<StringKey>,
    project_config: &ProjectConfig,
) -> AstKey {
    let mut builder = CodegenBuilder::new(
        schema,
        CodegenVariant::Reader,
        ast_builder,
        project_config,
        definition_source_location,
    );
    builder.build_fragment(
        fragment,
        false,
        fragment.directives.named(*SERVER_DIRECTIVE).is_some(),
    )
}

pub fn build_resolvers_schema(
    ast_builder: &mut AstBuilder,
    schema: &SDLSchema,
    project_config: &ProjectConfig,
) -> AstKey {
    let artifact_path = project_config
        .resolvers_schema_module
        .as_ref()
        .unwrap()
        .path
        .as_ref()
        .expect("build_resolvers_schema called without a resolversSchemaModule path");

    let mut map = vec![];
    for object in schema.get_objects() {
        let mut fields = vec![];
        for field in object.fields.iter().map(|field_id| schema.field(*field_id)) {
            if let Some(Ok(ResolverInfo {
                import_path,
                import_name: Some(import_name),
                resolver_type,
                ..
            })) = get_resolver_info(schema, field, field.name.location)
            {
                if field
                    .directives
                    .named(*RESOLVER_BELONGS_TO_BASE_SCHEMA_DIRECTIVE)
                    .is_some()
                {
                    continue;
                }
                fields.push(ObjectEntry {
                    key: field.name.item,
                    value: Primitive::Key(build_resolver_info(
                        ast_builder,
                        project_config,
                        artifact_path,
                        field,
                        import_path,
                        ModuleImportName::Named {
                            name: import_name,
                            import_as: Some(resolver_import_alias(
                                object.name.item.0,
                                field.name.item,
                            )),
                        },
                        resolver_type,
                    )),
                });
            }
        }
        if !fields.is_empty() {
            fields.sort_by_key(|field| field.key);
            map.push(ObjectEntry {
                key: object.name.item.0,
                value: Primitive::Key(ast_builder.intern(Ast::Object(fields))),
            })
        }
    }
    map.sort_by_key(|field| field.key);

    ast_builder.intern(Ast::Object(map))
}

fn build_resolver_info(
    ast_builder: &mut AstBuilder,
    project_config: &ProjectConfig,
    artifact_path: &PathBuf,
    field: &Field,
    import_path: StringKey,
    import_name: ModuleImportName,
    resolver_type: ResolverSchemaGenType,
) -> AstKey {
    ast_builder.intern(Ast::Object(object! {
        resolver_function: match resolver_type {
            ResolverSchemaGenType::PropertyLookup { property_name } => {
                Primitive::PropertyAccessor(property_name.to_string())
            }
            ResolverSchemaGenType::ResolverModule => {
                Primitive::JSModuleDependency(JSModuleDependency {
                    path: project_config.js_module_import_identifier(
                        artifact_path,
                        &PathBuf::from(import_path.lookup()),
                    ),
                    import_name,
                })
            }
        },
        root_fragment: match get_resolver_fragment_dependency_name(field) {
            Some(name) => {
                let definition_name = WithLocation::new(
                    field.name.location,
                    get_normalization_operation_name(name.0).intern(),
                );
                Primitive::JSModuleDependency(JSModuleDependency {
                    path: project_config.js_module_import_identifier(
                        artifact_path,
                        &project_config.artifact_path_for_definition(definition_name),
                    ),
                    import_name: ModuleImportName::Default(definition_name.item),
                })
            }
            None => Primitive::SkippableNull,
        },
    }))
}

pub struct CodegenBuilder<'schema, 'builder, 'config> {
    connection_constants: ConnectionConstants,
    schema: &'schema SDLSchema,
    variant: CodegenVariant,
    ast_builder: &'builder mut AstBuilder,
    project_config: &'config ProjectConfig,
    definition_source_location: WithLocation<StringKey>,
}

#[derive(PartialEq)]
pub enum CodegenVariant {
    Reader,
    Normalization,
}

impl<'schema, 'builder, 'config> CodegenBuilder<'schema, 'builder, 'config> {
    pub fn new(
        schema: &'schema SDLSchema,
        variant: CodegenVariant,
        ast_builder: &'builder mut AstBuilder,
        project_config: &'config ProjectConfig,
        definition_source_location: WithLocation<StringKey>,
    ) -> Self {
        Self {
            connection_constants: Default::default(),
            schema,
            variant,
            ast_builder,
            project_config,
            definition_source_location,
        }
    }

    fn object(&mut self, object: Vec<ObjectEntry>) -> AstKey {
        self.ast_builder.intern(Ast::Object(object))
    }

    fn array(&mut self, array: Vec<Primitive>) -> AstKey {
        self.ast_builder.intern(Ast::Array(array))
    }

    fn build_internal_metadata_directives(&mut self, directives: &[Directive]) -> Vec<ObjectEntry> {
        directives
            .iter()
            .filter_map(|directive| {
                if directive.name.item == *INTERNAL_METADATA_DIRECTIVE {
                    if directive.arguments.len() != 1 {
                        panic!("@__metadata directive should have only one argument!");
                    }

                    let arg = &directive.arguments[0];
                    let key = arg.name.item;
                    let value = match &arg.value.item {
                        Value::Constant(value) => self.build_constant_value(value),
                        _ => {
                            panic!("@__metadata directive expect only constant argument values.");
                        }
                    };

                    Some(ObjectEntry { key: key.0, value })
                } else {
                    None
                }
            })
            .collect()
    }

    fn use_exec_time_resolvers(&self, context: &ContextualMetadata) -> bool {
        let feature_flags = &self.project_config.feature_flags;
        feature_flags.enable_resolver_normalization_ast
            || (feature_flags.enable_exec_time_resolvers_directive
                && context.has_exec_time_resolvers_directive
                && !context.has_exec_time_resolvers_enabled_provider)
    }

    fn use_exec_and_read_time_resolvers(&self, context: &ContextualMetadata) -> bool {
        let feature_flags = &self.project_config.feature_flags;
        feature_flags.enable_exec_time_resolvers_directive
            && context.has_exec_time_resolvers_directive
            && context.has_exec_time_resolvers_enabled_provider
    }

    fn build_operation(&mut self, operation: &OperationDefinition) -> AstKey {
        let has_exec_time_resolvers_directive =
            operation.directives.named(*EXEC_TIME_RESOLVERS).is_some();
        // `exec_time_resolvers_enabled_provider` make the query use exec time resolvers, for a query with
        //  @exec_time_resolvers but without the exec time provider argument, exec time is enabled by default.
        // `use_experimental_provider` make the exec time query use the experimental exec time exeuctor in runtime
        // `use_network_normalization_provider` make the query opt in to the executeWithNetwork coordinated
        //  publish path at runtime. Used to explicitly route variable-gated S2C queries.
        let (
            exec_time_resolvers_enabled_provider,
            use_experimental_provider,
            use_network_normalization_provider,
        ) = if let Some(directive) = operation.directives.named(*EXEC_TIME_RESOLVERS) {
            let parse_provider_arg = |arg_name: ArgumentName| {
                directive
                    .arguments
                    .named(arg_name)
                    .map(|arg| match &arg.value.item {
                        Value::Constant(ConstantValue::String(cons)) => WithLocation {
                            item: *cons,
                            location: arg.value.location,
                        },
                        _ => panic!(
                            "The {} argument in exec_time_resolvers directive should be the string name of your provider file.",
                            arg_name.0.lookup()
                        ),
                    })
            };
            (
                parse_provider_arg(*EXEC_TIME_RESOLVERS_ENABLED_ARGUMENT),
                parse_provider_arg(ArgumentName(intern!("useExperimentalProvider"))),
                parse_provider_arg(ArgumentName(intern!("useNetworkNormalizationProvider"))),
            )
        } else {
            (None, None, None)
        };

        let mut context = ContextualMetadata {
            has_client_edges: false,
            has_client_to_server_resolvers: false,
            has_exec_time_resolvers_directive,
            has_exec_time_resolvers_enabled_provider: exec_time_resolvers_enabled_provider
                .is_some(),
            has_server_to_client_resolvers: false,
            rsc_seams: Vec::new(),
            use_experimental_provider,
        };
        match operation.directives.named(*DIRECTIVE_SPLIT_OPERATION) {
            Some(_split_directive) => {
                // A resolver root fragment that reaches a server field cannot produce
                // a value until the response is normalized. Only resolver root
                // fragments are asked — the marker comes from
                // `generate_relay_resolvers_root_fragment_split_operation`, so
                // `@module` and other split operations are untouched.
                //
                // It goes in `metadata`, which `NormalizationSplitOperation` types as
                // an open dictionary, so consuming it needs no runtime type change.
                // A new top-level field would, and the `www` mirror of that type is
                // RepoSync-generated from landed revisions only — which would make
                // every consumer wait a landing cycle to read its own flag.
                let mut metadata_entries = vec![];
                if IsResolverRootFragmentSplitOperation::find(&operation.directives).is_some()
                    && selections_reach_server_field(&operation.selections)
                {
                    metadata_entries.push(ObjectEntry {
                        key: CODEGEN_CONSTANTS.has_server_field,
                        value: Primitive::Bool(true),
                    });
                }
                let selections = self.build_selections(&mut context, operation.selections.iter());
                if !context.rsc_seams.is_empty() {
                    metadata_entries.push(self.build_rsc_descriptors(&context.rsc_seams));
                }
                let metadata = Primitive::Key(self.object(metadata_entries));
                let mut fields = object! {
                    kind: Primitive::String(CODEGEN_CONSTANTS.split_operation),
                    metadata: metadata,
                    name: Primitive::String(operation.name.item.0),
                    selections: selections,
                };
                if !operation.variable_definitions.is_empty() {
                    let argument_definitions =
                        self.build_operation_variable_definitions(&operation.variable_definitions);
                    fields.insert(
                        0,
                        ObjectEntry {
                            key: CODEGEN_CONSTANTS.argument_definitions,
                            value: Primitive::Key(argument_definitions),
                        },
                    );
                }
                self.object(fields)
            }
            None => {
                let argument_definitions =
                    self.build_operation_variable_definitions(&operation.variable_definitions);
                let selections = self.build_selections(&mut context, operation.selections.iter());
                let mut fields = object! {
                    argument_definitions: Primitive::Key(argument_definitions),
                    kind: Primitive::String(CODEGEN_CONSTANTS.operation_value),
                    name: Primitive::String(operation.name.item.0),
                    selections: selections,
                };
                if context.has_exec_time_resolvers_directive {
                    fields.push(
                        if let Some(provider) = exec_time_resolvers_enabled_provider {
                            let mut provider_path =
                                PathBuf::from(provider.location.source_location().path());
                            provider_path.pop();
                            provider_path.push(PathBuf::from(provider.item.lookup()));
                            let artifact_path = self
                                .project_config
                                .artifact_path_for_definition(self.definition_source_location);
                            ObjectEntry {
                                key: "exec_time_resolvers_enabled_provider".intern(),
                                value: Primitive::JSModuleDependency(JSModuleDependency {
                                    path: self.project_config.js_module_import_identifier(
                                        &artifact_path,
                                        &provider_path,
                                    ),
                                    import_name: ModuleImportName::Default(provider.item),
                                }),
                            }
                        } else {
                            ObjectEntry {
                                key: "use_exec_time_resolvers".intern(),
                                value: Primitive::Bool(true),
                            }
                        },
                    );
                    if let Some(use_experimental_provider) = context.use_experimental_provider {
                        fields.push(ObjectEntry {
                            key: "use_experimental_provider".intern(),
                            value: Primitive::JSModuleDependency(JSModuleDependency {
                                path: use_experimental_provider.item,
                                import_name: ModuleImportName::Default(
                                    use_experimental_provider.item,
                                ),
                            }),
                        })
                    }
                    if let Some(provider) = use_network_normalization_provider {
                        let mut provider_path =
                            PathBuf::from(provider.location.source_location().path());
                        provider_path.pop();
                        provider_path.push(PathBuf::from(provider.item.lookup()));
                        let artifact_path = self
                            .project_config
                            .artifact_path_for_definition(self.definition_source_location);
                        fields.push(ObjectEntry {
                            key: "use_network_normalization_provider".intern(),
                            value: Primitive::JSModuleDependency(JSModuleDependency {
                                path: self
                                    .project_config
                                    .js_module_import_identifier(&artifact_path, &provider_path),
                                import_name: ModuleImportName::Default(provider.item),
                            }),
                        })
                    }
                }
                if context.has_client_to_server_resolvers {
                    fields.push(ObjectEntry {
                        key: "has_client_to_server_resolvers".intern(),
                        value: Primitive::Bool(true),
                    });
                }
                if context.has_server_to_client_resolvers {
                    fields.push(ObjectEntry {
                        key: "has_server_to_client_resolvers".intern(),
                        value: Primitive::Bool(true),
                    });
                }
                if let Some(client_abstract_types) =
                    self.maybe_build_client_abstract_types(operation)
                {
                    fields.push(client_abstract_types);
                }
                self.object(fields)
            }
        }
    }

    fn maybe_build_client_abstract_types(
        &mut self,
        operation: &OperationDefinition,
    ) -> Option<ObjectEntry> {
        // If the query contains fragment spreads on abstract types which are
        // defined in the client schema, we attach extra metadata so that we
        // know which concrete types match these type conditions at runtime.
        ClientExtensionAbstractTypeMetadataDirective::find(&operation.directives).map(|directive| {
            let entries = directive
                .abstract_types
                .iter()
                .map(|abstract_type| {
                    let concrete_types = self.array(
                        abstract_type
                            .concrete
                            .iter()
                            .map(|concrete| Primitive::String(*concrete))
                            .collect(),
                    );
                    ObjectEntry {
                        key: abstract_type.name,
                        value: Primitive::Key(concrete_types),
                    }
                })
                .collect();
            ObjectEntry {
                key: CODEGEN_CONSTANTS.client_abstract_types,
                value: Primitive::Key(self.object(entries)),
            }
        })
    }

    pub(crate) fn build_fragment(
        &mut self,
        fragment: &FragmentDefinition,
        skip_connection_metadata: bool,
        emit_server_fragment_marker: bool,
    ) -> AstKey {
        let mut context = ContextualMetadata::default();
        if fragment.directives.named(*INLINE_DIRECTIVE_NAME).is_some() {
            return self.build_inline_data_fragment(fragment);
        }

        let selections = self.build_selections(&mut context, fragment.selections.iter());
        let object = object! {
            argument_definitions: self.build_fragment_variable_definitions(
                    &fragment.variable_definitions,
                    &fragment.used_global_variables),
            kind: Primitive::String(CODEGEN_CONSTANTS.fragment_value),
            metadata: self.build_fragment_metadata(
                context,
                fragment,
                skip_connection_metadata,
                emit_server_fragment_marker,
            ),
            name: Primitive::String(fragment.name.item.0),
            selections: selections,
            type_: Primitive::String(self.schema.get_type_name(fragment.type_condition)),
            abstract_key: if fragment.type_condition.is_abstract_type() {
                    Primitive::String(generate_abstract_type_refinement_key(
                        self.schema,
                        fragment.type_condition,
                    ))
                } else {
                    Primitive::SkippableNull
                },
        };
        self.object(object)
    }

    fn build_fragment_metadata(
        &mut self,
        // NOTE: an owned value here ensures that the caller must construct the context prior to building the metadata object
        context: ContextualMetadata,
        fragment: &FragmentDefinition,
        skip_connection_metadata: bool,
        emit_server_fragment_marker: bool,
    ) -> Primitive {
        let connection_metadata = extract_connection_metadata_from_directive(&fragment.directives);

        let mut plural = false;
        let mut unmask = false;
        if let Some(relay_directive) = RelayDirective::find(&fragment.directives) {
            plural = relay_directive.plural;
            unmask = relay_directive.unmask;
        };

        let mut metadata = self.build_internal_metadata_directives(&fragment.directives);

        if emit_server_fragment_marker {
            metadata.push(ObjectEntry {
                key: CODEGEN_CONSTANTS.server_fragment,
                value: Primitive::Bool(true),
            });
        }

        if !skip_connection_metadata && let Some(connection_metadata) = &connection_metadata {
            metadata.push(self.build_connection_metadata(connection_metadata))
        }
        if unmask {
            metadata.push(ObjectEntry {
                key: CODEGEN_CONSTANTS.mask,
                value: Primitive::Bool(false),
            })
        }
        if plural {
            metadata.push(ObjectEntry {
                key: CODEGEN_CONSTANTS.plural,
                value: Primitive::Bool(true),
            })
        }
        if context.has_client_edges {
            metadata.push(ObjectEntry {
                key: CODEGEN_CONSTANTS.has_client_edges,
                value: Primitive::Bool(true),
            })
        }
        if fragment
            .directives
            .named(*THROW_ON_FIELD_ERROR_DIRECTIVE_NAME)
            .is_some()
        {
            metadata.push(ObjectEntry {
                key: CODEGEN_CONSTANTS.throw_on_field_error,
                value: Primitive::Bool(true),
            })
        }
        if let Some(catch_metadata) = CatchMetadataDirective::find(&fragment.directives) {
            metadata.push(ObjectEntry {
                key: CODEGEN_CONSTANTS.catch_to,
                value: Primitive::String(catch_metadata.to.into()),
            })
        }
        if let Some(refetch_metadata) = RefetchableMetadata::find(&fragment.directives) {
            let refetch_connection = if let Some(connection_metadata) = connection_metadata {
                let metadata = &connection_metadata[0]; // Validated in `transform_refetchable`
                let connection_object = object! {
                    forward: if let Some(first) = metadata.first {
                        Primitive::Key(self.object(object!{
                            count: Primitive::String(first),
                            cursor: Primitive::string_or_null(metadata.after),
                        }))
                    } else {
                        Primitive::Null
                    },
                    backward: if let Some(last) = metadata.last {
                        Primitive::Key(self.object(object!{
                            count: Primitive::String(last),
                            cursor: Primitive::string_or_null(metadata.before),
                        }))
                    } else {
                        Primitive::Null
                    },
                    path: Primitive::Key(
                        self.array(
                            metadata
                                .path
                                .as_ref()
                                .expect("Expected path to exist")
                                .iter()
                                .cloned()
                                .map(Primitive::String)
                                .collect(),
                        ),
                    ),
                };
                Primitive::Key(self.object(connection_object))
            } else {
                Primitive::SkippableNull
            };
            let mut refetch_object = object! {
                connection: refetch_connection,
                fragment_path_in_result: Primitive::Key(
                        self.array(
                            refetch_metadata
                                .path
                                .iter()
                                .copied()
                                .map(Primitive::String)
                                .collect(),
                        ),
                    ),
                operation: Primitive::GraphQLModuleDependency(GraphQLModuleDependency::Name(refetch_metadata.operation_name.into())),
            };
            if let Some(identifier_info) = &refetch_metadata.identifier_info {
                refetch_object.push(ObjectEntry {
                    key: CODEGEN_CONSTANTS.identifier_info,
                    value: Primitive::Key(self.object(object! {
                        identifier_field:  Primitive::String(identifier_info.identifier_field),
                        identifier_query_variable_name:  Primitive::String(identifier_info.identifier_query_variable_name),
                    })),
                });
            }
            if refetch_metadata.is_prefetchable_pagination {
                refetch_object.push(ObjectEntry {
                    key: intern!("edgesFragment"),
                    value: Primitive::GraphQLModuleDependency(GraphQLModuleDependency::Name(
                        ExecutableDefinitionName::FragmentDefinitionName(FragmentDefinitionName(
                            format!("{}__edges", fragment.name.item).intern(),
                        )),
                    )),
                });
            }

            metadata.push(ObjectEntry {
                key: CODEGEN_CONSTANTS.refetch,
                value: Primitive::Key(self.object(refetch_object)),
            })
        }

        // sort metadata keys
        metadata.sort_unstable_by_key(|entry| entry.key);

        if metadata.is_empty() {
            Primitive::SkippableNull
        } else {
            Primitive::Key(self.object(metadata))
        }
    }

    fn build_connection_metadata(
        &mut self,
        connection_metadata: &[ConnectionMetadata],
    ) -> ObjectEntry {
        let array = connection_metadata
            .iter()
            .map(|metadata| {
                let path = match &metadata.path {
                    None => Primitive::SkippableNull,
                    Some(path) => Primitive::Key(
                        self.array(path.iter().cloned().map(Primitive::String).collect()),
                    ),
                };
                let (count, cursor) =
                    if metadata.direction == self.connection_constants.direction_forward {
                        (metadata.first, metadata.after)
                    } else if metadata.direction == self.connection_constants.direction_backward {
                        (metadata.last, metadata.before)
                    } else {
                        (None, None)
                    };
                let mut object = object! {
                    count: Primitive::string_or_null(count),
                    cursor: Primitive::string_or_null(cursor),
                    direction: Primitive::String(metadata.direction),
                    path: path,
                };
                if metadata.is_stream_connection {
                    object.push(ObjectEntry {
                        key: self
                            .project_config
                            .schema_config
                            .defer_stream_interface
                            .stream_name
                            .0,
                        value: Primitive::Bool(true),
                    })
                }
                Primitive::Key(self.object(object))
            })
            .collect::<Vec<_>>();
        ObjectEntry {
            key: CODEGEN_CONSTANTS.connection,
            value: Primitive::Key(self.array(array)),
        }
    }

    fn build_inline_data_fragment(&mut self, fragment: &FragmentDefinition) -> AstKey {
        let object = object! {
            kind: Primitive::String(CODEGEN_CONSTANTS.inline_data_fragment),
            name: Primitive::String(fragment.name.item.0),
        };
        self.object(object)
    }

    fn build_selections<'a, Selections>(
        &mut self,
        context: &mut ContextualMetadata,
        selections: Selections,
    ) -> Primitive
    where
        Selections: Iterator<Item = &'a Selection>,
    {
        let selections = selections
            .flat_map(|selection| self.build_selections_from_selection(context, selection))
            .collect();
        Primitive::Key(self.array(selections))
    }

    fn build_selections_from_selection(
        &mut self,
        context: &mut ContextualMetadata,
        selection: &Selection,
    ) -> Vec<Primitive> {
        match selection {
            Selection::Condition(condition) => vec![self.build_condition(context, condition)],
            Selection::FragmentSpread(frag_spread) => {
                self.build_fragment_spread_selections(context, frag_spread)
            }
            Selection::InlineFragment(inline_fragment) => {
                let defer = inline_fragment.directives.named(
                    self.project_config
                        .schema_config
                        .defer_stream_interface
                        .defer_name,
                );
                if let Some(defer) = defer {
                    vec![self.build_defer(context, inline_fragment, defer)]
                } else if let Some(inline_data_directive) =
                    InlineDirectiveMetadata::find(&inline_fragment.directives)
                {
                    // If inline fragment has @__inline directive (created by inline_data_fragment transform)
                    // we will return selection wrapped with InlineDataFragmentSpread
                    vec![self.build_inline_data_fragment_spread(
                        context,
                        inline_fragment,
                        inline_data_directive,
                    )]
                } else if let Some(module_metadata) =
                    ModuleMetadata::find(&inline_fragment.directives)
                {
                    self.build_module_import_selections(module_metadata, inline_fragment)
                } else if let Some(resolver_metadata) =
                    RelayResolverMetadata::find(&inline_fragment.directives)
                {
                    match self.variant {
                        CodegenVariant::Reader => {
                            panic!(
                                "Unexpected RelayResolverMetadata on inline fragment while generating Reader AST"
                            )
                        }
                        CodegenVariant::Normalization => {
                            // `inline_fragments` has already expanded the
                            // resolver's `@rootFragment` spread into this inline
                            // fragment, so these selections ARE the root
                            // fragment's. That makes this the one place the
                            // question can be answered without a `Program`,
                            // which `CodegenBuilder` does not have.
                            let root_fragment_reaches_server_field =
                                selections_reach_server_field(&inline_fragment.selections);
                            let fragment_primitive =
                                self.build_inline_fragment(context, inline_fragment);

                            vec![self.build_normalization_relay_resolver(
                                context,
                                resolver_metadata,
                                Some(fragment_primitive),
                                root_fragment_reaches_server_field,
                            )]
                        }
                    }
                } else {
                    vec![self.build_inline_fragment(context, inline_fragment)]
                }
            }
            Selection::LinkedField(field) => {
                let stream = field.directives.named(
                    self.project_config
                        .schema_config
                        .defer_stream_interface
                        .stream_name,
                );

                match stream {
                    Some(stream) => vec![self.build_stream(context, field, stream)],
                    None => self.build_linked_field_and_handles(context, field),
                }
            }
            Selection::ScalarField(field) => {
                if field.directives.len() == 1
                    && field.directives[0].name.item == *TYPE_DISCRIMINATOR_DIRECTIVE_NAME
                {
                    match self.variant {
                        CodegenVariant::Reader => vec![],
                        CodegenVariant::Normalization => vec![self.build_type_discriminator(field)],
                    }
                } else {
                    self.build_scalar_field_and_handles(context, field)
                }
            }
        }
    }

    fn build_type_discriminator(&mut self, field: &ScalarField) -> Primitive {
        Primitive::Key(self.object(object! {
        kind: Primitive::String(CODEGEN_CONSTANTS.type_discriminator),
        abstract_key: Primitive::String(field.alias.expect(
                "Expected the type discriminator field to contain the abstract key alias.",
            ).item),
        }))
    }

    fn build_scalar_backed_resolver_field(
        &mut self,
        context: &mut ContextualMetadata,
        field: &ScalarField,
        resolver_metadata: &RelayResolverMetadata,
    ) -> Primitive {
        let resolver_primitive = match self.variant {
            CodegenVariant::Reader => self.build_reader_relay_resolver(resolver_metadata, None),
            CodegenVariant::Normalization => {
                // A scalar-backed resolver has no inline fragment and therefore
                // no root fragment to reach a server field through.
                self.build_normalization_relay_resolver(context, resolver_metadata, None, false)
            }
        };
        if let Some(required_metadata) = RequiredMetadataDirective::find(&field.directives) {
            self.build_required_field(required_metadata, resolver_primitive)
        } else if let Some(catch_metadata) = CatchMetadataDirective::find(&field.directives) {
            self.build_catch_node(catch_metadata, resolver_primitive)
        } else {
            resolver_primitive
        }
    }

    // For Relay Resolvers in the normalization AST, we need to include enough
    // information to retain resolver fields during GC. That means the data for
    // the resolver's root query as well as enough data to derive the storage
    // key for the resolver itself in the cache.
    fn build_normalization_relay_resolver(
        &mut self,
        context: &mut ContextualMetadata,
        resolver_metadata: &RelayResolverMetadata,
        inline_fragment: Option<Primitive>,
        root_fragment_reaches_server_field: bool,
    ) -> Primitive {
        // Detect S2C resolvers: a client extension field on a server type whose
        // `@rootFragment` reads server data, and so cannot run until the response
        // has been normalized. Only relevant for exec-time resolver queries.
        //
        // The condition is the literal question, not a proxy for it. It used to
        // ask whether the resolver had a root fragment at all, and then exclude
        // `Query` parents except when `@returnFragment` was declared — which
        // covered magic fragments only, and wrongly excluded a Query-rooted
        // resolver whose root fragment reads server data without declaring one.
        //
        // The parent-type gate stays: a resolver on a client extension type can
        // also read server data through its root fragment, but that is a
        // different classification and does not take this path.
        if !context.has_server_to_client_resolvers && context.has_exec_time_resolvers_directive {
            let field = resolver_metadata.field(self.schema);
            if let Some(parent_type) = field.parent_type
                && !self.schema.is_extension_type(parent_type)
                && root_fragment_reaches_server_field
            {
                context.has_server_to_client_resolvers = true;
            }
        }
        if self
            .project_config
            .resolvers_schema_module
            .as_ref()
            .is_some_and(|config| config.apply_to_normalization_ast)
        {
            self.build_normalization_relay_resolver_execution_time_for_worker(resolver_metadata)
        } else if self.use_exec_time_resolvers(context) {
            self.build_normalization_relay_resolver_exec_and_read_time(
                resolver_metadata,
                inline_fragment,
                true,
            )
        } else if self.use_exec_and_read_time_resolvers(context) {
            // We must handle both read time resolvers case and exec time resolvers case
            // since the mode it is in (read time resolvers vs exec time resolvers)
            // is now determined at runtime.
            self.build_normalization_relay_resolver_exec_and_read_time(
                resolver_metadata,
                inline_fragment,
                false,
            )
        } else {
            self.build_normalization_relay_resolver_read_time(resolver_metadata, inline_fragment)
        }
    }

    // This function generates a Normalization AST node that is the UNION of the node that would be
    // generated for the exec time resolvers case and the node that would be generated for the read
    // time resolvers case. This is because we need information to fulfill requests for both cases
    // in the runtime now, since the query's mode is determined dynamically at runtime.
    fn build_normalization_relay_resolver_exec_and_read_time(
        &mut self,
        resolver_metadata: &RelayResolverMetadata,
        inline_fragment: Option<Primitive>,
        exec_resolvers_only: bool,
    ) -> Primitive {
        let field_name = resolver_metadata.field_name(self.schema);
        // Include both field_arguments and fragment_arguments so the
        // exec-time executor can see variable mappings (e.g.,
        // include_friend → $my_flag) that would otherwise be lost since
        // the normalization AST has no FragmentSpread to carry them.
        let all_arguments: Vec<_> = resolver_metadata
            .field_arguments
            .iter()
            .chain(resolver_metadata.fragment_arguments.iter())
            .cloned()
            .collect();
        let args = self.build_arguments(&all_arguments);
        let is_output_type = resolver_metadata
            .output_type_info
            .normalization_ast_should_have_is_output_type_true();
        let kind = if resolver_metadata.live {
            CODEGEN_CONSTANTS.relay_live_resolver
        } else {
            CODEGEN_CONSTANTS.relay_resolver
        };
        let variable_name = resolver_metadata.generate_local_resolver_name(self.schema);
        let artifact_path = &self
            .project_config
            .artifact_path_for_definition(self.definition_source_location);
        let resolver_info = build_resolver_info(
            self.ast_builder,
            self.project_config,
            artifact_path,
            self.schema.field(resolver_metadata.field_id),
            resolver_metadata.import_path,
            match resolver_metadata.import_name {
                Some(name) => ModuleImportName::Named {
                    name,
                    import_as: Some(variable_name),
                },
                None => ModuleImportName::Default(variable_name),
            },
            resolver_metadata.resolver_type,
        );
        let mut obj = object! {
            name: Primitive::String(field_name),
            args: match args {
                None => Primitive::SkippableNull,
                Some(key) => Primitive::Key(key),
            },
            kind: Primitive::String(kind),
            storage_key: match args {
                None => Primitive::SkippableNull,
                Some(key) => {
                    if is_static_storage_key_available(&all_arguments) {
                        Primitive::StorageKey(field_name, key)
                    } else {
                        Primitive::SkippableNull
                    }
                }
            },
            is_output_type: Primitive::Bool(is_output_type),
            resolver_info: Primitive::Key(resolver_info),
        };
        if !exec_resolvers_only {
            obj.push(ObjectEntry {
                key: *FRAGMENT_KEY,
                value: match inline_fragment {
                    None => Primitive::SkippableNull,
                    Some(fragment) => fragment,
                },
            });
        }
        Primitive::Key(self.object(obj))
    }

    // For read time Relay Resolvers in the normalization AST, we do not
    // need to include resolver modules since those modules will be
    // evaluated at read time.
    fn build_normalization_relay_resolver_read_time(
        &mut self,
        resolver_metadata: &RelayResolverMetadata,
        inline_fragment: Option<Primitive>,
    ) -> Primitive {
        let field_name = resolver_metadata.field_name(self.schema);
        let field_arguments = &resolver_metadata.field_arguments;
        let args = self.build_arguments(field_arguments);
        let is_output_type = resolver_metadata
            .output_type_info
            .normalization_ast_should_have_is_output_type_true();
        Primitive::Key(self.object(object! {
            name: Primitive::String(field_name),
            args: match args {
                None => Primitive::SkippableNull,
                Some(key) => Primitive::Key(key),
            },
            fragment: match inline_fragment {
                None => Primitive::SkippableNull,
                Some(fragment) => fragment,
            },
            kind: Primitive::String(CODEGEN_CONSTANTS.relay_resolver),
            storage_key: match args {
                None => Primitive::SkippableNull,
                Some(key) => {
                    if is_static_storage_key_available(&resolver_metadata.field_arguments) {
                        Primitive::StorageKey(field_name, key)
                    } else {
                        Primitive::SkippableNull
                    }
                }
            },
            is_output_type: Primitive::Bool(is_output_type),
        }))
    }

    fn build_normalization_relay_resolver_execution_time_for_worker(
        &mut self,
        resolver_metadata: &RelayResolverMetadata,
    ) -> Primitive {
        let field_name = resolver_metadata.field_name(self.schema);
        // Include both field_arguments and fragment_arguments (see comment
        // in build_normalization_relay_resolver_exec_and_read_time).
        let all_arguments: Vec<_> = resolver_metadata
            .field_arguments
            .iter()
            .chain(resolver_metadata.fragment_arguments.iter())
            .cloned()
            .collect();
        let args = self.build_arguments(&all_arguments);
        let is_output_type = resolver_metadata
            .output_type_info
            .normalization_ast_should_have_is_output_type_true();

        let field_type = match resolver_metadata.field(self.schema).parent_type.unwrap() {
            Type::Interface(interface_id) => self.schema.interface(interface_id).name.item.0,
            Type::Object(object_id) => self.schema.object(object_id).name.item.0,
            _ => panic!("Unexpected parent type for resolver."),
        };

        let variable_name = resolver_metadata.generate_local_resolver_name(self.schema);
        let kind = if resolver_metadata.live {
            CODEGEN_CONSTANTS.relay_live_resolver
        } else {
            CODEGEN_CONSTANTS.relay_resolver
        };
        Primitive::Key(self.object(object! {
            name: Primitive::String(field_name),
            args: match args {
                None => Primitive::SkippableNull,
                Some(key) => Primitive::Key(key),
            },
            kind: Primitive::String(kind),
            storage_key: match args {
                None => Primitive::SkippableNull,
                Some(key) => {
                    if is_static_storage_key_available(&all_arguments) {
                        Primitive::StorageKey(field_name, key)
                    } else {
                        Primitive::SkippableNull
                    }
                }
            },
            is_output_type: Primitive::Bool(is_output_type),
            resolver_reference: Primitive::ResolverModuleReference(ResolverModuleReference {
                field_type,
                resolver_function_name: match resolver_metadata.import_name {
                    Some(name) => ModuleImportName::Named {
                        name,
                        import_as: Some(variable_name),
                    },
                    None => ModuleImportName::Default(variable_name),
                },
            }),
        }))
    }

    fn build_scalar_field_and_handles(
        &mut self,
        context: &mut ContextualMetadata,
        field: &ScalarField,
    ) -> Vec<Primitive> {
        if let Some(resolver_metadata) = RelayResolverMetadata::find(&field.directives) {
            if self.variant == CodegenVariant::Reader
                && self
                    .project_config
                    .feature_flags
                    .disable_resolver_reader_ast
            {
                return vec![self.build_scalar_field(field)];
            }
            return vec![self.build_scalar_backed_resolver_field(
                context,
                field,
                resolver_metadata,
            )];
        }
        match self.variant {
            CodegenVariant::Reader => vec![self.build_scalar_field(field)],
            CodegenVariant::Normalization => {
                let mut result = vec![self.build_scalar_field(field)];
                self.build_scalar_handles(&mut result, field);
                result
            }
        }
    }

    fn build_required_field(
        &mut self,
        required_metadata: &RequiredMetadataDirective,
        primitive: Primitive,
    ) -> Primitive {
        Primitive::Key(self.object(object! {
            kind: Primitive::String(CODEGEN_CONSTANTS.required_field),
            field: primitive,
            action: Primitive::String(required_metadata.action.into()),
        }))
    }

    fn build_catch_node(
        &mut self,
        catch_metadata: &CatchMetadataDirective,
        primitive: Primitive,
    ) -> Primitive {
        Primitive::Key(self.object(object! {
            kind: Primitive::String(CODEGEN_CONSTANTS.catch_field),
            field: primitive,
            to: Primitive::String(catch_metadata.to.into()),
        }))
    }

    fn build_scalar_field(&mut self, field: &ScalarField) -> Primitive {
        let schema_field = self.schema.field(field.definition.item);
        let (name, alias) =
            self.build_field_name_and_alias(schema_field.name.item, field.alias, &field.directives);
        let args = self.build_arguments(&field.arguments);
        let primitive = Primitive::Key(self.object(object! {
            :build_alias(alias, name),
            args: match args {
                    None => Primitive::SkippableNull,
                    Some(key) => Primitive::Key(key),
                },
            kind: Primitive::String(CODEGEN_CONSTANTS.scalar_field),
            name: Primitive::String(name),
            storage_key: match args {
                    None => Primitive::SkippableNull,
                    Some(key) => {
                        if is_static_storage_key_available(&field.arguments) {
                            Primitive::StorageKey(name, key)
                        } else {
                            Primitive::SkippableNull
                        }
                    }
                },
        }));

        if let Some(required_metadata) = RequiredMetadataDirective::find(&field.directives) {
            self.build_required_field(required_metadata, primitive)
        } else if let Some(catch_metadata) = CatchMetadataDirective::find(&field.directives) {
            self.build_catch_node(catch_metadata, primitive)
        } else {
            primitive
        }
    }

    fn build_scalar_handles(&mut self, result: &mut Vec<Primitive>, field: &ScalarField) {
        let schema_field = self.schema.field(field.definition.item);
        let field_name = schema_field.name.item;
        let handle_field_directives = extract_handle_field_directives(&field.directives);

        for directive in handle_field_directives {
            let values = extract_values_from_handle_field_directive(directive);
            let filters = match values.filters {
                None => Primitive::SkippableNull,
                Some(strs) => {
                    Primitive::Key(self.array(strs.into_iter().map(Primitive::String).collect()))
                }
            };
            let arguments = match self.build_arguments(&field.arguments) {
                None => Primitive::SkippableNull,
                Some(key) => Primitive::Key(key),
            };
            let mut object = object! {
                :build_alias(field.alias.map(|a| a.item), field_name),
                args: arguments,
                filters: filters,
                handle: Primitive::String(values.handle),
                key: Primitive::String(values.key),
                kind: Primitive::String(CODEGEN_CONSTANTS.scalar_handle),
                name: Primitive::String(field_name),
            };
            if let Some(handle_args) = values.handle_args {
                let args = self.build_arguments(&handle_args);
                if let Some(args) = args {
                    object.push(ObjectEntry {
                        key: CODEGEN_CONSTANTS.handle_args,
                        value: Primitive::Key(args),
                    });
                }
            };
            result.push(Primitive::Key(self.object(object)));
        }
    }

    fn build_linked_field_and_handles(
        &mut self,
        context: &mut ContextualMetadata,
        field: &LinkedField,
    ) -> Vec<Primitive> {
        match self.variant {
            CodegenVariant::Reader => vec![self.build_linked_field(context, field)],
            CodegenVariant::Normalization => {
                let mut result = vec![self.build_linked_field(context, field)];
                self.build_linked_handles(&mut result, field);
                result
            }
        }
    }

    fn build_linked_field(
        &mut self,
        context: &mut ContextualMetadata,
        field: &LinkedField,
    ) -> Primitive {
        let schema_field = self.schema.field(field.definition.item);
        let (name, alias) =
            self.build_field_name_and_alias(schema_field.name.item, field.alias, &field.directives);
        let args = self.build_arguments(&field.arguments);
        let selections = self.build_selections(context, field.selections.iter());
        let primitive = Primitive::Key(self.object(object! {
            :build_alias(alias, name),
            args: match args {
                    None => Primitive::SkippableNull,
                    Some(key) => Primitive::Key(key),
                },
            concrete_type: if schema_field.type_.inner().is_abstract_type() {
                    Primitive::SkippableNull
                } else {
                    Primitive::String(self.schema.get_type_name(schema_field.type_.inner()))
                },
            kind: Primitive::String(CODEGEN_CONSTANTS.linked_field),
            name: Primitive::String(name),
            plural: Primitive::Bool(schema_field.type_.is_list()),
            selections: selections,
            storage_key: match args {
                None => Primitive::SkippableNull,
                Some(key) => {
                    if is_static_storage_key_available(&field.arguments) {
                        Primitive::StorageKey(name, key)
                    } else {
                        Primitive::SkippableNull
                    }
                }
            },
        }));

        if let Some(required_metadata) = RequiredMetadataDirective::find(&field.directives) {
            self.build_required_field(required_metadata, primitive)
        } else if let Some(catch_metadata) = CatchMetadataDirective::find(&field.directives) {
            self.build_catch_node(catch_metadata, primitive)
        } else {
            primitive
        }
    }

    fn build_linked_handles(&mut self, result: &mut Vec<Primitive>, field: &LinkedField) {
        let schema_field = self.schema.field(field.definition.item);
        let field_name = schema_field.name.item;
        let handle_field_directives = extract_handle_field_directives(&field.directives);
        for directive in handle_field_directives {
            let values = extract_values_from_handle_field_directive(directive);

            let dynamic_key = match &values.dynamic_key {
                Some(val) => self.build_argument(CODEGEN_CONSTANTS.dynamic_key_argument, val),
                None => None,
            };
            let filters = match values.filters {
                None => Primitive::SkippableNull,
                Some(strings) => {
                    Primitive::Key(self.array(strings.into_iter().map(Primitive::String).collect()))
                }
            };
            let mut object = object! {
                :build_alias(field.alias.map(|a| a.item), field_name),
                args: match self.build_arguments(&field.arguments) {
                        None => Primitive::SkippableNull,
                        Some(key) => Primitive::Key(key),
                    },
                filters: filters,
                handle: Primitive::String(values.handle),
                key: Primitive::String(values.key),
                kind: Primitive::String(CODEGEN_CONSTANTS.linked_handle),
                name: Primitive::String(field_name),
            };
            if let Some(dynamic_key) = dynamic_key {
                object.push(ObjectEntry {
                    key: CODEGEN_CONSTANTS.dynamic_key,
                    value: Primitive::Key(dynamic_key),
                });
            };
            if let Some(handle_args) = values.handle_args {
                let args = self.build_arguments(&handle_args);
                if let Some(args) = args {
                    object.push(ObjectEntry {
                        key: CODEGEN_CONSTANTS.handle_args,
                        value: Primitive::Key(args),
                    });
                }
            };
            result.push(Primitive::Key(self.object(object)))
        }
    }

    fn build_field_name_and_alias(
        &self,
        mut name: StringKey,
        alias: Option<WithLocation<StringKey>>,
        directives: &[Directive],
    ) -> (StringKey, Option<StringKey>) {
        let mut alias = alias.map(|alias| alias.item);
        if self.variant == CodegenVariant::Reader {
            let mut handle_field_directives = extract_handle_field_directives(directives);
            if let Some(handle_field_directive) = handle_field_directives.next() {
                if let Some(other_handle_field_directive) = handle_field_directives.next() {
                    panic!(
                        "Expected at most one handle directive, got `{handle_field_directive:?}` and `{other_handle_field_directive:?}`."
                    );
                }
                let values = extract_values_from_handle_field_directive(handle_field_directive);
                alias = alias.or(Some(name));
                name = if values.key == CODEGEN_CONSTANTS.default_handle_key {
                    format!("__{}_{}", name, values.handle).intern()
                } else {
                    format!("__{}_{}", values.key, values.handle).intern()
                }
            }
        }
        (name, alias)
    }

    fn build_fragment_spread(&mut self, frag_spread: &FragmentSpread) -> Primitive {
        if self.variant == CodegenVariant::Normalization
            && let Some(boundary) = ClientComponentBoundaryMetadata::find(&frag_spread.directives)
        {
            return self.build_client_component_fragment_spread(frag_spread, boundary);
        }
        if let Some(no_inline_metadata) =
            NoInlineFragmentSpreadMetadata::find(&frag_spread.directives)
        {
            let fragment_source_location_key = no_inline_metadata.location;

            let normalization_import_path = self.project_config.js_module_import_identifier(
                &self
                    .project_config
                    .artifact_path_for_definition(self.definition_source_location),
                &self.project_config.create_path_for_artifact(
                    fragment_source_location_key,
                    frag_spread.fragment.item.0.lookup().to_string(),
                ),
            );

            return self
                .build_normalization_fragment_spread(frag_spread, normalization_import_path);
        }
        let args = self.build_arguments(&frag_spread.arguments);
        let primitive = Primitive::Key(self.object(object! {
            args: match args {
                    None => Primitive::SkippableNull,
                    Some(key) => Primitive::Key(key),
                },
            kind: Primitive::String(CODEGEN_CONSTANTS.fragment_spread),
            name: Primitive::String(frag_spread.fragment.item.0),
        }));

        if let Some(resolver_metadata) = RelayResolverMetadata::find(&frag_spread.directives) {
            let resolver_primitive = match self.variant {
                CodegenVariant::Reader => {
                    if self
                        .project_config
                        .feature_flags
                        .disable_resolver_reader_ast
                    {
                        let scalar_field = ScalarField {
                            alias: resolver_metadata.field_alias.map(WithLocation::generated),
                            definition: WithLocation::generated(resolver_metadata.field_id),
                            arguments: resolver_metadata.field_arguments.clone(),
                            directives: frag_spread
                                .directives
                                .iter()
                                .filter(|directive| {
                                    directive.name.item
                                        != RequiredMetadataDirective::directive_name()
                                })
                                .cloned()
                                .collect(),
                        };
                        self.build_scalar_field(&scalar_field)
                    } else {
                        self.build_reader_relay_resolver(resolver_metadata, Some(primitive))
                    }
                }
                // We expect all RelayResolver fragment spreads to be inlined into inline fragment spreads when generating Normalization ASTs.
                CodegenVariant::Normalization => panic!(
                    "Unexpected RelayResolverMetadata on fragment spread while generating normalization AST."
                ),
            };

            if let Some(required_metadata) =
                RequiredMetadataDirective::find(&frag_spread.directives)
            {
                self.build_required_field(required_metadata, resolver_primitive)
            } else if let Some(catch_metadata) =
                CatchMetadataDirective::find(&frag_spread.directives)
            {
                self.build_catch_node(catch_metadata, resolver_primitive)
            } else {
                resolver_primitive
            }
        } else {
            primitive
        }
    }

    fn build_fragment_spread_selections(
        &mut self,
        context: &mut ContextualMetadata,
        frag_spread: &FragmentSpread,
    ) -> Vec<Primitive> {
        if let Some(seam) = RscSeamMetadata::find(&frag_spread.directives) {
            if ClientRscSeamMetadata::find(&frag_spread.directives).is_some() {
                assert!(self.variant == CodegenVariant::Normalization);
                if !context
                    .rsc_seams
                    .iter()
                    .any(|existing| existing.definition_id == seam.definition_id)
                {
                    context.rsc_seams.push(seam.clone());
                }
                return vec![self.build_rsc_handle(frag_spread, seam)];
            }
            return match self.variant {
                CodegenVariant::Reader => vec![self.build_rsc_seam_reader(frag_spread, seam)],
                CodegenVariant::Normalization => {
                    vec![self.build_rsc_seam_normalization(frag_spread, seam)]
                }
            };
        }
        vec![self.build_fragment_spread(frag_spread)]
    }

    fn build_rsc_descriptors(&mut self, seams: &[RscSeamMetadata]) -> ObjectEntry {
        let descriptors = seams
            .iter()
            .map(|seam| {
                let fragment_prop_name = rsc_fragment_prop_name(seam.fragment_name);
                let component_argument_names = Primitive::Key(
                    self.array(
                        seam.component_argument_names()
                            .map(|name| Primitive::String(name.0))
                            .collect(),
                    ),
                );
                let normalization_fragment = self.build_graphql_artifact_dependency(
                    WithLocation::new(seam.fragment_location, seam.normalization_operation.into()),
                );
                let reader_fragment = self.build_graphql_artifact_dependency(WithLocation::new(
                    seam.fragment_location,
                    seam.fragment_name.into(),
                ));
                Primitive::Key(self.object(object! {
                    component_argument_names: component_argument_names,
                    component_export_name: Primitive::String(seam.component_export_name),
                    component_module_provider: self.build_rsc_component_module_provider(seam),
                    definition_id: Primitive::String(seam.definition_id),
                    fragment_prop_name: Primitive::String(fragment_prop_name),
                    normalization_fragment: normalization_fragment,
                    reader_fragment: reader_fragment,
                    render_id: Primitive::String(self.rsc_render_id(seam)),
                }))
            })
            .collect();
        ObjectEntry {
            key: CODEGEN_CONSTANTS.rsc,
            value: Primitive::Key(self.array(descriptors)),
        }
    }

    fn build_rsc_seam_normalization(
        &mut self,
        frag_spread: &FragmentSpread,
        seam: &RscSeamMetadata,
    ) -> Primitive {
        let fragment = self.build_graphql_artifact_dependency(WithLocation::new(
            seam.fragment_location,
            seam.normalization_operation.into(),
        ));
        let args = self.build_rsc_fragment_arguments(frag_spread, seam);
        let identity_args = self.build_public_rsc_seam_arguments(frag_spread, seam);
        let mut fields = object! {
            args: match args {
                None => Primitive::SkippableNull,
                Some(key) => Primitive::Key(key),
            },
            fragment: fragment,
            kind: Primitive::String(CODEGEN_CONSTANTS.fragment_spread),
        };
        fields.push(ObjectEntry {
            key: CODEGEN_CONSTANTS.rsc_identity_args,
            // The runtime uses this key's presence to reject stale compiler metadata.
            value: identity_args.map_or(Primitive::Null, Primitive::Key),
        });
        fields.push(ObjectEntry {
            key: CODEGEN_CONSTANTS.rsc_render_id,
            value: Primitive::String(self.rsc_render_id(seam)),
        });
        Primitive::Key(self.object(fields))
    }

    fn build_rsc_handle(
        &mut self,
        frag_spread: &FragmentSpread,
        seam: &RscSeamMetadata,
    ) -> Primitive {
        let client_id_field_name = self.schema.field(self.schema.clientid_field()).name.item;
        let public_arguments: Vec<&Argument> = frag_spread
            .arguments
            .iter()
            .filter(|argument| seam.is_public_argument(argument.name.item))
            .collect();
        let identity_arguments = self.build_arguments_from_refs(public_arguments.clone());
        let handler_arguments = self.build_arguments(&frag_spread.arguments);
        let filters = if public_arguments.is_empty() {
            Primitive::SkippableNull
        } else {
            Primitive::Key(
                self.array(
                    public_arguments
                        .iter()
                        .map(|argument| Primitive::String(argument.name.item.0))
                        .collect(),
                ),
            )
        };
        let source_field = Primitive::Key(self.object(object! {
            alias: Primitive::SkippableNull,
            args: identity_arguments.map_or(Primitive::SkippableNull, Primitive::Key),
            kind: Primitive::String(CODEGEN_CONSTANTS.scalar_field),
            name: Primitive::String(client_id_field_name),
            storage_key: Primitive::SkippableNull,
        }));
        let mut handle_object = object! {
            alias: Primitive::SkippableNull,
            args: identity_arguments.map_or(Primitive::SkippableNull, Primitive::Key),
            filters: filters,
            handle: Primitive::String("rsc".intern()),
            key: Primitive::String(seam.definition_id),
            kind: Primitive::String(CODEGEN_CONSTANTS.scalar_handle),
            name: Primitive::String(client_id_field_name),
        };
        // `handleArgs` is optional but not nullable in the runtime's
        // NormalizationHandle type, so a handle without arguments omits it.
        if let Some(handler_arguments) = handler_arguments {
            handle_object.push(ObjectEntry {
                key: CODEGEN_CONSTANTS.handle_args,
                value: Primitive::Key(handler_arguments),
            });
        }
        let handle_field = Primitive::Key(self.object(handle_object));
        let selections = Primitive::Key(self.array(vec![source_field, handle_field]));
        Primitive::Key(self.object(object! {
            kind: Primitive::String(CODEGEN_CONSTANTS.client_extension),
            selections: selections,
        }))
    }

    fn build_rsc_seam_reader(
        &mut self,
        frag_spread: &FragmentSpread,
        seam: &RscSeamMetadata,
    ) -> Primitive {
        let arguments = self.build_public_rsc_seam_arguments(frag_spread, seam);
        Primitive::Key(self.object(object! {
            alias: Primitive::String(seam.alias),
            args: arguments.map_or(Primitive::SkippableNull, Primitive::Key),
            kind: Primitive::String(CODEGEN_CONSTANTS.scalar_field),
            name: Primitive::String(rsc_field_name(seam.definition_id)),
            storage_key: Primitive::SkippableNull,
        }))
    }

    fn build_rsc_fragment_arguments(
        &mut self,
        frag_spread: &FragmentSpread,
        seam: &RscSeamMetadata,
    ) -> Option<AstKey> {
        let arguments: Vec<_> = rsc_seam_arguments(frag_spread, seam)
            .into_iter()
            .filter(|argument| !seam.is_component_argument(argument.name.item))
            .collect();
        self.build_arguments(&arguments)
    }

    fn build_public_rsc_seam_arguments(
        &mut self,
        frag_spread: &FragmentSpread,
        seam: &RscSeamMetadata,
    ) -> Option<AstKey> {
        let arguments: Vec<_> = rsc_seam_arguments(frag_spread, seam)
            .into_iter()
            .filter(|argument| seam.is_public_argument(argument.name.item))
            .collect();
        self.build_arguments(&arguments)
    }

    fn build_rsc_component_module_provider(&self, seam: &RscSeamMetadata) -> Primitive {
        let dynamic_module_provider = self
            .project_config
            .effective_module_import_config()
            .dynamic_module_provider
            .expect("validated Relay RSC metadata requires a dynamic module provider");
        let module = self.project_config.js_module_import_identifier(
            &self
                .project_config
                .artifact_path_for_definition(self.definition_source_location),
            &PathBuf::from(seam.component_module_name.lookup()),
        );
        Primitive::DynamicImport {
            provider: dynamic_module_provider,
            module,
        }
    }

    fn rsc_render_id(&self, seam: &RscSeamMetadata) -> StringKey {
        let fragment_name = seam.fragment_name.0.lookup();
        let component_module = self.canonical_rsc_component_module_identity(seam);
        let component_export_name = seam.component_export_name.lookup();
        format!(
            "rsc-render:v2:{}:{}:{}:{}:{}:{}",
            fragment_name.len(),
            fragment_name,
            component_module.len(),
            component_module,
            component_export_name.len(),
            component_export_name,
        )
        .intern()
    }

    fn canonical_rsc_component_module_identity(&self, seam: &RscSeamMetadata) -> String {
        let module_name = seam.component_module_name.lookup();
        if matches!(self.project_config.js_module_format, JsModuleFormat::Haste) {
            return self
                .project_config
                .js_module_import_identifier(
                    &self
                        .project_config
                        .artifact_path_for_definition(self.definition_source_location),
                    &PathBuf::from(module_name),
                )
                .lookup()
                .to_owned();
        }
        let mut module_path = normalize_path(Path::new(module_name));
        if module_path.extension().is_some_and(|extension| {
            matches!(extension.to_str(), Some("js" | "jsx" | "ts" | "tsx"))
        }) {
            module_path.set_extension("");
        }
        module_path.to_string_lossy().replace(MAIN_SEPARATOR, "/")
    }

    fn build_client_component_fragment_spread(
        &mut self,
        frag_spread: &FragmentSpread,
        boundary: &ClientComponentBoundaryMetadata,
    ) -> Primitive {
        let fragment = self.build_graphql_artifact_dependency(WithLocation::new(
            boundary.fragment_location,
            boundary.normalization_operation.into(),
        ));
        let kind = Primitive::String(CODEGEN_CONSTANTS.fragment_spread);

        Primitive::Key(match self.build_arguments(&frag_spread.arguments) {
            None => self.object(object! {
                fragment: fragment,
                kind: kind,
            }),
            Some(args) => self.object(object! {
                args: Primitive::Key(args),
                fragment: fragment,
                kind: kind,
            }),
        })
    }

    /// Builds a server query's `serverHandoff`: `clientFragments` lists each
    /// client fragment it hands off, with its Reader fragment, its
    /// `$normalization` split operation and the operation variables it reads,
    /// and `rsc` lists the Relay RSC Resolver fields it selects.
    fn build_server_handoff(&mut self, operation: &OperationDefinition) -> Option<Primitive> {
        let handoff = ServerOperationHandoffMetadata::find(&operation.directives)?;
        let client_fragments = handoff
            .client_fragments
            .iter()
            .map(|client_fragment| {
                let normalization = self.build_graphql_artifact_dependency(WithLocation::new(
                    client_fragment.fragment_location,
                    client_fragment.client_normalization_operation.into(),
                ));
                let fragment = self.build_graphql_artifact_dependency(WithLocation::new(
                    client_fragment.fragment_location,
                    client_fragment.fragment.into(),
                ));
                let mut fields = object! {
                    normalization: normalization,
                    fragment: fragment,
                };
                if !client_fragment.root_variables.is_empty() {
                    let root_variables = client_fragment
                        .root_variables
                        .iter()
                        .map(|name| Primitive::String(name.0))
                        .collect();
                    fields.push(ObjectEntry {
                        key: CODEGEN_CONSTANTS.root_variables,
                        value: Primitive::Key(self.array(root_variables)),
                    });
                }
                Primitive::Key(self.object(fields))
            })
            .collect();
        let client_fragments = Primitive::Key(self.array(client_fragments));

        let mut fields = object! {
            client_fragments: client_fragments,
        };
        if !handoff.rsc_seams.is_empty() {
            fields.push(self.build_rsc_descriptors(&handoff.rsc_seams));
        }
        Some(Primitive::Key(self.object(fields)))
    }

    fn build_graphql_artifact_dependency(
        &self,
        definition_name: WithLocation<ExecutableDefinitionName>,
    ) -> Primitive {
        let path = self.project_config.js_module_import_identifier(
            &self
                .project_config
                .artifact_path_for_definition(self.definition_source_location),
            &self.project_config.create_path_for_artifact(
                definition_name.location.source_location(),
                definition_name.item.to_string(),
            ),
        );
        Primitive::GraphQLModuleDependency(GraphQLModuleDependency::Path {
            path,
            name: definition_name.item,
        })
    }

    /// Where a resolver's function is imported from, and the name the generated
    /// artifact binds it to — i.e. both halves of the emitted
    /// `require('<path>').<name>`.
    ///
    /// `path` comes from the metadata's own `import_path`. The binding name comes
    /// from `generate_local_resolver_name`, which builds it from the field's
    /// parent type and field name. Both are read off the `RelayResolverMetadata`
    /// passed in, so two artifacts given the same metadata always emit the same
    /// import and the same binding.
    fn resolver_js_module_dependency(
        &self,
        relay_resolver_metadata: &RelayResolverMetadata,
    ) -> JSModuleDependency {
        let import_path = self.project_config.js_module_import_identifier(
            &self
                .project_config
                .artifact_path_for_definition(self.definition_source_location),
            &PathBuf::from(relay_resolver_metadata.import_path.lookup()),
        );
        let variable_name = relay_resolver_metadata.generate_local_resolver_name(self.schema);
        JSModuleDependency {
            path: import_path,
            import_name: match relay_resolver_metadata.import_name {
                Some(name) => ModuleImportName::Named {
                    name,
                    import_as: Some(variable_name),
                },
                None => ModuleImportName::Default(variable_name),
            },
        }
    }

    fn build_client_edge_model_resolvers(
        &mut self,
        model_resolvers: &[ClientEdgeModelResolver],
        relay_resolver_metadata: &RelayResolverMetadata,
    ) -> Vec<ObjectEntry> {
        model_resolvers
            .iter()
            .map(|model_resolver| ObjectEntry {
                key: model_resolver.type_name.item.0,
                value: match self.variant {
                    CodegenVariant::Reader => self.build_reader_client_edge_model_resolver(
                        model_resolver,
                        relay_resolver_metadata,
                    ),
                    CodegenVariant::Normalization => self
                        .build_normalization_client_edge_model_resolver(
                            model_resolver,
                            relay_resolver_metadata,
                        ),
                },
            })
            .collect()
    }

    fn build_normalization_client_edge_model_resolver(
        &mut self,
        model_resolver: &ClientEdgeModelResolver,
        backing_resolver_metadata: &RelayResolverMetadata,
    ) -> Primitive {
        let model_resolver_metadata =
            client_edge_model_resolver_metadata(model_resolver, backing_resolver_metadata);
        let resolver_module = self.resolver_js_module_dependency(&model_resolver_metadata);

        let object_props = object! {
            resolver_module: Primitive::JSModuleDependency(resolver_module),
        };

        Primitive::Key(self.object(object_props))
    }

    fn build_reader_client_edge_model_resolver(
        &mut self,
        model_resolver: &ClientEdgeModelResolver,
        backing_resolver_metadata: &RelayResolverMetadata,
    ) -> Primitive {
        let model_resolver_metadata =
            client_edge_model_resolver_metadata(model_resolver, backing_resolver_metadata);
        let fragment_name = model_resolver
            .resolver_info
            .fragment_name
            .expect(MODEL_RESOLVER_FRAGMENT_EXPECTATION);
        let fragment_primitive = Primitive::Key(self.object(object! {
            args: Primitive::SkippableNull,
            kind: Primitive::String(CODEGEN_CONSTANTS.fragment_spread),
            name: Primitive::String(fragment_name.0),
        }));
        self.build_reader_relay_resolver(&model_resolver_metadata, Some(fragment_primitive))
    }

    fn build_reader_relay_resolver_args(
        &mut self,
        relay_resolver_metadata: &RelayResolverMetadata,
    ) -> Primitive {
        let field = relay_resolver_metadata.field(self.schema);
        // Check field.arguments here instead of relay_resolver_metadata.field_arguments. field.arguments is partitioned into
        // field_arguments and fragment_arguments during the relay resolvers transform. If the resolver field is only passed a
        // fragment argument, we should fall back to the else case where we will return an empty array primitive as the resolver
        // field arguments instead of returning null.
        if field.arguments.is_empty() {
            Primitive::SkippableNull
        } else {
            // For shadow resolvers (magic fragments), the consumer's field arguments that
            // match the root fragment's @argumentDefinitions (e.g. `ids`) are partitioned
            // into fragment_arguments to parameterize the root-fragment spread. Those same
            // values must also reach the resolver function at read time, so include both
            // buckets — mirroring the normalization path. Non-shadow resolvers continue to
            // receive field_arguments only.
            let read_time_arguments: Vec<&Argument> =
                if relay_resolver_metadata.return_fragment.is_some() {
                    relay_resolver_metadata
                        .field_arguments
                        .iter()
                        .chain(relay_resolver_metadata.fragment_arguments.iter())
                        .collect()
                } else {
                    relay_resolver_metadata.field_arguments.iter().collect()
                };
            self.build_arguments_from_refs(read_time_arguments)
                .map_or_else(
                    || {
                        // Passing an empty array here, rather than `null`, allows the runtime
                        // to know that it should still create an arguments object to pass to
                        // the resolver, even though no arguments were provided at the callsite,
                        // since all arguments are optional.
                        Primitive::Key(self.array(vec![]))
                    },
                    Primitive::Key,
                )
        }
    }

    fn build_reader_relay_resolver(
        &mut self,
        relay_resolver_metadata: &RelayResolverMetadata,
        fragment_primitive: Option<Primitive>,
    ) -> Primitive {
        let field = relay_resolver_metadata.field(self.schema);
        let field_alias = relay_resolver_metadata.field_alias;
        let field_name = field.name.item;
        let path = relay_resolver_metadata.field_path;

        let kind = if relay_resolver_metadata.live {
            CODEGEN_CONSTANTS.relay_live_resolver
        } else {
            CODEGEN_CONSTANTS.relay_resolver
        };

        let args = self.build_reader_relay_resolver_args(relay_resolver_metadata);

        let resolver_js_module = self.resolver_js_module_dependency(relay_resolver_metadata);

        let resolver_module = if let Some((fragment_name, injection_mode)) =
            relay_resolver_metadata.fragment_data_injection_mode
        {
            let fragment_import_path = self.project_config.js_module_import_identifier(
                &self
                    .project_config
                    .artifact_path_for_definition(self.definition_source_location),
                &self.project_config.create_path_for_artifact(
                    fragment_name.location.source_location(),
                    fragment_name.item.to_string(),
                ),
            );

            let resolver_fn = match relay_resolver_metadata.resolver_type {
                ResolverSchemaGenType::ResolverModule => {
                    Box::new(Primitive::JSModuleDependency(resolver_js_module))
                }
                ResolverSchemaGenType::PropertyLookup { property_name } => {
                    Box::new(Primitive::PropertyAccessor(property_name.to_string()))
                }
            };

            Primitive::RelayResolverModel {
                graphql_module_name: fragment_name.item.0,
                graphql_module_path: fragment_import_path,
                resolver_fn,
                injected_field_name_details: match injection_mode {
                    FragmentDataInjectionMode::Field { name, is_required } => {
                        Some((name, is_required))
                    }
                },
            }
        } else {
            Primitive::JSModuleDependency(resolver_js_module)
        };

        // For Relay Resolvers in the Reader AST, we need enough
        // information to _read_ the resolver. Specifically, enough data
        // to construct a fragment key, and an import of the resolver
        // module itself.
        let mut object_props = object! {
            :build_alias(field_alias, field_name),
            args: args,
            fragment: match fragment_primitive {
                None => Primitive::SkippableNull,
                Some(fragment_primitive) => fragment_primitive,
            },
            kind: Primitive::String(kind),
            name: Primitive::String(field_name),
            resolver_module: resolver_module,
            path: Primitive::String(path),
        };

        if let ResolverOutputTypeInfo::Composite(normalization_info) =
            &relay_resolver_metadata.output_type_info
        {
            let normalization_artifact_source_location = normalization_info
                .normalization_operation
                .location
                .source_location();

            let normalization_import_path = self.project_config.js_module_import_identifier(
                &self
                    .project_config
                    .artifact_path_for_definition(self.definition_source_location),
                &self.project_config.create_path_for_artifact(
                    normalization_artifact_source_location,
                    normalization_info.normalization_operation.item.to_string(),
                ),
            );
            let concrete_type = if normalization_info.inner_type.is_abstract_type() {
                Primitive::Null
            } else {
                Primitive::String(self.schema.get_type_name(normalization_info.inner_type))
            };

            // A shadow (`@returnFragment`) resolver returning a non-Node SERVER
            // VALUE type is read INLINE IN PLACE off the transplanted
            // `client:<parentid>:<field>` record. It takes the same
            // inline reader branch as `OutputType`/`WeakModel` (no
            // `ensureClientRecord`, no refetch) but must NOT carry a
            // `normalizationNode`: the value is already normalized once by the
            // transplant, so a second normalization would double-store it. We emit
            // a dedicated `ServerWeak` kind WITHOUT a `normalizationNode`;
            // `LiveResolverCache._setResolverValue` skips re-normalization for it,
            // and the reader sources `storeID` from the resolver-returned `__id`.
            // This read-in-place classification is the single source of truth in
            // `relay_schema::definitions::is_server_weak_shadow_return`, shared
            // with `field_transform` (which routed it to this `Composite` arm),
            // the nested-objects pass (which skips its normalization operation),
            // and `relay-typegen` (which emits a `{__typename, __id}` identity
            // return type rather than a dangling `$normalization` import). A
            // `@weak` model is a client-extension type, so the helper returns
            // `false` for it and the `weak_object_instance_field` branch below
            // still handles weak returns.
            let is_server_weak = relay_schema::definitions::is_server_weak_shadow_return(
                self.schema,
                normalization_info.inner_type,
                self.project_config.schema_config.node_interface_id_field,
                relay_resolver_metadata.return_fragment.is_some(),
            );

            // An INTERFACE/UNION shadow return with inline (weak/value)
            // implementors. The abstract type has no object id, so each
            // implementor's kind is emitted per `__typename` in an `inlineKinds`
            // map (`WeakModel` for an `@weak` member, `ServerWeak` for a non-Node
            // server-value member) and the runtime dispatches per concrete
            // `__typename` at read time. Like the concrete weak/value arms it
            // carries NO `normalizationNode` (no abstract normalization operation
            // exists), so it never falls into the `OutputType` branch below (which
            // would emit a dangling `$normalization` import). `concrete_type` is
            // `null` (abstract). Every abstract inline return — pure-weak,
            // pure-value, AND mixed — takes this one first-class `AbstractInline`
            // shape, so the concrete `WeakModel`/`ServerWeak` arms below stay
            // untouched (the concrete `@weak` path stores its model as-is, no
            // per-`__typename` unwrap overload).
            let abstract_inline_kinds = if relay_resolver_metadata.return_fragment.is_some()
                && normalization_info.inner_type.is_abstract_type()
            {
                relay_schema::definitions::abstract_shadow_return_inline_kinds_by_typename(
                    self.schema,
                    normalization_info.inner_type,
                    self.project_config.schema_config.node_interface_id_field,
                )
            } else {
                None
            };

            let normalization_info = if let Some(kinds_by_typename) = abstract_inline_kinds {
                let inline_kind_entries: Vec<ObjectEntry> = kinds_by_typename
                    .iter()
                    .map(|(type_name, kind)| {
                        let kind_constant = match kind {
                            relay_schema::definitions::AbstractInlineKind::WeakModel => {
                                CODEGEN_CONSTANTS.weak_model
                            }
                            relay_schema::definitions::AbstractInlineKind::ServerWeak => {
                                CODEGEN_CONSTANTS.server_weak
                            }
                        };
                        ObjectEntry {
                            key: *type_name,
                            value: Primitive::String(kind_constant),
                        }
                    })
                    .collect();
                object! {
                    kind: Primitive::String(CODEGEN_CONSTANTS.abstract_inline),
                    concrete_type: concrete_type,
                    plural: Primitive::Bool(normalization_info.plural),
                    inline_kinds: Primitive::Key(self.object(inline_kind_entries)),
                }
            } else if is_server_weak {
                object! {
                    kind: Primitive::String(CODEGEN_CONSTANTS.server_weak),
                    concrete_type: concrete_type,
                    plural: Primitive::Bool(normalization_info.plural),
                }
            } else if normalization_info.weak_object_instance_field.is_some() {
                object! {
                    kind: Primitive::String(CODEGEN_CONSTANTS.weak_model),
                    concrete_type: concrete_type,
                    plural: Primitive::Bool(normalization_info.plural),
                }
            } else {
                object! {
                    kind: Primitive::String(CODEGEN_CONSTANTS.output_type),
                    concrete_type: concrete_type,
                    plural: Primitive::Bool(normalization_info.plural),
                    normalization_node: Primitive::GraphQLModuleDependency(GraphQLModuleDependency::Path {
                        path: normalization_import_path,
                        name: normalization_info.normalization_operation.item.into(),
                    }),
                }
            };

            object_props.push(ObjectEntry {
                key: CODEGEN_CONSTANTS.relay_resolver_normalization_info,
                value: Primitive::Key(self.object(normalization_info)),
            })
        }

        Primitive::Key(self.object(object_props))
    }

    fn build_normalization_fragment_spread(
        &mut self,
        frag_spread: &FragmentSpread,
        normalization_import_path: StringKey,
    ) -> Primitive {
        let args = self.build_arguments(&frag_spread.arguments);

        Primitive::Key(self.object(object! {
                args: match args {
                        None => Primitive::SkippableNull,
                        Some(key) => Primitive::Key(key),
                    },
                fragment: Primitive::GraphQLModuleDependency(GraphQLModuleDependency::Path {
                    path: normalization_import_path,
                    name: frag_spread.fragment.item.into(),
                }),
                kind: Primitive::String(
                            CODEGEN_CONSTANTS.fragment_spread
                    ),
        }))
    }

    fn build_defer(
        &mut self,
        context: &mut ContextualMetadata,
        inline_fragment: &InlineFragment,
        defer: &Directive,
    ) -> Primitive {
        match self.variant {
            CodegenVariant::Reader => self.build_defer_reader(context, inline_fragment),
            CodegenVariant::Normalization => {
                self.build_defer_normalization(context, inline_fragment, defer)
            }
        }
    }

    fn build_defer_reader(
        &mut self,
        context: &mut ContextualMetadata,
        inline_fragment: &InlineFragment,
    ) -> Primitive {
        let next_selections =
            if let Selection::FragmentSpread(frag_spread) = &inline_fragment.selections[0] {
                let next_selections = vec![self.build_fragment_spread(frag_spread)];
                Primitive::Key(self.array(next_selections))
            } else {
                self.build_selections(context, inline_fragment.selections.iter())
            };

        Primitive::Key(self.object(object! {
            kind: Primitive::String(CODEGEN_CONSTANTS.defer),
            selections: next_selections,
        }))
    }

    fn build_defer_normalization(
        &mut self,
        context: &mut ContextualMetadata,
        inline_fragment: &InlineFragment,
        defer: &Directive,
    ) -> Primitive {
        let next_selections = self.build_selections(context, inline_fragment.selections.iter());
        let DeferDirective { if_arg, label_arg } = DeferDirective::from(
            defer,
            &self.project_config.schema_config.defer_stream_interface,
        );
        let if_variable_name = if_arg.and_then(|arg| match &arg.value.item {
            // `true` is the default, remove as the AST is typed just as a variable name string
            // `false` constant values should've been transformed away in skip_unreachable_node
            Value::Constant(ConstantValue::Boolean(true)) => None,
            Value::Variable(var) => Some(var.name.item),
            other => panic!("unexpected value for @defer if argument: {other:?}"),
        });
        let label_name = label_arg.unwrap().value.item.expect_string_literal();

        Primitive::Key(self.object(object! {
            if_: Primitive::string_or_null(if_variable_name.map(|variable_name| variable_name.0)),
            kind: Primitive::String(CODEGEN_CONSTANTS.defer),
            label: Primitive::String(label_name),
            selections: next_selections,
        }))
    }

    fn build_stream(
        &mut self,
        context: &mut ContextualMetadata,
        linked_field: &LinkedField,
        stream: &Directive,
    ) -> Primitive {
        let next_selections = self.build_linked_field_and_handles(
            context,
            &LinkedField {
                directives: remove_directive(
                    &linked_field.directives,
                    self.project_config
                        .schema_config
                        .defer_stream_interface
                        .stream_name,
                ),
                ..linked_field.to_owned()
            },
        );
        let next_selections = Primitive::Key(self.array(next_selections));
        Primitive::Key(match self.variant {
            CodegenVariant::Reader => self.object(object! {
                kind: Primitive::String(CODEGEN_CONSTANTS.stream),
                selections: next_selections,
            }),
            CodegenVariant::Normalization => {
                let StreamDirective {
                    if_arg,
                    label_arg,
                    use_customized_batch_arg: _,
                    initial_count_arg: _,
                } = StreamDirective::from(
                    stream,
                    &self.project_config.schema_config.defer_stream_interface,
                );
                let if_variable_name = if_arg.and_then(|arg| match &arg.value.item {
                    // `true` is the default, remove as the AST is typed just as a variable name string
                    // `false` constant values should've been transformed away in skip_unreachable_node
                    Value::Constant(ConstantValue::Boolean(true)) => None,
                    Value::Variable(var) => Some(var.name.item),
                    other => panic!("unexpected value for @stream if argument: {other:?}"),
                });
                let label_name = label_arg.unwrap().value.item.expect_string_literal();
                self.object(object! {
                     if_: Primitive::string_or_null(if_variable_name.map(|variable_name| variable_name.0)),
                     kind: Primitive::String(CODEGEN_CONSTANTS.stream),
                     label: Primitive::String(label_name),
                     selections: next_selections,
                 })
            }
        })
    }

    // This function creates a node that is the UNION of the nodes that would be created for read time resolvers
    // and for exec time resolvers (so runtime has ALL the information it needs to run for both resolver modes.)
    // For C2C (client-to-client) edges, we emit ClientEdgeToClientObject with model resolvers.
    // For C2S (client-to-server) edges, we emit ClientEdgeToServerObject with the operation reference.
    fn build_client_edge_exec_and_read_time(
        &mut self,
        context: &mut ContextualMetadata,
        client_edge_metadata: ClientEdgeMetadata<'_>,
    ) -> Primitive {
        let backing_field_primitives =
            self.build_selections_from_selection(context, client_edge_metadata.backing_field);

        if backing_field_primitives.len() != 1 {
            panic!(
                "Expected client edge backing field to be transformed into exactly one primitive."
            )
        }
        let backing_field = backing_field_primitives.into_iter().next().unwrap();

        let selections_item = self.build_linked_field(context, client_edge_metadata.linked_field);

        match &client_edge_metadata.metadata_directive {
            ClientEdgeMetadataDirective::ClientObject {
                model_resolvers, ..
            } => {
                let field_directives = match &client_edge_metadata.backing_field {
                    Selection::ScalarField(field) => Some(&field.directives),
                    // Although the reader checks for FragmentSpreads on the backing field, the normalization
                    // transforms inline the fragment spread so we match an InlineFragment here
                    Selection::InlineFragment(inline_frag) => Some(&inline_frag.directives),
                    _ => panic!(
                        "Expected Client Edge backing field to be a Relay Resolver. {:?}",
                        client_edge_metadata.backing_field
                    ),
                };
                let client_edge_model_resolvers = field_directives.and_then(|field_directives| {
                    let resolver_metadata = RelayResolverMetadata::find(field_directives).unwrap();
                    let is_weak_resolver = matches!(
                        resolver_metadata.output_type_info,
                        ResolverOutputTypeInfo::Composite(_)
                    );
                    let model_resolver_primitives = if !is_weak_resolver {
                        self.build_client_edge_model_resolvers(model_resolvers, resolver_metadata)
                    } else {
                        vec![]
                    };
                    if model_resolver_primitives.is_empty() {
                        None
                    } else {
                        Some(Primitive::Key(self.object(model_resolver_primitives)))
                    }
                });

                let obj = match client_edge_model_resolvers {
                    Some(model_resolvers) => object! {
                        kind: Primitive::String(CODEGEN_CONSTANTS.client_edge_to_client_object),
                        client_edge_model_resolvers: model_resolvers,
                        client_edge_backing_field_key: backing_field,
                        client_edge_selections_key: selections_item,
                    },
                    None => object! {
                        kind: Primitive::String(CODEGEN_CONSTANTS.client_edge_to_client_object),
                        client_edge_backing_field_key: backing_field,
                        client_edge_selections_key: selections_item,
                    },
                };
                Primitive::Key(self.object(obj))
            }
            ClientEdgeMetadataDirective::ServerObject { query_name, .. } => {
                // C2S (client-to-server) edges need to emit ClientEdgeToServerObject
                // with the operation reference so the executor can trigger the waterfall fetch.
                context.has_client_to_server_resolvers = true;
                let obj = object! {
                    kind: Primitive::String(CODEGEN_CONSTANTS.client_edge_to_server_object),
                    operation: Primitive::GraphQLModuleDependency(GraphQLModuleDependency::Name(ExecutableDefinitionName::OperationDefinitionName(*query_name))),
                    client_edge_backing_field_key: backing_field,
                    client_edge_selections_key: selections_item,
                };
                Primitive::Key(self.object(obj))
            }
        }
    }

    fn build_normalization_client_edge(
        &mut self,
        context: &mut ContextualMetadata,
        client_edge_metadata: ClientEdgeMetadata<'_>,
    ) -> Primitive {
        let backing_field_primitives =
            self.build_selections_from_selection(context, client_edge_metadata.backing_field);

        if backing_field_primitives.len() != 1 {
            panic!(
                "Expected client edge backing field to be transformed into exactly one primitive."
            )
        }
        let backing_field = backing_field_primitives.into_iter().next().unwrap();

        let field_type = self
            .schema
            .field(client_edge_metadata.linked_field.definition.item)
            .type_
            .inner();

        if self.schema.is_extension_type(field_type) {
            let selections_item =
                self.build_linked_field(context, client_edge_metadata.linked_field);
            Primitive::Key(self.object(object! {
                kind: Primitive::String(CODEGEN_CONSTANTS.client_edge_to_client_object),
                client_edge_backing_field_key: backing_field,
                client_edge_selections_key: selections_item,
            }))
        } else {
            // For read-time C2S edges, the waterfall query is handled by the
            // OperationExecutor using the reader AST's ClientEdgeToServerObject node.
            // The normalization AST only needs the backing resolver field.
            backing_field
        }
    }

    fn build_reader_client_edge(
        &mut self,
        context: &mut ContextualMetadata,
        client_edge_metadata: &ClientEdgeMetadata<'_>,
        required_metadata: Option<RequiredMetadataDirective>,
        catch_metadata: Option<CatchMetadataDirective>,
    ) -> Primitive {
        context.has_client_edges = true;
        let backing_field = match &client_edge_metadata.backing_field {
            Selection::FragmentSpread(fragment_spread) => {
                self.build_fragment_spread(fragment_spread)
            }
            Selection::ScalarField(field) => {
                if let Some(resolver_metadata) = RelayResolverMetadata::find(&field.directives) {
                    self.build_scalar_backed_resolver_field(context, field, resolver_metadata)
                } else {
                    panic!("Expected field backing a Client Edge to be a Relay Resolver. {field:?}")
                }
            }
            _ => panic!(
                "Expected Client Edge backing field to be a Relay Resolver. {:?}",
                client_edge_metadata.backing_field
            ),
        };

        let selections_item = if required_metadata.is_none() {
            self.build_linked_field(context, client_edge_metadata.linked_field)
        } else {
            let next_directives = client_edge_metadata
                .linked_field
                .directives
                .iter()
                .filter(|directive| {
                    directive.name.item != RequiredMetadataDirective::directive_name()
                })
                .cloned()
                .collect();

            self.build_linked_field(
                context,
                &LinkedField {
                    directives: next_directives,
                    ..client_edge_metadata.linked_field.clone()
                },
            )
        };

        let field = match &client_edge_metadata.metadata_directive {
             ClientEdgeMetadataDirective::ServerObject { query_name, .. } => {
                 Primitive::Key(self.object(object! {
                     kind: Primitive::String(CODEGEN_CONSTANTS.client_edge_to_server_object),
                     operation: Primitive::GraphQLModuleDependency(GraphQLModuleDependency::Name(ExecutableDefinitionName::OperationDefinitionName(OperationDefinitionName(query_name.0)))),
                     client_edge_backing_field_key: backing_field,
                     client_edge_selections_key: selections_item,
                 }))
             }

             ClientEdgeMetadataDirective::ClientObject { type_name, model_resolvers, server_object_operations, .. } => {
                 if self.project_config.feature_flags.disable_resolver_reader_ast {
                     selections_item
                 } else {
                     let concrete_type = type_name.map_or(Primitive::Null, |type_name| Primitive::String(type_name.0));
                     let field_directives = match &client_edge_metadata.backing_field {
                         Selection::ScalarField(field) => Some(&field.directives),
                         Selection::FragmentSpread(frag_spread) => Some(&frag_spread.directives),
                         _ => panic!(
                             "Expected Client Edge backing field to be a Relay Resolver. {:?}",
                             client_edge_metadata.backing_field
                         ),
                     };
                     let model_resolver_field = field_directives.and_then(|field_directives| {
                         let resolver_metadata = RelayResolverMetadata::find(field_directives).unwrap();
                         let is_weak_resolver = matches!(resolver_metadata.output_type_info, ResolverOutputTypeInfo::Composite(_));
                         if !is_weak_resolver {
                             let model_resolver_primitives = self.build_client_edge_model_resolvers(
                                 model_resolvers,
                                 resolver_metadata,
                             );
                             if model_resolver_primitives.is_empty() {
                                 None
                             } else {
                                 Some(self.object(model_resolver_primitives))
                             }
                         } else {
                             None
                         }
                         });
                         let client_edge_model_resolvers = if let Some(model_resolver_field) = model_resolver_field {
                             Primitive::Key(model_resolver_field)
                         } else if type_name.is_none() {
                             // Abstract edge (`concreteType: null`): the concrete
                             // type is only known at read time from the resolver's
                             // returned `__typename`. Emit an empty (non-null)
                             // dispatch map so the runtime takes the `modelResolvers
                             // != null` path -- a returned server `__typename` is
                             // absent from the map and reads off the raw store id
                             // (the transplanted record), while a client
                             // `__typename` would route to its model resolver. A
                             // `null` map would instead send the read down the
                             // concrete-client-object path (`ensureClientRecord`),
                             // which mis-namespaces a server pointer.
                             Primitive::Key(self.object(vec![]))
                         } else {
                             // Concrete client object edge (`concreteType` set):
                             // `ensureClientRecord(id, concreteType)` is correct.
                             Primitive::Null
                         };
                         let server_op = if server_object_operations.is_empty() {
                             Primitive::Null
                         } else {
                             let entries: Vec<ObjectEntry> = server_object_operations
                                 .iter()
                                 .map(|op| ObjectEntry {
                                     key: op.type_name.0,
                                     value: Primitive::GraphQLModuleDependency(
                                         GraphQLModuleDependency::Name(
                                             ExecutableDefinitionName::OperationDefinitionName(op.query_name),
                                         ),
                                     ),
                                 })
                                 .collect();
                             Primitive::Key(self.object(entries))
                         };
                         Primitive::Key(self.object(object! {
                             kind: Primitive::String(CODEGEN_CONSTANTS.client_edge_to_client_object),
                             concrete_type: concrete_type,
                             client_edge_model_resolvers: client_edge_model_resolvers,
                             server_object_operations: server_op,
                             client_edge_backing_field_key: backing_field,
                             client_edge_selections_key: selections_item,
                         }))
                 }
             }

         };

        if let Some(required_metadata) = required_metadata {
            self.build_required_field(&required_metadata, field)
        } else if let Some(catch_metadata) = catch_metadata {
            self.build_catch_node(&catch_metadata, field)
        } else {
            field
        }
    }

    fn build_inline_fragment(
        &mut self,
        context: &mut ContextualMetadata,
        inline_frag: &InlineFragment,
    ) -> Primitive {
        match inline_frag.type_condition {
            None => {
                if let Some(client_edge_metadata) = ClientEdgeMetadata::find(inline_frag) {
                    match self.variant {
                        CodegenVariant::Reader => {
                            let required_metadata =
                                RequiredMetadataDirective::find(&inline_frag.directives).cloned();
                            let catch_metadata =
                                CatchMetadataDirective::find(&inline_frag.directives).cloned();
                            self.build_reader_client_edge(
                                context,
                                &client_edge_metadata,
                                required_metadata,
                                catch_metadata,
                            )
                        }
                        CodegenVariant::Normalization => {
                            // In this case, the functions we run for exec time mode only and for exec and read time mode
                            // are the exact same. This is because the node fields for read time is a subset of the node
                            // fields for exec time.
                            if self.use_exec_time_resolvers(context)
                                || self.use_exec_and_read_time_resolvers(context)
                            {
                                self.build_client_edge_exec_and_read_time(
                                    context,
                                    client_edge_metadata,
                                )
                            } else {
                                self.build_normalization_client_edge(context, client_edge_metadata)
                            }
                        }
                    }
                } else if
                // TODO(T63388023): Use typed custom directives
                inline_frag.directives.len() == 1
                    && inline_frag.directives[0].name.item == *CLIENT_EXTENSION_DIRECTIVE_NAME
                {
                    let selections = self.build_selections(context, inline_frag.selections.iter());
                    Primitive::Key(self.object(object! {
                        kind: Primitive::String(CODEGEN_CONSTANTS.client_extension),
                        selections: selections,
                    }))
                } else if let Some(fragment_alias_metadata) =
                    FragmentAliasMetadata::find(&inline_frag.directives)
                {
                    let selections = self.build_selections(context, inline_frag.selections.iter());
                    let primitive = Primitive::Key(self.object(object! {
                        kind: Primitive::String(CODEGEN_CONSTANTS.inline_fragment),
                        selections: selections,
                        type_: Primitive::SkippableNull,
                        abstract_key: Primitive::SkippableNull,
                    }));
                    let aliased_fragment = Primitive::Key(self.object(object! {
                        fragment: primitive,
                        kind: Primitive::String(CODEGEN_CONSTANTS.aliased_inline_fragment_spread),
                        name: Primitive::String(fragment_alias_metadata.alias.item),
                    }));
                    if let Some(catch_metadata) =
                        CatchMetadataDirective::find(&inline_frag.directives)
                    {
                        self.build_catch_node(catch_metadata, aliased_fragment)
                    } else {
                        aliased_fragment
                    }
                } else {
                    // TODO(T63559346): Handle anonymous inline fragments with no directives
                    panic!(
                        "Unexpected custom directives: {:#?}",
                        inline_frag.directives
                    );
                }
            }
            Some(type_condition) => {
                if self.variant == CodegenVariant::Normalization {
                    let is_abstract_inline_fragment = type_condition.is_abstract_type();
                    if is_abstract_inline_fragment {
                        // Maintain a few invariants:
                        // - InlineFragment (and `selections` arrays generally) cannot be empty
                        // - Don't emit a TypeDiscriminator under an InlineFragment unless it has
                        //   a different abstractKey
                        // This means we have to handle two cases:
                        // - The inline fragment only contains a TypeDiscriminator with the same
                        //   abstractKey: replace the Fragment w the Discriminator
                        // - The inline fragment contains other selections: return all the selections
                        //   minus any Discriminators w the same key
                        let has_type_discriminator = inline_frag
                            .selections
                            .iter()
                            .any(is_type_discriminator_selection);

                        if has_type_discriminator {
                            if inline_frag.selections.len() == 1 {
                                return self.build_type_discriminator(
                                    if let Selection::ScalarField(field) =
                                        &inline_frag.selections[0]
                                    {
                                        field
                                    } else {
                                        panic!("Expected a scalar field.")
                                    },
                                );
                            } else {
                                let selections = self.build_selections(
                                    context,
                                    inline_frag.selections.iter().filter(|selection| {
                                        !is_type_discriminator_selection(selection)
                                    }),
                                );
                                return Primitive::Key(self.object(object! {
                                    kind: Primitive::String(CODEGEN_CONSTANTS.inline_fragment),
                                    selections: selections,
                                    type_: Primitive::String(
                                            self.schema.get_type_name(type_condition),
                                        ),
                                    abstract_key: Primitive::String(
                                            generate_abstract_type_refinement_key(
                                                self.schema,
                                                type_condition,
                                            ),
                                        ),
                                }));
                            }
                        }
                    }
                }
                let selections = self.build_selections(context, inline_frag.selections.iter());
                let primitive = Primitive::Key(self.object(object! {
                    kind: Primitive::String(CODEGEN_CONSTANTS.inline_fragment),
                    selections: selections,
                    type_: Primitive::String(self.schema.get_type_name(type_condition)),
                    abstract_key: if type_condition.is_abstract_type() {
                            Primitive::String(generate_abstract_type_refinement_key(
                                self.schema,
                                type_condition,
                            ))
                        } else {
                            Primitive::SkippableNull
                        },
                }));
                if let Some(fragment_alias_metadata) =
                    FragmentAliasMetadata::find(&inline_frag.directives)
                {
                    let aliased_fragment = Primitive::Key(self.object(object! {
                        fragment: primitive,
                        kind: Primitive::String(CODEGEN_CONSTANTS.aliased_inline_fragment_spread),
                        name: Primitive::String(fragment_alias_metadata.alias.item),
                    }));
                    if let Some(catch_metadata) =
                        CatchMetadataDirective::find(&inline_frag.directives)
                    {
                        self.build_catch_node(catch_metadata, aliased_fragment)
                    } else {
                        aliased_fragment
                    }
                } else {
                    primitive
                }
            }
        }
    }

    fn build_condition(
        &mut self,
        context: &mut ContextualMetadata,
        condition: &Condition,
    ) -> Primitive {
        let selections = self.build_selections(context, condition.selections.iter());
        Primitive::Key(self.object(object! {
            condition: Primitive::String(match &condition.value {
                ConditionValue::Variable(variable) => variable.name.item.0,
                ConditionValue::Constant(_) => panic!(
                    "Expected Condition with static value to have been pruned or inlined."
                ),
            }),
            kind: Primitive::String(CODEGEN_CONSTANTS.condition_value),
            passing_value: Primitive::Bool(condition.passing_value),
            selections: selections,
        }))
    }

    pub fn build_operation_variable_definitions(
        &mut self,
        variable_definitions: &[VariableDefinition],
    ) -> AstKey {
        let var_defs = variable_definitions
            .iter()
            .map(|def| {
                let default_value = if let Some(const_val) = &def.default_value {
                    self.build_constant_value(&const_val.item)
                } else {
                    Primitive::Null
                };
                Primitive::Key(self.object(object! {
                    default_value: default_value,
                    kind: Primitive::String(CODEGEN_CONSTANTS.local_argument),
                    name: Primitive::String(def.name.item.0),
                }))
            })
            .collect::<Vec<_>>();

        self.array(var_defs)
    }

    fn build_fragment_variable_definitions(
        &mut self,
        local_variable_definitions: &[VariableDefinition],
        global_variable_definitions: &[VariableDefinition],
    ) -> Primitive {
        // TODO(T63164787) this will produce argument_definitions in a different order than our JS codegen
        let mut var_defs = Vec::with_capacity(
            local_variable_definitions.len() + global_variable_definitions.len(),
        );
        for def in local_variable_definitions {
            let object = object! {
                default_value: if let Some(const_val) = &def.default_value {
                    self.build_constant_value(&const_val.item)
                } else {
                    Primitive::Null
                },
                kind: Primitive::String(CODEGEN_CONSTANTS.local_argument),
                name: Primitive::String(def.name.item.0),
            };

            var_defs.push((def.name.item, Primitive::Key(self.object(object))));
        }
        for def in global_variable_definitions {
            var_defs.push((
                def.name.item,
                Primitive::Key(self.object(object! {
                    kind: Primitive::String(CODEGEN_CONSTANTS.root_argument),
                    name: Primitive::String(def.name.item.0),
                })),
            ));
        }

        var_defs.sort_unstable_by_key(|(name_a, _)| *name_a);
        let mut sorted_var_defs = Vec::with_capacity(var_defs.len());

        for (_, var_def) in var_defs {
            sorted_var_defs.push(var_def);
        }

        Primitive::Key(self.array(sorted_var_defs))
    }

    fn build_arguments(&mut self, arguments: &[Argument]) -> Option<AstKey> {
        self.build_arguments_from_refs(arguments.iter().collect())
    }

    fn build_arguments_from_refs(&mut self, mut sorted_args: Vec<&Argument>) -> Option<AstKey> {
        sorted_args.sort_unstable_by_key(|arg| arg.name.item);

        let args = sorted_args
            .into_iter()
            // We are filtering out "null" arguments matching JS behavior
            .filter_map(|arg| self.build_argument(arg.name.item.0, &arg.value.item))
            .map(Primitive::Key)
            .collect::<Vec<_>>();
        if args.is_empty() {
            None
        } else {
            Some(self.array(args))
        }
    }

    fn build_argument(&mut self, arg_name: StringKey, arg_value: &Value) -> Option<AstKey> {
        match arg_value {
            Value::Constant(const_val) => self.build_constant_argument(arg_name, const_val),
            Value::Variable(variable) => {
                let name = Primitive::String(arg_name);
                let variable_name = Primitive::String(variable.name.item.0);
                Some(self.object(object! {
                    kind: Primitive::String(CODEGEN_CONSTANTS.variable),
                    name: name,
                    // TODO(T63303966) type is always skipped in JS compiler
                    variable_name: variable_name,
                }))
            }
            Value::List(list) => {
                let items = list
                    .iter()
                    .enumerate()
                    .map(|(i, val)| {
                        let item_name = format!("{arg_name}.{i}").as_str().intern();
                        match self.build_argument(item_name, val) {
                            None => Primitive::Null,
                            Some(key) => Primitive::Key(key),
                        }
                    })
                    .collect::<Vec<_>>();
                let object = object! {
                    items: Primitive::Key(self.array(items)),
                    kind: Primitive::String(CODEGEN_CONSTANTS.list_value),
                    name: Primitive::String(arg_name),
                };
                Some(self.object(object))
            }
            Value::Object(object) => {
                let mut sorted_object = object.clone();
                sorted_object.sort_by_key(|arg| arg.name);
                let fields = sorted_object
                    .into_iter()
                    .map(|arg| {
                        let field_name = arg.name.item;
                        if let Some(concrete_arg) =
                            self.build_argument(field_name.0, &arg.value.item)
                        {
                            Primitive::Key(concrete_arg)
                        } else {
                            // For object types, we do want to keep the literal argument
                            // for null, instead of filtering it out, matching JS behavior
                            Primitive::Key(self.object(object! {
                                kind: Primitive::String(CODEGEN_CONSTANTS.literal),
                                name: Primitive::String(field_name.0),
                                value: Primitive::Null,
                            }))
                        }
                    })
                    .collect::<Vec<_>>();
                let object = object! {
                    fields: Primitive::Key(self.array(fields)),
                    kind: Primitive::String(CODEGEN_CONSTANTS.object_value),
                    name: Primitive::String(arg_name),
                };
                Some(self.object(object))
            }
        }
    }

    fn build_constant_argument(
        &mut self,
        arg_name: StringKey,
        arg_value: &ConstantValue,
    ) -> Option<AstKey> {
        match arg_value {
            // We return None here to filter out "null" arguments, matching JS behavior
            ConstantValue::Null() => None,
            _ => {
                let value = self.build_constant_value(arg_value);
                Some(self.object(object! {
                    kind: Primitive::String(CODEGEN_CONSTANTS.literal),
                    name: Primitive::String(arg_name),
                    value: value,
                }))
            }
        }
    }

    fn build_constant_value(&mut self, value: &ConstantValue) -> Primitive {
        match value {
            ConstantValue::Int(val) => Primitive::Int(*val),
            ConstantValue::Float(val) => Primitive::Float(*val),
            ConstantValue::String(val) => Primitive::String(*val),
            ConstantValue::Boolean(val) => Primitive::Bool(*val),
            ConstantValue::Null() => Primitive::Null,
            ConstantValue::Enum(val) => Primitive::String(*val),
            ConstantValue::List(val_list) => {
                let json_values = val_list
                    .iter()
                    .map(|val| self.build_constant_value(val))
                    .collect::<Vec<_>>();
                Primitive::Key(self.array(json_values))
            }
            ConstantValue::Object(val_object) => {
                let mut sorted_val_object: Vec<&_> = val_object.iter().collect();
                sorted_val_object.sort_unstable_by_key(|arg| arg.name.item);

                let json_values = sorted_val_object
                    .into_iter()
                    .map(|arg| ObjectEntry {
                        key: arg.name.item.0,
                        value: self.build_constant_value(&arg.value.item),
                    })
                    .collect::<Vec<_>>();
                Primitive::Key(self.object(json_values))
            }
        }
    }

    fn resolve_module_import_name(
        &self,
        module_name: StringKey,
        module_source_location: common::SourceLocationKey,
        provider: ModuleProvider,
    ) -> StringKey {
        if !matches!(provider, ModuleProvider::Custom { .. }) {
            return module_name;
        }
        let module_name_str = module_name.lookup();
        let is_relative = module_name_str.starts_with("./") || module_name_str.starts_with("../");

        if matches!(self.project_config.js_module_format, JsModuleFormat::Haste) || !is_relative {
            module_name
        } else {
            assert!(
                !module_source_location.is_generated(),
                "Cannot resolve relative @module path '{}' from a generated source location",
                module_name_str
            );
            let mut source_dir = PathBuf::from(module_source_location.path());
            source_dir.pop();
            let module_path = normalize_path(&source_dir.join(PathBuf::from(module_name_str)));

            self.project_config.js_module_import_identifier(
                &self
                    .project_config
                    .artifact_path_for_definition(self.definition_source_location),
                &module_path,
            )
        }
    }

    fn resolve_normalization_import(
        &self,
        fragment_name: FragmentDefinitionName,
        fragment_source_location: common::SourceLocationKey,
        provider: ModuleProvider,
    ) -> StringKey {
        if !matches!(provider, ModuleProvider::Custom { .. })
            || matches!(self.project_config.js_module_format, JsModuleFormat::Haste)
        {
            return get_normalization_fragment_filename(fragment_name);
        }
        assert!(
            !fragment_source_location.is_generated(),
            "Cannot resolve normalization import path for fragment '{}' from a generated source location",
            fragment_name
        );
        let normalization_filename = format!(
            "{}.graphql",
            get_normalization_operation_name(fragment_name.0)
        );
        let artifact_path = self
            .project_config
            .artifact_path_for_definition(self.definition_source_location);
        let norm_artifact_path = self
            .project_config
            .path_for_language_specific_artifact(fragment_source_location, normalization_filename);
        self.project_config
            .js_module_import_identifier(&artifact_path, &norm_artifact_path)
    }

    fn build_module_import_selections(
        &mut self,
        module_metadata: &ModuleMetadata,
        inline_fragment: &InlineFragment,
    ) -> Vec<Primitive> {
        let fragment_name = module_metadata.fragment_name;
        let module_prop_name = fragment_prop_name(fragment_name).unwrap_or_else(|| {
            panic!(
                "@module fragments should be named 'FragmentName_propName', got '{fragment_name}'."
            )
        });

        let frag_spread = inline_fragment.selections.iter().find_map(|sel| match sel {
            Selection::FragmentSpread(frag_spread) => Some(frag_spread),
            _ => None,
        });
        let args = if let Some(frag_spread) = frag_spread {
            self.build_arguments(&frag_spread.arguments)
        } else {
            None
        };
        let mut module_import = object! {
            args: match args {
                None => Primitive::SkippableNull,
                Some(key) => Primitive::Key(key),
            },
            document_name: Primitive::String(module_metadata.key),
            fragment_name: Primitive::String(fragment_name.0),
            fragment_prop_name: Primitive::String(module_prop_name),
            kind: Primitive::String(CODEGEN_CONSTANTS.module_import),
        };

        let should_use_reader_module_imports = self
            .project_config
            .feature_flags
            .use_reader_module_imports
            .is_enabled_for(module_metadata.key);

        match self.variant {
            CodegenVariant::Reader => {
                if (module_metadata.read_time_resolvers || should_use_reader_module_imports)
                    && let Some(dynamic_module_provider) = self
                        .project_config
                        .effective_module_import_config()
                        .dynamic_module_provider
                {
                    let resolved_component_module = self.resolve_module_import_name(
                        module_metadata.module_name,
                        module_metadata.module_source_location,
                        dynamic_module_provider,
                    );
                    module_import.push(ObjectEntry {
                        key: CODEGEN_CONSTANTS.component_module_provider,
                        value: Primitive::DynamicImport {
                            provider: dynamic_module_provider,
                            module: resolved_component_module,
                        },
                    });
                }
            }
            CodegenVariant::Normalization => {
                let effective_config = self.project_config.effective_module_import_config();
                if let Some(dynamic_module_provider) = effective_config.dynamic_module_provider
                    && (effective_config.surface.is_none()
                        || effective_config.surface == Some(Surface::All)
                        || (effective_config.surface == Some(Surface::Resolvers)
                            && module_metadata.read_time_resolvers))
                {
                    let operation_module_provider = match effective_config.operation_module_provider
                    {
                        Some(operation_module_provider) => operation_module_provider,
                        None => dynamic_module_provider,
                    };
                    let resolved_component_module = self.resolve_module_import_name(
                        module_metadata.module_name,
                        module_metadata.module_source_location,
                        dynamic_module_provider,
                    );
                    let resolved_operation_module = self.resolve_normalization_import(
                        fragment_name,
                        module_metadata.fragment_source_location.source_location(),
                        operation_module_provider,
                    );
                    module_import.push(ObjectEntry {
                        key: CODEGEN_CONSTANTS.component_module_provider,
                        value: Primitive::DynamicImport {
                            provider: dynamic_module_provider,
                            module: resolved_component_module,
                        },
                    });
                    module_import.push(ObjectEntry {
                        key: CODEGEN_CONSTANTS.operation_module_provider,
                        value: Primitive::DynamicImport {
                            provider: operation_module_provider,
                            module: resolved_operation_module,
                        },
                    });
                }
            }
        }
        let selection = Primitive::Key(self.object(module_import));
        vec![selection]
    }

    /// This method will wrap inline fragment with @__inline directive
    // (created by `inline_fragment_data` transform)
    /// with the node `InlineDataFragmentSpread`
    fn build_inline_data_fragment_spread(
        &mut self,
        context: &mut ContextualMetadata,
        inline_fragment: &InlineFragment,
        inline_directive_data: &InlineDirectiveMetadata,
    ) -> Primitive {
        let selections = self.build_selections(context, inline_fragment.selections.iter());
        let args = self.build_arguments(&inline_directive_data.arguments);
        let argument_definitions = self.build_fragment_variable_definitions(
            &inline_directive_data.variable_definitions,
            &inline_directive_data.used_global_variables,
        );

        Primitive::Key(self.object(object! {
            kind: Primitive::String(CODEGEN_CONSTANTS.inline_data_fragment_spread),
            name: Primitive::String(inline_directive_data.fragment_name.0),
            selections: selections,
            args: match args {
                None => Primitive::SkippableNull,
                Some(key) => Primitive::Key(key),
            },
            argument_definitions: argument_definitions,
        }))
    }

    pub fn build_operation_provided_variables(
        &mut self,
        operation: &OperationDefinition,
    ) -> Option<AstKey> {
        let var_defs = operation
            .variable_definitions
            .iter()
            .filter_map(|def| {
                let provider = ProvidedVariableMetadata::find(&def.directives)?;

                let provider_module =
                    if matches!(self.project_config.js_module_format, JsModuleFormat::Haste)
                        || (!self.project_config.relativize_js_module_paths && provider.is_bare())
                    {
                        provider.module_name
                    } else {
                        // This will build a path from the operation artifact to the provider module
                        self.project_config.js_module_import_identifier(
                            &self
                                .project_config
                                .artifact_path_for_definition(operation.name),
                            &provider.module_path(),
                        )
                    };

                let variable_name =
                    (provider.original_variable_name.to_string() + "_provider").intern();

                Some(ObjectEntry {
                    key: def.name.item.0,
                    value: Primitive::JSModuleDependency(JSModuleDependency {
                        path: provider_module,
                        import_name: ModuleImportName::Default(variable_name),
                    }),
                })
            })
            .collect::<Vec<_>>();

        if var_defs.is_empty() {
            None
        } else {
            Some(self.object(var_defs))
        }
    }

    fn build_request_parameters(
        &mut self,
        operation: &OperationDefinition,
        request_parameters: RequestParameters<'_>,
    ) -> AstKey {
        let mut metadata_items = self.build_internal_metadata_directives(&operation.directives);

        // add connection metadata
        let connection_metadata = extract_connection_metadata_from_directive(&operation.directives);
        if let Some(connection_metadata) = connection_metadata {
            metadata_items.push(self.build_connection_metadata(connection_metadata))
        }

        if let Some(server_variables) = request_parameters.server_variables {
            let names = server_variables
                .iter()
                .map(|name| Primitive::String(*name))
                .collect();
            metadata_items.push(ObjectEntry {
                key: intern!("server_variables"),
                value: Primitive::Key(self.array(names)),
            });
        }

        // sort metadata keys
        metadata_items.sort_unstable_by_key(|entry| entry.key);

        // Construct metadata object
        let mut params_object = vec![];

        if let Some(text) = &request_parameters.text {
            params_object.push(ObjectEntry {
                key: CODEGEN_CONSTANTS.cache_id,
                value: Primitive::RawString(md5(text)),
            });
        } else if request_parameters.id.is_none() {
            params_object.push(ObjectEntry {
                key: CODEGEN_CONSTANTS.cache_id,
                value: Primitive::RawString(md5(operation.name.item.0.lookup())),
            });
        }

        params_object.push(ObjectEntry {
            key: CODEGEN_CONSTANTS.id,
            value: match request_parameters.id {
                Some(QueryID::Persisted { id, .. }) => Primitive::RawString(id.clone()),
                Some(QueryID::External(module_name)) => {
                    Primitive::JSModuleDependency(JSModuleDependency {
                        path: *module_name,
                        import_name: ModuleImportName::Default(*module_name),
                    })
                }
                None => Primitive::Null,
            },
        });
        params_object.push(ObjectEntry {
            key: CODEGEN_CONSTANTS.metadata,
            value: Primitive::Key(self.object(metadata_items)),
        });
        params_object.push(ObjectEntry {
            key: CODEGEN_CONSTANTS.name,
            value: Primitive::String(request_parameters.name),
        });
        params_object.push(ObjectEntry {
            key: CODEGEN_CONSTANTS.operation_kind,
            value: Primitive::String(match request_parameters.operation_kind {
                OperationKind::Query => CODEGEN_CONSTANTS.query,
                OperationKind::Mutation => CODEGEN_CONSTANTS.mutation,
                OperationKind::Subscription => CODEGEN_CONSTANTS.subscription,
            }),
        });

        let text = get_raw_text_value(operation).or(request_parameters.text);
        params_object.push(ObjectEntry {
            key: CODEGEN_CONSTANTS.text,
            value: match text {
                Some(text) => Primitive::RawString(text),
                None => Primitive::Null,
            },
        });

        if let Some(provided_variables) = self.build_operation_provided_variables(operation) {
            params_object.push(ObjectEntry {
                key: CODEGEN_CONSTANTS.provided_variables,
                value: Primitive::Key(provided_variables),
            });
        }

        self.object(params_object)
    }
}

const MODEL_RESOLVER_FRAGMENT_EXPECTATION: &str = "should have a generated fragment: a client edge model resolver is always backed by a `@__RelayResolverModel` type";

/// Describe a client edge's MODEL resolver — the one that materializes the model
/// the edge points at — as a resolver in its own right, separate from the
/// BACKING FIELD resolver that returns the edge.
///
/// The reader and the normalization AST both derive their module reference from
/// this one construction, so they cannot disagree about which module backs a
/// given model.
///
/// The `field_id` here must be the model's, not the backing field's. The name the
/// artifact binds the import to comes from `generate_local_resolver_name`, which
/// is derived from the field's parent type and field name — so building this from
/// the backing field would name the model's import after the backing field (say
/// `best_friend`), which is the name that field's own resolver import already
/// uses. One name, two different modules, and whichever is emitted second wins.
fn client_edge_model_resolver_metadata(
    model_resolver: &ClientEdgeModelResolver,
    backing_resolver_metadata: &RelayResolverMetadata,
) -> RelayResolverMetadata {
    let ClientEdgeModelResolver {
        model_field_id,
        type_name,
        resolver_info,
    } = model_resolver;

    RelayResolverMetadata {
        field_id: *model_field_id,
        import_path: resolver_info.import_path,
        import_name: Some(type_name.item.0),
        field_alias: None,
        field_path: format!(
            "{}.{}",
            backing_resolver_metadata.field_path, *RELAY_RESOLVER_MODEL_INSTANCE_FIELD
        )
        .intern(),
        field_arguments: vec![], // The model resolver field does not take GraphQL arguments.
        fragment_arguments: vec![],
        live: resolver_info.live,
        output_type_info: ResolverOutputTypeInfo::ScalarField,
        fragment_data_injection_mode: resolver_info.fragment_data_injection_mode.map(|mode| {
            let fragment_name = resolver_info
                .fragment_name
                .expect(MODEL_RESOLVER_FRAGMENT_EXPECTATION);
            (WithLocation::new(type_name.location, fragment_name), mode)
        }),
        type_confirmed: resolver_info.type_confirmed,
        resolver_type: resolver_info.resolver_type,
        return_fragment: None,
    }
}

fn is_type_discriminator_selection(selection: &Selection) -> bool {
    if let Selection::ScalarField(selection) = selection {
        selection
            .directives
            .named(*TYPE_DISCRIMINATOR_DIRECTIVE_NAME)
            .is_some()
    } else {
        false
    }
}

/// Whether a selection set reaches a field outside every `ClientExtension`.
///
/// By the time codegen runs, the `client_extensions` transform has wrapped every
/// client-extension selection in an inline fragment carrying
/// `CLIENT_EXTENSION_DIRECTIVE_NAME`, so anything reachable without crossing one
/// of those is server data. That precondition is what makes the wrapper a usable
/// signal here, and it is why this cannot be reused from the pre-transform
/// validation phase, which sees no wrappers at all.
///
/// Keying on the wrapper rather than on `field.is_extension` matters: resolver
/// backing fields such as `__context` and `__rawThreadObject` are not flagged as
/// extensions in the schema, but they do sit inside the wrapper.
///
/// A client edge is decided by its target rather than by descending into it. Its
/// linked field looks like a server `LinkedField`, but a `ClientObject` edge
/// resolves entirely on the client, and a `ServerObject` edge resolves through a
/// separate waterfall request rather than this fragment's own normalization.
/// Only the latter counts.
///
/// A `FragmentSpread` surviving to codegen is opaque — a `@no_inline` fragment
/// lives in its own artifact — so it counts as server data. That errs toward
/// "reads server data", which is the safe direction: a resolver evaluated later
/// than necessary is correct, one evaluated before its data exists is not.
fn selections_reach_server_field(selections: &[Selection]) -> bool {
    selections.iter().any(|selection| match selection {
        Selection::InlineFragment(fragment) => {
            if let Some(client_edge_metadata) = ClientEdgeMetadata::find(fragment) {
                return matches!(
                    client_edge_metadata.metadata_directive,
                    ClientEdgeMetadataDirective::ServerObject { .. }
                );
            }
            let is_client_extension = fragment.directives.len() == 1
                && fragment.directives[0].name.item == *CLIENT_EXTENSION_DIRECTIVE_NAME;
            !is_client_extension && selections_reach_server_field(&fragment.selections)
        }
        Selection::Condition(condition) => selections_reach_server_field(&condition.selections),
        Selection::LinkedField(_) | Selection::ScalarField(_) | Selection::FragmentSpread(_) => {
            true
        }
    })
}

// Storage key is only pre-computable if the arguments don't contain variables
pub fn is_static_storage_key_available(arguments: &[Argument]) -> bool {
    !arguments
        .iter()
        .any(|arg| value_contains_variable(&arg.value.item))
}

fn value_contains_variable(value: &Value) -> bool {
    match value {
        Value::Variable(_) => true,
        Value::Constant(_) => false,
        Value::List(values) => values.iter().any(value_contains_variable),
        Value::Object(objects) => objects
            .iter()
            .any(|arg| value_contains_variable(&arg.value.item)),
    }
}

fn build_alias(alias: Option<StringKey>, name: StringKey) -> ObjectEntry {
    let alias = match alias {
        None => Primitive::SkippableNull,
        Some(alias) => {
            if alias == name {
                Primitive::SkippableNull
            } else {
                Primitive::String(alias)
            }
        }
    };
    ObjectEntry {
        key: CODEGEN_CONSTANTS.alias,
        value: alias,
    }
}

/// Collapse `.` and `..` segments in a path without touching the filesystem.
/// Unlike `Path::canonicalize`, this works on paths that don't exist on disk
/// and doesn't resolve symlinks.
fn normalize_path(path: &Path) -> PathBuf {
    let mut normalized = PathBuf::new();
    for component in path.components() {
        match component {
            std::path::Component::ParentDir => {
                // If the path is empty or already ends with `..`, we can't collapse
                // further — accumulate another `..`. Otherwise pop the last segment.
                match normalized.components().next_back() {
                    Some(std::path::Component::ParentDir) | None => {
                        normalized.push(component);
                    }
                    _ => {
                        normalized.pop();
                    }
                }
            }
            std::path::Component::CurDir => {}
            _ => normalized.push(component),
        }
    }
    normalized
}

/// Computes the md5 hash of a string.
pub fn md5(data: &str) -> String {
    let mut md5 = Md5::new();
    md5.update(data);
    hex::encode(md5.finalize())
}

/// Transitive properties of the output collected during traversal
#[derive(Default)]
struct ContextualMetadata {
    has_client_edges: bool,
    has_client_to_server_resolvers: bool,
    has_exec_time_resolvers_directive: bool,
    has_exec_time_resolvers_enabled_provider: bool,
    has_server_to_client_resolvers: bool,
    rsc_seams: Vec<RscSeamMetadata>,
    use_experimental_provider: Option<WithLocation<StringKey>>,
}

#[cfg(test)]
mod selections_reach_server_field_tests {
    use std::sync::Arc;

    use ::intern::string_key::Intern;
    use common::Location;
    use schema::FieldID;

    // Brings in the IR types and `CLIENT_EXTENSION_DIRECTIVE_NAME` /
    // `ClientEdgeMetadataDirective`, which `build_ast` already imports.
    use super::*;

    /// The classifier matches on selection variants and directives only; it never
    /// resolves a `FieldID` against a schema. An arbitrary id is therefore
    /// sufficient, and these tests need no schema.
    const ANY_FIELD: FieldID = FieldID(0);

    fn scalar_field() -> Selection {
        Selection::ScalarField(Arc::new(ScalarField {
            alias: None,
            definition: WithLocation::generated(ANY_FIELD),
            arguments: vec![],
            directives: vec![],
        }))
    }

    fn linked_field(selections: Vec<Selection>) -> Selection {
        Selection::LinkedField(Arc::new(LinkedField {
            alias: None,
            definition: WithLocation::generated(ANY_FIELD),
            arguments: vec![],
            directives: vec![],
            selections,
        }))
    }

    fn fragment_spread() -> Selection {
        Selection::FragmentSpread(Arc::new(FragmentSpread {
            fragment: WithLocation::generated(FragmentDefinitionName("SomeFragment".intern())),
            arguments: vec![],
            signature: None,
            directives: vec![],
        }))
    }

    fn inline_fragment(directives: Vec<Directive>, selections: Vec<Selection>) -> Selection {
        Selection::InlineFragment(Arc::new(InlineFragment {
            type_condition: None,
            directives,
            selections,
            spread_location: Location::generated(),
        }))
    }

    fn condition(selections: Vec<Selection>) -> Selection {
        Selection::Condition(Arc::new(Condition {
            selections,
            value: ConditionValue::Constant(true),
            passing_value: true,
            location: Location::generated(),
        }))
    }

    fn directive(name: DirectiveName) -> Directive {
        Directive {
            name: WithLocation::generated(name),
            arguments: vec![],
            data: None,
            location: Location::generated(),
        }
    }

    /// What the `client_extensions` transform wraps client-extension selections in.
    fn client_extension_wrapper(selections: Vec<Selection>) -> Selection {
        inline_fragment(
            vec![directive(*CLIENT_EXTENSION_DIRECTIVE_NAME)],
            selections,
        )
    }

    /// A client edge is modelled as an inline fragment with exactly two
    /// selections — the backing field, then the linked field holding the
    /// consumer's selections. `ClientEdgeMetadata::find` asserts that shape, so
    /// the fixture has to honour it.
    fn client_edge(metadata_directive: ClientEdgeMetadataDirective) -> Selection {
        inline_fragment(
            vec![metadata_directive.into()],
            vec![scalar_field(), linked_field(vec![scalar_field()])],
        )
    }

    fn server_object_edge() -> Selection {
        client_edge(ClientEdgeMetadataDirective::ServerObject {
            query_name: OperationDefinitionName("SomeClientEdgeQuery".intern()),
            unique_id: 0,
        })
    }

    fn client_object_edge() -> Selection {
        client_edge(ClientEdgeMetadataDirective::ClientObject {
            type_name: None,
            unique_id: 0,
            model_resolvers: vec![],
            server_object_operations: vec![],
        })
    }

    #[test]
    fn empty_selection_set_reaches_nothing() {
        assert!(!selections_reach_server_field(&[]));
    }

    #[test]
    fn plain_fields_are_server_data() {
        assert!(selections_reach_server_field(&[scalar_field()]));
        assert!(selections_reach_server_field(&[linked_field(vec![])]));
    }

    /// A spread surviving to codegen is opaque, so it is treated as server data
    /// even though its contents are unknown.
    #[test]
    fn opaque_fragment_spread_is_server_data() {
        assert!(selections_reach_server_field(&[fragment_spread()]));
    }

    /// The central negative: a client-extension wrapper is a hard stop. Without
    /// it, every resolver backing field would look like server data.
    #[test]
    fn client_extension_wrapper_is_not_server_data() {
        assert!(!selections_reach_server_field(&[client_extension_wrapper(
            vec![scalar_field(), linked_field(vec![scalar_field()])],
        )]));
    }

    /// An inline fragment that is not a client-extension wrapper is transparent.
    #[test]
    fn plain_inline_fragment_descends() {
        assert!(selections_reach_server_field(&[inline_fragment(
            vec![],
            vec![scalar_field()],
        )]));
        assert!(!selections_reach_server_field(&[inline_fragment(
            vec![],
            vec![client_extension_wrapper(vec![scalar_field()])],
        )]));
    }

    /// A `ServerObject` edge refetches through its own waterfall query rather
    /// than through this selection set's normalization, but it still counts —
    /// the resolver cannot produce the pointer before the response arrives.
    #[test]
    fn server_object_client_edge_is_server_data() {
        assert!(selections_reach_server_field(&[server_object_edge()]));
    }

    /// The other central negative: a `ClientObject` edge resolves entirely on
    /// the client, so its server-looking `LinkedField` must not be descended
    /// into.
    #[test]
    fn client_object_client_edge_is_not_server_data() {
        assert!(!selections_reach_server_field(&[client_object_edge()]));
    }

    #[test]
    fn condition_is_transparent() {
        assert!(selections_reach_server_field(&[condition(vec![
            scalar_field(),
        ])]));
        assert!(!selections_reach_server_field(&[condition(vec![
            client_extension_wrapper(vec![scalar_field()]),
        ])]));
    }

    /// Any one server-reaching sibling is enough.
    #[test]
    fn a_single_server_sibling_decides_the_set() {
        assert!(selections_reach_server_field(&[
            client_extension_wrapper(vec![scalar_field()]),
            client_object_edge(),
            scalar_field(),
        ]));
        assert!(!selections_reach_server_field(&[
            client_extension_wrapper(vec![scalar_field()]),
            client_object_edge(),
        ]));
    }

    /// The wrapper is recognised by being the fragment's ONLY directive, which
    /// mirrors how `build_inline_fragment` decides to emit a `ClientExtension`
    /// node. An inline fragment carrying an extra directive is not a wrapper to
    /// either of them, so it is descended into.
    #[test]
    fn wrapper_with_an_extra_directive_is_descended_into() {
        let directives = vec![
            directive(*CLIENT_EXTENSION_DIRECTIVE_NAME),
            directive(DirectiveName("someOtherDirective".intern())),
        ];
        assert!(selections_reach_server_field(&[inline_fragment(
            directives,
            vec![scalar_field()],
        )]));
    }
}

#[cfg(test)]
mod tests {
    use std::path::Path;

    use super::normalize_path;

    #[test]
    fn normalize_path_simple_parent() {
        // `src/foo/../bar` → `src/bar`
        assert_eq!(
            normalize_path(Path::new("src/foo/../bar")),
            Path::new("src/bar")
        );
    }

    #[test]
    fn normalize_path_exceeds_root() {
        // `src/foo/../../../../B`: four `..` against two normal segments yields `../../B`
        assert_eq!(
            normalize_path(Path::new("src/foo/../../../../B")),
            Path::new("../../B"),
        );
    }

    #[test]
    fn normalize_path_consecutive_parent_dirs() {
        // Accumulated `..` segments must not cancel each other out.
        assert_eq!(
            normalize_path(Path::new("../../foo")),
            Path::new("../../foo")
        );
    }

    #[test]
    fn normalize_path_cur_dir_ignored() {
        // `.` components are dropped.
        assert_eq!(
            normalize_path(Path::new("./src/./foo")),
            Path::new("src/foo")
        );
    }
}
