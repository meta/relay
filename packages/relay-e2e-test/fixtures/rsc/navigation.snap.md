## Network

```
GET / -> 200 text/html
GET /page ?id=2 -> 200 text/x-component
GET /page ?id=1 -> 200 text/x-component
```

## Browser Modules

```
fixture:template/Bio.tsx
fixture:template/__generated__/Bio_user.graphql.ts
```

## SSR HTML

```html
<main><h1>Ada</h1><p>Wrote the first program.<!-- --> <button>Like <!-- -->Ada<!-- --> (<!-- -->0<!-- -->)</button></p></main>
```

## HTML

```html
<main><h1>Ada</h1><p>Wrote the first program. <button>Like Ada (0)</button></p></main>
```
