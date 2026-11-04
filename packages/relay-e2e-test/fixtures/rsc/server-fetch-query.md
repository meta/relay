# Server Component Fetches a Query

A Server Component fetches a query with `serverFetchQuery` and renders the
result. The page reaches the browser as server-rendered HTML plus the React
Flight stream it hydrates from, which carries only the rendered output: the
browser makes no GraphQL request, and the field the page read but did not
render never reaches it. A navigation renders the page again on the server
for new search params.

The page and the Server Component it nests are synchronous once the data is
there, so React Flight sends the tree inline, with no outlined rows. Both
hosts run the fixture.

## Relay Config

```json title="relay.config.json"
{
  "src": "./",
  "schema": "./schema.graphql",
  "language": "typescript"
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

const USERS: { [id: string]: User } = {
  "1": { id: "1", name: "Ada", email: "ada-private@example.com" },
  "2": { id: "2", name: "Grace", email: "grace-private@example.com" },
};

/** @gqlQueryField */
export function user(args: { id: ID }): User | null {
  return USERS[args.id] ?? null;
}
```

## Server Environment

The server half of the Relay RSC API, created once per server and scoped to
each request by `React.cache`.

```ts title="ServerEnvironment.ts"
import { createServerEnvironment } from "react-relay/rsc_EXPERIMENTAL";
import { Environment, RecordSource, Store } from "relay-runtime";
import { gratsNetwork } from "../GratsNetwork";

export const { serverFetchQuery } = createServerEnvironment(
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
import { serverFetchQuery } from "./ServerEnvironment";
import type { PageQuery } from "./__generated__/PageQuery.graphql";

export default async function Page(props: { searchParams: { id?: string } }) {
  const data = await serverFetchQuery<PageQuery>(
    graphql`
      query PageQuery($id: ID!) {
        user(id: $id) {
          name
          email
        }
      }
    `,
    { id: props.searchParams.id ?? "1" },
  );
  if (data.user == null) {
    return <p>No such user</p>;
  }
  return (
    <main>
      <Greeting name={data.user.name} />
      <p>The server read a {data.user.email?.length}-character email.</p>
    </main>
  );
}

function Greeting(props: { name: string | null | undefined }) {
  return <h1>Hello, {props.name}!</h1>;
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
requests "POST /graphql" 0
wire-excludes "ada-private@example.com"
outlined-rows 0
navigate "?id=2"
wait "Hello, Grace!"
wire-excludes "grace-private@example.com"
outlined-rows 0
```
