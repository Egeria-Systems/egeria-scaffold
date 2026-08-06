# Read-Only Project Diagnostics Verification Evidence

**Execution date:** 2026-08-05 (America/Toronto)

**Status:** P1 Task 5 implementation, evidence-backed repairs, independent re-review, and settled verification are complete. Verified-final-diff approval remains pending.

**Planning gate:** `5dafb380701334e72237f98fe7cde0c080f79086`

**Verified source comparison:** `5dafb380701334e72237f98fe7cde0c080f79086..1756b7d5685a463000e667621b5305ed570177f4`

**Commits:**

- `d8b7b55` — `Add read-only project diagnostics`
- `f60140d` — `Harden project diagnostics inputs`
- `1756b7d` — `Report combined diagnostic failures`

The implementation used the approved sequential local `main` stream. At settled source verification, local `main` was thirty-seven commits ahead of unrefreshed local `origin/main`. Remote refs were not fetched because the approved local P1 sequence and current official documentation, not remote integration, owned this increment. The worktree contained one user-owned root `AGENTS.md` edit outside Task 5. It remained unstaged, uncommitted, and absent from every comparison and commit above.

## Implemented boundary

Task 5 adds:

- a shared internal promise cache that reads each repository path at most once per doctor/diff operation;
- one internal inspection boundary for the three required `.egeria` control files, validated desired resolution, existing repository inference, and no raw content;
- `doctorRepository` with the exact ten stable codes, severity-first deterministic ordering, duplicate suppression, and explicit desired/installed/inferred/surface policy;
- `diffProject` with the exact six structural kinds, invalid-control short-circuiting, deterministic ordering, and duplicate suppression;
- content-safe handling for missing, symlinked, unreadable, malformed, version-incompatible, and runtime-invalid catalog inputs;
- exact public type-union checks, canonical minimal and portfolio fixtures, read-once coherence, and temporary-filesystem no-write checks; and
- direct builder-core ownership and enforcement documentation through Task 5.

The implementation creates no `.egeria` file, state update, migration record, generated repository, template, planner, transformation, CLI behavior, provider resource, persistent data, deployment, or Task 6+ runtime surface. Diagnostic evidence neither authorizes nor performs a repository change.

## TDD record

### Initial RED

Tests and the exact private source/documentation boundary preceded runtime implementation.

```text
rtk env CI=true /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm --filter @egeria-systems/builder-core run build
exit 0; unchanged Task 4 source built successfully

rtk node --test packages/builder-core/tests/diagnostics.test.mjs
expected exit 1; 0 passed, 16 failed on absent Task 5 exports, types, and functions

rtk node --test tests/package-boundaries/private-packages.test.mjs
expected exit 1; 4 passed, 2 failed on absent Task 5 files and direct-owner wording
```

The failures were caused by the missing approved behavior and boundary, not dependency, loader, fixture, or platform failures.

### Initial GREEN and development command corrections

The shared cache, control inspection, doctor, diff, root exports, tests, and direct owners produced:

```text
diagnostics.test.mjs: 17/17 passed
inference.test.mjs: 17/17 passed
private-packages.test.mjs: 6/6 passed
constitution: 13/13 passed
build, no-emit typecheck, zero-warning lint, and git diff --check passed
```

Two command-invocation failures did not exercise product behavior:

- an unquoted `read-once|control file` test-name pattern was parsed by the shell and exited `127` with `command not found: control file` plus an `EPIPE`; the quoted command ran the intended focused control-file tests successfully;
- direct pnpm typecheck and lint invocations without `CI=true` stopped before their scripts with `ERR_PNPM_META_FETCH_FAIL` and `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`; the same pinned commands under the repository's CI environment ran from the existing workspace and passed.

### Review-repair RED and GREEN

Requirements and input-format/security review found two runtime defects. The first repair tests produced causal failures:

```text
rtk node --test packages/builder-core/tests/diagnostics.test.mjs
expected exit 1; 20 passed, 2 failed
```

The failures proved that:

- a missing profile-default capability was mislabeled as an unknown project-selected capability; and
- a schema-invalid runtime catalog reached inference first and threw `TypeError: probes is not iterable`.

The repair resolves validated project intent before catalog-backed inference, reports `PROJECT_CAPABILITY_UNKNOWN` only for an identifier actually present in validated `selectedCapabilities`, and keeps rejected catalogs out of inference. Test-evidence review also added mutation-sensitive coverage for invalid-state/migration short-circuiting, shared control/probe cache paths, partial and ambiguous diff branches, severity-first sorting, bidirectional exact unions, and ejected-surface suppression.

Requirements re-review then found combined state and project control failures were not both reported by diff. A focused regression produced:

```text
rtk node --test --test-name-pattern='diff short-circuits' packages/builder-core/tests/diagnostics.test.mjs
expected exit 1; 0 passed, 1 failed because only the state path was returned
```

Inspection now resolves every valid project while keeping invalid controls or rejected resolution out of inference. Diff independently reports all invalid control contracts. Focused and complete diagnostics tests then passed 22/22, prior inference tests passed 17/17, and build, typecheck, lint, and diff hygiene passed.

## Settled commands and results

| Command | Result |
| --- | --- |
| `rtk env CI=true /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm --filter @egeria-systems/builder-core run verify` | exit `0`; build, checked schemas, 69/69 tests, no-emit typecheck, and zero-warning lint passed |
| `rtk env CI=true /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm run test:package-boundaries` | exit `0`; 22/22 passed |
| `rtk env CI=true /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm run test:constitution` | exit `0`; 13/13 passed |
| negative write/process/generic-port/later-capability source search | exit `1`; no matches, as expected |
| `rtk git diff --check` | exit `0` |
| `rtk git status --short --branch` | only the separately owned root `AGENTS.md` edit remained; Task 5 source was committed |

The compatibility proof was not rerun. Task 5 changes no root runtime pin, lockfile, Next/OpenNext/Cloudflare proof, generated application, workflow, or deployed behavior.

## Independent review dispositions

All reviewers inspected frozen candidate `5dafb38..d8b7b55`. Relevant follow-ups inspected `d8b7b55..f60140d` and `f60140d..1756b7d`.

- **Requirements:** found profile-owned unknown defaults were mislabeled as project selections. After repair, re-review found combined invalid state plus failed project resolution incomplete in diff. Both defects received causal tests and focused repairs; final re-review reported no material finding.
- **Architecture and anti-overengineering:** reported no material finding. The private ownership, functional-core/imperative-shell split, canonical codec/resolver/inference/fingerprint reuse, shared promise cache, and Task 5 scope remained cohesive.
- **Test evidence:** found six material protection gaps: invalid-control short-circuit/content safety, cross-layer cache sharing, partial/ambiguous diff branches, severity-first sorting, exact unions, and isolated ejected suppression. All received mutation-sensitive tests; bounded re-review closed all six.
- **Input-format/security:** found rejected catalogs could reach inference before resolver validation and crash public JavaScript callers. Inspection now validates/resolves before catalog-backed inference and returns only control evidence on rejection. Bounded re-review closed the finding with no remaining input/security defect.

Reviewers were read-only and performed no repository edit, recursive delegation, GitHub comment, workflow dispatch, deployment, provider call, or external mutation.

## Evidence limits and residual risks

- No-write tests compare temporary repository path/type structure, symlink targets where present, and exact file bytes before and after each API. They do not claim that ordinary filesystem access timestamps are unchanged.
- The existing filesystem reader bounds text to valid UTF-8 at 1 MiB and defends its fixed root and requested paths. Hostile-kernel behavior, privileged concurrent mutation, and unusual network-filesystem identity semantics remain outside the evidence.
- Exported `RepositoryReader` implementations are trusted ports. Doctor/diff normalize explicit repository results; they do not catch programming errors or rejected promises from a contract-violating custom reader.
- Diagnostics expose only validated stable capability identifiers, validated relative paths, and fixed codes/tokens. They do not expose source excerpts, rejected package values, fingerprints, credentials, tokens, or parser prose.
- The repository remains pinned to Node `22.23.0`. The preparation evidence records that official Node `22.23.2` is a security release fixing multiple HIGH-severity Node 22 issues. Task 5 does not use the affected services as its containment boundary, so local implementation was not blocked, but a separate compatibility/security increment is required before P1 completion or release evidence can make a current-security claim.
- Static and unit checks do not establish deployment, production safety, generated-skeleton correctness, accessibility conformance, translation quality, visual quality, or human usability.

## Rollback and recovery

- Revert `1756b7d`, `f60140d`, then `d8b7b55` with new focused revert commits; do not reset shared `main`.
- Rebuild builder-core after source rollback. Ignored `dist` output is reproducible and non-authoritative.
- Revert the final gate-artifact commit separately if the verification record and packet must be withdrawn.
- No dependency or lockfile rollback exists.
- No `.egeria` state, migration record, generated repository, persistent data, deployment, provider resource, or external system requires recovery.

## Gate disposition

Task 5 meets its implementation and review checkpoint. The exact verified source comparison is `5dafb380701334e72237f98fe7cde0c080f79086..1756b7d5685a463000e667621b5305ed570177f4`. The final committed handoff comparison will also include this evidence and the review packet. Task 6, the separate Node pin increment, and every external action remain unauthorized pending explicit verified-final-diff approval.
