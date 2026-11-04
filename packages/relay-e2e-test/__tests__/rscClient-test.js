/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

'use strict';

jest.mock('child_process', () => ({
  fork: () => {
    throw new Error('fork failed');
  },
}));

const {createRscSession} = require('../src/rsc/rscClient');

test('a session that fails to start leaves no globals behind', () => {
  const names = [
    'ReadableStream',
    'TextDecoder',
    'TextEncoder',
    '__webpack_chunk_load__',
    '__webpack_require__',
  ];
  const before = names.map(name =>
    Object.getOwnPropertyDescriptor(global, name),
  );
  expect(() =>
    createRscSession({fixtureDir: '/nonexistent', flushOnShell: false, host: 'nextjs'}),
  ).toThrow('fork failed');
  expect(names.map(name => Object.getOwnPropertyDescriptor(global, name))).toEqual(
    before,
  );
});
