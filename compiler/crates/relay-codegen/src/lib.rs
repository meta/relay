/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

#![deny(warnings)]
#![deny(rust_2018_idioms)]
#![deny(clippy::all)]

mod ast;
mod build_ast;
mod constants;
mod indentation;
pub mod printer;
mod top_level_statements;
mod utils;

pub use ast::AstBuilder;
pub use ast::JSModule;
pub use ast::Primitive;
pub use ast::QueryID;
pub use ast::RequestParameters;
pub use build_ast::CodegenBuilder;
pub use build_ast::CodegenVariant;
pub use build_ast::EXEC_TIME_RESOLVERS;
pub use build_ast::EXEC_TIME_RESOLVERS_ENABLED_ARGUMENT;
pub use build_ast::build_request_params;
pub use build_ast::is_static_storage_key_available;
pub use build_ast::resolve_module_import_name;
pub use build_ast::resolve_normalization_import;
pub use constants::CODEGEN_CONSTANTS;
pub use printer::JSONPrinter;
pub use printer::Printer;
pub use printer::print_fragment;
pub use printer::print_module_provider;
pub use printer::print_operation;
pub use printer::print_provided_variables;
pub use printer::print_request;
pub use printer::print_request_params;
pub use relay_config::JsModuleFormat;
pub use top_level_statements::TopLevelStatement;
