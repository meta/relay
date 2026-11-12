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

import type {ComponentType, Node} from 'react';

const React = require('react');

type ActivityProps = {
  mode: 'hidden' | 'visible',
  children: Node,
};

declare function getActivity(): ComponentType<ActivityProps>;

/**
 * React's Activity (`unstable_Activity` in experimental builds), which not
 * every React type definition declares.
 */
function getActivity(): unknown {
  const Activity: unknown = Object.getOwnPropertyDescriptor(
    React,
    'unstable_Activity',
  )?.value;
  if (Activity == null) {
    throw new Error('Expected a version of React with Activity.');
  }
  return Activity;
}

module.exports = {getActivity};
