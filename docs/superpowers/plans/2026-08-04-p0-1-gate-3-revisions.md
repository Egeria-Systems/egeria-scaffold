# P0.1 Gate 3 Revisions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an nvm-compatible Node.js pin and permit clean sequential builder-repository development on `main` without weakening isolated transactional transformations of generated client repositories.

**Architecture:** `.nvmrc` and `package.json` are two local version-manager surfaces for the same exact Node.js version, enforced by the dependency-free constitution test. The governance protocol remains the canonical Git-policy owner: it distinguishes development of this repository from builder commands that mutate generated repositories. Existing Better Stack browser observability and the `@egeria-systems/*` package scope remain unchanged.

**Tech Stack:** Markdown, JSON, Git, `.nvmrc`, pnpm, and the Node.js built-in test runner. No dependency, lockfile, application, package, provider resource, or deployment is added.

## Global Constraints

- Root `.nvmrc` contains exactly `22.23.0` followed by one newline.
- `package.json` retains `volta.node` as `22.23.0`; the two pins must match.
- Root package name remains `@egeria-systems/scaffold`.
- Planned public package names remain `@egeria-systems/standards` and `@egeria-systems/observability`.
- Clean, approved, sequential development of this builder repository may run directly on `main`.
- A branch and isolated worktree are required when implementation becomes parallel or isolation is materially useful.
- Builder commands that change generated client repositories always retain clean-state, dedicated-branch, isolated-worktree, transactional verification, and separate approval gates.
- ADR-0010 already covers Better Stack browser errors and Web Vitals; do not change observability or analytics architecture.
- Do not implement P0.2, name or create its proof app, install dependencies, create a lockfile, or create `apps/*` or `packages/*`.
- Do not push, create a pull request, merge, publish, deploy, change provider state, or perform another external action.

## Exact File Map

Create:

- `.nvmrc` — exact nvm-compatible Node.js version pin.

Modify:

- `tests/constitution/constitution.test.mjs` — require exact equality between `.nvmrc` and `volta.node`.
- `README.md` — identify both supported Node version-manager pins without claiming P0.2 compatibility.
- `AGENTS.md` — summarize the approved builder-repository development policy while preserving generated-client isolation.
- `docs/governance/review-and-contribution.md` — canonical separation between builder-repository development and generated-client transformations.
- `docs/superpowers/plans/2026-08-04-p0-1-constitution-and-adrs.md` — record that the later Gate 3 workflow decision supersedes the earlier P0.1-only `main` exception.
- `docs/roadmaps/2026-08-04-nextjs-boilerplate-builder-best-reconciled-plan.md` — delegate builder-repository development mode to the canonical governance protocol while preserving generated-client migration isolation.
- `docs/implementation-evidence/2026-08-04-p0-1-constitution-verification.md` — add the revision RED/GREEN, commands, candidate commits, and reviewer dispositions.
- `docs/review-packets/2026-08-04-p0-1-constitution-and-adrs.md` — present the revised exact candidate and final verification.

Planning artifacts already committed:

- `docs/superpowers/specs/2026-08-04-p0-1-gate-3-revisions-design.md`
- `docs/superpowers/plans/2026-08-04-p0-1-gate-3-revisions.md`

Explicitly unchanged:

- `package.json` — already has the approved version and retained package scope.
- `docs/adr/0010-analytics-and-observability.md` — already covers Better Stack browser observability.
- `docs/adr/0007-transactional-repository-migrations.md` — already owns generated-client isolation and transaction ordering.
- `docs/architecture/capability-model.md` and `docs/adr/0005-evidence-driven-package-extraction.md` — already retain `@egeria-systems/*`.
- `docs/implementation-evidence/2026-08-04-p0-1-constitution-preparation.md` — historical preparation evidence remains unchanged.

The source plan's original SHA-256 remains historical provenance in preparation evidence. Verification evidence and the review packet record the revised source-plan hash after this approved Gate 3 policy correction.

---

### Task 1: Add and enforce the nvm Node.js pin

**Files:**

- Create: `.nvmrc`
- Modify: `tests/constitution/constitution.test.mjs`
- Modify: `README.md`

**Interfaces:**

- Consumes: `package.json` `volta.node: "22.23.0"` and `readRepositoryFile(relativePath): Promise<string>`.
- Produces: exact `.nvmrc` content `22.23.0\n`; the root workspace contract fails if the nvm and Volta pins differ.

- [ ] **Step 1: Write the failing contract**

In `the root workspace is private and dependency-free in P0.1`, read `.nvmrc` and add the exact equality assertion:

```js
test("the root workspace is private and dependency-free in P0.1", async () => {
  const manifest = JSON.parse(await readRepositoryFile("package.json"));
  const nvmVersion = await readRepositoryFile(".nvmrc");

  // Existing manifest assertions remain unchanged.
  assert.deepEqual(manifest.volta, { node: "22.23.0" });
  assert.equal(nvmVersion, `${manifest.volta.node}\n`);
});
```

Do not add an nvm dependency or shell integration test. The contract owns only repository file content and equality.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
node --test --test-name-pattern="root workspace" tests/constitution/constitution.test.mjs
```

Expected: one failure with `ENOENT` for root `.nvmrc`. Stop if it fails for another reason.

- [ ] **Step 3: Add the minimum pin and README wording**

Create `.nvmrc` with exactly:

```text
22.23.0
```

Replace the current README Node-pin paragraph with:

```markdown
Node.js `22.23.0` is pinned for local development through both `.nvmrc` and `package.json` Volta configuration. These matching pins are not deployed compatibility proof.
```

- [ ] **Step 4: Verify focused GREEN and the complete suite**

Run:

```bash
node --test --test-name-pattern="root workspace" tests/constitution/constitution.test.mjs
pnpm run test:constitution
git diff --check
```

Expected: the focused test and all six constitution contracts pass; the comparison has no whitespace error.

- [ ] **Step 5: Commit the focused configuration change**

Run:

```bash
git add .nvmrc README.md tests/constitution/constitution.test.mjs
git diff --cached --check
git commit -m "build: add nvm Node pin"
```

Expected: one commit containing only the pin, its contract, and direct README documentation.

---

### Task 2: Separate builder-repository development from generated-client transformations

**Files:**

- Modify: `AGENTS.md`
- Modify: `docs/governance/review-and-contribution.md`
- Modify: `docs/roadmaps/2026-08-04-nextjs-boilerplate-builder-best-reconciled-plan.md`
- Modify: `docs/superpowers/plans/2026-08-04-p0-1-constitution-and-adrs.md`

**Interfaces:**

- Consumes: the approved design's distinction between this repository and repositories modified by the future builder.
- Produces: one canonical development policy in the governance protocol and a concise root-instruction summary; generated-client builder behavior remains governed by ADR-0007.

- [ ] **Step 1: Record the pre-change semantic conflict**

Run:

```bash
rg -n "one-time|later increments|isolated worktree|directly on clean `main`" AGENTS.md docs/governance/review-and-contribution.md docs/superpowers/plans/2026-08-04-p0-1-constitution-and-adrs.md
```

Expected: the files still describe direct `main` development as a P0.1-only exception. This is semantic evidence, not an executable RED test; do not add brittle prose-presence assertions.

- [ ] **Step 2: Update the canonical governance owner**

Replace `## Clean execution boundary` with two explicit boundaries.

The first section must state:

```markdown
## Builder-repository development boundary

Development of this repository may proceed directly on `main` only when the approved work is one clean, sequential implementation stream, no user-owned work is at risk, repository protections permit it, and isolation has no material safety or coordination benefit.

A dedicated branch and isolated worktree are required when implementation becomes parallel or when isolation is materially useful for risk containment, experimentation, conflicting changes, or preservation of another active tree. Before either mode, verify the branch, status, comparison, and approval scope. Development workflow permission never authorizes push, pull-request creation, merge, deployment, publication, or another external action.
```

The second section must retain the existing clean-state bullets and transactional paragraph under this heading and introduction:

```markdown
## Generated-client transformation boundary

Repository-changing builder commands always require:
```

Remove only the obsolete sentence that calls direct `main` development a P0.1-only exception. Preserve the rules that the builder never stashes, commits, discards, restores, or force-bypasses user work automatically and that state belongs in the exact approved diff.

- [ ] **Step 3: Update direct instruction and plan consumers**

Replace the P0.1-only exception bullet in root `AGENTS.md` with:

```markdown
- Development of this builder repository may proceed directly on clean `main` for one approved sequential implementation stream when repository protections permit it and isolation has no material safety or coordination benefit. Use a dedicated branch and isolated worktree when implementation becomes parallel or isolation is otherwise materially useful. Repository-changing builder commands that target generated client repositories always require clean state, a dedicated branch, and one isolated-worktree execution.
```

In `docs/superpowers/plans/2026-08-04-p0-1-constitution-and-adrs.md`:

1. add a `## Gate 3 Development Workflow Amendment` after `## Independent Review Reconciliation`;
2. state that the approved 2026-08-04 Gate 3 decision supersedes only that plan's P0.1-only builder-repository development exception;
3. copy the repository-development and generated-client boundary from the approved design without changing transactional builder behavior;
4. state that the new revision plan is the exact-file execution owner.

In the source plan's `## 20. AI-agent governance` checklist, replace the unconditional isolated-worktree development item with:

```markdown
6. test-driven development under the canonical builder-repository development boundary in `docs/governance/review-and-contribution.md`;
```

Do not rewrite the historical preparation evidence or ADR-0007.

- [ ] **Step 4: Verify the documentation delta**

Run:

```bash
pnpm run test:constitution
git diff --check
git diff -- AGENTS.md docs/governance/review-and-contribution.md docs/roadmaps/2026-08-04-nextjs-boilerplate-builder-best-reconciled-plan.md docs/superpowers/plans/2026-08-04-p0-1-constitution-and-adrs.md
```

Expected: all tests pass; no whitespace error; the diff clearly distinguishes the two repositories and preserves generated-client isolation.

- [ ] **Step 5: Commit the governance revision**

Run:

```bash
git add AGENTS.md docs/governance/review-and-contribution.md docs/roadmaps/2026-08-04-nextjs-boilerplate-builder-best-reconciled-plan.md docs/superpowers/plans/2026-08-04-p0-1-constitution-and-adrs.md
git diff --cached --check
git commit -m "docs: allow sequential development on main"
```

Expected: one documentation-only policy commit.

---

### Task 3: Review and deliver the revised P0.1 candidate

**Files:**

- Modify: `docs/implementation-evidence/2026-08-04-p0-1-constitution-verification.md`
- Modify: `docs/review-packets/2026-08-04-p0-1-constitution-and-adrs.md`

**Interfaces:**

- Consumes: the exact Task 1 and Task 2 commits plus three read-only reviewer reports.
- Produces: dated evidence and a revised Gate 3 packet for the exact final candidate.

- [ ] **Step 1: Freeze and verify the implementation delta**

Record the planning base `965d1c0c868bcd9b66a5f46381dc12ba93389d2d` and the exact implementation head after Tasks 1–2. Run:

```bash
pnpm run test:constitution
git diff --check 965d1c0c868bcd9b66a5f46381dc12ba93389d2d...HEAD
git status --short --branch
git diff --name-only 965d1c0c868bcd9b66a5f46381dc12ba93389d2d...HEAD
```

Expected: all six tests pass after extending the existing root-workspace contract; comparison check passes; `main` is clean; only approved revision files changed.

- [ ] **Step 2: Dispatch three bounded read-only reviewers**

Provide each reviewer the approved design, this plan, base `965d1c0c868bcd9b66a5f46381dc12ba93389d2d`, and exact implementation head. Prohibit edits, recursive delegation, GitHub comments, and external action.

- Requirements reviewer: verify every approved decision/non-goal and exact-file boundary, including unchanged package scope and Better Stack architecture.
- Architecture and anti-overengineering reviewer: verify the two Git-policy domains are unambiguous, no transactional safeguard weakened, and no unnecessary abstraction or file was added.
- Test-evidence reviewer: verify the RED cause, exact file/equality assertion, final-tree coverage, command claims, and evidence limits.

Classify every finding against the current tree. Repair only current evidence-backed material findings, rerun affected checks, and request bounded repair verification from the originating reviewer.

- [ ] **Step 3: Update verification evidence**

Append a `## Gate 3 revisions` section containing:

- approved decisions and non-goals;
- planning base and exact reviewed/repaired heads;
- `.nvmrc` RED/Green commands and results;
- final complete-suite and diff-check results;
- every reviewer finding/disposition and repair verification;
- explicit evidence limits: no nvm installation, shell integration, P0.2 compatibility, runtime, deployment, or publication proof.

- [ ] **Step 4: Update the review packet**

Revise the packet status and frozen comparison for the new exact candidate. Add `.nvmrc`, the design, and this plan to changed-file groups. Record:

- matching nvm/Volta pins;
- the canonical linear-`main` versus generated-client isolation policy;
- unchanged `@egeria-systems/*` scope and Better Stack browser observability;
- reviewer dispositions;
- final commands/results and evidence limits;
- recovery by ordinary reverts only;
- a new request for exact P0.1 Gate 3 approval.

- [ ] **Step 5: Run final verification on the packet tree**

Run:

```bash
node --version
pnpm --version
pnpm run test:constitution
git diff --check
git diff --check 98ff2f4054fb7c1b27a217726e40ba9f2fc5bca3...HEAD
shasum -a 256 docs/roadmaps/2026-08-04-nextjs-boilerplate-builder-best-reconciled-plan.md
test ! -e apps
test ! -e packages
test ! -e .egeria
test ! -e pnpm-lock.yaml
test ! -e .github
git status --short --branch
```

Expected: Node `v22.23.0`; all six tests pass; comparison and source hash pass; deferred surfaces remain absent; only evidence/packet changes are uncommitted.

- [ ] **Step 6: Commit the revised evidence and packet**

Run:

```bash
git add docs/implementation-evidence/2026-08-04-p0-1-constitution-verification.md docs/review-packets/2026-08-04-p0-1-constitution-and-adrs.md
git diff --cached --check
git commit -m "docs: revise P0.1 review packet"
```

- [ ] **Step 7: Verify the exact committed tree and stop**

Rerun the Task 3 Step 5 commands with a clean status, then record the exact final `HEAD`, comparison range, and commit list in the handoff. Stop for verified-final-diff approval. Do not begin P0.2, push, create a pull request, merge, publish, or deploy.

## Plan Self-Review

- **Spec coverage:** `.nvmrc`, Volta equality, linear `main`, parallel/isolation threshold, generated-client transaction safety, retained package scope, unchanged Better Stack architecture, evidence, review, and recovery all map to exact tasks.
- **Scope:** One configuration/test task, one governance task, and one delivery task; no independent subsystem or runtime feature is bundled.
- **Test quality:** The executable contract protects exact version equality. Git-policy meaning is reviewed semantically rather than through phrase assertions.
- **Canonical ownership:** Governance owns development workflow; ADR-0007 continues to own generated-client transactional migrations.
- **No placeholders:** Every implementation step names exact content, commands, expected results, and commit boundaries.
- **Safety:** Local commits on clean `main` are within the approved sequential policy; all external actions remain separately gated.
