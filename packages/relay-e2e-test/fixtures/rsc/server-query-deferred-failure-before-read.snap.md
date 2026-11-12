## Console

```
error:  Server  Error: Karma service unavailable

The above error occurred in the <KarmaCard> component.

React will try to recreate this component tree from scratch using the error boundary you provided, Boundary.

```

## Server Console

```
rsc: Karma service unavailable
```

## Network

```
GET / -> 200 text/html
```

## Browser Modules

```
fixture:template/Boundary.tsx
fixture:template/KarmaCard.tsx
fixture:template/__generated__/KarmaCardDetails_user.graphql.ts
fixture:template/__generated__/KarmaCard_user.graphql.ts
```

## SSR HTML

```html
<main><h1>Ada</h1><!--$?--><template id="B:0"></template><p>Loading card...</p><!--/$--></main><div hidden id="S:0"><section><p>Card for <!-- -->Ada</p><template id="P:1"></template></section></div>
```

## HTML

```html
<main><h1>Ada</h1><p role="alert">Card failed</p></main>
```
