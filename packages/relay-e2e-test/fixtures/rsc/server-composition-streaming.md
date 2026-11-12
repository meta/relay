# Server-Only Composition Streams a Deferred Server Fragment

A `@server` query spreads a `@defer`red `@server` fragment that a child Server
Component reads. Nothing is handed to the browser — every fragment is
server-owned — so the Flight stream carries only rendered output: the
Suspense fallback streams first, and the deferred fragment's rendering
streams in when its payload arrives. No client module loads and the browser
makes no GraphQL request.

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

/** @gqlDirective on FRAGMENT_SPREAD | INLINE_FRAGMENT */
export function defer(args: { label?: string | null; if?: boolean | null }) {}

/** @gqlType */
class User {
  /** @gqlField */
  id: ID = "4";
  /** @gqlField */
  name: string = "Ada";
  /** @gqlField */
  async notes(): Promise<string> {
    await waitForGate("notes");
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
import ServerNotes from "./ServerNotes";
import type { PageQuery } from "./__generated__/PageQuery.graphql";

export default async function Page() {
  const data = await serverQuery<PageQuery>(
    graphql`
      query PageQuery @server {
        viewer {
          name
          ...ServerNotes_user @defer
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
      <Suspense fallback={<p>Loading notes...</p>}>
        <ServerNotes user={viewer} />
      </Suspense>
    </main>
  );
}
```

## Server Notes

```tsx title="ServerNotes.tsx"
import { graphql } from "relay-runtime";
import { useServerFragment } from "../RelayRscHost";
import type { ServerNotes_user$key } from "./__generated__/ServerNotes_user.graphql";

const serverNotesFragment = graphql`
  fragment ServerNotes_user on User @server {
    notes
  }
`;

export default function ServerNotes(props: { user: ServerNotes_user$key }) {
  const user = useServerFragment(serverNotesFragment, props.user);
  return <p>Notes: {user.notes}</p>;
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
wait "Loading notes..."
release "notes"
wait "Notes: Prefers analytical engines."
```
