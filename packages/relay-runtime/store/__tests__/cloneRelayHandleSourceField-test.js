/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict-local
 * @format
 * @oncall relay
 */

'use strict';

const getRelayHandleKey = require('../../util/getRelayHandleKey');
const {LINKED_FIELD, LINKED_HANDLE} = require('../../util/RelayConcreteNode');
const cloneRelayHandleSourceField = require('../cloneRelayHandleSourceField');
const {graphql} = require('relay-runtime');

describe('cloneRelayHandleSourceField()', () => {
  let selections;

  beforeEach(() => {
    const TestQuery = graphql`
      query cloneRelayHandleSourceFieldTestTestQuery {
        me {
          address @__clientField(handle: "test") {
            street
          }
        }
      }
    `;
    // Get the selections on `me`.
    selections = TestQuery.operation.selections[0].selections;
  });

  it('returns a clone of the source, with the same name as the handle', () => {
    // $FlowFixMe[incompatible-use]
    const handleField = selections.find(node => node.kind === LINKED_HANDLE);
    // $FlowFixMe[incompatible-use]
    const sourceField = selections.find(node => node.kind === LINKED_FIELD);
    const clone = cloneRelayHandleSourceField(
      handleField as $FlowFixMe,
      // $FlowFixMe[incompatible-type]
      selections,
      {},
    );

    expect(clone.kind).toBe(LINKED_FIELD);
    expect(clone.name).toBe(getRelayHandleKey('test', null, 'address'));
    // $FlowFixMe[incompatible-use]
    expect(clone.selections).toEqual(sourceField.selections);
  });

  it('throws if the source field is not present', () => {
    // $FlowFixMe[incompatible-use]
    const handleField = selections.find(node => node.kind === LINKED_HANDLE);
    // $FlowFixMe[incompatible-use]
    selections = selections.filter(node => node.kind === LINKED_HANDLE);

    expect(() =>
      // $FlowFixMe[incompatible-type]
      cloneRelayHandleSourceField(handleField as $FlowFixMe, selections, {}),
    ).toThrowError(
      'cloneRelayHandleSourceField: Expected a corresponding source field ' +
        'for handle `test`.',
    );
  });
});
