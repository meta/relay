# Garbage Collection — Optimistic Update

The user follows Bob, and the optimistic response shows "Following" at once.
While an optimistic update is applied, Relay holds garbage collection, so
the user can leave Bob's profile and come back to it from the store, still
"Following", with no request. When the mutation completes, Relay releases
the hold and runs the collection it postponed, which removes Bob's record.
Opening his profile again fetches the server's state.

The store keeps no released queries (`gcReleaseBufferSize: 0`), so each
release starts a collection unless one is held. The network keeps mutation
requests until "Send pending mutation" is clicked, to keep the optimistic
update applied while the user navigates.

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
  isFollowing: boolean;
};

let followingBob = false;

/** @gqlQueryField */
export function user(args: { id: ID }): User {
  console.log(`server: user(id: "${args.id}")`);
  return { id: "bob", name: "Bob", isFollowing: followingBob };
}

/** @gqlMutationField */
export function follow(args: { id: ID }): User {
  console.log(`server: follow(id: "${args.id}")`);
  followingBob = true;
  return { id: "bob", name: "Bob", isFollowing: followingBob };
}
```

## App

```tsx title="App.tsx"
import { Suspense, useState, useSyncExternalStore } from "react";
import {
  RelayEnvironmentProvider,
  useLazyLoadQuery,
  useMutation,
} from "react-relay";
import {
  graphql,
  Environment,
  LogEvent,
  Network,
  Observable,
  RecordSource,
  Store,
} from "relay-runtime";
import { gratsNetwork } from "../GratsNetwork";
import { AppProfileQuery } from "./__generated__/AppProfileQuery.graphql";
import { AppFollowMutation } from "./__generated__/AppFollowMutation.graphql";

let recordsBeforeGC: string[] = [];
let gcCount = 0;
const gcListeners = new Set<() => void>();

// Relay gives each mutation's root record a generated ID (`client:local:<n>`)
// that counts mutations across the whole test run, so the log leaves it out.
function recordIDs(): string[] {
  return store
    .getSource()
    .getRecordIDs()
    .filter((id) => !id.startsWith("client:local:"));
}

function logGC(event: LogEvent) {
  if (event.name === "store.gc.start") {
    recordsBeforeGC = recordIDs();
  } else if (event.name === "store.gc.end") {
    const kept = recordIDs().sort();
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

const pendingMutations: Array<() => void> = [];

const network = Network.create((request, variables, cacheConfig) => {
  if (request.operationKind !== "mutation") {
    return gratsNetwork.execute(request, variables, cacheConfig);
  }
  return Observable.create((sink) => {
    pendingMutations.push(() => {
      gratsNetwork.execute(request, variables, cacheConfig).subscribe(sink);
    });
  });
});

const store = new Store(new RecordSource(), {
  gcReleaseBufferSize: 0,
  log: logGC,
});
const environment = new Environment({ network, store });

function Profile() {
  const data = useLazyLoadQuery<AppProfileQuery>(
    graphql`
      query AppProfileQuery {
        user(id: "bob") {
          id
          name
          isFollowing
        }
      }
    `,
    {},
  );
  const [commitFollow] = useMutation<AppFollowMutation>(graphql`
    mutation AppFollowMutation($id: ID!) {
      follow(id: $id) {
        id
        isFollowing
      }
    }
  `);
  if (data.user == null) {
    return null;
  }
  return (
    <main>
      <p>
        {data.user.name}: {data.user.isFollowing ? "Following" : "Not following"}
      </p>
      <button
        onClick={() => {
          console.log("follow: Bob");
          commitFollow({
            variables: { id: "bob" },
            optimisticResponse: { follow: { id: "bob", isFollowing: true } },
          });
        }}
      >
        Follow
      </button>
    </main>
  );
}

export default function TestApp() {
  const [page, setPage] = useState("Home");
  return (
    <RelayEnvironmentProvider environment={environment}>
      <nav>
        {["Home", "Bob"].map((name) => (
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
        <button
          onClick={() => {
            console.log("network: send pending mutation");
            pendingMutations.splice(0).forEach((send) => send());
          }}
        >
          Send pending mutation
        </button>
      </nav>
      <Suspense fallback={<main>Loading profile...</main>}>
        {page === "Bob" ? <Profile /> : <main>Home</main>}
      </Suspense>
      <GCCount />
    </RelayEnvironmentProvider>
  );
}
```

## Steps

```steps
click button "Bob"
wait "Bob: Not following"
click button "Follow"
wait "Bob: Following"
click button "Home"
wait "Garbage collections: 0"
click button "Bob"
wait "Bob: Following"
click button "Home"
click button "Send pending mutation"
wait "Garbage collections: 1"
click button "Bob"
wait "Loading profile..."
wait "Bob: Following"
```
