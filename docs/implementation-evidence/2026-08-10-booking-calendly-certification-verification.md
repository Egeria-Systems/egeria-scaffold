# Booking Calendly Certification Verification Evidence

**Date:** 2026-08-10 (America/Toronto)

**Status:** Local fresh-scaffold evidence passed; protected-staging, provider-confirmed, and cleanup/recovery evidence not executed

**Planning base:** `542660b5a3d25709ade6d8536c8c65bd1e6b6038`

**Certification capability:** `booking-calendly`

**Certification descriptor version:** `0.1.0`

**Certification behavior-contract digest:** `sha256:339462dc3cc43065aeeb2eabc0556960d07c4c6b3e1e13738715fc7e0cedc8ab`

**Certification evidence revision:** `636df53958c0e3421b7f493d83493724b67b41f3`

**Passed certification outcomes:** `fresh-scaffold`

## Registry and gate evidence

The repository-owned certification registry contains one key for each of the seven executable capability descriptors. Every subject is bound to the descriptor version and the lowercase SHA-256 digest of canonical `{ descriptor, requiredEvidence }` data.

Current status is intentionally non-closing:

- `booking-calendly@0.1.0`: `pending`, linked to the separate Task 5B plan, with only `fresh-scaffold` evidence recorded;
- the six accepted pre-foundation subjects: `backfill-pending`, restricted by executable exact identifier/version/digest tuples; and
- no record: `certified`.

Admission also loads each referenced task/evidence artifact and requires evidence metadata to match its capability, descriptor subject, evidence-producing revision, and explicit passed outcomes. The local receipt declares only `fresh-scaffold`; relabeling it as deployed, provider, cleanup, or recovery evidence rejects.

The admission command passed:

```text
{"ok":true,"gate":"admission","records":7}
```

The current transition closure command rejected only `booking-calendly` as pending. The full closure command rejected all seven non-certified records. These rejecting exits are required evidence that registry presence and local execution do not imply certification.

## TDD evidence

The registry/gate RED state failed for missing certification exports, subject functions, checked schema, source inventory, registry command, and builder-candidate wiring. GREEN established strict parsing, descriptor/evidence digest binding, missing/extra/stale/false-legacy rejection, distinct closure policies, content-safe command output, checked schema identity, and exact private inventories.

The fresh-project RED state failed for a missing single-root verifier and a missing certification runner. GREEN established:

- one caller-supplied generated root validated against the exact existing `portfolio-calendly` contract;
- the same 12 fixed-root checks and environment boundary used by the three-fixture verifier;
- exact compiled-CLI `create`, `infer`, `doctor`, and `diff` order;
- installed and confirmed `booking-calendly@0.1.0` evidence;
- healthy diagnostics and an empty exact diff;
- mode-0700 owner creation, identity-checked cleanup on success/failure, and source immutability; and
- a bounded receipt that contains no scheduling URL, provider data, secret, temporary root, or child output.

The first real local run reached generated-project verification and failed with the stable code `GENERATED_PROJECT_VERIFICATION_FAILED`. Root-cause tracing showed that the new runner used a project name different from the exact known fixture contract, while the adapter unit test had mocked below manifest inspection. A focused regression test changed the runner to use the existing exact `portfolio-calendly` create identity. The repaired focused test passed before the real journey was rerun.

## Real local fresh-scaffold journey

The exact command was:

```text
CI=true volta run --node 22.23.2 --pnpm 11.20.0 pnpm run verify:booking-calendly-certification
```

It built the current private builder packages, created a fresh absent temporary destination through the compiled CLI with the synthetic destination `https://calendly.com/example/intro` and popup mode, then re-inferred, diagnosed, diffed, installed, audited, built, previewed, browser-tested, and removed that generated root. The command exited zero with this content-safe receipt:

```json
{"ok":true,"capability":"booking-calendly","version":"0.1.0","profile":"portfolio","mode":"popup","checks":["compiled-cli-create","state-inference","healthy-diagnostics","exact-diff","pnpm-version","frozen-install","peer-dependencies","dependency-audit","registry-signatures","lint","typecheck","next-build","opennext-build","browser-install","browser-development","browser-preview"]}
```

This establishes actual initial-scaffolding output, valid `.egeria` state, confirmed inference, healthy diagnostics, an empty exact diff, exact pnpm, frozen installation, peer compatibility, the execution-time moderate advisory result, registry signatures, lint, typecheck, Next build, OpenNext build, explicit Chromium installation, development browser behavior, and OpenNext/workerd preview browser behavior for the synthetic local configuration.

## Unsupported outcomes

No workflow was dispatched. No GitHub environment or secret changed. No Worker was deployed, rolled back, or deleted. No Calendly account, event type, calendar, meeting, invitee, or provider record was created, read, changed, cancelled, or deleted. No cost was incurred by this task.

Local browser checks stub the provider origin. They do not establish provider availability, a real booking, provider-side confirmation, hosted-runner behavior, a live staging URL, cleanup/recovery, visual approval, human accessibility, production readiness, or WCAG conformance. `booking-calendly` and P2 remain unable to close until the separately authorized external journey supplies the three missing evidence outcomes and the reviewed registry is updated to `certified`.
