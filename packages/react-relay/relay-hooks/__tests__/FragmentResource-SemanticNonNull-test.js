/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 * @format
 * @oncall relay
 */

'use strict';

import {getFragmentResourceForEnvironment} from '../legacy/FragmentResource';
import {createOperationDescriptor, graphql} from 'relay-runtime';
import RelayNetwork from 'relay-runtime/network/RelayNetwork';
import RelayModernEnvironment from 'relay-runtime/store/RelayModernEnvironment';
import RelayModernStore from 'relay-runtime/store/RelayModernStore';
import RelayRecordSource from 'relay-runtime/store/RelayRecordSource';

const componentDisplayName = 'TestComponent';

let query;
let FragmentResource;

beforeEach(() => {
  const source = RelayRecordSource.create({
    'client:root': {
      __id: 'client:root',
      __typename: '__Root',
      me: {__ref: '1'},
    },
    '1': {
      __id: '1',
      __typename: 'User',
      id: '1',
      name: null,
      __errors: {
        name: [
          {
            message: 'There was an error!',
            path: ['me', 'name'],
          },
        ],
      },
    },
  });

  const store = new RelayModernStore(source, {
    gcReleaseBufferSize: 0,
  });

  const environment = new RelayModernEnvironment({
    network: RelayNetwork.create(jest.fn()),
    store,
  });
  FragmentResource = getFragmentResourceForEnvironment(environment);

  query = createOperationDescriptor(
    graphql`
      query FragmentResourceSemanticNonNullTestQuery($id: ID!) {
        node(id: $id) {
          __typename
          ...FragmentResourceSemanticNonNullTestFragment1
            @dangerously_unaliased_fixme
          ...FragmentResourceSemanticNonNullTestFragment2
            @dangerously_unaliased_fixme
        }
      }
    `,
    {id: '1'},
  );
});

test('Throws if a field has error with explicit error handling enabled', () => {
  expect(() => {
    FragmentResource.read(
      graphql`
        fragment FragmentResourceSemanticNonNullTestFragment1 on User
        @throwOnFieldError {
          name
        }
      `,
      {
        __id: '1',
        __fragments: {
          FragmentResourceSemanticNonNullTestFragment1: {},
        },
        __fragmentOwner: query.request,
      },
      componentDisplayName,
    );
  }).toThrowError(
    "Relay: Received a field error in the server response for field 'name' in 'FragmentResourceSemanticNonNullTestFragment1'. Message: There was an error!",
  );
});

test('Does not throw if a field has error without explicit error handling enabled', () => {
  expect(() => {
    FragmentResource.read(
      graphql`
        fragment FragmentResourceSemanticNonNullTestFragment2 on User {
          name
        }
      `,
      {
        __id: '1',
        __fragments: {
          FragmentResourceSemanticNonNullTestFragment2: {},
        },
        __fragmentOwner: query.request,
      },
      componentDisplayName,
    );
  }).not.toThrow();
});
