# Garbage Collection — Navigate Away and Back

A header query stays mounted while the user opens and leaves profile pages.
The store keeps one released query (`gcReleaseBufferSize: 1`), so a profile
query that the user leaves is kept until a second one is released. Then Relay
schedules a garbage collection, and the store's `log` reports what it removed.

The sequence:

1. The header query stays mounted, so every collection keeps its `alice`
   record. Alice's profile shares that record: when her released query leaves
   the release buffer, GC keeps `alice`, so her profile opens again from the
   store, with no request.
2. When Bob's released query leaves the release buffer, GC removes `bob`. Going
   back to his profile fetches it again, exactly once.

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
  /** @gqlField */
  bio: string;
};

const users: { [id: string]: User } = {
  alice: { id: "alice", name: "Alice", bio: "Builds Relay apps" },
  bob: { id: "bob", name: "Bob", bio: "Writes GraphQL servers" },
};

/** @gqlQueryField */
export function viewer(): User {
  console.log("server: viewer");
  return users.alice;
}

/** @gqlQueryField */
export function user(args: { id: ID }): User | null {
  console.log(`server: user(id: "${args.id}")`);
  return users[args.id] ?? null;
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
import { AppHeaderQuery } from "./__generated__/AppHeaderQuery.graphql";
import { AppProfileQuery } from "./__generated__/AppProfileQuery.graphql";

let recordsBeforeGC: string[] = [];
let gcCount = 0;
const gcListeners = new Set<() => void>();

function logGC(event: LogEvent) {
  // Log only while the app is mounted (`GCCount` listens). A query's
  // temporary retain can expire after the harness unmounts the app, and
  // that collection would otherwise log into a later fixture.
  if (event.name === "store.gc.start") {
    recordsBeforeGC = store.getSource().getRecordIDs();
  } else if (event.name === "store.gc.end" && gcListeners.size > 0) {
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
  gcReleaseBufferSize: 1,
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
      }
    `,
    {},
  );
  return <header>Signed in as {data.viewer?.name}</header>;
}

function Profile({ id }: { id: string }) {
  const data = useLazyLoadQuery<AppProfileQuery>(
    graphql`
      query AppProfileQuery($id: ID!) {
        user(id: $id) {
          id
          name
          bio
        }
      }
    `,
    { id },
  );
  return (
    <main>
      {data.user?.name}: {data.user?.bio}
    </main>
  );
}

const pages = [
  { name: "Home", userID: null },
  { name: "Alice", userID: "alice" },
  { name: "Bob", userID: "bob" },
];

export default function TestApp() {
  const [userID, setUserID] = useState<string | null>(null);
  return (
    <RelayEnvironmentProvider environment={environment}>
      <Suspense fallback={<header>Loading header...</header>}>
        <Header />
      </Suspense>
      <nav>
        {pages.map((page) => (
          <button
            key={page.name}
            onClick={() => {
              console.log(`navigate: ${page.name}`);
              setUserID(page.userID);
            }}
          >
            {page.name}
          </button>
        ))}
      </nav>
      <Suspense fallback={<main>Loading profile...</main>}>
        {userID == null ? <main>Home</main> : <Profile id={userID} />}
      </Suspense>
      <GCCount />
    </RelayEnvironmentProvider>
  );
}
```

## Steps

```steps
wait "Signed in as Alice"
click button "Alice"
wait "Alice: Builds Relay apps"
click button "Home"
wait "Garbage collections: 0"
click button "Bob"
wait "Bob: Writes GraphQL servers"
click button "Home"
wait "Garbage collections: 1"
click button "Alice"
wait "Alice: Builds Relay apps"
click button "Home"
wait "Garbage collections: 2"
click button "Bob"
wait "Loading profile..."
wait "Bob: Writes GraphQL servers"
```
