## Console

```
error:  Server  Error: Ledger unavailable

The above error occurred in the <Balance> component.

React will try to recreate this component tree from scratch using the error boundary you provided, ErrorBoundary.

```

## Server Console

```
rsc: Ledger unavailable
ssr: Ledger unavailable
```

## Network

```
GET / -> 200 text/html
```

## Browser Modules

```
fixture:template/ErrorBoundary.tsx
```

## SSR HTML

```html

```

## HTML

```html
<main><h1>Account</h1><p role="alert">Balance failed: Ledger unavailable</p></main>
```
