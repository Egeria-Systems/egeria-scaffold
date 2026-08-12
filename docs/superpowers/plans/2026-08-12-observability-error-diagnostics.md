# Observability Error Diagnostics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add actionable error messages, stacks, and safe debugging context for every unexpected/unhandled browser and server error observable through supported capture points, plus explicit selected-catch reporting, while keeping restricted diagnostics out of Workers Logs and preserving provider portability.

**Architecture:** The zero-runtime-dependency public package owns immutable safe events, restricted exception diagnostics, two distinct sink types, non-throwing dispatch, and provider-neutral tests. Generated Next.js/Cloudflare code captures framework/browser context, sends browser reports through a strictly validated same-origin route, sends safe error events to Workers Logs, and sends one enriched error record only to the approved Better Stack diagnostic sink. The current `observability@0.2.0` certification subject remains unchanged until its lifecycle gate closes; only the local public-package source candidate may proceed before that gate.

**Tech Stack:** Volta-pinned Node.js `22.23.2` and pnpm `11.20.0`, TypeScript `6.0.3`, Node test runner, Changesets `2.31.1`, Next.js `16.3.0`, React `19.2.8`, OpenNext Cloudflare `1.20.2`, Wrangler `4.118.0`, Playwright `1.62.1`, Cloudflare Workers Logs/version metadata/execution context, and Better Stack HTTP ingestion.

## Direct Predecessor

The package-source candidate's direct predecessor is the completed production-observability implementation. Its acceptance artifact is `docs/review-packets/2026-08-10-production-observability.md`, which records explicit approval of comparison `717c3bb0f048f4a4bc544100125ae42d818f09bc..45b57d2dc265ef6ba9ac805d7352a01db5f1081d` and states that the implementation is complete. The accepted revision is `45b57d2dc265ef6ba9ac805d7352a01db5f1081d`.

Before Task 1 RED work:

- require a clean exact worktree at or descended from planning base `2a315aa0e7dce1bf1048b9a2c07e318add9241de`;
- run `rtk git merge-base --is-ancestor 45b57d2dc265ef6ba9ac805d7352a01db5f1081d HEAD` and require exit `0`;
- re-read the acceptance artifact and require its explicit approval text and exact accepted revision;
- build builder-core and run `rtk volta run --node 22.23.2 --pnpm 11.20.0 node scripts/check-capability-certification.mjs`, requiring admission success for all current records;
- run `rtk volta run --node 22.23.2 --pnpm 11.20.0 node --test tests/constitution/*.test.mjs`, `rtk volta run --node 22.23.2 --pnpm 11.20.0 node --test tests/package-boundaries/public-observability.test.mjs tests/package-boundaries/release-safeguards.test.mjs`, and the unchanged public observability package verification; and
- record exact results and any setup limitation in `docs/implementation-evidence/2026-08-12-observability-error-diagnostics-preparation.md`.

The current certification closure is not the package candidate's predecessor and is expected to remain open. Tasks 5 onward have the separate Gate B predecessors below. A failed admission, missing approval, non-ancestor revision, unrelated dirty state, or overlapping write scope is a hard stop.

## Global Constraints

- Work only in `/Users/CoveMB/Code/CoveMB/egeria-scaffold/.worktrees/observability-error-diagnostics` on branch `observability-error-diagnostics`. Planning base is `2a315aa0e7dce1bf1048b9a2c07e318add9241de`.
- Before any edit, read the root and applicable nested `AGENTS.md` files plus every canonical source named in the design. Revalidate branch, status, HEAD, and active worktrees. Stop on unrelated dirty state, base drift, or an overlapping generated-template implementation.
- Use `rtk` for every shell command and the exact Volta Node/pnpm versions above. Use `CI=true` for pnpm verification.
- Follow strict RED-GREEN-REFACTOR for behavior changes. Capture the intended RED failure before implementation. Do not manufacture tests for comments, evidence-only changes, or a single CI wiring fix.
- Keep the public package at zero runtime dependencies. It imports no DOM, React, Next.js, Node, Cloudflare, Better Stack, Sentry, or OpenTelemetry SDK.
- Keep `OperationalSink` safe-only. Restricted diagnostics must be unreachable from its input type and serialization path. Only the distinct diagnostic sink receives messages, stacks, causes, or fingerprints.
- Workers custom logs receive no message, stack, cause, URL, literal request path, filename, header, cookie, form value, email, IP, user agent, response body, secret, token, arbitrary object, or provider response.
- Better Stack is the only initially approved restricted diagnostic sink. No diagnostic browser token is introduced. Browser reports always traverse the same-origin server route.
- Keep analytics absent. Add no Web Analytics, GA4, Clarity, session replay, browser storage, console interception, trace SDK, queue, database, Tail Worker, Logpush, `apps/jobs`, retry service, or second production provider adapter.
- Do not enable or upload source maps in this increment. Do not claim production stacks are deobfuscated.
- Expected validation/domain/control-flow results are not exception reports. Catches that contain observability failure never recurse. Catches that rethrow unchanged rely on the framework/global capture point unless there is evidence they will not reach it.
- Generated error fallback copy must originate in a validated localization/content file. Presentation components remain pure and receive typed copy/callbacks.
- Preserve the deployment capability's full-file ownership of `apps/web/wrangler.jsonc`. Do not add a new secret or provider resource to implement log-source diagnostics.
- Never hand-edit retained fixture fingerprints or generated state. Regenerate fixtures only after successful production generation and re-inference.
- Before each commit: run `rtk git status --short --branch`, stage only named paths, inspect `rtk git diff --cached --stat` and `rtk git diff --cached`, then run `rtk git diff --cached --check`.
- No push, pull request, merge, package publication, workflow dispatch, deployment, provider/source mutation, secret mutation, spending, production action, registry transition, review-comment response, or certification execution is authorized by this plan.

## Execution and Approval Gates

### Gate A — local package candidate may start

The package-only tasks below may start from the committed plan after the user asks the implementation agent to execute it and the direct-predecessor checks above pass. They do not change the capability descriptor, generated templates, fixtures, active certification registry subject, provider, or published package.

Stop after Task 4 with a clean, reviewed local package candidate and its packet. Do not materialize version `0.3.0`, publish, or begin generated integration.

### Gate B — release and integration predecessor

Tasks 5 onward require all of the following without altering the currently approved `Task 6B -> Task 6C -> Task 6D` sequence:

1. the current `observability@0.2.0` certification, provider-resource/credential/data disposition, and cleanup/recovery gate is resolved, reviewed, approved, and integrated;
2. the generated unit/component implementation and its separate materially changed `standards` certification are completed, reviewed, approved, and integrated under their existing plans;
3. local `main` contains every accepted revision and each applicable admission/closure check passes;
4. the approved source plan and program roadmap explicitly select this diagnostics integration as the next increment without rewriting historical plan/evidence ownership;
5. no active task is mutating the same generated catalog, templates, fixtures, or state;
6. this branch is reconciled with that accepted lineage without discarding either stream, and the reconciled package candidate receives exact-diff approval;
7. the user separately authorizes the minimum integration/push/trusted-publication actions needed to create `@egeria-systems/observability@0.3.0`; and
8. the exact public package is verified from the registry before any generated manifest refers to it.

If any predecessor is pending, the source plan has not selected this integration, or the user chooses to abandon `0.2.0` without an approved lifecycle amendment, stop and report the exact blocker. Do not overwrite any predecessor task plan or evidence.

### Gate C — implemented capability review

Tasks 6–10 are local generated-capability implementation. They stop after a complete review packet and verified final diff. The new diagnostics certification plan is created but not executed.

## Exact File Scope

### Committed planning artifacts

Read before implementation and modify only the preparation record to append exact implementation-entry preflight results:

```text
docs/implementation-evidence/2026-08-12-observability-error-diagnostics-preparation.md
docs/superpowers/plans/2026-08-12-observability-error-diagnostics.md
docs/superpowers/specs/2026-08-12-observability-error-diagnostics-design.md
```

### Package source candidate

Create:

```text
.changeset/add-observability-error-diagnostics.md
packages/observability/src/diagnostics.ts
packages/observability/tests/diagnostics.test.mjs
docs/implementation-evidence/2026-08-12-observability-error-diagnostics-package-verification.md
docs/review-packets/2026-08-12-observability-error-diagnostics-package.md
```

Modify:

```text
packages/observability/AGENTS.md
packages/observability/README.md
packages/observability/package.json
packages/observability/src/browser.ts
packages/observability/src/contracts.ts
packages/observability/src/dispatch.ts
packages/observability/src/events.ts
packages/observability/src/index.ts
packages/observability/src/redaction.ts
packages/observability/src/server.ts
packages/observability/src/testing.ts
packages/observability/tests/browser.test.mjs
packages/observability/tests/contracts.test.mjs
packages/observability/tests/dispatch.test.mjs
packages/observability/tests/public-api.test.mjs
packages/observability/tests/server.test.mjs
packages/observability/tests/testing.test.mjs
tests/package-boundaries/public-observability.test.mjs
tests/package-boundaries/release-safeguards.test.mjs
```

The source-candidate manifest may add exports but remains version `0.2.0` until the separately authorized Changesets release step. The Changeset declares a minor release to `0.3.0`. Do not change `pnpm-lock.yaml` unless an exact manifest change mechanically requires it; no runtime dependency is allowed.

### Separately authorized release

Modify only as required by the established trusted-publication path:

```text
.changeset/add-observability-error-diagnostics.md
packages/observability/CHANGELOG.md
packages/observability/package.json
pnpm-lock.yaml
scripts/check-package-release.mjs
tests/package-boundaries/package-release.test.mjs
tests/package-boundaries/public-observability.test.mjs
tests/package-boundaries/release-safeguards.test.mjs
docs/implementation-evidence/2026-08-12-observability-error-diagnostics-package-release.md
docs/review-packets/2026-08-12-observability-error-diagnostics-package-release.md
```

Do not change the release workflow unless a focused current-tree failure proves it cannot release the exact single package under its existing OIDC/provenance contract. A release-workflow change requires its own exact-file amendment and review.

### Generated capability integration

Create:

```text
packages/builder-core/templates/common/apps/web/app/error.tsx
packages/builder-core/templates/common/apps/web/app/global-error.tsx
packages/builder-core/templates/common/apps/web/content/en-CA/observability.yaml
packages/builder-core/templates/common/apps/web/src/infrastructure/observability/error-copy.ts
packages/builder-core/templates/common/apps/web/src/presentation/error-fallback.tsx
docs/superpowers/plans/2026-08-12-observability-error-diagnostics-certification.md
docs/implementation-evidence/2026-08-12-observability-error-diagnostics-verification.md
docs/review-packets/2026-08-12-observability-error-diagnostics.md
```

Modify:

```text
packages/builder-core/AGENTS.md
packages/builder-core/README.md
packages/builder-core/src/catalog/capability-catalog.ts
packages/builder-core/src/catalog/verified-package-versions.ts
packages/builder-core/src/generation/template-catalog.ts
packages/builder-core/src/profiles/profile-recipes.ts
packages/builder-core/templates/common/AGENTS.md.template
packages/builder-core/templates/common/README.md.template
packages/builder-core/templates/common/apps/web/AGENTS.md.template
packages/builder-core/templates/common/apps/web/app/api/observability/route.ts
packages/builder-core/templates/common/apps/web/app/globals.css
packages/builder-core/templates/common/apps/web/instrumentation-client.ts
packages/builder-core/templates/common/apps/web/instrumentation.ts
packages/builder-core/templates/common/apps/web/package.json.template
packages/builder-core/templates/common/apps/web/src/infrastructure/observability/browser-reporter.ts
packages/builder-core/templates/common/apps/web/src/infrastructure/observability/server-reporter.ts
packages/builder-core/templates/common/apps/web/tests/e2e/site-quality.spec.ts
packages/builder-core/tests/certification.test.mjs
packages/builder-core/tests/contracts.test.mjs
packages/builder-core/tests/generate-project.integration.mjs
packages/builder-core/tests/generate-project.test.mjs
packages/builder-core/tests/inference.test.mjs
packages/builder-core/tests/render-skeleton.test.mjs
packages/builder-core/tests/resolution.test.mjs
certifications/capabilities.json
scripts/verify-generated-skeletons.mjs
tests/capability-certification/certification-runner.test.mjs
tests/capability-certification/production-observability.test.mjs
tests/constitution/constitution.test.mjs
tests/generated-fixtures/determinism.test.mjs
tests/generated-fixtures/verification-script.test.mjs
tests/package-boundaries/private-packages.test.mjs
docs/architecture/capability-model.md
docs/architecture/enforcement-map.md
docs/architecture/overview.md
docs/architecture/package-ownership.md
docs/roadmaps/program-roadmap.md
README.md
```

Regenerate from the compiled production CLI after the exact public package resolves:

```text
fixtures/generated/portfolio/**
fixtures/generated/portfolio-calendly/**
fixtures/generated/site/**
```

The production-generation and determinism tools own the exact generated lockfile, `.egeria/project.yaml`, `.egeria/state.json`, manifest, template, documentation, and managed-surface fingerprint changes.

No other file is in scope without a written evidence-backed plan amendment approved at the applicable gate.

---

### Task 1: Freeze the package contract and prove the safe/diagnostic separation

**Files:**
- Create: `packages/observability/src/diagnostics.ts`
- Create: `packages/observability/tests/diagnostics.test.mjs`
- Modify: `packages/observability/src/contracts.ts`
- Modify: `packages/observability/src/events.ts`
- Modify: `packages/observability/src/redaction.ts`
- Modify: `packages/observability/src/index.ts`
- Modify: `packages/observability/tests/contracts.test.mjs`
- Modify: `packages/observability/tests/public-api.test.mjs`

**Interfaces:**
- Add immutable `OperationalErrorReport`, `ExceptionDiagnostics`, `ErrorCaptureContext`, `DiagnosticSink`, and result/validation types.
- Add `eventId`, optional genuine `correlationId`, `service`, and optional `environment` to the new event context without accepting private/free-form values.
- Add `createOperationalErrorReport(event, error, capture, options)`, `reconstructOperationalErrorReport(input)`, and `isOperationalErrorReport(value)`.
- Preserve `createOperationalEvent` and `isOperationalEvent` as the only constructors/brands for safe events.

- [ ] RED: test that an ordinary event cannot contain `message`, `stack`, `cause`, `url`, `path`, or arbitrary nested values and that no diagnostic field is exposed through `OperationalSink` or safe serialization.
- [ ] RED: test error reports for a normal `Error`, primitive rejection, missing fields, hostile getters/proxies, non-enumeration, two-level cause limit, cycles, multibyte byte limits, 64-line server stack limit, absolute path/query/fragment removal, secret/JWT/email/IP redaction, fixed truncation markers, exact versioned FNV-1a fingerprint vectors, invalid capture vocabularies, and deep immutability.
- [ ] Run `rtk volta run --node 22.23.2 --pnpm 11.20.0 pnpm --filter @egeria-systems/observability run build` and the focused diagnostics/contracts tests; retain the expected missing-export/type/test failures.
- [ ] GREEN: implement only the package-owned pure constructors, guarded readers, UTF-8 bounds, normalized stack-line policy, redaction, fingerprint, brand checks, and immutable results needed by the tests.
- [ ] Advance the operational event schema to `2.0.0`. Require `eventId` and `service`, make `correlationId` optional, and do not let new generated code use a per-event correlation ID. Compatibility with schema `1.0.0` remains available only by retaining the immutable published `0.2.0` package; do not add a dual-schema overload to `0.3.0`.
- [ ] Run the focused tests GREEN, then `rtk proxy env CI=true volta run --node 22.23.2 --pnpm 11.20.0 pnpm --filter @egeria-systems/observability run verify`.
- [ ] Commit with message `Add provider-neutral error diagnostics`.

### Task 2: Add explicit diagnostic dispatch and Better Stack encoding

**Files:**
- Modify: `packages/observability/src/dispatch.ts`
- Modify: `packages/observability/src/server.ts`
- Modify: `packages/observability/src/testing.ts`
- Modify: `packages/observability/tests/dispatch.test.mjs`
- Modify: `packages/observability/tests/server.test.mjs`
- Modify: `packages/observability/tests/testing.test.mjs`

**Interfaces:**
- Add `dispatchOperationalErrorReport(report, { operationalSinks, diagnosticSinks })`.
- Add `createBetterStackDiagnosticSink(configuration)`.
- Add an in-memory diagnostic sink and assertions in `./testing`.
- Keep `dispatchOperationalEvent`, `createStructuredLogSink`, and `createBetterStackSink` safe-only.

- [ ] RED: prove safe sinks receive only `report.event`, diagnostic sinks receive the branded report, all valid sinks run despite peer failure, malformed results normalize to stable reasons, and thrown/rejected sinks never escape.
- [ ] RED: prove one Better Stack enriched record uses bounded `exception.type`, `exception.message`, `exception.stacktrace`, code/digest/fingerprint/cause, capture context, and the existing safe event fields; token, URL, response body, and provider error content never appear in results.
- [ ] RED: prove error dispatch does not send a second safe-only Better Stack error record when the same adapter is the approved diagnostic destination.
- [ ] Run focused tests and retain the intended RED failures.
- [ ] GREEN: implement the distinct diagnostic dispatcher, provider record serializer, Better Stack diagnostic sink, and test sink with the existing injected request, host/token validation, timeout, payload cap, exact `202` success, and content-safe failure behavior.
- [ ] Keep the enriched record below 96,000 UTF-8 bytes even after JSON encoding; fail closed rather than dropping only the safe event.
- [ ] Run focused tests GREEN and the full package verification.
- [ ] Commit with message `Separate operational and diagnostic delivery`.

### Task 3: Add versioned browser error-report envelopes

**Files:**
- Modify: `packages/observability/src/browser.ts`
- Modify: `packages/observability/tests/browser.test.mjs`
- Modify: `packages/observability/src/index.ts`
- Modify: `packages/observability/tests/public-api.test.mjs`

**Interfaces:**
- Advance the safe `BrowserEnvelope` and `createBrowserSink` to schema `2.0.0` with discriminator `operational-event`.
- Add a distinct schema `2.0.0` `BrowserErrorEnvelope` with discriminator `error-report` and `createBrowserErrorEnvelope(report)`.
- Add a browser diagnostic transport sink whose input is an `OperationalErrorReport` and whose output never contains credentials or transport details.

- [ ] RED: reject server-runtime reports, non-error events, unbranded reports, unknown fields, unsafe capture values, and oversized serialized envelopes.
- [ ] RED: accept bounded browser error, unhandled rejection, React boundary, and selected-catch reports while preserving immutable safe and restricted tiers.
- [ ] RED: prove the serialized browser envelope is at most 8,192 UTF-8 bytes after deterministic cause removal, stack truncation, then message truncation; prove the fixed truncation markers remain; and return `BROWSER_ERROR_ENVELOPE_TOO_LARGE` when required safe fields alone cannot fit. Test exact 8,192/8,193 boundaries with multibyte and JSON-escaped input.
- [ ] RED: prove safe web-vital envelopes cannot acquire diagnostics.
- [ ] Run focused browser tests and retain RED.
- [ ] GREEN: implement the smallest distinct browser-report envelope and injected delivery boundary.
- [ ] Run focused tests GREEN and full package verification.
- [ ] Commit with message `Encode bounded browser error reports`.

### Task 4: Document, independently review, and stop at the package gate

**Files:**
- Create: `.changeset/add-observability-error-diagnostics.md`
- Create: `docs/implementation-evidence/2026-08-12-observability-error-diagnostics-package-verification.md`
- Create: `docs/review-packets/2026-08-12-observability-error-diagnostics-package.md`
- Modify: `packages/observability/AGENTS.md`
- Modify: `packages/observability/README.md`
- Modify: `packages/observability/package.json`
- Modify: `tests/package-boundaries/public-observability.test.mjs`
- Modify: `tests/package-boundaries/release-safeguards.test.mjs`

- [ ] Add the new public export only if it materially improves boundary clarity; otherwise export the provider-neutral constructors from root and provider adapter from `./server`. Update exact API and pack-inventory tests.
- [ ] Record a minor Changeset for target `0.3.0`, restricted-data warnings, safe/diagnostic sink separation, compatibility impact, and no new runtime dependency.
- [ ] Update canonical package instructions/docs to permit bounded restricted diagnostics only through the explicit contract. Keep generic operational attributes safe.
- [ ] Run package verification, package-boundary tests, constitution, semantic naming, package packing/inventory, zero-runtime-dependency checks, and `rtk git diff --check`.
- [ ] Dispatch independent read-only requirements, architecture/anti-overengineering, test-evidence, and security/privacy reviewers for the exact package-candidate range. Prohibit edits and recursive fan-out. Validate every finding against the current tree; use a focused RED/GREEN repair only for material defects.
- [ ] Record the exact comparison, commands/results, API/compatibility effects, review dispositions, risks, and rollback in the evidence and packet.
- [ ] Commit with message `Record observability diagnostics package candidate`.
- [ ] Re-run only checks affected by the evidence commit, verify a clean worktree, and STOP at Gate A. Do not publish or edit builder integration files.

### Task 5: Materialize and verify the exact public package

**Gate:** Gate B must be affirmatively satisfied before this task.

**Files:** only the release files named above.

- [ ] Revalidate the exact clean package-candidate commit, approved comparison, current default-branch lineage, npm authentication/trusted-publisher prerequisites, and absence of `@egeria-systems/observability@0.3.0`.
- [ ] Use the existing Changesets/OIDC/provenance flow to materialize `0.3.0`. Do not add a token fallback or broaden workflow permissions.
- [ ] Run the release-candidate gate, obtain exact-diff approval and separate push/publication authority, then publish only through the authorized path.
- [ ] Verify registry version history, exact tarball inventory, integrity, provenance, license, zero runtime dependencies, conditional exports, and fresh consumer imports.
- [ ] Record the immutable package revision, workflow/run identity, registry integrity/provenance, and claim limits in the release evidence and packet.
- [ ] Commit only authorized release evidence/source changes with messages naming the actual release step.
- [ ] STOP if registry verification fails or the exact package is unavailable. Never substitute `workspace:*`, `file:`, a tarball, alias, or local link in generated output.

### Task 6: Advance the capability subject and create its certification owner

**Files:**
- Create: `docs/superpowers/plans/2026-08-12-observability-error-diagnostics-certification.md`
- Modify: catalog, recipe, version, certification, constitution, and direct package-boundary files named in generated integration scope.

**Interfaces:**
- Advance capability `observability` to descriptor `0.3.0` and exact package `@egeria-systems/observability@0.3.0`.
- At Gate B, freeze the exact accepted and identical `portfolio`/`site` recipe versions from the post-standards-certification lineage. Advance both by exactly one semantic minor increment with patch reset to zero, and record the frozen predecessor and exact successor versions in the preparation evidence before RED tests. Never guess or reuse the version owned by generated unit/component testing.
- Add data classification `restricted-error-diagnostics`.
- Make `content-files` an explicit dependency because generated error UI consumes validated content.
- Add managed/inference surfaces for `app/error.tsx`, `app/global-error.tsx`, error copy, copy reader, and pure fallback presentation.
- Replace the certified/closed `0.2.0` current subject with a new ordinary `pending` `0.3.0` subject only after preserving its historical evidence owners.

- [ ] RED: require exact new descriptor/version/package, dependency order, restricted data classification, diagnostic-sink semantic requirement, new surfaces/probes, new behavior-contract digest, empty new-subject evidence, and task plan path.
- [ ] RED: require both accepted recipe versions to be identical valid semantic versions and require the diagnostics successor to equal the exact next-minor version derived from that frozen value.
- [ ] Run focused catalog/resolution/certification/registry tests; retain RED.
- [ ] GREEN: update the minimum catalog, verified version, recipes, registry, and direct tests. Generate schemas only if their derived output actually changes.
- [ ] Author the separate certification plan with exact prerequisites and synthetic cases for browser error, unhandled rejection, React boundary, Next request error, selected caught server/browser error, duplicate suppression, Workers safe-field absence, Better Stack message/stack/context receipt, diagnostic failure containment, provider access/region/retention/quota/spend, source/credential/data cleanup, and recovery. The plan must retain separate human approval for every external action.
- [ ] Preserve the completed predecessor plans and current program sequence. Update only current-status/next-increment owners after the source plan has separately selected this diagnostics integration under Gate B.
- [ ] Do not execute certification, mutate providers, or claim that `0.2.0` evidence applies to `0.3.0`.
- [ ] Run focused tests GREEN.
- [ ] Commit with message `Admit restricted error diagnostics`.

### Task 7: Implement generated server capture and delivery

**Files:**
- Modify: `instrumentation.ts` and `server-reporter.ts` templates plus exact builder tests.

**Interfaces:**
- `onRequestError(error, request, context)` awaits `reportServerError(error, safeContext)`.
- `reportCaughtServerError(error, { operation, correlationId? })` reports mechanism `selected-catch` with `handled: true`.
- Server error dispatch sends safe event to Workers Logs and one enriched report to Better Stack.

- [ ] RED: execute generated server composition with all documented Next.js context vocabularies and error digest. Assert event ID, optional correlation, release, fixed `service: "web"`, absent environment, normalized method/route/framework context, message, stack, fingerprint, and handled state.
- [ ] RED: pass request path/query, headers, cookies, private strings, invalid route patterns, hostile error getters, missing credentials, provider rejection, schedule failure, and diagnostic oversize. Assert raw request/private/provider data never reaches either sink/result and application behavior never fails.
- [ ] RED: prove Workers structured records omit diagnostics and Better Stack receives exactly one enriched error record.
- [ ] RED: prove expected validation/control-flow and observability catches remain unreported. Exercise `reportCaughtServerError` directly as the selected-catch boundary because the current generated runtime has no eligible production catch.
- [ ] Run focused render-skeleton tests and retain RED.
- [ ] GREEN: implement safe Next.js context normalization, distinct dispatch composition, non-recursive safe delivery-health logging, and selected-catch API. Keep Cloudflare access in the existing adapter/composition boundary.
- [ ] Run focused tests GREEN, then builder-core tests.
- [ ] Commit with message `Report server errors with restricted diagnostics`.

### Task 8: Implement browser capture, route validation, and accessible error boundaries

**Files:**
- Create the five browser/UI/content templates named above.
- Modify `instrumentation-client.ts`, `browser-reporter.ts`, the observability route, globals, template catalog, generated manifest, and exact builder/browser tests.

**Interfaces:**
- Global listeners pass `ErrorEvent.error`/fallback message and `PromiseRejectionEvent.reason`.
- `reportCaughtBrowserError` and `reportReactBoundaryError` use explicit handled/mechanism context.
- The route accepts safe web-vital envelopes and the distinct diagnostic error envelope, revalidates/re-sanitizes it, and calls server reporting.
- `error.tsx` and `global-error.tsx` report once and render typed externalized recovery copy through a pure component.

- [ ] RED: execute global handler registration and dispatch actual `ErrorEvent`/`PromiseRejectionEvent` values. Prove fresh event IDs, actual message/stack capture, no browser credential, no referrer, no URL/path/filename/user agent, and `WeakSet` suppression for the same error object.
- [ ] RED: test primitive rejection, opaque error event, hostile object, duplicate React/global capture, network rejection, route rejection, and best-effort `keepalive` behavior.
- [ ] RED: execute the route for valid diagnostic input plus exact 8,192/8,193-byte bodies, cross-origin, fallback-origin predicate failures, wrong media type, declared/streamed oversize, malformed JSON, extra/missing keys, invalid vocabularies, nested arbitrary objects, restricted-field overflow, and secret-shaped content. Assert empty bounded responses.
- [ ] RED: validate exact externalized error copy, parser rejection, pure presentation inputs, focusable retry action, heading/landmark semantics, `global-error` root elements, and one report per boundary error.
- [ ] Run focused render-skeleton/content/copy/browser tests and retain RED.
- [ ] GREEN: implement the smallest handlers, reporter, route branch, copy parser, pure fallback, two boundaries, CSS, and catalog entries needed by the tests.
- [ ] Add an actual generated-browser regression that intercepts the same-origin route and proves a synthetic client error/rejection produces the bounded diagnostic envelope. Keep it local/synthetic and assert only declared fields.
- [ ] Run focused tests GREEN, builder-core tests, copy externalization, lint, typecheck, Next build, and the relevant local browser matrix.
- [ ] Commit with message `Capture browser errors with diagnostic context`.

### Task 9: Regenerate exact fixtures and reconcile canonical owners

**Files:**
- Regenerate all three fixture trees.
- Modify direct architecture, roadmap, README, fixture, verification, and package-boundary owners named above.

- [ ] Build the production CLI and generate temporary `portfolio`, portfolio-plus-Calendly, and `site` outputs from exact registry packages.
- [ ] Verify generation, inference, doctor, exact diff, install, audit/signatures, Wrangler types, lint, typecheck, Next/OpenNext builds, and browser development/preview before replacing retained fixtures.
- [ ] Replace retained fixtures only from successful output. Re-infer and verify managed-surface fingerprints; never hand-edit state.
- [ ] Update canonical architecture/package/capability/enforcement/program owners with the safe/diagnostic split, restricted-data handling, `0.3.0` pending status, provider portability, current claim limits, and new certification plan. Preserve historical `0.2.0` evidence.
- [ ] Explicitly document that message/stack sanitization is not a privacy guarantee and that stacks are not source-map deobfuscated in this increment.
- [ ] Run generated-fixture determinism and directly affected package/constitution/certification tests.
- [ ] Commit fixtures with message `Refresh observable application fixtures` and documentation with message `Document restricted error diagnostics`.

### Task 10: Independent implementation review, full verification, and stop

**Files:**
- Create: `docs/implementation-evidence/2026-08-12-observability-error-diagnostics-verification.md`
- Create: `docs/review-packets/2026-08-12-observability-error-diagnostics.md`
- Modify only already named files for evidence-backed repairs.

- [ ] Dispatch independent read-only requirements, architecture/anti-overengineering, test-evidence, and security/privacy reviewers for the exact integration comparison. Add no further specialist unless a material finding requires one. Prohibit edits and recursive fan-out.
- [ ] Validate every finding against the current tree. Repair only material defects with focused RED/GREEN evidence. Obtain at most one bounded recheck for repaired findings.
- [ ] Run the settled focused suites and exactly one full `rtk proxy env CI=true volta run --node 22.23.2 --pnpm 11.20.0 pnpm run verify:builder-kernel` on unchanged final implementation inputs.
- [ ] Run a fresh moderate production/root audit and signature/provenance checks only when their networked inputs are authorized and record their point-in-time limits.
- [ ] Record exact comparison, changed files, commits, commands/results, review dispositions, compatibility/migration effects, safe-versus-restricted field evidence, risks, deferred source-map/provider work, and source/package/provider/credential/data rollback/recovery separately.
- [ ] State prominently that the new `0.3.0` capability remains `pending`, its certification plan was not executed, no deployment/provider/secret/data external action occurred, and no production-readiness/privacy-completeness claim is made.
- [ ] Commit with message `Record observability diagnostics review`.
- [ ] Re-run only checks whose inputs changed in the evidence commit, verify the clean exact final diff, and STOP for explicit verified-final-diff approval. Do not push, merge, deploy, configure providers, transition the registry, execute certification, or begin the next program increment.

## Expected Final Claim

After Task 10, local and generated evidence may support only this claim:

> The reviewed generated code reports unexpected/unhandled errors exposed by the tested browser and Next.js capture points, and exposes explicit selected-catch APIs. Workers custom logs receive bounded safe context; the approved Better Stack adapter receives bounded restricted message/stack diagnostics. Delivery, provider receipt, retention, cleanup, source-map deobfuscation, and production behavior remain separately certified outcomes.

It must not claim literally all runtime errors, durable delivery, privacy completeness, deobfuscated production stacks, provider availability, production readiness, or certification.
