# Server-Rendered Client Components Hydrate Without Refetching

The initial page load is server-rendered: the SSR process renders the Flight
tree, Client Components included, to HTML, and the browser hydrates that HTML
from the Flight payload embedded in the document. The Client Components read
their data from a preloaded query (`useQueryFromServer`) and a fragment of it
(`useFragment`), so neither the server render nor the browser sends a GraphQL
request. The `## SSR HTML` section of the snapshot is the HTML the browser
received before any script ran.

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
import { ID } from "grats";

/** @gqlType */
type User = {
  /** @gqlField */
  id: ID;
  /** @gqlField */
  name: string;
  /** @gqlField */
  bio: string;
};

/** @gqlQueryField */
export function viewer(): User {
  return { id: "4", name: "Ada", bio: "Wrote the first program." };
}
```

## Server Environment

```ts title="ServerEnvironment.ts"
import { createServerEnvironment } from "react-relay/rsc_EXPERIMENTAL";
import { Environment, RecordSource, Store } from "relay-runtime";
import { gratsNetwork } from "../GratsNetwork";

export const { serverPreloadQuery } = createServerEnvironment(
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
import Greeting from "./Greeting";
import { serverPreloadQuery } from "./ServerEnvironment";
import GreetingQuery from "./__generated__/GreetingQuery.graphql";
import type { GreetingQuery as GreetingQueryType } from "./__generated__/GreetingQuery.graphql";

export default function Page() {
  return (
    <main>
      <h1>Profile</h1>
      <Greeting queryRef={serverPreloadQuery<GreetingQueryType>(GreetingQuery, {})} />
    </main>
  );
}
```

## Greeting

```tsx title="Greeting.tsx"
"use client";

import { useQueryFromServer } from "react-relay/rsc-client_EXPERIMENTAL";
import type { PreloadedQueryRef } from "react-relay/rsc-client_EXPERIMENTAL";
import { graphql } from "relay-runtime";
import Bio from "./Bio";
import type { GreetingQuery } from "./__generated__/GreetingQuery.graphql";

export default function Greeting(props: {
  queryRef: PreloadedQueryRef<GreetingQuery["variables"], GreetingQuery["response"]>;
}) {
  const data = useQueryFromServer<GreetingQuery>(
    graphql`
      query GreetingQuery {
        viewer {
          name
          ...Bio_user
        }
      }
    `,
    props.queryRef,
  );
  return (
    <section>
      <p>Hello, {data.viewer?.name}!</p>
      {data.viewer && <Bio user={data.viewer} />}
    </section>
  );
}
```

## Bio

```tsx title="Bio.tsx"
"use client";

import { useState } from "react";
import { useFragment } from "react-relay";
import { graphql } from "relay-runtime";
import type { Bio_user$key } from "./__generated__/Bio_user.graphql";

export default function Bio(props: { user: Bio_user$key }) {
  const user = useFragment(
    graphql`
      fragment Bio_user on User {
        bio
      }
    `,
    props.user,
  );
  const [open, setOpen] = useState(false);
  return open ? (
    <p>{user.bio}</p>
  ) : (
    <button onClick={() => setOpen(true)}>Show bio</button>
  );
}
```

## Steps

The click works only once the page has hydrated.

```steps
wait "Hello, Ada!"
click button "Show bio"
wait "Wrote the first program."
requests "POST /graphql" 0
```
