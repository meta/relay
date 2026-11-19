## Network

```
GET / -> 200 text/html
```

## Browser Modules

```
fixture:template/MarkdownRendererView.tsx
fixture:template/RendererCard.tsx
fixture:template/__generated__/MarkdownRendererView_name$normalization.graphql.ts
fixture:template/__generated__/MarkdownRendererView_name.graphql.ts
fixture:template/__generated__/RendererCard_viewer$moduleProviders.client.ts
fixture:template/__generated__/RendererCard_viewer.graphql.ts
```

## Evaluated

```
modules.filter(name => name.includes('RendererCard_'))
[
  "fixture:template/__generated__/RendererCard_viewer$moduleProviders.client.ts",
  "fixture:template/__generated__/RendererCard_viewer.graphql.ts"
]

modules.filter(name => name.includes('RendererView'))
[
  "fixture:template/MarkdownRendererView.tsx",
  "fixture:template/__generated__/MarkdownRendererView_name$normalization.graphql.ts",
  "fixture:template/__generated__/MarkdownRendererView_name.graphql.ts"
]
```

## SSR HTML

```html
<main><p>The server read a <!-- -->26<!-- -->-character note.</p><section><!--$--><div>Markdown: <!-- -->**Ada**</div><!--/$--></section></main>
```

## HTML

```html
<main><p>The server read a <!-- -->26<!-- -->-character note.</p><section><!--$--><div>Markdown: <!-- -->**Ada**</div><!--/$--></section></main>
```
