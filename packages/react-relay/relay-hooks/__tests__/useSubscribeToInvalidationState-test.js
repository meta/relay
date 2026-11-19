/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 * @format
 * @oncall relay
 * @jest-environment jsdom
 */

'use strict';

import type {RelayMockEnvironment} from '../../../relay-test-utils/RelayModernMockEnvironment';
import type {RecordSourceJSON} from 'relay-runtime/store/RelayStoreTypes';

const RelayEnvironmentProvider = require('../RelayEnvironmentProvider');
const useSubscribeToInvalidationState = require('../useSubscribeToInvalidationState');
const ReactTestingLibrary = require('@testing-library/react');
const React = require('react');
const {useEffect, useState} = require('react');
const {act} = require('react');
const {RecordSource, REF_KEY, Store} = require('relay-runtime');
const {createMockEnvironment} = require('relay-test-utils');

let environment;
let render;
let setEnvironment;
let setDataIDs;
let setCallback;
let disposable;
let renderedInstance;
let data: RecordSourceJSON;
let callback;

beforeEach(() => {
  data = {
    '4': {
      __id: '4',
      id: '4',
      __typename: 'User',
      name: 'Zuck',
      'profilePicture(size:32)': {[REF_KEY]: 'client:1'},
    },
    '5': {
      __id: '5',
      id: '5',
      __typename: 'User',
      name: 'Someone',
      'profilePicture(size:32)': {[REF_KEY]: 'client:2'},
    },
    'client:1': {
      __id: 'client:1',
      uri: 'https://photo1.jpg',
    },
    'client:2': {
      __id: 'client:2',
      uri: 'https://photo2.jpg',
    },
    'client:root': {
      __id: 'client:root',
      __typename: '__Root',
      'node(id:"4")': {__ref: '4'},
      'node(id:"5")': {__ref: '5'},
    },
  };
  const source = new RecordSource(data);
  const store = new Store(source);

  environment = createMockEnvironment({store});
  callback = jest.fn<ReadonlyArray<unknown>, void>();

  function Renderer({
    initialDataIDs,
    initialCallback,
  }: {
    initialCallback: JestMockFn<ReadonlyArray<unknown>, void>,
    initialDataIDs: ReadonlyArray<string>,
  }) {
    const [dataIDs, _setDataIDs] = useState(initialDataIDs);
    const [cbState, _setCallback] = useState({callback: initialCallback});
    const cb = cbState.callback;

    setDataIDs = _setDataIDs;
    setCallback = (_cb: JestMockFn<Array<unknown>, void>) =>
      // $FlowFixMe[incompatible-type] Error found while enabling LTI on this file
      _setCallback({callback: _cb});

    const _disposable = useSubscribeToInvalidationState(dataIDs, cb);
    useEffect(() => {
      disposable = _disposable;
    }, [_disposable]);

    return null;
  }

  function Container(props: {
    callback: JestMockFn<ReadonlyArray<unknown>, void>,
    dataIDs: ReadonlyArray<string>,
    environment: RelayMockEnvironment,
  }) {
    const [env, setEnv] = useState(props.environment);
    setEnvironment = setEnv;
    return (
      <RelayEnvironmentProvider environment={env}>
        <Renderer
          initialDataIDs={props.dataIDs}
          initialCallback={props.callback}
        />
      </RelayEnvironmentProvider>
    );
  }

  render = async (
    env: RelayMockEnvironment,
    dataIDs: ReadonlyArray<string>,
    cb: JestMockFn<ReadonlyArray<unknown>, void>,
  ) => {
    await act(() => {
      renderedInstance = ReactTestingLibrary.render(
        <Container environment={env} dataIDs={dataIDs} callback={cb} />,
      );
    });
  };
});

const dataIDs = ['4', 'client:1'];

it('notifies when invalidation state changes due to global invalidation', async () => {
  await render(environment, dataIDs, callback);

  environment.commitUpdate(storeProxy => {
    storeProxy.invalidateStore();
  });

  expect(callback).toHaveBeenCalledTimes(1);
});

it('notifies when invalidation state changes due to invalidating one of the provided ids', async () => {
  await render(environment, dataIDs, callback);

  environment.commitUpdate(storeProxy => {
    const user = storeProxy.get('4');
    if (!user) {
      throw new Error('Expected to find record with id "4"');
    }
    user.invalidateRecord();
  });

  expect(callback).toHaveBeenCalledTimes(1);
});

it('notifies once when invalidating multiple affected records in the same update', async () => {
  await render(environment, dataIDs, callback);

  environment.commitUpdate(storeProxy => {
    const user = storeProxy.get('4');
    if (!user) {
      throw new Error('Expected to find record with id "4"');
    }
    user.invalidateRecord();

    const record = storeProxy.get('client:1');
    if (!record) {
      throw new Error('Expected to find record with id "client:1"');
    }
    record.invalidateRecord();
  });

  expect(callback).toHaveBeenCalledTimes(1);
});

it('notifies once per update when multiple affected records invalidated', async () => {
  await render(environment, dataIDs, callback);

  environment.commitUpdate(storeProxy => {
    const user = storeProxy.get('4');
    if (!user) {
      throw new Error('Expected to find record with id "4"');
    }
    user.invalidateRecord();
  });
  expect(callback).toHaveBeenCalledTimes(1);

  environment.commitUpdate(storeProxy => {
    const record = storeProxy.get('client:1');
    if (!record) {
      throw new Error('Expected to find record with id "client:1"');
    }
    record.invalidateRecord();
  });

  expect(callback).toHaveBeenCalledTimes(2);
});

it('notifies once when invalidation state changes due to both global and local invalidation in a single update', async () => {
  await render(environment, dataIDs, callback);

  environment.commitUpdate(storeProxy => {
    storeProxy.invalidateStore();

    const user = storeProxy.get('4');
    if (!user) {
      throw new Error('Expected to find record with id "4"');
    }
    user.invalidateRecord();

    const record = storeProxy.get('client:1');
    if (!record) {
      throw new Error('Expected to find record with id "client:1"');
    }
    record.invalidateRecord();
  });

  expect(callback).toHaveBeenCalledTimes(1);
});

it('notifies once per update when invalidation state changes due to both global and local invalidation in multiple', async () => {
  await render(environment, dataIDs, callback);

  environment.commitUpdate(storeProxy => {
    storeProxy.invalidateStore();
  });
  expect(callback).toHaveBeenCalledTimes(1);

  environment.commitUpdate(storeProxy => {
    const user = storeProxy.get('4');
    if (!user) {
      throw new Error('Expected to find record with id "4"');
    }
    user.invalidateRecord();
  });
  expect(callback).toHaveBeenCalledTimes(2);

  environment.commitUpdate(storeProxy => {
    const record = storeProxy.get('client:1');
    if (!record) {
      throw new Error('Expected to find record with id "client:1"');
    }
    record.invalidateRecord();
  });

  expect(callback).toHaveBeenCalledTimes(3);
});

it('does not notify if invalidated ids do not affect subscription', async () => {
  await render(environment, dataIDs, callback);

  environment.commitUpdate(storeProxy => {
    const user = storeProxy.get('5');
    if (!user) {
      throw new Error('Expected to find record with id "5"');
    }
    user.invalidateRecord();
  });
  expect(callback).toHaveBeenCalledTimes(0);
});

it('does not notify if subscription has been manually disposed of', async () => {
  await render(environment, dataIDs, callback);
  disposable.dispose();

  environment.commitUpdate(storeProxy => {
    storeProxy.invalidateStore();
  });
  expect(callback).toHaveBeenCalledTimes(0);
});

it('does not notify after component unmounts', async () => {
  await render(environment, dataIDs, callback);

  await act(() => {
    renderedInstance.unmount();
  });

  environment.commitUpdate(storeProxy => {
    storeProxy.invalidateStore();
  });
  expect(callback).toHaveBeenCalledTimes(0);
});

it('re-establishes subscription when data ids change', async () => {
  await render(environment, dataIDs, callback);

  environment.commitUpdate(storeProxy => {
    const user = storeProxy.get('4');
    if (!user) {
      throw new Error('Expected to find record with id "4"');
    }
    user.invalidateRecord();
  });

  expect(callback).toHaveBeenCalledTimes(1);

  await act(() => {
    setDataIDs(['5', 'client:2']);
  });

  // Assert that invalidating data ids from initial subscriptions
  // does not trigger callback anymore
  callback.mockClear();
  environment.commitUpdate(storeProxy => {
    const user = storeProxy.get('4');
    if (!user) {
      throw new Error('Expected to find record with id "4"');
    }
    user.invalidateRecord();
  });
  expect(callback).toHaveBeenCalledTimes(0);

  // Assert that invalidating ids from new subscription
  // trigger callback
  environment.commitUpdate(storeProxy => {
    const user = storeProxy.get('5');
    if (!user) {
      throw new Error('Expected to find record with id "5"');
    }
    user.invalidateRecord();
  });

  expect(callback).toHaveBeenCalledTimes(1);
});

it('does not re-establish subscription id data ids change but array changes', async () => {
  await render(environment, dataIDs, callback);

  environment.commitUpdate(storeProxy => {
    const user = storeProxy.get('4');
    if (!user) {
      throw new Error('Expected to find record with id "4"');
    }
    user.invalidateRecord();
  });

  expect(callback).toHaveBeenCalledTimes(1);

  const store = environment.getStore();
  jest.spyOn(store, 'subscribeToInvalidationState');

  await act(() => {
    setDataIDs(['client:1', '4']);
  });

  // Assert that we didn't re-subscribe
  expect(store.subscribeToInvalidationState).toHaveBeenCalledTimes(0);

  // Assert that invalidating data ids from initial subscriptions
  // triggers callback again
  environment.commitUpdate(storeProxy => {
    const user = storeProxy.get('4');
    if (!user) {
      throw new Error('Expected to find record with id "4"');
    }
    user.invalidateRecord();
  });
  expect(callback).toHaveBeenCalledTimes(2);
});

it('re-establishes subscription when callback changes', async () => {
  await render(environment, dataIDs, callback);

  environment.commitUpdate(storeProxy => {
    const user = storeProxy.get('4');
    if (!user) {
      throw new Error('Expected to find record with id "4"');
    }
    user.invalidateRecord();
  });

  expect(callback).toHaveBeenCalledTimes(1);

  const newCallback = jest.fn<Array<unknown>, void>();
  await act(() => {
    setCallback(newCallback);
  });

  // Assert that invalidating data ids from initial subscriptions
  // does not trigger the old callback anymore, but the new one
  callback.mockClear();
  environment.commitUpdate(storeProxy => {
    const user = storeProxy.get('4');
    if (!user) {
      throw new Error('Expected to find record with id "4"');
    }
    user.invalidateRecord();
  });
  expect(callback).toHaveBeenCalledTimes(0);
  expect(newCallback).toHaveBeenCalledTimes(1);
});

it('re-establishes subscription when environment changes', async () => {
  await render(environment, dataIDs, callback);

  environment.commitUpdate(storeProxy => {
    const user = storeProxy.get('4');
    if (!user) {
      throw new Error('Expected to find record with id "4"');
    }
    user.invalidateRecord();
  });

  expect(callback).toHaveBeenCalledTimes(1);

  const newEnvironment = createMockEnvironment();
  await act(() => {
    setEnvironment(newEnvironment);
  });

  // Assert that invalidating data ids from initial subscriptions
  // does not trigger callback anymore
  callback.mockClear();
  environment.commitUpdate(storeProxy => {
    const user = storeProxy.get('4');
    if (!user) {
      throw new Error('Expected to find record with id "4"');
    }
    user.invalidateRecord();
  });
  expect(callback).toHaveBeenCalledTimes(0);

  // Assert that invalidating data ids on the new environment
  // triggers the callback
  newEnvironment.commitUpdate(storeProxy => {
    const user = storeProxy.create('4', 'User');
    user.invalidateRecord();
  });
  expect(callback).toHaveBeenCalledTimes(1);
});
