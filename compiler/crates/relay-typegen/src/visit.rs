/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

use std::collections::HashSet;
use std::hash::Hash;
use std::path::PathBuf;
use std::sync::Arc;
use std::sync::LazyLock;

use ::intern::Lookup;
use ::intern::intern;
use ::intern::string_key::Intern;
use ::intern::string_key::StringKey;
use common::ArgumentName;
use common::DirectiveName;
use common::NamedItem;
use common::ObjectName;
use docblock_shared::FRAGMENT_KEY_ARGUMENT_NAME;
use docblock_shared::KEY_RESOLVER_ID_FIELD;
use docblock_shared::RELAY_RESOLVER_DIRECTIVE_NAME;
use docblock_shared::RELAY_RESOLVER_MODEL_INSTANCE_FIELD;
use docblock_shared::RELAY_RSC_VALUE_SCALAR_NAME;
use docblock_shared::RESOLVER_VALUE_SCALAR_NAME;
use graphql_ir::Condition;
use graphql_ir::Directive;
use graphql_ir::FragmentDefinitionName;
use graphql_ir::FragmentSpread;
use graphql_ir::InlineFragment;
use graphql_ir::LinkedField;
use graphql_ir::OperationDefinition;
use graphql_ir::OperationDefinitionName;
use graphql_ir::ScalarField;
use graphql_ir::Selection;
use indexmap::IndexMap;
use indexmap::IndexSet;
use indexmap::map::Entry;
use itertools::Itertools;
use relay_config::CustomType;
use relay_config::CustomTypeImport;
use relay_config::OneOfGeneration;
use relay_config::ResolverContextTypeInput;
use relay_config::TypegenLanguage;
use relay_schema::CUSTOM_SCALAR_DIRECTIVE_NAME;
use relay_schema::EXPORT_NAME_CUSTOM_SCALAR_ARGUMENT_NAME;
use relay_schema::PATH_CUSTOM_SCALAR_ARGUMENT_NAME;
use relay_schema::definitions::AbstractInlineKind;
use relay_schema::definitions::ResolverType;
use relay_schema::definitions::abstract_shadow_return_has_server_implementor;
use relay_schema::definitions::abstract_shadow_return_inline_kinds_by_typename;
use relay_schema::definitions::abstract_shadow_return_is_mixed_inline;
use relay_schema::definitions::is_server_weak_shadow_return;
use relay_transforms::ASSIGNABLE_DIRECTIVE_FOR_TYPEGEN;
use relay_transforms::CATCH_DIRECTIVE_NAME;
use relay_transforms::CHILDREN_CAN_BUBBLE_METADATA_KEY;
use relay_transforms::CLIENT_EXTENSION_DIRECTIVE_NAME;
use relay_transforms::CatchMetadataDirective;
use relay_transforms::CatchTo;
use relay_transforms::ClientEdgeMetadata;
use relay_transforms::FragmentAliasMetadata;
use relay_transforms::FragmentDataInjectionMode;
use relay_transforms::ModuleMetadata;
use relay_transforms::NoInlineFragmentSpreadMetadata;
use relay_transforms::RelayResolverMetadata;
use relay_transforms::RequiredMetadataDirective;
use relay_transforms::ResolverOutputTypeInfo;
use relay_transforms::SERVER_DIRECTIVE_FOR_TYPEGEN;
use relay_transforms::TypeConditionInfo;
use relay_transforms::UPDATABLE_DIRECTIVE_FOR_TYPEGEN;
use relay_transforms::relay_resolvers::ResolverSchemaGenType;
use schema::EnumID;
use schema::Field;
use schema::InputObject;
use schema::ObjectID;
use schema::SDLSchema;
use schema::ScalarID;
use schema::Schema;
use schema::Type;
use schema::TypeReference;
use schema::definitions::TypeWithDirectives;

use crate::FRAGMENT_PROP_NAME;
use crate::KEY_CLIENTID;
use crate::KEY_DATA_ID;
use crate::KEY_FRAGMENT_SPREADS;
use crate::KEY_FRAGMENT_TYPE;
use crate::KEY_SERVER_FRAGMENT;
use crate::KEY_SERVER_OPERATION;
use crate::KEY_TYPENAME;
use crate::KEY_UPDATABLE_FRAGMENT_SPREADS;
use crate::LIVE_STATE_TYPE;
use crate::MODULE_COMPONENT;
use crate::MaskStatus;
use crate::RESPONSE;
use crate::RESULT_TYPE_NAME;
use crate::TYPE_BOOLEAN;
use crate::TYPE_FLOAT;
use crate::TYPE_ID;
use crate::TYPE_INT;
use crate::TYPE_STRING;
use crate::TypegenContext;
use crate::VARIABLES;
use crate::type_selection::ModuleDirective;
use crate::type_selection::RawResponseFragmentSpread;
use crate::type_selection::ScalarFieldSpecialSchemaField;
use crate::type_selection::TypeSelection;
use crate::type_selection::TypeSelectionFragmentSpread;
use crate::type_selection::TypeSelectionInlineFragment;
use crate::type_selection::TypeSelectionKey;
use crate::type_selection::TypeSelectionLinkedField;
use crate::type_selection::TypeSelectionMap;
use crate::type_selection::TypeSelectionScalarField;
use crate::typegen_state::EncounteredEnums;
use crate::typegen_state::EncounteredFragment;
use crate::typegen_state::EncounteredFragments;
use crate::typegen_state::GeneratedInputObject;
use crate::typegen_state::ImportedRawResponseTypes;
use crate::typegen_state::ImportedResolver;
use crate::typegen_state::ImportedResolverName;
use crate::typegen_state::ImportedResolvers;
use crate::typegen_state::InputObjectTypes;
use crate::typegen_state::MatchFields;
use crate::typegen_state::ResolverContextType;
use crate::typegen_state::RuntimeImports;
use crate::write::CustomScalarsImports;
use crate::writer::AST;
use crate::writer::ExactObject;
use crate::writer::FunctionTypeAssertion;
use crate::writer::GetterSetterPairProp;
use crate::writer::InexactObject;
use crate::writer::KeyValuePairProp;
use crate::writer::Prop;
use crate::writer::SortedASTList;
use crate::writer::SortedStringKeyList;
use crate::writer::SpreadProp;
use crate::writer::StringLiteral;

static THROW_ON_FIELD_ERROR_DIRECTIVE: LazyLock<DirectiveName> =
    LazyLock::new(|| DirectiveName("throwOnFieldError".intern()));
static SEMANTIC_NON_NULL_DIRECTIVE: LazyLock<DirectiveName> =
    LazyLock::new(|| DirectiveName("semanticNonNull".intern()));
static ONE_OF_DIRECTIVE_NAME: LazyLock<DirectiveName> =
    LazyLock::new(|| DirectiveName("oneOf".intern()));

pub fn is_result_type_directive(directives: &[Directive]) -> bool {
    match CatchMetadataDirective::find(directives) {
        Some(catch_directive) => catch_directive.to != CatchTo::Null,
        None => false,
    }
}

pub fn has_explicit_catch_to_null(directives: &[Directive]) -> bool {
    match CatchMetadataDirective::find(directives) {
        Some(catch_directive) => catch_directive.to == CatchTo::Null,
        None => false,
    }
}

#[allow(clippy::too_many_arguments)]
pub(crate) fn visit_selections(
    typegen_context: &'_ TypegenContext<'_>,
    selections: &[Selection],
    input_object_types: &mut InputObjectTypes,
    encountered_enums: &mut EncounteredEnums,
    imported_raw_response_types: &mut ImportedRawResponseTypes,
    encountered_fragments: &mut EncounteredFragments,
    imported_resolvers: &mut ImportedResolvers,
    custom_scalars: &mut CustomScalarsImports,
    runtime_imports: &mut RuntimeImports,
    custom_error_import: &mut Option<CustomTypeImport>,
    enclosing_linked_field_concrete_type: Option<Type>,
    emit_semantic_types: bool,
) -> Vec<TypeSelection> {
    let mut type_selections = Vec::new();
    for selection in selections {
        match selection {
            Selection::FragmentSpread(fragment_spread) => visit_fragment_spread(
                typegen_context,
                &mut type_selections,
                fragment_spread,
                input_object_types,
                encountered_enums,
                custom_scalars,
                imported_raw_response_types,
                encountered_fragments,
                imported_resolvers,
                runtime_imports,
                emit_semantic_types,
            ),
            Selection::InlineFragment(inline_fragment) => visit_inline_fragment(
                typegen_context,
                &mut type_selections,
                inline_fragment,
                input_object_types,
                encountered_enums,
                imported_raw_response_types,
                encountered_fragments,
                imported_resolvers,
                custom_scalars,
                runtime_imports,
                custom_error_import,
                enclosing_linked_field_concrete_type,
                emit_semantic_types,
            ),
            Selection::LinkedField(linked_field) => {
                let linked_field_type = typegen_context
                    .schema
                    .field(linked_field.definition.item)
                    .type_
                    .inner();
                let nested_enclosing_linked_field_concrete_type =
                    if linked_field_type.is_abstract_type() {
                        None
                    } else {
                        Some(linked_field_type)
                    };
                let field_emit_semantic_types = emit_semantic_types
                    || linked_field
                        .directives
                        .named(*CATCH_DIRECTIVE_NAME)
                        .is_some();
                gen_visit_linked_field(
                    typegen_context,
                    &mut type_selections,
                    linked_field,
                    |selections| {
                        visit_selections(
                            typegen_context,
                            selections,
                            input_object_types,
                            encountered_enums,
                            imported_raw_response_types,
                            encountered_fragments,
                            imported_resolvers,
                            custom_scalars,
                            runtime_imports,
                            custom_error_import,
                            nested_enclosing_linked_field_concrete_type,
                            field_emit_semantic_types,
                        )
                    },
                    emit_semantic_types,
                )
            }
            Selection::ScalarField(scalar_field) => {
                if let Some(resolver_metadata) =
                    RelayResolverMetadata::find(&scalar_field.directives)
                {
                    visit_relay_resolver(
                        typegen_context,
                        None,
                        input_object_types,
                        encountered_enums,
                        custom_scalars,
                        imported_raw_response_types,
                        encountered_fragments,
                        runtime_imports,
                        &mut type_selections,
                        resolver_metadata,
                        RequiredMetadataDirective::find(&scalar_field.directives).is_some(),
                        imported_resolvers,
                        emit_semantic_types,
                    );
                } else {
                    visit_scalar_field(
                        typegen_context,
                        &mut type_selections,
                        scalar_field,
                        encountered_enums,
                        custom_scalars,
                        enclosing_linked_field_concrete_type,
                        emit_semantic_types,
                    )
                }
            }
            Selection::Condition(condition) => visit_condition(
                typegen_context,
                &mut type_selections,
                condition,
                input_object_types,
                encountered_enums,
                imported_raw_response_types,
                encountered_fragments,
                imported_resolvers,
                custom_scalars,
                runtime_imports,
                custom_error_import,
                enclosing_linked_field_concrete_type,
                emit_semantic_types,
            ),
        }
    }
    type_selections
}

#[allow(clippy::too_many_arguments)]
fn visit_fragment_spread(
    typegen_context: &'_ TypegenContext<'_>,
    type_selections: &mut Vec<TypeSelection>,
    fragment_spread: &FragmentSpread,
    input_object_types: &mut InputObjectTypes,
    encountered_enums: &mut EncounteredEnums,
    custom_scalars: &mut CustomScalarsImports,
    imported_raw_response_types: &mut ImportedRawResponseTypes,
    encountered_fragments: &mut EncounteredFragments,
    imported_resolvers: &mut ImportedResolvers,
    runtime_imports: &mut RuntimeImports,
    emit_semantic_types: bool,
) {
    if let Some(resolver_metadata) = RelayResolverMetadata::find(&fragment_spread.directives) {
        visit_relay_resolver(
            typegen_context,
            Some(fragment_spread.fragment.item),
            input_object_types,
            encountered_enums,
            custom_scalars,
            imported_raw_response_types,
            encountered_fragments,
            runtime_imports,
            type_selections,
            resolver_metadata,
            RequiredMetadataDirective::find(&fragment_spread.directives).is_some(),
            imported_resolvers,
            emit_semantic_types,
        );
    } else {
        let name = fragment_spread.fragment.item;
        encountered_fragments
            .0
            .insert(EncounteredFragment::Spread(name));

        let spread_selection = TypeSelection::FragmentSpread(TypeSelectionFragmentSpread {
            fragment_name: name,
            conditional: false,
            concrete_type: None,
            abstract_type: None,
            type_condition_info: get_type_condition_info(fragment_spread),
            is_updatable_fragment_spread: fragment_spread
                .directives
                .named(*UPDATABLE_DIRECTIVE_FOR_TYPEGEN)
                .is_some(),
            is_server_fragment_spread: fragment_spread
                .directives
                .named(*SERVER_DIRECTIVE_FOR_TYPEGEN)
                .is_some(),
        });

        type_selections.push(spread_selection);
    }
}

pub(crate) fn rsc_node_type(
    typegen_context: &'_ TypegenContext<'_>,
    custom_scalars: &mut CustomScalarsImports,
) -> AST {
    let typegen_config = &typegen_context.project_config.typegen_config;
    match &typegen_config.rsc_node_type {
        Some(CustomType::Name(type_name)) => AST::RawType(*type_name),
        // The default names React's TypeScript export. Flow's React type
        // definitions do not export `ReactNode`; they declare `React$Node`.
        Some(CustomType::Path(custom_type))
            if typegen_config.language == TypegenLanguage::Flow
                && custom_type.name == intern!("ReactNode")
                && custom_type.path.as_os_str() == "react" =>
        {
            AST::RawType(intern!("React$Node"))
        }
        Some(CustomType::Path(custom_type)) => {
            custom_scalars.insert((custom_type.name, custom_type.path.clone()));
            AST::RawType(custom_type.name)
        }
        None => AST::Mixed,
    }
}

#[allow(clippy::too_many_arguments)]
fn generate_resolver_type(
    typegen_context: &'_ TypegenContext<'_>,
    input_object_types: &mut InputObjectTypes,
    encountered_enums: &mut EncounteredEnums,
    custom_scalars: &mut CustomScalarsImports,
    imported_raw_response_types: &mut ImportedRawResponseTypes,
    encountered_fragments: &mut EncounteredFragments,
    runtime_imports: &mut RuntimeImports,
    resolver_function_name: StringKey,
    fragment_name: Option<FragmentDefinitionName>,
    resolver_metadata: &RelayResolverMetadata,
    context_import: Option<ResolverContextType>,
) -> AST {
    // For the purposes of function type assertion, we always use the semantic type.
    let schema_field = resolver_metadata.field(typegen_context.schema);
    let schema_field_type = schema_field.semantic_type();

    let resolver_arguments = get_resolver_arguments(
        fragment_name,
        resolver_metadata,
        encountered_fragments,
        typegen_context,
        input_object_types,
        encountered_enums,
        custom_scalars,
        schema_field,
        context_import,
    );

    let inner_ast = match &resolver_metadata.output_type_info {
        ResolverOutputTypeInfo::ScalarField => {
            if is_relay_resolver_type(typegen_context, schema_field) {
                AST::Mixed
            } else {
                let type_ = &schema_field_type.inner();
                expect_scalar_type(typegen_context, encountered_enums, custom_scalars, type_)
            }
        }
        ResolverOutputTypeInfo::Composite(normalization_info) => {
            if let Some(field_id) = normalization_info.weak_object_instance_field {
                let type_ = &typegen_context.schema.field(field_id).type_.inner();
                expect_scalar_type(typegen_context, encountered_enums, custom_scalars, type_)
            } else if is_server_weak_shadow_return(
                typegen_context.schema,
                normalization_info.inner_type,
                typegen_context
                    .project_config
                    .schema_config
                    .node_interface_id_field,
                resolver_metadata.return_fragment.is_some(),
            ) {
                // READ-IN-PLACE shadow (`@returnFragment`) server-value return:
                // the resolver returns the IDENTITY of the transplanted
                // record — an object with the concrete `__typename` and `__id`
                // (the DataID/store key) — and the runtime reads the value in place
                // off that `__id` (`extractStoreIDFromResponse`). It must NOT be
                // typed as a `$normalization` import: no normalization artifact is
                // generated for it (the nested-objects pass skips it), so emitting
                // that import would be a dangling, unresolvable Flow module.
                create_server_weak_return_type_ast(
                    &normalization_info.inner_type,
                    typegen_context.schema,
                    runtime_imports,
                )
            } else if abstract_shadow_return_is_mixed_inline(
                typegen_context.schema,
                normalization_info.inner_type,
                typegen_context
                    .project_config
                    .schema_config
                    .node_interface_id_field,
            ) {
                // MIXED abstract interface shadow return: implemented by BOTH
                // an `@weak` model AND a non-Node server value type. A single
                // `{__typename, __id}` identity would leave the weak arm with no
                // model value to normalize (rendering blank), so emit a
                // DISCRIMINATED UNION: the weak member carries its
                // `__relay_model_instance` (the fat value the `WeakModel` normalizer
                // stores and the weak field resolvers read), the value member
                // carries `{__typename, __id}` (read in place off the transplanted
                // record). The backing field's `inlineKinds` map tells the runtime
                // which arm is which. This must be checked BEFORE
                // `abstract_shadow_return_has_server_implementor` (a mixed return's
                // value member is a server type, so that predicate is also true).
                create_abstract_mixed_return_type_ast(
                    &normalization_info.inner_type,
                    typegen_context,
                    encountered_fragments,
                    runtime_imports,
                )
            } else if abstract_shadow_return_has_server_implementor(
                typegen_context.schema,
                normalization_info.inner_type,
                typegen_context
                    .project_config
                    .schema_config
                    .node_interface_id_field,
                resolver_metadata.return_fragment.is_some(),
            ) {
                // Abstract interface/union shadow return with a server
                // (Node or value) implementor. Like the read-in-place case the
                // resolver returns the per-`__typename` IDENTITY (`{__typename,
                // __id}`) and the runtime dispatches per type — inline read for the
                // weak/value member, refetch for the Node. The abstract type has
                // many possible concrete `__typename`s, so `__typename` is `string`
                // (not a single literal). No `$normalization` import: the
                // nested-objects pass skips generating one for such a return.
                create_abstract_identity_return_type_ast(runtime_imports)
            } else {
                imported_raw_response_types.0.insert(
                    normalization_info.normalization_operation.item.0,
                    normalization_info.normalization_operation.location,
                );
                AST::RawType(normalization_info.normalization_operation.item.0)
            }
        }
        ResolverOutputTypeInfo::EdgeTo => create_edge_to_return_type_ast(
            &schema_field_type.inner(),
            typegen_context.schema,
            runtime_imports,
        ),
        ResolverOutputTypeInfo::Legacy => AST::Mixed,
    };

    // `__relay_model_instance` is exempt from the assertion transform below.
    // `generate_model_instance_field` always builds it NonNull regardless of what
    // the model resolver returns, because a strong model resolver is *expected* to
    // return `?Model` -- null means "no such model", and
    // `RelayReader._readClientEdge` nulls the whole edge before the instance field
    // is ever read. The non-nullness belongs to the edge, not to the resolver, so
    // asserting it against the resolver would be wrong.
    let is_model_instance = schema_field.name.item == *RELAY_RESOLVER_MODEL_INSTANCE_FIELD;
    let ast = if is_model_instance || !hides_its_nullability(&inner_ast) {
        transform_type_reference_into_ast(&schema_field_type, |_| inner_ast)
    } else {
        transform_type_reference_into_assertion_ast(&schema_field_type, |_| inner_ast)
    };

    let return_type = if resolver_metadata.live {
        runtime_imports.resolver_live_state_type = true;
        AST::GenericType {
            outer: *LIVE_STATE_TYPE,
            inner: vec![ast],
        }
    } else {
        ast
    };

    AST::AssertFunctionType(FunctionTypeAssertion {
        function_name: resolver_function_name,
        arguments: resolver_arguments,
        return_type: Box::new(return_type),
    })
}

fn add_fragment_name_to_encountered_fragments(
    fragment_name: FragmentDefinitionName,
    encountered_fragments: &mut EncounteredFragments,
) {
    encountered_fragments
        .0
        .insert(EncounteredFragment::Data(fragment_name));
}

fn get_fragment_data_type(fragment_name: StringKey) -> Box<AST> {
    Box::new(AST::RawType(format!("{fragment_name}$data").intern()))
}

fn add_model_argument_for_interface_resolver(
    resolver_arguments: &mut Vec<KeyValuePairProp>,
    encountered_fragments: &mut EncounteredFragments,
    implementing_objects: HashSet<ObjectID>,
    typegen_context: &TypegenContext<'_>,
) {
    let mut model_types_for_type_assertion = vec![];
    for object_id in implementing_objects.iter().sorted() {
        if !Type::Object(*object_id).is_terse_resolver_object(typegen_context.schema) {
            continue;
        }
        let type_name = typegen_context.schema.object(*object_id).name.item.0;
        let fragment_name = typegen_context
            .project_config
            .name
            .generate_name_for_object_and_field(type_name, *RELAY_RESOLVER_MODEL_INSTANCE_FIELD)
            .intern();
        add_fragment_name_to_encountered_fragments(
            FragmentDefinitionName(fragment_name),
            encountered_fragments,
        );
        model_types_for_type_assertion.push(AST::PropertyType {
            type_: get_fragment_data_type(fragment_name),
            property_name: *RELAY_RESOLVER_MODEL_INSTANCE_FIELD,
        });
    }
    if !model_types_for_type_assertion.is_empty() {
        let interface_union_type = AST::Union(SortedASTList::new(model_types_for_type_assertion));
        resolver_arguments.push(KeyValuePairProp {
            key: "model".intern(),
            optional: false,
            read_only: false,
            value: interface_union_type,
        });
    }
}

#[allow(clippy::too_many_arguments)]
fn get_resolver_arguments(
    fragment_name: Option<FragmentDefinitionName>,
    resolver_metadata: &RelayResolverMetadata,
    encountered_fragments: &mut EncounteredFragments,
    typegen_context: &TypegenContext<'_>,
    input_object_types: &mut IndexMap<common::InputObjectName, GeneratedInputObject>,
    encountered_enums: &mut EncounteredEnums,
    custom_scalars: &mut std::collections::HashSet<(StringKey, PathBuf)>,
    schema_field: &Field,
    context_import: Option<ResolverContextType>,
) -> Vec<KeyValuePairProp> {
    let void_type = match typegen_context.project_config.typegen_config.language {
        TypegenLanguage::Flow | TypegenLanguage::JavaScript => AST::RawType(intern!("void")),
        TypegenLanguage::TypeScript => AST::RawType(intern!("undefined")),
    };

    let mut resolver_arguments = vec![];
    if let Some(Type::Interface(interface_id)) = schema_field.parent_type {
        let interface = typegen_context.schema.interface(interface_id);
        let implementing_objects =
            interface.recursively_implementing_objects(typegen_context.schema);
        let resolver_directive = schema_field
            .directives
            .named(*RELAY_RESOLVER_DIRECTIVE_NAME)
            .unwrap();
        // Add model argument if @rootFragment is not set on the resolver field
        if !resolver_directive
            .arguments
            .iter()
            .any(|arg| arg.name.0 == FRAGMENT_KEY_ARGUMENT_NAME.0)
        {
            add_model_argument_for_interface_resolver(
                &mut resolver_arguments,
                encountered_fragments,
                implementing_objects,
                typegen_context,
            )
        }
    }
    if let Some(fragment_name) = fragment_name {
        if let Some((fragment_name, injection_mode)) =
            resolver_metadata.fragment_data_injection_mode
        {
            match injection_mode {
                FragmentDataInjectionMode::Field { name, .. } => {
                    add_fragment_name_to_encountered_fragments(
                        fragment_name.item,
                        encountered_fragments,
                    );
                    resolver_arguments.push(KeyValuePairProp {
                        key: name,
                        value: AST::PropertyType {
                            type_: get_fragment_data_type(fragment_name.item.0),
                            property_name: name,
                        },
                        read_only: false,
                        optional: false,
                    });
                }
            }
        } else {
            encountered_fragments
                .0
                .insert(EncounteredFragment::Key(fragment_name));
            resolver_arguments.push(KeyValuePairProp {
                key: intern!("rootKey"),
                value: AST::RawType(format!("{fragment_name}$key").intern()),
                read_only: false,
                optional: false,
            });
        }
    }

    let mut args = vec![];
    for field_argument in schema_field.arguments.iter() {
        args.push(Prop::KeyValuePair(KeyValuePairProp {
            key: field_argument.name.item.0,
            optional: false,
            read_only: false,
            value: transform_input_type(
                typegen_context,
                &field_argument.type_,
                input_object_types,
                encountered_enums,
                custom_scalars,
            ),
        }));
    }

    if !args.is_empty() {
        resolver_arguments.push(KeyValuePairProp {
            key: intern!("args"),
            value: AST::ExactObject(ExactObject::new(args)),
            read_only: true,
            optional: false,
        });
    } else if context_import.is_some() {
        resolver_arguments.push(KeyValuePairProp {
            key: intern!("args"),
            value: void_type,
            read_only: true,
            optional: false,
        });
    }

    if let Some(context_import) = context_import {
        resolver_arguments.push(KeyValuePairProp {
            key: intern!("context"),
            value: AST::RawType(context_import.name),
            read_only: true,
            optional: false,
        });
    }

    resolver_arguments
}

#[allow(clippy::too_many_arguments)]
fn import_relay_resolver_function_type(
    typegen_context: &'_ TypegenContext<'_>,
    fragment_name: Option<FragmentDefinitionName>,
    input_object_types: &mut InputObjectTypes,
    encountered_enums: &mut EncounteredEnums,
    custom_scalars: &mut CustomScalarsImports,
    imported_raw_response_types: &mut ImportedRawResponseTypes,
    encountered_fragments: &mut EncounteredFragments,
    runtime_imports: &mut RuntimeImports,
    resolver_metadata: &RelayResolverMetadata,
    imported_resolvers: &mut ImportedResolvers,
) {
    let local_resolver_name =
        resolver_metadata.generate_local_resolver_type_name(typegen_context.schema);
    let resolver_name = if let Some(name) = resolver_metadata.import_name {
        ImportedResolverName::Named {
            name,
            import_as: local_resolver_name,
        }
    } else {
        ImportedResolverName::Default(local_resolver_name)
    };

    let import_path = typegen_context.project_config.js_module_import_identifier(
        &typegen_context
            .project_config
            .artifact_path_for_definition(typegen_context.definition_source_location),
        &PathBuf::from(resolver_metadata.import_path.lookup()),
    );

    let context_import = match &typegen_context
        .project_config
        .typegen_config
        .resolver_context_type
    {
        Some(ResolverContextTypeInput::Path(context_import)) => Some(ResolverContextType {
            name: context_import.name,
            import_path: typegen_context.project_config.js_module_import_identifier(
                &typegen_context
                    .project_config
                    .artifact_path_for_definition(typegen_context.definition_source_location),
                &PathBuf::from(&context_import.path),
            ),
        }),
        Some(ResolverContextTypeInput::Package(context_import)) => Some(ResolverContextType {
            name: context_import.name,
            import_path: context_import.package,
        }),
        None => None,
    };

    let is_property_lookup = match resolver_metadata.resolver_type {
        ResolverSchemaGenType::PropertyLookup { .. } => true,
        ResolverSchemaGenType::ResolverModule => false,
    };
    let resolver_type = if (resolver_metadata.type_confirmed
        && typegen_context
            .project_config
            .feature_flags
            .omit_resolver_type_assertions_for_confirmed_types
            .is_fully_enabled())
        || is_property_lookup
    {
        None
    } else {
        Some(generate_resolver_type(
            typegen_context,
            input_object_types,
            encountered_enums,
            custom_scalars,
            imported_raw_response_types,
            encountered_fragments,
            runtime_imports,
            local_resolver_name,
            fragment_name,
            resolver_metadata,
            context_import,
        ))
    };

    if !is_property_lookup {
        let imported_resolver = ImportedResolver {
            resolver_name,
            resolver_type,
            import_path,
            context_import,
        };

        imported_resolvers
            .0
            .entry(local_resolver_name)
            .or_insert(imported_resolver);
    }
}

/// Check if the scalar field has the special type `RelayResolverValue`. This is a type that
/// indicates that the return type is an opaque scalar, whose type is determined by the return
/// type of the resolver function.
fn is_relay_resolver_type(typegen_context: &'_ TypegenContext<'_>, field: &Field) -> bool {
    if let Some(scalar_id) = field.type_.inner().get_scalar_id() {
        typegen_context.schema.scalar(scalar_id).name.item == *RESOLVER_VALUE_SCALAR_NAME
    } else {
        false
    }
}

fn is_relay_rsc_value_type(typegen_context: &'_ TypegenContext<'_>, field: &Field) -> bool {
    if let Some(scalar_id) = field.type_.inner().get_scalar_id() {
        typegen_context.schema.scalar(scalar_id).name.item == *RELAY_RSC_VALUE_SCALAR_NAME
    } else {
        false
    }
}

/// Build relay resolver field type
#[allow(clippy::too_many_arguments)]
fn relay_resolver_field_type(
    typegen_context: &'_ TypegenContext<'_>,
    resolver_metadata: &RelayResolverMetadata,
    encountered_enums: &mut EncounteredEnums,
    custom_scalars: &mut CustomScalarsImports,
    local_resolver_name: StringKey,
    required: bool,
    live: bool,
    emit_semantic_types: bool,
) -> AST {
    let maybe_scalar_field =
        if let ResolverOutputTypeInfo::ScalarField = resolver_metadata.output_type_info {
            let field = resolver_metadata.field(typegen_context.schema);
            // Scalar fields that return `RelayResolverValue` should behave as "classic"
            // resolvers, where we infer the field type from the return type of the
            // resolver function
            if is_relay_resolver_type(typegen_context, field) {
                None
            } else {
                Some(field)
            }
        } else {
            None
        };

    if let Some(field) = maybe_scalar_field {
        let type_ = match emit_semantic_types {
            true => field.semantic_type(),
            false => field.type_.clone(),
        };
        let inner_value = transform_type_reference_into_ast(&type_, |type_| {
            expect_scalar_type(typegen_context, encountered_enums, custom_scalars, type_)
        });
        if required {
            if type_.is_non_null() {
                inner_value
            } else {
                AST::NonNullable(Box::new(inner_value))
            }
        } else {
            inner_value
        }
    } else {
        let field = resolver_metadata.field(typegen_context.schema);
        let field_type = match emit_semantic_types {
            true => field.semantic_type(),
            false => field.type_.clone(),
        };

        let inner_value = AST::ReturnTypeOfFunctionWithName(local_resolver_name);
        let inner_value = if live {
            AST::ReturnTypeOfMethodCall(Box::new(inner_value), intern!("read"))
        } else {
            inner_value
        };

        if required || field_type.is_non_null() {
            AST::NonNullable(Box::new(inner_value))
        } else {
            AST::Nullable(Box::new(inner_value))
        }
    }
}

#[allow(clippy::too_many_arguments)]
fn visit_relay_resolver(
    typegen_context: &'_ TypegenContext<'_>,
    fragment_name: Option<FragmentDefinitionName>,
    input_object_types: &mut InputObjectTypes,
    encountered_enums: &mut EncounteredEnums,
    custom_scalars: &mut CustomScalarsImports,
    imported_raw_response_types: &mut ImportedRawResponseTypes,
    encountered_fragments: &mut EncounteredFragments,
    runtime_imports: &mut RuntimeImports,
    type_selections: &mut Vec<TypeSelection>,
    resolver_metadata: &RelayResolverMetadata,
    required: bool,
    imported_resolvers: &mut ImportedResolvers,
    emit_semantic_types: bool,
) {
    let schema_field = resolver_metadata.field(typegen_context.schema);
    if typegen_context
        .project_config
        .relay_rsc_capabilities()
        .is_some()
        && is_relay_rsc_value_type(typegen_context, schema_field)
    {
        let field_name = resolver_metadata.field_name(typegen_context.schema);
        let key = resolver_metadata.field_alias.unwrap_or(field_name);
        type_selections.push(TypeSelection::ScalarField(TypeSelectionScalarField {
            field_name_or_alias: key,
            special_field: None,
            value: rsc_node_type(typegen_context, custom_scalars),
            conditional: false,
            concrete_type: None,
            abstract_type: None,
            is_result_type: false,
        }));
        return;
    }

    import_relay_resolver_function_type(
        typegen_context,
        fragment_name,
        input_object_types,
        encountered_enums,
        custom_scalars,
        imported_raw_response_types,
        encountered_fragments,
        runtime_imports,
        resolver_metadata,
        imported_resolvers,
    );

    let field_name = resolver_metadata.field_name(typegen_context.schema);
    let key = resolver_metadata.field_alias.unwrap_or(field_name);

    let live = resolver_metadata.live;
    let local_resolver_name =
        resolver_metadata.generate_local_resolver_type_name(typegen_context.schema);

    let resolver_type = relay_resolver_field_type(
        typegen_context,
        resolver_metadata,
        encountered_enums,
        custom_scalars,
        local_resolver_name,
        required,
        live,
        emit_semantic_types,
    );

    type_selections.push(TypeSelection::ScalarField(TypeSelectionScalarField {
        field_name_or_alias: key,
        special_field: None,
        value: resolver_type,
        conditional: false,
        concrete_type: None,
        abstract_type: None,
        is_result_type: false,
    }));
}

#[allow(clippy::too_many_arguments)]
fn visit_client_edge(
    typegen_context: &'_ TypegenContext<'_>,
    input_object_types: &mut InputObjectTypes,
    encountered_enums: &mut EncounteredEnums,
    custom_scalars: &mut CustomScalarsImports,
    imported_raw_response_types: &mut ImportedRawResponseTypes,
    encountered_fragments: &mut EncounteredFragments,
    type_selections: &mut Vec<TypeSelection>,
    client_edge_metadata: &ClientEdgeMetadata<'_>,
    imported_resolvers: &mut ImportedResolvers,
    runtime_imports: &mut RuntimeImports,
    custom_error_import: &mut Option<CustomTypeImport>,
    enclosing_linked_field_concrete_type: Option<Type>,
    emit_semantic_types: bool,
) {
    let (resolver_metadata, fragment_name) = match &client_edge_metadata.backing_field {
        Selection::FragmentSpread(fragment_spread) => (
            RelayResolverMetadata::find(&fragment_spread.directives),
            Some(fragment_spread.fragment.item),
        ),
        Selection::ScalarField(scalar_field) => {
            (RelayResolverMetadata::find(&scalar_field.directives), None)
        }
        _ => panic!(
            "Expect correct relay resolver selection (fragment spread or scalar field). Got {:?}",
            client_edge_metadata.backing_field
        ),
    };
    if let Some(resolver_metadata) = resolver_metadata {
        import_relay_resolver_function_type(
            typegen_context,
            fragment_name,
            input_object_types,
            encountered_enums,
            custom_scalars,
            imported_raw_response_types,
            encountered_fragments,
            runtime_imports,
            resolver_metadata,
            imported_resolvers,
        );
    }

    let mut client_edge_selections = visit_selections(
        typegen_context,
        &[Selection::LinkedField(Arc::new(
            client_edge_metadata.linked_field.clone(),
        ))],
        input_object_types,
        encountered_enums,
        imported_raw_response_types,
        encountered_fragments,
        imported_resolvers,
        custom_scalars,
        runtime_imports,
        custom_error_import,
        enclosing_linked_field_concrete_type,
        emit_semantic_types,
    );
    type_selections.append(&mut client_edge_selections);
}

#[allow(clippy::too_many_arguments)]
fn visit_inline_fragment(
    typegen_context: &'_ TypegenContext<'_>,
    type_selections: &mut Vec<TypeSelection>,
    inline_fragment: &InlineFragment,
    input_object_types: &mut InputObjectTypes,
    encountered_enums: &mut EncounteredEnums,
    imported_raw_response_types: &mut ImportedRawResponseTypes,
    encountered_fragments: &mut EncounteredFragments,
    imported_resolvers: &mut ImportedResolvers,
    custom_scalars: &mut CustomScalarsImports,
    runtime_imports: &mut RuntimeImports,
    custom_error_import: &mut Option<CustomTypeImport>,
    enclosing_linked_field_concrete_type: Option<Type>,
    emit_semantic_types: bool,
) {
    if let Some(module_metadata) = ModuleMetadata::find(&inline_fragment.directives) {
        let name = module_metadata.fragment_name;
        encountered_fragments
            .0
            .insert(EncounteredFragment::Spread(name));
        type_selections.push(TypeSelection::ScalarField(TypeSelectionScalarField {
            field_name_or_alias: *FRAGMENT_PROP_NAME,
            special_field: None,
            value: AST::Nullable(Box::new(AST::String)),
            conditional: false,
            concrete_type: None,
            abstract_type: None,
            is_result_type: false,
        }));
        type_selections.push(TypeSelection::ScalarField(TypeSelectionScalarField {
            field_name_or_alias: *MODULE_COMPONENT,
            special_field: None,
            value: AST::Nullable(Box::new(AST::String)),
            conditional: false,
            concrete_type: None,
            abstract_type: None,
            is_result_type: false,
        }));
        type_selections.push(TypeSelection::InlineFragment(TypeSelectionInlineFragment {
            fragment_name: name,
            conditional: false,
            concrete_type: None,
            abstract_type: None,
        }));
    } else if let Some(client_edge_metadata) = ClientEdgeMetadata::find(inline_fragment) {
        visit_client_edge(
            typegen_context,
            input_object_types,
            encountered_enums,
            custom_scalars,
            imported_raw_response_types,
            encountered_fragments,
            type_selections,
            &client_edge_metadata,
            imported_resolvers,
            runtime_imports,
            custom_error_import,
            enclosing_linked_field_concrete_type,
            emit_semantic_types,
        );
    } else {
        let mut inline_selections = visit_selections(
            typegen_context,
            &inline_fragment.selections,
            input_object_types,
            encountered_enums,
            imported_raw_response_types,
            encountered_fragments,
            imported_resolvers,
            custom_scalars,
            runtime_imports,
            custom_error_import,
            enclosing_linked_field_concrete_type,
            emit_semantic_types
                || inline_fragment
                    .directives
                    .named(*CATCH_DIRECTIVE_NAME)
                    .is_some(),
        );

        let mut selections = if let Some(fragment_alias_metadata) =
            FragmentAliasMetadata::find(&inline_fragment.directives)
        {
            // We will model the types as a linked field containing just the fragment spread.
            let mut node_type = TypeReference::Named(fragment_alias_metadata.selection_type);
            if fragment_alias_metadata.non_nullable {
                node_type = TypeReference::NonNull(Box::new(node_type));
            }

            // With @required, null might bubble up to this synthetic field, so we need to apply that nullability here.
            // coerce_to_nullable is false because @catch can't be on inline fragment anyway. Note catchable is also false.
            node_type = apply_required_directive_nullability(
                &node_type,
                &inline_fragment.directives,
                false,
            );
            let coerce_to_nullable = has_explicit_catch_to_null(&inline_fragment.directives);
            let is_result_type = is_result_type_directive(&inline_fragment.directives);

            vec![TypeSelection::LinkedField(TypeSelectionLinkedField {
                field_name_or_alias: fragment_alias_metadata.alias.item,
                node_type,
                node_selections: selections_to_map(inline_selections.into_iter(), true),
                conditional: coerce_to_nullable,
                concrete_type: None,
                abstract_type: None,
                is_result_type,
            })]
        } else {
            // If the inline fragment is on an abstract type, its selections must be
            // made nullable since the type condition may not match, and there will be
            // no way for the user to refine the type to ensure it did match. 
            //
            // There is an exception to this rule. If we can prove that the type condition 
            // will always match, then we can leave the selections as is. This is the case
            // when the parent object is a member of the type condition union, or it 
            // implements the type condition interface.
            // It is safe to assume unconditional conformace, since the only way the type
            // will not satisfy the type condition is if the interface conformace is removed
            // or the type is removed from the union, both of which are breaking changes
            // to the schema.
            //
            // Inline fragments with @alias are not subject to this limitation since 
            // RelayReader will make the field null if the type does not match, allowing the
            // user to perform a field (alias) null check to ensure the type matched.
            if let Some(type_condition) = inline_fragment.type_condition {
                if !type_condition.is_abstract_type() {
                    for selection in &mut inline_selections {
                        selection.set_concrete_type(type_condition);
                    }
                } else if !type_condition_always_satisfied(
                    &typegen_context.schema,
                    type_condition,
                    enclosing_linked_field_concrete_type,
                ) {
                    for selection in &mut inline_selections {
                        selection.set_conditional(true);
                    }
                }
            }

            inline_selections
        };
        type_selections.append(&mut selections);
    }
}

/// Checks if type_condition is a supertype (union or interface) of the
/// given enclosing type. If so, we can safely assume that the type condition
/// will always match, given that removing interface conformance or union
/// membership is a breaking change anyway.
fn type_condition_always_satisfied(
    schema: &SDLSchema,
    type_condition: Type,
    enclosing_linked_field_concrete_type: Option<Type>,
) -> bool {
    match (type_condition, enclosing_linked_field_concrete_type) {
        (Type::Interface(interface_id), Some(Type::Object(enclosing_object_id))) => {
            let enclosing_object = schema.object(enclosing_object_id);
            enclosing_object.interfaces.contains(&interface_id)
        }
        (Type::Union(union_id), Some(Type::Object(enclosing_object_id))) => {
            let union = schema.union(union_id);
            union.members.contains(&enclosing_object_id)
        }
        (Type::Union(_) | Type::Interface(_), _)  => false,
        _ => true,
    }
}

#[allow(clippy::too_many_arguments)]
fn raw_response_visit_inline_fragment(
    typegen_context: &'_ TypegenContext<'_>,
    operation_name: OperationDefinitionName,
    type_selections: &mut Vec<TypeSelection>,
    inline_fragment: &InlineFragment,
    encountered_enums: &mut EncounteredEnums,
    match_fields: &mut MatchFields,
    encountered_fragments: &mut EncounteredFragments,
    imported_raw_response_types: &mut ImportedRawResponseTypes,
    runtime_imports: &mut RuntimeImports,
    custom_scalars: &mut CustomScalarsImports,
    enclosing_linked_field_concrete_type: Option<Type>,
    emit_semantic_types: bool,
) {
    let mut selections = raw_response_visit_selections(
        typegen_context,
        operation_name,
        &inline_fragment.selections,
        encountered_enums,
        match_fields,
        encountered_fragments,
        imported_raw_response_types,
        runtime_imports,
        custom_scalars,
        enclosing_linked_field_concrete_type,
        emit_semantic_types,
    );
    if inline_fragment
        .directives
        .named(*CLIENT_EXTENSION_DIRECTIVE_NAME)
        .is_some()
    {
        for selection in &mut selections {
            selection.set_conditional(true);
        }
    }

    if let Some(module_metadata) = ModuleMetadata::find(&inline_fragment.directives) {
        let fragment_name = module_metadata.fragment_name;
        if !match_fields.0.contains_key(&fragment_name.0) {
            let module_concrete_type = inline_fragment
                .type_condition
                .filter(|type_condition| !type_condition.is_abstract_type())
                .or(enclosing_linked_field_concrete_type);
            let match_field = raw_response_selections_to_babel(
                typegen_context,
                operation_name,
                selections.iter().filter(|sel| !sel.is_js_field()).cloned(),
                module_concrete_type,
                encountered_enums,
                runtime_imports,
                custom_scalars,
            );
            match_fields.0.insert(fragment_name.0, match_field);
        }

        type_selections.extend(selections.iter().filter(|sel| sel.is_js_field()).cloned());

        type_selections.push(TypeSelection::ModuleDirective(ModuleDirective {
            fragment_name,
            document_name: module_metadata.key,
            conditional: false,
            concrete_type: None,
            abstract_type: None,
        }));
        return;
    }

    if let Some(type_condition) = inline_fragment.type_condition {
        if type_condition.is_abstract_type() {
            for selection in &mut selections {
                // Only set abstract_type if not already set. Inner (more
                // specific) abstract types take precedence over outer ones.
                // e.g. `... on Interface1 { ... on Interface2 { field } }`
                // should keep Interface2 on `field`.
                if selection.get_enclosing_abstract_type().is_none() {
                    selection.set_abstract_type(type_condition);
                }
            }
        } else {
            for selection in &mut selections {
                selection.set_concrete_type(type_condition);
            }
        }
    }
    type_selections.append(&mut selections);
}

fn gen_visit_linked_field(
    typegen_context: &'_ TypegenContext<'_>,
    type_selections: &mut Vec<TypeSelection>,
    linked_field: &LinkedField,
    mut visit_selections_fn: impl FnMut(&[Selection]) -> Vec<TypeSelection>,
    emit_semantic_types: bool,
) {
    let field = typegen_context.schema.field(linked_field.definition.item);
    let schema_name = field.name.item;
    let key = if let Some(alias) = linked_field.alias {
        alias.item
    } else {
        schema_name
    };
    let selections = visit_selections_fn(&linked_field.selections);

    let coerce_to_nullable = has_explicit_catch_to_null(&linked_field.directives);

    let is_result_type = is_result_type_directive(&linked_field.directives);

    let node_type = if emit_semantic_types || is_result_type {
        apply_directive_nullability(field, &linked_field.directives, coerce_to_nullable)
    } else {
        apply_required_directive_nullability(
            &field.type_,
            &linked_field.directives,
            coerce_to_nullable,
        )
    };

    type_selections.push(TypeSelection::LinkedField(TypeSelectionLinkedField {
        field_name_or_alias: key,
        node_type,
        node_selections: selections_to_map(selections.into_iter(), true),
        conditional: false,
        concrete_type: None,
        abstract_type: None,
        is_result_type,
    }));
}

fn visit_scalar_field(
    typegen_context: &'_ TypegenContext<'_>,
    type_selections: &mut Vec<TypeSelection>,
    scalar_field: &ScalarField,
    encountered_enums: &mut EncounteredEnums,
    custom_scalars: &mut CustomScalarsImports,
    enclosing_linked_field_concrete_type: Option<Type>,
    emit_semantic_types: bool,
) {
    let field = typegen_context.schema.field(scalar_field.definition.item);
    let schema_name = field.name.item;
    let key = if let Some(alias) = scalar_field.alias {
        alias.item
    } else {
        schema_name
    };

    let coerce_to_nullable = has_explicit_catch_to_null(&scalar_field.directives);

    let is_result_type = is_result_type_directive(&scalar_field.directives);

    let field_type = if emit_semantic_types || is_result_type {
        apply_directive_nullability(field, &scalar_field.directives, coerce_to_nullable)
    } else {
        apply_required_directive_nullability(
            &field.type_,
            &scalar_field.directives,
            coerce_to_nullable,
        )
    };

    let special_field = ScalarFieldSpecialSchemaField::from_schema_name(
        schema_name,
        &typegen_context.project_config.schema_config,
    );

    if matches!(special_field, Some(ScalarFieldSpecialSchemaField::TypeName))
        && let Some(concrete_type) = enclosing_linked_field_concrete_type
    {
        // If we are creating a typename selection within a linked field with a concrete type, we generate
        // the type e.g. "User", i.e. the concrete string name of the concrete type.
        //
        // This cannot be done within abstract fields and at the top level (even in fragments), because
        // we have the following type hole. With `node { ...Fragment_user }`, `Fragment_user` can be
        // unconditionally read out, without checking whether the `node` field actually has a matching
        // type at runtime.
        //
        // Note that passing concrete_type: enclosing_linked_field_concrete_type here has the effect
        // of making the emitted fields left-hand-optional, causing the compiler to panic (because
        // within updatable fragments/queries, we expect never to generate an optional type.)
        return type_selections.push(TypeSelection::ScalarField(TypeSelectionScalarField {
            field_name_or_alias: key,
            special_field,
            value: AST::StringLiteral(StringLiteral(
                typegen_context.schema.get_type_name(concrete_type),
            )),
            conditional: false,
            concrete_type: None,
            abstract_type: None,
            is_result_type: is_result_type_directive(&scalar_field.directives),
        }));
    }

    let ast = transform_type_reference_into_ast(&field_type, |type_| {
        expect_scalar_type(typegen_context, encountered_enums, custom_scalars, type_)
    });

    type_selections.push(TypeSelection::ScalarField(TypeSelectionScalarField {
        field_name_or_alias: key,
        special_field,
        value: ast,
        conditional: false,
        concrete_type: None,
        abstract_type: None,
        is_result_type,
    }));
}

#[allow(clippy::too_many_arguments)]
fn raw_response_visit_condition(
    typegen_context: &'_ TypegenContext<'_>,
    operation_name: OperationDefinitionName,
    type_selections: &mut Vec<TypeSelection>,
    condition: &Condition,
    encountered_enums: &mut EncounteredEnums,
    match_fields: &mut MatchFields,
    encountered_fragments: &mut EncounteredFragments,
    imported_raw_response_types: &mut ImportedRawResponseTypes,
    runtime_imports: &mut RuntimeImports,
    custom_scalars: &mut CustomScalarsImports,
    enclosing_linked_field_concrete_type: Option<Type>,
    is_throw_on_field_error: bool,
) {
    let mut selections = raw_response_visit_selections(
        typegen_context,
        operation_name,
        &condition.selections,
        encountered_enums,
        match_fields,
        encountered_fragments,
        imported_raw_response_types,
        runtime_imports,
        custom_scalars,
        enclosing_linked_field_concrete_type,
        is_throw_on_field_error,
    );
    for selection in selections.iter_mut() {
        selection.set_conditional(true);
    }
    type_selections.append(&mut selections);
}

#[allow(clippy::too_many_arguments)]
fn visit_condition(
    typegen_context: &'_ TypegenContext<'_>,
    type_selections: &mut Vec<TypeSelection>,
    condition: &Condition,
    input_object_types: &mut InputObjectTypes,
    encountered_enums: &mut EncounteredEnums,
    imported_raw_response_types: &mut ImportedRawResponseTypes,
    encountered_fragments: &mut EncounteredFragments,
    imported_resolvers: &mut ImportedResolvers,
    custom_scalars: &mut CustomScalarsImports,
    runtime_imports: &mut RuntimeImports,
    custom_error_import: &mut Option<CustomTypeImport>,
    enclosing_linked_field_concrete_type: Option<Type>,
    emit_semantic_types: bool,
) {
    let mut selections = visit_selections(
        typegen_context,
        &condition.selections,
        input_object_types,
        encountered_enums,
        imported_raw_response_types,
        encountered_fragments,
        imported_resolvers,
        custom_scalars,
        runtime_imports,
        custom_error_import,
        enclosing_linked_field_concrete_type,
        emit_semantic_types,
    );
    for selection in selections.iter_mut() {
        selection.set_conditional(true);
    }
    type_selections.append(&mut selections);
}

#[allow(clippy::too_many_arguments)]
pub(crate) fn get_data_type(
    typegen_context: &'_ TypegenContext<'_>,
    concrete_type: &Type,
    selections: impl Iterator<Item = TypeSelection>,
    mask_status: MaskStatus,
    fragment_type_name: Option<StringKey>,
    emit_optional_type: bool,
    emit_plural_type: bool,
    encountered_enums: &mut EncounteredEnums,
    encountered_fragments: &mut EncounteredFragments,
    custom_scalars: &mut CustomScalarsImports,
    runtime_imports: &mut RuntimeImports,
    custom_error_import: &mut Option<CustomTypeImport>,
) -> AST {
    let mut data_type = selections_to_babel(
        typegen_context,
        concrete_type,
        selections,
        mask_status,
        fragment_type_name,
        encountered_enums,
        encountered_fragments,
        custom_scalars,
        runtime_imports,
        custom_error_import,
    );
    if emit_optional_type {
        data_type = AST::Nullable(Box::new(data_type))
    }
    if emit_plural_type {
        data_type = AST::ReadOnlyArray(Box::new(data_type))
    }
    data_type
}

#[allow(clippy::too_many_arguments)]
fn selections_to_babel(
    typegen_context: &'_ TypegenContext<'_>,
    concrete_type: &Type,
    selections: impl Iterator<Item = TypeSelection>,
    mask_status: MaskStatus,
    fragment_type_name: Option<StringKey>,
    encountered_enums: &mut EncounteredEnums,
    encountered_fragments: &mut EncounteredFragments,
    custom_scalars: &mut CustomScalarsImports,
    runtime_imports: &mut RuntimeImports,
    custom_error_import: &mut Option<CustomTypeImport>,
) -> AST {
    // A map of "key" to TypeSelection. The key can be thought of as the field name or alias
    // for scalar/linked fields. See [TypeSelection::get_string_key] for the key's behavior
    // for non scalar/linked fields.
    // When we encounter additional TypeSelections with matching keys (e.g. multiple linked
    // fields with the same name?), we merge those into the existing TypeSelection.
    let mut base_fields: IndexMap<StringKey, TypeSelection> = Default::default();

    // A map of Type => Vec<TypeSelection> of all types that are found within inline fragments.
    let mut by_concrete_type: IndexMap<Type, Vec<TypeSelection>> = Default::default();

    for selection in selections {
        if let Some(concrete_type) = selection.get_enclosing_concrete_type() {
            by_concrete_type
                .entry(concrete_type)
                .or_default()
                .push(selection);
        } else {
            let key = selection.get_string_key();
            match base_fields.entry(key) {
                Entry::Occupied(entry) => {
                    let previous_sel = entry.get().clone();
                    *entry.into_mut() = merge_selection(Some(selection), previous_sel, true);
                }
                Entry::Vacant(entry) => {
                    entry.insert(selection);
                }
            }
        }
    }

    let enable_typename_discriminated_unions = typegen_context
        .project_config
        .feature_flags
        .enable_typename_discriminated_unions
        .is_enabled_for(typegen_context.definition_source_location.item);
    if should_emit_discriminated_union(
        concrete_type,
        &by_concrete_type,
        &base_fields,
        enable_typename_discriminated_unions,
    ) {
        get_discriminated_union_ast(
            by_concrete_type,
            &base_fields,
            typegen_context,
            encountered_enums,
            encountered_fragments,
            mask_status,
            fragment_type_name,
            custom_scalars,
            runtime_imports,
            custom_error_import,
        )
    } else {
        get_merged_object_with_optional_fields(
            base_fields,
            by_concrete_type,
            typegen_context,
            encountered_enums,
            encountered_fragments,
            mask_status,
            fragment_type_name,
            custom_scalars,
            runtime_imports,
            custom_error_import,
        )
    }
}

/// If we have top-level non-__typename selections, then selections within type refinements to concrete
/// types are flattened to the top and made optional
#[allow(clippy::too_many_arguments)]
fn get_merged_object_with_optional_fields(
    base_fields: IndexMap<StringKey, TypeSelection>,
    by_concrete_type: IndexMap<Type, Vec<TypeSelection>>,
    typegen_context: &'_ TypegenContext<'_>,
    encountered_enums: &mut EncounteredEnums,
    encountered_fragments: &mut EncounteredFragments,
    mask_status: MaskStatus,
    fragment_type_name: Option<StringKey>,
    custom_scalars: &mut CustomScalarsImports,
    runtime_imports: &mut RuntimeImports,
    custom_error_import: &mut Option<CustomTypeImport>,
) -> AST {
    let mut selection_map = selections_to_map(hashmap_into_values(base_fields), false);
    for concrete_type_selections in hashmap_into_values(by_concrete_type) {
        merge_selection_maps(
            &mut selection_map,
            selections_to_map(
                concrete_type_selections.into_iter().map(|mut sel| {
                    sel.set_conditional(true);
                    sel
                }),
                false,
            ),
            true,
        );
    }
    let mut props = group_refs(hashmap_into_values(selection_map))
        .map(|mut sel| {
            if sel.is_typename()
                && let Some(concrete_type) = sel.get_enclosing_concrete_type()
            {
                sel.set_conditional(false);
                return make_prop(
                    typegen_context,
                    sel,
                    mask_status,
                    Some(concrete_type),
                    encountered_enums,
                    encountered_fragments,
                    custom_scalars,
                    runtime_imports,
                    custom_error_import,
                );
            }
            if let TypeSelection::LinkedField(ref linked_field) = sel
                && let Some(concrete_type) = linked_field.concrete_type
            {
                let mut linked_field = linked_field.clone();
                linked_field.concrete_type = None;
                return make_prop(
                    typegen_context,
                    TypeSelection::LinkedField(linked_field),
                    mask_status,
                    Some(concrete_type),
                    encountered_enums,
                    encountered_fragments,
                    custom_scalars,
                    runtime_imports,
                    custom_error_import,
                );
            }

            make_prop(
                typegen_context,
                sel,
                mask_status,
                None,
                encountered_enums,
                encountered_fragments,
                custom_scalars,
                runtime_imports,
                custom_error_import,
            )
        })
        .collect::<Vec<_>>();

    // If we are in a masked fragment, add the $fragmentType: NameOfFragment$fragmentType
    // type to the generated object.
    if let Some(fragment_type_name) = fragment_type_name {
        props.push(Prop::KeyValuePair(KeyValuePairProp {
            key: *KEY_FRAGMENT_TYPE,
            optional: false,
            read_only: true,
            value: AST::FragmentReferenceType(fragment_type_name),
        }));
    }

    if mask_status == MaskStatus::Unmasked {
        AST::InexactObject(InexactObject::new(props))
    } else {
        AST::ExactObject(ExactObject::new(props))
    }
}

#[allow(clippy::too_many_arguments)]
fn get_discriminated_union_ast(
    by_concrete_type: IndexMap<Type, Vec<TypeSelection>>,
    base_fields: &IndexMap<StringKey, TypeSelection>,
    typegen_context: &'_ TypegenContext<'_>,
    encountered_enums: &mut EncounteredEnums,
    encountered_fragments: &mut EncounteredFragments,
    mask_status: MaskStatus,
    fragment_type_name: Option<StringKey>,
    custom_scalars: &mut CustomScalarsImports,
    runtime_imports: &mut RuntimeImports,
    custom_error_import: &mut Option<CustomTypeImport>,
) -> AST {
    let mut types: Vec<Vec<Prop>> = Vec::new();
    let mut typename_aliases = IndexSet::new();
    for (concrete_type, concrete_type_selections) in by_concrete_type {
        let mut selection_map = selections_to_map(hashmap_into_values(base_fields.clone()), false);
        merge_selection_maps(
            &mut selection_map,
            selections_to_map(concrete_type_selections.into_iter(), false),
            false,
        );
        types.push(
            group_refs(hashmap_into_values(selection_map))
                .map(|selection| {
                    if selection.is_typename() {
                        typename_aliases.insert(selection.get_field_name_or_alias().expect(
                            "Just checked this exists by checking that the field is typename",
                        ));
                    }
                    make_prop(
                        typegen_context,
                        selection,
                        mask_status,
                        Some(concrete_type),
                        encountered_enums,
                        encountered_fragments,
                        custom_scalars,
                        runtime_imports,
                        custom_error_import,
                    )
                })
                .collect(),
        );
    }
    types.push(
        typename_aliases
            .iter()
            .map(|typename_alias| {
                Prop::KeyValuePair(KeyValuePairProp {
                    key: *typename_alias,
                    read_only: true,
                    optional: false,
                    value: AST::OtherTypename,
                })
            })
            .collect(),
    );

    AST::Union(SortedASTList::new(
        types
            .into_iter()
            .map(|mut props: Vec<Prop>| {
                // If we are in a masked fragment, add the $fragmentType: NameOfFragment$fragmentType
                // type to the generated object.
                if let Some(fragment_type_name) = fragment_type_name {
                    props.push(Prop::KeyValuePair(KeyValuePairProp {
                        key: *KEY_FRAGMENT_TYPE,
                        optional: false,
                        read_only: true,
                        value: AST::FragmentReferenceType(fragment_type_name),
                    }));
                }
                if mask_status == MaskStatus::Unmasked {
                    AST::InexactObject(InexactObject::new(props))
                } else {
                    AST::ExactObject(ExactObject::new(props))
                }
            })
            .collect(),
    ))
}

/// In the following condition, if base_fields is empty, the .all will return true
/// but the .any will return false.
///
/// So, we can read this as:
///
/// If base fields is empty
///   * if we have a type refinement to a concrete type
///   * and within each type refinement, there is a __typename selection
///
/// If base fields is not empty
///   * if we have a type refinement to a concrete type
///   * and all fields outside of type refinements are __typename selections
///
/// If this condition passes, we emit a discriminated union
fn should_emit_discriminated_union(
    concrete_type: &Type,
    by_concrete_type: &IndexMap<Type, Vec<TypeSelection>>,
    base_fields: &IndexMap<StringKey, TypeSelection>,
    enable_typename_discriminated_unions: bool,
) -> bool {
    if by_concrete_type.is_empty() || !concrete_type.is_abstract_type() {
        return false;
    }

    if enable_typename_discriminated_unions {
        !base_fields.is_empty() && base_fields.values().any(TypeSelection::is_typename)
    } else {
        base_fields.values().all(TypeSelection::is_typename)
            && (base_fields.values().any(TypeSelection::is_typename)
                || by_concrete_type
                    .values()
                    .all(|selections| has_typename_selection(selections)))
    }
}

pub(crate) fn raw_response_selections_to_babel(
    typegen_context: &'_ TypegenContext<'_>,
    operation_name: OperationDefinitionName,
    selections: impl Iterator<Item = TypeSelection>,
    concrete_type: Option<Type>,
    encountered_enums: &mut EncounteredEnums,
    runtime_imports: &mut RuntimeImports,
    custom_scalars: &mut CustomScalarsImports,
) -> AST {
    let mut base_fields = Vec::new();
    let mut by_concrete_type: IndexMap<Type, Vec<TypeSelection>> = Default::default();
    let mut by_abstract_type: IndexMap<Type, Vec<TypeSelection>> = Default::default();

    for selection in selections {
        if let Some(concrete_type) = selection.get_enclosing_concrete_type() {
            by_concrete_type
                .entry(concrete_type)
                .or_default()
                .push(selection);
        } else if let Some(abstract_type) = selection.get_enclosing_abstract_type() {
            if typegen_context
                .project_config
                .feature_flags
                .disable_more_precise_abstract_selection_raw_response_type
                .is_enabled_for(operation_name.0)
            {
                base_fields.push(selection);
            } else {
                by_abstract_type
                    .entry(abstract_type)
                    .or_default()
                    .push(selection);
            }
        } else if let Some(ct) = concrete_type {
            // No concrete_type and no abstract_type on this selection, but we
            // know the enclosing field's concrete return type. This happens
            // when the same concrete field is selected via two paths:
            // (1) directly — where raw_response_visit_selections stamps inner
            // selections with concrete_type=Some(X); and (2) through an
            // abstract interface spread — where the field's schema return type
            // is abstract so the new-code path is skipped and inner selections
            // keep concrete_type=None.
            //
            // Routing these untyped selections into the known concrete bucket
            // (rather than into base_fields) prevents a spurious catch-all
            // ExactObject from being generated, which would cause the raw
            // response type to be an unnecessary union.
            by_concrete_type.entry(ct).or_default().push(selection);
        } else {
            base_fields.push(selection);
        }
    }

    if base_fields.is_empty() && by_abstract_type.is_empty() && by_concrete_type.is_empty() {
        // base fields, fields on abstract types and per-type fields are all empty:
        // this can only occur because the only selection was a  @no_inline fragment.
        // in this case, emit a single, empty ExactObject since nothing was selected.
        return AST::ExactObject(ExactObject::new(Default::default()));
    }

    let mut types: Vec<AST> = Vec::new();

    if let Some(concrete_type) = concrete_type {
        let mut merged_selections = selections_to_map(base_fields.into_iter(), false);

        if let Some(concrete_selections) = by_concrete_type.get(&concrete_type) {
            merge_selection_maps(
                &mut merged_selections,
                selections_to_map(concrete_selections.iter().cloned(), false),
                false,
            );
        }

        for (abstract_type, abstract_selections) in &by_abstract_type {
            if typegen_context
                .schema
                .is_named_type_subtype_of(concrete_type, *abstract_type)
            {
                merge_selection_maps(
                    &mut merged_selections,
                    selections_to_map(abstract_selections.iter().cloned(), false),
                    false,
                );
            }
        }

        let merged_selections: Vec<_> = hashmap_into_values(merged_selections).collect();
        types.push(AST::ExactObject(ExactObject::new(
            merged_selections
                .iter()
                .cloned()
                .map(|selection| {
                    raw_response_make_prop(
                        typegen_context,
                        operation_name,
                        selection,
                        Some(concrete_type),
                        encountered_enums,
                        runtime_imports,
                        custom_scalars,
                    )
                })
                .collect(),
        )));
        append_local_3d_payload(
            typegen_context,
            operation_name,
            &mut types,
            &merged_selections,
            Some(concrete_type),
            encountered_enums,
            runtime_imports,
            custom_scalars,
        );
        return AST::Union(SortedASTList::new(types));
    }

    if !by_concrete_type.is_empty() {
        let base_fields_map = selections_to_map(base_fields.clone().into_iter(), false);
        for (concrete_type, selections) in by_concrete_type {
            let mut base_fields_map = base_fields_map.clone();
            merge_selection_maps(
                &mut base_fields_map,
                selections_to_map(selections.into_iter(), false),
                false,
            );

            if !by_abstract_type.is_empty() {
                for (abstract_type, abstract_selections) in &by_abstract_type {
                    if typegen_context
                        .schema
                        .is_named_type_subtype_of(concrete_type, *abstract_type)
                    {
                        merge_selection_maps(
                            &mut base_fields_map,
                            selections_to_map(abstract_selections.clone().into_iter(), false),
                            false,
                        );
                    }
                }
            }

            let merged_selections: Vec<_> = hashmap_into_values(base_fields_map).collect();
            types.push(AST::ExactObject(ExactObject::new(
                merged_selections
                    .iter()
                    .cloned()
                    .map(|selection| {
                        raw_response_make_prop(
                            typegen_context,
                            operation_name,
                            selection,
                            Some(concrete_type),
                            encountered_enums,
                            runtime_imports,
                            custom_scalars,
                        )
                    })
                    .collect(),
            )));
            append_local_3d_payload(
                typegen_context,
                operation_name,
                &mut types,
                &merged_selections,
                Some(concrete_type),
                encountered_enums,
                runtime_imports,
                custom_scalars,
            );
        }
    }

    if !base_fields.is_empty() || !by_abstract_type.is_empty() {
        let mut base_fields_map = selections_to_map(base_fields.clone().into_iter(), false);

        if !by_abstract_type.is_empty() {
            for (abstract_type, abstract_selections) in by_abstract_type {
                // When concrete_type is None (abstract parent), the
                // catch-all branch must be valid for any type that doesn't
                // have its own concrete branch. We cannot assume all such
                // types implement the abstract type, so selections from
                // abstract spreads must always be conditional here.
                let is_conditional = !matches!(
                    concrete_type,
                    Some(ct) if typegen_context
                        .schema
                        .is_named_type_subtype_of(ct, abstract_type)
                );

                merge_selection_maps(
                    &mut base_fields_map,
                    selections_to_map(abstract_selections.into_iter(), false),
                    is_conditional,
                );
            }
        }

        let merged_selections: Vec<_> = hashmap_into_values(base_fields_map).collect();
        types.push(AST::ExactObject(ExactObject::new(
            merged_selections
                .iter()
                .cloned()
                .map(|selection| {
                    raw_response_make_prop(
                        typegen_context,
                        operation_name,
                        selection,
                        concrete_type,
                        encountered_enums,
                        runtime_imports,
                        custom_scalars,
                    )
                })
                .collect(),
        )));
        append_local_3d_payload(
            typegen_context,
            operation_name,
            &mut types,
            &merged_selections,
            concrete_type,
            encountered_enums,
            runtime_imports,
            custom_scalars,
        );
    }

    AST::Union(SortedASTList::new(types))
}

#[allow(clippy::too_many_arguments)]
fn append_local_3d_payload(
    typegen_context: &'_ TypegenContext<'_>,
    operation_name: OperationDefinitionName,
    types: &mut Vec<AST>,
    type_selections: &[TypeSelection],
    concrete_type: Option<Type>,
    encountered_enums: &mut EncounteredEnums,
    runtime_imports: &mut RuntimeImports,
    custom_scalars: &mut CustomScalarsImports,
) {
    if let Some(module_import) = type_selections.iter().find_map(|sel| {
        if let TypeSelection::ModuleDirective(m) = sel {
            Some(m)
        } else {
            None
        }
    }) {
        runtime_imports.local_3d_payload_type = true;

        types.push(AST::Local3DPayload(
            module_import.document_name,
            Box::new(AST::ExactObject(ExactObject::new(
                type_selections
                    .iter()
                    .filter(|sel| !sel.is_js_field())
                    .map(|sel| {
                        raw_response_make_prop(
                            typegen_context,
                            operation_name,
                            sel.clone(),
                            concrete_type,
                            encountered_enums,
                            runtime_imports,
                            custom_scalars,
                        )
                    })
                    .collect(),
            ))),
        ));
    }
}

pub fn make_custom_error_import(
    typegen_context: &'_ TypegenContext<'_>,
    custom_error_type: &mut Option<CustomTypeImport>,
) -> Result<(), std::fmt::Error> {
    let current_error_type = typegen_context
        .project_config
        .typegen_config
        .custom_error_type
        .clone();
    if custom_error_type.is_some() && *custom_error_type != current_error_type {
        panic!(
            "Custom error type is not consistent across fragments. This indicates a bug in Relay. current_error_type: {current_error_type:?}, custom_error_type: {custom_error_type:?}"
        );
    } else if custom_error_type.is_some() && *custom_error_type == current_error_type {
        return Ok(());
    }
    custom_error_type.clone_from(
        &typegen_context
            .project_config
            .typegen_config
            .custom_error_type,
    );
    Ok(())
}
pub fn make_result_type(typegen_context: &'_ TypegenContext<'_>, value: AST) -> AST {
    let maybe_custom_error = &typegen_context
        .project_config
        .typegen_config
        .custom_error_type;

    let error_type = match maybe_custom_error {
        Some(custom_error) => AST::RawType(custom_error.name),
        None => AST::Mixed,
    };

    AST::GenericType {
        outer: *RESULT_TYPE_NAME,
        inner: vec![value, error_type],
    }
}

#[allow(clippy::too_many_arguments)]
fn make_prop(
    typegen_context: &'_ TypegenContext<'_>,
    type_selection: TypeSelection,
    mask_status: MaskStatus,
    concrete_type: Option<Type>,
    encountered_enums: &mut EncounteredEnums,
    encountered_fragments: &mut EncounteredFragments,
    custom_scalars: &mut CustomScalarsImports,
    runtime_imports: &mut RuntimeImports,
    custom_error_import: &mut Option<CustomTypeImport>,
) -> Prop {
    let optional = type_selection.is_conditional();
    if typegen_context.generating_updatable_types && optional {
        panic!(
            "When generating types for updatable operations and fragments, we should never generate optional fields! This indicates a bug in Relay. type_selection: {type_selection:?}"
        );
    }

    match type_selection {
        TypeSelection::LinkedField(linked_field) => {
            let key = linked_field.field_name_or_alias;

            if typegen_context.generating_updatable_types {
                // TODO check whether the field is `node` or `nodes` on `Query`. If so, it should not be
                // updatable.

                let (just_fragments, no_fragments) =
                    extract_fragments(linked_field.node_selections);

                let getter_object_props = selections_to_babel(
                    typegen_context,
                    &linked_field.node_type.inner(),
                    no_fragments.into_iter(),
                    mask_status,
                    None,
                    encountered_enums,
                    encountered_fragments,
                    custom_scalars,
                    runtime_imports,
                    custom_error_import,
                );

                let getter_return_value =
                    transform_type_reference_into_ast(&linked_field.node_type, |type_| {
                        return_ast_in_object_case(
                            typegen_context,
                            encountered_enums,
                            custom_scalars,
                            getter_object_props,
                            type_,
                        )
                    });

                let setter_parameter = if just_fragments.is_empty() {
                    if linked_field.node_type.is_list() {
                        AST::RawType(intern!("[]"))
                    } else {
                        match typegen_context.project_config.typegen_config.language {
                            TypegenLanguage::Flow | TypegenLanguage::JavaScript => {
                                AST::RawType(intern!("null | void"))
                            }
                            TypegenLanguage::TypeScript => {
                                AST::RawType(intern!("null | undefined"))
                            }
                        }
                    }
                } else {
                    let setter_parameter = AST::Union(
                                  SortedASTList::new(
                                  just_fragments
                                      .iter()
                                      .map(|fragment_spread| {
                                          let type_condition_info =  fragment_spread
                                              .type_condition_info
                                              .expect("Fragment spreads in updatable queries should have TypeConditionInfo");
                                          let (key, value) = match type_condition_info {
                                              TypeConditionInfo::Abstract => (format!("__is{}", fragment_spread.fragment_name).intern(), AST::String),
                                              TypeConditionInfo::Concrete { concrete_type } => ("__typename".intern(), AST::StringLiteral(StringLiteral(concrete_type))),
                                          };
                                          let fragment_spread_or_concrete_type_marker = Prop::KeyValuePair(KeyValuePairProp {
                                              key,
                                              value,
                                              read_only: true,
                                              optional: false,
                                          });
                                          let assignable_fragment_spread_ref = Prop::KeyValuePair(KeyValuePairProp {
                                              key: *KEY_FRAGMENT_SPREADS,
                                              value: AST::FragmentReference(
                                                  SortedStringKeyList::new(vec![fragment_spread.fragment_name.0]),
                                              ),
                                              read_only: true,
                                              optional: false,
                                          });
                                          let client_id_field = Prop::KeyValuePair(KeyValuePairProp {
                                              key: "__id".intern(),
                                              value: AST::String,
                                              read_only: true,
                                              optional: false,
                                          });

                                          AST::InexactObject(InexactObject::new(vec![
                                              assignable_fragment_spread_ref,
                                              fragment_spread_or_concrete_type_marker,
                                              client_id_field,
                                          ]))
                                      })
                                      .collect(),
                              ));
                    if linked_field.node_type.is_list() {
                        AST::ReadOnlyArray(Box::new(setter_parameter))
                    } else {
                        AST::Nullable(Box::new(setter_parameter))
                    }
                };

                Prop::GetterSetterPair(GetterSetterPairProp {
                    key,
                    getter_return_value,
                    setter_parameter,
                })
            } else {
                let object_props = selections_to_babel(
                    typegen_context,
                    &linked_field.node_type.inner(),
                    hashmap_into_values(linked_field.node_selections),
                    mask_status,
                    None,
                    encountered_enums,
                    encountered_fragments,
                    custom_scalars,
                    runtime_imports,
                    custom_error_import,
                );
                let mut value =
                    transform_type_reference_into_ast(&linked_field.node_type, |type_| {
                        return_ast_in_object_case(
                            typegen_context,
                            encountered_enums,
                            custom_scalars,
                            object_props,
                            type_,
                        )
                    });

                if linked_field.is_result_type {
                    value = make_result_type(typegen_context, value);
                    runtime_imports.result_type = true;
                    match make_custom_error_import(typegen_context, custom_error_import) {
                        Ok(_) => {}
                        Err(e) => {
                            panic!("Error while generating custom error type: {e}");
                        }
                    }
                }

                Prop::KeyValuePair(KeyValuePairProp {
                    key,
                    value,
                    optional,
                    read_only: true,
                })
            }
        }
        TypeSelection::ScalarField(scalar_field) => {
            if scalar_field.special_field == Some(ScalarFieldSpecialSchemaField::TypeName) {
                if let Some(concrete_type) = concrete_type {
                    Prop::KeyValuePair(KeyValuePairProp {
                        key: scalar_field.field_name_or_alias,
                        value: AST::StringLiteral(StringLiteral(
                            typegen_context.schema.get_type_name(concrete_type),
                        )),
                        optional,
                        read_only: true,
                    })
                } else {
                    Prop::KeyValuePair(KeyValuePairProp {
                        key: scalar_field.field_name_or_alias,
                        value: scalar_field.value,
                        optional,
                        read_only: true,
                    })
                }
            } else {
                let mut value = scalar_field.value;

                if scalar_field.is_result_type {
                    value = make_result_type(typegen_context, value);
                    runtime_imports.result_type = true;
                    match make_custom_error_import(typegen_context, custom_error_import) {
                        Ok(_) => {}
                        Err(e) => {
                            panic!("Error while generating custom error type: {e}");
                        }
                    }
                }

                Prop::KeyValuePair(KeyValuePairProp {
                    key: scalar_field.field_name_or_alias,
                    value,
                    optional,
                    // all fields outside of updatable operations are read-only, and within updatable operations,
                    // all special fields are read only
                    read_only: !typegen_context.generating_updatable_types
                        || scalar_field.special_field.is_some(),
                })
            }
        }
        _ => panic!("Unexpected TypeSelection variant in make_prop, {type_selection:?}"),
    }
}

fn raw_response_make_prop(
    typegen_context: &'_ TypegenContext<'_>,
    operation_name: OperationDefinitionName,
    type_selection: TypeSelection,
    concrete_type: Option<Type>,
    encountered_enums: &mut EncounteredEnums,
    runtime_imports: &mut RuntimeImports,
    custom_scalars: &mut CustomScalarsImports,
) -> Prop {
    let optional = !typegen_context
        .typegen_options
        .no_optional_fields_in_raw_response_type
        && type_selection.is_conditional();
    match type_selection {
        TypeSelection::ModuleDirective(module_directive) => Prop::Spread(SpreadProp {
            value: module_directive.fragment_name.0,
            conditional: false,
        }),
        TypeSelection::LinkedField(linked_field) => {
            let node_type = linked_field.node_type;
            let inner_concrete_type = if node_type.is_list()
                || node_type.is_non_null()
                || node_type.inner().is_abstract_type()
            {
                None
            } else {
                Some(node_type.inner())
            };
            let object_props = raw_response_selections_to_babel(
                typegen_context,
                operation_name,
                hashmap_into_values(linked_field.node_selections),
                inner_concrete_type,
                encountered_enums,
                runtime_imports,
                custom_scalars,
            );
            Prop::KeyValuePair(KeyValuePairProp {
                key: linked_field.field_name_or_alias,
                value: transform_type_reference_into_ast(&node_type, |type_| {
                    return_ast_in_object_case(
                        typegen_context,
                        encountered_enums,
                        custom_scalars,
                        object_props,
                        type_,
                    )
                }),
                read_only: true,
                optional,
            })
        }
        TypeSelection::ScalarField(scalar_field) => {
            if scalar_field.special_field == Some(ScalarFieldSpecialSchemaField::TypeName) {
                if let Some(concrete_type) = concrete_type {
                    Prop::KeyValuePair(KeyValuePairProp {
                        key: scalar_field.field_name_or_alias,
                        value: AST::StringLiteral(StringLiteral(
                            typegen_context.schema.get_type_name(concrete_type),
                        )),
                        read_only: true,
                        optional,
                    })
                } else {
                    Prop::KeyValuePair(KeyValuePairProp {
                        key: scalar_field.field_name_or_alias,
                        value: scalar_field.value,
                        read_only: true,
                        optional,
                    })
                }
            } else {
                Prop::KeyValuePair(KeyValuePairProp {
                    key: scalar_field.field_name_or_alias,
                    value: scalar_field.value,
                    read_only: true,
                    optional,
                })
            }
        }
        TypeSelection::RawResponseFragmentSpread(f) => Prop::Spread(SpreadProp {
            value: f.value,
            conditional: optional,
        }),
        _ => {
            panic!("Unexpected TypeSelection variant in raw_response_make_prop {type_selection:?}")
        }
    }
}

fn transform_type_reference_into_ast(
    type_reference: &TypeReference<Type>,
    transform_inner_type: impl FnOnce(&Type) -> AST,
) -> AST {
    match type_reference {
        TypeReference::NonNull(non_null_ref) => {
            transform_non_nullable_type_reference_into_ast(non_null_ref, transform_inner_type)
        }
        _ => AST::Nullable(Box::new(transform_non_nullable_type_reference_into_ast(
            type_reference,
            transform_inner_type,
        ))),
    }
}

fn transform_non_nullable_type_reference_into_ast(
    type_reference: &TypeReference<Type>,
    transform_inner_type: impl FnOnce(&Type) -> AST,
) -> AST {
    match type_reference {
        TypeReference::List(of_type) => AST::ReadOnlyArray(Box::new(
            transform_type_reference_into_ast(of_type, transform_inner_type),
        )),
        TypeReference::Named(named_type) => transform_inner_type(named_type),
        TypeReference::NonNull(_) => panic!("unexpected NonNull"),
    }
}

/// Whether the type checker can see this type's nullability from the emitted
/// syntax alone.
///
/// Absence of `Nullable` is already a real constraint for anything structurally
/// evident -- Flow rejects `() => ?{id: string}` cast to `() => {id: string}` --
/// so those assertions need no help and wrapping them only adds noise. It says
/// nothing for a type that is printed as a *name*: the assertion then restates
/// the resolver's own annotation, and nothing can fail a tautology.
///
/// Unrecognised variants default to "visible", i.e. no wrap. Being wrong that
/// way costs a missed check, never a false positive.
fn hides_its_nullability(ast: &AST) -> bool {
    matches!(
        ast,
        // `unknown` admits null, so the bare type constrains nothing.
        AST::Mixed
            // Printed as a bare name; the definition may be a maybe type.
            | AST::RawType(_)
            | AST::Identifier(_)
            | AST::GenericType { .. }
            // Deferred lookups -- resolved by the type checker, not by us.
            | AST::ReturnTypeOfFunctionWithName(_)
            | AST::ReturnTypeOfMethodCall(_, _)
            | AST::PropertyType { .. }
    )
}

/// Like `transform_type_reference_into_ast`, but states every non-null level
/// positively as `NonNullable<...>` rather than as the absence of `Nullable`.
///
/// Only used for leaf types that `hides_its_nullability` flags. Every level is
/// wrapped because `@semanticNonNull(levels: [...])` can mark the list and its
/// items independently.
fn transform_type_reference_into_assertion_ast(
    type_reference: &TypeReference<Type>,
    transform_inner_type: impl FnOnce(&Type) -> AST,
) -> AST {
    match type_reference {
        TypeReference::NonNull(non_null_ref) => AST::NonNullable(Box::new(
            transform_non_nullable_type_reference_into_assertion_ast(
                non_null_ref,
                transform_inner_type,
            ),
        )),
        _ => AST::Nullable(Box::new(
            transform_non_nullable_type_reference_into_assertion_ast(
                type_reference,
                transform_inner_type,
            ),
        )),
    }
}

fn transform_non_nullable_type_reference_into_assertion_ast(
    type_reference: &TypeReference<Type>,
    transform_inner_type: impl FnOnce(&Type) -> AST,
) -> AST {
    match type_reference {
        TypeReference::List(of_type) => AST::ReadOnlyArray(Box::new(
            transform_type_reference_into_assertion_ast(of_type, transform_inner_type),
        )),
        TypeReference::Named(named_type) => transform_inner_type(named_type),
        TypeReference::NonNull(_) => panic!("unexpected NonNull"),
    }
}

fn transform_graphql_scalar_type(
    typegen_context: &'_ TypegenContext<'_>,
    scalar: ScalarID,
    custom_scalars: &mut CustomScalarsImports,
) -> AST {
    let scalar_definition = typegen_context.schema.scalar(scalar);
    let scalar_name = scalar_definition.name;
    if let Some(directive) = scalar_definition
        .directives
        .named(DirectiveName(*CUSTOM_SCALAR_DIRECTIVE_NAME))
    {
        let path = directive
            .arguments
            .named(ArgumentName(*PATH_CUSTOM_SCALAR_ARGUMENT_NAME))
            .unwrap_or_else(|| {
                panic!(
                    "Expected @{} directive to have a path argument",
                    *CUSTOM_SCALAR_DIRECTIVE_NAME
                )
            })
            .expect_string_literal();

        let import_path = typegen_context.project_config.js_module_import_identifier(
            &typegen_context
                .project_config
                .artifact_path_for_definition(typegen_context.definition_source_location),
            &PathBuf::from(path.lookup()),
        );

        let export_name = directive
            .arguments
            .named(ArgumentName(*EXPORT_NAME_CUSTOM_SCALAR_ARGUMENT_NAME))
            .unwrap_or_else(|| {
                panic!(
                    "Expected @{} directive to have an export_name argument",
                    *CUSTOM_SCALAR_DIRECTIVE_NAME
                )
            })
            .expect_string_literal();
        custom_scalars.insert((export_name, PathBuf::from(import_path.lookup())));
        return AST::RawType(export_name);
    }
    // TODO: We could implement custom variables that are provided via the
    // config by inserting them into the schema with directives, thus avoiding
    // having two different ways to express typed custom scalars internally.
    if let Some(custom_scalar) = typegen_context
        .project_config
        .typegen_config
        .custom_scalar_types
        .get(&scalar_name.item)
    {
        match custom_scalar {
            CustomType::Name(custom_scalar) => AST::RawType(*custom_scalar),
            CustomType::Path(CustomTypeImport { name, path }) => {
                custom_scalars.insert((*name, path.clone()));

                AST::RawType(*name)
            }
        }
    } else if scalar_name.item == *TYPE_ID || scalar_name.item == *TYPE_STRING {
        AST::String
    } else if scalar_name.item == *TYPE_FLOAT || scalar_name.item == *TYPE_INT {
        AST::Number
    } else if scalar_name.item == *TYPE_BOOLEAN {
        AST::Boolean
    } else {
        if typegen_context
            .project_config
            .typegen_config
            .require_custom_scalar_types
        {
            panic!(
                "Expected the JS type for '{}' to be defined, please update 'customScalarTypes' in your compiler config.",
                scalar_name.item
            );
        }
        AST::Any
    }
}

fn transform_graphql_enum_type(
    schema: &SDLSchema,
    enum_id: EnumID,
    encountered_enums: &mut EncounteredEnums,
) -> AST {
    encountered_enums.0.insert(enum_id);
    AST::Identifier(schema.enum_(enum_id).name.item.0)
}

#[allow(clippy::too_many_arguments)]
pub(crate) fn raw_response_visit_selections(
    typegen_context: &'_ TypegenContext<'_>,
    operation_name: OperationDefinitionName,
    selections: &[Selection],
    encountered_enums: &mut EncounteredEnums,
    match_fields: &mut MatchFields,
    encountered_fragments: &mut EncounteredFragments,
    imported_raw_response_types: &mut ImportedRawResponseTypes,
    runtime_imports: &mut RuntimeImports,
    custom_scalars: &mut CustomScalarsImports,
    enclosing_linked_field_concrete_type: Option<Type>,
    emit_semantic_types: bool,
) -> Vec<TypeSelection> {
    let mut type_selections = Vec::new();
    for selection in selections {
        match selection {
            Selection::FragmentSpread(spread) => {
                if NoInlineFragmentSpreadMetadata::find(&spread.directives).is_some() {
                    let spread_type = spread.fragment.item.0;
                    // apply_fragment_arguments rewrites no-inline spreads to use the
                    // fragment definition location required by split-output paths.
                    imported_raw_response_types
                        .0
                        .insert(spread_type, spread.fragment.location);
                    let target_type = spread
                        .signature
                        .as_ref()
                        .map(|signature| signature.type_condition);
                    let target_always_matches = target_type.is_some_and(|target_type| {
                        enclosing_linked_field_concrete_type.is_some_and(|parent_type| {
                            typegen_context
                                .schema
                                .is_named_type_subtype_of(parent_type, target_type)
                        })
                    });
                    type_selections.push(TypeSelection::RawResponseFragmentSpread(
                        RawResponseFragmentSpread {
                            value: spread_type,
                            conditional: target_type.is_some_and(|target_type| {
                                !target_always_matches
                                    && target_type.is_abstract_type()
                                    && typegen_context
                                        .project_config
                                        .feature_flags
                                        .disable_more_precise_abstract_selection_raw_response_type
                                        .is_enabled_for(operation_name.0)
                            }),
                            concrete_type: target_type.filter(|target_type| {
                                !target_always_matches && !target_type.is_abstract_type()
                            }),
                            abstract_type: target_type.filter(|target_type| {
                                !target_always_matches && target_type.is_abstract_type()
                            }),
                        },
                    ))
                }
            }
            Selection::InlineFragment(inline_fragment) => raw_response_visit_inline_fragment(
                typegen_context,
                operation_name,
                &mut type_selections,
                inline_fragment,
                encountered_enums,
                match_fields,
                encountered_fragments,
                imported_raw_response_types,
                runtime_imports,
                custom_scalars,
                enclosing_linked_field_concrete_type,
                inline_fragment
                    .directives
                    .named(*THROW_ON_FIELD_ERROR_DIRECTIVE)
                    .is_some(),
            ),
            Selection::LinkedField(linked_field) => {
                // Note: We intentionally use the semantic field type here
                // despite the fact that we are generating a raw response type,
                // which should model the _server's_ return type.
                //
                // While it's true that the server may return null for a semantic non-null field,
                // it should only do so if that field also has an error in the errors array. Since
                // raw response type is generally used to construct payloads for apis which do not
                // allow the user to provide additional field level error data, we must ensure that
                // only semantically valid values are allowed in the raw response type.
                let linked_field_type = typegen_context
                    .schema
                    .field(linked_field.definition.item)
                    .type_
                    .inner();
                let nested_enclosing_linked_field_concrete_type =
                    if linked_field_type.is_abstract_type() {
                        None
                    } else {
                        Some(linked_field_type)
                    };
                gen_visit_linked_field(
                    typegen_context,
                    &mut type_selections,
                    linked_field,
                    |selections| {
                        raw_response_visit_selections(
                            typegen_context,
                            operation_name,
                            selections,
                            encountered_enums,
                            match_fields,
                            encountered_fragments,
                            imported_raw_response_types,
                            runtime_imports,
                            custom_scalars,
                            nested_enclosing_linked_field_concrete_type,
                            emit_semantic_types,
                        )
                    },
                    emit_semantic_types,
                )
            }
            Selection::ScalarField(scalar_field) => visit_scalar_field(
                typegen_context,
                &mut type_selections,
                scalar_field,
                encountered_enums,
                custom_scalars,
                enclosing_linked_field_concrete_type,
                emit_semantic_types,
            ),
            Selection::Condition(condition) => raw_response_visit_condition(
                typegen_context,
                operation_name,
                &mut type_selections,
                condition,
                encountered_enums,
                match_fields,
                encountered_fragments,
                imported_raw_response_types,
                runtime_imports,
                custom_scalars,
                enclosing_linked_field_concrete_type,
                emit_semantic_types,
            ),
        }
    }

    if let Some(concrete_type) = enclosing_linked_field_concrete_type {
        // If we are generating for a concrete field type, we should 1. remove
        // any selections that are for a different concrete type, since they are
        // not applicable to our field, and 2. mark any selections without a
        // concrete type as being for our field's concrete type, so that
        // `raw_response_selections_to_babel` doesn't generate redundant types.
        type_selections.retain_mut(|type_selection| {
            match type_selection.get_enclosing_concrete_type() {
                Some(selection_concrete_type) => selection_concrete_type == concrete_type,
                None => {
                    type_selection.set_concrete_type(concrete_type);
                    true
                }
            }
        });
    }

    type_selections
}

fn transform_non_nullable_input_type(
    typegen_context: &'_ TypegenContext<'_>,
    type_ref: &TypeReference<Type>,
    input_object_types: &mut InputObjectTypes,
    encountered_enums: &mut EncounteredEnums,
    custom_scalars: &mut CustomScalarsImports,
) -> AST {
    match type_ref {
        TypeReference::List(of_type) => AST::ReadOnlyArray(Box::new(transform_input_type(
            typegen_context,
            of_type,
            input_object_types,
            encountered_enums,
            custom_scalars,
        ))),
        TypeReference::Named(named_type) => match named_type {
            Type::Scalar(scalar) => {
                transform_graphql_scalar_type(typegen_context, *scalar, custom_scalars)
            }
            Type::Enum(enum_id) => {
                transform_graphql_enum_type(typegen_context.schema, *enum_id, encountered_enums)
            }
            Type::InputObject(input_object_id) => {
                let input_object = typegen_context.schema.input_object(*input_object_id);
                if !input_object_types.contains_key(&input_object.name.item) {
                    input_object_types
                        .insert(input_object.name.item, GeneratedInputObject::Pending);

                    let node = if typegen_context.project_config.typegen_config.one_of_type
                        == OneOfGeneration::Strict
                        && input_object
                            .directives()
                            .named(*ONE_OF_DIRECTIVE_NAME)
                            .is_some()
                    {
                        AST::Union(SortedASTList::new(
                            build_one_of_cases(
                                typegen_context,
                                input_object,
                                input_object_types,
                                encountered_enums,
                                custom_scalars,
                            )
                            .map(AST::from)
                            .collect(),
                        ))
                    } else {
                        build_input_object(
                            typegen_context,
                            input_object,
                            input_object_types,
                            encountered_enums,
                            custom_scalars,
                        )
                        .into()
                    };

                    input_object_types
                        .insert(input_object.name.item, GeneratedInputObject::Resolved(node));
                }
                AST::Identifier(input_object.name.item.0)
            }
            Type::Union(_) | Type::Object(_) | Type::Interface(_) => {
                panic!("unexpected non-input type")
            }
        },
        TypeReference::NonNull(_) => panic!("Unexpected NonNull"),
    }
}

fn build_input_object(
    typegen_context: &TypegenContext<'_>,
    input_object: &InputObject,
    input_object_types: &mut InputObjectTypes,
    encountered_enums: &mut EncounteredEnums,
    custom_scalars: &mut CustomScalarsImports,
) -> ExactObject {
    ExactObject::new(
        input_object
            .fields
            .iter()
            .map(|field| {
                Prop::KeyValuePair(KeyValuePairProp {
                    key: field.name.item.0,
                    read_only: false,
                    optional: !field.type_.is_non_null()
                        || typegen_context
                            .project_config
                            .typegen_config
                            .optional_input_fields
                            .contains(&field.name.item.0)
                        || field.default_value.is_some(),
                    value: transform_input_type(
                        typegen_context,
                        &field.type_,
                        input_object_types,
                        encountered_enums,
                        custom_scalars,
                    ),
                })
            })
            .collect(),
    )
}

/// This builds a union of objects of shape
/// ```ts
/// type OneOfInput =
///   | { foo: string; bar?: never; baz?: never }
///   | { foo?: never; bar: string; baz?: never }
///   | { foo?: never; bar?: never; baz?: number }
/// ```
/// for the @oneOf inputs
/// ```gql
/// type OneOfInput @oneOf {
///   foo: String
///   bar: String
///   baz: Int
/// }
/// ```
///
/// NOTE: This type scheme might be unintuitive when compared to
/// `{ foo: string } | { bar: string } | { baz: number }`.
/// This is a completely fine type to use in flow, but in typescript
/// this simpler type exhibits unfortunate usability limitations
/// ```ts
/// type SimplerOneOfInput = { foo: string } | { bar: string } | { baz: number }
///
/// declare var simpleInput: SimplerOneOfInput
/// if (simpleInput.foo) processFoo(input.foo)
/// //              ^^^ Error: OneOfInput has no property 'foo'
///
/// declare var input: OneOfInput
/// if (simpleInput.foo) processFoo(input.foo) // ✅ works fine
/// ```
fn build_one_of_cases(
    typegen_context: &TypegenContext<'_>,
    input_object: &InputObject,
    input_object_types: &mut InputObjectTypes,
    encountered_enums: &mut EncounteredEnums,
    custom_scalars: &mut CustomScalarsImports,
) -> impl Iterator<Item = ExactObject> {
    (0..input_object.fields.len())
        .map(|present_field_idx| {
            input_object
                .fields
                .iter()
                .enumerate()
                .map(|(idx, field)| {
                    if idx == present_field_idx {
                        Prop::KeyValuePair(KeyValuePairProp {
                            key: field.name.item.0,
                            read_only: false,
                            optional: false,
                            value: transform_non_nullable_input_type(
                                typegen_context,
                                &field.type_,
                                input_object_types,
                                encountered_enums,
                                custom_scalars,
                            ),
                        })
                    } else {
                        Prop::KeyValuePair(KeyValuePairProp {
                            key: field.name.item.0,
                            read_only: false,
                            optional: true,
                            value: AST::Empty,
                        })
                    }
                })
                .collect()
        })
        .map(ExactObject::new)
}

pub(crate) fn transform_input_type(
    typegen_context: &'_ TypegenContext<'_>,
    type_ref: &TypeReference<Type>,
    input_object_types: &mut InputObjectTypes,
    encountered_enums: &mut EncounteredEnums,
    custom_scalars: &mut CustomScalarsImports,
) -> AST {
    match type_ref {
        TypeReference::NonNull(of_type) => transform_non_nullable_input_type(
            typegen_context,
            of_type,
            input_object_types,
            encountered_enums,
            custom_scalars,
        ),
        _ => AST::Nullable(Box::new(transform_non_nullable_input_type(
            typegen_context,
            type_ref,
            input_object_types,
            encountered_enums,
            custom_scalars,
        ))),
    }
}

pub(crate) fn get_input_variables_type<'a>(
    typegen_context: &'a TypegenContext<'_>,
    node: &OperationDefinition,
    input_object_types: &'a mut InputObjectTypes,
    encountered_enums: &'a mut EncounteredEnums,
    custom_scalars: &'a mut CustomScalarsImports,
) -> ExactObject {
    ExactObject::new(
        node.variable_definitions
            .iter()
            .map(|var_def| {
                Prop::KeyValuePair(KeyValuePairProp {
                    key: var_def.name.item.0,
                    read_only: false,
                    optional: !var_def.type_.is_non_null(),
                    value: transform_input_type(
                        typegen_context,
                        &var_def.type_,
                        input_object_types,
                        encountered_enums,
                        custom_scalars,
                    ),
                })
            })
            .collect(),
    )
}

fn hashmap_into_values<K: Hash + Eq, V>(map: IndexMap<K, V>) -> impl Iterator<Item = V> {
    map.into_iter().map(|(_, val)| val)
}

fn extract_fragments(
    all_selections: IndexMap<TypeSelectionKey, TypeSelection>,
) -> (Vec<TypeSelectionFragmentSpread>, Vec<TypeSelection>) {
    let mut fragments = Vec::with_capacity(all_selections.len());
    let mut non_fragments = Vec::with_capacity(all_selections.len());

    for (_, type_selection) in all_selections {
        match type_selection {
            TypeSelection::FragmentSpread(f) => {
                fragments.push(f);
            }
            _ => non_fragments.push(type_selection),
        }
    }

    (fragments, non_fragments)
}

fn selections_to_map(
    selections: impl Iterator<Item = TypeSelection>,
    append_type: bool,
) -> TypeSelectionMap {
    let mut map: TypeSelectionMap = Default::default();
    for selection in selections {
        let selection_key = selection.get_string_key();
        let key = if append_type {
            TypeSelectionKey {
                key: selection_key,
                concrete_type: selection.get_enclosing_concrete_type(),
            }
        } else {
            TypeSelectionKey {
                key: selection_key,
                concrete_type: None,
            }
        };

        map.insert(
            key,
            if let Some(previous_sel) = map.get(&key) {
                merge_selection(Some(previous_sel.clone()), selection, true)
            } else {
                selection
            },
        );
    }
    map
}

fn merge_selection(
    a: Option<TypeSelection>,
    mut b: TypeSelection,
    should_set_conditional: bool,
) -> TypeSelection {
    if let Some(a) = a {
        let both_are_conditional = a.is_conditional() && b.is_conditional();

        let mut new_type_selection = if let TypeSelection::LinkedField(mut lf_a) = a {
            if let TypeSelection::LinkedField(lf_b) = b {
                merge_selection_maps(
                    &mut lf_a.node_selections,
                    lf_b.node_selections,
                    should_set_conditional,
                );
                TypeSelection::LinkedField(lf_a)
            } else {
                panic!("Invalid variants passed to merge_selection linked field a={lf_a:?} b={b:?}")
            }
        } else if let TypeSelection::ScalarField(sf_a) = a {
            if let TypeSelection::ScalarField(_) = b {
                TypeSelection::ScalarField(sf_a)
            } else {
                panic!("Invalid variants passed to merge_selection scalar field a={sf_a:?} b={b:?}")
            }
        } else {
            a
        };

        new_type_selection.set_conditional(both_are_conditional);
        new_type_selection
    } else if should_set_conditional {
        b.set_conditional(true);
        b
    } else {
        b
    }
}

fn merge_selection_maps(
    a: &mut TypeSelectionMap,
    b: TypeSelectionMap,
    should_set_conditional: bool,
) {
    for (key, value) in b {
        let item = a.swap_remove(&key);
        a.insert(key, merge_selection(item, value, should_set_conditional));
    }
}

// TODO: T85950736 Fix these clippy errors
#[allow(clippy::while_let_on_iterator, clippy::useless_conversion)]
fn group_refs(props: impl Iterator<Item = TypeSelection>) -> impl Iterator<Item = TypeSelection> {
    let mut regular_fragment_spreads = None;
    let mut updatable_fragment_spreads = None;
    let mut saw_server_fragment_spread = false;
    let mut emitted_server_fragment = false;
    let mut props = props.into_iter();
    std::iter::from_fn(move || {
        while let Some(prop) = props.next() {
            if let TypeSelection::FragmentSpread(inline_fragment) = prop {
                if inline_fragment.is_updatable_fragment_spread {
                    updatable_fragment_spreads
                        .get_or_insert_with(Vec::new)
                        .push(inline_fragment.fragment_name);
                } else {
                    if inline_fragment.is_server_fragment_spread {
                        saw_server_fragment_spread = true;
                    }
                    regular_fragment_spreads
                        .get_or_insert_with(Vec::new)
                        .push(inline_fragment.fragment_name);
                }
            } else if let TypeSelection::InlineFragment(inline_fragment) = prop {
                regular_fragment_spreads
                    .get_or_insert_with(Vec::new)
                    .push(inline_fragment.fragment_name);
            } else {
                return Some(prop);
            }
        }

        let get_fragment_as_stringkey = |fragment_name: FragmentDefinitionName| fragment_name.0;
        if let Some(refs) = regular_fragment_spreads.take() {
            let refs_as_stringkeys = refs.into_iter().map(get_fragment_as_stringkey).collect();
            return Some(TypeSelection::ScalarField(TypeSelectionScalarField {
                field_name_or_alias: *KEY_FRAGMENT_SPREADS,
                value: AST::FragmentReference(SortedStringKeyList::new(refs_as_stringkeys)),
                special_field: None,
                conditional: false,
                concrete_type: None,
                abstract_type: None,
                is_result_type: false,
            }));
        }
        if saw_server_fragment_spread && !emitted_server_fragment {
            emitted_server_fragment = true;
            return Some(TypeSelection::ScalarField(TypeSelectionScalarField {
                field_name_or_alias: *KEY_SERVER_FRAGMENT,
                value: AST::RawType("true".intern()),
                special_field: None,
                conditional: false,
                concrete_type: None,
                abstract_type: None,
                is_result_type: false,
            }));
        }
        if let Some(refs) = updatable_fragment_spreads.take() {
            let refs_as_stringkeys = refs.into_iter().map(get_fragment_as_stringkey).collect();
            return Some(TypeSelection::ScalarField(TypeSelectionScalarField {
                field_name_or_alias: *KEY_UPDATABLE_FRAGMENT_SPREADS,
                value: AST::FragmentReference(SortedStringKeyList::new(refs_as_stringkeys)),
                special_field: None,
                conditional: false,
                concrete_type: None,
                abstract_type: None,
                is_result_type: false,
            }));
        }
        None
    })
}

fn apply_directive_nullability(
    field: &Field,
    schema_field_directives: &[Directive],
    coerce_to_nullable: bool,
) -> TypeReference<Type> {
    let field_type = match field.directives.named(*SEMANTIC_NON_NULL_DIRECTIVE) {
        Some(_) => field.semantic_type(),
        None => field.type_.clone(),
    };
    apply_required_directive_nullability(&field_type, schema_field_directives, coerce_to_nullable)
}

fn apply_required_directive_nullability(
    field_type: &TypeReference<Type>,
    schema_field_directives: &[Directive],
    coerce_to_nullable: bool,
) -> TypeReference<Type> {
    // We apply bubbling before the field's own @required directive (which may
    // negate the effects of bubbling) because we need handle the case where
    // null can bubble to the _items_ in a plural field which is itself
    // @required.
    let bubbled_type = match schema_field_directives.named(*CHILDREN_CAN_BUBBLE_METADATA_KEY) {
        Some(_) => field_type.with_nullable_item_type(),
        None => field_type.clone(),
    };
    // When putting a match for coerce_to_nullable in the match below - both branches had nullable_type()
    // so the entire match doesn't have to run
    if coerce_to_nullable {
        bubbled_type.nullable_type().clone()
    } else {
        match schema_field_directives.named(RequiredMetadataDirective::directive_name()) {
            Some(_) => bubbled_type.non_null(),
            None => bubbled_type,
        }
    }
}

fn get_type_condition_info(fragment_spread: &FragmentSpread) -> Option<TypeConditionInfo> {
    fragment_spread
          .directives
          .named(*ASSIGNABLE_DIRECTIVE_FOR_TYPEGEN)
          .map(|directive| {
              directive
                  .data
                  .as_ref()
                  .and_then(|data| data.downcast_ref().copied())
                  .expect("If a fragment spread contains an __updatable directive, the associated data should be present and have type TypeConditionInfo")
          })
}

/// Returns the type of the generated query. This is the type parameter that you would have
/// Example:
/// { response: MyQuery$data, variables: MyQuery$variables }
pub(crate) fn get_operation_type_export(
    variables_identifier_key: StringKey,
    response_identifier_key: StringKey,
    raw_response_prop: Option<KeyValuePairProp>,
    is_server_operation: bool,
) -> Result<ExactObject, std::fmt::Error> {
    let mut operation_types = vec![
        Prop::KeyValuePair(KeyValuePairProp {
            key: *VARIABLES,
            read_only: false,
            optional: false,
            value: AST::Identifier(variables_identifier_key),
        }),
        Prop::KeyValuePair(KeyValuePairProp {
            key: *RESPONSE,
            read_only: false,
            optional: false,
            value: AST::Identifier(response_identifier_key),
        }),
    ];
    if let Some(raw_response_prop) = raw_response_prop {
        operation_types.push(raw_response_prop.into());
    }
    if is_server_operation {
        operation_types.push(Prop::KeyValuePair(KeyValuePairProp {
            key: *KEY_SERVER_OPERATION,
            read_only: true,
            optional: false,
            value: AST::RawType("true".intern()),
        }));
    }

    Ok(ExactObject::new(operation_types))
}

fn has_typename_selection(selections: &[TypeSelection]) -> bool {
    selections.iter().any(TypeSelection::is_typename)
}

fn create_edge_to_return_type_ast(
    inner_type: &Type,
    schema: &SDLSchema,
    runtime_imports: &mut RuntimeImports,
) -> AST {
    // Mark that the DataID type is used, and must be imported.
    runtime_imports.data_id_type = true;

    let mut fields = vec![Prop::KeyValuePair(KeyValuePairProp {
        // TODO consider reading the id field from the config. This must be done
        // in conjunction with runtime changes.
        key: *KEY_RESOLVER_ID_FIELD,
        value: AST::RawType(*KEY_DATA_ID),
        read_only: true,
        optional: false,
    })];
    if inner_type.is_abstract_type() && schema.is_extension_type(*inner_type) {
        let get_object_names = |members: &[ObjectID]| {
            members
                .iter()
                .map(|id| schema.object(*id).name.item)
                .collect::<Vec<_>>()
        };
        let mut valid_typenames: Vec<ObjectName> = match inner_type {
            Type::Interface(id) => get_object_names(&schema.interface(*id).implementing_objects),
            Type::Union(id) => get_object_names(&schema.union(*id).members),
            _ => panic!("Unexpected abstract type"),
        };
        valid_typenames.sort();

        fields.push(Prop::KeyValuePair(KeyValuePairProp {
            key: *KEY_TYPENAME,
            value: AST::Union(SortedASTList::new(
                valid_typenames
                    .iter()
                    .map(|x| AST::StringLiteral(StringLiteral(x.0)))
                    .collect(),
            )),
            read_only: true,
            optional: false,
        }))
    }

    AST::ExactObject(ExactObject::new(fields))
}

/// Return-type AST for a READ-IN-PLACE shadow (`@returnFragment`) server-value
/// resolver. The resolver returns the IDENTITY of the transplanted
/// `client:<parentid>:<field>` record so the runtime can read its value in place:
/// `{ +__typename: "<ConcreteType>", +__id: DataID }`. The runtime helper
/// `extractStoreIDFromResponse` reads `response.__id` (falling back to
/// `extractIdFromResponse`) to locate the record.
///
/// This mirrors `create_edge_to_return_type_ast` but keys on `__id`
/// (`KEY_CLIENTID`) instead of the `id` field, and is never an abstract type (a
/// server value type is always a concrete `Object`), so `__typename` is a single
/// concrete string literal. Crucially it does NOT emit a `$normalization` import:
/// no normalization artifact is generated for a read-in-place return, so the
/// import would be a dangling, unresolvable Flow module.
fn create_server_weak_return_type_ast(
    inner_type: &Type,
    schema: &SDLSchema,
    runtime_imports: &mut RuntimeImports,
) -> AST {
    // Mark that the DataID type is used, and must be imported.
    runtime_imports.data_id_type = true;

    let type_name = schema.get_type_name(*inner_type);

    AST::ExactObject(ExactObject::new(vec![
        Prop::KeyValuePair(KeyValuePairProp {
            key: *KEY_TYPENAME,
            value: AST::StringLiteral(StringLiteral(type_name)),
            read_only: true,
            optional: false,
        }),
        Prop::KeyValuePair(KeyValuePairProp {
            key: *KEY_CLIENTID,
            value: AST::RawType(*KEY_DATA_ID),
            read_only: true,
            optional: false,
        }),
    ]))
}

/// The resolver return type for a MIXED interface/union shadow return:
/// `{ +__typename: string, +__id: DataID }`. Mirrors
/// `create_server_weak_return_type_ast` but `__typename` is `string` rather than
/// a single concrete literal — a mixed abstract return has many possible concrete
/// implementor `__typename`s, resolved per read. The runtime reads the inline
/// (weak/value) member in place off `__id` and refetches the Node member via
/// `serverObjectOperations`. Like read-in-place it emits NO `$normalization`
/// import (no normalization artifact is generated for a mixed return).
fn create_abstract_identity_return_type_ast(runtime_imports: &mut RuntimeImports) -> AST {
    // Mark that the DataID type is used, and must be imported.
    runtime_imports.data_id_type = true;

    AST::ExactObject(ExactObject::new(vec![
        Prop::KeyValuePair(KeyValuePairProp {
            key: *KEY_TYPENAME,
            value: AST::String,
            read_only: true,
            optional: false,
        }),
        Prop::KeyValuePair(KeyValuePairProp {
            key: *KEY_CLIENTID,
            value: AST::RawType(*KEY_DATA_ID),
            read_only: true,
            optional: false,
        }),
    ]))
}

/// The resolver return type for a MIXED interface shadow return: an
/// interface implemented by BOTH an `@weak` model AND a non-Node server value
/// type. A single `{__typename, __id}` identity is insufficient — the weak arm
/// needs its `__relay_model_instance` value (which `LiveResolverCache` stores and
/// the weak field resolvers read), while the value arm needs `{__typename, __id}`
/// to be read in place. So emit a DISCRIMINATED UNION, one object per implementor:
/// a weak member as `{ +__typename: "<W>", +__relay_model_instance: <W> }`
/// (referencing the per-object `<W>____relay_model_instance` fragment, mirroring
/// the weak `$normalization` shape), and a value member as `{ +__typename: "<V>",
/// +__id: DataID }` (mirroring `create_server_weak_return_type_ast`). The backing
/// field's `inlineKinds` map tells the runtime which arm is which.
fn create_abstract_mixed_return_type_ast(
    inner_type: &Type,
    typegen_context: &TypegenContext<'_>,
    encountered_fragments: &mut EncounteredFragments,
    runtime_imports: &mut RuntimeImports,
) -> AST {
    // Mark that the DataID type is used, and must be imported.
    runtime_imports.data_id_type = true;

    let id_field_name = typegen_context
        .project_config
        .schema_config
        .node_interface_id_field;
    let kinds = abstract_shadow_return_inline_kinds_by_typename(
        typegen_context.schema,
        *inner_type,
        id_field_name,
    )
    .unwrap_or_default();

    let members: Vec<AST> = kinds
        .into_iter()
        .map(|(type_name, kind)| match kind {
            AbstractInlineKind::WeakModel => {
                let fragment_name = typegen_context
                    .project_config
                    .name
                    .generate_name_for_object_and_field(
                        type_name,
                        *RELAY_RESOLVER_MODEL_INSTANCE_FIELD,
                    )
                    .intern();
                add_fragment_name_to_encountered_fragments(
                    FragmentDefinitionName(fragment_name),
                    encountered_fragments,
                );
                AST::ExactObject(ExactObject::new(vec![
                    Prop::KeyValuePair(KeyValuePairProp {
                        key: *KEY_TYPENAME,
                        value: AST::StringLiteral(StringLiteral(type_name)),
                        read_only: true,
                        optional: false,
                    }),
                    Prop::KeyValuePair(KeyValuePairProp {
                        key: *RELAY_RESOLVER_MODEL_INSTANCE_FIELD,
                        value: AST::PropertyType {
                            type_: get_fragment_data_type(fragment_name),
                            property_name: *RELAY_RESOLVER_MODEL_INSTANCE_FIELD,
                        },
                        read_only: true,
                        optional: false,
                    }),
                ]))
            }
            AbstractInlineKind::ServerWeak => AST::ExactObject(ExactObject::new(vec![
                Prop::KeyValuePair(KeyValuePairProp {
                    key: *KEY_TYPENAME,
                    value: AST::StringLiteral(StringLiteral(type_name)),
                    read_only: true,
                    optional: false,
                }),
                Prop::KeyValuePair(KeyValuePairProp {
                    key: *KEY_CLIENTID,
                    value: AST::RawType(*KEY_DATA_ID),
                    read_only: true,
                    optional: false,
                }),
            ])),
        })
        .collect();

    AST::Union(SortedASTList::new(members))
}

fn expect_scalar_type(
    typegen_context: &TypegenContext<'_>,
    encountered_enums: &mut EncounteredEnums,
    custom_scalars: &mut CustomScalarsImports,
    type_: &Type,
) -> AST {
    match type_ {
        Type::Enum(enum_id) => {
            transform_graphql_enum_type(typegen_context.schema, *enum_id, encountered_enums)
        }
        Type::Scalar(scalar_id) => {
            transform_graphql_scalar_type(typegen_context, *scalar_id, custom_scalars)
        }
        Type::InputObject(_) => panic!("Unexpected input type"),
        Type::Interface(_) | Type::Object(_) | Type::Union(_) => {
            panic!("Expected a scalar type")
        }
    }
}

/// This is a very poorly named function. Also, we **probably** want to panic
/// if the inner type is an enum or scalar, since this function is clearly used for the
/// interface | object | union case.
fn return_ast_in_object_case(
    typegen_context: &TypegenContext<'_>,
    encountered_enums: &mut EncounteredEnums,
    custom_scalars: &mut CustomScalarsImports,
    ast_in_object_case: AST,
    type_: &Type,
) -> AST {
    match type_ {
        Type::Enum(enum_id) => {
            transform_graphql_enum_type(typegen_context.schema, *enum_id, encountered_enums)
        }
        Type::Scalar(scalar_id) => {
            transform_graphql_scalar_type(typegen_context, *scalar_id, custom_scalars)
        }
        Type::InputObject(_) => panic!("Unexpected input type"),
        Type::Interface(_) | Type::Object(_) | Type::Union(_) => ast_in_object_case,
    }
}
