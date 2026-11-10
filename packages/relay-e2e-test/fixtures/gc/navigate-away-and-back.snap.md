## Console

```
server: viewer
navigate: Alice
server: user(id: "alice")
navigate: Home
navigate: Bob
server: user(id: "bob")
navigate: Home
gc: removed nothing; kept alice, bob, client:root
navigate: Alice
navigate: Home
gc: removed bob; kept alice, client:root
navigate: Bob
server: user(id: "bob")
```

## HTML

```html
<header>Signed in as Alice</header><nav><button>Home</button><button>Alice</button><button>Bob</button></nav><main>Bob: Writes GraphQL servers</main><footer>Garbage collections: 2</footer>
```
