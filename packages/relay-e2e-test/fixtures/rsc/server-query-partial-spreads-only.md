# A Server Query That Only Spreads Fragments Does Not Wait for Its Response

A `@server` query that reads no field of its own, and only spreads a
`@server` fragment and an aliased client fragment, resolves before any of its
response arrives, as a client query renders with `renderPolicy: 'partial'`.
The page and the Server Component of a fragment that itself only spreads
another render at once; each fragment that reads fields suspends where it is
read, the server fragment in its Server Component and the client fragment in
its Client Component, until the gated response arrives. The page logs that it
rendered before the response's resolver does.

## Relay Config

```json title="relay.config.json"
{
  "src": "./",
  "schema": "./schema.graphql",
  "language": "typescript",
  "featureFlags": {
    "enable_relay_rsc": true
  },
  "rscNodeType": {
    "name": "ReactNode",
    "path": "react"
  }
}
```

## Server

`notes` waits for the `notes` gate, so the whole response does.

```ts title="server.ts"
import { ID } from "grats";
import { waitForGate } from "../RelayRscHost";

/** @gqlType */
class User {
  /** @gqlField */
  id: ID = "4";
  /** @gqlField */
  name: string = "Ada";
  /** @gqlField */
  async notes(): Promise<string> {
    await waitForGate("notes");
    console.log("notes resolved");
    return "Prefers analytical engines.";
  }
}

/** @gqlQueryField */
export function viewer(): User {
  return new User();
}
```

## Page

```tsx title="Page.tsx"
import { Suspense } from "react";
import { graphql } from "relay-runtime";
import { serverQuery } from "../RelayRscHost";
import Greeting from "./Greeting";
import Outer from "./Outer";
import type { PageQuery } from "./__generated__/PageQuery.graphql";

export default async function Page() {
  const data = await serverQuery<PageQuery>(
    graphql`
      query PageQuery @server {
        ...Outer_query
        ...Greeting_query @alias(as: "greeting")
      }
    `,
    {},
  );
  console.log("Page rendered");
  return (
    <main>
      <h1>Partial page</h1>
      <Suspense fallback={<p>Loading outer...</p>}>
        <Outer query={data} />
      </Suspense>
      <Suspense fallback={<p>Loading greeting...</p>}>
        <Greeting query={data.greeting} />
      </Suspense>
    </main>
  );
}
```

## Outer

Reads no field of its own: it only spreads `Notes_query`.

```tsx title="Outer.tsx"
import { Suspense } from "react";
import { graphql } from "relay-runtime";
import { useServerFragment } from "../RelayRscHost";
import Notes from "./Notes";
import type { Outer_query$key } from "./__generated__/Outer_query.graphql";

const outerFragment = graphql`
  fragment Outer_query on Query @server {
    ...Notes_query
  }
`;

export default function Outer(props: { query: Outer_query$key }) {
  const query = useServerFragment(outerFragment, props.query);
  return (
    <section>
      <h2>Outer rendered</h2>
      <Suspense fallback={<p>Loading notes...</p>}>
        <Notes query={query} />
      </Suspense>
    </section>
  );
}
```

## Notes

```tsx title="Notes.tsx"
import { graphql } from "relay-runtime";
import { useServerFragment } from "../RelayRscHost";
import type { Notes_query$key } from "./__generated__/Notes_query.graphql";

const notesFragment = graphql`
  fragment Notes_query on Query @server {
    viewer {
      notes
    }
  }
`;

export default function Notes(props: { query: Notes_query$key }) {
  const query = useServerFragment(notesFragment, props.query);
  return <p>Notes: {query.viewer?.notes}</p>;
}
```

## Greeting

```tsx title="Greeting.tsx"
"use client";

import { useFragment } from "react-relay";
import { graphql } from "relay-runtime";
import type { Greeting_query$key } from "./__generated__/Greeting_query.graphql";

export default function Greeting(props: { query: Greeting_query$key }) {
  const data = useFragment(
    graphql`
      fragment Greeting_query on Query {
        viewer {
          name
        }
      }
    `,
    props.query,
  );
  return <p>Hello, {data.viewer?.name}!</p>;
}
```

## Hosts

```hosts
nextjs
cometjs
```

## Steps

```steps
wait "Partial page"
wait "Outer rendered"
wait "Loading notes..."
wait "Loading greeting..."
release "notes"
wait "Notes: Prefers analytical engines."
wait "Hello, Ada!"
```
