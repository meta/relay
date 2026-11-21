/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

use thiserror::Error;

use crate::lexer::TokenKind;

#[derive(
    Clone,
    Copy,
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
pub enum SyntaxError {
    #[error("Expected a {0}")]
    Expected(TokenKind),
    #[error("Expected a selection: field, inline fragment, or fragment spread")]
    ExpectedSelection,
    #[error("Expected a fragment, mutation, query, or subscription definition")]
    ExpectedDefinition,
    #[error("Expected a definition")]
    ExpectedExecutableDefinition,
    #[error("Expected a 'mutation', 'query', or 'subscription' keyword")]
    ExpectedOperationKind,
    #[error(
        "Expected a valid variable name after $ (alphabetic character followed by any number of alphabetic, number and _ characters)"
    )]
    ExpectedVariableIdentifier,
    #[error("Expected the keyword '{0}'")]
    ExpectedKeyword(&'static str),
    #[error("Expected a constant value (boolean, integer, float, string, null, list, or object")]
    ExpectedConstantValue,
    #[error("Expected a type annotation (e.g. '<Type>', '[Type]', 'Type!', etc)")]
    ExpectedTypeAnnotation,
    #[error(
        "Expected a value ('$example', boolean, integer, float, string, null, list, or object)"
    )]
    ExpectedValue,
    #[error("Expected a variable ('$example')")]
    ExpectedVariable,
    #[error("Expected a spread ('...')")]
    ExpectedSpread,
    #[error("Expected an argument")]
    ExpectedArgument,
    #[error("Expected the list to be non-empty")]
    ExpectedNonEmptyList,
    #[error("Invalid floating point value")]
    InvalidFloat,
    #[error("Float literal is outside the finite range of a 64-bit floating point value")]
    NonFiniteFloat,
    #[error("Invalid integer value")]
    InvalidInteger,
    #[error("Invalid number value, expected an int or float")]
    InvalidNumberLiteral,
    #[error(
        "Invalid float literal, fractional float literals require a leading 0, e.g. 0.5 instead of .5"
    )]
    InvalidFloatLiteralMissingZero,
    #[error("Invalid float value, GraphQL requires a leading zero, eg. 0.56")]
    InvalidFloatMissingZeroLiteral,
    #[error("Unsupported character")]
    UnsupportedCharacter,
    #[error("String containing an invalid character")]
    UnsupportedStringCharacter,
    #[error("Unterminated string literal (strings cannot contain unescaped line breaks)")]
    UnterminatedString,
    #[error("Unterminated block string literal")]
    UnterminatedBlockString,
}
