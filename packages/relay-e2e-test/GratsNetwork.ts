/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Network, Observable, GraphQLResponse } from "relay-runtime";
import type { RelayObservable } from "relay-runtime/lib/network/RelayObservable";
import type {
  AsyncExecutionResult,
  ExecutionResult,
  GraphQLSchemaConfig,
} from "graphql";
import type { PromiseOrValue } from "graphql/jsutils/PromiseOrValue";
import { GraphQLSchema, execute, subscribe, parse } from "graphql";
import { getSchema } from "./schema";

// The processes of a Server Component fixture (src/rsc/) execute `@defer`
// and `@stream` incrementally, which this graphql build does only for a
// schema created with `enableDeferStream` (its type declarations leave the
// option out). They pass payloads on as JSON, as a GraphQL server sends them:
// graphql-js builds result objects with null prototypes, which React Flight
// refuses to pass from a Server Component to a Client Component.
const serverComponents =
  (
    globalThis as unknown as {
      process?: { env: { [name: string]: string | undefined } };
    }
  ).process?.env.RELAY_E2E_SERVER_COMPONENTS === "1";

const executableSchema = serverComponents
  ? new GraphQLSchema({
      ...getSchema().toConfig(),
      enableDeferStream: true,
    } as GraphQLSchemaConfig)
  : getSchema();

function toPayload(value: unknown): GraphQLResponse {
  return serverComponents
    ? JSON.parse(JSON.stringify(value))
    : (value as GraphQLResponse);
}

// The async branch yields `AsyncExecutionResult`, not `ExecutionResult`: under
// incremental delivery each payload after the first is an `ExecutionPatchResult`,
// whose `data` is `unknown` rather than an object map. Narrowing this to
// `ExecutionResult` would not typecheck against what `execute`/`subscribe`
// actually return from this graphql build.
type GraphQLResult = PromiseOrValue<
  ExecutionResult | AsyncIterable<AsyncExecutionResult>
>;

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
        document: parse(request.text!),
        variableValues: variables,
      }),
    ),
  (request, variables) =>
    toObservable(
      subscribe({
        schema: executableSchema,
        document: parse(request.text!),
        variableValues: variables,
      }),
    ),
);
