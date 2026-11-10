// expected-to-throw
# Garbage Collection — Live Resolver Behind an Abstract Client Edge

This fixture pins a known garbage collection bug: it shows the CURRENT, buggy
behavior. Its first line marks it as expected to throw, so it passes only
while the bug makes the app throw. When the bug is fixed, the fixture stops
throwing and fails. Then remove the first line and update the snapshot.

The wizard query reads `Query.currentStep`, a client edge to the client
interface `WizardStep`, and the `@live` field `MediaStep.photo` behind that
edge. `photo` reads an upload store outside Relay. While an upload runs, it
returns the suspense sentinel, so the wizard suspends.

The wizard query stays mounted, so garbage collection must keep the records
that it reads. But garbage collection does not yet keep the records behind a
client edge to an abstract client type (see the TODO in
`RelayReferenceMarker`). The sequence:

1. The user starts an upload, and the wizard suspends on `photo`.
2. The user opens and closes the settings page. This releases the settings
   query, and the collection that follows keeps `client:root:$r:currentStep`
   but removes `client:MediaStep:media` and its resolver records. Removing
   the `photo` record unsubscribes it from the upload store.
3. The upload finishes. React renders the suspended wizard again. The wizard
   still holds the ID of the removed `photo` record, so Relay throws
   `Expected to find record for live resolver.` Nothing catches the error, so
   React unmounts the app.

The last step waits for the uploaded photo, which is what the user sees when
the bug is fixed.

The store keeps no released queries (`gcReleaseBufferSize: 0`), so each
release starts a collection.

## Relay Config

The feature flag lets a client edge point to a client interface.

```json title="relay.config.json"
{
  "src": "./",
  "schema": "./schema.graphql",
  "schemaExtensions": ["./schema-extensions"],
  "language": "typescript",
  "featureFlags": {
    "relay_resolver_enable_interface_output_type": { "kind": "enabled" }
  }
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

## Schema Extension

```graphql title="schema-extensions/extension.graphql"
interface WizardStep {
  id: ID!
  title: String
}
```

## Wizard Steps

An upload store outside Relay, the resolver type `MediaStep` that implements
`WizardStep`, and the client edge `Query.currentStep`.

```ts title="WizardSteps.ts"
import { suspenseSentinel } from "relay-runtime";
import type { LiveState } from "relay-runtime";

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
 * @relayType MediaStep implements WizardStep
 */
export function MediaStep(id: string): { id: string } {
  return { id };
}

/**
 * @relayField MediaStep.title: String
 */
export function title(_step: { id: string }): string {
  return "Media";
}

/**
 * @relayField MediaStep.photo: String
 * @live
 */
export function photo(_step: { id: string }): LiveState<string> {
  return {
    read: () => {
      if (upload === "uploading") {
        return suspenseSentinel();
      }
      return upload === "done" ? "photo.jpg" : "none";
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

/**
 * @relayField Query.currentStep: WizardStep
 */
export function currentStep(): { id: string; __typename: "MediaStep" } {
  return { id: "media", __typename: "MediaStep" };
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
import { finishUpload, startUpload } from "./WizardSteps";
import { AppWizardQuery } from "./__generated__/AppWizardQuery.graphql";
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

function Wizard() {
  const data = useLazyLoadQuery<AppWizardQuery>(
    graphql`
      query AppWizardQuery {
        viewer {
          id
          name
        }
        currentStep {
          title
          ... on MediaStep {
            photo
          }
        }
      }
    `,
    {},
  );
  return (
    <main>
      {data.viewer?.name}, {data.currentStep?.title} step:{" "}
      {data.currentStep?.photo}
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
      <Suspense fallback={<main>Loading wizard...</main>}>
        <Wizard />
      </Suspense>
      <Pages />
      <GCCount />
    </RelayEnvironmentProvider>
  );
}
```

## Steps

```steps
wait "Alice, Media step: none"
click button "Upload photo"
wait "Loading wizard..."
click button "Settings"
wait "Theme: dark"
click button "Home"
wait "Garbage collections: 1"
click button "Finish upload"
wait "Alice, Media step: photo.jpg"
```
