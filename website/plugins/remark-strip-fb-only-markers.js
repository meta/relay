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

// When the docs are exported from Meta's internal repository, lines that only
// make sense internally are replaced with a bare `// @fb-only` marker. MDX
// treats those markers as regular text, so without this plugin they render as
// a visible "// @fb-only" paragraph on the public site. This plugin removes
// any paragraph whose only content is such a marker.

const MARKER = /^\/\/\s*@fb-only$/;

function isMarkerParagraph(node) {
  return (
    node.type === 'paragraph' &&
    node.children.length === 1 &&
    node.children[0].type === 'text' &&
    MARKER.test(node.children[0].value.trim())
  );
}

function strip(node) {
  if (!Array.isArray(node.children)) {
    return;
  }
  node.children = node.children.filter(child => !isMarkerParagraph(child));
  node.children.forEach(strip);
}

module.exports = function remarkStripFbOnlyMarkers() {
  return strip;
};
