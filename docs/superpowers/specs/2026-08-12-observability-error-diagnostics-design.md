# Observability Error Diagnostics Design

**Date:** 2026-08-12

**Status:** Approved by the user for implementation planning; implementation remains subject to the execution gates below

## Outcome

Generated `portfolio` and `site` applications will report every observable unexpected or unhandled browser and server error through the framework/runtime capture points available to them. They will also expose an explicit reporting boundary for unexpected errors that application code intentionally catches.

Every error report has two deliberately separate data tiers:

1. a bounded operational event that is safe for every configured operational sink; and
2. restricted exception diagnostics, including the error message and stack, that are sent only to an explicitly approved diagnostic sink.

For the first implementation, the generated Cloudflare structured-log sink writes only the safe operational event. Cloudflare may independently retain provider-controlled platform errors and uncaught exceptions outside that custom schema; the existing certification lifecycle continues to own their actual fields and retention. Better Stack is the only approved custom diagnostic sink and receives one enriched error record containing the safe event plus the restricted diagnostics. Non-error operational events continue to use the existing safe delivery path. A later provider can replace Better Stack by implementing the provider-neutral diagnostic-sink contract; browser code, capture policy, operational events, and framework adapters do not depend on a provider SDK.

## Current verified behavior and gaps

At planning base `2a315aa0e7dce1bf1048b9a2c07e318add9241de`, generated applications:

- register `window` `error` and `unhandledrejection` listeners, but discard `ErrorEvent.error`, `PromiseRejectionEvent.reason`, message, and stack;
- register Next.js `onRequestError`, but use only its first `error` argument and discard the request-safe framework context and error digest;
- create a new correlation identifier for every event, although that value identifies an event rather than a multi-event operation;
- send the same bounded event to Workers Logs and Better Stack;
- have no App Router `error.tsx` or `global-error.tsx` reporting boundary;
- have no explicit API for unexpected errors intentionally caught at selected application boundaries; and
- correctly keep expected validation/control-flow failures and observability-delivery failures out of recursive error reporting.

This means the present implementation reports the existence and broad category of the global errors it observes, but does not provide enough diagnostic evidence to locate or understand most failures. It also cannot promise literally every thrown error: browsers and frameworks do not expose handled errors globally, cross-origin browser failures can be intentionally opaque, termination can interrupt best-effort delivery, and a caught error is observable only where application code explicitly reports it.

The target claim is therefore:

> Report every unexpected or unhandled error exposed by the supported browser and Next.js capture points, and explicitly report unexpected errors at selected catch or error-boundary boundaries. Keep expected errors as modeled control flow. Delivery remains best effort and independently certified.

## Approaches considered

### Put messages and stacks in the existing event attributes

Rejected. Existing operational sinks are intentionally privacy-safe. Adding restricted strings to generic attributes would silently expose them to Workers Logs, future sinks, tests, and any consumer that assumes the current safe contract.

### Replace the package with a Better Stack or Sentry SDK

Rejected for the default generated profile. Better Stack Errors is Sentry-SDK compatible and can provide a richer vendor-managed error product, but making the SDK the application capture boundary would add provider coupling, browser/provider configuration, runtime dependencies, and a broader data surface. The public package must remain a replaceable boundary.

### Add an explicit provider-neutral diagnostic tier

Selected. The package distinguishes safe event delivery from restricted diagnostic delivery in its types and dispatch API. Generated adapters decide which sink is approved for each tier. This keeps messages and stacks available for debugging without weakening the safe operational contract.

## Public data model

The public package advances to a new pre-1.0 minor version because the generated contract changes materially. The implementation targets `@egeria-systems/observability@0.3.0`, contingent on the release gate confirming that exact version is absent from the registry. Version `0.3.0` uses operational-event and browser-envelope schema `2.0.0`. Existing generated repositories remain on their immutable `0.2.0` dependency and application-owned schema `1.0.0` unless a separately approved migration changes them.

The conceptual contract is:

```ts
type OperationalContext = Readonly<{
  eventId: string;
  correlationId?: string;
  releaseId?: string;
  service: string;
  // Supported for other package consumers; generated applications omit it.
  environment?: string;
}>;

type ErrorCaptureContext = Readonly<{
  mechanism:
    | "browser-error-event"
    | "browser-unhandled-rejection"
    | "react-error-boundary"
    | "next-request-error"
    | "selected-catch";
  handled: boolean;
  operation?: string;
  routerKind?: "app-router" | "pages-router";
  routeType?: "action" | "proxy" | "render" | "route";
  renderSource?:
    | "react-server-components"
    | "react-server-components-payload"
    | "server-rendering";
  renderType?: "dynamic" | "dynamic-resume";
  revalidateReason?: "on-demand" | "stale";
  requestMethod?: string;
  routeIdentifier?: string;
}>;

type ExceptionDiagnostics = Readonly<{
  exceptionType: string;
  exceptionMessage?: string;
  exceptionStacktrace?: string;
  exceptionCode?: string;
  exceptionDigest?: string;
  fingerprint: string;
  cause?: ExceptionDiagnostics;
  truncated: boolean;
}>;

type OperationalErrorReport = Readonly<{
  event: OperationalEvent;
  capture: ErrorCaptureContext;
  diagnostics: ExceptionDiagnostics;
}>;

type OperationalErrorReportResult =
  | Readonly<{ ok: true; value: OperationalErrorReport }>
  | Readonly<{ ok: false; code: OperationalErrorReportValidationCode }>;

type OperationalSink = Readonly<{
  identifier: string;
  write(event: OperationalEvent): SinkWriteResult | Promise<SinkWriteResult>;
}>;

type DiagnosticSink = Readonly<{
  identifier: string;
  writeReport(
    report: OperationalErrorReport,
  ): SinkWriteResult | Promise<SinkWriteResult>;
}>;
```

The contract must preserve these invariants:

- an `OperationalSink` cannot receive diagnostics;
- a `DiagnosticSink` must opt in through a distinct method and type;
- an error report contains exactly one canonical operational event;
- ordinary event attributes still reject messages, stacks, causes, URLs, paths, headers, cookies, tokens, and arbitrary objects;
- `eventId` identifies one occurrence; `correlationId` is optional and is used only when a genuine request or operation identifier exists;
- returned events, capture context, diagnostics, reports, dispatch results, and serialized records are immutable; and
- hostile getters, proxies, cyclic causes, and non-`Error` rejection reasons cannot throw through the capture boundary.

The exception field names follow the stable OpenTelemetry exception concepts (`exception.type`, `exception.message`, and `exception.stacktrace`) at the provider-record boundary without adopting an OpenTelemetry SDK or claiming full semantic-convention compliance.

## Delivery matrix

| Data | Workers structured-log sink | Better Stack operational sink | Better Stack diagnostic sink |
| --- | --- | --- | --- |
| Lifecycle and web-vital event | safe event | safe event | not called |
| Unexpected error | safe event | not called separately | one enriched report containing the safe event and restricted diagnostics |
| Diagnostic-delivery failure | one new safe delivery-health event | not called | never recursively retried |

This avoids duplicate Better Stack error records while ensuring Workers Logs still receives the safe occurrence and release/context markers.

Dispatch is non-throwing. A failed diagnostic sink produces only a bounded local delivery result. Generated server composition may emit one safe `observability.delivery.failed` record to Workers Logs containing the approved sink identifier and normalized failure reason. It must not include the original message, stack, provider response, URL, token, or request data, and it must not recurse through the failed diagnostic path.

## Restricted diagnostic construction

Message and stack capture is necessary for practical debugging, but both are sensitive operational data. OpenTelemetry explicitly warns that exception messages may contain sensitive information. Sanitization reduces exposure; it cannot prove that arbitrary application text contains no personal or confidential data.

The package therefore:

- reads only known `Error`-like fields through guarded access;
- accepts non-`Error` rejection reasons without serializing arbitrary objects;
- bounds exception type/code/digest tokens;
- bounds a server message to 2,048 UTF-8 bytes;
- bounds a server stack to 16,384 UTF-8 bytes and at most 64 logical lines;
- follows at most two `cause` links, stops on cycles, and never enumerates arbitrary object properties;
- removes URL query strings and fragments;
- replaces absolute runtime/build prefixes while retaining bounded relative file/function/line/column information where possible;
- redacts common authorization, cookie, credential, password, secret, bearer-token, API-key, JWT, email-address, and IP-address shapes;
- marks truncation or redaction with fixed tokens rather than copying rejected content; and
- computes a versioned FNV-1a 32-bit grouping fingerprint from normalized exception type, normalized top application frame, and optional framework digest, never from the raw complete message. This is a deterministic grouping aid, not a cryptographic identity.

The implementation must prove exact byte and line bounds with multibyte input. It must also document that regex-based redaction is defense in depth, not a privacy guarantee. Access control, provider region, retention, deletion, and operator handling for restricted diagnostics remain certification decisions.

The browser transport keeps the existing 8,192-byte request limit as a single end-to-end contract. `createBrowserErrorEnvelope` serializes schema `2.0.0` and guarantees an output of at most 8,192 UTF-8 bytes by deterministically removing causes, then truncating the stack, then truncating the message, preserving fixed truncation markers at each step. If the already-bounded safe event, capture context, exception type, and fingerprint cannot fit without optional message/stack/cause fields, it returns `BROWSER_ERROR_ENVELOPE_TOO_LARGE` and sends nothing. The server route rejects any declared or streamed body above exactly 8,192 bytes before parsing. Server-originated diagnostic delivery retains the larger server message/stack limits because it does not traverse this browser route.

## Browser capture and context

`instrumentation-client.ts` passes the actual `ErrorEvent.error` value to the reporter. If that is absent, it may use the event message as restricted diagnostic input, but it never sends `filename`, page URL, referrer, pathname, query, user agent, or resource target. The `unhandledrejection` handler passes `PromiseRejectionEvent.reason`, which may be any JavaScript value.

The browser reporter:

- reports `browser.window.error` with mechanism `browser-error-event` and `handled: false`;
- reports `browser.unhandled.rejection` with mechanism `browser-unhandled-rejection` and `handled: false`;
- exposes `reportCaughtBrowserError(error, { operation })` for deliberately selected async/event-handler catch boundaries;
- exposes `reportReactBoundaryError(error, { boundary })` for generated App Router boundaries;
- uses a module-local `WeakSet<object>` to suppress repeated reports of the same error object in the browser runtime;
- does not use cookies, local storage, session storage, IndexedDB, a persistent device/user/session identifier, or a page URL; and
- creates a fresh `eventId` per accepted occurrence.

Generated `app/error.tsx` and `app/global-error.tsx` are client error boundaries. They report the received error once in an effect and render accessible recovery UI. `global-error.tsx` owns its required `html` and `body` elements. All visible fallback and retry copy originates in a validated `content/en-CA/observability.yaml` file and is passed to a pure presentation component.

The same-origin browser route continues to enforce origin, fetch metadata fallback, media type, declared and streamed byte limits, exact keys, vocabularies, and empty responses. Schema `2.0.0` has distinct `operational-event` and `error-report` envelope discriminators. The route passes parsed error-report data through `reconstructOperationalErrorReport(input)`, which strictly revalidates, re-sanitizes, re-bounds, brands, and freezes the plain transport value. It never trusts browser-side sanitization. Web-vital envelopes remain safe and contain no diagnostics.

## Server capture and context

`instrumentation.ts` consumes all three Next.js `onRequestError(error, request, context)` parameters and awaits reporting as required by the framework contract.

The generated server reporter includes:

- error category;
- capture mechanism and handled state;
- Next.js error digest when it passes the bounded token policy;
- request method from a fixed allowlist;
- router kind, route type, render source, render type, and revalidation reason from their documented vocabularies;
- a normalized stable route identifier derived from `context.routePath`, not `request.path`; and
- event, optional genuine correlation, release, and service identifiers.

Generated applications always set `service` to the fixed semantic token `web`. They omit optional `environment` in this increment because no canonical generated configuration owns such a value; they do not infer it from a hostname, URL, branch, or provider metadata. Other public-package consumers may supply an optional bounded environment token.

The generated reporter never records `request.path`, a literal URL, query, headers, cookie, request/response body, IP, user agent, or raw framework object. Route normalization accepts only the documented route-file pattern, converts dynamic/group segments to stable semantic tokens, bounds the result, and drops it if validation fails.

The reporter also exposes:

```ts
reportCaughtServerError(
  error: unknown,
  context: Readonly<{ operation: string; correlationId?: string }>,
): Promise<void>
```

Call sites use this only when a caught failure is unexpected and the application is containing, translating, retrying, or recovering from it. Expected validation/domain results are not reported as exceptions. A catch that immediately rethrows without changing observability relies on `onRequestError` to avoid duplication. Observability transport/configuration catches never report through the same pipeline.

The current generated runtime has no eligible server application catch to instrument: its catches validate expected content/input, contain observability failure, or exist only in tests/configuration. The implementation adds and tests the explicit boundary but does not invent a production failure solely to exercise it.

## Provider portability

The package owns capture, sanitization, immutable report construction, dispatch, provider-neutral diagnostic sink types, and test sinks/assertions. It has zero runtime dependencies and imports no DOM, React, Next.js, Node, Cloudflare, Better Stack, or Sentry SDK.

`createBetterStackDiagnosticSink` remains isolated in the `./server` export and uses the existing injected HTTP request boundary. Its enriched JSON encoding is provider-specific, but its input is the provider-neutral error report. Replacing Better Stack requires a new adapter and composition change, not changes to browser/framework capture or the domain contract.

Better Stack is approved for restricted diagnostics only after the deployment owner supplies the existing server-held ingest host/token and certification confirms source access, region, retention, quota/spend, and deletion. No provider credential is exposed to the browser.

## Source maps, tracing, and limits of this increment

Raw message and stack strings are included because they materially improve debugging. They do not guarantee original TypeScript source locations after bundling or minification.

Cloudflare can upload source maps and use them to deobfuscate exceptions in Cloudflare tooling, but its documentation states that uploaded maps are unavailable inside a Worker and do not deobfuscate `Error.stack` read at runtime. Better Stack Errors requires a separate Sentry-compatible Errors application and source-map upload credentials. Adding either provider-specific upload path would introduce new secrets, build/deploy behavior, retention, provider resources, and external certification.

This implementation therefore does not:

- enable `upload_source_maps`;
- add Sentry or OpenTelemetry SDKs;
- create a Better Stack Errors application;
- upload source maps;
- add traces, spans, session replay, browser storage, console interception, or automatic request capture; or
- claim deobfuscated production stacks.

A separately approved follow-up may add source maps after choosing the authoritative diagnostic product and reviewing its credential, build, artifact, provider, retention, and cleanup boundaries.

## Capability and certification lifecycle

The existing `observability@0.2.0` registry subject is `pending` and owns an active protected-staging retry plan. A material descriptor change would invalidate that exact subject.

Execution is therefore split without changing the approved `Task 6B -> Task 6C -> Task 6D` program sequence:

1. the isolated branch may implement and review only the local public-package `0.3.0` source candidate while the `0.2.0` certification remains active;
2. it then stops without publication, descriptor/template integration, fixture regeneration, provider mutation, or certification changes;
3. generated integration may begin only after the current `0.2.0` certification, generated unit/component implementation, and its separate standards certification are completed, accepted, and integrated; the canonical roadmap explicitly selects this diagnostics increment next; the user approves the exact package candidate and separately authorizes publication; and no overlapping generated-template implementation is active;
4. after the exact public `0.3.0` artifact is independently verified, the capability descriptor advances to `0.3.0`, its behavior-contract digest changes, and the registry receives a new ordinary `pending` subject linked to a new diagnostics certification plan; and
5. the new certification plan runs only with separate authorization after implementation review.

Package-only preparation is an isolated stream whose accepted direct predecessor is the completed production-observability implementation. It does not authorize or reorder the active certification or later generated testing. If the user prefers to abandon rather than complete the current `0.2.0` certification, that requires an explicit governance, provider-resource, credential, retained-data, and cleanup decision. This design does not infer it.

## Verification and claim boundaries

Focused TDD must prove:

- immutable error reports and distinct safe/diagnostic sink types;
- exact capture/redaction/bounding behavior for `Error`, primitive rejection, hostile getters, proxies, cyclic causes, multibyte strings, URLs, absolute paths, secrets, email/IP shapes, and missing stacks;
- operational sinks never receive diagnostics;
- Better Stack receives one enriched error record and no duplicate safe-only error record;
- provider rejection, timeout, invalid result, and thrown sinks remain non-throwing and cannot recursively report private data;
- browser error/rejection handlers pass actual reasons, deduplicate repeated error objects, and create fresh event identifiers;
- the browser route rejects malformed, oversized, cross-origin, unknown-field, private-context, and invalid-vocabulary reports before server reconstruction;
- App Router error boundaries report once and render externalized accessible recovery copy;
- Next.js `onRequestError` uses only approved method/framework/route metadata and never raw request path/headers;
- expected validation/control-flow catches remain unreported while selected unexpected catch APIs report; and
- generated profiles, state fingerprints, inference, exact public package, builds, and browser matrices remain deterministic.

Package/static/generated checks establish only their named boundaries. Protected staging must separately prove an actual browser error, unhandled rejection, React error boundary, server request error, selected caught synthetic error, Workers safe record, Better Stack restricted record, diagnostic failure containment, access/retention, and cleanup/recovery using synthetic data only.

## Current primary-source basis

- [Next.js error handling](https://nextjs.org/docs/app/getting-started/error-handling) distinguishes expected errors from uncaught exceptions and documents App Router error boundaries.
- [Next.js instrumentation](https://nextjs.org/docs/pages/api-reference/file-conventions/instrumentation) documents the three `onRequestError` inputs, error digest, and the requirement to await asynchronous reporting.
- [MDN Window error event](https://developer.mozilla.org/en-US/docs/Web/API/Window/error_event) documents the `ErrorEvent` delivered to `addEventListener`.
- [MDN PromiseRejectionEvent](https://developer.mozilla.org/en-US/docs/Web/API/PromiseRejectionEvent/PromiseRejectionEvent) documents that `reason` may be any value.
- [OpenTelemetry exception attributes](https://opentelemetry.io/docs/specs/semconv/registry/attributes/exception/) defines stable exception type/message/stack concepts and warns that messages may contain sensitive information.
- [Cloudflare Workers Logs](https://developers.cloudflare.com/workers/observability/logs/workers-logs/) documents structured custom logs, provider-controlled errors/uncaught exceptions, limits, retention, and pricing.
- [Cloudflare source maps](https://developers.cloudflare.com/workers/observability/source-maps/) documents upload behavior and the runtime deobfuscation limitation.
- [Better Stack HTTP ingestion](https://betterstack.com/docs/logs/ingesting-data/http/logs/) documents injected JSON ingestion, status behavior, and record-size guidance.
- [Better Stack source-map uploads](https://betterstack.com/docs/errors/collecting-errors/upload-source-maps/) documents the separate Errors-application and upload credential path.

These sources support interface and plan decisions only. They do not prove the repository implementation or any live provider outcome.
