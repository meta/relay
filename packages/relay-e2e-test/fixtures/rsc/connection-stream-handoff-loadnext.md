# Paginating a Handed-Off Connection Whose First Page Streamed

A `@server` query hands off a client pagination fragment whose `@connection`
streams its edges (`edges @stream(initialCount: 1)`). The first page arrives in
the handoff: one edge in the first payload, the other two streamed. The
server's ConnectionHandler names the edges again for each streamed edge, and
the client renames every chunk's edges so they never collide with the edges
its own ConnectionHandler creates. Right after hydration the list calls
`loadNext`, as an infinite-scroll list does when its first page doesn't fill
the screen. The next page's edges append to the connection the handoff created,
and navigating to another server-rendered page, whose own handoff publishes
into the same Store, keeps working.

The handoff carries only what the client reads, once: no records of the
connection field as the server fetched it (the client reads the connection
through its handle), and no edge the server's ConnectionHandler created again
with the same data.

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
import { ID, Int } from "grats";

/** @gqlDirective on FIELD */
export function stream(args: {
  label?: string | null;
  initialCount: Int;
  if?: boolean | null;
}) {}

/** @gqlType */
type User = {
  /** @gqlField */
  id: ID;
  /** @gqlField */
  name: string;
};

/** @gqlType */
type UserEdge = {
  /** @gqlField */
  cursor: string;
  /** @gqlField */
  node: User;
};

/** @gqlType */
type PageInfo = {
  /** @gqlField */
  hasNextPage: boolean;
  /** @gqlField */
  hasPreviousPage: boolean;
  /** @gqlField */
  startCursor: string | null;
  /** @gqlField */
  endCursor: string | null;
};

/** @gqlType */
type UserConnection = {
  /** @gqlField */
  edges: UserEdge[];
  /** @gqlField */
  pageInfo: PageInfo;
};

const PEOPLE: User[] = ["P1", "P2", "P3", "P4", "P5", "P6"].map((name, index) => ({
  id: String(index + 1),
  name,
}));

/** @gqlQueryField */
export function people(args: { first: Int; after?: string | null }): UserConnection {
  const start = args.after == null ? 0 : Number(args.after) + 1;
  const page = PEOPLE.slice(start, start + args.first);
  return {
    edges: page.map((node, index) => ({ cursor: String(start + index), node })),
    pageInfo: {
      hasNextPage: start + page.length < PEOPLE.length,
      hasPreviousPage: start > 0,
      startCursor: page.length > 0 ? String(start) : null,
      endCursor: page.length > 0 ? String(start + page.length - 1) : null,
    },
  };
}

/** @gqlQueryField */
export function other(): User {
  return { id: "other", name: "Zed" };
}
```

## Page

```tsx title="Page.tsx"
import { graphql } from "relay-runtime";
import { serverQuery } from "../RelayRscHost";
import OtherName from "./OtherName";
import PeopleList from "./PeopleList";
import type { PageOtherQuery } from "./__generated__/PageOtherQuery.graphql";
import type { PageQuery } from "./__generated__/PageQuery.graphql";

export default async function Page(props: { searchParams: { view?: string } }) {
  if (props.searchParams.view === "other") {
    const data = await serverQuery<PageOtherQuery>(
      graphql`
        query PageOtherQuery @server {
          other {
            ...OtherName_user @alias(as: "name")
          }
        }
      `,
      {},
    );
    return (
      <main>
        {data.other == null ? null : <OtherName user={data.other.name} />}
      </main>
    );
  }
  const data = await serverQuery<PageQuery>(
    graphql`
      query PageQuery @server {
        ...PeopleList_query @alias(as: "people")
      }
    `,
    {},
  );
  return (
    <main>
      <PeopleList query={data.people} />
    </main>
  );
}
```

## People List

```tsx title="PeopleList.tsx"
"use client";

import { useEffect } from "react";
import { usePaginationFragment } from "react-relay";
import { graphql } from "relay-runtime";
import type { PeopleList_query$key } from "./__generated__/PeopleList_query.graphql";
import type { PeopleListPaginationQuery } from "./__generated__/PeopleListPaginationQuery.graphql";

export default function PeopleList(props: { query: PeopleList_query$key }) {
  const { data, hasNext, isLoadingNext, loadNext } = usePaginationFragment<
    PeopleListPaginationQuery,
    PeopleList_query$key
  >(
    graphql`
      fragment PeopleList_query on Query
      @refetchable(queryName: "PeopleListPaginationQuery")
      @argumentDefinitions(
        count: { type: "Int", defaultValue: 3 }
        cursor: { type: "String" }
      ) {
        people(first: $count, after: $cursor) @connection(key: "PeopleList_people") {
          edges @stream(label: "PeopleListEdges", initialCount: 1) {
            node {
              id
              name
            }
          }
        }
      }
    `,
    props.query,
  );
  const edges = data.people?.edges ?? [];
  const count = edges.length;
  useEffect(() => {
    if (count === 3 && hasNext && !isLoadingNext) {
      loadNext(2);
    }
  }, [count, hasNext, isLoadingNext, loadNext]);
  return (
    <section>
      <p>Edges: {count}</p>
      <ul>
        {edges.map((edge) =>
          edge?.node == null ? null : <li key={edge.node.id}>Person: {edge.node.name}</li>,
        )}
      </ul>
    </section>
  );
}
```

## Other Name

```tsx title="OtherName.tsx"
"use client";

import { useFragment } from "react-relay";
import { graphql } from "relay-runtime";
import type { OtherName_user$key } from "./__generated__/OtherName_user.graphql";

export default function OtherName(props: { user: OtherName_user$key }) {
  const user = useFragment(
    graphql`
      fragment OtherName_user on User {
        name
      }
    `,
    props.user,
  );
  return <h1>Other: {user.name}</h1>;
}
```

## Hosts

```hosts
nextjs
cometjs
```

## Steps

```steps
wait "Person: P3"
requests "POST /graphql" 1
wait "Person: P5"
wait "Edges: 5"
wire-excludes "client:root:people(first:3)"
wire-excludes "__PeopleList_people_connection:edges:1"
navigate "?view=other"
wait "Other: Zed"
```
