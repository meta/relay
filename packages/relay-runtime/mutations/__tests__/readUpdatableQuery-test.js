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
  GraphQLResponse,
  LogRequestInfoFunction,
  UploadableMap,
} from '../../network/RelayNetworkTypes';
import type {ObservableFromValue} from '../../network/RelayObservable';
import type {ReadOnlyRecordProxy} from '../../store/RelayStoreTypes';
import type {
  NormalizationLinkedField,
  NormalizationScalarField,
} from '../../util/NormalizationNode';
import type {ReaderLinkedField} from '../../util/ReaderNode';
import type {RequestParameters} from '../../util/RelayConcreteNode';
import type {CacheConfig, Variables} from '../../util/RelayRuntimeTypes';
import type {readUpdatableQueryTestRegularQuery} from './__generated__/readUpdatableQueryTestRegularQuery.graphql';
import type {OpaqueScalarType} from './OpaqueScalarType';

const RelayNetwork = require('../../network/RelayNetwork');
const {graphql} = require('../../query/GraphQLTag');
const RelayModernEnvironment = require('../../store/RelayModernEnvironment');
const {
  createOperationDescriptor,
} = require('../../store/RelayModernOperationDescriptor');
const RelayModernStore = require('../../store/RelayModernStore');
const RelayReader = require('../../store/RelayReader');
const RelayRecordSource = require('../../store/RelayRecordSource');
const {ROOT_TYPE} = require('../../store/RelayStoreUtils');
const commitLocalUpdate = require('../commitLocalUpdate');
const {
  validate: validateNode,
} = require('./__generated__/readUpdatableQueryTest_node.graphql');
const {
  validate: validateUser,
} = require('./__generated__/readUpdatableQueryTest_user.graphql');
const {createOpaqueScalarTypeValue} = require('./OpaqueScalarType');
const {
  disallowConsoleErrors,
  disallowWarnings,
} = require('relay-test-utils-internal');

disallowWarnings();
disallowConsoleErrors();

const updatableQuery = graphql`
  query readUpdatableQueryTestUpdatableQuery @updatable {
    me {
      __typename
      __id
      id
      name
      author {
        client_best_friend {
          ...readUpdatableQueryTest_user
          name
        }
      }
      author2: author {
        client_nickname
      }
      ...readUpdatableQueryTest_user
    }
    node(id: "4") {
      ... on User {
        __typename
        name
      }
    }
    node2: node(id: "5") {
      ... on User {
        __typename
        name
        parents {
          ...readUpdatableQueryTest_user
          name
          parents {
            name
          }
        }
      }
    }
    node3: node(id: "6") {
      id
      ...readUpdatableQueryTest_node
    }
  }
`;

const updatableQuery2 = graphql`
  query readUpdatableQueryTest2UpdatableQuery($id: ID!) @updatable {
    node(id: $id) {
      __typename
    }
  }
`;

const regularQuery = graphql`
  query readUpdatableQueryTestRegularQuery {
    me {
      ...readUpdatableQueryTest_node
      id
      name
      author {
        client_best_friend {
          name
        }
        client_nickname
      }
    }
    node(id: "4") {
      ...readUpdatableQueryTest_user @dangerously_unaliased_fixme
      ... on User {
        name
      }
    }
    node2: node(id: "5") {
      ... on User {
        name
        parents {
          id
          name
          parents {
            id
          }
        }
      }
    }
  }
`;

graphql`
  fragment readUpdatableQueryTest_user on User @assignable {
    __typename
  }
`;

graphql`
  fragment readUpdatableQueryTest_node on Node @assignable {
    __typename
  }
`;

describe('readUpdatableQuery', () => {
  let environment;
  let operation;

  beforeEach(() => {
    operation = createOperationDescriptor(regularQuery, {});
    const source = RelayRecordSource.create();
    const store = new RelayModernStore(source);

    const fetch = jest.fn<
      [
        RequestParameters,
        Variables,
        CacheConfig,
        ?UploadableMap,
        ?LogRequestInfoFunction,
      ],
      ObservableFromValue<GraphQLResponse>,
    >();
    environment = new RelayModernEnvironment({
      network: RelayNetwork.create(fetch),
      store,
    });
  });

  it('can be used to read scalar values', () => {
    environment.commitPayload(operation, {
      me: {
        __typename: 'User',
        author: null,
        id: '4',
        name: 'Zuck',
      },
      node: null,
      node2: null,
    });

    commitLocalUpdate(environment, store => {
      const me = store.getRoot()?.getLinkedRecord('me');
      expect(me?.getValue('id')).toEqual('4');
      expect(me?.getValue('name')).toEqual('Zuck');

      const updatableData = store.readUpdatableQuery(
        updatableQuery,
        {},
      ).updatableData;

      expect(updatableData.me?.id).toEqual('4');
      expect(updatableData.me?.name).toEqual('Zuck');
    });
  });

  it('can be used to update scalar values', () => {
    environment.commitPayload(operation, {
      me: {
        __typename: 'User',
        author: null,
        id: '4',
        name: 'Zuck',
      },
      node: null,
      node2: null,
    });

    commitLocalUpdate(environment, store => {
      const me = store.getRoot()?.getLinkedRecord('me');
      expect(me?.getValue('id')).toEqual('4');
      expect(me?.getValue('name')).toEqual('Zuck');

      const updatableData = store.readUpdatableQuery(
        updatableQuery,
        {},
      ).updatableData;

      if (updatableData.me != null) {
        updatableData.me.name = 'MetaZuck';
      }
      expect(updatableData.me?.name).toEqual('MetaZuck');
      expect(me?.getValue('name')).toEqual('MetaZuck');
    });

    const source = environment.getStore().getSource();
    const selector = operation.fragment;
    const readOnlyData: readUpdatableQueryTestRegularQuery['response'] =
      // $FlowFixMe[incompatible-type]
      // $FlowFixMe[incompatible-indexer]
      RelayReader.read(source, selector, null, undefined, undefined)
        .data as readUpdatableQueryTestRegularQuery['response'];
    expect(readOnlyData?.me?.name).toEqual('MetaZuck');
  });

  it('cannot be used to update clientids, ids or typenames', () => {
    environment.commitPayload(operation, {
      me: {
        __typename: 'User',
        author: null,
        id: '4',
        name: 'Zuck',
      },
      node: null,
      node2: null,
    });

    commitLocalUpdate(environment, store => {
      const me = store.getRoot()?.getLinkedRecord('me');
      expect(me?.getValue('id')).toEqual('4');
      expect(me?.getValue('name')).toEqual('Zuck');

      const updatableData = store.readUpdatableQuery(
        updatableQuery,
        {},
      ).updatableData;

      expect(() => {
        if (updatableData.me != null) {
          // $FlowFixMe[cannot-write] That's the point!
          updatableData.me.id = '5';
        }
      }).toThrowError();
      expect(() => {
        if (updatableData.me != null) {
          // $FlowFixMe[cannot-write] That's the point!
          updatableData.me.__typename = 'Protoss';
        }
      }).toThrowError();
      expect(() => {
        if (updatableData.me != null) {
          // $FlowFixMe[cannot-write] That's the point!
          updatableData.me.__id = '5';
        }
      }).toThrowError();
    });
  });

  it('does not create setters for fields within non-matching inline fragments', () => {
    environment.commitPayload(operation, {
      me: null,
      node: {
        __typename: 'User',
        id: '4',
        name: 'Zuck',
      },
      node2: {
        __typename: 'Page',
        id: '5',
      },
    });

    commitLocalUpdate(environment, store => {
      const node = store.getRoot()?.getLinkedRecord('node', {id: '4'});
      expect(node?.getValue('id')).toEqual('4');
      expect(node?.getValue('name')).toEqual('Zuck');

      const node2 = store.getRoot()?.getLinkedRecord('node', {id: '5'});
      expect(node2?.getValue('id')).toEqual('5');
      expect(node2?.getValue('name')).toEqual(undefined);

      const updatableData = store.readUpdatableQuery(
        updatableQuery,
        {},
      ).updatableData;

      if (updatableData.node != null) {
        const propertyDescriptor = Object.getOwnPropertyDescriptor(
          updatableData.node,
          'name',
        );
        expect(propertyDescriptor?.set).not.toEqual(undefined);
      }
      if (updatableData.node != null) {
        if (updatableData.node.__typename === 'User') {
          updatableData.node.name = 'MetaZuck';
          expect(updatableData.node.name).toEqual('MetaZuck');
        } else {
          throw new Error('Expected updatableData.node to have type User');
        }
      }
      expect(node?.getValue('name')).toEqual('MetaZuck');

      // Because node2 is not a user, selections within an inline fragment on User do not result
      // in a setter being created
      if (updatableData.node2 != null) {
        const propertyDescriptor2 = Object.getOwnPropertyDescriptor(
          updatableData.node2,
          'name',
        );
        expect(propertyDescriptor2).toEqual(undefined);

        // In __DEV__, this throws. In prod, this updates a value on an object, but that
        // doesn't update any value in the store, as evidenced by the undefined property
        // descriptor.
        expect(() => {
          if (updatableData.node2 != null) {
            // $FlowFixMe[prop-missing] that's the point!
            updatableData.node2.name = 'MetaZuck';
          }
        }).toThrowError();
      } else {
        throw new Error('Expected node2 to be found');
      }
    });
  });

  describe('assignable fragments with concrete type conditions', () => {
    it('lets you assign values to linked fields', () => {
      environment.commitPayload(operation, {
        me: {
          __typename: 'User',
          author: null,
          id: '42',
          name: 'NotZuck',
        },
        node: {
          __typename: 'User',
          id: '4',
          name: 'Zuck',
        },
        node2: null,
      });

      commitLocalUpdate(environment, store => {
        const me = store.getRoot()?.getLinkedRecord('me');
        expect(me?.getValue('id')).toEqual('42');
        expect(me?.getValue('name')).toEqual('NotZuck');

        const node = store.getRoot()?.getLinkedRecord('node', {id: '4'});
        expect(node?.getValue('id')).toEqual('4');
        expect(node?.getValue('name')).toEqual('Zuck');

        const updatableData = store.readUpdatableQuery(
          updatableQuery,
          {},
        ).updatableData;

        const source = environment.getStore().getSource();
        const selector = operation.fragment;
        const readOnlyData: readUpdatableQueryTestRegularQuery['response'] =
          // $FlowFixMe[incompatible-type]
          // $FlowFixMe[incompatible-indexer]
          RelayReader.read(source, selector, null, undefined, undefined)
            .data as readUpdatableQueryTestRegularQuery['response'];

        expect(readOnlyData.me?.id).toBe('42');

        if (readOnlyData.node != null) {
          if (readOnlyData.node.__typename === 'User') {
            expect(readOnlyData.node.__id).toBe('4');
          }
        }

        if (updatableData.me != null) {
          if (readOnlyData.node != null) {
            const validUser = validateUser(readOnlyData.node);
            if (validUser !== false) {
              updatableData.me = validUser;
              // Flow inference must be cleared here
              (() => {})();
              expect(updatableData.me?.id).toBe('4');
            } else {
              throw new Error('Expected assignment to be valid');
            }
          } else {
            throw new Error('Expected readOnlyData.node to exist');
          }
        } else {
          throw new Error('Expected updatableData.me to exist');
        }
      });

      const source = environment.getStore().getSource();
      const selector = operation.fragment;
      const readOnlyData: readUpdatableQueryTestRegularQuery['response'] =
        // $FlowFixMe[incompatible-type]
        // $FlowFixMe[incompatible-indexer]
        RelayReader.read(source, selector, undefined, undefined, null)
          .data as readUpdatableQueryTestRegularQuery['response'];
      expect(readOnlyData.me?.id).toBe('4');
    });

    it('lets you assign to plural linked fields', () => {
      environment.commitPayload(operation, {
        me: null,
        node: {
          __typename: 'User',
          id: '4',
          name: 'Gaius Julius Caesar',
        },
        node2: {
          __typename: 'User',
          id: '5',
          name: 'Gaius Julius Caesar Octavianus',
          parents: [
            {
              __typename: 'User',
              id: '467',
              name: 'Gaius Octavius',
              parents: [],
            },
          ],
        },
      });

      commitLocalUpdate(environment, store => {
        const updatableData = store.readUpdatableQuery(
          updatableQuery,
          {},
        ).updatableData;

        const source = environment.getStore().getSource();
        const selector = operation.fragment;
        const readOnlyData: readUpdatableQueryTestRegularQuery['response'] =
          // $FlowFixMe[incompatible-type]
          // $FlowFixMe[incompatible-indexer]
          RelayReader.read(source, selector, null, undefined, undefined)
            .data as readUpdatableQueryTestRegularQuery['response'];

        const validUser = (() => {
          if (readOnlyData.node != null) {
            if (readOnlyData.node.__typename === 'User') {
              const forAssignment = validateUser(readOnlyData.node);
              if (forAssignment !== false) {
                return forAssignment;
              }
            }
          }
          throw new Error(
            'Expected readOnlyData.node to exist, __typename User and be valid for assignment',
          );
        })();

        const node2 = (() => {
          if (updatableData.node2 != null) {
            if (updatableData.node2.__typename === 'User') {
              return updatableData.node2;
            }
          }
          throw new Error('Expected node2 to exist and have __typename User');
        })();

        node2.parents = [validUser];

        // We need to clear Flow's inference about what type node2.parents has
        (() => {})();

        if (node2.parents[0] != null) {
          expect(node2.parents[0]?.name).toBe('Gaius Julius Caesar');
        } else {
          throw new Error('Expected parent to exist');
        }
      });

      const source = environment.getStore().getSource();
      const selector = operation.fragment;
      const readOnlyData: readUpdatableQueryTestRegularQuery['response'] =
        // $FlowFixMe[incompatible-type]
        // $FlowFixMe[incompatible-indexer]
        RelayReader.read(source, selector, null, undefined, undefined)
          .data as readUpdatableQueryTestRegularQuery['response'];
      if (readOnlyData.node2?.parents != null) {
        expect(readOnlyData.node2?.parents[0]?.name).toBe(
          'Gaius Julius Caesar',
        );
      } else {
        throw new Error('Expected parents to exist');
      }
    });

    it('lets you update client extension linked fields', () => {
      environment.commitPayload(operation, {
        me: {
          __typename: 'User',
          author: {
            client_best_friend: {
              id: '6',
              name: 'Sheryl',
            },
            client_nickname: 'Zucc',
            id: '5',
          },
          id: '4',
          name: 'Mark',
        },
        node: {
          __typename: 'User',
          id: '4',
          name: 'Mark',
        },
        node2: null,
      });

      commitLocalUpdate(environment, store => {
        const updatableData = store.readUpdatableQuery(
          updatableQuery,
          {},
        ).updatableData;

        const source = environment.getStore().getSource();
        const selector = operation.fragment;
        const readOnlyData: readUpdatableQueryTestRegularQuery['response'] =
          // $FlowFixMe[incompatible-type]
          // $FlowFixMe[incompatible-indexer]
          RelayReader.read(source, selector, null, undefined, undefined)
            .data as readUpdatableQueryTestRegularQuery['response'];

        const author = (() => {
          if (updatableData.me?.author != null) {
            return updatableData.me.author;
          }
          throw new Error('Expected author to exist');
        })();

        const validUser = (() => {
          if (readOnlyData.node != null) {
            const forAssignment = validateUser(readOnlyData.node);
            if (forAssignment !== false) {
              return forAssignment;
            }
          }
          throw new Error(
            'Expected readOnlyData.node to exist and be valid for assignment',
          );
        })();

        author.client_best_friend = validUser;
        expect(updatableData.me?.author?.client_best_friend?.name).toBe('Mark');
      });
      const source = environment.getStore().getSource();
      const selector = operation.fragment;
      const readOnlyData: readUpdatableQueryTestRegularQuery['response'] =
        // $FlowFixMe[incompatible-type]
        // $FlowFixMe[incompatible-indexer]
        RelayReader.read(source, selector, null, undefined, undefined)
          .data as readUpdatableQueryTestRegularQuery['response'];
      expect(readOnlyData.me?.author?.client_best_friend?.name).toBe('Mark');
    });

    describe('validate', () => {
      it('will return false if the source has the wrong __typename', () => {
        environment.commitPayload(operation, {
          me: null,
          node: {
            __typename: 'Alien',
            id: '4',
          },
          node2: null,
        });

        const source = environment.getStore().getSource();
        const selector = operation.fragment;
        const readOnlyData: readUpdatableQueryTestRegularQuery['response'] =
          // $FlowFixMe[incompatible-type]
          // $FlowFixMe[incompatible-indexer]
          RelayReader.read(source, selector, null, undefined, undefined)
            .data as readUpdatableQueryTestRegularQuery['response'];
        if (readOnlyData.node != null) {
          expect(validateUser(readOnlyData.node)).toBe(false);
        } else {
          throw new Error('Expected readOnlyData.node to exist');
        }
      });

      it('will return the parameter if the source has a matching __typename', () => {
        environment.commitPayload(operation, {
          me: null,
          node: {
            __typename: 'User',
            id: '4',
            name: 'Mark',
          },
          node2: null,
        });

        const source = environment.getStore().getSource();
        const selector = operation.fragment;
        const readOnlyData: readUpdatableQueryTestRegularQuery['response'] =
          // $FlowFixMe[incompatible-type]
          // $FlowFixMe[incompatible-indexer]
          RelayReader.read(source, selector, null, undefined, undefined)
            .data as readUpdatableQueryTestRegularQuery['response'];
        if (readOnlyData.node != null) {
          expect(validateUser(readOnlyData.node)).toEqual(readOnlyData.node);
        } else {
          throw new Error('Expected readOnlyData.node to exist');
        }
      });
    });
  });

  describe('assignable fragments with abstract type conditions', () => {
    it('lets you assign values to linked fields', () => {
      environment.commitPayload(operation, {
        me: {
          __typename: 'User',
          author: null,
          id: '4',
          name: null,
        },
        node: null,
        node2: null,
      });

      commitLocalUpdate(environment, store => {
        const updatableData = store.readUpdatableQuery(
          updatableQuery,
          {},
        ).updatableData;

        const source = environment.getStore().getSource();
        const selector = operation.fragment;
        const readOnlyData: readUpdatableQueryTestRegularQuery['response'] =
          // $FlowFixMe[incompatible-type]
          // $FlowFixMe[incompatible-indexer]
          RelayReader.read(source, selector, null, undefined, undefined)
            .data as readUpdatableQueryTestRegularQuery['response'];

        const validNode = (() => {
          if (readOnlyData.me != null) {
            const forAssignment = validateNode(readOnlyData.me);
            if (forAssignment !== false) {
              return forAssignment;
            }
          }
          throw new Error('Expected me to be present and valid for assignment');
        })();

        updatableData.node3 = validNode;
        (() => {})();
        expect(updatableData.node3?.id).toBe('4');
      });
    });

    describe('validate', () => {
      it('will return the parameter if the source has a matching __isFragmentName field', () => {
        environment.commitPayload(operation, {
          me: {
            __isreadUpdatableQueryTest_node: null,
            __typename: 'User',
            author: null,
            id: '4',
            name: 'Mark',
          },
          node: null,
          node2: null,
        });

        const source = environment.getStore().getSource();
        const selector = operation.fragment;
        const readOnlyData: readUpdatableQueryTestRegularQuery['response'] =
          // $FlowFixMe[incompatible-type]
          // $FlowFixMe[incompatible-indexer]
          RelayReader.read(source, selector, null, undefined, undefined)
            .data as readUpdatableQueryTestRegularQuery['response'];
        expect(readOnlyData.me?.__isreadUpdatableQueryTest_node).toBe('User');
        if (readOnlyData.me != null) {
          expect(validateNode(readOnlyData.me)).toBe(readOnlyData.me);
        } else {
          throw new Error('Expected readOnlyData.me to exist');
        }
      });
    });
  });

  it('lets you delete linked fields by assigning null', () => {
    environment.commitPayload(operation, {
      me: {
        __typename: 'User',
        author: null,
        id: '42',
        name: 'NotZuck',
      },
      node: {
        __typename: 'User',
        id: '4',
        name: 'Zuck',
      },
      node2: null,
    });

    commitLocalUpdate(environment, store => {
      const me = store.getRoot()?.getLinkedRecord('me');
      expect(me?.getValue('id')).toEqual('42');
      expect(me?.getValue('name')).toEqual('NotZuck');

      const node = store.getRoot()?.getLinkedRecord('node', {id: '4'});
      expect(node?.getValue('id')).toEqual('4');
      expect(node?.getValue('name')).toEqual('Zuck');

      const updatableData = store.readUpdatableQuery(
        updatableQuery,
        {},
      ).updatableData;

      if (updatableData.me != null) {
        updatableData.me = null;
      }

      expect(updatableData.me).toBe(null);
      expect(store.getRoot()?.getLinkedRecord('me')).toBe(null);
    });

    const source = environment.getStore().getSource();
    const selector = operation.fragment;
    const readOnlyData: readUpdatableQueryTestRegularQuery['response'] =
      // $FlowFixMe[incompatible-type]
      // $FlowFixMe[incompatible-indexer]
      RelayReader.read(source, selector, null, undefined, undefined)
        .data as readUpdatableQueryTestRegularQuery['response'];
    expect(readOnlyData.me).toBe(null);
  });

  it('allows you to assign an empty array to clear plural linked fields', () => {
    environment.commitPayload(operation, {
      me: null,
      node: null,
      node2: {
        __typename: 'User',
        id: '5',
        name: 'Oedipus',
        parents: [
          {
            __typename: 'User',
            id: '467',
            name: 'Laius',
            parents: [],
          },
        ],
      },
    });

    commitLocalUpdate(environment, store => {
      const parents = store
        .getRoot()
        .getLinkedRecord('node', {id: '5'})
        ?.getLinkedRecords('parents');
      if (parents != null) {
        expect(parents[0]?.getValue('name')).toEqual('Laius');
      } else {
        throw new Error('parents should not be null');
      }

      const updatableData = store.readUpdatableQuery(
        updatableQuery,
        {},
      ).updatableData;

      if (updatableData.node2 != null) {
        if (updatableData.node2.__typename === 'User') {
          // $FlowFixMe[incompatible-type] Error found while enabling LTI on this file
          updatableData.node2.parents = [];
          expect(updatableData.node2.parents).toEqual([]);
          expect(
            store
              .getRoot()
              ?.getLinkedRecord('node', {id: '5'})
              ?.getLinkedRecords('parents'),
          ).toEqual([]);
        }
      } else {
        throw new Error('Expected node2 to exist');
      }
    });

    const source = environment.getStore().getSource();
    const selector = operation.fragment;
    const readOnlyData: readUpdatableQueryTestRegularQuery['response'] =
      // $FlowFixMe[incompatible-type]
      // $FlowFixMe[incompatible-indexer]
      RelayReader.read(source, selector, null, undefined, undefined)
        .data as readUpdatableQueryTestRegularQuery['response'];
    expect(readOnlyData.node2?.parents).toEqual([]);
  });

  it('throws if you assign null or undefined to a plural linked field', () => {
    environment.commitPayload(operation, {
      me: null,
      node: {
        __typename: 'User',
        id: '4',
        name: 'Gaius Julius Caesar',
      },
      node2: {
        __typename: 'User',
        id: '5',
        name: 'Gaius Julius Caesar Octavianus',
        parents: [
          {
            __typename: 'User',
            id: '467',
            name: 'Gaius Octavius',
            parents: [],
          },
        ],
      },
    });

    commitLocalUpdate(environment, store => {
      const updatableData = store.readUpdatableQuery(
        updatableQuery,
        {},
      ).updatableData;

      const source = environment.getStore().getSource();
      const selector = operation.fragment;
      const readOnlyData: readUpdatableQueryTestRegularQuery['response'] =
        // $FlowFixMe[incompatible-type]
        // $FlowFixMe[incompatible-indexer]
        RelayReader.read(source, selector, null, undefined, undefined)
          .data as readUpdatableQueryTestRegularQuery['response'];

      if (updatableData.node2 != null) {
        if (updatableData.node2.__typename === 'User') {
          if (readOnlyData.node != null) {
            if (readOnlyData.node.__typename === 'User') {
              expect(() => {
                /* eslint-disable-next-line ft-flow/no-flow-fix-me-comments */
                // $FlowFixMe[incompatible-type]
                // $FlowFixMe[incompatible-use]
                // $FlowFixMe[prop-missing]
                updatableData.node2.parents = null;
              }).toThrowError();
            }
          }
        } else {
          throw new Error('Expected node2 to have typename User');
        }
      } else {
        throw new Error('Expected node2 to exist');
      }
    });
  });

  it('lets you access fields deeply', () => {
    environment.commitPayload(operation, {
      me: null,
      node: {
        __typename: 'User',
        id: '4',
        name: 'Yancy Fry',
      },
      node2: {
        __typename: 'User',
        id: '5',
        name: 'Philip Fry',
        parents: [
          {
            __typename: 'User',
            id: '4',
            name: 'Yancy Fry',
            parents: [
              {
                id: '5',
              },
            ],
          },
        ],
      },
    });
    commitLocalUpdate(environment, store => {
      const updatableData = store.readUpdatableQuery(
        updatableQuery,
        {},
      ).updatableData;

      if (updatableData.node2 != null) {
        if (updatableData.node2.__typename === 'User') {
          expect(updatableData.node2?.parents[0].parents[0].name).toBe(
            'Philip Fry',
          );
        } else {
          throw new Error('Expected node2 to be a User');
        }
      } else {
        throw new Error('Expected node2 to exist');
      }
    });
  });

  it('lets you use variables', () => {
    environment.commitPayload(operation, {
      me: null,
      node: {
        __typename: 'Metahuman',
        id: '4',
      },
      node2: {
        __typename: 'Page',
        id: '5',
      },
    });

    commitLocalUpdate(environment, store => {
      const updatableData = store.readUpdatableQuery(updatableQuery2, {
        id: '4',
      }).updatableData;
      expect(updatableData.node?.__typename).toBe('Metahuman');

      const updatableData2 = store.readUpdatableQuery(updatableQuery2, {
        id: '5',
      }).updatableData;
      expect(updatableData2.node?.__typename).toBe('Page');

      const updatableData3 = store.readUpdatableQuery(updatableQuery2, {
        id: '42',
      }).updatableData;
      expect(updatableData3.node).toBe(undefined);
    });
  });

  it('should ignore extra variables, though flow will complain', () => {
    environment.commitPayload(operation, {
      me: null,
      node: {
        __typename: 'Metahuman',
        id: '4',
      },
      node2: null,
    });

    commitLocalUpdate(environment, store => {
      const updatableData = store.readUpdatableQuery(
        // $FlowFixMe[incompatible-type] Error found while enabling LTI on this file
        updatableQuery2,
        {foo: 'bar', id: '4'},
      ).updatableData;
      expect(updatableData.node?.__typename).toBe('Metahuman');
    });
  });

  it('does not throw when accessing a client extension field', () => {
    environment.commitPayload(operation, {
      me: {
        __typename: 'User',
        author: {
          client_best_friend: {
            id: '6',
            name: 'Sheryl',
          },
          client_nickname: 'Zucc',
          id: '5',
        },
        id: '4',
        name: 'Mark',
      },
      node: null,
      node2: null,
    });

    commitLocalUpdate(environment, store => {
      const updatableData = store.readUpdatableQuery(
        updatableQuery,
        {},
      ).updatableData;
      expect(() => {
        // The author field contains client_best_friend, which is a client extension
        updatableData.me?.author;
      }).not.toThrowError();
      expect(() => {
        // The author field contains client_nickname, which is a client extension
        updatableData.me?.author2;
      }).not.toThrowError();
    });
  });

  it('lets you update client extension scalar fields', () => {
    environment.commitPayload(operation, {
      me: {
        __typename: 'User',
        author: {
          client_best_friend: {
            id: '6',
            name: 'Sheryl',
          },
          client_nickname: 'Zucc',
          id: '5',
        },
        id: '4',
        name: 'Mark',
      },
      node: null,
      node2: null,
    });

    commitLocalUpdate(environment, store => {
      const updatableData = store.readUpdatableQuery(
        updatableQuery,
        {},
      ).updatableData;

      if (updatableData.me?.author2 != null) {
        updatableData.me.author2.client_nickname = 'Mr. Right';
      } else {
        throw new Error('Expected author to exist');
      }
      expect(updatableData.me?.author2?.client_nickname).toBe('Mr. Right');
    });
    const source = environment.getStore().getSource();
    const selector = operation.fragment;
    const readOnlyData: readUpdatableQueryTestRegularQuery['response'] =
      // $FlowFixMe[incompatible-type]
      // $FlowFixMe[incompatible-indexer]
      RelayReader.read(source, selector, null, undefined, undefined)
        .data as readUpdatableQueryTestRegularQuery['response'];
    expect(readOnlyData.me?.author?.client_nickname).toBe('Mr. Right');
  });

  it('lets you navigate through client extension fields and update nested scalar fields', () => {
    environment.commitPayload(operation, {
      me: {
        __typename: 'User',
        author: {
          client_best_friend: {
            id: '6',
            name: 'Sheryl',
          },
          client_nickname: 'Zucc',
          id: '5',
        },
        id: '4',
        name: 'Mark',
      },
      node: null,
      node2: null,
    });

    commitLocalUpdate(environment, store => {
      const updatableData = store.readUpdatableQuery(
        updatableQuery,
        {},
      ).updatableData;

      if (updatableData.me?.author?.client_best_friend != null) {
        updatableData.me.author.client_best_friend.name = 'Mr. Right';
      } else {
        throw new Error('Expected author to exist');
      }
      expect(updatableData.me?.author?.client_best_friend.name).toBe(
        'Mr. Right',
      );
    });

    const source = environment.getStore().getSource();
    const selector = operation.fragment;
    const readOnlyData: readUpdatableQueryTestRegularQuery['response'] =
      // $FlowFixMe[incompatible-type]
      // $FlowFixMe[incompatible-indexer]
      RelayReader.read(source, selector, null, undefined, undefined)
        .data as readUpdatableQueryTestRegularQuery['response'];
    expect(readOnlyData.me?.author?.client_best_friend?.name).toBe('Mr. Right');
  });

  describe('with custom scalars', () => {
    it('should update custom scalar field', () => {
      // Read initial data
      const readableQuery = graphql`
        query readUpdatableQueryTest2Query {
          updatable_scalar_field
        }
      `;
      const updateableQuery = graphql`
        query readUpdatableQueryTest1Query @updatable {
          updatable_scalar_field
        }
      `;

      const operationDescriptor = createOperationDescriptor(readableQuery, {});
      const value = environment.lookup(operationDescriptor.fragment);
      expect(value.data).toEqual({
        updatable_scalar_field: undefined,
      });

      function updateCustomScalar(newValue: OpaqueScalarType) {
        commitLocalUpdate(environment, store => {
          const updatableData = store.readUpdatableQuery(
            updateableQuery,
            {},
          ).updatableData;
          updatableData.updatable_scalar_field = newValue;
        });
      }

      // Update custom scalar field
      updateCustomScalar(
        createOpaqueScalarTypeValue('Alice', () => {
          throw new Error('Hello, Alice');
        }),
      );

      // Validate the updated value
      const updatedData = environment.lookup(operationDescriptor.fragment).data;
      expect(updatedData).toEqual({
        updatable_scalar_field: {
          callback: expect.any(Function),
          name: 'Alice',
        },
      });
      expect(() => {
        // $FlowFixMe[incompatible-use] we just checked that callback is a function
        updatedData.updatable_scalar_field.callback();
      }).toThrow('Hello, Alice');

      // Update custom value one more time
      updateCustomScalar(createOpaqueScalarTypeValue('Bob', jest.fn()));
      expect(environment.lookup(operationDescriptor.fragment).data).toEqual({
        updatable_scalar_field: {
          callback: expect.any(Function),
          name: 'Bob',
        },
      });
    });
  });

  describe('missing field handlers', () => {
    // Note that missing field handlers will only be consulted if the field in the store
    // is undefined (i.e. missing). They are not run on "null" records.
    // So, in these tests, we don't want to provide a null value for node(id: "4"), etc.
    //
    // If the operation for which we are providing data (via environment.commitPayload)
    // has a `node(id: "4")` selection, we must provide either null or a value for that field.
    // Providing `node: undefined` causes `environment.commitPayload` to throw an error.
    // Hence, we provide data using different operations that do not contain the fields
    // we are attempting to provide via missing field handlers.
    const missingFieldsUpdatableQuery = graphql`
      query readUpdatableQueryTestMissingFieldsUpdatableQuery @updatable {
        node(id: "4") {
          ... on User {
            __typename
            name
          }
        }
        nodes(ids: ["4"]) {
          ... on User {
            __typename
            name
          }
        }
        me {
          lastName
        }
      }
    `;
    const missingFieldsQuery = graphql`
      query readUpdatableQueryTestMissingFieldsQuery {
        me {
          name
        }
      }
    `;
    const missingFieldsOperation = createOperationDescriptor(
      missingFieldsQuery,
      {},
    );

    let handleLinkedField;
    let handlePluralLinkedField;
    let handleScalarField;

    beforeEach(() => {
      handleLinkedField = jest.fn(
        (
          field: NormalizationLinkedField | ReaderLinkedField,
          record: ?ReadOnlyRecordProxy,
          argValues: Variables,
        ) => {
          if (
            record != null &&
            record.getType() === ROOT_TYPE &&
            field.name === 'node' &&
            argValues.hasOwnProperty('id')
          ) {
            return argValues.id;
          }
        },
      );
      handlePluralLinkedField = jest.fn(
        (
          field: NormalizationLinkedField | ReaderLinkedField,
          record: ?ReadOnlyRecordProxy,
          argValues: Variables,
        ) => {
          if (
            record != null &&
            record.getType() === ROOT_TYPE &&
            field.name === 'nodes' &&
            argValues.hasOwnProperty('ids')
          ) {
            return argValues.ids;
          }
        },
      );
      handleScalarField = jest.fn(
        (field: NormalizationScalarField, record: ?ReadOnlyRecordProxy) => {
          if (field.name === 'lastName') {
            return 'Hamill';
          }
        },
      );

      const source = RelayRecordSource.create();
      const store = new RelayModernStore(source);

      const fetch = jest.fn<
        [
          RequestParameters,
          Variables,
          CacheConfig,
          ?UploadableMap,
          ?LogRequestInfoFunction,
        ],
        ObservableFromValue<GraphQLResponse>,
      >();
      environment = new RelayModernEnvironment({
        missingFieldHandlers: [
          // $FlowFixMe[invalid-tuple-arity] Error found while enabling LTI on this file
          {
            handle: handleLinkedField,
            kind: 'linked',
          },
          // $FlowFixMe[invalid-tuple-arity] Error found while enabling LTI on this file
          {
            handle: handlePluralLinkedField,
            kind: 'pluralLinked',
          },
          // $FlowFixMe[invalid-tuple-arity] Error found while enabling LTI on this file
          {
            handle: handleScalarField,
            kind: 'scalar',
          },
        ],
        network: RelayNetwork.create(fetch),
        store,
      });
    });

    it('should read linked fields using missing field handlers', () => {
      environment.commitPayload(missingFieldsOperation, {
        me: {
          __typename: 'User',
          id: '4',
          name: 'Zuck',
        },
      });

      commitLocalUpdate(environment, store => {
        const me = store.getRoot()?.getLinkedRecord('me');
        expect(me?.getValue('id')).toEqual('4');
        expect(me?.getValue('name')).toEqual('Zuck');

        const updatableData = store.readUpdatableQuery(
          missingFieldsUpdatableQuery,
          {},
        ).updatableData;

        const node = updatableData.node;
        expect(handleLinkedField).toHaveBeenCalledTimes(1);
        expect(node != null).toBe(true);
        if (node != null) {
          expect(node.__typename).toEqual('User');
          if (node.__typename === 'User') {
            expect(node.name).toEqual('Zuck');
          }
        }
      });
    });

    it('should read plural linked fields using missing field handlers', () => {
      environment.commitPayload(missingFieldsOperation, {
        me: {
          __typename: 'User',
          id: '4',
          name: 'Zuck',
        },
      });

      commitLocalUpdate(environment, store => {
        const me = store.getRoot()?.getLinkedRecord('me');
        expect(me?.getValue('id')).toEqual('4');
        expect(me?.getValue('name')).toEqual('Zuck');

        const updatableData = store.readUpdatableQuery(
          missingFieldsUpdatableQuery,
          {},
        ).updatableData;

        const nodes = updatableData.nodes;
        expect(handlePluralLinkedField).toHaveBeenCalledTimes(1);
        expect(nodes != null).toBe(true);
        if (nodes != null && nodes[0] != null) {
          expect(nodes[0].__typename).toEqual('User');
          if (nodes[0]?.__typename === 'User') {
            expect(nodes[0].name).toEqual('Zuck');
          }
        }
      });
    });

    it('should read scalar fields using missing field handlers', () => {
      environment.commitPayload(missingFieldsOperation, {
        me: {
          __typename: 'User',
          id: '4',
          name: 'Zuck',
        },
      });

      commitLocalUpdate(environment, store => {
        const me = store.getRoot()?.getLinkedRecord('me');
        expect(me?.getValue('id')).toEqual('4');
        expect(me?.getValue('name')).toEqual('Zuck');

        const updatableData = store.readUpdatableQuery(
          missingFieldsUpdatableQuery,
          {},
        ).updatableData;

        const updatableMe = updatableData.me;
        expect(updatableMe != null).toBe(true);
        if (updatableMe != null) {
          const lastName = updatableMe.lastName;
          expect(lastName).toBe('Hamill');
          expect(handleScalarField).toHaveBeenCalledTimes(1);
        }
      });
    });
  });
});
