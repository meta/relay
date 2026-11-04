---
name: relay-e2e-test
description: Write and run markdown-driven e2e tests for Relay. Covers fixture format, server/client code patterns, interaction DSL, snapshots, and running tests.
allowed-tools: Bash, Read, Edit, Write, AskUserQuestion, mcp__plugin_meta_mux__search_files
metadata:
  oncalls: ['relay']
  strict: true
---

# Relay E2E Tests

Markdown-driven end-to-end tests for Relay. Each test is a self-contained `.md` file that defines a GraphQL server (via [Grats](https://grats.capt.dev/)), a Relay-powered React component, and optional interaction steps. The test harness extracts the code blocks, compiles them with Grats + relay-compiler, renders with React Testing Library, runs interactions, and snapshot-tests the output.

Tests run against **Relay runtime packages from source**, so changes are reflected immediately without a build step.

## References

Read the appropriate reference file based on your task:

- **[Writing fixtures](references/writing-fixtures.md)** — fixture format, example, server/client code patterns, interaction DSL, snapshots. Read when creating or modifying test fixtures.
- **[Server Component fixtures](references/server-components.md)** — fixtures with a `Page.tsx`: the RSC and SSR processes, `'use client'` modules, server APIs, extra steps and snapshot sections. Read when testing Relay with React Server Components.
- **[Running tests (internal)](references/running-tests-internal.md)** — setup, commands, and compiler resolution for fbsource / OD. Read when running tests internally.
- **[Running tests (GitHub)](references/running-tests-github.md)** — setup, commands, and compiler resolution for the OSS repo. Read when running tests on GitHub.
