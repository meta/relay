## Network

```
GET / -> 200 text/html
```

## Browser Modules

```
fixture:template/PlainTextRendererView.tsx
fixture:template/RendererCard.tsx
fixture:template/__generated__/PlainTextRendererView_name$normalization.graphql.ts
fixture:template/__generated__/PlainTextRendererView_name.graphql.ts
fixture:template/__generated__/RendererCard_user$moduleProviders.client.ts
fixture:template/__generated__/RendererCard_user.graphql.ts
```

## Evaluated

```
modules.filter(name => name.includes('RendererCard_'))
[
  "fixture:template/__generated__/RendererCard_user$moduleProviders.client.ts",
  "fixture:template/__generated__/RendererCard_user.graphql.ts"
]

modules.filter(name => name.includes('RendererView'))
[
  "fixture:template/PlainTextRendererView.tsx",
  "fixture:template/__generated__/PlainTextRendererView_name$normalization.graphql.ts",
  "fixture:template/__generated__/PlainTextRendererView_name.graphql.ts"
]
```

## SSR HTML

```html
<main><section>literal<!-- -->:<!-- --> <!--$--><span>Plain: <!-- -->text@2</span><!--/$--></section><section>variable<!-- -->:<!-- --> <!--$--><span>Plain: <!-- -->text@5</span><!--/$--></section></main>
```

## HTML

```html
<main><section>literal<!-- -->:<!-- --> <!--$--><span>Plain: <!-- -->text@2</span><!--/$--></section><section>variable<!-- -->:<!-- --> <!--$--><span>Plain: <!-- -->text@5</span><!--/$--></section></main>
```
