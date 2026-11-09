# GraphQL Types, Interfaces, and Polymorphism

In this section, we’ll see how to treat different types of nodes differently. You might notice that some of the newsfeed stories in the example app are posted by people, while others are posted by organizations. In this example, we'll enhance our hovercard by writing a fragment that selects people-specific information about people  and organization-specific information about organizations.

* * *

We’ve alluded to the fact that GraphQL nodes aren’t just random bags of fields — they have types. Your GraphQL schema defines what fields each type has. For instance, it might define the `Story` type like this:

```
type Story {
  id: ID!
  title: String
  summary: String
  createdAt: Date
  poster: Actor
  image: Image
}
```

Here, some of the fields are scalars (like `String` and `ID`). Others are types defined elsewhere in the schema, like `Image` — these fields are edges to nodes of those specific types. The `!` on `ID!` means that field is non-nullable. In GraphQL, fields are normally nullable and non-nullability is the exception.

Fragments are always “on” a particular type. In our example above, `StoryFragment` is defined `on Story`. This means that you can only spread it into places in a query where a `Story` node is expected. And it means that the fragment can select just those fields that exist on the `Story` type.

Of particular interest is the `Actor` type used for the `poster` field. This type is an *interface*. That means that the `poster` of a story can be a Person, a Page, an Organization, or any other type of entity that meets the specifications for being an “Actor”.

The GraphQL schema in our example app defines an Actor as follows:

```
interface Actor {
  name: String
  profilePicture: Image
  joined: DateTime
}
```

Not coincidentally this is exactly the information that we’re displaying here. There are two types in the schema that *implement* Actor, meaning that they include all the fields defined in Actor and declare as such:

```
type User implements Actor {
  id: ID!
  name: String
  profilePicture: Image
  joined: DateTime
  email: String
  location: Location
}

type Organization implements Actor {
  id: ID!
  name: String
  profilePicture: Image
  joined: DateTime
  organizationKind: OrganizationKind
}
```

Both of these types have `name` , `profilePicture`, and `joined`, so they can both declare that they implement Actor and thus can be used wherever an Actor is called for in the schema and in fragments. They also have other fields that are distinct to each particular type.

Let’s see how to work with interfaces more by extending the `PosterDetailsHovercardContentsBody` component to display the location of a `Person` or the organization kind of an `Organization`. These are fields that are only present on those specific types, not on the `Actor` interface.

Right now, if you’ve followed along so far, it should have a fragment defined like this (in `PosterDetailsHovercardContents.tsx`):

```
fragment PosterDetailsHovercardContentsBodyFragment on Actor {
  name
  joined
  profilePicture {
    ...ImageFragment
  }
}
```

If you try to add a field like `organizationKind` to this fragment, you’ll get an error from the Relay compiler:

```
✖︎ The type `Actor` has no field organizationKind
```

This is because when we define a fragment as being on an interface, we can only use fields from that interface. To use fields from a specific type that implements the interface, we use a *type refinement* to tell GraphQL we’re selecting fields from that type:

```
fragment PosterDetailsHovercardContentsBodyFragment on Actor {
  name
  joined
  profilePicture {
    ...ImageFragment
  }
  // change
  ... on Organization {
    organizationKind
  }
  // end-change
}
```

Go ahead and add this now. You can also add a type refinement for `Person`:

```
fragment PosterDetailsHovercardContentsBodyFragment on Actor {
  name
  joined
  profilePicture {
    ...ImageFragment
  }
  ... on Organization {
    organizationKind
  }
  // change
  ... on Person {
    location {
      name
    }
  }
  // end-change
}
```

When you select a field that’s only present on some of the types that implement an interface, and the node you’re dealing with is of a different type, then you simply get `null` for the value of that field when you read it out. With that in mind, we can modify the `PosterDetailsHovercardContentsBody` component to show the location of people and organization kind of organizations:

```
import OrganizationKind from './OrganizationKind';

function PosterDetailsHovercardContentsBody({ poster }: Props): React.ReactElement {
  const data = useFragment(PosterDetailsHovercardContentsBodyFragment, poster);
  return (
    <>
      <Image image={data.profilePicture} width={128} height={128} className="posterHovercard__image" />
      <div className="posterHovercard__name">{data.name}</div>
      <ul className="posterHovercard__details">
         <li>Joined <Timestamp time={data.joined} /></li>
         // change
         {data.location != null && (
           <li>{data.location.name}</li>
         )}
        {data.organizationKind != null && (
          <li><OrganizationKind kind={data.organizationKind} /></li>
         )}
         // end-change
      </ul>
    </>
  );
}
```

You should now see the location of people, and the organization kind for organizations:

![An organization hovercard](/img/docs/tutorial/interfaces-organization-screenshot.png) ![A person hovercard](/img/docs/tutorial/interfaces-person-screenshot.png)

By the way, we can now understand why we had `... on Actor` in the example earlier. The `node` field can return a node of any type because any ID could be given at runtime. So the type that it gives us is `Node`, a very generic interface that can be implemented by anything that has an `id` field. We needed a type refinement to use fields from the `Actor` interface.

:::note
In the GraphQL spec and other sources, type refinements are called *inline fragments*. We call them “type refinements” instead because this terminology is more descriptive and less confusing.
:::

:::tip
If you need to do something totally different depending on what type it is, you can select a field called `__typename`, which returns a string with the name of the concrete type that you got (e.g., `"Person"` or `"Organization"`). This is a built-in feature of GraphQL.
:::

## Summary

The `... on Type {}` syntax allows us to select fields that are only present in a specific type that implements an interface.
