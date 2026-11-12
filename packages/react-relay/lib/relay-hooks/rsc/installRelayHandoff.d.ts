/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

// Types for importing `react-relay/lib/relay-hooks/rsc/installRelayHandoff`
// directly, which loads only `installRelayHandoff` and not the rest of
// `react-relay/rsc-client_EXPERIMENTAL`.
import {installRelayHandoff} from '../../../rsc-client_EXPERIMENTAL';

export = installRelayHandoff;
