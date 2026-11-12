/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

//! The object types the client defines (Relay Resolver types and client schema
//! extension types) that implement a server interface or belong to a server
//! union.
//!
//! A server abstract type is an open set: the server can add implementors
//! without a client compile, so the compiler never lists the server's
//! implementors. The implementors the client defines are a closed set the
//! compiler can list. Building the schema records them on each server
//! interface and union that `enable_client_implementors_of_server_abstract_types`
//! names, as `@__clientImplementors(types: [...])`, so every later pass reads
//! them from the schema it already has, and so does anyone reading the printed
//! schema.

use std::collections::HashMap;
use std::sync::LazyLock;

use common::ArgumentName;
use common::DiagnosticsResult;
use common::DirectiveName;
use common::FeatureFlag;
use common::NamedItem;
use common::Span;
use graphql_syntax::ConstantValue;
use graphql_syntax::List;
use graphql_syntax::StringNode;
use graphql_syntax::Token;
use graphql_syntax::TokenKind;
use intern::Lookup;
use schema::ArgumentValue;
use schema::DirectiveValue;
use schema::InterfaceID;
use schema::ObjectID;
use schema::SDLSchema;
use schema::Schema;
use schema::Type;
use schema::UnionID;

/// Lists, on a server interface or union, the object types the client defines
/// that implement or join it, by name and sorted.
static CLIENT_IMPLEMENTORS_DIRECTIVE_NAME: LazyLock<DirectiveName> =
    LazyLock::new(|| DirectiveName(intern::intern!("__clientImplementors")));
static TYPES_ARGUMENT_NAME: LazyLock<ArgumentName> =
    LazyLock::new(|| ArgumentName(intern::intern!("types")));

/// Records the client-defined implementors of each server abstract type that
/// `enabled` names. Any other server abstract type gets no directive, so its
/// selections compile as they did before client implementors existed. One pass
/// over the object types; its cost does not grow with the number of server
/// implementors (`Node` has tens of thousands). Runs once all client types are
/// in the schema, which must be an in-memory one.
pub fn mark_client_implementors(
    schema: &mut SDLSchema,
    enabled: &FeatureFlag,
) -> DiagnosticsResult<()> {
    remove_client_implementors_directives(schema)?;
    if matches!(enabled, FeatureFlag::Disabled) {
        return Ok(());
    }
    let client_implementors = collect_client_implementors(schema, enabled);
    for (interface_id, object_ids) in client_implementors.interfaces {
        let directive = client_implementors_directive(schema, &object_ids);
        let mut interface = schema.interface(interface_id).clone();
        interface.directives.push(directive);
        schema.replace_interface(interface_id, interface)?;
    }
    for (union_id, object_ids) in client_implementors.unions {
        let directive = client_implementors_directive(schema, &object_ids);
        let mut union = schema.union(union_id).clone();
        union.directives.push(directive);
        schema.replace_union(union_id, union)?;
    }
    Ok(())
}

/// The client-defined implementors of `type_` when it is a server interface or
/// union the schema build recorded, sorted by name. Empty for a client abstract
/// type, whose implementors are all known, and for any other type.
pub fn client_implementors_of(schema: &SDLSchema, type_: Type) -> Vec<ObjectID> {
    let mut object_ids = Vec::new();
    let Some(directive) = client_implementors_directive_of(schema, type_) else {
        return object_ids;
    };
    let Some(argument) = directive.arguments.named(*TYPES_ARGUMENT_NAME) else {
        return object_ids;
    };
    let ConstantValue::List(names) = &argument.value else {
        return object_ids;
    };
    for name in &names.items {
        if let ConstantValue::String(name) = name
            && let Some(Type::Object(object_id)) = schema.get_type(name.value)
        {
            object_ids.push(object_id);
        }
    }
    object_ids
}

/// Whether `type_` is a server abstract type that a client-defined type
/// implements, so a value of it can be a client object.
pub fn has_client_implementors(schema: &SDLSchema, type_: Type) -> bool {
    client_implementors_directive_of(schema, type_).is_some()
}

/// Whether any server abstract type has a client-defined implementor.
pub fn has_any_client_implementors(schema: &SDLSchema) -> bool {
    for interface in schema.get_interfaces() {
        if is_marked(&interface.directives) {
            return true;
        }
    }
    for union in schema.get_unions() {
        if is_marked(&union.directives) {
            return true;
        }
    }
    false
}

fn is_marked(directives: &[DirectiveValue]) -> bool {
    directives
        .named(*CLIENT_IMPLEMENTORS_DIRECTIVE_NAME)
        .is_some()
}

fn is_not_client_implementors_directive(directive: &DirectiveValue) -> bool {
    directive.name != *CLIENT_IMPLEMENTORS_DIRECTIVE_NAME
}

fn client_implementors_directive_of(schema: &SDLSchema, type_: Type) -> Option<&DirectiveValue> {
    let directives = match type_ {
        Type::Interface(interface_id) => &schema.interface(interface_id).directives,
        Type::Union(union_id) => &schema.union(union_id).directives,
        _ => return None,
    };
    directives.named(*CLIENT_IMPLEMENTORS_DIRECTIVE_NAME)
}

/// Only the schema build writes the directive: one a schema file wrote would
/// turn the feature on without the flag, so it is dropped.
fn remove_client_implementors_directives(schema: &mut SDLSchema) -> DiagnosticsResult<()> {
    let mut interface_ids = vec![];
    for interface in schema.get_interfaces() {
        if is_marked(&interface.directives)
            && let Some(Type::Interface(interface_id)) = schema.get_type(interface.name.item.0)
        {
            interface_ids.push(interface_id);
        }
    }
    let mut union_ids = vec![];
    for union in schema.get_unions() {
        if is_marked(&union.directives)
            && let Some(Type::Union(union_id)) = schema.get_type(union.name.item.0)
        {
            union_ids.push(union_id);
        }
    }
    for interface_id in interface_ids {
        let mut interface = schema.interface(interface_id).clone();
        interface
            .directives
            .retain(is_not_client_implementors_directive);
        schema.replace_interface(interface_id, interface)?;
    }
    for union_id in union_ids {
        let mut union = schema.union(union_id).clone();
        union
            .directives
            .retain(is_not_client_implementors_directive);
        schema.replace_union(union_id, union)?;
    }
    Ok(())
}

fn client_implementors_directive(schema: &SDLSchema, object_ids: &[ObjectID]) -> DirectiveValue {
    let mut names = Vec::with_capacity(object_ids.len());
    for object_id in object_ids {
        names.push(ConstantValue::String(StringNode {
            token: Token {
                span: Span::empty(),
                kind: TokenKind::StringLiteral,
            },
            value: schema.object(*object_id).name.item.0,
        }));
    }
    DirectiveValue {
        name: *CLIENT_IMPLEMENTORS_DIRECTIVE_NAME,
        arguments: vec![ArgumentValue {
            name: *TYPES_ARGUMENT_NAME,
            value: ConstantValue::List(List::generated(names)),
        }],
    }
}

#[derive(Default)]
struct ClientImplementorsByType {
    interfaces: HashMap<InterfaceID, Vec<ObjectID>>,
    unions: HashMap<UnionID, Vec<ObjectID>>,
}

fn collect_client_implementors(
    schema: &SDLSchema,
    enabled: &FeatureFlag,
) -> ClientImplementorsByType {
    let mut client_implementors = ClientImplementorsByType::default();
    for object in schema.get_objects() {
        if !object.is_extension {
            continue;
        }
        let object_id = schema
            .get_type(object.name.item.0)
            .and_then(Type::get_object_id)
            .expect("Expected an object to be registered under its name");
        // An object implements the super-interfaces of its interfaces too.
        let mut pending = object.interfaces.clone();
        let mut seen = Vec::new();
        while let Some(interface_id) = pending.pop() {
            if seen.contains(&interface_id) {
                continue;
            }
            seen.push(interface_id);
            let interface = schema.interface(interface_id);
            if !interface.is_extension && enabled.is_enabled_for(interface.name.item.0) {
                client_implementors
                    .interfaces
                    .entry(interface_id)
                    .or_default()
                    .push(object_id);
            }
            pending.extend(interface.interfaces.iter().copied());
        }
    }
    for union in schema.get_unions() {
        if union.is_extension || !enabled.is_enabled_for(union.name.item.0) {
            continue;
        }
        let mut client_members = vec![];
        for object_id in &union.members {
            if schema.object(*object_id).is_extension {
                client_members.push(*object_id);
            }
        }
        if client_members.is_empty() {
            continue;
        }
        let union_id = schema
            .get_type(union.name.item.0)
            .and_then(Type::get_union_id)
            .expect("Expected a union to be registered under its name");
        client_implementors.unions.insert(union_id, client_members);
    }
    for object_ids in client_implementors.interfaces.values_mut() {
        sort_by_name(schema, object_ids);
    }
    for object_ids in client_implementors.unions.values_mut() {
        sort_by_name(schema, object_ids);
    }
    client_implementors
}

/// Sorts by type name, so artifacts do not depend on schema order, and drops
/// duplicates.
fn sort_by_name(schema: &SDLSchema, object_ids: &mut Vec<ObjectID>) {
    let mut named = Vec::with_capacity(object_ids.len());
    for object_id in object_ids.iter() {
        named.push((schema.object(*object_id).name.item.0.lookup(), *object_id));
    }
    named.sort_unstable();
    named.dedup();
    object_ids.clear();
    for (_, object_id) in named {
        object_ids.push(object_id);
    }
}

#[cfg(test)]
mod tests {
    use common::SourceLocationKey;
    use intern::string_key::Intern;
    use schema::build_schema_with_extensions_parallel;

    use super::*;

    fn build(server: &str, extension: &str, enabled: &FeatureFlag) -> SDLSchema {
        let mut schema = build_schema_with_extensions_parallel::<_, &str>(
            &[(server, SourceLocationKey::generated())],
            &[(extension, SourceLocationKey::generated())],
        )
        .expect("Expected the test schema to build");
        mark_client_implementors(&mut schema, enabled).expect("Expected marking to succeed");
        schema
    }

    fn names(schema: &SDLSchema, object_ids: &[ObjectID]) -> Vec<String> {
        object_ids
            .iter()
            .map(|object_id| schema.object(*object_id).name.item.0.lookup().to_string())
            .collect()
    }

    fn type_named(schema: &SDLSchema, name: &str) -> Type {
        schema
            .get_type(name.intern())
            .expect("Expected the type to exist")
    }

    fn client_implementors_named(schema: &SDLSchema, name: &str) -> Vec<String> {
        names(
            schema,
            &client_implementors_of(schema, type_named(schema, name)),
        )
    }

    #[test]
    fn lists_only_the_client_implementors_of_a_server_interface() {
        let schema = build(
            "type Query { node: Node }
             interface Node { id: ID! }
             interface Named { name: String }
             type User implements Node & Named { id: ID! name: String }",
            "type ClientUser implements Named { name: String }
             type Other { name: String }",
            &FeatureFlag::Enabled,
        );
        assert_eq!(
            client_implementors_named(&schema, "Named"),
            vec!["ClientUser"],
            "The server implementor User is never listed"
        );
        assert!(
            !has_client_implementors(&schema, type_named(&schema, "Node")),
            "No client type implements Node, so Node gets no directive"
        );
        assert!(has_any_client_implementors(&schema));
    }

    #[test]
    fn follows_interfaces_that_implement_server_interfaces() {
        let schema = build(
            "type Query { named: Named }
             interface Named { name: String }",
            "interface ClientNamed implements Named { name: String }
             type B implements ClientNamed { name: String }
             type A implements ClientNamed & Named { name: String }",
            &FeatureFlag::Enabled,
        );
        assert_eq!(
            client_implementors_named(&schema, "Named"),
            vec!["A", "B"],
            "B through ClientNamed only, A once though it lists Named too, sorted by name"
        );
        assert!(
            !has_client_implementors(&schema, type_named(&schema, "ClientNamed")),
            "A client interface is a closed set the compiler lists in full elsewhere"
        );
    }

    #[test]
    fn lists_nothing_for_server_abstract_types_the_flag_does_not_name() {
        let server = "type Query { named: Named }
             interface Named { name: String }
             interface Other { name: String }";
        let extension = "type ClientUser implements Named & Other { name: String }";
        let schema = build(
            server,
            extension,
            &FeatureFlag::Limited {
                allowlist: ["Named".intern()].into_iter().collect(),
            },
        );
        assert_eq!(
            client_implementors_named(&schema, "Named"),
            vec!["ClientUser"]
        );
        assert!(!has_client_implementors(
            &schema,
            type_named(&schema, "Other")
        ));
        let schema = build(server, extension, &FeatureFlag::Disabled);
        assert!(
            !has_any_client_implementors(&schema),
            "The flag is off, so no type gets the directive"
        );
    }

    #[test]
    fn lists_a_type_under_the_named_super_interface_only() {
        let schema = build(
            "type Query { named: Named }
             interface Named { name: String }
             interface Titled implements Named { name: String }",
            "type ClientUser implements Titled & Named { name: String }",
            &FeatureFlag::Limited {
                allowlist: ["Named".intern()].into_iter().collect(),
            },
        );
        assert_eq!(
            client_implementors_named(&schema, "Named"),
            vec!["ClientUser"]
        );
        assert!(
            !has_client_implementors(&schema, type_named(&schema, "Titled")),
            "The flag does not name Titled"
        );
    }

    #[test]
    fn lists_client_members_of_a_server_union() {
        let schema = build(
            "type Query { result: Result }
             union Result = User
             type User { name: String }",
            "type ClientUser { name: String }
             extend union Result = ClientUser",
            &FeatureFlag::Enabled,
        );
        assert_eq!(
            client_implementors_named(&schema, "Result"),
            vec!["ClientUser"]
        );
    }

    #[test]
    fn replaces_a_directive_a_schema_file_wrote() {
        let server = "type Query { named: Named }
             interface Named { name: String }
             interface Other { name: String }";
        let extension = "type ClientUser implements Named { name: String }
             extend interface Named @__clientImplementors(types: [\"Wrong\"])
             extend interface Other @__clientImplementors(types: [\"ClientUser\"])";
        let mut schema = build(server, extension, &FeatureFlag::Enabled);
        assert_eq!(
            client_implementors_named(&schema, "Named"),
            vec!["ClientUser"],
            "The schema build's list replaces the written one"
        );
        assert!(
            !has_client_implementors(&schema, type_named(&schema, "Other")),
            "Only the schema build marks a type"
        );
        mark_client_implementors(&mut schema, &FeatureFlag::Enabled)
            .expect("Expected marking to succeed");
        let Type::Interface(named_id) = type_named(&schema, "Named") else {
            panic!("Expected Named to be an interface");
        };
        assert_eq!(
            schema
                .interface(named_id)
                .directives
                .iter()
                .filter(|directive| directive.name == *CLIENT_IMPLEMENTORS_DIRECTIVE_NAME)
                .count(),
            1,
            "Marking again keeps one directive"
        );
        let schema = build(server, extension, &FeatureFlag::Disabled);
        assert!(
            !has_any_client_implementors(&schema),
            "With the flag off, a written directive is dropped too"
        );
    }
}
