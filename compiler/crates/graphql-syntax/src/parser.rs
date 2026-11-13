/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

use std::collections::VecDeque;

use common::Diagnostic;
use common::DiagnosticsResult;
use common::Location;
use common::SourceLocationKey;
use common::Span;
use common::WithDiagnostics;
use intern::string_key::Intern;
use logos::Logos;

use crate::lexer::TokenKind;
use crate::node::*;
use crate::syntax_error::SyntaxError;

type ParseResult<T> = Result<T, ()>;

#[derive(Default, Clone, Copy, PartialEq)]
pub enum FragmentArgumentSyntaxKind {
    #[default]
    None,
    OnlyFragmentVariableDefinitions,
    SpreadArgumentsAndFragmentVariableDefinitions,
}

#[derive(Default, Clone, Copy)]
pub struct ParserFeatures {
    /// Whether and how to enable the experimental fragment variables definitions syntax
    pub fragment_argument_capability: FragmentArgumentSyntaxKind,

    /// Allows string literals as field aliases, as in: `query { "alias": field }`
    pub allow_string_literal_alias: bool,
}

impl ParserFeatures {
    fn supports_variable_definition_syntax(&self) -> bool {
        self.fragment_argument_capability != FragmentArgumentSyntaxKind::None
    }

    fn supports_spread_arguments_syntax(&self) -> bool {
        self.fragment_argument_capability
            == FragmentArgumentSyntaxKind::SpreadArgumentsAndFragmentVariableDefinitions
    }
}

pub struct Parser<'a> {
    current: Token,
    features: ParserFeatures,
    lexer: logos::Lexer<'a, TokenKind>,
    errors: Vec<Diagnostic>,
    source_location: SourceLocationKey,
    source: &'a str,
    /// the byte offset of the *end* of the previous token
    end_index: u32,
    offset: u32,
}

/// Parser for the *executable* subset of the GraphQL specification:
/// https://github.com/graphql/graphql-spec/blob/main/spec/Appendix%20B%20--%20Grammar%20Summary.md
impl<'a> Parser<'a> {
    pub fn new(
        source: &'a str,
        source_location: SourceLocationKey,
        features: ParserFeatures,
    ) -> Self {
        Self::with_offset(source, source_location, features, 0)
    }

    /// When parsing GraphQL syntax that is embedded within a parent
    /// SourceLocation, such as a field definition within a docblock, you may
    /// not be starting at the initial character of the SourceLocation.
    /// Specifying an `offset` allows the Spans attached to each node to reflect
    /// this fact.
    pub fn with_offset(
        source: &'a str,
        source_location: SourceLocationKey,
        features: ParserFeatures,
        offset: u32,
    ) -> Self {
        // To enable fast lookahead the parser needs to store at least the 'kind' (TokenKind)
        // of the next token: the simplest option is to store the full current token, but
        // the Parser requires an initial value. Rather than incur runtime/code overhead
        // of dealing with an Option or UnsafeCell, the constructor uses a dummy token
        // value to construct the Parser, then immediately advance()s to move to the
        // first real token.
        let lexer = TokenKind::lexer(source);
        let dummy = Token {
            kind: TokenKind::EndOfFile,
            span: Span::new(offset, offset),
        };
        let mut parser = Parser {
            current: dummy,
            errors: Vec::new(),
            features,
            lexer,
            source_location,
            source,
            end_index: offset,
            offset,
        };
        // Advance to the first real token before doing any work
        parser.parse_token();
        parser
    }

    pub fn parse_document(mut self) -> DiagnosticsResult<Document> {
        let document = self.parse_document_impl();
        if self.errors.is_empty() {
            self.parse_eof()?;
            Ok(document.unwrap())
        } else {
            Err(self.errors)
        }
    }

    /// Parses a string containing a single directive.
    pub fn parse_directive(mut self) -> DiagnosticsResult<Directive> {
        let document = self.parse_directive_impl();
        if self.errors.is_empty() {
            self.parse_eof()?;
            Ok(document.unwrap())
        } else {
            Err(self.errors)
        }
    }

    /// Parses a string containing a field name with optional arguments
    pub fn parse_field_definition_stub(mut self) -> DiagnosticsResult<FieldDefinitionStub> {
        let stub = self.parse_field_definition_stub_impl();
        if self.errors.is_empty() {
            Ok(stub.unwrap())
        } else {
            Err(self.errors)
        }
    }

    /// Parses a string containing a field definition
    pub fn parse_field_definition(mut self) -> DiagnosticsResult<FieldDefinition> {
        let stub = self.parse_field_definition_impl();
        if self.errors.is_empty() {
            self.parse_eof()?;
            Ok(stub.unwrap())
        } else {
            Err(self.errors)
        }
    }

    /// Parses a document consisting only of executable nodes: operations and
    /// fragments.
    pub fn parse_executable_document(mut self) -> WithDiagnostics<ExecutableDocument> {
        let document = self.parse_executable_document_impl();
        if self.errors.is_empty() {
            let _ = self.parse_kind(TokenKind::EndOfFile);
        }
        let document = document.unwrap_or_else(|_| ExecutableDocument {
            span: Span::new(self.index(), self.index()),
            definitions: Default::default(),
        });
        WithDiagnostics {
            item: document,
            diagnostics: self.errors,
        }
    }

    pub fn parse_schema_document(mut self) -> DiagnosticsResult<SchemaDocument> {
        let document = self.parse_schema_document_impl();
        if self.errors.is_empty() {
            self.parse_eof()?;
            Ok(document.unwrap())
        } else {
            Err(self.errors)
        }
    }

    pub fn parse_schema_document_into_type_system_definitions(
        mut self,
    ) -> DiagnosticsResult<Vec<&'a str>> {
        let start = self.index();
        let definition_tokens = self
            .parse_list(
                |s| s.peek_type_system_definition(),
                |s| s.advance_type_system_definition(),
            )
            .unwrap_or_else(|_| Vec::new());
        if self.errors.is_empty() {
            let definition_strs =
                // Create range for first definition
                std::iter::once((start, definition_tokens.first().map_or(0, |t| t.span.start)))
                    // Chain rest of definitions
                    .chain(definition_tokens.windows(2).map(|definition_pairs| {
                        let from = definition_pairs[0].span.start;
                        let to = definition_pairs[1].span.start;
                        (from, to)
                    }))
                    .map(|(from, to)| self.source[from as usize..to as usize].into())
                    .collect::<Vec<_>>();
            self.parse_eof()?;
            Ok(definition_strs)
        } else {
            Err(self.errors)
        }
    }

    /// Parses a type annotation such as `ID` or `[User!]!`.
    pub fn parse_type(mut self) -> DiagnosticsResult<TypeAnnotation> {
        let type_annotation = self.parse_type_annotation();
        if self.errors.is_empty() {
            self.parse_eof()?;
            Ok(type_annotation.unwrap())
        } else {
            Err(self.errors)
        }
    }

    pub fn parse_identifier_result(mut self) -> DiagnosticsResult<Identifier> {
        let identifier = self.parse_identifier();
        if self.errors.is_empty() {
            Ok(identifier.unwrap())
        } else {
            Err(self.errors)
        }
    }

    pub fn parse_identifier_and_implements_interfaces_result(
        mut self,
    ) -> DiagnosticsResult<(Identifier, Vec<Identifier>)> {
        let identifier = self.parse_identifier();
        let impls = self.parse_implements_interfaces();
        if self.errors.is_empty() {
            self.parse_eof()?;
            Ok((identifier.unwrap(), impls.unwrap()))
        } else {
            Err(self.errors)
        }
    }

    pub fn parse_type_system_definition(mut self) -> DiagnosticsResult<TypeSystemDefinition> {
        let type_system_definition = self.parse_type_system_definition_impl();
        if self.errors.is_empty() {
            Ok(type_system_definition.unwrap())
        } else {
            Err(self.errors)
        }
    }

    fn parse_eof(mut self) -> DiagnosticsResult<()> {
        self.parse_kind(TokenKind::EndOfFile)
            .map(|_| ())
            .map_err(|_| self.errors)
    }

    // Document / Definitions

    /// Document : Definition+
    fn parse_document_impl(&mut self) -> ParseResult<Document> {
        let start = self.index();
        let definitions = self.parse_list(|s| s.peek_definition(), |s| s.parse_definition())?;
        let end = self.index();
        let span = Span::new(start, end);
        Ok(Document {
            location: Location::new(self.source_location, span),
            definitions,
        })
    }

    fn parse_executable_document_impl(&mut self) -> ParseResult<ExecutableDocument> {
        let start = self.index();
        let definitions = self.parse_list(
            |s| s.peek_executable_definition(),
            |s| s.parse_executable_definition(),
        )?;
        let end = self.index();
        let span = Span::new(start, end);
        Ok(ExecutableDocument { span, definitions })
    }

    fn parse_schema_document_impl(&mut self) -> ParseResult<SchemaDocument> {
        let start = self.index();
        let definitions = self.parse_list(
            |s| s.peek_type_system_definition(),
            |s| s.parse_type_system_definition_impl(),
        )?;
        let end = self.index();
        let span = Span::new(start, end);
        Ok(SchemaDocument {
            location: Location::new(self.source_location, span),
            definitions,
        })
    }

    /// Definition :
    /// [x] ExecutableDefinition
    /// [x]  TypeSystemDefinition
    /// [x]  TypeSystemExtension
    fn peek_definition(&self) -> bool {
        self.peek_executable_definition() || self.peek_type_system_definition()
    }
    fn parse_definition(&mut self) -> ParseResult<Definition> {
        let token = self.peek();
        let source = self.source(token);
        match (token.kind, source) {
            (TokenKind::OpenBrace, _)
            | (TokenKind::Identifier, "query")
            | (TokenKind::Identifier, "mutation")
            | (TokenKind::Identifier, "subscription")
            | (TokenKind::Identifier, "fragment") => Ok(Definition::ExecutableDefinition(
                self.parse_executable_definition()?,
            )),
            (TokenKind::StringLiteral, _)
            | (TokenKind::BlockStringLiteral, _)
            | (TokenKind::Identifier, "schema")
            | (TokenKind::Identifier, "scalar")
            | (TokenKind::Identifier, "type")
            | (TokenKind::Identifier, "interface")
            | (TokenKind::Identifier, "union")
            | (TokenKind::Identifier, "enum")
            | (TokenKind::Identifier, "input")
            | (TokenKind::Identifier, "directive")
            | (TokenKind::Identifier, "extend") => Ok(Definition::TypeSystemDefinition(
                self.parse_type_system_definition_impl()?,
            )),
            _ => {
                let error = Diagnostic::error(
                    SyntaxError::ExpectedDefinition,
                    Location::new(self.source_location, token.span),
                );
                self.record_error(error);
                Err(())
            }
        }
    }

    /// Definition :
    /// [x] ExecutableDefinition
    /// []  TypeSystemDefinition
    /// []  TypeSystemExtension
    fn peek_executable_definition(&self) -> bool {
        let token = self.peek();
        match token.kind {
            TokenKind::OpenBrace => true, // unnamed query
            TokenKind::Identifier => matches!(
                self.source(token),
                "query" | "mutation" | "fragment" | "subscription"
            ),
            _ => false,
        }
    }

    /// Definition :
    /// [x] ExecutableDefinition
    /// []  TypeSystemDefinition
    /// []  TypeSystemExtension
    fn parse_executable_definition(&mut self) -> ParseResult<ExecutableDefinition> {
        let token = self.peek();
        let source = self.source(token);
        match (token.kind, source) {
            (TokenKind::OpenBrace, _) => Ok(ExecutableDefinition::Operation(
                self.parse_operation_definition()?,
            )),
            (TokenKind::Identifier, "query")
            | (TokenKind::Identifier, "mutation")
            | (TokenKind::Identifier, "subscription") => Ok(ExecutableDefinition::Operation(
                self.parse_operation_definition()?,
            )),
            (TokenKind::Identifier, "fragment") => Ok(ExecutableDefinition::Fragment(
                self.parse_fragment_definition()?,
            )),
            _ => {
                let error = Diagnostic::error(
                    SyntaxError::ExpectedExecutableDefinition,
                    Location::new(self.source_location, token.span),
                );
                self.record_error(error);
                Err(())
            }
        }
    }

    /// Definition :
    /// [] ExecutableDefinition
    /// [x]  TypeSystemDefinition
    /// [x]  TypeSystemExtension
    fn peek_type_system_definition(&self) -> bool {
        let token = self.peek();
        match token.kind {
            TokenKind::StringLiteral | TokenKind::BlockStringLiteral => true, // description
            TokenKind::Identifier => matches!(
                self.source(token),
                "schema"
                    | "scalar"
                    | "type"
                    | "interface"
                    | "union"
                    | "enum"
                    | "input"
                    | "directive"
                    | "extend"
            ),
            _ => false,
        }
    }

    /// Definition :
    /// [] ExecutableDefinition
    /// [x]  TypeSystemDefinition
    /// [x]  TypeSystemExtension
    fn parse_type_system_definition_impl(&mut self) -> ParseResult<TypeSystemDefinition> {
        let description = self.parse_optional_description();
        let hack_source = self.parse_optional_hack_source();
        let token = self.peek();
        if token.kind != TokenKind::Identifier {
            // TODO
            // self.record_error(error)
            return Err(());
        }
        match self.source(token) {
            "schema" => Ok(TypeSystemDefinition::SchemaDefinition(
                self.parse_schema_definition(description)?,
            )),
            "scalar" => Ok(TypeSystemDefinition::ScalarTypeDefinition(
                self.parse_scalar_type_definition(description)?,
            )),
            "type" => Ok(TypeSystemDefinition::ObjectTypeDefinition(
                self.parse_object_type_definition(description)?,
            )),
            "interface" => Ok(TypeSystemDefinition::InterfaceTypeDefinition(
                self.parse_interface_type_definition(description)?,
            )),
            "union" => Ok(TypeSystemDefinition::UnionTypeDefinition(
                self.parse_union_type_definition(description)?,
            )),
            "enum" => Ok(TypeSystemDefinition::EnumTypeDefinition(
                self.parse_enum_type_definition(description)?,
            )),
            "input" => Ok(TypeSystemDefinition::InputObjectTypeDefinition(
                self.parse_input_object_type_definition(description)?,
            )),
            "directive" => Ok(TypeSystemDefinition::DirectiveDefinition(
                self.parse_directive_definition(description, hack_source)?,
            )),
            "extend" => self.parse_type_system_extension(),
            token_str => {
                let error = Diagnostic::error(
                    format!("Unexpected token: `{token_str}`"),
                    Location::new(self.source_location, token.span),
                );
                self.record_error(error);
                Err(())
            }
        }
    }

    /// Definition :
    /// [] ExecutableDefinition
    /// [x]  TypeSystemDefinition
    /// []  TypeSystemExtension
    fn advance_type_system_definition(&mut self) -> ParseResult<Token> {
        self.advance_optional_description(); // description
        self.advance_optional_hack_source(); // hack_source
        let token = self.peek();
        if token.kind != TokenKind::Identifier {
            return Err(());
        }
        match self.source(token) {
            "schema" => self.advance_schema_definition(),
            "scalar" => self.advance_scalar_type_definition(),
            "type" => self.advance_object_type_definition(),
            "interface" => self.advance_interface_type_definition(),
            "union" => self.advance_union_type_definition(),
            "enum" => self.advance_enum_type_definition(),
            "input" => self.advance_input_object_type_definition(),
            "directive" => self.advance_directive_definition(),
            "extend" => self.advance_type_system_extension(),
            token_str => {
                let error = Diagnostic::error(
                    format!("Unexpected token: `{token_str}`"),
                    Location::new(self.source_location, token.span),
                );
                self.record_error(error);
                Err(())
            }
        }
    }

    /**
     * TypeSystemExtension :
     *   - SchemaExtension
     *   - TypeExtension
     *
     * TypeExtension :
     *   - ScalarTypeExtension
     *   - ObjectTypeExtension
     *   - InterfaceTypeExtension
     *   - UnionTypeExtension
     *   - EnumTypeExtension
     *   - InputObjectTypeDefinition
     */
    fn parse_type_system_extension(&mut self) -> ParseResult<TypeSystemDefinition> {
        self.parse_keyword("extend")?;
        let token = self.parse_kind(TokenKind::Identifier)?;
        match self.source(&token) {
            "schema" => Ok(TypeSystemDefinition::SchemaExtension(
                self.parse_schema_extension(token.span)?,
            )),
            "scalar" => Ok(TypeSystemDefinition::ScalarTypeExtension(
                self.parse_scalar_type_extension()?,
            )),
            "type" => Ok(TypeSystemDefinition::ObjectTypeExtension(
                self.parse_object_type_extension()?,
            )),
            "interface" => Ok(TypeSystemDefinition::InterfaceTypeExtension(
                self.parse_interface_type_extension()?,
            )),
            "union" => Ok(TypeSystemDefinition::UnionTypeExtension(
                self.parse_union_type_extension()?,
            )),
            "enum" => Ok(TypeSystemDefinition::EnumTypeExtension(
                self.parse_enum_type_extension()?,
            )),
            "input" => Ok(TypeSystemDefinition::InputObjectTypeExtension(
                self.parse_input_object_type_extension()?,
            )),
            "directive" => Ok(TypeSystemDefinition::DirectiveDefinitionExtension(
                self.parse_directive_definition_extension()?,
            )),
            token_str => {
                let error = Diagnostic::error(
                    format!("Unexpected token `{token_str}`"),
                    Location::new(self.source_location, token.span),
                );
                self.record_error(error);
                Err(())
            }
        }
    }

    /**
     * TypeSystemExtension :
     *   - SchemaExtension
     *   - TypeExtension
     *
     * TypeExtension :
     *   - ScalarTypeExtension
     *   - ObjectTypeExtension
     *   - InterfaceTypeExtension
     *   - UnionTypeExtension
     *   - EnumTypeExtension
     *   - InputObjectTypeDefinition
     */
    fn advance_type_system_extension(&mut self) -> ParseResult<Token> {
        self.advance_keyword("extend")?;
        let token = self.advance_kind(TokenKind::Identifier)?;
        match self.source(&token) {
            "schema" => self.advance_schema_extension(),
            "scalar" => self.advance_scalar_type_extension(),
            "type" => self.advance_object_type_extension(),
            "interface" => self.advance_interface_type_extension(),
            "union" => self.advance_union_type_extension(),
            "enum" => self.advance_enum_type_extension(),
            "input" => self.advance_input_object_type_extension(),
            "directive" => self.advance_directive_definition_extension(),
            token_str => {
                let error = Diagnostic::error(
                    format!("Unexpected token `{token_str}`"),
                    Location::new(self.source_location, token.span),
                );
                self.record_error(error);
                Err(())
            }
        }
    }

    /**
     * SchemaDefinition : Description? schema Directives? { OperationTypeDefinition+ }
     */
    fn parse_schema_definition(
        &mut self,
        description: Option<StringNode>,
    ) -> ParseResult<SchemaDefinition> {
        let start = self.index();
        self.parse_keyword("schema")?;
        let directives = self.parse_constant_directives()?;
        let operation_types = self.parse_delimited_nonempty_list(
            TokenKind::OpenBrace,
            TokenKind::CloseBrace,
            Self::parse_operation_type_definition,
        )?;
        let end = self.index();
        let span = Span::new(start, end);
        Ok(SchemaDefinition {
            directives,
            operation_types,
            description,
            span,
        })
    }

    /**
     * SchemaDefinition : schema Directives? { OperationTypeDefinition+ }
     */
    fn advance_schema_definition(&mut self) -> ParseResult<Token> {
        self.advance_keyword("schema")?;
        self.advance_constant_directives()?; // directives
        self.advance_delimited_nonempty_list(
            // operation_types
            TokenKind::OpenBrace,
            TokenKind::CloseBrace,
            Self::advance_operation_type_definition,
        )?;
        Ok(self.current)
    }

    /**
     * SchemaExtension :
     *  - extend schema Directives? { OperationTypeDefinition+ }
     *  - extend schema Directives
     */
    fn parse_schema_extension(
        &mut self,
        schema_keyword_span: Span,
    ) -> ParseResult<SchemaExtension> {
        // `extend schema` was already parsed
        let start = self.index();
        let directives = self.parse_constant_directives()?;
        let operation_types = self.parse_optional_delimited_nonempty_list(
            TokenKind::OpenBrace,
            TokenKind::CloseBrace,
            Self::parse_operation_type_definition,
        )?;
        if directives.is_empty() && operation_types.is_none() {
            self.record_error(Diagnostic::error(
                "Schema extension should define directives or operation types.",
                Location::new(self.source_location, schema_keyword_span),
            ));
            return Err(());
        }
        let end = self.index();
        let span = Span::new(start, end);
        Ok(SchemaExtension {
            directives,
            operation_types,
            span,
        })
    }

    /**
     * SchemaExtension :
     *  - extend schema Directives? { OperationTypeDefinition+ }
     *  - extend schema Directives
     */
    fn advance_schema_extension(&mut self) -> ParseResult<Token> {
        // `extend schema` was already parsed
        self.advance_constant_directives()?; // directives
        self.advance_optional_delimited_nonempty_list(
            // operation_types
            TokenKind::OpenBrace,
            TokenKind::CloseBrace,
            Self::advance_operation_type_definition,
        )?;
        Ok(self.current)
    }

    /**
     * OperationTypeDefinition : OperationType : NamedType
     */
    fn parse_operation_type_definition(&mut self) -> ParseResult<OperationTypeDefinition> {
        let start = self.index();
        let operation = self.parse_operation_type()?;
        self.parse_kind(TokenKind::Colon)?;
        let type_ = self.parse_identifier()?;
        let end = self.index();
        let span = Span::new(start, end);
        Ok(OperationTypeDefinition {
            operation,
            type_,
            span,
        })
    }

    /**
     * OperationTypeDefinition : OperationType : NamedType
     */
    fn advance_operation_type_definition(&mut self) -> ParseResult<Token> {
        self.advance_operation_type()?; // operation
        self.advance_kind(TokenKind::Colon)?;
        self.advance_identifier()?; // type_
        Ok(self.current)
    }

    /**
     * OperationType : one of query mutation subscription
     */
    fn parse_operation_type(&mut self) -> ParseResult<OperationType> {
        let token = self.parse_kind(TokenKind::Identifier)?;
        match self.source(&token) {
            "query" => Ok(OperationType::Query),
            "mutation" => Ok(OperationType::Mutation),
            "subscription" => Ok(OperationType::Subscription),
            token_str => {
                let error = Diagnostic::error(
                    format!(
                        "Expected one of `query`, `mutation`, `subscription`, got `{token_str}`",
                    ),
                    Location::new(self.source_location, token.span),
                );
                self.record_error(error);
                Err(())
            }
        }
    }

    /**
     * OperationType : one of query mutation subscription
     */
    fn advance_operation_type(&mut self) -> ParseResult<Token> {
        let token = self.advance_kind(TokenKind::Identifier)?;
        match self.source(&token) {
            "query" => Ok(token),
            "mutation" => Ok(token),
            "subscription" => Ok(token),
            token_str => {
                let error = Diagnostic::error(
                    format!(
                        "Expected one of `query`, `mutation`, `subscription`, got `{token_str}`",
                    ),
                    Location::new(self.source_location, token.span),
                );
                self.record_error(error);
                Err(())
            }
        }
    }

    /**
     * ObjectTypeDefinition :
     *   - Description? type Name ImplementsInterfaces? Directives? FieldsDefinition?
     */
    fn parse_object_type_definition(
        &mut self,
        description: Option<StringNode>,
    ) -> ParseResult<ObjectTypeDefinition> {
        let start = self.index();
        self.parse_keyword("type")?;
        let name = self.parse_identifier()?;
        let interfaces = self.parse_implements_interfaces()?;
        let directives = self.parse_constant_directives()?;
        let fields = self.parse_fields_definition()?;
        let end = self.index();
        let span = Span::new(start, end);
        Ok(ObjectTypeDefinition {
            name,
            interfaces,
            directives,
            fields,
            description,
            span,
        })
    }

    fn advance_object_type_definition(&mut self) -> ParseResult<Token> {
        self.advance_keyword("type")?;
        self.advance_identifier()?; // name
        self.advance_implements_interfaces()?; // interfaces
        self.advance_constant_directives()?; // directives
        self.advance_fields_definition()?; // fields
        Ok(self.current)
    }

    /**
     * InterfaceTypeDefinition :
     *   - Description? interface Name ImplementsInterfaces? Directives? FieldsDefinition?
     */
    fn parse_interface_type_definition(
        &mut self,
        description: Option<StringNode>,
    ) -> ParseResult<InterfaceTypeDefinition> {
        let start = self.index();
        self.parse_keyword("interface")?;
        let name = self.parse_identifier()?;
        let interfaces = self.parse_implements_interfaces()?;
        let directives = self.parse_constant_directives()?;
        let fields = self.parse_fields_definition()?;
        let end = self.index();
        let span = Span::new(start, end);
        Ok(InterfaceTypeDefinition {
            name,
            interfaces,
            directives,
            fields,
            description,
            span,
        })
    }

    fn advance_interface_type_definition(&mut self) -> ParseResult<Token> {
        self.advance_keyword("interface")?;
        self.advance_identifier()?; // name
        self.advance_implements_interfaces()?; // interfaces
        self.advance_constant_directives()?; // directives
        self.advance_fields_definition()?; // fields
        Ok(self.current)
    }

    /**
     * UnionTypeDefinition :
     *   - Description? union Name Directives? UnionMemberTypes?
     */
    fn parse_union_type_definition(
        &mut self,
        description: Option<StringNode>,
    ) -> ParseResult<UnionTypeDefinition> {
        let start = self.index();
        self.parse_keyword("union")?;
        let name = self.parse_identifier()?;
        let directives = self.parse_constant_directives()?;
        let members = self.parse_union_member_types()?;
        let end = self.index();
        let span = Span::new(start, end);
        Ok(UnionTypeDefinition {
            name,
            directives,
            members,
            description,
            span,
        })
    }

    /**
     * UnionTypeDefinition :
     *   - Description? union Name Directives? UnionMemberTypes?
     */
    fn advance_union_type_definition(&mut self) -> ParseResult<Token> {
        self.advance_keyword("union")?;
        self.advance_identifier()?;
        self.advance_constant_directives()?;
        self.advance_union_member_types()?;
        Ok(self.current)
    }

    /**
     * UnionTypeExtension :
     *   - extend union Name Directives? UnionMemberTypes
     *   - extend union Name Directives
     */
    fn parse_union_type_extension(&mut self) -> ParseResult<UnionTypeExtension> {
        // `extend union` was parsed before
        let start = self.index();
        let name = self.parse_identifier()?;
        let directives = self.parse_constant_directives()?;
        let members = self.parse_union_member_types()?;
        if directives.is_empty() && members.is_empty() {
            self.record_error(Diagnostic::error(
                "Union extension should define one of directives or member types.",
                Location::new(self.source_location, name.span),
            ));
            return Err(());
        }
        let end = self.index();
        let span = Span::new(start, end);
        Ok(UnionTypeExtension {
            name,
            directives,
            members,
            span,
        })
    }

    /**
     * UnionTypeExtension :
     *   - extend union Name Directives? UnionMemberTypes
     *   - extend union Name Directives
     */
    fn advance_union_type_extension(&mut self) -> ParseResult<Token> {
        // `extend union` was parsed before
        self.advance_identifier()?; // name
        self.advance_constant_directives()?; // directives
        self.advance_union_member_types()?; // members
        Ok(self.current)
    }

    /**
     * UnionMemberTypes :
     *   - = `|`? NamedType
     *   - UnionMemberTypes | NamedType
     */
    fn parse_union_member_types(&mut self) -> ParseResult<Vec<Identifier>> {
        let mut members = vec![];
        if self.parse_optional_kind(TokenKind::Equals).is_some() {
            self.parse_optional_kind(TokenKind::Pipe);
            members.push(self.parse_identifier()?);
            while self.parse_optional_kind(TokenKind::Pipe).is_some() {
                members.push(self.parse_identifier()?);
            }
        }
        Ok(members)
    }

    /**
     * UnionMemberTypes :
     *   - = `|`? NamedType
     *   - UnionMemberTypes | NamedType
     */
    fn advance_union_member_types(&mut self) -> ParseResult<Token> {
        if self.advance_optional_kind(TokenKind::Equals).is_some() {
            self.advance_optional_kind(TokenKind::Pipe);
            self.advance_identifier()?;
            while self.advance_optional_kind(TokenKind::Pipe).is_some() {
                self.advance_identifier()?;
            }
        }
        Ok(self.current)
    }

    /**
     * EnumTypeDefinition :
     *   - Description? enum Name Directives? EnumValuesDefinition?
     */
    fn parse_enum_type_definition(
        &mut self,
        description: Option<StringNode>,
    ) -> ParseResult<EnumTypeDefinition> {
        let start = self.index();
        self.parse_keyword("enum")?;
        let name = self.parse_identifier()?;
        let directives = self.parse_constant_directives()?;
        let values = self.parse_enum_values_definition()?;
        let end = self.index();
        let span = Span::new(start, end);
        Ok(EnumTypeDefinition {
            name,
            directives,
            values,
            description,
            span,
        })
    }

    /**
     * EnumTypeDefinition :
     *   - Description? enum Name Directives? EnumValuesDefinition?
     */
    fn advance_enum_type_definition(&mut self) -> ParseResult<Token> {
        self.advance_keyword("enum")?;
        self.advance_identifier()?; // name
        self.advance_constant_directives()?; // directives
        self.advance_enum_values_definition()?; // values
        Ok(self.current)
    }

    /**
     * EnumTypeExtension :
     *   - extend enum Name Directives? EnumValuesDefinition
     *   - extend enum Name Directives
     */
    fn parse_enum_type_extension(&mut self) -> ParseResult<EnumTypeExtension> {
        // `extend enum` was already parsed
        let start = self.index();
        let name = self.parse_identifier()?;
        let directives = self.parse_constant_directives()?;
        let values = self.parse_enum_values_definition()?;
        if directives.is_empty() && values.is_none() {
            self.record_error(Diagnostic::error(
                "Enum extension should define one of directives or values.",
                Location::new(self.source_location, name.span),
            ));
            return Err(());
        }
        let end = self.index();
        let span = Span::new(start, end);
        Ok(EnumTypeExtension {
            name,
            directives,
            values,
            span,
        })
    }

    /**
     * EnumTypeExtension :
     *   - extend enum Name Directives? EnumValuesDefinition
     *   - extend enum Name Directives
     */
    fn advance_enum_type_extension(&mut self) -> ParseResult<Token> {
        // `extend enum` was already parsed
        self.advance_identifier()?; // name
        self.advance_constant_directives()?; // directives
        self.advance_enum_values_definition()?; // values
        Ok(self.current)
    }

    /**
     * EnumValuesDefinition : { EnumValueDefinition+ }
     */
    fn parse_enum_values_definition(&mut self) -> ParseResult<Option<List<EnumValueDefinition>>> {
        self.parse_optional_delimited_nonempty_list(
            TokenKind::OpenBrace,
            TokenKind::CloseBrace,
            Self::parse_enum_value_definition,
        )
    }

    /**
     * EnumValuesDefinition : { EnumValueDefinition+ }
     */
    fn advance_enum_values_definition(&mut self) -> ParseResult<Token> {
        self.advance_optional_delimited_nonempty_list(
            TokenKind::OpenBrace,
            TokenKind::CloseBrace,
            Self::advance_enum_value_definition,
        )
    }

    /**
     * EnumValueDefinition : Description? EnumValue Directives?
     *
     * EnumValue : Name
     */
    fn parse_enum_value_definition(&mut self) -> ParseResult<EnumValueDefinition> {
        let start = self.index();
        let description = self.parse_optional_description();
        let name = self.parse_identifier()?;
        let directives = self.parse_constant_directives()?;
        let end = self.index();
        let span = Span::new(start, end);
        Ok(EnumValueDefinition {
            name,
            directives,
            description,
            span,
        })
    }

    /**
     * EnumValueDefinition : Description? EnumValue Directives?
     *
     * EnumValue : Name
     */
    fn advance_enum_value_definition(&mut self) -> ParseResult<Token> {
        self.advance_optional_description();
        self.advance_identifier()?;
        self.advance_constant_directives()?;
        Ok(self.current)
    }

    /**
     * ObjectTypeExtension :
     *  - extend type Name ImplementsInterfaces? DirectivesConst? FieldsDefinition
     *  - extend type Name ImplementsInterfaces? DirectivesConst
     *  - extend type Name ImplementsInterfaces
     */
    fn parse_object_type_extension(&mut self) -> ParseResult<ObjectTypeExtension> {
        // `extend type` was parsed before
        let start = self.index();
        let name = self.parse_identifier()?;
        let interfaces = self.parse_implements_interfaces()?;
        let directives = self.parse_constant_directives()?;
        let fields = self.parse_fields_definition()?;
        if interfaces.is_empty() && directives.is_empty() && fields.is_none() {
            self.record_error(Diagnostic::error(
                "Type extension should define one of interfaces, directives or fields.",
                Location::new(self.source_location, name.span),
            ));
            return Err(());
        }
        let end = self.index();
        let span = Span::new(start, end);
        Ok(ObjectTypeExtension {
            name,
            interfaces,
            directives,
            fields,
            span,
        })
    }

    /**
     * ObjectTypeExtension :
     *  - extend type Name ImplementsInterfaces? DirectivesConst? FieldsDefinition
     *  - extend type Name ImplementsInterfaces? DirectivesConst
     *  - extend type Name ImplementsInterfaces
     */
    fn advance_object_type_extension(&mut self) -> ParseResult<Token> {
        // `extend type` was parsed before
        self.advance_identifier()?; // name
        self.advance_implements_interfaces()?; // interfaces
        self.advance_constant_directives()?; // directives
        self.advance_fields_definition()?; // fields
        Ok(self.current)
    }

    /**
     * InterfaceTypeExtension :
     *   - extend interface Name ImplementsInterfaces? DirectivesConst? FieldsDefinition
     *   - extend interface Name ImplementsInterfaces? DirectivesConst
     *   - extend interface Name ImplementsInterfaces
     */
    fn parse_interface_type_extension(&mut self) -> ParseResult<InterfaceTypeExtension> {
        // `extend interface` was parsed before
        let start = self.index();
        let name = self.parse_identifier()?;
        let interfaces = self.parse_implements_interfaces()?;
        let directives = self.parse_constant_directives()?;
        let fields = self.parse_fields_definition()?;
        if interfaces.is_empty() && directives.is_empty() && fields.is_none() {
            self.record_error(Diagnostic::error(
                "Interface extension should define one of interfaces, directives or fields.",
                Location::new(self.source_location, name.span),
            ));
            return Err(());
        }
        let end = self.index();
        let span = Span::new(start, end);
        Ok(InterfaceTypeExtension {
            name,
            interfaces,
            directives,
            fields,
            span,
        })
    }

    /**
     * InterfaceTypeExtension :
     *   - extend interface Name ImplementsInterfaces? DirectivesConst? FieldsDefinition
     *   - extend interface Name ImplementsInterfaces? DirectivesConst
     *   - extend interface Name ImplementsInterfaces
     */
    fn advance_interface_type_extension(&mut self) -> ParseResult<Token> {
        // `extend interface` was parsed before
        self.advance_identifier()?; // name
        self.advance_implements_interfaces()?; // interfaces
        self.advance_constant_directives()?; // directives
        self.advance_fields_definition()?; // fields
        Ok(self.current)
    }

    /**
     * ScalarTypeDefinition :
     *   - Description? scalar Name Directives?
     */
    fn parse_scalar_type_definition(
        &mut self,
        description: Option<StringNode>,
    ) -> ParseResult<ScalarTypeDefinition> {
        let start = self.index();
        self.parse_keyword("scalar")?;
        let name = self.parse_identifier()?;
        let directives = self.parse_constant_directives()?;
        let end = self.index();
        let span = Span::new(start, end);
        Ok(ScalarTypeDefinition {
            name,
            directives,
            description,
            span,
        })
    }

    /**
     * ScalarTypeDefinition : Description? scalar Name Directives?
     */
    fn advance_scalar_type_definition(&mut self) -> ParseResult<Token> {
        self.advance_keyword("scalar")?;
        self.advance_identifier()?; // name
        self.advance_constant_directives()?; // directives
        Ok(self.current)
    }

    /**
     * ScalarTypeExtension :
     *   - extend scalar Name Directives
     */
    fn parse_scalar_type_extension(&mut self) -> ParseResult<ScalarTypeExtension> {
        // `extend scalar` was parsed before
        let start = self.index();
        let name = self.parse_identifier()?;
        let directives = self.parse_constant_directives()?;
        if directives.is_empty() {
            self.record_error(Diagnostic::error(
                "Scalar extension should define one or more directives.",
                Location::new(self.source_location, name.span),
            ));
            return Err(());
        }
        let end = self.index();
        let span = Span::new(start, end);
        Ok(ScalarTypeExtension {
            name,
            directives,
            span,
        })
    }

    /**
     * ScalarTypeExtension :
     *   - extend scalar Name Directives
     */
    fn advance_scalar_type_extension(&mut self) -> ParseResult<Token> {
        // `extend scalar` was parsed before
        self.advance_identifier()?; // name
        self.advance_constant_directives()?; // directives
        Ok(self.current)
    }

    /**
     * InputObjectTypeDefinition :
     *   - Description? input Name Directives? InputFieldsDefinition?
     */
    fn parse_input_object_type_definition(
        &mut self,
        description: Option<StringNode>,
    ) -> ParseResult<InputObjectTypeDefinition> {
        let start = self.index();
        self.parse_keyword("input")?;
        let name = self.parse_identifier()?;
        let directives = self.parse_constant_directives()?;
        let fields = self.parse_input_fields_definition()?;
        let end = self.index();
        let span = Span::new(start, end);
        Ok(InputObjectTypeDefinition {
            name,
            directives,
            fields,
            description,
            span,
        })
    }

    /**
     * InputObjectTypeDefinition :
     *   - Description? input Name Directives? InputFieldsDefinition?
     */
    fn advance_input_object_type_definition(&mut self) -> ParseResult<Token> {
        self.advance_keyword("input")?;
        self.advance_identifier()?; // name
        self.advance_constant_directives()?; // directives
        self.advance_input_fields_definition()?; // fields
        Ok(self.current)
    }

    /**
     * InputObjectTypeExtension :
     *   - extend input Name Directives? InputFieldsDefinition
     *   - extend input Name Directives
     */
    fn parse_input_object_type_extension(&mut self) -> ParseResult<InputObjectTypeExtension> {
        // `extend input` was parsed already here
        let start = self.index();
        let name = self.parse_identifier()?;
        let directives = self.parse_constant_directives()?;
        let fields = self.parse_input_fields_definition()?;
        if directives.is_empty() && fields.is_none() {
            self.record_error(Diagnostic::error(
                "Input object extension should define one of directives or fields.",
                Location::new(self.source_location, name.span),
            ));
            return Err(());
        }
        let end = self.index();
        let span = Span::new(start, end);
        Ok(InputObjectTypeExtension {
            name,
            directives,
            fields,
            span,
        })
    }

    /**
     * InputObjectTypeExtension :
     *   - extend input Name Directives? InputFieldsDefinition
     *   - extend input Name Directives
     */
    fn advance_input_object_type_extension(&mut self) -> ParseResult<Token> {
        // `extend input` was parsed already here
        self.advance_identifier()?; // name
        self.advance_constant_directives()?; // directives
        self.advance_input_fields_definition()?; // fields
        Ok(self.current)
    }

    /**
     * InputFieldsDefinition : { InputValueDefinition+ }
     */
    fn parse_input_fields_definition(&mut self) -> ParseResult<Option<List<InputValueDefinition>>> {
        self.parse_optional_delimited_nonempty_list(
            TokenKind::OpenBrace,
            TokenKind::CloseBrace,
            Self::parse_input_value_def,
        )
    }

    /**
     * InputFieldsDefinition : { InputValueDefinition+ }
     */
    fn advance_input_fields_definition(&mut self) -> ParseResult<Token> {
        self.advance_optional_delimited_nonempty_list(
            TokenKind::OpenBrace,
            TokenKind::CloseBrace,
            Self::advance_input_value_def,
        )
    }

    /**
     * DirectiveDefinition :
     *   - Description? directive @ Name ArgumentsDefinition? `repeatable`? on DirectiveLocations
     */
    fn parse_directive_definition(
        &mut self,
        description: Option<StringNode>,
        hack_source: Option<StringNode>,
    ) -> ParseResult<DirectiveDefinition> {
        let start = self.index();
        self.parse_keyword("directive")?;
        self.parse_kind(TokenKind::At)?;
        let name = self.parse_identifier()?;
        let arguments = self.parse_argument_defs()?;
        let directives = self.parse_constant_directives()?;

        let repeatable = self.peek_keyword("repeatable");
        if repeatable {
            self.parse_token();
        }
        self.parse_keyword("on")?;
        let locations = self.parse_directive_locations()?;
        let end = self.index();
        let span = Span::new(start, end);
        Ok(DirectiveDefinition {
            name,
            arguments,
            repeatable,
            locations,
            directives,
            description,
            hack_source,
            span,
        })
    }

    /**
     * DirectiveDefinition :
     *   - Description? directive @ Name ArgumentsDefinition? `repeatable`? on DirectiveLocations
     */
    fn advance_directive_definition(&mut self) -> ParseResult<Token> {
        self.advance_keyword("directive")?;
        self.advance_kind(TokenKind::At)?;
        self.advance_identifier()?; // name
        self.advance_argument_defs()?; // arguments
        self.advance_constant_directives()?; // directives

        let repeatable = self.peek_keyword("repeatable");
        if repeatable {
            self.advance_token();
        }
        self.advance_keyword("on")?;
        self.advance_directive_locations()?; // locations
        Ok(self.current)
    }

    /**
     * DirectiveDefinitionExtension :
     *   - extend directive @ Name Directives[Const]
     */
    fn parse_directive_definition_extension(
        &mut self,
    ) -> ParseResult<DirectiveDefinitionExtension> {
        // `extend directive` was parsed before
        let start = self.index();
        self.parse_kind(TokenKind::At)?;
        let name = self.parse_identifier()?;
        let directives = self.parse_constant_directives()?;
        if directives.is_empty() {
            self.record_error(Diagnostic::error(
                "Directive extension should define one or more directives.",
                Location::new(self.source_location, name.span),
            ));
            return Err(());
        }
        let end = self.index();
        let span = Span::new(start, end);
        Ok(DirectiveDefinitionExtension {
            name,
            directives,
            span,
        })
    }

    /**
     * DirectiveDefinitionExtension :
     *   - extend directive @ Name Directives[Const]
     */
    fn advance_directive_definition_extension(&mut self) -> ParseResult<Token> {
        // `extend directive` was parsed before
        self.advance_kind(TokenKind::At)?;
        self.advance_identifier()?; // name
        self.advance_constant_directives()?; // directives
        Ok(self.current)
    }

    /**
     * DirectiveLocations :
     *   - `|`? DirectiveLocation
     *   - DirectiveLocations | DirectiveLocation
     */
    fn parse_directive_locations(&mut self) -> ParseResult<Vec<DirectiveLocation>> {
        let mut locations = Vec::new();
        self.parse_optional_kind(TokenKind::Pipe);
        locations.push(self.parse_directive_location()?);
        while self.parse_optional_kind(TokenKind::Pipe).is_some() {
            locations.push(self.parse_directive_location()?);
        }
        Ok(locations)
    }

    /**
     * DirectiveLocations :
     *   - `|`? DirectiveLocation
     *   - DirectiveLocations | DirectiveLocation
     */
    fn advance_directive_locations(&mut self) -> ParseResult<Token> {
        self.advance_optional_kind(TokenKind::Pipe);
        self.advance_directive_location()?;
        while self.advance_optional_kind(TokenKind::Pipe).is_some() {
            self.advance_directive_location()?;
        }
        Ok(self.current)
    }

    /*
     * DirectiveLocation :
     *   - ExecutableDirectiveLocation
     *   - TypeSystemDirectiveLocation
     *
     * ExecutableDirectiveLocation : one of
     *   `QUERY`
     *   `MUTATION`
     *   `SUBSCRIPTION`
     *   `FIELD`
     *   `FRAGMENT_DEFINITION`
     *   `FRAGMENT_SPREAD`
     *   `INLINE_FRAGMENT`
     *
     * TypeSystemDirectiveLocation : one of
     *   `SCHEMA`
     *   `SCALAR`
     *   `OBJECT`
     *   `FIELD_DEFINITION`
     *   `ARGUMENT_DEFINITION`
     *   `INTERFACE`
     *   `UNION`
     *   `ENUM`
     *   `ENUM_VALUE`
     *   `INPUT_OBJECT`
     *   `INPUT_FIELD_DEFINITION`
     */
    fn parse_directive_location(&mut self) -> ParseResult<DirectiveLocation> {
        let token = self.parse_kind(TokenKind::Identifier)?;
        match self.source(&token) {
            "QUERY" => Ok(DirectiveLocation::Query),
            "MUTATION" => Ok(DirectiveLocation::Mutation),
            "SUBSCRIPTION" => Ok(DirectiveLocation::Subscription),
            "FIELD" => Ok(DirectiveLocation::Field),
            "FRAGMENT_DEFINITION" => Ok(DirectiveLocation::FragmentDefinition),
            "FRAGMENT_SPREAD" => Ok(DirectiveLocation::FragmentSpread),
            "INLINE_FRAGMENT" => Ok(DirectiveLocation::InlineFragment),
            "SCHEMA" => Ok(DirectiveLocation::Schema),
            "SCALAR" => Ok(DirectiveLocation::Scalar),
            "OBJECT" => Ok(DirectiveLocation::Object),
            "FIELD_DEFINITION" => Ok(DirectiveLocation::FieldDefinition),
            "ARGUMENT_DEFINITION" => Ok(DirectiveLocation::ArgumentDefinition),
            "INTERFACE" => Ok(DirectiveLocation::Interface),
            "UNION" => Ok(DirectiveLocation::Union),
            "ENUM" => Ok(DirectiveLocation::Enum),
            "ENUM_VALUE" => Ok(DirectiveLocation::EnumValue),
            "INPUT_OBJECT" => Ok(DirectiveLocation::InputObject),
            "INPUT_FIELD_DEFINITION" => Ok(DirectiveLocation::InputFieldDefinition),
            "VARIABLE_DEFINITION" => Ok(DirectiveLocation::VariableDefinition),
            "DIRECTIVE_DEFINITION" => Ok(DirectiveLocation::DirectiveDefinition),
            "FRAGMENT_VARIABLE_DEFINITION" => Ok(DirectiveLocation::FragmentVariableDefinition),
            token_str => {
                let error = Diagnostic::error(
                    format!("Unexpected `{token_str}`, expected a directive location."),
                    Location::new(self.source_location, token.span),
                );
                self.record_error(error);
                Err(())
            }
        }
    }

    fn advance_directive_location(&mut self) -> ParseResult<Token> {
        self.advance_kind(TokenKind::Identifier)
    }

    /**
     * Description : StringValue
     */
    fn parse_optional_description(&mut self) -> Option<StringNode> {
        match self.peek_token_kind() {
            TokenKind::StringLiteral => {
                let token = self.parse_token();
                let source = self.source(&token);
                let value = source[1..source.len() - 1].to_string().intern();
                Some(StringNode { token, value })
            }
            TokenKind::BlockStringLiteral => {
                let token = self.parse_token();
                let source = self.source(&token);
                let value = clean_block_string_literal(source).intern();
                Some(StringNode { token, value })
            }
            _ => None,
        }
    }

    /**
     * Description : StringValue
     */
    fn advance_optional_description(&mut self) -> Option<Token> {
        match self.peek_token_kind() {
            TokenKind::StringLiteral => Some(self.parse_token()),
            TokenKind::BlockStringLiteral => Some(self.parse_token()),
            _ => None,
        }
    }

    /**
     * hack_source : StringValue
     */
    fn parse_optional_hack_source(&mut self) -> Option<StringNode> {
        match self.peek_token_kind() {
            TokenKind::StringLiteral => {
                let token = self.parse_token();
                let source = self.source(&token);
                let value = source[1..source.len() - 1].to_string().intern();
                Some(StringNode { token, value })
            }
            TokenKind::BlockStringLiteral => {
                let token = self.parse_token();
                let source = self.source(&token);
                let value = clean_block_string_literal(source).intern();
                Some(StringNode { token, value })
            }
            _ => None,
        }
    }

    /**
     * hack_source : StringValue
     */
    fn advance_optional_hack_source(&mut self) -> Option<Token> {
        match self.peek_token_kind() {
            TokenKind::StringLiteral => Some(self.parse_token()),
            TokenKind::BlockStringLiteral => Some(self.parse_token()),
            _ => None,
        }
    }

    /**
     * FieldsDefinition : { FieldDefinition+ }
     */
    fn parse_fields_definition(&mut self) -> ParseResult<Option<List<FieldDefinition>>> {
        self.parse_optional_delimited_nonempty_list(
            TokenKind::OpenBrace,
            TokenKind::CloseBrace,
            Self::parse_field_definition_impl,
        )
    }

    /**
     * FieldsDefinition : { FieldDefinition+ }
     */
    fn advance_fields_definition(&mut self) -> ParseResult<Token> {
        self.advance_optional_delimited_nonempty_list(
            TokenKind::OpenBrace,
            TokenKind::CloseBrace,
            Self::advance_field_definition_impl,
        )
    }

    /**
     * FieldDefinition :
     *   - Description? Name ArgumentsDefinition? : Type Directives?
     */
    fn parse_field_definition_impl(&mut self) -> ParseResult<FieldDefinition> {
        let start = self.index();
        let description = self.parse_optional_description();
        let hack_source = self.parse_optional_hack_source();
        let name = self.parse_identifier()?;
        let arguments = self.parse_argument_defs()?;
        self.parse_kind(TokenKind::Colon)?;
        let type_ = self.parse_type_annotation()?;
        let directives = self.parse_constant_directives()?;
        let end = self.index();
        let span = Span::new(start, end);
        Ok(FieldDefinition {
            name,
            type_,
            arguments,
            directives,
            description,
            hack_source,
            span,
        })
    }

    /**
     * FieldDefinition :
     *   - Description? Name ArgumentsDefinition? : Type Directives?
     */
    fn advance_field_definition_impl(&mut self) -> ParseResult<Token> {
        self.advance_optional_description(); // description
        self.advance_optional_hack_source(); // hack_source
        self.advance_identifier()?; // name
        self.advance_argument_defs()?; // arguments
        self.advance_kind(TokenKind::Colon)?;
        self.advance_type_annotation()?; // type_
        self.advance_constant_directives()?; // directives
        Ok(self.current)
    }

    fn parse_field_definition_stub_impl(&mut self) -> ParseResult<FieldDefinitionStub> {
        let name = self.parse_identifier()?;
        let arguments = self.parse_argument_defs()?;
        Ok(FieldDefinitionStub { name, arguments })
    }

    /**
     * ArgumentsDefinition : ( InputValueDefinition+ )
     */
    fn parse_argument_defs(&mut self) -> ParseResult<Option<List<InputValueDefinition>>> {
        self.parse_optional_delimited_nonempty_list(
            TokenKind::OpenParen,
            TokenKind::CloseParen,
            Self::parse_input_value_def,
        )
    }

    /**
     * ArgumentsDefinition : ( InputValueDefinition+ )
     */
    fn advance_argument_defs(&mut self) -> ParseResult<Token> {
        self.advance_optional_delimited_nonempty_list(
            TokenKind::OpenParen,
            TokenKind::CloseParen,
            Self::advance_input_value_def,
        )
    }

    /**
     * InputValueDefinition :
     *   - Description? Name : Type DefaultValue? Directives?
     */
    fn parse_input_value_def(&mut self) -> ParseResult<InputValueDefinition> {
        let start = self.index();
        let description = self.parse_optional_description();
        let name = self.parse_identifier()?;
        self.parse_kind(TokenKind::Colon)?;
        let type_ = self.parse_type_annotation()?;
        let default_value = if self.peek_token_kind() == TokenKind::Equals {
            Some(self.parse_default_value()?)
        } else {
            None
        };
        let directives = self.parse_constant_directives()?;
        let end = self.index();
        let span = Span::new(start, end);
        Ok(InputValueDefinition {
            name,
            type_,
            default_value,
            directives,
            description,
            span,
        })
    }

    /**
     * InputValueDefinition :
     *   - Description? Name : Type DefaultValue? Directives?
     */
    fn advance_input_value_def(&mut self) -> ParseResult<Token> {
        self.advance_optional_description();
        self.advance_identifier()?; // name
        self.advance_kind(TokenKind::Colon)?;
        self.advance_type_annotation()?; // type_
        if self.peek_token_kind() == TokenKind::Equals {
            self.advance_default_value()?; // default_value
        }
        self.advance_constant_directives()?; // directives
        Ok(self.current)
    }

    /**
     * ImplementsInterfaces :
     *   - implements `&`? NamedType
     *   - ImplementsInterfaces & NamedType
     */
    fn parse_implements_interfaces(&mut self) -> ParseResult<Vec<Identifier>> {
        let mut interfaces = Vec::new();
        if self.peek_keyword("implements") {
            self.parse_token();
            self.parse_optional_kind(TokenKind::Ampersand);
            interfaces.push(self.parse_identifier()?);
            while self.parse_optional_kind(TokenKind::Ampersand).is_some() {
                interfaces.push(self.parse_identifier()?);
            }
        }
        Ok(interfaces)
    }

    /**
     * ImplementsInterfaces :
     *   - implements `&`? NamedType
     *   - ImplementsInterfaces & NamedType
     */
    fn advance_implements_interfaces(&mut self) -> ParseResult<Token> {
        if self.peek_keyword("implements") {
            self.advance_token();
            self.advance_optional_kind(TokenKind::Ampersand);
            self.advance_identifier()?;
            while self.advance_optional_kind(TokenKind::Ampersand).is_some() {
                self.advance_identifier()?;
            }
        }
        Ok(self.current)
    }

    /// FragmentDefinition : Description? fragment FragmentName TypeCondition Directives? SelectionSet
    fn parse_fragment_definition(&mut self) -> ParseResult<FragmentDefinition> {
        let start = self.index();
        let description = self.parse_optional_description();
        let fragment = self.parse_keyword("fragment")?;
        let name = self.parse_identifier()?;
        let variable_definitions = if self.features.supports_variable_definition_syntax() {
            self.parse_optional_delimited_nonempty_list(
                TokenKind::OpenParen,
                TokenKind::CloseParen,
                Self::parse_variable_definition,
            )?
        } else {
            None
        };
        let type_condition = self.parse_type_condition()?;
        let directives = self.parse_directives()?;
        let selections = self.parse_selections()?;
        let end = self.end_index;
        let span = Span::new(start, end);
        Ok(FragmentDefinition {
            location: Location::new(self.source_location, span),
            fragment,
            name,
            variable_definitions,
            type_condition,
            directives,
            selections,
            description,
        })
    }

    /// OperationDefinition :
    ///     Description? OperationType Name? VariableDefinitions? Directives? SelectionSet
    ///     SelectionSet
    fn parse_operation_definition(&mut self) -> ParseResult<OperationDefinition> {
        let start = self.index();
        // Special case: anonymous query
        if self.peek_token_kind() == TokenKind::OpenBrace {
            let selections = self.parse_selections()?;
            let span = Span::new(start, self.end_index);
            return Ok(OperationDefinition {
                location: Location::new(self.source_location, span),
                operation: None,
                name: None,
                variable_definitions: None,
                directives: Vec::new(),
                selections,
                description: None,
            });
        }
        // Check for description before operation type
        let description = self.parse_optional_description();
        // Otherwise requires operation type and name
        let maybe_operation_token = self.peek();
        let operation = match (
            maybe_operation_token.kind,
            self.source(maybe_operation_token),
        ) {
            (TokenKind::Identifier, "mutation") => (self.parse_token(), OperationKind::Mutation),
            (TokenKind::Identifier, "query") => (self.parse_token(), OperationKind::Query),
            (TokenKind::Identifier, "subscription") => {
                (self.parse_token(), OperationKind::Subscription)
            }
            _ => {
                let error = Diagnostic::error(
                    SyntaxError::ExpectedOperationKind,
                    Location::new(self.source_location, maybe_operation_token.span),
                );
                self.record_error(error);
                return Err(());
            }
        };
        let name = if self.peek_token_kind() == TokenKind::Identifier {
            Some(self.parse_identifier()?)
        } else {
            None
        };
        let variable_definitions = self.parse_optional_delimited_nonempty_list(
            TokenKind::OpenParen,
            TokenKind::CloseParen,
            Self::parse_variable_definition,
        )?;
        let directives = self.parse_directives()?;
        let selections = self.parse_selections()?;
        let span = Span::new(start, self.end_index);
        Ok(OperationDefinition {
            location: Location::new(self.source_location, span),
            operation: Some(operation),
            name,
            variable_definitions,
            directives,
            selections,
            description,
        })
    }

    /// VariableDefinition : Description? Variable : Type DefaultValue? Directives[Const]?
    fn parse_variable_definition(&mut self) -> ParseResult<VariableDefinition> {
        let start = self.index();
        let description = self.parse_optional_description();
        let name = self.parse_variable_identifier()?;
        let colon = self.parse_kind(TokenKind::Colon)?;
        let type_ = self.parse_type_annotation()?;
        let default_value = if self.peek_token_kind() == TokenKind::Equals {
            Some(self.parse_default_value()?)
        } else {
            None
        };
        let directives = self.parse_directives()?;
        let span = Span::new(start, self.end_index);
        Ok(VariableDefinition {
            span,
            name,
            colon,
            type_,
            default_value,
            directives,
            description,
        })
    }

    /// DefaultValue : = Value[Const]
    fn parse_default_value(&mut self) -> ParseResult<DefaultValue> {
        let start = self.index();
        let equals = self.parse_kind(TokenKind::Equals)?;
        let value = self.parse_constant_value()?;
        let span = Span::new(start, self.end_index);
        Ok(DefaultValue {
            span,
            equals,
            value,
        })
    }

    /// DefaultValue : = Value[Const]
    fn advance_default_value(&mut self) -> ParseResult<Token> {
        self.advance_kind(TokenKind::Equals)?; // equals
        self.advance_constant_value()?; // value
        Ok(self.current)
    }

    /// Type :
    ///     NamedType
    ///     ListType
    ///     NonNullType
    fn parse_type_annotation(&mut self) -> ParseResult<TypeAnnotation> {
        let start = self.index();
        let token = self.peek();
        let type_annotation = match token.kind {
            TokenKind::Identifier => TypeAnnotation::Named(NamedTypeAnnotation {
                name: self.parse_identifier()?,
            }),
            TokenKind::OpenBracket => {
                let open = self.parse_kind(TokenKind::OpenBracket)?;
                let type_ = self.parse_type_annotation()?;
                let close = self.parse_kind(TokenKind::CloseBracket)?;
                TypeAnnotation::List(Box::new(ListTypeAnnotation {
                    span: Span::new(start, self.end_index),
                    open,
                    type_,
                    close,
                }))
            }
            _ => {
                let error = Diagnostic::error(
                    SyntaxError::ExpectedTypeAnnotation,
                    Location::new(self.source_location, token.span),
                );
                self.record_error(error);
                return Err(());
            }
        };
        if self.peek_token_kind() == TokenKind::Exclamation {
            let exclamation = self.parse_kind(TokenKind::Exclamation)?;
            Ok(TypeAnnotation::NonNull(Box::new(NonNullTypeAnnotation {
                span: Span::new(start, self.end_index),
                type_: type_annotation,
                exclamation,
            })))
        } else {
            Ok(type_annotation)
        }
    }

    /// Type :
    ///     NamedType
    ///     ListType
    ///     NonNullType
    fn advance_type_annotation(&mut self) -> ParseResult<Token> {
        let token = self.peek();
        match token.kind {
            TokenKind::Identifier => {
                self.advance_identifier()?;
            }
            TokenKind::OpenBracket => {
                self.advance_kind(TokenKind::OpenBracket)?; // open
                self.advance_type_annotation()?; // type_
                self.advance_kind(TokenKind::CloseBracket)?; // close
            }
            _ => {
                let error = Diagnostic::error(
                    SyntaxError::ExpectedTypeAnnotation,
                    Location::new(self.source_location, token.span),
                );
                self.record_error(error);
                return Err(());
            }
        };
        if self.peek_token_kind() == TokenKind::Exclamation {
            self.advance_kind(TokenKind::Exclamation)?; // exclamation
        }
        Ok(self.current)
    }

    /// Directives[Const] : Directive[?Const]+
    fn parse_directives(&mut self) -> ParseResult<Vec<Directive>> {
        self.parse_list(|s| s.peek_kind(TokenKind::At), |s| s.parse_directive_impl())
    }

    fn parse_constant_directives(&mut self) -> ParseResult<Vec<ConstantDirective>> {
        if self.peek_token_kind() == TokenKind::At {
            self.parse_list(
                |s| s.peek_kind(TokenKind::At),
                |s| s.parse_constant_directive(),
            )
        } else {
            Ok(vec![])
        }
    }

    fn advance_constant_directives(&mut self) -> ParseResult<Token> {
        if self.peek_token_kind() == TokenKind::At {
            self.advance_list(
                |s| s.peek_kind(TokenKind::At),
                |s| s.advance_constant_directive(),
            )
        } else {
            Ok(self.current)
        }
    }

    /// Directive[Const] : @ Name Arguments[?Const]?
    fn parse_directive_impl(&mut self) -> ParseResult<Directive> {
        let start = self.index();
        let at = self.parse_kind(TokenKind::At)?;
        let name = self.parse_identifier_with_error_recovery();
        let arguments = self.parse_optional_arguments()?;
        let span = Span::new(start, self.end_index);
        Ok(Directive {
            span,
            at,
            name,
            arguments,
        })
    }
    fn parse_constant_directive(&mut self) -> ParseResult<ConstantDirective> {
        let start = self.index();
        let at = self.parse_kind(TokenKind::At)?;
        let name = self.parse_identifier()?;
        let arguments = self.parse_optional_constant_arguments()?;
        let span = Span::new(start, self.end_index);
        Ok(ConstantDirective {
            span,
            at,
            name,
            arguments,
        })
    }

    fn advance_constant_directive(&mut self) -> ParseResult<Token> {
        self.advance_kind(TokenKind::At)?; // at
        self.advance_identifier()?; // name
        self.advance_optional_constant_arguments()?; // arguments
        Ok(self.current)
    }

    /// TypeCondition : on NamedType
    /// NamedType : Name
    fn parse_type_condition(&mut self) -> ParseResult<TypeCondition> {
        let start = self.index();
        let on = self.parse_keyword("on")?;
        let type_ = self.parse_identifier()?;
        Ok(TypeCondition {
            span: Span::new(start, self.end_index),
            on,
            type_,
        })
    }

    /// SelectionSet : { Selection+ }
    fn parse_selections(&mut self) -> ParseResult<List<Selection>> {
        self.parse_delimited_nonempty_list(
            TokenKind::OpenBrace,
            TokenKind::CloseBrace,
            Self::parse_selection,
        )
    }

    /// Selection :
    ///     Field
    ///     FragmentSpread
    ///     InlineFragment
    fn parse_selection(&mut self) -> ParseResult<Selection> {
        let token = self.peek();
        match token.kind {
            TokenKind::Spread => self.parse_spread(),
            TokenKind::Identifier | TokenKind::StringLiteral => self.parse_field(),
            // hint for invalid spreads
            TokenKind::Period | TokenKind::PeriodPeriod => {
                let error = Diagnostic::error(
                    SyntaxError::ExpectedSpread,
                    Location::new(self.source_location, token.span),
                );
                self.record_error(error);
                Err(())
            }
            _ => {
                let error = Diagnostic::error(
                    SyntaxError::ExpectedSelection,
                    Location::new(self.source_location, token.span),
                );
                self.record_error(error);
                Err(())
            }
        }
    }

    fn parse_name_or_string_literal(&mut self) -> ParseResult<IdentifierOrString> {
        let token_kind = self.peek_token_kind();
        if token_kind == TokenKind::Identifier {
            return Ok(IdentifierOrString::Identifier(self.parse_identifier()?));
        }

        let token = self.parse_token();
        if !self.features.allow_string_literal_alias {
            self.record_error(Diagnostic::error(
                SyntaxError::Expected(TokenKind::Identifier),
                Location::new(self.source_location, token.span),
            ));
            return Err(());
        }

        match token.kind {
            TokenKind::StringLiteral => Ok(IdentifierOrString::StringNode(
                self.parse_string_literal(token, self.source(&token)),
            )),
            _ => {
                self.record_error(Diagnostic::error(
                    SyntaxError::Expected(TokenKind::StringLiteral),
                    Location::new(self.source_location, token.span),
                ));
                Err(())
            }
        }
    }

    /// Field : Alias? Name Arguments? Directives? SelectionSet?
    fn parse_field(&mut self) -> ParseResult<Selection> {
        let start = self.index();
        let maybe_alias = self.parse_name_or_string_literal()?;
        let (name, alias) = if self.peek_token_kind() == TokenKind::Colon {
            let colon = self.parse_kind(TokenKind::Colon)?;
            let alias = match maybe_alias {
                IdentifierOrString::Identifier(node) => node,
                IdentifierOrString::StringNode(node) => Identifier {
                    span: node.token.span,
                    token: node.token,
                    value: node.value,
                },
            };
            let name = {
                match self.peek_token_kind() {
                    TokenKind::Identifier => self.parse_identifier()?,
                    token_kind => {
                        let name = self.empty_identifier();
                        self.record_error(Diagnostic::error(
                            format!(
                                "Incomplete field alias, expected {} but found {}",
                                TokenKind::Identifier,
                                token_kind
                            ),
                            Location::new(self.source_location, Span::new(start, name.span.end)),
                        ));
                        name
                    }
                }
            };
            (
                name,
                Some(Alias {
                    span: Span::new(start, self.end_index),
                    alias,
                    colon,
                }),
            )
        } else {
            match maybe_alias {
                IdentifierOrString::StringNode(node) => {
                    self.record_error(Diagnostic::error(
                        SyntaxError::Expected(TokenKind::Identifier),
                        Location::new(self.source_location, node.token.span),
                    ));
                    (self.empty_identifier(), None)
                }
                IdentifierOrString::Identifier(node) => (node, None),
            }
        };

        let arguments = self.parse_optional_arguments()?;
        let directives = self.parse_directives()?;
        if self.peek_token_kind() == TokenKind::OpenBrace {
            let selections = self.parse_selections()?;
            Ok(Selection::LinkedField(LinkedField {
                span: Span::new(start, self.end_index),
                alias,
                name,
                arguments,
                directives,
                selections,
            }))
        } else {
            Ok(Selection::ScalarField(ScalarField {
                span: Span::new(start, self.end_index),
                alias,
                name,
                arguments,
                directives,
            }))
        }
    }

    /// FragmentSpread : ... FragmentName Directives?
    /// InlineFragment : ... TypeCondition? Directives? SelectionSet
    fn parse_spread(&mut self) -> ParseResult<Selection> {
        let start = self.index();
        let spread = self.parse_kind(TokenKind::Spread)?;
        let is_on_keyword = self.peek_keyword("on");
        if !is_on_keyword && self.peek_token_kind() == TokenKind::Identifier {
            // fragment spread
            let name = self.parse_identifier()?;
            let arguments = if self.features.supports_spread_arguments_syntax() {
                self.parse_optional_arguments()?
            } else {
                None
            };
            let directives = self.parse_directives()?;
            Ok(Selection::FragmentSpread(FragmentSpread {
                span: Span::new(start, self.end_index),
                spread,
                name,
                arguments,
                directives,
            }))
        } else {
            // inline fragment with or without a type condition
            let type_condition = if is_on_keyword {
                Some(self.parse_type_condition()?)
            } else {
                None
            };
            let directives = self.parse_directives()?;
            let selections = self.parse_selections()?;
            Ok(Selection::InlineFragment(InlineFragment {
                span: Span::new(start, self.end_index),
                spread,
                type_condition,
                directives,
                selections,
            }))
        }
    }

    /// Arguments?
    /// Arguments[Const] : ( Argument[?Const]+ )
    fn parse_optional_arguments(&mut self) -> ParseResult<Option<List<Argument>>> {
        if self.peek_token_kind() != TokenKind::OpenParen {
            return Ok(None);
        }
        let start = self.parse_token();
        let mut items: Vec<Argument> = vec![];
        loop {
            let peek_kind = self.peek_token_kind();
            if peek_kind == TokenKind::CloseParen {
                break;
            } else if peek_kind == TokenKind::OpenBrace || peek_kind == TokenKind::CloseBrace {
                self.record_error(Diagnostic::error(
                    SyntaxError::Expected(TokenKind::CloseParen),
                    Location::new(self.source_location, self.peek().span),
                ));
                let span = Span::new(start.span.start, self.end_index);
                if items.is_empty() {
                    self.record_error(Diagnostic::error(
                        SyntaxError::ExpectedArgument,
                        Location::new(self.source_location, span),
                    ))
                }
                return Ok(Some(List {
                    span,
                    start,
                    items,
                    end: self.empty_token(),
                }));
            }
            // MaybeArgument Name ?: ?Value[?Const]
            let start = self.index();
            let name = if peek_kind == TokenKind::Identifier {
                self.parse_identifier()?
            } else {
                (|| {
                    if peek_kind == TokenKind::Colon && !items.is_empty() {
                        /*
                            (
                                arg:
                                arg2: $var
                                #   ^ We are at the second colon, and need to recover the identifier
                            )
                        */
                        let last_arg = items.last_mut().unwrap();
                        if let Value::Constant(ConstantValue::Enum(node)) = &last_arg.value {
                            self.record_error(Diagnostic::error(
                                SyntaxError::ExpectedValue,
                                Location::new(
                                    self.source_location,
                                    Span::new(last_arg.colon.span.end, last_arg.colon.span.end),
                                ),
                            ));
                            let name = Identifier {
                                span: node.token.span,
                                token: node.token,
                                value: node.value,
                            };
                            last_arg.span.end = last_arg.colon.span.end;
                            last_arg.value = Value::Constant(ConstantValue::Null(Token {
                                span: Span::new(last_arg.span.end, last_arg.span.end),
                                kind: TokenKind::Empty,
                            }));
                            return name;
                        }
                    }
                    /*
                        ($var)
                        (:$var)
                    */
                    self.record_error(Diagnostic::error(
                        SyntaxError::Expected(TokenKind::Identifier),
                        Location::new(
                            self.source_location,
                            Span::new(start, self.peek().span.start),
                        ),
                    ));
                    self.empty_identifier()
                })()
            };

            let colon = self.parse_optional_kind(TokenKind::Colon);
            if let Some(colon) = colon {
                if self.peek_kind(TokenKind::CloseParen) {
                    self.record_error(Diagnostic::error(
                        SyntaxError::ExpectedValue,
                        Location::new(
                            self.source_location,
                            Span::new(name.span.end, self.end_index),
                        ),
                    ));
                    let span = Span::new(start, self.end_index);
                    let value = Value::Constant(ConstantValue::Null(self.empty_token()));
                    items.push(Argument {
                        span,
                        name,
                        colon,
                        value,
                    });
                } else {
                    let value = self.parse_value()?;
                    let span = Span::new(start, self.end_index);
                    items.push(Argument {
                        span,
                        name,
                        colon,
                        value,
                    });
                }
            } else {
                self.record_error(Diagnostic::error(
                    SyntaxError::Expected(TokenKind::Colon),
                    Location::new(self.source_location, Span::new(name.span.end, self.index())),
                ));
                // Continue parsing value if the next token looks like a value (except for Enum)
                // break early if the next token is not a valid token for the next argument
                let mut should_break = false;
                let value = match self.peek_token_kind() {
                    TokenKind::Dollar
                    | TokenKind::OpenBrace
                    | TokenKind::OpenBracket
                    | TokenKind::StringLiteral
                    | TokenKind::IntegerLiteral
                    | TokenKind::FloatLiteral => self.parse_value()?,
                    TokenKind::Identifier => {
                        let source = self.source(self.peek());
                        if source == "true" || source == "false" || source == "null" {
                            self.parse_value()?
                        } else {
                            Value::Constant(ConstantValue::Null(self.empty_token()))
                        }
                    }
                    TokenKind::CloseParen | TokenKind::Colon => {
                        Value::Constant(ConstantValue::Null(self.empty_token()))
                    }
                    _ => {
                        should_break = true;
                        Value::Constant(ConstantValue::Null(self.empty_token()))
                    }
                };
                let span = Span::new(start, self.end_index);
                items.push(Argument {
                    span,
                    name,
                    colon: self.empty_token(),
                    value,
                });
                if should_break {
                    break;
                }
            }
        }
        let end = self.parse_token();
        let span = Span::new(start.span.start, end.span.end);
        if items.is_empty() {
            self.record_error(Diagnostic::error(
                SyntaxError::ExpectedArgument,
                Location::new(self.source_location, span),
            ))
        }
        Ok(Some(List {
            span,
            start,
            items,
            end,
        }))
    }

    fn parse_optional_constant_arguments(&mut self) -> ParseResult<Option<List<ConstantArgument>>> {
        self.parse_optional_delimited_nonempty_list(
            TokenKind::OpenParen,
            TokenKind::CloseParen,
            Self::parse_constant_argument,
        )
    }

    fn advance_optional_constant_arguments(&mut self) -> ParseResult<Token> {
        self.advance_optional_delimited_nonempty_list(
            TokenKind::OpenParen,
            TokenKind::CloseParen,
            Self::parse_constant_argument,
        )
    }

    /// Argument[Const] : Name : Value[?Const]
    fn parse_argument(&mut self) -> ParseResult<Argument> {
        let start = self.index();
        let name = self.parse_identifier()?;
        let colon = self.parse_kind(TokenKind::Colon)?;
        let value = self.parse_value()?;
        let span = Span::new(start, self.end_index);
        Ok(Argument {
            span,
            name,
            colon,
            value,
        })
    }

    /// Argument[Const=true] : Name : Value[Const=true]
    fn parse_constant_argument(&mut self) -> ParseResult<ConstantArgument> {
        let start = self.index();
        let name = self.parse_identifier()?;
        let colon = self.parse_kind(TokenKind::Colon)?;
        let value = self.parse_constant_value()?;
        let span = Span::new(start, self.end_index);
        Ok(ConstantArgument {
            span,
            name,
            colon,
            value,
        })
    }

    /// Argument[Const=true] : Name : Value[Const=true]
    fn advance_constant_argument(&mut self) -> ParseResult<Token> {
        self.advance_identifier()?; // name
        self.advance_kind(TokenKind::Colon)?; // colon
        self.advance_constant_value()?; // value
        Ok(self.current)
    }

    /// Value[?Const] :
    ///     [~Const] Variable
    ///     ListValue[?Const]
    ///     ObjectValue[?Const]
    // (delegated):
    ///     IntValue
    ///     FloatValue
    ///     StringValue
    ///     BooleanValue
    ///     NullValue
    ///     EnumValue
    fn parse_value(&mut self) -> ParseResult<Value> {
        let token = self.peek();
        match token.kind {
            TokenKind::OpenBracket => {
                let list = self.parse_delimited_list(
                    TokenKind::OpenBracket,
                    TokenKind::CloseBracket,
                    |s| s.parse_value(),
                )?;
                // Promote a Value::List() with all constant items to Value::Constant()
                if list.items.iter().all(|x| x.is_constant()) {
                    let mut constants = Vec::with_capacity(list.items.len());
                    for item in list.items {
                        match item {
                            Value::Constant(c) => {
                                constants.push(c);
                            }
                            _ => unreachable!("Already checked all items are constant"),
                        }
                    }
                    Ok(Value::Constant(ConstantValue::List(List {
                        span: list.span,
                        start: list.start,
                        items: constants,
                        end: list.end,
                    })))
                } else {
                    Ok(Value::List(list))
                }
            }
            TokenKind::OpenBrace => {
                let list =
                    self.parse_delimited_list(TokenKind::OpenBrace, TokenKind::CloseBrace, |s| {
                        s.parse_argument()
                    })?;
                // Promote a Value::Object() with all constant values to Value::Constant()
                if list.items.iter().all(|x| x.value.is_constant()) {
                    let mut arguments = Vec::with_capacity(list.items.len());
                    for argument in list.items {
                        let value = match argument.value {
                            Value::Constant(c) => c,
                            _ => unreachable!("Already checked all items are constant"),
                        };
                        arguments.push(ConstantArgument {
                            span: argument.span,
                            name: argument.name,
                            colon: argument.colon,
                            value,
                        });
                    }
                    Ok(Value::Constant(ConstantValue::Object(List {
                        span: list.span,
                        start: list.start,
                        items: arguments,
                        end: list.end,
                    })))
                } else {
                    Ok(Value::Object(list))
                }
            }
            TokenKind::Dollar => Ok(Value::Variable(self.parse_variable_identifier()?)),
            _ => Ok(Value::Constant(self.parse_literal_value()?)),
        }
    }

    // Constant Values

    /// Value[Const=true] :
    ///     IntValue
    ///     FloatValue
    ///     StringValue
    ///     BooleanValue
    ///     NullValue
    ///     EnumValue
    ///     ListValue[Const=true]
    ///     ObjectValue[Const=true]
    fn parse_constant_value(&mut self) -> ParseResult<ConstantValue> {
        match self.peek_token_kind() {
            TokenKind::OpenBracket => Ok(ConstantValue::List(self.parse_delimited_list(
                TokenKind::OpenBracket,
                TokenKind::CloseBracket,
                |s| s.parse_constant_value(),
            )?)),
            TokenKind::OpenBrace => Ok(ConstantValue::Object(self.parse_delimited_list(
                TokenKind::OpenBrace,
                TokenKind::CloseBrace,
                |s| s.parse_constant_argument(),
            )?)),
            _ => self.parse_literal_value(),
        }
    }

    /// Value[Const=true] :
    ///     IntValue
    ///     FloatValue
    ///     StringValue
    ///     BooleanValue
    ///     NullValue
    ///     EnumValue
    ///     ListValue[Const=true]
    ///     ObjectValue[Const=true]
    fn advance_constant_value(&mut self) -> ParseResult<Token> {
        match self.peek_token_kind() {
            TokenKind::OpenBracket => {
                self.advance_delimited_list(TokenKind::OpenBracket, TokenKind::CloseBracket, |s| {
                    s.advance_constant_value()
                })
            }
            TokenKind::OpenBrace => {
                self.advance_delimited_list(TokenKind::OpenBrace, TokenKind::CloseBrace, |s| {
                    s.advance_constant_argument()
                })
            }
            _ => self.advance_literal_value(),
        }
    }

    /// IntValue
    /// FloatValue
    /// StringValue
    /// BooleanValue
    /// NullValue
    /// EnumValue
    fn parse_literal_value(&mut self) -> ParseResult<ConstantValue> {
        let token = self.parse_token();
        let source = self.source(&token);
        match &token.kind {
            TokenKind::StringLiteral => Ok(ConstantValue::String(
                self.parse_string_literal(token, source),
            )),
            TokenKind::BlockStringLiteral => {
                let value = clean_block_string_literal(source);
                Ok(ConstantValue::String(StringNode {
                    token,
                    value: value.intern(),
                }))
            }
            TokenKind::IntegerLiteral => {
                let value = source.parse::<i64>();
                match value {
                    Ok(value) => Ok(ConstantValue::Int(IntNode { token, value })),
                    Err(_) => {
                        let error = Diagnostic::error(
                            SyntaxError::InvalidInteger,
                            Location::new(self.source_location, token.span),
                        );
                        self.record_error(error);
                        Err(())
                    }
                }
            }
            TokenKind::FloatLiteral => {
                let value = source.parse::<f64>();
                match value {
                    // Out-of-range literals such as `1e400` parse to infinity
                    // rather than an error, but GraphQL floats must be finite.
                    Ok(value) if value.is_finite() => Ok(ConstantValue::Float(FloatNode {
                        token,
                        value: FloatValue::new(value),
                        source_value: source.intern(),
                    })),
                    _ => {
                        let error = Diagnostic::error(
                            SyntaxError::InvalidFloat,
                            Location::new(self.source_location, token.span),
                        );
                        self.record_error(error);
                        Err(())
                    }
                }
            }
            TokenKind::Identifier => Ok(match source {
                "true" => ConstantValue::Boolean(BooleanNode { token, value: true }),
                "false" => ConstantValue::Boolean(BooleanNode {
                    token,
                    value: false,
                }),
                "null" => ConstantValue::Null(token),
                _ => ConstantValue::Enum(EnumNode {
                    token,
                    value: source.intern(),
                }),
            }),
            TokenKind::ErrorFloatLiteralMissingZero => {
                let error = Diagnostic::error(
                    SyntaxError::InvalidFloatLiteralMissingZero,
                    Location::new(self.source_location, token.span),
                );
                self.record_error(error);
                Err(())
            }
            TokenKind::ErrorNumberLiteralLeadingZero
            | TokenKind::ErrorNumberLiteralTrailingInvalid => {
                let error = Diagnostic::error(
                    SyntaxError::InvalidNumberLiteral,
                    Location::new(self.source_location, token.span),
                );
                self.record_error(error);
                Err(())
            }
            TokenKind::ErrorUnsupportedStringCharacter => {
                let error = Diagnostic::error(
                    SyntaxError::UnsupportedStringCharacter,
                    Location::new(self.source_location, token.span),
                );
                self.record_error(error);
                Err(())
            }
            TokenKind::ErrorUnterminatedString => {
                let error = Diagnostic::error(
                    SyntaxError::UnterminatedString,
                    Location::new(self.source_location, token.span),
                );
                self.record_error(error);
                Err(())
            }
            TokenKind::ErrorUnterminatedBlockString => {
                let error = Diagnostic::error(
                    SyntaxError::UnterminatedBlockString,
                    Location::new(self.source_location, token.span),
                );
                self.record_error(error);
                Err(())
            }
            _ => {
                let error = Diagnostic::error(
                    SyntaxError::ExpectedConstantValue,
                    Location::new(self.source_location, token.span),
                );
                self.record_error(error);
                Err(())
            }
        }
    }

    fn parse_string_literal(&self, token: Token, source: &str) -> StringNode {
        let value = source[1..source.len() - 1].to_string();
        StringNode {
            token,
            value: value.intern(),
        }
    }

    /// IntValue
    /// FloatValue
    /// StringValue
    /// BooleanValue
    /// NullValue
    /// EnumValue
    fn advance_literal_value(&mut self) -> ParseResult<Token> {
        Ok(self.advance_token())
    }

    /// Variable : $ Name
    fn parse_variable_identifier(&mut self) -> ParseResult<VariableIdentifier> {
        let start = self.index();
        let dollar_token = self.parse_token();
        if dollar_token.kind != TokenKind::Dollar {
            self.record_error(Diagnostic::error(
                SyntaxError::ExpectedVariable,
                Location::new(self.source_location, dollar_token.span),
            ));
            return Err(());
        }

        let token = self.parse_token();
        if token.kind == TokenKind::Identifier {
            let name = self.source(&token).intern();
            Ok(VariableIdentifier {
                span: Span::new(start, token.span.end),
                token,
                name,
            })
        } else {
            let error = Diagnostic::error(
                SyntaxError::ExpectedVariableIdentifier,
                Location::new(self.source_location, token.span),
            );
            self.record_error(error);
            Err(())
        }
    }

    /// Name :: /[_A-Za-z][_0-9A-Za-z]*/
    fn parse_identifier(&mut self) -> ParseResult<Identifier> {
        let token = self.parse_token();
        let source = self.source(&token);
        let span = token.span;
        match token.kind {
            TokenKind::Identifier => Ok(Identifier {
                span,
                token,
                value: source.intern(),
            }),
            _ => {
                let error = Diagnostic::error(
                    SyntaxError::Expected(TokenKind::Identifier),
                    Location::new(self.source_location, span),
                );
                self.record_error(error);
                Err(())
            }
        }
    }

    /// Name :: /[_A-Za-z][_0-9A-Za-z]*/
    fn advance_identifier(&mut self) -> ParseResult<Token> {
        let token = self.parse_token();
        match token.kind {
            TokenKind::Identifier => Ok(token),
            _ => {
                let error = Diagnostic::error(
                    SyntaxError::Expected(TokenKind::Identifier),
                    Location::new(self.source_location, token.span),
                );
                self.record_error(error);
                Err(())
            }
        }
    }

    fn parse_identifier_with_error_recovery(&mut self) -> Identifier {
        match self.peek_token_kind() {
            TokenKind::Identifier => {
                let token = self.parse_token();
                let source = self.source(&token);
                let span = token.span;
                Identifier {
                    span,
                    token,
                    value: source.intern(),
                }
            }
            _ => {
                let identifier = self.empty_identifier();
                self.record_error(Diagnostic::error(
                    SyntaxError::Expected(TokenKind::Identifier),
                    Location::new(self.source_location, identifier.span),
                ));
                identifier
            }
        }
    }

    // Helpers

    /// <item>*
    fn parse_list<T, F1, F2>(&mut self, peek: F1, parse: F2) -> ParseResult<Vec<T>>
    where
        F1: Fn(&mut Self) -> bool,
        F2: Fn(&mut Self) -> ParseResult<T>,
    {
        let mut items = vec![];
        while peek(self) {
            items.push(parse(self)?);
        }
        Ok(items)
    }

    /// <item>*
    fn advance_list<F1, F2>(&mut self, peek: F1, advance: F2) -> ParseResult<Token>
    where
        F1: Fn(&mut Self) -> bool,
        F2: Fn(&mut Self) -> ParseResult<Token>,
    {
        while peek(self) {
            advance(self)?;
        }
        Ok(self.current)
    }

    /// Parse delimited items into a `List`
    /// <start> <item>* <end>
    fn parse_delimited_list<T, F>(
        &mut self,
        start_kind: TokenKind,
        end_kind: TokenKind,
        parse: F,
    ) -> ParseResult<List<T>>
    where
        F: Fn(&mut Self) -> ParseResult<T>,
    {
        let start = self.parse_kind(start_kind)?;
        let mut items = vec![];
        while !self.peek_kind(end_kind) {
            items.push(parse(self)?);
        }
        let end = self.parse_kind(end_kind)?;

        let span = Span::new(start.span.start, end.span.end);
        Ok(List {
            span,
            start,
            items,
            end,
        })
    }

    /// Advance delimited items of a `List`
    /// <start> <item>* <end>
    fn advance_delimited_list<T, F>(
        &mut self,
        start_kind: TokenKind,
        end_kind: TokenKind,
        advance: F,
    ) -> ParseResult<Token>
    where
        F: Fn(&mut Self) -> ParseResult<T>,
    {
        self.advance_kind(start_kind)?;
        while !self.peek_kind(end_kind) {
            advance(self)?;
        }
        self.advance_kind(end_kind)?;

        Ok(self.current)
    }

    /// Parse delimited items into a `List`
    /// <start> <item>+ <end>
    fn parse_delimited_nonempty_list<T, F>(
        &mut self,
        start_kind: TokenKind,
        end_kind: TokenKind,
        parse: F,
    ) -> ParseResult<List<T>>
    where
        F: Fn(&mut Self) -> ParseResult<T>,
    {
        if !self.peek_kind(start_kind) {
            let error = Diagnostic::error(
                SyntaxError::Expected(start_kind),
                Location::new(
                    self.source_location,
                    Span::new(self.end_index, self.index()),
                ),
            );
            self.record_error(error);
            let token = self.empty_token();
            return Ok(List {
                span: token.span,
                start: token,
                items: vec![],
                end: token,
            });
        }
        let start = self.parse_token();
        let mut items = vec![];
        while !self.peek_kind(end_kind) {
            items.push(parse(self)?);
        }
        let end = self.parse_kind(end_kind)?;
        let span = Span::new(start.span.start, end.span.end);

        if items.is_empty() {
            self.record_error(Diagnostic::error(
                SyntaxError::ExpectedNonEmptyList,
                Location::new(self.source_location, span),
            ));
        }

        Ok(List {
            span,
            start,
            items,
            end,
        })
    }

    /// Advance to last token of delimited items
    /// <start> <item>+ <end>
    fn advance_delimited_nonempty_list<T, F>(
        &mut self,
        start_kind: TokenKind,
        end_kind: TokenKind,
        advance: F,
    ) -> ParseResult<Token>
    where
        F: Fn(&mut Self) -> ParseResult<T>,
    {
        if !self.peek_kind(start_kind) {
            let error = Diagnostic::error(
                SyntaxError::Expected(start_kind),
                Location::new(
                    self.source_location,
                    Span::new(self.end_index, self.index()),
                ),
            );
            self.record_error(error);
            return Ok(self.empty_token());
        }
        let start = self.parse_token();
        let mut has_items = false;
        while !self.peek_kind(end_kind) {
            has_items = true;
            advance(self)?;
        }
        let end = self.advance_kind(end_kind)?;
        let span = Span::new(start.span.start, end.span.end);

        if !has_items {
            self.record_error(Diagnostic::error(
                SyntaxError::ExpectedNonEmptyList,
                Location::new(self.source_location, span),
            ));
        }

        Ok(end)
    }

    /// (<start> <item>+ <end>)?
    fn parse_optional_delimited_nonempty_list<T, F>(
        &mut self,
        start_kind: TokenKind,
        end_kind: TokenKind,
        parse: F,
    ) -> ParseResult<Option<List<T>>>
    where
        F: Fn(&mut Self) -> ParseResult<T>,
    {
        if self.peek_token_kind() == start_kind {
            Ok(Some(self.parse_delimited_nonempty_list(
                start_kind, end_kind, parse,
            )?))
        } else {
            Ok(None)
        }
    }

    /// (<start> <item>+ <end>)?
    fn advance_optional_delimited_nonempty_list<T, F>(
        &mut self,
        start_kind: TokenKind,
        end_kind: TokenKind,
        parse: F,
    ) -> ParseResult<Token>
    where
        F: Fn(&mut Self) -> ParseResult<T>,
    {
        if self.peek_token_kind() == start_kind {
            self.advance_delimited_nonempty_list(start_kind, end_kind, parse)
        } else {
            Ok(self.current)
        }
    }

    /// A &str for the source of the inner span of the given token.
    fn source(&self, token: &Token) -> &str {
        let (raw_start, raw_end) = token.span.as_usize();
        let start = raw_start - self.offset as usize;
        let end = raw_end - self.offset as usize;

        &self.source[start..end]
    }

    /// Peek at the next token
    fn peek(&self) -> &Token {
        &self.current
    }

    /// Return true if the next token has the expected kind
    fn peek_kind(&self, expected: TokenKind) -> bool {
        self.peek_token_kind() == expected
    }

    /// Peek at the kind of the next token
    fn peek_token_kind(&self) -> TokenKind {
        self.current.kind
    }

    /// Parse the next token, succeeding if it has the expected kind and failing
    /// otherwise.
    fn parse_kind(&mut self, expected: TokenKind) -> ParseResult<Token> {
        let start = self.index();
        let token = self.parse_token();
        if token.kind == expected {
            Ok(token)
        } else {
            let error = Diagnostic::error(
                SyntaxError::Expected(expected),
                Location::new(self.source_location, Span::new(start, self.end_index)),
            );
            self.record_error(error);
            Err(())
        }
    }

    fn advance_kind(&mut self, expected: TokenKind) -> ParseResult<Token> {
        self.parse_kind(expected)
    }

    /// Parse the next token if it has the expected kind.
    fn parse_optional_kind(&mut self, expected: TokenKind) -> Option<Token> {
        if self.peek_kind(expected) {
            Some(self.parse_token())
        } else {
            None
        }
    }

    fn advance_optional_kind(&mut self, expected: TokenKind) -> Option<Token> {
        if self.peek_kind(expected) {
            Some(self.advance_token())
        } else {
            None
        }
    }

    /// Return true if the current token is an Identifier matching the given keyword.
    fn peek_keyword(&self, expected: &'static str) -> bool {
        self.peek_kind(TokenKind::Identifier) && self.source(self.peek()) == expected
    }

    /// Parse the next token, succeeding if it is an Identifier that matches the
    /// given keyword
    fn parse_keyword(&mut self, expected: &'static str) -> ParseResult<Token> {
        let token = self.parse_kind(TokenKind::Identifier)?;
        if self.source(&token) == expected {
            Ok(token)
        } else {
            let error = Diagnostic::error(
                SyntaxError::ExpectedKeyword(expected),
                Location::new(self.source_location, token.span),
            );
            self.record_error(error);
            Err(())
        }
    }

    fn advance_keyword(&mut self, expected: &'static str) -> ParseResult<Token> {
        self.parse_keyword(expected)
    }

    /// Get the byte offset of the *start* of the current token
    fn index(&self) -> u32 {
        self.current.span.start
    }

    /// Get the next token (and advance)
    fn parse_token(&mut self) -> Token {
        // Skip over (and record) any invalid tokens until either a valid token or an EOF is encountered
        loop {
            let kind = self.lexer.next().unwrap_or(Ok(TokenKind::EndOfFile));
            match kind {
                Err(_) => {
                    if let Some(error_token_kind) = self.lexer.extras.error_token {
                        // Reset the error token
                        self.lexer.extras.error_token = None;
                        // If error_token is set, return that error token
                        // instead of a generic error.
                        self.end_index = self.current.span.end;
                        let span = self.lexer_span();
                        return std::mem::replace(
                            &mut self.current,
                            Token {
                                kind: error_token_kind,
                                span,
                            },
                        );
                    } else {
                        // Record and skip over unknown character errors
                        let error = Diagnostic::error(
                            SyntaxError::UnsupportedCharacter,
                            Location::new(self.source_location, self.lexer_span()),
                        );
                        self.record_error(error);
                    }
                }
                Ok(kind) => {
                    self.end_index = self.current.span.end;
                    let span = self.lexer_span();
                    return std::mem::replace(&mut self.current, Token { kind, span });
                }
            }
        }
    }

    fn advance_token(&mut self) -> Token {
        self.parse_token()
    }

    fn lexer_span(&self) -> Span {
        let span: Span = self.lexer.span().into();
        span.with_offset(self.offset)
    }

    fn record_error(&mut self, error: Diagnostic) {
        // NOTE: Useful for debugging parse errors:
        // panic!("{:?}", error);
        self.errors.push(error);
    }

    /// Returns an empty token with a span at the end of last token
    fn empty_token(&self) -> Token {
        let index = self.end_index;
        Token {
            span: Span::new(index, index),
            kind: TokenKind::Empty,
        }
    }

    fn empty_identifier(&self) -> Identifier {
        let token = self.empty_token();
        Identifier {
            span: token.span,
            token,
            value: "".intern(),
        }
    }
}

// https://spec.graphql.org/June2018/#sec-String-Value
fn clean_block_string_literal(source: &str) -> String {
    let inner = &source[3..source.len() - 3];
    let common_indent = get_common_indent(inner);

    let mut formatted_lines = inner
        .lines()
        .enumerate()
        .map(|(i, line)| {
            if i == 0 {
                line.to_string()
            } else {
                line.chars().skip(common_indent).collect::<String>()
            }
        })
        .collect::<VecDeque<String>>();

    while formatted_lines
        .front()
        .is_some_and(|line| line_is_whitespace(line))
    {
        formatted_lines.pop_front();
    }
    while formatted_lines
        .back()
        .is_some_and(|line| line_is_whitespace(line))
    {
        formatted_lines.pop_back();
    }

    let lines_vec: Vec<String> = formatted_lines.into_iter().collect();
    lines_vec.join("\n")
}

fn get_common_indent(source: &str) -> usize {
    let lines = source.lines().skip(1);
    let mut common_indent: Option<usize> = None;
    for line in lines {
        if let Some((first_index, _)) = line.match_indices(is_not_whitespace).next()
            && common_indent.is_none_or(|indent| first_index < indent)
        {
            common_indent = Some(first_index)
        }
    }
    common_indent.unwrap_or(0)
}

fn line_is_whitespace(line: &str) -> bool {
    !line.contains(is_not_whitespace)
}

// https://spec.graphql.org/June2018/#sec-White-Space
fn is_not_whitespace(c: char) -> bool {
    c != ' ' && c != '\t'
}

#[cfg(test)]
mod tests {
    use super::*;

    fn triple_quote(inner: &str) -> String {
        format!("\"\"\"{inner}\"\"\"")
    }

    #[test]
    fn common_indent_ignores_first_line() {
        let actual = get_common_indent("            1\n  2\n  3");
        assert_eq!(actual, 2);
    }
    #[test]
    fn common_indent_uses_smallest_indent() {
        let actual = get_common_indent("1\n  2\n        3");
        assert_eq!(actual, 2);
    }

    #[test]
    fn common_indent_ignores_lines_that_are_all_whitespace() {
        let actual = get_common_indent("1\n    2\n \t\n    3\n");
        assert_eq!(actual, 4);
    }

    #[test]
    fn common_indent_ignores_lines_blank_lines() {
        let actual = get_common_indent("1\n    2\n\n    3\n");
        assert_eq!(actual, 4);
    }

    #[test]
    fn clean_block_string_literal_does_not_trim_leading_whitespace() {
        let actual = clean_block_string_literal(&triple_quote("       Hello world!"));
        assert_eq!(actual, "       Hello world!");
    }

    #[test]
    fn clean_block_string_literal_trims_leading_whitespace_lines() {
        let actual = clean_block_string_literal(&triple_quote("       \n\t\t\t\nHello world!"));
        assert_eq!(actual, "Hello world!");
    }

    #[test]
    fn clean_block_string_literal_trims_trailing_whitespace_lines() {
        let actual = clean_block_string_literal(&triple_quote("Hello world!\n    \n\t\t   \n"));
        assert_eq!(actual, "Hello world!");
    }

    #[test]
    fn clean_block_string_literal_trims_trailing_empty_lines() {
        let actual = clean_block_string_literal(&triple_quote("Hello world!\n\n\n\n\n"));
        assert_eq!(actual, "Hello world!");
    }

    #[test]
    fn clean_block_string_literal_dedents_smallest_common_indent() {
        let actual = clean_block_string_literal(&triple_quote(
            "Hello world!\n  Two Char Indent\n    Four Char Indent",
        ));
        assert_eq!(actual, "Hello world!\nTwo Char Indent\n  Four Char Indent");
    }

    #[test]
    fn clean_block_string_literal_ignores_first_line_indent() {
        let actual = clean_block_string_literal(&triple_quote(
            "        Hello world!\n  Two Char Indent\n    Four Char Indent",
        ));
        assert_eq!(
            actual,
            "        Hello world!\nTwo Char Indent\n  Four Char Indent"
        );
    }

    #[test]
    fn clean_block_string_literal_treats_tab_and_space_as_equal() {
        let actual = clean_block_string_literal(&triple_quote(
            "Hello world!\n\t\tTwo Tab Indent\n    Four Space Indent",
        ));
        assert_eq!(actual, "Hello world!\nTwo Tab Indent\n  Four Space Indent");
    }
}
