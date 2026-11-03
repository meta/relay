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

import type {ReactRelayQueryRendererContext as ReactRelayQueryRendererContextType} from './ReactRelayQueryRendererContext';
import type {
  GraphQLTaggedNode,
  IEnvironment,
  RelayContext,
  Variables,
} from 'relay-runtime';
import type {SelectorData} from 'relay-runtime/store/RelayStoreTypes';

const ReactRelayContext = require('./ReactRelayContext');
const ReactRelayQueryRendererContext = require('./ReactRelayQueryRendererContext');
const areEqual = require('areEqual');
const React = require('react');
const {
  createOperationDescriptor,
  deepFreeze,
  getRequest,
} = require('relay-runtime');

const {useLayoutEffect, useState, useRef, useMemo} = React;

type Props = {
  environment: IEnvironment,
  query: GraphQLTaggedNode,
  // $FlowFixMe[unclear-type]
  render: (v: {props: ?any, ...}) => React.Node,
  variables: Variables,
  ...
};

const queryRendererContext: ReactRelayQueryRendererContextType = {
  rootIsQueryRenderer: true,
};

hook useDeepCompare<T extends {...}>(value: T): T {
  const latestValue = React.useRef(value);
  // $FlowFixMe[react-rule-unsafe-ref]
  if (!areEqual(latestValue.current, value)) {
    if (__DEV__) {
      deepFreeze(value);
    }
    // $FlowFixMe[react-rule-unsafe-ref]
    latestValue.current = value;
  }
  // $FlowFixMe[react-rule-unsafe-ref]
  return latestValue.current;
}

component ReactRelayLocalQueryRenderer(...props: Props) {
  const {environment, query, variables, render} = props;
  const latestVariables = useDeepCompare(variables);
  const operation = useMemo(() => {
    const request = getRequest(query);
    return createOperationDescriptor(request, latestVariables);
  }, [query, latestVariables]);

  const relayContext = useMemo(
    (): RelayContext => ({environment}),
    [environment],
  );

  // Use a ref to prevent rendering twice when data changes
  // because of props change
  const dataRef = useRef<?SelectorData>(null);
  const [, forceUpdate] = useState<?SelectorData>(null);
  const cleanupFnRef = useRef<null | (() => void)>(null);

  const snapshot = useMemo(() => {
    environment.check(operation);
    const res = environment.lookup(operation.fragment);
    // $FlowFixMe[react-rule-unsafe-ref]
    dataRef.current = res.data;

    // Run effects here so that the data can be retained
    // and subscribed before the component commits
    const retainDisposable = environment.retain(operation);
    const subscribeDisposable = environment.subscribe(res, newSnapshot => {
      dataRef.current = newSnapshot.data;
      forceUpdate(dataRef.current);
    });
    let disposed = false;
    function nextCleanupFn() {
      if (!disposed) {
        disposed = true;
        cleanupFnRef.current = null;
        retainDisposable.dispose();
        subscribeDisposable.dispose();
      }
    }
    if (cleanupFnRef.current) {
      // $FlowFixMe[react-rule-unsafe-ref]
      cleanupFnRef.current();
    }
    // $FlowFixMe[react-rule-unsafe-ref]
    cleanupFnRef.current = nextCleanupFn;
    return res;
  }, [environment, operation]);

  useLayoutEffect(() => {
    const cleanupFn = cleanupFnRef.current;
    return () => {
      cleanupFn && cleanupFn();
    };
  }, [snapshot]);

  return (
    <ReactRelayContext.Provider value={relayContext}>
      <ReactRelayQueryRendererContext.Provider value={queryRendererContext}>
        {
          // $FlowFixMe[react-rule-unsafe-ref]
          render({props: dataRef.current})
        }
      </ReactRelayQueryRendererContext.Provider>
    </ReactRelayContext.Provider>
  );
}

module.exports = ReactRelayLocalQueryRenderer;
