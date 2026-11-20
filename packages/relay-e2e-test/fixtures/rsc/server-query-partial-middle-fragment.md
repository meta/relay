# A Server Fragment That Only Spreads Another Does Not Suspend

A `@server` query that only spreads fragments resolves before its gated
response arrives. Each chain it starts has a middle `@server` fragment that
reads no field of its own and only spreads a child `@server` fragment on the
same object:

- on the Query root: `RootMiddle_query` spreads `RootNotes_query`;
- on a nested object: `Parent_query` reads `viewer` (which the page's first
  query already wrote to the request's Store) and its `viewer` field gives
  `NestedMiddle_user` its reference, which spreads `NestedNotes_user`.

Each middle Server Component renders, and passes its child the reference,
before the gate opens; only each child suspends. A middle that suspended
would show its own fallback ("Loading root middle..." or
"Loading nested middle...") instead.

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

`notes` waits for the `notes` gate, so the whole chains response does.

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
import Parent from "./Parent";
import RootMiddle from "./RootMiddle";
import type { PageChainsQuery } from "./__generated__/PageChainsQuery.graphql";
import type { PageQuery } from "./__generated__/PageQuery.graphql";

export default async function Page() {
  const page = await serverQuery<PageQuery>(
    graphql`
      query PageQuery @server {
        viewer {
          name
        }
      }
    `,
    {},
  );
  const chains = await serverQuery<PageChainsQuery>(
    graphql`
      query PageChainsQuery @server {
        ...RootMiddle_query
        ...Parent_query
      }
    `,
    {},
  );
  console.log("Page rendered");
  return (
    <main>
      <h1>{page.viewer?.name}</h1>
      <Suspense fallback={<p>Loading root middle...</p>}>
        <RootMiddle query={chains} />
      </Suspense>
      <Suspense fallback={<p>Loading parent...</p>}>
        <Parent query={chains} />
      </Suspense>
    </main>
  );
}
```

## Root Middle

```tsx title="RootMiddle.tsx"
import { Suspense } from "react";
import { graphql } from "relay-runtime";
import { useServerFragment } from "../RelayRscHost";
import RootNotes from "./RootNotes";
import type { RootMiddle_query$key } from "./__generated__/RootMiddle_query.graphql";

const middleFragment = graphql`
  fragment RootMiddle_query on Query @server {
    ...RootNotes_query
  }
`;

export default function RootMiddle(props: { query: RootMiddle_query$key }) {
  const query = useServerFragment(middleFragment, props.query);
  return (
    <section>
      <h2>Root middle rendered</h2>
      <Suspense fallback={<p>Loading root notes...</p>}>
        <RootNotes query={query} />
      </Suspense>
    </section>
  );
}
```

## Root Notes

```tsx title="RootNotes.tsx"
import { graphql } from "relay-runtime";
import { useServerFragment } from "../RelayRscHost";
import type { RootNotes_query$key } from "./__generated__/RootNotes_query.graphql";

const notesFragment = graphql`
  fragment RootNotes_query on Query @server {
    viewer {
      notes
    }
  }
`;

export default function RootNotes(props: { query: RootNotes_query$key }) {
  const query = useServerFragment(notesFragment, props.query);
  return <p>Root notes: {query.viewer?.notes}</p>;
}
```

## Parent

```tsx title="Parent.tsx"
import { Suspense } from "react";
import { graphql } from "relay-runtime";
import { useServerFragment } from "../RelayRscHost";
import NestedMiddle from "./NestedMiddle";
import type { Parent_query$key } from "./__generated__/Parent_query.graphql";

const parentFragment = graphql`
  fragment Parent_query on Query @server {
    viewer {
      ...NestedMiddle_user
    }
  }
`;

export default function Parent(props: { query: Parent_query$key }) {
  const query = useServerFragment(parentFragment, props.query);
  const viewer = query.viewer;
  return (
    <section>
      <h2>Parent rendered</h2>
      <Suspense fallback={<p>Loading nested middle...</p>}>
        {viewer != null ? <NestedMiddle user={viewer} /> : null}
      </Suspense>
    </section>
  );
}
```

## Nested Middle

```tsx title="NestedMiddle.tsx"
import { Suspense } from "react";
import { graphql } from "relay-runtime";
import { useServerFragment } from "../RelayRscHost";
import NestedNotes from "./NestedNotes";
import type { NestedMiddle_user$key } from "./__generated__/NestedMiddle_user.graphql";

const middleFragment = graphql`
  fragment NestedMiddle_user on User @server {
    ...NestedNotes_user
  }
`;

export default function NestedMiddle(props: { user: NestedMiddle_user$key }) {
  const user = useServerFragment(middleFragment, props.user);
  return (
    <div>
      <h3>Nested middle rendered</h3>
      <Suspense fallback={<p>Loading nested notes...</p>}>
        <NestedNotes user={user} />
      </Suspense>
    </div>
  );
}
```

## Nested Notes

```tsx title="NestedNotes.tsx"
import { graphql } from "relay-runtime";
import { useServerFragment } from "../RelayRscHost";
import type { NestedNotes_user$key } from "./__generated__/NestedNotes_user.graphql";

const notesFragment = graphql`
  fragment NestedNotes_user on User @server {
    notes
  }
`;

export default function NestedNotes(props: { user: NestedNotes_user$key }) {
  const user = useServerFragment(notesFragment, props.user);
  return <p>Nested notes: {user.notes}</p>;
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
wait "Root middle rendered"
wait "Loading root notes..."
wait "Parent rendered"
wait "Nested middle rendered"
wait "Loading nested notes..."
release "notes"
wait "Root notes: Prefers analytical engines."
wait "Nested notes: Prefers analytical engines."
```
