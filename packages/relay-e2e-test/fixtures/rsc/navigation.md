# Navigating Between Server-Rendered Pages

Each navigation renders the page again on the server for new search params
and decodes the new Flight tree in a transition, keeping the browser's Relay
Environment. Every page's handoff publishes into that one Store: navigating
back to the first user renders from a fresh handoff, and a Client Component's
local state belongs to the user it was rendered for.

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
  /** @gqlField */
  bio: string;
};

const USERS: { [id: string]: User } = {
  "1": { id: "1", name: "Ada", bio: "Wrote the first program." },
  "2": { id: "2", name: "Grace", bio: "Built the first compiler." },
};

/** @gqlQueryField */
export function user(args: { id: ID }): User | null {
  return USERS[args.id] ?? null;
}
```

## Page

```tsx title="Page.tsx"
import { graphql } from "relay-runtime";
import { serverQuery } from "../RelayRscHost";
import Bio from "./Bio";
import type { PageQuery } from "./__generated__/PageQuery.graphql";

export default async function Page(props: { searchParams: { id?: string } }) {
  const id = props.searchParams.id ?? "1";
  const data = await serverQuery<PageQuery>(
    graphql`
      query PageQuery($id: ID!) @server {
        user(id: $id) {
          id
          name
          ...Bio_user @alias(as: "bio")
        }
      }
    `,
    { id },
  );
  const user = data.user;
  if (user == null) {
    return <p>No user {id}</p>;
  }
  return (
    <main>
      <h1>{user.name}</h1>
      <Bio key={user.id} user={user.bio} />
    </main>
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
        name
        bio
      }
    `,
    props.user,
  );
  const [likes, setLikes] = useState(0);
  return (
    <p>
      {user.bio} <button onClick={() => setLikes(likes + 1)}>Like {user.name} ({likes})</button>
    </p>
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
wait "Wrote the first program."
click button "Like Ada (0)"
wait "Like Ada (1)"
navigate "?id=2"
wait "Built the first compiler."
wait "Like Grace (0)"
navigate "?id=1"
wait "Like Ada (0)"
```
