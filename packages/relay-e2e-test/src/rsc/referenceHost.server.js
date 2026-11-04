/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

'use strict';

// Marks the output of a server process failure (see rscClient.js).
const FATAL = 'RELAY_E2E_FATAL ';

/**
 * The reference host for Server Component fixtures: an App Router-like
 * framework in two processes, started by src/rsc/rscClient.js with
 *
 *   node --conditions=react-server referenceHost.server.js '{"layer":"rsc",...}'
 *   node referenceHost.server.js '{"layer":"ssr",...}'
 *
 * The RSC process runs React's server build. It answers
 * - `GET /page?<search>`: the fixture's `Page` Server Component with
 *   `{searchParams}`, rendered to a React Flight stream;
 * - `POST /graphql`: an operation against the fixture's Grats schema, one
 *   JSON payload per line;
 * - `POST /__release?gate=<name>`: opens a gate (test control).
 *
 * The SSR process runs the client build. `GET /?<search>` fetches the page's
 * Flight stream, renders it to HTML with react-dom/server, and answers a
 * document carrying that HTML and, inline, the Flight stream to hydrate it
 * with, the way a framework embeds the RSC payload in the page. Suspense
 * boundaries that complete after the HTML was sent stream in after it, as
 * react-dom/server writes them.
 */

const {AsyncLocalStorage} = require('async_hooks');
const http = require('http');
const path = require('path');
const {StringDecoder} = require('string_decoder');

const E2E_NODE_MODULES = path.resolve(__dirname, '..', '..', 'node_modules');

function interopDefault(module) {
  return module != null && module.__esModule ? module.default : module;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    req.on('error', reject);
  });
}

function listen(handler) {
  const server = http.createServer((req, res) => {
    Promise.resolve(handler(req, res, new URL(req.url, 'http://localhost')))
      .catch(error => {
        console.error(String(error?.stack ?? error));
        if (!res.headersSent) {
          res.writeHead(500);
        }
        res.end();
      });
  });
  return new Promise(resolve =>
    server.listen(0, '127.0.0.1', () => resolve(server.address().port)),
  );
}

async function startRscServer({fixtureDir, host}) {
  if (host !== 'nextjs' && host !== 'cometjs') {
    throw new Error(`relay-e2e-test: unknown RSC host "${host}".`);
  }
  const React = require('react');
  const {renderToPipeableStream} = require('react-server-dom-webpack/server.node');
  const {Environment, RecordSource, Store} = require('relay-runtime');
  const {createServerEnvironment} = require('react-relay/rsc_EXPERIMENTAL');
  const {gratsNetwork} = require(path.join(fixtureDir, 'GratsNetwork.ts'));
  const runID = path.basename(fixtureDir);

  const createEnvironment = () =>
    new Environment({
      isServer: true,
      network: gratsNetwork,
      store: new Store(new RecordSource()),
    });
  // `nextjs` creates one server environment and lets React.cache scope its
  // Relay Environment to the request. `cometjs` owns request state: it
  // creates a server environment per request.
  const sharedServerEnvironment = createServerEnvironment(createEnvironment);
  const requestServerEnvironment = new AsyncLocalStorage();
  function getServerEnvironmentMethod(name) {
    const serverEnvironment =
      host === 'nextjs'
        ? sharedServerEnvironment
        : requestServerEnvironment.getStore();
    if (typeof serverEnvironment?.[name] !== 'function') {
      throw new Error(
        `relay-e2e-test: ${name}() is not available yet: the server ` +
          "environment from react-relay/rsc_EXPERIMENTAL's " +
          'createServerEnvironment() has no such method.',
      );
    }
    return serverEnvironment[name];
  }

  const gates = new Map();
  function getGate(name) {
    if (!gates.has(name)) {
      let open;
      const opened = new Promise(resolve => {
        open = resolve;
      });
      gates.set(name, {open, opened});
    }
    return gates.get(name);
  }

  // What the fixture-facing API (RelayRscHost.ts) calls.
  globalThis.__RELAY_E2E_RSC_SERVER_HOST__ = {
    serverQuery: (query, variables) =>
      getServerEnvironmentMethod('serverQuery')(query, variables),
    useServerFragment: (fragment, fragmentRef) =>
      getServerEnvironmentMethod('useServerFragment')(fragment, fragmentRef),
    waitForGate: name => getGate(name).opened,
  };

  // Every module is its own chunk. React Flight's browser client caches
  // loaded chunks for the life of the page, and one jest worker runs many
  // fixtures whose module ids coincide, so a chunk id names its run too.
  const clientManifest = new Proxy(
    {},
    {
      get: (_target, id) =>
        typeof id === 'string' && !id.includes('#')
          ? {id, chunks: [`${id}@${runID}`, ''], name: '*'}
          : undefined,
    },
  );

  function renderPage(res, url) {
    const Page = interopDefault(
      require(path.join(fixtureDir, 'template', 'Page.tsx')),
    );
    res.writeHead(200, {'content-type': 'text/x-component'});
    renderToPipeableStream(
      React.createElement(Page, {
        searchParams: Object.fromEntries(url.searchParams),
      }),
      clientManifest,
      {onError: error => console.error(String(error?.message ?? error))},
    ).pipe(res);
  }

  async function executeGraphQL(req, res) {
    const {name, query, variables} = JSON.parse(await readBody(req));
    res.writeHead(200, {'content-type': 'application/x-ndjson'});
    gratsNetwork
      .execute(
        {cacheID: name, id: null, metadata: {}, name, operationKind: 'query', text: query},
        variables,
        {},
      )
      .subscribe({
        next: payload => res.write(JSON.stringify(payload) + '\n'),
        error: error =>
          res.end(
            JSON.stringify({errors: [{message: String(error.message)}]}) + '\n',
          ),
        complete: () => res.end(),
      });
  }

  return listen(async (req, res, url) => {
    if (req.method === 'GET' && url.pathname === '/page') {
      const serverEnvironment =
        host === 'cometjs' ? createServerEnvironment(createEnvironment) : null;
      requestServerEnvironment.run(serverEnvironment, () =>
        renderPage(res, url),
      );
    } else if (req.method === 'POST' && url.pathname === '/graphql') {
      await executeGraphQL(req, res);
    } else if (req.method === 'POST' && url.pathname === '/__release') {
      getGate(url.searchParams.get('gate')).open();
      res.writeHead(204).end();
    } else {
      res.writeHead(404).end();
    }
  });
}

async function startSsrServer({fixtureDir, flushOnShell, rscOrigin}) {
  const React = require('react');
  const {renderToPipeableStream} = require('react-dom/server');
  const {createFromNodeStream} = require(
    path.join(E2E_NODE_MODULES, 'react-server-dom-webpack/client.node'),
  );
  const {Environment, Network, Observable, RecordSource, Store} =
    require('relay-runtime');
  const {RscRoot} = require('./RscRoot');
  const {fromClientModuleId, postGraphQL} = require('./wireProtocol');

  // Client modules load synchronously here, from the same files the browser
  // realm loads.
  global.__webpack_chunk_load__ = () => Promise.resolve();
  global.__webpack_require__ = id => require(fromClientModuleId(fixtureDir, id));
  const serverConsumerManifest = {
    moduleLoading: null,
    serverModuleMap: null,
    moduleMap: new Proxy(
      {},
      {get: (_, id) => new Proxy({}, {get: (__, name) => ({id, chunks: [], name})})},
    ),
  };

  // A Relay Environment per request. Any operation it sends is logged, so a
  // fixture's snapshot shows a server-side render that fetched.
  function createEnvironment() {
    const fetchFn = (params, variables) =>
      Observable.create(sink => {
        console.debug(`POST /graphql ${params.name}`);
        postGraphQL(`${rscOrigin}/graphql`, params, variables, {
          onPayload: payload => sink.next(payload),
        }).then(
          () => sink.complete(),
          error => sink.error(error),
        );
      });
    return new Environment({
      isServer: true,
      network: Network.create(fetchFn),
      store: new Store(new RecordSource()),
    });
  }

  return listen((req, res, url) => {
    http.get(`${rscOrigin}/page${url.search}`, flight => {
      res.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
      const decoder = new StringDecoder('utf8');
      const beforeShell = [];
      let shellSent = false;
      let flightEnded = false;
      let htmlEnded = false;
      // The document ends once; nothing is written after that (a failed
      // render can end it while Flight data is still arriving).
      let documentEnded = false;
      // A response error is a harness failure: report it, so the test fails.
      res.on('error', error => {
        console.error(`${FATAL}response error: ${String(error?.message ?? error)}`);
      });
      const write = text => {
        if (!documentEnded) {
          res.write(text);
        }
      };
      const endDocument = () => {
        if (!documentEnded && shellSent && flightEnded && htmlEnded) {
          documentEnded = true;
          res.end('</body></html>');
        }
      };
      const writeFlight = text =>
        write(
          `<script>self.__FLIGHT__.push(${JSON.stringify(text).replace(/</g, '\\u003c')})</script>`,
        );
      flight.on('data', chunk => {
        const text = decoder.write(chunk);
        if (shellSent) {
          writeFlight(text);
        } else {
          beforeShell.push(text);
        }
      });
      flight.on('end', () => {
        flightEnded = true;
        endDocument();
      });
      // A Flight stream error (e.g. the RSC process exiting mid-response) is
      // a harness failure too: report it, and end the document rather than
      // leave the page loading.
      flight.on('error', error => {
        console.error(`${FATAL}Flight stream error: ${String(error?.message ?? error)}`);
        if (!documentEnded) {
          documentEnded = true;
          res.end();
        }
      });

      // react-dom/server's destination. Each flush is complete HTML: the
      // first is the page, later ones complete Suspense boundaries.
      let html = '';
      const htmlDecoder = new TextDecoder();
      const destination = {
        write(chunk) {
          html +=
            typeof chunk === 'string'
              ? chunk
              : htmlDecoder.decode(chunk, {stream: true});
          return true;
        },
        flush() {
          if (shellSent) {
            write(html);
            html = '';
          }
        },
        end() {
          htmlEnded = true;
          destination.flush();
          endDocument();
        },
        // react-dom/server destroys the destination when the render fails.
        destroy() {
          htmlEnded = true;
          endDocument();
        },
        on() {},
      };
      // A failed shell sends no HTML: the browser renders the page itself.
      function sendShell(failed) {
        if (shellSent) {
          return;
        }
        shellSent = true;
        htmlEnded ||= failed;
        write(
          '<!DOCTYPE html><html><body>' +
            (failed
              ? '<div id="root" data-client-render></div>'
              : `<div id="root">${html}</div>`) +
            '<!--shell--><script>self.__FLIGHT__=[]</script>',
        );
        html = '';
        beforeShell.forEach(writeFlight);
        endDocument();
      }

      // The HTML is the complete render, unless the fixture holds part of the
      // page behind a gate: then it is the shell, with fallbacks for the
      // boundaries still pending.
      const {pipe} = renderToPipeableStream(
        React.createElement(RscRoot, {
          environment: createEnvironment(),
          initialResponse: createFromNodeStream(flight, serverConsumerManifest),
        }),
        {
          [flushOnShell ? 'onShellReady' : 'onAllReady']() {
            pipe(destination);
            sendShell(false);
          },
          onShellError: () => sendShell(true),
          onError: error => console.error(String(error?.message ?? error)),
        },
      );
    }).on('error', error => {
      // The RSC process could not be reached: a harness failure.
      console.error(`${FATAL}Flight request error: ${String(error?.message ?? error)}`);
      if (!res.headersSent) {
        res.writeHead(502);
        res.end();
      }
    });
  });
}

if (require.main === module) {
  // Relay's sources read `__DEV__`, as in the jest realm (jest-setup.js).
  global.__DEV__ = true;
  const options = JSON.parse(process.argv[2]);
  require('./serverModuleLoader').installServerModuleLoader({
    clientReferences: options.layer === 'rsc',
    fixtureDir: options.fixtureDir,
  });
  (options.layer === 'rsc' ? startRscServer : startSsrServer)(options).then(
    port => process.send({type: 'ready', port}),
    error => {
      process.send({type: 'failed', message: String(error?.stack ?? error)});
      process.exit(1);
    },
  );
  process.on('disconnect', () => process.exit(0));
  // A crash of this process fails the fixture (see rscClient.js); a handled
  // application error, whatever its message, does not.
  process.on('uncaughtException', error => {
    console.error(`${FATAL}uncaughtException: ${String(error?.message ?? error)}`);
    process.exitCode = 1;
  });
  process.on('unhandledRejection', error => {
    console.error(`${FATAL}unhandledRejection: ${String(error?.message ?? error)}`);
    process.exitCode = 1;
  });
}
