/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

use std::sync::Arc;

use common::FeatureFlag;
use common::SourceLocationKey;
use fixture_tests::Fixture;
use graphql_ir::Program;
use graphql_ir::build;
use graphql_syntax::parse_executable;
use graphql_text_printer::PrinterOptions;
use graphql_text_printer::print_fragment;
use graphql_text_printer::print_operation;
use relay_schema::client_implementors::mark_client_implementors;
use relay_test_schema::get_test_schema_with_extensions;
use relay_transforms::client_extensions_abstract_types;

pub async fn transform_fixture(fixture: &Fixture<'_>) -> Result<String, String> {
    let parts: Vec<_> = fixture.content.split("%extensions%").collect();
    if let [base, extensions] = parts.as_slice() {
        let source_location = SourceLocationKey::standalone(fixture.file_name);
        let ast = parse_executable(base, source_location).unwrap();
        let mut schema = Arc::try_unwrap(get_test_schema_with_extensions(extensions))
            .expect("Expected a schema no one else holds");
        mark_client_implementors(&mut schema, &FeatureFlag::Enabled).unwrap();
        let schema = Arc::new(schema);
        let ir = build(&schema, &ast.definitions).unwrap();
        let program = Program::from_definitions(Arc::clone(&schema), ir);
        let next_program = client_extensions_abstract_types(&program);

        let printer_options = PrinterOptions {
            debug_directive_data: true,
            ..Default::default()
        };

        let mut printed = next_program
            .operations()
            .map(|def| print_operation(&schema, def, printer_options.clone()))
            .chain(
                next_program
                    .fragments()
                    .map(|def| print_fragment(&schema, def, printer_options.clone())),
            )
            .collect::<Vec<_>>();
        printed.sort();
        Ok(printed.join("\n\n"))
    } else {
        panic!("Expected exactly one %extensions% section marker.")
    }
}
