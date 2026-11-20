## Console

```
 Server  Profile rendered
 Server  notes resolved
```

## Server Console

```
rsc: Profile rendered
rsc: notes resolved
```

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
<main><h1>Ada</h1><!--$--><section><h2>Profile of <!-- -->Ada</h2><div><p>Card for <!-- -->Ada</p><!--$?--><template id="B:0"></template><p>Loading notes...</p><!--/$--></div><!--$?--><template id="B:1"></template><p>Loading bio...</p><!--/$--></section><!--/$--></main>
```

## HTML

```html
<main><h1>Ada</h1><!--$--><section><h2>Profile of <!-- -->Ada</h2><div><p>Card for <!-- -->Ada</p><!--$--><p>Notes: <!-- -->Prefers analytical engines.</p><!--/$--></div><!--$--><p>Bio: <!-- -->Wrote the first program.</p><!--/$--></section><!--/$--></main>
```
