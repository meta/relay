/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @format
 * @oncall relay
 */

'use strict';

const {graphql} = require('../../query/GraphQLTag');
const RelayFeatureFlags = require('../../util/RelayFeatureFlags');
const defaultGetDataID = require('../defaultGetDataID');
const {
  createOperationDescriptor,
} = require('../RelayModernOperationDescriptor');
const RelayModernRecord = require('../RelayModernRecord');
const {createNormalizationSelector} = require('../RelayModernSelector');
const RelayModernStore = require('../RelayModernStore');
const {read} = require('../RelayReader');
const RelayRecordSource = require('../RelayRecordSource');
const {normalize} = require('../RelayResponseNormalizer');
const {ROOT_ID, ROOT_TYPE} = require('../RelayStoreUtils');

describe('RelayReader error fields', () => {
  it('adds the errors to fieldErrors', () => {
    const source = RelayRecordSource.create({
      'client:root': {
        __id: 'client:root',
        __typename: '__Root',
        me: {__ref: '1'},
      },
      1: {
        __id: '1',
        id: '1',
        __typename: 'User',
        lastName: null,
        __errors: {
          lastName: [
            {
              message: 'There was an error!',
              path: ['me', 'lastName'],
            },
          ],
        },
      },
    });

    const FooQuery = graphql`
      query RelayReaderRelayErrorHandlingTest1Query {
        me {
          lastName
        }
      }
    `;
    const operation = createOperationDescriptor(FooQuery, {id: '1'});
    const {data, fieldErrors} = read(source, operation.fragment, null);
    expect(data).toEqual({me: {lastName: null}});
    expect(fieldErrors).toEqual([
      {
        owner: 'RelayReaderRelayErrorHandlingTest1Query',
        fieldPath: 'me.lastName',
        error: {
          message: 'There was an error!',
          path: ['me', 'lastName'],
        },
        kind: 'relay_field_payload.error',
        shouldThrow: false,
        handled: false,
      },
    ]);
  });

  it('reports the field path of a server error stored by the normalizer', () => {
    // The normalizer drops `path` when it attaches an error to a record, so
    // the reader has to work out the path itself.
    const FooQuery = require('./__generated__/RelayReaderRelayErrorHandlingTest1Query.graphql');
    const source = new RelayRecordSource();
    source.set(ROOT_ID, RelayModernRecord.create(ROOT_ID, ROOT_TYPE));
    normalize(
      source,
      createNormalizationSelector(FooQuery.operation, ROOT_ID, {}),
      {me: {__typename: 'User', id: '1', lastName: null}},
      {
        getDataID: defaultGetDataID,
        treatMissingFieldsAsNull: false,
        deferDeduplicatedFields: false,
        log: null,
      },
      [{message: 'There was an error!', path: ['me', 'lastName']}],
    );
    const operation = createOperationDescriptor(FooQuery, {});
    const {fieldErrors} = read(source, operation.fragment, null);
    expect(fieldErrors).toEqual([
      {
        owner: 'RelayReaderRelayErrorHandlingTest1Query',
        fieldPath: 'me.lastName',
        error: {message: 'There was an error!'},
        kind: 'relay_field_payload.error',
        shouldThrow: false,
        handled: false,
      },
    ]);
  });

  it('adds the errors to fieldErrors including missingData - without @catch', () => {
    const source = RelayRecordSource.create({
      'client:root': {
        __id: 'client:root',
        __typename: '__Root',
        me: {__ref: '1'},
      },
      1: {
        __id: '1',
        id: '1',
        __typename: 'User',
        lastName: null,
        __errors: {
          lastName: [
            {
              message: 'There was an error!',
              path: ['me', 'lastName'],
            },
          ],
        },
      },
    });

    const FooQuery = graphql`
      query RelayReaderRelayErrorHandlingTest4Query($size: [Int])
      @throwOnFieldError {
        me {
          lastName
          profilePicture(size: $size) {
            uri
          }
        }
      }
    `;
    const operation = createOperationDescriptor(FooQuery, {size: 42});
    const {fieldErrors} = read(source, operation.fragment, null);

    expect(fieldErrors).toEqual([
      {
        owner: 'RelayReaderRelayErrorHandlingTest4Query',
        fieldPath: 'me.lastName',
        kind: 'relay_field_payload.error',
        error: {
          message: 'There was an error!',
          path: ['me', 'lastName'],
        },
        shouldThrow: true,
        handled: false,
      },
      {
        owner: 'RelayReaderRelayErrorHandlingTest4Query',
        fieldPath: 'me.profilePicture',
        kind: 'missing_expected_data.throw',
        handled: false,
      },
    ]);
  });

  it('adds the errors to fieldErrors including missingData within plural fields - without @catch', () => {
    const source = RelayRecordSource.create({
      'client:root': {
        __id: 'client:root',
        __typename: '__Root',
        nodes: {__refs: ['1']},
      },
      1: {
        __id: '1',
        id: '1',
        __typename: 'User',
        lastName: null,
        __errors: {
          lastName: [
            {
              message: 'There was an error!',
              path: ['me', 'lastName'],
            },
          ],
        },
      },
    });

    const FooQuery = graphql`
      query RelayReaderRelayErrorHandlingTestMissingPluralQuery($size: [Int])
      @throwOnFieldError {
        nodes {
          lastName
          profilePicture(size: $size) {
            uri
          }
        }
      }
    `;
    const operation = createOperationDescriptor(FooQuery, {size: 42});
    const {fieldErrors} = read(source, operation.fragment, null);

    expect(fieldErrors).toEqual([
      {
        owner: 'RelayReaderRelayErrorHandlingTestMissingPluralQuery',
        fieldPath: 'nodes.0.lastName',
        kind: 'relay_field_payload.error',
        error: {
          message: 'There was an error!',
          path: ['me', 'lastName'],
        },
        shouldThrow: true,
        handled: false,
      },
      {
        owner: 'RelayReaderRelayErrorHandlingTestMissingPluralQuery',
        fieldPath: 'nodes.0.profilePicture',
        kind: 'missing_expected_data.throw',
        handled: false,
      },
    ]);
  });

  it('adds the errors to fieldErrors including missingData - with @catch', () => {
    const source = RelayRecordSource.create({
      'client:root': {
        __id: 'client:root',
        __typename: '__Root',
        me: {__ref: '1'},
      },
      1: {
        __id: '1',
        id: '1',
        __typename: 'User',
        lastName: null,
        __errors: {
          lastName: [
            {
              message: 'There was an error!',
              path: ['me', 'lastName'],
            },
          ],
        },
      },
    });

    const FooQuery = graphql`
      query RelayReaderRelayErrorHandlingTest3Query($size: [Int]) {
        me @catch {
          lastName
          profilePicture(size: $size) {
            uri
          }
        }
      }
    `;
    const operation = createOperationDescriptor(FooQuery, {size: 42});
    const {data, fieldErrors} = read(source, operation.fragment, null);

    // we have a task out for adding path to missingData. Meantime that array is empty.
    expect(data).toEqual({
      me: {
        ok: false,
        errors: [
          {
            path: ['me', 'lastName'],
          },
          {
            path: ['me', 'profilePicture'],
          },
        ],
      },
    });

    expect(fieldErrors).toEqual([
      {
        error: {message: 'There was an error!', path: ['me', 'lastName']},
        fieldPath: 'me.lastName',
        handled: true,
        kind: 'relay_field_payload.error',
        owner: 'RelayReaderRelayErrorHandlingTest3Query',
        shouldThrow: false,
      },
      {
        fieldPath: 'me.profilePicture',
        kind: 'missing_expected_data.log',
        owner: 'RelayReaderRelayErrorHandlingTest3Query',
      },
    ]);
  });
  test('@throwOnFieldError on a resolver rootFragment that reads field error will cause that resolver to be treated as a field error by the reader', () => {
    const source = RelayRecordSource.create({
      'client:root': {
        __id: 'client:root',
        __typename: '__Root',
        me: {__ref: '1'},
      },
      1: {
        __id: '1',
        id: '1',
        __typename: 'User',
        lastName: null,
        __errors: {
          lastName: [
            {
              message: 'There was an error!',
              path: ['me', 'lastName'],
            },
          ],
        },
      },
    });

    const FooQuery = graphql`
      query RelayReaderRelayErrorHandlingTest2Query {
        me {
          last_name_throw_on_field_error
        }
      }
    `;

    const operation = createOperationDescriptor(FooQuery, {size: 42});
    const {data, fieldErrors} = read(source, operation.fragment, null);

    expect(data).toEqual({
      me: {
        last_name_throw_on_field_error: null,
      },
    });

    expect(fieldErrors).toEqual([
      {
        error: {message: 'There was an error!', path: ['me', 'lastName']},
        fieldPath: 'lastName',
        // handled is true because we handled the error by making
        // last_name_throw_on_field_error null
        handled: true,
        kind: 'relay_field_payload.error',
        owner: 'UserLastNameThrowOnFieldErrorResolver',
        shouldThrow: true,
      },
    ]);
  });

  test('@throwOnFieldError reading a resolver with @throwOnFieldError on its rootFragment that reads field error will cause that resolver to be treated as a field error by the reader', () => {
    const source = RelayRecordSource.create({
      'client:root': {
        __id: 'client:root',
        __typename: '__Root',
        me: {__ref: '1'},
      },
      1: {
        __id: '1',
        id: '1',
        __typename: 'User',
        lastName: null,
        __errors: {
          lastName: [
            {
              message: 'There was an error!',
              path: ['me', 'lastName'],
            },
          ],
        },
      },
    });

    const FooQuery = graphql`
      query RelayReaderRelayErrorHandlingTest5Query @throwOnFieldError {
        me {
          last_name_throw_on_field_error
        }
      }
    `;

    const operation = createOperationDescriptor(FooQuery, {size: 42});
    const {fieldErrors} = read(source, operation.fragment, null);

    expect(fieldErrors).toEqual([
      {
        error: {message: 'There was an error!', path: ['me', 'lastName']},
        fieldPath: 'lastName',
        // handled is false because we want this to throw
        // last_name_throw_on_field_error null
        handled: false,
        kind: 'relay_field_payload.error',
        owner: 'UserLastNameThrowOnFieldErrorResolver',
        shouldThrow: true,
      },
    ]);
  });

  test('@throwOnFieldError reading a client edge resolver which points to a record with missing data logs the correct path', () => {
    const source = RelayRecordSource.create({
      'client:root': {
        __id: 'client:root',
        __typename: '__Root',
        me: {__ref: '1'},
      },
      1: {
        __id: '1',
        id: '1',
        __typename: 'User',
        name: 'Proto Mark', // Read by the resolver fragment
      },
      1337: {
        __id: '1337',
        id: '1337',
        __typename: 'User',
        // firstName is missing
      },
    });

    const FooQuery = graphql`
      query RelayReaderRelayErrorHandlingTestResolverClientEdgeWithMissingDataQuery
      @throwOnFieldError {
        me {
          client_edge @waterfall {
            firstName
          }
        }
      }
    `;

    const operation = createOperationDescriptor(FooQuery, {size: 42});
    const {fieldErrors} = read(source, operation.fragment, null);

    expect(fieldErrors).toEqual([
      {
        fieldPath: 'me.client_edge.firstName',
        kind: 'missing_expected_data.throw',
        handled: false,
        owner:
          'RelayReaderRelayErrorHandlingTestResolverClientEdgeWithMissingDataQuery',
      },
    ]);
  });

  test('@throwOnFieldError reading a client edge to client object resolver which points to a record with missing data logs the correct path', () => {
    const source = RelayRecordSource.create({
      'client:root': {
        __id: 'client:root',
        __typename: '__Root',
        me: {__ref: '1'},
      },
      1: {
        __id: '1',
        id: '1',
        __typename: 'User',
        birthdate: {__ref: '2'},
      },
      2: {
        __id: '2',
        id: '2',
        __typename: 'Date',
        day: 6,
        month: 1,
        year: 1985,
      },
    });
    const store = new RelayModernStore(source);

    const FooQuery = graphql`
      query RelayReaderRelayErrorHandlingTestResolverClientEdgeClientObjectWithMissingDataQuery
      @throwOnFieldError {
        me {
          astrological_sign {
            # Compiler forces us to use @catch here
            notes @catch(to: NULL) # Not in the store!
          }
        }
      }
    `;

    const operation = createOperationDescriptor(FooQuery, {});
    const {fieldErrors} = store.lookup(operation.fragment);

    expect(fieldErrors).toEqual([
      {
        fieldPath: 'me.astrological_sign.notes',
        kind: 'missing_expected_data.throw',
        handled: true,
        owner:
          'RelayReaderRelayErrorHandlingTestResolverClientEdgeClientObjectWithMissingDataQuery',
      },
    ]);
  });

  test('@throwOnFieldError reading a client edge to PLURAL client object resolver which points to records with missing data logs the correct paths with index segments', () => {
    const source = RelayRecordSource.create({
      'client:root': {
        __id: 'client:root',
        __typename: '__Root',
        me: {__ref: '1'},
      },
      1: {
        __id: '1',
        id: '1',
        __typename: 'User', // Read by the all_astrological_signs resolver fragment
      },
    });
    const store = new RelayModernStore(source);
    const FooQuery = graphql`
      query RelayReaderRelayErrorHandlingTestResolverClientPluralEdgeClientObjectWithMissingDataQuery
      @throwOnFieldError {
        all_astrological_signs {
          # Compiler forces us to use @catch here
          notes @catch(to: NULL) # Not in the store!
        }
      }
    `;
    const operation = createOperationDescriptor(FooQuery, {});
    const {fieldErrors} = store.lookup(operation.fragment);
    for (let i = 0; i < fieldErrors.length; i++) {
      expect(fieldErrors[i]).toEqual({
        fieldPath: `all_astrological_signs.${i}.notes`,
        kind: 'missing_expected_data.throw',
        handled: true,
        owner:
          'RelayReaderRelayErrorHandlingTestResolverClientPluralEdgeClientObjectWithMissingDataQuery',
      });
    }
  });

  test('@catch(to: NULL) on a client edge to server object returns data when available', () => {
    const source = RelayRecordSource.create({
      'client:root': {
        __id: 'client:root',
        __typename: '__Root',
        me: {__ref: '1'},
      },
      1: {
        __id: '1',
        id: '1',
        __typename: 'User',
        name: 'Proto Mark', // Read by the resolver fragment
      },
      1337: {
        __id: '1337',
        id: '1337',
        __typename: 'User',
        firstName: 'Mark',
      },
    });

    const FooQuery = graphql`
      query RelayReaderRelayErrorHandlingTestCatchOnClientEdgeDataAvailableQuery {
        me {
          client_edge @waterfall @catch(to: NULL) {
            firstName
          }
        }
      }
    `;

    const operation = createOperationDescriptor(FooQuery, {});
    const {data, fieldErrors} = read(source, operation.fragment, null);

    // @catch(to: NULL) passes through data unwrapped when no errors
    expect(data).toEqual({
      me: {
        client_edge: {firstName: 'Mark'},
      },
    });
    expect(fieldErrors).toEqual(null);
  });

  test('@catch(to: NULL) on a client edge to server object returns null when data is missing instead of throwing', () => {
    const source = RelayRecordSource.create({
      'client:root': {
        __id: 'client:root',
        __typename: '__Root',
        me: {__ref: '1'},
      },
      1: {
        __id: '1',
        id: '1',
        __typename: 'User',
        name: 'Proto Mark', // Read by the resolver fragment
      },
      1337: {
        __id: '1337',
        id: '1337',
        __typename: 'User',
        // firstName is missing
      },
    });

    const FooQuery = graphql`
      query RelayReaderRelayErrorHandlingTestCatchOnClientEdgeMissingDataQuery
      @throwOnFieldError {
        me {
          client_edge @waterfall @catch(to: NULL) {
            firstName
          }
        }
      }
    `;

    const operation = createOperationDescriptor(FooQuery, {});
    const {data, fieldErrors} = read(source, operation.fragment, null);

    // @catch(to: NULL) returns null instead of throwing
    expect(data).toEqual({
      me: {
        client_edge: null,
      },
    });

    expect(fieldErrors).toEqual([
      {
        fieldPath: 'me.client_edge.firstName',
        kind: 'missing_expected_data.throw',
        handled: true,
        owner:
          'RelayReaderRelayErrorHandlingTestCatchOnClientEdgeMissingDataQuery',
      },
    ]);
  });

  test('@catch(to: NULL) on a client edge to server object returns null when field has errors instead of throwing', () => {
    const source = RelayRecordSource.create({
      'client:root': {
        __id: 'client:root',
        __typename: '__Root',
        me: {__ref: '1'},
      },
      1: {
        __id: '1',
        id: '1',
        __typename: 'User',
        name: 'Proto Mark',
      },
      1337: {
        __id: '1337',
        id: '1337',
        __typename: 'User',
        lastName: null,
        __errors: {
          lastName: [
            {
              message: 'There was an error!',
              path: ['me', 'client_edge', 'lastName'],
            },
          ],
        },
      },
    });

    const FooQuery = graphql`
      query RelayReaderRelayErrorHandlingTestCatchOnClientEdgeFieldErrorQuery
      @throwOnFieldError {
        me {
          client_edge @waterfall @catch(to: NULL) {
            lastName
          }
        }
      }
    `;

    const operation = createOperationDescriptor(FooQuery, {});
    const {data, fieldErrors} = read(source, operation.fragment, null);

    // @catch(to: NULL) returns null instead of throwing
    expect(data).toEqual({
      me: {
        client_edge: null,
      },
    });

    expect(fieldErrors).toEqual([
      {
        error: {
          message: 'There was an error!',
          path: ['me', 'client_edge', 'lastName'],
        },
        fieldPath: 'me.client_edge.lastName',
        handled: true,
        kind: 'relay_field_payload.error',
        owner:
          'RelayReaderRelayErrorHandlingTestCatchOnClientEdgeFieldErrorQuery',
        shouldThrow: true,
      },
    ]);
  });

  test('@catch(to: NULL) on a client edge to client object returns null when data is missing instead of throwing', () => {
    const source = RelayRecordSource.create({
      'client:root': {
        __id: 'client:root',
        __typename: '__Root',
        me: {__ref: '1'},
      },
      1: {
        __id: '1',
        id: '1',
        __typename: 'User',
        birthdate: {__ref: '2'},
      },
      2: {
        __id: '2',
        id: '2',
        __typename: 'Date',
        day: 6,
        month: 1,
        year: 1985,
      },
    });
    const store = new RelayModernStore(source);

    const FooQuery = graphql`
      query RelayReaderRelayErrorHandlingTestCatchOnClientEdgeClientObjectQuery
      @throwOnFieldError {
        me {
          astrological_sign @catch(to: NULL) {
            notes # Not in the store!
          }
        }
      }
    `;

    const operation = createOperationDescriptor(FooQuery, {});
    const {data, fieldErrors} = store.lookup(operation.fragment);

    // @catch(to: NULL) on the client edge itself returns null
    expect(data).toEqual({
      me: {
        astrological_sign: null,
      },
    });

    expect(fieldErrors).toEqual([
      {
        fieldPath: 'me.astrological_sign.notes',
        kind: 'missing_expected_data.throw',
        handled: true,
        owner:
          'RelayReaderRelayErrorHandlingTestCatchOnClientEdgeClientObjectQuery',
      },
    ]);
  });

  it('does not report missing data within an inline fragment that does not match', () => {
    const source = RelayRecordSource.create({
      'client:root': {
        __id: 'client:root',
        __typename: '__Root',
        'node(id:"4")': {__ref: '4'},
      },
      'client:__type:User': {
        __isMaybeNodeInterface: false,
      },
      4: {
        __id: '4',
        id: '4',
        __typename: 'User',
      },
    });

    const FooQuery = graphql`
      query RelayReaderRelayErrorHandlingTestInlineFragmentQuery
      @throwOnFieldError {
        node(id: "4") {
          # GraphQL lets us spread this here as long as there is at least one
          # type that overlaps
          ... on MaybeNodeInterface {
            name
          }
        }
      }
    `;
    const operation = createOperationDescriptor(FooQuery, {});
    const {fieldErrors, isMissingData} = read(source, operation.fragment, null);

    expect(isMissingData).toBe(false);
    expect(fieldErrors).toEqual(null);
  });

  it('does report missing data within an inline fragment that does match', () => {
    const source = RelayRecordSource.create({
      'client:root': {
        __id: 'client:root',
        __typename: '__Root',
        'node(id:"4")': {__ref: '4'},
      },
      'client:__type:User': {
        __isMaybeNodeInterface: true,
      },
      4: {
        __id: '4',
        id: '4',
        __typename: 'NonNodeNoID',
        // NOTE: `name` is missing
      },
    });

    const FooQuery = graphql`
      query RelayReaderRelayErrorHandlingTestInlineFragmentMatchesQuery
      @throwOnFieldError {
        node(id: "4") {
          # GraphQL lets us spread this here as long as there is at least one
          # type that overlaps
          ... on MaybeNodeInterface {
            name
          }
        }
      }
    `;
    const operation = createOperationDescriptor(FooQuery, {});
    const {fieldErrors, isMissingData} = read(source, operation.fragment, null);

    expect(isMissingData).toBe(true);
    expect(fieldErrors).toEqual([
      // We are missing the metadata bout the interface
      {
        fieldPath: 'node.<abstract-type-hint>',
        handled: false,
        kind: 'missing_expected_data.throw',
        owner: 'RelayReaderRelayErrorHandlingTestInlineFragmentMatchesQuery',
      },
      // We don't know if we should traverse into the inline fragment, but we do
      // anyway and find that the field is missing
      {
        fieldPath: 'node.name',
        handled: false,
        kind: 'missing_expected_data.throw',
        owner: 'RelayReaderRelayErrorHandlingTestInlineFragmentMatchesQuery',
      },
    ]);
  });

  it('Reports missing fields in topological order', () => {
    const source = RelayRecordSource.create({
      'client:root': {
        __id: 'client:root',
        __typename: '__Root',
        me: {__ref: '4'},
      },
      4: {
        __id: '4',
        id: '4',
        __typename: 'User',
        nearest_neighbor: {__ref: '4'},
        // NOTE: `name` is missing
      },
    });

    const FooQuery = graphql`
      query RelayReaderRelayErrorHandlingTestErrorOrderQuery
      @throwOnFieldError {
        also_me: me {
          name
          nearest_neighbor {
            name
          }
        }
        me {
          name
        }
      }
    `;
    const operation = createOperationDescriptor(FooQuery, {});
    const {fieldErrors, isMissingData} = read(source, operation.fragment, null);

    expect(isMissingData).toBe(true);
    expect(fieldErrors).toEqual([
      {
        fieldPath: 'also_me.name',
        handled: false,
        kind: 'missing_expected_data.throw',
        owner: 'RelayReaderRelayErrorHandlingTestErrorOrderQuery',
      },
      {
        fieldPath: 'also_me.nearest_neighbor.name',
        handled: false,
        kind: 'missing_expected_data.throw',
        owner: 'RelayReaderRelayErrorHandlingTestErrorOrderQuery',
      },
      {
        fieldPath: 'me.name',
        handled: false,
        kind: 'missing_expected_data.throw',
        owner: 'RelayReaderRelayErrorHandlingTestErrorOrderQuery',
      },
    ]);
  });

  let wasNoncompliantErrorHandlingOnListsEnabled;

  beforeEach(() => {
    wasNoncompliantErrorHandlingOnListsEnabled =
      RelayFeatureFlags.ENABLE_NONCOMPLIANT_ERROR_HANDLING_ON_LISTS;
  });

  afterEach(() => {
    RelayFeatureFlags.ENABLE_NONCOMPLIANT_ERROR_HANDLING_ON_LISTS =
      wasNoncompliantErrorHandlingOnListsEnabled;
  });

  describe('when noncompliant error handling on lists is enabled', () => {
    beforeEach(() => {
      RelayFeatureFlags.ENABLE_NONCOMPLIANT_ERROR_HANDLING_ON_LISTS = true;
    });

    describe('when query has @throwOnFieldError directive', () => {
      it('has errors that will throw when the linked field is an empty list', () => {
        const source = RelayRecordSource.create({
          1: {
            __id: '1',
            __typename: 'User',
            'friends(first:3)': {
              __ref: 'client:1:friends(first:3)',
            },
            id: '1',
          },
          'client:1:friends(first:3)': {
            __id: 'client:1:friends(first:3)',
            __typename: 'FriendsConnection',
            __errors: {
              edges: [
                {
                  message: 'There was an error!',
                },
              ],
            },
            edges: {
              __refs: [],
            },
          },
          'client:root': {
            __id: 'client:root',
            __typename: '__Root',
            'node(id:"1")': {__ref: '1'},
          },
        });

        const FooQuery = graphql`
          query RelayReaderRelayErrorHandlingTestNoncompliantEmptyLinkedFieldWithThrowOnFieldErrorQuery
          @throwOnFieldError {
            node(id: "1") {
              id
              __typename
              ... on User {
                friends(first: 3) {
                  edges {
                    cursor
                  }
                }
              }
            }
          }
        `;
        const operation = createOperationDescriptor(FooQuery, {});
        const {fieldErrors} = read(source, operation.fragment, null);

        expect(fieldErrors).toEqual([
          {
            fieldPath: 'node.friends.edges',
            handled: false,
            error: {message: 'There was an error!'},
            kind: 'relay_field_payload.error',
            owner:
              'RelayReaderRelayErrorHandlingTestNoncompliantEmptyLinkedFieldWithThrowOnFieldErrorQuery',
            shouldThrow: true,
          },
        ]);
      });

      it('has errors that will throw when the scalar field is an empty list', () => {
        const source = RelayRecordSource.create({
          1: {
            __id: '1',
            __typename: 'User',
            __errors: {
              emailAddresses: [
                {
                  message: 'There was an error!',
                },
              ],
            },
            id: '1',
            emailAddresses: [],
          },
          'client:root': {
            __id: 'client:root',
            __typename: '__Root',
            'node(id:"1")': {__ref: '1'},
          },
        });

        const FooQuery = graphql`
          query RelayReaderRelayErrorHandlingTestNoncompliantEmptyScalarFieldWithThrowOnFieldErrorQuery
          @throwOnFieldError {
            node(id: "1") {
              id
              __typename
              ... on User {
                emailAddresses
              }
            }
          }
        `;
        const operation = createOperationDescriptor(FooQuery, {});
        const {fieldErrors} = read(source, operation.fragment, null);

        expect(fieldErrors).toEqual([
          {
            fieldPath: 'node.emailAddresses',
            handled: false,
            error: {message: 'There was an error!'},
            kind: 'relay_field_payload.error',
            owner:
              'RelayReaderRelayErrorHandlingTestNoncompliantEmptyScalarFieldWithThrowOnFieldErrorQuery',
            shouldThrow: true,
          },
        ]);
      });
    });

    describe('when query does not have the @throwOnFieldError directive', () => {
      it('has errors that wont throw when the linked field is an empty list', () => {
        const source = RelayRecordSource.create({
          1: {
            __id: '1',
            __typename: 'User',
            'friends(first:3)': {
              __ref: 'client:1:friends(first:3)',
            },
            id: '1',
          },
          'client:1:friends(first:3)': {
            __id: 'client:1:friends(first:3)',
            __typename: 'FriendsConnection',
            __errors: {
              edges: [
                {
                  message: 'There was an error!',
                },
              ],
            },
            edges: {
              __refs: [],
            },
          },
          'client:root': {
            __id: 'client:root',
            __typename: '__Root',
            'node(id:"1")': {__ref: '1'},
          },
        });

        const FooQuery = graphql`
          query RelayReaderRelayErrorHandlingTestNoncompliantEmptyLinkedFieldWithoutThrowOnFieldErrorQuery {
            node(id: "1") {
              id
              __typename
              ... on User {
                friends(first: 3) {
                  edges {
                    cursor
                  }
                }
              }
            }
          }
        `;
        const operation = createOperationDescriptor(FooQuery, {});
        const {data, fieldErrors} = read(source, operation.fragment, null);

        expect(data.node.friends.edges).toEqual([]);
        expect(fieldErrors).toEqual([
          {
            fieldPath: 'node.friends.edges',
            handled: false,
            error: {message: 'There was an error!'},
            kind: 'relay_field_payload.error',
            owner:
              'RelayReaderRelayErrorHandlingTestNoncompliantEmptyLinkedFieldWithoutThrowOnFieldErrorQuery',
            shouldThrow: false,
          },
        ]);
      });

      it('has errors that wont throw when the scalar field is an empty list', () => {
        const source = RelayRecordSource.create({
          1: {
            __id: '1',
            __typename: 'User',
            __errors: {
              emailAddresses: [
                {
                  message: 'There was an error!',
                },
              ],
            },
            id: '1',
            emailAddresses: [],
          },
          'client:root': {
            __id: 'client:root',
            __typename: '__Root',
            'node(id:"1")': {__ref: '1'},
          },
        });

        const FooQuery = graphql`
          query RelayReaderRelayErrorHandlingTestNoncompliantEmptyScalarFieldWithoutThrowOnFieldErrorQuery {
            node(id: "1") {
              id
              __typename
              ... on User {
                emailAddresses
              }
            }
          }
        `;
        const operation = createOperationDescriptor(FooQuery, {});
        const {data, fieldErrors} = read(source, operation.fragment, null);
        expect(data.node.emailAddresses).toEqual([]);
        expect(fieldErrors).toEqual([
          {
            fieldPath: 'node.emailAddresses',
            handled: false,
            error: {message: 'There was an error!'},
            kind: 'relay_field_payload.error',
            owner:
              'RelayReaderRelayErrorHandlingTestNoncompliantEmptyScalarFieldWithoutThrowOnFieldErrorQuery',
            shouldThrow: false,
          },
        ]);
      });
    });
  });
});
