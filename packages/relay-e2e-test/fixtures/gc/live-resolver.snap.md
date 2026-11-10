## Console

```
inbox: subscribed (listeners: 1)
inbox: new message
navigate: Settings
navigate: Home
gc: removed settings; kept alice, client:root, client:root:$r:unreadCount
inbox: new message
navigate: Sign out
inbox: unsubscribed (listeners: 0)
gc: removed alice, client:root:$r:unreadCount; kept client:root
inbox: new message
navigate: Sign in
inbox: subscribed (listeners: 1)
```

## HTML

```html
<button>Simulate new message</button><button>Sign out</button><header>Alice: 3 unread</header><nav><button>Home</button><button>Settings</button></nav><main>Home</main><footer>Garbage collections: 2</footer>
```
