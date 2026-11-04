# Preloaded Query Hydrates a Client Component

A Server Component starts a query with `serverPreloadQuery` and passes the
ref to a Client Component, which reads it with `useQueryFromServer`. The
response streams to the browser inside the Flight payload and is published
to the browser's Relay Store, so the page hydrates without a GraphQL request.
After hydration the Client Component updates through an ordinary mutation.

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
import { ID, Int } from "grats";

/** @gqlType */
type User = {
  /** @gqlField */
  id: ID;
  /** @gqlField */
  name: string;
  /** @gqlField */
  likes: Int;
};

const ada: User = { id: "4", name: "Ada", likes: 0 };

/** @gqlQueryField */
export function viewer(): User {
  return ada;
}

/** @gqlMutationField */
export function like(): User {
  ada.likes += 1;
  return ada;
}
```

## Server Environment

```ts title="ServerEnvironment.ts"
import { createServerEnvironment } from "react-relay/rsc_EXPERIMENTAL";
import { Environment, RecordSource, Store } from "relay-runtime";
import { gratsNetwork } from "../GratsNetwork";

export const { serverPreloadQuery } = createServerEnvironment(
  () =>
    new Environment({
      isServer: true,
      network: gratsNetwork,
      store: new Store(new RecordSource()),
    }),
);
```

## Page

The query is defined in the Client Component's module, so the server imports
its generated artifact.

```tsx title="Page.tsx"
import Profile from "./Profile";
import { serverPreloadQuery } from "./ServerEnvironment";
import ProfileQuery from "./__generated__/ProfileQuery.graphql";
import type { ProfileQuery as ProfileQueryType } from "./__generated__/ProfileQuery.graphql";

export default function Page() {
  return (
    <main>
      <Profile queryRef={serverPreloadQuery<ProfileQueryType>(ProfileQuery, {})} />
    </main>
  );
}
```

## Profile

```tsx title="Profile.tsx"
"use client";

import { useMutation } from "react-relay";
import { useQueryFromServer } from "react-relay/rsc-client_EXPERIMENTAL";
import type { PreloadedQueryRef } from "react-relay/rsc-client_EXPERIMENTAL";
import { graphql } from "relay-runtime";
import type { ProfileQuery } from "./__generated__/ProfileQuery.graphql";
import type { ProfileLikeMutation } from "./__generated__/ProfileLikeMutation.graphql";

export default function Profile(props: {
  queryRef: PreloadedQueryRef<ProfileQuery["variables"], ProfileQuery["response"]>;
}) {
  const data = useQueryFromServer<ProfileQuery>(
    graphql`
      query ProfileQuery {
        viewer {
          id
          name
          likes
        }
      }
    `,
    props.queryRef,
  );
  const [commitLike] = useMutation<ProfileLikeMutation>(graphql`
    mutation ProfileLikeMutation {
      like {
        id
        likes
      }
    }
  `);
  return (
    <p>
      {data.viewer?.name} has {data.viewer?.likes} likes{" "}
      <button onClick={() => commitLike({ variables: {} })}>Like</button>
    </p>
  );
}
```

## Steps

```steps
wait "Ada has 0 likes"
requests "POST /graphql" 0
click button "Like"
wait "Ada has 1 likes"
requests "POST /graphql" 1
```
