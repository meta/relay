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

import type {NormalizationSplitOperation} from './NormalizationNode';
import type {JSResourceReference} from 'JSResourceReference';

const {
  getModuleComponentKey,
  getModuleOperationKey,
} = require('../store/RelayStoreUtils');

export opaque type Local3DPayload<
  out _DocumentName extends string,
  out Response extends {...},
> = Response;

function createPayloadFor3DField<
  // $FlowFixMe[unsupported-variance-annotation]
  out DocumentName extends string,
  // $FlowFixMe[unsupported-variance-annotation]
  out Response extends {...},
>(
  name: DocumentName,
  operation: JSResourceReference<NormalizationSplitOperation>,
  component: JSResourceReference<unknown>,
  response: Response,
): Local3DPayload<DocumentName, Response> {
  const data = {
    ...response,
  };
  // $FlowFixMe[prop-missing]
  data[getModuleComponentKey(name)] = component;
  // $FlowFixMe[prop-missing]
  data[getModuleOperationKey(name)] = operation;
  return data;
}

module.exports = createPayloadFor3DField;
