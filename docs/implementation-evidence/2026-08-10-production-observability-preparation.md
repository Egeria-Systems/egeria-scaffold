# Production Observability Preparation Evidence

**Date:** 2026-08-10 (America/Toronto)

**Planning base:** `c6617e5192e7e3a983a82d074791e451cfbe9bd7`

**Implementation branch:** `production-observability`

**Design:** [Production Observability Design](../superpowers/specs/2026-08-10-production-observability-design.md)

**Plan:** [Production Observability Implementation Plan](../superpowers/plans/2026-08-10-production-observability.md)

## Approved outcome

The selected P2 production-observability increment must turn the existing shell into privacy-safe operational telemetry for every generated `portfolio` and `site` repository. The completed capability must provide Cloudflare Workers Logs, Better Stack server delivery, explicitly configured browser-error and web-vitals reporting, structured events, correlation and release context, normalized error categories, redaction, and test sinks/assertions. It must not install Cloudflare Web Analytics, another visitor-analytics provider, session replay, behavioral autocapture, console interception, a database, a queue, `apps/jobs`, or later-profile behavior.

The user preapproved exact-file plan amendments and continuation through the implemented-task review. That approval covers bounded local source changes, tests, commits, and read-only reviews. It does not authorize package publication, push, workflow dispatch, deployment, provider configuration, secret mutation, spending, production mutation, or capability certification.

## Repository identity and preparation

- Source checkout: `/Users/CoveMB/Code/CoveMB/egeria-scaffold`
- Clean local branch at selection: `main`
- Local `HEAD`: `c6617e5192e7e3a983a82d074791e451cfbe9bd7`
- Local `origin/main`: `c6617e5192e7e3a983a82d074791e451cfbe9bd7`
- Isolated worktree: `.worktrees/production-observability`
- Exact toolchain: Node.js `22.23.2`, pnpm `11.20.0`
- Remote refs were not fetched because local `main` and the existing `origin/main` tracking ref were identical and remote freshness did not affect this local planning boundary.

The isolated worktree was installed from the frozen lockfile. The unchanged complete builder-kernel baseline reached generated-fixture execution and then failed because its sandboxed fresh-lockfile subprocess exhausted DNS retries. A registry-enabled rerun of `test:generated-fixtures` passed all eight tests and all three immutable fixture comparisons. The repository remained clean. This is an environment-bound first-run result, not a source defect.

Current registry audits under the exact toolchain reported no known moderate-or-higher vulnerabilities for the root or production dependency graph, and the signature audit verified 885 packages. These are point-in-time registry results, not proof that unknown vulnerabilities or upstream compromise do not exist.

## Canonical repository sources reviewed

Preparation read the root and relevant nested `AGENTS.md` files; the approved reconciled source plan; program roadmap; architecture overview, capability model, enforcement map, package ownership, and review protocol; every accepted ADR through ADR-0011; current `.egeria` project/state/migration/profile and capability contracts plus checked JSON Schemas; current package and workspace manifests; capability catalog, profile recipes, certification registry, templates, generated fixtures, tests, workflows, and recent commits.

The directly relevant accepted owners are:

- the approved source plan sections for the observability package and the observability/analytics split;
- ADR-0010 for the mandatory operational-telemetry contents and excluded analytics behavior;
- package ownership for the public replaceable package boundary;
- the capability model and ADR-0002 for hybrid delivery, state, inference, removal, and certification;
- ADR-0005 for Cloudflare adapter isolation;
- the review protocol for TDD, independent review, evidence, commits, and approval gates; and
- the program roadmap for the P2 sequence and separate capability-certification task.

Preparation also read the current public-package release packet, generated browser foundation packet, responsive portfolio packet, Calendly scaffolding packet, and Calendly certification packet. Those packets establish the immutable published `0.1.0` package boundary, current generated-browser matrix, pure presentation boundary, capability admission rule, and prohibition on reusing provider or deployment authority.

## Current implementation facts

- `@egeria-systems/observability@0.1.0` is an immutable published shell with an empty ESM API and no runtime dependency.
- Generated repositories pin that exact public package. The fixed-root verifier forbids workspace, file, link, and tarball substitutes.
- The current `observability@0.1.0` capability descriptor owns only the package declaration and an installed-capability marker.
- `deployment-cloudflare` owns the generated `wrangler.jsonc` file. Observability must not introduce overlapping managed-file ownership; it may infer a dependency-owned JSON value while the deployment capability remains the file owner.
- The current profile recipes are `0.5.0`. Materializing a new observability behavior changes the versioned recipe output.
- The observability certification record is a frozen `backfill-pending` tuple for the current descriptor. A material descriptor change must replace that exemption with an ordinary `pending` record linked to a separately planned certification task.
- A standards minor Changeset is already pending. A later release materialization will therefore produce both standards and observability public-package updates; the publication checkpoint must verify both exact candidates rather than silently publishing an unrelated pending package.

## Current official documentation and advisory evidence

All sources below were revalidated on 2026-08-10.

- [Cloudflare Workers Logs](https://developers.cloudflare.com/workers/observability/logs/workers-logs/) documents explicit `observability.enabled`, head sampling, invocation logs, and structured object logging.
- [Cloudflare Wrangler configuration](https://developers.cloudflare.com/workers/wrangler/configuration/) owns the generated configuration shape; [version metadata](https://developers.cloudflare.com/workers/runtime-apis/bindings/version-metadata/) provides the deployment-version binding; and [secrets](https://developers.cloudflare.com/workers/configuration/secrets/) requires credentials to use secret bindings rather than plaintext variables.
- [Cloudflare's Next.js guide](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/) and [OpenNext Cloudflare bindings](https://opennext.js.org/cloudflare/bindings) support current route handlers and adapter-scoped `getCloudflareContext` access.
- [Better Stack HTTP ingestion](https://betterstack.com/docs/logs/ingesting-data/http/logs/) documents source-specific HTTPS ingestion, bearer authorization, JSON/NDJSON payloads, `202` success, bounded record guidance, and failure statuses.
- [Better Stack's Next.js guide](https://betterstack.com/docs/logs/javascript/nextjs/) currently presents `@logtail/next@0.4.0`, a proxy route with a five-second failure-isolation timeout, and web-vitals reporting. Registry metadata confirms `0.4.0` was published 2026-07-17 and adds runtime dependencies plus broad Next/React/Node peer ranges.
- [Next.js instrumentation](https://nextjs.org/docs/app/guides/instrumentation) documents the stable async `onRequestError` hook; [instrumentation-client](https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation-client) runs before hydration and should remain lightweight; and [useReportWebVitals](https://nextjs.org/docs/app/api-reference/functions/use-report-web-vitals) requires a stable isolated client callback.
- [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/) documents OIDC trusted publishing, `id-token: write`, and automatic public-package provenance with current npm/Node versions. The existing release workflow already uses that boundary.
- The current OpenNext pin is `1.20.2`, above the `1.17.1` repair for [GHSA-c7mq-gh6q-6q7c](https://github.com/advisories/GHSA-c7mq-gh6q-6q7c). The current Next pin is `16.3.0`; the [Next.js security advisory index](https://github.com/vercel/next.js/security/advisories) was checked alongside the fresh registry audit. Exact-version range comparison and audit results are point-in-time evidence, not an assertion of vulnerability absence.

## Consolidated contradictions and blocking uncertainties

### Public-package release is a hard sequencing boundary

The generated repositories cannot consume unpublished observability behavior without violating the public-package and fixed-root verification contracts. Published `0.1.0` cannot be changed, and local-source aliases are expressly rejected.

**Resolution:** split execution at one explicit checkpoint. First produce and independently review the complete `@egeria-systems/observability` minor-release source candidate. Package versioning, commit integration to `main`, push, and publication require separate authority. Generated capability integration begins only after the exact public release is verified from the registry. The branch/worktree keeps a prepublication candidate from destabilizing clean `main`.

### Current release tooling describes the initial release

The release checker is intentionally hard-coded to the first two `0.1.0` packages and requires absent package histories. Those assertions are false for a subsequent release.

**Resolution:** do not weaken the existing safeguard speculatively in the source-candidate increment. The publication checkpoint owns a focused TDD update for the exact materialized candidate versions and requires existing package histories plus absent exact new versions. It must account for both pending Changesets.

### Better Stack's framework package conflicts with the narrow privacy boundary

The official integration exposes browser-oriented token configuration and adds runtime dependencies. The repository requires a replaceable provider-neutral contract, secrets in server bindings, and no hidden browser behavior.

**Resolution:** implement the public package with no runtime dependency. Use injected HTTP and structured-log transports, strict Better Stack host validation, server-held bearer credentials, bounded payloads, and content-safe outcomes. Generated browser telemetry will use a same-origin bounded route after publication. This follows the provider protocol without adopting its browser-token or dependency surface.

### Browser telemetry is necessarily public input

A portfolio has no authenticated user, so a same-origin browser telemetry route cannot prove caller identity. Direct browser ingestion would expose a source token and has the same abuse class.

**Resolution:** keep the later route same-origin, method/content-type/size/schema bounded, reconstruct events from an allowlist, never accept raw messages, stacks, URLs, headers, query data, or arbitrary attributes, and record residual flood/cost risk for certification and deployment controls. Do not invent a database, identity layer, rate-limit resource, or WAF policy in this increment.

### Capability certification must follow implementation

A material descriptor change cannot retain the current legacy exemption, but implementation approval does not authorize a protected-staging or provider run.

**Resolution:** the generated-integration batch will add an ordinary pending record and a separate exact certification plan. Certification execution, Better Stack source creation, Cloudflare secret changes, deployment, and cleanup remain externally gated.

No unresolved architecture contradiction blocks the local package source candidate.

## Claim limits and non-goals

The first reviewable increment proves public-package behavior against injected local adapters only. It does not prove Cloudflare runtime delivery, Better Stack acceptance, browser hooks, a generated project, deployment, production safety, ongoing provider availability, cost control, performance, accessibility, analytics separation in a running browser, or package publication. It makes no WCAG claim and changes no client-visible copy.

Later batches remain prohibited until their preceding gate is satisfied. No package publication, push, workflow dispatch, deployment, provider mutation, credential access, analytics enablement, or production action is performed by this preparation.
