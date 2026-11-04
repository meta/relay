/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

use std::collections::HashSet;

use common::ArgumentName;
use common::Diagnostic;
use common::DirectiveName;
use common::PerfLogEvent;
use common::SourceLocationKey;
use common::sync::ParallelIterator;
use dependency_analyzer::get_reachable_ir;
use fnv::FnvHashMap;
use fnv::FnvHashSet;
use graphql_ir::ConstantValue;
use graphql_ir::ExecutableDefinition as IrExecutableDefinition;
use graphql_ir::ExecutableDefinitionName;
use graphql_ir::FragmentDefinitionName;
use graphql_ir::OperationDefinitionName;
use graphql_ir::Value;
use graphql_syntax::ExecutableDefinition;
use graphql_text_printer::print_executable_definition_ast;
use intern::Lookup;
use intern::string_key::Intern;
use intern::string_key::StringKey;
use md5::Digest;
use md5::Md5;
use rayon::prelude::*;
use relay_transforms::annotate_resolver_root_fragments;
use schema::SDLSchema;

use super::BuildMode;
use super::ProjectAsts;
use crate::config::ProjectConfig;

pub struct BuildIRResult {
    pub ir: Vec<graphql_ir::ExecutableDefinition>,
    pub source_hashes: SourceHashes,
}

/// Map fragments and queries definition names to the md5 of they printed source
pub struct SourceHashes(FnvHashMap<ExecutableDefinitionName, String>);

impl SourceHashes {
    /// Compute MD5 hashes for definitions. When `filter` is `Some`, skips
    /// the expensive print + MD5 step for definitions whose names are not
    /// in the set (used by incremental builds).
    pub fn from_definitions(
        definitions: &[ExecutableDefinition],
        filter: Option<&FnvHashSet<StringKey>>,
    ) -> Self {
        let hash_one = |ast: &ExecutableDefinition| {
            let name = ast.name()?;
            if let Some(f) = filter
                && !f.contains(&name)
            {
                return None;
            }
            let key = match ast {
                ExecutableDefinition::Operation(_) => OperationDefinitionName(name).into(),
                ExecutableDefinition::Fragment(_) => FragmentDefinitionName(name).into(),
            };
            Some((key, md5(&print_executable_definition_ast(ast))))
        };
        let source_hashes: FnvHashMap<_, _> = if definitions.len() > 500 {
            definitions.par_iter().filter_map(hash_one).collect()
        } else {
            definitions.iter().filter_map(hash_one).collect()
        };
        Self(source_hashes)
    }

    pub fn get(&self, k: &ExecutableDefinitionName) -> Option<&String> {
        self.0.get(k)
    }
}

pub fn build_ir(
    project_config: &ProjectConfig,
    project_asts: ProjectAsts,
    schema: &SDLSchema,
    build_mode: BuildMode,
    log_event: &impl PerfLogEvent,
) -> Result<BuildIRResult, Vec<Diagnostic>> {
    let asts = project_asts.definitions;
    let is_full_build = matches!(build_mode, BuildMode::Full);

    let mut ir = graphql_ir::build_ir_in_relay_mode(schema, &asts, &project_config.feature_flags)?;
    if project_config.resolvers_schema_module.is_some() {
        ir = annotate_resolver_root_fragments(schema, ir);
    }
    let client_edge_closure = (!is_full_build
        && (project_config
            .feature_flags
            .enable_exec_time_resolvers_directive
            || has_exec_time_resolver_context(&ir)))
    .then_some(project_asts.removed_spread_names);
    let definition_count = ir.len();
    let affected_ir: Vec<graphql_ir::ExecutableDefinition> = match build_mode {
        BuildMode::Incremental => get_reachable_ir(
            ir,
            project_asts.base_definition_names,
            project_asts.changed_names,
            schema,
            HashSet::default(),
            log_event,
            client_edge_closure,
        ),
        BuildMode::IncrementalWithSchemaChanges(changes) => get_reachable_ir(
            ir,
            project_asts.base_definition_names,
            project_asts.changed_names,
            schema,
            changes,
            log_event,
            client_edge_closure,
        ),
        BuildMode::Full => ir,
    };

    if !is_full_build {
        log_event.number("definition_count", definition_count);
        log_event.number("affected_definition_count", affected_ir.len());
    }

    let source_hashes = if is_full_build {
        SourceHashes::from_definitions(&asts, None)
    } else {
        let affected_names: FnvHashSet<StringKey> = affected_ir
            .iter()
            .map(|def| def.name_with_location().item)
            .collect();
        SourceHashes::from_definitions(&asts, Some(&affected_names))
    };

    Ok(BuildIRResult {
        ir: affected_ir,
        source_hashes,
    })
}

fn has_exec_time_resolver_context(definitions: &[IrExecutableDefinition]) -> bool {
    let exec_time = DirectiveName("exec_time_resolvers".intern());
    let refetchable = DirectiveName("refetchable".intern());
    let directives_argument = ArgumentName("directives".intern());
    definitions.iter().any(|definition| {
        definition.has_directive(exec_time)
            || definition
                .directives()
                .iter()
                .filter(|directive| directive.name.item == refetchable)
                .flat_map(|directive| &directive.arguments)
                .filter(|argument| argument.name.item == directives_argument)
                .any(|argument| match &argument.value.item {
                    Value::Constant(ConstantValue::List(values)) => values.iter().any(|value| {
                        let ConstantValue::String(source) = value else {
                            return false;
                        };
                        graphql_syntax::parse_directive(
                            source.lookup(),
                            SourceLocationKey::generated(),
                            0,
                        )
                        .is_ok_and(|directive| directive.name.value == exec_time.0)
                    }),
                    _ => false,
                })
    })
}

fn md5(data: &str) -> String {
    let mut md5 = Md5::new();
    md5.update(data);
    hex::encode(md5.finalize())
}
