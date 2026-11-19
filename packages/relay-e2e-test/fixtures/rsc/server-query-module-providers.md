# Server Query Hands Off @module Data Loaded by Module Providers

A Client Component's fragment, handed off by a `@server` query, selects
`@module` data. Without Haste, the compiler names each branch's component and
normalization by module providers (`() => import(...)`), and the server's
normalizer writes those functions into the record. Functions cannot cross to
the browser: the handoff sends client references to the client fragment's
generated `'use client'` providers module in their place, and the browser
receives that module's providers. `MatchContainer` then loads the branch's
component with that provider, and the browser loads the branch's
normalization with its operation provider. The browser loads only the branch
it renders, and no module for the client fragment's split operation, which the
handoff carries inline. The server-only field never reaches the browser.

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
/** @gqlUnion */
type NameRenderer = PlainTextRenderer | MarkdownRenderer;

/** @gqlType */
type PlainTextRenderer = {
  __typename: "PlainTextRenderer";
  /** @gqlField */
  plaintext: string;
};

/** @gqlType */
type MarkdownRenderer = {
  __typename: "MarkdownRenderer";
  /** @gqlField */
  markdown: string;
};

/** @gqlType */
type Viewer = {
  /** @gqlField */
  secretNote: string;
  /** @gqlField */
  nameRenderer: NameRenderer;
};

/** @gqlQueryField */
export function viewer(): Viewer {
  return {
    secretNote: "Note only the server reads",
    nameRenderer: {
      __typename: "MarkdownRenderer",
      markdown: "**Ada**",
    },
  };
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
      query PageQuery @server {
        viewer {
          secretNote
          ...RendererCard_viewer @alias(as: "card")
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
      <p>The server read a {viewer.secretNote?.length}-character note.</p>
      <RendererCard viewer={viewer.card} />
    </main>
  );
}
```

## Renderer Card

`MatchContainer`'s loader receives the component provider from the providers
module, which `React.lazy` loads.

```tsx title="RendererCard.tsx"
"use client";

import React, { Suspense } from "react";
import { useFragment } from "react-relay";
import MatchContainerModule from "react-relay/relay-hooks/MatchContainer";
import { graphql } from "relay-runtime";
import type { RendererCard_viewer$key } from "./__generated__/RendererCard_viewer.graphql";

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

export default function RendererCard(props: { viewer: RendererCard_viewer$key }) {
  const viewer = useFragment(
    graphql`
      fragment RendererCard_viewer on Viewer {
        nameRenderer {
          ...PlainTextRendererView_name @module(name: "./PlainTextRendererView")
          ...MarkdownRendererView_name @module(name: "./MarkdownRendererView")
        }
      }
    `,
    props.viewer,
  );
  return (
    <section>
      <Suspense fallback="Loading renderer">
        <MatchContainer match={viewer.nameRenderer} loader={moduleLoader} />
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
  return <div>Markdown: {data.markdown}</div>;
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
        plaintext
      }
    `,
    props.name,
  );
  return <div>Plain: {data.plaintext}</div>;
}
```

## Hosts

```hosts
nextjs
cometjs
```

## Steps

```steps
wait "Markdown: **Ada**"
wire-excludes "Note only the server reads"
eval "modules.filter(name => name.includes('RendererCard_'))"
eval "modules.filter(name => name.includes('RendererView'))"
```
