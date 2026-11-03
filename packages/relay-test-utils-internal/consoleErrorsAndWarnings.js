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

/* global afterEach */

export type WillFireOptions = {
  count?: number,
  optional?: boolean,
};

type API = Readonly<{
  disallowMessages: () => void,
  expectMessageWillFire: (v0: string, v1: void | WillFireOptions) => void,
  expectMessage: <T>(v0: string, v1: () => T) => T,
  expectMessageMany: <T>(v0: Array<string>, v1: () => T) => T,
}>;

const originalConsoleError = console.error;

function createConsoleInterceptionSystem(
  typename: string,
  expectFunctionName: string,
  setUpMock: (v: (v: string) => void) => void,
): API {
  let installed = false;
  const expectedMessages: Array<string> = [];
  const optionalMessages: Array<string> = [];
  const contextualExpectedMessage: Array<string> = [];

  const typenameCap = typename.charAt(0).toUpperCase() + typename.slice(1);
  const typenameCapPlural = typenameCap + 's';
  const installerName = `disallow${typenameCap}s`;

  function handleMessage(message: string): void {
    const index = expectedMessages.findIndex(expected =>
      message.startsWith(expected),
    );
    const optionalIndex = optionalMessages.findIndex(expected =>
      message.startsWith(expected),
    );
    if (
      contextualExpectedMessage.length > 0 &&
      message.startsWith(contextualExpectedMessage[0])
    ) {
      contextualExpectedMessage.shift();
    } else if (index >= 0) {
      expectedMessages.splice(index, 1);
    } else if (optionalIndex >= 0) {
      optionalMessages.splice(optionalIndex, 1);
    } else {
      // log to console in case the error gets swallowed somewhere
      // $FlowFixMe[incompatible-type]
      originalConsoleError(`Unexpected ${typenameCap}: ` + message);
      throw new Error(`${typenameCap}: ` + message);
    }
  }

  function disallowMessages(): void {
    if (installed) {
      throw new Error(`${installerName} should be called only once.`);
    }

    installed = true;
    setUpMock(handleMessage);

    afterEach(() => {
      optionalMessages.length = 0;
      contextualExpectedMessage.length = 0;
      if (expectedMessages.length > 0) {
        const error = new Error(
          `Some ${expectedMessages.length} expected ${typename}s where not triggered:\n\n` +
            Array.from(expectedMessages, message => ` * ${message}`).join(
              '\n',
            ) +
            '\n',
        );
        expectedMessages.length = 0;
        throw error;
      }
    });
  }

  function expectMessageWillFire(
    message: string,
    options?: WillFireOptions,
  ): void {
    if (!installed) {
      throw new Error(
        `${installerName} needs to be called before expect${typenameCapPlural}WillFire`,
      );
    }
    const optional = options?.optional === true; // avoid "sketchy null check"
    for (let i = 0; i < (options?.count ?? 1); i++) {
      (optional ? optionalMessages : expectedMessages).push(message);
    }
  }

  function expectMessage<T>(message: string, fn: () => T): T {
    return expectMessageMany([message], fn);
  }

  function expectMessageMany<T>(messages: Array<string>, fn: () => T): T {
    if (contextualExpectedMessage.length > 0) {
      throw new Error(`Cannot nest ${expectFunctionName}() calls.`);
    }
    contextualExpectedMessage.push(...messages);
    const result = fn();
    if (contextualExpectedMessage.length > 0) {
      const notFired = contextualExpectedMessage.toString();
      contextualExpectedMessage.length = 0;
      throw new Error(`Expected ${typename} in callback: ${notFired}`);
    }
    return result;
  }

  return {
    disallowMessages,
    expectMessageWillFire,
    expectMessage,
    expectMessageMany,
  };
}

module.exports = {
  createConsoleInterceptionSystem,
};
