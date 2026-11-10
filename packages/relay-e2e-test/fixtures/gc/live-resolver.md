# Garbage Collection — Live Resolver Subscription

The header reads the `@live` resolver `Query.unreadCount`, which subscribes to
an inbox outside Relay. While the header is mounted, new messages update it,
and a garbage collection keeps its resolver record, so the subscription stays
open. After the user signs out, the header query is released and the next
collection removes the resolver record, which unsubscribes from the inbox.
Signing in again subscribes again and reads the current count.

The store keeps no released queries (`gcReleaseBufferSize: 0`), so each
release starts a collection.

Known limit: garbage collection does not yet keep the records behind a client
edge to an abstract client type (see the TODO in `RelayReferenceMarker`), so
a live resolver behind such an edge can lose its subscription while its query
is mounted. `abstract-client-edge.md` pins that case as an expected runtime
error.

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
import type { ID } from "grats";

/** @gqlType */
type User = {
  /** @gqlField */
  id: ID;
  /** @gqlField */
  name: string;
};

/** @gqlType */
type Settings = {
  /** @gqlField */
  id: ID;
  /** @gqlField */
  theme: string;
};

/** @gqlQueryField */
export function viewer(): User {
  return { id: "alice", name: "Alice" };
}

/** @gqlQueryField */
export function settings(): Settings {
  return { id: "settings", theme: "dark" };
}
```

## Inbox

An inbox outside Relay, and the live resolver that reads it.

```ts title="Inbox.ts"
import type { LiveState } from "relay-runtime";

let unread = 0;
const listeners = new Set<() => void>();

export function receiveMessage() {
  unread += 1;
  listeners.forEach((listener) => listener());
}

/**
 * @relayField Query.unreadCount: Int
 * @live
 */
export function unreadCount(): LiveState<number> {
  return {
    read: () => unread,
    subscribe: (callback) => {
      listeners.add(callback);
      console.log(`inbox: subscribed (listeners: ${listeners.size})`);
      return () => {
        listeners.delete(callback);
        console.log(`inbox: unsubscribed (listeners: ${listeners.size})`);
      };
    },
  };
}
```

## App

```tsx title="App.tsx"
import { Suspense, useState, useSyncExternalStore } from "react";
import { RelayEnvironmentProvider, useLazyLoadQuery } from "react-relay";
import {
  graphql,
  Environment,
  LogEvent,
  RecordSource,
  Store,
} from "relay-runtime";
import { gratsNetwork } from "../GratsNetwork";
import { receiveMessage } from "./Inbox";
import { AppHeaderQuery } from "./__generated__/AppHeaderQuery.graphql";
import { AppSettingsQuery } from "./__generated__/AppSettingsQuery.graphql";

let recordsBeforeGC: string[] = [];
let gcCount = 0;
const gcListeners = new Set<() => void>();

function logGC(event: LogEvent) {
  if (event.name === "store.gc.start") {
    recordsBeforeGC = store.getSource().getRecordIDs();
  } else if (event.name === "store.gc.end") {
    const kept = store.getSource().getRecordIDs().sort();
    const removed = recordsBeforeGC.filter((id) => !kept.includes(id)).sort();
    console.log(
      `gc: removed ${removed.join(", ") || "nothing"}; kept ${kept.join(", ")}`,
    );
    gcCount += 1;
    gcListeners.forEach((listener) => listener());
  }
}

function GCCount() {
  const count = useSyncExternalStore(
    (listener) => {
      gcListeners.add(listener);
      return () => {
        gcListeners.delete(listener);
      };
    },
    () => gcCount,
  );
  return <footer>Garbage collections: {count}</footer>;
}

const store = new Store(new RecordSource(), {
  gcReleaseBufferSize: 0,
  log: logGC,
});
const environment = new Environment({ network: gratsNetwork, store });

function Header() {
  const data = useLazyLoadQuery<AppHeaderQuery>(
    graphql`
      query AppHeaderQuery {
        viewer {
          id
          name
        }
        unreadCount
      }
    `,
    {},
  );
  return (
    <header>
      {data.viewer?.name}: {data.unreadCount} unread
    </header>
  );
}

function SettingsPage() {
  const data = useLazyLoadQuery<AppSettingsQuery>(
    graphql`
      query AppSettingsQuery {
        settings {
          id
          theme
        }
      }
    `,
    {},
  );
  return <main>Theme: {data.settings?.theme}</main>;
}

function SignedIn() {
  const [page, setPage] = useState("Home");
  return (
    <>
      <Suspense fallback={<header>Loading header...</header>}>
        <Header />
      </Suspense>
      <nav>
        {["Home", "Settings"].map((name) => (
          <button
            key={name}
            onClick={() => {
              console.log(`navigate: ${name}`);
              setPage(name);
            }}
          >
            {name}
          </button>
        ))}
      </nav>
      <Suspense fallback={<main>Loading settings...</main>}>
        {page === "Settings" ? <SettingsPage /> : <main>Home</main>}
      </Suspense>
    </>
  );
}

export default function TestApp() {
  const [signedIn, setSignedIn] = useState(true);
  return (
    <RelayEnvironmentProvider environment={environment}>
      <button
        onClick={() => {
          console.log("inbox: new message");
          receiveMessage();
        }}
      >
        Simulate new message
      </button>
      <button
        onClick={() => {
          console.log(signedIn ? "navigate: Sign out" : "navigate: Sign in");
          setSignedIn(!signedIn);
        }}
      >
        {signedIn ? "Sign out" : "Sign in"}
      </button>
      {signedIn ? <SignedIn /> : <main>Signed out</main>}
      <GCCount />
    </RelayEnvironmentProvider>
  );
}
```

## Steps

```steps
wait "Alice: 0 unread"
click button "Simulate new message"
wait "Alice: 1 unread"
click button "Settings"
wait "Theme: dark"
click button "Home"
wait "Garbage collections: 1"
click button "Simulate new message"
wait "Alice: 2 unread"
click button "Sign out"
wait "Garbage collections: 2"
click button "Simulate new message"
click button "Sign in"
wait "Alice: 3 unread"
```
