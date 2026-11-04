/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

'use strict';

export type CodeBlock = {
  filename: string,
  content: string,
};

export type ParsedFixture = {
  codeBlocks: Array<CodeBlock>,
  // The RSC hosts a Server Component fixture runs under, from a `hosts` block.
  hosts: Array<string>,
  steps: Array<string>,
};

/**
 * The trimmed, non-empty lines of the fixture's one ```<info> block, if any.
 */
function parseLines(markdown: string, info: string): Array<string> {
  const matches = [
    ...markdown.matchAll(new RegExp('^```' + info + '\\s*\\n([\\s\\S]*?)^```$', 'gm')),
  ];
  if (matches.length > 1) {
    throw new Error(
      `Expected at most one ${info} block, found ${matches.length}.`,
    );
  }
  return (matches[0]?.[1] ?? '')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);
}

/**
 * Extracts code fences with `title="filename"`, and the `steps` and `hosts`
 * blocks, from markdown.
 */
export function parseMarkdown(markdown: string): ParsedFixture {
  const codeBlocks: Array<CodeBlock> = [];
  const fileRegex = /^```\w+\s+title="([^"]+)"\s*\n([\s\S]*?)^```$/gm;
  let match;
  while ((match = fileRegex.exec(markdown)) !== null) {
    codeBlocks.push({
      filename: match[1],
      content: match[2],
    });
  }

  return {
    codeBlocks,
    // Only a Server Component fixture (one with a Page.tsx) has hosts; other
    // fixtures ignore a `hosts` fence like any other.
    hosts: codeBlocks.some(block => block.filename === 'Page.tsx')
      ? parseLines(markdown, 'hosts')
      : [],
    steps: parseLines(markdown, 'steps'),
  };
}
