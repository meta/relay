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

'use strict';

import type {
  NormalizationField,
  NormalizationSelection,
} from '../util/NormalizationNode';
import type {ConcreteRequest} from '../util/RelayConcreteNode';
import type {Variables} from '../util/RelayRuntimeTypes';

const warning = require('warning');

type ValidationContext = {
  visitedPaths: Set<string>,
  path: string,
  variables: Variables,
  missingDiff: any,
  extraDiff: any,
  moduleImportPaths: Set<string>,
};
// $FlowFixMe[method-unbinding] added when improving typing for this parameters
const hasOwnProperty = Object.prototype.hasOwnProperty;

let validateMutation:
  | (() => void)
  | ((
      optimisticResponse: any,
      mutation: ConcreteRequest,
      variables: ?any,
    ) => void) = () => {};
if (__DEV__) {
  const addFieldToDiff = (
    path: string,
    diff: any,
    isScalar: void | boolean,
  ) => {
    let deepLoc = diff;
    path.split('.').forEach((key, index, arr) => {
      if (deepLoc[key] == null) {
        deepLoc[key] = {};
      }
      if (isScalar && index === arr.length - 1) {
        deepLoc[key] = '<scalar>';
      }
      deepLoc = deepLoc[key];
    });
  };
  validateMutation = (
    optimisticResponse: any,
    mutation: ConcreteRequest,
    variables: ?any,
  ) => {
    const operationName = mutation.operation.name;
    const context: ValidationContext = {
      extraDiff: {},
      missingDiff: {},
      moduleImportPaths: new Set(),
      path: 'ROOT',
      variables: variables || {},
      visitedPaths: new Set(),
    };
    validateSelections(
      optimisticResponse,
      mutation.operation.selections,
      context,
    );
    validateOptimisticResponse(optimisticResponse, context);
    warning(
      context.missingDiff.ROOT == null,
      'Expected `optimisticResponse` to match structure of server response for mutation `%s`, please define fields for all of\n%s',
      operationName,
      JSON.stringify(context.missingDiff.ROOT, null, 2),
    );
    warning(
      context.extraDiff.ROOT == null,
      'Expected `optimisticResponse` to match structure of server response for mutation `%s`, please remove all fields of\n%s',
      operationName,
      JSON.stringify(context.extraDiff.ROOT, null, 2),
    );
  };

  const validateSelections = (
    optimisticResponse: any,
    selections: ReadonlyArray<NormalizationSelection>,
    context: ValidationContext,
  ) => {
    selections.forEach(selection =>
      validateSelection(optimisticResponse, selection, context),
    );
  };

  const validateSelection = (
    optimisticResponse: any,
    selection: NormalizationSelection,
    context: ValidationContext,
  ): void => {
    switch (selection.kind) {
      case 'Condition':
        validateSelections(optimisticResponse, selection.selections, context);
        return;
      case 'FragmentSpread':
        validateSelections(
          optimisticResponse,
          selection.fragment.selections,
          context,
        );
        return;
      case 'ScalarField':
      case 'LinkedField':
        return validateField(optimisticResponse, selection, context);
      case 'ActorChange':
        return validateField(
          optimisticResponse,
          selection.linkedField,
          context,
        );
      case 'InlineFragment':
        const type = selection.type;
        const isConcreteType = selection.abstractKey == null;
        validateAbstractKey(context, selection.abstractKey);
        selection.selections.forEach(subselection => {
          if (isConcreteType && optimisticResponse.__typename !== type) {
            return;
          }
          validateSelection(optimisticResponse, subselection, context);
        });
        return;
      case 'ClientExtension':
        selection.selections.forEach(subselection => {
          validateSelection(optimisticResponse, subselection, context);
        });
        return;
      case 'ModuleImport':
        return validateModuleImport(context);
      case 'TypeDiscriminator':
        return validateAbstractKey(context, selection.abstractKey);
      case 'ClientEdgeToClientObject':
      case 'ClientEdgeToServerObject':
      case 'LinkedHandle':
      case 'ScalarHandle':
      case 'Defer':
      case 'Stream':
      case 'RelayResolver':
      case 'RelayLiveResolver': {
        // TODO(T35864292) - Add missing validations for these types
        return;
      }
      default:
        selection as empty;
        return;
    }
  };

  const validateModuleImport = (context: ValidationContext) => {
    context.moduleImportPaths.add(context.path);
  };

  const validateAbstractKey = (
    context: ValidationContext,
    abstractKey: ?string,
  ) => {
    if (abstractKey != null) {
      const path = `${context.path}.${abstractKey}`;
      context.visitedPaths.add(path);
    }
  };

  const validateField = (
    optimisticResponse: any,
    field: NormalizationField,
    context: ValidationContext,
  ) => {
    const fieldName = field.alias || field.name;
    const path = `${context.path}.${fieldName}`;
    context.visitedPaths.add(path);
    switch (field.kind) {
      case 'ScalarField':
        /* $FlowFixMe[invalid-this-arg] Error exposed after fixing this typing
         * unsoundness in flow */
        if (hasOwnProperty.call(optimisticResponse, fieldName) === false) {
          addFieldToDiff(path, context.missingDiff, true);
        }
        return;
      case 'LinkedField':
        const selections = field.selections;
        if (
          optimisticResponse[fieldName] === null ||
          /* $FlowFixMe[invalid-this-arg] Error exposed after fixing this
           * typing unsoundness in flow */
          (hasOwnProperty.call(optimisticResponse, fieldName) &&
            optimisticResponse[fieldName] === undefined)
        ) {
          return;
        }
        if (field.plural) {
          if (Array.isArray(optimisticResponse[fieldName])) {
            optimisticResponse[fieldName].forEach(r => {
              if (r !== null) {
                validateSelections(r, selections, {
                  ...context,
                  path,
                });
              }
            });
            return;
          } else {
            addFieldToDiff(path, context.missingDiff);
            return;
          }
        } else {
          if (optimisticResponse[fieldName] instanceof Object) {
            validateSelections(optimisticResponse[fieldName], selections, {
              ...context,
              path,
            });
            return;
          } else {
            addFieldToDiff(path, context.missingDiff);
            return;
          }
        }
    }
  };

  const validateOptimisticResponse = (
    optimisticResponse: any,
    context: ValidationContext,
  ) => {
    if (Array.isArray(optimisticResponse)) {
      optimisticResponse.forEach(r => {
        if (r instanceof Object) {
          validateOptimisticResponse(r, context);
        }
      });
      return;
    }
    Object.keys(optimisticResponse).forEach((key: string) => {
      const value = optimisticResponse[key];
      const path = `${context.path}.${key}`;
      // if it's a module import path we don't have an ast so we cannot validate it
      if (context.moduleImportPaths.has(path)) {
        return;
      }
      if (!context.visitedPaths.has(path)) {
        addFieldToDiff(path, context.extraDiff);
        return;
      }
      if (value instanceof Object) {
        validateOptimisticResponse(value, {
          ...context,
          path,
        });
      }
    });
  };
}

module.exports = validateMutation as (
  v0: any,
  v1: ConcreteRequest,
  v2: ?any,
) => void;
