# Production Observability Design

**Date:** 2026-08-10

**Status:** Approved through the user's preapproved plan-amendment authority, subject to the explicit package-publication checkpoint

## Outcome

Every newly generated `portfolio` and `site` will eventually include privacy-safe operational evidence through Cloudflare Workers Logs, Better Stack server ingestion, browser-error reporting, and web-vitals reporting. The public observability package owns stable provider-neutral events and delivery boundaries. Generated Cloudflare/Next.js source owns framework and platform composition. Analytics remains absent.

## Approaches considered

### Adopt `@logtail/next`

This follows Better Stack's current framework guide most directly. It also adds runtime dependencies, broad peer-version coupling, a framework-owned proxy/client surface, and browser-token configuration that is wider than this repository's server-secret and replaceable-package boundaries. Rejected for the default profile.

### Generate all observability source and keep the public package empty

This avoids a package release but duplicates the canonical event/redaction/test contract into every repository and leaves the approved public package without a concrete consumer. It would make the package dependency ceremonial and violate the source plan's package ownership. Rejected.

### Build a zero-dependency public contract with injected transports

The package owns immutable event values, validation, redaction, normalized error categories, context, a non-throwing dispatcher, Better Stack protocol encoding, structured-log sinks, browser envelopes, and test sinks/assertions. It imports no Cloudflare, Next.js, React, DOM, or Node runtime API. Generated adapters inject `fetch`, console/object logging, browser sending, time, identity, and Cloudflare context. Selected because it is the smallest boundary that satisfies privacy, replacement, runtime isolation, and testability.

## Public package

The package exposes four explicit ESM surfaces:

- root: event/context types, event construction, error normalization, redaction, and non-throwing dispatch;
- `./server`: Better Stack protocol sink and structured-object log sink using injected adapters;
- `./browser`: bounded same-origin browser envelope construction and injected delivery;
- `./testing`: an in-memory sink plus assertions that fail with stable content-safe codes.

Events have fixed severity, runtime, and kind vocabularies; a semantic event name; an ISO timestamp from an injected clock; optional normalized error category; correlation/release context made only from bounded tokens; and attributes admitted through an explicit allowlist. Redaction drops prohibited keys, replaces secret-like values, bounds strings and collection size, and never serializes `Error`, message, stack, cause, request data, or arbitrary objects.

The dispatcher freezes the event, invokes every sink, converts thrown/rejected sinks to content-safe failure results, and never lets telemetry failure become an application failure. Better Stack delivery accepts only a validated `*.betterstackdata.com` HTTPS host, sets the bearer token only in the injected request headers, caps the encoded record below the provider limit, accepts documented success statuses, and returns status categories without response content, URL, token, or payload echoes.

## Generated composition after publication

The later generated integration will add:

- explicit Workers Logs and head-sampling configuration in the deployment-owned Wrangler file;
- a Cloudflare version-metadata binding and required Better Stack host/token secrets;
- a Cloudflare adapter under `src/infrastructure/cloudflare` that is the only source reading bindings or execution context;
- server composition under `src/infrastructure/observability` that emits structured objects to Workers Logs and schedules Better Stack delivery through the Cloudflare execution context;
- root `instrumentation.ts` using Next.js `onRequestError` without exporting raw request/error content;
- lightweight `instrumentation-client.ts` listeners for global error and unhandled-rejection categories;
- an infrastructure-owned `useReportWebVitals` client component that reports only metric name, numeric value/delta, rating, and navigation type;
- a same-origin route that rejects cross-origin, oversized, wrong-content-type, unknown-field, and invalid-vocabulary payloads, then reconstructs a server-owned event; and
- browser checks for exact bounded error delivery plus build/type evidence for the web-vitals hook.

The browser sends no page URL, referrer, pathname, query, cookie, header, form value, email, IP address, user agent, error message, filename, stack, cause, console output, persistent identifier, or arbitrary attribute. It uses no browser storage. A fresh per-event correlation identifier is allowed; no identifier persists across navigation or visits.

## Ownership and lifecycle

`deployment-cloudflare` remains the canonical owner of the complete Wrangler file. `observability` owns its package value and generated application files, and uses inference probes for the dependency-owned Wrangler values without claiming an overlapping managed surface. The materialized profile recipes advance together, capability/state fingerprints regenerate only from successful output, and immutable fixture lockfiles use public registry artifacts only.

The material capability change replaces the observability legacy-backfill exemption with a task-linked pending certification record. The sibling certification plan will require a fresh compiled-CLI scaffold, local runtime/browser evidence, one protected-staging Worker, provider-confirmed Workers Logs and Better Stack receipt evidence, browser-error and web-vitals evidence, bounded synthetic data, credential disposition, and source/provider cleanup separation. It cannot run without new authorization.

## Release sequencing

The public package source candidate is coherent and reviewable before publication. The full generated capability is not. Execution therefore uses these gates:

1. locally implement, verify, review, and commit the public package source candidate and Changeset;
2. stop for exact-diff approval plus separate authority for versioning/integration, push, and trusted publication;
3. verify the exact public versions from npm;
4. implement the builder descriptor, templates, recipes, generated fixtures, state fingerprints, documentation, and pending certification task;
5. independently review, repair, fully verify, and stop for implemented-task approval;
6. run capability certification only as a later separately authorized task.

No local alias or tarball may bridge the release boundary.

## Verification strategy

Strict TDD protects each realistic break:

- invalid events, secret-bearing attributes, oversized values, mutable returned objects, and error-message leakage;
- wrong error category and invalid correlation/release tokens;
- one failing sink suppressing another sink or escaping into the application;
- invalid Better Stack hosts, token exposure, oversized records, wrong authorization, non-success/provider failures, and response-body leakage;
- browser envelopes accepting arbitrary fields or raw error content;
- test assertions passing the wrong event;
- package exports, pack inventory, zero runtime dependencies, and public consumer importability;
- later template ownership, inference, rendered manifests, exact fixture files, browser behavior, Cloudflare isolation, and analytics absence.

Static/package tests establish contract behavior only. Fixed generated installs/builds and browser suites establish the named local execution paths only. Protected-staging and provider evidence remain separate certification outcomes.
