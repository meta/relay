# Server Component Fixtures

A fixture with a `Page.tsx` instead of an `App.tsx` tests Relay with React Server Components across real process boundaries, with real React Flight (`react-server-dom-webpack`). Read [writing-fixtures.md](writing-fixtures.md) first; everything there still applies. `fixtures/rsc/` holds the examples.

## How it runs

```
jest (browser realm: jsdom)       SSR process                  RSC process
                                  node                         node --conditions=react-server
GET / ─────────────────────────▶  GET /page ─────────────────▶ Page.tsx → Server Components
                                  ◀──── Flight stream ──────── 'use client' → client references
                                  render to HTML (react-dom/server)
◀─ HTML + inline Flight stream ──
hydrate the HTML from the Flight stream
navigate "?id=2" ─────── GET /page?id=2 ─────────────────────▶ (Flight)
Relay network ────────── POST /graphql ──────────────────────▶ the fixture's Grats schema
```

The reference host (`src/rsc/referenceHost.server.js`) is App Router-like:

- The initial page load is server-rendered. The SSR process decodes the Flight stream with React's client build, renders it to HTML, and sends a document carrying the HTML and, in inline scripts, the same Flight stream. The browser realm hydrates that HTML, so a hydration mismatch shows up in `## Console` as a `Recoverable error`.
- The HTML is the complete render. A fixture whose steps `release` a gate gets the shell instead (gated content cannot finish first); the boundaries still pending then stream in as react-dom/server writes them, and hydrate.
- A navigation fetches the new page's Flight stream and renders it in a transition, keeping the browser's Relay Environment.
- A module whose directive prologue has `'use client'` is a client module, wherever it lives: fixture files, Relay's own entry points, and generated files under `__generated__/`. In the RSC process, requiring one returns a client reference; the SSR process and the browser load the real module. A module that only server code imports never loads in the browser (see `## Browser Modules`).
- Both server processes compile fixture and Relay source with jest's babel plugins, so Relay runs from source in all three realms.
- The host gives each client realm a Relay Environment: the browser one per page session, the SSR one per request. Both send queries and mutations to the RSC process's `POST /graphql`; subscriptions are not supported.

## Files

| File | Role |
|---|---|
| `Page.tsx` | Default-exports the page, a Server Component. Receives `{searchParams}` |
| `*.tsx` without `'use client'` | Server Components and server-only modules |
| `*.tsx` with `'use client'` | Client Components |

Server Components use the Relay RSC API directly. Create the server environment once, in a module the server files share; `React.cache` scopes its Relay Environment to the request:

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

`../RelayRscHost` is the API a framework adapter would export instead, bound by the host to the current request:

```ts
import { serverQuery, useServerFragment, waitForGate } from "../RelayRscHost";
```

`serverQuery(query, variables)` and `useServerFragment(fragment, ref)` call the methods of the same name on the host's own `createServerEnvironment()`, and throw while it has none. `useServerFragment` is synchronous: call it from a synchronous Server Component.

## Hosts

A `hosts` block runs the fixture once per host, compiled with `relayRsc.mode` set to that host, against the one `.snap.md`; every host must also match the first host's output exactly. Without one the fixture runs once, under its config's `relayRsc.mode` (default `nextjs`).

````markdown
```hosts
nextjs
cometjs
```
````

Both hosts serve Server Components the same way. `nextjs` creates one server environment and leaves request scoping to `React.cache`; `cometjs` owns request state and creates one per request. Client-rooted RSC operations are not implemented.

## Gates

`waitForGate(name)` resolves when the steps run `release "name"`. Await it in a resolver or a Server Component to hold back part of a response, and assert the state before it arrives. A gate opens once, for the life of the fixture:

````markdown
```steps
wait "Loading notes..."
release "notes"
wait "Notes: Prefers analytical engines."
```
````

## Steps

On top of `click`, `type`, and `wait` (which polls for 5 seconds here, rather than 1):

| Action | Description |
|---|---|
| `navigate "?id=2"` | Render the page for new search params, in a transition |
| `release "name"` | Open a gate |
| `wire-excludes "text"` | Assert the browser has not received `text`, also JSON- or HTML-escaped: use it for server-only fields, arguments, and variables |
| `requests "POST /graphql" 0` | Assert how many such requests the browser has sent, e.g. none while hydrating |
| `outlined-rows 0` | Assert how many outlined rows the latest page's Flight response has |

`wire-excludes` waits for every response so far to complete, and `outlined-rows` for the latest page's, so place them after the `release` steps their responses wait on.

The wire is every byte the browser received: the document, the decoded Flight stream inside it, later Flight responses, and GraphQL responses. The RSC process runs React's development build, whose Flight output also carries debug information, including the props each Server Component received; `wire-excludes` sees those bytes too.

An outlined row is a part of the tree, or a promise, that React Flight streams on its own, behind a lazy or promise reference: an async Server Component, a suspended one, or a promise passed to a Client Component. A tree of synchronous Server Components whose data is all present has none. `countFlightRows` in `src/rsc/wireProtocol.js` counts them as a production build would send them, reading through the rows only the development build adds; use it outside a fixture too.

## Snapshot sections

In addition to `## Type Errors`, `## Console` (the browser realm's console), and `## HTML`:

| Section | Contents |
|---|---|
| `## Server Console` | Output of the RSC (`rsc:`) and SSR (`ssr:`) processes, without file paths or stack frames; omitted when empty. A server render that sent a GraphQL request logs `ssr: POST /graphql <Name>` |
| `## Network` | Every request the browser made: `METHOD /path label -> status content-type` |
| `## Browser Modules` | Every fixture module the browser evaluated, and every module it loaded for a client reference; omitted when none |
| `## SSR HTML` | The HTML of the initial page load, before hydration |

## Debugging

A failing fixture reports the browser console and both server processes' output with its error. `RELAY_E2E_KEEP_TEMP_DIR=1` keeps each fixture's compiled temp dir and prints its path.
