# Production Observability Capability Certification Plan

> **Execution gate:** This sibling plan is recorded for capability admission only. Its execution requires new explicit authorization.

**Goal:** Certify the materialized `observability@0.2.0` capability against one exact fresh generated project, protected non-production Cloudflare behavior, and provider-confirmed Better Stack receipt without making a production, analytics, accessibility-conformance, or ongoing-provider claim.

**Architecture:** Reuse the compiled production CLI and the fixed-root generated-project verifier. Deploy one identity-bounded protected-staging Worker with synthetic operational events only. Verify Workers Logs, Better Stack delivery, browser-error reporting, web-vitals reporting, and cleanup as separate evidence outcomes bound to the exact descriptor subject and ancestor revision. Keep Cloudflare deployment, Better Stack source, credentials, and repository source recovery separate.

**Required evidence:** `fresh-scaffold` and `deployed-application`. Provider receipt details support the deployed-application outcome but do not create a broader availability or production claim.

## Preconditions

- Obtain explicit authority for workflow dispatch, non-production deployment, Better Stack source creation or reuse, Cloudflare secret mutation, synthetic telemetry delivery, provider inspection, credential disposition, and Worker/source cleanup.
- Bind execution to an exact reviewed `main` revision whose certification subject equals the committed registry record.
- Use least-privilege, task-bounded credentials and a protected non-production environment. Stop on permission, billing, retention, unexpected-provider, revision, or subject drift.
- Use synthetic bounded values only. Never transmit real client data, URLs, request data, headers, cookies, user agents, error messages, stacks, email addresses, form content, provider responses, tokens, or secrets.

## Task 1: Prepare an exact certification candidate

- [ ] Revalidate current Cloudflare Workers Logs, version metadata, execution-context, secrets, OpenNext, Better Stack ingestion, Next.js instrumentation, security-advisory, and dependency-audit evidence.
- [ ] Generate a fresh `portfolio` from the compiled production CLI in an identity-owned mode-0700 temporary root.
- [ ] Prove exact project/state/inference/doctor/diff agreement and reuse the fixed-root install, audit, signature, lint, typecheck, Next, OpenNext, Wrangler-type, development-browser, and workerd-preview checks.
- [ ] Record a content-safe fresh-scaffold receipt bound to the exact capability subject and ancestor revision.

## Task 2: Verify protected staging and provider delivery

- [ ] Inspect and approve the exact workflow/revision and all provider-side targets before exposing credentials.
- [ ] Configure only the declared Better Stack host/token secrets and deploy one dedicated non-production Worker.
- [ ] Exercise bounded synthetic server error, browser error, and web-vitals events.
- [ ] Confirm structured Workers Logs and Better Stack receipt by event name, correlation identifier, release identifier, runtime, kind, severity, and bounded allowlisted attributes only.
- [ ] Confirm application responses remain successful when Better Stack rejects, times out, or is unreachable.
- [ ] Confirm the browser route rejects cross-origin, oversized, wrong-content-type, malformed, extra-field, invalid-vocabulary, and secret-bearing inputs without echoing content.

## Task 3: Cleanup, review, and certification decision

- [ ] Remove or roll back the dedicated Worker and dispose of the task credentials according to the approved credential plan.
- [ ] Remove or preserve the Better Stack source only according to the separately approved provider-state decision; record its final state and retention limits.
- [ ] Verify the deployment target no longer serves the certification candidate when deletion is selected.
- [ ] Dispatch independent read-only requirements, architecture/anti-overengineering, test-evidence, and security/privacy reviews of the exact evidence.
- [ ] Update the registry to `certified` only after every required outcome is passed, subject/revision-bound, reviewed, and present. Otherwise retain `pending` and record the blocker.
- [ ] Run admission and both closure policies, produce a review packet, and stop for verified-final-diff approval.

## Claim and authority limits

This plan does not authorize itself. Local generation does not prove provider delivery. A protected-staging pass does not prove production readiness, ongoing availability, cost control, human accessibility, WCAG conformance, or analytics behavior beyond the tested absence. No production deployment, provider mutation, credential mutation, workflow dispatch, spending, or certification status change may occur without new explicit authorization.
