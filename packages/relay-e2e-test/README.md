# Relay E2E Tests

Markdown-driven end-to-end tests for Relay. Each test is a self-contained `.md` file that defines a GraphQL server (via [Grats](https://grats.capt.dev/)), a Relay-powered React component, and optional interaction steps. The test harness extracts the code blocks, compiles them with Grats + relay-compiler, typechecks them with `tsc`, renders with React Testing Library, runs interactions, and snapshot-tests the output.

A fixture with a `Page.tsx` instead of an `App.tsx` tests React Server Components: it runs in separate RSC and SSR processes with real React Flight, and the browser realm hydrates the server-rendered page. See the [Server Component guide](.llms/skills/relay-e2e-test/references/server-components.md).

Tests run against **Relay runtime packages from source** (`packages/relay-runtime/` and `packages/react-relay/`), so changes are reflected immediately without a build step.

## Running tests

From the repo root:

```
yarn test:e2e
```

Run a single fixture by name:

```
yarn test:e2e -- --testNamePattern defer
```

### First-time setup

The e2e package has its own `node_modules` (isolated `react@19`, and `graphql@16` and `graphql@17`, which every fixture runs on in turn):

```
cd packages/relay-e2e-test && yarn install
```

The babel-plugin-relay must be built before running tests:

```
yarn build
```

### Compiler resolution

The test harness resolves the relay-compiler binary in this order:

1. `RELAY_COMPILER_BINARY` env var
2. Local cargo build: `compiler/target/debug/relay`
3. npm fallback: `node_modules/.bin/relay-compiler`

To test compiler changes, build with `cargo build --manifest-path=compiler/Cargo.toml --bin relay` and re-run tests.

When the `CI` environment variable is set, the npm fallback is a hard error rather than a silent downgrade to the last published release. `babel-plugin-relay` is resolved the same way, so CI must run `yarn build` first. Both are backstops: the two things that run this suite in CI — GitHub Actions and the fbsource Buck test — each supply their own binaries.

## Updating snapshots

Snapshots are plain `.snap.md` files, but follow jest's standard semantics:

```
yarn test:e2e -u      # rewrite changed snapshots
yarn test:e2e --ci    # never write; a new or changed snapshot fails
```

A new fixture's snapshot is written on a plain `yarn test:e2e`; a *changed* snapshot always fails unless `-u` is passed. Jest treats a CI environment as `--ci` automatically, so commit the generated `.snap.md` alongside its fixture.

## Typechecking

Each fixture is typechecked with `tsc` after the Relay compiler runs, against the generated `__generated__/*.graphql.ts` artifacts and the `.d.ts` files `relay-runtime` and `react-relay` ship from this repo (wired up via generated `paths` in the fixture's tsconfig). Type errors are reported in a `## Type Errors` section of the snapshot rather than failing the test outright — see the [writing guide](.llms/skills/relay-e2e-test/references/writing-fixtures.md#type-errors).

The repo's other TypeScript check, `yarn typecheck:ts`, only verifies that `relay-runtime`'s declarations are internally well-formed. The e2e suite is what checks they are actually *usable*.

## Expected runtime errors

An uncaught error fails a fixture. A fixture whose first line is `// expected-to-throw` (the comment that marks a Relay compiler fixture that expects an error) passes only if one occurs, and the error is written into a `## Runtime Error` section of its snapshot. Use it to pin a known runtime bug until it is fixed — see the [writing guide](.llms/skills/relay-e2e-test/references/writing-fixtures.md#expected-runtime-errors).

## Writing fixtures

For the complete writing guide including fixture format, server/client code patterns, the interaction DSL, and snapshot behavior, see [`.llms/skills/relay-e2e-test/SKILL.md`](.llms/skills/relay-e2e-test/SKILL.md).
