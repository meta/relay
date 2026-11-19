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

import type {RelayHandoffUseClientProvidersResolver$key} from './__generated__/RelayHandoffUseClientProvidersResolver.graphql';

const {graphql, readInlineData} = require('relay-runtime');
const {readFragment} = require('relay-runtime/store/ResolverFragments');

/**
 * @relayField User.handoffRendererProp: String
 * @rootFragment RelayHandoffUseClientProvidersResolver
 *
 * An ordinary Relay Resolver whose root fragment selects `@module` data.
 */
function handoffRendererProp(
  rootKey: RelayHandoffUseClientProvidersResolver$key,
): ?string {
  const user = readFragment(
    graphql`
      fragment RelayHandoffUseClientProvidersResolver on User {
        ...RelayHandoffUseClientProvidersResolverInline_user
      }
    `,
    rootKey,
  );
  const renderer = readInlineData(
    graphql`
      fragment RelayHandoffUseClientProvidersResolverInline_user on User
      @inline {
        resolverRenderer: nameRenderer @match {
          ...RelayHandoffUseClientProvidersResolverPlain_name
            @module(name: "../RelayHandoffTestPlainRenderer.react")
        }
      }
    `,
    user,
  ).resolverRenderer;
  return renderer?.__fragmentPropName ?? null;
}

graphql`
  fragment RelayHandoffUseClientProvidersResolverPlain_name on PlainUserNameRenderer {
    plaintext
  }
`;

module.exports = {handoffRendererProp};
