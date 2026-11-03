/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

use std::sync::Arc;

use common::Diagnostic;
use common::DiagnosticsResult;
use common::FeatureFlag;
use common::Location;
use common::NamedItem;
use common::WithLocation;
use graphql_ir::ExecutableDefinitionName;
use graphql_ir::FragmentDefinition;
use graphql_ir::FragmentDefinitionName;
use graphql_ir::FragmentDefinitionNameMap;
use graphql_ir::FragmentDefinitionNameSet;
use graphql_ir::FragmentSpread;
use graphql_ir::OperationDefinition;
use graphql_ir::OperationDefinitionName;
use graphql_ir::Program;
use graphql_ir::Selection;
use graphql_ir::Transformed;
use graphql_ir::Transformer;
use graphql_ir::VariableName;
use graphql_ir::associated_data_impl;
use graphql_syntax::OperationKind;
use intern::string_key::Intern;
use intern::string_key::StringKey;
use rustc_hash::FxHashSet;
use thiserror::Error;

use crate::INLINE_DIRECTIVE_NAME;
use crate::NO_INLINE_DIRECTIVE_NAME;
use crate::RelayDirective;
use crate::SERVER_DIRECTIVE;
use crate::SplitOperationMetadata;
use crate::UPDATABLE_DIRECTIVE;
use crate::apply_fragment_arguments::format_local_variable;
use crate::no_inline::attach_no_inline_directives_to_fragments;
use crate::util::get_normalization_operation_name;
use crate::util::pass_through_fragment_variables;

/// Identifies the generated normalization artifact for a client fragment
/// crossing a server-owned fragment boundary.
#[derive(Clone, Debug, Eq, Hash, PartialEq)]
pub struct ClientComponentBoundaryMetadata {
    /// The Reader fragment exposed to the client.
    pub fragment: FragmentDefinitionName,
    /// The generated normalization operation imported by the boundary.
    pub normalization_operation: OperationDefinitionName,
    /// The source location used to place the generated fragment artifacts.
    pub fragment_location: Location,
}
associated_data_impl!(ClientComponentBoundaryMetadata);

pub(crate) fn infer_client_component_boundaries(
    program: &Program,
    no_inline: &FeatureFlag,
    base_fragment_names: &FragmentDefinitionNameSet,
) -> DiagnosticsResult<Program> {
    if !program
        .operations()
        .any(|operation| operation.directives.named(*SERVER_DIRECTIVE).is_some())
        && !program
            .fragments()
            .any(|fragment| fragment.directives.named(*SERVER_DIRECTIVE).is_some())
    {
        return Ok(program.clone());
    }

    let mut transform =
        ClientComponentBoundaryTransform::new(program, no_inline, base_fragment_names);
    let mut next_program = transform
        .transform_program(program)
        .replace_or_else(|| program.clone());

    if !transform.no_inline_fragments.is_empty() {
        attach_no_inline_directives_to_fragments(
            &mut transform.no_inline_fragments,
            &mut next_program,
        );
    }

    let mut split_operations: Vec<_> = transform.split_operations.drain().collect();
    split_operations.sort_unstable_by_key(|(fragment_name, _)| *fragment_name);
    for (_, (metadata, mut operation)) in split_operations {
        operation.directives.push(metadata.into());
        if let Some(previous) = next_program.operation(operation.name.item) {
            transform.errors.push(Diagnostic::error(
                ValidationMessage::DuplicateSplitOperation {
                    operation_name: operation.name.item,
                },
                previous.name.location,
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

struct ClientComponentBoundaryTransform<'program, 'flag> {
    program: &'program Program,
    no_inline: &'flag FeatureFlag,
    base_fragment_names: &'program FragmentDefinitionNameSet,
    document_name: Option<ExecutableDefinitionName>,
    document_is_server: bool,
    split_operations: FragmentDefinitionNameMap<(SplitOperationMetadata, OperationDefinition)>,
    no_inline_fragments: FragmentDefinitionNameMap<Vec<ExecutableDefinitionName>>,
    errors: Vec<Diagnostic>,
}

impl<'program, 'flag> ClientComponentBoundaryTransform<'program, 'flag> {
    fn new(
        program: &'program Program,
        no_inline: &'flag FeatureFlag,
        base_fragment_names: &'program FragmentDefinitionNameSet,
    ) -> Self {
        Self {
            program,
            no_inline,
            base_fragment_names,
            document_name: None,
            document_is_server: false,
            split_operations: Default::default(),
            no_inline_fragments: Default::default(),
            errors: Vec::new(),
        }
    }

    fn open_client_boundary(&mut self, spread: &FragmentSpread) -> Transformed<Selection> {
        let boundary = self.ensure_split_operation(spread);
        let mut directives = spread.directives.clone();
        directives.push(boundary.into());
        Transformed::Replace(Selection::FragmentSpread(Arc::new(FragmentSpread {
            directives,
            ..spread.clone()
        })))
    }

    fn ensure_split_operation(
        &mut self,
        spread: &FragmentSpread,
    ) -> ClientComponentBoundaryMetadata {
        let fragment = self
            .program
            .fragment(spread.fragment.item)
            .expect("A validated fragment spread should have a definition.");
        let normalization_operation = OperationDefinitionName(
            get_normalization_operation_name(fragment.name.item.0).intern(),
        );
        let document_name = self
            .document_name
            .expect("A fragment spread is always transformed inside a document.");

        if self.no_inline.is_enabled_for(fragment.name.item.0)
            || fragment
                .directives
                .named(*NO_INLINE_DIRECTIVE_NAME)
                .is_some()
        {
            self.no_inline_fragments
                .entry(fragment.name.item)
                .or_default()
                .push(document_name);
        } else {
            let (metadata, _) = self
                .split_operations
                .entry(fragment.name.item)
                .or_insert_with(|| {
                    let mut parent_documents = FxHashSet::default();
                    parent_documents.insert(document_name);
                    // The fragment's variables are renamed as in `@no_inline`
                    // split operations, so they cannot shadow an operation
                    // variable read by a fragment spread inside it.
                    let (variable_definitions, arguments) =
                        pass_through_fragment_variables(fragment, |name| {
                            VariableName(format_local_variable(fragment.name.item, name.0))
                        });
                    (
                        SplitOperationMetadata {
                            derived_from: Some(fragment.name.item),
                            location: fragment.name.location,
                            parent_documents,
                            raw_response_type_generation_mode: None,
                        },
                        OperationDefinition {
                            name: WithLocation::new(
                                fragment.name.location,
                                normalization_operation,
                            ),
                            type_: fragment.type_condition,
                            kind: OperationKind::Query,
                            variable_definitions,
                            directives: Vec::new(),
                            selections: vec![Selection::FragmentSpread(Arc::new(FragmentSpread {
                                fragment: fragment.name,
                                arguments,
                                directives: Vec::new(),
                                signature: Some(fragment.as_ref().into()),
                            }))],
                        },
                    )
                });
            metadata.parent_documents.insert(document_name);
        }

        ClientComponentBoundaryMetadata {
            fragment: fragment.name.item,
            normalization_operation,
            fragment_location: fragment.name.location,
        }
    }

    fn document_name_key(&self) -> StringKey {
        match self
            .document_name
            .expect("A fragment spread is always transformed inside a document.")
        {
            ExecutableDefinitionName::OperationDefinitionName(name) => name.0,
            ExecutableDefinitionName::FragmentDefinitionName(name) => name.0,
        }
    }
}

impl Transformer<'_> for ClientComponentBoundaryTransform<'_, '_> {
    const NAME: &'static str = "ClientComponentBoundaryTransform";
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

    fn transform_fragment_spread(&mut self, spread: &FragmentSpread) -> Transformed<Selection> {
        let Some(target) = self.program.fragment(spread.fragment.item) else {
            return Transformed::Keep;
        };
        let target_is_server = target.directives.named(*SERVER_DIRECTIVE).is_some();

        if target_is_server && !self.document_is_server {
            self.errors.push(Diagnostic::error(
                ValidationMessage::ClientDocumentSpreadsServerFragment {
                    document_name: self.document_name_key(),
                    fragment_name: target.name.item,
                },
                spread.fragment.location,
            ));
            return Transformed::Keep;
        }

        if target_is_server || !self.document_is_server {
            return Transformed::Keep;
        }

        if RelayDirective::find(&target.directives).is_some_and(|directive| directive.plural) {
            self.errors.push(Diagnostic::error(
                ValidationMessage::PluralClientFragment {
                    server_document_name: self.document_name_key(),
                    client_fragment_name: target.name.item,
                },
                spread.fragment.location,
            ));
            return Transformed::Keep;
        }

        if target.directives.named(*INLINE_DIRECTIVE_NAME).is_some()
            || target.directives.named(*UPDATABLE_DIRECTIVE).is_some()
        {
            self.errors.push(Diagnostic::error(
                ValidationMessage::ClientFragmentHasNoReaderArtifact {
                    fragment_name: target.name.item,
                },
                spread.fragment.location,
            ));
            return Transformed::Keep;
        }

        if self.base_fragment_names.contains(&target.name.item)
            && target.directives.named(*NO_INLINE_DIRECTIVE_NAME).is_none()
        {
            self.errors.push(Diagnostic::error(
                ValidationMessage::BaseClientFragmentHasNoNormalizationArtifact {
                    fragment_name: target.name.item,
                },
                spread.fragment.location,
            ));
            return Transformed::Keep;
        }

        match spread.alias() {
            Ok(Some(_)) => self.open_client_boundary(spread),
            Ok(None) => {
                self.errors.push(Diagnostic::error(
                    ValidationMessage::ClientBoundaryRequiresAlias {
                        server_document_name: self.document_name_key(),
                        client_fragment_name: target.name.item,
                    },
                    spread.fragment.location,
                ));
                Transformed::Keep
            }
            Err(mut diagnostics) => {
                self.errors.append(&mut diagnostics);
                Transformed::Keep
            }
        }
    }
}

#[derive(
    Clone,
    Debug,
    Eq,
    Error,
    Hash,
    Ord,
    PartialEq,
    PartialOrd,
    serde::Serialize
)]
#[serde(tag = "type")]
enum ValidationMessage {
    #[error(
        "Client-owned document `{document_name}` cannot spread server-owned fragment `{fragment_name}`; client-rooted Relay RSC is not yet supported by this compiler slice."
    )]
    ClientDocumentSpreadsServerFragment {
        document_name: StringKey,
        fragment_name: FragmentDefinitionName,
    },
    #[error(
        "Server-owned document `{server_document_name}` must use `@alias` when it spreads client fragment `{client_fragment_name}`."
    )]
    ClientBoundaryRequiresAlias {
        server_document_name: StringKey,
        client_fragment_name: FragmentDefinitionName,
    },
    #[error(
        "Server-owned document `{server_document_name}` cannot hand off plural client fragment `{client_fragment_name}`; spread it from each singular item instead."
    )]
    PluralClientFragment {
        server_document_name: StringKey,
        client_fragment_name: FragmentDefinitionName,
    },
    #[error(
        "Client fragment `{fragment_name}` cannot cross a server boundary because it has no standalone Reader artifact."
    )]
    ClientFragmentHasNoReaderArtifact {
        fragment_name: FragmentDefinitionName,
    },
    #[error(
        "Client fragment `{fragment_name}` is provided by a base project and cannot cross a server boundary without a precompiled normalization artifact."
    )]
    BaseClientFragmentHasNoNormalizationArtifact {
        fragment_name: FragmentDefinitionName,
    },
    #[error("Client boundary split operation `{operation_name}` already exists.")]
    DuplicateSplitOperation {
        operation_name: OperationDefinitionName,
    },
}
