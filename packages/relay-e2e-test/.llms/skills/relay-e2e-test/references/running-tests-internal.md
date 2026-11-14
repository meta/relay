# Running E2E Tests (Internal / fbsource)

## Directory layout

| | Path |
|---|---|
| Repo root | `xplat/js/RKJSModules/Libraries/Relay/oss/__github__/` |
| Relay packages | `oss/relay-runtime/`, `oss/react-relay/` (siblings of `__github__/`) |
| babel-plugin-relay | npm fallback (`babel-plugin-relay` in e2e `node_modules`) |
| Fixtures | `packages/relay-e2e-test/fixtures/` under `__github__/` |

The test harness resolves these paths transparently via `resolveRelayPackage()` in `repoRoot.js` and `findBabelPluginRelay()` in `jest-transform.js`.

## First-time setup

```bash
cd xplat/js/RKJSModules/Libraries/Relay/oss/__github__

# 1. Install root dependencies
yarn install --ignore-scripts --ignore-engines

# 2. Install e2e package dependencies (includes babel-plugin-relay from npm)
cd packages/relay-e2e-test && yarn install --ignore-engines
```

No `yarn build` step is needed — the babel plugin is installed from npm.

> **Careful with step 2.** `__github__` is a member of the `xplat/js` yarn workspace, so a bare `yarn install` inside the e2e package resolves the workspace root up at `xplat/js` and can strip `__github__/node_modules/.bin` — taking jest with it, which then fails as an opaque `MODULE_NOT_FOUND`. `smart-install` will not repair this; it no-ops when its cached state looks current. Repair with a full workspace install:
>
> ```bash
> cd xplat/js && ../third-party/yarn/yarn install
> ```

## Commands

All commands run from `xplat/js/RKJSModules/Libraries/Relay/oss/__github__/`.

Run all e2e tests:

```bash
yarn test:e2e
```

Run a single fixture by name (use the path without extension, e.g. `queries/greeting`):

```bash
yarn test:e2e -- --testNamePattern greeting
```

## Compiler resolution

The test harness resolves the relay-compiler binary in this order:

1. `RELAY_COMPILER_BINARY` env var
2. Local cargo build: `compiler/target/debug/relay`
3. npm fallback: `node_modules/.bin/relay-compiler`

Internally, point `RELAY_COMPILER_BINARY` at the Buck-built compiler so the tests exercise the compiler in this repo rather than the last published release:

```bash
RELAY_COMPILER_BINARY="$(buck2 build --show-full-simple-output fbcode//relay/oss/crates/relay-bin:relay)"
```

The two differ in practice — fixtures using `@module` fail against the npm compiler and pass against the Buck-built one.

When the `CI` environment variable is set, step 3 is a hard error instead of a fallback. The same applies to `babel-plugin-relay`, which internally cannot come from `yarn build` at all: gulp expects `packages/babel-plugin-relay/`, and the package lives at `oss/babel-plugin-relay/`. Both are backstops internally — the Buck test supplies `RELAY_COMPILER_BINARY` and `BABEL_PLUGIN_RELAY_PATH` itself.
