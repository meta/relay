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

import type {IEnvironment, RecordSource} from '../store/RelayStoreTypes';

type InspectFn = (environment: IEnvironment, dataID?: ?string) => unknown;

let inspect: InspectFn = () => {};

if (__DEV__) {
  let formattersInstalled = false;

  /**
   * Installs a Chrome Developer Tools custom formatter for Relay proxy objects
   * returned by StoreInspector.inspect.
   *
   * bit.ly/object-formatters
   */
  const installDevtoolFormatters = () => {
    if (formattersInstalled) {
      return;
    }
    formattersInstalled = true;
    // $FlowFixMe[incompatible-use] D61394600
    // $FlowFixMe[cannot-resolve-name]
    if (window.devtoolsFormatters == null) {
      // $FlowFixMe[incompatible-use] D61394600
      // $FlowFixMe[cannot-resolve-name]
      window.devtoolsFormatters = [];
    }
    // $FlowFixMe[incompatible-use] D61394600
    // $FlowFixMe[cannot-resolve-name]
    if (!Array.isArray(window.devtoolsFormatters)) {
      return;
    }
    // eslint-disable-next-line no-console
    console.info(
      'Make sure to select "Enable custom formatters" in the Chrome ' +
        'Developer Tools settings, tab "Preferences" under the "Console" ' +
        'section.',
    );
    // $FlowFixMe[incompatible-use] D61394600
    // $FlowFixMe[cannot-resolve-name]
    window.devtoolsFormatters.push(...createFormatters());
  };

  const createFormatters = () => {
    const listStyle = {
      style:
        'list-style-type: none; padding: 0; margin: 0 0 0 12px; font-style: normal',
    };
    const keyStyle = {style: 'rgb(136, 19, 145)'};
    const nullStyle = {style: 'color: #777'};

    const reference = (object: $FlowFixMe, config: void) => {
      return object == null
        ? ['span', nullStyle, 'undefined']
        : ['object', {object, config}];
    };

    const renderRecordHeader = (record: $FlowFixMe) => {
      return [
        'span',
        {style: 'font-style: italic'},
        record.__typename,
        ['span', nullStyle, ' {id: "', record.__id, '", …}'],
      ];
    };

    const isRecord = (o: $FlowFixMe) => o != null && typeof o.__id === 'string';

    class RecordEntry {
      readonly key: string;
      readonly value: unknown;
      constructor(key: string, value: unknown) {
        this.key = key;
        this.value = value;
      }
    }

    const renderRecordEntries = (record: $FlowFixMe) => {
      const children = Object.keys(record).map(key => {
        return [
          'li',
          {},
          ['object', {object: new RecordEntry(key, record[key])}],
        ];
      });
      return ['ol', listStyle, ...children];
    };

    const recordFormatter = {
      header(obj: $FlowFixMe) {
        if (!isRecord(obj)) {
          return null;
        }
        return renderRecordHeader(obj);
      },
      hasBody(obj: $FlowFixMe) {
        return true;
      },
      body(obj: $FlowFixMe) {
        return renderRecordEntries(obj);
      },
    };

    const recordEntryFormatter = {
      header(obj: $FlowFixMe) {
        if (obj instanceof RecordEntry) {
          const value = isRecord(obj.value)
            ? renderRecordHeader(obj.value)
            : reference(obj.value);
          return ['span', keyStyle, obj.key, ': ', value];
        }
        return null;
      },
      hasBody(obj: $FlowFixMe) {
        return isRecord(obj.value);
      },
      body(obj: $FlowFixMe) {
        return renderRecordEntries(obj.value);
      },
    };

    return [recordFormatter, recordEntryFormatter];
  };

  const getWrappedRecord = (
    source: RecordSource,
    dataID: string,
  ): ?{[key: string]: unknown} => {
    const record = source.get(dataID);
    if (record == null) {
      // $FlowFixMe[incompatible-type]
      return record;
    }
    return new Proxy(
      {...record},
      {
        get(target, prop) {
          // $FlowFixMe[invalid-computed-prop]
          const value = target[prop];
          if (value == null) {
            return value;
          }
          if (typeof value === 'object') {
            if (typeof value.__ref === 'string') {
              return getWrappedRecord(source, value.__ref);
            }
            if (Array.isArray(value.__refs)) {
              // $FlowFixMe[incompatible-type]
              return value.__refs.map((ref: string) =>
                getWrappedRecord(source, ref),
              );
            }
          }
          return value;
        },
      },
    );
  };

  inspect = (environment: IEnvironment, dataID: ?string) => {
    installDevtoolFormatters();
    return getWrappedRecord(
      environment.getStore().getSource(),
      dataID ?? 'client:root',
    );
  };
}

module.exports = {
  inspect,
};
