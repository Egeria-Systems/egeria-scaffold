# ADR-0014: Selective Effect application runtime

**Status:** Accepted

**Date:** 2026-09-05

## Context

The first app foundation needs a lazy provider-neutral application program, explicit dependency provision, typed expected failure, and complete failure interpretation at one server delivery boundary. Effect supplies those properties directly. Applying it repository-wide or hiding it behind a local abstraction would add coupling without improving pure transforms, presentation, content, builder policy, or CLI behavior.

Effect 4 remains a release candidate. Its exact API, dependency graph, license, install behavior, optional native dependencies, bundle impact, Next.js behavior, OpenNext/workerd behavior, and cancellation semantics therefore require evidence at their owning implementation gates.

## Decision

Generated app repositories adopt `effect@4.0.0-rc.112` directly as an exactly pinned ordinary generated-app dependency. The generated root lockfile records its resolved graph and remains builder-kernel owned. A newer release candidate or general-availability release requires an explicit decision and plan amendment; it is never selected silently.

Effect is allowed only in application, infrastructure, composition, and delivery server modules when a workflow has meaningful success, typed error, or environment channels. Builder-core, the CLI, domain transforms, presentation, client modules, and content remain Effect-free. There is no Egeria wrapper, internal facade, new package, Effect HTTP/CLI/Workers package, `@effect/vitest`, or import from `effect/unstable/`.

`RequestContext` remains a plain readonly value passed explicitly to the application program, with clock and UUID creation injected at delivery or composition. It is not a Context service, global, `FiberRef`, `AsyncLocalStorage`, `ManagedRuntime`, or other hidden request state.

`BuildInformationReader` is an application-owned `Context.Service` with a repository-unique namespaced runtime identity. Its operation exposes only the declared application error. Infrastructure supplies Cloudflare and in-memory implementations as Layers; application code imports no Cloudflare types. No generic `PlatformService` or `ApplicationDatabase` is introduced.

The application constructs a lazy health Effect. Composition supplies the selected Layer. The delivery boundary passes `request.signal` through Effect run options and calls `Effect.runPromiseExit` exactly once. It interprets the full Cause in this priority order:

1. If any reason is a defect, report the first defect through the existing server-error boundary and return the sanitized `500` response.
2. Otherwise, if any reason is an interruption, propagate one stable host abort without application error reporting or a synthesized response.
3. Otherwise, if every failure is recognized `BuildInformationUnavailable`, return the sanitized `503` response.
4. Any unrecognized or mixed residual failure is unexpected; report it and return the sanitized `500` response.

A pure interruption rejects with the native `DOMException` named `AbortError`; there is no custom abort type or factory. The `deployment-cloudflare` capability, as sole owner of generated Wrangler configuration, adds `enable_request_signal`. `app-foundation` depends on that behavior but does not own or merge the Wrangler file.

The cancellation claim is bounded to interruption of the Effect fiber and response path, not cancellation of already-started provider work. The initial metadata acquisition has no cancellation claim because the Cloudflare context API accepts no signal. Deployed client-disconnect classification and provider diagnostics remain unclaimed until separately exercised.

The initial program has no retry. Any later retry policy requires an independent decision at an idempotent adapter boundary with explicit attempts, backoff, timeout, cancellation, and observability semantics.

The runtime adds no database, queue, background job, email provider, durable contact submission, identity, payments, file storage, CMS, real-time infrastructure, or invented CRUD. No placeholder server action is added merely to demonstrate Effect.

## Rejected alternatives

- Retaining a temporary Promise/result application model is rejected because the first public app would immediately require a second architecture migration.
- Waiting for pipeFlow or consuming its wrapper is rejected because the broader wrapper supplies no required safety property for this bounded generated application.
- Repository-wide Effect adoption is rejected because pure transforms, presentation, content, builder-core, and CLI already have suitable owners and contracts.
- A local Effect facade, extra platform package, global or managed runtime, hidden request context, custom abort type, or speculative server action is rejected because each adds coupling without a current requirement.

## Consequences

- Application orchestration exposes lazy success, typed error, and environment channels without turning Effect into a repository-wide programming model.
- Provider types remain isolated in infrastructure and composition, while tests can supply an in-memory Layer without mocking Effect internals.
- Delivery distinguishes defects, interruption, expected unavailability, and unexpected residual failure without leaking provider values or sensitive details.
- Direct release-candidate adoption requires exact dependency, API, install, bundle, framework, Worker, and security evidence before runtime acceptance.
- No app dependency, source, generated configuration, fixture, runtime, or certification state is created by this architecture decision.

## Enforcement

This ADR owns the exact runtime decision. The enforcement map owns the actual and planned gate mapping for the dependency and lockfile, allowed and prohibited imports, laziness, Layer provision, one execution, full Cause priority, native abort, deployment-owned `enable_request_signal`, bounded cancellation claims, absence of retry, generated verification, dependency review, and claim boundaries in its [canonical mapping](../architecture/enforcement-map.md). The constitution contract verifies the recorded decision only; it does not establish Effect installation, API compatibility, generated behavior, deployment, provider cancellation, certification, or production readiness.
