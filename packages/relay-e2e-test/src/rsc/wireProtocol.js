/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

'use strict';

/**
 * What the browser realm and the two server processes of a Server Component
 * fixture agree on about the wire, plus a reader for React Flight rows.
 */

const {resolveRelayPackage} = require('../../repoRoot');
const http = require('http');
const path = require('path');

/**
 * Client reference ids are relative to these roots, so nothing on the wire
 * depends on a checkout or temp directory path.
 */
function clientReferenceRoots(fixtureDir) {
  return [
    ['fixture', fixtureDir],
    ['relay-runtime', resolveRelayPackage('relay-runtime')],
    ['react-relay', resolveRelayPackage('react-relay')],
  ];
}

function toClientModuleId(fixtureDir, filename) {
  for (const [prefix, root] of clientReferenceRoots(fixtureDir)) {
    if (filename.startsWith(root + path.sep)) {
      return `${prefix}:${path.relative(root, filename).split(path.sep).join('/')}`;
    }
  }
  throw new Error(
    `relay-e2e-test: ${filename} is a 'use client' module outside the ` +
      'fixture and the Relay packages, so it has no client reference id.',
  );
}

function fromClientModuleId(fixtureDir, id) {
  const separator = id.indexOf(':');
  const root = new Map(clientReferenceRoots(fixtureDir)).get(
    id.slice(0, separator),
  );
  if (root == null) {
    throw new Error(`relay-e2e-test: unknown client reference id ${id}.`);
  }
  return path.join(root, ...id.slice(separator + 1).split('/'));
}

/**
 * POSTs a GraphQL operation to the RSC process. The answer is one JSON
 * payload per line (an incremental response has several).
 */
function postGraphQL(url, params, variables, {onPayload, onResponse}) {
  return new Promise((resolve, reject) => {
    const request = http.request(url, {method: 'POST'}, response => {
      onResponse?.(response);
      let pending = '';
      response.setEncoding('utf-8');
      response.on('data', text => {
        const lines = (pending + text).split('\n');
        pending = lines.pop();
        lines.filter(Boolean).forEach(line => onPayload(JSON.parse(line)));
      });
      response.on('end', () => {
        if (pending.trim() !== '') {
          onPayload(JSON.parse(pending));
        }
        resolve();
      });
      response.on('error', reject);
    });
    request.on('error', reject);
    request.end(
      JSON.stringify({name: params.name, query: params.text, variables}),
    );
  });
}

// Rows with these tags carry a hex byte length instead of ending at a newline.
const LENGTH_PREFIXED_TAGS = 'TAOoUSsLlGgMmV';

/** Splits a React Flight response into `{id, tag, body}` rows. */
function parseFlightRows(bytes) {
  const rows = [];
  for (let i = 0; i < bytes.length; ) {
    const colon = bytes.indexOf(0x3a, i);
    if (colon === -1) {
      break;
    }
    const id = parseInt(bytes.toString('latin1', i, colon), 16);
    let tag = String.fromCharCode(bytes[colon + 1]);
    let start = colon + 2;
    let end;
    if (LENGTH_PREFIXED_TAGS.includes(tag)) {
      const comma = bytes.indexOf(0x2c, start);
      const length =
        comma === -1 ? NaN : parseInt(bytes.toString('latin1', start, comma), 16);
      end = comma + 1 + length;
      if (Number.isNaN(length) || end > bytes.length) {
        throw new Error(
          `relay-e2e-test: React Flight row ${id.toString(16)} is truncated.`,
        );
      }
      start = comma + 1;
      i = end;
    } else {
      if (!/[A-Z#rx]/.test(tag)) {
        // A model row: its JSON starts right after the colon.
        tag = '';
        start = colon + 1;
      }
      end = bytes.indexOf(0x0a, start);
      end = end === -1 ? bytes.length : end;
      i = end + 1;
    }
    rows.push({id, tag, body: bytes.toString('utf-8', start, end)});
  }
  return rows;
}

/**
 * Counts what a Flight response streams to render its tree, as React's
 * production build would send it. `outlined` is the number of distinct parts
 * of the tree, or promises, that reach the client as lazy (`$L`) or promise
 * (`$@`) references to rows streamed on their own: async or suspended Server
 * Components, and promises passed to Client Components. A tree of synchronous
 * Server Components whose data is all present has none. `rows` adds the root
 * and one import (`I`) row per client module.
 *
 * The RSC process runs React's development build, which also gives every
 * nested Server Component a row of its own, referenced as plain `$<id>`, and
 * adds debug rows (`D`, `W`, and the owners and stacks of elements). Those are
 * read through, not counted.
 */
function countFlightRows(bytes) {
  const rows = new Map();
  for (const row of parseFlightRows(bytes)) {
    if (row.tag !== 'D' && row.tag !== 'W') {
      rows.set(row.id, row);
    }
  }
  const visited = new Set();
  const imports = new Set();
  const outlined = new Set();
  function visit(id) {
    const row = rows.get(id);
    if (visited.has(id)) {
      return;
    }
    visited.add(id);
    if (row?.tag === 'I') {
      imports.add(id);
    } else if (row?.tag === '') {
      walk(JSON.parse(row.body));
    }
  }
  function walk(value) {
    if (typeof value === 'string') {
      const reference = /^\$([L@]|[QWBKi])?([0-9a-f]+)(:|$)/.exec(value);
      if (reference != null) {
        const id = parseInt(reference[2], 16);
        // A row that has not arrived yet still counts.
        if (/[L@]/.test(reference[1] ?? '') && rows.get(id)?.tag !== 'I') {
          outlined.add(id);
        }
        visit(id);
      }
    } else if (Array.isArray(value)) {
      // An element is ["$", type, key, props, ...development-only fields].
      (value[0] === '$' ? value.slice(1, 4) : value).forEach(walk);
    } else if (value != null && typeof value === 'object') {
      Object.values(value).forEach(walk);
    }
  }
  visit(0);
  return {outlined: outlined.size, rows: 1 + imports.size + outlined.size};
}

module.exports = {
  countFlightRows,
  fromClientModuleId,
  parseFlightRows,
  postGraphQL,
  toClientModuleId,
};
