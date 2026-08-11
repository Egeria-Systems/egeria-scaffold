# @egeria-systems/observability

Privacy-safe operational event contracts and injected delivery boundaries for generated applications.

The package has no runtime dependencies. It imports no framework, platform SDK, browser API, or Node.js runtime API. Applications inject clocks, structured-log writers, HTTP requests, and browser senders at their composition roots.

## API surfaces

- `@egeria-systems/observability` creates immutable allowlisted events, normalizes error categories without reading messages, and dispatches to every sink without letting telemetry failure escape.
- `@egeria-systems/observability/server` provides injected structured-object logging and Better Stack HTTP protocol delivery.
- `@egeria-systems/observability/browser` admits canonical browser events into a bounded envelope and sends it through an injected same-origin boundary.
- `@egeria-systems/observability/testing` provides an in-memory sink and content-safe event assertions.

```ts
import {
  createOperationalEvent,
  dispatchOperationalEvent,
} from "@egeria-systems/observability";
import { createMemorySink } from "@egeria-systems/observability/testing";

const created = createOperationalEvent(
  {
    name: "example.application.ready",
    kind: "application.lifecycle",
    runtime: "server",
    severity: "info",
    context: { correlationId: "example-correlation" },
  },
  { clock: { now: () => new Date() } },
);

if (created.ok) {
  const memory = createMemorySink();
  await dispatchOperationalEvent(created.value, [memory.sink]);
}
```

## Privacy and failure contract

Event names, context tokens, and string attributes use bounded token vocabularies. Attributes are flat scalar values admitted only through an explicit allowlist. Prohibited private-data keys, unsafe strings, nested values, non-finite numbers, raw errors, messages, stacks, causes, request data, and arbitrary objects are not emitted.

The Better Stack boundary accepts only a validated `betterstackdata.com` ingestion host and a bounded server-held bearer token. It never exposes configuration, provider response content, request payloads, or thrown error content in results. The browser surface contains no token, storage, replay, behavioral capture, analytics, or console interception.

Every sink returns a bounded delivery category. The dispatcher attempts every sink and contains thrown, rejected, or malformed results so observability cannot become an application failure path.

Analytics remains an independent capability. Importing this package never enables Cloudflare Web Analytics or another visitor-analytics provider. The canonical ownership boundary is recorded in [Package Ownership](../../docs/architecture/package-ownership.md).

Run `pnpm run verify` in this package to build declarations and JavaScript, lint the strict source, run behavior tests, and type-check the package.

## Source and license

The package source is [`packages/observability`](https://github.com/Egeria-Systems/egeria-scaffold/tree/main/packages/observability). It is licensed under [Apache-2.0](LICENSE).
