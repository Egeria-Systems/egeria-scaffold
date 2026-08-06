# Semantic Naming Enforcement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent roadmap and implementation-sequencing labels from becoming software names, paths, configuration, commands, generated output, or ordinary test vocabulary, while preserving labels in documentation whose actual subject is sequencing, provenance, or historical status.

**Architecture:** One repository-local module owns the label grammar, path classification, Git-aware enumeration, and deterministic findings. A permanent constitution test and direct root command invoke that scanner across tracked and non-ignored untracked paths. A temporary local ESLint rule reuses the same matcher for fast JavaScript and TypeScript feedback through the remaining P1 implementation, then is removed at the end of the main plan's last implementation task after an explicit equivalence gate.

**Tech stack:** Node.js `22.23.0`, pnpm `11.20.0`, Node test runner, ESLint `10.8.0`, Git `ls-files`, existing repository dependencies only.

**Preparation evidence:** [`2026-08-06-semantic-naming-preparation.md`](../../implementation-evidence/2026-08-06-semantic-naming-preparation.md)

## Approval, sequencing, and shared-file boundary

This plan stops at Gate 2. Approval authorizes only the bounded local edits and focused commits listed below. It does not authorize push, pull request, merge, deployment, publication, provider mutation, permission changes, external messages, or responses to review comments.

Before implementation:

1. Re-read root instructions, this plan, the preparation evidence, the current main P1 plan, the active deterministic-rendering plan, and every file in the implementation map.
2. Re-freeze branch, `HEAD`, status, worktrees, and the exact comparison from planning base `ed33e97b4a9424a44c1b7d363584a43ca711c164`. Re-run the read-only inventory; amend this plan if the executable/configuration/test leaks or direct consumers changed materially.
3. Preserve the user's root `AGENTS.md` functional-programming edit. Edit the semantic-naming block only if the adjacent user hunk can remain unstaged and excluded from every naming commit, or the user separately authorizes its exact inclusion. Stop if the staged diff cannot prove that separation.
4. Treat committed deterministic-rendering planning commit `ed33e97` as a direct consumer. Amend only the conflicting naming instructions; preserve the rest of that approved plan and its preparation evidence.
5. Use `rtk` for shell commands and the pinned pnpm executable where pnpm is required.

No dependency or lockfile change is permitted. The public standards package and separately accepted compatibility proof remain unchanged.

## Contract boundary

### Prohibited label grammar

The canonical matcher recognizes:

```text
compact phase label := p + ordinal
named sequence label := prefix + optional separator + ordinal
ordinal             := integer with optional dotted integers and optional letter suffix | x
separator           := whitespace | hyphen | underscore | period
```

Matching is case-aware enough to recognize lowercase paths and camel/Pascal identifiers. It covers standalone strings, filename segments, keys, snake/kebab names, and an ordinal at the start or middle of an identifier before a camel-case boundary.

The initial named-prefix data is exact:

```js
[
  "phase",
  "task",
  "stage",
  "step",
  "part",
  "milestone",
  "gate",
  "wave",
  "workstream",
  "sprint",
  "iteration",
  "increment",
  "epic",
  "story",
]
```

The data list is the single expansion point. Tests construct prohibited examples from neutral fragments so the checker does not exempt itself.

Required positive cases include compact numeric, dotted, letter-suffixed, and placeholder forms; numbered and placeholder task forms; named labels with whitespace, hyphen, underscore, and camel/Pascal continuation; literal strings; comments; test descriptions; configuration keys; and path segments.

Required counterexamples include `p2pConnection`, `taskQueue`, `stepCount`, `stageName`, `incrementValue`, ordinary semantic-version text, and prose that uses a prefix without an ordinal. If an abbreviation is indistinguishable from a sequencing label, prefer a fully spelled semantic name instead of adding a broad exception.

### Allowed documentation boundary

Labels remain allowed when sequencing/provenance is the actual subject, including roadmap headings, dated plans and specs, preparation/verification evidence, review packets, compatibility records, accepted historical status, approval-gate records, and explicitly phase-scoped invariants.

The path scanner may allow label-bearing path segments only beneath:

```text
docs/roadmaps/
docs/superpowers/plans/
docs/superpowers/specs/
docs/implementation-evidence/
docs/review-packets/
docs/compatibility/
```

Document content under `docs/` and repository instruction/contribution/readme Markdown remains documentary. Templates and committed generated fixtures are product surfaces even when their destination is Markdown and must be scanned.

Historical-document tests may construct the exact historical label from neutral fragments. Their test/suite descriptions, local identifiers, and stable fixture names remain semantic.

### Permanent and temporary enforcement

Permanent enforcement scans:

- every tracked and non-ignored untracked path;
- authored text under root configuration, `.github/`, `apps/`, `packages/`, `proofs/`, `scripts/`, `tests/`, and `fixtures/`;
- executable source, comments, configuration, workflows, tests, test descriptions, schemas, templates, and committed generated fixtures;
- no dependency directory, ignored/generated build output, binary file, or lockfile content.

Path enumeration must use `execFile` without a shell:

```text
git ls-files -z --cached --others --exclude-standard
```

Findings are sorted by path, line, column, family, and matched value. Diagnostics report only location and label category, not whole source lines or unrelated contents.

The temporary ESLint adapter imports the permanent matcher. It is repository-local, has no public package export, adds no dependency, and does not alter `@egeria-systems/standards` or `proofs/nextjs-cloudflare`.

## Exact implementation file map

Create permanently:

```text
scripts/check-semantic-naming.mjs
tests/constitution/semantic-naming.test.mjs
```

Create temporarily, then delete through the main-plan Task 8 sunset gate:

```text
scripts/eslint/no-sequencing-labels.mjs
```

Modify for permanent enforcement and cleanup:

```text
AGENTS.md
package.json
tests/constitution/constitution.test.mjs
tests/package-boundaries/private-packages.test.mjs
tests/package-boundaries/release-safeguards.test.mjs
packages/builder-core/tests/contracts.test.mjs
packages/builder-core/tests/resolution.test.mjs
packages/builder-core/AGENTS.md
packages/builder-core/README.md
docs/architecture/enforcement-map.md
docs/architecture/package-ownership.md
docs/superpowers/plans/2026-08-05-p1-builder-kernel.md
docs/superpowers/plans/2026-08-06-deterministic-skeleton-rendering.md
```

Modify for the temporary ESLint adapter:

```text
eslint.config.mjs
tests/package-boundaries/internal-linting.test.mjs
```

Create after settled implementation and review:

```text
docs/implementation-evidence/2026-08-06-semantic-naming-verification.md
docs/review-packets/2026-08-06-semantic-naming-enforcement.md
```

If verification/review occurs on a later local date, use that actual date for the final two artifacts and their links.

## Task 1: Permanent matcher, path scanner, and repository contract

**Files:**

- Create: `scripts/check-semantic-naming.mjs`
- Create: `tests/constitution/semantic-naming.test.mjs`

- [ ] **Step 1.1 — Write matcher and path-classification tests first**

The test imports this internal interface:

```js
export function findSequencingLabels(value) {}
export function classifySemanticNamingPath(path) {}
export async function listRepositoryPaths({ root, runGit }) {}
export async function scanRepository({ root, paths, readFile }) {}
```

Test the full positive/counterexample matrix, deterministic finding order, NUL-delimited Git-path parsing, exact `ls-files` arguments, documentary path allowances, template/fixture Markdown inclusion, lockfile/binary exclusion, invalid path rejection, line/column reporting, and content-safe diagnostics.

Use dependency injection for Git enumeration and reads in unit cases. The real-repository contract is added in Task 3 so this task can finish GREEN without temporarily breaking the aggregate suite.

- [ ] **Step 1.2 — Verify expected RED**

```bash
rtk node --test tests/constitution/semantic-naming.test.mjs
```

Expected RED: the checker module is absent. Do not accept malformed test syntax or a missing installed dependency as RED.

- [ ] **Step 1.3 — Implement the minimum canonical checker**

Keep label recognition and path classification pure. Use `execFile` for Git, `TextDecoder("utf-8", { fatal: true })` for selected text, and no shell, network, write, or Git mutation. When the module is the direct entry point, scan the repository and exit non-zero with sorted concise findings.

Do not wire the checker into root scripts yet; Task 3 adds the real-repository contract and aggregate command immediately before the cleanup RED.

- [ ] **Step 1.4 — Run unit GREEN, commit, and stop**

```bash
rtk node --test tests/constitution/semantic-naming.test.mjs
rtk git diff --check
```

Expected: matcher, path classification, injected Git enumeration, and scanner unit cases pass.

After approval of the staged diff, commit only these two files:

```bash
git add scripts/check-semantic-naming.mjs tests/constitution/semantic-naming.test.mjs
git diff --cached --check
git commit -m "Add semantic naming scanner"
```

Stop before Task 2.

## Task 2: Temporary repository-local ESLint feedback

**Files:**

- Create: `scripts/eslint/no-sequencing-labels.mjs`
- Modify: `eslint.config.mjs`
- Modify: `tests/package-boundaries/internal-linting.test.mjs`

- [ ] **Step 2.1 — Write ESLint behavior RED**

Extend the internal-linting test to load the root ESLint config and lint source strings constructed from neutral fragments. Require one stable rule message for labels in identifiers, private identifiers, string literals, static template text, comments, JSX identifiers/text when parsed, and ordinary test/suite descriptions. Require no message for the counterexample matrix.

Assert that the rule is local to the root config and is absent from the standards package exports and packed file allowlist.

- [ ] **Step 2.2 — Verify expected RED**

```bash
rtk node --test tests/package-boundaries/internal-linting.test.mjs
```

Expected RED: the local rule/config entry does not exist. Existing ESLint-major and standards behavior checks must remain green.

- [ ] **Step 2.3 — Implement the thin adapter**

Export one ESLint rule object with no independent regex or prefix data. It calls `findSequencingLabels` for relevant AST names/text and source comments and reports `sequencingLabel` at the narrowest available location.

Register it in `eslint.config.mjs` under a repository-local plugin/config name. Existing package lint commands apply it to builder source. Task 3 extends `lint:builder` over authored tests, scripts, and root ESLint configuration only after the known source leaks are cleaned.

Do not export the rule from `@egeria-systems/standards`, change peer dependencies, modify the lockfile, or apply the builder ESLint major to the proof.

- [ ] **Step 2.4 — Run focused GREEN without masking repository RED**

```bash
rtk node --test tests/package-boundaries/internal-linting.test.mjs
rtk node --test packages/standards/tests/*.test.mjs
```

Expected: local rule behavior and existing standards dual-major tests pass.

After approval of the staged diff, commit only the local adapter/config/behavior test:

```bash
git add eslint.config.mjs scripts/eslint/no-sequencing-labels.mjs tests/package-boundaries/internal-linting.test.mjs
git diff --cached --check
git commit -m "Add semantic naming lint"
```

Stop before Task 3.

## Task 3: Remove executable leakage and update canonical consumers

**Files:**

- Modify: the six inventoried executable test files
- Modify: `package.json`
- Modify: `tests/constitution/constitution.test.mjs`
- Modify: `AGENTS.md`
- Modify: `packages/builder-core/AGENTS.md`
- Modify: `packages/builder-core/README.md`
- Modify: `docs/architecture/enforcement-map.md`
- Modify: `docs/architecture/package-ownership.md`
- Modify: `docs/superpowers/plans/2026-08-05-p1-builder-kernel.md`
- Modify: `docs/superpowers/plans/2026-08-06-deterministic-skeleton-rendering.md`

- [ ] **Step 3.1 — Wire the permanent repository contract and observe inventory RED**

Add a final real-repository scan to `semantic-naming.test.mjs`. Add permanent root scripts/configuration:

```json
{
  "check:semantic-naming": "node scripts/check-semantic-naming.mjs",
  "test:constitution": "node --test tests/constitution/*.test.mjs"
}
```

Update the existing constitution assertion to require the glob command. Do not add a duplicate CI workflow: the root test and current/future builder verification already call `test:constitution`.

Temporarily extend `lint:builder` so the local rule also runs over authored tests, scripts, and root ESLint configuration with `--no-error-on-unmatched-pattern`.

Run:

```bash
rtk node --test tests/constitution/semantic-naming.test.mjs
rtk node scripts/check-semantic-naming.mjs
```

Expected RED: unit cases pass and the repository contract reports the current 37 lines across the six inventoried test files. Stop and amend the inventory if it reports an unclassified false positive or materially different leak set.

- [ ] **Step 3.2 — Rename ordinary test vocabulary semantically**

Use exact responsibility names, including:

```text
the CLI remains an empty shell while builder-core owns the approved diagnostic boundary
builder-core direct consumers describe the private diagnostic boundary
the compatibility record preserves its required evidence boundaries
package ownership documentation records the approved release boundary
```

When the deterministic-rendering plan advances the first two boundaries, it must use `approved rendering boundary` and `private deterministic-rendering boundary`, not another numbered task title.

Remove redundant literals for old API names, schema titles, script keys, and source paths where exact current semantic contracts plus the permanent scanner provide stronger protection. Where a historical document assertion still needs exact old heading/path/gate text, construct it from neutral fragments and name local variables for historical behavior, such as `completedBuilderFoundationSection`.

Do not weaken historical evidence assertions, exact current script assertions, package source allowlists, or schema artifact equality.

- [ ] **Step 3.3 — Broaden the canonical instruction surgically**

Edit only the semantic-naming section of root `AGENTS.md`. Preserve the user's functional-programming block byte-for-byte.

The canonical rule must:

- cover the generic compact and named sequencing-label taxonomy;
- prohibit labels in authored executable/configuration/workflow/test/fixture content, comments, test/suite descriptions, paths, identifiers, keys, commands, flags, schemas, errors, and generated output;
- retain the narrow phase/provenance documentation allowance;
- identify the permanent repository contract as the enforcement owner;
- forbid compatibility aliases without an approved consumer/removal gate.

Do not copy the matcher implementation or full prefix array into multiple documentation files; link the enforcement map and checker.

- [ ] **Step 3.4 — Remove task labels as software ownership from direct-owner docs**

Rewrite builder-core instructions, README, and package-ownership status so builder-core, diagnostics, and deterministic rendering own responsibilities semantically. Retain dated/task labels only where the implementation sequence itself is the subject.

Add `INV-SEMANTIC-NAMING` to the enforcement map. Mark the generic repository contract/path scanner actual. Record the local ESLint adapter as temporary fast feedback through the final P1 implementation task, not as the canonical or public owner.

- [ ] **Step 3.5 — Amend the active rendering plan before its boundary RED**

Surgically change only its direct-consumer instructions:

- replace the instruction to rename a numbered task test title with the semantic rendering-boundary title;
- replace requirements that direct-owner documents “say” a numbered task label with semantic behavior/ownership assertions;
- add `check:semantic-naming`/constitution coverage to its coherent GREEN and final verification;
- retain its task headings, P1 provenance, evidence/review filenames, approval gates, and historical references.

Do not rewrite the rendering plan beyond these direct naming and verification consumers.

- [ ] **Step 3.6 — Amend the main P1 plan, including the requested ESLint sunset**

Make a surgical amendment to `docs/superpowers/plans/2026-08-05-p1-builder-kernel.md`; do not create a replacement main plan.

Add the generic naming contract to the global constraints and direct verification commands. In Task 8, after canonical-owner updates and before the final full-suite run, add one small sunset step:

1. run the permanent matcher/path/content/test-description equivalence matrix against every case covered by the temporary ESLint rule;
2. require `node scripts/check-semantic-naming.mjs`, `test:constitution`, and focused internal-linting tests to pass;
3. only then delete `scripts/eslint/no-sequencing-labels.mjs`, remove its import/plugin/config block, and remove the temporary extra ESLint invocation from `lint:builder`;
4. update `tests/package-boundaries/internal-linting.test.mjs` to require the permanent scanner and prove the temporary rule/config is absent;
5. rerun semantic naming, constitution, package-boundary, and builder lint checks;
6. if equivalence fails, retain the rule, record the gap, amend the plan, and stop rather than deleting coverage.

Keep `scripts/check-semantic-naming.mjs`, `tests/constitution/semantic-naming.test.mjs`, `check:semantic-naming`, and `INV-SEMANTIC-NAMING` permanently.

- [ ] **Step 3.7 — Run coherent GREEN**

```bash
rtk node scripts/check-semantic-naming.mjs
rtk node --test tests/constitution/*.test.mjs
rtk node --test tests/package-boundaries/*.test.mjs
rtk /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm run lint:builder
rtk /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm --filter @egeria-systems/builder-core run verify
rtk git diff --check
rtk git status --short --branch
```

Expected: no path/content/test-description finding; all historical-document contracts retain their meaning; the temporary lint layer is green; the proof, public standards API, dependencies, and lockfile are unchanged.

- [ ] **Step 3.8 — Commit only reviewable owned hunks and stop**

Use focused commits for the permanent contract, temporary adapter, and executable/direct-consumer cleanup. Before every commit, inspect the staged diff and prove that it excludes the user's functional-programming hunk and any unrelated rendering-plan content. If exact hunk ownership cannot be separated, stop for user direction rather than committing adjacent work.

The intended cleanup commit message is:

```bash
git commit -m "Enforce semantic repository names"
```

Stage the root instruction hunk only after its separate cached diff proves the user-owned adjacent hunk is absent.

Present the exact comparison, changed files, RED/GREEN results, and shared-file disposition. Stop for approval before final independent review.

## Task 4: Settled verification, independent review, and Gate 3 packet

**Files:**

- Create: dated semantic-naming verification evidence
- Create: dated semantic-naming review packet
- Modify implementation files only for a current, reproduced material finding

- [ ] **Step 4.1 — Freeze the coherent candidate**

Record base/candidate, commits, branch/ref freshness, status, worktrees, changed files, lockfile hash, and preserved user-owned work. Use commit comparisons that exclude unrelated working-tree changes.

- [ ] **Step 4.2 — Run the full relevant deterministic suite once**

```bash
rtk env CI=true /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm run test:constitution
rtk env CI=true /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm run test:package-boundaries
rtk env CI=true /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm run test:builder-core
rtk env CI=true /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm run lint:builder
rtk git diff --check ed33e97b4a9424a44c1b7d363584a43ca711c164...HEAD
rtk git status --short --branch
```

Do not repeat the compatibility proof, install dependencies, or run an audit: this change does not alter the proof or dependency graph. Record those limits explicitly.

- [ ] **Step 4.3 — Dispatch the required bounded read-only reviewers**

Provide the frozen comparison, approved plan, preparation evidence, changed-file list, taxonomy/exception contract, RED/GREEN output, and current tree to:

1. a requirements reviewer for the user's examples, all named surfaces, test descriptions, documentation exceptions, and requested sunset entry;
2. an architecture/anti-overengineering reviewer for single ownership, standards/proof isolation, false-positive control, and low-churn design;
3. a test-evidence reviewer for credible RED/GREEN, tracked/untracked path coverage, matcher/ESLint equivalence, historical-test preservation, and claim limits.

Prohibit edits, recursive delegation, GitHub comments, and external action. Treat reports as evidence and independently validate every finding.

- [ ] **Step 4.4 — Repair only verified material defects**

For each retained behavior defect, add a focused failing regression case before the minimum repair and rerun only the affected checks. Do not broaden the label list or documentation exceptions based only on taste.

- [ ] **Step 4.5 — Record verification and the Gate 3 packet**

The evidence and packet must include:

- exact comparison, changed files, and focused commits;
- the initial 37-line/six-file inventory and final zero-finding result;
- matcher, path classification, tracked/untracked enumeration, test-description, and ESLint results;
- all renamed descriptions and preserved historical assertions;
- reviewer reports and dispositions;
- proof that standards exports, compatibility proof, manifests, and lockfile are unchanged;
- exact main-plan Task 8 sunset wording and permanent surfaces that remain afterward;
- false-positive risks, expansion procedure, evidence limits, and source rollback through focused reverts;
- explicit statement that no dependency, publication, deployment, provider, push, or pull-request action occurred.

- [ ] **Step 4.6 — Commit gate artifacts and stop**

Commit only the settled evidence and review packet after their links and diff checks pass. Present the exact final comparison and stop for verified-final-diff approval. This approval does not authorize any external action or the future Task 8 sunset before its own sequential gate.

## Completion criteria

- One matcher owns the enforceable sequencing-label taxonomy.
- The permanent scanner covers tracked and non-ignored untracked paths plus authored executable/configuration/workflow/test/template/fixture text.
- Ordinary test and suite descriptions contain no sequencing label.
- Current APIs, errors, schemas, commands, paths, keys, and generated surfaces remain semantic.
- Historical/provenance documentation and its evidence assertions retain their meaning.
- Root instructions and the enforcement map name one canonical contract without duplicating its implementation.
- The local ESLint adapter reuses the matcher, is private to this repository, and leaves standards/proof boundaries unchanged.
- The active rendering plan cannot reintroduce numbered task vocabulary into its tests or direct-owner assertions.
- The main P1 plan contains the conditional Task 8 ESLint removal gate, and the permanent scanner/contract survives that removal.
- Required deterministic checks and reviews pass on the settled tree, with unrelated user work preserved.
