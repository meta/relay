/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

mod scope;

use std::collections::HashMap;
use std::sync::Arc;

use common::ArgumentName;
use common::Diagnostic;
use common::DiagnosticsResult;
use common::FeatureFlag;
use common::Location;
use common::NamedItem;
use common::SourceLocationKey;
use common::WithLocation;
use graphql_ir::Condition;
use graphql_ir::ConditionValue;
use graphql_ir::ConstantValue;
use graphql_ir::Directive;
use graphql_ir::FragmentDefinition;
use graphql_ir::FragmentDefinitionName;
use graphql_ir::FragmentDefinitionNameMap;
use graphql_ir::FragmentDefinitionNameSet;
use graphql_ir::FragmentSpread;
use graphql_ir::InlineFragment;
use graphql_ir::OperationDefinition;
use graphql_ir::OperationDefinitionName;
use graphql_ir::Program;
use graphql_ir::ProvidedVariableMetadata;
use graphql_ir::Selection;
use graphql_ir::Transformed;
use graphql_ir::TransformedMulti;
use graphql_ir::TransformedValue;
use graphql_ir::Transformer;
use graphql_ir::Value;
use graphql_ir::Variable;
use graphql_ir::VariableDefinition;
use graphql_ir::VariableName;
use graphql_ir::associated_data_impl;
use graphql_ir::transform_list;
use graphql_ir::transform_list_multi;
use graphql_syntax::OperationKind;
use intern::string_key::Intern;
use intern::string_key::StringKey;
use intern::string_key::StringKeyIndexMap;
use intern::string_key::StringKeyMap;
use itertools::Itertools;
use schema::Type;
use scope::Scope;
use scope::format_local_variable;
use thiserror::Error;

use super::get_applied_fragment_name;
use crate::ClientComponentBoundaryMetadata;
use crate::RawResponseGenerationMode;
use crate::RelayResolverMetadata;
use crate::RscSeamMetadata;
use crate::match_::DIRECTIVE_SPLIT_OPERATION;
use crate::match_::SplitOperationMetadata;
use crate::no_inline::NO_INLINE_DIRECTIVE_NAME;
use crate::no_inline::PARENT_DOCUMENTS_ARG;
use crate::no_inline::is_raw_response_type_enabled;
use crate::util::get_normalization_operation_name;

/// A transform that converts a set of documents containing fragments/fragment
/// spreads *with* arguments to one where all arguments have been inlined. This
/// is effectively static currying of functions. Nodes are changed as follows:
/// - Fragment spreads with arguments are replaced with references to an inlined
///   version of the referenced fragment.
/// - Fragments with argument definitions are cloned once per unique set of
///   arguments, with the name changed to original name + hash and all nested
///   variable references changed to the value of that variable given its
///   arguments.
/// - Field & directive argument variables are replaced with the value of those
///   variables in context.
/// - Definitions of provided variables are added to root operations.
/// - All nodes are cloned with updated children.
///
/// The transform also handles statically passing/failing Condition nodes:
/// - Literal Conditions with a passing value are elided and their selections
///   inlined in their parent.
/// - Literal Conditions with a failing value are removed.
/// - Nodes that would become empty as a result of the above are removed.
///
/// Note that unreferenced fragments are not added to the output.
pub fn apply_fragment_arguments(
    program: &Program,
    is_normalization: bool,
    no_inline_feature: &FeatureFlag,
    base_fragment_names: &FragmentDefinitionNameSet,
) -> DiagnosticsResult<Program> {
    let mut transform = ApplyFragmentArgumentsTransform {
        base_fragment_names,
        errors: Vec::new(),
        fragments: Default::default(),
        is_normalization,
        no_inline_feature,
        program,
        provided_variables: Default::default(),
        scope: Default::default(),
        split_operations: Default::default(),
    };

    let mut next_program = transform
        .transform_program(program)
        .replace_or_else(|| program.clone());

    for (fragment_name, used_fragment) in transform.fragments {
        match used_fragment {
            PendingFragment::Resolved {
                fragment_definition: Some(fragment),
                ..
            } => next_program.insert_fragment(fragment),
            PendingFragment::Resolved {
                fragment_definition: None,
                ..
            } => {
                // The fragment ended up empty, do not add to result Program.
            }
            PendingFragment::Pending => panic!("Unexpected case, {fragment_name}"),
        }
    }

    for (_, (operation, _)) in transform.split_operations {
        if let Some(operation) = operation {
            next_program.insert_operation(Arc::new(operation));
        }
    }

    if transform.errors.is_empty() {
        Ok(next_program)
    } else {
        Err(transform.errors)
    }
}

type ProvidedVariablesMap = StringKeyIndexMap<VariableDefinition>;

#[derive(Debug)]
enum PendingFragment {
    Pending,
    Resolved {
        fragment_definition: Option<Arc<FragmentDefinition>>,
        provided_variables: ProvidedVariablesMap,
    },
}

#[derive(Clone, Debug, PartialEq, Eq, Hash)]
pub struct NoInlineFragmentSpreadMetadata {
    pub location: SourceLocationKey,
}

associated_data_impl!(NoInlineFragmentSpreadMetadata);

struct ApplyFragmentArgumentsTransform<'flags, 'program, 'base_fragments> {
    base_fragment_names: &'base_fragments FragmentDefinitionNameSet,
    errors: Vec<Diagnostic>,
    fragments: FragmentDefinitionNameMap<PendingFragment>,
    is_normalization: bool,
    no_inline_feature: &'flags FeatureFlag,
    program: &'program Program,
    // used to keep track of the provided variables used by the current
    //  operation / fragment / no-inline fragment and its transitively
    //  included fragments
    provided_variables: ProvidedVariablesMap,
    scope: Scope,
    split_operations: StringKeyMap<(Option<OperationDefinition>, ProvidedVariablesMap)>,
}

impl Transformer<'_> for ApplyFragmentArgumentsTransform<'_, '_, '_> {
    const NAME: &'static str = "ApplyFragmentArgumentsTransform";
    const VISIT_ARGUMENTS: bool = true;
    const VISIT_DIRECTIVES: bool = true;

    fn transform_operation(
        &mut self,
        operation: &OperationDefinition,
    ) -> Transformed<OperationDefinition> {
        self.scope = Scope::root_scope();
        self.provided_variables = Default::default();
        let transform_result = self.default_transform_operation(operation);
        if self.provided_variables.is_empty()
            || operation
                .directives
                .named(*DIRECTIVE_SPLIT_OPERATION)
                .is_some()
        {
            // this transform does not add the SplitOperation directive, so this
            //  should be equal to checking whether the result is a split operation
            self.provided_variables.clear();

            match transform_result {
                Transformed::Keep => Transformed::Keep,
                Transformed::Replace(new_operation) => Transformed::Replace(new_operation),
                Transformed::Delete => {
                    self.errors.push(Diagnostic::error(
                        ValidationMessage::EmptySelectionsInDocument {
                            document: "query",
                            name: operation.name.item.0,
                        },
                        operation.name.location,
                    ));

                    Transformed::Delete
                }
            }
        } else {
            let mut add_provided_variables = |new_operation: &mut OperationDefinition| {
                new_operation.variable_definitions.append(
                    &mut self
                        .provided_variables
                        .drain(..)
                        .map(|(_, definition)| definition)
                        .collect_vec(),
                );
            };
            match transform_result {
                Transformed::Keep => {
                    let mut new_operation = operation.clone();
                    add_provided_variables(&mut new_operation);
                    Transformed::Replace(new_operation)
                }
                Transformed::Replace(mut new_operation) => {
                    add_provided_variables(&mut new_operation);
                    Transformed::Replace(new_operation)
                }
                Transformed::Delete => {
                    self.errors.push(Diagnostic::error(
                        ValidationMessage::EmptySelectionsInDocument {
                            document: "query",
                            name: operation.name.item.0,
                        },
                        operation.name.location,
                    ));

                    Transformed::Delete
                }
            }
        }
    }

    fn transform_fragment(
        &mut self,
        fragment: &FragmentDefinition,
    ) -> Transformed<FragmentDefinition> {
        if self.is_normalization {
            let no_inline_directive = fragment.directives.named(*NO_INLINE_DIRECTIVE_NAME);
            if let Some(no_inline_directive) = no_inline_directive {
                self.transform_no_inline_fragment(fragment, no_inline_directive);
            }
        }
        // Non-inlined fragments are promoted to operations; other fragments are deleted
        // unless they are referenced
        Transformed::Delete
    }

    fn transform_fragment_spread(&mut self, spread: &FragmentSpread) -> Transformed<Selection> {
        let fragment = self
            .program
            .fragment(spread.fragment.item)
            .unwrap_or_else(|| {
                panic!(
                    "Tried to spread missing fragment: `{}`.",
                    spread.fragment.item
                );
            });

        // Validate that the fragment spread does not try to pass in provided variables
        for (original_definition_name, definition_location) in
            fragment.used_global_variables.iter().filter_map(|def| {
                Some((
                    ProvidedVariableMetadata::find(&def.directives)?.original_variable_name,
                    def.name.location,
                ))
            })
        {
            if let Some(invalid_argument) = spread
                .arguments
                .named(ArgumentName(original_definition_name.0))
            {
                self.errors.push(
                    Diagnostic::error(
                        ValidationMessage::ProvidedVariableIncompatibleWithArguments {
                            original_definition_name,
                        },
                        invalid_argument.name.location,
                    )
                    .annotate("Provided variable defined here", definition_location),
                );
            }
        }

        if self.is_normalization
            && let Some(directive) = fragment.directives.named(*NO_INLINE_DIRECTIVE_NAME)
        {
            self.transform_no_inline_fragment(fragment, directive);
            let transformed_arguments = spread
                .arguments
                .iter()
                .map(|arg| {
                    let mut arg = self.transform_argument(arg).unwrap_or_else(|| arg.clone());
                    arg.name.item.0 = format_local_variable(fragment.name.item, arg.name.item.0);
                    arg
                })
                .collect();
            let mut directives = Vec::with_capacity(spread.directives.len() + 1);
            directives.extend(spread.directives.iter().cloned());

            directives.push(
                NoInlineFragmentSpreadMetadata {
                    location: fragment.name.location.source_location(),
                }
                .into(),
            );

            let normalization_name =
                get_normalization_operation_name(fragment.name.item.0).intern();
            let next_spread = Selection::FragmentSpread(Arc::new(FragmentSpread {
                arguments: transformed_arguments,
                directives,
                fragment: WithLocation::new(
                    fragment.name.location,
                    FragmentDefinitionName(normalization_name),
                ),
                signature: Some(fragment.as_ref().into()),
            }));
            return with_type_refinement(next_spread, fragment.type_condition);
        }

        let applied_fragment = self.apply_fragment(spread, fragment);

        if self.is_normalization
            && (ClientComponentBoundaryMetadata::find(&spread.directives).is_some()
                || RscSeamMetadata::find(&spread.directives).is_some())
        {
            let Some(applied_fragment) = applied_fragment else {
                return Transformed::Delete;
            };

            let arguments = self.transform_arguments(&spread.arguments);
            let directives = self.transform_directives(&spread.directives);
            return with_type_refinement(
                Selection::FragmentSpread(Arc::new(FragmentSpread {
                    fragment: applied_fragment.name,
                    arguments: arguments.replace_or_else(|| spread.arguments.clone()),
                    directives: directives.replace_or_else(|| spread.directives.clone()),
                    signature: Some(applied_fragment.as_ref().into()),
                })),
                applied_fragment.type_condition,
            );
        }

        match applied_fragment {
            Some(applied_fragment) => {
                let directives = self
                    .transform_directives(&spread.directives)
                    .replace_or_else(|| spread.directives.clone());
                Transformed::Replace(Selection::FragmentSpread(Arc::new(FragmentSpread {
                    fragment: applied_fragment.name,
                    arguments: Vec::new(),
                    directives,
                    signature: Some(applied_fragment.as_ref().into()),
                })))
            }
            _ => Transformed::Delete,
        }
    }

    fn transform_selections(
        &mut self,
        selections: &[Selection],
    ) -> TransformedValue<Vec<Selection>> {
        transform_list_multi(selections, |selection| {
            self.transform_selection_multi(selection)
        })
    }

    fn transform_arguments(
        &mut self,
        arguments: &[graphql_ir::Argument],
    ) -> TransformedValue<Vec<graphql_ir::Argument>> {
        if self.scope.has_bindings() {
            transform_list(arguments, |argument| self.transform_argument(argument))
        } else {
            TransformedValue::Keep
        }
    }

    fn transform_directives(
        &mut self,
        directives: &[Directive],
    ) -> TransformedValue<Vec<Directive>> {
        if self.scope.has_bindings() {
            transform_list(directives, |directive| self.transform_directive(directive))
        } else {
            TransformedValue::Keep
        }
    }

    fn transform_directive(&mut self, directive: &Directive) -> Transformed<Directive> {
        if directive.name.item == RelayResolverMetadata::directive_name()
            && let Some(resolver_metadata) = RelayResolverMetadata::from(directive)
        {
            return self
                .transform_arguments(&resolver_metadata.field_arguments)
                .map(|new_args| {
                    RelayResolverMetadata {
                        field_arguments: new_args,
                        ..resolver_metadata.clone()
                    }
                    .into()
                })
                .into();
        }
        if directive.name.item == RscSeamMetadata::directive_name()
            && let Some(seam) = RscSeamMetadata::from(directive)
        {
            return self
                .transform_arguments(&seam.component_arguments)
                .map(|component_arguments| {
                    RscSeamMetadata {
                        component_arguments,
                        ..seam.clone()
                    }
                    .into()
                })
                .into();
        }
        self.default_transform_directive(directive)
    }

    fn transform_value(&mut self, value: &Value) -> TransformedValue<Value> {
        match value {
            Value::Variable(prev_variable) => {
                if let Some(scope_value) = self.scope.get(prev_variable.name.item) {
                    match scope_value {
                        Value::Variable(replacement_variable) => {
                            TransformedValue::Replace(Value::Variable(Variable {
                                // Update the name/location to the applied variable name
                                name: replacement_variable.name,
                                // But keep the type of the previous variable, which reflects the type
                                // expected at this location
                                type_: prev_variable.type_.clone(),
                            }))
                        }
                        _ => TransformedValue::Replace(scope_value.clone()),
                    }
                } else {
                    // Assume a global variable if the variable has no local
                    // bindings.
                    TransformedValue::Keep
                }
            }
            Value::Constant(_) => TransformedValue::Keep,
            Value::List(items) => {
                transform_list(items, |value| self.transform_value(value)).map(Value::List)
            }
            Value::Object(arguments) => self.transform_arguments(arguments).map(Value::Object),
        }
    }

    fn transform_condition_value(
        &mut self,
        condition_value: &ConditionValue,
    ) -> TransformedValue<ConditionValue> {
        match condition_value {
            ConditionValue::Variable(prev_variable) => {
                match self.scope.get(prev_variable.name.item) {
                    Some(Value::Variable(replacement_variable)) => {
                        TransformedValue::Replace(ConditionValue::Variable(Variable {
                            // Update the name/location to the applied variable name
                            name: replacement_variable.name,
                            // But keep the type of the previous variable, which reflects the type
                            // expected at this location
                            type_: prev_variable.type_.clone(),
                        }))
                    }
                    Some(Value::Constant(ConstantValue::Boolean(constant_value))) => {
                        TransformedValue::Replace(ConditionValue::Constant(*constant_value))
                    }
                    None => {
                        // Assume a global variable if the variable has no local
                        // bindings.
                        TransformedValue::Keep
                    }
                    Some(other_binding) => {
                        panic!("Invalid variable value for condition: {other_binding:?}");
                    }
                }
            }
            ConditionValue::Constant(_) => TransformedValue::Keep,
        }
    }
}

impl ApplyFragmentArgumentsTransform<'_, '_, '_> {
    fn transform_no_inline_fragment(
        &mut self,
        fragment: &FragmentDefinition,
        directive: &Directive,
    ) {
        // If we have already computed, we can return early
        if let Some((_, provided_variables)) = self.split_operations.get(&fragment.name.item.0) {
            for (name, def) in provided_variables {
                self.provided_variables.insert(*name, def.clone());
            }
            return;
        }

        // We do not need to write normalization files for base fragments
        let is_base = self.base_fragment_names.contains(&fragment.name.item);
        if !is_base && !self.no_inline_feature.is_enabled_for(fragment.name.item.0) {
            self.errors.push(Diagnostic::error(
                format!(
                    "Invalid usage of @no_inline on fragment '{}': this feature is gated and currently set to: {}",
                    fragment.name.item, self.no_inline_feature
                ),
                directive.location,
            ));
        }

        // save the context used by the enclosing operation / fragment
        let mut saved_provided_vars = std::mem::take(&mut self.provided_variables);
        let saved_scope = std::mem::replace(&mut self.scope, no_inline_fragment_scope(fragment));

        self.extract_provided_variables(fragment);
        let fragment = self
            .default_transform_fragment(fragment)
            .unwrap_or_else(|| fragment.clone());
        let FragmentDefinition {
            name,
            mut directives,
            mut variable_definitions,
            selections,
            type_condition,
            ..
        } = fragment;

        for variable in &mut variable_definitions {
            variable.name.item = VariableName(format_local_variable(
                fragment.name.item,
                variable.name.item.0,
            ));
        }
        let mut metadata = SplitOperationMetadata {
            derived_from: Some(fragment.name.item),
            location: fragment.name.location,
            parent_documents: Default::default(),
            raw_response_type_generation_mode: is_raw_response_type_enabled(directive)
                .then_some(RawResponseGenerationMode::AllFieldsOptional),
        };
        // - A fragment with user defined @no_inline always produces a $normalization file. The `parent_document` of
        // that file is the fragment itself as it gets deleted iff that fragment is deleted or no longer
        // has the @no_inline directive.
        // - A fragment with @no_inline generated by @module, `parent_documents` also include fragments that
        // spread the current fragment with @module
        metadata.parent_documents.insert(fragment.name.item.into());
        let parent_documents_arg = directive.arguments.named(*PARENT_DOCUMENTS_ARG);
        if let Some(Value::Constant(ConstantValue::List(parent_documents))) =
            parent_documents_arg.map(|arg| &arg.value.item)
        {
            for val in parent_documents {
                if let ConstantValue::String(name) = val {
                    // Determine the correct ExecutableDefinitionName
                    // variant based on whether the parent document is
                    // an operation or a fragment.
                    let def_name = if self
                        .program
                        .operation(OperationDefinitionName(*name))
                        .is_some()
                    {
                        graphql_ir::ExecutableDefinitionName::OperationDefinitionName(
                            OperationDefinitionName(*name),
                        )
                    } else {
                        graphql_ir::ExecutableDefinitionName::FragmentDefinitionName(
                            FragmentDefinitionName(*name),
                        )
                    };
                    metadata.parent_documents.insert(def_name);
                } else {
                    panic!("Expected item in the parent_documents to be a StringKey.")
                }
            }
        }
        directives.push(metadata.into());
        let normalization_name = get_normalization_operation_name(name.item.0).intern();
        let operation = if is_base {
            None
        } else {
            Some(OperationDefinition {
                name: WithLocation::new(name.location, OperationDefinitionName(normalization_name)),
                type_: type_condition,
                variable_definitions,
                directives,
                selections,
                kind: OperationKind::Query,
            })
        };

        if self
            .program
            .operation(OperationDefinitionName(normalization_name))
            .is_some()
        {
            self.errors.push(Diagnostic::error(
                format!(
                    "Invalid usage of @no_inline on fragment '{}' - @no_inline is only allowed on allowlisted fragments loaded with @module",
                    fragment.name.item,
                ),
                directive.name.location,
            ));
        }
        self.split_operations.insert(
            fragment.name.item.0,
            (operation, self.provided_variables.clone()),
        );

        // add this fragment's provided variables to that of the enclosing operation / fragment
        saved_provided_vars.extend(self.provided_variables.drain(..));
        self.provided_variables = saved_provided_vars;
        self.scope = saved_scope;
    }

    fn extract_provided_variables(&mut self, fragment: &FragmentDefinition) {
        let provided_arguments =
            fragment
                .used_global_variables
                .iter()
                .filter(|variable_definition| {
                    variable_definition
                        .directives
                        .named(ProvidedVariableMetadata::directive_name())
                        .is_some()
                });
        for definition in provided_arguments {
            self.provided_variables
                .entry(definition.name.item.0)
                .or_insert_with(|| definition.clone());
        }
    }

    fn apply_fragment(
        &mut self,
        spread: &FragmentSpread,
        fragment: &FragmentDefinition,
    ) -> Option<Arc<FragmentDefinition>> {
        let transformed_arguments = self
            .transform_arguments(&spread.arguments)
            .replace_or_else(|| spread.arguments.clone());

        let applied_fragment_name =
            get_applied_fragment_name(spread.fragment.item, &transformed_arguments);
        if let Some(applied_fragment) = self.fragments.get(&applied_fragment_name) {
            return match applied_fragment {
                PendingFragment::Resolved {
                    fragment_definition,
                    provided_variables,
                } => {
                    // add this fragment's provided variables to that of the enclosing
                    //  operation / fragment
                    for (name, def) in provided_variables.iter() {
                        self.provided_variables.insert(*name, def.clone());
                    }
                    fragment_definition.clone()
                }
                PendingFragment::Pending => {
                    let mut error = Diagnostic::error(
                        ValidationMessage::CircularFragmentReference {
                            fragment_name: spread.fragment.item,
                        },
                        spread.fragment.location,
                    );
                    for location in self.scope.locations() {
                        error = error.annotate("other member of the cycle", location);
                    }
                    self.errors.push(error);
                    None
                }
            };
        }

        self.fragments
            .insert(applied_fragment_name, PendingFragment::Pending);

        self.scope
            .push(spread.fragment.location, &transformed_arguments, fragment);
        // save the context used by the enclosing operation / fragment
        let mut saved_provided_vars = std::mem::take(&mut self.provided_variables);
        self.extract_provided_variables(fragment);

        let selections = self
            .transform_selections(&fragment.selections)
            .replace_or_else(|| fragment.selections.clone());

        let transformed_fragment = if selections.is_empty() {
            None
        } else {
            Some(Arc::new(FragmentDefinition {
                name: WithLocation::new(fragment.name.location, applied_fragment_name),
                variable_definitions: Vec::new(),
                type_condition: fragment.type_condition,
                // TODO update globals
                used_global_variables: Vec::new(),
                directives: fragment.directives.clone(),
                selections,
            }))
        };

        self.fragments.insert(
            applied_fragment_name,
            PendingFragment::Resolved {
                fragment_definition: transformed_fragment.clone(),
                provided_variables: self.provided_variables.clone(),
            },
        );

        // add this fragment's provided variables to that of the enclosing operation / fragment
        saved_provided_vars.extend(self.provided_variables.drain(..));
        self.provided_variables = saved_provided_vars;
        self.scope.pop();

        transformed_fragment
    }

    fn transform_selection_multi(&mut self, selection: &Selection) -> TransformedMulti<Selection> {
        match selection {
            Selection::FragmentSpread(selection) => {
                self.transform_fragment_spread(selection).into()
            }
            Selection::InlineFragment(selection) => {
                self.transform_inline_fragment(selection).into()
            }
            Selection::LinkedField(selection) => self.transform_linked_field(selection).into(),
            Selection::ScalarField(selection) => self.transform_scalar_field(selection).into(),
            Selection::Condition(selection) => self.transform_condition_multi(selection),
        }
    }

    fn transform_condition_multi(&mut self, condition: &Condition) -> TransformedMulti<Selection> {
        let condition_value = self.transform_condition_value(&condition.value);

        // If we replace with a constant condition, remove the condition node.
        if let TransformedValue::Replace(ConditionValue::Constant(const_condition_value)) =
            condition_value
        {
            return if const_condition_value == condition.passing_value {
                let selections = self
                    .transform_selections(&condition.selections)
                    .replace_or_else(|| condition.selections.clone());
                TransformedMulti::ReplaceMultiple(selections)
            } else {
                TransformedMulti::Delete
            };
        }

        // If selections are empty, delete
        let selections = self.transform_selections(&condition.selections);
        if let TransformedValue::Replace(selections) = &selections
            && selections.is_empty()
        {
            return TransformedMulti::Delete;
        }

        if selections.should_keep() && condition_value.should_keep() {
            TransformedMulti::Keep
        } else {
            TransformedMulti::Replace(Selection::Condition(Arc::new(Condition {
                value: condition_value.replace_or_else(|| condition.value.clone()),
                selections: selections.replace_or_else(|| condition.selections.clone()),
                ..condition.clone()
            })))
        }
    }
}

fn no_inline_fragment_scope(fragment: &FragmentDefinition) -> Scope {
    let mut bindings = HashMap::<VariableName, Value>::with_capacity_and_hasher(
        fragment.variable_definitions.len(),
        Default::default(),
    );
    for variable_definition in &fragment.variable_definitions {
        let variable_name = variable_definition.name.item;
        let scoped_variable_name = format_local_variable(fragment.name.item, variable_name.0);
        bindings.insert(
            variable_name,
            Value::Variable(Variable {
                name: WithLocation::new(
                    variable_definition.name.location,
                    VariableName(scoped_variable_name),
                ),
                type_: variable_definition.type_.clone(),
            }),
        );
    }
    let mut scope = Scope::root_scope();
    scope.push_bindings(fragment.name.location, bindings);
    scope
}

#[derive(Debug, Error, serde::Serialize)]
#[serde(tag = "type")]
enum ValidationMessage {
    #[error("Found a circular reference from fragment '{fragment_name}'.")]
    CircularFragmentReference {
        fragment_name: FragmentDefinitionName,
    },
    #[error(
        "Passing a value to '{original_definition_name}' (a provided variable) through @arguments is not supported."
    )]
    ProvidedVariableIncompatibleWithArguments {
        original_definition_name: VariableName,
    },
    #[error(
        "After applying transforms to the {document} `{name}` selections of \
        the `{name}` that would be sent to the server are empty. \
        This is likely due to the use of `@skip`/`@include` directives with \
        constant values that remove all selections in the {document}. "
    )]
    EmptySelectionsInDocument {
        name: StringKey,
        document: &'static str,
    },
}

/// Wraps a spread that normalization does not inline in its fragment's type
/// refinement, so that the runtime traverses it only for records of that type,
/// as it would the inlined fragment. `flatten` removes the refinement where the
/// parent selection already has that type.
fn with_type_refinement(spread: Selection, type_condition: Type) -> Transformed<Selection> {
    Transformed::Replace(Selection::InlineFragment(Arc::new(InlineFragment {
        directives: Default::default(),
        selections: vec![spread],
        type_condition: Some(type_condition),
        spread_location: Location::generated(),
    })))
}
