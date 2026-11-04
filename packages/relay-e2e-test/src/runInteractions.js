/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

'use strict';

import {act, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

type Step = {
  action: 'click' | 'type' | 'wait',
  role?: string,
  name: string,
  value?: string,
};

/** What a Server Component fixture's session provides (src/rsc/rscClient.js). */
export type RscSteps = {
  countFlightRows: () => Promise<{rows: number, outlined: number}>,
  countRequests: (request: string) => number,
  navigate: (search: string) => void,
  readWire: () => Promise<string>,
  releaseGate: (name: string) => Promise<void>,
};

const USAGE = `Expected step syntax:
  click "Name"             — click element with text "Name"
  click role "Name"        — click element with ARIA role and accessible name
  type "Name" "value"      — type into element with text "Name"
  type role "Name" "value" — type into element with ARIA role and accessible name
  wait "Text"              — wait for element with text "Text" to appear

  Server Component fixtures (with a Page.tsx) also support:
  navigate "?id=2"           — render the page for new search params, in a transition
  release "gate"             — open the gate server code awaits with waitForGate("gate")
  wire-excludes "Text"       — assert the browser has not received "Text", once every
                               response so far is complete
  requests "POST /graphql" 0 — assert how many such requests the browser has sent
  outlined-rows 0            — assert how many outlined rows the latest page's Flight
                               response has, once it is complete (see countFlightRows
                               in src/rsc/wireProtocol.js)

  role = button | link | textbox | checkbox | etc. (any ARIA role)
  "Name" = accessible name or visible text (must be quoted)`;

function tokenize(line: string): Array<string> {
  const tokens: Array<string> = [];
  const tokenRegex = /("(?:[^"\\]|\\.)*"|\S+)/g;
  let match;
  while ((match = tokenRegex.exec(line)) !== null) {
    tokens.push(match[1]);
  }
  return tokens;
}

function expectQuoted(
  token: string | void,
  label: string,
  line: string,
): string {
  if (token == null) {
    throw new Error(`Missing ${label} in step: ${line}\n\n${USAGE}`);
  }
  if (!token.startsWith('"') || !token.endsWith('"')) {
    throw new Error(
      `${label} must be quoted in step: ${line}\n  Got: ${token}\n\n${USAGE}`,
    );
  }
  return token.slice(1, -1);
}

/**
 * Parses a DSL line into a Step.
 *
 * Supported formats:
 *   click "Name"              -> getByText("Name") + click
 *   click role "Name"         -> getByRole("role", { name: "Name" }) + click
 *   type "Name" "value"       -> getByText("Name") + type
 *   type role "Name" "value"  -> getByRole("role", { name: "Name" }) + type
 */
function parseStep(line: string): Step {
  const tokens = tokenize(line);

  if (tokens.length === 0) {
    throw new Error(`Empty step\n\n${USAGE}`);
  }

  const action = tokens[0];
  if (action !== 'click' && action !== 'type' && action !== 'wait') {
    throw new Error(
      `Unknown action "${action}" in step: ${line}\n  Supported actions: click, type, wait\n\n${USAGE}`,
    );
  }

  if (tokens.length < 2) {
    throw new Error(
      `Missing arguments for "${action}" in step: ${line}\n\n${USAGE}`,
    );
  }

  if (action === 'wait') {
    if (tokens[1].startsWith('"')) {
      if (tokens.length > 2) {
        throw new Error(
          `Too many arguments for wait in step: ${line}\n  Expected: wait "Text" or wait role "Name"\n\n${USAGE}`,
        );
      }
      return {action, name: expectQuoted(tokens[1], 'name', line)};
    }
    // wait role "Name"
    const role = tokens[1];
    const name = expectQuoted(tokens[2], 'name', line);
    if (tokens.length > 3) {
      throw new Error(
        `Too many arguments for wait in step: ${line}\n  Expected: wait ${role} "Name"\n\n${USAGE}`,
      );
    }
    return {action, role, name};
  }

  if (action === 'click') {
    if (tokens[1].startsWith('"')) {
      // click "Name"
      if (tokens.length > 2) {
        throw new Error(
          `Too many arguments for click in step: ${line}\n  Expected: click "Name" or click role "Name"\n\n${USAGE}`,
        );
      }
      return {action, name: expectQuoted(tokens[1], 'name', line)};
    }
    // click role "Name"
    const role = tokens[1];
    const name = expectQuoted(tokens[2], 'name', line);
    if (tokens.length > 3) {
      throw new Error(
        `Too many arguments for click in step: ${line}\n  Expected: click ${role} "Name"\n\n${USAGE}`,
      );
    }
    return {action, role, name};
  }

  // type
  if (tokens[1].startsWith('"')) {
    // type "Name" "value"
    const name = expectQuoted(tokens[1], 'name', line);
    const value = expectQuoted(tokens[2], 'value', line);
    if (tokens.length > 3) {
      throw new Error(
        `Too many arguments for type in step: ${line}\n  Expected: type "Name" "value" or type role "Name" "value"\n\n${USAGE}`,
      );
    }
    return {action, name, value};
  }
  // type role "Name" "value"
  const role = tokens[1];
  const name = expectQuoted(tokens[2], 'name', line);
  const value = expectQuoted(tokens[3], 'value', line);
  if (tokens.length > 4) {
    throw new Error(
      `Too many arguments for type in step: ${line}\n  Expected: type ${role} "Name" "value"\n\n${USAGE}`,
    );
  }
  return {action, role, name, value};
}

function expectCount(token: string | void, line: string): number {
  if (token == null || !/^\d+$/.test(token)) {
    throw new Error(`Expected a count in step: ${line}\n\n${USAGE}`);
  }
  return Number(token);
}

const RSC_ACTIONS = [
  'navigate',
  'release',
  'wire-excludes',
  'requests',
  'outlined-rows',
];

/** Runs `line` if it is a Server Component step; returns whether it was. */
async function runRscStep(line: string, rsc: ?RscSteps): Promise<boolean> {
  const [action, argument, count, ...extra] = tokenize(line);
  if (!RSC_ACTIONS.includes(action)) {
    return false;
  }
  if (rsc == null) {
    throw new Error(
      `Step "${line}" needs a Server Component fixture (one with a Page.tsx).`,
    );
  }
  if (extra.length > 0 || (count != null && action !== 'requests')) {
    throw new Error(`Too many arguments in step: ${line}\n\n${USAGE}`);
  }
  switch (action) {
    case 'navigate': {
      const search = expectQuoted(argument, 'search', line);
      await act(async () => rsc.navigate(search));
      break;
    }
    case 'release': {
      const gate = expectQuoted(argument, 'gate', line);
      await act(() => rsc.releaseGate(gate));
      break;
    }
    case 'wire-excludes': {
      const text = expectQuoted(argument, 'text', line);
      const wire = await rsc.readWire();
      // As sent, inside JSON, and as escaped HTML text.
      const forms = [
        text,
        JSON.stringify(text).slice(1, -1),
        text
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#x27;'),
      ];
      if (forms.some(form => wire.includes(form))) {
        throw new Error(`Step "${line}" failed: "${text}" reached the browser.`);
      }
      break;
    }
    case 'requests': {
      const found = rsc.countRequests(expectQuoted(argument, 'request', line));
      if (found !== expectCount(count, line)) {
        throw new Error(`Step "${line}" failed: the browser made ${found}.`);
      }
      break;
    }
    case 'outlined-rows': {
      const {outlined, rows} = await rsc.countFlightRows();
      if (outlined !== expectCount(argument, line)) {
        throw new Error(
          `Step "${line}" failed: the latest page's Flight response has ` +
            `${outlined} outlined rows (${rows} rows in all).`,
        );
      }
      break;
    }
  }
  return true;
}

function getElement(step: Step): HTMLElement {
  if (step.role) {
    return screen.getByRole(step.role, {name: step.name});
  }
  return screen.getByText(step.name);
}

export async function runInteractions(
  steps: Array<string>,
  rsc?: ?RscSteps,
): Promise<void> {
  const user = userEvent.setup();
  for (const line of steps) {
    // Other fixtures run their steps exactly as before, with no extra await.
    if (rsc != null && (await runRscStep(line, rsc))) {
      continue;
    }
    const step = parseStep(line);
    switch (step.action) {
      case 'wait':
        if (rsc != null) {
          // In a Server Component fixture, several elements may match (e.g.
          // two consumers of the same data), and data crosses processes over
          // real HTTP, so it gets longer than testing-library's 1s default.
          if (step.role) {
            await screen.findAllByRole(
              step.role,
              {name: step.name},
              {timeout: 5000},
            );
          } else {
            await screen.findAllByText(
              step.name,
              {exact: false},
              {timeout: 5000},
            );
          }
        } else if (step.role) {
          await screen.findByRole(step.role, {name: step.name});
        } else {
          await screen.findByText(step.name, {exact: false});
        }
        break;
      case 'click':
        await user.click(getElement(step));
        break;
      case 'type':
        await user.type(getElement(step), step.value || '');
        break;
    }
  }
}
