## Console

```
navigate: Bob
server: user(id: "bob")
follow: Bob
navigate: Home
navigate: Bob
navigate: Home
network: send pending mutation
server: follow(id: "bob")
gc: removed bob; kept client:root
navigate: Bob
server: user(id: "bob")
```

## HTML

```html
<nav><button>Home</button><button>Bob</button><button>Send pending mutation</button></nav><main><p>Bob: Following</p><button>Follow</button></main><footer>Garbage collections: 1</footer>
```
