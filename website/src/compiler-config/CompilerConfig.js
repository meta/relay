/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @format
 */

import * as React from 'react';
import {useMemo} from 'react';

/**
 * Generate documentation for the Relay Compiler Config Schema dynamically from
 * the JSON schema, which is itself generated from our Rust structs/enums.
 *
 * The output is formatted to resemble the TypeScript type definitions since we
 * expect Relay users are intuitively familiar with TypeScript.
 *
 * This component will get executed during build time, so it should be written
 * defensively. It's okay for us to only handle a subset of the JSON schema as long
 * as we explicitly throw on any unhandled cases. If no config options are added
 * which exercise these unhandled cases, the build will fail and we can add support for
 * them at that point.
 */

export default function CompilerConfig({schema, definitions}) {
  const indirections = useIndirections(schema);
  return (
    <Schema
      schema={schema}
      indirections={indirections}
      definitions={definitions}
    />
  );
}

function Schema({schema, indirections, definitions}) {
  const defs = definitions ?? schema.$defs;
  if (defs == null) {
    throw new Error(
      'Expected schema to have $defs or have non-standard definitions explicitly passed in.',
    );
  }
  return (
    <div className="json-schema">
      <SchemaDefinition
        definition={schema}
        name={schema.title}
        indirections={indirections}
      />
      {defs != null &&
        Object.entries(defs).map(([name, definition], index) => {
          return (
            <SchemaDefinition
              key={index}
              definition={definition}
              name={name}
              indirections={indirections}
            />
          );
        })}
    </div>
  );
}

function SchemaDefinition({definition, name, indirections}) {
  if (indirections.getInlineDef(definition)) {
    // If this type is rendered inline, we don't need to render its definition.
    return null;
  }
  switch (definition.type) {
    case 'object':
      return (
        <SchemaObjectDefinition
          definition={definition}
          name={name}
          indirections={indirections}
        />
      );
    case 'array':
      throw new Error('Expected array type to be handled as indirection');
    case 'string':
      if (definition.enum) {
        return <SchemaEnumDefinition definition={definition} name={name} />;
      }
      throw new Error('Expected string type to be handled as indirection');
    default:
      if (definition.$ref) {
        throw new Error('Expected $ref type to be handled as indirection');
      }
      if (definition.oneOf && definition.oneOf.length > 0) {
        return (
          <SchemaOneOfDefinition
            definition={definition}
            name={name}
            indirections={indirections}
          />
        );
      }
      if (definition.anyOf && definition.anyOf.length > 0) {
        return (
          <SchemaAnyOfDefinition
            definition={definition}
            name={name}
            indirections={indirections}
          />
        );
      }
      if (definition.allOf) {
        throw new Error('Expected allOf to be handled as indirection');
      }
      throw new Error('Unhandled definition type');
  }
}

function SchemaEnumDefinition({definition, name}) {
  return (
    <Definition name={name} description={definition.description}>
      <summary>
        type {name} {' ='}
      </summary>
      {definition.enum.map((item, index) => {
        return (
          <div className="property" key={index}>
            {item.description && (
              <div className="description">{' // ' + item.description}</div>
            )}
            {'|'}{' '}
            <span className="type">
              {'"'}
              {item}
              {'"'}
            </span>
          </div>
        );
      })}
    </Definition>
  );
}

function SchemaOneOfDefinition({definition, name, indirections}) {
  return (
    <Definition name={name} description={definition.description}>
      <summary>
        type {name} {' ='}
      </summary>
      {definition.oneOf.map((item, index) => {
        return (
          <div className="property" key={index}>
            {item.description && (
              <div className="description">{' // ' + item.description}</div>
            )}
            {'|'} <TypeRef prop={item} indirections={indirections} />
          </div>
        );
      })}
    </Definition>
  );
}
function SchemaAnyOfDefinition({definition, name, indirections}) {
  return (
    <Definition name={name} description={definition.description}>
      <summary>
        type {name} {' ='}
      </summary>
      {definition.anyOf.map((item, index) => {
        return (
          <div className="property" key={index}>
            {item.description && (
              <div className="description">{' // ' + item.description}</div>
            )}
            {'|'} <TypeRef prop={item} indirections={indirections} />
          </div>
        );
      })}
    </Definition>
  );
}

function SchemaObjectDefinition({definition, name, indirections}) {
  return (
    <Definition name={name} description={definition.description}>
      <summary>
        type {name} {' = {'}
      </summary>
      <div>
        {Object.entries(definition.properties).map(
          ([name, property], index) => {
            return (
              <SchemaProperty
                key={index}
                property={property}
                name={name}
                required={property.required?.includes(name)}
                indirections={indirections}
              />
            );
          },
        )}
      </div>
      {'}'}
    </Definition>
  );
}

function SchemaProperty({property, name, required, indirections}) {
  return (
    <div className="property">
      {property.description && (
        <div className="description">{' // ' + property.description}</div>
      )}
      <div>
        <span>
          {name}
          {required ? '' : '?'}
        </span>
        : <TypeRef prop={property} indirections={indirections} />
        <Default prop={property} />
      </div>
    </div>
  );
}

function Default({prop}) {
  if (prop.default) {
    return (
      <span className="default">
        {' = '}
        <RawJson json={prop.default} />
      </span>
    );
  }
  return null;
}

function RawJson({json}) {
  if (json === null) {
    return 'null';
  }
  switch (typeof json) {
    case 'string':
    case 'number':
    case 'boolean':
      return JSON.stringify(json);
    case 'object':
      if (Array.isArray(json)) {
        return (
          <span>
            [
            <Join separator={', '}>
              {json.map((item, index) => (
                <RawJson key={index} json={item} />
              ))}
            </Join>
            ]
          </span>
        );
      }
      return (
        <span>
          {'{'}
          {Object.entries(json).map(([key, value], index) => (
            <div key={index} className="inline-property">
              {key}: <RawJson json={value} />
              {', '}
            </div>
          ))}
          {'}'}
        </span>
      );
    default:
      throw new Error('Unexpected JSON type');
  }
}

function TypeRef({prop, indirections}) {
  return (
    <span className="type">
      <T prop={prop} indirections={indirections} />
    </span>
  );
}

function T({prop, indirections}) {
  if (typeof prop === 'boolean') {
    return String(prop);
  }
  if (prop.$ref) {
    const value = indirections.resolveRef(prop.$ref);
    const inlineDef = indirections.getInlineDef(value);
    if (inlineDef) {
      return <T prop={inlineDef} indirections={indirections} />;
    }
    const typeName = prop.$ref.split('/').pop();
    if (typeName != null) {
      return <a href={'#' + typeName}>{typeName}</a>;
    }
    throw new Error('Expected $ref to be a valid type name');
  }
  if (prop.type === 'array' && prop.items) {
    return (
      <>
        <T prop={prop.items} indirections={indirections} />
        {'[]'}
      </>
    );
  }
  if (Array.isArray(prop.type)) {
    return prop.type.join(' | ');
  }

  if (prop.enum) {
    return (
      <Join separator={' | '}>
        {prop.enum.map((item, i) => (
          <span key={i} className="type">
            {'"'}
            {item}
            {'"'}
          </span>
        ))}
      </Join>
    );
  }

  if (prop.allOf) {
    if (prop.allOf.length !== 1) {
      throw new Error('allOf should only have one item');
    }
    return <T prop={prop.allOf[0]} indirections={indirections} />;
  }
  if (prop.anyOf) {
    return (
      <Join separator={' | '}>
        {prop.anyOf.map((item, i) => (
          <T prop={item} key={i} indirections={indirections} />
        ))}
      </Join>
    );
  }

  if (Array.isArray(prop)) {
    return (
      <Join separator={' | '}>
        {prop.map((item, i) => (
          <span key={i} className="type">
            {item}
          </span>
        ))}
      </Join>
    );
  }

  switch (prop.type) {
    case 'string':
    case 'number':
    case 'boolean':
    case 'null':
      if (prop.const != null) {
        return JSON.stringify(prop.const);
      }
      return prop.type;
    case 'integer':
      // TODO: Clarify if this needs to be a unint8
      return 'number';
    case 'object':
      if (prop.additionalProperties) {
        return (
          <span className="type">
            {'{ [key: string]: '}
            <T prop={prop.additionalProperties} indirections={indirections} />
            {' }'}
          </span>
        );
      }
      return <InlineObject prop={prop} indirections={indirections} />;
    default:
      return prop.type ?? 'any';
  }
}

function InlineObject({prop, indirections}) {
  return (
    <span>
      {'{'}
      {Object.entries(prop.properties).map(([name, property], index) => {
        return (
          <div className="property" key={index}>
            {property.description && (
              <div className="description">{' // ' + property.description}</div>
            )}
            <span>{name}</span>
            {': '}
            <T prop={property} indirections={indirections} />
            <Default prop={property} />
          </div>
        );
      })}
      {'}'}
    </span>
  );
}

function Definition({name, description, children}) {
  return (
    <div>
      <h2 id={name} className="definition-title">
        {splitPascalCase(name)}
      </h2>
      {description && <p>{description}</p>}
      <div>{children}</div>
    </div>
  );
}

function Join({children, separator}) {
  const filtered = children.filter(Boolean);
  return (
    <>
      {filtered.map((child, idx) => (
        <React.Fragment key={idx}>
          {child}
          {idx < filtered.length - 1 && separator}
        </React.Fragment>
      ))}
    </>
  );
}

function splitPascalCase(str) {
  return str.replace(/([A-Z]+)/g, ' $1').trim();
}

// Some types have a name but are really just simple wrappers around other types
// or shapes. First we collect up these types and build a map redirecting them to
// their real type.
function useIndirections(data) {
  return useMemo(() => new IndirectionResolver(data), [data]);
}

class IndirectionResolver {
  constructor(schema) {
    this._schema = schema;
  }

  /**
   * Some types are trivial wrappers which are not worth showing as their own
   * types. Here we encode a heuristic for types which we think are not worth
   * showing as their own types, and instead we can use either the type they
   * wrap, or the structure of the type directly.
   */
  getInlineDef(value) {
    if (value.type === 'string' || value.type === 'array') {
      return value;
    }
    if (Array.isArray(value.type)) {
      return value.type;
    }
    if (value.allOf) {
      if (value.allOf.length !== 1) {
        throw new Error(
          'Expected allOf to only be used as a wrapper type wrapping a single type.',
        );
      }
      return value.allOf[0];
    }
    if (value.$ref) {
      return this.getInlineDef(this.resolveRef(value.$ref));
    }
    return null;
  }

  resolveRef(ref) {
    const path = ref.split('/');
    let node = null;
    for (const segment of path) {
      if (segment === '#') {
        node = this._schema;
      } else {
        node = node[segment];
      }
      if (!node) {
        throw new Error(`Reference ${ref} not found in schema.`);
      }
    }
    return node;
  }
}
