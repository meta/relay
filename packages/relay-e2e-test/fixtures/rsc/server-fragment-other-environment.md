# Server Fragment Read Through Another Server Environment

A component module can hold another `createServerEnvironment` instance than
the one that ran the query, in the same request: for example after a hot
reload evaluated the module that creates it again. The `@server` query runs
on the host's server environment; a nested Server Component reads its
`@server` fragment with the `useServerFragment` of a second instance, whose
Environment never executed the query. The read goes through the Environment
of the request that owns the reference, and the client fragment the server
fragment spreads is handed off as usual.

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

## Other Server Environment

A second instance, as a hot reload would leave in a component module.

```ts title="OtherServerEnvironment.ts"
import { createServerEnvironment } from "react-relay/rsc_EXPERIMENTAL";
import { Environment, RecordSource, Store } from "relay-runtime";
import { gratsNetwork } from "../GratsNetwork";

export const { useServerFragment } = createServerEnvironment(
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

A Server Component reading a `@server` fragment through the other instance.

```tsx title="ProfileSection.tsx"
import { graphql } from "relay-runtime";
import { useServerFragment } from "./OtherServerEnvironment";
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
wait "The server read a 23-character email."
wait "Hello, Ada!"
requests "POST /graphql" 0
wire-excludes "ada-private@example.com"
```
