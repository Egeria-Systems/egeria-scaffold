# Generated Testing CI Repair Review Packet

**Review date:** 2026-08-12 (America/Toronto)

**Base:** `origin/main@2a315aa0e7dce1bf1048b9a2c07e318add9241de`

**Most recent hosted-green content:** `0ce8c0db3a14242aa287a530672e8742b00e521a`

**Current locally verified content:** `80b9b614c455bdf6de78fc79eded6b3a078f87c9`

**Outcome:** READY FOR FINAL DOCUMENTARY REVIEW; merge remains conditional on exact-head green checks, one eligible approving GitHub review, resolved threads, and repository rules.

## Scope and result

This packet supersedes the 2026-08-11 packet as the final readiness owner for merge request 2. The earlier packet remains the historical implementation record for its exact comparison.

The repair removes registry-dependent lockfile generation, preserves source ownership on failed exclusive writes, closes fixed-tuple schema cardinality, separates expensive CI by owned paths, reconciles current `main`, repairs two Linux/merge-ref CI assumptions, restores the live production-generation receipt counts, and centralizes pending-Changeset discovery without weakening application or workflow gates. All three retained generated fixtures are deterministic and all three applicable hosted workflows passed against exact content candidate `0ce8c0d`; the later shared-loader repair remains locally verified pending exact-head hosted checks.

No application capability, public package version or packed content, provider, deployment, credential, persistent data, production state, or certification status changed.

## Changed files

The final documentary comparison contains 114 paths. The original 101 implementation paths are listed exactly in the [historical implementation packet](2026-08-11-generated-unit-component-testing.md#changed-files). These 13 additional paths complete the repair and final evidence:

```text
.changeset/generated-testing-boundary.md
.gitignore
.github/workflows/compatibility-proof-quality.yml
.github/workflows/generated-project-quality.yml
docs/implementation-evidence/2026-08-12-generated-testing-ci-repair-preparation.md
docs/implementation-evidence/2026-08-12-generated-testing-ci-repair-verification.md
docs/review-packets/2026-08-12-generated-testing-ci-repair.md
docs/superpowers/plans/2026-08-11-generated-testing-ci-repairs.md
packages/builder-core/lockfiles/web-recipe-0.7.0/pnpm-lock.yaml
packages/builder-core/src/contracts/json-schemas.ts
packages/builder-core/tests/generate-project.integration.mjs
scripts/check-package-release.mjs
tests/package-boundaries/release-safeguards.test.mjs
```

The exact comparison is reproducible with:

```sh
git diff --name-only 2a315aa0e7dce1bf1048b9a2c07e318add9241de...HEAD
```

## Focused repair and reconciliation commits

- `6f2e558` — `fix: materialize recipe lockfile deterministically`
- `bfba450` — `docs: exclude concurrent certification work`
- `f8af04c` — `ci: scope deep verification to relevant changes`
- `d5668ab` — `fix: preserve generated contract integrity`
- `e9cb302` — `fix: fail closed on exclusive write errors`
- `ac7d516` — `Merge main into generated testing branch` (main reconciliation; not a repair-only revert candidate)
- `5c4c036` — `test: make cleanup identity check portable`
- `24ec499` — `ci: bind release intent to remote main`
- `93e4e9f` — `test: record generated no-release intent`
- `99b9d6e` — `docs: record generated testing CI verification`
- `d829988` — `docs: reconcile generated testing roadmap`
- `3f4ed20` — `docs: clarify generated testing authority`
- `8888a8d` — `docs: harden generated testing recovery`
- `592b706` — `docs: align generated testing recovery evidence`
- `0f25377` — `docs: separate generated testing recovery paths`
- `97c322c` — `docs: isolate generated testing repair history`
- `0ce8c0d` — `test: restore production generation coverage`
- `80b9b61` — `refactor: centralize changeset discovery`

The final recovery-evidence closure commit containing this packet is identified by the exact head at handoff because a commit cannot embed its own immutable object ID.

The historical packet owns the original implementation commits through merge `29628f9`. Repair-only recovery uses the first-parent, non-merge commits selected newest-first by `git log --first-parent --no-merges 29628f9..HEAD`; this excludes reconciliation merge `ac7d516` and all history reachable only through its accepted-main second parent, including `2a315aa`. Full-MR withdrawal is the complete `2a315aa0...HEAD` comparison and does not use a partial commit-revert list.

All branch commits contain SSH signatures. Local signature display cannot assign a signer because this checkout has no `gpg.ssh.allowedSignersFile`; GitHub signature status remains the remote policy boundary.

## Requirements and evidence

| Requirement | Evidence |
| --- | --- |
| Deterministic dependency graph | Checked recipe lockfile materialized byte-for-byte before isolated verification |
| Source preservation | Exclusive write failures never unlink a replaceable path; staging cleanup remains identity-owned |
| Exact schemas | Fixed tuples emit and test exact cardinality bounds |
| Accurate routine CI | Builder/package checks always-on; generated and proof matrices path-scoped without command weakening |
| Correct production generation | Live generation verifies the expanded `95`/`97` managed-surface receipts |
| Correct release intent | Pull requests compare with `origin/main`; the MR-owned empty Changeset records no bump; one shared loader owns sorted Markdown discovery and excludes `README.md` |
| Main reconciliation | Incoming observability source fingerprints retained; checked recipe lockfile/fingerprint retained and deterministically regenerated |
| Hosted execution | Exact candidate passed repository, compatibility, and generated-project workflows |
| Claim boundary | No deployment, provider, production, visual, performance, human-accessibility, or WCAG claim |

## Commands and results

The [verification evidence](../implementation-evidence/2026-08-12-generated-testing-ci-repair-verification.md) records exact local and hosted commands, candidates, run IDs, durations, RED causes, and GREEN results.

Final material results:

- `pnpm run verify:builder-kernel` — PASS at merged runtime candidate `ac7d516`, including 140/140 builder-core tests, 52/52 constitution tests, 20/20 capability tests, 8/8 generated-fixture tests, complete fixed-root checks, and no package bump.
- `pnpm run test:generated-project` — PASS 1/1 at `0ce8c0d`.
- `pnpm run test:package-boundaries` — PASS 45/45 at `80b9b61`.
- `pnpm exec changeset status --since origin/main` — PASS; no bump.
- `pnpm run check:package-release local` — expected `PENDING_CHANGESET` refusal while the two reviewed empty records remain unmaterialized.
- hosted `builder-and-packages` run `31591250486` at `0ce8c0d` — PASS.
- hosted `compatibility-proof` run `31591250469` at `0ce8c0d` — PASS.
- hosted `generated-projects` run `31591250506` at `0ce8c0d` — PASS.

## Independent review dispositions

| Review | Disposition |
| --- | --- |
| Requirements | Exclusive-write TOCTOU finding closed in `e9cb302`; main fingerprint resolution independently confirmed; recovery paths are separated; the shared loader preserves sorted Markdown discovery and `README.md` exclusion while literal inventory and byte assertions remain independent |
| Architecture and anti-overengineering | The roadmap and constitution consumer distinguish current Task 6C authority, certification boundaries, and CI ownership; exporting the repository-internal release loader adds no package API or import side effect and avoids an unnecessary new module |
| Test evidence | Exclusive-write race, portable cleanup identity, release base, retained Changeset inventory, production receipt counts, local suites, and hosted runs are bounded explicitly; loader RED/GREEN and 45/45 package boundaries cover the latest code repair |
| Merge-request thread audit | Two unresolved plan-safety findings were validated: portable rename is now explicitly bounded rather than described as hostile-concurrency no-clobber, and the plan, packet, and dated evidence now require separate recovery authorization and preserve unrelated user work; no GitHub reply or thread-resolution action was taken |

Reviewers are read-only and do not recursively fan out. Final exact-head dispositions and any evidence-backed repairs are reported at handoff; this packet does not predeclare their result.

## Risks and deferred work

- jsdom and automated Chromium/axe results remain bounded automation, not visual, assistive-technology, human-usability, or WCAG-conformance evidence.
- The hosted runs prove GitHub Ubuntu execution for the named checks, not deployment, provider behavior, production safety, performance, or security completeness.
- `observability@0.2.0` and `standards@0.3.0` remain pending separate certification tasks.
- Path-scoped workflows must be reconsidered before repository rules require those status names.
- Existing-repository mutation, migrations, later capabilities, `apps/jobs`, deployment, publication, provider mutation, and production remain deferred.
- Registry, audit, signature, dependency, and browser downloads are mutable point-in-time inputs.

## Rollback and recovery

If separately authorized after squash integration, revert only the resulting single integration commit through ordinary Git history, regenerate all three fixtures, and run `pnpm run verify:builder-kernel`.

Before integration, separately authorized repair-only recovery reverts, in displayed order, only the commits selected by `git log --first-parent --no-merges --format='%H' 29628f9..HEAD` in the isolated worktree. The first-parent selector excludes `ac7d516` and its accepted-main second-parent history, including `2a315aa`; staged, unstaged, untracked, and unrelated committed user work remain preserved. This leaves the original implementation plus accepted `main` reconciliation for inspection and re-verification.

Separately authorized full-MR withdrawal closes merge request 2 without merging and retains the branch/worktree as evidence; it reverts no branch commits and therefore cannot partially remove the 114-path `2a315aa0...HEAD` comparison or disturb accepted `main`. Any later disposal of that retained evidence is a separate action.

Never leave recipe lockfile bytes, fixture lockfiles, managed fingerprints, schemas, templates, state receipts, workflows, or release intent out of agreement. No persistent-data, provider, deployment, credential, publication, or production recovery applies.

## Merge gate

The user authorized push and merge after accurate applicable CI passes. Merge still requires the exact documentary head to pass applicable checks and the repository rules to report an eligible approving review and resolved threads. No rule bypass, deployment, publication, provider mutation, or review-comment response is authorized.
