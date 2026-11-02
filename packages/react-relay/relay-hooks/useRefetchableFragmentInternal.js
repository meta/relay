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

import type {LoaderFn} from './useQueryLoader';
import type {
  CacheConfig,
  ConcreteRequest,
  Disposable,
  FetchPolicy,
  IEnvironment,
  OperationDescriptor,
  OperationType,
  ReaderFragment,
  RefetchableIdentifierInfo,
  RenderPolicy,
  Variables,
  VariablesOf,
} from 'relay-runtime';

const getFragmentInternalData = require('./getFragmentInternalData');
const ProfilerContext = require('./ProfilerContext');
const {getQueryResourceForEnvironment} = require('./QueryResource');
const readFragmentInternal = require('./readFragmentInternal');
const useFragmentInternal = require('./useFragmentInternal');
const useIsMountedRef = require('./useIsMountedRef');
const useQueryLoader = require('./useQueryLoader');
const useRelayEnvironment = require('./useRelayEnvironment');
const invariant = require('invariant');
const {useCallback, useContext, useReducer} = require('react');
const {
  __internal: {fetchQuery},
  createOperationDescriptor,
  getFragmentIdentifier,
  getRefetchMetadata,
  getSelector,
  getValueAtPath,
} = require('relay-runtime');
const warning = require('warning');

export type RefetchFn<
  TQuery extends OperationType,
  TOptions = Options,
> = RefetchFnExact<TQuery, TOptions>;

// NOTE: RefetchFnDynamic returns a refetch function that:
//  - Expects the /exact/ set of query variables if the provided key type is
//    /nullable/.
//  - Or, expects /a subset/ of the query variables if the provided key type is
//    /non-null/.
export type RefetchFnDynamic<
  TQuery extends OperationType,
  TKey extends ?{readonly $data?: unknown, ...},
  TOptions = Options,
> = [TKey] extends [{readonly $data?: unknown, ...}]
  ? RefetchFnInexact<TQuery, TOptions>
  : RefetchFnExact<TQuery, TOptions>;

export type ReturnType<
  TQuery extends OperationType,
  TKey extends ?{readonly $data?: unknown, ...},
  TOptions = Options,
> = {
  fragmentData: unknown,
  fragmentRef: unknown,
  refetch: RefetchFnDynamic<TQuery, TKey, TOptions>,
};

export type Options = {
  fetchPolicy?: FetchPolicy,
  networkCacheConfig?: CacheConfig,
  onComplete?: (Error | null) => void,
  UNSTABLE_renderPolicy?: RenderPolicy,
};

type InternalOptions = {
  ...Options,
  __environment?: IEnvironment,
};

type RefetchFnBase<TVars, TOptions> = (
  vars: TVars,
  options?: TOptions,
) => Disposable;

type RefetchFnExact<
  TQuery extends OperationType,
  TOptions = Options,
> = RefetchFnBase<VariablesOf<TQuery>, TOptions>;
type RefetchFnInexact<
  TQuery extends OperationType,
  TOptions = Options,
> = RefetchFnBase<Readonly<Partial<VariablesOf<TQuery>>>, TOptions>;

type Action =
  | {
      type: 'reset',
      environment: IEnvironment,
      fragmentIdentifier: string,
    }
  | {
      type: 'refetch',
      refetchQuery: OperationDescriptor,
      fetchPolicy?: FetchPolicy,
      renderPolicy?: RenderPolicy,
      onComplete?: (Error | null) => void,
      refetchEnvironment: ?IEnvironment,
    };

type RefetchState = {
  fetchPolicy: FetchPolicy | void,
  mirroredEnvironment: IEnvironment,
  mirroredFragmentIdentifier: string,
  onComplete: ((Error | null) => void) | void,
  refetchEnvironment?: ?IEnvironment,
  refetchQuery: OperationDescriptor | null,
  renderPolicy: RenderPolicy | void,
};

type DebugIDandTypename = {
  id: string,
  typename: string,
  ...
};

function reducer(state: RefetchState, action: Action): RefetchState {
  switch (action.type) {
    case 'refetch': {
      return {
        ...state,
        fetchPolicy: action.fetchPolicy,
        mirroredEnvironment:
          action.refetchEnvironment ?? state.mirroredEnvironment,
        onComplete: action.onComplete,
        refetchEnvironment: action.refetchEnvironment,
        refetchQuery: action.refetchQuery,
        renderPolicy: action.renderPolicy,
      };
    }
    case 'reset': {
      return {
        fetchPolicy: undefined,
        mirroredEnvironment: action.environment,
        mirroredFragmentIdentifier: action.fragmentIdentifier,
        onComplete: undefined,
        refetchQuery: null,
        renderPolicy: undefined,
      };
    }
    default: {
      action.type as empty;
      throw new Error('useRefetchableFragmentNode: Unexpected action type');
    }
  }
}

hook useRefetchableFragmentInternal<
  TQuery extends OperationType,
  TKey extends ?{readonly $data?: unknown, ...},
>(
  fragmentNode: ReaderFragment,
  parentFragmentRef: unknown,
  componentDisplayName: string,
): ReturnType<TQuery, TKey, InternalOptions> {
  const parentEnvironment = useRelayEnvironment();
  const {refetchableRequest, fragmentRefPathInResponse, identifierInfo} =
    getRefetchMetadata(fragmentNode, componentDisplayName);
  const fragmentIdentifier = getFragmentIdentifier(
    fragmentNode,
    parentFragmentRef,
  );

  const [refetchState, dispatch] = useReducer(reducer, {
    fetchPolicy: undefined,
    mirroredEnvironment: parentEnvironment,
    mirroredFragmentIdentifier: fragmentIdentifier,
    onComplete: undefined,
    refetchEnvironment: null,
    refetchQuery: null,
    renderPolicy: undefined,
  } as RefetchState);
  const {
    fetchPolicy,
    mirroredEnvironment,
    mirroredFragmentIdentifier,
    onComplete,
    refetchEnvironment,
    refetchQuery,
    renderPolicy,
  } = refetchState;
  const environment = refetchEnvironment ?? parentEnvironment;

  const QueryResource = getQueryResourceForEnvironment(environment);
  const profilerContext = useContext(ProfilerContext);

  const shouldReset =
    environment !== mirroredEnvironment ||
    fragmentIdentifier !== mirroredFragmentIdentifier;
  const [queryRef, loadQuery, disposeQuery] = useQueryLoader<
    TQuery['variables'],
    TQuery['response'],
    TQuery['rawResponse'],
  >(refetchableRequest as $FlowFixMe);

  let fragmentRef = parentFragmentRef;
  if (shouldReset) {
    dispatch({
      environment,
      fragmentIdentifier,
      type: 'reset',
    });
    disposeQuery();
  } else if (refetchQuery != null && queryRef != null) {
    // If refetch was called, we expect to have a refetchQuery and queryRef
    // in state, since both state updates to set the refetchQuery and the
    // queryRef occur simultaneously.
    // In this case, we need to read the refetched query data (potentially
    // suspending if it's in flight), and extract the new fragment ref
    // from the query in order read the current @refetchable fragment
    // with the updated fragment owner as the new refetchQuery.

    // Before observing the refetch, record the current ID and typename
    // so that, if we are refetching existing data on
    // a field that implements Node, after refetching we
    // can validate that the received data is consistent
    let debugPreviousIDAndTypename: ?DebugIDandTypename;
    if (__DEV__) {
      debugPreviousIDAndTypename = debugFunctions.getInitialIDAndType(
        refetchQuery.request.variables,
        fragmentRefPathInResponse,
        identifierInfo?.identifierQueryVariableName,
        environment,
      );
    }

    const handleQueryCompleted = (maybeError: void | Error) => {
      onComplete && onComplete(maybeError ?? null);
    };

    // The queryRef.source obtained from useQueryLoader will be
    // an observable we can consume /if/ a network request was
    // started. Otherwise, given that QueryResource.prepare
    // always expects an observable we fall back to a new network
    // observable. Note however that if loadQuery did not make a network
    // request, we don't expect to make one here, unless the state of
    // the cache has changed between the call to refetch and this
    // render.
    const fetchObservable =
      queryRef.source != null
        ? queryRef.source
        : fetchQuery(environment, refetchQuery);

    // Now wwe can we read the refetch query here using the
    // queryRef provided from useQueryLoader. Note that the
    // network request is started during the call to refetch,
    // but if the refetch query is still in flight, we will suspend
    // at this point:
    const queryResult = profilerContext.wrapPrepareQueryResource(() => {
      return QueryResource.prepare(
        refetchQuery,
        fetchObservable,
        fetchPolicy,
        renderPolicy,
        {
          complete: () => {
            // Validate that the type of the object we got back matches the type
            // of the object already in the store
            if (__DEV__) {
              debugFunctions.checkSameTypeAfterRefetch(
                debugPreviousIDAndTypename,
                environment,
                fragmentNode,
                componentDisplayName,
              );
            }
            handleQueryCompleted();
          },
          error: handleQueryCompleted,
        },
        queryRef.fetchKey,
        profilerContext,
      );
    });

    const queryData = readFragmentInternal(
      environment,
      queryResult.fragmentNode,
      queryResult.fragmentRef,
      componentDisplayName,
    ).data;
    invariant(
      queryData != null,
      'Relay: Expected to be able to read refetch query response. ' +
        "If you're seeing this, this is likely a bug in Relay.",
    );

    // After reading/fetching the refetch query, we extract from the
    // refetch query response the new fragment ref we need to use to read
    // the fragment. The new fragment ref will point to the refetch query
    // as its fragment owner.
    const refetchedFragmentRef = getValueAtPath(
      queryData,
      fragmentRefPathInResponse,
    );
    fragmentRef = refetchedFragmentRef;

    if (__DEV__) {
      // Validate that the id of the object we got back matches the id
      // we queried for in the variables.
      // We do this during render instead of onComplete to make sure we are
      // only validating the most recent refetch.
      debugFunctions.checkSameIDAfterRefetch(
        debugPreviousIDAndTypename,
        fragmentRef,
        fragmentNode,
        componentDisplayName,
      );
    }
  }

  // We read and subscribe to the fragment using useFragmentNode.
  // If refetch was called, we read the fragment using the new computed
  // fragment ref from the refetch query response; otherwise, we use the
  // fragment ref passed by the caller as normal.
  const fragmentData = useFragmentInternal(
    fragmentNode,
    fragmentRef,
    componentDisplayName,
  );

  const refetch = useRefetchFunction<TQuery>(
    componentDisplayName,
    dispatch,
    disposeQuery,
    fragmentData,
    fragmentIdentifier,
    fragmentNode,
    fragmentRefPathInResponse,
    identifierInfo,
    loadQuery,
    parentFragmentRef,
    refetchableRequest,
  );
  return {
    fragmentData,
    fragmentRef,
    // $FlowFixMe[incompatible-type] RefetchFn not compatible with RefetchFnDynamic
    refetch,
  };
}

hook useRefetchFunction<TQuery extends OperationType>(
  componentDisplayName: string,
  dispatch: (
    | {
        environment: IEnvironment,
        fragmentIdentifier: string,
        type: 'reset',
      }
    | {
        fetchPolicy?: FetchPolicy,
        onComplete?: (Error | null) => void,
        refetchEnvironment: ?IEnvironment,
        refetchQuery: OperationDescriptor,
        renderPolicy?: RenderPolicy,
        type: 'refetch',
      },
  ) => void,
  disposeQuery: () => void,
  fragmentData: unknown,
  fragmentIdentifier: string,
  fragmentNode: ReaderFragment,
  fragmentRefPathInResponse: ReadonlyArray<string | number>,
  identifierInfo: ?RefetchableIdentifierInfo,
  loadQuery: LoaderFn<TQuery>,
  parentFragmentRef: unknown,
  refetchableRequest: ConcreteRequest,
): RefetchFn<TQuery, InternalOptions> {
  const isMountedRef = useIsMountedRef();
  // When @catch wraps the fragment root in a Result envelope, look inside
  // .value for the identifier field.
  const internalFragmentData = getFragmentInternalData(
    fragmentNode,
    fragmentData,
  );
  const identifierValue =
    identifierInfo?.identifierField != null &&
    internalFragmentData != null &&
    typeof internalFragmentData === 'object'
      ? internalFragmentData[identifierInfo.identifierField]
      : null;
  return useCallback(
    (
      providedRefetchVariables: VariablesOf<TQuery>,
      options: void | InternalOptions,
    ) => {
      // Bail out and warn if we're trying to refetch after the component
      // has unmounted
      if (isMountedRef.current !== true) {
        warning(
          false,
          'Relay: Unexpected call to `refetch` on unmounted component for fragment ' +
            '`%s` in `%s`. It looks like some instances of your component are ' +
            'still trying to fetch data but they already unmounted. ' +
            'Please make sure you clear all timers, intervals, ' +
            'async calls, etc that may trigger a fetch.',
          fragmentNode.name,
          componentDisplayName,
        );
        return {dispose: () => {}};
      }
      if (parentFragmentRef == null) {
        warning(
          false,
          'Relay: Unexpected call to `refetch` while using a null fragment ref ' +
            'for fragment `%s` in `%s`. When calling `refetch`, we expect ' +
            "initial fragment data to be non-null. Please make sure you're " +
            'passing a valid fragment ref to `%s` before calling ' +
            '`refetch`, or make sure you pass all required variables to `refetch`.',
          fragmentNode.name,
          componentDisplayName,
          componentDisplayName,
        );
      }

      const refetchEnvironment = options?.__environment;
      const fetchPolicy = options?.fetchPolicy;
      const renderPolicy = options?.UNSTABLE_renderPolicy;
      const onComplete = options?.onComplete;
      const networkCacheConfig = {
        ...options?.networkCacheConfig,
        force: true,
      };
      const fragmentSelector = getSelector(fragmentNode, parentFragmentRef);
      let parentVariables: Variables;
      let fragmentVariables: Variables;
      if (fragmentSelector == null) {
        parentVariables = {};
        fragmentVariables = {};
      } else if (fragmentSelector.kind === 'PluralReaderSelector') {
        parentVariables = fragmentSelector.selectors[0]?.owner.variables ?? {};
        fragmentVariables = fragmentSelector.selectors[0]?.variables ?? {};
      } else {
        parentVariables = fragmentSelector.owner.variables;
        fragmentVariables = fragmentSelector.variables;
      }

      // A user of `useRefetchableFragment()` may pass a subset of
      // all variables required by the fragment when calling `refetch()`.
      // We fill in any variables not passed by the call to `refetch()` with the
      // variables from the original parent fragment owner.
      const refetchVariables: VariablesOf<TQuery> = {
        ...(parentVariables as $FlowFixMe),
        ...fragmentVariables,
        ...providedRefetchVariables,
      };

      // If the query needs an identifier value ('id' or similar) and one
      // was not explicitly provided, read it from the fragment data.
      if (
        identifierInfo != null &&
        !providedRefetchVariables.hasOwnProperty(
          identifierInfo.identifierQueryVariableName,
        )
      ) {
        // @refetchable fragments are guaranteed to have an `id` selection
        // if the type is Node, implements Node, or is @fetchable. Double-check
        // that there actually is a value at runtime.
        if (typeof identifierValue !== 'string') {
          warning(
            false,
            'Relay: Expected result to have a string  ' +
              '`%s` in order to refetch, got `%s`.',
            identifierInfo.identifierField,
            identifierValue,
          );
        }
        (refetchVariables as $FlowFixMe)[
          identifierInfo.identifierQueryVariableName
        ] = identifierValue;
      }

      const refetchQuery = createOperationDescriptor(
        refetchableRequest,
        refetchVariables,
        networkCacheConfig,
      );

      // We call loadQuery which will start a network request if necessary
      // and update the queryRef from useQueryLoader.
      // Note the following:
      // - loadQuery will dispose of any previously refetched queries.
      // - We use the variables extracted off the OperationDescriptor
      // so that they have been filtered out to include only the
      // variables actually declared in the query.
      loadQuery(refetchQuery.request.variables, {
        __environment: refetchEnvironment,
        __nameForWarning: 'refetch',
        fetchPolicy,
        networkCacheConfig,
      });

      dispatch({
        fetchPolicy,
        onComplete,
        refetchEnvironment,
        refetchQuery,
        renderPolicy,
        type: 'refetch',
      });
      return {dispose: disposeQuery};
    },
    // NOTE: We disable react-hooks-deps warning because:
    //   - We know fragmentRefPathInResponse is static, so it can be omitted from
    //     deps
    //   - We know fragmentNode is static, so it can be omitted from deps.
    //   - fragmentNode and parentFragmentRef are also captured by including
    //     fragmentIdentifier
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fragmentIdentifier, dispatch, disposeQuery, identifierValue, loadQuery],
  );
}

let debugFunctions;
if (__DEV__) {
  debugFunctions = {
    checkSameIDAfterRefetch(
      previousIDAndTypename: ?DebugIDandTypename,
      refetchedFragmentRef: unknown,
      fragmentNode: ReaderFragment,
      componentDisplayName: string,
    ): void {
      if (previousIDAndTypename == null || refetchedFragmentRef == null) {
        return;
      }
      const {ID_KEY} = require('relay-runtime');
      // $FlowExpectedError[incompatible-use]
      const resultID = refetchedFragmentRef[ID_KEY];
      if (resultID != null && resultID !== previousIDAndTypename.id) {
        warning(
          false,
          'Relay: Call to `refetch` returned a different id, expected ' +
            '`%s`, got `%s`, on `%s` in `%s`. ' +
            'Please make sure the server correctly implements ' +
            'unique id requirement.',
          resultID,
          previousIDAndTypename.id,
          fragmentNode.name,
          componentDisplayName,
        );
      }
    },
    checkSameTypeAfterRefetch(
      previousIDAndType: ?DebugIDandTypename,
      environment: IEnvironment,
      fragmentNode: ReaderFragment,
      componentDisplayName: string,
    ): void {
      const {Record} = require('relay-runtime');
      if (!previousIDAndType) {
        return;
      }
      const recordSource = environment.getStore().getSource();
      const record = recordSource.get(previousIDAndType.id);
      const typename = record && Record.getType(record);
      if (typename !== previousIDAndType.typename) {
        warning(
          false,
          'Relay: Call to `refetch` returned data with a different ' +
            '__typename: was `%s`, now `%s`, on `%s` in `%s`. ' +
            'Please make sure the server correctly implements' +
            'unique id requirement.',
          previousIDAndType.typename,
          typename,
          fragmentNode.name,
          componentDisplayName,
        );
      }
    },
    getInitialIDAndType(
      memoRefetchVariables: ?Variables,
      fragmentRefPathInResponse: ReadonlyArray<string | number>,
      identifierQueryVariableName: ?string,
      environment: IEnvironment,
    ): ?DebugIDandTypename {
      const {Record} = require('relay-runtime');
      const id = memoRefetchVariables?.[identifierQueryVariableName ?? 'id'];
      if (
        fragmentRefPathInResponse.length !== 1 ||
        fragmentRefPathInResponse[0] !== 'node' ||
        id == null
      ) {
        return null;
      }
      const recordSource = environment.getStore().getSource();
      const record = recordSource.get(id);
      const typename = record == null ? null : Record.getType(record);
      if (typename == null) {
        return null;
      }
      return {
        id,
        typename,
      };
    },
  };
}

module.exports = useRefetchableFragmentInternal;
