# BUG: a screen goes permanently blank after you leave it mid-refresh

**This fixture records current, broken behaviour.** The snapshot below is the
bug, not the goal. It exists so that the fix can be reviewed as a diff of the
snapshot.

The bug as a user would report it: *"If I open the profile, go back while it's
refreshing, and open it again later, the name is just blank. No spinner, no
error. It stays blank until I reload the page."*

Underneath, `QueryResource` has handed the screen a **zombie** cache entry.

The app has a sidebar showing the user, and a profile screen on
`fetchPolicy: 'store-and-network'` — the usual "show what we have, refresh in
the background" policy. Every step is an ordinary user action:

1. The sidebar loads the user. The store now has the data, and the sidebar
   holds a retain on it.
2. The user opens the profile. It renders instantly from the store and starts a
   background refresh. Because it rendered, `useLazyLoadQueryNode` attached a
   permanent retain.
3. The user goes back before the refresh lands. The effect cleanup disposes the
   cache entry.
4. The refresh lands. Regular (non-live) queries deliberately do **not** cancel
   their request on dispose, so the observable is still subscribed and `next`
   fires on the now-disposed entry. **This is the bug**: `next` calls
   `_getOrCreateCacheEntry`, which re-inserts the disposed entry into the LRU
   with refcount 0. No `useEffect` ever retained it, so none will ever release
   it.
5. The sidebar closes. It was the last retainer, so the store garbage-collects
   the records. The zombie holds no retain, so nothing protects them.
6. The user opens the profile again. It computes the same `cacheIdentifier`,
   finds the zombie, and reuses it — **issuing no request at all**. The fragment
   reader walks into the reclaimed records and `useLazyLoadQuery` returns
   `undefined`. There is no fetch to wait for, no error to catch, and no
   suspense to fall back to, so the screen renders blank and stays blank.

Once a disposed entry stays disposed, step 6 will cache-miss, refetch, and
render `Alice #3`. Until then the snapshot reads `(blank forever)`.

## Relay Config

```json title="relay.config.json"
{
  "src": "./",
  "schema": "./schema.graphql",
  "language": "typescript"
}
```

## Server

Each response is numbered so the rendered name says which request produced it.
The first answers immediately, for the sidebar; every later one blocks on a
gate the app opens by hand, so the fixture controls exactly when the
outstanding refresh lands relative to the user going back.

```ts title="server.ts"
let openGate: () => void = () => {};
const gate = new Promise<void>((resolve) => {
  openGate = resolve;
});

/** Lets the app deliver the outstanding refresh on demand. */
export function deliverPendingResponse(): void {
  openGate();
}

let responsesServed = 0;

/** @gqlType */
export class User {
  /** @gqlField */
  name: string;

  constructor(name: string) {
    this.name = name;
  }
}

/** @gqlQueryField */
export async function user(): Promise<User> {
  responsesServed++;
  if (responsesServed > 1) {
    await gate;
  }
  return new User(`Alice #${responsesServed}`);
}
```

## App

`gcReleaseBufferSize: 0` makes the collection in step 5 immediate rather than
deferred. It changes when the records are reclaimed, not whether — any app busy
enough to cycle the release buffer gets there on its own.

```tsx title="App.tsx"
import { Suspense, useState } from "react";
import { RelayEnvironmentProvider, useLazyLoadQuery } from "react-relay";
import { graphql, Environment, RecordSource, Store } from "relay-runtime";
import { gratsNetwork } from "../GratsNetwork";
import { deliverPendingResponse } from "./server";
import { AppSidebarQuery } from "./__generated__/AppSidebarQuery.graphql";
import { AppProfileQuery } from "./__generated__/AppProfileQuery.graphql";

const testEnvironment = new Environment({
  network: gratsNetwork,
  store: new Store(new RecordSource(), { gcReleaseBufferSize: 0 }),
});

function Sidebar() {
  const data = useLazyLoadQuery<AppSidebarQuery>(
    graphql`
      query AppSidebarQuery {
        user {
          name
        }
      }
    `,
    {},
  );
  return <div>sidebar = {data.user?.name}</div>;
}

function Profile() {
  const data = useLazyLoadQuery<AppProfileQuery>(
    graphql`
      query AppProfileQuery {
        user {
          name
        }
      }
    `,
    {},
    { fetchPolicy: "store-and-network" },
  );
  // `data?.` rather than `data.`: when the zombie is reused the hook returns
  // `undefined` outright, so the ordinary `data.user` a real app would write
  // throws `Cannot read properties of undefined`. Guarded here only so the
  // fixture can render the symptom instead of crashing the tree.
  return <div>name = {data?.user?.name ?? "(blank forever)"}</div>;
}

export default function TestApp() {
  const [profileOpen, setProfileOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  return (
    <RelayEnvironmentProvider environment={testEnvironment}>
      <button onClick={() => setProfileOpen(true)}>Open profile</button>
      <button onClick={() => setProfileOpen(false)}>Back</button>
      <button onClick={() => deliverPendingResponse()}>Deliver refresh</button>
      <button onClick={() => setSidebarOpen(false)}>Close sidebar</button>
      {sidebarOpen ? (
        <Suspense fallback={<div>sidebar loading</div>}>
          <Sidebar />
        </Suspense>
      ) : null}
      {profileOpen ? (
        <Suspense fallback={<div>profile loading</div>}>
          <Profile />
        </Suspense>
      ) : (
        <div>no profile</div>
      )}
    </RelayEnvironmentProvider>
  );
}
```

## Steps

The last visit is the assertion, and it currently asserts the bug. When the
zombie is fixed this becomes `wait "name = Alice #3"` and the snapshot changes
with it.

```steps
wait "sidebar = Alice #1"
click button "Open profile"
wait "name = Alice #1"
click button "Back"
click button "Deliver refresh"
click button "Close sidebar"
click button "Open profile"
wait "(blank forever)"
```
