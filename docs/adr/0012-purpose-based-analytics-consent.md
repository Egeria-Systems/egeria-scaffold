# ADR-0012: Purpose-Based Analytics Consent

**Status:** Accepted

**Date:** 2026-08-04

## Context

[ADR-0010](0010-analytics-and-observability.md) separates optional visitor analytics from operational observability and requires provider-neutral consent orchestration. The first analytics implementation records one provider-group choice. That representation cannot preserve independent visitor choices when configured purposes change, distinguish a current choice from an expired or materially changed notice, or safely coordinate reductions across open tabs.

The project configuration still selects providers. Visitor consent instead needs a stable key that describes why optional analytics runs, while provider identity remains available for disclosure, invalidation, and bounded revocation behavior. Local browser state must fail closed without being mistaken for a legal record or evidence of provider-side erasure.

## Decision

Purpose is the canonical visitor choice key. Each current runtime provider has exactly one fixed purpose:

- `cloudflare-web-analytics` maps to `aggregate-traffic-and-performance`;
- `google-analytics-4` maps to `audience-measurement`;
- `microsoft-clarity` maps to `consented-experience-analysis`.

Provider identifiers describe which providers implement and disclose a purpose and invalidate an earlier choice when that binding changes. They are not visitor-facing consent switches. Project configuration remains the sole provider-selection authority.

The first-party key `egeria.analytics.consent.v2` stores one strict version-2 local preference record containing only:

- `schemaVersion: 2`;
- `noticeVersion: 1`, the exact current generated notice contract;
- UTC `decidedAt` and `expiresAt` instants, with expiry exactly 180 days after the decision;
- `providerPurposeContext`, the exact configured provider identities paired with their fixed purposes;
- `purposes`, the exact configured purposes with one `granted` or `denied` decision each.

Provider-purpose context entries and purpose decisions are separate and use deterministic order. The record stores no provider configuration values. Neither collection may contain a duplicate, missing, extra, or unknown member. A record is current only when its schema and shape are valid, its notice version is exactly 1, its complete provider-purpose context and purpose-decision set exactly match the generated configuration, its timestamps are valid, and it has not expired. A legacy, malformed, partial, expired, future-dated, notice-stale, or configuration-stale record grants nothing. A legacy grant is never promoted to version 2.

The initial and management controls disclose the configured purposes, default each optional purpose to denied, give the allow-all and deny-all actions equal prominence, permit purpose-specific choices, remain persistently reopenable, and provide withdrawal. A choice is effective in memory only for the current document unless the exact version-2 record is persisted successfully.

A reduction is any transition in which a formerly granted purpose becomes denied, absent, expired, or invalid. Reductions fail closed in memory before bounded provider effects run. A successfully persisted reduction reloads the document; complete withdrawal or invalidation therefore reaches a provider-free document, while a partial reduction can load only the still-granted purposes. More-permissive changes may load newly granted current providers at most once without a reload.

Persisted changes synchronize through the browser `storage` event so other open tabs revalidate the complete record. A tab applies a more restrictive result immediately and follows the same revocation-and-reload rule. In-memory fallback after a storage failure is tab-local and is not broadcast as though it persisted.

Revocation effects are provider-specific and bounded. Google receives a consent update that denies analytics and advertising-related storage and data uses. Clarity receives its consent-v2 denial and documented cookie-erasure call. Known accessible first-party Google Analytics and Clarity cookies may be expired. Cloudflare Web Analytics documents no client revocation operation for the manually loaded beacon. These effects do not unload executed code, cancel every in-flight request, erase provider-held data, or substitute for the safe reload that produces a document without denied providers.

If a stale persisted grant cannot be removed or replaced, revocation is `incomplete`: the current tab remains fail-closed, no successful-withdrawal state is reported, and an automatic reload must not re-enter the still-current stale grant. The UI exposes a stable incomplete-revocation state for retry or a later provider-free navigation. Provider calls or cookie expiry alone never convert that state to complete.

The exact executable record, validation, synchronization, reduction, and state-transition contract is owned by the [capability model](../architecture/capability-model.md#purpose-based-consent-contract). The generated localized disclosure remains the copy owner. The stored value is a local technical preference, not an audit receipt, identity record, proof of informed consent, provider-erasure receipt, or legal-compliance artifact.

## Consequences

- Visitor choices survive only while their exact notice, purpose set, provider context, and 180-day validity remain current.
- Provider configuration can evolve without turning provider identifiers into visitor switches or carrying stale grants forward.
- Reductions converge through persisted state, cross-tab synchronization, bounded provider effects, and a safe reload; an unremovable stale grant remains visibly incomplete.
- The generated application needs no backend, consent service, identity, additional dependency, persistent-data store, or audit log for this local preference.
- Provider accounts, previously collected data, provider-side retention or deletion, and legal assessment remain separate human and provider responsibilities.

## Enforcement

`INV-ANALYTICS-CONSENT` requires versioned purpose-keyed preference parsing, exact configuration and notice validation, 180-day expiry, equal actions, fail-closed reduction, cross-tab synchronization, provider-specific bounded effects, safe reload, and incomplete-revocation tests. `INV-ANALYTICS-SEPARATION` continues to prohibit an observability dependency or event bridge. Architecture acceptance adds no runtime dependency, backend, provider mutation, deployment, certification, compliance claim, or publication authority.
