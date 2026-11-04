/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

'use strict';

import type {CodeBlock} from './parseMarkdown';

import {resolveRelayPackage} from '../repoRoot';
import {cp, mkdir, mkdtemp, readFile, symlink, writeFile} from 'fs/promises';
import {tmpdir} from 'os';
import path from 'path';

const PROJECT_ROOT = path.resolve(__dirname, '..');

/**
 * `paths` entries pointing tsc at the Relay packages in this repo, so fixtures
 * typecheck against the `.d.ts` files this commit ships rather than whatever
 * `relay-runtime` happens to be installed.
 *
 * The `lib/*` entry makes the source tree look like the published package:
 * npm flattens everything under `lib/`, so code written against the real
 * package imports `relay-runtime/lib/network/RelayObservable`, which in source
 * is `relay-runtime/network/RelayObservable`. tsc prefers the more specific
 * pattern, so the bare `*` entry only catches paths that are already flat.
 */
function relayPackagePaths(): {[string]: Array<string>} {
  const paths: {[string]: Array<string>} = {};
  for (const name of ['relay-runtime', 'react-relay']) {
    const root = resolveRelayPackage(name);
    paths[name] = [path.join(root, 'index.d.ts')];
    paths[`${name}/lib/*`] = [path.join(root, '*')];
    paths[`${name}/*`] = [path.join(root, '*')];
  }
  return paths;
}

export async function setupTempDir(
  codeBlocks: Array<CodeBlock>,
  options: {
    // Overrides `relayRsc.mode` in relay.config.json, so a Server Component
    // fixture compiles for each RSC host it runs under.
    relayRscMode?: ?string,
  } = {},
): Promise<string> {
  const tempDir = await mkdtemp(path.join(tmpdir(), 'relay-e2e-'));

  // Create template/ subdirectory
  const templateDir = path.join(tempDir, 'template');
  await mkdir(templateDir, {recursive: true});

  // Write code blocks from markdown into template/
  for (const block of codeBlocks) {
    const filePath = path.join(templateDir, block.filename);
    await mkdir(path.dirname(filePath), {recursive: true});
    let content = block.content;
    if (block.filename === 'relay.config.json' && options.relayRscMode) {
      const config = JSON.parse(content);
      config.relayRsc = {...config.relayRsc, mode: options.relayRscMode};
      content = JSON.stringify(config, null, 2) + '\n';
    }
    await writeFile(filePath, content);
  }

  // Copy the shared network from project root, and for a Server Component
  // fixture (one with a Page.tsx) the Server Component API
  const isServerComponentFixture = codeBlocks.some(
    block => block.filename === 'Page.tsx',
  );
  for (const file of isServerComponentFixture
    ? ['GratsNetwork.ts', 'RelayRscHost.ts']
    : ['GratsNetwork.ts']) {
    await cp(path.join(PROJECT_ROOT, file), path.join(tempDir, file));
  }

  // The tsconfig is generated rather than copied: `paths` has to hold absolute
  // paths to the Relay packages, because the temp dir lives outside the repo
  // and nothing relative would reach them.
  const tsconfig = JSON.parse(
    await readFile(path.join(PROJECT_ROOT, 'tsconfig.template.json'), 'utf-8'),
  );
  tsconfig.compilerOptions.paths = relayPackagePaths();
  await writeFile(
    path.join(tempDir, 'tsconfig.json'),
    JSON.stringify(tsconfig, null, 2) + '\n',
  );

  // Symlink node_modules from project root
  await symlink(
    path.join(PROJECT_ROOT, 'node_modules'),
    path.join(tempDir, 'node_modules'),
  );

  return tempDir;
}
