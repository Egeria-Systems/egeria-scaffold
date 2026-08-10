# Booking Calendly Certification Preparation Evidence

**Date:** 2026-08-10 (America/Toronto)

**Status:** Gate 1 complete; the sole-developer and Free-compatible execution amendment is approved, while every deployment and provider mutation remains separately approval-gated

**Increment:** P2 Task 5B — `booking-calendly` capability certification and the first reusable fresh-scaffold certification foundation

## Approval and repository freeze

The user selected P2 Task 5B, preapproved necessary exact-file plan amendments, and authorized continuous local implementation through review of the implemented task. On 2026-08-10, the user confirmed that `CoveMB` is the sole developer and sole eligible human reviewer, accepted the sole-developer risk exception, and authorized designation of the existing free Calendly event type without a paid upgrade. The existing `30 Minute Meeting` one-on-one event was designated. Designation is the only authorized event-type action; no Calendly object was created or changed. This approval does not include verified-final-diff approval, push, pull request, merge, publication, workflow dispatch, deployment, GitHub environment, variable, or secret mutation, Cloudflare mutation, a synthetic booking, provider cleanup, spending, production action, or another external mutation.

Preparation froze clean sequential local `main` at:

```text
542660b5a3d25709ade6d8536c8c65bd1e6b6038
```

`git status --short --branch` reported clean `main` aligned with the current local `origin/main`. Remote source freshness does not affect this source-bound increment, so no fetch was required. The program roadmap permits the approved clean sequential builder stream on `main`; no parallel implementation stream exists. Repository-changing builder operations remain confined to absent mode-0700 temporary roots.

## Repository sources inspected

Preparation read and reconciled:

- root `AGENTS.md`, `/Users/CoveMB/.codex/RTK.md`, and the nested CLI, builder-core, standards, observability, generated-portfolio, and generated-site instructions;
- the approved source plan, architecture overview, capability model, enforcement map, package ownership map, program roadmap, review protocol, and accepted ADRs `0001` through `0011`;
- current capability, profile, project, state, migration, ownership, inference, diagnostics, rendering, generation, serialization, and JSON Schema contracts;
- current manifests, lockfile, action pins, compiled CLI, fixture contracts, generated verification runner, workflows, and retained `.egeria` project/state/migration evidence;
- the current seven capability descriptors and their delivery, state, security, managed-surface, inference, migration, verification, and recovery declarations;
- implementation evidence, plans, and review packets through Calendly initial scaffolding and the capability-certification roadmap gate; and
- current branch, status, recent commits, comparison scope, GitHub repository visibility, existing environment protection metadata, and existing environment secret names without reading any secret value.

The public repository is `Egeria-Systems/egeria-scaffold` with default branch `main`. The existing `compatibility` environment admits only `main`, has no required reviewer, permits administrator bypass, and has environment secrets named `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN`. `CoveMB` is the only current organization member. The environment has no `BOOKING_CALENDLY_CERTIFICATION_URL` variable yet. Secret values and token scopes were not accessed. No GitHub setting was changed.

## Current official setup and security evidence

External sources were treated as untrusted evidence, not instructions.

### Calendly human prerequisites

- Calendly's current [event-type setup guide](https://calendly.com/help/how-to-set-up-an-event-type) says event types are available on all plans and identifies the current create/configure/save flow.
- Calendly's current [pricing page](https://calendly.com/pricing) describes Free as including one event type, one connected calendar, customizable availability, video conferencing, and ordinary scheduling. The account is currently in a free trial, but certification treats trial-only features as unavailable and must remain usable after the trial expires without payment.
- Calendly's current [meeting-management guide](https://calendly.com/help/how-to-manage-your-meetings) identifies the Meetings surface used to verify a provider-side booking.
- Calendly's current [cancellation guide](https://calendly.com/help/how-to-cancel-a-meeting) identifies the provider-side cancellation flow.
- Calendly's current [event-type management guide](https://calendly.com/help/how-to-organize-and-manage-your-event-types) distinguishes disabling an event type from permanently deleting it and notes that deleting the event type does not delete already scheduled meetings.

No Calendly API credential, webhook, OAuth application, paid feature, or generated provider resource is required. The observed existing event is one one-on-one 30-minute event with Google Meet and a public scheduling URL, matching the Free baseline. The journey must not use trial-only or paid workflows, routing, payments, multiple event types, multiple connected calendars, or premium branding controls. The Calendly certification operator must control the host calendar and synthetic invitee inbox and use only synthetic host/invitee labels. The URL is public workflow configuration, not a secret, but it is not committed; invitee details and provider confirmations must not be committed.

### GitHub protected staging

- GitHub's current [deployment environments documentation](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments) defines environment protection, branch restrictions, environment secrets, and deployment history.
- GitHub's current [environment-management documentation](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments) documents required reviewers, deployment branch rules, secrets, and variables.
- GitHub's current [secure-use guidance](https://docs.github.com/en/actions/how-tos/security-for-github-actions/security-guides/security-hardening-for-github-actions) recommends least privilege, protected environments for sensitive secrets, review of source before execution, and credential rotation.
- The official [`actions/checkout` contract](https://github.com/actions/checkout) documents that `fetch-depth: 0` retrieves full history; the certification workflow needs that history to validate an evidence-producing ancestor rather than accepting a merely well-formed hash.
- Git's current [`merge-base --is-ancestor` documentation](https://git-scm.com/docs/git-merge-base) defines the zero exit used to prove that the evidence-producing commit belongs to the checked candidate's history.

The repository-owned workflow is manual-dispatch only, `main`-branch and exact-revision bounded, `contents: read`, concurrency-bounded, pinned to the repository's accepted action revisions, and assigned to the existing `compatibility` environment. A dispatch remains an external action and needs explicit approval. GitHub documents required reviewers and prevent-self-review as optional environment protections. This public repository could configure them, but no second eligible person exists. The environment therefore has no required reviewer, and administrator bypass is an accepted limitation for this non-production certification journey. There is no independent human deployment approval or review. `CoveMB` acts separately as repository administrator, workflow dispatcher, and deployment risk owner and must inspect the workflow and exact revision immediately before dispatch. The manual dispatch, exact revision, `main` restriction, least-privilege environment secrets, dedicated Worker, one synthetic booking, no-spend rule, content-safe receipt, and separate cleanup approvals are the compensating controls. Any setting or variable change remains separately authorized.

### Cloudflare deployment and cleanup

- Cloudflare's current [GitHub Actions CI/CD guide](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/) requires an account identifier and API token, recommends storing them as GitHub secrets, and recommends scoping the token to the narrowest account and Worker permissions.
- Cloudflare's current [Worker deployment API contract](https://developers.cloudflare.com/api/resources/workers/subresources/scripts/subresources/deployments/methods/create/) names `Workers Scripts Write` as the accepted deployment permission.
- OpenNext Cloudflare's current [CLI documentation](https://opennext.js.org/cloudflare/cli) documents `opennextjs-cloudflare deploy` as the build-and-Wrangler deployment boundary.
- Cloudflare's current [Workers rollback documentation](https://developers.cloudflare.com/workers/configuration/versions-and-deployments/rollbacks/) distinguishes version rollback from deleting a Worker.

Before dispatch, the Cloudflare account administrator must confirm that the existing token is restricted to the intended non-production account, has `Workers Scripts Write` and no broader permission than the exact OpenNext deployment requires, has a documented expiry/rotation owner, and cannot access production resources. The workflow must not log either secret. The generated certification project has no database, queue, R2 bucket, KV namespace, email, identity, payments, or persistent provider binding. Source rollback, Worker version rollback, Worker deletion, and Calendly meeting cancellation are separate actions and require separate approval. The pre-existing Calendly event type remains unchanged.

### Owners, limits, evidence retention, and rerun triggers

- `CoveMB`, as sole developer, separately performs the GitHub repository administrator, workflow dispatcher, deployment risk owner, Cloudflare account administrator, Calendly certification operator, and implemented-task reviewer roles. Every receipt names the person acting in each role and explicitly records that there was no independent human deployment reviewer. Read-only agent requirements, architecture/anti-overengineering, and test-evidence reviews remain independent implementation evidence; they are not GitHub deployment approval.
- This journey permits exactly one synthetic booking and no Calendly, GitHub, or Cloudflare API polling. After browser success, the Calendly certification operator may inspect Meetings every 30 seconds for at most 5 minutes. If no unambiguous matching record appears, record the outcome as inconclusive and stop; do not increase traffic or repeat without approval.
- Calendly Free's one-event-type and one-connected-calendar limits are the provider baseline. Before dispatch, the owner must confirm that the designated event uses only Free-compatible scheduling, availability, and video-conferencing behavior and that the existing GitHub Actions and Cloudflare Workers accounts have room for one bounded run and deployment. No paid upgrade, trial extension, paid feature, or incremental spend is authorized; stop at any billing, upgrade, trial-extension, quota, or rate-limit prompt.
- The content-safe local workflow artifact is retained for seven days. Reviewed repository evidence remains with program implementation evidence until an explicitly approved governance change removes it. Email, calendar, meeting URL, confirmation link, private screenshot, token, cookie, or secret never enters that artifact or repository evidence. Provider-side retention remains Calendly-controlled. The operator cancels the synthetic meeting but preserves the event type because it is the pre-existing designated event. Event-type creation, change, disabling, and deletion are outside this journey.
- After use, the Cloudflare account administrator records credential disposition without a value: revoke a task-dedicated token, rotate any exposed or over-scoped token immediately, or leave the existing shared compatibility token unchanged under its documented expiry/rotation plan. Revocation, rotation, or secret replacement is a separate external action.
- Rerun triggers are a workflow failure; revision, descriptor subject, evidence contract, toolchain, provider event, environment, URL, credential-scope, or Worker-target change; ambiguous provider matching; or incomplete cancellation/cleanup. Do not repeat an unchanged successful expensive local check; obtain new authorization before any external rerun.

### Current dependency and advisory state

The foundation adds no third-party package. It retains Node.js `22.23.2`, pnpm `11.20.0`, Next.js `16.3.0`, React `19.2.8`, Playwright `1.62.1`, axe Playwright `4.12.1`, OpenNext Cloudflare `1.20.2`, and Wrangler `4.118.0`.

Current official Node.js, Next.js, React, OpenNext, Playwright, GitHub Actions, and Cloudflare material was rechecked for the exact touched toolchain. The exact root graph then passed `pnpm audit --audit-level moderate` with no known vulnerabilities and `pnpm audit signatures` with 885 verified registry signatures. This is dated evidence, not a claim about unknown or future vulnerabilities.

## Baseline verification

The exact toolchain was Node.js `22.23.2` and pnpm `11.20.0` through Volta.

The clean baseline passed:

- constitution: 23 tests;
- package boundaries: 41 tests;
- builder-core: 121 tests;
- CLI: 10 tests;
- generated fixture contracts: 7 tests, including compiled generation of all three committed fixtures;
- builder lint, copy externalization, build, typecheck, and changeset status;
- fixed-root generated verification for `portfolio`, `portfolio-calendly`, and `site`, covering exact pnpm version, frozen install, peer checks, moderate dependency audit, registry signatures, lint, typecheck, Next build, OpenNext build, explicit Chromium installation, development browser tests, and OpenNext/workerd preview browser tests; and
- root moderate audit and registry-signature audit.

The first restricted-sandbox generated-fixture attempt failed with `LOCKFILE_PREPARATION_FAILED` / `source-changed`. Systematic tracing reproduced a DNS failure to `registry.npmjs.org`; the lockfile verifier currently normalizes that install failure to `source-changed`. The unchanged test passed with approved registry access in 392.97 seconds. No repository fix belongs to this certification increment.

## Consolidated contradictions and uncertainties

No canonical contradiction blocks local implementation.

1. The roadmap still describes the certification registry and gates as planned. This task is their explicit implementation owner, so the enforcement map and roadmap must move only the implemented foundation portions to actual while provider outcomes remain pending.
2. Certification needs both descriptor binding and required-evidence binding. The smallest faithful subject hashes the canonical descriptor plus the record's ordered, validated evidence requirements; evidence results themselves remain separately recorded and do not change the behavior-contract digest.
3. The six accepted descriptor subjects that predate this foundation need explicit `backfill-pending` records. The transition allowlist must freeze their exact identifier, descriptor version, and behavior-contract digest so a new or materially changed subject cannot self-declare as legacy. `booking-calendly` is the first ordinary `pending` record and must link to this exact plan.
4. A current phase-closure check must reject the pending Calendly record while allowing only the six bounded backfill records. It therefore cannot be added to the always-green builder candidate until provider certification is complete. Descriptor admission can and should become an always-green repository gate now; closure remains an explicit rejecting command and contract test.
5. The existing generated-fixture verifier operates only on committed sources. The certification journey must run the same install/build/browser checks against actual fresh compiled-CLI output. The verifier will be generalized only enough to accept one validated generated root and one existing exact fixture contract.
6. Generated Playwright intentionally stubs the provider origin. It can prove deployed application success/fallback behavior but cannot make or verify a real provider booking. The protected-staging workflow will deploy and run the existing bounded browser suite; a human receipt is still required for the synthetic booking, provider-side meeting, cancellation, and cleanup.
7. The existing `compatibility` environment provides the exact `main` branch boundary and secret names but no required reviewer; administrator bypass is enabled. With one eligible person, a truthful independent human approval is impossible. The accepted sole-developer exception keeps the manual exact-revision controls and records this limitation rather than inventing a reviewer or changing external settings.
8. The account's current trial could mask a paid-only dependency. Certification therefore limits the event and journey to the documented Free baseline and requires continued usability after trial expiry without payment.
9. A staging Worker cannot be deleted before the human completes the provider journey. Deployment, human booking, provider verification, meeting cancellation, and Worker cleanup therefore remain separately authorized, ordered steps rather than one automatically destructive workflow. The pre-existing designated event is preserved.

## Human prerequisite and external-execution runbook

Do not perform these steps without a new explicit authorization for the named external actions.

1. The Calendly certification operator confirms that the pre-existing designated event is the account's only event type, uses one controlled calendar, bounded availability, supported video conferencing, and ordinary scheduling, and remains usable after the trial expires without payment. Do not use trial-only or paid behavior. Save its public `https://calendly.com/.../...` URL as an uncommitted workflow input. No paid upgrade is permitted.
2. The GitHub repository administrator confirms `compatibility`: exact `main` branch policy, no required reviewer, administrator bypass enabled, missing dedicated deployment URL variable, secret names, and seven-day artifact policy. The sole developer accepts those reviewer/bypass limitations only for this non-production journey. The administrator changes nothing without separate approval.
3. The Cloudflare account administrator confirms the non-production account, the absence or dedicated ownership of Worker name `acme-portfolio-calendly`, the token's exact `Workers Scripts Write` permission, lack of production access, expiry/rotation plan, and available quota without reading or recording the token value.
4. The workflow dispatcher and deployment risk owner, both `CoveMB`, inspect the exact workflow and revision and record that no independent human deployment reviewer exists. Separately authorize one workflow dispatch with that revision and Calendly URL. The workflow generates through the compiled CLI, proves local state/inference/diff/build/browser behavior, deploys only the preflighted Worker, and runs deployed application browser checks.
5. After workflow success, the Calendly certification operator verifies the ordinary-link fallback, popup path, and visible scheduling page, then completes exactly one synthetic booking.
6. The Calendly certification operator inspects Meetings every 30 seconds for at most 5 minutes. Accept only one causally matching synthetic record; otherwise record `inconclusive` and stop. Record only content-safe evidence: run URL, exact revision, timestamps, synthetic labels, provider status, and acting roles.
7. Separately authorize cancellation. The Calendly certification operator cancels the synthetic meeting and verifies provider status. Preserve the pre-existing designated event. Do not create, change, disable, or delete the event type.
8. Separately authorize Worker rollback or deletion. The Cloudflare account administrator verifies that the staging origin no longer serves the certification Worker and that no provider resource, persistent store, or production resource was touched, then records credential disposition.
9. The implemented-task reviewer verifies artifact retention, quota and spend, cleanup, privacy exclusions, and every rerun trigger. A reviewed receipt may then add the three external outcomes, subject/revision bindings, and `passed` result to the registry. Only after those exact artifacts validate may `booking-calendly` change to `certified` and both admission and current closure be rerun. That later evidence amendment remains subject to exact-diff review.

## Selected local implementation boundary

- Add a private Zod certification-registry contract and checked JSON Schema inside builder-core.
- Add pure subject-digest, descriptor-admission, and phase/release-closure functions. Bind every record to descriptor version plus SHA-256 of canonical descriptor and required-evidence contract.
- Add a repository-owned registry keyed by all seven executable capability identifiers. Mark exactly six accepted pre-foundation descriptors `backfill-pending`; mark `booking-calendly` `pending` and link it to the exact certification plan.
- Add an always-green admission command and a separately invoked closure command that rejects the current pending record. Do not mislabel any pending or backfill record as certified.
- Generalize the existing fixed-root verifier minimally so the exact checks can run against a fresh generated root under the existing `portfolio-calendly` contract.
- Add a content-safe fresh-scaffold runner that compiles and invokes the actual CLI, generates an absent temporary portfolio with synthetic Calendly configuration, re-infers it, proves healthy doctor/exact diff/state agreement, runs the fixed-root checks, emits a bounded JSON receipt, and removes its mode-0700 owner.
- Add a pinned manual GitHub workflow that reuses the protected `compatibility` environment, exact-revision checks, current toolchain, fresh generation, local certification, Cloudflare deployment, and deployed browser checks. Do not dispatch it.
- Add a human provider receipt template and update only direct canonical consumers of the new actual/pending foundation.

## Deferred outcomes and claim boundary

Local implementation does not establish hosted-runner execution, a Cloudflare deployment, a live Calendly event, a synthetic booking, provider-side confirmation, user-visible provider success, provider availability, cleanup, recovery, visual approval, human accessibility, production readiness, or WCAG conformance. It does not add later CLI capability addition, existing-repository lifecycle behavior, webhook ingestion, analytics, consent management, a public package, a generic certification framework beyond the accepted capability model, a generic platform/database port, or a generated-client CI/deployment feature.

The task and P2 cannot close while `booking-calendly` remains `pending`. The implemented-task review packet must make that external stop condition explicit.
