/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

'use strict';

const {parseMarkdown} = require('../src/parseMarkdown');
const {runFixture} = require('../src/runFixture');
const {runInteractions} = require('../src/runInteractions');
const {setupTempDir} = require('../src/setupTempDir');
const {cleanup, render} = require('@testing-library/react');
const {readdirSync, readFileSync, writeFileSync} = require('fs');
const {rm} = require('fs/promises');
const path = require('path');
const React = require('react');

const fixturesDir = path.resolve(__dirname, '..', 'fixtures');

const fixtureFiles = readdirSync(fixturesDir, {recursive: true})
  .map(f => String(f))
  .filter(f => f.endsWith('.md') && !f.endsWith('.snap.md'));

function formatConsoleArgs(
  args: Array<mixed>,
  serverComponents: boolean = false,
): string {
  if (args.length === 0) {return '';}
  const first = args[0];
  if (typeof first === 'string' && args.length > 1) {
    let i = 1;
    const formatted = first.replace(/%[sdioOcf%]/g, match => {
      if (match === '%%') {return '%';}
      if (i >= args.length) {return match;}
      // `%c` styles the text after it, as in React's replayed server logs.
      if (serverComponents && match === '%c') {
        i++;
        return '';
      }
      return String(args[i++]);
    });
    const rest = args.slice(i);
    return [formatted, ...rest.map(String)].join(' ');
  }
  return args.map(String).join(' ');
}

/**
 * A fixture with a `Page.tsx` renders through the reference RSC host
 * (src/rsc/). A `hosts` block runs it once per host, compiled with that
 * host's `relayRsc.mode`; without one it runs once, under its config's mode.
 */
function getRscHosts(
  codeBlocks: Array<{filename: string, content: string}>,
  hosts: Array<string>,
): Array<?string> {
  if (!codeBlocks.some(block => block.filename === 'Page.tsx')) {
    return [null];
  }
  if (hosts.length > 0) {
    return hosts;
  }
  const config = codeBlocks.find(
    block => block.filename === 'relay.config.json',
  );
  return [JSON.parse(config?.content ?? '{}').relayRsc?.mode ?? 'nextjs'];
}

// Every host must render a fixture exactly as its first host did, whatever
// the snapshot update mode: under `-u`, hosts that disagree would otherwise
// each rewrite the one snapshot, and the last would win.
const firstHostOutputs: Map<string, string> = new Map();

// One test per fixture, as before; a Server Component fixture with a `hosts`
// block gets one per host. The hosts are found when tests are collected; a
// fixture that cannot be parsed then gets one test, which reports the error.
function getRuns(file: string) {
  const name = file.slice(0, -'.md'.length);
  let rscHosts: Array<?string> = [null];
  try {
    const {codeBlocks, hosts} = parseMarkdown(
      readFileSync(path.join(fixturesDir, file), 'utf-8'),
    );
    rscHosts = getRscHosts(codeBlocks, hosts);
  } catch {}
  return rscHosts.map(rscHost => ({
    file,
    name,
    rscHost,
    snapPath: path.join(fixturesDir, name + '.snap.md'),
    testName: rscHosts.length > 1 ? `${name} [${String(rscHost)}]` : name,
  }));
}

for (const run of fixtureFiles.flatMap(getRuns)) {
  const {file, name, rscHost, snapPath, testName} = run;
  test(testName, async () => {
    const markdown = readFileSync(path.join(fixturesDir, file), 'utf-8');
    const {codeBlocks, hosts, steps} = parseMarkdown(markdown);
    const tempDir = await setupTempDir(codeBlocks, {
      relayRscMode: hosts.length > 0 ? rscHost : null,
    });

    const logs: Array<string> = [];
    const logSpy = jest
      .spyOn(console, 'log')
      .mockImplementation((...args: Array<mixed>) => {
        logs.push(formatConsoleArgs(args, rscHost != null));
      });
    const warnSpy = jest
      .spyOn(console, 'warn')
      .mockImplementation((...args: Array<mixed>) => {
        logs.push(`warn: ${formatConsoleArgs(args, rscHost != null)}`);
      });
    const errorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation((...args: Array<mixed>) => {
        logs.push(`error: ${formatConsoleArgs(args, rscHost != null)}`);
      });

    let rsc = null;
    try {
      const typeErrors = await runFixture(tempDir);

      let container;
      if (rscHost == null) {
        // Dynamic import of the built App component
        // Jest's transform will handle TSX compilation
        const appPath = path.join(tempDir, 'template', 'App.tsx');
        const appModule = await import(appPath);
        const TestApp = appModule.default;

        // Render with React Testing Library
        ({container} = render(<TestApp />));
      } else {
        // Server Components render in a separate react-server process; this
        // realm hydrates the server-rendered HTML with the Flight stream.
        // Loaded only for Server Component fixtures.
        const {createRscSession} = require('../src/rsc/rscClient');
        rsc = createRscSession({
          fixtureDir: tempDir,
          // Gated content cannot finish before the steps release it, so the
          // HTML is sent as soon as the shell is ready.
          flushOnShell: steps.some(step => /^release\s/.test(step)),
          host: rscHost,
        });
        container = await rsc.render();
      }

      // Run interactions from the steps block
      if (steps.length > 0) {
        await runInteractions(steps, rsc?.steps);
      }

      // Build snapshot string
      const sections: Array<string> = [];

      // First, because it reflects the compile step that precedes the render.
      // Omitted entirely when clean, so a fixture that typechecks keeps a
      // snapshot with no trace of this section.
      if (typeErrors.length > 0) {
        sections.push('## Type Errors\n');
        sections.push('```\n' + typeErrors.join('\n') + '\n```\n');
      }

      if (logs.length > 0) {
        sections.push('## Console\n');
        sections.push('```\n' + logs.join('\n') + '\n```\n');
      }

      for (const [title, language, text] of rsc?.snapshotSections() ?? []) {
        sections.push(`## ${title}\n`);
        sections.push('```' + language + '\n' + text + '\n```\n');
      }

      sections.push('## HTML\n');
      sections.push('```html\n' + container.innerHTML + '\n```\n');

      // In a Server Component fixture, the temporary directory differs per run
      // (and per host), and React's development error stacks in the HTML can
      // include it.
      const actual =
        rscHost == null
          ? sections.join('\n')
          : sections.join('\n').split(tempDir + '/').join('');

      if (rscHost != null) {
        const first = firstHostOutputs.get(name);
        if (first == null) {
          firstHostOutputs.set(name, actual);
        } else {
          expect(actual).toBe(first);
        }
      }

      // File-based snapshot comparison
      let expected: string | null = null;
      try {
        expected = readFileSync(snapPath, 'utf-8');
      } catch {
        // Snap file doesn't exist yet
      }

      // Snapshots are plain files rather than jest's own `.snap` format so
      // they stay reviewable, but they follow jest's update semantics: `-u`
      // rewrites, `--ci` (or a detected CI environment) refuses to write.
      const snapshotState = expect.getState().snapshotState;
      const updateSnapshot = snapshotState?._updateSnapshot;
      // `_updateSnapshot` is private to jest. Fail loudly if it ever moves:
      // reading it as undefined would silently downgrade CI back to writing
      // snapshots and passing, which is the exact failure this guards against.
      if (
        updateSnapshot !== 'all' &&
        updateSnapshot !== 'new' &&
        updateSnapshot !== 'none'
      ) {
        throw new Error(
          "Could not read jest's snapshot update mode from " +
            '`expect.getState().snapshotState._updateSnapshot` (got ' +
            `${String(updateSnapshot)}). It is a private jest field, so a ` +
            'jest upgrade may have moved it; this test needs updating.',
        );
      }

      if (expected == null) {
        if (updateSnapshot === 'none') {
          snapshotState.unmatched++;
          throw new Error(
            `No snapshot file exists for fixture "${name}".\n\n` +
              `Expected to find: fixtures/${name}.snap.md\n\n` +
              'One was not generated because snapshots are never written in ' +
              'a continuous integration (CI) environment. If this fixture is ' +
              'new, run `yarn test:e2e` locally and commit the generated ' +
              'snapshot alongside it.',
          );
        }
        writeFileSync(snapPath, actual);
        snapshotState.added++;
      } else if (actual === expected) {
        snapshotState.matched++;
      } else if (updateSnapshot === 'all') {
        writeFileSync(snapPath, actual);
        snapshotState.updated++;
      } else {
        snapshotState.unmatched++;
        expect(actual).toBe(expected);
      }
    } catch (error) {
      // A Server Component failure usually starts in another process: report
      // every console with it.
      if (rsc != null && error instanceof Error) {
        error.message += `\n\nBrowser console:\n${logs.join('\n')}\n\n${rsc
          .snapshotSections()
          .map(([title, , text]) => `${title}:\n${text}`)
          .join('\n\n')}`;
      }
      throw error;
    } finally {
      logSpy.mockRestore();
      warnSpy.mockRestore();
      errorSpy.mockRestore();
      cleanup();
      await rsc?.dispose();
      if (process.env.RELAY_E2E_KEEP_TEMP_DIR) {
        process.stderr.write(`Kept ${testName} in ${tempDir}\n`);
      } else {
        await rm(tempDir, {recursive: true, force: true});
      }
    }
  });
}
