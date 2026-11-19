/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

'use strict';

import {RELAY_ROOT, getMainRepoRoot, resolveRelayPackage} from '../repoRoot';
import {execFile} from 'child_process';
import fs from 'fs';
import path from 'path';

const PROJECT_ROOT = path.resolve(__dirname, '..');

/**
 * Resolve the relay-compiler binary to use.
 *
 * Priority order:
 * 1. RELAY_COMPILER_BINARY env var (explicit override)
 * 2. Local cargo build output in repo root: compiler/target/debug/relay
 * 3. Local cargo build output in main worktree (if running from a git worktree)
 * 4. Fallback to node_modules/.bin/relay-compiler (npm version)
 *
 * The npm fallback is a published release that can lag the compiler in this
 * repo, so under CI it is an error rather than a silent downgrade: a run that
 * quietly tests last release's compiler is worse than no run at all.
 */
function getRelayCompilerBinary(): string {
  if (process.env.RELAY_COMPILER_BINARY) {
    return process.env.RELAY_COMPILER_BINARY;
  }

  const localBinary = path.join(
    RELAY_ROOT,
    'compiler',
    'target',
    'debug',
    'relay',
  );
  if (fs.existsSync(localBinary)) {
    return localBinary;
  }

  // In a git worktree, build artifacts live in the main worktree
  const mainRoot = getMainRepoRoot();
  if (mainRoot !== RELAY_ROOT) {
    const mainBinary = path.join(
      mainRoot,
      'compiler',
      'target',
      'debug',
      'relay',
    );
    if (fs.existsSync(mainBinary)) {
      return mainBinary;
    }
  }

  // Plain `CI` is enough: GitHub Actions always sets it, and the fbsource Buck
  // test supplies RELAY_COMPILER_BINARY outright, so this is only a backstop
  // there. Jest's own `--ci` detection is broader (it uses `ci-info`), which
  // would matter on a CI system that sets only BUILD_NUMBER or RUN_ID -- not
  // something either of those two run on.
  if (process.env.CI) {
    throw new Error(
      'No relay-compiler built from this repo was found, and the published ' +
        'npm relay-compiler must not be used in CI.\nEither set ' +
        'RELAY_COMPILER_BINARY to the compiler under test, or build it with:' +
        '\n  cargo build --manifest-path=compiler/Cargo.toml --bin relay',
    );
  }

  return path.join(PROJECT_ROOT, 'node_modules', '.bin', 'relay-compiler');
}

function runAllowingFailure(
  command: string,
  args: Array<string>,
  options?: {env?: {[key: string]: string}, cwd?: string},
): Promise<{
  code: number | null,
  signal: string | null,
  stdout: string,
  stderr: string,
}> {
  return new Promise(resolve => {
    const proc = execFile(command, args, {
      env: {...process.env, ...options?.env},
      cwd: options?.cwd ?? PROJECT_ROOT,
    });
    let stdout = '';
    let stderr = '';
    proc.stdout?.on('data', data => {
      stdout += data;
    });
    proc.stderr?.on('data', data => {
      stderr += data;
    });
    // `code` is null when the process died from a signal. Callers have to
    // distinguish that from a clean exit -- coercing it to 0 here would report
    // a killed process as a success.
    proc.on('close', (code, signal) => {
      resolve({code, signal, stdout, stderr});
    });
  });
}

async function run(
  command: string,
  args: Array<string>,
  options?: {env?: {[key: string]: string}, cwd?: string},
): Promise<string> {
  const {code, signal, stdout, stderr} = await runAllowingFailure(
    command,
    args,
    options,
  );
  if (signal != null) {
    throw new Error(
      `${command} ${args.join(' ')} was killed by ${signal}\n${stderr}`,
    );
  }
  if (code !== 0) {
    throw new Error(
      `${command} ${args.join(' ')} exited with code ${String(code)}\n${stderr}`,
    );
  }
  return stdout;
}

/**
 * Absolute paths that must never reach a snapshot.
 *
 * Diagnostics about the fixture itself are relative, because tsc runs with cwd
 * set to the temp dir. But a diagnostic that *mentions a type* declared in a
 * Relay package quotes that package's absolute path, which comes from the
 * `paths` map and so points into the checkout.
 *
 * Substituting a placeholder keyed by package name does double duty: it keeps
 * the checkout location out of the snapshot, and it makes the two repo layouts
 * agree. Internally the packages sit at `oss/<name>`, on GitHub at
 * `packages/<name>`, and these snapshots are shared between the two.
 */
const PATH_PLACEHOLDERS: Array<[string, string]> = [
  'relay-runtime',
  'react-relay',
].map(name => [resolveRelayPackage(name), `<${name}>`]);

function scrubAbsolutePaths(line: string, tempDir: string): string {
  let scrubbed = line.split(tempDir + '/').join('');
  for (const [absolute, placeholder] of PATH_PLACEHOLDERS) {
    scrubbed = scrubbed.split(absolute).join(placeholder);
  }
  return scrubbed;
}

/**
 * Typecheck the fixture against the Relay `.d.ts` files in this repo.
 *
 * This runs last because it is the only step that needs relay-compiler's
 * output: the generated `template/__generated__/*.graphql.ts` artifacts are
 * picked up by the tsconfig's `template/**` include, so the fixture's
 * `useLazyLoadQuery<AppTestQuery>` is checked against the types the compiler
 * under test actually emitted.
 *
 * Diagnostics are returned rather than thrown. They land in the fixture's
 * snapshot, which keeps a type bug visible and reviewable without blocking a
 * fixture that exists to characterise one.
 */
async function typecheck(tempDir: string): Promise<Array<string>> {
  const tscBin = path.join(PROJECT_ROOT, 'node_modules', '.bin', 'tsc');

  // `--pretty false` gives one diagnostic per line with no colour codes; both
  // matter for a snapshot. `--noEmit` is passed here rather than set in the
  // tsconfig so grats, which shares that tsconfig, is unaffected.
  const {code, signal, stdout, stderr} = await runAllowingFailure(
    tscBin,
    ['-p', 'tsconfig.json', '--noEmit', '--pretty', 'false'],
    {cwd: tempDir},
  );

  // A killed tsc has no verdict to report. Treating it as "no diagnostics"
  // would snapshot a clean fixture, which is the silent pass this whole
  // function is written to avoid.
  if (signal != null) {
    throw new Error(`tsc was killed by ${signal}.\n${stderr}`);
  }

  if (code === 0) {
    return [];
  }

  // tsc reports diagnostics on stdout and reserves stderr for its own crashes,
  // so empty stdout with a non-zero exit is a harness failure, not a type
  // error, and must not be silently snapshotted as "no type errors".
  const output = stdout.trim();
  if (output === '') {
    throw new Error(
      `tsc exited with code ${String(code)} but reported no diagnostics.\n` +
        `${stderr}`,
    );
  }

  return output.split('\n').map(line => scrubAbsolutePaths(line, tempDir));
}

export async function runFixture(tempDir: string): Promise<Array<string>> {
  const tsconfigPath = path.join(tempDir, 'tsconfig.json');
  const relayConfigPath = path.join(tempDir, 'template', 'relay.config.json');
  const gratsBin = path.join(PROJECT_ROOT, 'node_modules', '.bin', 'grats');
  const relayBin = getRelayCompilerBinary();

  // 1. Run grats to generate template/schema.graphql + schema.ts
  await run(gratsBin, ['--tsconfig', tsconfigPath]);

  // 2. Run relay-compiler to generate __generated__/ artifacts
  await run(relayBin, [relayConfigPath], {
    env: {FORCE_NO_WATCHMAN: '1'},
    cwd: path.join(tempDir, 'template'),
  });

  // 3. Typecheck the fixture plus the artifacts step 2 generated
  return typecheck(tempDir);
}
