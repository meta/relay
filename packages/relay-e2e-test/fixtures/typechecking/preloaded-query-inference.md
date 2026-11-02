# PreloadedQuery Type Inference

`usePreloadedQuery` is declared as

```ts
function usePreloadedQuery<TQuery extends OperationType>(
    gqlQuery: GraphQLTaggedNode,
    preloadedQuery: PreloadedQuery<TQuery>,
): TQuery['response'];
```

The first argument is an opaque `GraphQLTaggedNode`, so the only place `TQuery`
can come from is the `PreloadedQuery<TQuery>` parameter. A component that takes
its query reference as a prop typed `PreloadedQuery<AppTestQuery>` — the shape
the [preloaded queries guide][guide] documents — should therefore get
`AppTestQuery$data` back without repeating the type argument at the call site.

It does not. `PreloadedQuery` is declared as a *type alias* over an anonymous
`Readonly<{...}>`, so by the time inference runs the alias has been erased and
there is no `PreloadedQuery<AppTestQuery>` reference left to match against
`PreloadedQuery<TQuery>`. Structural inference is the only route left, and
`TQuery` appears in exactly one property — `variables: VariablesOf<TQuery>` —
behind an indexed access that TypeScript cannot invert. `TQuery` is inferred as
`OperationType`, and `data` comes back as that type's `response`, which is
`unknown`.

Runtime is unaffected: the name renders, and the `wait` step below passes. Only
the typecheck sees it.

This regressed in v21 — the declarations Relay now ships were adapted from
DefinitelyTyped's `@types/react-relay`, where `PreloadedQuery` was an
`interface`. An interface is a named declaration, so a value typed
`PreloadedQuery<AppTestQuery>` stays a reference to it and inference matches the
two references directly, never needing to look inside. See
[#5361](https://github.com/facebook/relay/issues/5361) and the fix proposed in
[#5362](https://github.com/facebook/relay/pull/5362).

[guide]: https://relay.dev/docs/guided-tour/rendering/queries/#rendering-queries

## Relay Config

```json title="relay.config.json"
{
  "src": "./",
  "schema": "./schema.graphql",
  "language": "typescript"
}
```

## Server

```ts title="server.ts"
/** @gqlType */
type User = {
  /** @gqlField */
  name: string;
};

/** @gqlQueryField */
export function viewer(): User {
  return { name: "Jordan" };
}
```

## App

```tsx title="App.tsx"
import { Suspense } from "react";
import {
  PreloadedQuery,
  RelayEnvironmentProvider,
  usePreloadedQuery,
  useQueryLoader,
} from "react-relay";
import { graphql, Environment } from "relay-runtime";
import { gratsNetwork } from "../GratsNetwork";
import { AppTestQuery } from "./__generated__/AppTestQuery.graphql";

const testEnvironment = new Environment({ network: gratsNetwork });

const query = graphql`
  query AppTestQuery {
    viewer {
      name
    }
  }
`;

function NameDisplay({ queryRef }: { queryRef: PreloadedQuery<AppTestQuery> }) {
  // No explicit type argument: `TQuery` should be inferred from `queryRef`,
  // making `data` an `AppTestQuery$data`. It is not, so reading `viewer` is a
  // type error.
  const data = usePreloadedQuery(query, queryRef);
  return <div>{data.viewer?.name}</div>;
}

function Loader() {
  const [queryRef, loadQuery] = useQueryLoader<AppTestQuery>(query);
  if (queryRef == null) {
    return <button onClick={() => loadQuery({})}>Load</button>;
  }
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <NameDisplay queryRef={queryRef} />
    </Suspense>
  );
}

export default function TestApp() {
  return (
    <RelayEnvironmentProvider environment={testEnvironment}>
      <Loader />
    </RelayEnvironmentProvider>
  );
}
```

## Steps

```steps
click button "Load"
wait "Jordan"
```
