# Production Observability Certification Preparation Evidence

**Date:** 2026-08-11 (America/Toronto)

**Planning base:** `fb3af7fef7602764432f16940abff0ffc65a5b67`

**Implementation branch:** `observability-certification`

**Isolated worktree:** `/Users/CoveMB/Code/CoveMB/egeria-scaffold/.worktrees/production-observability`

**Certification subject:** `observability@0.2.0`

**Behavior-contract digest:** `sha256:a4f15a132e08da307ab412673b02152fee8509c0cc1dabb4b60856abd61f5d97`

**Plan:** [Production Observability Capability Certification Implementation Plan](../superpowers/plans/2026-08-10-production-observability-certification.md)

## Approved local outcome and authority boundary

The user selected the separate observability certification increment and preapproved evidence-backed exact-file plan amendments through implemented-task review. This authorizes bounded local planning, source, tests, focused commits, and read-only review on the dedicated branch. It does not authorize merging or pushing Task 6 or Task 6B, workflow dispatch, GitHub environment or secret mutation, Cloudflare deployment or credential use, Better Stack source or token mutation, telemetry transmission, provider inspection, spending, cleanup, certification-state transition, publication, or production action.

This local increment must produce causal `fresh-scaffold` evidence and a reviewable protected-staging/provider path. The registry remains `pending` until separately authorized `deployed-application` and `cleanup-recovery` evidence is complete, affirmatively reviewed, exact-subject/revision bound, and approved for a later registry transition.

## Repository identity and inspected state

- The linked worktree was clean on branch `production-observability` at `fb3af7fef7602764432f16940abff0ffc65a5b67` before the dedicated local branch `observability-certification` was created.
- The approved Task 6 implementation comparison is `717c3bb0f048f4a4bc544100125ae42d818f09bc..45b57d2dc265ef6ba9ac805d7352a01db5f1081d`; `fb3af7f` records its approval without changing runtime behavior.
- Local `main` and `origin/main` remained at published-package revision `717c3bb0f048f4a4bc544100125ae42d818f09bc`. Task 6 and its approval record were not integrated or pushed. Remote refs were not fetched because freshness does not change the bounded local implementation and no external execution is authorized.
- Exact toolchain: Node.js `22.23.2`, pnpm `11.20.0`, Next.js `16.3.0`, React `19.2.8`, `@opennextjs/cloudflare@1.20.2`, Wrangler `4.118.0`, TypeScript `6.0.3`, Playwright `1.62.1`, axe-core `4.12.1`, Zod `4.4.3`, and YAML `2.9.0`.
- `@egeria-systems/observability@0.2.0` and `@egeria-systems/standards@0.2.0` are published ordinary dependencies. Generated portfolio/site repositories install exact observability `0.2.0` and deliberately retain standards `0.1.0`.

Preparation read the root and relevant nested `AGENTS.md` files; approved reconciled source plan; program roadmap; architecture overview, capability model, enforcement map, package ownership, review protocol, and all accepted ADRs through ADR-0011; current `.egeria` project/state/migration/profile/capability/certification contracts and checked schemas; workspace and package manifests; certification registry and runtime validators; capability descriptors and recipes; generated portfolio/portfolio-Calendly/site manifests and state; current workflows; compatibility record; recent commits; Task 6 preparation, verification, release, and review packets; and the prior Calendly certification plan, runner, workflow, receipts, and review evidence.

The canonical current subject is an ordinary `pending` record requiring sorted outcomes `cleanup-recovery`, `deployed-application`, and `fresh-scaffold`. Admission passes. Both `legacy-backfill-exempt` and `all-certified` closure reject observability until the required evidence is complete and status changes through a separately reviewed transition.

## Baseline checks

The exact-toolchain baseline passed:

- constitution contract: 22/22;
- capability-certification suite: 5/5; and
- private package-boundary suite: 7/7.

An initial command inherited a fallback `pnpm@11.16.0` in subprocess `PATH`; pnpm attempted to resolve the repository-required `11.20.0`, the sandboxed registry request failed, and the noninteractive module replacement stopped. Re-running with the exact Volta Node/pnpm directories first in `PATH` passed. This was setup-invalid execution evidence, not a source failure, and no repository file changed.

## Current official documentation and advisory evidence

All sources below were revalidated on 2026-08-11. External documentation is evidence, not execution authority.

- [Cloudflare Workers Logs](https://developers.cloudflare.com/workers/observability/logs/workers-logs/) documents structured custom logs, provider-controlled error/exception and invocation records, independent invocation-log disablement, sampling, a 256 KB event limit, 200,000 daily Free events with three-day retention, paid quotas/pricing with seven-day retention, and a seven-day absolute maximum. Custom schema claims cannot include platform/framework records.
- [Cloudflare Context](https://developers.cloudflare.com/workers/runtime-apis/context/) limits HTTP `waitUntil()` work to 30 seconds after response/disconnect and recommends Queues for reliable retried delivery and Tail Workers for exception/log emission resilient to uncaught failure. The current capability therefore remains best-effort and must not claim durability.
- [Cloudflare secrets](https://developers.cloudflare.com/workers/configuration/secrets/) requires secret bindings rather than plaintext variables. `wrangler secret put/delete` creates and deploys a version immediately; bulk/version-scoped paths have different deployment semantics. Secret installation and source deployment must be separately visible in evidence.
- [Cloudflare GitHub Actions](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/) requires CI-held account/token values and recommends account scoping. Official permission documentation does not prove one exact command-by-command minimum token set, so an authorized human must approve the staging token, resource scope, expiry, and revocation plan.
- [GitHub deployment environments](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments) withhold environment secrets until configured protection passes. A manual workflow must reside on the default branch, so the local workflow cannot execute until a separately approved integration and push makes it available there.
- [OpenNext Cloudflare CLI](https://opennext.js.org/cloudflare/cli) defines build, deploy, and upload behavior and forwards supported Wrangler options. Its `1.20.2` release does not independently establish exact Next.js `16.3.0` compatibility; actual pinned build and protected deployment remain required evidence.
- [Next.js instrumentation](https://nextjs.org/docs/pages/api-reference/file-conventions/instrumentation) requires awaited asynchronous `onRequestError` work, while the existing adapter schedules failure-contained reporting through Cloudflare context. Local and deployed checks remain necessary and do not prove durable delivery.
- [Better Stack HTTP ingestion](https://betterstack.com/docs/logs/ingesting-data/http/logs/) requires the source-specific ingesting host and bearer source token and documents `202`, `402`, `403`, `406`, and `413` results. The same page gives conflicting 20 MiB and 10 MiB request-limit descriptions; certification remains far below 8,192 bytes and encodes neither provider threshold as an application contract.
- [Better Stack source creation](https://betterstack.com/docs/logs/api/create-a-source/) returns the authoritative source token, ingesting host, region, and retention. Those values must not be guessed or copied into repository evidence. Team-scoped API authority is narrower than a global token, but this plan automates no source-management API call.
- [Better Stack pricing](https://betterstack.com/pricing) documents the personal-project Free tier as 3 GB retained for three days. Region, eligibility, spend ceiling, retention, and data-residency acceptance require current human confirmation before transmission.
- [Better Stack source deletion](https://betterstack.com/docs/logs/api/delete-an-existing-source/) documents permanent deletion, while source-token lifetime/rotation and immediate revocation semantics were not documented in the reviewed material. Cleanup evidence must record observable final state without claiming undocumented revocation behavior.
- [Node.js 22.23.2](https://nodejs.org/en/blog/release/v22.23.2/) is the 2026-07-29 security release. [pnpm audit](https://pnpm.io/cli/audit) and [pnpm dependency-resolution security settings](https://pnpm.io/settings/dependency-resolution) support the repository's actual graph/advisory boundary. npm provenance verification is not substituted through an npm install for this pnpm workspace.
- GitHub advisories [GHSA-c7mq-gh6q-6q7c](https://github.com/advisories/GHSA-c7mq-gh6q-6q7c) and [GHSA-492v-c6pp-mqqv](https://github.com/vercel/next.js/security/advisories/GHSA-492v-c6pp-mqqv) identify patched floors `@opennextjs/cloudflare@1.17.1` and Next.js `16.2.5`; the pinned versions are above those floors. No official exact-version Wrangler advisory result was located, which is not proof of absence. A live `pnpm audit --json` and signature audit remain required point-in-time evidence.

## Consolidated contradictions and live-run blockers

### The workflow cannot yet be invoked

Task 6 and Task 6B are local-only. GitHub manual workflows must exist on the default branch, but integration, push, and workflow dispatch are all outside current authority.

**Local resolution:** prepare and statically verify the exact workflow. Stop after implemented-task review. A later authorization must name the reviewed SHA for integration/push and separately authorize dispatch.

### Provider and credential prerequisites are unresolved by design

No current authority identifies or permits mutation of a GitHub environment, Cloudflare account, Worker, API token, Better Stack team/source/token, region, plan, retention, or data. Reusing a historical `compatibility` environment would silently inherit stale protection and broad shared credentials.

**Local resolution:** use a dedicated declarative environment name `observability-certification` and a constant Worker `acme-portfolio-observability`; create or configure neither. Before a live run, one consolidated human decision must name the GitHub repository administrator, workflow dispatcher, deployment risk owner, Cloudflare account administrator, Better Stack operator, privacy/cost owner, cleanup owner, and evidence reviewer; confirm environment protections and exact allowed revision; approve the Cloudflare token scope/expiry/revocation; approve Better Stack account/team/region/source create-or-reuse/tier/retention/spend/data-residency/source-token storage; approve the public staging origin; and authorize deployment, secret installation, synthetic transmission, provider inspection, Worker/source/data cleanup, and credential disposition separately.

### Deployment and secret mutation are separate effects

The generated Worker safely runs without Better Stack configuration. Cloudflare secret commands create versions/deployments and must not be hidden inside a generic build step.

**Local resolution:** the prepared workflow builds without credentials, deploys one dedicated Worker with only Cloudflare credentials, then uses one isolated step holding both Cloudflare and the two declared Better Stack secrets to bulk-install them from a mode-0600 runner-temporary file that an exit trap removes. A later live receipt must record both effects and cleanup separately. No secret value enters command arguments, artifacts, logs, or repository files.

### Live failure injection would create unnecessary provider risk

The existing observability package and generated-source tests already exercise provider rejection, timeout, unreachable delivery, non-throwing dispatch, and application-response containment. Mutating live host/token values to repeat those cases would add credential and provider effects without stronger evidence.

**Resolution:** protected staging exercises actual successful custom delivery, browser-route rejection behavior, one exact generic framework error, and ordinary application responses. The provider receipt cites the exact local failure-containment tests and does not claim that a live provider outage was induced.

### Provider records exceed the custom privacy envelope

Disabling invocation logs does not remove Cloudflare's separately retained platform/framework errors and exceptions. Better Stack receives pre-redacted custom events, while any provider-side transformation occurs after transit.

**Resolution:** custom events contain only fixed synthetic names, revision-derived correlation markers, release/runtime/kind/severity, normalized categories, and allowlisted attributes. One certification-only route throws one exact generic message. The live reviewer must separately inventory platform record fields and retention, stop on unexpected private/real content, and never copy raw logs, stacks, request metadata, host/token values, or private provider URLs into repository evidence.

### Retention, quota, compatibility, and durability claims are conditional

Cloudflare and Better Stack plans control retention/quota/cost. OpenNext's release notes do not certify the exact Next pin. `waitUntil()` does not provide retries or durable delivery.

**Resolution:** require explicit no-upgrade/spend and retention decisions, actual pinned build/deploy evidence, bounded event counts, post-run quota observations, and separate data/source/Worker cleanup evidence. Claim only one exact journey. No unresolved architecture contradiction blocks the bounded local implementation.

## Local claim limits

The planned local runner can establish actual builder output, `.egeria` agreement, inference, diagnostics, exact diff, install, audit, signature, lint, typecheck, Next/OpenNext build, and local browser behavior through the fixed verifier. A prepared workflow and receipt template establish no hosted execution or provider outcome. Until a separately authorized journey and review occur, there is no deployed-application, Workers Logs UI, Better Stack receipt, retention, abuse/cost, cleanup/recovery, production, performance, visual, human-accessibility, WCAG-conformance, analytics, security-completeness, or ongoing-availability evidence.
