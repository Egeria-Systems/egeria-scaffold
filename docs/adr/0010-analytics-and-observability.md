# ADR-0010: Analytics and Observability Separation

**Status:** Accepted

**Date:** 2026-08-04

## Context

Operational telemetry and visitor analytics answer different questions, have different privacy implications, and should not arrive through hidden defaults. Cloudflare Web Analytics is especially easy to conflate with Cloudflare platform observability.

## Decision

Observability is part of generated profiles and provides privacy-safe operational evidence:

- Cloudflare Workers Logs;
- Better Stack server observability;
- explicitly configured browser errors and web-vitals monitoring;
- structured event contracts, correlation, release context, normalized error categories, and redaction.

Default browser observability excludes session replay, automatic behavioral capture, duplicate website analytics, and console capture unless separately reviewed.

Analytics is an independently selectable capability. Runtime providers are configured independently:

- Cloudflare Web Analytics;
- GA4;
- Microsoft Clarity.

Search Console and Looker Studio are operational integrations within the analytics capability. Cloudflare Web Analytics may be the recommended default provider after `analytics` is selected, but installing `observability` never installs or enables it.

Consent orchestration is provider-neutral, defaults optional tracking to denied where the selected policy requires it, supports withdrawal, and is not represented as automatic legal compliance.

## Consequences

- Operational error evidence remains available without silently adding visitor analytics.
- Analytics selections, domains, CSP, storage, consent, and privacy review stay explicit.
- Multiple providers require deliberate deduplication and purpose boundaries.
- Legal and policy decisions remain external human responsibilities supported by technical controls, not inferred from them.

## Enforcement

`INV-ANALYTICS-SEPARATION` is planned for P5B capability resolution, generated configuration, consent, CSP/storage, and provider-combination tests. P0.1 records only the architecture boundary.
