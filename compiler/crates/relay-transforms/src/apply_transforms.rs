/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

use std::sync::Arc;

use common::DiagnosticsResult;
use common::DirectiveName;
use common::PerfLogEvent;
use common::PerfLogger;
use common::sync::try_join;
use graphql_ir::FragmentDefinitionNameSet;
use graphql_ir::Program;
use raw_text::set_raw_text;
use relay_config::ProjectConfig;
use validate_operation_variables::ValidateVariablesOptions;

use super::*;
use crate::apply_custom_transforms::CustomTransformsConfig;
use crate::apply_custom_transforms::apply_after_custom_transforms;
use crate::apply_custom_transforms::apply_before_custom_transforms;
use crate::assignable_fragment_spread::annotate_updatable_fragment_spreads;
use crate::assignable_fragment_spread::replace_updatable_fragment_spreads;
use crate::client_extensions_abstract_types::client_extensions_abstract_types;
use crate::disallow_non_node_id_fields;
use crate::generate_relay_resolvers_model_fragments::generate_relay_resolvers_model_fragments;
use crate::generate_relay_resolvers_operations_for_nested_objects::generate_relay_resolvers_operations_for_nested_objects;
use crate::generate_relay_resolvers_root_fragment_split_operation::generate_relay_resolvers_root_fragment_split_operation;
use crate::match_::hash_supported_argument;
use crate::relay_resolvers_abstract_types::relay_resolvers_abstract_types;
use crate::server_documents::annotate_server_fragment_spreads;
use crate::server_documents::validate_server_documents;
use crate::server_documents::validate_server_operation_incremental_delivery;
use crate::skip_updatable_queries::skip_updatable_queries;

#[derive(Debug, Clone)]
pub struct Programs {
    pub source: Arc<Program>,
    pub reader: Arc<Program>,
    pub normalization: Arc<Program>,
    pub operation_text: Arc<Program>,
    pub typegen: Arc<Program>,
}

pub fn apply_transforms<TPerfLogger>(
    project_config: &ProjectConfig,
    program: Arc<Program>,
    base_fragment_names: Arc<FragmentDefinitionNameSet>,
    perf_logger: Arc<TPerfLogger>,
    print_stats: Option<fn(extra_info: &str, program: &Program) -> ()>,
    custom_transforms_config: Option<&CustomTransformsConfig>,
    transferrable_refetchable_query_directives: Vec<DirectiveName>,
) -> DiagnosticsResult<Programs>
where
    TPerfLogger: PerfLogger + 'static,
{
    // The execution pipeline is as follows, where items at the same indentation
    // can be computed independently and therefore in parallel:
    // |- common
    //    |- reader
    //    |- operation
    //       |- normalization
    //       |- operation_text
    // |- typegen
    //
    // NOTE: try_join(f1, f2) prefers the errors from f1 over f2, so process the normalization
    // program first since it is likely to include more errors (both per-fragment and
    // whole-operation errors) than the reader_program which just includes per-fragment errors.
    let (((normalization_program, text_program), reader_program), typegen_program) = try_join(
        || {
            let common_program = apply_common_transforms(
                project_config,
                Arc::clone(&program),
                Arc::clone(&base_fragment_names),
                Arc::clone(&perf_logger),
                custom_transforms_config,
                transferrable_refetchable_query_directives.clone(),
            )?;

            try_join(
                || {
                    let operation_program = apply_operation_transforms(
                        project_config,
                        Arc::clone(&common_program),
                        Arc::clone(&base_fragment_names),
                        Arc::clone(&perf_logger),
                        custom_transforms_config,
                    )?;

                    try_join(
                        || {
                            apply_normalization_transforms(
                                project_config,
                                Arc::clone(&operation_program),
                                Arc::clone(&base_fragment_names),
                                Arc::clone(&perf_logger),
                                print_stats,
                                custom_transforms_config,
                            )
                        },
                        || {
                            apply_operation_text_transforms(
                                project_config,
                                Arc::clone(&operation_program),
                                Arc::clone(&base_fragment_names),
                                Arc::clone(&perf_logger),
                                custom_transforms_config,
                            )
                        },
                    )
                },
                || {
                    apply_reader_transforms(
                        project_config,
                        Arc::clone(&common_program),
                        Arc::clone(&base_fragment_names),
                        Arc::clone(&perf_logger),
                        custom_transforms_config,
                    )
                },
            )
        },
        || {
            apply_typegen_transforms(
                project_config,
                Arc::clone(&program),
                Arc::clone(&base_fragment_names),
                Arc::clone(&perf_logger),
                custom_transforms_config,
                transferrable_refetchable_query_directives.clone(),
            )
        },
    )?;

    Ok(Programs {
        source: program,
        reader: reader_program,
        normalization: normalization_program,
        operation_text: text_program,
        typegen: typegen_program,
    })
}

/// Applies transforms that apply to every output.
fn apply_common_transforms(
    project_config: &ProjectConfig,
    program: Arc<Program>,
    base_fragment_names: Arc<FragmentDefinitionNameSet>,
    perf_logger: Arc<impl PerfLogger>,
    custom_transforms_config: Option<&CustomTransformsConfig>,
    transferrable_refetchable_query_directives: Vec<DirectiveName>,
) -> DiagnosticsResult<Arc<Program>> {
    let log_event = perf_logger.create_event("apply_common_transforms");
    log_event.string("project", project_config.name.to_string());

    // raw_text stores the operation text before transforms and should be executed first
    let mut program = log_event.time("raw_text", || set_raw_text(&program))?;

    let custom_transforms = custom_transforms_config.and_then(|c| c.common_transforms.as_ref());
    program = apply_before_custom_transforms(
        &program,
        custom_transforms,
        project_config,
        &base_fragment_names,
        &log_event,
        None,
    )?;

    program = log_event.time("fragment_alias_directive", || {
        fragment_alias_directive(
            &program,
            &project_config
                .feature_flags
                .enforce_fragment_alias_where_ambiguous,
        )
    })?;

    log_event.time("validate_server_documents", || {
        validate_server_documents(&program, project_config.relay_rsc_capabilities().is_some())
    })?;
    log_event.time("validate_server_operation_incremental_delivery", || {
        validate_server_operation_incremental_delivery(
            &program,
            &project_config.schema_config.defer_stream_interface,
            project_config
                .relay_rsc_capabilities()
                .is_none_or(|capabilities| capabilities.allow_incremental_delivery),
            &base_fragment_names,
        )
    })?;
    program = log_event.time("transform_connections", || {
        transform_connections(
            &program,
            &project_config.schema_config.connection_interface,
            &project_config.schema_config.defer_stream_interface,
            false,
        )
    });
    program = log_event.time("mask", || mask(&program));
    program = log_event.time("transform_defer_stream", || {
        transform_defer_stream(
            &program,
            &project_config.schema_config.defer_stream_interface,
        )
    })?;
    // Must run after transform_defer_stream: it copies selections into one inline
    // fragment per implementor, and each copy of an authored @defer or @stream must
    // keep the single label assigned to it.
    program = log_event.time("relay_resolvers_abstract_types", || {
        relay_resolvers_abstract_types(&program, &project_config.feature_flags)
    })?;
    program = log_event.time("transform_match", || {
        transform_match(
            &program,
            &project_config.feature_flags,
            project_config.effective_module_import_config(),
            project_config.schema_config.defer_stream_interface,
        )
    })?;
    program = log_event.time("transform_subscriptions", || {
        transform_subscriptions(&program)
    })?;
    program = log_event.time("transform_refetchable_fragment", || {
        transform_refetchable_fragment(
            &program,
            project_config,
            &base_fragment_names,
            false,
            transferrable_refetchable_query_directives,
        )
    })?;

    program = log_event.time("infer_client_component_boundaries", || {
        infer_client_component_boundaries(
            &program,
            &project_config.feature_flags.no_inline,
            &base_fragment_names,
        )
    })?;

    program = log_event.time("lower_rsc_resolver_fields", || {
        lower_rsc_resolver_fields(
            &program,
            &base_fragment_names,
            project_config.relay_rsc_capabilities().is_some(),
            project_config
                .effective_module_import_config()
                .dynamic_module_provider
                .is_some(),
        )
    })?;

    program = log_event.time("provided_variable_fragment_transform", || {
        provided_variable_fragment_transform(&program)
    })?;

    program = log_event.time("generate_relay_resolvers_model_fragments", || {
        generate_relay_resolvers_model_fragments(
            project_config.name,
            &program,
            &project_config.schema_config,
        )
    });

    program = log_event.time(
        "generate_relay_resolvers_operations_for_nested_objects",
        || {
            generate_relay_resolvers_operations_for_nested_objects(
                project_config.name,
                &program,
                &project_config.schema_config,
            )
        },
    )?;

    program = apply_after_custom_transforms(
        &program,
        custom_transforms,
        project_config,
        &base_fragment_names,
        &log_event,
        None,
    )?;

    log_event.complete();

    Ok(Arc::new(program))
}

/// Applies transforms only for generated reader code.
/// Corresponds to the "fragment transforms" in the JS compiler.
fn apply_reader_transforms(
    project_config: &ProjectConfig,
    program: Arc<Program>,
    base_fragment_names: Arc<FragmentDefinitionNameSet>,
    perf_logger: Arc<impl PerfLogger>,
    custom_transforms_config: Option<&CustomTransformsConfig>,
) -> DiagnosticsResult<Arc<Program>> {
    let log_event = perf_logger.create_event("apply_reader_transforms");
    log_event.string("project", project_config.name.to_string());

    let custom_transforms = custom_transforms_config.and_then(|c| c.reader_transforms.as_ref());
    let mut program = apply_before_custom_transforms(
        &program,
        custom_transforms,
        project_config,
        &base_fragment_names,
        &log_event,
        None,
    )?;

    program = log_event.time("required_directive", || {
        required_directive(&program, &project_config.feature_flags)
    })?;

    program = log_event.time("catch_directive", || catch_directive(&program))?;

    program = log_event.time("client_edges", || {
        client_edges(&program, project_config, &base_fragment_names, false, false)
    })?;

    program = log_event.time("relay_resolvers", || {
        relay_resolvers(
            project_config.name,
            &program,
            &project_config.feature_flags,
            ResolversPipeline::ForReader,
            project_config.schema_config.node_interface_id_field,
        )
    })?;

    program = log_event.time("client_extensions", || client_extensions(&program));
    program = log_event.time("handle_field_transform", || {
        handle_field_transform(&program)
    });

    program = log_event.time(
        "transform_assignable_fragment_spreads_in_regular_queries",
        || transform_assignable_fragment_spreads_in_regular_queries(&program),
    )?;

    program = log_event.time("inline_data_fragment", || inline_data_fragment(&program))?;
    program = log_event.time("skip_unreachable_node", || {
        skip_unreachable_node_strict(
            &program,
            project_config.schema_config.defer_stream_interface,
        )
    })?;
    program = log_event.time("remove_base_fragments", || {
        remove_base_fragments(&program, &base_fragment_names)
    });

    log_event.time("flatten", || flatten(&mut program, true, false))?;
    program = log_event.time("skip_redundant_nodes", || {
        skip_redundant_nodes(
            &program,
            project_config.schema_config.defer_stream_interface,
        )
    });
    program = log_event.time("generate_data_driven_dependency_metadata", || {
        generate_data_driven_dependency_metadata(&program)
    });
    program = log_event.time("hash_supported_argument", || {
        hash_supported_argument(&program)
    })?;

    program = apply_after_custom_transforms(
        &program,
        custom_transforms,
        project_config,
        &base_fragment_names,
        &log_event,
        None,
    )?;

    log_event.complete();

    Ok(Arc::new(program))
}

/// Applies transforms that apply to all operation artifacts.
/// Corresponds to the "query transforms" in the JS compiler.
fn apply_operation_transforms(
    project_config: &ProjectConfig,
    program: Arc<Program>,
    base_fragment_names: Arc<FragmentDefinitionNameSet>,
    perf_logger: Arc<impl PerfLogger>,
    custom_transforms_config: Option<&CustomTransformsConfig>,
) -> DiagnosticsResult<Arc<Program>> {
    let log_event = perf_logger.create_event("apply_operation_transforms");
    log_event.string("project", project_config.name.to_string());

    let custom_transforms = custom_transforms_config.and_then(|c| c.operation_transforms.as_ref());
    let mut program = apply_before_custom_transforms(
        &program,
        custom_transforms,
        project_config,
        &base_fragment_names,
        &log_event,
        None,
    )?;

    program = log_event.time("remove_aliased_inline_fragments", || {
        remove_aliased_inline_fragments(&program)
    });

    program = log_event.time("skip_updatable_queries", || {
        skip_updatable_queries(&program)
    });

    program = log_event.time("client_edges", || {
        client_edges(&program, project_config, &base_fragment_names, true, false)
    })?;

    program = log_event.time("relay_resolvers", || {
        relay_resolvers(
            project_config.name,
            &program,
            &project_config.feature_flags,
            ResolversPipeline::ForOperation,
            project_config.schema_config.node_interface_id_field,
        )
    })?;

    if project_config.resolvers_schema_module.is_some() {
        program = log_event.time(
            "generate_relay_resolvers_root_fragment_split_operation",
            || generate_relay_resolvers_root_fragment_split_operation(&program),
        )?;
    }

    program = log_event.time("split_module_import", || {
        split_module_import(&program, &base_fragment_names)
    });
    program = log_event.time("generate_id_field", || {
        generate_id_field(&program, &project_config.schema_config)
    });
    program = log_event.time("declarative_connection", || {
        transform_declarative_connection(
            &program,
            &project_config.schema_config.connection_interface,
            &project_config.feature_flags,
        )
    })?;

    program = log_event.time("generate_live_query_metadata", || {
        generate_live_query_metadata(&program)
    })?;

    if project_config.schema_config.non_node_id_fields.is_some() {
        log_event.time("disallow_non_node_id_fields", || {
            disallow_non_node_id_fields(&program, &project_config.schema_config)
        })?;
    }

    program = apply_after_custom_transforms(
        &program,
        custom_transforms,
        project_config,
        &base_fragment_names,
        &log_event,
        None,
    )?;

    log_event.complete();

    Ok(Arc::new(program))
}

/// After the operation transforms, this applies further transforms that only
/// apply to the generated normalization code.
///
/// Corresponds to the "codegen transforms" in the JS compiler
fn apply_normalization_transforms(
    project_config: &ProjectConfig,
    program: Arc<Program>,
    base_fragment_names: Arc<FragmentDefinitionNameSet>,
    perf_logger: Arc<impl PerfLogger>,
    maybe_print_stats: Option<fn(extra_info: &str, program: &Program) -> ()>,
    custom_transforms_config: Option<&CustomTransformsConfig>,
) -> DiagnosticsResult<Arc<Program>> {
    let log_event = perf_logger.create_event("apply_normalization_transforms");
    log_event.string("project", project_config.name.to_string());
    if let Some(print_stats) = maybe_print_stats {
        print_stats("normalization start", &program);
    }

    // Its fragments, of a base project too, before they are inlined.
    let fragments_program = Arc::clone(&program);
    let custom_transforms =
        custom_transforms_config.and_then(|c| c.normalization_transforms.as_ref());
    let mut program = apply_before_custom_transforms(
        &program,
        custom_transforms,
        project_config,
        &base_fragment_names,
        &log_event,
        maybe_print_stats,
    )?;

    program = log_event.time("apply_fragment_arguments", || {
        apply_fragment_arguments(
            &program,
            true,
            &project_config.feature_flags.no_inline,
            &base_fragment_names,
        )
    })?;

    if let Some(print_stats) = maybe_print_stats {
        print_stats("apply_fragment_arguments", &program);
    }

    program = log_event.time("client_extensions_abstract_types", || {
        client_extensions_abstract_types(&program)
    });

    if let Some(print_stats) = maybe_print_stats {
        print_stats("client_extensions_abstract_types", &program);
    }

    program = log_event.time("replace_updatable_fragment_spreads", || {
        replace_updatable_fragment_spreads(&program)
    });

    program = log_event.time("hash_supported_argument", || {
        hash_supported_argument(&program)
    })?;
    if let Some(print_stats) = maybe_print_stats {
        print_stats("hash_supported_argument", &program);
    }

    program = log_event.time("skip_unreachable_node", || {
        skip_unreachable_node_strict(
            &program,
            project_config.schema_config.defer_stream_interface,
        )
    })?;
    if let Some(print_stats) = maybe_print_stats {
        print_stats("skip_unreachable_node", &program);
    }

    // Before `inline_fragments`, which inlines client boundaries.
    program = log_event.time("generate_server_operation_handoffs", || {
        generate_server_operation_handoffs(&program, &fragments_program)
    })?;

    program = log_event.time("inline_fragments", || {
        inline_fragments(
            &program,
            &project_config
                .feature_flags
                .skip_impossible_inline_fragments,
        )
    });
    if let Some(print_stats) = maybe_print_stats {
        print_stats("inline_fragments", &program);
    }

    program = log_event.time("client_extensions", || client_extensions(&program));
    if let Some(print_stats) = maybe_print_stats {
        print_stats("client_extensions", &program);
    }

    program = log_event.time("generate_typename", || generate_typename(&program, true));
    if let Some(print_stats) = maybe_print_stats {
        print_stats("generate_typename", &program);
    }

    log_event.time("flatten", || flatten(&mut program, true, false))?;
    if let Some(print_stats) = maybe_print_stats {
        print_stats("flatten", &program);
    }

    program = log_event.time("skip_redundant_nodes", || {
        skip_redundant_nodes(
            &program,
            project_config.schema_config.defer_stream_interface,
        )
    });
    if let Some(print_stats) = maybe_print_stats {
        print_stats("skip_redundant_nodes", &program);
    }

    program = log_event.time("generate_test_operation_metadata", || {
        generate_test_operation_metadata(&program, project_config.test_path_regex.as_ref())
    })?;
    if let Some(print_stats) = maybe_print_stats {
        print_stats("generate_test_operation_metadata", &program);
    }

    program = apply_after_custom_transforms(
        &program,
        custom_transforms,
        project_config,
        &base_fragment_names,
        &log_event,
        maybe_print_stats,
    )?;

    log_event.complete();

    Ok(Arc::new(program))
}

/// After the operation transforms, this applies further transforms that only
/// apply to the printed operation text.
///
/// Corresponds to the "print transforms" in the JS compiler
fn apply_operation_text_transforms(
    project_config: &ProjectConfig,
    program: Arc<Program>,
    base_fragment_names: Arc<FragmentDefinitionNameSet>,
    perf_logger: Arc<impl PerfLogger>,
    custom_transforms_config: Option<&CustomTransformsConfig>,
) -> DiagnosticsResult<Arc<Program>> {
    let log_event = perf_logger.create_event("apply_operation_text_transforms");
    log_event.string("project", project_config.name.to_string());

    let custom_transforms =
        custom_transforms_config.and_then(|c| c.operation_text_transforms.as_ref());
    let mut program = apply_before_custom_transforms(
        &program,
        custom_transforms,
        project_config,
        &base_fragment_names,
        &log_event,
        None,
    )?;

    program = log_event.time("apply_fragment_arguments", || {
        apply_fragment_arguments(
            &program,
            false,
            &project_config.feature_flags.no_inline,
            &base_fragment_names,
        )
    })?;

    log_event.time("validate_global_variables", || {
        validate_global_variables(&program)
    })?;

    program = log_event.time("remove_client_edge_selections", || {
        remove_client_edge_selections(&program)
    })?;

    program = log_event.time("replace_updatable_fragment_spreads", || {
        replace_updatable_fragment_spreads(&program)
    });

    program = log_event.time("skip_split_operation", || skip_split_operation(&program));
    program = log_event.time("skip_unreachable_node_strict", || {
        skip_unreachable_node_strict(
            &program,
            project_config.schema_config.defer_stream_interface,
        )
    })?;
    program = log_event.time("skip_null_arguments_transform", || {
        skip_null_arguments_transform(&program)
    });
    log_event.time("validate_selection_conflict", || {
        graphql_ir_validations::validate_selection_conflict::<RelayLocationAgnosticBehavior>(
            &program,
            project_config,
            true,
        )
    })?;
    program = log_event.time("skip_client_extensions", || {
        skip_client_extensions(&program)
    });
    program = log_event.time("skip_unreachable_node_loose", || {
        skip_unreachable_node_loose(
            &program,
            project_config.schema_config.defer_stream_interface,
        )
    });

    program = log_event.time("generate_typename", || generate_typename(&program, false));
    log_event.time("flatten", || flatten(&mut program, false, true))?;
    program = log_event.time("validate_operation_variables", || {
        validate_operation_variables(
            &program,
            ValidateVariablesOptions {
                remove_unused_variables: true,
            },
        )
    })?;
    program = log_event.time("skip_client_directives", || {
        skip_client_directives(&program)
    });
    log_event.time("validate_required_arguments", || {
        validate_required_arguments(&program)
    })?;
    program = log_event.time("unwrap_custom_directive_selection", || {
        unwrap_custom_directive_selection(
            &program,
            project_config.schema_config.defer_stream_interface,
        )
    });

    program = apply_after_custom_transforms(
        &program,
        custom_transforms,
        project_config,
        &base_fragment_names,
        &log_event,
        None,
    )?;

    log_event.complete();

    Ok(Arc::new(program))
}

fn apply_typegen_transforms(
    project_config: &ProjectConfig,
    program: Arc<Program>,
    base_fragment_names: Arc<FragmentDefinitionNameSet>,
    perf_logger: Arc<impl PerfLogger>,
    custom_transforms_config: Option<&CustomTransformsConfig>,
    transferrable_refetchable_query_directives: Vec<DirectiveName>,
) -> DiagnosticsResult<Arc<Program>> {
    let log_event = perf_logger.create_event("apply_typegen_transforms");
    log_event.string("project", project_config.name.to_string());

    let custom_transforms = custom_transforms_config.and_then(|c| c.typegen_transforms.as_ref());
    let mut program = apply_before_custom_transforms(
        &program,
        custom_transforms,
        project_config,
        &base_fragment_names,
        &log_event,
        None,
    )?;

    program = log_event.time("fragment_alias_directive", || {
        fragment_alias_directive(
            &program,
            &project_config
                .feature_flags
                .enforce_fragment_alias_where_ambiguous,
        )
    })?;

    // Split edge fragment for prefetchable pagination
    program = log_event.time("transform_connections_typegen", || {
        transform_connections(
            &program,
            &project_config.schema_config.connection_interface,
            &project_config.schema_config.defer_stream_interface,
            true,
        )
    });

    program = log_event.time("mask", || mask(&program));
    program = log_event.time("transform_match", || {
        transform_match(
            &program,
            &project_config.feature_flags,
            project_config.effective_module_import_config(),
            project_config.schema_config.defer_stream_interface,
        )
    })?;
    program = log_event.time("transform_subscriptions", || {
        transform_subscriptions(&program)
    })?;
    program = log_event.time("required_directive", || {
        required_directive(&program, &project_config.feature_flags)
    })?;
    program = log_event.time("catch_directive", || catch_directive(&program))?;
    program = log_event.time("generate_relay_resolvers_model_fragments", || {
        generate_relay_resolvers_model_fragments(
            project_config.name,
            &program,
            &project_config.schema_config,
        )
    });

    program = log_event.time(
        "generate_relay_resolvers_operations_for_nested_objects",
        || {
            generate_relay_resolvers_operations_for_nested_objects(
                project_config.name,
                &program,
                &project_config.schema_config,
            )
        },
    )?;

    program = log_event.time(
        "transform_assignable_fragment_spreads_in_regular_queries",
        || transform_assignable_fragment_spreads_in_regular_queries(&program),
    )?;
    program = log_event.time(
        "transform_assignable_fragment_spreads_in_updatable_queries",
        || transform_assignable_fragment_spreads_in_updatable_queries(&program),
    );
    program = log_event.time("annotate_updatable_fragment_spreads", || {
        annotate_updatable_fragment_spreads(&program)
    });

    program = log_event.time("client_edges", || {
        client_edges(&program, project_config, &base_fragment_names, false, true)
    })?;

    program = log_event.time("relay_resolvers", || {
        relay_resolvers(
            project_config.name,
            &program,
            &project_config.feature_flags,
            ResolversPipeline::ForReader,
            project_config.schema_config.node_interface_id_field,
        )
    })?;

    log_event.time("flatten", || flatten(&mut program, false, false))?;
    program = log_event.time("transform_refetchable_fragment", || {
        transform_refetchable_fragment(
            &program,
            project_config,
            &base_fragment_names,
            true,
            transferrable_refetchable_query_directives,
        )
    })?;
    program = log_event.time("annotate_server_fragment_spreads", || {
        annotate_server_fragment_spreads(&program)
    });
    program = log_event.time("remove_base_fragments", || {
        remove_base_fragments(&program, &base_fragment_names)
    });

    program = log_event.time("generate_typename_union", || {
        generate_typename_union(
            &program,
            &project_config
                .feature_flags
                .enable_typename_discriminated_unions,
        )
    });

    program = apply_after_custom_transforms(
        &program,
        custom_transforms,
        project_config,
        &base_fragment_names,
        &log_event,
        None,
    )?;

    log_event.complete();

    Ok(Arc::new(program))
}
