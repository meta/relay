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

import type {IEnvironment, PayloadError, Query, Variables} from 'relay-runtime';

const invariant = require('invariant');
const {createOperationDescriptor, getRequest} = require('relay-runtime');

export type PreloadedQueryResponse<TData> = {
  readonly data: TData,
  readonly errors?: ReadonlyArray<PayloadError>,
};

export type PreloadedQueryRef<TVariables, TData> = {
  readonly kind: 'PreloadedQueryRef',
  readonly queryId: string,
  readonly variables: TVariables,
  readonly _response: Promise<PreloadedQueryResponse<TData>>,
  readonly fetchedAt: number,
};

function serverPreloadQuery<TVariables extends Variables, TData>(
  environment: IEnvironment,
  query: Query<TVariables, TData>,
  variables: TVariables,
): PreloadedQueryRef<TVariables, TData> {
  const request = getRequest(query);
  const operationDescriptor = createOperationDescriptor(request, variables);

  const observable = environment.execute({operation: operationDescriptor});

  const queryId =
    request.params.id ?? request.params.cacheID ?? request.params.name;

  const response: Promise<PreloadedQueryResponse<TData>> = observable
    .toPromise()
    .then(rawResponse => {
      invariant(rawResponse != null, 'Unexpected null response from execute');
      // TODO: @defer returns batched responses; this only handles the first payload
      invariant(
        !Array.isArray(rawResponse),
        '@defer is not yet supported in serverPreloadQuery',
      );
      return {
        // $FlowFixMe[incompatible-type] PayloadData -> TData; shape validated by the Relay compiler
        data: rawResponse.data as TData,
        errors: rawResponse.errors,
      };
    });

  return {
    kind: 'PreloadedQueryRef',
    queryId,
    variables,
    _response: response,
    fetchedAt: Date.now(),
  };
}

module.exports = serverPreloadQuery;
