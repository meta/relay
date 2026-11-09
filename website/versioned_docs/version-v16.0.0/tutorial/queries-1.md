# Query Basics

In this section:

* We’ll take a React component that displays hard-coded placeholder data and modify it so that it fetches its data using a GraphQL query.
* We’ll learn how to use the TypeScript types that Relay generates from your GraphQL to ensure type safety.

* * *
With Relay, you fetch data using GraphQL Queries. A Query specifies a part of the GraphQL graph for your app to fetch, starting from some root node and traversing from node to node to retrieve a particular set of data in the shape of a tree.

![A query selects a particular subgraph](/img/docs/tutorial/query-upon-graph.png)

Right now, our example app doesn’t fetch any data, it just renders some placeholder data that’s hard-coded into the React components. Let’s modify it to fetch some data using Relay.

Open up the file called `Newsfeed.tsx`. (All of the components in the tutorial are in `src/components`.) In it you should see a `<Newsfeed>` component where the data is hard-coded:

```jsx
export default function Newsfeed() {
  const story = {
    title: "Placeholder Story",
    summary:
      "Placeholder data, to be replaced with data fetched via GraphQL",
    poster: {
      name: "Placeholder Person",
      profilePicture: {
        url: "/assets/cat_avatar.png",
      },
    },
    thumbnail: {
      url: "/assets/placeholder.jpeg",
    },
  };
  return (
    <div className="newsfeed">
      <Story story={story} />
    </div>
  );
}
```

We’re going to replace this placeholder data with data fetched from the server.  First we need to define a GraphQL query. Add the following declaration above the Newsfeed component:

```
import { graphql } from 'relay-runtime';

// color1
const NewsfeedQuery = graphql`
  // color2
  query NewsfeedQuery {
    topStory {
      // color3
      title
      // color3
      summary
      // color4
      poster {
        name
        profilePicture {
          url
        }
      }
      thumbnail {
        url
      }
    }
  }
`;
```

Let’s break this down:

* To embed GraphQL within Javascript, we put a string literal <span className="color1">marked with the <code>graphql``</code> tag</span>. This tag allows the Relay compiler to find and compile the GraphQL within a Javascript codebase.
* Our GraphQL string consists of a <span className="color2">query declaration</span> with the keyword `query` and then a query name.
* Inside the query declaration are *fields*, which specify what information to query for*:*
    * Some fields are *<span className="color3">scalar fields</span>* that retrieve a string, number, or other unit of information.
    * Other fields are *<span className="color4">edges</span>* that let us traverse from one node in the graph to another. When a field is an edge, it’s followed by another block `{ }` containing fields for the node at the other end of the edge. Here, the `poster` field is an edge that goes from a Story to a Person who posted it. Once we’ve traversed to the Person, we can include fields about the Person such as their `name`.

This illustrates the part of the graph that this query is asking for:

![Parts of the GraphQL query](/img/docs/tutorial/query-breakdown.png)

Now that we’ve defined the query, we need to do two things.
1. Run relay compiler so that it knows about the new Graphql query. [npm run relay.]
2. Modify our React component to fetch it and to use the data returned by the server.

If you open package.json you will find the script `relay` is hooked up to run the relay-compiler. This is what npm run relay does. Once the compiler successfully updates/generated the new compiled query you will be able to find it in the __generated__ folder under src/components/ as NewsfeedQuery.graphql.ts. This project comes with precomputed fragments, so unless you do this step, you will not get the desired results.

Next, Turn back to the `Newsfeed` component and start by deleting the placeholder data. Then replace it with this:

```
import { useLazyLoadQuery } from "react-relay";

export default function Newsfeed({}) {
  const data = useLazyLoadQuery(
    // color1
    NewsfeedQuery,
    // color2
    {},
  );
  const story = data.topStory;
  // As before:
  return (
    <div className="newsfeed">
      <Story story={story} />
    </div>
  );
}
```

The `useLazyLoadQuery` hook fetches and returns the data. It takes two arguments:

* The <span className="color1">GraphQL query</span> that we defined before.
* <span className="color2">Variables</span> that are passed to the server with the query. This query doesn’t declare any variables, so it’s an empty object.

The object that `useLazyLoadQuery` returns has the same shape as the query. For instance, if printed in JSON format it might look like this:

```
{
  topStory: {
    title: "Local Yak Named Yak of the Year",
    summary: "The annual Yak of the Year awards ceremony ...",
    poster: {
      name: "Baller Bovine Board",
      profilePicture: {
        url: '/images/baller_bovine_board.jpg',
      },
    },
    thumbnail: {
      url: '/images/max_the_yak.jpg',
    }
  }
}
```

Notice that each field selected by the GraphQL query corresponds to a property in the JSON response.

At this point, you should see a story fetched from the server:

![Screenshot](/img/docs/tutorial/queries-basic-screenshot.png)

:::note
The server's responses are artifically slowed down to make loading states perceptible, which will come in handy when we add more interactivity to the app. If you want to remove the delay, open `server/index.js` and remove the call to `sleep()`.
:::

The `useLazyLoadQuery` hook fetches the data when the component is first rendered. Relay also has APIs for pre-fetching the data before your app has even loaded — these are covered later. In any case, Relay uses Suspense to show a loading indicator until the data is available.

This is Relay in its most basic form: fetching the results of a GraphQL query when a component is rendered. As the tutorial progresses, we’ll see how Relay’s features fit together to make your app more maintainable — starting with a look at how Relay generates TypeScript types corresponding to each query.

<details>
<summary>Deep dive: Suspense for Data Loading</summary>

*Suspense* is a new API in React that lets React wait while data is loaded before it renders components that need that data. When a component needs to load data before rendering, React shows a loading indicator. You control the loading indicator's location and style using a special component called `Suspense`.

Right now, there's a `Suspense` component inside `App.tsx`, which is what shows the spinner while `useLazyLoadQuery` is loading data.

We'll look at Suspense in more detail in later sections when we add some more interactivity to the app.
</details>

<details>
<summary>Deep dive: Queries are Static</summary>

All of the GraphQL strings in a Relay app are pre-processed by the Relay compiler and removed from the resulting bundled code. This means you can’t construct GraphQL queries at runtime — they have to be static string literals so that they’re known at compile time. But it comes with major advantages.

First, it allows Relay to generate type definitions for the results of the query, making your code more type-safe.

Second, Relay replaces the GraphQL string literal with an object that tells Relay what to do. This is much faster than using the GraphQL strings directly at runtime.

Also, Relay’s compiler can be configured to [save queries to the server](/docs/guides/persisted-queries/) when you build your app, so that at runtime the client need only send a query ID instead of the query itself. This saves bundle size and network bandwidth, and can prevent attackers from writing malicious queries since only those your app was built with need to be available.

So when you have a GraphQL tagged string literal in your program...

```
const MyQuery = graphql`
  query MyQuery {
    viewer {
      name
    }
  }
`;
```

... the JavaScript variable `MyQuery` is actually assigned to an object that looks something like this:

```
const MyQuery = {
  kind: "query",
  selections: [
    {
      name: "viewer",
      kind: "LinkedField",
      selections: [
        name: "name",
        kind: "ScalarField",
      ],
    }
  ]
};
```

along with various other properties and information. These data structures are carefully designed to allow the JIT to run Relay’s payload processing code very quickly. If you’re curious, you can use the [Relay Compiler Explorer](/compiler-explorer) to play with it.

</details>

* * *

## Relay and the Type System

You might notice that TypeScript reports an error with this code as we’ve written it:

```
const story = data.topStory;
                   ^^^^^^^^
Property 'topStory' does not exist on type 'unknown'
```

To fix this, we need to annotate the call to `useLazyLoadQuery` with types that Relay generates. That way, TypeScript will know what type `data` should have based on the fields we’ve selected in our query. Add the following:

```
// change-line
import type {NewsfeedQuery as NewsfeedQueryType} from './__generated__/NewsfeedQuery.graphql';

function Newsfeed({}) {
  const data = useLazyLoadQuery
  // change-line
  <NewsfeedQueryType>
  (NewsfeedQuery, {});
  ...
}
```

If we look inside `__generated__/NewsfeedQuery.graphql` we’ll see the following type definition — with the annotation we’ve just added, TypeScript knows that `data` should have this type:

```
export type NewsfeedQuery$data = {
  readonly topStory: {
    readonly poster: {
      readonly name: string | null;
      readonly profilePicture: {
        readonly url: string;
      } | null;
    };
    readonly summary: string | null;
    readonly thumbnail: {
      readonly url: string;
    } | null;
    readonly title: string;
  } | null;
};
```

 The Relay compiler generates TypeScript types corresponding to every piece of GraphQL that you have in your app within a <code>graphql``</code> literal. As long as <code>npm run dev</code> is running, the Relay compiler will automatically regenerate these files whenever you save one of your JavaScript source files, so you don’t need to refresh anything to keep them up to date.

Using Relay’s generated types makes your app safer and more maintainable. In addition to TypeScript, Relay supports the Flow type system if you want to use that instead. When using Flow, the extra annotation on `useLazyLoadQuery` is not needed, because Flow directly understands the contents of the <code>graphql``</code> tagged literal.

We’ll revisit types throughout this tutorial. But next, we'll look at an even more important way that Relay helps us with maintainability.

* * *

## Summary

Queries are the foundation of fetching GraphQL data. We’ve seen:

* How to define a GraphQL query within our app using the <code>graphql``</code> tagged literal
* How to use the `useLazyLoadQuery` hook to fetch the results of a query when a component renders.
* How to import Relay's generated types for type safety.

In the next section, we’ll look at Fragments, one of the most core and distinctive aspects of Relay. Fragments let each individual component define its own data requirements, while retaining the performance advantages of issuing a single query to the server.
