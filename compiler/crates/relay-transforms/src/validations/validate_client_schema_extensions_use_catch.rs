/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

use std::sync::Arc;
use std::sync::LazyLock;

use common::Diagnostic;
use common::DiagnosticsResult;
use common::DirectiveName;
use common::NamedItem;
use docblock_shared::RELAY_RESOLVER_DIRECTIVE_NAME;
use docblock_shared::RELAY_RESOLVER_MODEL_GENERATED_ID_FIELD_DIRECTIVE_NAME;
use graphql_ir::Field;
use graphql_ir::FragmentDefinition;
use graphql_ir::Program;
use graphql_ir::Validator;
use graphql_ir::reexport::Intern;
use intern::string_key::StringKey;
use schema::Field as SchemaField;
use schema::SDLSchema;
use schema::Schema;
use schema::Type;
use thiserror::Error;

use crate::CATCH_DIRECTIVE_NAME;

static THROW_ON_FIELD_ERROR_DIRECTIVE: LazyLock<DirectiveName> =
    LazyLock::new(|| DirectiveName("throwOnFieldError".intern()));

/// Within @throwOnFieldError, we treat missing data as an error. However, client schema extensions
/// have no practical way to ensure that a field has been set before it is read. This means we must
/// handle the case where a field is missing data gracefully. This validator ensures that all
/// such client schema extension fields are wrapped in a @catch directive.
///
/// Note that within a linked client schema extension, we can't use @catch because it is not
pub fn validate_client_schema_extensions_use_catch(program: &Program) -> DiagnosticsResult<()> {
    let mut validator = EnsureCatch::new(&program.schema);
    validator.validate_program(program)
}

struct EnsureCatch<'a> {
    schema: &'a Arc<SDLSchema>,
}

impl<'a> EnsureCatch<'a> {
    fn new(schema: &'a Arc<SDLSchema>) -> Self {
        Self { schema }
    }

    fn all_implementors_error_semantic_fields(
        &self,
        object_ids: &[schema::ObjectID],
        field_name: StringKey,
    ) -> bool {
        object_ids.iter().all(|object_id| {
            // Use the standard schema method to find the field on the concrete type
            if let Some(concrete_field_id) = self
                .schema
                .named_field(Type::Object(*object_id), field_name)
            {
                let concrete_field = self.schema.field(concrete_field_id);
                self.is_error_semantic_field(concrete_field)
            } else {
                // A client type implementing a server interface may leave out
                // the interface's fields that no document reads on its objects.
                // A server type can only lack one through a schema validation
                // exemption, and its objects have no value there.
                self.schema.object(*object_id).is_extension
            }
        })
    }

    // Some fields don't have guarantees they they will be set. Specifically,
    // client schema extensions fields that are not backed by Relay Resolvers.
    fn is_error_semantic_field(&self, field: &SchemaField) -> bool {
        if !field.is_extension {
            return true;
        }
        // Relay Resolvers are added in such a way that they are marked as extensions, but they don't
        // need to be wrapped in @catch since they are guaranteed by Relay Runtime to be set.
        if field
            .directives
            .named(*RELAY_RESOLVER_DIRECTIVE_NAME)
            .is_some()
        {
            return true;
        }

        // When defining a strong resolver, Relay will create an id field. These fields
        // appear as generarated fields but the Relay runtime ensures they are always set.
        if field
            .directives
            .named(*RELAY_RESOLVER_MODEL_GENERATED_ID_FIELD_DIRECTIVE_NAME)
            .is_some()
        {
            return true;
        }

        let parent_type = match field.parent_type {
            Some(parent_type) => parent_type,
            // Special fields like __id and __typename can be ignored since their existence
            // is guaranteed by Relay. They can be identified by not having a parent type.
            None => return true,
        };

        // If the field type is an interface or union that is itself an extension,
        // but all implementors/members are resolvers, then it should be okay
        match parent_type {
            Type::Interface(interface_id) => {
                let interface = self.schema.interface(interface_id);
                // Check if all implementing objects have this field as a resolver
                return self.all_implementors_error_semantic_fields(
                    &interface.implementing_objects,
                    field.name.item,
                );
            }
            Type::Union(union_id) => {
                let union = self.schema.union(union_id);
                // Check if all union members have this field as a resolver
                return self
                    .all_implementors_error_semantic_fields(&union.members, field.name.item);
            }
            _ => {}
        }

        // The field is an extension and not a resolver
        false
    }
}
impl Validator for EnsureCatch<'_> {
    const NAME: &'static str = "validate_client_schema_extensions_use_catch";
    const VALIDATE_ARGUMENTS: bool = false;
    const VALIDATE_DIRECTIVES: bool = false;

    fn validate_scalar_field(&mut self, field: &graphql_ir::ScalarField) -> DiagnosticsResult<()> {
        let field_definition = self.schema.field(field.definition.item);
        if self.is_error_semantic_field(field_definition) {
            return Ok(());
        }
        match field.directives.named(*CATCH_DIRECTIVE_NAME) {
            Some(_) => Ok(()),
            None => Err(vec![Diagnostic::error(
                ValidationMessage::ClientSchemaExtenstionWithoutCatch,
                field.alias_or_name_location(),
            )]),
        }
    }

    fn validate_linked_field(&mut self, field: &graphql_ir::LinkedField) -> DiagnosticsResult<()> {
        match field.directives.named(*CATCH_DIRECTIVE_NAME) {
            Some(_) => Ok(()),
            None => {
                let field_definition = self.schema.field(field.definition.item);
                if !self.is_error_semantic_field(field_definition) {
                    Err(vec![Diagnostic::error(
                        ValidationMessage::ClientSchemaExtenstionWithoutCatch,
                        field.alias_or_name_location(),
                    )])
                } else {
                    self.default_validate_linked_field(field)
                }
            }
        }
    }

    fn validate_inline_fragment(
        &mut self,
        fragment: &graphql_ir::InlineFragment,
    ) -> DiagnosticsResult<()> {
        match fragment.directives.named(*CATCH_DIRECTIVE_NAME) {
            Some(_) => Ok(()),
            None => self.default_validate_inline_fragment(fragment),
        }
    }

    fn validate_fragment(&mut self, fragment: &FragmentDefinition) -> DiagnosticsResult<()> {
        match fragment.directives.named(*THROW_ON_FIELD_ERROR_DIRECTIVE) {
            Some(_) => self.default_validate_fragment(fragment),
            None => Ok(()),
        }
    }

    fn validate_operation(
        &mut self,
        operation: &graphql_ir::OperationDefinition,
    ) -> DiagnosticsResult<()> {
        match operation.directives.named(*THROW_ON_FIELD_ERROR_DIRECTIVE) {
            Some(_) => self.default_validate_operation(operation),
            None => Ok(()),
        }
    }
}

#[derive(
    Clone,
    Debug,
    Error,
    Eq,
    PartialEq,
    Ord,
    PartialOrd,
    Hash,
    serde::Serialize
)]
#[serde(tag = "type")]
enum ValidationMessage {
    #[error(
        "Expected client-defined field within `@throwOnFieldError` to be annotated with `@catch`. Accessing an unset field is treated as a field error, but Relay cannot guarantee that client field will be set before they are read. Add `@catch` to explicitly handle the case where the field is unset."
    )]
    ClientSchemaExtenstionWithoutCatch,
}
