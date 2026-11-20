# A Server Query Reads What an Earlier Query of the Request Wrote

The page's `@server` query writes `viewer.name` to the request's server
Store. A nested Server Component's `@server` query also reads `viewer.name`,
spreads a `@server` fragment and hands off a client fragment. As a client
query with `renderPolicy: 'partial'` renders from the Store, the nested query
resolves before its own gated response arrives, since the Store has the data
it reads itself. The `@server` fragment it spreads also reads `name`, so it
renders at once too, and the fragment that one spreads suspends in its Server
Component until the response arrives; so does the handed-off client fragment
in its Client Component.

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

`notes` waits for the `notes` gate.

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
  bio: string = "Wrote the first program.";
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
import Profile from "./Profile";
import type { PageQuery } from "./__generated__/PageQuery.graphql";

export default async function Page() {
  const data = await serverQuery<PageQuery>(
    graphql`
      query PageQuery @server {
        viewer {
          name
        }
      }
    `,
    {},
  );
  return (
    <main>
      <h1>{data.viewer?.name}</h1>
      <Suspense fallback={<p>Loading profile...</p>}>
        <Profile />
      </Suspense>
    </main>
  );
}
```

## Profile

```tsx title="Profile.tsx"
import { Suspense } from "react";
import { graphql } from "relay-runtime";
import { serverQuery } from "../RelayRscHost";
import Bio from "./Bio";
import ProfileCard from "./ProfileCard";
import type { ProfileQuery } from "./__generated__/ProfileQuery.graphql";

export default async function Profile() {
  const data = await serverQuery<ProfileQuery>(
    graphql`
      query ProfileQuery @server {
        viewer {
          name
          ...ProfileCard_user
          ...Bio_user @alias(as: "bio")
        }
      }
    `,
    {},
  );
  console.log("Profile rendered");
  const viewer = data.viewer;
  if (viewer == null) {
    return <p>No viewer</p>;
  }
  return (
    <section>
      <h2>Profile of {viewer.name}</h2>
      <ProfileCard user={viewer} />
      <Suspense fallback={<p>Loading bio...</p>}>
        <Bio user={viewer.bio} />
      </Suspense>
    </section>
  );
}
```

## Profile Card

Reads `name`, which the Store has, and spreads `Notes_user`.

```tsx title="ProfileCard.tsx"
import { Suspense } from "react";
import { graphql } from "relay-runtime";
import { useServerFragment } from "../RelayRscHost";
import Notes from "./Notes";
import type { ProfileCard_user$key } from "./__generated__/ProfileCard_user.graphql";

const cardFragment = graphql`
  fragment ProfileCard_user on User @server {
    name
    ...Notes_user
  }
`;

export default function ProfileCard(props: { user: ProfileCard_user$key }) {
  const user = useServerFragment(cardFragment, props.user);
  return (
    <div>
      <p>Card for {user.name}</p>
      <Suspense fallback={<p>Loading notes...</p>}>
        <Notes user={user} />
      </Suspense>
    </div>
  );
}
```

## Notes

```tsx title="Notes.tsx"
import { graphql } from "relay-runtime";
import { useServerFragment } from "../RelayRscHost";
import type { Notes_user$key } from "./__generated__/Notes_user.graphql";

const notesFragment = graphql`
  fragment Notes_user on User @server {
    notes
  }
`;

export default function Notes(props: { user: Notes_user$key }) {
  const user = useServerFragment(notesFragment, props.user);
  return <p>Notes: {user.notes}</p>;
}
```

## Bio

```tsx title="Bio.tsx"
"use client";

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
  return <p>Bio: {user.bio}</p>;
}
```

## Hosts

```hosts
nextjs
cometjs
```

## Steps

```steps
wait "Ada"
wait "Profile of Ada"
wait "Card for Ada"
wait "Loading notes..."
wait "Loading bio..."
release "notes"
wait "Notes: Prefers analytical engines."
wait "Bio: Wrote the first program."
```
