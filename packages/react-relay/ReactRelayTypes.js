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
  Disposable,
  FragmentType,
  GraphQLTaggedNode,
  IEnvironment,
  Observer,
  Variables,
} from 'relay-runtime';

export type GeneratedNodeMap = {[key: string]: GraphQLTaggedNode, ...};

export type ObserverOrCallback = Observer<void> | ((error: ?Error) => unknown);

// NOTE: This is an inexact type in order to allow a RelayPaginationProp or
// RelayRefetchProp to flow into a RelayProp.
export type RelayProp = {readonly environment: IEnvironment, ...};

export type RelayPaginationProp = {
  readonly environment: IEnvironment,
  readonly hasMore: () => boolean,
  readonly isLoading: () => boolean,
  readonly loadMore: (
    pageSize: number,
    observerOrCallback: ?ObserverOrCallback,
    options?: RefetchOptions,
  ) => ?Disposable,
  readonly refetchConnection: (
    totalCount: number,
    observerOrCallback: ?ObserverOrCallback,
    refetchVariables: ?Variables,
  ) => ?Disposable,
};

export type RelayRefetchProp = {
  readonly environment: IEnvironment,
  readonly refetch: (
    refetchVariables: Variables | ((fragmentVariables: Variables) => Variables),
    renderVariables: ?Variables,
    observerOrCallback: ?ObserverOrCallback,
    options?: RefetchOptions,
  ) => Disposable,
};

export type RefetchOptions = {
  readonly force?: boolean,
  readonly fetchPolicy?: 'store-or-network' | 'network-only',
  readonly metadata?: {[key: string]: unknown, ...},
};

/**
 * A utility type which takes the type of a fragment's data (typically found in
 * a relay generated file) and returns a fragment reference type. This is used
 * when the input to a Relay component needs to be explicitly typed:
 *
 *   // ExampleComponent.js
 *   import type {ExampleComponent_data} from './generated/ExampleComponent_data.graphql';
 *   type Props = {
 *     title: string,
 *     data: ExampleComponent_data,
 *   };
 *
 *   export default createFragmentContainer(
 *     (props: Props) => <div>{props.title}, {props.data.someField}</div>,
 *     graphql`
 *       fragment ExampleComponent_data on SomeType {
 *         someField
 *       }`
 *   );
 *
 *   // ExampleUsage.js
 *   import type {ExampleComponent_data} from './generated/ExampleComponent_data.graphql';
 *   type Props = {
 *     title: string,
 *     data: $FragmentRef<ExampleComponent_data>,
 *   };
 *
 *   export default function ExampleUsage(props: Props) {
 *     return <ExampleComponent {...props} />
 *   }
 *
 */
export type $FragmentRef<T> = {
  readonly $fragmentSpreads: T['$fragmentType'],
  ...
};

/* $FlowExpectedError[unclear-type]: Intentional so that it won't fail,
 * even if the type we want to exclude doesn't exist in Props */
type LooseOmitRelayProps<Props extends {...}, K extends keyof any> = Pick<
  Props,
  Exclude<keyof Props, K>,
>;
/**
 * A utility type that takes the Props of a component and the type of
 * `props.relay` and returns the props of the container.
 */
// prettier-ignore
export type $RelayProps<Props extends {...}, _RelayPropT = RelayProp> = MapRelayProps<
  LooseOmitRelayProps<Props, 'relay'>,
>;

type MapRelayProps<Props> = {[K in keyof Props]: MapRelayProp<Props[K]>};
type MapRelayProp<T> = [readonly t: T] extends [
  readonly t: {readonly $fragmentType: empty, ...},
]
  ? T
  : [readonly t: T] extends [readonly t: ?{readonly $fragmentType: empty, ...}]
    ? ?T
    : [readonly t: T] extends [
          readonly t: {readonly $fragmentType: FragmentType, ...},
        ]
      ? $FragmentRef<T>
      : [readonly t: T] extends [
            readonly t: ?{readonly $fragmentType: FragmentType, ...},
          ]
        ? ?$FragmentRef<NonNullable<T>>
        : [readonly t: T] extends [
              readonly t: ReadonlyArray<
                infer V extends {readonly $fragmentType: FragmentType, ...},
              >,
            ]
          ? ReadonlyArray<$FragmentRef<V>>
          : [readonly t: T] extends [
                readonly t: ?ReadonlyArray<
                  infer V extends {readonly $fragmentType: FragmentType, ...},
                >,
              ]
            ? ?ReadonlyArray<$FragmentRef<V>>
            : [readonly t: T] extends [
                  readonly t: ReadonlyArray<?infer V extends {
                    readonly $fragmentType: FragmentType,
                    ...
                  }>,
                ]
              ? ReadonlyArray<?$FragmentRef<NonNullable<V>>>
              : [readonly t: T] extends [
                    readonly t: ?ReadonlyArray<?infer V extends {
                      readonly $fragmentType: FragmentType,
                      ...
                    }>,
                  ]
                ? ?ReadonlyArray<?$FragmentRef<NonNullable<V>>>
                : T;

export type RelayFragmentContainer<TComponent extends component(...empty)> =
  component(...$RelayProps<React.ComponentProps<TComponent>, RelayProp>);

export type RelayPaginationContainer<TComponent extends component(...empty)> =
  component(
    ...$RelayProps<React.ComponentProps<TComponent>, RelayPaginationProp>
  );

export type RelayRefetchContainer<TComponent extends component(...empty)> =
  component(...$RelayProps<React.ComponentProps<TComponent>, RelayRefetchProp>);
