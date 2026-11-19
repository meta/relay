# Server Query Hands Off Client Fragments with Arguments and Provider-Backed @module Data

A `@server` query hands off one client fragment twice, with a literal
argument and an operation variable. The fragment passes its argument to the
field that selects `@module` data, whose modules are loaded by module
providers. The server query's normalization inlines the client
fragment with its arguments applied, so the server's records hold the
query's own providers. The browser gets the providers of the client
fragment's generated `'use client'` module instead, and each card renders the
module data for its own argument. The browser loads only the branch the cards
render, and no module for the client fragment's split operation.

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

/** @gqlUnion */
type NameRenderer = PlainTextRenderer | MarkdownRenderer;

/** @gqlType */
type PlainTextRenderer = {
  __typename: "PlainTextRenderer";
  /** @gqlField */
  text: string;
};

/** @gqlType */
type MarkdownRenderer = {
  __typename: "MarkdownRenderer";
  /** @gqlField */
  markdown: string;
};

/** @gqlType */
type User = {
  /** @gqlField */
  id: ID;
};

/** @gqlField */
export function nameRenderer(
  _: User,
  args: { size?: Int | null },
): NameRenderer {
  return { __typename: "PlainTextRenderer", text: `text@${args.size ?? "null"}` };
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
import RendererCard from "./RendererCard";
import type { PageQuery } from "./__generated__/PageQuery.graphql";

export default async function Page() {
  const data = await serverQuery<PageQuery>(
    graphql`
      query PageQuery($scale: Int) @server {
        literal: user(id: "1") {
          ...RendererCard_user @arguments(scale: 2) @alias(as: "card")
        }
        variable: user(id: "2") {
          ...RendererCard_user @arguments(scale: $scale) @alias(as: "card")
        }
      }
    `,
    { scale: 5 },
  );
  return (
    <main>
      {data.literal ? <RendererCard label="literal" user={data.literal.card} /> : null}
      {data.variable ? <RendererCard label="variable" user={data.variable.card} /> : null}
    </main>
  );
}
```

## Renderer Card

```tsx title="RendererCard.tsx"
"use client";

import React, { Suspense } from "react";
import { useFragment } from "react-relay";
import MatchContainerModule from "react-relay/relay-hooks/MatchContainer";
import { graphql } from "relay-runtime";
import type { RendererCard_user$key } from "./__generated__/RendererCard_user.graphql";

const MatchContainer = MatchContainerModule as unknown as React.ComponentType<any>;

const lazyCache = new Map<unknown, React.ComponentType<any>>();

function moduleLoader(provider: unknown): React.ComponentType<any> {
  if (!lazyCache.has(provider)) {
    lazyCache.set(
      provider,
      React.lazy(provider as () => Promise<{ default: React.ComponentType<any> }>),
    );
  }
  return lazyCache.get(provider)!;
}

export default function RendererCard(props: {
  label: string;
  user: RendererCard_user$key;
}) {
  const user = useFragment(
    graphql`
      fragment RendererCard_user on User
      @argumentDefinitions(scale: { type: "Int", defaultValue: 1 }) {
        nameRenderer(size: $scale) {
          ...PlainTextRendererView_name @module(name: "./PlainTextRendererView")
          ...MarkdownRendererView_name @module(name: "./MarkdownRendererView")
        }
      }
    `,
    props.user,
  );
  return (
    <section>
      {props.label}:{" "}
      <Suspense fallback="Loading renderer">
        <MatchContainer match={user.nameRenderer} loader={moduleLoader} />
      </Suspense>
    </section>
  );
}
```

## Markdown Renderer

```tsx title="MarkdownRendererView.tsx"
import { useFragment } from "react-relay";
import { graphql } from "relay-runtime";

export default function MarkdownRendererView(props: any) {
  const data = useFragment(
    graphql`
      fragment MarkdownRendererView_name on MarkdownRenderer {
        markdown
      }
    `,
    props.name,
  );
  return <span>Markdown: {data.markdown}</span>;
}
```

## Plain Text Renderer

```tsx title="PlainTextRendererView.tsx"
import { useFragment } from "react-relay";
import { graphql } from "relay-runtime";

export default function PlainTextRendererView(props: any) {
  const data = useFragment(
    graphql`
      fragment PlainTextRendererView_name on PlainTextRenderer {
        text
      }
    `,
    props.name,
  );
  return <span>Plain: {data.text}</span>;
}
```

## Hosts

```hosts
nextjs
cometjs
```

## Steps

```steps
wait "Plain: text@2"
wait "Plain: text@5"
eval "modules.filter(name => name.includes('RendererCard_'))"
eval "modules.filter(name => name.includes('RendererView'))"
```
