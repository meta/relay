---
id: step-by-step-guide
title: Step-by-step Guide
slug: /getting-started/step-by-step-guide/
description: Step-by-step guide for setting up Relay
keywords:
- setup
---

import DocsRating from '@site/src/core/DocsRating';
import {OssOnly, FbInternalOnly} from 'docusaurus-plugin-internaldocs-fb/internal';


Relay is a framework for managing and declaratively fetching GraphQL data. It allows developers to declare *what* data each component needs via GraphQL, and then aggregate these dependencies and efficiently fetch the data in fewer round trips. In this guide we'll introduce the key concepts for using Relay in a React app one at a time.

## Step 1: Create React App

For this example we'll start with a standard install of [Create React App](https://create-react-app.dev). Create React App makes it easy to get a fully configured React app up and running and also supports configuring Relay. To get started, create a new app with:

```bash
# NPM
npx create-react-app your-app-name

# Yarn
yarn create react-app your-app-name
```

At this point we should be able to change to the app's directory and run it:

```bash
# NPM
cd your-app-name
npm start

# Yarn
cd your-app-name
yarn start
```

For troubleshooting and more setup options, see the [Create React App documentation](https://create-react-app.dev/docs/getting-started).

## Step 2: Fetch GraphQL (without Relay)

If you're exploring using GraphQL with Relay, we highly recommend starting with a basic approach and using as few libraries as possible. GraphQL servers can generally be accessed using plain-old HTTP requests, so we can use the [`fetch` API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API) to request some data from our server. For this guide we'll use GitHub's GraphQL API as the server, but if you already have a GraphQL server feel free to use that instead.

### 2.1: GitHub GraphQL Authentication

To start we'll need an authentication token for the GitHub API (if you're using your own GraphQL endpoint, you can skip this step):

* Open [github.com/settings/tokens](https://github.com/settings/tokens).
* Ensure that at least the `repo` scope is selected.
* Generate a token
* Create a file `./your-app-name/.env.local` and add the following contents, replacing `<TOKEN>` with your authentication token:

```
# your-app-name/.env.local
REACT_APP_GITHUB_AUTH_TOKEN=<TOKEN>
```
* At this point, go to the command prompt in which the local server was started, press CTRL-C to stop the server, and restart it using `npm start` or `yarn start`, so that the token becomes accessible by the code in the section below.

### 2.2: A fetchGraphQL Helper

Next let's update the home screen of our app to show the name of the Relay repository. We'll start with a common approach to fetching data in React, calling our fetch function after the component mounts (note: later we'll see some limitations of this approach and a better alternative that works with React Concurrent Mode and Suspense). First we'll create a helper function to load data from the server. Again, this example will use the GitHub API, but feel free to replace it with the appropriate URL and authentication mechanism for your own GraphQL server:

```javascript
// your-app-name/src/fetchGraphQL.js
async function fetchGraphQL(text, variables) {
  const REACT_APP_GITHUB_AUTH_TOKEN = process.env.REACT_APP_GITHUB_AUTH_TOKEN;

  // Fetch data from GitHub's GraphQL API:
  const response = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      Authorization: `bearer ${REACT_APP_GITHUB_AUTH_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: text,
      variables,
    }),
  });

  // Get the response as JSON
  return await response.json();
}

export default fetchGraphQL;
```

### 2.3: Fetching GraphQL From React

Now we can use our `fetchGraphQL` function to fetch some data in our app. Open `src/App.js` and edit it as follows:

```javascript
// your-app-name/src/App.js
import React from 'react';
import './App.css';
import fetchGraphQL from './fetchGraphQL';

const { useState, useEffect } = React;

function App() {
  // We'll load the name of a repository, initially setting it to null
  const [name, setName] = useState(null);

  // When the component mounts we'll fetch a repository name
  useEffect(() => {
    let isMounted = true;
    fetchGraphQL(`
      query RepositoryNameQuery {
        # feel free to change owner/name here
        repository(owner: "facebook" name: "relay") {
          name
        }
      }
    `).then(response => {
      // Avoid updating state if the component unmounted before the fetch completes
      if (!isMounted) {
        return;
      }
      const data = response.data;
      setName(data.repository.name);
    }).catch(error => {
      console.error(error);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  // Render "Loading" until the query completes
  return (
    <div className="App">
      <header className="App-header">
        <p>
          {name != null ? `Repository: ${name}` : "Loading"}
        </p>
      </header>
    </div>
  );
}

export default App;
```

## Step 3: When To Use Relay

At this point we can fetch data with GraphQL and render it with React. This is a reasonable solution that can be sufficient for many apps. However, this approach doesn't necessarily scale. As our app grows in size and complexity, or the number of people working on the app grows, a simple approach like this can become limiting. Relay provides a number of features designed to help keep applications fast and reliable even as they grow in size and complexity: collocating data dependencies in components with GraphQL fragments, data consistency, mutations, etc. Check out [Thinking in GraphQL](../../principles-and-architecture/thinking-in-graphql/) and [Thinking in Relay](../../principles-and-architecture/thinking-in-relay/) for an overview of how Relay makes it easier to work with GraphQL.


## Step 4: Adding Relay To Our Project

In this guide we'll demonstrate installing the *experimental* release of Relay Hooks, a new, hooks-based Relay API that supports React Concurrent Mode and Suspense.

First we'll add the necessary packages. Note that Relay is comprised of three key pieces: a compiler (which is used at build time), a core runtime (that is React agnostic), and a React integration layer.

```bash
# NPM Users
npm install --save relay-runtime react-relay
npm install --save-dev relay-compiler babel-plugin-relay

# Yarn Users
yarn add relay-runtime react-relay
yarn add --dev relay-compiler babel-plugin-relay
```

### 4.1 Configure Relay Compiler

Next let's configure Relay compiler. We'll need a copy of the schema as a `.graphql` file. If you're using the GitHub GraphQL API, you can download a copy directly from the Relay example app:

```bash
cd your-app-name
curl https://raw.githubusercontent.com/relayjs/relay-examples/main/issue-tracker/schema/schema.graphql > schema.graphql
```
*Note:* On Windows, the `.graphql` file has to be explicitly saved with UTF-8 encoding, not the default UTF-16. See this [issue](https://github.com/prisma-labs/get-graphql-schema/issues/30) for more details.

If you're using your own API we suggest using the [`get-graphql-schema`](https://www.npmjs.com/package/get-graphql-schema) utility to download your schema into a `.graphql` file.

Now that we have a schema we can modify `package.json` to run the compiler first whenever we build or start our app:

```json
// your-app-name/package.json
{
  ...
  "scripts": {
    ...
    "start": "yarn run relay && react-scripts start",
    "build": "yarn run relay && react-scripts build",
    "relay": "yarn run relay-compiler"
    ...
  },
  "relay": {
    "src": "./src/",
    "schema": "./schema.graphql",
    "language": "javascript"
  }
  ...
}
```

At this point, you should be able to run the following successfully:

```bash
cd your-app-name
yarn start
```

If it works, your app will open at [localhost:3000](http://localhost:3000). Now when we write GraphQL in our app, Relay will detect it and generate code to represent our queries in `your-app-name/src/__generated__/`. We recommend checking in these generated files to source control.

### 4.2 Configure Relay Runtime

Now that the compiler is configured we can set up the runtime - we have to tell Relay how to connect to our GraphQL server. We'll reuse the `fetchGraphQL` utility we built above. Assuming you haven't modified it (or at least that it still takes `text` and `variables` as arguments), we can now define a Relay `Environment`. An `Environment` encapsulates how to talk to our server (a Relay `Network`) with a cache of data retrieved from that server. We'll create a new file, `src/RelayEnvironment.js` and add the following:

```javascript
// your-app-name/src/RelayEnvironment.js
import {Environment, Network, RecordSource, Store} from 'relay-runtime';
import fetchGraphQL from './fetchGraphQL';

// Relay passes a "params" object with the query name and text. So we define a helper function
// to call our fetchGraphQL utility with params.text.
async function fetchRelay(params, variables) {
  console.log(`fetching query ${params.name} with ${JSON.stringify(variables)}`);
  return fetchGraphQL(params.text, variables);
}

// Export a singleton instance of Relay Environment configured with our network function:
export default new Environment({
  network: Network.create(fetchRelay),
  store: new Store(new RecordSource()),
});
```

## Step 5: Fetching a Query With Relay

Now that Relay is installed and configured we can change `App.js` to use it instead. We'll prepare our data as the app starts, and wait for it to be ready in `<App>`. Replace the contents of `src/App.js` with the following:

```javascript
import React from 'react';
import './App.css';
import graphql from 'babel-plugin-relay/macro';
import {
  RelayEnvironmentProvider,
  loadQuery,
  usePreloadedQuery,
} from 'react-relay/hooks';
import RelayEnvironment from './RelayEnvironment';

const { Suspense } = React;

// Define a query
const RepositoryNameQuery = graphql`
  query AppRepositoryNameQuery {
    repository(owner: "facebook", name: "relay") {
      name
    }
  }
`;

// Immediately load the query as our app starts. For a real app, we'd move this
// into our routing configuration, preloading data as we transition to new routes.
const preloadedQuery = loadQuery(RelayEnvironment, RepositoryNameQuery, {
  /* query variables */
});

// Inner component that reads the preloaded query results via `usePreloadedQuery()`.
// This works as follows:
// - If the query has completed, it returns the results of the query.
// - If the query is still pending, it "suspends" (indicates to React that the
//   component isn't ready to render yet). This will show the nearest <Suspense>
//   fallback.
// - If the query failed, it throws the failure error. For simplicity we aren't
//   handling the failure case here.
function App(props) {
  const data = usePreloadedQuery(RepositoryNameQuery, props.preloadedQuery);

  return (
    <div className="App">
      <header className="App-header">
        <p>{data.repository.name}</p>
      </header>
    </div>
  );
}

// The above component needs to know how to access the Relay environment, and we
// need to specify a fallback in case it suspends:
// - <RelayEnvironmentProvider> tells child components how to talk to the current
//   Relay Environment instance
// - <Suspense> specifies a fallback in case a child suspends.
function AppRoot(props) {
  return (
    <RelayEnvironmentProvider environment={RelayEnvironment}>
      <Suspense fallback={'Loading...'}>
        <App preloadedQuery={preloadedQuery} />
      </Suspense>
    </RelayEnvironmentProvider>
  );
}

export default AppRoot;
```

Note that you'll have to restart the app - `yarn start` - so that Relay compiler can see the new query and generate code for it. See the [Relay Compiler setup docs](../installation-and-setup/#set-up-relay-compiler) for how to run Relay Compiler in watch mode, to regenerate code as you modify queries.

## Step 6: Explore!

At this point we have an app configured to use Relay. We recommend checking out the following for information and ideas about where to go next:

* The [Guided Tour](../../guided-tour/) describes how to implement many common use-cases.
* The [API Reference](../../api-reference/use-fragment/) has full details on the Relay Hooks APIs.
* The [Example App](https://github.com/relayjs/relay-examples/tree/main/issue-tracker) is a more sophisticated version of what we've started building here. It includes routing integration and uses React Concurrent Mode and Suspense for smooth transitions between pages.


<DocsRating />
