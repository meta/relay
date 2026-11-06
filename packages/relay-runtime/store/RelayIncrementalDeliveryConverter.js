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

import type {
  GraphQLResponseWithData,
  GraphQLSingularResponse,
  IncrementalDeliveryResponse,
  PayloadData,
  PayloadError,
  PayloadExtensions,
} from '../network/RelayNetworkTypes';

const invariant = require('invariant');

type Path = ReadonlyArray<string | number>;

/**
 * Converts one request's responses in GraphQL's incremental delivery format
 * (graphql-js 17's `experimentalExecuteIncrementally`) into the label/path
 * payloads Relay applies: each deferred fragment whole, from the data the
 * request's results have sent so far, and each streamed item at
 * `[...path, index]`. Responses in any other format pass through.
 */
class RelayIncrementalDeliveryConverter {
  _data: unknown = undefined;
  _errors: Array<PayloadError> = [];
  _pending: Map<string, {label: string, path: Path, nextIndex: ?number}> =
    new Map();
  _announced: Set<string> = new Set();
  _isIncrementalDelivery: boolean = false;

  convert(
    singular: GraphQLSingularResponse,
  ): ReadonlyArray<GraphQLSingularResponse> {
    const response: GraphQLSingularResponse | IncrementalDeliveryResponse =
      singular;
    if (!isIncrementalDeliveryResponse(response, this._isIncrementalDelivery)) {
      return [response.hasNext != null ? fromEarlierDraft(singular) : singular];
    }
    this._isIncrementalDelivery = true;
    const {completed, data, errors, hasNext, incremental, pending} = response;
    const payloads: Array<GraphQLSingularResponse> = [];
    this._errors.push(...(errors ?? []));
    if (data !== undefined) {
      this._data = data;
      // The last payload is marked final below.
      const extensions: PayloadExtensions = {
        ...response.extensions,
        is_final: false,
      };
      payloads.push(
        errors != null
          ? {data, errors: [...errors], extensions}
          : data != null
            ? {data, extensions}
            : {data: null, extensions},
      );
    }
    pending?.forEach(({id, label, path}) => {
      invariant(
        label != null,
        'RelayIncrementalDeliveryConverter: Expected pending result `%s` ' +
          'to have a label.',
        id,
      );
      this._pending.set(id, {label, nextIndex: null, path});
      this._announced.add(key(label, path));
    });
    // Deferred data first, so a stream announced in the same response finds
    // its list.
    incremental?.forEach(entry => {
      const entryData = entry.data;
      if (entryData != null) {
        const {path} = this._getPending(entry.id);
        this._data = mergeAt(
          this._data,
          [...path, ...(entry.subPath ?? [])],
          entryData,
        );
        this._errors.push(...(entry.errors ?? []));
      }
    });
    incremental?.forEach(({errors: itemErrors, id, items}) => {
      if (items == null) {
        return;
      }
      this._errors.push(...(itemErrors ?? []));
      const stream = this._getPending(id);
      const list = getAt(this._data, stream.path);
      const start = stream.nextIndex ?? (Array.isArray(list) ? list.length : 0);
      items.forEach((item, offset) => {
        const itemPath = [...stream.path, start + offset];
        this._data = mergeAt(this._data, itemPath, item);
        payloads.push(this._payload(stream.label, itemPath, item));
      });
      stream.nextIndex = start + items.length;
    });
    completed?.forEach(({errors: failure, id}) => {
      const {label, path} = this._getPending(id);
      this._pending.delete(id);
      const value = getAt(this._data, path);
      if (failure != null) {
        // Failed as a whole: a payload without data, as WWW sends.
        this._errors.push(...failure);
        payloads.push(this._payload(label, path, null));
      } else if (!Array.isArray(value)) {
        payloads.push(this._payload(label, path, value ?? {}));
      }
    });
    if (hasNext === false) {
      const last = payloads.pop();
      payloads.push(
        last != null
          ? {...last, extensions: {...last.extensions, is_final: true}}
          : {data: null, extensions: {is_final: true}},
      );
    }
    return payloads;
  }

  /**
   * The deferred fragment at `path` whole, when graphql-js did not announce
   * it: it leaves out a fragment whose fields earlier results all sent, but
   * announces the fragments deferred inside it, which Relay places only when
   * it applies the outer one.
   */
  unannouncedFragment(label: string, path: Path): ?GraphQLResponseWithData {
    if (!this._isIncrementalDelivery || this._announced.has(key(label, path))) {
      return null;
    }
    const data = asObject(getAt(this._data, path));
    if (data == null) {
      return null;
    }
    const errors = this._errorsUnder(path);
    return errors != null ? {data, errors} : {data};
  }

  _getPending(id: string): {label: string, path: Path, nextIndex: ?number} {
    const pending = this._pending.get(id);
    invariant(
      pending != null,
      'RelayIncrementalDeliveryConverter: Expected a pending result with id `%s`.',
      id,
    );
    return pending;
  }

  _payload(label: string, path: Path, value: unknown): GraphQLSingularResponse {
    const data = asObject(value);
    const errors = this._errorsUnder(path);
    return data == null
      ? {data: null, errors: errors ?? [], label, path: [...path]}
      : {data, errors: errors ?? undefined, label, path: [...path]};
  }

  // The errors under `path`, with paths relative to it.
  _errorsUnder(path: Path): ?Array<PayloadError> {
    const under = this._errors
      .filter(error => isUnder(error.path ?? [], path))
      .map(error => relativeTo(error, path));
    return under.length > 0 ? under : null;
  }
}

/**
 * A response of an earlier draft of incremental delivery (graphql-js 16's
 * experimental `@defer` and `@stream`), which has `hasNext`, as Relay applies
 * it: its errors' paths, which start at the root of the response, relative to
 * its `path`, and the bare `{hasNext: false}` sent when a stream ends after
 * its last item (its only field) as the end of the request.
 */
function fromEarlierDraft(
  response: GraphQLSingularResponse,
): GraphQLSingularResponse {
  if (Object.keys(response).length === 1) {
    return {data: null, extensions: {is_final: true}};
  }
  const {errors, path} = response;
  if (errors == null || path == null) {
    return response;
  }
  return {
    ...response,
    errors: errors.map(error =>
      isUnder(error.path ?? [], path) ? relativeTo(error, path) : error,
    ),
  };
}

function relativeTo(
  {extensions, locations, message, path: errorPath, severity}: PayloadError,
  path: Path,
): PayloadError {
  return {
    extensions,
    locations,
    message,
    path: errorPath?.slice(path.length),
    severity,
  };
}

function isUnder(fullPath: Path, path: Path): boolean {
  return (
    fullPath.length >= path.length &&
    path.every((k, i) => String(fullPath[i]) === String(k))
  );
}

/**
 * Whether `response` is in GraphQL's incremental delivery format: it has
 * `hasNext`, no `label` or `path`, and a field only this format has, or the
 * request's earlier responses were in this format. The first response of the
 * 2022 draft format, `{data, hasNext}`, followed by label/path results, is not.
 */
function isIncrementalDeliveryResponse(
  response: GraphQLSingularResponse | IncrementalDeliveryResponse,
  isKnownFormat: boolean,
): implies response is IncrementalDeliveryResponse {
  return (
    response.label == null &&
    response.path == null &&
    response.hasNext != null &&
    (isKnownFormat ||
      response.pending != null ||
      response.completed != null ||
      (response.incremental?.some(entry => entry.id != null) ?? false))
  );
}

function key(label: string, path: Path): string {
  return `${label}\u0000${path.map(String).join('.')}`;
}

function asObject(value: unknown): ?PayloadData {
  return value != null && typeof value === 'object' && !Array.isArray(value)
    ? value
    : null;
}

function getAt(value: unknown, path: Path): unknown {
  let current = value;
  for (let i = 0; i < path.length; i++) {
    current = Array.isArray(current)
      ? current[Number(path[i])]
      : asObject(current)?.[String(path[i])];
  }
  return current;
}

// `value` with `incoming` merged in at `path`, copying what it changes so
// payloads already passed on stay as they were.
function mergeAt(value: unknown, path: Path, incoming: unknown): unknown {
  if (path.length === 0) {
    return merge(value, incoming);
  }
  const [head, ...rest] = path;
  if (typeof head === 'number') {
    const list = Array.isArray(value) ? [...value] : [];
    list[head] = mergeAt(list[head], rest, incoming);
    return list;
  }
  return {
    ...asObject(value),
    [head]: mergeAt(asObject(value)?.[head], rest, incoming),
  };
}

function merge(value: unknown, incoming: unknown): unknown {
  const object = asObject(value);
  const incomingObject = asObject(incoming);
  if (object == null || incomingObject == null) {
    return incoming === undefined ? value : incoming;
  }
  const merged: {[key: string]: unknown} = {...object};
  Object.keys(incomingObject).forEach(k => {
    merged[k] = merge(merged[k], incomingObject[k]);
  });
  return merged;
}

module.exports = RelayIncrementalDeliveryConverter;
