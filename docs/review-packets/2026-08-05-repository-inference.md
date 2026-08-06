# P1 Task 4 Review Packet — Read-Only Repository Inference

**Date:** 2026-08-05 (America/Toronto)

**Outcome:** PASS after evidence-backed repairs. Stop before Task 5.

**Verified implementation comparison:** `dd02cde0278be357f92a87dec8e7f06454fd5b91..1ce45f10bff4abf50e8a27c97b230385ca063e73`

## Scope

Private builder-core now owns fixed-root read-only text access plus deterministic state, capability, probe, and ownership evidence. The adapter rejects unsafe paths, root replacement, requested-path symlinks, unsupported file types, oversized text, invalid UTF-8, and unsafe read uncertainty with stable content-free results. Inference accesses only state, declared probes, and valid-state managed surfaces.

No doctor/diff policy, repository write, report, `.egeria` update, migration, planner, transformation, CLI behavior, provider action, or Task 5+ runtime surface is included.

## Changed files

- `docs/architecture/enforcement-map.md`
- `docs/architecture/package-ownership.md`
- `packages/builder-core/AGENTS.md`
- `packages/builder-core/README.md`
- `packages/builder-core/src/index.ts`
- `packages/builder-core/src/inference/evaluate-probe.ts`
- `packages/builder-core/src/inference/infer-repository.ts`
- `packages/builder-core/src/repository/repository-reader.ts`
- `packages/builder-core/tests/inference.test.mjs`
- `tests/package-boundaries/private-packages.test.mjs`

Gate artifacts outside the frozen implementation comparison:

- `docs/implementation-evidence/2026-08-05-repository-inference-verification.md`
- `docs/review-packets/2026-08-05-repository-inference.md`

## Verification summary

- Initial RED: Task 4 tests 0/12 and private boundary tests 4/6, failing on absent Task 4 behavior and owners.
- First review-repair RED: focused tests 13/16, failing on the three validated runtime/API defects.
- Final review-repair RED: targeted tests 1/2, failing only on pre-first-read root replacement.
- Final builder-core verification: 47/47 tests plus build, schema check, typecheck, and zero-warning lint.
- Final package boundaries: 22/22.
- Final constitution: 13/13.
- `git diff --check`: pass.
- No Task 5 or runtime write surface found.
- Final implementation tree: clean.

Full commands, development corrections, claim limits, and exact results are in the [verification evidence](../implementation-evidence/2026-08-05-repository-inference-verification.md).

## Review dispositions

| Review | Material finding | Disposition |
| --- | --- | --- |
| Requirements | Classification sets were compared positionally | Fixed as equal-cardinality sets; positive and negative regressions pass; no new finding |
| Architecture/anti-overengineering | Same set-semantics defect; repair cohesion and scope needed confirmation | Fixed; reader/type/test repairs remain narrow and evidence-only; no new finding |
| Test evidence | Exact state variants, precedence intersections, JSON drift, root types, pre-read root replacement, and negative set control were under-protected | All causal checks added; final re-review addressed with no new finding |
| Filesystem/security | Per-read root rebinding could mix state and probe evidence from different repositories | Root identity fixed at construction and checked every read; both replacement timings rejected; no new finding |

No material finding remains. No reviewer edited the repository or took external action.

## Risks and deferred work

- Hostile-kernel, privileged race, and unusual network-filesystem guarantees are not claimed.
- Binary and text files larger than 1 MiB remain unsupported by this reader.
- Task 5 owns doctor/diff diagnostics and policy. Generation, transformation, CLI behavior, providers, later capabilities, and persistent-data behavior also remain deferred.
- Node `22.23.0` remains pinned; a later patch update needs separate compatibility proof.
- No dependency, lockfile, `.egeria` state, provider, deployment, accessibility, or production-safety claim is part of this increment.

## Rollback and recovery

Revert `1ce45f1`, `6967e2f`, then `7ad08dc` with focused revert commits and rebuild builder-core. No dependency, `.egeria`, persistent-data, deployment, or provider recovery is required.

## Approval boundary

This packet closes the two-task advance-authorized implementation run at Task 4. The full committed comparison, including this packet, requires the repository's separate final-diff approval. Task 5, push, pull request, workflow dispatch, deployment, publication, provider mutation, production action, permissions change, external message, and review-comment response remain unauthorized.
