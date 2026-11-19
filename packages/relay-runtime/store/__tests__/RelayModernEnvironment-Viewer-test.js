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
import type {PayloadError} from '../../network/RelayNetworkTypes';
import type {Snapshot} from '../RelayStoreTypes';
import type {RelayModernEnvironmentViewerTest_SetLocationMutation$variables} from './__generated__/RelayModernEnvironmentViewerTest_SetLocationMutation.graphql';
import type {RequestParameters} from 'relay-runtime/util/RelayConcreteNode';
import type {
  CacheConfig,
  Variables,
} from 'relay-runtime/util/RelayRuntimeTypes';

const commitMutation = require('../../mutations/commitMutation');
const RelayNetwork = require('../../network/RelayNetwork');
const RelayObservable = require('../../network/RelayObservable');
const RelayModernEnvironment = require('../RelayModernEnvironment');
const {
  createOperationDescriptor,
} = require('../RelayModernOperationDescriptor');
const {createReaderSelector} = require('../RelayModernSelector');
const RelayModernStore = require('../RelayModernStore');
const RelayRecordSource = require('../RelayRecordSource');
const {ROOT_ID} = require('../RelayStoreUtils');
const {getRequest, graphql} = require('relay-runtime');
const {disallowWarnings} = require('relay-test-utils-internal');

disallowWarnings();

describe('Mutations on viewer', () => {
  let dataSource;
  let environment;
  let mutation;
  let onCompleted;
  let onError;
  let variables;
  let source;
  let store;

  beforeEach(() => {
    mutation = graphql`
      mutation RelayModernEnvironmentViewerTest_SetLocationMutation(
        $input: LocationInput!
      ) {
        setLocation(input: $input) {
          viewer {
            marketplace_settings {
              location {
                latitude
                longitude
              }
            }
          }
        }
      }
    `;
    variables = {
      input: {
        longitude: 30.0,
        latitude: 30.0,
      },
    } as RelayModernEnvironmentViewerTest_SetLocationMutation$variables;

    onCompleted = jest.fn<[{...}, ?Array<PayloadError>], void>();
    onError = jest.fn<[Error], void>();
    const fetch = (
      _query: RequestParameters,
      _variables: Variables,
      _cacheConfig: CacheConfig,
    ) => {
      // $FlowFixMe[missing-local-annot] Error found while enabling LTI on this file
      return RelayObservable.create(sink => {
        dataSource = sink;
      });
    };
    source = RelayRecordSource.create({});
    store = new RelayModernStore(source);
    environment = new RelayModernEnvironment({
      network: RelayNetwork.create(fetch),
      store,
    });
  });

  it("doesn't overwrite existing data in a mutation under viewer field", () => {
    const query = graphql`
      query RelayModernEnvironmentViewerTestQuery {
        viewer {
          marketplace_settings {
            categories
          }
        }
      }
    `;
    const payload = {
      viewer: {
        marketplace_settings: {
          categories: ['a', 'b', 'c'],
        },
      },
    };
    const ShortCutQuery = getRequest(query);
    const operationDescriptor = createOperationDescriptor(ShortCutQuery, {});
    const selector = createReaderSelector(
      ShortCutQuery.fragment,
      ROOT_ID,
      {},
      operationDescriptor.request,
    );
    const callback = jest.fn<[Snapshot], void>();
    const snapshot = environment.lookup(selector);
    environment.subscribe(snapshot, callback);

    environment.commitPayload(operationDescriptor, payload);
    expect(callback).toBeCalledTimes(1);
    expect(callback.mock.calls[0][0].data).toEqual({
      viewer: {marketplace_settings: {categories: ['a', 'b', 'c']}},
    });

    callback.mockClear();
    commitMutation(environment, {
      mutation,
      variables,
      onCompleted,
      onError,
    });

    dataSource.next({
      data: {
        setLocation: {
          viewer: {
            marketplace_settings: {
              location: {
                latitude: 30.0,
                longitude: 30.0,
              },
            },
          },
        },
      },
    });
    expect(callback).toBeCalledTimes(0); // no changes to selector result
  });
});
