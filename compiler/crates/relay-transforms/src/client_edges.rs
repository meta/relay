/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

use std::collections::HashSet;
use std::sync::Arc;
use std::sync::LazyLock;

use common::ArgumentName;
use common::Diagnostic;
use common::DiagnosticsResult;
use common::DirectiveName;
use common::Location;
use common::NamedItem;
use common::ObjectName;
use common::WithLocation;
use docblock_shared::FRAGMENT_KEY_ARGUMENT_NAME;
use docblock_shared::HAS_OUTPUT_TYPE_ARGUMENT_NAME;
use docblock_shared::RELAY_RESOLVER_DIRECTIVE_NAME;
use docblock_shared::RELAY_RESOLVER_MODEL_INSTANCE_FIELD;
use graphql_ir::Argument;
use graphql_ir::ConstantValue;
use graphql_ir::Directive;
use graphql_ir::ExecutableDefinitionName;
use graphql_ir::Field;
use graphql_ir::FragmentDefinition;
use graphql_ir::FragmentDefinitionName;
use graphql_ir::FragmentDefinitionNameSet;
use graphql_ir::InlineFragment;
use graphql_ir::LinkedField;
use graphql_ir::OperationDefinition;
use graphql_ir::OperationDefinitionName;
use graphql_ir::Program;
use graphql_ir::Selection;
use graphql_ir::Transformed;
use graphql_ir::Transformer;
use graphql_ir::Value;
use graphql_ir::associated_data_impl;
use graphql_syntax::OperationKind;
use intern::Lookup;
use intern::string_key::Intern;
use intern::string_key::StringKey;
use intern::string_key::StringKeyMap;
use relay_config::ProjectConfig;
use relay_schema::client_implementors::client_implementors_of;
use relay_schema::client_implementors::has_client_implementors;
use relay_schema::definitions::ResolverType;
use relay_schema::definitions::is_server_value_object;
use relay_schema::definitions::weak_object_instance_field;
use schema::DirectiveValue;
use schema::FieldID;
use schema::ObjectID;
use schema::SDLSchema;
use schema::Schema;
use schema::Type;

use super::ValidationMessageWithData;
use crate::CHILDREN_CAN_BUBBLE_METADATA_KEY;
use crate::REQUIRED_DIRECTIVE_NAME;
use crate::RequiredMetadataDirective;
use crate::ValidationMessage;
use crate::catch_directive::CATCH_DIRECTIVE_NAME;
use crate::catch_directive::CatchMetadataDirective;
use crate::match_::MATCH_CONSTANTS;
use crate::refetchable_fragment::REFETCHABLE_NAME;
use crate::refetchable_fragment::RefetchableFragment;
use crate::relay_resolvers::ResolverInfo;
use crate::relay_resolvers::get_bool_argument_is_true;
use crate::relay_resolvers::get_resolver_info;
use crate::relay_resolvers::get_resolver_return_fragment_name;
use crate::relay_resolvers::selections_contain_shadow_return_marker;
use crate::relay_resolvers::shadow_return_directive_fragment_name;
use crate::relay_resolvers_abstract_types::concrete_field_requires_waterfall;
use crate::relay_resolvers_abstract_types::project_interface_selections_to_concrete;

// This gets attached to the generated query
pub static QUERY_NAME_ARG: LazyLock<ArgumentName> =
    LazyLock::new(|| ArgumentName("queryName".intern()));
pub static CLIENT_EDGE_SOURCE_NAME: LazyLock<ArgumentName> =
    LazyLock::new(|| ArgumentName("clientEdgeSourceDocument".intern()));
pub static CLIENT_EDGE_WATERFALL_DIRECTIVE_NAME: LazyLock<DirectiveName> =
    LazyLock::new(|| DirectiveName("waterfall".intern()));
pub static EXEC_TIME_RESOLVERS_DIRECTIVE_NAME: LazyLock<DirectiveName> =
    LazyLock::new(|| DirectiveName("exec_time_resolvers".intern()));
/// Argument on `@exec_time_resolvers` naming a provider that decides exec-vs-read
/// time at RUNTIME. Its presence alone matters here; the value is not known at
/// compile time.
///
/// This is the exec-vs-read gate. `useExperimentalProvider` is a different
/// argument that only selects which exec-time executor runs, so a document
/// carrying it is still unconditionally exec time. Codegen draws the same line:
/// `use_exec_time_resolvers` requires this argument to be ABSENT, while
/// `use_exec_and_read_time_resolvers` requires it present.
///
/// MUST match `relay_codegen::EXEC_TIME_RESOLVERS_ENABLED_ARGUMENT`, which is the
/// same string. The two cannot be shared: `relay-codegen` depends on
/// `relay-transforms`, not the reverse, so this crate cannot import theirs — and
/// theirs has its own consumer in `relay-compiler`, so it cannot be replaced by
/// this one without moving the definition and updating both.
pub static EXEC_TIME_RESOLVERS_ENABLED_PROVIDER_ARG: LazyLock<ArgumentName> =
    LazyLock::new(|| ArgumentName("enabledProvider".intern()));

/// Directive added to inline fragments created by the transform. The inline
/// fragment groups together the client edge's backing field as well as a linked
/// field containing the selections being read off of the link.
///
/// Each instance of the directive within a traversal is assigned a unique id.
/// This is added to prevent future transforms from merging multiple of these inline
/// fragments.
#[derive(Clone, Debug, PartialEq, Eq, Hash)]
pub enum ClientEdgeMetadataDirective {
    ServerObject {
        query_name: OperationDefinitionName,
        unique_id: u32,
    },
    ClientObject {
        type_name: Option<ObjectName>,
        unique_id: u32,
        model_resolvers: Vec<ClientEdgeModelResolver>,
        server_object_operations: Vec<ClientEdgeServerObjectOperation>,
    },
}
associated_data_impl!(ClientEdgeMetadataDirective);

/// Whether `get_client_object_for_abstract_type` generates the `@waterfall`
/// server-refetch operations for an abstract edge's server-type implementors.
///
/// A regular client edge to an abstract type needs a `ClientEdgeQuery` per
/// server-type implementor (recorded as a `ClientEdgeServerObjectOperation`) so
/// the runtime can refetch the server record. Two callers suppress that: a magic
/// fragment, whose transplant already fetched the shadowed record in the main
/// operation, and an exec-time resolver, whose executor has no refetch path.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum ServerObjectOperationMode {
    /// Regular client edge, or a `@waterfall` magic fragment: generate a
    /// `ClientEdgeQuery` and record a `ClientEdgeServerObjectOperation` for each
    /// server-type implementor. For a magic fragment this is the cross-object
    /// refetch backstop that fires only when the returned pointer is missing
    /// from the store; the transplant still serves the common case.
    GenerateWaterfallOperations,
    /// Collect model resolvers for client-extension members as usual, but
    /// generate no `ClientEdgeQuery` and record no
    /// `ClientEdgeServerObjectOperation`, so `server_object_operations` stays
    /// empty. Two callers, two reasons:
    /// - magic fragment without `@waterfall`: the transplant in the main
    ///   operation serves the shadowed record, and a cross-object pointer has
    ///   no refetch backstop;
    /// - exec-time resolvers: the executor cannot run a client-edge refetch, so
    ///   a server arm is reachable only when its record is already available.
    SuppressWaterfallOperations,
}

#[derive(Clone, Debug, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub struct ClientEdgeServerObjectOperation {
    pub type_name: ObjectName,
    pub query_name: OperationDefinitionName,
}

#[derive(Clone, Debug, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub struct ClientEdgeModelResolver {
    pub model_field_id: FieldID,
    pub type_name: WithLocation<ObjectName>,
    pub resolver_info: ResolverInfo,
}

/// Metadata directive attached to generated queries
#[derive(Clone, Debug, PartialEq, Eq, Hash)]
pub struct ClientEdgeGeneratedQueryMetadataDirective {
    pub source_name: WithLocation<ExecutableDefinitionName>,
}
associated_data_impl!(ClientEdgeGeneratedQueryMetadataDirective);

pub struct ClientEdgeMetadata<'a> {
    /// The field which defines the graph relationship (currently always a Resolver)
    pub backing_field: &'a Selection,
    /// Models the client edge field and its selections
    pub linked_field: &'a LinkedField,
    /// Additional metadata about the client edge
    pub metadata_directive: ClientEdgeMetadataDirective,
}

// Client edges consists of two parts:
//
// 1. A backing field which contains the ID defining the graph relationship
// 2. A linked field containing the selections that the user has asked for off
// of that relationship.
//
// In order to ensure both of these elements are present in our IR, and also get
// traversed by subsequent transform steps, we model Client Edges in our IR as
// an inline fragment containing these two children in an implicit order.
//
// This utility method is intended to reduce the number of places that need to
// know about this implicit contract by reading an inline fragment and returning
// structured metadata, if present.
impl<'a> ClientEdgeMetadata<'a> {
    pub fn find(fragment: &'a InlineFragment) -> Option<Self> {
        ClientEdgeMetadataDirective::find(&fragment.directives).map(|metadata_directive| {

            // Double check that some flatten/inline transform is not trying to combine/merge our inline directives together.
            assert!(
                fragment.selections.len() == 2,
                "Expected Client Edge inline fragment to have exactly two selections. This is a bug in the Relay compiler."
            );

            let backing_field = fragment
                .selections.first()
                .expect("Client Edge inline fragments have exactly two selections");

            let linked_field = match fragment.selections.get(1) {
                Some(Selection::LinkedField(linked_field)) => linked_field,
                _ => panic!("Client Edge inline fragments have exactly two selections, with the second selection being a linked field.")
            };

            ClientEdgeMetadata {
                metadata_directive: metadata_directive.clone(),
                backing_field,
                linked_field,
            }
        })
    }
}
pub fn client_edges(
    program: &Program,
    project_config: &ProjectConfig,
    base_fragment_names: &FragmentDefinitionNameSet,
    validate_exec_time_resolvers: bool,
    // True for the typegen pipeline, which runs on the un-fanned IR (interface
    // fields are NOT split into per-concrete arms). This drives two pipeline
    // differences:
    //   1. `@waterfall` diagnostics are suppressed — a mixed interface field would
    //      be validated against the interface field itself and wrongly rejected;
    //      the reader/operation pipelines run on the fanned IR and validate each
    //      concrete arm correctly, so they own the diagnostic.
    //   2. Per-implementor `ClientEdgeQuery` operations for an abstract field with
    //      client-edge-to-server implementors are self-projected here, because the
    //      un-fanned IR has no per-concrete arm for the fan-out to mint them from.
    is_typegen: bool,
) -> DiagnosticsResult<Program> {
    let (fragments_in_exec_time_operations, fragments_in_unconditional_exec_time_operations) =
        if validate_exec_time_resolvers {
            collect_fragments_in_exec_time_operations(program)
        } else {
            Default::default()
        };

    let mut transform = ClientEdgesTransform::new(
        program,
        project_config,
        base_fragment_names,
        fragments_in_exec_time_operations,
        fragments_in_unconditional_exec_time_operations,
        is_typegen,
    );
    let mut next_program = transform
        .transform_program(program)
        .replace_or_else(|| program.clone());

    if transform.errors.is_empty() {
        for fragment in transform.new_fragments {
            next_program.insert_fragment(fragment);
        }
        for operation in transform.new_operations {
            next_program.insert_operation(Arc::new(operation));
        }
        Ok(next_program)
    } else {
        Err(transform.errors)
    }
}

/// True when `@exec_time_resolvers` is present with no `enabledProvider`, i.e.
/// this document can ONLY ever run at exec time.
fn is_unconditional_exec_time(directives: &[Directive]) -> bool {
    directives
        .named(*EXEC_TIME_RESOLVERS_DIRECTIVE_NAME)
        .is_some_and(|directive| {
            directive
                .arguments
                .named(*EXEC_TIME_RESOLVERS_ENABLED_PROVIDER_ARG)
                .is_none()
        })
}

/// Two sets: every fragment reached from an `@exec_time_resolvers` operation,
/// and the subset reached ONLY from operations that can never run at read time.
///
/// The second set drives suppression of codegen that read time needs, so it is
/// computed by subtraction: a fragment keeps its operations if ANY operation
/// reaching it is read-time-capable. That includes ordinary operations with no
/// exec-time directive at all, not just `enabledProvider`-gated ones — a
/// fragment shared between a plain query and an exec-time query is reachable at
/// read time through the former.
fn collect_fragments_in_exec_time_operations(
    program: &Program,
) -> (FragmentDefinitionNameSet, FragmentDefinitionNameSet) {
    let mut all_exec_time = FragmentCollector {
        program,
        fragments: Default::default(),
    };
    let mut unconditional_exec_time = FragmentCollector {
        program,
        fragments: Default::default(),
    };
    let mut read_time_capable = FragmentCollector {
        program,
        fragments: Default::default(),
    };

    for operation in program.operations() {
        let has_directive = operation
            .directives
            .named(*EXEC_TIME_RESOLVERS_DIRECTIVE_NAME)
            .is_some();
        if has_directive {
            all_exec_time.collect_fragments_in_selections(&operation.selections);
        }
        if is_unconditional_exec_time(&operation.directives) {
            unconditional_exec_time.collect_fragments_in_selections(&operation.selections);
        } else {
            read_time_capable.collect_fragments_in_selections(&operation.selections);
        }
    }

    let unconditional_only = unconditional_exec_time
        .fragments
        .difference(&read_time_capable.fragments)
        .cloned()
        .collect();
    (all_exec_time.fragments, unconditional_only)
}

struct FragmentCollector<'p> {
    fragments: FragmentDefinitionNameSet,
    program: &'p Program,
}

impl<'p> FragmentCollector<'p> {
    fn collect_fragments_in_selections(&mut self, selections: &[Selection]) {
        for selection in selections {
            match selection {
                Selection::FragmentSpread(fragment_spread) => {
                    // Traverse into the fragment's selections
                    let fragment_name = fragment_spread.fragment.item;
                    if !self.fragments.contains(&fragment_name) {
                        self.fragments.insert(fragment_spread.fragment.item);
                        if let Some(fragment_def) = self.program.fragment(fragment_name) {
                            self.fragments.insert(fragment_name);
                            self.collect_fragments_in_selections(&fragment_def.selections);
                        }
                    }
                }
                Selection::LinkedField(field) => {
                    self.collect_fragments_in_selections(&field.selections);
                }
                Selection::InlineFragment(fragment) => {
                    self.collect_fragments_in_selections(&fragment.selections);
                }
                Selection::ScalarField(_) => {
                    // Scalar fields don't contain fragment spreads
                }
                Selection::Condition(condition) => {
                    self.collect_fragments_in_selections(&condition.selections);
                }
            }
        }
    }
}

struct ClientEdgesTransform<'program, 'pc> {
    path: Vec<&'program str>,
    document_name: Option<WithLocation<ExecutableDefinitionName>>,
    query_names: StringKeyMap<usize>,
    program: &'program Program,
    new_fragments: Vec<Arc<FragmentDefinition>>,
    new_operations: Vec<OperationDefinition>,
    errors: Vec<Diagnostic>,
    project_config: &'pc ProjectConfig,
    next_key: u32,
    base_fragment_names: &'program FragmentDefinitionNameSet,
    has_exec_time_resolvers: bool,
    /// Exec time is not merely requested but GUARANTEED: `@exec_time_resolvers`
    /// with no `enabledProvider`. Only this justifies dropping codegen a
    /// read-time execution would need.
    is_unconditional_exec_time: bool,
    fragments_in_exec_time_operations: FragmentDefinitionNameSet,
    fragments_in_unconditional_exec_time_operations: FragmentDefinitionNameSet,
    /// The typegen pipeline runs on the un-fanned IR; see `client_edges`. Drives
    /// `@waterfall` diagnostic suppression and per-implementor query self-projection.
    is_typegen: bool,
}

impl<'program, 'pc> ClientEdgesTransform<'program, 'pc> {
    fn new(
        program: &'program Program,
        project_config: &'pc ProjectConfig,
        base_fragment_names: &'program FragmentDefinitionNameSet,
        fragments_in_exec_time_operations: FragmentDefinitionNameSet,
        fragments_in_unconditional_exec_time_operations: FragmentDefinitionNameSet,
        is_typegen: bool,
    ) -> Self {
        Self {
            program,
            path: Default::default(),
            query_names: Default::default(),
            document_name: Default::default(),
            new_fragments: Default::default(),
            new_operations: Default::default(),
            errors: Default::default(),
            next_key: 0,
            project_config,
            base_fragment_names,
            has_exec_time_resolvers: false,
            is_unconditional_exec_time: false,
            is_typegen,
            fragments_in_exec_time_operations,
            fragments_in_unconditional_exec_time_operations,
        }
    }

    /// Push an "unexpected `@waterfall`" diagnostic, unless `@waterfall`
    /// validation is suppressed for this pipeline (see `client_edges`).
    fn push_unexpected_waterfall(&mut self, location: Location) {
        if !self.is_typegen {
            self.errors.push(Diagnostic::error_with_data(
                ValidationMessageWithData::RelayResolversUnexpectedWaterfall,
                location,
            ));
        }
    }

    /// Push a "missing `@waterfall`" diagnostic, unless `@waterfall` validation is
    /// suppressed for this pipeline (see `client_edges`).
    fn push_missing_waterfall(&mut self, field_name: StringKey, location: Location) {
        if !self.is_typegen {
            self.errors.push(Diagnostic::error_with_data(
                ValidationMessageWithData::RelayResolversMissingWaterfall { field_name },
                location,
            ));
        }
    }

    fn generate_query_name(
        &mut self,
        document_name: ExecutableDefinitionName,
    ) -> OperationDefinitionName {
        let name_root =
            format!("ClientEdgeQuery_{}_{}", document_name, self.path.join("__")).intern();

        // Due to duplicate inline fragments, or inline fragments without type
        // conditions, it's possible that multiple fields will have the same
        // path. In this case, we will append incrementing numbers to the end of
        // the query name to ensure uniqueness.
        let num = self
            .query_names
            .entry(name_root)
            .and_modify(|n| *n += 1)
            .or_insert(0);

        match num {
            0 => OperationDefinitionName(name_root),
            n => OperationDefinitionName(format!("{name_root}_{n}").intern()),
        }
    }

    fn generate_client_edge_query(
        &mut self,
        generated_query_name: OperationDefinitionName,
        field_type: Type,
        selections: Vec<Selection>,
        unsupported_type_error: Vec<Diagnostic>,
    ) {
        let document_name = self.document_name.expect("Expect to be within a document");
        let synthetic_fragment_name = WithLocation::new(
            // The artifact for the refetchable fragment and query derived from
            // this fragment will be placed on disk based on this source
            // location. Currently non-Haste environments assume that this
            // fragment and the query derived from it will use the same location
            // source, and thus will be placed in the same `__generated__`
            // directory. Based on this assumption they import the file using `./`.
            document_name.location,
            FragmentDefinitionName(format!("Refetchable{generated_query_name}").intern()),
        );

        let synthetic_refetchable_fragment = FragmentDefinition {
            name: synthetic_fragment_name,
            variable_definitions: Vec::new(),
            used_global_variables: Vec::new(),
            type_condition: field_type,
            directives: vec![
                // Used to influence where we place this generated file, and
                // the document from which we derive the source hash for the
                // Client Edge generated query's artifact.
                ClientEdgeGeneratedQueryMetadataDirective {
                    source_name: document_name,
                }
                .into(),
            ],
            selections,
        };

        let mut transformer = RefetchableFragment::new(self.program, self.project_config, false);

        let refetchable_fragment = transformer
            .transform_refetch_fragment_with_refetchable_directive_and_custom_error(
                &Arc::new(synthetic_refetchable_fragment),
                &make_refetchable_directive(generated_query_name),
                unsupported_type_error,
            );

        match refetchable_fragment {
            Err(diagnostics) => {
                self.errors.extend(diagnostics);
            }
            Ok((refetchable_directive, refetchable_root)) => {
                self.new_fragments.push(refetchable_root.fragment);

                let query_type = self.program.schema.query_type().unwrap();

                let mut directives = refetchable_directive.directives;
                directives.push(
                    // Used to influence where we place this generated file, and
                    // the document from which we derive the source hash for the
                    // Client Edge generated query's artifact.
                    ClientEdgeGeneratedQueryMetadataDirective {
                        source_name: document_name,
                    }
                    .into(),
                );
                // Propagate exec-time semantics to the auto-generated
                // ClientEdgeQuery so its NormalizationOperation carries
                // `use_exec_time_resolvers: true`. The reactive executor's
                // per-waterfall NormalizationEngine reads this flag to
                // collect S2C executions instead of inlining them. See
                // CLIENT_TO_SERVER_EDGES_DESIGN.md section 7.1.
                if self.has_exec_time_resolvers {
                    directives.push(Directive {
                        name: WithLocation::generated(*EXEC_TIME_RESOLVERS_DIRECTIVE_NAME),
                        arguments: vec![],
                        data: None,
                        location: Location::generated(),
                    });
                }
                self.new_operations.push(OperationDefinition {
                    kind: OperationKind::Query,
                    name: WithLocation::new(
                        document_name.location,
                        refetchable_directive.query_name.item,
                    ),
                    type_: query_type,
                    variable_definitions: refetchable_root.variable_definitions,
                    directives,
                    selections: refetchable_root.selections,
                });
            }
        };
    }

    fn verify_directives_or_push_errors(&mut self, directives: &[Directive]) {
        let allowed_directive_names = [
            *CLIENT_EDGE_WATERFALL_DIRECTIVE_NAME,
            *REQUIRED_DIRECTIVE_NAME,
            *CHILDREN_CAN_BUBBLE_METADATA_KEY,
            RequiredMetadataDirective::directive_name(),
            MATCH_CONSTANTS.match_directive_name,
            *CATCH_DIRECTIVE_NAME,
            CatchMetadataDirective::directive_name(),
        ];

        let other_directives = directives
            .iter()
            .filter(|directive| !allowed_directive_names.contains(&directive.name.item))
            .collect::<Vec<_>>();

        for directive in other_directives {
            self.errors.push(Diagnostic::error(
                ValidationMessage::ClientEdgeUnsupportedDirective {
                    directive_name: directive.name.item,
                },
                directive.location,
            ));
        }
    }

    fn get_edge_to_client_object_metadata_directive(
        &mut self,
        field: &LinkedField,
        edge_to_type: Type,
        waterfall_directive: Option<&Directive>,
        resolver_directive: Option<&DirectiveValue>,
        new_selections: &[Selection],
    ) -> Option<ClientEdgeMetadataDirective> {
        // Exec time has no client-edge refetch path, so a per-implementor
        // `ClientEdgeQuery` would advertise a waterfall the executor cannot run.
        // A server arm is reachable only when its record is already available;
        // a returned id the parent operation never fetched needs `@mayWaterfall`
        // support that does not exist yet.
        //
        // Only UNCONDITIONAL exec time may suppress them. Under
        // `@exec_time_resolvers(enabledProvider: ...)` the same document still runs
        // at read time when the provider is false, and read time does perform the
        // refetch — dropping the operation at compile time would leave it with no
        // way to resolve the edge. Suppression is additionally narrowed to genuinely
        // mixed edges where the operations are consumed; see `has_server_type`.
        // (Narrowing to the mixed shape is intentionally NOT done there.)
        let server_object_operation_mode = if self.is_unconditional_exec_time {
            ServerObjectOperationMode::SuppressWaterfallOperations
        } else {
            ServerObjectOperationMode::GenerateWaterfallOperations
        };

        let result = match edge_to_type {
            Type::Interface(_) | Type::Union(_)
                if has_client_implementors(&self.program.schema, edge_to_type) =>
            {
                // A server abstract type: the client-defined implementors take a
                // model resolver and every other value is a server record, so
                // no server implementor is listed and none gets a refetch query.
                let members = client_implementors_of(&self.program.schema, edge_to_type);
                self.get_client_object_for_abstract_type(
                    members.iter(),
                    self.program.schema.get_type_name(edge_to_type),
                    field,
                    new_selections,
                    server_object_operation_mode,
                )
            }
            Type::Interface(interface_id) => {
                let interface = self.program.schema.interface(interface_id);
                let implementing_objects =
                    interface.recursively_implementing_objects(Arc::as_ref(&self.program.schema));
                if implementing_objects.is_empty() {
                    self.errors.push(Diagnostic::error(
                        ValidationMessage::RelayResolverClientInterfaceMustBeImplemented {
                            interface_name: interface.name.item,
                        },
                        interface.name.location,
                    ));
                }
                if !self
                    .project_config
                    .feature_flags
                    .relay_resolver_enable_interface_output_type
                    .is_fully_enabled()
                    && !has_output_type(resolver_directive)
                {
                    self.errors.push(Diagnostic::error(
                        ValidationMessage::ClientEdgeToClientInterface,
                        field.alias_or_name_location(),
                    ));
                }
                self.get_client_object_for_abstract_type(
                    implementing_objects.iter(),
                    interface.name.item.0,
                    field,
                    new_selections,
                    server_object_operation_mode,
                )
            }
            Type::Union(union) => {
                let union = self.program.schema.union(union);
                self.get_client_object_for_abstract_type(
                    union.members.iter(),
                    union.name.item.0,
                    field,
                    new_selections,
                    server_object_operation_mode,
                )
            }
            Type::Object(object_id) => {
                let type_name = self.program.schema.object(object_id).name.item;
                let model_resolvers = self
                    .get_client_edge_model_resolver_for_object(object_id)
                    .map_or(vec![], |model_resolver| vec![model_resolver]);
                Some(ClientEdgeMetadataDirective::ClientObject {
                    type_name: Some(type_name),
                    model_resolvers,
                    server_object_operations: vec![],
                    unique_id: self.get_key(),
                })
            }
            _ => {
                panic!("Expected a linked field to reference either an Object, Interface, or Union")
            }
        };

        // Validate @waterfall usage based on whether there are server type implementors.
        if let Some(ClientEdgeMetadataDirective::ClientObject {
            server_object_operations,
            ..
        }) = &result
        {
            if server_object_operations.is_empty() {
                // Nothing to refetch — either there are no server type
                // implementors, or the mode above suppressed their operations.
                // Either way @waterfall has nothing to opt into.
                if let Some(directive) = waterfall_directive {
                    self.push_unexpected_waterfall(directive.location);
                }
            } else {
                // Has server type implementors: @waterfall is required.
                if waterfall_directive.is_none() {
                    let field_name = self.program.schema.field(field.definition.item).name.item;
                    self.push_missing_waterfall(field_name, field.definition.location);
                }
            }
        }

        result
    }

    /// Collect the concrete implementing objects of `edge_to_type`, paired with
    /// the abstract type's name. Returns `None` for a concrete object type (which
    /// has no abstract members) — magic-fragment edges only route interface/union return
    /// types through the client-object machinery.
    fn abstract_type_members(&self, edge_to_type: Type) -> Option<(Vec<ObjectID>, StringKey)> {
        let client_implementors = client_implementors_of(&self.program.schema, edge_to_type);
        if !client_implementors.is_empty() {
            return Some((
                client_implementors,
                self.program.schema.get_type_name(edge_to_type),
            ));
        }
        match edge_to_type {
            Type::Interface(interface_id) => {
                let interface = self.program.schema.interface(interface_id);
                let members = interface
                    .recursively_implementing_objects(Arc::as_ref(&self.program.schema))
                    .into_iter()
                    .collect();
                Some((members, interface.name.item.0))
            }
            Type::Union(union_id) => {
                let union = self.program.schema.union(union_id);
                Some((union.members.clone(), union.name.item.0))
            }
            _ => None,
        }
    }

    /// Returns true if any implementor of the magic-fragment edge's return type
    /// (`edge_to_type`) is a client-extension type. Such an edge carries client
    /// data that is read via the model-resolver (`ClientObject`) path, which
    /// requires the interface selection to have been expanded into per-concrete
    /// typed arms by `relay_resolvers_abstract_types`.
    ///
    /// This is a pure predicate, so it iterates the borrowed members directly
    /// (rather than going through `abstract_type_members`, which collects/clones
    /// them) — `any` short-circuits without allocating.
    fn magic_fragment_edge_has_client_extension_implementor(&self, edge_to_type: Type) -> bool {
        if has_client_implementors(&self.program.schema, edge_to_type) {
            return true;
        }
        let schema = &self.program.schema;
        let is_client_object =
            |object_id: &ObjectID| schema.is_extension_type(Type::Object(*object_id));
        match edge_to_type {
            Type::Interface(interface_id) => schema
                .interface(interface_id)
                .recursively_implementing_objects(Arc::as_ref(schema))
                .iter()
                .any(is_client_object),
            Type::Union(union_id) => schema.union(union_id).members.iter().any(is_client_object),
            _ => false,
        }
    }

    /// Build the `ClientObject` edge for a magic fragment whose return
    /// interface/union is read through the model-resolver machinery.
    ///
    /// Reuses the shared `get_client_object_for_abstract_type` helper — so model
    /// resolvers for client-extension members are minted exactly as on the
    /// regular client-edge path.
    ///
    /// `is_waterfall` selects how server members are served:
    /// - `false` (default, no `@waterfall`): `SuppressWaterfallOperations` — no
    ///   `ClientEdgeQuery` is generated and `server_object_operations` stays empty;
    ///   the consumer's selections for a server member are transplanted onto the
    ///   shadowed server field in the main operation by
    ///   `relay_resolvers_spread_transform`, so there is no waterfall.
    /// - `true` (`@waterfall` opt-in): `GenerateWaterfallOperations` — the
    ///   server member's pointer targets a different object not covered by the
    ///   transplant, so a `ClientEdgeQuery` refetch is generated exactly as for a
    ///   regular client-edge-to-server-object.
    fn get_edge_to_magic_fragment_client_object_metadata_directive(
        &mut self,
        field: &LinkedField,
        edge_to_type: Type,
        is_waterfall: bool,
        new_selections: &[Selection],
    ) -> Option<ClientEdgeMetadataDirective> {
        // A CONCRETE non-Node SERVER VALUE return has no abstract
        // members, so route it through the concrete `ClientObject` machinery (the
        // same `Type::Object` arm a concrete client edge uses): a `ClientObject`
        // with empty `model_resolvers` and empty `server_object_operations`. The
        // consumer's selections are transplanted onto the shadowed server field in
        // the main operation; the edge reads them INLINE in place off the injected
        // `__id` (no `ensureClientRecord`, no refetch). `build_ast` emits the
        // `ServerWeak` `normalizationInfo` for it.
        if let Type::Object(object_id) = edge_to_type {
            // A server VALUE return has no global `id` and no separate record, so
            // `node(id:)` is meaningless: `@waterfall` is a hard error.
            if is_waterfall {
                self.push_unexpected_waterfall(field.definition.location);
            }
            let type_name = self.program.schema.object(object_id).name.item;
            return Some(ClientEdgeMetadataDirective::ClientObject {
                type_name: Some(type_name),
                model_resolvers: vec![],
                server_object_operations: vec![],
                unique_id: self.get_key(),
            });
        }

        let (members, abstract_type_name) = self.abstract_type_members(edge_to_type)?;
        let server_object_operation_mode = if is_waterfall {
            ServerObjectOperationMode::GenerateWaterfallOperations
        } else {
            ServerObjectOperationMode::SuppressWaterfallOperations
        };
        self.get_client_object_for_abstract_type(
            members.iter(),
            abstract_type_name,
            field,
            new_selections,
            server_object_operation_mode,
        )
    }

    fn get_client_object_for_abstract_type<'a>(
        &mut self,
        members: impl Iterator<Item = &'a ObjectID>,
        abstract_type_name: StringKey,
        field: &LinkedField,
        // The caller's already-transformed selections for `field`. Reused here
        // (rather than re-running `transform_selections`) so nested client edges
        // are not visited twice — a second visit would re-mint their generated
        // query names with a `_N` uniqueness suffix.
        new_selections: &[Selection],
        server_object_operation_mode: ServerObjectOperationMode,
    ) -> Option<ClientEdgeMetadataDirective> {
        let mut model_resolvers: Vec<ClientEdgeModelResolver> = Vec::new();
        let mut server_type_object_ids: Vec<ObjectID> = Vec::new();
        let mut has_inline_member = false;

        let id_field_name = self.project_config.schema_config.node_interface_id_field;
        for object_id in members {
            let member = Type::Object(*object_id);
            let schema = self.program.schema.as_ref();

            // Per-`__typename` classification. A weak `@weak` model or a
            // non-Node server VALUE implementor is read INLINE (off
            // `__relay_model_instance` / the transplanted `client:<parentid>:<field>`
            // record via `__id`) — it has no DataID pointer and no separate record
            // to refetch. Such a member must reach NEITHER `model_resolvers` (it has
            // no model resolver; `@weak` was previously silent-dropped) NOR
            // `server_type_object_ids` (a value type cannot be refetched via
            // `node(id:)`, so an `@waterfall` mixed interface must not attempt one on
            // it — R5). The reader serves it through the backing field's
            // `normalizationInfo` inline branch (set by `field_transform` /
            // `build_ast`) plus the per-concrete inline fragment that
            // `relay_resolvers_abstract_types` expanded; the per-member `@waterfall`
            // strip in `project_interface_selections_to_concrete` already removes
            // `@waterfall` from a non-refetchable inline member's selections. So we
            // simply skip it here.
            let is_inline_member = weak_object_instance_field(schema, member).is_some()
                || is_server_value_object(schema, member, id_field_name);
            if is_inline_member {
                has_inline_member = true;
                continue;
            }

            let is_server_type = !self
                .program
                .schema
                .is_extension_type(Type::Object(*object_id));
            if is_server_type {
                // Strong (Node) server implementor. Collected unconditionally, but
                // only consumed under `GenerateWaterfallOperations`. In
                // `SuppressWaterfallOperations` mode these ids are
                // gathered-but-unused: no per-server refetch query is generated.
                server_type_object_ids.push(*object_id);
            } else {
                // Client model type: try to get a model resolver.
                let model_resolver = self.get_client_edge_model_resolver_for_object(*object_id);
                match model_resolver {
                    Some(resolver) => {
                        model_resolvers.push(resolver);
                    }
                    None => {
                        self.maybe_report_error_for_missing_model_resolver(
                            object_id,
                            abstract_type_name,
                        );
                    }
                }
            }
        }

        // Gate: a mixed magic-fragment return that has BOTH an inline
        // (weak / non-Node value) implementor AND a strong refetchable server-object
        // (Node) implementor is not yet runtime-correct. The inline arm reads in
        // place off `normalizationInfo` while the Node arm needs a `node(id:)`
        // refetch — a single backing-field `normalizationInfo.kind` cannot express
        // per-`__typename` behavior, so the Node member would be mis-normalized as an
        // inline value. Reject up front; full per-`__typename` dispatch is not yet
        // supported. Pure-inline (no strong-Node) and pure-strong (no
        // inline) returns are unaffected.
        if has_inline_member && !server_type_object_ids.is_empty() {
            self.errors.push(Diagnostic::error(
                ValidationMessage::MagicFragmentMixedInlineAndRefetchableUnsupported {
                    interface_name: abstract_type_name,
                },
                field.definition.location,
            ));
            return None;
        }

        model_resolvers.sort();

        // Model resolvers for client-extension members are collected above in
        // every mode; only the server-refetch operations are suppressed.
        //
        // Suppression is deliberately NOT narrowed to the mixed shape. An abstract
        // edge whose implementors are all server types is suppressed too: exec time
        // has no refetch path for any of them, and a magic fragment supplies such an
        // arm's data by transplanting the consumer's selections onto the shadowed
        // server field in the main operation, so no refetch is wanted. Any future
        // fetch is gated on explicit `@mayWaterfall` plus `@waterfall`; until then an
        // unavailable reference is a field error and null link, never a silent fetch.
        let has_server_type = !server_type_object_ids.is_empty()
            && server_object_operation_mode
                == ServerObjectOperationMode::GenerateWaterfallOperations;

        // For each server type, generate a refetch query individually.
        // The refetchable fragment system determines whether to use
        // node(id:) or fetch__TypeName(id:) based on the type's capabilities.
        let server_object_operations = if has_server_type {
            let document_name = self.document_name.expect("We are within a document");

            // Skip query generation for base fragments (fragments defined in
            // other projects that this project depends on). Those fragments
            // will have their client edge queries generated by their own
            // project's compilation. We still need to process the selections
            // below to collect metadata, but we don't emit a new query.
            let should_generate_query =
                if let ExecutableDefinitionName::FragmentDefinitionName(fragment_name) =
                    document_name.item
                {
                    !self.base_fragment_names.contains(&fragment_name)
                } else {
                    true
                };

            // When the interface is mixed (server + client resolver implementors),
            // relay_resolvers_abstract_types has already expanded the selections into
            // per-concrete-type inline fragments — including fragments for client types
            // (e.g. `... on BestFriend { wheels @resolver }`). These client-type
            // fragments must not appear in the server refetch query for a server
            // implementor (e.g. Bicycle), so strip them before generating each query.
            //
            // Fragment spreads on mixed abstract types (e.g. `...PersonFragment` on IPerson)
            // pass through here unchanged. skip_client_extensions handles them in the
            // operation text pipeline by inlining their server-reachable selections in
            // place of the spread, while the reader keeps the original fragment spread.
            let server_selections = new_selections
                .iter()
                .filter(|selection| {
                    if let Selection::InlineFragment(fragment) = selection
                        && let Some(type_condition) = fragment.type_condition
                    {
                        return !self.program.schema.is_extension_type(type_condition);
                    }
                    true
                })
                .cloned()
                .collect::<Vec<_>>();

            let mut ops: Vec<ClientEdgeServerObjectOperation> = Vec::new();
            for object_id in &server_type_object_ids {
                let object = self.program.schema.object(*object_id);
                let query_name = self.generate_query_name(document_name.item);
                if should_generate_query {
                    self.generate_client_edge_query(
                        query_name,
                        Type::Object(*object_id),
                        server_selections.clone(),
                        {
                            let schema_field =
                                self.program.schema.field(field.definition.item);
                            vec![Diagnostic::error(
                                ValidationMessage::ClientEdgeMixedInterfaceServerTypeNotRefetchable {
                                    field_name: schema_field.name.item,
                                    abstract_type_name,
                                    server_type_name: object.name.item,
                                },
                                field.definition.location,
                            )
                            .annotate_if_location_exists(
                                "field defined here",
                                schema_field.name.location,
                            )]
                        },
                    );
                }
                ops.push(ClientEdgeServerObjectOperation {
                    type_name: object.name.item,
                    query_name,
                });
            }
            ops.sort();
            ops
        } else {
            vec![]
        };

        Some(ClientEdgeMetadataDirective::ClientObject {
            type_name: None,
            model_resolvers,
            server_object_operations,
            unique_id: self.get_key(),
        })
    }

    fn maybe_report_error_for_missing_model_resolver(
        &mut self,
        object_id: &ObjectID,
        abstract_type_name: StringKey,
    ) {
        let object = Type::Object(*object_id);
        let schema = self.program.schema.as_ref();
        if !object.is_weak_resolver_object(schema) && object.is_resolver_object(schema) {
            let model_name = self.program.schema.object(*object_id).name;
            self.errors.push(Diagnostic::error(
                ValidationMessage::ClientEdgeImplementingObjectMissingModelResolver {
                    name: abstract_type_name,
                    type_name: model_name.item,
                },
                model_name.location,
            ));
        }
    }

    fn get_client_edge_model_resolver_for_object(
        &mut self,
        object_id: ObjectID,
    ) -> Option<ClientEdgeModelResolver> {
        let model = Type::Object(object_id);
        let schema = self.program.schema.as_ref();
        if !model.is_resolver_object(schema)
            || model.is_weak_resolver_object(schema)
            || !model.is_terse_resolver_object(schema)
        {
            return None;
        }
        let object = self.program.schema.object(object_id);
        let model_field_id = self
            .program
            .schema
            .named_field(model, *RELAY_RESOLVER_MODEL_INSTANCE_FIELD)?;
        let model_field = self.program.schema.field(model_field_id);
        get_resolver_info(&self.program.schema, model_field, object.name.location)
            .and_then(|resolver_info_result| match resolver_info_result {
                Ok(resolver_info) => Some(resolver_info),
                Err(diagnstics) => {
                    self.errors.extend(diagnstics);
                    None
                }
            })
            .map(|resolver_info| ClientEdgeModelResolver {
                model_field_id,
                type_name: object.name,
                resolver_info,
            })
    }

    fn get_edge_to_server_object_metadata_directive(
        &mut self,
        field_type: &schema::Field,
        field_location: Location,
        waterfall_directive: Option<&Directive>,
        selections: Vec<Selection>,
    ) -> ClientEdgeMetadataDirective {
        if field_type.type_.is_list() {
            self.errors.push(Diagnostic::error(
                ValidationMessage::ClientEdgeToServerObjectList,
                field_type.name.location,
            ));
        }
        // Client Edges to server objects must be annotated with @waterfall
        if waterfall_directive.is_none() {
            self.push_missing_waterfall(field_type.name.item, field_location);
        }
        let document_name = self.document_name.expect("We are within a document");
        let client_edge_query_name = self.generate_query_name(document_name.item);

        let should_generate_query =
            if let ExecutableDefinitionName::FragmentDefinitionName(fragment_name) =
                document_name.item
            {
                // For base fragments we don't need to generate refetch queries
                !self.base_fragment_names.contains(&fragment_name)
            } else {
                true
            };
        if should_generate_query {
            let type_name = self.program.schema.get_type_name(field_type.type_.inner());
            self.generate_client_edge_query(
                client_edge_query_name,
                field_type.type_.inner(),
                selections,
                vec![
                    Diagnostic::error(
                        ValidationMessage::ClientEdgeServerTypeNotRefetchable {
                            field_name: field_type.name.item,
                            server_type_name: ObjectName(type_name),
                        },
                        field_location,
                    )
                    .annotate_if_location_exists("field defined here", field_type.name.location),
                ],
            );
        }

        ClientEdgeMetadataDirective::ServerObject {
            query_name: client_edge_query_name,
            unique_id: self.get_key(),
        }
    }

    /// Returns true if `field_type` is backed by a MAGIC FRAGMENT: a Relay
    /// Resolver declaring a `@returnFragment`. Such resolvers shadow a server
    /// field and return a pointer read off the already-normalized record (no
    /// waterfall), so they are routed through the `ClientObject` edge in suppress
    /// mode rather than the regular client-object / server-object client-edge
    /// paths.
    ///
    /// This used to say "shadow resolver". It is worth being exact, because the
    /// two are not the same and reading them as synonyms has produced wrong
    /// designs more than once. A shadow resolver is one whose parent is a server
    /// type and whose return type is an interface the runtime picks an arm of;
    /// declaring `@returnFragment` is an ADDITIONAL property that only some of
    /// them have. `@returnFragment` therefore identifies the magic-fragment
    /// subset, never the family.
    fn shadow_resolver_info(&self, field_type: &schema::Field) -> Option<ResolverInfo> {
        // `get_resolver_info` may surface diagnostics, but those are also raised
        // (and reported) by the `relay_resolvers` field transform that runs
        // after this pass. Here we only need the resolver signal, so we ignore
        // any diagnostics. Surfacing the full `ResolverInfo` (rather than a bool)
        // lets the caller also read resolver-declared facts like `@mayWaterfall`.
        match get_resolver_info(&self.program.schema, field_type, field_type.name.location) {
            Some(Ok(resolver_info)) if resolver_info.return_fragment.is_some() => {
                Some(resolver_info)
            }
            _ => None,
        }
    }

    /// If `field_type` is declared on an interface or union, returns the concrete
    /// implementor object ids; otherwise `None`. Used by the typegen pipeline to
    /// re-derive the per-implementor arms the operation pipeline fans out.
    fn abstract_parent_implementors(&self, field_type: &schema::Field) -> Option<Vec<ObjectID>> {
        // The cases of a server abstract type that client types implement mint
        // their own queries.
        if let Some(parent_type) = field_type.parent_type
            && has_client_implementors(&self.program.schema, parent_type)
        {
            return None;
        }
        match field_type.parent_type {
            Some(Type::Interface(interface_id)) => Some(
                self.program
                    .schema
                    .interface(interface_id)
                    .recursively_implementing_objects(Arc::as_ref(&self.program.schema))
                    .into_iter()
                    .collect(),
            ),
            Some(Type::Union(union_id)) => {
                Some(self.program.schema.union(union_id).members.clone())
            }
            _ => None,
        }
    }

    /// For an abstract-typed field on the un-fanned typegen IR, emit one
    /// `ClientEdgeQuery` per implementor whose concrete field is a
    /// client-edge-to-server-object — matching, by name and selections, the
    /// queries the operation pipeline mints from the fanned per-concrete arms.
    /// The implementor type name is spliced into the generated path so the query
    /// name matches the fanned pipeline, where the field sits inside a
    /// `... on Implementor` arm.
    fn generate_typegen_self_projected_queries(
        &mut self,
        field: &LinkedField,
        field_type: &schema::Field,
        members: &[ObjectID],
        new_selections: &[Selection],
    ) {
        let field_name = field_type.name.item;
        let document_name = match self.document_name {
            Some(document_name) => document_name,
            None => return,
        };
        let should_generate_query = match document_name.item {
            ExecutableDefinitionName::FragmentDefinitionName(fragment_name) => {
                !self.base_fragment_names.contains(&fragment_name)
            }
            _ => true,
        };

        let mut sorted_members = members.to_vec();
        sorted_members.sort();
        for object_id in sorted_members {
            let concrete_type = Type::Object(object_id);
            let Some(concrete_field_id) =
                self.program.schema.named_field(concrete_type, field_name)
            else {
                continue;
            };
            if !concrete_field_requires_waterfall(self.program.schema.as_ref(), concrete_field_id) {
                continue;
            }
            let edge_target = self.program.schema.field(concrete_field_id).type_.inner();
            let projected = project_interface_selections_to_concrete(
                self.program.schema.as_ref(),
                edge_target,
                new_selections,
            );

            // The path currently ends with this field's leaf name; temporarily
            // insert the implementor type name before the leaf to mirror the
            // `... on Implementor` arm the fanned pipeline produces, then restore.
            let leaf = self.path.pop();
            let type_name = self.program.schema.get_type_name(concrete_type);
            self.path.push(type_name.lookup());
            if let Some(leaf) = leaf {
                self.path.push(leaf);
            }
            let query_name = self.generate_query_name(document_name.item);
            if leaf.is_some() {
                self.path.pop();
            }
            self.path.pop();
            if let Some(leaf) = leaf {
                self.path.push(leaf);
            }

            if should_generate_query {
                let schema_field = self.program.schema.field(field.definition.item);
                let server_type_name = self.program.schema.get_type_name(edge_target);
                self.generate_client_edge_query(
                    query_name,
                    edge_target,
                    projected,
                    vec![
                        Diagnostic::error(
                            ValidationMessage::ClientEdgeServerTypeNotRefetchable {
                                field_name: schema_field.name.item,
                                server_type_name: ObjectName(server_type_name),
                            },
                            field.definition.location,
                        )
                        .annotate_if_location_exists(
                            "field defined here",
                            schema_field.name.location,
                        ),
                    ],
                );
            }
        }
    }

    fn transform_linked_field_impl(&mut self, field: &LinkedField) -> Transformed<Selection> {
        let schema = &self.program.schema;
        let field_type = schema.field(field.definition.item);

        // Eventually we will want to enable client edges on non-resolver client
        // schema extensions, but we'll start with limiting them to resolvers.
        let resolver_directive = field_type.directives.named(*RELAY_RESOLVER_DIRECTIVE_NAME);

        let is_client_edge = is_client_edge_field(field_type);

        let waterfall_directive = field
            .directives()
            .named(*CLIENT_EDGE_WATERFALL_DIRECTIVE_NAME);

        if !is_client_edge {
            // Non-Client-Edge fields do not incur a waterfall, and thus should
            // not be annotated with @waterfall.
            if let Some(directive) = waterfall_directive {
                self.push_unexpected_waterfall(directive.location);
            }

            // The typegen pipeline runs on the un-fanned IR, so a field selected
            // on an abstract type is seen here as a plain interface/union field
            // rather than as the per-concrete arms the operation pipeline fans it
            // into. When an implementor's version of the field is a
            // client-edge-to-server-object, the operation pipeline mints a
            // `ClientEdgeQuery` for it from that arm; typegen must mint the same
            // query (by name and selections) so artifact generation can pair each
            // operation with its typegen twin. Transform the child selections once
            // and reuse them for both the generated queries and the returned
            // field, so nested client edges are not visited twice.
            // Gate on the same flag as the operation-pipeline fan-out
            // (`relay_resolvers_abstract_types`, gated on
            // `relay_resolver_enable_interface_output_type`). Without this, when
            // the flag is off the operation pipeline mints no per-implementor
            // `ClientEdgeQuery` but typegen would still self-project one — the
            // reverse-orphan of the panic this branch exists to prevent.
            if self.is_typegen
                && self
                    .project_config
                    .feature_flags
                    .relay_resolver_enable_interface_output_type
                    .is_fully_enabled()
                && let Some(members) = self.abstract_parent_implementors(field_type)
            {
                let new_selections = self
                    .transform_selections(&field.selections)
                    .replace_or_else(|| field.selections.clone());
                self.generate_typegen_self_projected_queries(
                    field,
                    field_type,
                    &members,
                    &new_selections,
                );
                return Transformed::Replace(Selection::LinkedField(Arc::new(LinkedField {
                    selections: new_selections,
                    ..field.clone()
                })));
            }

            return self.default_transform_linked_field(field);
        }

        self.verify_directives_or_push_errors(&field.directives);

        let edge_to_type = field_type.type_.inner();

        let is_edge_to_client_object =
            schema.is_extension_type(edge_to_type) || has_client_implementors(schema, edge_to_type);

        let new_selections = self
            .transform_selections(&field.selections)
            .replace_or_else(|| field.selections.clone());

        // Magic fragment: a resolver that shadows a server field and returns a
        // pointer (DataID) read off a normalized record. Its consumer selections
        // are always transplanted onto the shadowed server field in the main
        // operation (see `shadow_transplant_selection`), which serves the common
        // case -- pointer targets the shadowed record -- from the store with no
        // waterfall. Route it through the shared `ClientObject` machinery:
        // client-extension members get their model resolvers via the existing
        // `@edgeTo` dispatch; server members either suppress the `ClientEdgeQuery`
        // (transplant-only) or also generate one as a cross-object refetch
        // backstop, selected by `@waterfall` below.
        //
        // Gated on the feature flag first so non-adopting projects skip the
        // `get_resolver_info` reparse inside `shadow_resolver_info` for every
        // client edge: a valid magic fragment can only exist when
        // `enable_shadow_resolvers` is fully enabled.
        // A shadow resolver (`@returnFragment`) whose return type is a CONCRETE
        // `@weak` model has no DataID pointer and no server record to transplant:
        // the weak value is produced by the resolver and read INLINE off
        // `<Type>____relay_model_instance`. It must NOT enter the magic-fragment
        // transplant branch (which transplants consumer selections onto a shadowed
        // *server* field). Instead it falls through to the regular client-object
        // path below, where the `Type::Object` arm builds a `ClientObject` with
        // empty `model_resolvers` (a `@weak` object yields no model resolver) and
        // the value is read inline. The `field_transform` routing already marks it
        // as the inline `Composite`/WeakModel arm. The `@returnFragment`
        // `@rootFragment` data dependency (and its `@__relay_shadow_return` marker)
        // is consumed/stripped by the normal resolver + codegen passes.
        let is_concrete_weak_return = edge_to_type.is_weak_resolver_object(schema.as_ref());

        let shadow_resolver_info = if self
            .project_config
            .feature_flags
            .enable_shadow_resolvers
            .is_fully_enabled()
            && !is_concrete_weak_return
        {
            self.shadow_resolver_info(field_type)
        } else {
            None
        };
        if let Some(resolver_info) = shadow_resolver_info {
            // A PLURAL shadow resolver cannot carry `@waterfall`: the refetch
            // backstop is a `node(id:)` query, which is inherently singular, and
            // there is no plural refetch path. Reject it here (rather than in
            // `shadow_transform`) because `@waterfall` is a per-use-site directive,
            // visible per occurrence only at this client-edge transform.
            if field_type.type_.is_list()
                && let Some(waterfall) = waterfall_directive
            {
                self.errors.push(Diagnostic::error(
                    ValidationMessage::MagicFragmentPluralWaterfallUnsupported {
                        field_name: field_type.name.item,
                    },
                    waterfall.location,
                ));
                return Transformed::Keep;
            }

            // Whether a magic fragment can return a pointer to a DIFFERENT server
            // object is a runtime property the compiler cannot decide statically,
            // so the RESOLVER declares it once via `@mayWaterfall`. That single
            // declaration drives `@waterfall` enforcement uniformly across every
            // consumer, rather than each consumer opting in ad hoc:
            //   - declared   -> each consumer MUST acknowledge the possible
            //     cross-object refetch with `@waterfall` (else `MissingWaterfall`).
            //   - undeclared -> the resolver only ever returns the shadowed
            //     record, served by the transplant, so a consumer `@waterfall`
            //     is unexpected (`UnexpectedWaterfall`).
            //
            // The transplant always runs, so the common case (pointer targets the
            // shadowed record) is served from the store with no roundtrip. When
            // the resolver may waterfall, server members ALSO generate a
            // `ClientEdgeQuery` cross-object refetch backstop that the runtime's
            // client-edge availability check fires only when the returned pointer
            // is missing from the store.
            let magic_fragment_waterfall = resolver_info.may_waterfall;

            if magic_fragment_waterfall {
                if waterfall_directive.is_none() {
                    // On this error path the metadata directive is still built
                    // below in `GenerateWaterfallOperations` mode (the field has
                    // no `@waterfall`), but the pushed error aborts compilation
                    // before that artifact is emitted -- matching the
                    // collect-errors-and-continue pattern used elsewhere here.
                    self.errors.push(Diagnostic::error_with_data(
                        ValidationMessageWithData::RelayResolversMissingWaterfall {
                            field_name: field_type.name.item,
                        },
                        field.definition.location,
                    ));
                }
            } else if let Some(directive) = waterfall_directive {
                // The field IS backed by client-edge machinery, so the generic
                // "unexpected @waterfall" message would mislead; point the author
                // at the resolver's missing `@mayWaterfall` declaration instead.
                self.errors.push(Diagnostic::error_with_data(
                    ValidationMessageWithData::MagicFragmentUnexpectedWaterfall {
                        field_name: field_type.name.item,
                    },
                    directive.location,
                ));
            }

            // A client-extension member is read through the model-resolver edge,
            // which needs the consumer's interface selection expanded into
            // per-concrete typed arms by `relay_resolvers_abstract_types`. That
            // expansion only happens when `relay_resolver_enable_interface_output_type`
            // is fully enabled; without it the spread-transform partition would
            // have no client arm to drop and we would silently emit a server-only
            // artifact that drops the client data. Fail loudly instead.
            if self.magic_fragment_edge_has_client_extension_implementor(edge_to_type)
                && !self
                    .project_config
                    .feature_flags
                    .relay_resolver_enable_interface_output_type
                    .is_fully_enabled()
            {
                self.errors.push(Diagnostic::error(
                    ValidationMessage::MagicFragmentClientImplementorRequiresInterfaceOutputType {
                        field_name: field_type.name.item,
                        interface_name: schema.get_type_name(edge_to_type),
                    },
                    field.definition.location,
                ));
                return Transformed::Keep;
            }

            // A magic fragment reaches server data by construction, so it needs
            // the identity-only rule applied WITH the corridor below rather than
            // skipped: the corridor is what distinguishes the transplant's own
            // path, which the main operation fetches, from a field beside it that
            // nothing fetches. This branch returns early, so without the call here
            // a magic fragment's root fragment is never checked at all.
            self.validate_s2c_root_fragment_for_exec_time(field);

            let metadata_directive = match self
                .get_edge_to_magic_fragment_client_object_metadata_directive(
                    field,
                    edge_to_type,
                    magic_fragment_waterfall,
                    &new_selections,
                ) {
                Some(directive) => directive,
                None => return Transformed::Keep,
            };
            let inline_fragment =
                create_inline_fragment_for_client_edge(field, new_selections, metadata_directive);
            return Transformed::Replace(Selection::InlineFragment(Arc::new(inline_fragment)));
        }

        let metadata_directive = if is_edge_to_client_object {
            // Validate S2C @rootFragment identity-only constraint
            self.validate_s2c_root_fragment_for_exec_time(field);
            match self.get_edge_to_client_object_metadata_directive(
                field,
                edge_to_type,
                waterfall_directive,
                resolver_directive,
                &new_selections,
            ) {
                Some(directive) => directive,
                None => return Transformed::Keep,
            }
        } else {
            // Client-to-server edges are now supported in exec time resolvers
            // (validation removed to enable C2S support)
            //
            // The identity-only rule still applies though. What the resolver
            // RETURNS says nothing about what its root fragment can see, and this
            // branch was the last of the three field shapes reaching the
            // transform without being checked.
            self.validate_s2c_root_fragment_for_exec_time(field);
            self.get_edge_to_server_object_metadata_directive(
                field_type,
                field.definition.location,
                waterfall_directive,
                new_selections.clone(),
            )
        };

        let inline_fragment =
            create_inline_fragment_for_client_edge(field, new_selections, metadata_directive);

        Transformed::Replace(Selection::InlineFragment(Arc::new(inline_fragment)))
    }

    fn get_key(&mut self) -> u32 {
        let key = self.next_key;
        self.next_key += 1;
        key
    }
}

fn create_inline_fragment_for_client_edge(
    field: &LinkedField,
    selections: Vec<Selection>,
    metadata_directive: ClientEdgeMetadataDirective,
) -> InlineFragment {
    let mut inline_fragment_directives: Vec<Directive> = vec![metadata_directive.into()];
    if let Some(required_directive_metadata) = field
        .directives
        .named(RequiredMetadataDirective::directive_name())
        .cloned()
    {
        inline_fragment_directives.push(required_directive_metadata);
    }
    if let Some(catch_directive_metadata) = field
        .directives
        .named(CatchMetadataDirective::directive_name())
        .cloned()
    {
        inline_fragment_directives.push(catch_directive_metadata);
    }

    // The transformed_field (used as linkedField in codegen) strips only
    // CatchMetadataDirective to prevent double-wrapping in CatchField.
    // RequiredMetadataDirective is kept so codegen generates non-nullable types.
    let transformed_field_directives: Vec<Directive> = field
        .directives()
        .iter()
        .filter(|directive| directive.name.item != CatchMetadataDirective::directive_name())
        .cloned()
        .collect();

    let transformed_field = Arc::new(LinkedField {
        selections: selections.clone(),
        directives: transformed_field_directives,
        ..field.clone()
    });

    // The backing_field strips both @required and @catch metadata since
    // they have been lifted to the inline fragment level.
    let backing_field_directives: Vec<Directive> = field
        .directives()
        .iter()
        .filter(|directive| {
            directive.name.item != RequiredMetadataDirective::directive_name()
                && directive.name.item != CatchMetadataDirective::directive_name()
        })
        .cloned()
        .collect();

    let backing_field = Arc::new(LinkedField {
        selections,
        directives: backing_field_directives,
        ..field.clone()
    });

    InlineFragment {
        type_condition: None,
        directives: inline_fragment_directives,
        selections: vec![
            // NOTE: This creates 2^H selecitons where H is the depth of nested client edges
            Selection::LinkedField(Arc::clone(&backing_field)),
            Selection::LinkedField(Arc::clone(&transformed_field)),
        ],
        spread_location: Location::generated(),
    }
}

impl Transformer<'_> for ClientEdgesTransform<'_, '_> {
    const NAME: &'static str = "ClientEdgesTransform";
    const VISIT_ARGUMENTS: bool = false;
    const VISIT_DIRECTIVES: bool = false;

    fn transform_fragment(
        &mut self,
        fragment: &FragmentDefinition,
    ) -> Transformed<FragmentDefinition> {
        self.document_name = Some(fragment.name.map(|name| name.into()));

        // Check if this fragment is used within an exec time resolver operation
        let fragment_in_exec_time_operation = self
            .fragments_in_exec_time_operations
            .contains(&fragment.name.item);

        let previous_exec_time_resolvers = self.has_exec_time_resolvers;
        self.has_exec_time_resolvers =
            previous_exec_time_resolvers || fragment_in_exec_time_operation;

        // A fragment reachable from any read-time-capable operation is absent from
        // the unconditional set, so it keeps its refetch operations.
        let previous_unconditional = self.is_unconditional_exec_time;
        self.is_unconditional_exec_time = previous_unconditional
            || self
                .fragments_in_unconditional_exec_time_operations
                .contains(&fragment.name.item);

        let new_fragment = self.default_transform_fragment(fragment);

        // Restore the previous state
        self.has_exec_time_resolvers = previous_exec_time_resolvers;
        self.is_unconditional_exec_time = previous_unconditional;
        self.document_name = None;
        new_fragment
    }

    fn transform_operation(
        &mut self,
        operation: &OperationDefinition,
    ) -> Transformed<OperationDefinition> {
        self.document_name = Some(operation.name.map(|name| name.into()));

        // Check if this operation has the @exec_time_resolvers directive
        self.has_exec_time_resolvers = operation
            .directives
            .named(*EXEC_TIME_RESOLVERS_DIRECTIVE_NAME)
            .is_some();
        self.is_unconditional_exec_time = is_unconditional_exec_time(&operation.directives);

        let new_operation = self.default_transform_operation(operation);

        // Reset the flags after processing the operation
        self.has_exec_time_resolvers = false;
        self.is_unconditional_exec_time = false;
        self.document_name = None;
        new_operation
    }

    fn transform_inline_fragment(&mut self, fragment: &InlineFragment) -> Transformed<Selection> {
        match fragment
            .type_condition
            .map(|type_| self.program.schema.get_type_name(type_))
        {
            Some(type_name) => {
                self.path.push(type_name.lookup());

                let new_inline_fragment = self.default_transform_inline_fragment(fragment);
                self.path.pop();

                new_inline_fragment
            }
            None => self.default_transform_inline_fragment(fragment),
        }
    }

    fn transform_linked_field(&mut self, field: &LinkedField) -> Transformed<Selection> {
        self.path
            .push(field.alias_or_name(&self.program.schema).lookup());

        let new_linked_field = self.transform_linked_field_impl(field);

        self.path.pop();

        new_linked_field
    }

    fn transform_scalar_field(
        &mut self,
        field: &graphql_ir::ScalarField,
    ) -> Transformed<Selection> {
        if let Some(directive) = field
            .directives()
            .named(*CLIENT_EDGE_WATERFALL_DIRECTIVE_NAME)
        {
            self.push_unexpected_waterfall(directive.location);
        }
        // Validate S2C @rootFragment identity-only constraint
        self.validate_s2c_root_fragment_for_exec_time(field);
        self.default_transform_scalar_field(field)
    }
}

impl ClientEdgesTransform<'_, '_> {
    /// Validate that an S2C resolver's @rootFragment only selects __typename and/or id
    /// when used inside @exec_time_resolvers queries.
    fn validate_s2c_root_fragment_for_exec_time<T: graphql_ir::Field>(&mut self, field: &T) {
        if !self.has_exec_time_resolvers {
            return;
        }
        let field_type: &schema::Field = self.program.schema.field(field.definition().item);
        // Only validate S2C fields: client extension fields on server types.
        //
        // `Query` is included. It used to be carved out entirely, on the grounds
        // that a Query-rooted resolver reads only client state — but one whose
        // root fragment reads SERVER data crosses exactly the same boundary, and
        // exec time projects it from the response identically, so the carve-out
        // was hiding the very case this rule exists to catch.
        //
        // The legitimate half of that carve-out survives as `allow_client_fields`
        // below: reading a client-extension field from a Query-rooted root
        // fragment is resolver composition, not payload projection, so it keeps
        // working and must keep compiling.
        let parent_type = match field_type.parent_type {
            Some(parent_type) if !self.program.schema.is_extension_type(parent_type) => parent_type,
            _ => return,
        };
        let allow_client_fields = Some(parent_type) == self.program.schema.query_type();
        let resolver_directive = field_type.directives.named(*RELAY_RESOLVER_DIRECTIVE_NAME);
        if resolver_directive.is_none() {
            return;
        }
        // Get the fragment_name from the resolver directive
        let fragment_name_arg = resolver_directive.and_then(|d| {
            d.arguments
                .iter()
                .find(|a| a.name.0 == FRAGMENT_KEY_ARGUMENT_NAME.0)
        });
        let fragment_name = match fragment_name_arg {
            Some(arg) => match arg.get_string_literal() {
                Some(s) => s,
                None => return,
            },
            None => {
                self.validate_s2c_resolver_has_root_fragment(field, field_type, parent_type);
                return;
            }
        };
        // Look up the fragment definition
        let fragment_def_name = FragmentDefinitionName(fragment_name);
        let fragment = match self.program.fragment(fragment_def_name) {
            Some(f) => f,
            None => return, // Fragment not found — other validation will catch this
        };
        let id_field_name = self.project_config.schema_config.node_interface_id_field;
        let mut errors = vec![];
        validate_s2c_selections(
            &self.program.schema,
            &fragment.selections,
            fragment_name,
            id_field_name,
            allow_client_fields,
            get_resolver_return_fragment_name(field_type),
            &mut errors,
        );
        self.errors.extend(errors);
    }

    /// An exec-time resolver on a server type is scheduled by its `@rootFragment`:
    /// the normalizer collects it for each record the response holds, and nothing
    /// else does. Without one it never runs and the field reads `undefined` with
    /// no error.
    ///
    /// `Query` is exempt: the executor builds its resolvers with the query root
    /// before any response arrives (`@exec_time_resolvers` is query-only, so no
    /// other root type reaches here). A client-to-server edge is exempt too,
    /// because the executor cannot run one under a server record with or without
    /// a root fragment, so requiring one would only move the failure to runtime.
    fn validate_s2c_resolver_has_root_fragment<T: graphql_ir::Field>(
        &mut self,
        field: &T,
        field_type: &schema::Field,
        parent_type: Type,
    ) {
        let schema = &self.program.schema;
        let return_type = field_type.type_.inner();
        let is_edge_to_server_object =
            return_type.is_composite_type() && !schema.is_extension_type(return_type);
        if Some(parent_type) == schema.query_type() || is_edge_to_server_object {
            return;
        }
        self.errors.push(
            Diagnostic::error(
                ValidationMessage::S2CResolverMissingRootFragment {
                    parent_type: schema.get_type_name(parent_type),
                    field_name: field_type.name.item,
                },
                field.alias_or_name_location(),
            )
            .annotate("Resolver defined here", field_type.name.location),
        );
    }
}

/// Whether this linked field is the one the resolver's own MAGIC FRAGMENT is
/// transplanted onto, `return_fragment` being that resolver's `@returnFragment`.
///
/// The marker alone does not say that. `shadow_return_conversion` rewrites the
/// root fragment's DEFINITION, so every resolver sharing that root fragment sees
/// the marker, but `spread_transform` only transplants onto the one naming the
/// resolver's own `@returnFragment`. For any other sharer the marked field is an
/// ordinary server link that nothing transplants onto.
///
/// Magic fragments are a proper subset of shadow resolvers: a shadow resolver is
/// one whose parent is a server type and whose return type is an interface the
/// runtime picks an arm of, and it need not declare `@returnFragment` at all.
/// Only the ones that do get a transplant, and only a transplant makes
/// non-identity selections safe to read — so this predicate is deliberately about
/// the magic fragment, not about shadow resolvers in general. A shadow resolver
/// without a transplant either has no root fragment, in which case nothing here
/// looks at it, or has one that reads server data, which is restricted like any
/// other.
///
/// `client_edges` runs before `relay_resolvers`, so the marker here is still the
/// raw `@__relay_shadow_return` directive that `shadow_return_conversion` injects
/// before `build_ir`; `shadow_transform` only turns it into the typed
/// `ShadowReturnMarker` later. Keying on the raw directive is still forgery-safe,
/// because that same conversion pass rejects any user-authored occurrence of it.
fn is_magic_fragment_target(
    field: &LinkedField,
    return_fragment: Option<FragmentDefinitionName>,
) -> bool {
    return_fragment.is_some() && shadow_return_directive_fragment_name(field) == return_fragment
}

fn selections_contain_magic_fragment(
    selections: &[Selection],
    return_fragment: Option<FragmentDefinitionName>,
) -> bool {
    return_fragment.is_some_and(|name| selections_contain_shadow_return_marker(selections, name))
}

/// Name of the escape hatch declared in `relay-extensions.graphql`.
static UNSTABLE_KEY_DIRECTIVE_NAME: LazyLock<DirectiveName> =
    LazyLock::new(|| DirectiveName("UNSTABLE_key".intern()));
static UNSTABLE_KEY_FIELDS_ARGUMENT_NAME: LazyLock<ArgumentName> =
    LazyLock::new(|| ArgumentName("fields".intern()));

/// The fields `@UNSTABLE_key` lets an exec-time S2C root fragment read on `type_`, beyond
/// identity.
///
/// `Err` carries a malformed field set. Only a space-separated list of flat field
/// names is accepted; the composite-schemas spec's nested form (`"a { b }"`) is
/// not. Splitting one of those on whitespace would hand back `a`, `{`, `b`, `}`
/// and so GRANT `a` — a field the author only meant to qualify — which is why
/// this rejects rather than parses what it can.
fn key_granted_fields(schema: &SDLSchema, type_: Type) -> Result<HashSet<StringKey>, StringKey> {
    let directives = match type_ {
        Type::Object(id) => &schema.object(id).directives,
        Type::Interface(id) => &schema.interface(id).directives,
        _ => return Ok(HashSet::new()),
    };

    let mut granted = HashSet::new();
    // `@UNSTABLE_key` is repeatable, so every occurrence contributes.
    for directive in directives
        .iter()
        .filter(|d| d.name == *UNSTABLE_KEY_DIRECTIVE_NAME)
    {
        let Some(field_set) = directive
            .arguments
            .iter()
            .find(|argument| argument.name == *UNSTABLE_KEY_FIELDS_ARGUMENT_NAME)
            .and_then(|argument| argument.get_string_literal())
        else {
            continue;
        };
        let field_set_str = field_set.lookup();
        if field_set_str
            .chars()
            .any(|c| !c.is_ascii_alphanumeric() && c != '_' && !c.is_ascii_whitespace())
        {
            return Err(field_set);
        }
        granted.extend(field_set_str.split_whitespace().map(|name| name.intern()));
    }
    Ok(granted)
}

/// Checks that a server-to-client resolver's root fragment selects nothing but
/// identity, allowing the magic fragment's transplant path through.
///
/// A walk rather than a flat check because of that path. The shadowed field can
/// sit several server links below the root — production has
/// `ad_campaign_groups { nodes @__relay_shadow_return { ... } }` — so its
/// ancestors have to be walked through rather than rejected on sight.
///
/// Those ancestors are a corridor, not a blanket exemption: every sibling is
/// still checked on its own, so an unrelated field standing next to the shadowed
/// one is still rejected rather than carried in by its neighbour.
///
/// The walk does NOT stop at a marker-bearing field. It used to, on the grounds
/// that the selections below one are the consumer's — transplanted there by the
/// compiler, and therefore genuinely fetched by the main operation. But the
/// transplant has not run yet at this point: what is actually below the marker
/// is the `id`/`__typename` that `shadow_return_conversion` injected in place of
/// the placeholder, plus anything the author wrote beside it. Stopping let that
/// author-written sibling through unchecked.
///
/// `allow_client_fields` is decided ONCE, from the resolver FIELD's parent type,
/// and holds for the whole walk rather than being re-decided per level. So in a
/// Query-rooted fragment a client-extension field stays permitted even below a
/// server corridor, where its own parent is no longer `Query`. Reaching that
/// needs the resolver's own magic fragment: every other server link is rejected
/// outright, and a client-extension link is skipped without descending into it.
fn validate_s2c_selections(
    schema: &SDLSchema,
    selections: &[Selection],
    fragment_name: StringKey,
    id_field_name: StringKey,
    allow_client_fields: bool,
    return_fragment: Option<FragmentDefinitionName>,
    errors: &mut Vec<Diagnostic>,
) {
    let typename_field_name = "__typename".intern();
    // The universal DataID. `shadow_return_conversion` injects it below the
    // marker in place of the placeholder for every ALL-INLINE return — a
    // non-`Node` server value, or an abstract return with any inline implementor
    // — and injects `id` only for the strong/`EdgeTo` pointer arm. So a shadow
    // resolver's own generated identity is `__id`, not `id`, for a whole class
    // of return shapes, and rejecting it rejects code the compiler itself wrote.
    //
    // Only reachable since the walk began descending into marker-bearing fields;
    // before that it never saw the injected identity at all. It stayed hidden
    // afterwards because every existing exec-time shadow is Query-rooted, where
    // `allow_client_fields` skips `__id` as an extension field before this check
    // — an accident, not a rule, and it does not hold for a server-typed parent.
    let clientid_field_name = schema.field(schema.clientid_field()).name.item;
    for selection in selections {
        match selection {
            Selection::ScalarField(scalar_field) => {
                let sel_field = schema.field(scalar_field.definition.item);
                if allow_client_fields && sel_field.is_extension {
                    continue;
                }
                let sel_field_name = sel_field.name.item;
                if sel_field_name == typename_field_name
                    || sel_field_name == id_field_name
                    || sel_field_name == clientid_field_name
                {
                    continue;
                }
                // `@UNSTABLE_key` on the field's OWN parent type, rather than on whichever
                // type the root fragment happens to be spread on.
                //
                // That parent type is the one the SELECTION resolved against, not
                // every type declaring the field, so an interface grant does NOT
                // reach the same field selected on an implementor: `display_name`
                // under `... on Actor` picks up a grant on `Actor`, while
                // `display_name` selected directly on `User` does not.
                // `exec_time_s2c_root_fragment_key_on_interface` pins both.
                match sel_field
                    .parent_type
                    .map(|parent_type| key_granted_fields(schema, parent_type))
                {
                    Some(Ok(granted)) if granted.contains(&sel_field_name) => {
                        // A grant is only meaningful for a SERVER field with no
                        // arguments. Checked where the grant is consulted rather
                        // than where it is written, because only here is the
                        // field resolved against its parent type.
                        let parent_type_name =
                            schema.get_type_name(sel_field.parent_type.expect("matched above"));
                        if sel_field.is_extension {
                            errors.push(Diagnostic::error(
                                ValidationMessage::KeyDirectiveClientField {
                                    type_name: parent_type_name,
                                    field_name: sel_field_name,
                                },
                                scalar_field.definition.location,
                            ));
                        } else if !sel_field.arguments.is_empty() {
                            errors.push(Diagnostic::error(
                                ValidationMessage::KeyDirectiveFieldWithArguments {
                                    type_name: parent_type_name,
                                    field_name: sel_field_name,
                                },
                                scalar_field.definition.location,
                            ));
                        }
                        continue;
                    }
                    Some(Err(field_set)) => {
                        errors.push(Diagnostic::error(
                            ValidationMessage::KeyDirectiveUnsupportedFieldSet {
                                type_name: schema.get_type_name(
                                    sel_field.parent_type.expect("checked by the match arm"),
                                ),
                                field_set,
                            },
                            scalar_field.definition.location,
                        ));
                        continue;
                    }
                    _ => {}
                }
                errors.push(Diagnostic::error(
                    ValidationMessage::S2CRootFragmentInvalidSelection {
                        fragment_name,
                        field_name: sel_field_name,
                    },
                    scalar_field.definition.location,
                ));
            }
            Selection::LinkedField(linked_field) => {
                if is_magic_fragment_target(linked_field, return_fragment) {
                    // Descend rather than skip. At this point the shadowed
                    // field's children are the `id`/`__typename` that
                    // `shadow_return_conversion` injected in place of the
                    // placeholder, PLUS anything the author wrote beside it —
                    // the transplant that brings the consumer's selections here
                    // has not run yet. Skipping the subtree let an author-written
                    // sibling through unchecked, which is the same smuggling the
                    // corridor prevents one level up: nothing fetches it, so it
                    // reads back undefined at exec time. The injected identity
                    // passes the check below on its own.
                    validate_s2c_selections(
                        schema,
                        &linked_field.selections,
                        fragment_name,
                        id_field_name,
                        allow_client_fields,
                        return_fragment,
                        errors,
                    );
                    continue;
                }
                // Everything below a client-extension link is reached through
                // resolver composition, never projected from the payload.
                if allow_client_fields && schema.field(linked_field.definition.item).is_extension {
                    continue;
                }
                if selections_contain_magic_fragment(&linked_field.selections, return_fragment) {
                    validate_s2c_selections(
                        schema,
                        &linked_field.selections,
                        fragment_name,
                        id_field_name,
                        allow_client_fields,
                        return_fragment,
                        errors,
                    );
                    continue;
                }
                errors.push(Diagnostic::error(
                    ValidationMessage::S2CRootFragmentInvalidSelection {
                        fragment_name,
                        field_name: linked_field.alias_or_name(schema),
                    },
                    linked_field.alias_or_name_location(),
                ));
            }
            Selection::FragmentSpread(fragment_spread) => {
                // Its own diagnostic, because the generic one offers `@UNSTABLE_key` as
                // the fix and a spread cannot be granted. Not the placeholder
                // spread either — `shadow_return_conversion` replaces that with
                // the injected identity before `build_ir`, so by the time this
                // walk runs a spread here is an ordinary one the author wrote.
                errors.push(Diagnostic::error(
                    ValidationMessage::S2CRootFragmentUnsupportedSpread {
                        fragment_name,
                        spread_name: fragment_spread.fragment.item.0,
                    },
                    fragment_spread.fragment.location,
                ));
            }
            Selection::InlineFragment(inline_fragment) => {
                // An inline fragment selects nothing itself — it refines a type
                // and defers to its contents, which are checked here field by
                // field. Rejecting the spread outright therefore refused shapes
                // whose every selection was legal, and forced an author with a
                // perfectly good `... on User { id }` to restructure the
                // fragment. The blame also landed on the type condition rather
                // than on whatever field was actually unreadable.
                validate_s2c_selections(
                    schema,
                    &inline_fragment.selections,
                    fragment_name,
                    id_field_name,
                    allow_client_fields,
                    return_fragment,
                    errors,
                );
            }
            Selection::Condition(condition) => {
                // Also its own diagnostic: `@UNSTABLE_key` is no answer to a condition
                // either. `Condition::directive_name` recovers which of the two
                // spellings the author wrote — `passing_value` is the only place
                // that survives into the IR.
                errors.push(Diagnostic::error(
                    ValidationMessage::S2CRootFragmentUnsupportedCondition {
                        fragment_name,
                        directive_name: condition.directive_name().intern(),
                    },
                    condition.location,
                ));
            }
        }
    }
}

fn make_refetchable_directive(query_name: OperationDefinitionName) -> Directive {
    Directive {
        name: WithLocation::generated(*REFETCHABLE_NAME),
        arguments: vec![Argument {
            name: WithLocation::generated(*QUERY_NAME_ARG),
            value: WithLocation::generated(Value::Constant(ConstantValue::String(query_name.0))),
        }],
        data: None,
        location: Location::generated(),
    }
}

pub fn remove_client_edge_selections(program: &Program) -> DiagnosticsResult<Program> {
    let mut transform = ClientEdgesCleanupTransform;
    let next_program = transform
        .transform_program(program)
        .replace_or_else(|| program.clone());

    Ok(next_program)
}

#[derive(Default)]
struct ClientEdgesCleanupTransform;

impl Transformer<'_> for ClientEdgesCleanupTransform {
    const NAME: &'static str = "ClientEdgesCleanupTransform";
    const VISIT_ARGUMENTS: bool = false;
    const VISIT_DIRECTIVES: bool = false;

    fn transform_inline_fragment(&mut self, fragment: &InlineFragment) -> Transformed<Selection> {
        match ClientEdgeMetadata::find(fragment) {
            Some(metadata) => {
                let new_selection = metadata.backing_field;

                Transformed::Replace(
                    self.transform_selection(new_selection)
                        .unwrap_or_else(|| new_selection.clone()),
                )
            }
            None => self.default_transform_inline_fragment(fragment),
        }
    }
}

// We should restructure the calling code so that this function does not
// accept an option.
fn has_output_type(directive: Option<&DirectiveValue>) -> bool {
    match directive {
        Some(directive) => {
            get_bool_argument_is_true(&directive.arguments, *HAS_OUTPUT_TYPE_ARGUMENT_NAME)
        }
        None => false,
    }
}

fn is_client_edge_field(field: &schema::Field) -> bool {
    field.is_extension
        && field
            .directives
            .named(*RELAY_RESOLVER_DIRECTIVE_NAME)
            .is_some()
}

/// Whether `client_edges` can compile a selection of this field differently
/// depending on the operations that reach it: such an edge generates a
/// `ClientEdgeQuery` that inherits `use_exec_time_resolvers` from its callers,
/// or targets a mixed abstract type whose server operations are suppressed only
/// under unconditional exec time. Interface fields count when an implementor's
/// field is such an edge, since `relay_resolvers_abstract_types` fans them out
/// later. Incremental builds rebuild fragments selecting them with all callers.
pub fn is_caller_dependent_client_edge(schema: &SDLSchema, field_id: FieldID) -> bool {
    let field = schema.field(field_id);
    if is_server_reaching_client_edge(schema, field) {
        return true;
    }
    let Some(Type::Interface(interface_id)) = field.parent_type else {
        return false;
    };
    schema
        .interface(interface_id)
        .recursively_implementing_objects(schema)
        .iter()
        .filter_map(|object_id| schema.named_field(Type::Object(*object_id), field.name.item))
        .any(|concrete_field_id| {
            is_server_reaching_client_edge(schema, schema.field(concrete_field_id))
        })
}

fn is_server_reaching_client_edge(schema: &SDLSchema, field: &schema::Field) -> bool {
    let return_type = field.type_.inner();
    if !is_client_edge_field(field) || !return_type.is_composite_type() {
        return false;
    }
    if !schema.is_extension_type(return_type) {
        return true;
    }
    let is_server_object = |object_id: &ObjectID| !schema.object(*object_id).is_extension;
    match return_type {
        Type::Interface(interface_id) => schema
            .interface(interface_id)
            .recursively_implementing_objects(schema)
            .iter()
            .any(is_server_object),
        Type::Union(union_id) => schema.union(union_id).members.iter().any(is_server_object),
        _ => false,
    }
}
