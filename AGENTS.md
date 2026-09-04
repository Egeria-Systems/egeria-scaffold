# Repository Constitution

## Scope and authority

These instructions apply to the entire repository. Before changing files, read this document, the [approved source plan](docs/roadmaps/2026-08-04-nextjs-boilerplate-builder-best-reconciled-plan.md), the [architecture overview](docs/architecture/overview.md), the [capability model](docs/architecture/capability-model.md), the [program roadmap](docs/roadmaps/program-roadmap.md), every applicable accepted ADR, current implementation evidence, and any more-specific nested `AGENTS.md`.

Do not rely on conversation memory. Verify decisions against repository sources and current code. Accepted ADRs own architecture decisions; a newer accepted ADR may supersede an older one only through an explicit link. The approved source plan controls gaps not yet materialized in an ADR. If canonical sources conflict and ownership is unclear, stop and ask rather than silently choosing one.

Treat requests such as “implement the next logical increment,” “start the next increment,” and clear equivalents as entry into the complete [review and contribution protocol](docs/governance/review-and-contribution.md), which is the canonical owner of the implementation lifecycle. A generic request never approves an unseen plan or any later authority gate.

## Git and approval boundaries

- Preserve staged, unstaged, untracked, and committed user work. Never clean, reset, discard, or overwrite it without explicit authorization.
- Before Git work, verify the branch, status, and exact comparison scope. Fetch only when remote freshness materially affects the approved work.
- Development of this builder repository may proceed directly on clean `main` for one approved sequential implementation stream when repository protections permit it and isolation has no material safety or coordination benefit. Use a dedicated branch and isolated worktree when implementation becomes parallel or isolation is otherwise materially useful. Repository-changing builder commands that target generated client repositories always require clean state, a dedicated branch, and one isolated-worktree execution.
- Plan approval is not final-diff approval. Stop at every roadmap gate and obtain the specified approval.
- Never create a pull request unless explicitly asked. A request to implement does not authorize push, pull-request creation, merge, deployment, publication, permission changes, production actions, external messages, or responses to review comments.
- Use small focused commits named for their actual change. Do not use branch names, commit prefixes, file names, or user-facing Git labels prefixed with `codex`.

## Stage discipline

Implement only the approved increment. Future capabilities may be documented without creating their runtime code, packages, schemas, workflows, state, bindings, or provider resources. Do not create a production profile in P0.1, compatibility-proof functionality before P0.2, or builder packages before P0.3.

Prefer the smallest resilient change. Every changed line must trace to the approved increment or a directly required correction. Reuse existing patterns and avoid speculative abstractions, generic frameworks, and unrelated refactors.

## Functional programming discipline

Use a functional core and imperative shell. Keep domain transformations pure and function inputs immutable where practical, and confine side effects to scripts, adapters, composition roots, and other explicit boundaries. Prefer named function composition when it makes a multi-step transformation clearer. Use `map`, `filter`, `flatMap`, and `reduce` only when they express their actual collection semantics; never use `map` for side effects. Point-free style is optional, and explicit lambdas are preferred when they preserve parameter meaning, arity, or error context. `for...of`, local mutation, `Map`, `Set`, and stacks remain appropriate for early exit, ordered or asynchronous effects, graph traversal, cycle detection, and other stateful algorithms when they are clearer and safer than immutable copying or reducer-based encodings. Do not add a functional-programming runtime or lint preset solely to enforce syntax; adopt dependencies and rules only for an evidenced correctness or maintainability benefit.

## Semantic naming

Roadmap and implementation-sequencing labels describe order and provenance, not software responsibility. This includes compact phase labels such as `P2` or `PX` and named labels such as `Task 3` or `Task X`. They may appear only when sequencing or provenance is the actual subject: roadmap headings, task or approval-gate references, historical status, dated plans, implementation evidence, compatibility records, review packets, and explicitly phase-scoped invariants.

Do not use these labels in authored executable, configuration, workflow, test, fixture, template, generated content, or user-facing documentation, including comments and ordinary test or suite descriptions. Do not use them in filenames, directories, package-script or configuration keys, exported or internal identifiers, stable errors, schema identifiers or titles, CLI commands or flags, or generated paths. Name each surface for the responsibility or domain behavior it provides. Historical-document tests may construct a required label from neutral fragments while keeping their own descriptions, identifiers, and fixture names semantic.

[`scripts/check-semantic-naming.mjs`](scripts/check-semantic-naming.mjs) is the permanent repository contract for the canonical label grammar, allowed documentary paths, tracked and non-ignored untracked path enumeration, and authored-content scan. It scans user-facing Markdown by default while retaining the approved internal and provenance exemptions during program implementation. The [enforcement map](docs/architecture/enforcement-map.md) owns its gate mapping, and the [program roadmap](docs/roadmaps/program-roadmap.md) owns the end-of-program hardening boundary. Link those owners instead of copying the matcher, prefix data, or exemption list.

Do not add a temporary sequencing-labelled alias unless an approved compatibility migration names its real external consumer and exact removal gate. Rename a live surface and every direct consumer atomically under an approved plan.

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
- Use Node's test runner (`node --test`) for root governance, builder-core, CLI, standards, observability, capability-certification, and generated-fixture contracts. Run the owning package script, such as `pnpm run test:builder-core`, `pnpm run test:cli`, `pnpm run test:packages`, or `pnpm run test:capability-certification`, before the broader aggregate.
- Generated client unit and component behavior belongs to the generated Vitest projects: `pnpm --dir apps/web run test:unit` uses Node and `pnpm --dir apps/web run test:component` uses jsdom. Use Playwright only for real-browser development, OpenNext/workerd preview, or separately authorized deployed journeys.
- The compatibility proof uses Vitest for its unit boundary, `createTestHarness()` for Workers-runtime integration, and Playwright for development and preview browser behavior. It is evidence, not product architecture.
- `fast-check` is planned only with the later state/migration invariants that justify property testing. Workers Vitest is planned only when a capability owns concrete Workers bindings; do not introduce either runtime early.
- Run the smallest deterministic check during each cycle and the full relevant suite once after a coherent change batch. Do not repeat a successful expensive check against an unchanged tree.
- Use `pnpm run verify:builder-kernel` for the complete current builder-kernel candidate. Its committed portfolio/site fixtures are immutable inputs; the fixed-root verifier installs and builds only identity-bounded temporary copies.
- Use `pnpm run verify:generated-visuals` for the opt-in retained-project OpenNext/workerd screenshot comparisons. The [capability model](docs/architecture/capability-model.md#executable-visual-regression-boundary) owns the visual matrix, baseline-update, diagnostics, and retention policy.
- Screenshot equality does not establish visual quality, human accessibility, deployed behavior, production readiness, or WCAG conformance.
- Do not claim that Node, Vitest/jsdom, static, or build checks prove real-browser, workerd, deployment, visual, translation, accessibility-conformance, production-safety, or security properties they do not exercise.
- Before an increment is complete, dispatch independent read-only requirements, architecture and anti-overengineering, and test-evidence reviewers. Add a specialist only when the changed scope materially requires it.
- Validate every finding against the current tree. Repair only evidence-backed material defects, rerun affected verification, and record all dispositions.
- Produce a review packet listing the comparison, changed files, commands and results, reviewer dispositions, risks, deferred work, and rollback/recovery. Then stop for explicit user approval.

## Canonical owners and cohesion

Assign one canonical owner to every decision, schema, workflow, invariant, and lifecycle rule. Update the canonical owner and every direct consumer in the same focused change. Never copy normative rules across surfaces when a precise link is sufficient.

Keep profile names, capability identifiers, state terminology, ADR numbers, invariant IDs, approval gates, and phase names consistent across architecture, ADRs, roadmaps, tests, evidence, and review packets. When documentation and implementation disagree, identify the canonical owner before changing either. Do not treat documentation as authoritative merely because it exists.

The [review and contribution protocol](docs/governance/review-and-contribution.md) owns the implementation lifecycle. The [enforcement map](docs/architecture/enforcement-map.md) owns the mapping from invariants to actual or planned automated gates. [Package ownership](docs/architecture/package-ownership.md) owns package visibility, APIs, responsibility, consumers, and publication boundaries. Root and nested instructions should link to those owners instead of duplicating their full procedures.

The current P0.2 infrastructure proof lives under [`proofs/nextjs-cloudflare`](proofs/nextjs-cloudflare/AGENTS.md); read its nested instructions and the [compatibility record](docs/compatibility/nextjs-cloudflare.md) before changing that surface.

The current P0.3 builder boundaries have more-specific instructions for [`apps/cli`](apps/cli/AGENTS.md), [`packages/builder-core`](packages/builder-core/AGENTS.md), [`packages/standards`](packages/standards/AGENTS.md), and [`packages/observability`](packages/observability/AGENTS.md). Read the applicable boundary before changing it.
