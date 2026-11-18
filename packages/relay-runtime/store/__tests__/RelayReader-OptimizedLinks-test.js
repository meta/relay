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

import type {ConcreteRequest} from '../../util/RelayConcreteNode';
import type {Variables} from '../../util/RelayRuntimeTypes';
import type {RecordSource, Snapshot} from '../RelayStoreTypes';

const {graphql} = require('../../query/GraphQLTag');
const RelayFeatureFlags = require('../../util/RelayFeatureFlags');
const {
  createOperationDescriptor,
} = require('../RelayModernOperationDescriptor');
const {read} = require('../RelayReader');
const RelayRecordSource = require('../RelayRecordSource');
const {FIELD_GRANULAR_NOTIFICATIONS_KEY} = require('../RelayStoreUtils');

type Flags = {
  ENABLE_FIELD_GRANULAR_NOTIFICATIONS: boolean,
  ENABLE_PERF_PUBLISH: boolean,
  ENABLE_PERF_READER: boolean,
};

function setFlags(flags: Flags): void {
  RelayFeatureFlags.ENABLE_FIELD_GRANULAR_NOTIFICATIONS =
    flags.ENABLE_FIELD_GRANULAR_NOTIFICATIONS;
  RelayFeatureFlags.ENABLE_PERF_PUBLISH = flags.ENABLE_PERF_PUBLISH;
  RelayFeatureFlags.ENABLE_PERF_READER = flags.ENABLE_PERF_READER;
}

function readWith(
  flags: Flags,
  query: ConcreteRequest,
  variables: Variables,
  source: RecordSource,
): Snapshot {
  const previous: Flags = {
    ENABLE_FIELD_GRANULAR_NOTIFICATIONS:
      RelayFeatureFlags.ENABLE_FIELD_GRANULAR_NOTIFICATIONS,
    ENABLE_PERF_PUBLISH: RelayFeatureFlags.ENABLE_PERF_PUBLISH,
    ENABLE_PERF_READER: RelayFeatureFlags.ENABLE_PERF_READER,
  };
  setFlags(flags);
  try {
    const operation = createOperationDescriptor(query, variables);
    return read(source, operation.fragment);
  } finally {
    setFlags(previous);
  }
}

function resultOf(snapshot: Snapshot): unknown {
  return {
    data: snapshot.data,
    fieldErrors: snapshot.fieldErrors,
    isMissingData: snapshot.isMissingData,
    seenRecords: Array.from(snapshot.seenRecords).sort(),
  };
}

// Each case compares RelayReaderOptimized (ENABLE_PERF_READER) with RelayReader
// on links.
describe('RelayReaderOptimized links', () => {
  const query = graphql`
    query RelayReaderOptimizedLinksTestQuery {
      me {
        backgroundImage {
          uri
        }
        firstName
        hometown {
          name
        }
        lastName
      }
    }
  `;

  // With `marked`, the root, the user and the background image have the
  // field-granular marker, so a read that honors the marker records field keys
  // for their fields, and the record ID of the hometown.
  function createSource(marked: boolean): RecordSource {
    const marker = marked ? {[FIELD_GRANULAR_NOTIFICATIONS_KEY]: true} : {};
    return RelayRecordSource.create({
      'client:root': {
        __id: 'client:root',
        __typename: '__Root',
        ...marker,
        me: {__ref: '1'},
      },
      '1': {
        __id: '1',
        __typename: 'User',
        ...marker,
        backgroundImage: {__ref: 'client:1:backgroundImage'},
        firstName: 'Alice',
        hometown: {__ref: 'page:1'},
        lastName: 'Smith',
      },
      'client:1:backgroundImage': {
        __id: 'client:1:backgroundImage',
        __typename: 'Image',
        ...marker,
        uri: 'https://example.com/background.png',
      },
      'page:1': {__id: 'page:1', __typename: 'Page', name: 'Springfield'},
    });
  }

  it.each([
    [true, false],
    [true, true],
    [false, false],
  ])(
    'records what RelayReader records (field-granular notifications: %s, ENABLE_PERF_PUBLISH: %s)',
    (fieldGranularNotifications, perfPublish) => {
      const flags = {
        ENABLE_FIELD_GRANULAR_NOTIFICATIONS: fieldGranularNotifications,
        ENABLE_PERF_PUBLISH: perfPublish,
      };
      const master = readWith(
        {...flags, ENABLE_PERF_READER: false},
        query,
        {},
        createSource(true),
      );
      const optimized = readWith(
        {...flags, ENABLE_PERF_READER: true},
        query,
        {},
        createSource(true),
      );
      expect(Array.from(optimized.seenRecords).sort()).toEqual([
        '__fn:1:backgroundImage',
        '__fn:1:firstName',
        '__fn:1:hometown',
        '__fn:1:lastName',
        '__fn:client:1:backgroundImage:uri',
        '__fn:client:root:me',
        'page:1',
      ]);
      expect(resultOf(optimized)).toEqual(resultOf(master));
    },
  );

  it('ignores the marker with field-granular notifications off and ENABLE_PERF_PUBLISH on', () => {
    // As RelayModernStore's publish does with ENABLE_PERF_PUBLISH: the read
    // matches a read of the same records without the marker.
    const flags = {
      ENABLE_FIELD_GRANULAR_NOTIFICATIONS: false,
      ENABLE_PERF_PUBLISH: true,
    };
    const unmarked = readWith(
      {...flags, ENABLE_PERF_READER: false},
      query,
      {},
      createSource(false),
    );
    const optimized = readWith(
      {...flags, ENABLE_PERF_READER: true},
      query,
      {},
      createSource(true),
    );
    expect(resultOf(optimized)).toEqual(resultOf(unmarked));
  });

  it('adds the fields of a link read twice to the same object', () => {
    // `@include` keeps the compiler from merging the two `backgroundImage`
    // selections, so the reader reads the link twice into the same object.
    const mergeQuery = graphql`
      query RelayReaderOptimizedLinksTestMergeQuery($withUri: Boolean!) {
        me {
          ... @include(if: $withUri) {
            backgroundImage {
              uri
            }
          }
          backgroundImage {
            width
          }
        }
      }
    `;
    const source = RelayRecordSource.create({
      'client:root': {
        __id: 'client:root',
        __typename: '__Root',
        me: {__ref: '1'},
      },
      '1': {
        __id: '1',
        __typename: 'User',
        backgroundImage: {__ref: 'client:1:backgroundImage'},
      },
      'client:1:backgroundImage': {
        __id: 'client:1:backgroundImage',
        __typename: 'Image',
        uri: 'https://example.com/background.png',
        width: 640,
      },
    });
    const flags = {
      ENABLE_FIELD_GRANULAR_NOTIFICATIONS: false,
      ENABLE_PERF_PUBLISH: false,
    };
    const master = readWith(
      {...flags, ENABLE_PERF_READER: false},
      mergeQuery,
      {withUri: true},
      source,
    );
    const optimized = readWith(
      {...flags, ENABLE_PERF_READER: true},
      mergeQuery,
      {withUri: true},
      source,
    );
    expect(optimized.data).toEqual({
      me: {
        backgroundImage: {
          uri: 'https://example.com/background.png',
          width: 640,
        },
      },
    });
    expect(resultOf(optimized)).toEqual(resultOf(master));
  });
});
