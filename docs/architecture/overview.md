# Architecture Overview

**Status:** Controlling architecture summary for the approved P1 builder kernel and in-progress P2 portfolio

**Source:** [Approved reconciled program plan](../roadmaps/2026-08-04-nextjs-boilerplate-builder-best-reconciled-plan.md)

Accepted [ADRs](../adr/README.md) own individual decisions. This overview explains how those decisions fit together; it does not replace them. The [enforcement map](enforcement-map.md) owns automation status, [package ownership](package-ownership.md) owns the exact package matrix and publication boundaries, and the [Next.js and Cloudflare compatibility record](../compatibility/nextjs-cloudflare.md) owns the current executable proof matrix and evidence boundary.

## Product model

Profiles are versioned materialized recipes. A selected profile resolves to explicit installed capabilities; that installed capability manifest becomes authoritative immediately after generation. Profiles do not remain live parents, and later edits to a recipe do not silently mutate existing projects.

### Public profiles

- `portfolio` is a static-first, principally one-page public presence. It excludes persistence, queues, forms, identity, CMS, payments, business CRUD, and real-time behavior by default.
- `site` is a conventional multi-page public website. It adds routes, navigation, page metadata, content composition, and migration support without becoming stateful merely because it has multiple pages.
- `app` is a backend-ready public profile without customer identity. Its default recipe is exactly:

```text
app = app-foundation
```

  Persistence, email, jobs, durable contact submissions, booking webhooks, and payments remain independent selections.
- `authenticated-app` is an individual-account application recipe. It materializes `app-foundation`, application persistence, Resend transactional email, Better Auth verified email/password, Google sign-in, protected routes, account-profile behavior, and a narrow support console. TOTP, passkeys, payments, durable contact submissions, jobs, and CMS remain independent.

### Internal app foundation

`app-foundation` establishes server composition roots, route-handler and server-action conventions, request context, typed server errors, stable application-facing error categories, environment separation, provider-neutral port conventions, Cloudflare adapter boundaries, backend tests, and health/build information.

It adds no database, queue, transactional-email provider, identity, payments, file storage, real-time infrastructure, or invented business CRUD.

## Application flow

```text
Pure presentation components
        ↓
Delivery and orchestration
Next routes, route handlers, and server actions
        ↓
Application use cases
        ↓
Domain policies and narrow consuming-boundary-owned ports
        ↑
Infrastructure and provider adapters
        ↑
Composition roots
Cloudflare bindings and concrete providers
```

Pure presentation components receive typed data and callbacks; they do not discover dependencies. Delivery code translates framework concerns into application commands. Use cases coordinate behavior and side effects. Domain policies remain pure where practical.

Expected failures use stable discriminated results or stable error identifiers. UI and delivery code map those identifiers to localized copy. Provider failures are normalized at their consuming boundary.

Ports describe domain needs, for example `ContentRepository`, `ContactSubmissionRepository`, `TransactionalEmailSender`, `JobDispatcher`, `AccountProfileRepository`, `BillingGateway`, `StructuredLogger`, and `RuntimeConfigurationReader`. No generic `PlatformService` or `ApplicationDatabase` port may hide incompatible semantics.

## Platform boundary

Cloudflare is the only initial production adapter. Cloudflare types, bindings, runtime APIs, and Workerd-specific behavior stay in Cloudflare infrastructure adapters, generated Wrangler/OpenNext configuration, Cloudflare integration tests, and composition roots. They do not enter presentation, content, domain, application use cases, or provider-neutral contracts.

Adapters declare the semantics they actually provide: transactions, conditional writes, streaming, queues, background execution, local emulation, metadata, preview behavior, and environment isolation. A difference that cannot be normalized safely remains explicit.

In-memory adapters and shared behavioral contract tests are required where ports become executable. They improve isolation and portability but do not imply support for a second production platform.

## Builder repository boundary

`apps/*` contains builder applications. `proofs/*` contains disposable infrastructure evidence and is not a product-application namespace. `packages/*` contains deliberately owned packages created only at an approved package-boundary stage.

P0.1 created none of those paths. P0.2 created only the separately scoped private proof at [`proofs/nextjs-cloudflare`](../../proofs/nextjs-cloudflare/). P0.3 has materialized a private CLI shell, private builder-core shell, public standards package, public observability shell, and local release safeguards. P0.3 is complete; [package ownership](package-ownership.md) is the canonical owner of their exact visibility, APIs, consumers, and publication guards.

P1 is the first executable project/state schema stage. Its approved implementation places schemas, resolution, codecs, ownership, inference, diagnostics, rendering, and state-last new-directory generation inside the already-private `builder-core` boundary. The private CLI remains a thin adapter over those policies. Committed portfolio and site fixtures provide exact generated-output evidence without becoming runtime packages.

`builder-core` is justified by cohesive private responsibilities: capability resolution, manifest/state schemas, inference, ownership, planning, migrations, repository transformation, and verification. Reserving that ownership in P0.3 does not implement the schemas early. A separate `project-schema` package is not justified until a second consumer requires an independently versioned contract.

Public packages remain ordinary dependencies. Public availability does not remove versioning, bundle, debugging, security, migration, or coordinated-release costs. Extraction requires concrete consumers or a true runtime/security boundary, a stable API, independent lifecycle value, contract tests, ownership, migration policy, and evidence that packaging costs less than local code.

## Generated repository boundary

Generated repositories are lightweight pnpm workspaces with `apps/web`. Application behavior stays in cohesive modules under `apps/web` until a separate runtime, release boundary, or proven reuse justifies extraction. Local `packages/` may remain absent.

Generated Next.js projects retain ESLint `9.39.5` while the selected Next plugin dependency graph does not support ESLint 10. This is a compatibility boundary, not a permanent version policy: revalidate the selected Next and plugin graph before changing majors. The builder repository's independent ESLint 10 use and standards' dual-major support do not migrate the accepted P0.2 proof.

`apps/jobs is generated only` when a concrete OpenNext limitation, independent deployment, permission isolation, failure isolation, materially different scaling, bundle boundary, or operational owner justifies another Worker. Selecting a queue does not automatically create it.

All user-visible or translatable copy originates from validated content or localization files. The generated source registry currently binds `hero`, `text`, `project-list`, and `call-to-action` content schemas to pure presentation components, profile support, variants, accessibility requirements, analytics declarations, and migration hooks. Content may configure only those registered typed sections; it cannot inject executable JSX, JavaScript, CSS, imports, or arbitrary component trees. The generated `section-composition` capability owns Tailwind CSS and PostCSS package properties, PostCSS configuration, semantic design tokens, responsive presentation source, and the global stylesheet. The `content-files` capability owns validated externalized skip-navigation copy. The hybrid `standards` capability owns generated Playwright/axe packages and scripts, environment-specific configuration, a content-agnostic starter specification, and the read-only quality workflow while retaining the ordinary public standards package. Browser automation is bounded evidence; it does not establish visual quality, assistive-technology behavior, human usability, or accessibility conformance.

## State and lifecycle

Desired state lives in human-reviewable `.egeria/project.yaml`; installed resolved state in generator-owned `.egeria/state.json`; successful migration and reconciliation history in append-only `.egeria/migrations.jsonl`. New-directory generation writes all three only inside an identity-recorded temporary source, verifies the copy, confirms post-state inference, and commits the destination with one rename. Existing-repository mutation and migration history remain deferred.

Repository-changing builder operations require clean state, inference, capability resolution, an isolated worktree, an approval-ready dry-run plan, one execution, verification, and post-change inference. State and migration records update only after those checks succeed; state/inference verification then runs again. The resulting exact diff and review packet require verified-final-diff approval before commit. Source, dependencies, deployment, persistent data, and provider state have separate rollback procedures.

## Current stage boundary

P0.1 created the constitution and architecture surfaces. P0.2 added private, non-production infrastructure evidence and its exact toolchain. P0.3 established the builder package and release boundaries. P1 is approved with executable schemas, six capability descriptors, portfolio/site recipes, read-only inspection, new-directory generation, committed golden fixtures, and a fixed-root isolated verification harness. P2 is in progress: the actual builder now emits versioned validated YAML/Markdown content, enforces static visible-copy externalization in canonical templates, materializes a bounded source-owned section registry, generates a responsive Tailwind interface with semantic design tokens, focus/reflow foundations, and externalized skip-navigation copy, and generates the browser-quality foundation for portfolio and site. Local browser certification and review remain open for the current increment. Calendly and later client-ready outcomes remain separately gated. Existing-repository changes, transactional migrations, later profiles/capabilities, provider actions, live deployment, hosted-CI proof, visual assessment, human evaluation, production readiness, and accessibility-conformance claims remain outside the accepted baseline.
