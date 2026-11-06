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
  FetchFunction,
  GraphQLResponse,
  GraphQLSingularResponse,
  IncrementalDeliveryResponse,
} from 'relay-runtime/network/RelayNetworkTypes';
import type {Sink} from 'relay-runtime/network/RelayObservable';
import type {GraphQLTaggedNode} from 'relay-runtime/query/GraphQLTag';
import type {Variables} from 'relay-runtime/util/RelayRuntimeTypes';

const RelayNetwork = require('relay-runtime/network/RelayNetwork');
const {getRequest, graphql} = require('relay-runtime/query/GraphQLTag');
const RelayModernEnvironment = require('relay-runtime/store/RelayModernEnvironment');
const {
  createOperationDescriptor,
} = require('relay-runtime/store/RelayModernOperationDescriptor');
const RelayModernStore = require('relay-runtime/store/RelayModernStore');
const RelayRecordSource = require('relay-runtime/store/RelayRecordSource');

/**
 * Scenarios for incremental delivery (`@defer`/`@stream`): each document with
 * the responses graphql-js 17.0.2 sends for it, in Relay's label/path format
 * and in GraphQL's incremental delivery format, and a harness that runs them
 * through an environment.
 */

graphql`
  fragment RelayIncrementalDeliveryTestScenariosUserFragment on User {
    id
    name
  }
`;
graphql`
  fragment RelayIncrementalDeliveryTestScenariosOverlapFragment on User {
    name
    alternate_name
    address {
      city
    }
  }
`;
graphql`
  fragment RelayIncrementalDeliveryTestScenariosCoveredFragment on User {
    name
  }
`;
graphql`
  fragment RelayIncrementalDeliveryTestScenariosFirstFragment on User {
    name
    alternate_name
  }
`;
graphql`
  fragment RelayIncrementalDeliveryTestScenariosSecondFragment on User {
    name
  }
`;
graphql`
  fragment RelayIncrementalDeliveryTestScenariosOuterFragment on User {
    name
    ...RelayIncrementalDeliveryTestScenariosInnerFragment
      @dangerously_unaliased_fixme
      @defer(label: "Inner")
  }
`;
graphql`
  fragment RelayIncrementalDeliveryTestScenariosInnerFragment on User {
    alternate_name
  }
`;
graphql`
  fragment RelayIncrementalDeliveryTestScenariosActorFragment on Actor {
    name
  }
`;
graphql`
  fragment RelayIncrementalDeliveryTestScenariosFailedFragment on User {
    name
    nearest_neighbor {
      id
    }
  }
`;

graphql`
  fragment RelayIncrementalDeliveryTestScenariosSubPathFragment on User {
    address {
      city
    }
    ...RelayIncrementalDeliveryTestScenariosInnerFragment
      @dangerously_unaliased_fixme
      @defer(label: "Inner")
  }
`;
graphql`
  fragment RelayIncrementalDeliveryTestScenariosDeferredStreamFragment on Feedback {
    actors @stream(label: "actors", initial_count: 1) {
      name
    }
  }
`;
graphql`
  fragment RelayIncrementalDeliveryTestScenariosActorNamesFragment on Feedback {
    actors {
      name
    }
  }
`;

graphql`
  fragment RelayIncrementalDeliveryTestScenariosActorDetailsFragment on Actor {
    name
    lastName
  }
`;

const queries = {
  defer: graphql`
    query RelayIncrementalDeliveryTestScenariosDeferQuery($id: ID!) {
      node(id: $id) {
        ...RelayIncrementalDeliveryTestScenariosUserFragment
          @dangerously_unaliased_fixme
          @defer(label: "UserFragment")
      }
    }
  `,
  overlap: graphql`
    query RelayIncrementalDeliveryTestScenariosOverlapQuery($id: ID!) {
      node(id: $id) {
        ... on User {
          name
          address {
            street
          }
        }
        ...RelayIncrementalDeliveryTestScenariosOverlapFragment
          @dangerously_unaliased_fixme
          @defer(label: "OverlapFragment")
      }
    }
  `,
  covered: graphql`
    query RelayIncrementalDeliveryTestScenariosCoveredQuery($id: ID!) {
      node(id: $id) {
        ... on User {
          name
        }
        ...RelayIncrementalDeliveryTestScenariosCoveredFragment
          @dangerously_unaliased_fixme
          @defer(label: "CoveredFragment")
      }
    }
  `,
  siblings: graphql`
    query RelayIncrementalDeliveryTestScenariosSiblingsQuery($id: ID!) {
      node(id: $id) {
        ...RelayIncrementalDeliveryTestScenariosFirstFragment
          @dangerously_unaliased_fixme
          @defer(label: "First")
        ...RelayIncrementalDeliveryTestScenariosSecondFragment
          @dangerously_unaliased_fixme
          @defer(label: "Second")
      }
    }
  `,
  nested: graphql`
    query RelayIncrementalDeliveryTestScenariosNestedQuery($id: ID!) {
      node(id: $id) {
        ...RelayIncrementalDeliveryTestScenariosOuterFragment
          @dangerously_unaliased_fixme
          @defer(label: "Outer")
      }
    }
  `,
  stream: graphql`
    query RelayIncrementalDeliveryTestScenariosStreamQuery($id: ID!) {
      node(id: $id) {
        ... on Feedback {
          actors @stream(label: "actors", initial_count: 1) {
            name
          }
        }
      }
    }
  `,
  streamDefer: graphql`
    query RelayIncrementalDeliveryTestScenariosStreamDeferQuery($id: ID!) {
      node(id: $id) {
        ... on Feedback {
          actors @stream(label: "actors", initial_count: 1) {
            ...RelayIncrementalDeliveryTestScenariosActorFragment
              @dangerously_unaliased_fixme
              @defer(label: "ActorFragment")
          }
        }
      }
    }
  `,
  list: graphql`
    query RelayIncrementalDeliveryTestScenariosListQuery($id: ID!) {
      node(id: $id) {
        ... on Feedback {
          actors {
            ...RelayIncrementalDeliveryTestScenariosActorFragment
              @dangerously_unaliased_fixme
              @defer(label: "ActorFragment")
          }
        }
      }
    }
  `,
  failed: graphql`
    query RelayIncrementalDeliveryTestScenariosFailedQuery($id: ID!) {
      node(id: $id) {
        ...RelayIncrementalDeliveryTestScenariosFailedFragment
          @dangerously_unaliased_fixme
          @defer(label: "FailedFragment")
      }
    }
  `,
  subPathNested: graphql`
    query RelayIncrementalDeliveryTestScenariosSubPathNestedQuery($id: ID!) {
      node(id: $id) {
        ... on User {
          address {
            street
          }
        }
        ...RelayIncrementalDeliveryTestScenariosSubPathFragment
          @dangerously_unaliased_fixme
          @defer(label: "SubPathFragment")
      }
    }
  `,
  deferredStream: graphql`
    query RelayIncrementalDeliveryTestScenariosDeferredStreamQuery($id: ID!) {
      node(id: $id) {
        ...RelayIncrementalDeliveryTestScenariosDeferredStreamFragment
          @dangerously_unaliased_fixme
          @defer(label: "DeferredStream")
      }
    }
  `,
  streamFromZero: graphql`
    query RelayIncrementalDeliveryTestScenariosStreamFromZeroQuery($id: ID!) {
      node(id: $id) {
        ... on Feedback {
          actors @stream(label: "actors", initial_count: 0) {
            name
          }
        }
      }
    }
  `,
  streamItemError: graphql`
    query RelayIncrementalDeliveryTestScenariosStreamItemErrorQuery($id: ID!) {
      node(id: $id) {
        ... on Feedback {
          actors @stream(label: "actors", initial_count: 1) {
            name
            ... on User {
              alternate_name
            }
          }
        }
      }
    }
  `,
  listSubPath: graphql`
    query RelayIncrementalDeliveryTestScenariosListSubPathQuery($id: ID!) {
      node(id: $id) {
        ... on Feedback {
          actors {
            id
          }
        }
        ...RelayIncrementalDeliveryTestScenariosActorNamesFragment
          @dangerously_unaliased_fixme
          @defer(label: "ActorNames")
      }
    }
  `,
  streamedConnection: graphql`
    query RelayIncrementalDeliveryTestScenariosStreamedConnectionQuery {
      viewer {
        newsFeed(first: 3)
          @stream_connection(
            key: "RelayIncrementalDeliveryTestScenarios_newsFeed"
            initial_count: 1
          ) {
          edges {
            cursor
            node {
              __typename
              id
            }
          }
        }
      }
    }
  `,
  abstractMarker: graphql`
    query RelayIncrementalDeliveryTestScenariosAbstractMarkerQuery($id: ID!) {
      node(id: $id) {
        ... on Feedback {
          actors {
            ... on Actor {
              name
            }
            ...RelayIncrementalDeliveryTestScenariosActorDetailsFragment
              @dangerously_unaliased_fixme
              @defer(label: "ActorDetails")
          }
        }
      }
    }
  `,
  coveredNested: graphql`
    query RelayIncrementalDeliveryTestScenariosCoveredNestedQuery($id: ID!) {
      node(id: $id) {
        ... on User {
          name
        }
        ...RelayIncrementalDeliveryTestScenariosOuterFragment
          @dangerously_unaliased_fixme
          @defer(label: "Outer")
      }
    }
  `,
};

/**
 * The responses graphql-js 17.0.2 sends for a scenario's document and data:
 * `labelPath` from its legacy executor, flattened into the payloads Relay
 * applies (one per deferred fragment or streamed item, as WWW sends them), and
 * `incremental` from its experimental executor.
 */
export type Scenario = {
  name: string,
  query: GraphQLTaggedNode,
  variables: Variables,
  labelPath: ReadonlyArray<GraphQLResponse>,
  incremental: ReadonlyArray<
    GraphQLSingularResponse | IncrementalDeliveryResponse,
  >,
};

// graphql-js 17.0.2's responses for each document and data.
const scenarios: ReadonlyArray<Scenario> = [
  {
    name: 'a deferred fragment, whose id the initial payload already has',
    query: queries.defer,
    variables: {id: '1'},
    labelPath: [
      {
        data: {
          node: {
            __typename: 'User',
            id: '1',
          },
        },
        extensions: {
          is_final: false,
        },
      },
      {
        data: {
          id: '1',
          name: 'Name 1',
        },
        label:
          'RelayIncrementalDeliveryTestScenariosDeferQuery$defer$UserFragment',
        path: ['node'],
        extensions: {
          is_final: true,
        },
      },
    ],
    incremental: [
      {
        data: {
          node: {
            __typename: 'User',
            id: '1',
          },
        },
        pending: [
          {
            id: '0',
            path: ['node'],
            label:
              'RelayIncrementalDeliveryTestScenariosDeferQuery$defer$UserFragment',
          },
        ],
        hasNext: true,
      },
      {
        hasNext: false,
        incremental: [
          {
            id: '0',
            data: {
              name: 'Name 1',
            },
          },
        ],
        completed: [
          {
            id: '0',
          },
        ],
      },
    ],
  },
  {
    name: 'a deferred fragment overlapping the initial payload, in part below it (subPath)',
    query: queries.overlap,
    variables: {id: '1'},
    labelPath: [
      {
        data: {
          node: {
            __typename: 'User',
            name: 'Name 1',
            address: {
              street: 'Hacker Way',
            },
            id: '1',
          },
        },
        extensions: {
          is_final: false,
        },
      },
      {
        data: {
          name: 'Name 1',
          address: {
            city: 'Menlo Park',
          },
          alternate_name: 'Alternate 1',
        },
        label:
          'RelayIncrementalDeliveryTestScenariosOverlapQuery$defer$OverlapFragment',
        path: ['node'],
        extensions: {
          is_final: true,
        },
      },
    ],
    incremental: [
      {
        data: {
          node: {
            __typename: 'User',
            name: 'Name 1',
            address: {
              street: 'Hacker Way',
            },
            id: '1',
          },
        },
        pending: [
          {
            id: '0',
            path: ['node'],
            label:
              'RelayIncrementalDeliveryTestScenariosOverlapQuery$defer$OverlapFragment',
          },
        ],
        hasNext: true,
      },
      {
        hasNext: false,
        incremental: [
          {
            id: '0',
            data: {
              city: 'Menlo Park',
            },
            subPath: ['address'],
          },
          {
            id: '0',
            data: {
              alternate_name: 'Alternate 1',
            },
          },
        ],
        completed: [
          {
            id: '0',
          },
        ],
      },
    ],
  },
  {
    name: 'a deferred fragment the initial payload covers entirely',
    query: queries.covered,
    variables: {id: '1'},
    labelPath: [
      {
        data: {
          node: {
            __typename: 'User',
            name: 'Name 1',
            id: '1',
          },
        },
        extensions: {
          is_final: false,
        },
      },
      {
        data: {
          name: 'Name 1',
        },
        label:
          'RelayIncrementalDeliveryTestScenariosCoveredQuery$defer$CoveredFragment',
        path: ['node'],
        extensions: {
          is_final: true,
        },
      },
    ],
    incremental: [
      {
        data: {
          node: {
            __typename: 'User',
            name: 'Name 1',
            id: '1',
          },
        },
      },
    ],
  },
  {
    name: 'two deferred fragments sharing a field',
    query: queries.siblings,
    variables: {id: '1'},
    labelPath: [
      {
        data: {
          node: {
            __typename: 'User',
            id: '1',
          },
        },
        extensions: {
          is_final: false,
        },
      },
      {
        data: {
          name: 'Name 1',
        },
        label:
          'RelayIncrementalDeliveryTestScenariosSiblingsQuery$defer$Second',
        path: ['node'],
      },
      {
        data: {
          name: 'Name 1',
          alternate_name: 'Alternate 1',
        },
        label: 'RelayIncrementalDeliveryTestScenariosSiblingsQuery$defer$First',
        path: ['node'],
        extensions: {
          is_final: true,
        },
      },
    ],
    incremental: [
      {
        data: {
          node: {
            __typename: 'User',
            id: '1',
          },
        },
        pending: [
          {
            id: '0',
            path: ['node'],
            label:
              'RelayIncrementalDeliveryTestScenariosSiblingsQuery$defer$First',
          },
          {
            id: '1',
            path: ['node'],
            label:
              'RelayIncrementalDeliveryTestScenariosSiblingsQuery$defer$Second',
          },
        ],
        hasNext: true,
      },
      {
        hasNext: true,
        incremental: [
          {
            id: '1',
            data: {
              name: 'Name 1',
            },
          },
        ],
        completed: [
          {
            id: '1',
          },
        ],
      },
      {
        hasNext: false,
        incremental: [
          {
            id: '0',
            data: {
              alternate_name: 'Alternate 1',
            },
          },
        ],
        completed: [
          {
            id: '0',
          },
        ],
      },
    ],
  },
  {
    name: 'a deferred fragment inside a deferred fragment',
    query: queries.nested,
    variables: {id: '1'},
    labelPath: [
      {
        data: {
          node: {
            __typename: 'User',
            id: '1',
          },
        },
        extensions: {
          is_final: false,
        },
      },
      {
        data: {
          name: 'Name 1',
        },
        label: 'RelayIncrementalDeliveryTestScenariosNestedQuery$defer$Outer',
        path: ['node'],
      },
      {
        data: {
          alternate_name: 'Alternate 1',
        },
        label: 'RelayIncrementalDeliveryTestScenariosOuterFragment$defer$Inner',
        path: ['node'],
        extensions: {
          is_final: true,
        },
      },
    ],
    incremental: [
      {
        data: {
          node: {
            __typename: 'User',
            id: '1',
          },
        },
        pending: [
          {
            id: '0',
            path: ['node'],
            label:
              'RelayIncrementalDeliveryTestScenariosNestedQuery$defer$Outer',
          },
        ],
        hasNext: true,
      },
      {
        hasNext: true,
        pending: [
          {
            id: '1',
            path: ['node'],
            label:
              'RelayIncrementalDeliveryTestScenariosOuterFragment$defer$Inner',
          },
        ],
        incremental: [
          {
            id: '0',
            data: {
              name: 'Name 1',
            },
          },
        ],
        completed: [
          {
            id: '0',
          },
        ],
      },
      {
        hasNext: false,
        incremental: [
          {
            id: '1',
            data: {
              alternate_name: 'Alternate 1',
            },
          },
        ],
        completed: [
          {
            id: '1',
          },
        ],
      },
    ],
  },
  {
    name: 'a streamed list',
    query: queries.stream,
    variables: {id: 'f1'},
    labelPath: [
      {
        data: {
          node: {
            __typename: 'Feedback',
            actors: [
              {
                __typename: 'User',
                name: 'Name a1',
                id: 'a1',
              },
            ],
            id: 'f1',
          },
        },
        extensions: {
          is_final: false,
        },
      },
      {
        data: {
          __typename: 'User',
          name: 'Name a2',
          id: 'a2',
        },
        label: 'RelayIncrementalDeliveryTestScenariosStreamQuery$stream$actors',
        path: ['node', 'actors', 1],
      },
      {
        data: {
          __typename: 'User',
          name: 'Name a3',
          id: 'a3',
        },
        label: 'RelayIncrementalDeliveryTestScenariosStreamQuery$stream$actors',
        path: ['node', 'actors', 2],
      },
      {
        data: null,
        extensions: {
          is_final: true,
        },
      },
    ],
    incremental: [
      {
        data: {
          node: {
            __typename: 'Feedback',
            actors: [
              {
                __typename: 'User',
                name: 'Name a1',
                id: 'a1',
              },
            ],
            id: 'f1',
          },
        },
        pending: [
          {
            id: '0',
            path: ['node', 'actors'],
            label:
              'RelayIncrementalDeliveryTestScenariosStreamQuery$stream$actors',
          },
        ],
        hasNext: true,
      },
      {
        hasNext: true,
        incremental: [
          {
            id: '0',
            items: [
              {
                __typename: 'User',
                name: 'Name a2',
                id: 'a2',
              },
            ],
          },
        ],
      },
      {
        hasNext: true,
        incremental: [
          {
            id: '0',
            items: [
              {
                __typename: 'User',
                name: 'Name a3',
                id: 'a3',
              },
            ],
          },
        ],
      },
      {
        hasNext: false,
        completed: [
          {
            id: '0',
          },
        ],
      },
    ],
  },
  {
    name: 'a streamed list whose last round is empty',
    query: queries.stream,
    variables: {id: 'f2'},
    labelPath: [
      {
        data: {
          node: {
            __typename: 'Feedback',
            actors: [
              {
                __typename: 'User',
                name: 'Name a1',
                id: 'a1',
              },
            ],
            id: 'f2',
          },
        },
        extensions: {
          is_final: false,
        },
      },
      {
        data: {
          __typename: 'User',
          name: 'Name a2',
          id: 'a2',
        },
        label: 'RelayIncrementalDeliveryTestScenariosStreamQuery$stream$actors',
        path: ['node', 'actors', 1],
      },
      {
        data: null,
        extensions: {
          is_final: true,
        },
      },
    ],
    incremental: [
      {
        data: {
          node: {
            __typename: 'Feedback',
            actors: [
              {
                __typename: 'User',
                name: 'Name a1',
                id: 'a1',
              },
            ],
            id: 'f2',
          },
        },
        pending: [
          {
            id: '0',
            path: ['node', 'actors'],
            label:
              'RelayIncrementalDeliveryTestScenariosStreamQuery$stream$actors',
          },
        ],
        hasNext: true,
      },
      {
        hasNext: true,
        incremental: [
          {
            id: '0',
            items: [
              {
                __typename: 'User',
                name: 'Name a2',
                id: 'a2',
              },
            ],
          },
        ],
      },
      {
        hasNext: false,
        completed: [
          {
            id: '0',
          },
        ],
      },
    ],
  },
  {
    name: 'a streamed list whose items arrive together',
    query: queries.stream,
    variables: {id: 'f4'},
    labelPath: [
      {
        data: {
          node: {
            __typename: 'Feedback',
            actors: [
              {
                __typename: 'User',
                name: 'Name b1',
                id: 'b1',
              },
            ],
            id: 'f4',
          },
        },
        extensions: {
          is_final: false,
        },
      },
      [
        {
          data: {
            __typename: 'User',
            name: 'Name b2',
            id: 'b2',
          },
          label:
            'RelayIncrementalDeliveryTestScenariosStreamQuery$stream$actors',
          path: ['node', 'actors', 1],
        },
        {
          data: {
            __typename: 'User',
            name: 'Name b3',
            id: 'b3',
          },
          label:
            'RelayIncrementalDeliveryTestScenariosStreamQuery$stream$actors',
          path: ['node', 'actors', 2],
          extensions: {
            is_final: true,
          },
        },
      ],
    ],
    incremental: [
      {
        data: {
          node: {
            __typename: 'Feedback',
            actors: [
              {
                __typename: 'User',
                name: 'Name b1',
                id: 'b1',
              },
            ],
            id: 'f4',
          },
        },
        pending: [
          {
            id: '0',
            path: ['node', 'actors'],
            label:
              'RelayIncrementalDeliveryTestScenariosStreamQuery$stream$actors',
          },
        ],
        hasNext: true,
      },
      {
        hasNext: false,
        incremental: [
          {
            id: '0',
            items: [
              {
                __typename: 'User',
                name: 'Name b2',
                id: 'b2',
              },
              {
                __typename: 'User',
                name: 'Name b3',
                id: 'b3',
              },
            ],
          },
        ],
        completed: [
          {
            id: '0',
          },
        ],
      },
    ],
  },
  {
    name: 'a deferred fragment in each streamed item',
    query: queries.streamDefer,
    variables: {id: 'f1'},
    labelPath: [
      {
        data: {
          node: {
            __typename: 'Feedback',
            actors: [
              {
                __typename: 'User',
                id: 'a1',
              },
            ],
            id: 'f1',
          },
        },
        extensions: {
          is_final: false,
        },
      },
      {
        data: {
          __isActor: 'User',
          name: 'Name a1',
        },
        label:
          'RelayIncrementalDeliveryTestScenariosStreamDeferQuery$defer$ActorFragment',
        path: ['node', 'actors', 0],
      },
      {
        data: {
          __typename: 'User',
          id: 'a2',
        },
        label:
          'RelayIncrementalDeliveryTestScenariosStreamDeferQuery$stream$actors',
        path: ['node', 'actors', 1],
      },
      {
        data: {
          __isActor: 'User',
          name: 'Name a2',
        },
        label:
          'RelayIncrementalDeliveryTestScenariosStreamDeferQuery$defer$ActorFragment',
        path: ['node', 'actors', 1],
      },
      {
        data: {
          __typename: 'User',
          id: 'a3',
        },
        label:
          'RelayIncrementalDeliveryTestScenariosStreamDeferQuery$stream$actors',
        path: ['node', 'actors', 2],
      },
      {
        data: {
          __isActor: 'User',
          name: 'Name a3',
        },
        label:
          'RelayIncrementalDeliveryTestScenariosStreamDeferQuery$defer$ActorFragment',
        path: ['node', 'actors', 2],
      },
      {
        data: null,
        extensions: {
          is_final: true,
        },
      },
    ],
    incremental: [
      {
        data: {
          node: {
            __typename: 'Feedback',
            actors: [
              {
                __typename: 'User',
                id: 'a1',
              },
            ],
            id: 'f1',
          },
        },
        pending: [
          {
            id: '0',
            path: ['node', 'actors', 0],
            label:
              'RelayIncrementalDeliveryTestScenariosStreamDeferQuery$defer$ActorFragment',
          },
          {
            id: '1',
            path: ['node', 'actors'],
            label:
              'RelayIncrementalDeliveryTestScenariosStreamDeferQuery$stream$actors',
          },
        ],
        hasNext: true,
      },
      {
        hasNext: true,
        incremental: [
          {
            id: '0',
            data: {
              __isActor: 'User',
              name: 'Name a1',
            },
          },
        ],
        completed: [
          {
            id: '0',
          },
        ],
      },
      {
        hasNext: true,
        pending: [
          {
            id: '2',
            path: ['node', 'actors', 1],
            label:
              'RelayIncrementalDeliveryTestScenariosStreamDeferQuery$defer$ActorFragment',
          },
        ],
        incremental: [
          {
            id: '1',
            items: [
              {
                __typename: 'User',
                id: 'a2',
              },
            ],
          },
        ],
      },
      {
        hasNext: true,
        incremental: [
          {
            id: '2',
            data: {
              __isActor: 'User',
              name: 'Name a2',
            },
          },
        ],
        completed: [
          {
            id: '2',
          },
        ],
      },
      {
        hasNext: true,
        pending: [
          {
            id: '3',
            path: ['node', 'actors', 2],
            label:
              'RelayIncrementalDeliveryTestScenariosStreamDeferQuery$defer$ActorFragment',
          },
        ],
        incremental: [
          {
            id: '1',
            items: [
              {
                __typename: 'User',
                id: 'a3',
              },
            ],
          },
        ],
      },
      {
        hasNext: true,
        incremental: [
          {
            id: '3',
            data: {
              __isActor: 'User',
              name: 'Name a3',
            },
          },
        ],
        completed: [
          {
            id: '3',
          },
        ],
      },
      {
        hasNext: false,
        completed: [
          {
            id: '1',
          },
        ],
      },
    ],
  },
  {
    name: 'a deferred fragment in each list item',
    query: queries.list,
    variables: {id: 'f1'},
    labelPath: [
      {
        data: {
          node: {
            __typename: 'Feedback',
            actors: [
              {
                __typename: 'User',
                id: 'a1',
              },
              {
                __typename: 'User',
                id: 'a2',
              },
              {
                __typename: 'User',
                id: 'a3',
              },
            ],
            id: 'f1',
          },
        },
        extensions: {
          is_final: false,
        },
      },
      {
        data: {
          __isActor: 'User',
          name: 'Name a1',
        },
        label:
          'RelayIncrementalDeliveryTestScenariosListQuery$defer$ActorFragment',
        path: ['node', 'actors', 0],
      },
      {
        data: {
          __isActor: 'User',
          name: 'Name a2',
        },
        label:
          'RelayIncrementalDeliveryTestScenariosListQuery$defer$ActorFragment',
        path: ['node', 'actors', 1],
      },
      {
        data: {
          __isActor: 'User',
          name: 'Name a3',
        },
        label:
          'RelayIncrementalDeliveryTestScenariosListQuery$defer$ActorFragment',
        path: ['node', 'actors', 2],
        extensions: {
          is_final: true,
        },
      },
    ],
    incremental: [
      {
        data: {
          node: {
            __typename: 'Feedback',
            actors: [
              {
                __typename: 'User',
                id: 'a1',
              },
              {
                __typename: 'User',
                id: 'a2',
              },
              {
                __typename: 'User',
                id: 'a3',
              },
            ],
            id: 'f1',
          },
        },
        pending: [
          {
            id: '0',
            path: ['node', 'actors', 0],
            label:
              'RelayIncrementalDeliveryTestScenariosListQuery$defer$ActorFragment',
          },
          {
            id: '1',
            path: ['node', 'actors', 1],
            label:
              'RelayIncrementalDeliveryTestScenariosListQuery$defer$ActorFragment',
          },
          {
            id: '2',
            path: ['node', 'actors', 2],
            label:
              'RelayIncrementalDeliveryTestScenariosListQuery$defer$ActorFragment',
          },
        ],
        hasNext: true,
      },
      {
        hasNext: true,
        incremental: [
          {
            id: '0',
            data: {
              __isActor: 'User',
              name: 'Name a1',
            },
          },
        ],
        completed: [
          {
            id: '0',
          },
        ],
      },
      {
        hasNext: true,
        incremental: [
          {
            id: '1',
            data: {
              __isActor: 'User',
              name: 'Name a2',
            },
          },
        ],
        completed: [
          {
            id: '1',
          },
        ],
      },
      {
        hasNext: false,
        incremental: [
          {
            id: '2',
            data: {
              __isActor: 'User',
              name: 'Name a3',
            },
          },
        ],
        completed: [
          {
            id: '2',
          },
        ],
      },
    ],
  },
  {
    name: 'a field error inside a deferred fragment',
    query: queries.overlap,
    variables: {id: '2'},
    labelPath: [
      {
        data: {
          node: {
            __typename: 'User',
            name: 'Name 2',
            address: {
              street: 'Hacker Way',
            },
            id: '2',
          },
        },
        extensions: {
          is_final: false,
        },
      },
      {
        data: {
          name: 'Name 2',
          address: {
            city: 'Menlo Park',
          },
          alternate_name: null,
        },
        label:
          'RelayIncrementalDeliveryTestScenariosOverlapQuery$defer$OverlapFragment',
        path: ['node'],
        errors: [
          {
            message: 'alternate_name failed',
            locations: [
              {
                line: 19,
                column: 3,
              },
            ],
            path: ['alternate_name'],
          },
        ],
        extensions: {
          is_final: true,
        },
      },
    ],
    incremental: [
      {
        data: {
          node: {
            __typename: 'User',
            name: 'Name 2',
            address: {
              street: 'Hacker Way',
            },
            id: '2',
          },
        },
        pending: [
          {
            id: '0',
            path: ['node'],
            label:
              'RelayIncrementalDeliveryTestScenariosOverlapQuery$defer$OverlapFragment',
          },
        ],
        hasNext: true,
      },
      {
        hasNext: false,
        incremental: [
          {
            id: '0',
            data: {
              city: 'Menlo Park',
            },
            subPath: ['address'],
          },
          {
            id: '0',
            data: {
              alternate_name: null,
            },
            errors: [
              {
                message: 'alternate_name failed',
                locations: [
                  {
                    line: 19,
                    column: 3,
                  },
                ],
                path: ['node', 'alternate_name'],
              },
            ],
          },
        ],
        completed: [
          {
            id: '0',
          },
        ],
      },
    ],
  },
  {
    name: 'a deferred fragment that fails as a whole',
    query: queries.failed,
    variables: {id: '1'},
    labelPath: [
      {
        data: {
          node: {
            __typename: 'User',
            id: '1',
          },
        },
        extensions: {
          is_final: false,
        },
      },
      {
        data: null,
        label:
          'RelayIncrementalDeliveryTestScenariosFailedQuery$defer$FailedFragment',
        path: ['node'],
        errors: [
          {
            message: 'nearest_neighbor failed',
            locations: [
              {
                line: 13,
                column: 3,
              },
            ],
            path: ['nearest_neighbor'],
          },
        ],
        extensions: {
          is_final: true,
        },
      },
    ],
    incremental: [
      {
        data: {
          node: {
            __typename: 'User',
            id: '1',
          },
        },
        pending: [
          {
            id: '0',
            path: ['node'],
            label:
              'RelayIncrementalDeliveryTestScenariosFailedQuery$defer$FailedFragment',
          },
        ],
        hasNext: true,
      },
      {
        hasNext: false,
        completed: [
          {
            id: '0',
            errors: [
              {
                message: 'nearest_neighbor failed',
                locations: [
                  {
                    line: 13,
                    column: 3,
                  },
                ],
                path: ['node', 'nearest_neighbor'],
              },
            ],
          },
        ],
      },
    ],
  },
  {
    name: 'a deferred fragment whose only new field is below its top, with a fragment deferred inside',
    query: queries.subPathNested,
    variables: {id: '1'},
    labelPath: [
      {
        data: {
          node: {
            __typename: 'User',
            address: {
              street: 'Hacker Way',
            },
            id: '1',
          },
        },
        extensions: {
          is_final: false,
        },
      },
      {
        data: {
          address: {
            city: 'Menlo Park',
          },
        },
        label:
          'RelayIncrementalDeliveryTestScenariosSubPathNestedQuery$defer$SubPathFragment',
        path: ['node'],
      },
      {
        data: {
          alternate_name: 'Alternate 1',
        },
        label:
          'RelayIncrementalDeliveryTestScenariosSubPathFragment$defer$Inner',
        path: ['node'],
        extensions: {
          is_final: true,
        },
      },
    ],
    incremental: [
      {
        data: {
          node: {
            __typename: 'User',
            address: {
              street: 'Hacker Way',
            },
            id: '1',
          },
        },
        pending: [
          {
            id: '0',
            path: ['node'],
            label:
              'RelayIncrementalDeliveryTestScenariosSubPathNestedQuery$defer$SubPathFragment',
          },
        ],
        hasNext: true,
      },
      {
        hasNext: true,
        pending: [
          {
            id: '1',
            path: ['node'],
            label:
              'RelayIncrementalDeliveryTestScenariosSubPathFragment$defer$Inner',
          },
        ],
        incremental: [
          {
            id: '0',
            data: {
              city: 'Menlo Park',
            },
            subPath: ['address'],
          },
        ],
        completed: [
          {
            id: '0',
          },
        ],
      },
      {
        hasNext: false,
        incremental: [
          {
            id: '1',
            data: {
              alternate_name: 'Alternate 1',
            },
          },
        ],
        completed: [
          {
            id: '1',
          },
        ],
      },
    ],
  },
  {
    name: 'a streamed list inside a deferred fragment',
    query: queries.deferredStream,
    variables: {id: 'f1'},
    labelPath: [
      {
        data: {
          node: {
            __typename: 'Feedback',
            id: 'f1',
          },
        },
        extensions: {
          is_final: false,
        },
      },
      {
        data: {
          actors: [
            {
              __typename: 'User',
              name: 'Name a1',
              id: 'a1',
            },
          ],
        },
        label:
          'RelayIncrementalDeliveryTestScenariosDeferredStreamQuery$defer$DeferredStream',
        path: ['node'],
      },
      {
        data: {
          __typename: 'User',
          name: 'Name a2',
          id: 'a2',
        },
        label:
          'RelayIncrementalDeliveryTestScenariosDeferredStreamFragment$stream$actors',
        path: ['node', 'actors', 1],
      },
      {
        data: {
          __typename: 'User',
          name: 'Name a3',
          id: 'a3',
        },
        label:
          'RelayIncrementalDeliveryTestScenariosDeferredStreamFragment$stream$actors',
        path: ['node', 'actors', 2],
      },
      {
        data: null,
        extensions: {
          is_final: true,
        },
      },
    ],
    incremental: [
      {
        data: {
          node: {
            __typename: 'Feedback',
            id: 'f1',
          },
        },
        pending: [
          {
            id: '0',
            path: ['node'],
            label:
              'RelayIncrementalDeliveryTestScenariosDeferredStreamQuery$defer$DeferredStream',
          },
        ],
        hasNext: true,
      },
      {
        hasNext: true,
        pending: [
          {
            id: '1',
            path: ['node', 'actors'],
            label:
              'RelayIncrementalDeliveryTestScenariosDeferredStreamFragment$stream$actors',
          },
        ],
        incremental: [
          {
            id: '0',
            data: {
              actors: [
                {
                  __typename: 'User',
                  name: 'Name a1',
                  id: 'a1',
                },
              ],
            },
          },
        ],
        completed: [
          {
            id: '0',
          },
        ],
      },
      {
        hasNext: true,
        incremental: [
          {
            id: '1',
            items: [
              {
                __typename: 'User',
                name: 'Name a2',
                id: 'a2',
              },
            ],
          },
        ],
      },
      {
        hasNext: true,
        incremental: [
          {
            id: '1',
            items: [
              {
                __typename: 'User',
                name: 'Name a3',
                id: 'a3',
              },
            ],
          },
        ],
      },
      {
        hasNext: false,
        completed: [
          {
            id: '1',
          },
        ],
      },
    ],
  },
  {
    name: 'a streamed list with no initial items',
    query: queries.streamFromZero,
    variables: {id: 'f1'},
    labelPath: [
      {
        data: {
          node: {
            __typename: 'Feedback',
            actors: [],
            id: 'f1',
          },
        },
        extensions: {
          is_final: false,
        },
      },
      {
        data: {
          __typename: 'User',
          name: 'Name a1',
          id: 'a1',
        },
        label:
          'RelayIncrementalDeliveryTestScenariosStreamFromZeroQuery$stream$actors',
        path: ['node', 'actors', 0],
      },
      {
        data: {
          __typename: 'User',
          name: 'Name a2',
          id: 'a2',
        },
        label:
          'RelayIncrementalDeliveryTestScenariosStreamFromZeroQuery$stream$actors',
        path: ['node', 'actors', 1],
      },
      {
        data: {
          __typename: 'User',
          name: 'Name a3',
          id: 'a3',
        },
        label:
          'RelayIncrementalDeliveryTestScenariosStreamFromZeroQuery$stream$actors',
        path: ['node', 'actors', 2],
      },
      {
        data: null,
        extensions: {
          is_final: true,
        },
      },
    ],
    incremental: [
      {
        data: {
          node: {
            __typename: 'Feedback',
            actors: [],
            id: 'f1',
          },
        },
        pending: [
          {
            id: '0',
            path: ['node', 'actors'],
            label:
              'RelayIncrementalDeliveryTestScenariosStreamFromZeroQuery$stream$actors',
          },
        ],
        hasNext: true,
      },
      {
        hasNext: true,
        incremental: [
          {
            id: '0',
            items: [
              {
                __typename: 'User',
                name: 'Name a1',
                id: 'a1',
              },
            ],
          },
        ],
      },
      {
        hasNext: true,
        incremental: [
          {
            id: '0',
            items: [
              {
                __typename: 'User',
                name: 'Name a2',
                id: 'a2',
              },
            ],
          },
        ],
      },
      {
        hasNext: true,
        incremental: [
          {
            id: '0',
            items: [
              {
                __typename: 'User',
                name: 'Name a3',
                id: 'a3',
              },
            ],
          },
        ],
      },
      {
        hasNext: false,
        completed: [
          {
            id: '0',
          },
        ],
      },
    ],
  },
  {
    name: 'a field error inside a streamed item',
    query: queries.streamItemError,
    variables: {id: 'f3'},
    labelPath: [
      {
        data: {
          node: {
            __typename: 'Feedback',
            actors: [
              {
                __typename: 'User',
                name: 'Name a1',
                alternate_name: 'Alternate a1',
                id: 'a1',
              },
            ],
            id: 'f3',
          },
        },
        extensions: {
          is_final: false,
        },
      },
      {
        data: {
          __typename: 'User',
          name: 'Name a2',
          alternate_name: null,
          id: 'a2',
        },
        label:
          'RelayIncrementalDeliveryTestScenariosStreamItemErrorQuery$stream$actors',
        path: ['node', 'actors', 1],
        errors: [
          {
            message: 'alternate_name failed',
            locations: [
              {
                line: 11,
                column: 11,
              },
            ],
            path: ['alternate_name'],
          },
        ],
      },
      {
        data: {
          __typename: 'User',
          name: 'Name a3',
          alternate_name: 'Alternate a3',
          id: 'a3',
        },
        label:
          'RelayIncrementalDeliveryTestScenariosStreamItemErrorQuery$stream$actors',
        path: ['node', 'actors', 2],
        extensions: {
          is_final: true,
        },
      },
    ],
    incremental: [
      {
        data: {
          node: {
            __typename: 'Feedback',
            actors: [
              {
                __typename: 'User',
                name: 'Name a1',
                alternate_name: 'Alternate a1',
                id: 'a1',
              },
            ],
            id: 'f3',
          },
        },
        pending: [
          {
            id: '0',
            path: ['node', 'actors'],
            label:
              'RelayIncrementalDeliveryTestScenariosStreamItemErrorQuery$stream$actors',
          },
        ],
        hasNext: true,
      },
      {
        hasNext: true,
        incremental: [
          {
            id: '0',
            items: [
              {
                __typename: 'User',
                name: 'Name a2',
                alternate_name: null,
                id: 'a2',
              },
            ],
            errors: [
              {
                message: 'alternate_name failed',
                locations: [
                  {
                    line: 11,
                    column: 11,
                  },
                ],
                path: ['node', 'actors', 1, 'alternate_name'],
              },
            ],
          },
        ],
      },
      {
        hasNext: false,
        incremental: [
          {
            id: '0',
            items: [
              {
                __typename: 'User',
                name: 'Name a3',
                alternate_name: 'Alternate a3',
                id: 'a3',
              },
            ],
          },
        ],
        completed: [
          {
            id: '0',
          },
        ],
      },
    ],
  },
  {
    name: 'a deferred fragment overlapping each list item (subPath through an index)',
    query: queries.listSubPath,
    variables: {id: 'f1'},
    labelPath: [
      {
        data: {
          node: {
            __typename: 'Feedback',
            actors: [
              {
                __typename: 'User',
                id: 'a1',
              },
              {
                __typename: 'User',
                id: 'a2',
              },
              {
                __typename: 'User',
                id: 'a3',
              },
            ],
            id: 'f1',
          },
        },
        extensions: {
          is_final: false,
        },
      },
      {
        data: {
          actors: [
            {
              __typename: 'User',
              name: 'Name a1',
              id: 'a1',
            },
            {
              __typename: 'User',
              name: 'Name a2',
              id: 'a2',
            },
            {
              __typename: 'User',
              name: 'Name a3',
              id: 'a3',
            },
          ],
        },
        label:
          'RelayIncrementalDeliveryTestScenariosListSubPathQuery$defer$ActorNames',
        path: ['node'],
        extensions: {
          is_final: true,
        },
      },
    ],
    incremental: [
      {
        data: {
          node: {
            __typename: 'Feedback',
            actors: [
              {
                __typename: 'User',
                id: 'a1',
              },
              {
                __typename: 'User',
                id: 'a2',
              },
              {
                __typename: 'User',
                id: 'a3',
              },
            ],
            id: 'f1',
          },
        },
        pending: [
          {
            id: '0',
            path: ['node'],
            label:
              'RelayIncrementalDeliveryTestScenariosListSubPathQuery$defer$ActorNames',
          },
        ],
        hasNext: true,
      },
      {
        hasNext: false,
        incremental: [
          {
            id: '0',
            data: {
              name: 'Name a1',
            },
            subPath: ['actors', 0],
          },
          {
            id: '0',
            data: {
              name: 'Name a2',
            },
            subPath: ['actors', 1],
          },
          {
            id: '0',
            data: {
              name: 'Name a3',
            },
            subPath: ['actors', 2],
          },
        ],
        completed: [
          {
            id: '0',
          },
        ],
      },
    ],
  },
  {
    name: 'a streamed connection (@stream_connection)',
    query: queries.streamedConnection,
    variables: {},
    labelPath: [
      {
        data: {
          viewer: {
            newsFeed: {
              edges: [
                {
                  cursor: 'cursor:s1',
                  node: {
                    __typename: 'Story',
                    id: 's1',
                  },
                },
              ],
            },
          },
        },
        extensions: {
          is_final: false,
        },
      },
      {
        data: {
          pageInfo: {
            endCursor: 'cursor:s3',
            hasNextPage: true,
          },
        },
        label:
          'RelayIncrementalDeliveryTestScenariosStreamedConnectionQuery$defer$RelayIncrementalDeliveryTestScenarios_newsFeed$pageInfo',
        path: ['viewer', 'newsFeed'],
      },
      {
        data: {
          cursor: 'cursor:s2',
          node: {
            __typename: 'Story',
            id: 's2',
          },
        },
        label:
          'RelayIncrementalDeliveryTestScenariosStreamedConnectionQuery$stream$RelayIncrementalDeliveryTestScenarios_newsFeed',
        path: ['viewer', 'newsFeed', 'edges', 1],
      },
      {
        data: {
          cursor: 'cursor:s3',
          node: {
            __typename: 'Story',
            id: 's3',
          },
        },
        label:
          'RelayIncrementalDeliveryTestScenariosStreamedConnectionQuery$stream$RelayIncrementalDeliveryTestScenarios_newsFeed',
        path: ['viewer', 'newsFeed', 'edges', 2],
      },
      {
        data: null,
        extensions: {
          is_final: true,
        },
      },
    ],
    incremental: [
      {
        data: {
          viewer: {
            newsFeed: {
              edges: [
                {
                  cursor: 'cursor:s1',
                  node: {
                    __typename: 'Story',
                    id: 's1',
                  },
                },
              ],
            },
          },
        },
        pending: [
          {
            id: '0',
            path: ['viewer', 'newsFeed'],
            label:
              'RelayIncrementalDeliveryTestScenariosStreamedConnectionQuery$defer$RelayIncrementalDeliveryTestScenarios_newsFeed$pageInfo',
          },
          {
            id: '1',
            path: ['viewer', 'newsFeed', 'edges'],
            label:
              'RelayIncrementalDeliveryTestScenariosStreamedConnectionQuery$stream$RelayIncrementalDeliveryTestScenarios_newsFeed',
          },
        ],
        hasNext: true,
      },
      {
        hasNext: true,
        incremental: [
          {
            id: '0',
            data: {
              pageInfo: {
                endCursor: 'cursor:s3',
                hasNextPage: true,
              },
            },
          },
        ],
        completed: [
          {
            id: '0',
          },
        ],
      },
      {
        hasNext: true,
        incremental: [
          {
            id: '1',
            items: [
              {
                cursor: 'cursor:s2',
                node: {
                  __typename: 'Story',
                  id: 's2',
                },
              },
            ],
          },
        ],
      },
      {
        hasNext: true,
        incremental: [
          {
            id: '1',
            items: [
              {
                cursor: 'cursor:s3',
                node: {
                  __typename: 'Story',
                  id: 's3',
                },
              },
            ],
          },
        ],
      },
      {
        hasNext: false,
        completed: [
          {
            id: '1',
          },
        ],
      },
    ],
  },
  {
    name: 'a deferred fragment on an interface the initial payload already matched',
    query: queries.abstractMarker,
    variables: {id: 'f1'},
    labelPath: [
      {
        data: {
          node: {
            __typename: 'Feedback',
            actors: [
              {
                __typename: 'User',
                __isActor: 'User',
                name: 'Name a1',
                id: 'a1',
              },
              {
                __typename: 'User',
                __isActor: 'User',
                name: 'Name a2',
                id: 'a2',
              },
              {
                __typename: 'User',
                __isActor: 'User',
                name: 'Name a3',
                id: 'a3',
              },
            ],
            id: 'f1',
          },
        },
        extensions: {
          is_final: false,
        },
      },
      {
        data: {
          __isActor: 'User',
          name: 'Name a1',
          lastName: 'Last a1',
        },
        label:
          'RelayIncrementalDeliveryTestScenariosAbstractMarkerQuery$defer$ActorDetails',
        path: ['node', 'actors', 0],
      },
      {
        data: {
          __isActor: 'User',
          name: 'Name a2',
          lastName: 'Last a2',
        },
        label:
          'RelayIncrementalDeliveryTestScenariosAbstractMarkerQuery$defer$ActorDetails',
        path: ['node', 'actors', 1],
      },
      {
        data: {
          __isActor: 'User',
          name: 'Name a3',
          lastName: 'Last a3',
        },
        label:
          'RelayIncrementalDeliveryTestScenariosAbstractMarkerQuery$defer$ActorDetails',
        path: ['node', 'actors', 2],
        extensions: {
          is_final: true,
        },
      },
    ],
    incremental: [
      {
        data: {
          node: {
            __typename: 'Feedback',
            actors: [
              {
                __typename: 'User',
                __isActor: 'User',
                name: 'Name a1',
                id: 'a1',
              },
              {
                __typename: 'User',
                __isActor: 'User',
                name: 'Name a2',
                id: 'a2',
              },
              {
                __typename: 'User',
                __isActor: 'User',
                name: 'Name a3',
                id: 'a3',
              },
            ],
            id: 'f1',
          },
        },
        pending: [
          {
            id: '0',
            path: ['node', 'actors', 0],
            label:
              'RelayIncrementalDeliveryTestScenariosAbstractMarkerQuery$defer$ActorDetails',
          },
          {
            id: '1',
            path: ['node', 'actors', 1],
            label:
              'RelayIncrementalDeliveryTestScenariosAbstractMarkerQuery$defer$ActorDetails',
          },
          {
            id: '2',
            path: ['node', 'actors', 2],
            label:
              'RelayIncrementalDeliveryTestScenariosAbstractMarkerQuery$defer$ActorDetails',
          },
        ],
        hasNext: true,
      },
      {
        hasNext: true,
        incremental: [
          {
            id: '0',
            data: {
              lastName: 'Last a1',
            },
          },
        ],
        completed: [
          {
            id: '0',
          },
        ],
      },
      {
        hasNext: true,
        incremental: [
          {
            id: '1',
            data: {
              lastName: 'Last a2',
            },
          },
        ],
        completed: [
          {
            id: '1',
          },
        ],
      },
      {
        hasNext: false,
        incremental: [
          {
            id: '2',
            data: {
              lastName: 'Last a3',
            },
          },
        ],
        completed: [
          {
            id: '2',
          },
        ],
      },
    ],
  },
  {
    name: 'a deferred fragment the initial payload covers entirely, with a fragment deferred inside',
    query: queries.coveredNested,
    variables: {id: '1'},
    labelPath: [
      {
        data: {
          node: {
            __typename: 'User',
            name: 'Name 1',
            id: '1',
          },
        },
        extensions: {
          is_final: false,
        },
      },
      {
        data: {
          name: 'Name 1',
        },
        label:
          'RelayIncrementalDeliveryTestScenariosCoveredNestedQuery$defer$Outer',
        path: ['node'],
      },
      {
        data: {
          alternate_name: 'Alternate 1',
        },
        label: 'RelayIncrementalDeliveryTestScenariosOuterFragment$defer$Inner',
        path: ['node'],
        extensions: {
          is_final: true,
        },
      },
    ],
    incremental: [
      {
        data: {
          node: {
            __typename: 'User',
            name: 'Name 1',
            id: '1',
          },
        },
        pending: [
          {
            id: '0',
            path: ['node'],
            label:
              'RelayIncrementalDeliveryTestScenariosOuterFragment$defer$Inner',
          },
        ],
        hasNext: true,
      },
      {
        hasNext: false,
        incremental: [
          {
            id: '0',
            data: {
              alternate_name: 'Alternate 1',
            },
          },
        ],
        completed: [
          {
            id: '0',
          },
        ],
      },
    ],
  },
  {
    name: 'a deferred fragment the initial payload covers entirely, with a field error, and a fragment deferred inside',
    query: queries.coveredNested,
    variables: {id: '3'},
    labelPath: [
      {
        errors: [
          {
            message: 'name failed',
            locations: [
              {
                line: 7,
                column: 7,
              },
            ],
            path: ['node', 'name'],
          },
        ],
        data: {
          node: {
            __typename: 'User',
            name: null,
            id: '3',
          },
        },
        extensions: {
          is_final: false,
        },
      },
      {
        data: {
          name: null,
        },
        label:
          'RelayIncrementalDeliveryTestScenariosCoveredNestedQuery$defer$Outer',
        path: ['node'],
        errors: [
          {
            message: 'name failed',
            locations: [
              {
                line: 19,
                column: 3,
              },
            ],
            path: ['name'],
          },
        ],
      },
      {
        data: {
          alternate_name: 'Alternate 3',
        },
        label: 'RelayIncrementalDeliveryTestScenariosOuterFragment$defer$Inner',
        path: ['node'],
        extensions: {
          is_final: true,
        },
      },
    ],
    incremental: [
      {
        errors: [
          {
            message: 'name failed',
            locations: [
              {
                line: 7,
                column: 7,
              },
              {
                line: 19,
                column: 3,
              },
            ],
            path: ['node', 'name'],
          },
        ],
        data: {
          node: {
            __typename: 'User',
            name: null,
            id: '3',
          },
        },
        pending: [
          {
            id: '0',
            path: ['node'],
            label:
              'RelayIncrementalDeliveryTestScenariosOuterFragment$defer$Inner',
          },
        ],
        hasNext: true,
      },
      {
        hasNext: false,
        incremental: [
          {
            id: '0',
            data: {
              alternate_name: 'Alternate 3',
            },
          },
        ],
        completed: [
          {
            id: '0',
          },
        ],
      },
    ],
  },
];

export type Outcome = {
  // The store, and whether the request is active, after each response.
  steps: Array<{records: unknown, active: boolean}>,
  error: ?string,
  completed: boolean,
};

/**
 * Runs `scenario` through an environment whose fetch function `createFetch`
 * builds around the server, which sends `responses` one at a time.
 */
function runScenario<TResponse>(
  {query, variables}: Scenario,
  responses: ReadonlyArray<TResponse>,
  createFetch: (server: (sink: Sink<TResponse>) => void) => FetchFunction,
): Outcome {
  let server: ?Sink<TResponse> = null;
  const store = new RelayModernStore(RelayRecordSource.create());
  const environment = new RelayModernEnvironment({
    network: RelayNetwork.create(
      createFetch(sink => {
        server = sink;
      }),
    ),
    store,
  });
  const operation = createOperationDescriptor(getRequest(query), variables);
  const outcome: Outcome = {completed: false, error: null, steps: []};
  environment.execute({operation}).subscribe({
    complete: () => {
      outcome.completed = true;
    },
    error: (error: Error) => {
      outcome.error = error.message;
    },
  });
  for (const response of responses) {
    const sink = server;
    if (sink == null) {
      throw new Error('The request was not sent.');
    }
    sink.next(response);
    jest.runAllTimers();
    outcome.steps.push({
      active: environment.isRequestActive(operation.request.identifier),
      records: store.getSource().toJSON(),
    });
  }
  server?.complete();
  return outcome;
}

module.exports = {runScenario, scenarios};
