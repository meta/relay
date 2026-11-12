# Client Fragment Behind a Server Fragment

The `@server` query spreads only a `@server` fragment. That fragment, read by
a child Server Component, hands an aliased client fragment to a Client
Component. The client owner is not at the query root: the compiler records the
transition through the server fragment, and the handoff still carries exactly
the client fragment's records. The server fragment's own field never crosses
the wire.

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

/** @gqlQueryField */
export function viewer(): User {
  return { id: "4", name: "Ada", email: "ada-private@example.com" };
}
```

## Page

```tsx title="Page.tsx"
import { graphql } from "relay-runtime";
import { serverQuery } from "../RelayRscHost";
import ProfileSection from "./ProfileSection";
import type { PageQuery } from "./__generated__/PageQuery.graphql";

export default async function Page() {
  const data = await serverQuery<PageQuery>(
    graphql`
      query PageQuery @server {
        viewer {
          ...ProfileSection_user
        }
      }
    `,
    {},
  );
  return <main>{data.viewer == null ? null : <ProfileSection user={data.viewer} />}</main>;
}
```

## Profile Section

A Server Component reading a `@server` fragment.

```tsx title="ProfileSection.tsx"
import { graphql } from "relay-runtime";
import { useServerFragment } from "../RelayRscHost";
import ProfileCard from "./ProfileCard";
import type { ProfileSection_user$key } from "./__generated__/ProfileSection_user.graphql";

const profileSectionFragment = graphql`
  fragment ProfileSection_user on User @server {
    email
    ...ProfileCard_user @alias(as: "card")
  }
`;

export default function ProfileSection(props: {
  user: ProfileSection_user$key;
}) {
  const user = useServerFragment(profileSectionFragment, props.user);
  return (
    <section>
      <p>The server read a {user.email?.length}-character email.</p>
      <ProfileCard user={user.card} />
    </section>
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
  return <p>Hello, {user.name}!</p>;
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
```
