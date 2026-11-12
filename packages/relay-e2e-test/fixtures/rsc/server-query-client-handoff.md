# Server Query Hands Off a Client Fragment

A `@server` query runs in a Server Component. It reads server-only fields and
passes an aliased client fragment ref to a Client Component, which reads it
with ordinary `useFragment`. The fragment data crosses the server/client
boundary inside the Flight stream (the handoff carrier rides on the fragment
ref), so the browser makes no GraphQL request. Neither the server-only fields
nor the query variable only they use ever reach it.

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
  email: string;
};

/** @gqlField */
export function secretNote(_: User, args: { accessToken: string }): string {
  return args.accessToken === "token-only-the-server-sees"
    ? "Note only the server reads"
    : "Wrong token";
}

/** @gqlQueryField */
export function viewer(): User {
  return { id: "4", name: "Ada", email: "ada-private@example.com" };
}
```

## Page

The Server Component. `serverQuery` comes from the reference host.

```tsx title="Page.tsx"
import { graphql } from "relay-runtime";
import { serverQuery } from "../RelayRscHost";
import ProfileCard from "./ProfileCard";
import type { PageQuery } from "./__generated__/PageQuery.graphql";

export default async function Page() {
  const data = await serverQuery<PageQuery>(
    graphql`
      query PageQuery($accessToken: String!) @server {
        viewer {
          email
          secretNote(accessToken: $accessToken)
          ...ProfileCard_user @alias(as: "card")
        }
      }
    `,
    { accessToken: "token-only-the-server-sees" },
  );
  const viewer = data.viewer;
  if (viewer == null) {
    return <p>No viewer</p>;
  }
  return (
    <main>
      <p>The server read a {viewer.email?.length}-character email.</p>
      <p>The server read a {viewer.secretNote?.length}-character note.</p>
      <ProfileCard user={viewer.card} />
    </main>
  );
}
```

## Profile Card

```tsx title="ProfileCard.tsx"
"use client";

import { useFragment } from "react-relay";
import { graphql } from "relay-runtime";
import type { ProfileCard_user$key } from "./__generated__/ProfileCard_user.graphql";

export default function ProfileCard(props: { user: ProfileCard_user$key }) {
  const user = useFragment(
    graphql`
      fragment ProfileCard_user on User {
        name
      }
    `,
    props.user,
  );
  return <section>Hello, {user.name}!</section>;
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
wire-excludes "ada-private@example.com"
wire-excludes "token-only-the-server-sees"
wire-excludes "Note only the server reads"
```
