---
id: observe-fragment
title: observeFragment
slug: api-reference/observe-fragment
description: Read the value of a fragment and observe it's state and value over time
keywords:
  - observable
  - fragment
---

import DocsRating from '@site/src/core/DocsRating';

:::warning
`observeFragment` is still an experimental API. It currently has some limitations and may evolve slightly during this phase.
:::

## `observeFragment`

In some cases it can be useful to define data that you wish to read using a GraphQL fragment, but then consume it outside of React render function. `observeFragment` allows you to consume the state and value of a fragment as it changes over time. This includes loading and error states as well as changes to the data as it gets updated by local updates, mutations or updates to Relay's normalized store from other queries.

To read a fragment's data just once, see [`waitForFragmentData`](./wait-for-fragment-data.md).

:::caution
When using `observeFragment` with a plural fragment, the current implementation notifies the subscription multiple times if a store update impacting multiple list items gets published. Since the notifications happen synchronously, it is advised to debounce for a tick and only use the last payload for batching.
:::

### Example

```ts
import {observeFragment} from "relay-runtime/experimental";
import { useEffect } from "react";
import { useFragment, useRelayEnvironment } from "react-relay";
import { graphql } from "relay-runtime";

function MyComponent({ key }) {
  const env = useRelayEnvironment()
  const user = useFragment(
    graphql`
      fragment UserFragment on User {
        ...TitleFragment
      }
    `,
    key,
  );

  // Update the title as the user's name changes without triggering rerenders.
  useEffect(() => {
    const subscription = observeFragment(
      env,
      graphql`
        fragment TitleFragment on User {
          name
        }
      `,
      user,
    ).subscribe({
      next: (result) => {
        switch(result.kind) {
          case "loading":
            window.title = "...loading";
            break;
          case "error":
            window.title = "Oops, we hit an error";
            break;
          case "ok":
            window.title = `Welcome ${result.value.name}`;
            break;
        }
      }
    });
    return () => {
      subscription.unsubscribe();
    };
  }, [user]);

  return <div>Check out the document title!</div>;
}
```

### Arguments

* `environment`: `IEnvironment`. A Relay environment.
* `fragment`: GraphQL fragment specified using a `graphql` template literal.
* `fragmentReference`: The *fragment reference* is an opaque Relay object that Relay uses to read the data for the fragment from the store; more specifically, it contains information about which particular object instance the data should be read from.
    * The type of the fragment reference can be imported from the generated Flow types, from the file `<fragment_name>.graphql.js`, and can be used to declare the type of your `Props`. The name of the fragment reference type will be: `<fragment_name>$key`. We use our [lint rule](https://github.com/relayjs/eslint-plugin-relay) to enforce that the type of the fragment reference prop is correctly declared.

### Return Value

* An [`Observable`](../../glossary/glossary.md#observable) which returns a discriminated union modeling the three possible states in which a fragment's data might be:
  * `{state: 'ok', value: T}` - When data is avalaible the state is `'ok'`. `T` is the data defined in the fragment.
  * `{state: 'error': error: Error}` - When the fragment is in an error state either due to network level errors, [`@throwOnFieldError`](../../guides/throw-on-field-error-directive.md) or [`@required(action: THROW)`](../../guides/required-directive.md) field errors.
  * `{state: 'loading'}` - When the parent request, or current `@defer` payload is still in flight, or a [`@live` Relay Resolver](../../guides/relay-resolvers/live-fields.md) being read is in a suspended state.

<DocsRating />
