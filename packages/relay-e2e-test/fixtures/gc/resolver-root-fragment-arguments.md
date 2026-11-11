// expected-to-throw
# Garbage Collection — Live Resolver With Root Fragment Arguments

This fixture pins a known garbage collection bug: it shows the CURRENT, buggy
behavior. Its first line marks it as expected to throw, so it passes only
while the bug makes the app throw. When the bug is fixed, the fixture stops
throwing and fails. Then remove the first line and update the snapshot.

The profile query reads `User.avatar(size: 64)`, a `@live` resolver. Its root
fragment takes the `size` argument (as in "Passing Arguments to your
@rootFragment" in the Relay Resolvers guide) and reads the server field
`profilePicture(size: $size)`. `avatar` also reads an upload store outside
Relay. While an upload runs, it returns the suspense sentinel, so the profile
suspends.

The profile query stays mounted, so garbage collection must keep the records
that it reads. `RelayReferenceMarker` finds a resolver's record with the
storage key of the resolver field in the operation's normalization AST. For a
resolver with root fragment arguments, that field has no arguments
(`args: null`), so the marker looks for `$r:avatar`. The reader stored the
record at `$r:avatar(size:64)`, so the marker does not keep it. The sequence:

1. The user starts an upload, and the profile suspends on `avatar`.
2. The user opens and closes the settings page. This releases the settings
   query, and the collection that follows keeps `alice` but removes
   `client:alice:$r:avatar(size:64)`. Removing the record unsubscribes it from
   the upload store.
3. The upload finishes. React renders the suspended profile again. The profile
   still holds the ID of the removed record, so Relay throws
   `Expected to find record for live resolver.` Nothing catches the error, so
   React unmounts the app.

The last step waits for the uploaded photo, which is what the user sees when
the bug is fixed. The same steps pass without the collection, and also when
`size` is a runtime argument of `avatar` instead of a root fragment argument.

The store keeps no released queries (`gcReleaseBufferSize: 0`), so each
release starts a collection.

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
import type { ID, Int } from "grats";

/** @gqlType */
type User = {
  /** @gqlField */
  id: ID;
  /** @gqlField */
  name: string;
};

/** @gqlField */
export function profilePicture(user: User, args: { size: Int }): string {
  return `${user.id}-${args.size}.jpg`;
}

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

## Avatar

An upload store outside Relay, and the live resolver `User.avatar`.

```ts title="Avatar.ts"
import { graphql, readFragment, suspenseSentinel } from "relay-runtime";
import type { LiveState } from "relay-runtime";
import { AvatarFragment$key } from "./__generated__/AvatarFragment.graphql";

let upload: "none" | "uploading" | "done" = "none";
const listeners = new Set<() => void>();

function updateUpload(next: "none" | "uploading" | "done") {
  upload = next;
  listeners.forEach((listener) => listener());
}

export function startUpload() {
  updateUpload("uploading");
}

export function finishUpload() {
  updateUpload("done");
}

/**
 * @relayField User.avatar: String
 * @rootFragment AvatarFragment
 * @live
 */
export function avatar(
  key: AvatarFragment$key,
): LiveState<string | null | undefined> {
  const user = readFragment(
    graphql`
      fragment AvatarFragment on User
      @argumentDefinitions(size: { type: "Int!" }) {
        profilePicture(size: $size)
      }
    `,
    key,
  );
  return {
    read: () => {
      if (upload === "uploading") {
        return suspenseSentinel();
      }
      return upload === "done" ? "photo.jpg" : user.profilePicture;
    },
    subscribe: (callback) => {
      listeners.add(callback);
      console.log(`uploads: subscribed (listeners: ${listeners.size})`);
      return () => {
        listeners.delete(callback);
        console.log(`uploads: unsubscribed (listeners: ${listeners.size})`);
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
import { finishUpload, startUpload } from "./Avatar";
import { AppProfileQuery } from "./__generated__/AppProfileQuery.graphql";
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

function Profile() {
  const data = useLazyLoadQuery<AppProfileQuery>(
    graphql`
      query AppProfileQuery {
        viewer {
          id
          name
          avatar(size: 64)
        }
      }
    `,
    {},
  );
  return (
    <main>
      {data.viewer?.name}: {data.viewer?.avatar}
    </main>
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
  return <aside>Theme: {data.settings?.theme}</aside>;
}

function Pages() {
  const [page, setPage] = useState("Home");
  return (
    <>
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
      <Suspense fallback={<aside>Loading settings...</aside>}>
        {page === "Settings" ? <SettingsPage /> : null}
      </Suspense>
    </>
  );
}

export default function TestApp() {
  return (
    <RelayEnvironmentProvider environment={environment}>
      <button
        onClick={() => {
          console.log("uploads: start");
          startUpload();
        }}
      >
        Upload photo
      </button>
      <button
        onClick={() => {
          console.log("uploads: finish");
          finishUpload();
        }}
      >
        Finish upload
      </button>
      <Suspense fallback={<main>Loading profile...</main>}>
        <Profile />
      </Suspense>
      <Pages />
      <GCCount />
    </RelayEnvironmentProvider>
  );
}
```

## Steps

```steps
wait "Alice: alice-64.jpg"
click button "Upload photo"
wait "Loading profile..."
click button "Settings"
wait "Theme: dark"
click button "Home"
wait "Garbage collections: 1"
click button "Finish upload"
wait "Alice: photo.jpg"
```
