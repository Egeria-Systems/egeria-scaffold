# ADR-0004: Cloudflare Adapter Isolation

**Status:** Accepted

**Date:** 2026-08-04

## Context

Cloudflare Workers is the initial production platform, but allowing its bindings and runtime types to spread through presentation, domain, or application code would couple business behavior to platform details and encourage false normalization of semantic differences.

## Decision

Cloudflare-specific types, bindings, and runtime APIs are allowed only in:

- Cloudflare infrastructure adapters;
- Cloudflare bootstrap and composition roots;
- generated Wrangler and OpenNext configuration;
- Cloudflare integration tests;
- a separately justified jobs Worker's Cloudflare boundary when present.

They are forbidden in presentation, content, domain policies, application use cases, provider-neutral ports, and ordinary unit/component/contract tests.

Ports belong to the consuming boundary and describe domain needs. No generic `PlatformService` or `ApplicationDatabase` port is permitted. Adapters declare their actual transaction, conditional-write, streaming, queue, background execution, local emulation, metadata, preview, and environment-isolation semantics. Differences that cannot be normalized safely remain explicit.

Cloudflare is the only initial production adapter. In-memory adapters and behavioral contract tests are required when ports become executable. A second production adapter requires a real migration or contracted need.

## Consequences

- Domain and application behavior remain testable without Cloudflare bindings.
- Composition roots visibly own concrete providers and environment wiring.
- Platform-specific guarantees cannot be silently emulated or overstated.
- Portability remains possible without paying for a speculative second production implementation.

## Enforcement

`INV-CLOUDFLARE-ISOLATION`, `INV-NARROW-PORTS`, and `INV-NO-GENERIC-PLATFORM-PORT` are planned for standards import restrictions, architecture tests, and bounded review beginning in P0.3/P1 and expanding with app-foundation in P4.

Current platform support and limitations are revalidated from the [Cloudflare Next.js guide](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/) and [OpenNext Cloudflare documentation](https://opennext.js.org/cloudflare) at each compatibility-sensitive phase.
