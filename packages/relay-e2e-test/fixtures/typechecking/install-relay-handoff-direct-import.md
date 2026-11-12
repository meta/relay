# Installing the Handoff Hook From Its Own Module

An app that only reads handed-off references can import `installRelayHandoff`
from its own module, `react-relay/lib/relay-hooks/rsc/installRelayHandoff`,
instead of `react-relay/rsc-client_EXPERIMENTAL`, so it doesn't load the rest
of that entry. That module has its own TypeScript declaration, and the feature
flag Relay RSC requires is typed on `RelayFeatureFlags`. This fixture
typechecks only if both are, and an Environment with the hook installed reads
ordinary fragment references as before.

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
/** @gqlQueryField */
export function greeting(): string {
  return "Hello, Jordan!";
}
```

## App

```tsx title="App.tsx"
import { Suspense } from "react";
import {
  RelayEnvironmentProvider,
  useFragment,
  useLazyLoadQuery,
} from "react-relay";
import installRelayHandoff from "react-relay/lib/relay-hooks/rsc/installRelayHandoff";
import { Environment, RelayFeatureFlags, graphql } from "relay-runtime";
import { gratsNetwork } from "../GratsNetwork";
import type { AppGreeting_query$key } from "./__generated__/AppGreeting_query.graphql";
import type { AppTestQuery } from "./__generated__/AppTestQuery.graphql";

RelayFeatureFlags.ENABLE_EXPLICIT_NULL_FRAGMENT_ARGUMENTS = true;
const testEnvironment = new Environment({ network: gratsNetwork });
installRelayHandoff(testEnvironment);

// Never called: the declaration requires an Environment.
export function installWithoutEnvironment(): void {
  // @ts-expect-error An Environment is required.
  installRelayHandoff();
}

function Greeting(props: { query: AppGreeting_query$key }) {
  const data = useFragment(
    graphql`
      fragment AppGreeting_query on Query {
        greeting
      }
    `,
    props.query,
  );
  return <div>{data.greeting}</div>;
}

function Page() {
  const data = useLazyLoadQuery<AppTestQuery>(
    graphql`
      query AppTestQuery {
        ...AppGreeting_query
      }
    `,
    {},
  );
  return <Greeting query={data} />;
}

export default function TestApp() {
  return (
    <RelayEnvironmentProvider environment={testEnvironment}>
      <Suspense fallback={<div>Loading...</div>}>
        <Page />
      </Suspense>
    </RelayEnvironmentProvider>
  );
}
```

## Steps

```steps
wait "Hello, Jordan!"
```
