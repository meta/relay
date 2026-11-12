# Server Query Hands Off `@no_inline` Client Fragments with Arguments

A `@server` query hands off the same client fragment with a literal argument,
a variable, a variable whose value is `null`, and the argument's default, and
a client fragment with a provided variable. The client fragment's argument `$scale` has
the same name as the operation variable `$scale`, which a fragment it spreads
reads. The client fragments are `@no_inline`, so the server query's
normalization spreads their normalization operations and binds the
arguments at runtime. The server Store and each client read keep every
value apart.

## Relay Config

```json title="relay.config.json"
{
  "src": "./",
  "schema": "./schema.graphql",
  "language": "typescript",
  "featureFlags": {
    "enable_relay_rsc": true,
    "no_inline": { "kind": "enabled" }
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

/** @gqlType */
type User = {
  /** @gqlField */
  id: ID;
};

/** @gqlField */
export function picture(_: User, args: { size?: Int | null }): string {
  return `pic@${args.size ?? "null"}`;
}

/** @gqlQueryField */
export function user(args: { id: ID }): User {
  return { id: args.id };
}
```

## Page

```tsx title="Page.tsx"
import { graphql } from "relay-runtime";
import { serverQuery } from "../RelayRscHost";
import PictureCard from "./PictureCard";
import ProvidedCard from "./ProvidedCard";
import type { PageQuery } from "./__generated__/PageQuery.graphql";

export default async function Page() {
  const data = await serverQuery<PageQuery>(
    graphql`
      query PageQuery($scale: Int, $nothing: Int) @server {
        literal: user(id: "1") {
          ...PictureCard_user @arguments(scale: 2) @alias(as: "card")
        }
        variable: user(id: "2") {
          ...PictureCard_user @arguments(scale: $scale) @alias(as: "card")
        }
        nullVariable: user(id: "3") {
          ...PictureCard_user @arguments(scale: $nothing) @alias(as: "card")
        }
        byDefault: user(id: "4") {
          ...PictureCard_user @alias(as: "card")
        }
        provided: user(id: "5") {
          ...ProvidedCard_user @alias(as: "card")
        }
      }
    `,
    { scale: 5, nothing: null },
  );
  return (
    <main>
      {data.literal ? <PictureCard label="literal" user={data.literal.card} /> : null}
      {data.variable ? <PictureCard label="variable" user={data.variable.card} /> : null}
      {data.nullVariable ? <PictureCard label="null" user={data.nullVariable.card} /> : null}
      {data.byDefault ? <PictureCard label="default" user={data.byDefault.card} /> : null}
      {data.provided ? <ProvidedCard user={data.provided.card} /> : null}
    </main>
  );
}
```

## Picture Card

```tsx title="PictureCard.tsx"
"use client";

import { useFragment } from "react-relay";
import { graphql } from "relay-runtime";
import Avatar from "./Avatar";
import type { PictureCard_user$key } from "./__generated__/PictureCard_user.graphql";

export default function PictureCard(props: {
  label: string;
  user: PictureCard_user$key;
}) {
  const user = useFragment(
    graphql`
      fragment PictureCard_user on User
      @no_inline
      @argumentDefinitions(scale: { type: "Int", defaultValue: 1 }) {
        local: picture(size: $scale)
        ...Avatar_user
      }
    `,
    props.user,
  );
  return (
    <p>
      {props.label}: {user.local} <Avatar user={user} />
    </p>
  );
}
```

## Avatar

```tsx title="Avatar.tsx"
"use client";

import { useFragment } from "react-relay";
import { graphql } from "relay-runtime";
import type { Avatar_user$key } from "./__generated__/Avatar_user.graphql";

export default function Avatar(props: { user: Avatar_user$key }) {
  const user = useFragment(
    graphql`
      fragment Avatar_user on User {
        global: picture(size: $scale)
      }
    `,
    props.user,
  );
  return <span>(operation {user.global})</span>;
}
```

## Provided Card

```tsx title="ProvidedCard.tsx"
"use client";

import { useFragment } from "react-relay";
import { graphql } from "relay-runtime";
import type { ProvidedCard_user$key } from "./__generated__/ProvidedCard_user.graphql";

export default function ProvidedCard(props: { user: ProvidedCard_user$key }) {
  const user = useFragment(
    graphql`
      fragment ProvidedCard_user on User
      @no_inline
      @argumentDefinitions(
        size: { type: "Int", provider: "./SizeProvider.relayprovider" }
      ) {
        picture(size: $size)
      }
    `,
    props.user,
  );
  return <p>provided: {user.picture}</p>;
}
```

## Size Provider

```ts title="SizeProvider.relayprovider.ts"
export default {
  get(): number {
    return 7;
  },
};
```

## Hosts

```hosts
nextjs
cometjs
```

## Steps

```steps
wait "provided: pic@7"
```
