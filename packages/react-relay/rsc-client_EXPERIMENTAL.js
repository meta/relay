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

'use client';
'use strict';

import type {PreloadedQueryRef} from './relay-hooks/rsc/serverPreloadQuery';

const installRelayHandoff = require('./relay-hooks/rsc/installRelayHandoff');
const useQueryFromServer = require('./relay-hooks/rsc/useQueryFromServer');

export type {PreloadedQueryRef};

module.exports = {
  installRelayHandoff,
  useQueryFromServer,
};
