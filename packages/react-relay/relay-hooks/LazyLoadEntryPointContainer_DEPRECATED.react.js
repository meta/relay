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
import type {OperationType} from '../../relay-runtime/util/RelayRuntimeTypes';
import type {
  EntryPoint,
  EntryPointComponent,
  EnvironmentProviderOptions,
  IEnvironmentProvider,
  PreloadedQuery,
} from './EntryPointTypes.flow';

const preloadQuery_DEPRECATED = require('./preloadQuery_DEPRECATED');
const ProfilerContext = require('./ProfilerContext');
const useRelayEnvironment = require('./useRelayEnvironment');
const React = require('react');
const {useContext, useEffect, useMemo} = require('react');
const {stableCopy} = require('relay-runtime');

type PreloadedEntryPoint<TEntryPointComponent> = Readonly<{
  entryPoints: React.ComponentProps<TEntryPointComponent>['entryPoints'],
  extraProps: React.ComponentProps<TEntryPointComponent>['extraProps'],
  getComponent: () => TEntryPointComponent,
  queries: React.ComponentProps<TEntryPointComponent>['queries'],
  rootModuleID: string,
}>;

type EntryPointContainerProps<
  TEntryPointParams,
  TPreloadedQueries,
  TPreloadedEntryPoints,
  TRuntimeProps,
  TExtraProps,
> = Readonly<
  Readonly<{
    entryPoint: EntryPoint<
      TEntryPointParams,
      EntryPointComponent<
        TPreloadedQueries,
        TPreloadedEntryPoints,
        TRuntimeProps,
        TExtraProps,
      >,
    >,
    entryPointParams: TEntryPointParams,
    environmentProvider?: IEnvironmentProvider<EnvironmentProviderOptions>,
    props: TRuntimeProps,
  }>,
>;

function stableStringify(value: unknown): string {
  return JSON.stringify(stableCopy(value)) ?? 'null';
}

function prepareEntryPoint<
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
  entryPointParams: TEntryPointParams,
): PreloadedEntryPoint<TEntryPointComponent> {
  // Start loading the code for the entrypoint
  let loadingPromise = null;
  if (entryPoint.root.getModuleIfRequired() == null) {
    loadingPromise = entryPoint.root.load();
  }
  const preloadProps = entryPoint.getPreloadProps(entryPointParams);
  const {queries, entryPoints, extraProps} = preloadProps;
  // $FlowFixMe[incompatible-type]
  const preloadedQueries: Partial<TPreloadedQueries> = {};
  // $FlowFixMe[incompatible-type]
  const preloadedEntryPoints: Partial<TPreloadedEntryPoints> = {};
  if (queries != null) {
    const queriesPropNames = Object.keys(queries);
    queriesPropNames.forEach(queryPropName => {
      const {environmentProviderOptions, options, parameters, variables} =
        queries[queryPropName];

      const environment = environmentProvider.getEnvironment(
        environmentProviderOptions,
      );

      // $FlowFixMe[cannot-write]
      preloadedQueries[queryPropName] = preloadQuery_DEPRECATED<
        OperationType,
        unknown,
      >(
        environment,
        parameters,
        variables,
        options,
        environmentProviderOptions,
      );
    });
  }

  if (entryPoints != null) {
    const entryPointPropNames = Object.keys(entryPoints);
    entryPointPropNames.forEach(entryPointPropName => {
      const entryPointDescription = entryPoints[entryPointPropName];
      if (entryPointDescription == null) {
        return;
      }
      const {entryPoint: nestedEntryPoint, entryPointParams: nestedParams} =
        entryPointDescription;
      preloadedEntryPoints[entryPointPropName] = prepareEntryPoint<
        _,
        {},
        {...},
        {...},
        unknown,
        EntryPointComponent<{}, {...}, {...}, unknown>,
        _,
      >(environmentProvider, nestedEntryPoint, nestedParams);
    });
  }
  return {
    // $FlowFixMe[incompatible-type]
    entryPoints: preloadedEntryPoints as TPreloadedEntryPoints,
    extraProps: extraProps ?? null,
    getComponent: () => {
      const component = entryPoint.root.getModuleIfRequired();
      if (component == null) {
        loadingPromise = loadingPromise ?? entryPoint.root.load();
        throw loadingPromise;
      }
      // $FlowFixMe[incompatible-type] - trust me Flow, its entryPoint component
      return component as TEntryPointComponent;
    },
    // $FlowFixMe[incompatible-type]
    queries: preloadedQueries as TPreloadedQueries,
    rootModuleID: entryPoint.root.getModuleId(),
  };
}

component LazyLoadEntryPointContainer_DEPRECATED<
  TEntryPointParams extends {...},
  // $FlowExpectedError[unclear-type] Need any to make it supertype of all PreloadedQuery
  TPreloadedQueries extends {readonly [key: string]: PreloadedQuery<any>},
  TPreloadedEntryPoints extends {...},
  TRuntimeProps extends {...},
  TExtraProps,
>(
  ...{
    entryPoint,
    entryPointParams,
    props,
    environmentProvider,
  }: EntryPointContainerProps<
    TEntryPointParams,
    TPreloadedQueries,
    TPreloadedEntryPoints,
    TRuntimeProps,
    TExtraProps,
  >
) {
  const environment = useRelayEnvironment();
  const {getPreloadProps} = entryPoint;
  // IMPORTANT: Loading the component may suspend (throw), so the props
  // *must* be computed first to fetch the component's data-dependencies in
  // parallel with the component itself (the code).
  const entryPointParamsHash = stableStringify(entryPointParams);
  const {getComponent, queries, entryPoints, extraProps, rootModuleID} =
    useMemo(() => {
      return prepareEntryPoint<
        TEntryPointParams,
        TPreloadedQueries,
        TPreloadedEntryPoints,
        TRuntimeProps,
        TExtraProps,
        EntryPointComponent<
          TPreloadedQueries,
          TPreloadedEntryPoints,
          TRuntimeProps,
          TExtraProps,
        >,
        _,
      >(
        environmentProvider ?? {
          getEnvironment: () => environment,
        },
        entryPoint,
        entryPointParams,
      );
      // NOTE: stableParams encodes the information from params
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
      environment,
      environmentProvider,
      getPreloadProps,
      entryPointParamsHash,
    ]);
  const Component = useMemo(() => {
    return getComponent();
  }, [getComponent]);

  const profilerContext = useContext(ProfilerContext);
  useEffect(() => {
    environment.__log({
      name: 'entrypoint.root.consume',
      profilerContext,
      rootModuleID,
    });
  }, [environment, profilerContext, rootModuleID]);
  return (
    <Component
      entryPoints={entryPoints}
      extraProps={extraProps}
      props={props}
      queries={queries}
    />
  );
}

module.exports = LazyLoadEntryPointContainer_DEPRECATED;
