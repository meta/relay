# Writing Fixtures

Each test is a `fixtures/<name>.md` file. Fixtures can be organized into subdirectories (e.g. `fixtures/errors/catch.md`). The test name uses the relative path without extension (e.g. `errors/catch`). Snapshots are placed alongside the fixture as `<name>.snap.md`.

Every fixture needs three code blocks:

1. **`relay.config.json`** - Relay compiler configuration
2. **`server.ts`** - Grats schema and resolvers
3. **`App.tsx`** - React component that default-exports the test app

A fixture with a `Page.tsx` instead of an `App.tsx` renders React Server Components through a reference host; see [server-components.md](server-components.md).

Each code block **must** include a `title="<filename>"` attribute on the code fence (e.g. `` ```json title="relay.config.json" ``). The title determines the output filename — the language tag is only for syntax highlighting.

Each code block should be preceded by a `##` heading describing its contents (`## Relay Config`, `## Server`, `## App`, `## Steps`). Additional files get their own descriptive heading (e.g. `## Counter Store`). A short note can be added between the heading and the code block when something is non-obvious.

Keep server code (Grats types, resolvers, directives, server-side state) in `server.ts` and client code (React components, Relay environment/network setup) in `App.tsx`.

## Example fixture

````markdown
# Greeting Query

A basic test: Grats resolver returns a string, Relay fetches it, component renders it.

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
  return "Hello!";
}
```

## App

```tsx title="App.tsx"
import { Suspense } from "react";
import { RelayEnvironmentProvider, useLazyLoadQuery } from "react-relay";
import { graphql, Environment } from "relay-runtime";
import { gratsNetwork } from "../GratsNetwork";
import { AppTestQuery } from "./__generated__/AppTestQuery.graphql";

const testEnvironment = new Environment({ network: gratsNetwork });

function Greeting() {
  const data = useLazyLoadQuery<AppTestQuery>(
    graphql`
      query AppTestQuery {
        greeting
      }
    `,
    {},
  );
  return <div>{data.greeting}</div>;
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
wait "Hello!"
```
````

## Server code

Use Grats to define the server schema. `@gqlQueryField` / `@gqlMutationField` / `@gqlSubscriptionField` for resolvers. Prefer `@gqlType` on TypeScript type literals over classes:

```ts
/** @gqlType */
type User = {
  /** @gqlField */
  name: string;
};
```

Use classes only when needed (e.g. async method resolvers like `async bio(): Promise<string>`).

Import the shared network via `import { gratsNetwork } from "../GratsNetwork"`. Import generated types from `./__generated__/`.

Grats documentation is in the Grats package in node_modules:

| | Path |
|---|---|
| GitHub | `packages/relay-e2e-test/node_modules/grats/llm-docs/` |
| Internal | same path under `__github__/` |

Key files: `getting-started.md`, `resolvers.md`, `docblock-tags.md`

## Interactions

Add a `steps` block to run user interactions before the snapshot is taken:

````markdown
```steps
wait button "Save"
click button "Save"
type textbox "Search" "hello"
```
````

Syntax: `action [role] "name" ["value"]`

| Action  | Description |
|---------|-------------|
| `click` | Click an element by text or role+name |
| `type`  | Type into an element by text or role+name |
| `wait`  | Wait for an element to appear (async/Suspense) |

Roles are [ARIA roles](https://testing-library.com/docs/queries/byrole/#api) (`button`, `link`, `textbox`, `checkbox`, etc.) as defined by [Testing Library](https://testing-library.com/docs/react-testing-library/intro). Names must be quoted.

`wait` polls until a matching element appears (uses `findByText`/`findByRole`). Use it to wait for Suspense to resolve or for async data to arrive before snapshotting or interacting.

## Snapshots

Snapshots are plain `.snap.md` files rather than jest's own `.snap` format, so they stay readable in review — but they follow jest's standard snapshot semantics:

| | new snapshot | changed snapshot |
|---|---|---|
| `yarn test:e2e` | written, passes | **fails** |
| `yarn test:e2e -u` | written, passes | rewritten, passes |
| `yarn test:e2e --ci` | **fails** | **fails** |

So running a new fixture locally generates its `.snap.md`, and `-u` regenerates after an intentional behavior change. Console output (log/warn/error) is captured and included in the snapshot when present.

### Type errors

After the Relay compiler runs, the harness typechecks the fixture with `tsc`, so `App.tsx` and `server.ts` are checked against both the generated `__generated__/*.graphql.ts` artifacts and the `.d.ts` files that `relay-runtime` and `react-relay` ship in this repo. This is the only place those hand-written declarations are exercised against real usage, so a fixture that annotates its hooks (`useLazyLoadQuery<AppTestQuery>`) and reads fields off the result is testing Relay's TypeScript support, not just its runtime.

Type errors do **not** fail the test. They are written into a `## Type Errors` section at the top of the snapshot:

````markdown
## Type Errors

```
template/App.tsx(18,20): error TS2339: Property 'greetng' does not exist on type 'AppTestQuery$data'.
```
````

The section is omitted entirely when a fixture is clean, so a passing fixture's snapshot has no trace of it. Because it lives in the snapshot, a type regression still fails CI — as a snapshot diff — while letting you land a fixture that characterises a known-bad generated type before it is fixed.

`fixtures/typechecking/unselected-field.md` is the worked example: it selects `greeting` but reads `farewell`, a field that exists on `Query` but was not selected. The GraphQL is valid, the Relay compiler is happy, and at runtime the field is `undefined` and renders as nothing — so the component works and the `wait` step passes. Only the typecheck catches it. Use it as the template when adding a fixture whose whole point is a type error.

Every fixture runs twice, on graphql 16 and on graphql 17 (see `jest.config.js`), and both runs must match its one snapshot. They differ in how they send `@defer` and `@stream` results: graphql 16 as label/path payloads, graphql 17 in GraphQL's incremental delivery format.

Always commit the `.snap.md` alongside the fixture. Jest treats a CI environment as `--ci` automatically (via `ci-info`, which checks `CI` among others), so a fixture landed without its snapshot fails there rather than silently writing one and passing forever.

### Expected runtime errors

An uncaught error fails the test: for example, an error that React reports when it renders after an update or a Suspense retry, or an error thrown by an event handler. To pin a known runtime bug instead, make this the first line of the fixture, like the comment that marks a Relay compiler fixture that expects an error:

```
// expected-to-throw
```

A marked fixture passes only if an uncaught error occurs while the app renders or runs its steps. The harness writes the error into a `## Runtime Error` section of the snapshot, after `## Type Errors`:

````markdown
## Runtime Error

```
Invariant Violation: Expected to find record for live resolver.
```
````

If no uncaught error occurs, the fixture fails. So when the bug is fixed, remove the first line and update the snapshot. The marker counts only on the first line.

After the error, React has unmounted the app, so the harness does not report a step that fails after it. Write the steps for the behavior you expect once the bug is fixed (for example, end with a `wait` for the correct result), so the error occurs while they run. Compile errors, type errors, and a step that fails before the error are reported as usual. An error that React throws back into the test inside `act()` (for example, from the first render) also fails the test as usual, and an error that an error boundary catches is not uncaught.

`fixtures/gc/abstract-client-edge.md` is the worked example.

## Relay docs

To understand how Relay APIs work, consult the Relay docs source files:

| | Path |
|---|---|
| GitHub | `website/docs/` |
| Internal | `xplat/js/RKJSModules/Libraries/Relay/oss/__github__/website/docs/` |

Key directories: `api-reference/`, `guided-tour/`, `guides/`, `getting-started/`
