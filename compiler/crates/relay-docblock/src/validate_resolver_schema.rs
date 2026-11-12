/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

use common::Diagnostic;
use common::DiagnosticsResult;
use common::FeatureFlag;
use common::FeatureFlags;
use common::InterfaceName;
use common::NamedItem;
use docblock_shared::HAS_OUTPUT_TYPE_ARGUMENT_NAME;
use docblock_shared::KEY_RESOLVER_ID_FIELD;
use docblock_shared::RELAY_RESOLVER_DIRECTIVE_NAME;
use docblock_shared::RELAY_RESOLVER_MODEL_DIRECTIVE_NAME;
use docblock_shared::RELAY_RESOLVER_WEAK_OBJECT_DIRECTIVE;
use docblock_shared::RETURN_FRAGMENT_ARGUMENT_NAME;
use errors::try_all;
use errors::try3;
use intern::string_key::StringKey;
use relay_schema::definitions::is_server_value_object;
use schema::InterfaceID;
use schema::Object;
use schema::SDLSchema;
use schema::Schema;
use schema::Type;
use schema::TypeReference;

use crate::errors::SchemaValidationErrorMessages;

pub fn validate_resolver_schema(
    schema: &SDLSchema,
    feature_flags: &FeatureFlags,
    id_field_name: StringKey,
) -> DiagnosticsResult<()> {
    validate_client_implementors_of_server_interfaces(
        schema,
        &feature_flags.enable_client_implementors_of_server_abstract_types,
    )?;
    try3(
        validate_strong_resolver_types(
            schema,
            &feature_flags.enable_client_implementors_of_server_abstract_types,
        ),
        validate_output_type_resolver_types(
            schema,
            &feature_flags.allow_output_type_resolvers,
            id_field_name,
        ),
        validate_mutation_resolvers(schema, feature_flags.enable_relay_resolver_mutations),
    )?;

    Ok(())
}

/// A client type that implements a server interface the project enables
/// implements that interface's server super-interfaces too, so fragments on
/// those read its objects: each must be enabled as well. The field types are
/// left to schema validation, which honors `disable_schema_validation`.
fn validate_client_implementors_of_server_interfaces(
    schema: &SDLSchema,
    enabled: &FeatureFlag,
) -> DiagnosticsResult<()> {
    if matches!(enabled, FeatureFlag::Disabled) {
        return Ok(());
    }
    let mut errors = vec![];
    for object in schema.objects() {
        if !object.is_extension {
            continue;
        }
        // Each interface with the enabled server interface it is reached
        // through, if any.
        let mut pending: Vec<(InterfaceID, Option<InterfaceName>)> = vec![];
        for interface_id in &object.interfaces {
            pending.push((*interface_id, None));
        }
        let mut seen = vec![];
        while let Some((interface_id, through)) = pending.pop() {
            if seen.contains(&interface_id) {
                continue;
            }
            seen.push(interface_id);
            let interface = schema.interface(interface_id);
            let is_enabled =
                !interface.is_extension && enabled.is_enabled_for(interface.name.item.0);
            if !interface.is_extension
                && !is_enabled
                && let Some(through) = through
            {
                errors.push(Diagnostic::error(
                    SchemaValidationErrorMessages::ClientImplementorServerSuperInterfaceNotEnabled {
                        object_name: object.name.item,
                        interface_name: through,
                        super_interface_name: interface.name.item,
                    },
                    object.name.location,
                ));
            }
            let next_through = if is_enabled {
                Some(interface.name.item)
            } else {
                through
            };
            for super_interface_id in &interface.interfaces {
                pending.push((*super_interface_id, next_through));
            }
        }
    }
    if errors.is_empty() {
        Ok(())
    } else {
        Err(errors)
    }
}

fn validate_strong_resolver_types(
    schema: &SDLSchema,
    client_implementors_of_server_abstract_types: &FeatureFlag,
) -> DiagnosticsResult<()> {
    try_all(
        schema
            .objects()
            .filter(|obj| object_is_strong_model_type(obj))
            .map(|strong_model_object| {
                validate_strong_object_interfaces(
                    strong_model_object,
                    schema,
                    client_implementors_of_server_abstract_types,
                )
            }),
    )?;
    Ok(())
}

fn validate_output_type_resolver_types(
    schema: &SDLSchema,
    allow_output_type_resolvers: &FeatureFlag,
    id_field_name: StringKey,
) -> DiagnosticsResult<()> {
    try_all(schema.fields().map(|field| -> DiagnosticsResult<()> {
        if let Some(resolver_directive) = field.directives.named(*RELAY_RESOLVER_DIRECTIVE_NAME) {
            if resolver_directive
                .arguments
                .named(*HAS_OUTPUT_TYPE_ARGUMENT_NAME)
                .is_some()
            {
                // A shadow (`@returnFragment`) resolver returning a non-Node
                // SERVER VALUE type is read INLINE in place off the transplanted
                // record via its `__id`. It is force-tagged
                // `@outputType` upstream (a non-strong object return), but it is a
                // server type, not a client weak/output type, so the
                // weak-required check does not apply.
                let is_shadow_server_value_return = resolver_directive
                    .arguments
                    .named(*RETURN_FRAGMENT_ARGUMENT_NAME)
                    .is_some()
                    && is_server_value_object(schema, field.type_.inner(), id_field_name);

                if let Some(obj_id) = field.type_.inner().get_object_id() {
                    if schema
                        .object(obj_id)
                        .directives
                        .named(*RELAY_RESOLVER_WEAK_OBJECT_DIRECTIVE)
                        .is_none()
                        && !is_shadow_server_value_return
                    {
                        if !allow_output_type_resolvers.is_enabled_for(field.name.item) {
                            return DiagnosticsResult::Err(vec![Diagnostic::error(
                                SchemaValidationErrorMessages::ClientEdgeToClientWeakType,
                                field.name.location,
                            )]);
                        }
                    }
                }
            }
        };

        Ok(())
    }))?;

    Ok(())
}

fn object_is_strong_model_type(object: &Object) -> bool {
    if !object.is_extension {
        return false;
    }

    object
        .directives
        .named(*RELAY_RESOLVER_MODEL_DIRECTIVE_NAME)
        .is_some()
        && object
            .directives
            .named(*RELAY_RESOLVER_WEAK_OBJECT_DIRECTIVE)
            .is_none()
}

fn validate_mutation_resolvers(
    schema: &SDLSchema,
    mutation_resolvers_enabled: bool,
) -> DiagnosticsResult<()> {
    if let Some(mutation_type) = schema.mutation_type() {
        let mutation = match mutation_type {
            Type::Object(object_id) => schema.object(object_id),
            _ => {
                // Someone else will report this error
                return Ok(());
            }
        };

        try_all(
            mutation
                .fields
                .iter()
                .map(|field_id| -> DiagnosticsResult<()> {
                    let field = schema.field(*field_id);
                    if field
                        .directives
                        .named(*RELAY_RESOLVER_DIRECTIVE_NAME)
                        .is_none()
                    {
                        return Ok(());
                    }

                    if !mutation_resolvers_enabled {
                        return DiagnosticsResult::Err(vec![Diagnostic::error(
                            SchemaValidationErrorMessages::DisallowedMutationResolvers {
                                mutation_type_name: mutation.name.item.0,
                            },
                            field.name.location,
                        )]);
                    }
                    let field_type = &field.type_;
                    if !is_valid_mutation_resolver_return_type(field_type) {
                        return DiagnosticsResult::Err(vec![Diagnostic::error(
                            SchemaValidationErrorMessages::MutationResolverNonScalarReturn {
                                resolver_field_name: field.name.item,
                                actual_return_type: schema.get_type_name(field_type.inner()),
                            },
                            field.name.location,
                        )]);
                    }
                    Ok(())
                }),
        )?;
    };

    Ok(())
}

fn is_valid_mutation_resolver_return_type(type_: &TypeReference<Type>) -> bool {
    match type_ {
        TypeReference::Named(named_type) => named_type.is_scalar() || named_type.is_enum(),
        TypeReference::List(_) => false,
        TypeReference::NonNull(non_null_type) => {
            // note: this should be unreachable since we already disallow relay resolvers to return non-nullable types
            // - implement this anyway in case that changes in the future
            is_valid_mutation_resolver_return_type(non_null_type.as_ref())
        }
    }
}

/// Validate that each interface that the strong object implements is client
/// defined, or a server interface the project lets client types implement, and
/// contains an id field that is non-null, either structurally (`id: ID!`) or
/// semantically (`id: ID @semanticNonNull`).
fn validate_strong_object_interfaces(
    object: &Object,
    schema: &SDLSchema,
    client_implementors_of_server_abstract_types: &FeatureFlag,
) -> DiagnosticsResult<()> {
    let location = object.name.location;
    let mut errors = vec![];

    let id_type = schema
        .field(schema.clientid_field())
        .type_
        .inner()
        .get_scalar_id()
        .expect("Expected __id field to be a scalar");
    let non_null_id_type =
        TypeReference::NonNull(Box::new(TypeReference::Named(Type::Scalar(id_type))));

    for interface in &object.interfaces {
        let interface = schema.interface(*interface);

        if !interface.is_extension
            && !client_implementors_of_server_abstract_types.is_enabled_for(interface.name.item.0)
        {
            errors.push(
                Diagnostic::error(
                    SchemaValidationErrorMessages::UnexpectedServerInterface {
                        interface_name: interface.name.item,
                    },
                    location,
                )
                .annotate_if_location_exists("Defined here", interface.name.location),
            );
        } else {
            let found_id_field = interface.fields.iter().find_map(|field_id| {
                let field = schema.field(*field_id);
                if field.name.item == *KEY_RESOLVER_ID_FIELD {
                    Some(field)
                } else {
                    None
                }
            });
            match found_id_field {
                Some(id_field) => {
                    // Compared against the SEMANTIC type, so `id: ID @semanticNonNull`
                    // is accepted alongside `id: ID!`. Semantic non-null already means
                    // non-null everywhere else in the compiler — typegen, `@required`
                    // and schema validation all read `semantic_type()` — and a strong
                    // object's own identity is non-null by construction, so this
                    // interface declaration is a contract for consumers rather than
                    // the mechanism that identifies the model. A plain nullable
                    // `id: ID` carries no such guarantee and is still rejected.
                    if id_field.semantic_type() != non_null_id_type {
                        let mut invalid_type_string = String::new();
                        // The type as WRITTEN, so the diagnostic shows what the author
                        // declared rather than a type they never typed.
                        schema
                            .write_type_string(&mut invalid_type_string, &id_field.type_)
                            .expect("Failed to write type to string.");

                        errors.push(
                            Diagnostic::error(
                                SchemaValidationErrorMessages::InterfaceWithWrongIdField {
                                    interface_name: interface.name.item,
                                    invalid_type_string,
                                },
                                id_field.name.location,
                            )
                            .annotate("required because the interface is implemented by a Relay Resolver type here", object.name.location),
                        )
                    }
                }
                None => errors.push(
                    Diagnostic::error(
                        SchemaValidationErrorMessages::InterfaceWithNoIdField {
                            interface_name: interface.name.item,
                        },
                        interface.name.location,
                    )
                            .annotate("required because the interface is implemented by a Relay Resolver type here", object.name.location),
                ),
            };
        }
    }
    if errors.is_empty() {
        Ok(())
    } else {
        Err(errors)
    }
}
