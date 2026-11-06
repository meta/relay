/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

'use strict';

/**
 * The module system of a Server Component fixture's server processes, done
 * at `require` time the way a bundler's server builds would:
 *
 * - Fixture files and Relay sources compile with jest's babel plugins, to
 *   CommonJS. Relay resolves to its sources, and React, React Flight and
 *   graphql to the e2e package's own copies, as in the jest realm.
 * - In the RSC process (`clientReferences`), a module whose directive
 *   prologue has `'use client'` is never evaluated. Requiring it returns a
 *   React Flight client module proxy, so rendering or passing one of its
 *   exports writes a client reference. That covers every such module:
 *   fixture files, Relay's own client entry points, and generated artifacts.
 */

const {resolveRelayPackage} = require('../../repoRoot');
const {toClientModuleId} = require('./wireProtocol');
const crypto = require('crypto');
const fs = require('fs');
const Module = require('module');
const path = require('path');

const E2E_ROOT = path.resolve(__dirname, '..', '..');
const E2E_NODE_MODULES = path.join(E2E_ROOT, 'node_modules');
const E2E_PACKAGE =
  /^(react|react-dom|react-server-dom-webpack|scheduler|graphql)(\/|$)/;
const RELAY_PACKAGE = /^(relay-runtime|react-relay)(?:\/(.+))?$/;
// The graphql package of the jest realm that started this process.
const GRAPHQL = process.env.RELAY_E2E_GRAPHQL;

// Each process compiles all of Relay; caching its output on disk keeps the
// processes of later fixtures fast. Fixture files change every run and are
// not cached.
const CACHE_DIR = path.join(E2E_NODE_MODULES, '.cache', 'relay-e2e-rsc');
const CACHE_KEY = crypto
  .createHash('sha1')
  .update(fs.readFileSync(path.join(E2E_ROOT, 'jest-transform.js')))
  .update(fs.readFileSync(path.join(E2E_ROOT, 'yarn.lock')))
  .update(process.env.BABEL_PLUGIN_RELAY_PATH ?? '')
  .digest('hex');

function compile(source, filename, cache) {
  const cached = cache
    ? path.join(
        CACHE_DIR,
        crypto
          .createHash('sha1')
          .update(CACHE_KEY + filename + source)
          .digest('hex') + '.js',
      )
    : null;
  if (cached != null && fs.existsSync(cached)) {
    return fs.readFileSync(cached, 'utf-8');
  }
  const {transformSource} = require('../../jest-transform');
  const {code} = transformSource(source, filename, {commonjs: true});
  if (cached != null) {
    fs.mkdirSync(CACHE_DIR, {recursive: true});
    fs.writeFileSync(`${cached}.${process.pid}`, code);
    fs.renameSync(`${cached}.${process.pid}`, cached);
  }
  return code;
}

/** Whether the module's directive prologue has `'use client'`. */
function isClientModule(source) {
  const prologue =
    /\s+|\/\/[^\n]*|\/\*[\s\S]*?\*\/|'([^'\\\n]*)'\s*;?|"([^"\\\n]*)"\s*;?/y;
  for (let match; (match = prologue.exec(source)) != null && match[0] !== ''; ) {
    if ((match[1] ?? match[2]) === 'use client') {
      return true;
    }
  }
  return false;
}

function installServerModuleLoader({clientReferences, fixtureDir}) {
  const compiledRoots = [
    fixtureDir,
    resolveRelayPackage('relay-runtime'),
    resolveRelayPackage('react-relay'),
  ];
  const createClientModuleProxy = clientReferences
    ? require(path.join(E2E_NODE_MODULES, 'react-server-dom-webpack/server.node'))
        .createClientModuleProxy
    : null;

  const resolveFilename = Module._resolveFilename;
  Module._resolveFilename = function (request, parent, isMain, options) {
    const relay = RELAY_PACKAGE.exec(request);
    if (relay != null) {
      const subpath = relay[2]?.replace(/^lib\//, '') ?? 'index.js';
      request = path.join(resolveRelayPackage(relay[1]), subpath);
    } else if (
      E2E_PACKAGE.test(request) &&
      !parent?.filename?.startsWith(E2E_NODE_MODULES + path.sep)
    ) {
      if (GRAPHQL != null) {
        request = request.replace(/^graphql(?=\/|$)/, GRAPHQL);
      }
      options = {paths: [E2E_ROOT]};
    }
    return resolveFilename.call(this, request, parent, isMain, options);
  };

  const loadJavaScript = Module._extensions['.js'];
  for (const extension of ['.js', '.ts', '.tsx']) {
    Module._extensions[extension] = function (module, filename) {
      if (!compiledRoots.some(root => filename.startsWith(root + path.sep))) {
        loadJavaScript(module, filename);
        return;
      }
      const source = fs.readFileSync(filename, 'utf-8');
      if (createClientModuleProxy != null && isClientModule(source)) {
        module.exports = createClientModuleProxy(
          toClientModuleId(fixtureDir, filename),
        );
        return;
      }
      module._compile(
        compile(source, filename, !filename.startsWith(fixtureDir + path.sep)),
        filename,
      );
    };
  }
}

module.exports = {installServerModuleLoader};
