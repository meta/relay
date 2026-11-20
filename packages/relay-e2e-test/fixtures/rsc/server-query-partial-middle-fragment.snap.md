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

## SSR HTML

```html
<main><h1>Ada</h1><!--$--><section><h2>Root middle rendered</h2><!--$?--><template id="B:0"></template><p>Loading root notes...</p><!--/$--></section><!--/$--><!--$--><section><h2>Parent rendered</h2><!--$--><div><h3>Nested middle rendered</h3><!--$?--><template id="B:1"></template><p>Loading nested notes...</p><!--/$--></div><!--/$--></section><!--/$--></main>
```

## HTML

```html
<main><h1>Ada</h1><!--$--><section><h2>Root middle rendered</h2><!--$--><p>Root notes: <!-- -->Prefers analytical engines.</p><!--/$--></section><!--/$--><!--$--><section><h2>Parent rendered</h2><!--$--><div><h3>Nested middle rendered</h3><!--$--><p>Nested notes: <!-- -->Prefers analytical engines.</p><!--/$--></div><!--/$--></section><!--/$--></main>
```
