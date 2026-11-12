/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

//! `$__relay_exec_time` is true while the document's operation runs at exec
//! time: a selection under `@include(if: $__relay_exec_time)` is fetched and
//! read only then. The compiler declares it in every operation that reaches it:
//! `true` for an operation that always runs at exec time, the operation's own
//! `enabledProvider` (read when the operation's variables are built) when it
//! has one, and `false` for an operation that runs at read time. The name is
//! reserved: a document that declares or passes it could claim exec time for
//! an operation that runs at read time.

use std::sync::Arc;
use std::sync::LazyLock;

use common::Diagnostic;
use common::DiagnosticsResult;
use common::FeatureFlags;
use common::NamedItem;
use common::WithLocation;
use graphql_ir::ConstantValue;
use graphql_ir::Directive;
use graphql_ir::FragmentSpread;
use graphql_ir::OperationDefinition;
use graphql_ir::Program;
use graphql_ir::ProvidedVariableMetadata;
use graphql_ir::VariableDefinition;
use graphql_ir::VariableName;
use graphql_ir::Visitor;
use intern::string_key::Intern;
use intern::string_key::StringKey;
use schema::Schema;
use schema::TypeReference;

use crate::EXEC_TIME_RESOLVERS_DIRECTIVE_NAME;
use crate::EXEC_TIME_RESOLVERS_ENABLED_PROVIDER_ARG;
use crate::RefetchableDerivedFromMetadata;
use crate::ValidationMessage;
use crate::root_variables::InferVariablesVisitor;

pub static EXEC_TIME_VARIABLE_NAME: LazyLock<VariableName> =
    LazyLock::new(|| VariableName("__relay_exec_time".intern()));

/// Whether codegen gives an operation exec-time artifacts for every execution:
/// `enable_resolver_normalization_ast` does for every operation, and
/// `@exec_time_resolvers` without `enabledProvider` for its operation.
pub fn runs_at_exec_time(
    feature_flags: &FeatureFlags,
    has_exec_time_resolvers_directive: bool,
    has_enabled_provider: bool,
) -> bool {
    feature_flags.enable_resolver_normalization_ast
        || (feature_flags.enable_exec_time_resolvers_directive
            && has_exec_time_resolvers_directive
            && !has_enabled_provider)
}

/// Whether codegen gives an operation exec-time artifacts that run while its
/// `enabledProvider` returns true, and read-time ones otherwise.
pub fn runs_at_exec_time_while_provider(
    feature_flags: &FeatureFlags,
    has_exec_time_resolvers_directive: bool,
    has_enabled_provider: bool,
) -> bool {
    feature_flags.enable_exec_time_resolvers_directive
        && has_exec_time_resolvers_directive
        && has_enabled_provider
}

/// Whether an operation's resolver values are in the store when its data is
/// read, as codegen decides it (`runs_at_exec_time`,
/// `runs_at_exec_time_while_provider`).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ExecTimeMode {
    ReadTime,
    /// Always at exec time.
    ExecTime,
    /// At exec time while the provider module returns true.
    Provider(StringKey),
}

pub fn exec_time_mode(directives: &[Directive], feature_flags: &FeatureFlags) -> ExecTimeMode {
    let directive = directives.named(*EXEC_TIME_RESOLVERS_DIRECTIVE_NAME);
    let provider_argument = match directive {
        Some(directive) => directive
            .arguments
            .named(*EXEC_TIME_RESOLVERS_ENABLED_PROVIDER_ARG),
        None => None,
    };
    let has_directive = directive.is_some();
    let has_provider = provider_argument.is_some();
    if runs_at_exec_time(feature_flags, has_directive, has_provider) {
        return ExecTimeMode::ExecTime;
    }
    if runs_at_exec_time_while_provider(feature_flags, has_directive, has_provider)
        && let Some(argument) = provider_argument
        && let Some(provider) = argument.value.item.get_string_literal()
    {
        return ExecTimeMode::Provider(provider);
    }
    ExecTimeMode::ReadTime
}

/// Reports every declaration of `$__relay_exec_time` and every
/// `@arguments(__relay_exec_time: ...)`: only the compiler sets it.
pub fn validate_exec_time_variable_is_reserved(program: &Program) -> DiagnosticsResult<()> {
    let mut validator = ReservedExecTimeVariable { errors: vec![] };
    for operation in program.operations() {
        report_declarations(&operation.variable_definitions, &mut validator.errors);
        validator.visit_operation(operation);
    }
    for fragment in program.fragments() {
        report_declarations(&fragment.variable_definitions, &mut validator.errors);
        validator.visit_fragment(fragment);
    }
    if validator.errors.is_empty() {
        Ok(())
    } else {
        Err(validator.errors)
    }
}

fn report_declarations(definitions: &[VariableDefinition], errors: &mut Vec<Diagnostic>) {
    for definition in definitions {
        if definition.name.item == *EXEC_TIME_VARIABLE_NAME {
            errors.push(Diagnostic::error(
                ValidationMessage::ReservedExecTimeVariable,
                definition.name.location,
            ));
        }
    }
}

struct ReservedExecTimeVariable {
    errors: Vec<Diagnostic>,
}

impl Visitor for ReservedExecTimeVariable {
    const NAME: &'static str = "ReservedExecTimeVariable";
    const VISIT_ARGUMENTS: bool = false;
    const VISIT_DIRECTIVES: bool = false;

    fn visit_fragment_spread(&mut self, spread: &FragmentSpread) {
        for argument in &spread.arguments {
            if argument.name.item.0 == EXEC_TIME_VARIABLE_NAME.0 {
                self.errors.push(Diagnostic::error(
                    ValidationMessage::ReservedExecTimeVariable,
                    argument.name.location,
                ));
            }
        }
    }
}

fn declares_exec_time_variable(operation: &OperationDefinition) -> bool {
    for definition in &operation.variable_definitions {
        if definition.name.item == *EXEC_TIME_VARIABLE_NAME {
            return true;
        }
    }
    false
}

fn without_exec_time_variable(operation: &OperationDefinition) -> OperationDefinition {
    let mut next_operation = operation.clone();
    next_operation.variable_definitions.clear();
    for definition in &operation.variable_definitions {
        if definition.name.item != *EXEC_TIME_VARIABLE_NAME {
            next_operation.variable_definitions.push(definition.clone());
        }
    }
    next_operation
}

/// Replaces the operation at each index with its new version.
fn with_operations(program: &Program, replaced: Vec<(usize, OperationDefinition)>) -> Program {
    if replaced.is_empty() {
        return program.clone();
    }
    let mut next_program = program.clone();
    for (index, operation) in replaced {
        next_program.operations[index] = Arc::new(operation);
    }
    next_program
}

/// Declares `$__relay_exec_time` in the operations whose selections, or the
/// fragments they reach, use it.
pub fn bind_exec_time_variable(program: &Program, feature_flags: &FeatureFlags) -> Program {
    let mut visitor = InferVariablesVisitor::new(program);
    let mut bound = vec![];
    for (index, operation) in program.operations.iter().enumerate() {
        if visitor
            .infer_operation_variables(operation)
            .0
            .contains_key(&*EXEC_TIME_VARIABLE_NAME)
        {
            bound.push((
                index,
                with_exec_time_variable(program, operation, feature_flags),
            ));
        }
    }
    with_operations(program, bound)
}

/// A query generated for `@refetchable` declares `$__relay_exec_time` as a plain
/// variable. Bind it as in an authored query, which is the value the generated
/// query gets when it runs on its own. A refetch passes the variables of the
/// query that fetched the fragment, and a passed value wins over a default, so
/// there only a provider binding holds: the read-time rule trusts the variable
/// in a generated query only when a provider binds it.
pub fn bind_exec_time_variable_in_refetch_queries(
    program: &Program,
    feature_flags: &FeatureFlags,
) -> Program {
    let mut rebound = vec![];
    for (index, operation) in program.operations.iter().enumerate() {
        if RefetchableDerivedFromMetadata::find(&operation.directives).is_some()
            && declares_exec_time_variable(operation)
        {
            rebound.push((
                index,
                with_exec_time_variable(
                    program,
                    &without_exec_time_variable(operation),
                    feature_flags,
                ),
            ));
        }
    }
    with_operations(program, rebound)
}

/// Typegen: the compiler binds `$__relay_exec_time` itself, so a query generated
/// for `@refetchable` does not ask its caller for it, just like an authored one.
pub fn remove_exec_time_variable_from_refetch_queries(program: &Program) -> Program {
    let mut stripped = vec![];
    for (index, operation) in program.operations.iter().enumerate() {
        if RefetchableDerivedFromMetadata::find(&operation.directives).is_some()
            && declares_exec_time_variable(operation)
        {
            stripped.push((index, without_exec_time_variable(operation)));
        }
    }
    with_operations(program, stripped)
}

fn with_exec_time_variable(
    program: &Program,
    operation: &OperationDefinition,
    feature_flags: &FeatureFlags,
) -> OperationDefinition {
    let location = operation.name.location;
    let boolean = program
        .schema
        .get_type("Boolean".intern())
        .expect("the schema should define Boolean");
    let mut definition = VariableDefinition {
        name: WithLocation::new(location, *EXEC_TIME_VARIABLE_NAME),
        // A default value requires a nullable type.
        type_: TypeReference::Named(boolean),
        default_value: None,
        directives: vec![],
    };
    match exec_time_mode(&operation.directives, feature_flags) {
        ExecTimeMode::ReadTime => {
            definition.default_value =
                Some(WithLocation::new(location, ConstantValue::Boolean(false)));
        }
        ExecTimeMode::ExecTime => {
            definition.default_value =
                Some(WithLocation::new(location, ConstantValue::Boolean(true)));
        }
        ExecTimeMode::Provider(provider) => {
            definition.type_ = TypeReference::NonNull(Box::new(TypeReference::Named(boolean)));
            definition.directives.push(Directive {
                name: WithLocation::new(location, ProvidedVariableMetadata::directive_name()),
                arguments: vec![],
                data: Some(Box::new(ProvidedVariableMetadata::new(
                    provider,
                    *EXEC_TIME_VARIABLE_NAME,
                    location.source_location(),
                ))),
                location,
            });
        }
    }
    let mut next_operation = operation.clone();
    next_operation.variable_definitions.push(definition);
    next_operation
}
