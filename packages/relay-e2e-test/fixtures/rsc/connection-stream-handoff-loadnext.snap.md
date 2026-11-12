## Network

```
GET / -> 200 text/html
POST /graphql PeopleListPaginationQuery -> 200 application/x-ndjson
GET /page ?view=other -> 200 text/x-component
```

## Browser Modules

```
fixture:template/OtherName.tsx
fixture:template/PeopleList.tsx
fixture:template/__generated__/OtherName_user.graphql.ts
fixture:template/__generated__/PeopleListPaginationQuery.graphql.ts
fixture:template/__generated__/PeopleList_query.graphql.ts
```

## SSR HTML

```html
<main><section><p>Edges: <!-- -->1</p><ul><li>Person: <!-- -->P1</li></ul></section></main>
```

## HTML

```html
<main><h1>Other: Zed</h1></main>
```
