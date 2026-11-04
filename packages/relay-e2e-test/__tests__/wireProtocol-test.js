/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

'use strict';

const {parseFlightRows} = require('../src/rsc/wireProtocol');

test('splits newline-terminated and length-prefixed rows', () => {
  expect(parseFlightRows(Buffer.from('0:"$L1"\n1:T5,hello'))).toEqual([
    {id: 0, tag: '', body: '"$L1"'},
    {id: 1, tag: 'T', body: 'hello'},
  ]);
});

test('throws on a length-prefixed row cut off before its length', () => {
  expect(() => parseFlightRows(Buffer.from('0:"$L1"\n1:T5'))).toThrow(
    'relay-e2e-test: React Flight row 1 is truncated.',
  );
});

test('throws on a length-prefixed row shorter than its length', () => {
  expect(() => parseFlightRows(Buffer.from('0:"$L1"\n1:Ta,hello'))).toThrow(
    'relay-e2e-test: React Flight row 1 is truncated.',
  );
});
