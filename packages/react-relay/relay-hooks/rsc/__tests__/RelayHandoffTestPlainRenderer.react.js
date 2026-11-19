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

// A `@module` component of the module provider tests, which never render it.
component RelayHandoffTestPlainRenderer() {
  return null;
}

module.exports = RelayHandoffTestPlainRenderer;
