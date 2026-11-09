/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

use common::Diagnostic;
use common::DiagnosticsResult;
use common::NamedItem;
use common::WithLocation;
use errors::validate;
use graphql_ir::Directive;
use graphql_ir::FragmentSpread;
use graphql_ir::InlineFragment;
use graphql_ir::LinkedField;
use graphql_ir::Program;
use graphql_ir::ScalarField;
use graphql_ir::ValidationMessage;
use graphql_ir::Validator;
use graphql_ir::alias_arg_as;
use intern::Lookup;
use intern::string_key::StringKey;

use crate::fragment_alias_directive::FRAGMENT_ALIAS_DIRECTIVE_NAME;

pub fn validate_no_double_underscore_alias(program: &Program) -> DiagnosticsResult<()> {
    let mut validator = ValidateNoDoubleUnderscoreAlias {};
    validator.validate_program(program)
}

struct ValidateNoDoubleUnderscoreAlias {}

impl Validator for ValidateNoDoubleUnderscoreAlias {
    const NAME: &'static str = "ValidateNoDoubleUnderscoreAlias";
    const VALIDATE_ARGUMENTS: bool = false;
    const VALIDATE_DIRECTIVES: bool = false;

    fn validate_linked_field(&mut self, field: &LinkedField) -> DiagnosticsResult<()> {
        validate!(
            if let Some(alias) = field.alias {
                validate_field_alias(&alias).map_err(|x| vec![x])
            } else {
                Ok(())
            },
            self.validate_selections(&field.selections)
        )
    }

    fn validate_scalar_field(&mut self, field: &ScalarField) -> DiagnosticsResult<()> {
        if let Some(alias) = field.alias {
            validate_field_alias(&alias).map_err(|x| vec![x])
        } else {
            Ok(())
        }
    }

    fn validate_fragment_spread(&mut self, spread: &FragmentSpread) -> DiagnosticsResult<()> {
        validate_fragment_alias(&spread.directives)
    }

    fn validate_inline_fragment(&mut self, fragment: &InlineFragment) -> DiagnosticsResult<()> {
        validate!(
            validate_fragment_alias(&fragment.directives),
            self.validate_selections(&fragment.selections)
        )
    }
}

// `@alias(as: "...")` names a key in the Reader's data, like a field alias.
fn validate_fragment_alias(directives: &[Directive]) -> DiagnosticsResult<()> {
    match directives
        .named(*FRAGMENT_ALIAS_DIRECTIVE_NAME)
        .map(alias_arg_as)
    {
        Some(Ok(Some(alias))) => validate_field_alias(&alias).map_err(|x| vec![x]),
        _ => Ok(()),
    }
}

fn validate_field_alias(alias: &WithLocation<StringKey>) -> Result<(), Diagnostic> {
    if alias.item.lookup().starts_with("__") {
        return Err(Diagnostic::error(
            ValidationMessage::NoDoubleUnderscoreAlias,
            alias.location,
        ));
    }
    Ok(())
}
