/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

use thiserror::Error;

#[derive(Debug, Error)]
pub enum Error {
    #[error("Unable to filter projects. Error details: \n{details}")]
    ProjectFilterError { details: String },

    #[error("Unable to run the relay language server. Error details: \n{details}")]
    LSPError { details: String },

    #[error("{0}")]
    ConfigError(relay_compiler::errors::Error),

    #[error(
        "{source}\n\nHint: You can dump the config JSON schema with:\n  relay-compiler config-json-schema\n\nFor documentation, see:\n  https://relay.dev/docs/getting-started/compiler-config/"
    )]
    ConfigErrorWithHint { source: Box<Error> },

    #[error("Unable to run relay compiler. Error details: \n{details}")]
    CompilerError { details: String },

    #[error("Unable to run relay codemod. Error details: \n{details}")]
    CodemodError { details: String },

    #[cfg(unix)]
    #[error("Daemon command failed")]
    DaemonCommandFailed,
}
