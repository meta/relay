/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

use std::io;
use std::path::Path;
use std::process::Stdio;

use async_trait::async_trait;
use persist_query::PersistError;
use relay_config::ProcessPersistConfig;
use serde::Deserialize;
use serde::Serialize;
use tokio::io::AsyncBufReadExt;
use tokio::io::AsyncRead;
use tokio::io::AsyncWrite;
use tokio::io::AsyncWriteExt;
use tokio::io::BufReader;
use tokio::process::Child;
use tokio::process::Command;
use tokio::sync::Mutex;

use crate::OperationPersister;
use crate::config::ArtifactForPersister;
use crate::config::PersistId;
use crate::config::PersistResult;

/// A persister backed by one long-lived child process using a JSONL protocol.
pub struct ProcessPersister {
    config: ProcessPersistConfig,
    state: Mutex<ProcessState>,
}

enum ProcessState {
    NotStarted,
    Running(Box<ProcessConnection>),
    Failed(String),
    Finalized,
}

struct ProcessConnection {
    child: Option<Child>,
    input: Box<dyn AsyncWrite + Send + Unpin>,
    output: BufReader<Box<dyn AsyncRead + Send + Unpin>>,
}

#[derive(Serialize)]
#[serde(tag = "type")]
enum ProcessRequest<'a> {
    #[serde(rename = "persist")]
    Persist {
        text: &'a str,
        #[serde(rename = "relativePath")]
        relative_path: &'a Path,
        #[serde(rename = "overrideSchema")]
        override_schema: Option<&'a str>,
        #[serde(rename = "previousId")]
        previous_id: Option<&'a str>,
        #[serde(rename = "schemaText", skip_serializing_if = "Option::is_none")]
        schema_text: Option<&'a str>,
    },
    #[serde(rename = "finalize")]
    Finalize,
}

#[derive(Debug, Deserialize)]
#[serde(tag = "type", deny_unknown_fields)]
enum ProcessResponse {
    #[serde(rename = "persisted")]
    Persisted { id: String },
    #[serde(rename = "finalized")]
    Finalized,
}

impl ProcessPersister {
    pub fn new(config: ProcessPersistConfig) -> Self {
        Self {
            config,
            state: Mutex::new(ProcessState::NotStarted),
        }
    }

    fn start_if_needed(&self, state: &mut ProcessState) -> PersistResult<()> {
        if !matches!(state, ProcessState::NotStarted) {
            return Ok(());
        }

        match ProcessConnection::spawn(&self.config) {
            Ok(connection) => {
                *state = ProcessState::Running(Box::new(connection));
                Ok(())
            }
            Err(error) => {
                let message = format!(
                    "Unable to start persist process `{}`: {error}",
                    self.config.command.display()
                );
                *state = ProcessState::Failed(message.clone());
                Err(PersistError::ErrorResponse { message })
            }
        }
    }

    fn connection<'a>(
        &self,
        state: &'a mut ProcessState,
    ) -> PersistResult<&'a mut ProcessConnection> {
        self.start_if_needed(state)?;
        match state {
            ProcessState::Running(connection) => Ok(connection),
            ProcessState::Failed(message) => Err(PersistError::ErrorResponse {
                message: message.clone(),
            }),
            ProcessState::Finalized => Err(PersistError::ErrorResponse {
                message: "Persist process was used after finalization".to_owned(),
            }),
            ProcessState::NotStarted => {
                unreachable!("start_if_needed transitions the process state")
            }
        }
    }

    #[cfg(test)]
    fn with_io(
        input: impl AsyncWrite + Send + Unpin + 'static,
        output: impl AsyncRead + Send + Unpin + 'static,
    ) -> Self {
        Self {
            config: ProcessPersistConfig {
                command: "unused-in-test".into(),
                args: Vec::new(),
                include_query_text: false,
                include_schema_text: false,
            },
            state: Mutex::new(ProcessState::Running(Box::new(ProcessConnection {
                child: None,
                input: Box::new(input),
                output: BufReader::new(Box::new(output)),
            }))),
        }
    }
}

impl ProcessConnection {
    fn spawn(config: &ProcessPersistConfig) -> io::Result<Self> {
        let mut child = Command::new(&config.command)
            .args(&config.args)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::inherit())
            .kill_on_drop(true)
            .spawn()?;
        let input = child
            .stdin
            .take()
            .ok_or_else(|| io::Error::other("persist process stdin was not piped"))?;
        let output = child
            .stdout
            .take()
            .ok_or_else(|| io::Error::other("persist process stdout was not piped"))?;

        Ok(Self {
            child: Some(child),
            input: Box::new(input),
            output: BufReader::new(Box::new(output)),
        })
    }

    async fn exchange(&mut self, request: &ProcessRequest<'_>) -> PersistResult<ProcessResponse> {
        let mut request = serde_json::to_vec(request)?;
        request.push(b'\n');
        self.input.write_all(&request).await?;
        self.input.flush().await?;

        let mut response = String::new();
        if self.output.read_line(&mut response).await? == 0 {
            return Err(PersistError::ErrorResponse {
                message: "Persist process closed stdout before sending a response".to_owned(),
            });
        }

        serde_json::from_str(&response).map_err(|source| PersistError::DetailedResponseParseError {
            source,
            raw_response: response,
        })
    }

    async fn stop(&mut self) -> io::Result<()> {
        self.input.shutdown().await?;
        if let Some(mut child) = self.child.take()
            && child.try_wait()?.is_none()
        {
            child.kill().await?;
        }
        Ok(())
    }
}

impl Drop for ProcessConnection {
    fn drop(&mut self) {
        if let Some(child) = &mut self.child {
            let _ = child.start_kill();
        }
    }
}

#[async_trait]
impl OperationPersister for ProcessPersister {
    async fn persist_artifact(&self, artifact: ArtifactForPersister) -> PersistResult<PersistId> {
        self.persist_artifact_with_previous_id(artifact, None).await
    }

    async fn persist_artifact_with_previous_id(
        &self,
        artifact: ArtifactForPersister,
        previous_id: Option<PersistId>,
    ) -> PersistResult<PersistId> {
        let schema_text = if self.config.include_schema_text {
            let text = artifact.schema_text.as_ref().ok_or_else(|| PersistError::ErrorResponse {
                message: "`persistConfig.includeSchemaText` is set, but this project produced no schema text to send as `schemaText`. Use `schema` or `schemaDir` instead of `schemaCompact`.".to_owned(),
            })?;
            Some(text.as_str())
        } else {
            None
        };

        let mut state = self.state.lock().await;
        let response = self
            .connection(&mut state)?
            .exchange(&ProcessRequest::Persist {
                text: &artifact.text,
                relative_path: &artifact.relative_path,
                override_schema: artifact.override_schema.as_deref(),
                previous_id: previous_id.as_deref(),
                schema_text,
            })
            .await?;

        match response {
            ProcessResponse::Persisted { id } => Ok(id),
            ProcessResponse::Finalized => Err(PersistError::ErrorResponse {
                message: "Persist process returned `finalized` for a `persist` request".to_owned(),
            }),
        }
    }

    async fn finalize(&self) -> PersistResult<()> {
        let mut state = self.state.lock().await;
        if matches!(*state, ProcessState::Finalized) {
            return Ok(());
        }

        let response = self
            .connection(&mut state)?
            .exchange(&ProcessRequest::Finalize)
            .await?;
        if !matches!(response, ProcessResponse::Finalized) {
            return Err(PersistError::ErrorResponse {
                message: "Persist process returned `persisted` for a `finalize` request".to_owned(),
            });
        }

        if let ProcessState::Running(mut connection) =
            std::mem::replace(&mut *state, ProcessState::Finalized)
        {
            connection.stop().await?;
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use std::path::PathBuf;
    use std::sync::Arc;

    use serde_json::Value;
    use tokio::io::AsyncBufReadExt;
    use tokio::io::AsyncWriteExt;
    use tokio::io::BufReader;
    use tokio::io::duplex;
    use tokio::io::split;

    use super::*;

    fn artifact() -> ArtifactForPersister {
        ArtifactForPersister {
            text: "query TestQuery { me { id } }".to_owned(),
            relative_path: PathBuf::from("src/__generated__/TestQuery.graphql.js"),
            override_schema: Some("test-schema".to_owned()),
            schema_text: Some(Arc::new("type Query { me: User }".to_owned())),
        }
    }

    #[tokio::test]
    async fn sends_previous_id_and_finalizes_over_one_connection() {
        assert_process_exchange(false).await;
    }

    #[tokio::test]
    async fn sends_schema_text_only_when_requested() {
        assert_process_exchange(true).await;
    }

    async fn assert_process_exchange(include_schema_text: bool) {
        let (client, worker) = duplex(4096);
        let (client_output, client_input) = split(client);
        let (worker_input, worker_output) = split(worker);
        let mut persister = ProcessPersister::with_io(client_input, client_output);
        persister.config.include_schema_text = include_schema_text;

        let worker = tokio::spawn(async move {
            let mut input = BufReader::new(worker_input);
            let mut output = worker_output;
            let mut line = String::new();

            input
                .read_line(&mut line)
                .await
                .expect("read persist request");
            let request: Value = serde_json::from_str(&line).expect("valid persist request");
            let mut expected = serde_json::json!({
                "type": "persist",
                "text": "query TestQuery { me { id } }",
                "relativePath": "src/__generated__/TestQuery.graphql.js",
                "overrideSchema": "test-schema",
                "previousId": "cached-id"
            });
            if include_schema_text {
                expected["schemaText"] = serde_json::json!("type Query { me: User }");
            }
            assert_eq!(request, expected);
            output
                .write_all(b"{\"type\":\"persisted\",\"id\":\"worker-id\"}\n")
                .await
                .expect("write persisted response");

            line.clear();
            input
                .read_line(&mut line)
                .await
                .expect("read finalize request");
            assert_eq!(
                serde_json::from_str::<Value>(&line).expect("valid finalize request"),
                serde_json::json!({"type": "finalize"})
            );
            output
                .write_all(b"{\"type\":\"finalized\"}\n")
                .await
                .expect("write finalized response");
        });

        let id = persister
            .persist_artifact_with_previous_id(artifact(), Some("cached-id".to_owned()))
            .await
            .expect("persist succeeds");
        assert_eq!(id, "worker-id");
        persister.finalize().await.expect("finalize succeeds");
        worker.await.expect("worker succeeds");
    }

    #[tokio::test]
    async fn rejects_missing_schema_text_before_starting_worker() {
        let persister = ProcessPersister::new(ProcessPersistConfig {
            command: "unused-in-test".into(),
            args: Vec::new(),
            include_query_text: false,
            include_schema_text: true,
        });
        let mut artifact = artifact();
        artifact.schema_text = None;

        let error = persister
            .persist_artifact(artifact)
            .await
            .expect_err("missing server SDL must fail");
        assert!(error.to_string().contains("schemaCompact"));
        assert!(matches!(
            *persister.state.lock().await,
            ProcessState::NotStarted
        ));
    }

    #[tokio::test]
    async fn rejects_an_unexpected_response_type() {
        let (client, worker) = duplex(1024);
        let (client_output, client_input) = split(client);
        let (worker_input, mut worker_output) = split(worker);
        let persister = ProcessPersister::with_io(client_input, client_output);

        let worker = tokio::spawn(async move {
            let mut line = String::new();
            BufReader::new(worker_input)
                .read_line(&mut line)
                .await
                .expect("read request");
            worker_output
                .write_all(b"{\"type\":\"finalized\"}\n")
                .await
                .expect("write response");
        });

        let error = persister
            .persist_artifact(artifact())
            .await
            .expect_err("wrong response type must fail");
        assert!(
            error.to_string().contains("returned `finalized`"),
            "unexpected error: {error}"
        );
        worker.await.expect("worker succeeds");
    }

    #[tokio::test]
    async fn reports_malformed_output() {
        let (client, worker) = duplex(1024);
        let (client_output, client_input) = split(client);
        let (worker_input, mut worker_output) = split(worker);
        let persister = ProcessPersister::with_io(client_input, client_output);

        let worker = tokio::spawn(async move {
            let mut line = String::new();
            BufReader::new(worker_input)
                .read_line(&mut line)
                .await
                .expect("read request");
            worker_output
                .write_all(b"not json\n")
                .await
                .expect("write response");
        });

        let error = persister
            .persist_artifact(artifact())
            .await
            .expect_err("malformed output must fail");
        assert!(
            error.to_string().contains("Raw response: not json"),
            "unexpected error: {error}"
        );
        worker.await.expect("worker succeeds");
    }

    #[tokio::test]
    async fn reports_eof_before_response() {
        let (client, worker) = duplex(1024);
        let (client_output, client_input) = split(client);
        let (worker_input, worker_output) = split(worker);
        let persister = ProcessPersister::with_io(client_input, client_output);

        let worker = tokio::spawn(async move {
            let mut line = String::new();
            BufReader::new(worker_input)
                .read_line(&mut line)
                .await
                .expect("read request");
            drop(worker_output);
        });

        let error = persister
            .persist_artifact(artifact())
            .await
            .expect_err("EOF must fail");
        assert!(
            error.to_string().contains("closed stdout"),
            "unexpected error: {error}"
        );
        worker.await.expect("worker succeeds");
    }
}
