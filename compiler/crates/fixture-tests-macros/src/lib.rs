/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

#![deny(warnings)]
#![deny(rust_2018_idioms)]
#![deny(clippy::all)]

//! The `fixture_tests!` macro, re-exported by the `fixture-tests` crate.

use std::collections::BTreeMap;
use std::fs;
use std::io;
use std::path::Path;
use std::path::PathBuf;

use proc_macro::Span;
use proc_macro::TokenStream;
use proc_macro::TokenTree;
use thiserror::Error;

const EXPECTED_EXTENSION: &str = "expected";

/// Expands to one `#[tokio::test]` per fixture in `<name>/fixtures`, a
/// directory next to the file that invokes the macro. Each test passes its
/// fixture to the `transform_fixture` function in scope and compares the
/// result with the fixture's `.expected` snapshot.
///
/// ```ignore
/// mod uppercase;
///
/// use uppercase::transform_fixture;
///
/// fixture_tests::fixture_tests!("uppercase");
/// ```
///
/// A fixture `foo.<ext>` is paired with `foo.expected`, and `foo.invalid.<ext>`
/// with `foo.invalid.expected`. A fixture without a snapshot gets a test that
/// fails until it is run with `UPDATE_SNAPSHOTS=1`, which writes the snapshot.
#[proc_macro]
pub fn fixture_tests(input: TokenStream) -> TokenStream {
    let code = match expand(input) {
        Ok(code) => code,
        Err(error) => format!("compile_error!({:?});", format!("fixture_tests!: {error}")),
    };
    code.parse()
        .expect("should generate valid Rust: the code is built from escaped string literals and sanitized identifiers")
}

#[derive(Debug, Error)]
enum FixtureTestsError {
    #[error(
        "expected one string literal: the name of the directory that holds `fixtures/`, next to the invoking file"
    )]
    Usage,
    #[error("cannot locate the file that invokes the macro ({file})")]
    InvokingFile { file: String },
    #[error("cannot read {dir}: {error}")]
    ReadDir { dir: PathBuf, error: io::Error },
    #[error("non-UTF-8 fixture file name {path}")]
    NonUtf8FileName { path: PathBuf },
    #[error(
        "conflicting fixture names {previous} and {file_name} in {dir}: both are test {test_name}"
    )]
    ConflictingNames {
        previous: String,
        file_name: String,
        test_name: String,
        dir: PathBuf,
    },
    #[error("{dir} has a snapshot but no input for test {test_name}")]
    MissingInput { test_name: String, dir: PathBuf },
    #[error(
        "fixture {file_name} in {dir} gives test name {test_name}, which is not a Rust identifier: rename the fixture to start with a letter or `_`"
    )]
    InvalidTestName {
        test_name: String,
        file_name: String,
        dir: PathBuf,
    },
}

struct TestCase {
    /// The file name without its last extension, shared by an input and its snapshot.
    stem: String,
    /// The first file name seen for this test, to name a conflict.
    first_file: String,
    input: Option<String>,
    expected: Option<String>,
}

fn expand(input: TokenStream) -> Result<String, FixtureTestsError> {
    let name = parse_name(input)?;
    let dir = invoking_file_dir()?.join(&name).join("fixtures");
    let test_cases = read_test_cases(&dir)?;
    test_cases
        .into_iter()
        .map(|(test_name, test_case)| {
            let input = test_case
                .input
                .ok_or_else(|| FixtureTestsError::MissingInput {
                    test_name: test_name.clone(),
                    dir: dir.clone(),
                })?;
            Ok(test_code(
                &name,
                &test_name,
                &input,
                test_case.expected.as_deref(),
            ))
        })
        .collect()
}

fn parse_name(input: TokenStream) -> Result<String, FixtureTestsError> {
    let mut tokens = input.into_iter();
    let (Some(TokenTree::Literal(literal)), None) = (tokens.next(), tokens.next()) else {
        return Err(FixtureTestsError::Usage);
    };
    let literal = literal.to_string();
    let Some(name) = literal
        .strip_prefix('"')
        .and_then(|rest| rest.strip_suffix('"'))
    else {
        return Err(FixtureTestsError::Usage);
    };
    if name.is_empty() || name.contains(['\\', '"']) {
        return Err(FixtureTestsError::Usage);
    }
    Ok(name.to_string())
}

/// The directory of the file that invokes the macro, as rustc reads it.
fn invoking_file_dir() -> Result<PathBuf, FixtureTestsError> {
    let span = Span::call_site();
    let file = span
        .local_file()
        .or_else(|| Some(PathBuf::from(span.file())).filter(|file| file.is_file()))
        .ok_or_else(|| FixtureTestsError::InvokingFile { file: span.file() })?;
    Ok(file.parent().map(Path::to_path_buf).unwrap_or_default())
}

/// The fixtures in `dir`, by test name: every file with an extension, each
/// `.expected` file paired with the input of the same stem.
fn read_test_cases(dir: &Path) -> Result<BTreeMap<String, TestCase>, FixtureTestsError> {
    let read_dir_error = |error| FixtureTestsError::ReadDir {
        dir: dir.to_path_buf(),
        error,
    };
    let mut test_cases: BTreeMap<String, TestCase> = BTreeMap::new();
    for entry in fs::read_dir(dir).map_err(read_dir_error)? {
        let path = entry.map_err(read_dir_error)?.path();
        // Build systems may present sources as symlinks: follow them.
        let Some(extension) = path.extension() else {
            continue;
        };
        if !fs::metadata(&path).is_ok_and(|metadata| metadata.is_file()) {
            continue;
        }
        let (Some(file_name), Some(stem)) = (
            path.file_name().and_then(|file_name| file_name.to_str()),
            path.file_stem().and_then(|stem| stem.to_str()),
        ) else {
            return Err(FixtureTestsError::NonUtf8FileName { path });
        };
        let test_name = sanitize_identifier(stem);
        if !is_identifier(&test_name) {
            return Err(FixtureTestsError::InvalidTestName {
                test_name,
                file_name: file_name.to_string(),
                dir: dir.to_path_buf(),
            });
        }
        let test_case = test_cases
            .entry(test_name.clone())
            .or_insert_with(|| TestCase {
                stem: stem.to_string(),
                first_file: file_name.to_string(),
                input: None,
                expected: None,
            });
        let conflict = |previous: &str| FixtureTestsError::ConflictingNames {
            previous: previous.to_string(),
            file_name: file_name.to_string(),
            test_name: test_name.clone(),
            dir: dir.to_path_buf(),
        };
        // Files whose stems differ only in characters the test name drops
        // (`a.b.input`, `a-b.expected`) would otherwise become one test with
        // an unrelated snapshot.
        if test_case.stem != stem {
            return Err(conflict(&test_case.first_file));
        }
        let slot = if extension == EXPECTED_EXTENSION {
            &mut test_case.expected
        } else {
            &mut test_case.input
        };
        if let Some(previous) = slot.replace(file_name.to_string()) {
            return Err(conflict(&previous));
        }
    }
    Ok(test_cases)
}

fn test_code(name: &str, test_name: &str, input: &str, expected: Option<&str>) -> String {
    let input_path = format!("{name}/fixtures/{input}");
    let expected_file = expected.map_or_else(
        || {
            Path::new(input)
                .with_extension(EXPECTED_EXTENSION)
                .to_string_lossy()
                .into_owned()
        },
        str::to_string,
    );
    let expected_path = format!("{name}/fixtures/{expected_file}");
    let expected_content = match expected {
        Some(_) => format!("include_str!({expected_path:?})"),
        None => "\"\"".to_string(),
    };
    format!(
        "#[::tokio::test]
async fn {test_name}() {{
    let input = include_str!({input_path:?});
    let expected = {expected_content};
    ::fixture_tests::test_fixture(transform_fixture, file!(), {input:?}, {expected_path:?}, input, expected).await;
}}
"
    )
}

/// Whether a sanitized test name can be a function name: not empty, not
/// starting with a digit, and not a lone `_`.
fn is_identifier(name: &str) -> bool {
    name.chars()
        .next()
        .is_some_and(|first| !first.is_ascii_digit())
        && name != "_"
}

fn sanitize_identifier(input: &str) -> String {
    input
        .chars()
        .map(|chr| match chr {
            'a'..='z' | '0'..='9' | '_' => chr,
            'A'..='Z' => chr.to_ascii_lowercase(),
            _ => '_',
        })
        .collect()
}
