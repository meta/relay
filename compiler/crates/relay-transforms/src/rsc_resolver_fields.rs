/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

use std::hash::Hasher;
use std::path::MAIN_SEPARATOR;
use std::sync::Arc;

use common::ArgumentName;
use common::Diagnostic;
use common::DiagnosticsResult;
use common::Location;
use common::NamedItem;
use common::WithLocation;
use docblock_shared::RELAY_RSC_VALUE_SCALAR_NAME;
use docblock_shared::SERVER_DIRECTIVE;
use docblock_shared::relay_rsc_component_export_name;
use fnv::FnvHashMap;
use fnv::FnvHasher;
use graphql_ir::Argument;
use graphql_ir::ConstantValue;
use graphql_ir::ExecutableDefinitionName;
use graphql_ir::FragmentDefinition;
use graphql_ir::FragmentDefinitionName;
use graphql_ir::FragmentDefinitionNameMap;
use graphql_ir::FragmentDefinitionNameSet;
use graphql_ir::FragmentSpread;
use graphql_ir::InlineFragment;
use graphql_ir::OperationDefinition;
use graphql_ir::OperationDefinitionName;
use graphql_ir::Program;
use graphql_ir::ScalarField;
use graphql_ir::Selection;
use graphql_ir::Transformed;
use graphql_ir::Transformer;
use graphql_ir::ValidationLevel;
use graphql_ir::Value;
use graphql_ir::VariableDefinition;
use graphql_ir::VariableName;
use graphql_ir::associated_data_impl;
use graphql_ir::build_constant_value;
use graphql_syntax::OperationKind;
use intern::Lookup;
use intern::string_key::Intern;
use intern::string_key::StringKey;
use rustc_hash::FxHashSet;
use schema::Field;
use schema::SDLSchema;
use schema::Schema;
use schema::Type;
use schema::TypeReference;

use crate::NO_INLINE_DIRECTIVE_NAME;
use crate::RawResponseGenerationMode;
use crate::SplitOperationMetadata;
use crate::fragment_prop_name;
use crate::generate_relay_resolvers_model_fragments::get_resolver_source_hash;
use crate::get_resolver_fragment_dependency_name;
use crate::relay_resolvers::ResolverInfo;
use crate::relay_resolvers::ResolverSchemaGenType;
use crate::relay_resolvers::get_resolver_info;
use crate::root_variables::InferVariablesVisitor;
use crate::util::get_normalization_operation_name;
use crate::util::pass_through_fragment_variables;

/// Compiler-only recipe for one Resolver-authored `RelayRscValue` selection.
#[derive(Clone, Debug, Eq, Hash, PartialEq)]
pub struct RscSeamMetadata {
    pub definition_id: StringKey,
    pub alias: StringKey,
    pub normalization_operation: OperationDefinitionName,
    pub component_module_name: StringKey,
    pub component_export_name: StringKey,
    pub output: RscSeamOutput,
    pub fragment_name: FragmentDefinitionName,
    pub fragment_location: Location,
    pub local_variable_definitions: Vec<VariableDefinition>,
    pub field_variable_definitions: Vec<VariableDefinition>,
    pub component_arguments: Vec<Argument>,
}
associated_data_impl!(RscSeamMetadata);

impl RscSeamMetadata {
    /// Whether `name` is one of the Resolver field's schema arguments.
    pub fn is_public_argument(&self, name: ArgumentName) -> bool {
        self.field_variable_definitions
            .named(VariableName(name.0))
            .is_some()
    }

    /// Whether `name` is a field argument that only the component receives.
    pub fn is_component_argument(&self, name: ArgumentName) -> bool {
        self.is_public_argument(name)
            && self
                .local_variable_definitions
                .named(VariableName(name.0))
                .is_none()
    }

    /// Field arguments that only the component receives, in schema order.
    pub fn component_argument_names(&self) -> impl Iterator<Item = ArgumentName> + '_ {
        self.field_variable_definitions
            .iter()
            .map(|definition| ArgumentName(definition.name.item.0))
            .filter(|name| self.is_component_argument(*name))
    }
}

/// What a lowered Resolver-authored server field produces.
#[derive(Clone, Copy, Debug, Eq, Hash, PartialEq)]
pub enum RscSeamOutput {
    /// A React Server Component rendering (`RelayRscValue`), carried as Flight.
    Flight,
    /// The plain return value of a Resolver whose root fragment is `@server`
    /// (a server value resolver), stored on the parent record at the
    /// resolver field's own storage key.
    Value { field_name: StringKey },
}

/// Returns the complete argument list shared by RSC seam projections and codegen.
pub fn rsc_seam_arguments(spread: &FragmentSpread, seam: &RscSeamMetadata) -> Vec<Argument> {
    let mut variable_definitions = seam.field_variable_definitions.clone();
    for definition in &seam.local_variable_definitions {
        if !variable_definitions
            .iter()
            .any(|existing| existing.name.item == definition.name.item)
        {
            variable_definitions.push(definition.clone());
        }
    }
    variable_definitions
        .iter()
        .map(|definition| {
            spread
                .arguments
                .iter()
                .chain(seam.component_arguments.iter())
                .find(|argument| argument.name.item.0 == definition.name.item.0)
                .cloned()
                .unwrap_or_else(|| Argument {
                    name: WithLocation::new(
                        definition.name.location,
                        ArgumentName(definition.name.item.0),
                    ),
                    value: WithLocation::new(
                        definition.name.location,
                        Value::Constant(
                            definition
                                .default_value
                                .as_ref()
                                .map_or(ConstantValue::Null(), |value| value.item.clone()),
                        ),
                    ),
                })
        })
        .collect()
}

/// Marks the same seam after it has been retained in `$clientNormalization`.
#[derive(Clone, Debug, Eq, Hash, PartialEq)]
pub struct ClientRscSeamMetadata;
associated_data_impl!(ClientRscSeamMetadata);

pub(crate) fn lower_rsc_resolver_fields(
    program: &Program,
    base_fragment_names: &FragmentDefinitionNameSet,
    enabled: bool,
    has_dynamic_module_provider: bool,
) -> DiagnosticsResult<Program> {
    let mut transform = RscResolverFieldTransform::new(
        program,
        base_fragment_names,
        enabled,
        has_dynamic_module_provider,
    );
    if enabled {
        validate_rsc_component_exports(&program.schema, &mut transform.errors);
    }
    let mut next_program = transform
        .transform_program(program)
        .replace_or_else(|| program.clone());

    if enabled {
        // The project that owns a root fragment writes its normalization
        // artifact even when none of its own documents selects the field, so
        // that derived projects can import it rather than writing a second one.
        let root_fragment_names: FragmentDefinitionNameSet = program
            .schema
            .get_fields()
            .filter(|field| is_rsc_value_field(&program.schema, field))
            .filter_map(get_resolver_fragment_dependency_name)
            .collect();
        for fragment_name in root_fragment_names {
            if let Some(fragment) = program.fragment(fragment_name)
                && !transform.split_operations.contains_key(&fragment_name)
            {
                transform.ensure_split_operation(fragment, fragment_name.into());
            }
        }
    }

    let mut split_operations: Vec<_> = transform.split_operations.drain().collect();
    split_operations.sort_unstable_by_key(|(fragment_name, _)| *fragment_name);
    for (_, (metadata, mut operation)) in split_operations {
        operation.directives.push(metadata.into());
        if next_program.operation(operation.name.item).is_some() {
            transform.errors.push(Diagnostic::error(
                format!(
                    "Relay RSC normalization operation `{}` already exists.",
                    operation.name.item
                ),
                operation.name.location,
            ));
        } else {
            next_program.insert_operation(Arc::new(operation));
        }
    }

    if transform.errors.is_empty() {
        Ok(next_program)
    } else {
        Err(transform.errors)
    }
}

/// The prop an RSC component receives its root fragment under. Projects without
/// the `Module_propName` naming convention may use the whole fragment name.
pub fn rsc_fragment_prop_name(fragment_name: FragmentDefinitionName) -> StringKey {
    fragment_prop_name(fragment_name).unwrap_or(fragment_name.0)
}

/// Two Resolvers mapped to one component export would silently share it, and
/// its signature artifact (a root fragment lives in its Resolver's module), so
/// every RSC field in the schema is compared, not only the selected ones. An
/// interface field and its copies on implementing types are one Resolver: they
/// compare by source hash, not by field.
fn validate_rsc_component_exports(schema: &SDLSchema, errors: &mut Vec<Diagnostic>) {
    let mut exports = FnvHashMap::default();
    for field in schema.get_fields() {
        let is_rsc_value = field
            .type_
            .inner()
            .get_scalar_id()
            .is_some_and(|scalar_id| {
                schema.scalar(scalar_id).name.item == *RELAY_RSC_VALUE_SCALAR_NAME
            });
        if !is_rsc_value {
            continue;
        }
        let (Some(source_hash), Some(Ok(resolver_info))) = (
            get_resolver_source_hash(field),
            get_resolver_info(schema, field, field.name.location),
        ) else {
            continue;
        };
        let Some(component_export_name) = resolver_info.import_name else {
            continue;
        };
        let (previous_hash, previous_field) = *exports
            .entry((resolver_info.import_path, component_export_name))
            .or_insert((source_hash, field.name.item));
        if previous_hash != source_hash {
            errors.push(Diagnostic::error(
                format!(
                    "The RSC fields `{previous_field}` and `{}` both map to the component export `{component_export_name}` of `{}`.",
                    field.name.item, resolver_info.import_path
                ),
                field.name.location,
            ));
        }
    }
}

struct RscResolverFieldTransform<'program> {
    program: &'program Program,
    base_fragment_names: &'program FragmentDefinitionNameSet,
    enabled: bool,
    has_dynamic_module_provider: bool,
    document_name: Option<ExecutableDefinitionName>,
    document_is_server: bool,
    root_variables: InferVariablesVisitor<'program>,
    split_operations: FragmentDefinitionNameMap<(SplitOperationMetadata, OperationDefinition)>,
    errors: Vec<Diagnostic>,
}

impl<'program> RscResolverFieldTransform<'program> {
    fn new(
        program: &'program Program,
        base_fragment_names: &'program FragmentDefinitionNameSet,
        enabled: bool,
        has_dynamic_module_provider: bool,
    ) -> Self {
        Self {
            program,
            base_fragment_names,
            enabled,
            has_dynamic_module_provider,
            document_name: None,
            document_is_server: false,
            root_variables: InferVariablesVisitor::new(program),
            split_operations: Default::default(),
            errors: Vec::new(),
        }
    }

    fn is_rsc_field(&self, field: &ScalarField) -> bool {
        is_rsc_value_field(
            &self.program.schema,
            self.program.schema.field(field.definition.item),
        )
    }

    fn open_rsc_field(
        &mut self,
        field: &ScalarField,
        resolver_info: ResolverInfo,
    ) -> Transformed<Selection> {
        let schema_field = self.program.schema.field(field.definition.item);
        let field_name = schema_field.name.item;
        if !self.enabled {
            self.error(
                "A `RelayRscValue` field requires the `enable_relay_rsc` feature flag.",
                field.definition.location,
            );
            return Transformed::Keep;
        }
        if !matches!(
            schema_field.type_,
            TypeReference::Named(Type::Scalar(scalar_id))
                if self.program.schema.scalar(scalar_id).name.item
                    == *RELAY_RSC_VALUE_SCALAR_NAME
        ) {
            self.error(
                "A Resolver-authored RSC field must have the exact nullable scalar type `RelayRscValue`.",
                field.definition.location,
            );
            return Transformed::Keep;
        }
        if !self.document_is_server {
            self.error(
                "A `RelayRscValue` field may only be selected by an explicitly `@server` document in this compiler slice.",
                field.definition.location,
            );
            return Transformed::Keep;
        }
        if !self.has_dynamic_module_provider {
            self.error(
                "A `RelayRscValue` field requires a configured dynamic module provider.",
                field.definition.location,
            );
            return Transformed::Keep;
        }
        if !field.directives.is_empty() {
            self.error(
                "Resolver-authored RSC fields do not support selection directives.",
                field.directives[0].name.location,
            );
            return Transformed::Keep;
        }
        let Some(fragment_name) = resolver_info.fragment_name else {
            self.error(
                "A Resolver-authored RSC field must declare a singular `@rootFragment`.",
                field.definition.location,
            );
            return Transformed::Keep;
        };
        let Some(component_export_name) = resolver_info.import_name else {
            self.error(
                "A Resolver-authored RSC field must use a named export matching the field name.",
                field.definition.location,
            );
            return Transformed::Keep;
        };
        if resolver_info.live
            || resolver_info.return_fragment.is_some()
            || !matches!(
                resolver_info.resolver_type,
                ResolverSchemaGenType::ResolverModule
            )
        {
            self.error(
                "A Resolver-authored RSC field cannot be live, a `@returnFragment` Resolver, or a property lookup.",
                field.definition.location,
            );
            return Transformed::Keep;
        }
        let Some(expected_export_name) = relay_rsc_component_export_name(field_name.lookup())
        else {
            self.error(
                format!(
                    "The RSC field `{field_name}` does not produce a valid PascalCase component export starting with a letter."
                ),
                field.definition.location,
            );
            return Transformed::Keep;
        };
        if component_export_name.lookup() != expected_export_name {
            self.error(
                format!(
                    "The RSC field `{field_name}` must be exported by a component named `{expected_export_name}`, its field name in PascalCase."
                ),
                field.definition.location,
            );
            return Transformed::Keep;
        }
        let Some(fragment) = self.program.fragment(fragment_name) else {
            self.error(
                format!("A Resolver-authored RSC field references missing root fragment `{fragment_name}`."),
                field.definition.location,
            );
            return Transformed::Keep;
        };
        if fragment.directives.named(*SERVER_DIRECTIVE).is_none() {
            self.error(
                format!("Resolver-authored RSC root fragment `{fragment_name}` must be marked `@server`."),
                fragment.name.location,
            );
            return Transformed::Keep;
        }
        if fragment
            .directives
            .named(*NO_INLINE_DIRECTIVE_NAME)
            .is_some()
        {
            self.error(
                format!(
                    "Resolver-authored RSC root fragment `{fragment_name}` cannot use `@no_inline`."
                ),
                fragment.name.location,
            );
            return Transformed::Keep;
        }
        if !self
            .root_variables
            .infer_fragment_variables(fragment)
            .is_empty()
        {
            self.error(
                format!(
                    "Resolver-authored RSC root fragment `{fragment_name}` cannot read free root variables; declare public field and fragment arguments instead."
                ),
                fragment.name.location,
            );
            return Transformed::Keep;
        }

        let fragment_prop_name = rsc_fragment_prop_name(fragment_name);
        if fragment_prop_name.lookup().is_empty() {
            self.error(
                format!(
                    "Resolver-authored RSC root fragment `{fragment_name}` derives an empty component prop name."
                ),
                fragment.name.location,
            );
            return Transformed::Keep;
        }
        // `args` carries the field arguments; React strips `key` and `ref`.
        if matches!(fragment_prop_name.lookup(), "args" | "key" | "ref") {
            self.error(
                format!(
                    "Resolver-authored RSC root fragment `{fragment_name}` derives the reserved component prop name `{fragment_prop_name}`."
                ),
                fragment.name.location,
            );
            return Transformed::Keep;
        }

        let (fragment_arguments, component_arguments): (Vec<_>, Vec<_>) =
            field.arguments.iter().cloned().partition(|argument| {
                fragment
                    .variable_definitions
                    .named(VariableName(argument.name.item.0))
                    .is_some()
            });
        let field_variable_definitions: DiagnosticsResult<Vec<_>> = schema_field
            .arguments
            .iter()
            .map(|argument| {
                let default_value = argument
                    .default_value
                    .as_ref()
                    .map(|default_value| {
                        build_constant_value(
                            self.program.schema.as_ref(),
                            default_value,
                            &argument.type_,
                            argument.name.location,
                            ValidationLevel::Strict,
                        )
                        .map(|value| {
                            WithLocation::from_span(
                                argument.name.location.source_location(),
                                default_value.span(),
                                value,
                            )
                        })
                    })
                    .transpose()?;
                Ok(VariableDefinition {
                    name: WithLocation::new(
                        argument.name.location,
                        VariableName(argument.name.item.0),
                    ),
                    type_: argument.type_.clone(),
                    default_value,
                    directives: Vec::new(),
                })
            })
            .collect();
        let field_variable_definitions = match field_variable_definitions {
            Ok(definitions) => definitions,
            Err(mut diagnostics) => {
                self.errors.append(&mut diagnostics);
                return Transformed::Keep;
            }
        };
        let alias = field.alias.map_or(field_name, |alias| alias.item);
        let normalization_operation = self.ensure_split_operation(
            fragment,
            self.document_name
                .expect("An RSC field is transformed inside a document."),
        );
        let definition_id = rsc_definition_id(
            fragment_name,
            resolver_info.import_path,
            component_export_name,
        );
        let metadata = RscSeamMetadata {
            definition_id,
            alias,
            normalization_operation,
            component_module_name: resolver_info.import_path,
            component_export_name,
            output: RscSeamOutput::Flight,
            fragment_name,
            fragment_location: fragment.name.location,
            local_variable_definitions: fragment.variable_definitions.clone(),
            field_variable_definitions,
            component_arguments,
        };
        let spread = FragmentSpread {
            fragment: fragment.name,
            arguments: fragment_arguments,
            directives: vec![metadata.into()],
            signature: Some(fragment.as_ref().into()),
        };
        Transformed::Replace(Selection::InlineFragment(Arc::new(InlineFragment {
            type_condition: Some(fragment.type_condition),
            directives: Vec::new(),
            selections: vec![Selection::FragmentSpread(Arc::new(spread))],
            spread_location: field.definition.location,
        })))
    }

    fn ensure_split_operation(
        &mut self,
        fragment: &FragmentDefinition,
        document_name: ExecutableDefinitionName,
    ) -> OperationDefinitionName {
        let normalization_operation = OperationDefinitionName(
            get_normalization_operation_name(fragment.name.item.0).intern(),
        );
        if self.base_fragment_names.contains(&fragment.name.item) {
            // The base project writes its root fragment's normalization artifact.
            return normalization_operation;
        }
        let (metadata, _) = self
            .split_operations
            .entry(fragment.name.item)
            .or_insert_with(|| {
                let mut parent_documents = FxHashSet::default();
                parent_documents.insert(document_name);
                (
                    SplitOperationMetadata {
                        derived_from: Some(fragment.name.item),
                        location: fragment.name.location,
                        parent_documents,
                        raw_response_type_generation_mode: Some(
                            RawResponseGenerationMode::AllFieldsOptional,
                        ),
                    },
                    OperationDefinition {
                        name: WithLocation::new(fragment.name.location, normalization_operation),
                        type_: fragment.type_condition,
                        kind: OperationKind::Query,
                        variable_definitions: fragment.variable_definitions.clone(),
                        directives: Vec::new(),
                        selections: vec![Selection::FragmentSpread(Arc::new(FragmentSpread {
                            fragment: fragment.name,
                            arguments: pass_through_fragment_variables(fragment, |name| name).1,
                            directives: Vec::new(),
                            signature: Some(fragment.into()),
                        }))],
                    },
                )
            });
        metadata.parent_documents.insert(document_name);
        normalization_operation
    }

    fn error(&mut self, message: impl Into<String>, location: Location) {
        self.errors
            .push(Diagnostic::error(message.into(), location));
    }
}

impl Transformer<'_> for RscResolverFieldTransform<'_> {
    const NAME: &'static str = "RscResolverFieldTransform";
    const VISIT_ARGUMENTS: bool = false;
    const VISIT_DIRECTIVES: bool = false;

    fn transform_operation(
        &mut self,
        operation: &OperationDefinition,
    ) -> Transformed<OperationDefinition> {
        self.document_name = Some(operation.name.item.into());
        self.document_is_server = operation.directives.named(*SERVER_DIRECTIVE).is_some();
        self.default_transform_operation(operation)
    }

    fn transform_fragment(
        &mut self,
        fragment: &FragmentDefinition,
    ) -> Transformed<FragmentDefinition> {
        self.document_name = Some(fragment.name.item.into());
        self.document_is_server = fragment.directives.named(*SERVER_DIRECTIVE).is_some();
        self.default_transform_fragment(fragment)
    }

    fn transform_scalar_field(&mut self, field: &ScalarField) -> Transformed<Selection> {
        if !self.is_rsc_field(field) {
            return Transformed::Keep;
        }
        match get_resolver_info(
            self.program.schema.as_ref(),
            self.program.schema.field(field.definition.item),
            field.definition.location,
        ) {
            Some(Ok(resolver_info)) => self.open_rsc_field(field, resolver_info),
            Some(Err(mut diagnostics)) => {
                self.errors.append(&mut diagnostics);
                Transformed::Keep
            }
            None => {
                self.error(
                    "A `RelayRscValue` field must be backed by an `@relayField` Resolver definition.",
                    field.definition.location,
                );
                Transformed::Keep
            }
        }
    }
}

fn is_rsc_value_field(schema: &SDLSchema, field: &Field) -> bool {
    field
        .type_
        .inner()
        .get_scalar_id()
        .is_some_and(|scalar_id| schema.scalar(scalar_id).name.item == *RELAY_RSC_VALUE_SCALAR_NAME)
}

fn rsc_definition_id(
    fragment_name: FragmentDefinitionName,
    component_module_name: StringKey,
    component_export_name: StringKey,
) -> StringKey {
    // The module name is a source path; normalize separators so the ID (and
    // the artifacts that embed it) is the same on every platform.
    let component_module_name = component_module_name.lookup().replace(MAIN_SEPARATOR, "/");
    let mut hasher = FnvHasher::default();
    for value in [fragment_name.0.lookup(), &component_module_name] {
        hasher.write(value.as_bytes());
        hasher.write_u8(0);
    }
    hasher.write(component_export_name.lookup().as_bytes());
    format!("{:016x}", hasher.finish()).intern()
}
