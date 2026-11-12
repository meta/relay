# A List of Handed-Off Fragment Refs

A `@server` query selects a list and spreads an aliased client fragment on
each item. Every item's ref carries the response's handoff, and each keyed
Client Component reads its own record with independent local state.

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
export function friends(): User[] {
  return [
    { id: "1", name: "Ada" },
    { id: "2", name: "Grace" },
    { id: "3", name: "Linus" },
  ];
}
```

## Page

```tsx title="Page.tsx"
import { graphql } from "relay-runtime";
import { serverQuery } from "../RelayRscHost";
import FriendRow from "./FriendRow";
import type { PageQuery } from "./__generated__/PageQuery.graphql";

export default async function Page() {
  const data = await serverQuery<PageQuery>(
    graphql`
      query PageQuery @server {
        friends {
          id
          ...FriendRow_user @alias(as: "row")
        }
      }
    `,
    {},
  );
  return (
    <ul>
      {data.friends?.map((friend) =>
        friend == null ? null : <FriendRow key={friend.id} user={friend.row} />,
      )}
    </ul>
  );
}
```

## Friend Row

```tsx title="FriendRow.tsx"
"use client";

import { useState } from "react";
import { useFragment } from "react-relay";
import { graphql } from "relay-runtime";
import type { FriendRow_user$key } from "./__generated__/FriendRow_user.graphql";

export default function FriendRow(props: { user: FriendRow_user$key }) {
  const user = useFragment(
    graphql`
      fragment FriendRow_user on User {
        name
      }
    `,
    props.user,
  );
  const [waves, setWaves] = useState(0);
  return (
    <li>
      <button onClick={() => setWaves(waves + 1)}>
        Wave at {user.name} ({waves})
      </button>
    </li>
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
wait "Wave at Linus (0)"
click button "Wave at Grace (0)"
wait "Wave at Grace (1)"
wait "Wave at Ada (0)"
```
