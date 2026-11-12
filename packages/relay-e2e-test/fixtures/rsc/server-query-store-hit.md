# Handed-Off Records Serve a Later Client Query

A `@server` query hands off a client fragment on `Query`. Its records are
published into the browser's Store when the Client Component first reads the
fragment. A later client query for the same data, with the default
`store-or-network` policy, is fulfilled entirely from those records: the
browser makes no GraphQL request.

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

```ts title="server.ts"
import { ID } from "grats";

/** @gqlType */
type User = {
  /** @gqlField */
  id: ID;
  /** @gqlField */
  name: string;
};

/** @gqlQueryField */
export function viewer(): User {
  return { id: "4", name: "Ada" };
}
```

## Page

```tsx title="Page.tsx"
import { graphql } from "relay-runtime";
import { serverQuery } from "../RelayRscHost";
import Greeting from "./Greeting";
import type { PageQuery } from "./__generated__/PageQuery.graphql";

export default async function Page() {
  const data = await serverQuery<PageQuery>(
    graphql`
      query PageQuery @server {
        ...Greeting_query @alias(as: "greeting")
      }
    `,
    {},
  );
  return (
    <main>
      <Greeting query={data.greeting} />
    </main>
  );
}
```

## Greeting

`ExactViewer` mounts after the handoff is accepted and asks for data the
handoff already published.

```tsx title="Greeting.tsx"
"use client";

import { Suspense } from "react";
import { useFragment, useLazyLoadQuery } from "react-relay";
import { graphql } from "relay-runtime";
import type { Greeting_query$key } from "./__generated__/Greeting_query.graphql";
import type { GreetingExactQuery } from "./__generated__/GreetingExactQuery.graphql";

function ExactViewer() {
  const data = useLazyLoadQuery<GreetingExactQuery>(
    graphql`
      query GreetingExactQuery {
        viewer {
          name
        }
      }
    `,
    {},
  );
  return <p>From the store: {data.viewer?.name}</p>;
}

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
  return (
    <section>
      <p>Hello, {data.viewer?.name}!</p>
      <Suspense fallback={<p>Fetching...</p>}>
        <ExactViewer />
      </Suspense>
    </section>
  );
}
```

## Hosts

```hosts
nextjs
cometjs
```

## Steps

```steps
wait "Hello, Ada!"
wait "From the store: Ada"
```
