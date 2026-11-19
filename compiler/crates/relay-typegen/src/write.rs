/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

use std::collections::HashSet;
use std::fmt::Result as FmtResult;
use std::path::PathBuf;
use std::sync::LazyLock;

use ::intern::Lookup;
use ::intern::intern;
use ::intern::string_key::Intern;
use ::intern::string_key::StringKey;
use common::DirectiveName;
use common::InputObjectName;
use common::NamedItem;
use graphql_ir::FragmentDefinition;
use graphql_ir::FragmentDefinitionName;
use graphql_ir::OperationDefinition;
use graphql_ir::OperationDefinitionName;
use graphql_ir::ProvidedVariableMetadata;
use graphql_ir::Selection;
use indexmap::IndexMap;
use itertools::Itertools;
use relay_config::CustomTypeImport;
use relay_config::JsModuleFormat;
use relay_config::TypegenLanguage;
use relay_transforms::ASSIGNABLE_DIRECTIVE;
use relay_transforms::CATCH_DIRECTIVE_NAME;
use relay_transforms::CHILDREN_CAN_BUBBLE_METADATA_KEY;
use relay_transforms::RefetchableDerivedFromMetadata;
use relay_transforms::RefetchableMetadata;
use relay_transforms::RelayDirective;
use relay_transforms::SERVER_DIRECTIVE;
use relay_transforms::rsc_fragment_prop_name;
use schema::Schema;

use crate::FUTURE_ENUM_VALUE;
use crate::KEY_CLIENTID;
use crate::KEY_DATA;
use crate::KEY_FRAGMENT_SPREADS;
use crate::KEY_FRAGMENT_TYPE;
use crate::KEY_RAW_RESPONSE;
use crate::KEY_SERVER_FRAGMENT;
use crate::KEY_TYPENAME;
use crate::KEY_UPDATABLE_FRAGMENT_SPREADS;
use crate::MaskStatus;
use crate::RAW_RESPONSE_TYPE_DIRECTIVE_NAME;
use crate::RscResolverSignatureTypeAssertionParams;
use crate::TypegenContext;
use crate::VALIDATOR_EXPORT_NAME;
use crate::typegen_state::EncounteredEnums;
use crate::typegen_state::EncounteredFragment;
use crate::typegen_state::EncounteredFragments;
use crate::typegen_state::ImportedRawResponseTypes;
use crate::typegen_state::ImportedResolverName;
use crate::typegen_state::ImportedResolvers;
use crate::typegen_state::InputObjectTypes;
use crate::typegen_state::MatchFields;
use crate::typegen_state::RuntimeImports;
use crate::visit::get_data_type;
use crate::visit::get_input_variables_type;
use crate::visit::get_operation_type_export;
use crate::visit::has_explicit_catch_to_null;
use crate::visit::is_result_type_directive;
use crate::visit::make_custom_error_import;
use crate::visit::make_result_type;
use crate::visit::raw_response_selections_to_babel;
use crate::visit::raw_response_visit_selections;
use crate::visit::rsc_node_type;
use crate::visit::transform_input_type;
use crate::visit::visit_selections;
use crate::writer::AST;
use crate::writer::DeduplicatedType;
use crate::writer::ExactObject;
use crate::writer::InexactObject;
use crate::writer::KeyValuePairProp;
use crate::writer::Prop;
use crate::writer::SortedASTList;
use crate::writer::SortedStringKeyList;
use crate::writer::StringLiteral;
use crate::writer::Writer;
use crate::writer::deduplicate_raw_response_types;

pub(crate) type CustomScalarsImports = HashSet<(StringKey, PathBuf)>;

const RSC_COMPONENT_TYPE_NAME: &str = "__RelayRscComponent";
const RSC_EXPECTED_ARG_NAMES_TYPE_NAME: &str = "__RelayRscExpectedArgNames";
const RSC_EXPECTED_ARGS_TYPE_NAME: &str = "__RelayRscExpectedArgs";
const RSC_EXPECTED_COMPONENT_TYPE_NAME: &str = "__RelayRscExpectedComponent";
const RSC_EXPECTED_PROPS_TYPE_NAME: &str = "__RelayRscExpectedProps";
const RSC_SIGNATURE_ASSERT_TYPE_NAME: &str = "__RelayRscAssert";
const RSC_SIGNATURE_CHECK_TYPE_NAME: &str = "__RelayRscResolverSignature";

pub(crate) fn write_rsc_resolver_signature_type_assertion(
    typegen_context: &'_ TypegenContext<'_>,
    params: &RscResolverSignatureTypeAssertionParams<'_>,
    writer: &mut Box<dyn Writer>,
) -> FmtResult {
    let signature_artifact_path = typegen_context
        .project_config
        .artifact_path_for_definition(params.signature_definition);
    let component_source_path = PathBuf::from(params.component_import_path.lookup());
    let component_import_path = typegen_context
        .project_config
        .js_module_import_identifier(&signature_artifact_path, &component_source_path);
    let component_import_path = strip_source_extension(component_import_path.lookup());

    let fragment_name = params.root_fragment.name.item;
    let fragment_key_type = format!("{fragment_name}$key");
    let fragment_import_path = fragment_type_import_path(typegen_context, params.root_fragment);
    let fragment_prop_name = rsc_fragment_prop_name(fragment_name);
    let fragment_argument_names: HashSet<StringKey> = params
        .root_fragment
        .variable_definitions
        .iter()
        .map(|definition| definition.name.item.0)
        .collect();

    let mut input_object_types = Default::default();
    let mut encountered_enums = Default::default();
    let mut custom_scalars = CustomScalarsImports::default();
    let runtime_argument_names: Vec<StringKey> = params
        .schema_field
        .arguments
        .iter()
        .filter(|argument| !fragment_argument_names.contains(&argument.name.item.0))
        .map(|argument| argument.name.item.0)
        .collect();
    let has_runtime_arguments = !runtime_argument_names.is_empty();
    let runtime_arguments: Vec<KeyValuePairProp> = params
        .schema_field
        .arguments
        .iter()
        .filter(|argument| !fragment_argument_names.contains(&argument.name.item.0))
        .map(|argument| KeyValuePairProp {
            key: argument.name.item.0,
            value: transform_input_type(
                typegen_context,
                &argument.type_,
                &mut input_object_types,
                &mut encountered_enums,
                &mut custom_scalars,
            ),
            read_only: true,
            optional: !argument.type_.is_non_null() || argument.default_value.is_some(),
        })
        .collect();
    let node_type = rsc_node_type(typegen_context, &mut custom_scalars);
    let return_type = AST::Union(SortedASTList::new(vec![
        node_type.clone(),
        AST::GenericType {
            outer: intern!("Promise"),
            inner: vec![node_type],
        },
    ]));
    let expected_args_type = AST::ExactObject(ExactObject::new(
        runtime_arguments
            .into_iter()
            .map(|mut argument| {
                argument.read_only = false;
                Prop::KeyValuePair(argument)
            })
            .collect(),
    ));
    let expected_props_type = AST::ExactObject(ExactObject::new(vec![
        Prop::KeyValuePair(KeyValuePairProp {
            key: fragment_prop_name,
            value: AST::RawType(fragment_key_type.as_str().intern()),
            read_only: false,
            optional: false,
        }),
        Prop::KeyValuePair(KeyValuePairProp {
            key: intern!("args"),
            value: AST::RawType(RSC_EXPECTED_ARGS_TYPE_NAME.intern()),
            read_only: false,
            optional: false,
        }),
    ]));

    match typegen_context.project_config.typegen_config.language {
        TypegenLanguage::Flow => writeln!(
            writer,
            "import typeof {{{} as {RSC_COMPONENT_TYPE_NAME}}} from \"{component_import_path}\";",
            params.component_export_name,
        )?,
        TypegenLanguage::TypeScript => writeln!(
            writer,
            "type {RSC_COMPONENT_TYPE_NAME} = typeof import(\"{component_import_path}\")[\"{}\"];",
            params.component_export_name,
        )?,
        TypegenLanguage::JavaScript => return Ok(()),
    }
    write_erased_type_import(writer, &fragment_key_type, &fragment_import_path)?;
    write_rsc_signature_enum_definitions(typegen_context, encountered_enums, writer)?;
    write_erased_custom_scalar_imports(custom_scalars, writer)?;
    write_input_object_types(
        input_object_types
            .into_iter()
            .map(|(key, value)| (key, value.unwrap_resolved_type())),
        writer,
    )?;

    write!(writer, "type {RSC_EXPECTED_ARG_NAMES_TYPE_NAME} = ")?;
    if runtime_argument_names.is_empty() {
        // Flow spells the empty type `empty`; it rejects `never`.
        let empty_type = match typegen_context.project_config.typegen_config.language {
            TypegenLanguage::Flow => "empty",
            _ => "never",
        };
        write!(writer, "{empty_type}")?;
    } else {
        writer.write(&AST::Union(SortedASTList::new(
            runtime_argument_names
                .into_iter()
                .map(|name| AST::StringLiteral(StringLiteral(name)))
                .collect(),
        )))?;
    }
    writeln!(writer, ";")?;
    write!(writer, "type {RSC_EXPECTED_ARGS_TYPE_NAME} = ")?;
    if !has_runtime_arguments
        && typegen_context.project_config.typegen_config.language == TypegenLanguage::TypeScript
    {
        // `Record<never, never>` is the genuinely keyless TypeScript callable input shape.
        write!(writer, "Record<never, never>")?;
    } else {
        writer.write(&expected_args_type)?;
    }
    writeln!(writer, ";")?;
    write!(writer, "type {RSC_EXPECTED_PROPS_TYPE_NAME} = ")?;
    writer.write(&expected_props_type)?;
    writeln!(writer, ";")?;
    write!(
        writer,
        "type {RSC_EXPECTED_COMPONENT_TYPE_NAME} = (props: {RSC_EXPECTED_PROPS_TYPE_NAME}) => "
    )?;
    writer.write(&return_type)?;
    writeln!(writer, ";")?;
    writeln!(
        writer,
        "type {RSC_SIGNATURE_ASSERT_TYPE_NAME}<T extends {RSC_EXPECTED_COMPONENT_TYPE_NAME}, Args extends [any], RequiredProps extends keyof Args[0], RequiredArgs extends keyof Args[0][\"args\"], CallableProps extends Args[0]> = T;"
    )?;
    // A component of a field without runtime arguments may leave out `args`.
    let required_props = if has_runtime_arguments {
        format!("keyof {RSC_EXPECTED_PROPS_TYPE_NAME}")
    } else {
        format!("\"{fragment_prop_name}\"")
    };
    writeln!(
        writer,
        "export type {RSC_SIGNATURE_CHECK_TYPE_NAME} = {RSC_SIGNATURE_ASSERT_TYPE_NAME}<{RSC_COMPONENT_TYPE_NAME}, Parameters<{RSC_COMPONENT_TYPE_NAME}>, {required_props}, {RSC_EXPECTED_ARG_NAMES_TYPE_NAME}, {RSC_EXPECTED_PROPS_TYPE_NAME}>;"
    )?;
    Ok(())
}

fn strip_source_extension(path: &str) -> &str {
    path.strip_suffix(".tsx")
        .or_else(|| path.strip_suffix(".ts"))
        .or_else(|| path.strip_suffix(".jsx"))
        .or_else(|| path.strip_suffix(".js"))
        .unwrap_or(path)
}

fn fragment_type_import_path(
    typegen_context: &'_ TypegenContext<'_>,
    fragment: &FragmentDefinition,
) -> String {
    match typegen_context.project_config.js_module_format {
        JsModuleFormat::CommonJS => {
            let signature_artifact_path = typegen_context
                .project_config
                .artifact_path_for_definition(typegen_context.definition_source_location);
            let fragment_artifact_path = typegen_context.project_config.create_path_for_artifact(
                fragment.name.location.source_location(),
                format!("{}.graphql", fragment.name.item),
            );
            let relative_path = typegen_context
                .project_config
                .js_module_import_identifier(&signature_artifact_path, &fragment_artifact_path);
            let relative_path = relative_path.lookup();
            if relative_path.starts_with('.') {
                relative_path.to_string()
            } else {
                format!("./{relative_path}")
            }
        }
        JsModuleFormat::Haste => format!("{}.graphql", fragment.name.item),
    }
}

fn write_erased_type_import(writer: &mut Box<dyn Writer>, name: &str, path: &str) -> FmtResult {
    writer.write_import_type(&[name], path)
}

fn write_erased_custom_scalar_imports(
    custom_scalars: CustomScalarsImports,
    writer: &mut Box<dyn Writer>,
) -> FmtResult {
    for (name, path) in custom_scalars.iter().sorted_by_key(|(key, _)| *key) {
        write_erased_type_import(
            writer,
            name.lookup(),
            path.to_str().expect("valid UTF-8 path"),
        )?;
    }
    Ok(())
}

fn write_rsc_signature_enum_definitions(
    typegen_context: &'_ TypegenContext<'_>,
    encountered_enums: EncounteredEnums,
    writer: &mut Box<dyn Writer>,
) -> FmtResult {
    let enum_ids = encountered_enums.into_sorted_vec(typegen_context.schema);
    let maybe_suffix = &typegen_context
        .project_config
        .typegen_config
        .enum_module_suffix;
    for enum_id in enum_ids {
        let enum_type = typegen_context.schema.enum_(enum_id);
        if !enum_type.is_extension
            && let Some(suffix) = maybe_suffix
        {
            write_erased_type_import(
                writer,
                enum_type.name.item.lookup(),
                &format!("{}{}", enum_type.name.item, suffix),
            )?;
        } else {
            let mut members: Vec<AST> = enum_type
                .values
                .iter()
                .map(|enum_value| AST::StringLiteral(StringLiteral(enum_value.value)))
                .collect();
            if !(enum_type.is_extension
                || typegen_context
                    .project_config
                    .typegen_config
                    .no_future_proof_enums)
            {
                members.push(AST::StringLiteral(StringLiteral(*FUTURE_ENUM_VALUE)));
            }
            writer.write_export_type(
                enum_type.name.item.lookup(),
                &AST::Union(SortedASTList::new(members)),
            )?;
        }
    }
    Ok(())
}

static THROW_ON_FIELD_ERROR_DIRECTIVE: LazyLock<DirectiveName> =
    LazyLock::new(|| DirectiveName("throwOnFieldError".intern()));

pub(crate) fn write_operation_type_exports_section(
    typegen_context: &'_ TypegenContext<'_>,
    typegen_operation: &OperationDefinition,
    normalization_operation: &OperationDefinition,
    writer: &mut Box<dyn Writer>,
    maybe_provided_variables_object: Option<String>,
) -> FmtResult {
    let mut encountered_enums = Default::default();
    let mut encountered_fragments = Default::default();
    let mut imported_resolvers = Default::default();
    let mut runtime_imports = RuntimeImports::default();
    let mut custom_error_import = None;
    let mut custom_scalars = CustomScalarsImports::default();
    let mut input_object_types = Default::default();
    let mut imported_raw_response_types = Default::default();

    let is_throw_on_field_error = typegen_operation
        .directives
        .named(*THROW_ON_FIELD_ERROR_DIRECTIVE)
        .is_some();

    let is_catch = typegen_operation
        .directives
        .named(*CATCH_DIRECTIVE_NAME)
        .is_some();

    let type_selections = visit_selections(
        typegen_context,
        &typegen_operation.selections,
        &mut input_object_types,
        &mut encountered_enums,
        &mut imported_raw_response_types,
        &mut encountered_fragments,
        &mut imported_resolvers,
        &mut custom_scalars,
        &mut runtime_imports,
        &mut custom_error_import,
        None,
        is_throw_on_field_error || is_catch,
    );

    let emit_optional_type = typegen_operation
        .directives
        .named(*CHILDREN_CAN_BUBBLE_METADATA_KEY)
        .is_some();

    let coerce_to_nullable = has_explicit_catch_to_null(&typegen_operation.directives);

    let mut data_type = get_data_type(
        typegen_context,
        &typegen_operation.type_,
        type_selections.into_iter(),
        MaskStatus::Masked, // Queries are never unmasked
        None,
        emit_optional_type || coerce_to_nullable,
        false, // Query types can never be plural
        &mut encountered_enums,
        &mut encountered_fragments,
        &mut custom_scalars,
        &mut runtime_imports,
        &mut custom_error_import,
    );

    if is_result_type_directive(&typegen_operation.directives) {
        data_type = make_result_type(typegen_context, data_type);
        runtime_imports.result_type = true;
        match make_custom_error_import(typegen_context, &mut custom_error_import) {
            Ok(_) => {}
            Err(e) => {
                panic!("Error while generating custom error type: {e}");
            }
        }
    }

    let raw_response_type_and_match_fields =
        if has_raw_response_type_directive(normalization_operation) {
            let mut match_fields = Default::default();
            let root_concrete_type = (!normalization_operation.type_.is_abstract_type())
                .then_some(normalization_operation.type_);
            let raw_response_selections = raw_response_visit_selections(
                typegen_context,
                normalization_operation.name.item,
                &normalization_operation.selections,
                &mut encountered_enums,
                &mut match_fields,
                &mut encountered_fragments,
                &mut imported_raw_response_types,
                &mut runtime_imports,
                &mut custom_scalars,
                root_concrete_type,
                is_throw_on_field_error,
            );
            let raw_response_type = raw_response_selections_to_babel(
                typegen_context,
                normalization_operation.name.item,
                raw_response_selections.into_iter(),
                root_concrete_type,
                &mut encountered_enums,
                &mut runtime_imports,
                &mut custom_scalars,
            );
            let deduplicated_types = maybe_deduplicate_raw_response_types(
                typegen_context,
                normalization_operation.name.item,
                raw_response_type,
                match_fields,
            );
            Some(deduplicated_types)
        } else {
            None
        };

    let refetchable_fragment_name =
        RefetchableDerivedFromMetadata::find(&typegen_operation.directives);
    if refetchable_fragment_name.is_some() {
        runtime_imports.generic_fragment_type = true;
    }

    // Always include 'FragmentRef' for typescript codegen for operations that have fragment spreads
    if typegen_context.project_config.typegen_config.language == TypegenLanguage::TypeScript
        && has_fragment_spread(&typegen_operation.selections)
    {
        runtime_imports.generic_fragment_type = true;
    }

    runtime_imports.write_runtime_imports(writer)?;
    write_fragment_imports(typegen_context, None, encountered_fragments, writer)?;
    if custom_error_import.is_some() {
        write_import_custom_type(custom_error_import, writer)?;
    }

    write_relay_resolver_imports(imported_resolvers, writer)?;

    write_split_raw_response_type_imports(typegen_context, imported_raw_response_types, writer)?;

    let mut input_object_types = IndexMap::default();
    let expected_provided_variables_type = generate_provided_variables_type(
        typegen_context,
        normalization_operation,
        &mut input_object_types,
        &mut encountered_enums,
        &mut custom_scalars,
    );

    let input_variables_type = get_input_variables_type(
        typegen_context,
        typegen_operation,
        &mut input_object_types,
        &mut encountered_enums,
        &mut custom_scalars,
    );
    let input_object_types = input_object_types
        .into_iter()
        .map(|(key, val)| (key, val.unwrap_resolved_type()));

    write_enum_definitions(typegen_context, encountered_enums, writer)?;
    write_custom_scalar_imports(custom_scalars, writer)?;
    write_input_object_types(input_object_types, writer)?;

    let variables_identifier = format!("{}$variables", typegen_operation.name.item.0);
    let variables_identifier_key = variables_identifier.as_str().intern();

    writer.write_export_type(&variables_identifier, &input_variables_type.into())?;

    let response_identifier = format!("{}$data", typegen_operation.name.item.0);
    let response_identifier_key = response_identifier.as_str().intern();
    writer.write_export_type(&response_identifier, &data_type)?;

    let raw_response_prop = write_raw_response_and_get_raw_response_prop(
        raw_response_type_and_match_fields,
        writer,
        typegen_operation,
    )?;
    let query_wrapper_type = get_operation_type_export(
        variables_identifier_key,
        response_identifier_key,
        raw_response_prop,
        typegen_operation
            .directives
            .named(*SERVER_DIRECTIVE)
            .is_some(),
    )?;
    writer.write_export_type(
        typegen_operation.name.item.0.lookup(),
        &query_wrapper_type.into(),
    )?;

    if let Some(provided_variables_type) = expected_provided_variables_type {
        let actual_provided_variables_object = maybe_provided_variables_object.unwrap_or_else(|| {
             panic!("Expected the provided variables object. If you see this error, it most likley a bug in the compiler.");
     });

        // Assert that expected type of provided variables matches
        // the flow/typescript types of functions with providers.
        writer.write_type_assertion(
            actual_provided_variables_object.as_str(),
            &provided_variables_type,
        )?;
    }

    Ok(())
}

fn write_raw_response_and_get_raw_response_prop(
    raw_response_type_and_match_fields: Option<(DeduplicatedType, MatchFields)>,
    writer: &mut Box<dyn Writer>,
    typegen_operation: &OperationDefinition,
) -> Result<Option<KeyValuePairProp>, std::fmt::Error> {
    if let Some((raw_response_type, match_fields)) = raw_response_type_and_match_fields {
        for (key, ast) in match_fields.0 {
            writer.write_export_type(key.lookup(), &ast)?;
        }
        for (name, ast) in raw_response_type.aliases {
            writer.write_type_definition(name.lookup(), &ast)?;
        }
        let raw_response_identifier = format!("{}$rawResponse", typegen_operation.name.item.0);
        writer.write_export_type(&raw_response_identifier, &raw_response_type.type_)?;

        Ok(Some(KeyValuePairProp {
            key: *KEY_RAW_RESPONSE,
            read_only: false,
            optional: false,
            value: AST::Identifier(raw_response_identifier.intern()),
        }))
    } else {
        Ok(None)
    }
}

pub(crate) fn write_split_operation_type_exports_section(
    typegen_context: &'_ TypegenContext<'_>,
    typegen_operation: &OperationDefinition,
    normalization_operation: &OperationDefinition,
    writer: &mut Box<dyn Writer>,
) -> FmtResult {
    let mut encountered_enums = Default::default();
    let mut match_fields = Default::default();
    let mut encountered_fragments = Default::default();
    let mut imported_raw_response_types = Default::default();
    let mut runtime_imports = RuntimeImports::default();
    let mut custom_scalars = CustomScalarsImports::default();

    let is_throw_on_field_error = typegen_operation
        .directives
        .named(*THROW_ON_FIELD_ERROR_DIRECTIVE)
        .is_some();

    let root_concrete_type = (!normalization_operation.type_.is_abstract_type())
        .then_some(normalization_operation.type_);

    let raw_response_selections = raw_response_visit_selections(
        typegen_context,
        normalization_operation.name.item,
        &normalization_operation.selections,
        &mut encountered_enums,
        &mut match_fields,
        &mut encountered_fragments,
        &mut imported_raw_response_types,
        &mut runtime_imports,
        &mut custom_scalars,
        root_concrete_type,
        is_throw_on_field_error,
    );
    let raw_response_type = raw_response_selections_to_babel(
        typegen_context,
        normalization_operation.name.item,
        raw_response_selections.into_iter(),
        root_concrete_type,
        &mut encountered_enums,
        &mut runtime_imports,
        &mut custom_scalars,
    );
    let (raw_response_type, match_fields) = maybe_deduplicate_raw_response_types(
        typegen_context,
        normalization_operation.name.item,
        raw_response_type,
        match_fields,
    );

    runtime_imports.write_runtime_imports(writer)?;
    write_fragment_imports(typegen_context, None, encountered_fragments, writer)?;
    write_split_raw_response_type_imports(typegen_context, imported_raw_response_types, writer)?;

    write_enum_definitions(typegen_context, encountered_enums, writer)?;
    write_custom_scalar_imports(custom_scalars, writer)?;

    for (key, ast) in match_fields.0 {
        writer.write_export_type(key.lookup(), &ast)?;
    }
    for (name, ast) in raw_response_type.aliases {
        writer.write_type_definition(name.lookup(), &ast)?;
    }

    writer.write_export_type(
        typegen_operation.name.item.0.lookup(),
        &raw_response_type.type_,
    )?;

    Ok(())
}

fn maybe_deduplicate_raw_response_types(
    typegen_context: &'_ TypegenContext<'_>,
    operation_name: OperationDefinitionName,
    raw_response_type: AST,
    match_fields: MatchFields,
) -> (DeduplicatedType, MatchFields) {
    if typegen_context.project_config.typegen_config.language == TypegenLanguage::Flow
        && typegen_context
            .project_config
            .feature_flags
            .dedupe_common_structures_in_raw_response_types
            .is_enabled_for(operation_name.0)
        && !typegen_context
            .project_config
            .feature_flags
            .disable_deduping_common_structures_in_raw_response_types
            .is_enabled_for(operation_name.0)
    {
        let match_fields = match_fields.0.into_iter().collect_vec();
        let raw_response_types = match_fields
            .iter()
            .map(|(_, type_)| type_)
            .chain(std::iter::once(&raw_response_type))
            .collect_vec();
        let deduplicated = deduplicate_raw_response_types(&raw_response_types, operation_name.0);
        let mut deduplicated_types = deduplicated.types.into_iter();
        let match_fields = MatchFields(
            match_fields
                .into_iter()
                .map(|(name, _)| {
                    let type_ = deduplicated_types
                        .next()
                        .expect("should return one deduplicated type per match field");
                    (name, type_)
                })
                .collect(),
        );
        let raw_response_type = deduplicated_types
            .next()
            .expect("should return the deduplicated raw response type");
        debug_assert!(deduplicated_types.next().is_none());

        (
            DeduplicatedType {
                type_: raw_response_type,
                aliases: deduplicated.aliases,
            },
            match_fields,
        )
    } else {
        (
            DeduplicatedType {
                type_: raw_response_type,
                aliases: Vec::new(),
            },
            match_fields,
        )
    }
}

pub(crate) fn write_fragment_type_exports_section(
    typegen_context: &'_ TypegenContext<'_>,
    fragment_definition: &FragmentDefinition,
    writer: &mut Box<dyn Writer>,
) -> FmtResult {
    // Assignable fragments do not require $data and $ref type exports, and their aliases
    let is_assignable_fragment = fragment_definition
        .directives
        .named(*ASSIGNABLE_DIRECTIVE)
        .is_some();

    let is_throw_on_field_error = fragment_definition
        .directives
        .named(*THROW_ON_FIELD_ERROR_DIRECTIVE)
        .is_some();
    let is_catch = fragment_definition
        .directives
        .named(*CATCH_DIRECTIVE_NAME)
        .is_some();

    let mut encountered_enums = Default::default();
    let mut encountered_fragments = Default::default();
    let mut imported_resolvers = Default::default();
    let mut custom_scalars = CustomScalarsImports::default();
    let mut input_object_types = Default::default();
    let mut runtime_imports = RuntimeImports {
        generic_fragment_type: true,
        ..Default::default()
    };
    let mut custom_error_import: Option<CustomTypeImport> = None;
    let mut imported_raw_response_types = Default::default();

    let mut type_selections = visit_selections(
        typegen_context,
        &fragment_definition.selections,
        &mut input_object_types,
        &mut encountered_enums,
        &mut imported_raw_response_types,
        &mut encountered_fragments,
        &mut imported_resolvers,
        &mut custom_scalars,
        &mut runtime_imports,
        &mut custom_error_import,
        None,
        is_throw_on_field_error || is_catch,
    );
    if !fragment_definition.type_condition.is_abstract_type() {
        let num_concrete_selections = type_selections
            .iter()
            .filter(|sel| sel.get_enclosing_concrete_type().is_some())
            .count();
        if num_concrete_selections <= 1 {
            for selection in type_selections.iter_mut().filter(|sel| sel.is_typename()) {
                selection.set_concrete_type(fragment_definition.type_condition);
            }
        }
    }

    let data_type = fragment_definition.name.item;
    let data_type_name = format!("{data_type}$data");

    let ref_type_data_property = Prop::KeyValuePair(KeyValuePairProp {
        key: *KEY_DATA,
        optional: true,
        read_only: true,
        value: AST::Identifier(data_type_name.as_str().intern()),
    });
    let fragment_name = fragment_definition.name.item.0;
    let ref_type_fragment_spreads_property = Prop::KeyValuePair(KeyValuePairProp {
        key: if typegen_context.generating_updatable_types {
            *KEY_UPDATABLE_FRAGMENT_SPREADS
        } else {
            *KEY_FRAGMENT_SPREADS
        },
        optional: false,
        read_only: true,
        value: AST::FragmentReference(SortedStringKeyList::new(vec![fragment_name])),
    });
    let mut ref_type_props = vec![ref_type_data_property, ref_type_fragment_spreads_property];
    if fragment_definition
        .directives
        .named(*SERVER_DIRECTIVE)
        .is_some()
    {
        ref_type_props.push(Prop::KeyValuePair(KeyValuePairProp {
            key: *KEY_SERVER_FRAGMENT,
            optional: false,
            read_only: true,
            value: AST::RawType("true".intern()),
        }));
    }
    let is_plural_fragment = is_plural(fragment_definition);
    let mut ref_type = AST::InexactObject(InexactObject::new(ref_type_props));
    if is_plural_fragment {
        ref_type = AST::ReadOnlyArray(Box::new(ref_type));
    }

    let mask_status = if RelayDirective::is_unmasked_fragment_definition(fragment_definition) {
        MaskStatus::Unmasked
    } else {
        MaskStatus::Masked
    };

    let coerce_to_nullable = has_explicit_catch_to_null(&fragment_definition.directives);
    let required_can_bubble = fragment_definition
        .directives
        .named(*CHILDREN_CAN_BUBBLE_METADATA_KEY)
        .is_some();

    let mut data_type = get_data_type(
        typegen_context,
        &fragment_definition.type_condition,
        type_selections.into_iter(),
        mask_status,
        if mask_status == MaskStatus::Unmasked {
            None
        } else {
            Some(fragment_name)
        },
        required_can_bubble || coerce_to_nullable,
        is_plural_fragment,
        &mut encountered_enums,
        &mut encountered_fragments,
        &mut custom_scalars,
        &mut runtime_imports,
        &mut custom_error_import,
    );

    if is_result_type_directive(&fragment_definition.directives) {
        data_type = make_result_type(typegen_context, data_type);
        runtime_imports.result_type = true;
        match make_custom_error_import(typegen_context, &mut custom_error_import) {
            Ok(_) => {}
            Err(e) => {
                panic!("Error while generating custom error type: {e}");
            }
        }
    }

    let input_object_types = input_object_types
        .into_iter()
        .map(|(key, val)| (key, val.unwrap_resolved_type()));

    write_input_object_types(input_object_types, writer)?;
    write_fragment_imports(
        typegen_context,
        Some(fragment_definition.name.item),
        encountered_fragments,
        writer,
    )?;
    write_split_raw_response_type_imports(typegen_context, imported_raw_response_types, writer)?;

    write_enum_definitions(typegen_context, encountered_enums, writer)?;
    write_custom_scalar_imports(custom_scalars, writer)?;

    runtime_imports.write_runtime_imports(writer)?;

    write_relay_resolver_imports(imported_resolvers, writer)?;

    let refetchable_metadata = RefetchableMetadata::find(&fragment_definition.directives);
    let fragment_type_name = format!("{fragment_name}$fragmentType");
    writer.write_export_fragment_type(&fragment_type_name)?;
    if let Some(refetchable_metadata) = refetchable_metadata {
        let variables_name = format!("{}$variables", refetchable_metadata.operation_name);
        match typegen_context.project_config.js_module_format {
            JsModuleFormat::CommonJS => {
                if typegen_context.has_unified_output {
                    writer.write_import_fragment_type(
                        &[&variables_name],
                        &format!("./{}.graphql", refetchable_metadata.operation_name),
                    )?;
                } else {
                    writer.write_any_type_definition(&variables_name)?;
                }
            }
            JsModuleFormat::Haste => {
                writer.write_import_fragment_type(
                    &[&variables_name],
                    &format!("{}.graphql", refetchable_metadata.operation_name),
                )?;
            }
        }
        let edges_name = format!("{fragment_name}__edges$data");
        if refetchable_metadata.is_prefetchable_pagination {
            match typegen_context.project_config.js_module_format {
                JsModuleFormat::CommonJS => {
                    if typegen_context.has_unified_output {
                        writer.write_import_fragment_type(
                            &[&edges_name],
                            &format!("./{fragment_name}__edges.graphql"),
                        )?;
                    } else {
                        writer.write_any_type_definition(&edges_name)?;
                    }
                }
                JsModuleFormat::Haste => {
                    writer.write_import_fragment_type(
                        &[&edges_name],
                        &format!("{fragment_name}__edges.graphql"),
                    )?;
                }
            }
        }
    }

    if !is_assignable_fragment {
        writer.write_export_type(&data_type_name, &data_type)?;
        writer.write_export_type(&format!("{}$key", fragment_definition.name.item), &ref_type)?;
    } else if typegen_context
        .typegen_options
        .is_extra_artifact_branch_module
    {
        writer.write_export_type(&data_type_name, &data_type)?;
    }

    Ok(())
}

fn write_import_custom_type(
    custom_type_import: Option<CustomTypeImport>,
    writer: &mut Box<dyn Writer>,
) -> FmtResult {
    match custom_type_import {
        Some(custom_type_import) => {
            let names = &[custom_type_import.name.lookup()];
            let path = &custom_type_import.path.to_str();
            match path {
                Some(path) => writer.write_import_type(names, path),
                _ => Ok(()),
            }
        }
        _ => Ok(()),
    }
}

fn write_fragment_imports(
    typegen_context: &'_ TypegenContext<'_>,
    fragment_name_to_skip: Option<FragmentDefinitionName>,
    encountered_fragments: EncounteredFragments,
    writer: &mut Box<dyn Writer>,
) -> FmtResult {
    for current_referenced_fragment in encountered_fragments.0.into_iter().sorted() {
        let (current_referenced_fragment, fragment_type_name) = match current_referenced_fragment {
            EncounteredFragment::Key(current_referenced_fragment) => (
                current_referenced_fragment,
                format!("{current_referenced_fragment}$key"),
            ),
            EncounteredFragment::Spread(current_referenced_fragment) => (
                current_referenced_fragment,
                format!("{current_referenced_fragment}$fragmentType"),
            ),
            EncounteredFragment::Data(current_referenced_fragment) => (
                current_referenced_fragment,
                format!("{current_referenced_fragment}$data"),
            ),
        };

        let should_skip_writing_current_referenced_fragment =
            fragment_name_to_skip == Some(current_referenced_fragment);
        if should_skip_writing_current_referenced_fragment {
            continue;
        }

        match typegen_context.project_config.js_module_format {
            JsModuleFormat::CommonJS => {
                if typegen_context.has_unified_output {
                    writer.write_import_fragment_type(
                        &[&fragment_type_name],
                        &format!("./{current_referenced_fragment}.graphql"),
                    )?;
                } else {
                    let fragment_location = typegen_context
                        .fragment_locations
                        .location(&current_referenced_fragment)
                        .unwrap_or_else(|| {
                            panic!("Expected location for fragment {current_referenced_fragment}.")
                        });

                    let fragment_import_path =
                        typegen_context.project_config.js_module_import_identifier(
                            &typegen_context.project_config.artifact_path_for_definition(
                                typegen_context.definition_source_location,
                            ),
                            &typegen_context.project_config.create_path_for_artifact(
                                fragment_location.source_location(),
                                current_referenced_fragment.to_string(),
                            ),
                        );

                    writer.write_import_fragment_type(
                        &[&fragment_type_name],
                        &format!("./{fragment_import_path}.graphql"),
                    )?;
                }
            }
            JsModuleFormat::Haste => {
                writer.write_import_fragment_type(
                    &[&fragment_type_name],
                    &format!("{current_referenced_fragment}.graphql"),
                )?;
            }
        }
    }
    Ok(())
}

fn write_relay_resolver_imports(
    mut imported_resolvers: ImportedResolvers,
    writer: &mut Box<dyn Writer>,
) -> FmtResult {
    imported_resolvers.0.sort_keys();

    // Context import will be the same for each resolver, so this flag is used to ensure it is only written once
    let mut live_resolver_context_import_written = false;

    for resolver in imported_resolvers.0.values() {
        match resolver.resolver_name {
            ImportedResolverName::Default(name) => {
                writer.write_import_module_default(name.lookup(), resolver.import_path.lookup())?;
            }
            ImportedResolverName::Named { name, import_as } => {
                writer.write_import_module_named(
                    name.lookup(),
                    Some(import_as.lookup()),
                    resolver.import_path.lookup(),
                )?;
            }
        }

        if let Some(ref live_resolver_context_import) = resolver.context_import
            && !live_resolver_context_import_written
        {
            writer.write_import_type(
                &[live_resolver_context_import.name.lookup()],
                live_resolver_context_import.import_path.lookup(),
            )?;
            live_resolver_context_import_written = true;
        }

        if let Some(resolver_type) = &resolver.resolver_type
            && let AST::AssertFunctionType(_) = resolver_type
        {
            writer.write(resolver_type)?;
        }
    }
    Ok(())
}

fn write_split_raw_response_type_imports(
    typegen_context: &'_ TypegenContext<'_>,
    mut imported_raw_response_types: ImportedRawResponseTypes,
    writer: &mut Box<dyn Writer>,
) -> FmtResult {
    if imported_raw_response_types.0.is_empty() {
        return Ok(());
    }

    imported_raw_response_types.0.sort_keys();
    for (imported_raw_response_type, imported_raw_response_document_location) in
        imported_raw_response_types.0
    {
        match typegen_context.project_config.js_module_format {
            JsModuleFormat::CommonJS => {
                if typegen_context.has_unified_output {
                    writer.write_import_type(
                        &[imported_raw_response_type.lookup()],
                        &format!("./{imported_raw_response_type}.graphql"),
                    )?;
                } else {
                    let artifact_import_path =
                        typegen_context.project_config.js_module_import_identifier(
                            &typegen_context.project_config.artifact_path_for_definition(
                                typegen_context.definition_source_location,
                            ),
                            &typegen_context.project_config.create_path_for_artifact(
                                imported_raw_response_document_location.source_location(),
                                imported_raw_response_type.to_string(),
                            ),
                        );

                    writer.write_import_type(
                        &[imported_raw_response_type.lookup()],
                        &format!("./{artifact_import_path}.graphql"),
                    )?;
                }
            }
            JsModuleFormat::Haste => {
                writer.write_import_type(
                    &[imported_raw_response_type.lookup()],
                    &format!("{imported_raw_response_type}.graphql"),
                )?;
            }
        }
    }

    Ok(())
}

fn write_enum_definitions(
    typegen_context: &'_ TypegenContext<'_>,
    encountered_enums: EncounteredEnums,
    writer: &mut Box<dyn Writer>,
) -> FmtResult {
    let enum_ids = encountered_enums.into_sorted_vec(typegen_context.schema);
    let maybe_suffix = &typegen_context
        .project_config
        .typegen_config
        .enum_module_suffix;
    for enum_id in enum_ids {
        let enum_type = typegen_context.schema.enum_(enum_id);
        if !enum_type.is_extension && maybe_suffix.is_some() {
            // We can't chain `if let` statements, so we need to unwrap here.
            let suffix = maybe_suffix.as_ref().unwrap();
            writer.write_import_type(
                &[enum_type.name.item.lookup()],
                &format!("{}{}", enum_type.name.item, suffix),
            )?;
        } else {
            let mut members: Vec<AST> = enum_type
                .values
                .iter()
                .map(|enum_value| AST::StringLiteral(StringLiteral(enum_value.value)))
                .collect();

            // Users can specify a config option to disable the inclusion of
            // FUTURE_ENUM_VALUE in the enum union. Additionally we want to avoid
            // emitting FUTURE_ENUM_VALUE if the enum is actually defined on the
            // client. For example in Client Schema Extensions or (some day)
            // Relay Resolvers.
            //
            // In the case of a client defined enum, we don't need to enforce
            // the breaking change semantics dictated by the GraphQL spec
            // because new fields added to the client schema will simply result
            // in fixable Flow/TypeScript errors elsewhere in the codebase.
            if !(enum_type.is_extension
                || typegen_context
                    .project_config
                    .typegen_config
                    .no_future_proof_enums)
            {
                members.push(AST::StringLiteral(StringLiteral(*FUTURE_ENUM_VALUE)));
            }

            writer.write_export_type(
                enum_type.name.item.lookup(),
                &AST::Union(SortedASTList::new(members)),
            )?;
        }
    }
    Ok(())
}

fn generate_provided_variables_type(
    typegen_context: &'_ TypegenContext<'_>,
    node: &OperationDefinition,
    input_object_types: &mut InputObjectTypes,
    encountered_enums: &mut EncounteredEnums,
    custom_scalars: &mut CustomScalarsImports,
) -> Option<AST> {
    let fields = node
        .variable_definitions
        .iter()
        .filter_map(|def| {
            def.directives
                .named(ProvidedVariableMetadata::directive_name())?;

            let provider_func = AST::Callable(Box::new(transform_input_type(
                typegen_context,
                &def.type_,
                input_object_types,
                encountered_enums,
                custom_scalars,
            )));
            let provider_module = Prop::KeyValuePair(KeyValuePairProp {
                key: "get".intern(),
                read_only: true,
                optional: false,
                value: provider_func,
            });
            Some(Prop::KeyValuePair(KeyValuePairProp {
                key: def.name.item.0,
                read_only: true,
                optional: false,
                value: AST::ExactObject(ExactObject::new(vec![provider_module])),
            }))
        })
        .collect_vec();
    if !fields.is_empty() {
        Some(AST::ExactObject(ExactObject::new(fields)))
    } else {
        None
    }
}

fn write_input_object_types(
    input_object_types: impl Iterator<Item = (InputObjectName, AST)>,
    writer: &mut Box<dyn Writer>,
) -> FmtResult {
    for (type_identifier, input_object_type) in input_object_types {
        writer.write_export_type(type_identifier.lookup(), &input_object_type)?;
    }
    Ok(())
}

/// Write the assignable fragment validator function.
///
/// Validators accept an item which *may* be valid for assignment and returns either
/// a sentinel value or something which is necessarily valid for assignment.
///
/// The types of the validator:
///
/// - For fragments whose type condition is abstract:
///   ({ __id: string, __isFragmentName: ?string, $fragmentSpreads: FragmentRefType }) =>
///   ({ __id: string, __isFragmentName: string, $fragmentSpreads: FragmentRefType })
///   | false
///
/// - For fragments whose type condition is concrete:
///   ({ __id: string, __typename: string, $fragmentSpreads: FragmentRefType }) =>
///   ({ __id: string, __typename: FragmentType, $fragmentSpreads: FragmentRefType })
///   | false
///
/// Validators' runtime behavior checks for the presence of the __isFragmentName marker
/// (for abstract fragment types) or a matching concrete type (for concrete fragment
/// types), and returns false iff the parameter didn't pass.
/// Validators return the parameter (unmodified) if it did pass validation, but with
/// a changed flowtype.
pub(crate) fn write_validator_function(
    typegen_context: &'_ TypegenContext<'_>,
    fragment_definition: &FragmentDefinition,
    writer: &mut Box<dyn Writer>,
) -> FmtResult {
    if fragment_definition.type_condition.is_abstract_type() {
        write_abstract_validator_function(
            typegen_context.project_config.typegen_config.language,
            fragment_definition,
            writer,
        )
    } else {
        write_concrete_validator_function(typegen_context, fragment_definition, writer)
    }
}

/// Write an abstract validator function. Flow example:
/// function validate(value/*: {
///   +__id: string,
///   +$fragmentSpreads: Assignable_node$fragmentType,
///   +__isAssignable_node: ?string,
///   ...
/// }*/)/*: ({
///   +__id: string,
///   +$fragmentSpreads: Assignable_node$fragmentType,
///   +__isAssignable_node: string,
///   ...
/// } | false)*/ {
///   return value.__isAssignable_node != null ? (value/*: any*/) : null
/// };
fn write_abstract_validator_function(
    language: TypegenLanguage,
    fragment_definition: &FragmentDefinition,
    writer: &mut Box<dyn Writer>,
) -> FmtResult {
    let fragment_name = fragment_definition.name.item.0.lookup();
    let abstract_fragment_spread_marker = format!("__is{fragment_name}").intern();
    let id_prop = Prop::KeyValuePair(KeyValuePairProp {
        key: *KEY_CLIENTID,
        value: AST::String,
        read_only: true,
        optional: false,
    });
    let fragment_spread_prop = Prop::KeyValuePair(KeyValuePairProp {
        key: *KEY_FRAGMENT_SPREADS,
        value: AST::Identifier(format!("{}{}", fragment_name, *KEY_FRAGMENT_TYPE).intern()),
        read_only: true,
        optional: false,
    });
    let parameter_discriminator = Prop::KeyValuePair(KeyValuePairProp {
        key: abstract_fragment_spread_marker,
        value: AST::String,
        read_only: true,
        optional: true,
    });
    let return_value_discriminator = Prop::KeyValuePair(KeyValuePairProp {
        key: abstract_fragment_spread_marker,
        value: AST::String,
        read_only: true,
        optional: false,
    });

    let parameter_type = AST::InexactObject(InexactObject::new(vec![
        id_prop.clone(),
        fragment_spread_prop.clone(),
        parameter_discriminator,
    ]));
    let return_type = AST::Union(SortedASTList::new(vec![
        AST::InexactObject(InexactObject::new(vec![
            id_prop,
            fragment_spread_prop,
            return_value_discriminator,
        ])),
        AST::RawType(intern!("false")),
    ]));

    let (open_comment, close_comment) = match language {
        TypegenLanguage::Flow | TypegenLanguage::JavaScript => ("/*", "*/"),
        TypegenLanguage::TypeScript => ("", ""),
    };

    write!(
        writer,
        "function {}(value{}: ",
        VALIDATOR_EXPORT_NAME, open_comment
    )?;

    writer.write(&parameter_type)?;
    write!(writer, "{}){}: ", close_comment, open_comment)?;
    writer.write(&return_type)?;
    write!(
        writer,
        "{} {{\n  return value.{} != null ? ",
        close_comment,
        abstract_fragment_spread_marker.lookup(),
    )?;

    match language {
        TypegenLanguage::Flow | TypegenLanguage::JavaScript => {
            write!(writer, "(value{}:: as ", open_comment)?;
            writer.write(&AST::Any)?;
            write!(writer, "{}) ", close_comment)?;
        }
        TypegenLanguage::TypeScript => {
            write!(writer, "value ")?;
        }
    }

    write!(writer, ": false;\n}}")?;

    Ok(())
}

/// Write a concrete validator function. Flow example:
/// function validate(value/*: {
///   +__id: string,
///   +$fragmentSpreads: Assignable_user$fragmentType,
///   +__typename: ?string,
///   ...
/// }*/)/*: ({
///   +__id: string,
///   +$fragmentSpreads: Assignable_user$fragmentType,
///   +__typename: 'User',
///   ...
/// } | false)*/ {
///   return value.__typename === 'User' ? (value/*:: as any*/) : null
/// };
fn write_concrete_validator_function(
    typegen_context: &'_ TypegenContext<'_>,
    fragment_definition: &FragmentDefinition,
    writer: &mut Box<dyn Writer>,
) -> FmtResult {
    let fragment_name = fragment_definition.name.item.0.lookup();
    let concrete_typename = typegen_context
        .schema
        .get_type_name(fragment_definition.type_condition);
    let id_prop = Prop::KeyValuePair(KeyValuePairProp {
        key: *KEY_CLIENTID,
        value: AST::String,
        read_only: true,
        optional: false,
    });
    let fragment_spread_prop = Prop::KeyValuePair(KeyValuePairProp {
        key: *KEY_FRAGMENT_SPREADS,
        value: AST::Identifier(format!("{}{}", fragment_name, *KEY_FRAGMENT_TYPE).intern()),
        read_only: true,
        optional: false,
    });
    let parameter_discriminator = Prop::KeyValuePair(KeyValuePairProp {
        key: *KEY_TYPENAME,
        value: AST::String,
        read_only: true,
        optional: false,
    });
    let return_value_discriminator = Prop::KeyValuePair(KeyValuePairProp {
        key: *KEY_TYPENAME,
        value: AST::StringLiteral(StringLiteral(concrete_typename)),
        read_only: true,
        optional: false,
    });

    let parameter_type = AST::InexactObject(InexactObject::new(vec![
        id_prop.clone(),
        fragment_spread_prop.clone(),
        parameter_discriminator,
    ]));
    let return_type = AST::Union(SortedASTList::new(vec![
        AST::InexactObject(InexactObject::new(vec![
            id_prop,
            fragment_spread_prop,
            return_value_discriminator,
        ])),
        AST::RawType(intern!("false")),
    ]));

    let typegen_language = typegen_context.project_config.typegen_config.language;
    let (open_comment, close_comment) = match typegen_language {
        TypegenLanguage::Flow | TypegenLanguage::JavaScript => ("/*", "*/"),
        TypegenLanguage::TypeScript => ("", ""),
    };

    write!(
        writer,
        "function {}(value{}: ",
        VALIDATOR_EXPORT_NAME, open_comment
    )?;
    writer.write(&parameter_type)?;
    write!(writer, "{}){}: ", close_comment, open_comment)?;
    writer.write(&return_type)?;
    write!(
        writer,
        "{} {{\n  return value.{} === '{}' ? ",
        close_comment,
        KEY_TYPENAME.lookup(),
        concrete_typename.lookup()
    )?;

    match typegen_language {
        TypegenLanguage::Flow | TypegenLanguage::JavaScript => {
            write!(writer, "(value{}:: as ", open_comment)?;
            writer.write(&AST::Any)?;
            write!(writer, "{}) ", close_comment)?;
        }
        TypegenLanguage::TypeScript => {
            write!(writer, "value ")?;
        }
    }

    write!(writer, ": false;\n}}")?;

    Ok(())
}

fn is_plural(node: &FragmentDefinition) -> bool {
    RelayDirective::find(&node.directives).is_some_and(|relay_directive| relay_directive.plural)
}

fn has_fragment_spread(selections: &[Selection]) -> bool {
    selections.iter().any(|selection| match selection {
        Selection::FragmentSpread(_) => true,
        Selection::Condition(condition) => has_fragment_spread(&condition.selections),
        Selection::LinkedField(linked_field) => has_fragment_spread(&linked_field.selections),
        Selection::InlineFragment(inline_fragment) => {
            has_fragment_spread(&inline_fragment.selections)
        }
        Selection::ScalarField(_) => false,
    })
}

pub fn has_raw_response_type_directive(operation: &OperationDefinition) -> bool {
    operation
        .directives
        .named(*RAW_RESPONSE_TYPE_DIRECTIVE_NAME)
        .is_some()
}

fn write_custom_scalar_imports(
    custom_scalars: CustomScalarsImports,
    writer: &mut Box<dyn Writer>,
) -> FmtResult {
    for (name, path) in custom_scalars.iter().sorted_by_key(|(key, _)| *key) {
        writer.write_import_type(&[name.lookup()], path.to_str().unwrap())?
    }

    Ok(())
}
