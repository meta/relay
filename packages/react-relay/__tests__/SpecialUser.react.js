/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict-local
 */

import type {RelayClient3DModuleTestFragmentSpecialUser_data$key} from 'react-relay/__tests__/__generated__/RelayClient3DModuleTestFragmentSpecialUser_data.graphql';

import * as React from 'react';
import {
  useFragment,
} from 'react-relay';
import RelayClient3DModuleTestFragmentSpecialUser_data from 'react-relay/__tests__/__generated__/RelayClient3DModuleTestFragmentSpecialUser_data.graphql';

/**
 * This is not a functional app, it is only used to test client 3D.
 */
export default component SpecialUser(
  data: RelayClient3DModuleTestFragmentSpecialUser_data$key,
) {
  const fragmentData = useFragment(
    RelayClient3DModuleTestFragmentSpecialUser_data,
    data,
  );
  return <>{fragmentData.data}</>;
// Conflicting lint errors doesn't allow CI to pass if we don't disable one of them.
// eslint-disable-next-line semi
}
