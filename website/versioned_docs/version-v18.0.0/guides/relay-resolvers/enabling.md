---
id: enabling
title: "Enabling Relay Resolvers"
slug: /guides/relay-resolvers/enabling-resolvers
description: Enabling experimental Relay Resolvers
---

Relay Resolvers are still an experimental feature in Relay. As such they require additional configuration to enable. You may also find that the APIs in the documentation are not yet reflected in our community maintained TypeScript types.

## Runtime

Relay Resolvers must be enabled in your runtime code by using our experimental `LiveResolverStore` as your Relay store and enabling the `ENABLE_RELAY_RESOLVERS` runtime feature flag:

```ts
import { Environment, RecordSource, RelayFeatureFlags } from "relay-runtime";
// highlight-next-line
import LiveResolverStore from "relay-runtime/lib/store/live-resolvers/LiveResolverStore";

RelayFeatureFlags.ENABLE_RELAY_RESOLVERS = true;

// It is recommended to log errors thrown by Resolvers
function fieldLogger(event) {
  if(event.kind === "relay_resolver.error") {
    // Log this somewhere!
    console.warn(`Resolver error encountered in ${event.owner}.${event.fieldPath}`)
    console.warn(event.error)
  }
}

const environment = new Environment({
  network: Network.create(/* your fetch function here */),
  store: new LiveResolverStore(new RecordSource()),
  requiredFieldLogger: fieldLogger
});

// ... create your Relay context with your environment
```

<FbInternalOnly>

## Enable new Flow based RelayResolver syntax
To opt-in the new syntax in a file, add `//relay:enable-new-relay-resolver` to the file

To convert files to the new syntax, run codemode: `flow-runner codemod relay/migrateResolver <path>`. The codemod doesn't support all cases, so you might need to modify some files manually after it runs.
</FbInternalOnly>

## Compiler

For Relay versions below 18.1.0, you must enable the `"enable_relay_resolver_transform"` feature flag in your Relay compiler config:


```json title="relay.config.json"
{
  "src": "./src",
  "schema": "./schema.graphql",
  "language": "typescript",
  "featureFlags": {
    // highlight-next-line
    "enable_relay_resolver_transform": true
  }
}
```
