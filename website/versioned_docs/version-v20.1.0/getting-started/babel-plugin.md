---
id: babel-plugin
title: Relay Babel Plugin
slug: /getting-started/babel-plugin/
description: Setting up Relay's Babel plugin
keywords:
- babel
---
# Babel Plugin

Relay requires a [Babel plugin](https://www.npmjs.com/package/babel-plugin-relay) to convert GraphQL to compiler-generated runtime artifacts. Depending upon what framework/bundler you are using, there may be a framwork-specific plugin you can use:

- Vite: [vite-plugin-relay](https://github.com/oscartbeaumont/vite-plugin-relay)
- Next.js: [Relay config option](https://nextjs.org/docs/architecture/nextjs-compiler#relay)
- SWC: [@swc/plugin-relay](https://www.npmjs.com/package/@swc/plugin-relay)

If not, you can install the Babel plugin manually:

```sh
npm install --save-dev babel-plugin-relay graphql
```

Add `"relay"` to the list of plugins in your `.babelrc` file:

```javascript
{
  "plugins": ["relay"]
}
```

Please note that the `"relay"` plugin should run before other plugins or presets to ensure the `graphql` template literals are correctly transformed. See Babel's [documentation on this topic](https://babeljs.io/docs/plugins/#pluginpreset-ordering).
