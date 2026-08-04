# P0.1 Constitution and ADRs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create the repository constitution, private root pnpm workspace, architecture overview, roadmap, eleven accepted ADRs, review protocol, and dependency-free enforcement tests without implementing a production profile or speculative runtime package.

**Architecture:** The repository remains documentation-first in P0.1. Canonical architecture and governance live in small Markdown documents linked from a substantive root `AGENTS.md`; a dependency-free Node.js contract test verifies their presence, decision coverage, ADR shape, and the deliberately empty runtime/package surface. Node.js is pinned to `22.23.0` through Volta by explicit user decision; exact framework and package versions remain candidates until P0.2 proves them under Next development, workerd preview, integration tests, accessibility smoke tests, and a non-production deployment.

**Tech Stack:** Markdown, JSON, YAML, Git, a private pnpm workspace, and the Node.js built-in test runner. P0.1 installs no third-party packages and creates no application or public package.

## Global Constraints

- Profiles are versioned materialized recipes; installed capabilities become authoritative immediately after generation.
- `portfolio` is one-page, `site` is multi-page, and public `app` materializes internal `app-foundation` by default.
- `app-foundation` adds backend-ready boundaries but no database, queue, email provider, identity, payments, file storage, real-time infrastructure, or invented CRUD.
- `application-persistence`, `transactional-email-resend`, `background-job-delivery`, and `durable-contact-submissions` remain independent capabilities.
- `authenticated-app` materializes `app-foundation`, application persistence, Resend email, Better Auth email/password, Google sign-in, protected routes, account-profile behavior, and a narrow support console.
- TOTP and passkeys remain independent scaffold-time and later-addable capabilities.
- `payments-stripe` remains independent and supports `one-time`, `subscriptions`, or `both`.
- Cloudflare Web Analytics is installed only through `analytics`, never through `observability`.
- Generated repositories are lightweight pnpm workspaces with `apps/web`; `apps/jobs` appears only when separately justified.
- Builder project and state schemas remain inside private `packages/builder-core` initially; no `project-schema` package is created.
- Cloudflare types and bindings stay in platform adapters and composition roots.
- Presentation is pure and receives typed data and callbacks; domain and application code depend on narrow consuming-boundary-owned ports.
- No generic `PlatformService` or `ApplicationDatabase` port is permitted.
- Semantic platform differences remain explicit.
- Every capability declares delivery mode, state classifications, one removal policy, security metadata, managed surfaces, inference probes, migrations, and verification.
- Public packages are ordinary replaceable dependencies, and extraction requires evidence.
- Repository-changing builder commands require a clean Git state and isolated worktree.
- By explicit approval, P0.1 repository-constitution development runs directly on clean `main`; this one-time bootstrap exception does not apply to builder commands or later increments.
- Plan approval and verified-final-diff approval are separate gates.
- `.egeria` state changes only after transformation, verification, and post-change inference succeed.
- Persistent-data and provider rollback remain separate from source rollback.
- All user-visible or translatable copy is externalized.
- Automated accessibility gates are mandatory, but automation cannot support a WCAG conformance claim by itself. Human review is not a default release gate unless separately required.
- GitHub Actions is the sole deployment authority. P0.1 performs no deployment.
- P0.1 creates no `apps/**`, `packages/**`, `.egeria/**`, lockfile, dependency, generated application, profile implementation, workflow, or Cloudflare resource.
- No commit, push, pull request, merge, deployment, publication, or external-system change occurs unless its specific gate is authorized.

## Approved Reconciliation Decisions

Plan approval also approves these normalizations of contradictions in the source plan:

1. Replace singular composite state labels with `stateClassifications`, a non-empty set whose members are only `stateless`, `repository-stateful`, `external-stateful`, or `persistent-data`. Privileged behavior belongs in security metadata, not state classification.
2. Keep exactly one `removalPolicy`: `automatic`, `reviewed`, `export-and-remove`, `eject-only`, or `unsupported`. Provider cleanup, operational reversal, and data recovery are separate metadata and procedures.
3. Normalize delivery labels to exactly `package-backed`, `source-generated`, or `hybrid`; “public package” is an ownership/publication fact rather than another delivery mode.
4. Preserve the strict action boundary: plan approval does not authorize pull-request creation, merge, push, publication, or deployment.
5. Treat “accessibility review complete” as the automated and policy-required evidence for the selected scope, not an implicit conformance claim or universal human-release gate.
6. Pin Node.js `22.23.0` through the root manifest's Volta configuration. Treat this as the approved P0.1 development pin; P0.2 still owns deployed compatibility proof.
7. Ignore the missing repository-external `/Users/CoveMB/.codex/RTK.md`. Root `AGENTS.md` must be self-contained and must not depend on personal machine instructions.
8. Execute P0.1 directly on clean `main` as explicitly approved. Preserve isolated-worktree requirements as permanent builder behavior and the default for later implementation increments.

## Execution Test Amendment

The phrase-presence assertions shown in Tasks 2 and 3 were useful during initial RED/GREEN authoring but are not retained in the final suite. The required test-design guidance classifies human-prose grep assertions as change detectors rather than behavioral protection. Before independent review, replace them with a real local Markdown-link integrity test, retain the workspace and ADR-structure contracts, and rely on the three independent reviewers for semantic requirements and architecture evaluation. Record the original RED/GREEN cycles and the final test design honestly in verification evidence.

## Exact File Map

Preparation artifacts already created and unchanged during implementation:

- `docs/roadmaps/2026-08-04-nextjs-boilerplate-builder-best-reconciled-plan.md` — byte-for-byte approved source plan.
- `docs/implementation-evidence/2026-08-04-p0-1-constitution-preparation.md` — repository, official-documentation, advisory, contradiction, and toolchain evidence.
- `docs/superpowers/plans/2026-08-04-p0-1-constitution-and-adrs.md` — this approved execution plan.

Files created by P0.1 implementation:

- `.gitignore` — dependency, local environment, coverage, and editor exclusions.
- `package.json` — private dependency-free workspace root, Volta Node.js `22.23.0` pin, and constitution test scripts.
- `pnpm-workspace.yaml` — future `apps/*` and `packages/*` workspace boundaries without creating either directory.
- `README.md` — repository purpose, current phase, canonical-document index, and explicit non-goals.
- `AGENTS.md` — substantive, self-contained repository constitution with cohesion/drift rules and links to canonical owners.
- `CONTRIBUTING.md` — contributor entry point that delegates the normative lifecycle to one governance document.
- `docs/governance/review-and-contribution.md` — canonical approval, Git, TDD, reviewer, verification, review-packet, and external-action protocol.
- `docs/architecture/overview.md` — builder and generated-repository architecture, application layers, portability boundaries, and current P0.1 scope.
- `docs/architecture/capability-model.md` — profiles, capability descriptors, catalog, normalized state/removal model, and package boundaries.
- `docs/architecture/enforcement-map.md` — invariant IDs mapped to current or planned automated gates and their owning phase.
- `docs/roadmaps/program-roadmap.md` — concise executable P0 through P10 sequence, prerequisites, exits, and stop gates.
- `docs/adr/README.md` — ordered ADR index and status definitions.
- `docs/adr/0001-materialized-profile-recipes.md` — profiles materialize capabilities and do not remain live parents.
- `docs/adr/0002-capability-delivery-and-state.md` — delivery modes, state classifications, and removal metadata.
- `docs/adr/0003-hybrid-ownership.md` — managed, application-owned, merged, and ejected surfaces.
- `docs/adr/0004-cloudflare-isolation.md` — Cloudflare types only at adapters and composition roots.
- `docs/adr/0005-evidence-driven-package-extraction.md` — private `builder-core`, public package gate, and no initial schema package.
- `docs/adr/0006-egeria-state-files.md` — roles and ownership of `.egeria/project.yaml`, `state.json`, and `migrations.jsonl`.
- `docs/adr/0007-transactional-repository-migrations.md` — clean-state gate, isolated execution, two approvals, update ordering, and rollback domains.
- `docs/adr/0008-copy-externalization.md` — externalized user-visible copy and stable application error identifiers.
- `docs/adr/0009-accessibility-evidence-and-claims.md` — mandatory automation, human checklist, conditional human gate, and claim prohibition.
- `docs/adr/0010-analytics-and-observability.md` — operational telemetry separated from selectable analytics.
- `docs/adr/0011-github-actions-deployment-authority.md` — sole deployment authority, environment separation, approvals, and no production self-authorization.
- `tests/constitution/constitution.test.mjs` — dependency-free executable constitution contract.
- `docs/implementation-evidence/2026-08-04-p0-1-constitution-verification.md` — final commands, results, environment limitations, and source hashes.
- `docs/review-packets/2026-08-04-p0-1-constitution-and-adrs.md` — changed files, review results, verification, risks, deferred work, and recovery.

No other file is in scope.

---

### Task 0: Confirm the approved main-branch bootstrap and amendments

**Files:**

- Modify: `docs/implementation-evidence/2026-08-04-p0-1-constitution-preparation.md`
- Modify: `docs/superpowers/plans/2026-08-04-p0-1-constitution-and-adrs.md`
- Verify unchanged: `docs/roadmaps/2026-08-04-nextjs-boilerplate-builder-best-reconciled-plan.md`

**Interfaces:**

- Consumes: User-created bootstrap commit `98ff2f4`, explicit P0.1 main-branch approval, the Volta Node.js pin, and the self-contained `AGENTS.md` requirement.
- Produces: A clean approved `main` execution base with permanent builder isolation rules preserved for later implementation.

- [ ] **Step 1: Verify the user-created bootstrap commit**

Run:

```bash
git status --short --branch
git branch --show-current
git show --stat --oneline HEAD
```

Expected: clean `main` at commit `98ff2f4`, containing only the approved source plan, preparation evidence, and implementation plan. Stop if any unrelated work appears.

- [ ] **Step 2: Record the explicit execution amendments**

Update this plan and preparation evidence to state:

- P0.1 implementation is explicitly approved directly on clean `main`;
- this is not a precedent for repository-changing builder commands or later increments;
- `package.json` pins Node.js `22.23.0` through `volta.node`;
- root `AGENTS.md` is substantive, self-contained, and owns cohesion/drift rules;
- the missing personal `RTK.md` include is ignored and never becomes a repository dependency.

- [ ] **Step 3: Revalidate the approved source copy**

Run:

```bash
shasum -a 256 docs/roadmaps/2026-08-04-nextjs-boilerplate-builder-best-reconciled-plan.md
```

Expected:

```text
f8d3f7db149f18c28ac3c6e41781405e3661c4a5ab710ee28290b184864c1027
```

- [ ] **Step 4: Commit only the approved amendments**

Run:

```bash
git add docs/implementation-evidence/2026-08-04-p0-1-constitution-preparation.md docs/superpowers/plans/2026-08-04-p0-1-constitution-and-adrs.md
git diff --cached --check
git diff --cached --stat
git commit -m "docs: record approved P0.1 amendments"
```

Expected: one focused amendment commit on `main`. No branch, worktree, push, pull request, or external action is created.

---

### Task 1: Establish the private dependency-free pnpm workspace contract

**Files:**

- Create: `.gitignore`
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `tests/constitution/constitution.test.mjs`

**Interfaces:**

- Consumes: Node.js built-in modules only.
- Produces: Root script `test:constitution` and workspace globs `apps/*` and `packages/*`; no dependency, lockfile, application, or package.

- [ ] **Step 1: Write the failing workspace contract test**

Create `tests/constitution/constitution.test.mjs` with:

```js
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const repositoryRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../..",
);

async function readRepositoryFile(relativePath) {
  return readFile(resolve(repositoryRoot, relativePath), "utf8");
}

test("the root workspace is private and dependency-free in P0.1", async () => {
  const manifest = JSON.parse(await readRepositoryFile("package.json"));

  assert.equal(manifest.name, "@egeria-systems/scaffold");
  assert.equal(manifest.private, true);
  assert.equal(manifest.scripts.test, "pnpm run test:constitution");
  assert.equal(
    manifest.scripts["test:constitution"],
    "node --test tests/constitution/constitution.test.mjs",
  );
  assert.equal("dependencies" in manifest, false);
  assert.equal("devDependencies" in manifest, false);
  assert.equal("packageManager" in manifest, false);
  assert.equal("engines" in manifest, false);
  assert.deepEqual(manifest.volta, { node: "22.23.0" });
});

test("the workspace declares only the approved future package roots", async () => {
  const workspace = await readRepositoryFile("pnpm-workspace.yaml");

  assert.equal(
    workspace,
    'packages:\n  - "apps/*"\n  - "packages/*"\n',
  );
});
```

- [ ] **Step 2: Run the test to verify the RED state**

Run:

```bash
node --test tests/constitution/constitution.test.mjs
```

Expected: failure with `ENOENT` for `package.json`.

- [ ] **Step 3: Create the minimal root files**

Create `package.json` with:

```json
{
  "name": "@egeria-systems/scaffold",
  "version": "0.0.0",
  "private": true,
  "description": "Builds versioned materialized Next.js recipes for Egeria Systems projects.",
  "scripts": {
    "test": "pnpm run test:constitution",
    "test:constitution": "node --test tests/constitution/constitution.test.mjs"
  },
  "volta": {
    "node": "22.23.0"
  }
}
```

Create `pnpm-workspace.yaml` with:

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

Create `.gitignore` with:

```gitignore
node_modules/
.pnpm-store/
coverage/
*.log
.DS_Store
.env
.env.*
!.env.example
.worktrees/
```

The absent `packageManager` and `engines` fields are deliberate: P0.2 owns package-manager and deployed compatibility selection. The Volta pin is the user-approved P0.1 Node.js development runtime. Do not create a lockfile or run an install in P0.1.

- [ ] **Step 4: Run the tests to verify GREEN**

Run:

```bash
node --test tests/constitution/constitution.test.mjs
pnpm run test:constitution
node --version
```

Expected: both test commands pass and Volta resolves `node --version` to `v22.23.0`. Record the pnpm version without describing it as the selected compatibility pair.

- [ ] **Step 5: Commit the workspace contract**

Run:

```bash
git add .gitignore package.json pnpm-workspace.yaml tests/constitution/constitution.test.mjs
git diff --cached --check
git commit -m "build: initialize private pnpm workspace"
```

---

### Task 2: Define repository governance and action boundaries

**Files:**

- Create: `README.md`
- Create: `AGENTS.md`
- Create: `CONTRIBUTING.md`
- Create: `docs/governance/review-and-contribution.md`
- Modify: `tests/constitution/constitution.test.mjs`

**Interfaces:**

- Consumes: The approved source roadmap and current repository instructions.
- Produces: One canonical lifecycle protocol referenced by concise root entry points.

- [ ] **Step 1: Add a failing governance-document contract**

Append to `tests/constitution/constitution.test.mjs`:

```js
const governanceDocuments = {
  "README.md": [
    "P0.1 — Constitution and ADRs",
    "No production profile is implemented",
    "docs/architecture/overview.md",
    "docs/roadmaps/program-roadmap.md",
  ],
  "AGENTS.md": [
    "Plan approval is not final-diff approval",
    "Never create a pull request unless explicitly asked",
    "Cloudflare types and bindings",
    "No WCAG conformance claim",
    "Canonical owners and cohesion",
    "Update the canonical owner and every direct consumer",
  ],
  "CONTRIBUTING.md": [
    "docs/governance/review-and-contribution.md",
    "docs/architecture/enforcement-map.md",
  ],
  "docs/governance/review-and-contribution.md": [
    "Gate 1: preparation evidence",
    "Gate 2: implementation-plan approval",
    "Gate 3: verified-final-diff approval",
    "Requirements reviewer",
    "Architecture and anti-overengineering reviewer",
    "Test-evidence reviewer",
    "Pull-request creation requires a separate explicit request",
  ],
};

test("governance documents preserve the approval and action boundaries", async () => {
  for (const [relativePath, requiredFragments] of Object.entries(
    governanceDocuments,
  )) {
    const document = await readRepositoryFile(relativePath);

    for (const fragment of requiredFragments) {
      assert.match(document, new RegExp(fragment.replaceAll("/", "\\/")));
    }
  }
});
```

- [ ] **Step 2: Run the focused test to verify RED**

Run:

```bash
node --test --test-name-pattern="governance documents" tests/constitution/constitution.test.mjs
```

Expected: failure with `ENOENT` for `README.md`.

- [ ] **Step 3: Create the root entry points**

Create `README.md` with these sections and exact scope statements:

- `# Egeria Scaffold`
- `## Current phase: P0.1 — Constitution and ADRs`
- “No production profile is implemented in P0.1.”
- Canonical links to the source plan, architecture overview, capability model, enforcement map, program roadmap, ADR index, governance protocol, evidence, and review packets.
- `## Deferred to P0.2` listing exact toolchain selection, Next.js proof, OpenNext/workerd preview, generated bindings, tests, accessibility smoke, and non-production deployment.
- `## Deferred to P0.3` listing `apps/cli`, private `builder-core`, public `standards`, public observability shell, and release tooling.

Create root `AGENTS.md` with these normative sections:

1. `Scope and authority`: read this file, the source roadmap, architecture docs, accepted ADRs, applicable nested `AGENTS.md`, and current evidence before edits; accepted ADRs own decisions and newer accepted ADRs supersede older ones.
2. `Git and approvals`: preserve user work; verify branch/status/scope; implementation runs in a clean isolated worktree; plan approval is not final-diff approval; no push, pull request, merge, deployment, publication, external message, or review-comment response without its explicit request.
3. `Stage discipline`: implement only the approved increment and do not create future profiles, capabilities, packages, schemas, workflows, or resources early.
4. `Architecture`: repeat the Cloudflare boundary, pure presentation, narrow consuming-boundary ports, no generic platform/database ports, explicit semantics, and evidence-driven extraction rules.
5. `State and migrations`: repeat update ordering and rollback-domain separation.
6. `Copy and accessibility`: externalize user-visible/translatable copy; require automated gates; prohibit automation-only conformance claims; keep human review conditional.
7. `Testing and review`: TDD, smallest relevant checks, one full relevant suite on the final tree, the three independent reviewer scopes required by the program, evidence-backed material repairs only, and a review packet before the stop gate.
8. `Canonical owners and cohesion`: identify one owner for each decision, schema, workflow, and invariant; update the canonical owner and every direct consumer in the same focused change; never copy normative rules when a precise link is sufficient; stop when documentation and implementation conflict and ownership is unclear; keep terminology and identifiers consistent across architecture, ADR, roadmap, tests, evidence, and review packets.
9. Canonical links to `docs/governance/review-and-contribution.md` and `docs/architecture/enforcement-map.md` instead of duplicating their full procedures.

The file must be self-contained and must not reference `/Users/CoveMB/.codex/RTK.md`, another personal path, conversation memory, or machine-local policy.

Create `CONTRIBUTING.md` as a concise entry point containing:

- prerequisite reading links;
- the three approval gates;
- the command `pnpm run test:constitution`;
- the rule that enforcement ownership lives in `docs/architecture/enforcement-map.md`;
- the rule that the lifecycle details live only in `docs/governance/review-and-contribution.md`.

- [ ] **Step 4: Create the canonical review and contribution protocol**

Create `docs/governance/review-and-contribution.md` with these ordered phases:

1. Scope freeze and source inspection.
2. Gate 1: preparation evidence and consolidated contradiction batch.
3. Gate 2: exact-file implementation-plan approval.
4. Clean-state and isolated-worktree setup.
5. TDD and small focused commits.
6. Required independent read-only reviewers: requirements; architecture and anti-overengineering; test evidence. Add a specialist only when changed scope requires it.
7. Controller validation and repair of only current, evidenced, material findings.
8. Final deterministic verification and final-tree inspection.
9. Review packet with changed files, commands/results, risks, deferred work, and rollback/recovery.
10. Gate 3: verified-final-diff approval.
11. Separate explicit authority for push, pull request, merge, publication, non-production deployment, production deployment, persistent-data migration, provider changes, and external messaging.

State explicitly that plan approval does not approve the final diff, a reviewer cannot authorize edits or external action, pull-request creation requires a separate explicit request, and production deployment cannot be self-approved.

- [ ] **Step 5: Run the governance and full contract tests**

Run:

```bash
node --test --test-name-pattern="governance documents" tests/constitution/constitution.test.mjs
pnpm run test:constitution
```

Expected: both commands pass.

- [ ] **Step 6: Commit governance**

Run:

```bash
git add README.md AGENTS.md CONTRIBUTING.md docs/governance/review-and-contribution.md tests/constitution/constitution.test.mjs
git diff --cached --check
git commit -m "docs: define review and contribution protocol"
```

---

### Task 3: Materialize the architecture, capability model, roadmap, and enforcement ownership

**Files:**

- Create: `docs/architecture/overview.md`
- Create: `docs/architecture/capability-model.md`
- Create: `docs/architecture/enforcement-map.md`
- Create: `docs/roadmaps/program-roadmap.md`
- Modify: `tests/constitution/constitution.test.mjs`

**Interfaces:**

- Consumes: The authoritative product model and approved reconciliation decisions.
- Produces: Canonical architecture terms and invariant identifiers consumed by ADRs and later automated gates.

- [ ] **Step 1: Add a failing architecture coverage contract**

Append to `tests/constitution/constitution.test.mjs`:

```js
const architectureCoverage = {
  "docs/architecture/overview.md": [
    "Profiles are versioned materialized recipes",
    "app = app-foundation",
    "Pure presentation components",
    "No generic `PlatformService`",
    "apps/jobs is generated only",
    "No production profile is implemented in P0.1",
  ],
  "docs/architecture/capability-model.md": [
    "type CapabilityDeliveryMode",
    "stateClassifications",
    "removalPolicy",
    "application-persistence",
    "transactional-email-resend",
    "background-job-delivery",
    "durable-contact-submissions",
    "identity-2fa",
    "identity-passkeys",
    "payments-stripe",
  ],
  "docs/architecture/enforcement-map.md": [
    "INV-PROFILE-MATERIALIZATION",
    "INV-CLOUDFLARE-ISOLATION",
    "INV-COPY-EXTERNALIZATION",
    "INV-ACCESSIBILITY-CLAIMS",
    "INV-DEPLOYMENT-AUTHORITY",
    "planned",
  ],
  "docs/roadmaps/program-roadmap.md": [
    "P0.1 — Constitution and ADRs",
    "P0.2 — Deployed compatibility proof",
    "P0.3 — Lean builder monorepo",
    "P2 — Client-ready portfolio",
    "P10 — Fleet hardening",
    "Stop gate",
  ],
};

test("architecture and roadmap cover every authoritative program decision", async () => {
  for (const [relativePath, requiredFragments] of Object.entries(
    architectureCoverage,
  )) {
    const document = await readRepositoryFile(relativePath);

    for (const fragment of requiredFragments) {
      assert.ok(
        document.includes(fragment),
        `${relativePath} must include: ${fragment}`,
      );
    }
  }
});
```

- [ ] **Step 2: Run the focused test to verify RED**

Run:

```bash
node --test --test-name-pattern="architecture and roadmap" tests/constitution/constitution.test.mjs
```

Expected: failure with `ENOENT` for `docs/architecture/overview.md`.

- [ ] **Step 3: Create the architecture overview**

Create `docs/architecture/overview.md` with:

- Document authority and P0.1 scope.
- Product profile definitions for `portfolio`, `site`, `app`, and `authenticated-app`, with `app = app-foundation` shown exactly and stateful capabilities excluded from default `app`.
- Application flow: pure presentation → delivery/orchestration → application use cases → domain/narrow ports ← adapters ← composition roots.
- Explicit Cloudflare boundary and examples of domain-owned ports.
- Builder repository boundary: thin future CLI, private future `builder-core` with project/state schemas, public future `standards` and observability only in P0.3.
- Generated repository boundary: lightweight workspace with `apps/web`, no local packages until justified, and conditional `apps/jobs` only for independent deployment, permission, failure, scaling, bundle, or ownership evidence.
- Portability rule: only one initial production adapter; in-memory adapters and behavioral contracts do not imply a second production platform.
- P0.1 non-goals and links to every ADR.

- [ ] **Step 4: Create the normalized capability model**

Create `docs/architecture/capability-model.md` containing these exact conceptual types:

```ts
type CapabilityDeliveryMode =
  | "package-backed"
  | "source-generated"
  | "hybrid";

type CapabilityStateClassification =
  | "stateless"
  | "repository-stateful"
  | "external-stateful"
  | "persistent-data";

type CapabilityRemovalPolicy =
  | "automatic"
  | "reviewed"
  | "export-and-remove"
  | "eject-only"
  | "unsupported";

interface CapabilityDescriptor {
  identifier: string;
  schemaVersion: string;
  deliveryMode: CapabilityDeliveryMode;
  stateClassifications: readonly [
    CapabilityStateClassification,
    ...CapabilityStateClassification[],
  ];
  removalPolicy: CapabilityRemovalPolicy;
  dependencies: readonly string[];
  optionalIntegrations: readonly string[];
  conflicts: readonly string[];
  supportedProfiles: readonly string[];
  requiredPackages: readonly string[];
  environmentVariables: readonly string[];
  secrets: readonly string[];
  platformResources: readonly string[];
  externalDomains: readonly string[];
  contentSecurityPolicyContributions: readonly string[];
  browserStorage: readonly string[];
  dataClassifications: readonly string[];
  retentionAssumptions: readonly string[];
  privilegedOperations: readonly string[];
  threatReviewLevel: string;
  adapterSemanticRequirements: readonly string[];
  managedSurfaces: readonly string[];
  inferenceProbes: readonly string[];
  migrationPlanners: readonly string[];
  verificationPlan: readonly string[];
  documentationEvidenceRequirements: readonly string[];
  removalAndRecoveryRequirements: readonly string[];
}
```

Document every capability named in the source plan, its initial delivery mode, normalized state classifications, one removal policy, dependencies, and profile inclusion. Keep `identity-2fa`, `identity-passkeys`, `payments-stripe`, analytics, persistence, email, jobs, and durable contact submissions independent. State that this Markdown catalog is architectural visibility, not an implemented runtime registry.

- [ ] **Step 5: Create the enforcement map**

Create `docs/architecture/enforcement-map.md` as a table with columns `Invariant`, `Rule`, `Gate status`, `Automated owner`, and `Phase`. Include at least:

| Invariant | Gate status | Automated owner | Phase |
|---|---|---|---|
| `INV-PROFILE-MATERIALIZATION` | planned | builder-core resolver and manifest/inference tests | P1 |
| `INV-CAPABILITY-METADATA` | planned | builder-core schema tests | P1 |
| `INV-CLOUDFLARE-ISOLATION` | planned | standards import restrictions and architecture tests | P0.3/P1 |
| `INV-NARROW-PORTS` | planned | architecture tests plus review | P4 onward |
| `INV-NO-GENERIC-PLATFORM-PORT` | planned | architecture tests plus review | P4 onward |
| `INV-PACKAGE-EXTRACTION` | planned | package API/release checks plus review evidence | P0.3/P10 |
| `INV-CLEAN-ISOLATED-MIGRATION` | planned | CLI temporary-repository integration tests | P3 |
| `INV-STATE-UPDATE-ORDER` | planned | transactional failure/recovery tests | P3 |
| `INV-COPY-EXTERNALIZATION` | planned | standards lint and locale validation | P2 |
| `INV-ACCESSIBILITY-AUTOMATION` | planned | axe/Playwright gates | P0.2/P2 |
| `INV-ACCESSIBILITY-CLAIMS` | actual in P0.1 docs; later automated | constitution contract and release checks | P0.1/P2 |
| `INV-ANALYTICS-SEPARATION` | planned | capability graph and generated-config tests | P5B |
| `INV-DEPLOYMENT-AUTHORITY` | planned | workflow-policy checks | P0.2 |
| `INV-P0-1-NO-PREMATURE-RUNTIME` | actual | final-tree inspection and review packet | P0.1 |

For each planned gate, name the first owning phase. Do not claim an automated gate exists before its listed phase.

- [ ] **Step 6: Create the executable roadmap summary**

Create `docs/roadmaps/program-roadmap.md` with:

- P0.1, P0.2, and P0.3 as separate increments with their exact acceptance and stop gates.
- P1 through P10 in the sequence in the approved source plan.
- The P2 client-ready portfolio with Calendly as the urgent milestone.
- Independent P5A–P5E capability tracks and P5F prerequisites.
- P6 after stable content/multilingual contracts; P7 after persistence and email; P8A/B/C independent after prerequisites; P9 booking webhooks; P10 evidence-led hardening.
- A `Stop gate` after every increment and phase, requiring its review packet and explicit user approval before the next phase.
- A statement that the concise roadmap never supersedes the full approved source plan or accepted ADRs.

- [ ] **Step 7: Run the architecture and full contract tests**

Run:

```bash
node --test --test-name-pattern="architecture and roadmap" tests/constitution/constitution.test.mjs
pnpm run test:constitution
```

Expected: both commands pass.

- [ ] **Step 8: Commit the architecture materialization**

Run:

```bash
git add docs/architecture/overview.md docs/architecture/capability-model.md docs/architecture/enforcement-map.md docs/roadmaps/program-roadmap.md tests/constitution/constitution.test.mjs
git diff --cached --check
git commit -m "docs: materialize the program architecture"
```

---

### Task 4: Accept recipe, delivery, ownership, Cloudflare, and package-boundary ADRs

**Files:**

- Create: `docs/adr/README.md`
- Create: `docs/adr/0001-materialized-profile-recipes.md`
- Create: `docs/adr/0002-capability-delivery-and-state.md`
- Create: `docs/adr/0003-hybrid-ownership.md`
- Create: `docs/adr/0004-cloudflare-isolation.md`
- Create: `docs/adr/0005-evidence-driven-package-extraction.md`
- Modify: `tests/constitution/constitution.test.mjs`

**Interfaces:**

- Consumes: Architecture invariant identifiers and normalized capability types.
- Produces: Accepted ADR-0001 through ADR-0005 and an index later extended by Task 5.

- [ ] **Step 1: Add a reusable failing ADR contract**

Append to `tests/constitution/constitution.test.mjs`:

```js
const acceptedAdrs = [
  ["0001-materialized-profile-recipes.md", "ADR-0001"],
  ["0002-capability-delivery-and-state.md", "ADR-0002"],
  ["0003-hybrid-ownership.md", "ADR-0003"],
  ["0004-cloudflare-isolation.md", "ADR-0004"],
  ["0005-evidence-driven-package-extraction.md", "ADR-0005"],
];

test("accepted ADRs use the repository decision contract", async () => {
  const index = await readRepositoryFile("docs/adr/README.md");

  for (const [fileName, identifier] of acceptedAdrs) {
    const relativePath = `docs/adr/${fileName}`;
    const document = await readRepositoryFile(relativePath);

    assert.ok(document.startsWith(`# ${identifier}:`));
    assert.ok(document.includes("**Status:** Accepted"));
    assert.ok(document.includes("**Date:** 2026-08-04"));
    assert.ok(document.includes("## Context"));
    assert.ok(document.includes("## Decision"));
    assert.ok(document.includes("## Consequences"));
    assert.ok(document.includes("## Enforcement"));
    assert.ok(index.includes(fileName));
  }
});
```

- [ ] **Step 2: Run the ADR test to verify RED**

Run:

```bash
node --test --test-name-pattern="accepted ADRs" tests/constitution/constitution.test.mjs
```

Expected: failure with `ENOENT` for `docs/adr/README.md`.

- [ ] **Step 3: Create the ADR index and status contract**

Create `docs/adr/README.md` with:

- Accepted ADRs are normative.
- Proposed ADRs are non-normative.
- Superseded ADRs remain historical and link to their replacement.
- Changes to an accepted decision require a new ADR; do not silently rewrite historical decisions.
- An ordered table containing identifier, title, status, date, and relative link.

List ADR-0001 through ADR-0005 as Accepted and include a clearly labelled “Reserved by the approved P0.1 plan” table for ADR-0006 through ADR-0011 until Task 5 creates them.

- [ ] **Step 4: Create ADR-0001 through ADR-0005**

Every ADR uses the test-required header and sections. Record these exact decisions:

- **ADR-0001:** Profiles are versioned starting recipes. Generation writes explicit installed capabilities, which become authoritative; later profile changes do not mutate generated projects through live inheritance. `portfolio`, `site`, `app`, and `authenticated-app` have the approved meanings, and `app` defaults only to `app-foundation`.
- **ADR-0002:** Delivery mode is exactly package-backed, source-generated, or hybrid. `stateClassifications` is a non-empty set of allowed state values. Each descriptor has exactly one removal policy; provider/data recovery and privileged operations are separate metadata. Optional integrations do not create hidden mandatory dependencies.
- **ADR-0003:** Managed surfaces carry fingerprints and merge strategies; application-owned surfaces are never overwritten; ejected surfaces leave builder management; hybrid capabilities must declare every managed surface. Conflict, ambiguous ownership, or contradictory inference blocks transformation.
- **ADR-0004:** Cloudflare types, bindings, and runtime APIs are limited to Cloudflare adapters, configuration, integration tests, and composition roots. Presentation, content, domain, application use cases, and provider-neutral ports remain Cloudflare-free. Semantic differences are explicit, and no generic platform or database port hides them.
- **ADR-0005:** Private `builder-core` is justified by cohesive internal responsibilities and initially owns project/state schemas. Public `standards` and observability are ordinary replaceable dependencies. No separate schema package exists until an independent consumer and release lifecycle are evidenced. Every new public package must meet the seven extraction gates from the source plan.

Under `## Enforcement`, reference the exact invariant IDs and first owning phases from `docs/architecture/enforcement-map.md`.

- [ ] **Step 5: Run tests and commit the first ADR group**

Run:

```bash
pnpm run test:constitution
git add docs/adr/README.md docs/adr/0001-materialized-profile-recipes.md docs/adr/0002-capability-delivery-and-state.md docs/adr/0003-hybrid-ownership.md docs/adr/0004-cloudflare-isolation.md docs/adr/0005-evidence-driven-package-extraction.md tests/constitution/constitution.test.mjs
git diff --cached --check
git commit -m "docs: accept recipe and ownership decisions"
```

Expected: tests pass and one focused ADR commit is created.

---

### Task 5: Accept state, migration, copy, accessibility, telemetry, and deployment ADRs

**Files:**

- Create: `docs/adr/0006-egeria-state-files.md`
- Create: `docs/adr/0007-transactional-repository-migrations.md`
- Create: `docs/adr/0008-copy-externalization.md`
- Create: `docs/adr/0009-accessibility-evidence-and-claims.md`
- Create: `docs/adr/0010-analytics-and-observability.md`
- Create: `docs/adr/0011-github-actions-deployment-authority.md`
- Modify: `docs/adr/README.md`
- Modify: `tests/constitution/constitution.test.mjs`

**Interfaces:**

- Consumes: Governance gates and enforcement identifiers.
- Produces: Complete accepted P0.1 ADR set.

- [ ] **Step 1: Extend the ADR contract before creating the files**

Extend `acceptedAdrs` in `tests/constitution/constitution.test.mjs` with:

```js
  ["0006-egeria-state-files.md", "ADR-0006"],
  ["0007-transactional-repository-migrations.md", "ADR-0007"],
  ["0008-copy-externalization.md", "ADR-0008"],
  ["0009-accessibility-evidence-and-claims.md", "ADR-0009"],
  ["0010-analytics-and-observability.md", "ADR-0010"],
  ["0011-github-actions-deployment-authority.md", "ADR-0011"],
```

- [ ] **Step 2: Run the ADR test to verify RED**

Run:

```bash
node --test --test-name-pattern="accepted ADRs" tests/constitution/constitution.test.mjs
```

Expected: failure with `ENOENT` for `docs/adr/0006-egeria-state-files.md`.

- [ ] **Step 3: Create ADR-0006 through ADR-0011**

Record these exact decisions:

- **ADR-0006:** `.egeria/project.yaml` is human-reviewable desired state and contains no secrets; `.egeria/state.json` is generator-owned resolved installed state; `.egeria/migrations.jsonl` is append-only successful migration/reconciliation history. Origin profile remains informational after materialization. State files are not created in P0.1.
- **ADR-0007:** Repository-changing builder commands enforce clean state, infer before planning, execute once in an isolated worktree, obtain plan and verified-final-diff approvals separately, verify and re-infer before state updates, and update state records last. Source, dependency, deployment, persistent-data, and provider rollback are separate domains. No generic force bypass exists.
- **ADR-0008:** All user-visible or translatable content originates from validated content/localization files, including accessibility labels, metadata, form states, and errors. Domain/application layers return stable identifiers. Technical diagnostics that never reach users remain beside their owner. Narrow documented escapes exist only for semantically invariant literals.
- **ADR-0009:** Automated accessibility tests are mandatory and target WCAG 2.2 AA-relevant behavior, but cannot establish conformance. A versioned human checklist is generated and recommended; human evaluation gates release only for contract, procurement, explicit risk, or conformance-claim requirements.
- **ADR-0010:** Observability always provides privacy-safe operational telemetry. Cloudflare Web Analytics, GA4, Clarity, Search Console, and Looker Studio belong only to selectable analytics. Consent orchestration is provider-neutral and is not represented as legal compliance.
- **ADR-0011:** GitHub Actions is the sole deployment authority. Local deploy commands may support explicit diagnostics but are not an authorized release path. Environments separate non-production and production credentials; protections and plan availability must be verified. Production deployment, persistent-data migrations, and provider changes require explicit human gates and cannot be self-approved.

Each ADR links its official references where applicable: W3C for ADR-0009, GitHub environments for ADR-0011, and Cloudflare/OpenNext for ADR-0004/0011.

- [ ] **Step 4: Complete the ADR index**

Replace the reserved ADR-0006 through ADR-0011 rows in `docs/adr/README.md` with Accepted rows and relative links. Ensure all eleven identifiers appear exactly once in the accepted table.

- [ ] **Step 5: Run tests and commit the second ADR group**

Run:

```bash
pnpm run test:constitution
git add docs/adr/README.md docs/adr/0006-egeria-state-files.md docs/adr/0007-transactional-repository-migrations.md docs/adr/0008-copy-externalization.md docs/adr/0009-accessibility-evidence-and-claims.md docs/adr/0010-analytics-and-observability.md docs/adr/0011-github-actions-deployment-authority.md tests/constitution/constitution.test.mjs
git diff --cached --check
git commit -m "docs: accept state and governance decisions"
```

Expected: all constitution tests pass.

---

### Task 6: Produce deterministic pre-review verification evidence

**Files:**

- Create: `docs/implementation-evidence/2026-08-04-p0-1-constitution-verification.md`

**Interfaces:**

- Consumes: Complete P0.1 tree before independent review.
- Produces: Reproducible verification evidence and an explicit list of unproven properties.

- [ ] **Step 1: Run the full deterministic checks once on the coherent tree**

Run:

```bash
node --version
pnpm --version
git --version
pnpm run test:constitution
git diff --check 98ff2f4...HEAD
shasum -a 256 docs/roadmaps/2026-08-04-nextjs-boilerplate-builder-best-reconciled-plan.md
test ! -e apps
test ! -e packages
test ! -e .egeria
git status --short --branch
git log --oneline --decorate 98ff2f4..HEAD
```

Expected:

- constitution tests pass;
- diff check is clean;
- source plan hash remains `f8d3f7db149f18c28ac3c6e41781405e3661c4a5ab710ee28290b184864c1027`;
- all three absence checks confirm that `apps`, `packages`, and `.egeria` do not exist;
- only the intended P0.1 files differ from `main`;
- no staged or unrelated work exists.

Do not rerun an unchanged successful check.

- [ ] **Step 2: Record the verification evidence**

Create `docs/implementation-evidence/2026-08-04-p0-1-constitution-verification.md` with:

- exact commit range `98ff2f4...HEAD` and commit IDs;
- every command and exit result;
- local Node.js, pnpm, and Git versions;
- source-plan hash;
- list of created files;
- confirmation that no dependencies, lockfile, app, public/private package, `.egeria` state, workflow, Cloudflare resource, or production profile exists;
- explicit limits: static document tests do not prove Next.js runtime behavior, OpenNext compatibility, workerd behavior, deployment, accessibility conformance, production safety, or package security;
- P0.2 entry requirement to refresh versions/advisories, validate the approved Volta Node.js `22.23.0` pin against the exact Next.js/OpenNext pair, and select the current compatible pnpm before installing dependencies.

- [ ] **Step 3: Commit the pre-review evidence**

Run:

```bash
git add docs/implementation-evidence/2026-08-04-p0-1-constitution-verification.md
git diff --cached --check
git commit -m "docs: record P0.1 verification evidence"
```

---

### Task 7: Run the required independent reviews and repair material findings

**Files:**

- Modify only when supported by a material finding: files already in the P0.1 file map.
- Modify after any repair: `docs/implementation-evidence/2026-08-04-p0-1-constitution-verification.md`

**Interfaces:**

- Consumes: Read-only diff `98ff2f4...HEAD`, approved source plan, preparation evidence, and this implementation plan.
- Produces: Three non-overlapping review reports, controller reconciliation, and a verified repaired tree if required.

- [ ] **Step 1: Dispatch the requirements reviewer read-only**

Provide no inherited conversation history; provide exact paths and scope. Require the reviewer to compare the final diff against the approved source roadmap, this plan, P0.1 acceptance, explicit non-goals, and changed-file boundary. Require only material, evidence-backed findings with exact file/line references. Prohibit edits, recursive delegation, comments, GitHub actions, and review outside P0.1.

- [ ] **Step 2: Dispatch the architecture and anti-overengineering reviewer read-only**

Require checks for internal contradictions, incorrect profile/capability materialization, Cloudflare leakage, generic ports, schema-package drift, premature runtime/package surfaces, duplicated normative ownership, and unnecessary abstractions. Prohibit edits and recursive delegation.

- [ ] **Step 3: Dispatch the test-evidence reviewer read-only**

Require checks that each acceptance statement is covered by either an actual P0.1 assertion or an honestly planned later gate, RED/GREEN evidence is credible, commands test the final tree, and claims do not exceed static evidence. Prohibit edits and recursive delegation.

- [ ] **Step 4: Reconcile all reviews before editing**

Wait for all three. Verify each finding against the current shared tree. Classify each as material-kept, invalid, duplicate, deferred-by-scope, or low-value churn. Add a specialist reviewer only if a kept finding requires expertise not covered by the three required scopes; deployment/security wording alone is handled by the architecture reviewer unless a concrete secrets, permissions, or production-control defect is found.

- [ ] **Step 5: Repair only kept material findings sequentially**

For each kept finding:

1. add or tighten the failing constitution assertion when automatable;
2. run the focused test and confirm RED;
3. make the smallest document/configuration correction;
4. run the focused test and confirm GREEN.

Do not modify the approved source-plan copy. Do not broaden P0.1.

- [ ] **Step 6: Verify the repaired final tree once**

Run only if relevant inputs changed:

```bash
pnpm run test:constitution
git diff --check 98ff2f4...HEAD
git status --short --branch
```

Update the verification evidence with the repair commands and final results. If repairs were required, commit them with:

```bash
git add -u -- .
git diff --cached --name-only
git diff --cached --check
git commit -m "fix: resolve P0.1 review findings"
```

Because repairs may modify only already tracked files in the exact P0.1 map, `git add -u -- .` cannot add an unrelated untracked path. Stop if the staged-name inspection shows any path not tied to a kept finding.

---

### Task 8: Produce the review packet and stop at the P0.1 approval gate

**Files:**

- Create: `docs/review-packets/2026-08-04-p0-1-constitution-and-adrs.md`

**Interfaces:**

- Consumes: Final verified tree and reconciled reviewer results.
- Produces: P0.1 handoff packet for explicit user approval; no external action.

- [ ] **Step 1: Create the review packet**

Create `docs/review-packets/2026-08-04-p0-1-constitution-and-adrs.md` with these sections:

1. Scope and acceptance decision.
2. Frozen comparison: `base: 98ff2f4`, `candidate: main`, exact commit IDs.
3. Changed files grouped as workspace, governance, architecture, ADRs, tests, evidence, and source plan.
4. Commands and results, including RED/GREEN focused tests and final full checks.
5. Reviewer reports and every disposition.
6. Security/advisory evidence and toolchain mismatch.
7. Material risks and fragile assumptions.
8. Deferred P0.2 and P0.3 work.
9. Rollback/recovery: P0.1 has no external or persistent data; after explicit approval, source recovery is `git revert` of the named P0.1 commits, while the bootstrap source-plan commit remains separately auditable.
10. Explicit limits: no runtime, deployment, accessibility conformance, package advisory, or production proof.
11. Approval requested: accept P0.1 final diff and authorize planning P0.2; do not conflate this with push, pull request, merge, or deployment authority.

- [ ] **Step 2: Run final verification after the packet changes the tree**

Run:

```bash
pnpm run test:constitution
git diff --check 98ff2f4...HEAD
git status --short --branch
git log --oneline --decorate 98ff2f4..HEAD
```

Expected: tests pass; diff is clean; only the new review packet is uncommitted.

- [ ] **Step 3: Commit the exact review packet**

Run:

```bash
git add docs/review-packets/2026-08-04-p0-1-constitution-and-adrs.md
git diff --cached --check
git commit -m "docs: record P0.1 review packet"
```

- [ ] **Step 4: Inspect and stop**

Run:

```bash
git status --short --branch
git diff --stat 98ff2f4...HEAD
git log --oneline --decorate 98ff2f4..HEAD
```

Expected: clean implementation worktree and only P0.1 commits. Present the review packet and stop for explicit user approval. Do not push, create a pull request, merge, deploy, publish, alter Cloudflare/GitHub settings, or begin P0.2.

## Plan Self-Review Result

- **Source coverage:** Every P0.1 deliverable and acceptance statement maps to a task and exact file.
- **Scope control:** No production profile, runtime package, `.egeria` schema, workflow, Cloudflare resource, or later-stage implementation is created.
- **Contradictions:** Composite state/removal labels, PR authority, bootstrap isolation, toolchain mismatch, and accessibility wording are resolved or gated explicitly.
- **Test integrity:** Each implementation batch starts with a focused failing contract, reaches GREEN, and ends with one final coherent-suite run after relevant inputs change.
- **Type consistency:** Delivery modes, state classifications, removal policies, descriptor names, invariant IDs, and ADR identifiers are consistent across tasks.
- **Action safety:** Commit, worktree, review, final-diff, pull-request, and deployment permissions remain distinct.
