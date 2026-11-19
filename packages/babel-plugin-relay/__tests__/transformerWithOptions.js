/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @format
 * @oncall relay
 */

'use strict';

const BabelPluginRelay = require('../BabelPluginRelay');
const babel = require('@babel/core');
const checkDuplicatedNodes =
  require('@babel/helper-check-duplicate-nodes').default;
const prettier = require('prettier');

function transformerWithOptions(
  options: RelayPluginOptions,
  environment: 'development' | 'production' = 'production',
  filename?: string = '',
): (v: string) => Promise<string> {
  return (text, providedFileName) => {
    const previousEnv = process.env.BABEL_ENV;
    try {
      process.env.BABEL_ENV = environment;
      const {code, ast} = babel.transformSync(text, {
        compact: false,
        cwd: '/',
        filename: filename || providedFileName || 'test.js',
        highlightCode: false,
        parserOpts: {plugins: ['jsx']},
        plugins: [[BabelPluginRelay, options]],
        ast: true,
      });
      checkDuplicatedNodes(ast);
      return prettier.format(code, {
        bracketSameLine: true,
        bracketSpacing: false,
        parser: 'flow',
        requirePragma: false,
        singleQuote: true,
        trailingComma: 'all',
      });
    } finally {
      process.env.BABEL_ENV = previousEnv;
    }
  };
}

module.exports = transformerWithOptions;
