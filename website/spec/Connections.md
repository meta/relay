GraphQL Cursor Connections Specification
--------------------------------------

This specification aims to provide an option for GraphQL clients to consistently
handle [pagination best practices](https://graphql.org/learn/pagination/) with
support for related metadata via a GraphQL server. This spec proposes calling
this pattern "Connections" and exposing them in a standardized way.

In the query, the connection model provides a standard mechanism for slicing
and paginating the result set.

In the response, the connection model provides a standard way of providing
cursors, and a way of telling the client when more results are available.

An example of all four of those is the following query:

```graphql
{
  user {
    id
    name
    friends(first: 10, after: "opaqueCursor") {
      edges {
        cursor
        node {
          id
          name
        }
      }
      pageInfo {
        hasNextPage
      }
    }
  }
}
```

In this case, `friends` is a connection. That query demonstrates the four
features described above:

 - Slicing is done with the `first` argument to `friends`. This asks for the
connection to return 10 friends.
 - Pagination is done with the `after` argument to `friends`. We passed in a
cursor, so we asked for the server to return friends after that cursor.
 - For each edge in the connection, we asked for a cursor. This cursor
is an opaque string, and is precisely what we would pass to the `after` arg
to paginate starting after this edge.
 - We asked for `hasNextPage`; that will tell us if there are more edges
available, or if we've reached the end of this connection.

This section of the spec describes the formal requirements around connections.

# Reserved Types

A GraphQL server which conforms to this spec must reserve certain types and type names
to support the pagination model of connections. In particular, this spec creates
guidelines for the following types:

 - Any object whose name ends in "Connection".
 - An object named `PageInfo`.

# Connection Types

Any type whose name ends in "Connection" is considered by this spec
to be a *Connection Type*. Connection types must be an "Object"
as defined in the "Type System" section of the GraphQL Specification.

## Fields

Connection types must have fields named `edges` and `pageInfo`. They
may have additional fields related to the connection, as the schema
designer sees fit.

### Edges

A "Connection Type" must contain a field called `edges`. This field must
return a list type that wraps an edge type, where the requirements of an
edge type are defined in the "Edge Types" section below.

### PageInfo

A "Connection Type" must contain a field called `pageInfo`. This field
must return a non-null `PageInfo` object, as defined in the "PageInfo" section
below.

## Introspection

If `ExampleConnection` existed in the type system, it would be a connection,
since its name ends in "Connection". If this connection's edge type was named
`ExampleEdge`, then a server that correctly implements the above requirement
would accept the following introspection query, and return the provided
response:

```graphql
{
  __type(name: "ExampleConnection") {
    fields {
      name
      type {
        name
        kind
        ofType {
          name
          kind
        }
      }
    }
  }
}
```

returns

```json
{
  "data": {
    "__type": {
      "fields": [
        // May contain other items
        {
          "name": "pageInfo",
          "type": {
            "name": null,
            "kind": "NON_NULL",
            "ofType": {
              "name": "PageInfo",
              "kind": "OBJECT"
            }
          }
        },
        {
          "name": "edges",
          "type": {
            "name": null,
            "kind": "LIST",
            "ofType": {
              "name": "ExampleEdge",
              "kind": "OBJECT"
            }
          }
        }
      ]
    }
  }
}
```

# Edge Types

A type that is returned in list form by a connection type's `edges` field
is considered by this spec to be an *Edge Type*. Edge types must be an "Object"
as defined in the "Type System" section of the GraphQL Specification.

## Fields

Edge types must have fields named `node` and `cursor`. They
may have additional fields related to the edge, as the schema
designer sees fit.

### Node

An "Edge Type" must contain a field called `node`. This field must return either
a Scalar, Enum, Object, Interface, Union, or a Non-Null wrapper around one of
those types. Notably, this field *cannot* return a list.

NOTE The naming echoes that of the "Node" interface and "node" root
field as described in a later section of this spec. Spec-compliant clients
can perform certain optimizations if this field returns an object that implements
`Node`, however, this is not a strict requirement for conforming.

### Cursor

An "Edge Type" must contain a field called `cursor`. This field must return
a type that serializes as a String; this may be a String, a Non-Null
wrapper around a String, a custom scalar that serializes as a String, or a
Non-Null wrapper around a custom scalar that serializes as a String.

Whatever type this field returns will be referred to as the *cursor type*
in the rest of this spec.

The result of this field should be considered opaque by the client, but will be passed
back to the server as described in the "Arguments" section below.

## Introspection

If `ExampleEdge` is an edge type in our schema, that returned "Example" objects,
then a server that correctly implements the above requirement would accept the
following introspection query, and return the provided response:

```graphql
{
  __type(name: "ExampleEdge") {
    fields {
      name
      type {
        name
        kind
        ofType {
          name
          kind
        }
      }
    }
  }
}
```

returns

```json
{
  "data": {
    "__type": {
      "fields": [
        // May contain other items
        {
          "name": "node",
          "type": {
            "name": "Example",
            "kind": "OBJECT",
            "ofType": null
          }
        },
        {
          "name": "cursor",
          "type": {
            // This shows the cursor type as String!, other types are possible
            "name": null,
            "kind": "NON_NULL",
            "ofType": {
              "name": "String",
              "kind": "SCALAR"
            }
          }
        }
      ]
    }
  }
}
```

# Arguments

A field that returns a *Connection Type* must include forward pagination
arguments, backward pagination arguments, or both. These pagination arguments
allow the client to slice the set of edges before it is returned.

## Forward pagination arguments

To enable forward pagination, two arguments are required.

 - `first` takes a non-negative integer.
 - `after` takes the *cursor type* as described in the `cursor` field section.

The server should use those two arguments to modify the edges returned by
the connection, returning edges after the `after` cursor, and returning at
most `first` edges.

You should generally pass the `cursor` of the last edge in the previous page for
`after`.

## Backward pagination arguments

To enable backward pagination, two arguments are required.

 - `last` takes a non-negative integer.
 - `before` takes the *cursor type* as described in the `cursor` field section.

The server should use those two arguments to modify the edges returned by
the connection, returning edges before the `before` cursor, and returning at
most `last` edges.

You should generally pass the `cursor` of the first edge in the next page for
`before`.

## Edge order

You may order the edges however your business logic dictates, and may determine
the ordering based upon additional arguments not covered by this specification.
But the ordering must be consistent from page to page, and importantly,
*The ordering of edges should be the same when using `first`/`after` as when using
`last`/`before`, all other arguments being equal.*  It should not be reversed when
using `last`/`before`.  More formally:

* When `before: cursor` is used, the edge closest to `cursor` must come **last**
  in the result `edges`.
* When `after: cursor` is used, the edge closest to `cursor` must come **first**
  in the result `edges`.

## Pagination algorithm

To determine what edges to return, the connection evaluates the
`before` and `after` cursors to filter the edges, then evaluates `first` to
slice the edges, then `last` to slice the edges.

NOTE Including a value for both `first` and `last` is strongly discouraged,
as it is likely to lead to confusing queries and results. The `PageInfo`
section goes into more detail here.

More formally:

EdgesToReturn(allEdges, before, after, first, last):
  * Let {edges} be the result of calling {ApplyCursorsToEdges(allEdges, before, after)}.
  * If {first} is set:
    * If {first} is less than 0:
      * Throw an error.
    * If {edges} has length greater than {first}:
      * Slice {edges} to be of length {first} by removing edges from the end of {edges}.
  * If {last} is set:
    * If {last} is less than 0:
      * Throw an error.
    * If {edges} has length greater than {last}:
      * Slice {edges} to be of length {last} by removing edges from the start of {edges}.
  * Return {edges}.

ApplyCursorsToEdges(allEdges, before, after):
  * Initialize {edges} to be {allEdges}.
  * If {after} is set:
    * Let {afterEdge} be the edge in {edges} whose {cursor} is equal to the {after} argument.
    * If {afterEdge} exists:
      * Remove all elements of {edges} before and including {afterEdge}.
  * If {before} is set:
    * Let {beforeEdge} be the edge in {edges} whose {cursor} is equal to the {before} argument.
    * If {beforeEdge} exists:
      * Remove all elements of {edges} after and including {beforeEdge}.
  * Return {edges}.

# PageInfo

The server must provide a type called `PageInfo`.

## Fields

`PageInfo` must contain fields `hasPreviousPage` and `hasNextPage`, both
of which return non-null booleans.  It must also contain fields `startCursor`
and `endCursor`, both of which return opaque strings.  The fields
`startCursor` and `endCursor` can be null if there are no results.

`hasPreviousPage` is used to indicate whether more edges exist prior to the set
defined by the client's arguments. If the client is paginating with
`last`/`before`, then the server must return {true} if prior edges exist,
otherwise {false}. If the client is paginating with `first`/`after`, then the
client may return {true} if edges prior to `after` exist, if it can do so
efficiently, otherwise may return {false}. More formally:

HasPreviousPage(allEdges, before, after, first, last):
  * If {last} is set:
    * Let {edges} be the result of calling {ApplyCursorsToEdges(allEdges, before, after)}.
    * If {edges} contains more than {last} elements return {true}, otherwise {false}.
  * If {after} is set:
    * The server may optionally return {false} immediately if it is inefficient to
      determine this value.
    * If an edge corresponding to {after} exists return {true}.
  * Return {false}.

`hasNextPage` is used to indicate whether more edges exist following the set
defined by the client's arguments. If the client is paginating with
`first`/`after`, then the server must return {true} if further edges exist,
otherwise {false}. If the client is paginating with `last`/`before`, then the
client may return {true} if edges further from `before` exist, if it can do
so efficiently, otherwise may return {false}. More formally:

HasNextPage(allEdges, before, after, first, last):
  * If {first} is set:
    * Let {edges} be the result of calling {ApplyCursorsToEdges(allEdges, before, after)}.
    * If {edges} contains more than {first} elements return {true}, otherwise {false}.
  * If {before} is set:
    * The server may optionally return {false} immediately if it is inefficient to
      determine this value.
    * If an edge corresponding to {before} exists return {true}.
  * Return {false}.

NOTE When both `first` and `last` are included, both of the fields should be set
according to the above algorithms, but their meaning as it relates to pagination
becomes unclear. This is among the reasons that pagination with both `first` and
`last` is discouraged.

`startCursor` and `endCursor` must be the cursors corresponding to the first and
last nodes in `edges`, respectively.

NOTE As this spec was created with Relay Classic in mind, it's worth noting that
Relay Legacy did not define `startCursor` and `endCursor`, and relied on
selecting the `cursor` of each edge; Relay Modern began selecting
`startCursor` and `endCursor` instead to save bandwidth (since it doesn't use any
cursors in between).

## Introspection

A server that correctly implements the above requirement would accept the
following introspection query, and return the provided response:

```graphql
{
  __type(name: "PageInfo") {
    fields {
      name
      type {
        name
        kind
        ofType {
          name
          kind
        }
      }
    }
  }
}
```

returns

```json
{
  "data": {
    "__type": {
      "fields": [
        // May contain other fields.
        {
          "name": "hasNextPage",
          "type": {
            "name": null,
            "kind": "NON_NULL",
            "ofType": {
              "name": "Boolean",
              "kind": "SCALAR"
            }
          }
        },
        {
          "name": "hasPreviousPage",
          "type": {
            "name": null,
            "kind": "NON_NULL",
            "ofType": {
              "name": "Boolean",
              "kind": "SCALAR"
            }
          }
        },
        {
          "name": "startCursor",
          "type": {
            "name": "String",
            "kind": "SCALAR",
            "ofType": null
          }
        },
        {
          "name": "endCursor",
          "type": {
            "name": "String",
            "kind": "SCALAR",
            "ofType": null
          }
        }
      ]
    }
  }
}
```
