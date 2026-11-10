# Garbage Collection — Refetchable Fragment

A weather page reads a `@refetchable` fragment. Its first forecast comes from
the page query, and each refetch fetches the refetch query for a new city.
Leaving the page releases the page query, and the next garbage collection
removes the first forecast. Opening the page again fetches the page query
once.

Known limit: the refetched forecasts are not removed. `QueryResource` holds
each refetch query for 5 minutes after its last render, even after the
fragment replaces it or unmounts (see the "FIXME should be released" in
`useRefetchableFragmentNode-test.js`). This fixture does not wait that long,
so its collection keeps them.

The store keeps no released queries (`gcReleaseBufferSize: 0`), so each
release starts a collection.

## Relay Config

```json title="relay.config.json"
{
  "src": "./",
  "schema": "./schema.graphql",
  "language": "typescript"
}
```

## Server

```ts title="server.ts"
import type { ID } from "grats";

/** @gqlType */
type Forecast = {
  /** @gqlField */
  id: ID;
  /** @gqlField */
  city: string;
  /** @gqlField */
  summary: string;
};

const summaries: { [city: string]: string } = {
  London: "Rain",
  Paris: "Sunny",
  Tokyo: "Cloudy",
};

/** @gqlQueryField */
export function forecast(args: { city: string }): Forecast {
  console.log(`server: forecast(city: "${args.city}")`);
  return {
    id: args.city.toLowerCase(),
    city: args.city,
    summary: summaries[args.city],
  };
}
```

## App

```tsx title="App.tsx"
import { Suspense, useState, useSyncExternalStore } from "react";
import {
  RelayEnvironmentProvider,
  useLazyLoadQuery,
  useRefetchableFragment,
} from "react-relay";
import {
  graphql,
  Environment,
  LogEvent,
  RecordSource,
  Store,
} from "relay-runtime";
import { gratsNetwork } from "../GratsNetwork";
import { AppWeatherQuery } from "./__generated__/AppWeatherQuery.graphql";
import { AppForecastRefetchQuery } from "./__generated__/AppForecastRefetchQuery.graphql";
import { App_forecast$key } from "./__generated__/App_forecast.graphql";

let recordsBeforeGC: string[] = [];
let gcCount = 0;
const gcListeners = new Set<() => void>();

function logGC(event: LogEvent) {
  if (event.name === "store.gc.start") {
    recordsBeforeGC = store.getSource().getRecordIDs();
  } else if (event.name === "store.gc.end") {
    const kept = store.getSource().getRecordIDs().sort();
    const removed = recordsBeforeGC.filter((id) => !kept.includes(id)).sort();
    console.log(
      `gc: removed ${removed.join(", ") || "nothing"}; kept ${kept.join(", ")}`,
    );
    gcCount += 1;
    gcListeners.forEach((listener) => listener());
  }
}

function GCCount() {
  const count = useSyncExternalStore(
    (listener) => {
      gcListeners.add(listener);
      return () => {
        gcListeners.delete(listener);
      };
    },
    () => gcCount,
  );
  return <footer>Garbage collections: {count}</footer>;
}

const store = new Store(new RecordSource(), {
  gcReleaseBufferSize: 0,
  log: logGC,
});
const environment = new Environment({ network: gratsNetwork, store });

function Forecast({ query }: { query: App_forecast$key }) {
  const [data, refetch] = useRefetchableFragment<
    AppForecastRefetchQuery,
    App_forecast$key
  >(
    graphql`
      fragment App_forecast on Query
      @refetchable(queryName: "AppForecastRefetchQuery")
      @argumentDefinitions(city: { type: "String!" }) {
        forecast(city: $city) {
          id
          city
          summary
        }
      }
    `,
    query,
  );
  return (
    <section>
      <p>
        {data.forecast?.city}: {data.forecast?.summary}
      </p>
      {["London", "Paris", "Tokyo"].map((city) => (
        <button
          key={city}
          onClick={() => {
            console.log(`refetch: ${city}`);
            refetch({ city });
          }}
        >
          {city}
        </button>
      ))}
    </section>
  );
}

function WeatherPage() {
  const data = useLazyLoadQuery<AppWeatherQuery>(
    graphql`
      query AppWeatherQuery {
        ...App_forecast @arguments(city: "London")
      }
    `,
    {},
  );
  return <Forecast query={data} />;
}

export default function TestApp() {
  const [page, setPage] = useState("Home");
  return (
    <RelayEnvironmentProvider environment={environment}>
      <nav>
        {["Home", "Weather"].map((name) => (
          <button
            key={name}
            onClick={() => {
              console.log(`navigate: ${name}`);
              setPage(name);
            }}
          >
            {name}
          </button>
        ))}
      </nav>
      <Suspense fallback={<main>Loading forecast...</main>}>
        {page === "Weather" ? <WeatherPage /> : <main>Home</main>}
      </Suspense>
      <GCCount />
    </RelayEnvironmentProvider>
  );
}
```

## Steps

```steps
click button "Weather"
wait "London: Rain"
click button "Paris"
wait "Paris: Sunny"
click button "Tokyo"
wait "Tokyo: Cloudy"
wait "Garbage collections: 0"
click button "Home"
wait "Garbage collections: 1"
click button "Weather"
wait "London: Rain"
```
