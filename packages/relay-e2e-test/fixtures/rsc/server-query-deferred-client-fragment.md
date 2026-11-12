# Server Query Streams a Deferred Client Fragment

The client fragment a `@server` query hands off is `@defer`red. The server
renders immediately and the handoff arrives in two waves: the first carrier
holds the non-deferred records, and its `progressive.next` promise — streamed
through Flight — resolves to a second carrier when the deferred payload
arrives. Two Client Components share the one fragment ref; both suspend on the
deferred data and both reveal it from the same wave, without any GraphQL
request from the browser.

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

`bio` waits for the `bio` gate, so the deferred payload arrives only when the
steps release it. The schema declares `@defer` so the Relay compiler accepts
it.

```ts title="server.ts"
import { ID } from "grats";
import { waitForGate } from "../RelayRscHost";

/** @gqlDirective on FRAGMENT_SPREAD | INLINE_FRAGMENT */
export function defer(args: { label?: string | null; if?: boolean | null }) {}

/** @gqlType */
class User {
  /** @gqlField */
  id: ID = "4";
  /** @gqlField */
  name: string = "Ada";
  /** @gqlField */
  async bio(): Promise<string> {
    await waitForGate("bio");
    return "Wrote the first program.";
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
import Bio from "./Bio";
import type { PageQuery } from "./__generated__/PageQuery.graphql";

export default async function Page() {
  const data = await serverQuery<PageQuery>(
    graphql`
      query PageQuery @server {
        viewer {
          name
          ...Bio_user @alias(as: "bio") @defer
        }
      }
    `,
    {},
  );
  const viewer = data.viewer;
  if (viewer == null) {
    return <p>No viewer</p>;
  }
  return (
    <main>
      <h1>{viewer.name}</h1>
      <Suspense fallback={<p>Loading primary bio...</p>}>
        <Bio label="Primary" user={viewer.bio} />
      </Suspense>
      <Suspense fallback={<p>Loading peer bio...</p>}>
        <Bio label="Peer" user={viewer.bio} />
      </Suspense>
    </main>
  );
}
```

## Bio

```tsx title="Bio.tsx"
"use client";

import { useFragment } from "react-relay";
import { graphql } from "relay-runtime";
import type { Bio_user$key } from "./__generated__/Bio_user.graphql";

export default function Bio(props: {
  label: string;
  user: Bio_user$key | null | undefined;
}) {
  const user = useFragment(
    graphql`
      fragment Bio_user on User {
        bio
      }
    `,
    props.user,
  );
  return (
    <p>
      {props.label}: {user?.bio}
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
wait "Ada"
wait "Loading primary bio..."
wait "Loading peer bio..."
release "bio"
wait "Primary: Wrote the first program."
wait "Peer: Wrote the first program."
```
