## Console

```
 Server  Page rendered
 Server  notes resolved
```

## Server Console

```
rsc: Page rendered
rsc: notes resolved
```

## Network

```
GET / -> 200 text/html
```

## Browser Modules

```
fixture:template/Greeting.tsx
fixture:template/__generated__/Greeting_query.graphql.ts
```

## SSR HTML

```html
<main><h1>Partial page</h1><!--$--><section><h2>Outer rendered</h2><!--$?--><template id="B:0"></template><p>Loading notes...</p><!--/$--></section><!--/$--><!--$?--><template id="B:1"></template><p>Loading greeting...</p><!--/$--></main>
```

## HTML

```html
<main><h1>Partial page</h1><!--$--><section><h2>Outer rendered</h2><!--$--><p>Notes: <!-- -->Prefers analytical engines.</p><!--/$--></section><!--/$--><!--$--><p>Hello, <!-- -->Ada<!-- -->!</p><!--/$--></main>
```
