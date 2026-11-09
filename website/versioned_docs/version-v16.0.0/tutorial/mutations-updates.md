# Mutations & Updates

In this chapter we’ll learn how to update data on the server and client. We’ll go through two main examples:

* Implementing a Like button for newsfeed stories
* Implementing the ability to post comments on a newsfeed story

Updating data is a complicated problem domain, and Relay handles many aspects of it automatically, while also giving you a lot of manual control so that your app can be as robust as possible in handling the cases that can arise.

First let’s distinguish two terms:

* A *mutation* is when you ask the server to perform some action that modifies data on the server. This is a feature of GraphQL that is analogous to an HTTP POST.
* An *update* is when you modify Relay’s local client-side data store.

The client doesn’t have the ability to directly manipulate individual pieces of data on the server side. Rather, mutations are opaque, high-level requests that express the user’s intent — for example, that the user friended somebody, joined a group, posted a comment, liked a particular newsfeed story, blocked somebody, or deleted a comment. (The GraphQL schema defines what mutations are available, as well as the input parameters that each mutation accepts.)

Mutations can have far-reaching and unpredictable effects on the state of the graph. For example, let’s say you join a group. Many things can change:

* Your name gets added to the Group Members list
* The group’s membership count gets incremented
* The group gets added to your list of groups
* Members-only posts appear in the group’s post feed
* Your recommended groups may change
* The group’s admins may get notifications
* Many other non-user-visible effects such as logging, training models, or sending emails
* Etc. etc. etc.

In general, it’s impossible to know what the full downstream effect of a mutation may be. So after asking the server to perform a mutation, the client just has to do its best to update its local data store, keeping the data as consistent as reasonably possible. It does this by asking the server for specific updated data as part of the mutation response, and by imperative code — called an *updater* — that fixes up the store to keep it consistent.

There is no principled solution that covers every case. Even if it were possible to know the full effect of a mutation on the graph, there are even circumstances where we don’t *want* to show updated data right away. For example, if you go to somebody’s profile page and block them, you don’t want for everything shown on that page to immediately disappear. The question of what data to update is ultimately a UI design decision.

Relay tries to make it as easy as possible to update data in response to a mutation. For example, if you want to update a certain component, you can spread its fragment into your mutation, which asks the server to send updated data for whatever was selected by that fragment.  For other cases, you have to manually write an *updater* that modifies Relay’s local data store imperatively. We’ll look at all of these cases below.
* * *

## Implementing a Like Button

Let’s dip our toes in the water by implementing the Like button for Newsfeed stories. Luckily we already have a Like button prepared, so open up `Story.tsx` and drop it in to the `Story` component, remembering to spread its fragment into Story’s fragment:

```
// change-line
import StoryLikeButton from './StoryLikeButton';

...

const StoryFragment = graphql`
  fragment StoryFragment on Story {
    title
    summary
    // ... etc
    // change-line
    ...StoryLikeButtonFragment
  }
`;

...

export default function Story({story}: Props) {
  const data = useFragment(StoryFragment, story);
  return (
    <Card>
      <PosterByline person={data.poster} />
      <Heading>{data.title}</Heading>
      <Timestamp time={data.posterAt} />
      <Image image={story.thumbnail} width={400} height={400} />
      <StorySummary summary={data.summary} />
      // change-line
      <StoryLikeButton story={data} />
      <StoryCommentsSection story={data} />
    </Card>
  );
}
```

Now let’s take a look at `StoryLikeButton.js`. Currently, it is a button that doesn’t do anything, along with a like count.

![Like button](/img/docs/tutorial/mutations-like-button.png)

You can look at its fragment to see that it fetches a field `likeCount` for the like count and `doesViewerLike` to determine whether the Like button is highlighted (it’s highlighted if the viewer likes the story, i.e. if `doesViewerLike` is true):

```
const StoryLikeButtonFragment = graphql`
  fragment StoryLikeButtonFragment on Story {
    id
    likeCount
    doesViewerLike
  }
`;
```

We want to make it so that when you press the Like button

1. The story gets “liked” on the server
2. Our local client copy of the “`likeCount`” and “`doesViewerLike`” fields get updated.

To do that, we need to write a GraphQL mutation. But first...

## Anatomy of a Mutation

The GraphQL mutation syntax is going to be confusing unless you first understand the following:

GraphQL has two different request types, Queries and Mutations — and they work in exactly the same way. This is analogous to how HTTP has GET and POST: technically the only difference is that POST requests are intended to cause effects while GET requests do not. Similarly, a Mutation is exactly like a Query, except that the Mutation is expected to cause things to happen. This means:

* A mutation is part of our client code
* A mutation declares *variables* that let the client pass data to the server
* The server implements *individual fields.* A given mutation composes together those fields and passes its variables in as field arguments.
* Each field yields data of a particular type — either scalar or an edge to some other graph node — which is returned to the client if that field is selected. In the case of edges, further fields are selected from the node being linked to.

The only difference is that, in a mutation, selecting a field makes something happen, as well as returning data.

## The Like Mutation

With that in mind, this is what our mutation is going to look like — go ahead and add this declaration to the file:

```
const StoryLikeButtonLikeMutation = graphql`
  mutation StoryLikeButtonLikeMutation(
    // color1
    $id: ID!,
    // color1
    $doesLike: Boolean!,
  ) {
    // color2
    likeStory(
      // color3
      id: $id,
      // color3
      doesLike: $doesLike
    ) {
      // color4
      story {
        // color5
        id
        // color5
        likeCount
        // color5
        doesViewerLike
      }
    }
  }
`;
```

This is a lot, let’s break it down:

* The mutation declares <span className="color1">variables</span> which are passed from the client to the server when the mutation is dispatched. Each variable has a name (`$id`, `$doesLike`) and a type (`ID!`, `Boolean!`). The `!` after the type indicates that it is required, not optional.
* The mutation selects a <span className="color2">mutation field</span> defined by the GraphQL schema. Each mutation field that the server defines corresponds to some action that the client can request of the server, such as liking a story.
    * The <span className="color3">mutation field takes arguments</span> (just like any field can do). Here we pass in the mutation variables that we declared as the argument values — for example, the `doesLike` field argument is set to be the `$doesLike` mutation variable.
* The `likeStory` field returns an edge to a node that represents the mutation response. We can select various fields in order to receive updated data. The fields that are available in the mutation response are specified by the GraphQL schema.
    * We select the `story` field, which is an <span className="color4">edge to the Story that we just liked</span>.
    * We select specific <span className="color5">fields from within that Story to get updated data</span>. These are the same fields that a query could select about a Story — in fact, the same fields we selected in our fragment.

When we send the server this mutation, we’ll get a response that, just like with queries, matches the shape of the mutation that we sent. For example, the server might send this back to us:

```
{
  "likeStory": {
    "story": {
      "id": "34a8c",
      "likeCount": 47,
      "doesViewerLike": true
    }
  }
}
```

and our job will be to update the local data store to incorporate this updated information. Relay will handle this in simple cases, while in more complex cases it will require custom code to update the store intelligently.

But we’re getting ahead of ourselves — let’s make that button trigger the mutation. Here’s what our component looks like now — we need to hook up the `onLikeButtonClicked` event to execute `StoryLikeButtonLikeMutation`.

```
function StoryLikeButton({story}) {
  const data = useFragment(StoryLikeButtonFragment, story);
  function onLikeButtonClicked() {
    // To be filled in
  }
  return (
    <>
      <LikeCount count={data.likeCount} />
      <LikeButton value={data.doesViewerLike} onChange={onLikeButtonClicked} />
    </>
  )
}
```

To do that, we add a call to `useMutation`:

```
// change-line
import {useMutation, useFragment} from 'react-relay';

function StoryLikeButton({story}) {
  const data = useFragment(StoryLikeButtonFragment, story);
  // change-line
  const [commitMutation, isMutationInFlight] = useMutation(StoryLikeButtonLikeMutation);
  function onLikeButtonClicked() {
    // change
    commitMutation({
      variables: {
        id: data.id,
        doesLike: !data.doesViewerLike,
      },
    })
    // end-change
  }
  return (
    <>
      <LikeCount count={data.likeCount} />
      <LikeButton value={data.doesViewerLike} onChange={onLikeButtonClicked} />
    </>
  )
}
```

The `useMutation` hook returns a function `commitMutation` that we can call to tell the server to do stuff.

We pass in an option called `variables` where we give values for the variables defined by the mutation, namely `id` and `doesViewerLike`. This tells the server which story we’re talking about and whether the we are liking or un-liking it. The `id` of the story we’ve read from the fragment, while whether we like it or unlike it comes from toggling whatever the current value that we rendered is.

The hook also returns a boolean flag that tells us when the mutation is in flight. We can use that to make the user experience nicer by disabling the button while the mutation is happening:

```
<LikeButton
  value={data.doesViewerLike}
  onChange={onLikeButtonClicked}
  // change-line
  disabled={isMutationInFlight}
/>
```

With this in place, we should now be able to like a story!

## How Relay Automatically Processes Mutation Responses

But how did Relay know to update the story we clicked on? The server sent back a response with this form:

```
{
  "likeStory": {
    "story": {
      "id": "34a8c",
      "likeCount": 47,
      "doesViewerLike": true
    }
  }
}
```

Whenever the response includes an object with an `id` field, Relay will check if the store already contains a record with a matching ID in the `id` field of that record. If there is a match, Relay will merge the other fields from the response into the existing record. That means that, in this simple case, we don’t need to write any code to update the store.
* * *

## Using Fragments in the Mutation Response

Remember that mutations are just like queries. In order to make sure that the mutation response always contains the data we want to render, instead of having a separate set of fields that has to be manually kept up to date, we can simply spread fragments into our mutation response:

```
const StoryLikeButtonLikeMutation = graphql`
  mutation StoryLikeButtonLikeMutation(
    $id: ID,
    $doesLike: Boolean,
  ) {
    likeStory(id: $id, doesLike: $doesLike) {
      story {
        // change-line
        ...StoryLikeButtonFragment
      }
    }
  }
`;
```

Now if we add or remove data requirements, all of the necessary data (but no more) will be included with the mutation response. This is usually the smart way of writing mutation responses. You can spread in any fragment from any component, not just the component that triggers the mutation. This helps you keep your whole UI up to date.
* * *

## Improving the UX with an Optimistic Updater

Mutations take time to perform, yet we always want the UI to update immediately in some way to give the user feedback that they’ve taken an action. In the current example, the Like button is disabled while the mutation is happening, and then after the mutation is done, the UI is updated into the new state as Relay merges the updated data into its store and re-renders the affected components.

Oftentimes the best feedback will be to simply pretend the operation is already completed: for example, if you press the Like button, that buttons immediately goes into the same highlighted state that it will stay in whenever you see something you’ve already liked. Or take the example of posting a comment: We would like to immediately show your comment as having been posted. This is because mutations are usually fast and reliable enough that we don’t need to bother the user with a separate loading state for them. However, sometimes mutations do end in failure. In that case, we’d like to roll back the changes we made and return you to the state you were in before we tried the mutation: the comment we showed as being posted should go away, while the text of the comment should re-appear within the composer where you wrote it, so that the data isn’t lost if you want to try posting again.

Managing these so-called *optimistic updates* is complicated to do manually, but Relay has a robust system for applying and rolling back updates. You can even have multiple mutations in flight at the same time (say if the user clicks several buttons in sequence), and Relay will keep track of what changes need to be rolled back in case of a failure.

Mutations proceed in three phases:

* First there’s an *optimistic update*, where you update the local data store into whatever state you anticipate and want to show to the user immediately.
* Then you actually perform the mutation on the server. If it’s successful, the server responds with updated information which can be used in the third step.
* When the mutation has succeeded or failed, you roll back the optimistic update. If the mutation failed, you’re done — back to where you started. If the mutation succeeded, Relay merges simple changes into the store and then applies a *concluding update* that updates the local data store with the actual new information received from the server, plus whatever other changes you want to make.

![Mutation flowchart](/img/docs/tutorial/mutations-lifecycle.png)

* * *
With this background knowledge in hand, let’s go ahead and write an optimistic updater for our Like button so that it immediately updates to the new state when clicked.

### Step 1 — Add the optimisticUpdater option to commitMutation

Go to `StoryLikeButton` and add a new option to the call to `commitMutation`:

```
function StoryLikeButton({story}) {
  ...
  function onLikeButtonClicked(newDoesLike) {
    commitMutation({
      variables: {
        id: data.id,
        doesViewerLike: newDoesLike,
      },
      // change
      optimisticUpdater: store => {
        // TODO fill in optimistic updater
      },
      // end-change
    })
  }
  ...
}
```

This callback receives a `store` argument which represents Relay’s local data store. It has various methods for reading and writing local data. All of the writes that we make in the optimistic updater will be applied immediately when the mutation is dispatched, and then rolled back when it is complete.

### Step 2 — Create an Updatable Fragment

We can read and write data in the local store by writing a special kind of fragment called an *updatable fragment.* Unlike a regular fragment, it doesn’t get spread into queries and sent to the server. Instead, it lets us read data out of the local store using the same GraphQL syntax we already know and love. Go ahead and add this fragment definition:

```
function StoryLikeButton({story}) {
  ...
      optimisticUpdater: store => {
        const fragment = graphql`
          fragment StoryLikeButton_updatable on Story
            // color1
            @updatable
          {
            likeCount
            doesViewerLike
          }
        `;
      },
  ...
}
```

It’s exactly like any other fragment but annotated with the <span className="color1">@updatable</span> directive.

Unlike normal fragments, updatable fragments are not spread into queries and do not select data to be fetched from the server. Instead, they select data that’s already in the Relay local data store so that the data may be updated.

### Step 3 — Call readUpdatableFragment

We pass this <span className="color2">fragment</span>, along with the <span className="color3">original fragment ref</span> that we received as a prop (which tells us *which* story we’re liking), to `store.readUpdatableFragment`. It returns a <span className="color1">special object called `updatableData`</span>:

```
function StoryLikeButton({story}) {
  ...
      optimisticUpdater: store => {
        const fragment = graphql`
          fragment StoryLikeButton_updatable on Story @updatable {
            likeCount
            doesViewerLike
          }
        `;
        const {
          // color1
          updatableData
        } = store.readUpdatableFragment(
          // color2
          fragment,
          // color3
          story
        );
      },
  ...
}
```

### Step 4 — Modify the Updatable Data

Now `upatableData` is an object representing our existing Story as it exists in the local store. We can read and write the fields listed in our fragment:

```
function StoryLikeButton({story}) {
  ...
      optimisticUpdater: store => {
        const fragment = graphql`
          fragment StoryLikeButton_updatable on Story @updatable {
            likeCount
            doesViewerLike
          }
        `;
        const {updatableData} = store.readUpdatableFragment(fragment, story);
        // change
        const alreadyLikes = updatableData.doesViewerLike;
        updatableData.doesViewerLike = !alreadyLikes;
        updatableData.likeCount += (alreadyLikes ? -1 : 1);
        // end-change
      },
  ...
}
```

In this example, we toggle `doesViewerLike` (so that clicking the button when you already like the story makes you un-like it) and increment or decrement the like count accordingly.

Relay records the changes we made to `updatableData` and will roll them back once the mutation is complete.

Now when you click the Like button, you should see the UI immediately update.

* * *

## Adding Comments — Mutations on Connections

The only thing that Relay can do completely automatically is what we’ve seen already: merge nodes in the mutation response with existing nodes that share the same ID in the store. For anything else, we have to give Relay some more information.

Let’s look at the case of Connections. We’ll implement the ability to post a new comment on a story.

The server’s mutation response only includes the newly-created comment. We have to tell Relay how to insert that story into the Connection between a story and its comments.

Head back over to `StoryCommentsSection` and add a component for posting a new comment, remembering to spread its fragment into our fragment:

```
// change-line
import StoryCommentsComposer from './StoryCommentsComposer';

const StoryCommentsSectionFragment = graphql`
  fragment StoryCommentsSectionFragment on Story
    ...
  {
    comments(after: $cursor, first: $count)
      @connection(key: "StoryCommentsSectionFragment_comments")
    {
      ...
    }
    // change-line
    ...StoryCommentsComposerFragment
  }
`

function StoryCommentsSection({story}) {
  ...
  return (
    <>
      // change-line
      <StoryCommentsComposer story={data} />
      ...
    </>
  );
}
```

We should now see a composer at the top of the comments section:

![Comments composer screenshot](/img/docs/tutorial/mutations-comments-composer-screenshot.png)

Now take a look inside `StoryCommentsComposer.js`:

```
function StoryCommentsComposer({story}) {
  const data = useFragment(StoryCommentsComposerFragment, story);
  const [text, setText] = useState('');
  function onPost() {
   // TODO post the comment here
  }
  return (
    <div className="commentsComposer">
      <TextComposer text={text} onChange={setText} onReturn={onPost} />
      <PostButton onClick={onPost} />
    </div>
  );
}
```

### Step 1 — Define the Comment Posting Mutation

Just like before, we need to define a mutation. It will send to the server the story ID and the text of the comment to be added:

```
const StoryCommentsComposerPostMutation = graphql`
  mutation StoryCommentsComposerPostMutation(
    $id: ID!,
    $text: String!,
  ) {
    postStoryComment(id: $id, text: $text) {
      commentEdge {
        node {
          id
          text
        }
      }
    }
  }
`;
```

Here, the schema allows us to select as part of the mutation response the newly-created edge to the newly-created comment. We select it and will use it to update the local store by inserting this edge into the Connection.

### Step 2 — Call commitMutation to post it

Now we use the `useMutation` hook to get access to the `commitMutation` callback, and call it in `onPost`:

```
function StoryCommentsComposer({story}) {
  const data = useFragment(StoryCommentsComposerFragment, story);
  const [text, setText] = useState('');
  // change-line
  const [commitMutation, isMutationInFlight] = useMutation(StoryCommentsComposerPostMutation);
  function onPost() {
    // change
    setText(''); // Reset the UI
    commitMutation({
      variables: {
        id: data.id,
        text,
      },
    })
    // end-change
  }
  ...
}
```

### Step 3 — Add a Declarative Connection Handler

At this point, we can find from the network logs that clicking Post will send a mutation request to the server — you can even see that the comment has been posted since it appears if you refresh the page. However, nothing happens in the UI. We need to tell Relay to append the newly-created comment to the Connection that goes from the story to its comments.

You’ll notice that in the mutation response that we wrote above we select `commentEdge`. This is the edge to the newly-created comment. We just need to tell Relay what Connections to add that edge to. Relay provides directives called `@appendEdge`, `@prependEdge`, and `@deleteEdge` that you put on the edge in the mutation response. Then when you run the mutation, you pass in the IDs of the Connections that you want to modify. Relay will append, prepend, or delete the edge from those connections as you specify.

We want our newly-created comment to appear at the top of the list, so we’ll use `@prependEdge`. Make the following additions to the mutation definition:

```
  mutation StoryCommentsComposerPostMutation(
    $id: ID!,
    $text: String!,
    // change-line
    $connections: [ID!]!,
  ) {
    postStoryComment(id: $id, text: $text) {
      commentEdge
        // change-line
        @prependEdge(connections: $connections)
      {
        node {
          id
          text
        }
      }
    }
  }
```

We’ve added a variable called `connections` to the mutation. We’ll use this to pass in the Connections we want to update.

:::note
The `$connections` variable is only used as an argument to the `@prependEdge` directive, which is processed on the client by Relay. Because `$connections` is not passed as an argument to any *field*, it is not sent to the server.
:::

### Step 4 — Pass in the Connection ID as a Mutation Variable

We need to identify the Connection to add the new edge to. A Connections is identified with two pieces of information:

* Which node it’s off of — in this case, the Story we’re posting a comment to.
* The *key* provided in the `@connection` directive, which lets us distinguish connections in case more than one connection is off of the same node.

We pass this information in to the mutation variables using a special API provided by Relay:

```
// change-line
import {useFragment, useMutation, ConnectionHandler} from 'react-relay';

...

export default function StoryCommentsComposer({story}: Props) {
  ...
  function onPost() {
    setText('');
    // change
    const connectionID = ConnectionHandler.getConnectionID(
      data.id,
      'StoryCommentsSectionFragment_comments',
    );
    // end-change
    commitMutation({
      variables: {
        id: data.id,
        text,
        // change-line
        connections: [connectionID],
      },
    })
  }
  ...
}
```

The string `"StoryCommentsSectionFragment_comments"` that we pass to `getConnectionID` is the identifier that we used when fetching the connection in `StoryCommentSection` — just as a reminder, here's what that looked like:

```
const StoryCommentsSectionFragment = graphql`
  fragment StoryCommentsSectionFragment on Story
  ...
  {
    comments(after: $cursor, first: $count)
     @connection(key: "StoryCommentsSectionFragment_comments")
    {
      ...
  }
`;
```

Meanwhile, the argument `data.id` is the ID of the specific story that we’re connecting off of.

With this change, we should see the comment appear in the list of comments once the mutation is complete.

* * *

## Summary

Mutations let us ask the server to make changes.

* Just like Queries, Mutations are composed of fields, accept variables, and pass those variables as arguments to fields.
* The fields that are selected by a Mutation constitute the *mutation response* which we can use to update the Store.
* Relay automatically merges nodes in the response to nodes in the Store with matching IDs.
* The `@appendEdge`, `@prependEdge`, and `@deleteEdge` directives let us insert and remove items from the mutation response into Connections in the store.
* Updaters let us manually manipulate the store.
* Optimistic updaters run before the mutation begins and are rolled back when it is done.
