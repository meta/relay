/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

'use strict';

/**
 * The browser realm of a Server Component fixture (jest + jsdom). It starts
 * the fixture's RSC and SSR processes (src/rsc/referenceHost.server.js),
 * loads the server-rendered page and hydrates it, then talks to the RSC
 * process over real HTTP. Every byte it receives is logged, so a fixture can
 * assert what did or did not cross the wire.
 */

const {RscRoot} = require('./RscRoot');
const {
  countFlightRows,
  fromClientModuleId,
  postGraphQL,
} = require('./wireProtocol');
const {act, render} = require('@testing-library/react');
const {fork} = require('child_process');
const http = require('http');
const path = require('path');
const React = require('react');
const {
  Environment,
  Network,
  Observable,
  RecordSource,
  Store,
} = require('relay-runtime');

const HOST_PROCESS = path.join(__dirname, 'referenceHost.server.js');
const READY_TIMEOUT_MS = 20000;

// React Flight's webpack client loads client references through the
// `__webpack_require__` and `__webpack_chunk_load__` globals (see
// installBrowserGlobals), and reads `__webpack_require__.u` as it loads.
// Chunk ids are `<module id>@<run>` (see the RSC process's manifest).
let activeSession = null;
function webpackRequire(id) {
  return activeSession.requireClientModule(id);
}
webpackRequire.u = chunkId => chunkId;
function createFromReadableStream(stream) {
  return require('react-server-dom-webpack/client').createFromReadableStream(
    stream,
  );
}

function startProcess(options, execArgv) {
  const child = fork(HOST_PROCESS, [JSON.stringify(options)], {
    // See GratsNetwork.ts.
    env: {...process.env, NODE_OPTIONS: '', RELAY_E2E_SERVER_COMPONENTS: '1'},
    execArgv,
    stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
  });
  const output = [];
  for (const stream of [child.stdout, child.stderr]) {
    let pending = '';
    stream.setEncoding('utf-8');
    stream.on('data', text => {
      const lines = (pending + text).split('\n');
      pending = lines.pop();
      output.push(...lines);
    });
  }
  const exited = new Promise(resolve => child.once('exit', resolve));
  const ready = new Promise((resolve, reject) => {
    const fail = message => reject(new Error(message + output.join('\n')));
    const timer = setTimeout(
      () => fail(`The ${options.layer} server did not start in time:\n`),
      READY_TIMEOUT_MS,
    );
    child.on('message', message => {
      clearTimeout(timer);
      if (message.type === 'ready') {
        resolve(`http://127.0.0.1:${message.port}`);
      } else {
        fail(`The ${options.layer} server failed:\n${message.message}\n`);
      }
    });
    child.on('exit', code => {
      clearTimeout(timer);
      fail(`The ${options.layer} server exited with code ${String(code)}:\n`);
    });
  });
  ready.catch(() => {});
  return {
    output,
    ready,
    async stop() {
      if (child.exitCode == null && child.signalCode == null) {
        child.kill('SIGKILL');
        await exited;
      }
    },
  };
}

/**
 * One page session: the two server processes, the browser's Relay
 * Environment, its client modules, and its network log.
 */
// jsdom leaves out the streams and encoding globals a browser has, which the
// browser half of React Flight decodes Server Component responses with; and
// React Flight loads client references through webpack's globals. Installed
// for the session only, so other fixtures run without them.
function installBrowserGlobals() {
  const globals = {
    ReadableStream: require('stream/web').ReadableStream,
    TextDecoder: require('util').TextDecoder,
    TextEncoder: require('util').TextEncoder,
    __webpack_chunk_load__: chunkId =>
      activeSession.loadClientModule(chunkId.slice(0, chunkId.lastIndexOf('@'))),
    __webpack_require__: webpackRequire,
  };
  const previous = Object.keys(globals).map(name => [
    name,
    Object.getOwnPropertyDescriptor(global, name),
  ]);
  Object.assign(global, globals);
  return () =>
    previous.forEach(([name, descriptor]) => {
      if (descriptor == null) {
        delete global[name];
      } else {
        Object.defineProperty(global, name, descriptor);
      }
    });
}

function createRscSession({fixtureDir, host, flushOnShell}) {
  // What the session installs, undone when it ends, or right away if it
  // fails to start, so other fixtures run without it.
  const restores = [];
  const restore = () => restores.splice(0).reverse().forEach(undo => undo());
  let rsc;
  try {
    restores.push(installBrowserGlobals());
    rsc = startProcess({fixtureDir, host, layer: 'rsc'}, [
      '--conditions=react-server',
    ]);
  } catch (error) {
    restore();
    throw error;
  }
  let ssr = null;
  let rscOrigin = null;
  let ssrHtml = null;
  // Every request the browser makes, logged as it is sent. `ended` settles
  // once its response is complete (or failed).
  const wireLog = [];
  // The Flight bytes of each page the browser loaded.
  const pages = [];
  // Page requests that failed. A failure is a harness failure even after the
  // page rendered: React Flight ignores a stream error once the chunks it
  // decodes have arrived.
  const transportErrors = [];
  function recordTransportError(request, error) {
    transportErrors.push(`${request}: ${String(error?.message ?? error)}`);
  }

  function logRequest(method, pathname, label) {
    const entry = {bytes: [], label, method, pathname, status: null, type: ''};
    entry.ended = new Promise(resolve => {
      entry.end = resolve;
    });
    wireLog.push(entry);
    return entry;
  }
  function logResponse(entry, response) {
    entry.status = response.statusCode;
    entry.type = (response.headers['content-type'] ?? '').split(';')[0];
    response.on('data', chunk => entry.bytes.push(Buffer.from(chunk)));
    response.on('close', entry.end);
  }

  const clientModules = new Map();
  const evaluatedModules = new Set();
  activeSession = {
    async loadClientModule(id) {
      if (!clientModules.has(id)) {
        const filename = fromClientModuleId(fixtureDir, id);
        clientModules.set(
          id,
          /\.tsx?$/.test(filename)
            ? {...(await import(filename)), __esModule: true}
            : require(filename),
        );
      }
    },
    requireClientModule(id) {
      if (!clientModules.has(id)) {
        throw new Error(`relay-e2e-test: client module ${id} was not loaded.`);
      }
      return clientModules.get(id);
    },
  };
  // Fixture modules report themselves when this realm evaluates them (see
  // jest-transform.js), transitive imports included.
  globalThis.__RELAY_E2E_MODULE_EVALUATED__ = file => {
    evaluatedModules.add(`fixture:${file}`);
  };

  const environment = new Environment({
    network: Network.create((params, variables) =>
      Observable.create(sink => {
        const entry = logRequest('POST', '/graphql', params.name);
        postGraphQL(`${rscOrigin}/graphql`, params, variables, {
          onPayload: payload => sink.next(payload),
          onResponse: response => logResponse(entry, response),
        })
          .then(
            () => sink.complete(),
            error => sink.error(error),
          )
          .finally(entry.end);
      }),
    ),
    store: new Store(new RecordSource()),
  });

  // Where streamed boundary HTML lands until the inline runtime moves it.
  const streamedHtml = document.createElement('div');

  // The document: the server-rendered HTML, then the page's Flight stream in
  // inline scripts, interleaved with the HTML of Suspense boundaries that
  // complete later and the scripts that reveal them. Resolves once the HTML is
  // in the page; the rest keeps flowing in as a browser would process it.
  function loadDocument() {
    const entry = logRequest('GET', '/', null);
    const page = {bytes: [], entry};
    pages.push(page);
    let controller;
    const flight = new ReadableStream({
      start(streamController) {
        controller = streamController;
      },
    });
    let flightEnded = false;
    const endFlight = error => {
      if (!flightEnded) {
        flightEnded = true;
        if (error == null) {
          controller.close();
        } else {
          controller.error(error);
        }
      }
    };
    return new Promise((resolve, reject) => {
      // After the shell resolved, only the Flight stream (and so hydration)
      // can still fail.
      const fail = error => {
        recordTransportError('GET /', error);
        entry.end();
        endFlight(error);
        reject(error);
      };
      http
        .get(`${ssr.origin}/`, response => {
          logResponse(entry, response);
          response.on('error', fail);
          let html = '';
          let scanned = -1;
          response.setEncoding('utf-8');
          response.on('data', text => {
            html += text;
            if (scanned === -1) {
              const end = html.indexOf('<!--shell-->');
              if (end === -1) {
                return;
              }
              const root =
                /<div id="root"( data-client-render)?>([\s\S]*)<\/div>$/.exec(
                  html.slice(0, end),
                );
              if (root == null) {
                response.destroy();
                reject(new Error('The SSR document has no root element.'));
                return;
              }
              scanned = end;
              ssrHtml = root[2];
              const container = document.createElement('div');
              container.innerHTML = ssrHtml;
              document.body.append(container, streamedHtml);
              resolve({clientRender: root[1] != null, container, flight});
            }
            const script = /<script>([\s\S]*?)<\/script>/g;
            script.lastIndex = scanned;
            for (let match; (match = script.exec(html)) != null; ) {
              const markup = html
                .slice(scanned, match.index)
                .replace('<!--shell-->', '');
              if (markup !== '') {
                streamedHtml.insertAdjacentHTML('beforeend', markup);
              }
              scanned = script.lastIndex;
              const flightChunk = /^self\.__FLIGHT__\.push\((".*")\)$/s.exec(
                match[1],
              );
              if (flightChunk != null) {
                const bytes = Buffer.from(JSON.parse(flightChunk[1]));
                entry.bytes.push(bytes);
                page.bytes.push(bytes);
                controller.enqueue(new Uint8Array(bytes));
              } else {
                // react-dom/server's inline runtime: reveals a boundary.
                // eslint-disable-next-line no-eval
                (0, eval)(match[1]);
              }
            }
          });
          response.on('end', () => {
            // E.g. a Flight stream error before the shell: fail now rather
            // than at the test's timeout.
            if (scanned === -1) {
              fail(new Error('The SSR document ended before its shell.'));
            } else {
              endFlight(null);
            }
          });
        })
        .on('error', fail);
    });
  }

  function fetchPage(search) {
    const entry = logRequest('GET', '/page', search);
    const page = {bytes: [], entry};
    pages.push(page);
    return createFromReadableStream(
      new ReadableStream({
        start(controller) {
          const fail = error => {
            recordTransportError(`GET /page${search}`, error);
            entry.end();
            controller.error(error);
          };
          http
            .get(`${rscOrigin}/page${search}`, response => {
              logResponse(entry, response);
              response.on('error', fail);
              response.on('data', chunk => {
                page.bytes.push(Buffer.from(chunk));
                controller.enqueue(new Uint8Array(chunk));
              });
              response.on('end', () => controller.close());
            })
            .on('error', fail);
        },
      }),
    );
  }

  const router = {navigate: null};

  return {
    /** Loads the server-rendered page and hydrates it. */
    async render() {
      rscOrigin = await rsc.ready;
      ssr = startProcess({fixtureDir, flushOnShell, layer: 'ssr', rscOrigin}, []);
      ssr.origin = await ssr.ready;
      const {clientRender, container, flight} = await loadDocument();
      const element = React.createElement(RscRoot, {
        environment,
        initialResponse: createFromReadableStream(flight),
        router,
      });
      // Hydration suspends on the Flight response; an awaited act lets React
      // retry once it resolves.
      await act(async () => {
        render(element, {
          container,
          hydrate: !clientRender,
          onRecoverableError: error =>
            console.error(`Recoverable error: ${error.message}`),
        });
      });
      return container;
    },

    /**
     * What `runInteractions` needs for the Server Component steps. The wire
     * reads wait for the responses they read to complete.
     */
    steps: {
      async countFlightRows() {
        const page = pages[pages.length - 1];
        await page.entry.ended;
        return countFlightRows(Buffer.concat(page.bytes));
      },
      countRequests: request =>
        wireLog.filter(entry => `${entry.method} ${entry.pathname}` === request)
          .length,
      navigate(search) {
        if (router.navigate == null) {
          throw new Error('relay-e2e-test: the page is not hydrated yet.');
        }
        router.navigate(fetchPage(search));
      },
      async readWire() {
        await Promise.all(wireLog.map(entry => entry.ended));
        return wireLog
          .map(entry => Buffer.concat(entry.bytes).toString('utf-8'))
          .join('\n');
      },
      releaseGate: name =>
        new Promise((resolve, reject) => {
          http
            .request(
              `${rscOrigin}/__release?gate=${encodeURIComponent(name)}`,
              {method: 'POST'},
              response => response.resume().on('end', resolve),
            )
            .on('error', reject)
            .end();
        }),
    },

    /** Snapshot sections, in order, before `## HTML`. */
    snapshotSections() {
      const serverConsole = [
        ...rsc.output.map(line => `rsc: ${line}`),
        ...(ssr?.output ?? []).map(line => `ssr: ${line}`),
      ]
        .filter(line => !/^\w+: (\s*$|\s+at )/.test(line))
        .map(line => line.split(fixtureDir + path.sep).join(''));
      // A server process failure (an uncaught exception, an unhandled
      // rejection, or a response error, which the reference host reports with
      // this marker) fails the fixture; it is never part of a snapshot.
      const crash = serverConsole.find(line =>
        line.includes('RELAY_E2E_FATAL '),
      );
      if (crash != null) {
        throw new Error(`A server process failed: ${crash}`);
      }
      if (transportErrors.length > 0) {
        throw new Error(`A page request failed: ${transportErrors[0]}`);
      }
      const browserModules = [
        ...new Set([...clientModules.keys(), ...evaluatedModules]),
      ].sort();
      const sections = [];
      if (serverConsole.length > 0) {
        sections.push(['Server Console', '', serverConsole.join('\n')]);
      }
      const network = wireLog.map(
        entry =>
          `${entry.method} ${entry.pathname}` +
          `${entry.label ? ` ${entry.label}` : ''} -> ` +
          `${String(entry.status)} ${entry.type}`,
      );
      sections.push(['Network', '', network.join('\n')]);
      if (browserModules.length > 0) {
        sections.push(['Browser Modules', '', browserModules.join('\n')]);
      }
      if (ssrHtml != null) {
        // React's development build puts error stacks, with the fixture's
        // temporary directory, in the HTML of failed boundaries.
        sections.push([
          'SSR HTML',
          'html',
          ssrHtml.split(fixtureDir + path.sep).join(''),
        ]);
      }
      return sections;
    },

    async dispose() {
      streamedHtml.remove();
      activeSession = null;
      delete globalThis.__RELAY_E2E_MODULE_EVALUATED__;
      restore();
      await Promise.all([rsc.stop(), ssr?.stop()]);
    },
  };
}

module.exports = {createRscSession};
