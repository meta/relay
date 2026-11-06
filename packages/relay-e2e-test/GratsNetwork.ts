/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Network, Observable, GraphQLResponse } from "relay-runtime";
import type { RelayObservable } from "relay-runtime/lib/network/RelayObservable";
import type {
  ExecutionArgs,
  ExecutionResult,
  GraphQLSchemaConfig,
} from "graphql";
import type { PromiseOrValue } from "graphql/jsutils/PromiseOrValue";
import * as graphql from "graphql";
import { getSchema } from "./schema";

// The suite runs on two graphql builds (see jest.config.js). graphql 17 sends
// `@defer` and `@stream` results in GraphQL's incremental delivery format.
// This graphql 16 build sends them as label/path payloads, and executes them
// incrementally only for a schema created with `enableDeferStream` (its type
// declarations leave the option out).
const { experimentalExecuteIncrementally } = graphql as unknown as {
  experimentalExecuteIncrementally?: (
    args: ExecutionArgs,
  ) => PromiseOrValue<
    | ExecutionResult
    | { initialResult: unknown; subsequentResults: AsyncIterable<unknown> }
  >;
};

const executableSchema =
  experimentalExecuteIncrementally != null
    ? getSchema()
    : new graphql.GraphQLSchema({
        ...getSchema().toConfig(),
        enableDeferStream: true,
      } as GraphQLSchemaConfig);

// The processes of a Server Component fixture (src/rsc/) pass payloads on as
// JSON, as a GraphQL server sends them: graphql-js builds result objects with
// null prototypes, which React Flight refuses to pass from a Server Component
// to a Client Component.
const serverComponents =
  (
    globalThis as unknown as {
      process?: { env: { [name: string]: string | undefined } };
    }
  ).process?.env.RELAY_E2E_SERVER_COMPONENTS === "1";

function toPayload(value: unknown): GraphQLResponse {
  return serverComponents
    ? JSON.parse(JSON.stringify(value))
    : (value as GraphQLResponse);
}

type GraphQLResult = PromiseOrValue<ExecutionResult | AsyncIterable<unknown>>;

async function* incrementalResults(
  args: ExecutionArgs,
): AsyncIterable<unknown> {
  const result = await experimentalExecuteIncrementally!(args);
  if ("initialResult" in result) {
    yield result.initialResult;
    yield* result.subsequentResults;
  } else {
    yield result;
  }
}

function execute(args: ExecutionArgs): GraphQLResult {
  return experimentalExecuteIncrementally != null
    ? incrementalResults(args)
    : graphql.execute(args);
}

function toObservable(result: GraphQLResult): RelayObservable<GraphQLResponse> {
  return Observable.create<GraphQLResponse>((sink) => {
    (async () => {
      const resolved = await result;
      if (Symbol.asyncIterator in resolved) {
        for await (const value of resolved) {
          sink.next(toPayload(value));
        }
      } else {
        sink.next(toPayload(resolved));
      }
      sink.complete();
    })().catch((err) => sink.error(err));
  });
}

export const gratsNetwork = Network.create(
  (request, variables) =>
    toObservable(
      execute({
        schema: executableSchema,
        document: graphql.parse(request.text!),
        variableValues: variables,
      }),
    ),
  (request, variables) =>
    toObservable(
      graphql.subscribe({
        schema: executableSchema,
        document: graphql.parse(request.text!),
        variableValues: variables,
      }),
    ),
);
