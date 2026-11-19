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
import type {
  LogEvent,
  RelayFieldLoggerEvent,
} from 'relay-runtime/store/RelayStoreTypes';

const {
  getFragmentResourceForEnvironment,
} = require('../legacy/FragmentResource');
const {
  __internal: {fetchQuery},
  createOperationDescriptor,
  graphql,
} = require('relay-runtime');
const {createMockEnvironment} = require('relay-test-utils');

const componentDisplayName = 'TestComponent';
const UserFragment = graphql`
  fragment FragmentResourceRequiredFieldTestUserFragment on User {
    id
    name @required(action: THROW)
    alternate_name @required(action: LOG)
  }
`;

let environment;
let query;
let FragmentResource;
let logger;
let relayFieldLogger;

beforeEach(() => {
  logger = jest.fn<[LogEvent], void>();
  relayFieldLogger = jest.fn<[RelayFieldLoggerEvent], void>();

  environment = createMockEnvironment({
    log: logger,
    relayFieldLogger,
  });
  FragmentResource = getFragmentResourceForEnvironment(environment);

  query = createOperationDescriptor(
    graphql`
      query FragmentResourceRequiredFieldTestUserQuery($id: ID!) {
        node(id: $id) {
          __typename
          ...FragmentResourceRequiredFieldTestUserFragment
            @dangerously_unaliased_fixme
        }
      }
    `,
    {id: '4'},
  );
});

test('Throws if a @required(action: THROW) field is null', () => {
  environment.commitPayload(query, {
    node: {
      __typename: 'User',
      id: '4',
      name: null,
      alternate_name: 'Zuckster',
    },
  });
  expect(() => {
    FragmentResource.read(
      UserFragment,
      {
        __id: '4',
        __fragments: {
          FragmentResourceRequiredFieldTestUserFragment: {},
        },
        __fragmentOwner: query.request,
      },
      componentDisplayName,
    );
  }).toThrowError(
    "Relay: Missing @required value at path 'name' in 'FragmentResourceRequiredFieldTestUserFragment': the server returned null.",
  );
});

test('Logs if a @required(action: LOG) field is null', () => {
  environment.commitPayload(query, {
    node: {
      __typename: 'User',
      id: '4',
      name: 'Zucc',
      alternate_name: null,
    },
  });
  FragmentResource.read(
    UserFragment,
    {
      __id: '4',
      __fragments: {
        FragmentResourceRequiredFieldTestUserFragment: {},
      },
      __fragmentOwner: query.request,
    },
    componentDisplayName,
  );
  expect(relayFieldLogger).toHaveBeenCalledWith({
    fieldError: null,
    fieldPath: 'alternate_name',
    fieldValue: null,
    kind: 'missing_required_field.log',
    owner: 'FragmentResourceRequiredFieldTestUserFragment',
  });
});

test('Throws if a @required(action: THROW) field is present and then goes missing', () => {
  const callback = jest.fn<[], void>();
  environment.commitPayload(query, {
    node: {
      __typename: 'User',
      id: '4',
      name: 'Zucc',
      alternate_name: 'Zuckster',
    },
  });
  const result = FragmentResource.read(
    UserFragment,
    {
      __id: '4',
      __fragments: {
        FragmentResourceRequiredFieldTestUserFragment: {},
      },
      __fragmentOwner: query.request,
    },
    componentDisplayName,
  );
  expect(result.data).toEqual({
    id: '4',
    name: 'Zucc',
    alternate_name: 'Zuckster',
  });

  expect(environment.subscribe).toHaveBeenCalledTimes(0);
  const disposable = FragmentResource.subscribe(result, callback);

  environment.commitPayload(query, {
    node: {
      __typename: 'User',
      id: '4',
      name: null,
      alternate_name: 'Zuckster',
    },
  });

  expect(() =>
    FragmentResource.read(
      UserFragment,
      {
        __id: '4',
        __fragments: {
          FragmentResourceRequiredFieldTestUserFragment: {},
        },
        __fragmentOwner: query.request,
      },
      componentDisplayName,
    ),
  ).toThrowError(
    "Relay: Missing @required value at path 'name' in 'FragmentResourceRequiredFieldTestUserFragment': the server returned null.",
  );

  expect(relayFieldLogger).toHaveBeenCalledWith({
    fieldError: null,
    fieldPath: 'name',
    fieldValue: null,
    kind: 'missing_required_field.throw',
    owner: 'FragmentResourceRequiredFieldTestUserFragment',
    handled: false,
  });

  disposable.dispose();
});

it('should throw promise if reading missing data and network request for parent query is in flight', async () => {
  fetchQuery(environment, query).subscribe({});
  const fragmentRef = {
    __id: '4',
    __fragments: {
      FragmentResourceRequiredFieldTestUserFragment: {},
    },
    __fragmentOwner: query.request,
  };

  // Try reading a fragment while parent query is in flight
  let thrown = null;
  try {
    FragmentResource.read(UserFragment, fragmentRef, componentDisplayName);
  } catch (p) {
    thrown = p;
  }

  expect(thrown).toBeInstanceOf(Promise);

  environment.mock.resolve(query, {
    data: {
      node: {
        __typename: 'User',
        id: '4',
        name: null,
        alternate_name: 'Zuckster',
      },
    },
  });
  jest.runAllImmediates();
  await thrown;

  // Now that the request is complete, check that we detect the missing field.
  expect(() =>
    FragmentResource.read(UserFragment, fragmentRef, componentDisplayName),
  ).toThrowError(
    "Relay: Missing @required value at path 'name' in 'FragmentResourceRequiredFieldTestUserFragment': the server returned null.",
  );
});
