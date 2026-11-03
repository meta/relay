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

import type {Disposable, IEnvironment} from 'relay-runtime';

const warning = require('warning');

const TEMPORARY_RETAIN_DURATION_MS = 5 * 60 * 1000;

/**
 * Allows you to retain a resource as part of a component lifecycle accounting
 * for Suspense. You temporarily retain the resource during render, then
 * permanently retain it during commit and release it during unmount.
 */
class SuspenseResource {
  _retainCount = 0;
  _retainDisposable: ?Disposable = null;
  _releaseTemporaryRetain: ?() => void = null;
  _retain: (v: IEnvironment) => Disposable;

  constructor(retain: (environment: IEnvironment) => Disposable) {
    this._retain = (environment: IEnvironment): Disposable => {
      this._retainCount++;
      if (this._retainCount === 1) {
        this._retainDisposable = retain(environment);
      }
      return {
        dispose: () => {
          this._retainCount = Math.max(0, this._retainCount - 1);
          if (this._retainCount === 0) {
            if (this._retainDisposable != null) {
              this._retainDisposable.dispose();
              this._retainDisposable = null;
            } else {
              warning(
                false,
                'Relay: Expected disposable to release query to be defined.' +
                  "If you're seeing this, this is likely a bug in Relay.",
              );
            }
          }
        },
      };
    };
  }

  temporaryRetain(environment: IEnvironment): Disposable {
    // If we're executing in a server environment, there's no need
    // to create temporary retains, since the component will never commit.
    if (environment.isServer()) {
      return {dispose: () => {}};
    }

    // temporaryRetain is called during the render phase. However,
    // given that we can't tell if this render will eventually commit or not,
    // we create a timer to autodispose of this retain in case the associated
    // component never commits.
    // If the component /does/ commit, permanentRetain will clear this timeout
    // and permanently retain the data.
    const retention = this._retain(environment);
    let releaseQueryTimeout = null;
    const releaseTemporaryRetain = () => {
      // $FlowFixMe[incompatible-type]
      clearTimeout(releaseQueryTimeout);
      releaseQueryTimeout = null;
      this._releaseTemporaryRetain = null;
      retention.dispose();
    };
    releaseQueryTimeout = setTimeout(
      releaseTemporaryRetain,
      TEMPORARY_RETAIN_DURATION_MS,
    );

    // NOTE: Since temporaryRetain can be called multiple times, we release
    // the previous temporary retain after we re-establish a new one, since
    // we only ever need a single temporary retain until the permanent retain is
    // established.
    // temporaryRetain may be called multiple times by React during the render
    // phase, as well as multiple times by other query components that are
    // rendering the same query/variables.
    this._releaseTemporaryRetain?.();
    this._releaseTemporaryRetain = releaseTemporaryRetain;

    return {
      dispose: () => {
        this._releaseTemporaryRetain?.();
      },
    };
  }

  permanentRetain(environment: IEnvironment): Disposable {
    const disposable = this._retain(environment);
    this.releaseTemporaryRetain();
    return disposable;
  }

  releaseTemporaryRetain(): void {
    this._releaseTemporaryRetain?.();
    this._releaseTemporaryRetain = null;
  }

  getRetainCount(): number {
    return this._retainCount;
  }
}

module.exports = SuspenseResource;
