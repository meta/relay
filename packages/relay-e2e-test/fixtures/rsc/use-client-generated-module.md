# A Generated `'use client'` Module Is a Client Reference

Any module whose directive prologue has `'use client'` is a client module,
including files under `__generated__/`: the Relay compiler can emit artifacts
that the browser needs, and server code that imports one must hand it to the
browser by reference rather than evaluate it. On the server the import is a
client reference; passed to a Client Component, it arrives as the module's
real export.

This fixture writes such a module itself, standing in for compiler output.

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
/** @gqlQueryField */
export function greeting(): string {
  return "Hello!";
}
```

## Generated Client Module

```ts title="__generated__/PageClientArtifact.ts"
"use client";

export default { kind: "ClientArtifact", name: "PageClientArtifact" };
```

## Page

```tsx title="Page.tsx"
import ArtifactName from "./ArtifactName";
import artifact from "./__generated__/PageClientArtifact";

export default function Page() {
  return (
    <main>
      <p>The server holds {"$$typeof" in artifact ? "a client reference" : "the module"}.</p>
      <ArtifactName artifact={artifact} />
    </main>
  );
}
```

## Artifact Name

```tsx title="ArtifactName.tsx"
"use client";

export default function ArtifactName(props: {
  artifact: { kind: string; name: string };
}) {
  return (
    <p>
      The browser holds {props.artifact.kind} {props.artifact.name}.
    </p>
  );
}
```

## Steps

```steps
wait "The browser holds ClientArtifact PageClientArtifact."
```
