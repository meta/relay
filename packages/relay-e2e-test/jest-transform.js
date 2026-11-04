/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Jest transform for the relay e2e test package.
 *
 * Handles both:
 * - TypeScript/TSX files (test code and fixture code) via @babel/plugin-transform-typescript
 * - Flow JS files (relay-runtime and react-relay source) via flow-parser/babel-plugin
 */

'use strict';

const {RELAY_ROOT, getMainRepoRoot} = require('./repoRoot');
const babel = require('@babel/core');
const createCacheKeyFunction =
  require('@jest/create-cache-key-function').default;
const fs = require('fs');
const path = require('path');

function findBabelPluginRelay() {
  // Explicit override, for callers that build the plugin themselves. The
  // internal layout has no `dist/` (`yarn build` only works once the packages
  // have been laid out the way the OSS repo expects), so fbsource builds the
  // plugin from `oss/babel-plugin-relay/` and points here.
  if (process.env.BABEL_PLUGIN_RELAY_PATH) {
    return process.env.BABEL_PLUGIN_RELAY_PATH;
  }

  // Prefer local build from source (tests latest changes)
  const relPath = 'dist/babel-plugin-relay/lib/BabelPluginRelay.js';
  const local = path.join(RELAY_ROOT, relPath);
  if (fs.existsSync(local)) {
    return local;
  }
  const mainRoot = getMainRepoRoot();
  if (mainRoot !== RELAY_ROOT) {
    const mainPath = path.join(mainRoot, relPath);
    if (fs.existsSync(mainPath)) {
      return mainPath;
    }
  }
  // The npm fallback is a published release that can lag the source in this
  // repo, so under CI it is an error rather than a silent downgrade.
  //
  // Plain `CI` is enough: GitHub Actions always sets it, and the fbsource Buck
  // test supplies BABEL_PLUGIN_RELAY_PATH outright, so this is only a backstop
  // there. Jest's own `--ci` detection is broader (it uses `ci-info`), which
  // would matter on a CI system that sets only BUILD_NUMBER or RUN_ID -- not
  // something either of those two run on.
  if (process.env.CI) {
    throw new Error(
      'No babel-plugin-relay built from this repo was found at ' +
        `${relPath}, and the published npm babel-plugin-relay must not be ` +
        'used in CI.\nBuild it from the repo root with `yarn build`, or set ' +
        'BABEL_PLUGIN_RELAY_PATH to a build of it.',
    );
  }

  // Fall back to npm version from e2e node_modules
  return require.resolve('babel-plugin-relay');
}

// Resolve all plugin paths upfront so Babel doesn't need to resolve them
// relative to each file being transformed (which fails for temp dir files)
const flowParser = require.resolve('flow-parser/babel-plugin');
const flowStrip = require.resolve('@babel/plugin-transform-flow-strip-types');
const tsTransform = require.resolve('@babel/plugin-transform-typescript');
const reactJsx = require.resolve('@babel/plugin-transform-react-jsx');
const modulesCommonjs = require.resolve(
  '@babel/plugin-transform-modules-commonjs',
);
const rewriteModules = path.join(RELAY_ROOT, 'scripts', 'rewrite-modules');

// A fixture's files live in a `mkdtemp` directory: `relay-e2e-` and six
// random characters.
const FIXTURE_FILE = /[\\/]relay-e2e-[A-Za-z0-9]{6}[\\/](.+)$/;

function isServerComponentFixture(filename, fixtureFile) {
  const tempDir = filename.slice(0, filename.length - fixtureFile[1].length);
  return fs.existsSync(path.join(tempDir, 'template', 'Page.tsx'));
}

module.exports = {
  process(src, filename) {
    const isTypeScript = /\.tsx?$/.test(filename);
    const isRelaySource = /\/packages\/(relay-runtime|react-relay)\//.test(
      filename,
    );
    const fixtureFile = FIXTURE_FILE.exec(filename);
    return module.exports.transformSource(src, filename, {
      // Convert ES modules to CommonJS for Jest — but skip for TypeScript
      // fixture files so import() returns clean ESM without nested defaults.
      commonjs: !isTypeScript || isRelaySource,
      // In a Server Component fixture (one with a Page.tsx), every fixture
      // module the browser realm evaluates reports itself, so the fixture can
      // list what reached the browser.
      evaluationHook:
        fixtureFile == null || !isServerComponentFixture(filename, fixtureFile)
          ? null
          : fixtureFile[1].split(path.sep).join('/'),
    });
  },

  /**
   * Also used by the Server Component fixture processes
   * (src/rsc/serverModuleLoader.js), always with `commonjs`, so every realm
   * runs identically transformed code.
   */
  transformSource(src, filename, {commonjs, evaluationHook}) {
    const isTypeScript = /\.tsx?$/.test(filename);
    const isRelaySource = /\/packages\/(relay-runtime|react-relay)\//.test(
      filename,
    );

    const plugins = [];

    if (isTypeScript && !isRelaySource) {
      // TypeScript files: use @babel/plugin-transform-typescript
      // which includes the TS syntax plugin and strips TS types
      plugins.push([tsTransform, {isTSX: true, allowDeclareFields: true}]);
    } else {
      // Flow files (relay source) and plain JS: use Flow parser + flow strip
      plugins.push(flowParser);
      plugins.push(flowStrip);
    }

    // Transform JSX to jsx-runtime calls (needed for all files with JSX)
    plugins.push([reactJsx, {runtime: 'automatic'}]);

    // Relay babel transform for graphql`` tagged templates
    plugins.push([findBabelPluginRelay(), {eagerEsModules: true}]);

    // Rewrite Haste-style bare module imports used by Relay source
    plugins.push([
      rewriteModules,
      {
        map: {
          areEqual: 'fbjs/lib/areEqual',
          warning: 'fbjs/lib/warning',
        },
      },
    ]);

    if (commonjs) {
      plugins.push(modulesCommonjs);
    }

    if (evaluationHook != null) {
      // Runs first, after the directives, so the module is recorded even if
      // the rest of its body throws.
      const report = `globalThis.__RELAY_E2E_MODULE_EVALUATED__?.(${JSON.stringify(
        evaluationHook,
      )});`;
      plugins.push(({template}) => ({
        visitor: {
          Program(programPath) {
            programPath.unshiftContainer('body', template.statement.ast(report));
          },
        },
      }));
    }

    return babel.transformSync(src, {
      filename,
      plugins,
      retainLines: true,
      sourceMaps: 'inline',
    });
  },

  getCacheKey: createCacheKeyFunction([__filename]),
};
