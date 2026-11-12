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

import type {RelayHandoff} from '../RelayHandoff';
import type {useRelayHandoffTestActors_user$key} from './__generated__/useRelayHandoffTestActors_user.graphql';
import type {IEnvironment} from 'relay-runtime';
import type {
  GraphQLResponse,
  GraphQLSingularResponse,
} from 'relay-runtime/network/RelayNetworkTypes';
import type {Sink} from 'relay-runtime/network/RelayObservable';
import type {EnvironmentConfig} from 'relay-runtime/store/RelayModernEnvironment';

const {getRelayHandoff} = require('../RelayHandoff');
const serverQuery = require('../serverQuery');
const ActorsBQuery = require('./__generated__/useRelayHandoffTestActorsBQuery.graphql');
const ActorsQuery = require('./__generated__/useRelayHandoffTestActorsQuery.graphql');
const {
  Network,
  Observable,
  RecordSource,
  Store,
  graphql,
} = require('relay-runtime');

// Two queries that hand off `me.actors` and each select a field the other
// does not, so that neither reads the other's data from the Store.
const TwinQuery = graphql`
  query RelayHandoffTestOverlappingQueriesTwinQuery @server {
    me {
      lastName
      ...useRelayHandoffTestActors_user @alias(as: "actors")
    }
  }
`;

const SecondQuery = graphql`
  query RelayHandoffTestOverlappingQueriesSecondQuery @server {
    me {
      name
      ...useRelayHandoffTestActors_user @alias(as: "actors")
    }
  }
`;

type Actor = {readonly __typename: 'User', readonly id: string, name: string};

const ADA: Actor = {__typename: 'User', id: 'a1', name: 'Ada'};
const GRACE: Actor = {__typename: 'User', id: 'a2', name: 'Grace'};
const LINUS: Actor = {__typename: 'User', id: 'a3', name: 'Linus'};
const MARGARET: Actor = {__typename: 'User', id: 'a4', name: 'Margaret'};

// The first payload of a query that selects `me.actors` with `@stream`.
function actorsPayload(actors: ReadonlyArray<Actor>): GraphQLSingularResponse {
  return {
    data: {
      me: {
        __typename: 'User',
        actors,
        id: '4',
        lastName: 'Zuckerberg',
        name: 'Mark',
      },
    },
    extensions: {is_final: false},
  };
}

// A streamed item of `me.actors`.
function actorItem(index: number, actor: Actor): GraphQLSingularResponse {
  return {
    data: actor,
    label: 'useRelayHandoffTestActors_user$stream$actors',
    path: ['me', 'actors', index],
  };
}

export type ActorsQueryHandle = {
  readonly next: (response: GraphQLResponse) => void,
  readonly complete: () => void,
  readonly actors: () => Promise<useRelayHandoffTestActors_user$key>,
};

export type ActorsServer = {
  readonly start: (query: 'A' | 'B' | 'twin' | 'second') => ActorsQueryHandle,
};

// A request's server Environment, whose server queries each hand off
// `me.actors`. `A` and `B` select only that; a query whose data the Store
// already has reads it from there.
function createActorsServer(
  createEnvironment: (config: EnvironmentConfig) => IEnvironment,
): ActorsServer {
  const sinks: Array<Sink<GraphQLResponse>> = [];
  const server = createEnvironment({
    isServer: true,
    network: Network.create(() =>
      Observable.create((sink: Sink<GraphQLResponse>) => {
        sinks.push(sink);
      }),
    ),
    store: new Store(new RecordSource()),
  });
  return {
    start: query => {
      const index = sinks.length;
      const handle = (
        result: Promise<{
          readonly me: ?{
            readonly actors: useRelayHandoffTestActors_user$key,
            ...
          },
          ...
        }>,
      ): ActorsQueryHandle => ({
        actors: async () => {
          const actors = (await result).me?.actors;
          if (actors == null) {
            throw new Error('Expected a handed-off reference.');
          }
          return actors;
        },
        next: response => {
          const sink = sinks[index];
          if (sink == null) {
            throw new Error('Expected the query to have started.');
          }
          sink.next(response);
        },
        complete: () => sinks[index]?.complete(),
      });
      switch (query) {
        case 'A':
          return handle(serverQuery(server, ActorsQuery, {}));
        case 'B':
          return handle(serverQuery(server, ActorsBQuery, {}));
        case 'twin':
          return handle(serverQuery(server, TwinQuery, {}));
        case 'second':
          return handle(serverQuery(server, SecondQuery, {}));
      }
    },
  };
}

/**
 * Two server queries of one request hand off `me.actors`, and their timings
 * overlap, so one root's handoff carries a value of the list older than one
 * the other's carries. The server ends with Ada, Grace and Linus.
 *
 * - `truncated`: the twin streams Grace; then the second query's first
 *   payload (Ada only) replaces the list while the twin's stream is still
 *   open, so the twin's next chunk carries the list cut back to Ada. The
 *   second query then streams Grace and Linus.
 * - `snapshot`: the twin streams Grace before the second query's data is
 *   handed off, so the second root starts with Ada and Grace while the twin's
 *   started with Ada only. Both then stream Linus.
 * - `batched`: both roots have sent Ada, Grace and Linus. Then, in one
 *   synchronous tick, the twin query's new first payload cuts the list back
 *   to Ada (the twin's root sends it), and a batch of the second query
 *   restores the list and streams Margaret: the second root sends only
 *   Margaret, appended to the list it sent. The twin's root then sends Grace,
 *   Linus and Margaret appended to Ada. The server ends with all four. The
 *   tick runs when `finish` is called (at once if `finishLater` is false).
 */
async function serveOverlappingActors(
  {start}: ActorsServer,
  timing: 'truncated' | 'snapshot' | 'batched',
  finishLater: boolean = false,
): Promise<{
  finish: () => void,
  second: useRelayHandoffTestActors_user$key,
  twin: useRelayHandoffTestActors_user$key,
}> {
  let finish = () => {};
  const twinQuery = start('twin');
  twinQuery.next(actorsPayload([ADA]));
  const twin = await twinQuery.actors();
  let second;
  if (timing === 'batched') {
    twinQuery.next(actorItem(1, GRACE));
    twinQuery.next(actorItem(2, LINUS));
    await settle();
    const secondQuery = start('second');
    secondQuery.next(actorsPayload([ADA, GRACE, LINUS]));
    second = await secondQuery.actors();
    await settle();
    finish = () => {
      twinQuery.next(actorsPayload([ADA]));
      secondQuery.next([
        actorsPayload([ADA, GRACE, LINUS]),
        actorItem(3, MARGARET),
      ]);
      twinQuery.complete();
      secondQuery.complete();
    };
    if (!finishLater) {
      finish();
    }
  } else if (timing === 'truncated') {
    twinQuery.next(actorItem(1, GRACE));
    const secondQuery = start('second');
    secondQuery.next(actorsPayload([ADA]));
    second = await secondQuery.actors();
    twinQuery.complete();
    secondQuery.next(actorItem(1, GRACE));
    secondQuery.next(actorItem(2, LINUS));
    secondQuery.complete();
  } else {
    const secondQuery = start('second');
    secondQuery.next(actorsPayload([ADA]));
    twinQuery.next(actorItem(1, GRACE));
    second = await secondQuery.actors();
    twinQuery.next(actorItem(2, LINUS));
    twinQuery.complete();
    secondQuery.next(actorItem(1, GRACE));
    secondQuery.next(actorItem(2, LINUS));
    secondQuery.complete();
  }
  return {finish, second, twin};
}

// Lets the Store's notifications and the handoffs' syncs run.
async function settle(): Promise<void> {
  for (let ii = 0; ii < 10; ii++) {
    await Promise.resolve();
  }
}

// The values of `me.actors` a handoff and its chunks carry, in order.
async function handedOffActors(
  ref: useRelayHandoffTestActors_user$key,
): Promise<Array<unknown>> {
  const handoff: ?RelayHandoff = getRelayHandoff(ref);
  if (handoff == null) {
    throw new Error('Expected a handoff.');
  }
  const values: Array<unknown> = [handoff.records['4']?.actors];
  let chunk = await handoff.next;
  while (chunk != null) {
    const value = chunk.records['4']?.actors;
    if (value !== undefined) {
      values.push(value);
    }
    chunk = await chunk.next;
  }
  return values;
}

module.exports = {
  ADA,
  GRACE,
  LINUS,
  MARGARET,
  actorItem,
  actorsPayload,
  createActorsServer,
  handedOffActors,
  serveOverlappingActors,
};
