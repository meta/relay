/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Jest configuration for the relay e2e test package.
 *
 * Dependencies come from two locations:
 * - Root node_modules: jest, babel, build tooling
 * - E2E node_modules: react@19, graphql@16 and graphql@17, @testing-library (isolated versions)
 * - Relay source: packages/relay-runtime, packages/react-relay (from source)
 */

'use strict';

const {getMainRepoRoot, resolveRelayPackage} = require('./repoRoot');
const path = require('path');

const mainRoot = getMainRepoRoot();
const relayRuntimePath = resolveRelayPackage('relay-runtime');
const reactRelayPath = resolveRelayPackage('react-relay');

const config = {
  testMatch: ['<rootDir>/**/__tests__/*-test.js'],
  transform: {
    '\\.[jt]sx?$': '<rootDir>/jest-transform.js',
  },
  // Transform relay source files and temp dir files (not in node_modules)
  // Also transform @testing-library since it uses ESM
  transformIgnorePatterns: [
    '/node_modules/(?!(@testing-library)/)',
  ],
  moduleNameMapper: {
    // Force all react imports to use the e2e package's React 19,
    // not the root repo's experimental React. Without this, relay
    // source files resolve react from root node_modules, causing
    // a dual-React-instance error.
    '^react$': '<rootDir>/node_modules/react',
    '^react/(.*)$': '<rootDir>/node_modules/react/$1',
    '^react-dom$': '<rootDir>/node_modules/react-dom',
    '^react-dom/(.*)$': '<rootDir>/node_modules/react-dom/$1',
    // The browser half of React Flight, for Server Component fixtures. The
    // server half runs in separate processes (src/rsc/).
    '^react-server-dom-webpack/client$':
      '<rootDir>/node_modules/react-server-dom-webpack/client.browser.js',
    // Point to Relay source files directly
    // resolveRelayPackage checks packages/ (GitHub) then oss/ (internal)
    // (the published packages compile them into `lib/`).
    '^relay-runtime$': relayRuntimePath,
    '^relay-runtime/lib/(.*)$': relayRuntimePath + '/$1',
    '^relay-runtime/(.*)$': relayRuntimePath + '/$1',
    '^react-relay$': reactRelayPath,
    '^react-relay/lib/(.*)$': reactRelayPath + '/$1',
    '^react-relay/(.*)$': reactRelayPath + '/$1',
  },
  // Resolve modules from both e2e node_modules (react@19, graphql@16)
  // and root node_modules (fbjs, invariant)
  // E2E comes first so react@19 wins over root's react@experimental
  modulePaths: [
    '<rootDir>/node_modules',
    path.join(mainRoot, 'node_modules'),
  ],
  // Treat TypeScript files as ESM so dynamic import() returns clean modules
  // without nested CJS default-wrapping.
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
  // Use jsdom for DOM testing with @testing-library
  testEnvironment: 'jest-environment-jsdom',
  roots: ['<rootDir>'],
  setupFiles: ['<rootDir>/jest-setup.js'],
};

module.exports = {
  // Increase timeout for fixture compilation (grats + relay-compiler)
  testTimeout: 30000,
  // The fixtures run twice, against each snapshot: on graphql 16, which sends
  // `@defer` and `@stream` results as label/path payloads, and on graphql 17,
  // which sends them in GraphQL's incremental delivery format.
  projects: [
    {...config, displayName: 'graphql 16'},
    {
      ...config,
      displayName: 'graphql 17',
      testMatch: ['<rootDir>/__tests__/fixtures-test.js'],
      moduleNameMapper: {
        ...config.moduleNameMapper,
        '^graphql$': '<rootDir>/node_modules/graphql17',
        '^graphql/(.*)$': '<rootDir>/node_modules/graphql17/$1',
      },
    },
  ],
};
