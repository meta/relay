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

import type {
  CheckOperationWithUnpublished,
  OperationAvailabilityConfig,
} from '../../network/RelayNetworkTypes';
import type {MissingFieldHandler, RecordSourceJSON} from '../RelayStoreTypes';

const {
  MultiActorEnvironment,
  getActorIdentifier,
} = require('../../multi-actor-environment');
const RelayNetwork = require('../../network/RelayNetwork');
const RelayObservable = require('../../network/RelayObservable');
const {graphql} = require('../../query/GraphQLTag');
const RelayModernEnvironment = require('../RelayModernEnvironment');
const {
  createOperationDescriptor,
} = require('../RelayModernOperationDescriptor');
const RelayModernStore = require('../RelayModernStore');
const RelayRecordSource = require('../RelayRecordSource');
const {ROOT_ID} = require('../RelayStoreUtils');
const invariant = require('invariant');
const {disallowWarnings} = require('relay-test-utils-internal');

disallowWarnings();

const ParentQuery = graphql`
  query RelayModernEnvironmentCheckTestParentQuery($size: [Int]!) {
    me {
      id
      name
      profilePicture(size: $size) {
        uri
      }
    }
  }
`;

describe.each(['RelayModernEnvironment', 'MultiActorEnvironment'])(
  'check()',
  environmentType => {
    let environment;
    let operationDescriptor;
    let source;
    let store;

    describe(environmentType, () => {
      beforeEach(() => {
        source = RelayRecordSource.create();
        store = new RelayModernStore(source, {gcReleaseBufferSize: 0});
        const multiActorEnvironment = new MultiActorEnvironment({
          createNetworkForActor: _actorID => RelayNetwork.create(jest.fn()),
          createStoreForActor: _actorID => store,
        });
        environment =
          environmentType === 'MultiActorEnvironment'
            ? multiActorEnvironment.forActor(getActorIdentifier('actor:1234'))
            : new RelayModernEnvironment({
                network: RelayNetwork.create(jest.fn()),
                store,
              });
        operationDescriptor = createOperationDescriptor(ParentQuery, {
          size: 32,
        });
      });

      it('returns available if all data exists in the environment', () => {
        environment.commitPayload(operationDescriptor, {
          me: {
            id: '4',
            name: 'Zuck',
            profilePicture: {
              uri: 'https://...',
            },
          },
        });
        expect(environment.check(operationDescriptor)).toEqual({
          status: 'available',
          fetchTime: null,
        });
      });

      it('returns available with fetchTime if all data exists in the environment and the query is retained', () => {
        const fetchTime = Date.now();
        jest.spyOn(global.Date, 'now').mockImplementation(() => fetchTime);
        environment.retain(operationDescriptor);
        environment.commitPayload(operationDescriptor, {
          me: {
            id: '4',
            name: 'Zuck',
            profilePicture: {
              uri: 'https://...',
            },
          },
        });
        expect(environment.check(operationDescriptor)).toEqual({
          status: 'available',
          fetchTime,
        });
      });
      it('returns missing if data is missing from the environment', () => {
        environment.commitPayload(operationDescriptor, {
          me: {
            id: '4',
            name: 'Zuck',
            profilePicture: {
              uri: 'https://example.com/32.png',
            },
          },
        });
        const operationDescriptor64 = createOperationDescriptor(ParentQuery, {
          size: 64,
        });
        expect(environment.check(operationDescriptor64)).toEqual({
          status: 'missing',
        });
      });
    });
  },
);

describe('checkOperationWithUnpublished', () => {
  const PICTURE_ID = 'client:4:profilePicture(size:32)';
  let operationDescriptor;
  let source;

  // `me` and its name in the store; the picture link and the picture each in
  // their own unpublished source.
  const storeRecords: RecordSourceJSON = {
    [ROOT_ID]: {__id: ROOT_ID, __typename: '__Root', me: {__ref: '4'}},
    '4': {__id: '4', __typename: 'User', id: '4', name: 'Zuck'},
  };
  function pictureLink() {
    return RelayRecordSource.create({
      '4': {
        __id: '4',
        __typename: 'User',
        'profilePicture(size:32)': {__ref: PICTURE_ID},
      },
    });
  }
  function picture() {
    return RelayRecordSource.create({
      [PICTURE_ID]: {__id: PICTURE_ID, __typename: 'Image', uri: 'https://...'},
    });
  }

  beforeEach(() => {
    operationDescriptor = createOperationDescriptor(ParentQuery, {size: 32});
  });

  // An environment whose network records the `operationAvailability` each
  // `execute()` gives it.
  function createEnvironment(
    records: RecordSourceJSON,
    missingFieldHandlers?: ReadonlyArray<MissingFieldHandler>,
  ) {
    source = RelayRecordSource.create(records);
    const availabilities: Array<?OperationAvailabilityConfig> = [];
    const environment = new RelayModernEnvironment({
      missingFieldHandlers,
      network: {
        execute: (
          _request,
          _variables,
          _cacheConfig,
          _uploadables,
          _logRequestInfo,
          _encryptedVariables,
          _preprocessResponse,
          operationAvailability,
        ) => {
          availabilities.push(operationAvailability);
          return RelayObservable.create(() => {});
        },
      },
      store: new RelayModernStore(source, {gcReleaseBufferSize: 0}),
    });
    return {availabilities, environment};
  }

  function checkOperationWithUnpublished(
    environment: RelayModernEnvironment,
    availabilities: Array<?OperationAvailabilityConfig>,
  ): CheckOperationWithUnpublished {
    environment.execute({operation: operationDescriptor}).subscribe({});
    const check =
      availabilities[availabilities.length - 1]?.checkOperationWithUnpublished;
    invariant(check != null, 'Expected execute() to pass the network one');
    return check;
  }

  it('reads the unpublished records over the store', () => {
    const {availabilities, environment} = createEnvironment(storeRecords);
    const check = checkOperationWithUnpublished(environment, availabilities);
    expect(environment.check(operationDescriptor)).toEqual({
      status: 'missing',
    });
    expect(check(operationDescriptor, [pictureLink()])).toEqual({
      status: 'missing',
    });
    expect(check(operationDescriptor, [pictureLink(), picture()])).toEqual({
      status: 'available',
      fetchTime: null,
    });
    expect(source.has(PICTURE_ID)).toBe(false);
  });

  it('reads the unpublished records over an optimistic update in flight', () => {
    const {availabilities, environment} = createEnvironment(storeRecords);
    const check = checkOperationWithUnpublished(environment, availabilities);
    // The optimistic update links the picture to one without a `uri`.
    const optimistic = environment.applyUpdate({
      storeUpdater: store => {
        const optimisticPicture =
          store.get('client:optimistic-picture') ??
          store.create('client:optimistic-picture', 'Image');
        store
          .get('4')
          ?.setLinkedRecord(optimisticPicture, 'profilePicture', {size: 32});
      },
    });
    expect(environment.check(operationDescriptor)).toEqual({
      status: 'missing',
    });
    // Published, the unpublished records land beneath the optimistic update,
    // as a fetched response would. So they, not what the update shows
    // meanwhile, decide whether a fetch is needed.
    expect(check(operationDescriptor, [pictureLink(), picture()])).toEqual({
      status: 'available',
      fetchTime: null,
    });
    environment.commitUpdate(store => {
      const committed = store.create(PICTURE_ID, 'Image');
      committed.setValue('https://...', 'uri');
      store.get('4')?.setLinkedRecord(committed, 'profilePicture', {size: 32});
    });
    expect(environment.check(operationDescriptor)).toEqual({
      status: 'missing',
    });
    optimistic.dispose();
    expect(environment.check(operationDescriptor)).toEqual({
      status: 'available',
      fetchTime: null,
    });
  });

  it('commits what missing-field handlers supply, but not the unpublished records', () => {
    const handle = jest.fn((field, parentRecord, _args, _store) =>
      field.name === 'me' && parentRecord?.getDataID() === ROOT_ID
        ? '4'
        : undefined,
    );
    const {availabilities, environment} = createEnvironment(
      {
        [ROOT_ID]: {__id: ROOT_ID, __typename: '__Root'},
        '4': storeRecords['4'],
      },
      [{handle, kind: 'linked'}],
    );
    const check = checkOperationWithUnpublished(environment, availabilities);
    const callback = jest.fn();
    environment.subscribe(
      environment.lookup(operationDescriptor.fragment),
      callback,
    );

    // Available only through the handler's `me` link. Readers don't run the
    // handlers, so the link is committed, as `check()` commits it.
    expect(check(operationDescriptor, [pictureLink(), picture()])).toEqual({
      status: 'available',
      fetchTime: null,
    });
    expect(handle).toHaveBeenCalled();
    expect(source.get(ROOT_ID)).toEqual({
      __id: ROOT_ID,
      __typename: '__Root',
      me: {__ref: '4'},
    });
    expect(source.get('4')).toEqual(storeRecords['4']);
    expect(source.has(PICTURE_ID)).toBe(false);
    expect(callback).toHaveBeenCalledTimes(1);
  });
});
