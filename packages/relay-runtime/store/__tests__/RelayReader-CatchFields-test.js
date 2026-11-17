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

const {graphql} = require('../../query/GraphQLTag');
const RelayFeatureFlags = require('../../util/RelayFeatureFlags');
const {
  createOperationDescriptor,
} = require('../RelayModernOperationDescriptor');
const {createReaderSelector} = require('../RelayModernSelector');
const {read} = require('../RelayReader');
const RelayRecordSource = require('../RelayRecordSource');

describe('RelayReader @catch', () => {
  it('if scalar has @catch(to: NULL) - scalar value should be null, and nothing should throw or catch', () => {
    const source = RelayRecordSource.create({
      'client:root': {
        __id: 'client:root',
        __typename: '__Root',
        me: {__ref: '1'},
      },
      '1': {
        __id: '1',
        id: '1',
        __typename: 'User',
        lastName: null,
      },
    });

    const FooQuery = graphql`
      query RelayReaderCatchFieldsTest00Query {
        me {
          lastName @catch(to: NULL)
        }
      }
    `;
    const operation = createOperationDescriptor(FooQuery, {id: '1'});
    const {data, fieldErrors} = read(source, operation.fragment, null);
    expect(fieldErrors).toEqual(null);
    expect(data).toEqual({me: {lastName: null}});
  });

  it('if scalar has catch to RESULT - scalar value should provide the error', () => {
    const source = RelayRecordSource.create({
      'client:root': {
        __id: 'client:root',
        __typename: '__Root',
        me: {__ref: '1'},
      },
      '1': {
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
      query RelayReaderCatchFieldsTest01Query {
        me {
          lastName @catch(to: RESULT)
        }
      }
    `;
    const operation = createOperationDescriptor(FooQuery, {id: '1'});
    const {data, fieldErrors} = read(source, operation.fragment, null);
    expect(data).toEqual({
      me: {
        lastName: {
          ok: false,
          errors: [
            {
              path: ['me', 'lastName'],
            },
          ],
        },
      },
    });

    expect(fieldErrors).toEqual([
      {
        error: {message: 'There was an error!', path: ['me', 'lastName']},
        fieldPath: 'me.lastName',
        handled: true,
        kind: 'relay_field_payload.error',
        owner: 'RelayReaderCatchFieldsTest01Query',
        shouldThrow: false,
      },
    ]);
  });

  it('if preceding scalar sibling has error, catch to RESULT should not catch that error', () => {
    const source = RelayRecordSource.create({
      'client:root': {
        __id: 'client:root',
        __typename: '__Root',
        me: {__ref: '1'},
      },
      '1': {
        __id: '1',
        id: '1',
        __typename: 'User',
        lastName: null,
        firstName: 'Elizabeth',
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
      query RelayReaderCatchFieldsTestSiblingErrorQuery {
        me {
          lastName # this field is in an error state and should not be caught
          firstName @catch(to: RESULT)
        }
      }
    `;
    const operation = createOperationDescriptor(FooQuery, {id: '1'});
    const {data, fieldErrors} = read(source, operation.fragment, null);
    expect(data).toEqual({
      me: {
        lastName: null,
        firstName: {
          ok: true,
          value: 'Elizabeth',
        },
      },
    });

    expect(fieldErrors).toEqual([
      {
        fieldPath: 'me.lastName',
        error: {
          message: 'There was an error!',
          path: ['me', 'lastName'],
        },
        owner: 'RelayReaderCatchFieldsTestSiblingErrorQuery',
        kind: 'relay_field_payload.error',
        shouldThrow: false,
        handled: false,
      },
    ]);
  });

  it('if preceding scalar sibling has a logged missing required field, an THROW required field inside a subsequent @catch should not delete that log', () => {
    const source = RelayRecordSource.create({
      'client:root': {
        __id: 'client:root',
        __typename: '__Root',
        me: {__ref: '1'},
      },
      '1': {
        __id: '1',
        id: '1',
        __typename: 'User',
        lastName: null,
        firstName: null,
      },
    });

    const FooQuery = graphql`
      query RelayReaderCatchFieldsTestSiblingLogRequiredErrorQuery {
        alsoMe: me {
          lastName @required(action: LOG)
        }
        me @catch(to: RESULT) {
          # Despite being more destructive, the THROW here should not overwrite
          # the LOG, since it gets caught.
          firstName @required(action: THROW)
        }
      }
    `;
    const operation = createOperationDescriptor(FooQuery, {id: '1'});
    const {data, fieldErrors} = read(source, operation.fragment, null);
    expect(data).toEqual({
      alsoMe: null,
      me: {
        ok: false,
        errors: [
          {
            message:
              "Relay: Missing @required value at path 'me.firstName' in 'RelayReaderCatchFieldsTestSiblingLogRequiredErrorQuery': the server returned null.",
          },
        ],
      },
    });

    expect(fieldErrors).toEqual([
      {
        fieldError: null,
        fieldPath: 'alsoMe.lastName',
        fieldValue: null,
        kind: 'missing_required_field.log',
        owner: 'RelayReaderCatchFieldsTestSiblingLogRequiredErrorQuery',
      },
      {
        fieldError: null,
        fieldPath: 'me.firstName',
        fieldValue: null,
        handled: true,
        kind: 'missing_required_field.throw',
        owner: 'RelayReaderCatchFieldsTestSiblingLogRequiredErrorQuery',
      },
    ]);
  });

  it('@catch(to: NULL) catching a @required(action: THROW) returns null', () => {
    const source = RelayRecordSource.create({
      'client:root': {
        __id: 'client:root',
        __typename: '__Root',
        me: {__ref: '1'},
      },
      '1': {
        __id: '1',
        id: '1',
        __typename: 'User',
        firstName: null,
      },
    });

    const FooQuery = graphql`
      query RelayReaderCatchFieldsTestRequiredCatchToNullErrorQuery {
        me @catch(to: NULL) {
          firstName @required(action: THROW)
        }
      }
    `;
    const operation = createOperationDescriptor(FooQuery, {id: '1'});
    const {data, fieldErrors} = read(source, operation.fragment, null);
    expect(data).toEqual({
      me: null,
    });

    expect(fieldErrors).toEqual([
      {
        fieldError: null,
        fieldPath: 'me.firstName',
        fieldValue: null,
        handled: true,
        kind: 'missing_required_field.throw',
        owner: 'RelayReaderCatchFieldsTestRequiredCatchToNullErrorQuery',
      },
    ]);
  });

  it('@catch(to: NULL) catching missing data returns null', () => {
    const source = RelayRecordSource.create({
      'client:root': {
        __id: 'client:root',
        __typename: '__Root',
        me: {__ref: '1'},
      },
      '1': {
        __id: '1',
        id: '1',
        __typename: 'User',
        // firstName is not defined here
      },
    });

    const FooQuery = graphql`
      query RelayReaderCatchFieldsTestCatchMissingToNullErrorQuery {
        me @catch(to: NULL) {
          firstName
        }
      }
    `;
    const operation = createOperationDescriptor(FooQuery, {id: '1'});
    const {data, fieldErrors, isMissingData} = read(
      source,
      operation.fragment,
      null,
    );

    expect(data).toEqual({me: null});

    // We still need to ensure that we will suspend if there is a request in flight.
    expect(isMissingData).toEqual(true);

    expect(fieldErrors).toEqual([
      {
        fieldPath: 'me.firstName',
        kind: 'missing_expected_data.log',
        owner: 'RelayReaderCatchFieldsTestCatchMissingToNullErrorQuery',
      },
    ]);
  });

  it('@catch(to: NULL) on query catching missing data returns null', () => {
    const source = RelayRecordSource.create({
      'client:root': {
        __id: 'client:root',
        __typename: '__Root',
        me: {__ref: '1'},
      },
      '1': {
        __id: '1',
        id: '1',
        __typename: 'User',
        // firstName is not defined here
      },
    });

    const FooQuery = graphql`
      query RelayReaderCatchFieldsTestCatchMissingInQueryToNullErrorQuery
      @catch(to: NULL) {
        me {
          firstName
        }
      }
    `;
    const operation = createOperationDescriptor(FooQuery, {});
    const {data, fieldErrors, isMissingData} = read(
      source,
      operation.fragment,
      null,
    );

    expect(data).toEqual(null);

    // We still need to ensure that we will suspend if there is a request in flight.
    expect(isMissingData).toEqual(true);

    expect(fieldErrors).toEqual([
      {
        fieldPath: 'me.firstName',
        kind: 'missing_expected_data.log',
        owner: 'RelayReaderCatchFieldsTestCatchMissingInQueryToNullErrorQuery',
      },
    ]);
  });

  it('@catch(to: RESULT) on query catching missing data returns error', () => {
    const source = RelayRecordSource.create({
      'client:root': {
        __id: 'client:root',
        __typename: '__Root',
        me: {__ref: '1'},
      },
      '1': {
        __id: '1',
        id: '1',
        __typename: 'User',
        // firstName is not defined here
      },
    });

    const FooQuery = graphql`
      query RelayReaderCatchFieldsTestCatchMissingInQueryToResultErrorQuery
      @catch {
        me {
          firstName
        }
      }
    `;
    const operation = createOperationDescriptor(FooQuery, {});
    const {data, fieldErrors, isMissingData} = read(
      source,
      operation.fragment,
      null,
    );

    expect(data).toEqual({errors: [{path: ['me', 'firstName']}], ok: false});

    // We still need to ensure that we will suspend if there is a request in flight.
    expect(isMissingData).toEqual(true);

    expect(fieldErrors).toEqual([
      {
        fieldPath: 'me.firstName',
        kind: 'missing_expected_data.log',
        owner:
          'RelayReaderCatchFieldsTestCatchMissingInQueryToResultErrorQuery',
      },
    ]);
  });

  it('@catch(to: NULL) on fragment catching missing data returns null', () => {
    const source = RelayRecordSource.create({
      'client:root': {
        __id: 'client:root',
        __typename: '__Root',
        me: {__ref: '1'},
      },
      '1': {
        __id: '1',
        id: '1',
        __typename: 'User',
        // firstName is not defined here
      },
    });
    const FooQuery = graphql`
      query RelayReaderCatchFieldsTestCatchToNullQuery {
        ...RelayReaderCatchFieldsTestCatchToNullFragment
      }
    `;

    const FooFragment = graphql`
      fragment RelayReaderCatchFieldsTestCatchToNullFragment on Query
      @catch(to: NULL) {
        me {
          firstName
        }
      }
    `;

    const owner = createOperationDescriptor(FooQuery, {});
    const {data, fieldErrors, isMissingData} = read(
      source,
      createReaderSelector(FooFragment, 'client:root', {}, owner.request),
    );

    expect(data).toEqual(null);

    // We still need to ensure that we will suspend if there is a request in flight.
    expect(isMissingData).toEqual(true);

    expect(fieldErrors).toEqual([
      {
        fieldPath: 'me.firstName',
        kind: 'missing_expected_data.log',
        owner: 'RelayReaderCatchFieldsTestCatchToNullFragment',
      },
    ]);
  });

  it('@catch(to: RESULT) on fragment catching missing data returns error', () => {
    const source = RelayRecordSource.create({
      'client:root': {
        __id: 'client:root',
        __typename: '__Root',
        me: {__ref: '1'},
      },
      '1': {
        __id: '1',
        id: '1',
        __typename: 'User',
        // firstName is not defined here
      },
    });
    const FooQuery = graphql`
      query RelayReaderCatchFieldsTestCatchToResultQuery {
        ...RelayReaderCatchFieldsTestCatchToResultFragment
      }
    `;

    const FooFragment = graphql`
      fragment RelayReaderCatchFieldsTestCatchToResultFragment on Query @catch {
        me {
          firstName
        }
      }
    `;

    const owner = createOperationDescriptor(FooQuery, {});
    const {data, fieldErrors, isMissingData} = read(
      source,
      createReaderSelector(FooFragment, 'client:root', {}, owner.request),
    );

    expect(data).toEqual({ok: false, errors: [{path: ['me', 'firstName']}]});

    // We still need to ensure that we will suspend if there is a request in flight.
    expect(isMissingData).toEqual(true);

    expect(fieldErrors).toEqual([
      {
        fieldPath: 'me.firstName',
        kind: 'missing_expected_data.log',
        owner: 'RelayReaderCatchFieldsTestCatchToResultFragment',
      },
    ]);
  });

  it('@catch(to: NULL) on aliased inline fragment catching missing data returns null', () => {
    const source = RelayRecordSource.create({
      'client:root': {
        __id: 'client:root',
        __typename: '__Root',
        me: {__ref: '1'},
      },
      '1': {
        __id: '1',
        id: '1',
        __typename: 'User',
        // firstName is not defined here
      },
    });

    const FooQuery = graphql`
      query RelayReaderCatchFieldsTestCatchMissingInInlineFragmentToNullErrorQuery {
        me {
          ... @catch(to: NULL) @alias(as: "myAlias") {
            firstName
          }
        }
      }
    `;
    const operation = createOperationDescriptor(FooQuery, {});
    const {data, fieldErrors, isMissingData} = read(
      source,
      operation.fragment,
      null,
    );

    expect(data).toEqual({me: {myAlias: null}});

    // We still need to ensure that we will suspend if there is a request in flight.
    expect(isMissingData).toEqual(true);

    expect(fieldErrors).toEqual([
      {
        fieldPath: 'me.myAlias.firstName',
        kind: 'missing_expected_data.log',
        owner:
          'RelayReaderCatchFieldsTestCatchMissingInInlineFragmentToNullErrorQuery',
      },
    ]);
  });

  it('@catch(to: RESULT) on aliased inline fragment catching missing data returns error', () => {
    const source = RelayRecordSource.create({
      'client:root': {
        __id: 'client:root',
        __typename: '__Root',
        me: {__ref: '1'},
      },
      '1': {
        __id: '1',
        id: '1',
        __typename: 'User',
        // firstName is not defined here
      },
    });

    const FooQuery = graphql`
      query RelayReaderCatchFieldsTestCatchMissingInInlineFragmentToResultErrorQuery {
        me {
          ... @catch(to: RESULT) @alias(as: "myAlias") {
            firstName
          }
        }
      }
    `;
    const operation = createOperationDescriptor(FooQuery, {});
    const {data, fieldErrors, isMissingData} = read(
      source,
      operation.fragment,
      null,
    );

    expect(data).toEqual({
      me: {myAlias: {ok: false, errors: [{path: ['myAlias', 'firstName']}]}},
    });

    // We still need to ensure that we will suspend if there is a request in flight.
    expect(isMissingData).toEqual(true);

    expect(fieldErrors).toEqual([
      {
        fieldPath: 'me.myAlias.firstName',
        kind: 'missing_expected_data.log',
        owner:
          'RelayReaderCatchFieldsTestCatchMissingInInlineFragmentToResultErrorQuery',
      },
    ]);
  });

  it('@catch(to: RESULT) on aliased inline fragment with field error returns error', () => {
    const source = RelayRecordSource.create({
      'client:root': {
        __id: 'client:root',
        __typename: '__Root',
        me: {__ref: '1'},
      },
      '1': {
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
      query RelayReaderCatchFieldsTestCatchErrorInAliasedInlineFragmentToResultQuery {
        me {
          ... @catch(to: RESULT) @alias(as: "myAlias") {
            lastName
          }
        }
      }
    `;
    const operation = createOperationDescriptor(FooQuery, {});
    const {data, fieldErrors} = read(source, operation.fragment, null);
    expect(data).toEqual({
      me: {
        myAlias: {
          ok: false,
          errors: [
            {
              path: ['me', 'lastName'],
            },
          ],
        },
      },
    });

    expect(fieldErrors).toEqual([
      {
        error: {message: 'There was an error!', path: ['me', 'lastName']},
        fieldPath: 'me.myAlias.lastName',
        handled: true,
        kind: 'relay_field_payload.error',
        owner:
          'RelayReaderCatchFieldsTestCatchErrorInAliasedInlineFragmentToResultQuery',
        shouldThrow: false,
      },
    ]);
  });

  it('@catch(to: NULL) on aliased inline fragment with field error returns null', () => {
    const source = RelayRecordSource.create({
      'client:root': {
        __id: 'client:root',
        __typename: '__Root',
        me: {__ref: '1'},
      },
      '1': {
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
      query RelayReaderCatchFieldsTestCatchErrorInAliasedInlineFragmentToNullQuery {
        me {
          ... @catch(to: NULL) @alias(as: "myAlias") {
            lastName
          }
        }
      }
    `;
    const operation = createOperationDescriptor(FooQuery, {});
    const {data, fieldErrors} = read(source, operation.fragment, null);
    expect(data).toEqual({
      me: {myAlias: null},
    });

    expect(fieldErrors).toEqual([
      {
        error: {message: 'There was an error!', path: ['me', 'lastName']},
        fieldPath: 'me.myAlias.lastName',
        handled: true,
        kind: 'relay_field_payload.error',
        owner:
          'RelayReaderCatchFieldsTestCatchErrorInAliasedInlineFragmentToNullQuery',
        shouldThrow: false,
      },
    ]);
  });

  it('@catch(to: RESULT) on aliased inline fragment with no error returns ok result', () => {
    const source = RelayRecordSource.create({
      'client:root': {
        __id: 'client:root',
        __typename: '__Root',
        me: {__ref: '1'},
      },
      '1': {
        __id: '1',
        id: '1',
        __typename: 'User',
        lastName: 'Big Bird',
      },
    });

    const FooQuery = graphql`
      query RelayReaderCatchFieldsTestCatchOkInAliasedInlineFragmentToResultQuery {
        me {
          ... @catch(to: RESULT) @alias(as: "myAlias") {
            lastName
          }
        }
      }
    `;
    const operation = createOperationDescriptor(FooQuery, {});
    const {data, fieldErrors} = read(source, operation.fragment, null);
    expect(data).toEqual({
      me: {
        myAlias: {
          ok: true,
          value: {
            lastName: 'Big Bird',
          },
        },
      },
    });

    expect(fieldErrors).toBeNull();
  });

  it('if scalar has catch to RESULT - but no error, response should reflect', () => {
    const source = RelayRecordSource.create({
      'client:root': {
        __id: 'client:root',
        __typename: '__Root',
        me: {__ref: '1'},
      },
      '1': {
        __id: '1',
        id: '1',
        __typename: 'User',
        lastName: 'Big Bird',
      },
    });

    const FooQuery = graphql`
      query RelayReaderCatchFieldsTest09Query {
        me {
          lastName @catch(to: RESULT)
        }
      }
    `;
    const operation = createOperationDescriptor(FooQuery, {id: '1'});
    const {data, fieldErrors} = read(source, operation.fragment, null);
    expect(data).toEqual({
      me: {
        lastName: {
          ok: true,
          value: 'Big Bird',
        },
      },
    });

    expect(fieldErrors).toBeNull();
  });

  it('if linked has catch to RESULT - but no error, response should reflect', () => {
    const source = RelayRecordSource.create({
      'client:root': {
        __id: 'client:root',
        __typename: '__Root',
        me: {__ref: '1'},
      },
      '1': {
        __id: '1',
        id: '1',
        __typename: 'User',
        lastName: 'Big Bird',
      },
    });

    const FooQuery = graphql`
      query RelayReaderCatchFieldsTest010Query {
        me @catch {
          lastName
        }
      }
    `;
    const operation = createOperationDescriptor(FooQuery, {id: '1'});
    const {data, fieldErrors} = read(source, operation.fragment, null);
    expect(data).toEqual({
      me: {
        ok: true,
        value: {
          lastName: 'Big Bird',
        },
      },
    });

    expect(fieldErrors).toBeNull();
  });

  it('if linked has catch to RESULT - with error, response should reflect', () => {
    const source = RelayRecordSource.create({
      'client:root': {
        __id: 'client:root',
        __typename: '__Root',
        me: {__ref: '1'},
      },
      '1': {
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
      query RelayReaderCatchFieldsTest07Query {
        me @catch {
          lastName
        }
      }
    `;
    const operation = createOperationDescriptor(FooQuery, {id: '1'});
    const {data, fieldErrors} = read(source, operation.fragment, null);
    expect(data).toEqual({
      me: {
        ok: false,
        errors: [
          {
            path: ['me', 'lastName'],
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
        owner: 'RelayReaderCatchFieldsTest07Query',
        shouldThrow: false,
      },
    ]);
  });

  it('if scalar has catch to RESULT with nested required', () => {
    const source = RelayRecordSource.create({
      'client:root': {
        __id: 'client:root',
        __typename: '__Root',
        me: {__ref: '1'},
      },
      '1': {
        __id: '1',
        id: '1',
        __typename: 'User',
        lastName: null,
      },
    });

    const FooQuery = graphql`
      query RelayReaderCatchFieldsTest02Query {
        me @catch {
          lastName @required(action: THROW)
        }
      }
    `;
    const operation = createOperationDescriptor(FooQuery, {id: '1'});
    const {data, fieldErrors} = read(source, operation.fragment, null);
    expect(data).toEqual({
      me: {
        errors: [
          {
            message:
              "Relay: Missing @required value at path 'me.lastName' in 'RelayReaderCatchFieldsTest02Query': the server returned null.",
          },
        ],
        ok: false,
      },
    });

    expect(fieldErrors).toEqual([
      {
        fieldError: null,
        fieldPath: 'me.lastName',
        fieldValue: null,
        handled: true,
        kind: 'missing_required_field.throw',
        owner: 'RelayReaderCatchFieldsTest02Query',
      },
    ]);
  });

  describe('with ENABLE_CATCH_IGNORE_HANDLED_FIELD_ERRORS', () => {
    beforeEach(() => {
      RelayFeatureFlags.ENABLE_CATCH_IGNORE_HANDLED_FIELD_ERRORS = true;
    });
    afterEach(() => {
      RelayFeatureFlags.ENABLE_CATCH_IGNORE_HANDLED_FIELD_ERRORS = false;
    });

    it('nested @catch(to: RESULT): server error on inner field should be handled by the inner @catch, not bubble to the outer @catch', () => {
      const source = RelayRecordSource.create({
        'client:root': {
          __id: 'client:root',
          __typename: '__Root',
          me: {__ref: '1'},
        },
        '1': {
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
        query RelayReaderCatchFieldsTestNestedResultQuery {
          me @catch(to: RESULT) {
            lastName @catch(to: RESULT)
          }
        }
      `;
      const operation = createOperationDescriptor(FooQuery, {id: '1'});
      const {data, fieldErrors} = read(source, operation.fragment, null);
      expect(data).toEqual({
        me: {
          ok: true,
          value: {
            lastName: {
              ok: false,
              errors: [
                {
                  path: ['me', 'lastName'],
                },
              ],
            },
          },
        },
      });

      expect(fieldErrors).toEqual([
        {
          error: {message: 'There was an error!', path: ['me', 'lastName']},
          fieldPath: 'me.lastName',
          handled: true,
          kind: 'relay_field_payload.error',
          owner: 'RelayReaderCatchFieldsTestNestedResultQuery',
          shouldThrow: false,
        },
      ]);
    });

    it('nested @catch(to: NULL): server error on inner field should be nulled by the inner @catch, leaving the outer field intact', () => {
      const source = RelayRecordSource.create({
        'client:root': {
          __id: 'client:root',
          __typename: '__Root',
          me: {__ref: '1'},
        },
        '1': {
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
        query RelayReaderCatchFieldsTestNestedNullQuery {
          me @catch(to: NULL) {
            lastName @catch(to: NULL)
          }
        }
      `;
      const operation = createOperationDescriptor(FooQuery, {id: '1'});
      const {data, fieldErrors} = read(source, operation.fragment, null);
      expect(data).toEqual({
        me: {
          lastName: null,
        },
      });

      expect(fieldErrors).toEqual([
        {
          error: {message: 'There was an error!', path: ['me', 'lastName']},
          fieldPath: 'me.lastName',
          handled: true,
          kind: 'relay_field_payload.error',
          owner: 'RelayReaderCatchFieldsTestNestedNullQuery',
          shouldThrow: false,
        },
      ]);
    });
  }); // end describe('with ENABLE_CATCH_IGNORE_HANDLED_FIELD_ERRORS')
});
