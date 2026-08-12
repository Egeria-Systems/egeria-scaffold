# Dependabot-Compatible Action Pin Tests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task by task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow Dependabot to update actions used by live root workflows while retaining immutable full-commit-SHA pins and every existing workflow security boundary.

**Architecture:** One dependency-free test helper owns the live-workflow action-reference invariant: an exact expected `owner/repository` followed by `@` and exactly 40 lowercase hexadecimal characters. Root workflow policy tests consume that helper instead of duplicating release-specific SHAs; generator and retained-fixture tests keep exact byte-level pins because they enforce a separate deterministic product-artifact contract.

**Tech Stack:** Node.js `22.23.2`, Node test runner, JavaScript ES modules, YAML parsing through the existing builder-core dependency, pnpm `11.20.0`.

## Authority and predecessor

- **Direct predecessor:** Dependabot enablement merged by PR #1, commit `25b9840c4ad0a6a27c5a1203e31261dfac848d4e` (`Create dependabot.yml (#1)`). The merged PR and commit are the acceptance artifact for the dependency-update stream.
- **Ancestry:** `git merge-base --is-ancestor 25b9840c4ad0a6a27c5a1203e31261dfac848d4e HEAD` passed at `main@12ecc73a8337ab12ece9dd3a6b2aec03f940383c`.
- **Admission:** the dependency-free owning constitution suite passed 52/52 tests at the clean base. The pinned pnpm aggregate remains a final verification requirement; it was not used for preparation because the existing `node_modules` was created by a different pnpm and pnpm `11.20.0` correctly refused an unattended purge.
- The user explicitly approved this plan and its bounded local implementation on clean `main`. No push, pull request, merge, workflow dispatch, deployment, publication, provider mutation, permission change, or external message is authorized.

## Global Constraints

- Keep `.github/dependabot.yml` and every `.github/workflows/*.yml` file unchanged.
- Preserve exact action repository identity and require exactly 40 lowercase hexadecimal commit characters; tags, branches, short SHAs, uppercase SHA text, malformed references, and different repositories remain invalid.
- Preserve all existing trigger, permission, concurrency, runner, timeout, ref, `persist-credentials`, runtime, cache, secret-isolation, artifact, deployment-order, and revision-binding assertions.
- Do not loosen exact action pins in generated templates, builder-core generator tests, or retained generated fixtures.
- Add exactly one focused helper contract test file. Do not add any other tests.
- Touch no runtime, package, generated artifact, provider, deployment, or historical evidence behavior.

---

### Task 1: Record the reviewed implementation boundary

**Files:**
- Create: `docs/implementation-evidence/2026-08-12-dependabot-compatible-action-pin-tests-preparation.md`
- Create: `docs/superpowers/plans/2026-08-12-dependabot-compatible-action-pin-tests.md`

**Interfaces:**
- Consumes: merged Dependabot acceptance commit `25b9840c4ad0a6a27c5a1203e31261dfac848d4e`, repository governance, ADR-0011, and current GitHub secure-use and Dependabot documentation.
- Produces: exact scope, security invariant, test limit, predecessor evidence, and verification boundary for Tasks 2-4.

- [x] **Step 1: Verify branch, status, base, predecessor ancestry, and pinned tool binaries**
- [x] **Step 2: Run the dependency-free owning baseline and record its result**
- [x] **Step 3: Obtain independent read-only plan review and reconcile every material finding**
- [x] **Step 4: Save this exact-file plan and dated preparation evidence**

### Task 2: Define the live-workflow full-SHA invariant through one RED/GREEN cycle

**Files:**
- Create: `tests/helpers/github-actions.mjs`
- Create: `tests/constitution/github-actions.test.mjs`

**Interfaces:**
- Produces: `isPinnedGitHubActionReference(reference, expectedRepository): boolean`.
- Contract: return `true` only when `reference` is a string containing the exact `expectedRepository`, one `@`, and exactly 40 lowercase hexadecimal characters.

- [x] **Step 1: Create the helper as a deliberate false-returning stub**

```js
export function isPinnedGitHubActionReference() {
  return false;
}
```

- [x] **Step 2: Add the single focused contract test**

The one test must accept two literal full-SHA references and reject a tag, short SHA, non-hex SHA, uppercase SHA, wrong repository, and non-string input. No other test is added.

- [x] **Step 3: Run the focused test and verify RED**

Run:

```bash
node --test tests/constitution/github-actions.test.mjs
```

Expected: FAIL because the first valid reference returns `false`.

- [x] **Step 4: Implement the minimum pure predicate**

```js
export function isPinnedGitHubActionReference(
  reference,
  expectedRepository,
) {
  if (typeof reference !== "string") {
    return false;
  }

  const separatorIndex = reference.lastIndexOf("@");

  return (
    separatorIndex > 0 &&
    reference.slice(0, separatorIndex) === expectedRepository &&
    /^[0-9a-f]{40}$/u.test(reference.slice(separatorIndex + 1))
  );
}
```

- [x] **Step 5: Rerun the focused test and verify GREEN**

Run the same Node test command. Expected: one test passes with zero failures.

### Task 3: Reuse the invariant in every live root workflow policy assertion

**Files:**
- Modify: `tests/constitution/constitution.test.mjs`
- Modify: `tests/package-boundaries/package-release.test.mjs`
- Test: `tests/constitution/github-actions.test.mjs`

**Interfaces:**
- Consumes: `isPinnedGitHubActionReference(reference, expectedRepository): boolean` from Task 2.
- Produces: version-agnostic full-SHA enforcement for live `actions/checkout`, `pnpm/setup`, and `actions/upload-artifact` references.

- [x] **Step 1: Import the shared helper into both existing policy-test files**
- [x] **Step 2: Replace exact live-workflow SHA equality or regex assertions with helper assertions using the exact expected repository name**
- [x] **Step 3: Confirm the two policy-test files contain none of the current action SHAs and that generated-artifact exact pins remain untouched**
- [x] **Step 4: Run the focused owning checks**

```bash
node --test tests/constitution/*.test.mjs
node --test tests/package-boundaries/*.test.mjs
node scripts/check-semantic-naming.mjs
git diff --check
```

Expected: every command exits 0.

### Task 4: Verify, independently review, and stop at final-diff approval

**Files:**
- Create: `docs/review-packets/2026-08-12-dependabot-compatible-action-pin-tests.md`
- Modify: `docs/implementation-evidence/2026-08-12-dependabot-compatible-action-pin-tests-preparation.md`

**Interfaces:**
- Consumes: settled implementation diff and all verification receipts.
- Produces: review packet for verified-final-diff approval.

- [x] **Step 1: Resolve the existing dependency installation with pinned pnpm `11.20.0` without changing dependency inputs**
- [x] **Step 2: Run the full relevant deterministic gate once**

```bash
/Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm run verify:builder-packages:quality
```

- [x] **Step 3: Dispatch three non-overlapping independent read-only reviews**

The requirements reviewer checks exact scope and non-goals; the architecture and anti-overengineering reviewer checks ownership, abstraction cost, and security; the test-evidence reviewer checks RED/GREEN credibility, assertion strength, test count, and claim limits. Reviewers must not edit, contact GitHub, or spawn recursively.

- [x] **Step 4: Reconcile findings and repair only evidence-backed material defects**
- [x] **Step 5: Run affected checks after any repair, then run final status, diff, changed-file, current-SHA scan, and `git diff --check` inspections**
- [x] **Step 6: Complete the evidence and review packet and stop for verified-final-diff approval**

Recovery is local and source-only: revert the bounded changed files and rerun the owning tests. No dependency, workflow, provider, deployment, persistent-data, or production recovery applies because none is changed or authorized.
