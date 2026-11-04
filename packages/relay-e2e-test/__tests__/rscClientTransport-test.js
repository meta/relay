/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

'use strict';

// Both "server processes" report the port of an HTTP server this test runs.
let mockPort = null;
jest.mock('child_process', () => ({
  fork: () => {
    const {EventEmitter} = require('events');
    const {PassThrough} = require('stream');
    const child = new EventEmitter();
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    child.exitCode = null;
    child.signalCode = null;
    child.kill = () => {
      child.exitCode = 0;
      child.emit('exit', 0);
    };
    setTimeout(() => child.emit('message', {type: 'ready', port: mockPort}), 0);
    return child;
  },
}));

const {createRscSession} = require('../src/rsc/rscClient');
const http = require('http');

const flightScript = text =>
  `<script>self.__FLIGHT__.push(${JSON.stringify(text)})</script>`;

// Serves a document whose response is cut off (the socket destroyed)
// after `body`.
async function withSsrServer(body, run) {
  const server = http.createServer((req, res) => {
    res.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
    res.write(body);
    setTimeout(() => res.socket.destroy(), 20);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  mockPort = server.address().port;
  let session = null;
  try {
    session = createRscSession({
      fixtureDir: '/nonexistent',
      flushOnShell: false,
      host: 'nextjs',
    });
    await run(session);
  } finally {
    await session?.dispose();
    document.body.innerHTML = '';
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
}

const shell = html =>
  '<!DOCTYPE html><html><body>' +
  `<div id="root">${html}</div>` +
  '<!--shell--><script>self.__FLIGHT__=[]</script>';

test('a document cut off before its shell fails the render', async () => {
  await withSsrServer('<!DOCTYPE html><html><body>', async session => {
    await expect(session.render()).rejects.toThrow();
    expect(() => session.snapshotSections()).toThrow('A page request failed: GET /');
  });
});

test('a document cut off while a chunk is pending fails the snapshot', async () => {
  await withSsrServer(shell('') + flightScript('0:"$L1"\n'), async session => {
    await session.render();
    await new Promise(resolve => setTimeout(resolve, 100));
    expect(() => session.snapshotSections()).toThrow('A page request failed: GET /');
  });
});

test('a document cut off after its Flight tree arrived still fails the snapshot', async () => {
  await withSsrServer(shell('ready') + flightScript('0:"ready"\n'), async session => {
    const container = await session.render();
    expect(container.textContent).toBe('ready');
    await new Promise(resolve => setTimeout(resolve, 100));
    expect(() => session.snapshotSections()).toThrow('A page request failed: GET /');
  });
});
