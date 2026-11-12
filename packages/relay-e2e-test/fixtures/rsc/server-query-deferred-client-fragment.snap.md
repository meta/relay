## Network

```
GET / -> 200 text/html
```

## Browser Modules

```
fixture:template/Bio.tsx
fixture:template/__generated__/Bio_user.graphql.ts
```

## SSR HTML

```html
<main><h1>Ada</h1><!--$?--><template id="B:0"></template><p>Loading primary bio...</p><!--/$--><!--$?--><template id="B:1"></template><p>Loading peer bio...</p><!--/$--></main>
```

## HTML

```html
<main><h1>Ada</h1><!--$--><p>Primary<!-- -->: <!-- -->Wrote the first program.</p><!--/$--><!--$--><p>Peer<!-- -->: <!-- -->Wrote the first program.</p><!--/$--></main>
```
