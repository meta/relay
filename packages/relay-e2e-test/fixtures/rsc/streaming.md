# A Suspense Boundary Streams

A Server Component inside a Suspense boundary waits on data the server holds
back behind a gate. The initial HTML is the shell, with the boundary's
fallback; the Flight stream embedded in the document keeps flowing after it,
and once the gate opens the browser renders the boundary's content from it.

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
import { waitForGate } from "../RelayRscHost";

/** @gqlQueryField */
export function greeting(): string {
  return "Hello, Ada!";
}

/** @gqlQueryField */
export async function notes(): Promise<string> {
  await waitForGate("notes");
  return "Prefers analytical engines.";
}
```

## Server Environment

```ts title="ServerEnvironment.ts"
import { createServerEnvironment } from "react-relay/rsc_EXPERIMENTAL";
import { Environment, RecordSource, Store } from "relay-runtime";
import { gratsNetwork } from "../GratsNetwork";

export const { serverFetchQuery } = createServerEnvironment(
  () =>
    new Environment({
      isServer: true,
      network: gratsNetwork,
      store: new Store(new RecordSource()),
    }),
);
```

## Page

```tsx title="Page.tsx"
import { Suspense } from "react";
import { graphql } from "relay-runtime";
import Notes from "./Notes";
import { serverFetchQuery } from "./ServerEnvironment";
import type { PageQuery } from "./__generated__/PageQuery.graphql";

export default async function Page() {
  const data = await serverFetchQuery<PageQuery>(
    graphql`
      query PageQuery {
        greeting
      }
    `,
    {},
  );
  return (
    <main>
      <h1>{data.greeting}</h1>
      <Suspense fallback={<p>Loading notes...</p>}>
        <Notes />
      </Suspense>
    </main>
  );
}
```

## Notes

```tsx title="Notes.tsx"
import { graphql } from "relay-runtime";
import { serverFetchQuery } from "./ServerEnvironment";
import type { NotesQuery } from "./__generated__/NotesQuery.graphql";

export default async function Notes() {
  const data = await serverFetchQuery<NotesQuery>(
    graphql`
      query NotesQuery {
        notes
      }
    `,
    {},
  );
  return <p>Notes: {data.notes}</p>;
}
```

## Steps

```steps
wait "Hello, Ada!"
wait "Loading notes..."
release "notes"
wait "Notes: Prefers analytical engines."
requests "POST /graphql" 0
```
