## babel-plugin-relay

Relay requires a Babel plugin to convert GraphQL tags to runtime artifacts.

A _very_ simplified example of what this plugin is doing:

```js
// It converts this code
const fragment = graphql`
  fragment User_fragment on User {
    name
  }
`;

// To require generated ASTs for fragments and queries
const fragment = require('__generated__/User_fragment.graphql');
```

## Plugin Configuration

`babel-plugin-relay` will discover the config if:

- There is a `relay.config.json`, `relay.config.js` file at the root of the
  project (i.e. in the same folder as the `package.json` file).
- The `package.json` file contains a `"relay"` key.

> [!IMPORTANT]
> This Babel plugin does not support `relay.config.mjs` or `package.json` with `"type": "module"`.

### Supported configuration options for `babel-plugin-relay`

- `artifactDirectory` A specific directory to output all artifacts to. When
  enabling this the Relay compiler needs `artifactDirectory` to be set as well.
  [string]
- `eagerEsModules` This option enables emitting ES modules artifacts.
  [boolean][default: false]
- `codegenCommand` The command to run to compile Relay files. [string]
- `isDevVariableName` Name of the global variable for dev mode (e.g. `__DEV__`).
  [string]
- `jsModuleFormat` Formatting style for generated files. `commonjs` or `haste`.
  Default is `commonjs`. [string]

[Configuration Instructions](https://relay.dev/docs/getting-started/installation-and-setup/#set-up-babel-plugin-relay)
