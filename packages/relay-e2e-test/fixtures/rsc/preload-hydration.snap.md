## Network

```
GET / -> 200 text/html
POST /graphql ProfileLikeMutation -> 200 application/x-ndjson
```

## Browser Modules

```
fixture:template/Profile.tsx
fixture:template/__generated__/ProfileLikeMutation.graphql.ts
fixture:template/__generated__/ProfileQuery.graphql.ts
```

## SSR HTML

```html
<main><p>Ada<!-- --> has <!-- -->0<!-- --> likes<!-- --> <button>Like</button></p></main>
```

## HTML

```html
<main><p>Ada<!-- --> has <!-- -->1<!-- --> likes<!-- --> <button>Like</button></p></main>
```
