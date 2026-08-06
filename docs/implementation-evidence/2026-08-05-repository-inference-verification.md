# Read-Only Repository Inference Verification Evidence

**Execution date:** 2026-08-05 (America/Toronto)

**Status:** Task 4 implementation, evidence-backed repairs, independent re-review, and final verification are complete. The user's advance authorization ends at this checkpoint; Task 5 has not begun.

**Implementation comparison:** `dd02cde0278be357f92a87dec8e7f06454fd5b91..1ce45f10bff4abf50e8a27c97b230385ca063e73`

**Commits:**

- `7ad08dc` — `Infer repository capabilities`
- `6967e2f` — `Harden repository inference`
- `1ce45f1` — `Bind repository root identity`

The implementation ran on the approved sequential local `main` stream. At final source verification the worktree was clean and `main` was thirty-one commits ahead of unrefreshed local `origin/main`. Remote refs were not fetched because no remote integration or publication was authorized.

## Implemented boundary

Task 4 adds:

- a fixed-construction-identity filesystem reader and a deterministic in-memory reader;
- safe relative-path validation before access;
- root, ancestor, and leaf identity/type checks without following requested-path symlinks;
- read-only file-handle identity comparison, repeated ancestor checks, a 1 MiB text cap, fatal UTF-8 decoding, and guaranteed close attempts;
- deterministic file, RFC 6901 JSON-value, and exact package-version probe evidence;
- state-aware `confirmed`, `probable`, `partial`, `contradictory`, and `ambiguous` capability classification;
- order-independent comparison for classification sets;
- valid-state managed and merge-managed drift evidence plus no-read application-owned/ejected evidence;
- one-read-per-path caching within an inference call; and
- direct package-root exports for every approved reader and inference type.

It creates no doctor, diff, user-facing diagnostic, repository report, `.egeria` file, state update, migration, plan, transformation, CLI behavior, provider resource, or Task 5+ runtime surface.

## TDD record

### Initial RED

Tests and exact package-boundary expectations preceded production files.

```text
rtk env CI=true /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm --filter @egeria-systems/builder-core run build
exit 0; unchanged Task 3 source built successfully

rtk node --test packages/builder-core/tests/inference.test.mjs
expected exit 1; 0 passed, 12 failed on absent reader and inference exports

rtk node --test tests/package-boundaries/private-packages.test.mjs
expected exit 1; 4 passed, 2 failed on absent Task 4 source and boundary documentation
```

The failures were requirement-specific missing-feature failures, not loader, dependency, platform, or fixture errors.

### Initial GREEN

The first TypeScript build found narrow union-return and JSON-value type errors. Specific non-file result types and a `JsonValue` return type corrected those compile-time boundaries. Two package-boundary expectations then needed their default lexical file order and case-sensitive documentation assertion corrected.

After those development corrections:

```text
inference.test.mjs: 12/12 passed
builder-core aggregate tests: 42/42 passed
package-boundary tests: 22/22 passed
constitution tests: 13/13 passed
typecheck and zero-warning lint passed
```

### Review-repair RED and GREEN

The first review repair tests produced three causal failures:

```text
rtk node --test packages/builder-core/tests/inference.test.mjs
expected exit 1; 13 passed, 3 failed on missing probe-evidence root exports, cross-read root replacement, and classification-set ordering
```

The repair exported the two missing probe evidence types, compared state classifications as sets, and retained one root identity across reads. Test-evidence findings also added exact state-kind/code assertions, precedence intersections, merge-managed JSON drift, and a compile-only root consumer. The focused suite passed 16/16 and the aggregate suite passed 46/46.

Scoped re-review then identified that root identity was still captured lazily on first read rather than at factory construction. A focused RED run passed the classification negative control but failed the pre-first-read root replacement scenario 1/2. Construction-time synchronous identity capture repaired the fixed-root contract. Final focused tests passed 17/17 and final aggregate builder-core tests passed 47/47.

## Final commands and results

| Command | Result |
| --- | --- |
| `pnpm --filter @egeria-systems/builder-core run verify` | exit `0`; build, checked schemas, 47/47 tests, no-emit typecheck, and zero-warning lint passed |
| `pnpm run test:package-boundaries` | exit `0`; 22/22 passed, including the exact private source and documentation boundary |
| `pnpm run test:constitution` | exit `0`; 13/13 passed, including local Markdown links |
| `git diff --check` | exit `0` |
| no-Task-5/runtime-write search under `packages/builder-core/src` | no matches |
| `git status --short --branch` | clean `main...origin/main [ahead 31]` before gate artifacts |

No compatibility proof was rerun because Task 4 changes no root workflow, Next/OpenNext/Cloudflare proof, runtime pin, lockfile, or generated application behavior.

## Independent review dispositions

All reviews inspected frozen candidate `dd02cde..7ad08dc`. Scoped re-reviews inspected `7ad08dc..6967e2f` and, where needed, `6967e2f..1ce45f1`.

- **Requirements:** found positional comparison of the canonical classification set could create false metadata drift. Repaired with equal-cardinality set comparison and positive/negative causal coverage; re-reviewed as addressed with no new material findings.
- **Architecture and anti-overengineering:** independently confirmed the set-semantics defect. Re-reviewed the set, root-identity, type-export, and test repairs as cohesive and within the approved read-only boundary; no new material findings.
- **Test evidence:** found exact state variants, precedence intersections, merge-managed JSON drift, and public type exports insufficiently protected. All coverage was added. Its first re-review found pre-first-read replacement and the set negative control missing; both were added and the final re-review reported addressed with no new material findings.
- **Filesystem and security:** found independently validating the root per read could combine state from one repository identity with probes from a replacement. The reader now captures identity at construction and rejects later mismatch. Both after-first-read and before-first-read replacement regressions pass; final re-review reported no new material filesystem/security finding.

Reviewers were read-only and performed no repository edit, recursive delegation, GitHub action, workflow dispatch, deployment, provider call, or external mutation.

## Evidence limits and residual risks

- The filesystem reader narrows time-of-check/time-of-use exposure with construction identity, open-handle identity, and repeated ancestor checks. It does not claim protection against a hostile kernel, privileged concurrent mutation, or unusual network-filesystem identity semantics.
- Filesystem reads are valid UTF-8 text capped at 1 MiB. Binary and larger managed surfaces remain outside this increment.
- The in-memory reader and custom `RepositoryReader` implementations are trusted test/application ports; the exported filesystem adapter owns the concrete containment and size boundary.
- Evidence exposes declared stable identifiers and paths plus valid installed state by contract. It never returns actual probed JSON values, actual repository package versions, raw source content, OS paths, or OS error messages.
- Node `22.23.0` remains the accepted pin; no runtime-security or future-vulnerability claim is made.
- Static/unit checks do not establish deployment, production security, accessibility, translation, visual quality, or human usability.

## Rollback and recovery

- Revert `1ce45f1`, `6967e2f`, and `7ad08dc` with new focused revert commits; do not reset shared `main`.
- Rebuild builder-core after source rollback. Ignored `dist` output is reproducible and non-authoritative.
- No dependency or lockfile rollback exists.
- Inference is read-only: no `.egeria` state, migration record, persistent data, deployment, provider resource, or external system requires recovery.

## Gate disposition

Task 4 meets its implementation and review checkpoint. The exact verified implementation comparison is `dd02cde0278be357f92a87dec8e7f06454fd5b91..1ce45f10bff4abf50e8a27c97b230385ca063e73`. The final committed comparison will also include this evidence and the review packet. Task 5 and all external actions remain unauthorized pending explicit user direction.
