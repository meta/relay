## Console

```
navigate: Weather
server: forecast(city: "London")
refetch: Paris
server: forecast(city: "Paris")
refetch: Tokyo
server: forecast(city: "Tokyo")
navigate: Home
gc: removed london; kept client:root, paris, tokyo
navigate: Weather
server: forecast(city: "London")
```

## HTML

```html
<nav><button>Home</button><button>Weather</button></nav><section><p>London: Rain</p><button>London</button><button>Paris</button><button>Tokyo</button></section><footer>Garbage collections: 1</footer>
```
