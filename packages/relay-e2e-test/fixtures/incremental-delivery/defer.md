# Deferred Fragments Arrive After the Rest of the Query

A query defers a fragment whose only field the query already selects, and that
fragment defers another, which repeats that field and has a field that fails.
graphql 17 sends no result for the outer fragment, leaves the repeated field
out of the inner one, and gives the error's path from the root of the
response. graphql 16 sends both fragments whole, also with root paths. Either
way the inner fragment renders once its result arrives, with the error on its
field.

## Relay Config

```json title="relay.config.json"
{
  "src": "./",
  "schema": "./schema.graphql",
  "language": "typescript"
}
```

## Server

Grats declares `@defer` for the Relay compiler. The deferred fields wait for
the test app's button.

```ts title="server.ts"
/** @gqlDirective on FRAGMENT_SPREAD | INLINE_FRAGMENT */
export function defer(args: { label?: string | null; if?: boolean | null }) {}

let sendBio = () => {};
const bioSent = new Promise<void>((resolve) => {
  sendBio = resolve;
});

export function releaseBio(): void {
  sendBio();
}

/** @gqlType */
class User {
  /** @gqlField */
  name: string = "Ada";

  /** @gqlField */
  async bio(): Promise<string> {
    await bioSent;
    return "Wrote the first program.";
  }

  /** @gqlField */
  async karma(): Promise<string> {
    await bioSent;
    throw new Error("No karma yet.");
  }
}

/** @gqlQueryField */
export function viewer(): User {
  return new User();
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
import { releaseBio } from "./server";
import { AppBio$key } from "./__generated__/AppBio.graphql";
import { AppName$key } from "./__generated__/AppName.graphql";
import { AppQuery } from "./__generated__/AppQuery.graphql";

const testEnvironment = new Environment({ network: gratsNetwork });

function Bio({ user }: { user: AppBio$key }) {
  const data = useFragment(
    graphql`
      fragment AppBio on User {
        name
        bio
        karma @catch(to: RESULT)
      }
    `,
    user,
  );
  return (
    <p>
      {data.name}: {data.bio} ({data.karma.ok ? data.karma.value : "no karma"})
    </p>
  );
}

function Name({ user }: { user: AppName$key }) {
  const data = useFragment(
    graphql`
      fragment AppName on User {
        name
        ...AppBio @defer
      }
    `,
    user,
  );
  return (
    <>
      <h1>{data.name}</h1>
      <Suspense fallback={<p>Loading bio...</p>}>
        <Bio user={data} />
      </Suspense>
    </>
  );
}

function Viewer() {
  const data = useLazyLoadQuery<AppQuery>(
    graphql`
      query AppQuery {
        viewer {
          name
          ...AppName @defer
        }
      }
    `,
    {},
  );
  if (data.viewer == null) {
    return null;
  }
  return (
    <div>
      <Name user={data.viewer} />
      <button onClick={releaseBio}>Send the bio</button>
    </div>
  );
}

export default function TestApp() {
  return (
    <RelayEnvironmentProvider environment={testEnvironment}>
      <Suspense fallback={<div>Loading...</div>}>
        <Viewer />
      </Suspense>
    </RelayEnvironmentProvider>
  );
}
```

## Steps

```steps
wait "Ada"
wait "Loading bio..."
click button "Send the bio"
wait "Ada: Wrote the first program. (no karma)"
```
