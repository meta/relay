/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

mod fetchable_query_generator;
mod node_query_generator;
mod query_query_generator;
mod refetchable_directive;
mod utils;
mod validation_message;
mod viewer_query_generator;

use std::fmt::Write;
use std::sync::Arc;

use ::errors::validate_map;
use common::Diagnostic;
use common::DiagnosticsResult;
use common::DirectiveName;
use common::Named;
use common::NamedItem;
use common::WithLocation;
use fetchable_query_generator::FETCHABLE_QUERY_GENERATOR;
use fnv::FnvHashMap;
use graphql_ir::Directive;
use graphql_ir::FragmentDefinition;
use graphql_ir::FragmentDefinitionName;
use graphql_ir::FragmentDefinitionNameSet;
use graphql_ir::OperationDefinition;
use graphql_ir::OperationDefinitionName;
use graphql_ir::Program;
use graphql_ir::Selection;
use graphql_ir::VariableDefinition;
use graphql_syntax::OperationKind;
use intern::string_key::StringKeyMap;
use node_query_generator::NODE_QUERY_GENERATOR;
use query_query_generator::QUERY_QUERY_GENERATOR;
use relay_config::ProjectConfig;
use relay_config::SchemaConfig;
use relay_schema::client_implementors::has_client_implementors;
use schema::SDLSchema;
use schema::Schema;
pub use utils::CONSTANTS;
pub use utils::RefetchableDerivedFromMetadata;
pub use utils::RefetchableMetadata;
pub use utils::build_used_global_variables;
use utils::*;
use viewer_query_generator::VIEWER_QUERY_GENERATOR;

pub use self::refetchable_directive::REFETCHABLE_NAME;
use self::refetchable_directive::RefetchableDirective;
use self::validation_message::ValidationMessage;
use crate::connections::ConnectionConstants;
use crate::connections::extract_connection_metadata_from_directive;
use crate::relay_directive::PLURAL_ARG_NAME;
use crate::relay_directive::RELAY_DIRECTIVE_NAME;
use crate::root_variables::InferVariablesVisitor;
use crate::root_variables::VariableMap;

/// This transform synthesizes "refetch" queries for fragments that
/// are trivially refetchable. This is comprised of three main stages:
///
/// 1. Validating that fragments marked with @refetchable qualify for
///    refetch query generation; mainly this means that the fragment
///    type is able to be refetched in some canonical way.
/// 2. Determining the variable definitions to use for each generated
///    query. GraphQL does not have a notion of fragment-local variables
///    at all, and although Relay adds this concept developers are still
///    allowed to reference global variables. This necessitates a
///    visiting all reachable fragments for each @refetchable fragment,
///    and finding the union of all global variables expected to be defined.
/// 3. Building the refetch queries, a straightforward copying transform from
///    Fragment to Root IR nodes.
pub fn transform_refetchable_fragment(
    program: &Program,
    project_config: &ProjectConfig,
    base_fragment_names: &'_ FragmentDefinitionNameSet,
    for_typegen: bool,
    transferrable_refetchable_query_directives: Vec<DirectiveName>,
) -> DiagnosticsResult<Program> {
    let mut next_program = Program::new(Arc::clone(&program.schema));

    let mut transformer = RefetchableFragment::new(program, project_config, for_typegen);

    for operation in program.operations() {
        next_program.insert_operation(Arc::clone(operation));
    }

    validate_map(program.fragments(), |fragment| {
        let operation_result = transformer.transform_refetch_fragment(fragment)?;
        if let Some((refetchable_directive, operation_result)) = operation_result {
            next_program.insert_fragment(operation_result.fragment);
            if !base_fragment_names.contains(&fragment.name.item) {
                let mut directives = refetchable_directive.directives;
                directives.push(RefetchableDerivedFromMetadata(fragment.name.item).into());
                // Calculate directives that are transferrable but that do not already exist on the refetchable query
                let transferrable_refetchable_query_directives: Vec<&DirectiveName> =
                    transferrable_refetchable_query_directives
                        .iter()
                        .filter(|name| directives.named(**name).is_none())
                        .collect::<Vec<_>>();
                let directives_to_copy = fragment
                    .directives
                    .iter()
                    .filter(|directive| {
                        transferrable_refetchable_query_directives
                            .iter()
                            .any(|name| directive.name() == **name)
                    })
                    .cloned();
                directives.extend(directives_to_copy);

                next_program.insert_operation(Arc::new(OperationDefinition {
                    kind: OperationKind::Query,
                    name: WithLocation::new(
                        fragment.name.location,
                        refetchable_directive.query_name.item,
                    ),
                    type_: program.schema.query_type().unwrap(),
                    variable_definitions: operation_result.variable_definitions,
                    directives,
                    selections: operation_result.selections,
                }));
            }
        } else {
            next_program.insert_fragment(Arc::clone(fragment));
        }
        Ok(())
    })?;

    Ok(next_program)
}

type ExistingRefetchOperations = StringKeyMap<WithLocation<FragmentDefinitionName>>;

pub struct RefetchableFragment<'program, 'pc> {
    connection_constants: ConnectionConstants,
    existing_refetch_operations: ExistingRefetchOperations,
    // O(1) operation-name lookup to avoid per-fragment linear scans.
    existing_operations: FnvHashMap<OperationDefinitionName, &'program Arc<OperationDefinition>>,
    for_typegen: bool,
    infer_variables_visitor: InferVariablesVisitor<'program>,
    program: &'program Program,
    project_config: &'pc ProjectConfig,
}

impl<'program, 'pc> RefetchableFragment<'program, 'pc> {
    pub fn new(
        program: &'program Program,
        project_config: &'pc ProjectConfig,
        for_typegen: bool,
    ) -> Self {
        let existing_operations = program.operations().map(|op| (op.name.item, op)).collect();
        RefetchableFragment {
            connection_constants: Default::default(),
            existing_refetch_operations: Default::default(),
            existing_operations,
            for_typegen,
            infer_variables_visitor: InferVariablesVisitor::new(program),
            program,
            project_config,
        }
    }

    fn transform_refetch_fragment(
        &mut self,
        fragment: &Arc<FragmentDefinition>,
    ) -> DiagnosticsResult<Option<(RefetchableDirective, RefetchRoot)>> {
        let refetchable_directive = fragment.directives.named(*REFETCHABLE_NAME);
        if let Some(directive) = refetchable_directive
            && self.program.schema.query_type().is_none()
        {
            return Err(vec![Diagnostic::error(
                "Unable to use @refetchable directive. The `Query` type is not defined on the schema.",
                directive.name.location,
            )]);
        }

        refetchable_directive
            .map(|refetchable_directive| {
                self.transform_refetch_fragment_with_refetchable_directive(
                    fragment,
                    refetchable_directive,
                )
            })
            .transpose()
    }

    pub fn transform_refetch_fragment_with_refetchable_directive(
        &mut self,
        fragment: &Arc<FragmentDefinition>,
        directive: &Directive,
    ) -> DiagnosticsResult<(RefetchableDirective, RefetchRoot)> {
        self.transform_refetch_fragment_with_refetchable_directive_impl(fragment, directive, None)
    }

    /// Like `transform_refetch_fragment_with_refetchable_directive`, but allows
    /// the caller to provide a custom error to use when no query generator
    /// matches the fragment's type. This is used by client edges where the
    /// `@refetchable` is an implementation detail and the default error message
    /// would reference internal concepts the user never wrote.
    pub fn transform_refetch_fragment_with_refetchable_directive_and_custom_error(
        &mut self,
        fragment: &Arc<FragmentDefinition>,
        directive: &Directive,
        unsupported_type_error: Vec<Diagnostic>,
    ) -> DiagnosticsResult<(RefetchableDirective, RefetchRoot)> {
        self.transform_refetch_fragment_with_refetchable_directive_impl(
            fragment,
            directive,
            Some(unsupported_type_error),
        )
    }

    fn transform_refetch_fragment_with_refetchable_directive_impl(
        &mut self,
        fragment: &Arc<FragmentDefinition>,
        directive: &Directive,
        unsupported_type_error: Option<Vec<Diagnostic>>,
    ) -> DiagnosticsResult<(RefetchableDirective, RefetchRoot)> {
        let refetchable_directive =
            RefetchableDirective::from_directive(&self.program.schema, directive)?;
        if has_client_implementors(&self.program.schema, fragment.type_condition) {
            return Err(vec![Diagnostic::error(
                ValidationMessage::RefetchableFragmentOnTypeWithClientImplementors {
                    fragment_name: fragment.name.item,
                    type_name: self.program.schema.get_type_name(fragment.type_condition),
                },
                fragment.name.location,
            )]);
        }
        self.validate_sibling_directives(fragment)?;
        self.validate_refetch_name(fragment, &refetchable_directive)?;
        let variables_map = self
            .infer_variables_visitor
            .infer_fragment_variables(fragment);

        let generators = get_query_generators(&refetchable_directive, self.project_config);

        for generator in generators {
            if let Some(refetch_root) = (generator.build_refetch_operation)(
                &self.program.schema,
                &self.project_config.schema_config,
                fragment,
                refetchable_directive.query_name.item,
                &variables_map,
            )? {
                if !self.for_typegen {
                    self.validate_connection_metadata(refetch_root.fragment.as_ref())?;
                }
                return Ok((refetchable_directive, refetch_root));
            }
        }
        if let Some(error) = unsupported_type_error {
            Err(error)
        } else {
            let mut descriptions = String::new();
            for generator in generators.iter() {
                writeln!(descriptions, " - {}", generator.description).unwrap();
            }
            descriptions.pop();
            Err(vec![Diagnostic::error(
                ValidationMessage::UnsupportedRefetchableFragment {
                    fragment_name: fragment.name.item,
                    descriptions,
                },
                fragment.name.location,
            )])
        }
    }

    fn validate_sibling_directives(
        &mut self,
        fragment: &FragmentDefinition,
    ) -> DiagnosticsResult<()> {
        let relay_directive = fragment.directives.named(*RELAY_DIRECTIVE_NAME);
        let plural_directive = relay_directive
            .filter(|directive| directive.arguments.named(*PLURAL_ARG_NAME).is_some());
        if let Some(directive) = plural_directive {
            Err(vec![Diagnostic::error(
                ValidationMessage::InvalidRefetchableFragmentWithRelayPlural {
                    fragment_name: fragment.name.item,
                },
                directive.location,
            )])
        } else {
            Ok(())
        }
    }

    fn validate_refetch_name(
        &mut self,
        fragment: &FragmentDefinition,
        refetchable_directive: &RefetchableDirective,
    ) -> DiagnosticsResult<()> {
        let fragment_name = fragment.name;

        // check for conflict with other @refetchable names
        if let Some(previous_fragment) = self
            .existing_refetch_operations
            .insert(refetchable_directive.query_name.item.0, fragment_name)
        {
            let (first_fragment, second_fragment) = if fragment.name.item > previous_fragment.item {
                (previous_fragment, fragment_name)
            } else {
                (fragment_name, previous_fragment)
            };
            return Err(vec![
                Diagnostic::error(
                    ValidationMessage::DuplicateRefetchableOperation {
                        query_name: refetchable_directive.query_name.item,
                        first_fragment_name: first_fragment.item,
                        second_fragment_name: second_fragment.item,
                    },
                    first_fragment.location,
                )
                .annotate("also defined here", second_fragment.location),
            ]);
        }

        // check for conflict with operations
        if let Some(existing_query) = self
            .existing_operations
            .get(&refetchable_directive.query_name.item)
            .copied()
        {
            return Err(vec![
                Diagnostic::error(
                    ValidationMessage::RefetchableQueryConflictWithDefinition {
                        definition_name: refetchable_directive.query_name.item.0,
                    },
                    refetchable_directive.query_name.location,
                )
                .annotate(
                    "an operation with that name is already defined here",
                    existing_query.name.location,
                ),
            ]);
        }

        if let Some(existing_fragment) = self.program.fragment(FragmentDefinitionName(
            refetchable_directive.query_name.item.0,
        )) {
            return Err(vec![
                Diagnostic::error(
                    ValidationMessage::RefetchableQueryConflictWithDefinition {
                        definition_name: refetchable_directive.query_name.item.0,
                    },
                    refetchable_directive.query_name.location,
                )
                .annotate(
                    "a fragment with that name is already defined here",
                    existing_fragment.name.location,
                ),
            ]);
        }

        Ok(())
    }

    /// Validate that any @connection usage is valid for refetching:
    /// - Variables are used for both the "count" and "cursor" arguments
    ///   (after/first or before/last)
    /// - Exactly one connection
    /// - Has a stable path to the connection data
    ///
    /// Connection metadata is extracted in `transform_connection`
    fn validate_connection_metadata(&self, fragment: &FragmentDefinition) -> DiagnosticsResult<()> {
        if let Some(metadatas) = extract_connection_metadata_from_directive(&fragment.directives) {
            // TODO: path or connection field locations in the error messages
            if metadatas.len() > 1 {
                return Err(vec![Diagnostic::error(
                    ValidationMessage::RefetchableWithMultipleConnections {
                        fragment_name: fragment.name.item,
                    },
                    fragment.name.location,
                )]);
            } else if metadatas.len() == 1 {
                let metadata = &metadatas[0];
                if metadata.path.is_none() {
                    return Err(vec![Diagnostic::error(
                        ValidationMessage::RefetchableWithConnectionInPlural {
                            fragment_name: fragment.name.item,
                        },
                        fragment.name.location,
                    )]);
                }
                if (metadata.after.is_none() || metadata.first.is_none())
                    && metadata.direction != self.connection_constants.direction_backward
                {
                    return Err(vec![Diagnostic::error(
                        ValidationMessage::RefetchableWithConstConnectionArguments {
                            fragment_name: fragment.name.item,
                            arguments: "after and first",
                        },
                        fragment.name.location,
                    )]);
                } else if (metadata.before.is_none() || metadata.last.is_none())
                    && metadata.direction != self.connection_constants.direction_forward
                {
                    return Err(vec![Diagnostic::error(
                        ValidationMessage::RefetchableWithConstConnectionArguments {
                            fragment_name: fragment.name.item,
                            arguments: "before and last",
                        },
                        fragment.name.location,
                    )]);
                }
            }
        }
        Ok(())
    }
}

type BuildRefetchOperationFn = fn(
    schema: &SDLSchema,
    schema_config: &SchemaConfig,
    fragment: &Arc<FragmentDefinition>,
    query_name: OperationDefinitionName,
    variables_map: &VariableMap,
) -> DiagnosticsResult<Option<RefetchRoot>>;
/// A strategy to generate queries for a given fragment. Multiple strategies
/// can be tried, such as generating a `node(id: ID)` query or a query directly
/// on the root query type.
pub struct QueryGenerator {
    /// Used to describe what fragments this QueryGenerator applies to, used in
    /// error messages.
    pub description: &'static str,

    /// Returns RefetchRoot or null if not applicable. Might throw a user error
    /// for an invalid schema or other problems.
    pub build_refetch_operation: BuildRefetchOperationFn,
}

const GENERATORS: [QueryGenerator; 4] = [
    VIEWER_QUERY_GENERATOR,
    QUERY_QUERY_GENERATOR,
    NODE_QUERY_GENERATOR,
    FETCHABLE_QUERY_GENERATOR,
];

const PREFER_FETCHABLE_GENERATORS: [QueryGenerator; 4] = [
    VIEWER_QUERY_GENERATOR,
    QUERY_QUERY_GENERATOR,
    FETCHABLE_QUERY_GENERATOR,
    NODE_QUERY_GENERATOR,
];

fn get_query_generators(
    directive: &RefetchableDirective,
    project_config: &ProjectConfig,
) -> &'static [QueryGenerator; 4] {
    if directive.prefer_fetchable
        || project_config
            .feature_flags
            .prefer_fetchable_in_refetch_queries
    {
        &PREFER_FETCHABLE_GENERATORS
    } else {
        &GENERATORS
    }
}

pub struct RefetchRoot {
    pub fragment: Arc<FragmentDefinition>,
    pub selections: Vec<Selection>,
    pub variable_definitions: Vec<VariableDefinition>,
}
