# Streamed List Items Render as They Arrive

A `@stream` list sends its first item with the rest of the query and each
later item on its own: as one result per item from graphql 16, and as items of
a pending stream from graphql 17.

## Relay Config

```json title="relay.config.json"
{
  "src": "./",
  "schema": "./schema.graphql",
  "language": "typescript"
}
```

## Server

Grats declares `@stream` for the Relay compiler. The second item waits for
the test app's button.

```ts title="server.ts"
import { Int } from "grats";

/** @gqlDirective on FIELD */
export function stream(args: {
  label?: string | null;
  initialCount: Int;
  if?: boolean | null;
}) {}

let sendMore = () => {};
const moreSent = new Promise<void>((resolve) => {
  sendMore = resolve;
});

export function releaseMore(): void {
  sendMore();
}

/** @gqlType */
type Friend = {
  /** @gqlField */
  name: string;
};

/** @gqlQueryField */
export async function* friends(): AsyncIterable<Friend> {
  yield { name: "Ann" };
  await moreSent;
  yield { name: "Bea" };
}
```

## App

```tsx title="App.tsx"
import { Suspense } from "react";
import { RelayEnvironmentProvider, useLazyLoadQuery } from "react-relay";
import { graphql, Environment } from "relay-runtime";
import { gratsNetwork } from "../GratsNetwork";
import { releaseMore } from "./server";
import { AppQuery } from "./__generated__/AppQuery.graphql";

const testEnvironment = new Environment({ network: gratsNetwork });

function Friends() {
  const data = useLazyLoadQuery<AppQuery>(
    graphql`
      query AppQuery {
        friends @stream(initialCount: 1) {
          name
        }
      }
    `,
    {},
  );
  return (
    <div>
      <p>Friends: {(data.friends ?? []).map((friend) => friend.name).join(", ")}</p>
      <button onClick={releaseMore}>Send more</button>
    </div>
  );
}

export default function TestApp() {
  return (
    <RelayEnvironmentProvider environment={testEnvironment}>
      <Suspense fallback={<div>Loading...</div>}>
        <Friends />
      </Suspense>
    </RelayEnvironmentProvider>
  );
}
```

## Steps

```steps
wait "Friends: Ann"
click button "Send more"
wait "Friends: Ann, Bea"
```
