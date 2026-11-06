# Fragment Argument Object With A Variable

A fragment spread passes an object literal to a fragment argument, mixing a
query variable (`name: $name`) with a literal value (`salutation: "Hello"`).
The compiler must count `$name` as used, and the runtime must send both
values to the server.

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
/** @gqlInput */
export type GreetingInput = {
  name: string;
  salutation: string;
};

/** @gqlQueryField */
export function greet(args: { input: GreetingInput }): string {
  return `${args.input.salutation}, ${args.input.name}!`;
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
import { graphql, Environment } from "relay-runtime";
import { gratsNetwork } from "../GratsNetwork";
import { AppTestQuery } from "./__generated__/AppTestQuery.graphql";
import { App_greeter$key } from "./__generated__/App_greeter.graphql";

const testEnvironment = new Environment({ network: gratsNetwork });

function Greeter({ query }: { query: App_greeter$key }) {
  const data = useFragment(
    graphql`
      fragment App_greeter on Query
      @argumentDefinitions(greeting: { type: "GreetingInput!" }) {
        greet(input: $greeting)
      }
    `,
    query,
  );
  return <div>{data.greet}</div>;
}

function Greeting() {
  const data = useLazyLoadQuery<AppTestQuery>(
    graphql`
      query AppTestQuery($name: String!) {
        ...App_greeter
          @arguments(greeting: { name: $name, salutation: "Hello" })
      }
    `,
    { name: "Jordan" },
  );
  return <Greeter query={data} />;
}

export default function TestApp() {
  return (
    <RelayEnvironmentProvider environment={testEnvironment}>
      <Suspense fallback={<div>Loading...</div>}>
        <Greeting />
      </Suspense>
    </RelayEnvironmentProvider>
  );
}
```

## Steps

```steps
wait "Hello, Jordan!"
```
