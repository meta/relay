/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 * @format
 * @oncall relay
 */

import type {ActorIdentifier} from '../multi-actor-environment/ActorIdentifier';
import type {PayloadData} from '../network/RelayNetworkTypes';
import type {
  NormalizationField,
  NormalizationLinkedField,
  NormalizationNode,
} from '../util/NormalizationNode';
import type {DataID, Variables} from '../util/RelayRuntimeTypes';
import type {NormalizationOptions} from './RelayResponseNormalizer';
import type {GetDataID} from './RelayResponseNormalizer';
import type {
  IncrementalDataPlaceholder,
  NormalizationSelector,
} from './RelayStoreTypes';

const {
  CLIENT_EXTENSION,
  CONDITION,
  DEFER,
  FRAGMENT_SPREAD,
  INLINE_FRAGMENT,
  LINKED_FIELD,
  LINKED_HANDLE,
  SCALAR_FIELD,
  SCALAR_HANDLE,
} = require('../util/RelayConcreteNode');
const {getLocalVariables} = require('./RelayConcreteVariables');
const {createNormalizationSelector} = require('./RelayModernSelector');
const {ROOT_TYPE, TYPENAME_KEY, getStorageKey} = require('./RelayStoreUtils');
const invariant = require('invariant');
const {generateClientID} = require('relay-runtime');

/**
 * This module is an experiment to explore a proposal normalized response format for GraphQL.
 * See the Quip document: Canonical Normalized Response Format (“GraphMode”) Proposal
 */

/**
 * # TODO
 *
 * - [ ] Compute storage keys using method outlined in the proposal
 * - [ ] Plural fields
 * - [ ] Write a utility to populate the store using a GraphMode response.
 */

export type ScalarField = string | number | null;
export type LinkedField =
  | {
      __id: number,
    }
  | {
      __ids: Array<number | null>,
    };

export type ChunkField = ScalarField | Array<ScalarField> | LinkedField;

export type ChunkFields = {
  [key: string]: ChunkField,
};

export type RecordChunk = {
  $kind: 'Record',
  $streamID: number,
  __id: string,
  __typename: string,
  [key: string]: ChunkField,
};

export type ExtendChunk = {
  $kind: 'Extend',
  $streamID: number,
  [key: string]: ChunkField,
};

export type CompleteChunk = {
  $kind: 'Complete',
};

export type DataChunk = RecordChunk | ExtendChunk;

export type GraphModeChunk = DataChunk | CompleteChunk;

export type GraphModeResponse = Iterable<GraphModeChunk>;

export type TransformMetadata = {
  duplicateFieldsAvoided: number,
};

/**
 * Converts a JSON response (and Normalization AST) into a stream of GraphMode chunks
 *
 * The stream is modeled as a Generator in order to highlight the streaming
 * nature of the response. Once a chunk is generated, it can be immediately flushed
 * to the client.
 *
 * The response is traversed depth-first, meaning children are emitted before
 * the parent. This allows parent objects to reference children using their
 * `$streamID`.
 *
 * After each object is traversed, a chunk is emitted. The first time an object
 * -- identified by its strong ID -- is encountered we emit a `Record`, and its
 * `$streamID` is recorded. If that same object is encountered again later in
 * the response, an `Extend` chunk is emitted, which includes any previously
 * unsent fields. If no unsent fields are present in the second appearance of
 * the new object, no chunk is emitted.
 *
 * ## State
 *
 * As we traverse we must maintain some state:
 *
 * - The next streamID
 * - A mapping of cache keys to streamIDs
 * - The set of fields which we've sent for each streamID. This allows us to
 *   avoid sending fields twice.
 */
export function normalizeResponse(
  response: PayloadData,
  selector: NormalizationSelector,
  options: NormalizationOptions,
): GraphModeResponse {
  const {node, variables, dataID} = selector;
  const normalizer = new GraphModeNormalizer(variables, options);
  return normalizer.normalizeResponse(node, dataID, response);
}

export function normalizeResponseWithMetadata(
  response: PayloadData,
  selector: NormalizationSelector,
  options: NormalizationOptions,
): [Array<GraphModeChunk>, TransformMetadata] {
  const {node, variables, dataID} = selector;
  const normalizer = new GraphModeNormalizer(variables, options);
  const chunks = Array.from(
    normalizer.normalizeResponse(node, dataID, response),
  );
  return [chunks, {duplicateFieldsAvoided: normalizer.duplicateFieldsAvoided}];
}

export class GraphModeNormalizer {
  _cacheKeyToStreamID: Map<string, number>;
  _sentFields: Map<string, Set<string>>;
  _nextStreamID: number;
  _getDataID: GetDataID;
  _variables: Variables;
  _path: Array<string>;
  _incrementalPlaceholders: Array<IncrementalDataPlaceholder>;
  _actorIdentifier: ?ActorIdentifier;
  duplicateFieldsAvoided: number;
  constructor(variables: Variables, options: NormalizationOptions) {
    this._actorIdentifier = options.actorIdentifier;
    this._path = options.path ? [...options.path] : [];
    this._getDataID = options.getDataID;
    this._cacheKeyToStreamID = new Map();
    this._sentFields = new Map();
    this._nextStreamID = 0;
    this._variables = variables;
    this.duplicateFieldsAvoided = 0;
  }

  _getStreamID(): number {
    return this._nextStreamID++;
  }

  _getSentFields(cacheKey: string): Set<string> {
    const maybeSent = this._sentFields.get(cacheKey);
    if (maybeSent != null) {
      return maybeSent;
    }
    const sent = new Set<string>();
    this._sentFields.set(cacheKey, sent);
    return sent;
  }

  _getObjectType(data: PayloadData): string {
    const typeName = (data as any)[TYPENAME_KEY];
    invariant(
      typeName != null,
      'Expected a typename for record `%s`.',
      JSON.stringify(data, null, 2),
    );
    return typeName;
  }

  // TODO: The GraphMode proposal outlines different approachs to derive keys. We
  // can expriment with different approaches here.
  _getStorageKey(selection: NormalizationField): string {
    return getStorageKey(selection, this._variables);
  }

  _getVariableValue(name: string): unknown {
    invariant(
      this._variables.hasOwnProperty(name),
      'Unexpected undefined variable `%s`.',
      name,
    );
    return this._variables[name];
  }

  *normalizeResponse(
    node: NormalizationNode,
    dataID: DataID,
    data: PayloadData,
  ): Generator<GraphModeChunk, void, void> {
    const rootFields: ChunkFields = {};
    yield* this._traverseSelections(node, data, rootFields, dataID, new Set());

    const $streamID = this._getStreamID();
    yield {
      ...rootFields,
      __id: dataID,
      __typename: ROOT_TYPE,
      $kind: 'Record',
      $streamID,
    } as RecordChunk;
    yield {
      $kind: 'Complete',
    } as CompleteChunk;
  }

  *_flushFields(
    cacheKey: string,
    typename: string,
    fields: ChunkFields,
  ): Generator<GraphModeChunk, number, void> {
    const maybeStreamID = this._cacheKeyToStreamID.get(cacheKey);
    const $streamID = maybeStreamID ?? this._getStreamID();
    if (maybeStreamID == null) {
      this._cacheKeyToStreamID.set(cacheKey, $streamID);
      // TODO: We could mutate `fields` rather than constructing a new
      // chunk object, but it's hard to convince Flow that we've
      // constructed a valid Chunk, and perf is not important for this
      // experimental transform
      yield {
        ...fields,
        __id: cacheKey,
        __typename: typename,
        $kind: 'Record',
        $streamID,
      } as RecordChunk;
    } else if (Object.keys(fields).length > 0) {
      yield {...fields, $kind: 'Extend', $streamID} as ExtendChunk;
    }
    return $streamID;
  }

  *_traverseSelections(
    node: NormalizationNode,
    data: PayloadData,
    parentFields: ChunkFields,
    parentID: string,
    sentFields: Set<string>,
  ): Generator<GraphModeChunk, void, void> {
    const selections = node.selections;

    for (const selection of selections) {
      switch (selection.kind) {
        case LINKED_FIELD: {
          const responseKey = selection.alias ?? selection.name;
          const fieldData: PayloadData = data[responseKey] as any;

          const storageKey = this._getStorageKey(selection);

          this._path.push(responseKey);

          const fieldValue = yield* this._traverseLinkedField(
            selection.plural,
            fieldData,
            storageKey,
            selection,
            parentID,
          );

          this._path.pop();

          // TODO: We could also opt to confirm that this matches the previously
          // seen value.
          if (sentFields.has(storageKey)) {
            this.duplicateFieldsAvoided++;
            break;
          }

          parentFields[storageKey] = fieldValue;
          sentFields.add(storageKey);
          break;
        }
        case SCALAR_FIELD: {
          const responseKey = selection.alias ?? selection.name;

          const storageKey = this._getStorageKey(selection);

          // TODO: We could also opt to confirm that this matches the previously
          // seen value.
          if (sentFields.has(storageKey)) {
            this.duplicateFieldsAvoided++;
            break;
          }
          const fieldData: ChunkField = data[responseKey] as any;

          parentFields[storageKey] = fieldData;
          sentFields.add(storageKey);
          break;
        }
        case INLINE_FRAGMENT: {
          const objType = this._getObjectType(data);
          const {abstractKey} = selection;
          if (abstractKey == null) {
            if (objType !== selection.type) {
              break;
            }
          } else if (!data.hasOwnProperty(abstractKey)) {
            break;
          }
          yield* this._traverseSelections(
            selection,
            data,
            parentFields,
            parentID,
            sentFields,
          );
          break;
        }
        case FRAGMENT_SPREAD: {
          const prevVariables = this._variables;
          this._variables = getLocalVariables(
            this._variables,
            selection.fragment.argumentDefinitions,
            selection.args,
          );
          yield* this._traverseSelections(
            selection.fragment,
            data,
            parentFields,
            parentID,
            sentFields,
          );
          this._variables = prevVariables;
          break;
        }
        case CONDITION:
          const conditionValue = Boolean(
            this._getVariableValue(selection.condition),
          );
          if (conditionValue === selection.passingValue) {
            yield* this._traverseSelections(
              selection,
              data,
              parentFields,
              parentID,
              sentFields,
            );
          }
          break;
        case DEFER:
          const isDeferred =
            selection.if === null || this._getVariableValue(selection.if);
          if (isDeferred === false) {
            // If defer is disabled there will be no additional response chunk:
            // normalize the data already present.
            yield* this._traverseSelections(
              selection,
              data,
              parentFields,
              parentID,
              sentFields,
            );
          } else {
            // Otherwise data *for this selection* should not be present: enqueue
            // metadata to process the subsequent response chunk.
            this._incrementalPlaceholders.push({
              actorIdentifier: this._actorIdentifier,
              data,
              kind: 'defer',
              label: selection.label,
              path: [...this._path],
              selector: createNormalizationSelector(
                selection,
                parentID,
                this._variables,
              ),
              typeName: this._getObjectType(data),
            });
          }
          break;
        case CLIENT_EXTENSION:
          // Since we are only expecting to handle server responses, we can skip
          // over client extensions.
          break;
        case SCALAR_HANDLE:
        case LINKED_HANDLE:
          // Handles allow us to record information that will be needed to
          // perform additional process when we insert data into the store. For
          // example, connection edges need to be prepended/appended to the
          // pre-existing values.
          //
          // GraphMode will eventually need some replacement for this, but it is
          // not nessesary in order to measure things like response size, so we
          // can ignore these for now.
          break;
        default:
          throw new Error(`Unexpected selection type: ${selection.kind}`);
      }
    }
  }

  *_traverseLinkedField(
    plural: boolean,
    fieldData: PayloadData,
    storageKey: string,
    selection: NormalizationLinkedField,
    parentID: string,
    index?: number,
  ): Generator<GraphModeChunk, ChunkField, void> {
    if (fieldData == null) {
      return null;
    }

    if (plural) {
      invariant(
        Array.isArray(fieldData),
        `Expected fieldData to be an array. Got ${JSON.stringify(fieldData)}`,
      );

      const fieldValue = [];
      for (const [i, itemData] of fieldData.entries()) {
        this._path.push(String(i));
        const itemValue = yield* this._traverseLinkedField(
          false,
          itemData,
          storageKey,
          selection,
          parentID,
          i,
        );
        this._path.pop();
        fieldValue.push(itemValue);
      }

      const ids = fieldValue.map(value => {
        if (value == null) {
          return null;
        }
        invariant(
          typeof value.__id === 'number',
          'Expected objects in a plural linked field to have an __id.',
        );
        return value.__id;
      });

      return {__ids: ids};
    }

    invariant(
      typeof fieldData === 'object',
      'Expected data for field `%s` to be an object.',
      storageKey,
    );

    const objType = selection.concreteType ?? this._getObjectType(fieldData);

    const nextID =
      this._getDataID(fieldData, objType) ||
      // Note: In RelayResponseNormalizer we try to access a cached
      // version of the key before generating a new one. I'm not clear if
      // that's a performance optimization (which would not be important
      // here) or important for stable ids.

      // TODO: The proposal does not yet specify how we handle objects
      // without strong ids.
      generateClientID(parentID, storageKey, index);

    invariant(
      typeof nextID === 'string',
      'Expected id on field `%s` to be a string.',
      storageKey,
    );

    const fields: ChunkFields = {};

    // Yield any decendent record chunks, and mutatively populate direct fields.
    yield* this._traverseSelections(
      selection,
      fieldData,
      fields,
      nextID,
      this._getSentFields(nextID),
    );

    const $streamID = yield* this._flushFields(nextID, objType, fields);

    return {__id: $streamID};
  }
}
