# @egeria-systems/observability

Bounded operational event and restricted error-diagnostic contracts with injected delivery boundaries for generated applications.

The package has zero runtime dependencies. It imports no framework, platform SDK, browser API, or Node.js runtime API. Applications inject clocks, structured-log writers, HTTP requests, and browser senders at their composition roots.

## API surfaces

- `@egeria-systems/observability` creates immutable schema `2.0.0` allowlisted events and bounded error reports. `OperationalSink` receives safe events only; `DiagnosticSink` explicitly opts into restricted diagnostics. Both dispatch paths contain telemetry failure.
- `@egeria-systems/observability/server` provides injected structured-object logging plus distinct safe and restricted Better Stack HTTP adapters. Exact HTTP `202` is the only success status.
- `@egeria-systems/observability/browser` emits distinct schema `2.0.0` `operational-event` and `error-report` envelopes. Error reports are reduced deterministically to at most 8,192 UTF-8 bytes and use an injected same-origin transport.
- `@egeria-systems/observability/testing` provides safe and diagnostic in-memory sinks with content-safe assertions.

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
    context: {
      eventId: "example-event",
      correlationId: "example-operation",
      service: "web",
    },
  },
  { clock: { now: () => new Date() } },
);

if (created.ok) {
  const memory = createMemorySink();
  await dispatchOperationalEvent(created.value, [memory.sink]);
}
```

Unexpected errors use a separate report and sink contract:

```ts
import {
  createOperationalErrorReport,
  createOperationalEvent,
  dispatchOperationalErrorReport,
} from "@egeria-systems/observability";

const errorEvent = createOperationalEvent(
  {
    name: "example.application.error",
    kind: "application.error",
    runtime: "server",
    severity: "error",
    context: { eventId: "example-error", service: "web" },
    errorCategory: "unexpected",
  },
  { clock: { now: () => new Date() } },
);
const report = errorEvent.ok
  ? createOperationalErrorReport(
      errorEvent.value,
      new Error("example failure"),
      { mechanism: "selected-catch", handled: true },
      {},
    )
  : undefined;

if (report?.ok) {
  await dispatchOperationalErrorReport(report.value, {
    operationalSinks: [workersLogsSink],
    diagnosticSinks: [approvedDiagnosticSink],
  });
}
```

The example sink variables are application-owned injected boundaries. The package does not discover providers or credentials.

## Privacy and failure contract

Event names, context tokens, and string attributes use bounded token vocabularies. Attributes are flat scalar values admitted only through an explicit allowlist. Prohibited private-data keys, unsafe strings, nested values, non-finite numbers, raw errors, messages, stacks, causes, request data, and arbitrary objects are excluded from the safe event tier.

Error reports read only known Error-like fields through guarded access. They bound messages to 2,048 UTF-8 bytes, stacks to 16,384 UTF-8 bytes and 64 lines, causes to two links, and replace common secret, credential, token, email, IP, URL-detail, and absolute-path shapes. These reports are restricted operational data. Regex-based redaction reduces obvious exposure but is not a privacy guarantee. Provider access, region, retention, deletion, and operator handling require separate review and certification.

The Better Stack boundary accepts only a validated `betterstackdata.com` ingestion host and a bounded server-held bearer token. It never exposes configuration, provider response content, request payloads, or thrown error content in results. Safe error delivery is suppressed when the same approved Better Stack identifier receives the enriched diagnostic report, avoiding duplicate provider records. The browser surface contains no provider token, storage, replay, behavioral capture, analytics, or console interception.

Every sink returns a bounded delivery category. The dispatcher attempts every sink and contains thrown, rejected, or malformed results so observability cannot become an application failure path.

Analytics remains an independent capability. Importing this package never enables Cloudflare Web Analytics or another visitor-analytics provider. The canonical ownership boundary is recorded in [Package Ownership](../../docs/architecture/package-ownership.md).

## Compatibility and release state

The source candidate advances events and browser envelopes from schema `1.0.0` to `2.0.0`, requires `eventId` and `service`, and makes `correlationId` optional. It is intended for the next pre-1.0 minor release and is not backward compatible with the published `0.2.0` contract. The manifest intentionally remains `0.2.0`; the pending Changeset records version intent but does not authorize versioning or publication.

Run `pnpm run verify` in this package to build declarations and JavaScript, lint the strict source, run behavior tests, and type-check the package.

## Source and license

The package source is [`packages/observability`](https://github.com/Egeria-Systems/egeria-scaffold/tree/main/packages/observability). It is licensed under [Apache-2.0](LICENSE).
