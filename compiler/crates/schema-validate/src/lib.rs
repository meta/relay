/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

mod errors;

use std::sync::LazyLock;

use common::ArgumentName;
use common::Diagnostic;
use common::DiagnosticsResult;
use common::DirectiveName;
use common::FeatureFlag;
use common::InterfaceName;
use common::Location;
use common::Named;
use common::NamedItem;
use common::WithLocation;
use errors::*;
use fnv::FnvHashMap;
use fnv::FnvHashSet;
use intern::Lookup;
use intern::string_key::Intern;
use intern::string_key::StringKey;
use rayon::prelude::*;
use regex::Regex;
use schema::DirectiveValue;
use schema::EnumID;
use schema::Field;
use schema::FieldID;
use schema::InputObjectID;
use schema::Interface;
use schema::SDLSchema;
use schema::Schema;
use schema::Type;
use schema::TypeReference;
use schema::TypeWithFields;
use schema::UnionID;

static INTROSPECTION_TYPES: LazyLock<FnvHashSet<StringKey>> = LazyLock::new(|| {
    vec![
        "__Schema".intern(),
        "__Directive".intern(),
        "__DirectiveLocation".intern(),
        "__Type".intern(),
        "__Field".intern(),
        "__InputValue".intern(),
        "__EnumValue".intern(),
        "__TypeKind".intern(),
    ]
    .into_iter()
    .collect()
});
static QUERY: LazyLock<StringKey> = LazyLock::new(|| "Query".intern());
static SUBSCRIPTION: LazyLock<StringKey> = LazyLock::new(|| "Subscription".intern());
static MUTATION: LazyLock<StringKey> = LazyLock::new(|| "Mutation".intern());
static TYPE_NAME_REGEX: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"^[_a-zA-Z][_a-zA-Z0-9]*$").unwrap());
static SEMANTIC_NON_NULL_DIRECTIVE: LazyLock<DirectiveName> =
    LazyLock::new(|| DirectiveName("semanticNonNull".intern()));

pub struct SchemaValidationOptions<'a> {
    pub allow_introspection_names: bool,
    /// Schema coordinates to skip: `Type` skips every check on that type, and
    /// `Type.field` skips the checks on that field, including whether it
    /// satisfies the interfaces `Type` implements. An entry of a limited
    /// allowlist that skips no error is reported.
    pub exempt_coordinates: &'a FeatureFlag,
}

pub fn validate(schema: &SDLSchema, options: SchemaValidationOptions<'_>) -> DiagnosticsResult<()> {
    let mut validation_context = ValidationContext::new(schema, &options);
    validation_context.validate();
    if validation_context.diagnostics.is_empty() {
        Ok(())
    } else {
        validation_context
            .diagnostics
            .sort_by_key(|diagnostic| diagnostic.location());
        Err(validation_context.diagnostics)
    }
}

pub struct ValidationContext<'schema> {
    schema: &'schema SDLSchema,
    options: &'schema SchemaValidationOptions<'schema>,
    diagnostics: Vec<Diagnostic>,
    /// Exempt coordinates that skipped at least one error.
    used_exempt_coordinates: FnvHashSet<StringKey>,
}

impl<'schema> ValidationContext<'schema> {
    pub fn new(
        schema: &'schema SDLSchema,
        options: &'schema SchemaValidationOptions<'schema>,
    ) -> Self {
        Self {
            schema,
            options,
            diagnostics: Default::default(),
            used_exempt_coordinates: Default::default(),
        }
    }

    fn validate(&mut self) {
        self.validate_root_types();
        self.validate_directives();
        self.validate_types();
        self.validate_exempt_coordinates_are_used();
    }

    fn validate_root_types(&mut self) {
        self.validate_root_type(self.schema.query_type(), *QUERY);
        self.validate_root_type(self.schema.subscription_type(), *SUBSCRIPTION);
        self.validate_root_type(self.schema.mutation_type(), *MUTATION);
    }

    fn validate_root_type(&mut self, root_type: Option<Type>, type_name: StringKey) {
        if let Some(type_) = root_type {
            if !type_.is_object() {
                self.report_diagnostic(Diagnostic::error(
                    SchemaValidationError::InvalidRootType(
                        type_name,
                        type_.get_variant_name().to_string(),
                    ),
                    self.get_type_definition_location(type_),
                ));
            }
        } else if type_name == *QUERY {
            self.diagnostics.push(Diagnostic::error(
                SchemaValidationError::MissingRootType(type_name),
                Location::generated(),
            ));
        }
    }

    fn validate_directives(&mut self) {
        for directive in self.schema.get_directives() {
            self.validate_name(directive.name.item.0, directive.name.location);
            let mut arg_names: FnvHashMap<ArgumentName, Location> = FnvHashMap::default();
            for argument in directive.arguments.iter() {
                self.validate_name(argument.name.item.0, argument.name.location);

                // Ensure unique arguments per directive.
                if let Some(prev_loc) = arg_names.get(&argument.name.item) {
                    self.report_diagnostic(
                        Diagnostic::error(
                            SchemaValidationError::DuplicateArgument(
                                argument.name.item,
                                directive.name.item.0,
                            ),
                            argument.name.location,
                        )
                        .annotate("Previously defined here:", *prev_loc),
                    );
                    continue;
                }
                arg_names.insert(argument.name.item, argument.name.location);
            }
        }
    }

    fn validate_types(&mut self) {
        let exempt_coordinates = self.options.exempt_coordinates;
        let (diagnostics, used_exempt_coordinates) = self
            .schema
            .get_type_map_par_iter()
            .map(|(type_name, type_)| {
                let mut child_visitor = Self::new(self.schema, self.options);
                child_visitor.validate_type(*type_name, type_);
                if !child_visitor.diagnostics.is_empty()
                    && exempt_coordinates.is_enabled_for(*type_name)
                {
                    child_visitor.diagnostics.clear();
                    child_visitor.used_exempt_coordinates.insert(*type_name);
                }
                (
                    child_visitor.diagnostics,
                    child_visitor.used_exempt_coordinates,
                )
            })
            .reduce(
                || (Vec::new(), FnvHashSet::default()),
                |(mut diagnostics, mut used), (more_diagnostics, more_used)| {
                    diagnostics.extend(more_diagnostics);
                    used.extend(more_used);
                    (diagnostics, used)
                },
            );
        self.diagnostics.extend(diagnostics);
        self.used_exempt_coordinates.extend(used_exempt_coordinates);
    }

    fn validate_type(&mut self, type_name: StringKey, type_: &Type) {
        // Ensure it is named correctly (excluding introspection types).
        if !is_introspection_type(type_, type_name) {
            self.validate_name(type_name, self.get_type_definition_location(*type_));
        }
        match type_ {
            Type::Enum(id) => {
                // Ensure Enums have valid values.
                self.validate_enum_type(*id);
            }
            Type::InputObject(id) => {
                // Ensure Input Object fields are valid.
                self.validate_input_object_fields(*id);
            }
            Type::Interface(id) => {
                let interface = self.schema.interface(*id);
                // Ensure fields are valid
                self.validate_fields(type_name, &interface.fields);

                // Validate cyclic references
                if !self.validate_cyclic_implements_reference(interface) {
                    // Ensure interface implement the interfaces they claim to.
                    self.validate_type_with_interfaces(interface);
                }
            }
            Type::Object(id) => {
                let object = self.schema.object(*id);
                // Ensure fields are valid
                self.validate_fields(type_name, &object.fields);

                // Ensure objects implement the interfaces they claim to.
                self.validate_type_with_interfaces(object);
            }
            Type::Union(id) => {
                // Ensure Unions include valid member types.
                self.validate_union_members(*id);
            }
            Type::Scalar(_id) => {}
        };
    }

    fn validate_fields(&mut self, type_name: StringKey, fields: &[FieldID]) {
        // Must define one or more fields.
        if fields.is_empty() {
            self.report_diagnostic(Diagnostic::error(
                SchemaValidationError::TypeWithNoFields(type_name),
                self.get_type_definition_location(self.schema.get_type(type_name).unwrap()),
            ));
        }

        let mut field_names: FnvHashMap<StringKey, Location> = FnvHashMap::default();
        for field_id in fields {
            let field = self.schema.field(*field_id);
            self.validate_field(type_name, field.name.item, |this| {
                if let Some(field_loc) = field_names.get(&field.name.item) {
                    this.report_diagnostic(
                        Diagnostic::error(
                            SchemaValidationError::DuplicateField(field.name.item),
                            field.name.location,
                        )
                        .annotate("Previously defined here:", field_loc.clone()),
                    );
                    return;
                }
                field_names.insert(field.name.item, field.name.location);

                // Ensure they are named correctly.
                this.validate_name(field.name.item, field.name.location);

                // Ensure the type is an output type
                if !is_output_type(&field.type_) {
                    this.report_diagnostic(Diagnostic::error(
                        SchemaValidationError::InvalidFieldType(
                            type_name,
                            field.name.item,
                            field.type_.inner().get_variant_name().to_string(),
                        ),
                        field.name.location,
                    ))
                }

                let mut arg_names: FnvHashMap<ArgumentName, Location> = FnvHashMap::default();
                for argument in field.arguments.iter() {
                    // Ensure they are named correctly.
                    this.validate_name(argument.name.item.0, argument.name.location);

                    // Ensure they are unique per field.
                    // Ensure unique arguments per directive.
                    if let Some(previous_loc) = arg_names.get(&argument.name.item) {
                        this.report_diagnostic(
                            Diagnostic::error(
                                SchemaValidationError::DuplicateArgument(
                                    argument.name.item,
                                    field.name.item,
                                ),
                                field.name.location,
                            )
                            .annotate("Previously defined here:", *previous_loc),
                        );
                        continue;
                    }
                    arg_names.insert(argument.name.item, argument.name.location);

                    // Ensure the type is an input type
                    if !is_input_type(&argument.type_) {
                        this.report_diagnostic(Diagnostic::error(
                            SchemaValidationError::InvalidArgumentType(
                                type_name,
                                field.name.item,
                                argument.name.item,
                                argument.type_.inner().get_variant_name().to_string(),
                            ),
                            argument.name.location, // Note: Schema does not retain location information for argument type reference
                        ));
                    }
                }
            });
        }
    }

    fn validate_union_members(&mut self, id: UnionID) {
        let union = self.schema.union(id);
        if union.members.is_empty() {
            self.report_diagnostic(Diagnostic::error(
                SchemaValidationError::UnionWithNoMembers(union.name.item),
                union.name.location,
            ));
        }

        let mut member_names = FnvHashSet::default();
        for member in union.members.iter() {
            let member_name = self.schema.object(*member).name;
            if member_names.contains(&member_name.item) {
                self.report_diagnostic(Diagnostic::error(
                    SchemaValidationError::DuplicateMember(member_name.item),
                    union.name.location, // Schema does not track location of union members
                ));
                continue;
            }
            member_names.insert(member_name.item);
        }
    }

    fn validate_enum_type(&mut self, id: EnumID) {
        let enum_ = self.schema.enum_(id);
        if enum_.values.is_empty() {
            self.report_diagnostic(Diagnostic::error(
                SchemaValidationError::EnumWithNoValues,
                enum_.name.location,
            ))
        }

        for value in enum_.values.iter() {
            // Ensure valid name.
            self.validate_name(value.value, enum_.name.location); // Note: Schema does not have location for enum value
            let value_name = value.value.lookup();
            if value_name == "true" || value_name == "false" || value_name == "null" {
                self.report_diagnostic(Diagnostic::error(
                    SchemaValidationError::InvalidEnumValue(value.value),
                    enum_.name.location, // Schema does not track location information for individual enum values
                ));
            }
        }
    }

    fn validate_input_object_fields(&mut self, id: InputObjectID) {
        let input_object = self.schema.input_object(id);
        if input_object.fields.is_empty() {
            self.report_diagnostic(Diagnostic::error(
                SchemaValidationError::TypeWithNoFields(input_object.name.item.0),
                input_object.name.location,
            ));
        }

        // Ensure the arguments are valid
        for field in input_object.fields.iter() {
            // Ensure they are named correctly.
            self.validate_name(field.name.item.0, field.name.location);

            // Ensure the type is an input type
            if !is_input_type(&field.type_) {
                self.report_diagnostic(Diagnostic::error(
                    SchemaValidationError::InvalidArgumentType(
                        input_object.name.item.0,
                        field.name.item.0,
                        field.name.item,
                        field.type_.inner().get_variant_name().to_string(),
                    ),
                    field.name.location,
                ));
            }
        }
    }

    fn validate_type_with_interfaces<T: TypeWithFields + Named>(&mut self, type_: &T) {
        let typename = type_.name().lookup().intern();
        let mut interface_names: FnvHashMap<InterfaceName, Location> = FnvHashMap::default();
        for interface_id in type_.interfaces().iter() {
            let interface = self.schema.interface(*interface_id);
            if let Some(prev_loc) = interface_names.get(&interface.name.item) {
                self.report_diagnostic(
                    Diagnostic::error(
                        SchemaValidationError::DuplicateInterfaceImplementation(
                            typename,
                            interface.name.item,
                        ),
                        interface.name.location,
                    )
                    .annotate("Previously defined here:", *prev_loc),
                );
                continue;
            }
            interface_names.insert(interface.name.item, interface.name.location);
            self.validate_type_implements_interface(type_, interface);
        }
    }

    fn validate_type_implements_interface<T: TypeWithFields + Named>(
        &mut self,
        type_: &T,
        interface: &Interface,
    ) {
        let typename = type_.name().lookup().intern();
        let object_field_map = self.field_map(type_.fields());
        let interface_field_map = self.field_map(&interface.fields);

        // Assert each interface field is implemented.
        for (field_name, interface_field) in interface_field_map {
            self.validate_field(typename, field_name, |this| {
                // Assert interface field exists on object.
                let Some(object_field) = object_field_map.get(&field_name) else {
                    this.report_diagnostic(
                        Diagnostic::error(
                            SchemaValidationError::InterfaceFieldNotProvided(
                                interface.name.item,
                                field_name,
                                type_.type_kind(),
                                typename,
                            ),
                            *type_.location(),
                        )
                        .annotate(
                            "The interface field is defined here:",
                            interface_field.name.location,
                        ),
                    );
                    return;
                };

                // Assert interface field type is satisfied by object field type, by being
                // a valid subtype. (covariant)
                if !this.schema.is_type_subtype_of(
                    &object_field.semantic_type(),
                    &interface_field.semantic_type(),
                ) {
                    let object_field_semantic_type = SemanticTypeReference::new(
                        object_field.type_.clone(),
                        this.schema,
                        object_field.directives.clone(),
                    );
                    let interface_field_semantic_type = SemanticTypeReference::new(
                        interface_field.type_.clone(),
                        this.schema,
                        interface_field.directives.clone(),
                    );
                    this.report_diagnostic(
                        Diagnostic::error(
                            SchemaValidationError::NotASubType(
                                interface.name.item,
                                field_name,
                                get_type_string(&interface_field_semantic_type),
                                typename,
                                get_type_string(&object_field_semantic_type),
                            ),
                            object_field.name.location,
                        )
                        .annotate(
                            "The interface field is defined here:",
                            interface_field.name.location,
                        ),
                    );
                }

                // Assert each interface field arg is implemented.
                for interface_argument in interface_field.arguments.iter() {
                    let object_argument = object_field
                        .arguments
                        .iter()
                        .find(|arg| arg.name.item == interface_argument.name.item);

                    // Assert interface field arg exists on object field.
                    if object_argument.is_none() {
                        this.report_diagnostic(
                            Diagnostic::error(
                                SchemaValidationError::InterfaceFieldArgumentNotProvided(
                                    interface.name.item,
                                    field_name,
                                    interface_argument.name.item,
                                    typename,
                                ),
                                object_field.name.location,
                            )
                            .annotate(
                                "The interface field argument is defined here:",
                                interface_argument.name.location,
                            ),
                        );
                        continue;
                    }
                    let object_argument = object_argument.unwrap();

                    // Assert interface field arg type matches object field arg type.
                    // (invariant)
                    // TODO: change to contravariant?
                    if interface_argument.type_ != object_argument.type_ {
                        this.report_diagnostic(
                            Diagnostic::error(
                                SchemaValidationError::NotEqualType(
                                    interface.name.item,
                                    field_name,
                                    interface_argument.name.item,
                                    this.schema.get_type_string(&interface_argument.type_),
                                    typename,
                                    this.schema.get_type_string(&object_argument.type_),
                                ),
                                object_argument.name.location,
                            )
                            .annotate(
                                "The interface field argument is defined here:",
                                interface_argument.name.location,
                            ),
                        );
                    }
                    // TODO: validate default values?
                }

                // Assert additional arguments must not be required.
                for object_argument in object_field.arguments.iter() {
                    if !interface_field
                        .arguments
                        .contains(object_argument.name.item.0)
                        && object_argument.type_.is_non_null()
                    {
                        this.report_diagnostic(
                            Diagnostic::error(
                                SchemaValidationError::MissingRequiredArgument(
                                    typename,
                                    field_name,
                                    object_argument.name.item,
                                    interface.name.item,
                                ),
                                object_argument.name.location,
                            )
                            .annotate(
                                "The interface field is define here:",
                                interface_field.name.location,
                            ),
                        );
                    }
                }
            });
        }
    }

    fn validate_cyclic_implements_reference(&mut self, interface: &Interface) -> bool {
        for id in interface.interfaces() {
            let mut path = Vec::new();
            let mut visited = FnvHashSet::default();
            if self.has_path(
                self.schema.interface(*id),
                interface.name.item,
                &mut path,
                &mut visited,
            ) {
                let mut diagnostic = Diagnostic::error(
                    SchemaValidationError::CyclicInterfaceInheritance(format!(
                        "{}->{}",
                        path.iter()
                            .map(|name| name.item.lookup())
                            .collect::<Vec<_>>()
                            .join("->"),
                        interface.name.item
                    )),
                    interface.name.location,
                );

                for name in path.iter().rev() {
                    diagnostic = diagnostic.annotate("->", name.location);
                }
                self.report_diagnostic(diagnostic);
                return true;
            }
        }
        false
    }

    fn has_path(
        &self,
        root: &Interface,
        target: InterfaceName,
        path: &mut Vec<WithLocation<InterfaceName>>,
        visited: &mut FnvHashSet<StringKey>,
    ) -> bool {
        if visited.contains(&root.name.item.0) {
            return false;
        }

        if root.name.item == target {
            return true;
        }

        path.push(root.name);
        visited.insert(root.name.item.0);
        for id in root.interfaces() {
            if self.has_path(self.schema.interface(*id), target, path, visited) {
                return true;
            }
        }
        path.remove(path.len() - 1);
        false
    }

    fn validate_name(&mut self, name: StringKey, location: Location) {
        let name = name.lookup();

        if !self.options.allow_introspection_names {
            let mut chars = name.chars();
            if name.len() > 1 && chars.next() == Some('_') && chars.next() == Some('_') {
                self.report_diagnostic(Diagnostic::error(
                    SchemaValidationError::InvalidNamePrefix(name.to_string()),
                    location,
                ));
            }
        }

        if !TYPE_NAME_REGEX.is_match(name) {
            self.report_diagnostic(Diagnostic::error(
                SchemaValidationError::InvalidName(name.to_string()),
                location,
            ));
        }
    }

    fn field_map(&mut self, fields: &[FieldID]) -> FnvHashMap<StringKey, Field> {
        fields
            .iter()
            .map(|id| self.schema.field(*id))
            .map(|field| (field.name.item, field.clone()))
            .collect::<FnvHashMap<_, _>>()
    }

    /// Runs the checks on the field `type_name.field_name`, dropping the
    /// diagnostics they report if that schema coordinate is exempt. The checks
    /// must only report diagnostics about this field.
    fn validate_field(
        &mut self,
        type_name: StringKey,
        field_name: StringKey,
        validate: impl FnOnce(&mut Self),
    ) {
        let first_diagnostic = self.diagnostics.len();
        validate(self);
        if self.diagnostics.len() == first_diagnostic {
            return;
        }
        let coordinate = format!("{type_name}.{field_name}").intern();
        if self.options.exempt_coordinates.is_enabled_for(coordinate) {
            self.diagnostics.truncate(first_diagnostic);
            self.used_exempt_coordinates.insert(coordinate);
        }
    }

    /// Reports each entry of a limited allowlist that skipped no error, so the
    /// allowlist shrinks as the errors behind it are fixed.
    fn validate_exempt_coordinates_are_used(&mut self) {
        let FeatureFlag::Limited { allowlist } = self.options.exempt_coordinates else {
            return;
        };
        let diagnostics = allowlist
            .iter()
            .filter(|coordinate| !self.used_exempt_coordinates.contains(*coordinate))
            .map(|coordinate| {
                Diagnostic::error(
                    SchemaValidationError::UnusedExemptCoordinate(*coordinate),
                    self.exempt_coordinate_location(*coordinate),
                )
            })
            .collect::<Vec<_>>();
        self.diagnostics.extend(diagnostics);
    }

    /// The definition of the field `coordinate` names, or of its type if the
    /// type has no such field. Generated if the schema has no such type.
    fn exempt_coordinate_location(&self, coordinate: StringKey) -> Location {
        let (type_name, field_name) = match coordinate.lookup().split_once('.') {
            Some((type_name, field_name)) => (type_name, Some(field_name.intern())),
            None => (coordinate.lookup(), None),
        };
        let Some(type_) = self.schema.get_type(type_name.intern()) else {
            return Location::generated();
        };
        let field_id = field_name.and_then(|field_name| match type_ {
            Type::Object(id) => self.schema.object(id).named_field(field_name, self.schema),
            Type::Interface(id) => self
                .schema
                .interface(id)
                .named_field(field_name, self.schema),
            _ => None,
        });
        match field_id {
            Some(field_id) => self.schema.field(field_id).name.location,
            None => self.get_type_definition_location(type_),
        }
    }

    fn report_diagnostic(&mut self, diagnostic: Diagnostic) {
        self.diagnostics.push(diagnostic);
    }

    fn get_type_definition_location(&self, type_: Type) -> Location {
        match type_ {
            Type::Enum(id) => self.schema.enum_(id).name.location,
            Type::InputObject(id) => self.schema.input_object(id).name.location,
            Type::Interface(id) => self.schema.interface(id).name.location,
            Type::Object(id) => self.schema.object(id).name.location,
            Type::Scalar(id) => self.schema.scalar(id).name.location,
            Type::Union(id) => self.schema.union(id).name.location,
        }
    }
}

fn is_named_type(type_: &Type) -> bool {
    type_.is_enum()
        || type_.is_input_type()
        || type_.is_interface()
        || type_.is_object()
        || type_.is_scalar()
        || type_.is_union()
}

fn is_introspection_type(type_: &Type, type_name: StringKey) -> bool {
    is_named_type(type_) && INTROSPECTION_TYPES.contains(&type_name)
}

fn is_output_type(type_: &TypeReference<Type>) -> bool {
    let type_ = type_.inner();
    type_.is_enum()
        || type_.is_interface()
        || type_.is_object()
        || type_.is_scalar()
        || type_.is_union()
}

fn is_input_type(type_: &TypeReference<Type>) -> bool {
    let type_ = type_.inner();
    type_.is_enum() || type_.is_input_type() || type_.is_scalar()
}

#[derive(Clone, Debug)]
enum SemanticTypeReference<'schema, T> {
    SemanticNonNull(Box<TypeReference<T>>, &'schema SDLSchema, DirectiveValue),
    SemanticNullable(Box<TypeReference<T>>, &'schema SDLSchema),
}

impl<'schema, T> SemanticTypeReference<'schema, T> {
    pub fn new(
        inner: TypeReference<T>,
        schema: &'schema SDLSchema,
        directives: Vec<DirectiveValue>,
    ) -> SemanticTypeReference<'schema, T> {
        let semantic_non_null_directive = directives.named(*SEMANTIC_NON_NULL_DIRECTIVE);
        match semantic_non_null_directive {
            Some(directive) => {
                SemanticTypeReference::SemanticNonNull(Box::new(inner), schema, directive.clone())
            }
            None => SemanticTypeReference::SemanticNullable(Box::new(inner), schema),
        }
    }
}

fn get_type_string<'schema>(type_: &SemanticTypeReference<'schema, Type>) -> String {
    match type_ {
        SemanticTypeReference::SemanticNonNull(inner, schema, directive) => {
            let levels = directive.arguments.first();
            let type_string = schema.get_type_string(inner);
            match levels {
                Some(levels) => {
                    format!("{} @semanticNonNull(levels: {})", type_string, levels.value)
                }
                None => format!("{} @semanticNonNull", type_string),
            }
        }
        SemanticTypeReference::SemanticNullable(inner, schema) => schema.get_type_string(inner),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn validate_schema_source(source: &str) -> DiagnosticsResult<()> {
        let schema = schema::build_schema(source).expect("test schema should build");
        validate(
            &schema,
            SchemaValidationOptions {
                allow_introspection_names: false,
                exempt_coordinates: &FeatureFlag::Disabled,
            },
        )
    }

    fn assert_mismatch_message_and_locations(source: &str, expected: &str) {
        let schema = schema::build_schema(source).expect("test schema should build");
        let errors = validate(
            &schema,
            SchemaValidationOptions {
                allow_introspection_names: false,
                exempt_coordinates: &FeatureFlag::Disabled,
            },
        )
        .expect_err("O.value should not satisfy I.value");
        assert_eq!(errors.len(), 1);
        assert_eq!(errors[0].message().to_string(), expected);
        let object_type = schema.get_type("O".intern()).expect("O should exist");
        let interface_type = schema.get_type("I".intern()).expect("I should exist");
        let object_field = schema
            .named_field(object_type, "value".intern())
            .expect("O.value should exist");
        let interface_field = schema
            .named_field(interface_type, "value".intern())
            .expect("I.value should exist");
        assert_eq!(
            errors[0].location(),
            schema.field(object_field).name.location
        );
        let related = errors[0].related_information();
        assert_eq!(related.len(), 1);
        assert_eq!(
            related[0].location,
            schema.field(interface_field).name.location
        );
        assert_eq!(
            related[0].message.to_string(),
            "The interface field is defined here:"
        );
    }

    #[test]
    fn compatible_interface_types_keep_success() {
        assert!(
            validate_schema_source(
                "type Query { value: O }
             interface I { value: String }
             type O implements I { value: String }",
            )
            .is_ok()
        );
    }

    #[test]
    fn compatible_semantic_non_null_types_keep_success() {
        assert!(
            validate_schema_source(
                "type Query { value: O }
             interface I { value: String @semanticNonNull }
             type O implements I { value: String! }",
            )
            .is_ok()
        );
    }

    #[test]
    fn ordinary_subtype_mismatch_keeps_rendered_types_and_locations() {
        assert_mismatch_message_and_locations(
            "type Query { value: O }
             interface I { value: ID }
             type O implements I { value: String }",
            "Interface field 'I.value' expects type 'ID' but 'O.value' is of type 'String'.",
        );
    }

    #[test]
    fn exempt_semantic_mismatch_keeps_coordinate_accounting() {
        let schema = schema::build_schema(
            "type Query { value: O }
             interface I { value: String @semanticNonNull }
             type O implements I { value: String }",
        )
        .expect("test schema should build");
        let exemptions = FeatureFlag::Limited {
            allowlist: ["O.value".intern()].into_iter().collect(),
        };
        assert!(
            validate(
                &schema,
                SchemaValidationOptions {
                    allow_introspection_names: false,
                    exempt_coordinates: &exemptions,
                },
            )
            .is_ok()
        );
    }

    #[test]
    fn duplicate_interface_and_semantic_mismatch_both_remain_errors() {
        let errors = validate_schema_source(
            "type Query { value: O }
             interface I { value: String @semanticNonNull }
             type O implements I & I { value: String }",
        )
        .expect_err("the semantic mismatch and duplicate interface should both remain");
        assert_eq!(errors.len(), 2);
        let classes = format!("{errors:?}");
        assert!(classes.contains("NotASubType"));
        assert!(classes.contains("DuplicateInterfaceImplementation"));
    }

    #[test]
    fn semantic_non_null_mismatch_keeps_rendered_types_and_locations() {
        assert_mismatch_message_and_locations(
            "type Query { value: O }
             interface I { value: String @semanticNonNull }
             type O implements I { value: String }",
            "Interface field 'I.value' expects type 'String @semanticNonNull' but 'O.value' is of type 'String'.",
        );
    }
}
