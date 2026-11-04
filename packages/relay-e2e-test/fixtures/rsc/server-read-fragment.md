# Server Component Reads a Fragment

The page's query spreads a fragment that a nested Server Component reads with
`serverReadFragment`, from the same request's Relay Environment. The fragment
ref crosses no process boundary and the browser makes no GraphQL request.

`serverReadFragment` is asynchronous, so the nested Server Component is too,
and React Flight streams its output as an outlined row instead of inline.

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

/** @gqlQueryField */
export function viewer(): User {
  return { id: "4", name: "Ada", email: "ada-private@example.com" };
}
```

## Server Environment

```ts title="ServerEnvironment.ts"
import { createServerEnvironment } from "react-relay/rsc_EXPERIMENTAL";
import { Environment, RecordSource, Store } from "relay-runtime";
import { gratsNetwork } from "../GratsNetwork";

export const { serverFetchQuery, serverReadFragment } = createServerEnvironment(
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
import ProfileSection from "./ProfileSection";
import { serverFetchQuery } from "./ServerEnvironment";
import type { PageQuery } from "./__generated__/PageQuery.graphql";

export default async function Page() {
  const data = await serverFetchQuery<PageQuery>(
    graphql`
      query PageQuery {
        viewer {
          ...ProfileSection_user
        }
      }
    `,
    {},
  );
  return <main>{data.viewer && <ProfileSection user={data.viewer} />}</main>;
}
```

## Profile Section

A Server Component in its own module.

```tsx title="ProfileSection.tsx"
import { graphql } from "relay-runtime";
import { serverReadFragment } from "./ServerEnvironment";
import type { ProfileSection_user$key } from "./__generated__/ProfileSection_user.graphql";

export default async function ProfileSection(props: {
  user: ProfileSection_user$key;
}) {
  const user = await serverReadFragment(
    graphql`
      fragment ProfileSection_user on User {
        name
        email
      }
    `,
    props.user,
  );
  return (
    <section>
      Hello, {user.name}! The server read a {user.email?.length}-character
      email.
    </section>
  );
}
```

## Steps

```steps
wait "Hello, Ada!"
requests "POST /graphql" 0
wire-excludes "ada-private@example.com"
outlined-rows 1
```
