# Architecture Overview

**Status:** Controlling P0.1 architecture summary

**Source:** [Approved reconciled program plan](../roadmaps/2026-08-04-nextjs-boilerplate-builder-best-reconciled-plan.md)

Accepted [ADRs](../adr/README.md) own individual decisions. This overview explains how those decisions fit together; it does not replace them. The [enforcement map](enforcement-map.md) owns automation status.

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

The intended builder workspace is:

```text
apps/cli                  thin command input/output
packages/builder-core     private builder internals and project/state schemas
packages/standards        public replaceable standards package
packages/observability    public replaceable observability package
```

P0.1 creates none of those paths. P0.2 creates only the separately scoped compatibility proof. P0.3 may create the listed builder boundaries after its own approved plan.

`builder-core` is justified by cohesive private responsibilities: capability resolution, manifest/state schemas, inference, ownership, planning, migrations, repository transformation, and verification. A separate `project-schema` package is not justified until a second consumer requires an independently versioned contract.

Public packages remain ordinary dependencies. Public availability does not remove versioning, bundle, debugging, security, migration, or coordinated-release costs. Extraction requires concrete consumers or a true runtime/security boundary, a stable API, independent lifecycle value, contract tests, ownership, migration policy, and evidence that packaging costs less than local code.

## Generated repository boundary

Generated repositories are lightweight pnpm workspaces with `apps/web`. Application behavior stays in cohesive modules under `apps/web` until a separate runtime, release boundary, or proven reuse justifies extraction. Local `packages/` may remain absent.

`apps/jobs is generated only` when a concrete OpenNext limitation, independent deployment, permission isolation, failure isolation, materially different scaling, bundle boundary, or operational owner justifies another Worker. Selecting a queue does not automatically create it.

All user-visible or translatable copy originates from validated content or localization files. Content may configure only registered, typed sections; it cannot inject executable JSX, JavaScript, CSS, imports, or arbitrary component trees.

## State and lifecycle

Desired state will live in human-reviewable `.egeria/project.yaml`; installed resolved state in generator-owned `.egeria/state.json`; successful migration and reconciliation history in append-only `.egeria/migrations.jsonl`. None is created before P1.

Repository-changing builder operations require clean state, inference, capability resolution, an isolated worktree, an approval-ready dry-run plan, one execution, verification, post-change inference, a verified-final-diff approval, and state updates last. Source, dependencies, deployment, persistent data, and provider state have separate rollback procedures.

## P0.1 boundary

No production profile is implemented in P0.1. This increment creates no application, builder package, profile code, `.egeria` state or schema, lockfile, dependency, workflow, Cloudflare resource, or deployment. Future behavior in these documents is architecture visibility, not shipped functionality.
