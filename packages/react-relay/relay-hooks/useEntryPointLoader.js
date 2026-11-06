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
  EntryPoint,
  EntryPointComponent,
  EnvironmentProviderOptions,
  IEnvironmentProvider,
  PreloadedEntryPoint,
  PreloadedQuery,
} from './EntryPointTypes.flow';

const loadEntryPoint = require('./loadEntryPoint');
const useIsMountedRef = require('./useIsMountedRef');
const {useCallback, useEffect, useRef, useState} = require('react');

type UseEntryPointLoaderHookReturnType<
  TEntryPointParams extends {...},
  TPreloadedQueries extends {...},
  TPreloadedEntryPoints extends {...},
  TRuntimeProps extends {...},
  TExtraProps,
  TEntryPointComponent extends EntryPointComponent<
    TPreloadedQueries,
    TPreloadedEntryPoints,
    TRuntimeProps,
    TExtraProps,
  >,
> = [
  ?PreloadedEntryPoint<TEntryPointComponent>,
  (params: TEntryPointParams) => void,
  () => void,
];

// NullEntryPointReference needs to implement referential equality,
// so that multiple NullEntryPointReferences can be in the same set
// (corresponding to multiple calls to disposeEntryPoint).
type NullEntryPointReference = {
  kind: 'NullEntryPointReference',
};
const initialNullEntryPointReferenceState: NullEntryPointReference = {
  kind: 'NullEntryPointReference',
};

hook useLoadEntryPoint<
  TEntryPointParams extends {...},
  // $FlowExpectedError[unclear-type] Need any to make it supertype of all PreloadedQuery
  TPreloadedQueries extends {readonly [key: string]: PreloadedQuery<any>},
  TPreloadedEntryPoints extends {...},
  TRuntimeProps extends {...},
  TExtraProps,
  TEntryPointComponent extends EntryPointComponent<
    TPreloadedQueries,
    TPreloadedEntryPoints,
    TRuntimeProps,
    TExtraProps,
  >,
  TEntryPoint extends EntryPoint<TEntryPointParams, TEntryPointComponent>,
>(
  environmentProvider: IEnvironmentProvider<EnvironmentProviderOptions>,
  entryPoint: TEntryPoint,
  options?: ?{
    // TODO(T83890478): Remove once Offscreen API lands in xplat
    // and we can use it in tests
    TEST_ONLY__initialEntryPointData?: ?{
      entryPointReference: ?PreloadedEntryPoint<TEntryPointComponent>,
      entryPointParams: ?TEntryPointParams,
    },
  },
): UseEntryPointLoaderHookReturnType<
  TEntryPointParams,
  TPreloadedQueries,
  TPreloadedEntryPoints,
  TRuntimeProps,
  TExtraProps,
  TEntryPointComponent,
> {
  /**
   * We want to always call `entryPointReference.dispose()` for every call to
   * `setEntryPointReference(loadEntryPoint(...))` so that no leaks of data in Relay
   * stores will occur.
   *
   * However, a call to `setState(newState)` is not always followed by a commit where
   * this value is reflected in the state. Thus, we cannot reliably clean up each ref
   * with `useEffect(() => () => entryPointReference.dispose(), [entryPointReference])`.
   *
   * Instead, we keep track of each call to `loadEntryPoint` in a ref.
   * Relying on the fact that if a state change commits, no state changes that were
   * initiated prior to the currently committing state change will ever subsequently
   * commit, we can safely dispose of all preloaded entry point references
   * associated with state changes initiated prior to the currently committing state
   * change.
   *
   * Finally, when the hook unmounts, we also dispose of all remaining uncommitted
   * entry point references.
   */

  const initialEntryPointReferenceInternal =
    options?.TEST_ONLY__initialEntryPointData?.entryPointReference ??
    initialNullEntryPointReferenceState;
  const initialEntryPointParamsInternal =
    options?.TEST_ONLY__initialEntryPointData?.entryPointParams ?? null;

  const isMountedRef = useIsMountedRef();
  const undisposedEntryPointReferencesRef = useRef<
    Set<PreloadedEntryPoint<TEntryPointComponent> | NullEntryPointReference>,
  >(new Set([initialEntryPointReferenceInternal]));

  const [entryPointReference, setEntryPointReference] = useState<
    PreloadedEntryPoint<TEntryPointComponent> | NullEntryPointReference,
  >(initialEntryPointReferenceInternal);
  const [entryPointParams, setEntryPointParams] =
    useState<TEntryPointParams | null>(initialEntryPointParamsInternal);

  const disposeEntryPoint = useCallback(() => {
    if (isMountedRef.current) {
      const nullEntryPointReference: NullEntryPointReference = {
        kind: 'NullEntryPointReference',
      };
      undisposedEntryPointReferencesRef.current.add(nullEntryPointReference);
      setEntryPointReference(nullEntryPointReference);
    }
  }, [setEntryPointReference, isMountedRef]);

  const entryPointLoaderCallback = useCallback(
    (params: TEntryPointParams) => {
      if (isMountedRef.current) {
        const updatedEntryPointReference = loadEntryPoint<
          TEntryPointParams,
          TPreloadedQueries,
          TPreloadedEntryPoints,
          TRuntimeProps,
          TExtraProps,
          TEntryPointComponent,
          TEntryPoint,
        >(environmentProvider, entryPoint, params);
        undisposedEntryPointReferencesRef.current.add(
          updatedEntryPointReference,
        );
        setEntryPointReference(updatedEntryPointReference);
        setEntryPointParams(params);
      }
    },
    [environmentProvider, entryPoint, setEntryPointReference, isMountedRef],
  );

  const maybeHiddenOrFastRefresh = useRef(false);
  useEffect(() => {
    return () => {
      // Attempt to detect if the component was
      // hidden (by Offscreen API), or fast refresh occurred;
      // Only in these situations would the effect cleanup
      // for "unmounting" run multiple times, so if
      // we are ever able to read this ref with a value
      // of true, it means that one of these cases
      // has happened.
      maybeHiddenOrFastRefresh.current = true;
    };
  }, []);

  useEffect(() => {
    if (maybeHiddenOrFastRefresh.current === true) {
      // This block only runs if the component has previously "unmounted"
      // due to it being hidden by the Offscreen API, or during fast refresh.
      // At this point, the current entryPointReference will have been disposed
      // by the previous cleanup, so instead of attempting to
      // do our regular commit setup, which would incorrectly leave our
      // current entryPointReference disposed, we need to load the entryPoint again
      // and force a re-render by calling entryPointLoaderCallback again,
      // so that the entryPointReference's queries are correctly re-retained, and
      // potentially refetched if necessary.
      maybeHiddenOrFastRefresh.current = false;
      if (
        entryPointReference.kind !== 'NullEntryPointReference' &&
        entryPointParams != null
      ) {
        entryPointLoaderCallback(entryPointParams);
      }
      return;
    }

    // When a new entryPointReference is committed, we iterate over all
    // entrypoint refs in undisposedEntryPointReferences and dispose all of
    // the refs that aren't the currently committed one. This ensures
    // that we don't leave any dangling entrypoint references for the
    // case that loadEntryPoint is called multiple times before commit; when
    // this happens, multiple state updates will be scheduled, but only one
    // will commit, meaning that we need to keep track of and dispose any
    // query references that don't end up committing.
    // - We are relying on the fact that sets iterate in insertion order, and we
    // can remove items from a set as we iterate over it (i.e. no iterator
    // invalidation issues.) Thus, it is safe to loop through
    // undisposedEntryPointReferences until we find entryPointReference, and
    // remove and dispose all previous references.
    // - We are guaranteed to find entryPointReference in the set, because if a
    // state change results in a commit, no state changes initiated prior to that
    // one will be committed, and we are disposing and removing references
    // associated with commits that were initiated prior to the currently
    // committing state change. (A useEffect callback is called during the commit
    // phase.)
    const undisposedEntryPointReferences =
      undisposedEntryPointReferencesRef.current;

    if (isMountedRef.current) {
      for (const undisposedEntryPointReference of undisposedEntryPointReferences) {
        if (undisposedEntryPointReference === entryPointReference) {
          break;
        }

        undisposedEntryPointReferences.delete(undisposedEntryPointReference);
        if (undisposedEntryPointReference.kind !== 'NullEntryPointReference') {
          undisposedEntryPointReference.dispose();
        }
      }
    }
  }, [
    entryPointReference,
    entryPointParams,
    entryPointLoaderCallback,
    isMountedRef,
  ]);

  useEffect(() => {
    return function disposeAllRemainingEntryPointReferences() {
      // undisposedEntryPointReferences.current is never reassigned
      // eslint-disable-next-line react-hooks/exhaustive-deps
      for (const unhandledStateChange of undisposedEntryPointReferencesRef.current) {
        if (unhandledStateChange.kind !== 'NullEntryPointReference') {
          unhandledStateChange.dispose();
        }
      }
    };
  }, []);

  return [
    entryPointReference.kind === 'NullEntryPointReference'
      ? null
      : entryPointReference,
    entryPointLoaderCallback,
    disposeEntryPoint,
  ];
}

module.exports = useLoadEntryPoint;
