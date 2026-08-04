# Repository Constitution

## Scope and authority

These instructions apply to the entire repository. Before changing files, read this document, the [approved source plan](docs/roadmaps/2026-08-04-nextjs-boilerplate-builder-best-reconciled-plan.md), the [architecture overview](docs/architecture/overview.md), the [capability model](docs/architecture/capability-model.md), the [program roadmap](docs/roadmaps/program-roadmap.md), every applicable accepted ADR, current implementation evidence, and any more-specific nested `AGENTS.md`.

Do not rely on conversation memory. Verify decisions against repository sources and current code. Accepted ADRs own architecture decisions; a newer accepted ADR may supersede an older one only through an explicit link. The approved source plan controls gaps not yet materialized in an ADR. If canonical sources conflict and ownership is unclear, stop and ask rather than silently choosing one.

## Git and approval boundaries

- Preserve staged, unstaged, untracked, and committed user work. Never clean, reset, discard, or overwrite it without explicit authorization.
- Before Git work, verify the branch, status, and exact comparison scope. Fetch only when remote freshness materially affects the approved work.
- Repository-changing builder commands require a clean Git state and execute once in an isolated worktree. P0.1 documentation work on `main` is a one-time, explicitly approved bootstrap exception and is not precedent for later increments or builder behavior.
- Plan approval is not final-diff approval. Stop at every roadmap gate and obtain the specified approval.
- Never create a pull request unless explicitly asked. A request to implement does not authorize push, pull-request creation, merge, deployment, publication, permission changes, production actions, external messages, or responses to review comments.
- Use small focused commits named for their actual change. Do not use branch names, commit prefixes, file names, or user-facing Git labels prefixed with `codex`.

## Stage discipline

Implement only the approved increment. Future capabilities may be documented without creating their runtime code, packages, schemas, workflows, state, bindings, or provider resources. Do not create a production profile in P0.1, compatibility-proof functionality before P0.2, or builder packages before P0.3.

Prefer the smallest resilient change. Every changed line must trace to the approved increment or a directly required correction. Reuse existing patterns and avoid speculative abstractions, generic frameworks, and unrelated refactors.

## Architecture invariants

- Profiles are versioned materialized recipes. Installed capabilities become authoritative immediately after generation.
- `portfolio` is a one-page public presence; `site` is a multi-page public website; public `app` materializes internal `app-foundation` by default.
- `app-foundation` adds backend-ready composition, request context, typed server errors, narrow provider-neutral ports, Cloudflare boundaries, and backend test infrastructure. It adds no database, queue, email provider, identity, payments, file storage, real-time infrastructure, or invented CRUD.
- Application persistence, Resend transactional email, background-job delivery, durable contact submissions, TOTP, passkeys, and Stripe payments remain independently selectable capabilities subject to declared dependencies.
- Presentation components are pure and receive typed data and callbacks. Domain and application code depend on narrow ports owned by the consuming boundary.
- Cloudflare types and bindings stay in Cloudflare adapters, generated configuration, integration tests, and composition roots. Semantic platform differences remain explicit.
- Never introduce a generic `PlatformService` or `ApplicationDatabase` port.
- Public packages remain ordinary replaceable dependencies. Extract a package only after the accepted evidence gate is met.
- Generated repositories remain lightweight pnpm workspaces with `apps/web`. Generate `apps/jobs` only for a concrete deployment, permission, failure, scaling, bundle, or ownership boundary.

## State and migrations

Capabilities declare delivery mode, state classifications, one removal policy, security metadata, managed surfaces, inference probes, migrations, verification, and removal/recovery requirements.

Repository-changing builder operations must infer current state, produce an approval-ready plan, transform once in isolation, verify, and re-infer. Only after those checks succeed may they update `.egeria` state and migration records and rerun state/inference verification. The resulting exact diff then requires verified-final-diff approval. Source, dependency, deployment, persistent-data, and provider rollback are separate domains.

## Copy, privacy, and accessibility

All user-visible or translatable copy originates from validated content or localization files. Domain and application code return stable identifiers rather than user-facing prose. Keep secrets, credentials, tokens, private data, recovery material, and unnecessary personal information out of source, logs, telemetry, evidence, and review packets.

Automated accessibility gates are mandatory. No WCAG conformance claim may be based only on automation. A human checklist is generated, but human evaluation gates release only when required by contract, procurement, an explicit risk decision, or a conformance claim.

Operational observability and selectable analytics are separate. Cloudflare Web Analytics is installed only through `analytics`, never through `observability`.

## Testing and review

- Use test-driven development: add a focused failing test, verify the expected RED state, implement the minimum change, and verify GREEN.
- Run the smallest deterministic check during each cycle and the full relevant suite once after a coherent change batch. Do not repeat a successful expensive check against an unchanged tree.
- Do not claim that static checks prove runtime, workerd, deployment, visual, translation, accessibility-conformance, production-safety, or security properties they do not exercise.
- Before an increment is complete, dispatch independent read-only requirements, architecture and anti-overengineering, and test-evidence reviewers. Add a specialist only when the changed scope materially requires it.
- Validate every finding against the current tree. Repair only evidence-backed material defects, rerun affected verification, and record all dispositions.
- Produce a review packet listing the comparison, changed files, commands and results, reviewer dispositions, risks, deferred work, and rollback/recovery. Then stop for explicit user approval.

## Canonical owners and cohesion

Assign one canonical owner to every decision, schema, workflow, invariant, and lifecycle rule. Update the canonical owner and every direct consumer in the same focused change. Never copy normative rules across surfaces when a precise link is sufficient.

Keep profile names, capability identifiers, state terminology, ADR numbers, invariant IDs, approval gates, and phase names consistent across architecture, ADRs, roadmaps, tests, evidence, and review packets. When documentation and implementation disagree, identify the canonical owner before changing either. Do not treat documentation as authoritative merely because it exists.

The [review and contribution protocol](docs/governance/review-and-contribution.md) owns the implementation lifecycle. The [enforcement map](docs/architecture/enforcement-map.md) owns the mapping from invariants to actual or planned automated gates. Root and nested instructions should link to those owners instead of duplicating their full procedures.
