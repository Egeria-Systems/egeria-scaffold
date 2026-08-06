# P1 Task 5 Review Packet — Read-Only Project Diagnostics

**Date:** 2026-08-05 (America/Toronto)

**Outcome:** PASS after evidence-backed repairs. Stop before Task 6.

**Verified source comparison:** `5dafb380701334e72237f98fe7cde0c080f79086..1756b7d5685a463000e667621b5305ed570177f4`

## Scope

Private builder-core now owns deterministic, content-safe, read-only `doctorRepository` and `diffProject` APIs. One internal inspection boundary composes the existing `.egeria` codecs, capability resolver, repository inference, ownership evidence, and a per-operation promise cache. Doctor returns the exact ten stable codes; diff returns the exact six structural kinds. Both handle invalid required controls without throwing or fabricating derived differences, sort and deduplicate output, and read each path at most once per operation.

Diagnostics are evidence only. They do not authorize or perform repository changes.

No generated skeleton, template, planner, transformation, state update, migration, CLI behavior, dependency, lockfile, provider action, persistent data, deployment, or Task 6+ runtime surface is included.

## Changed files

- `docs/architecture/enforcement-map.md` — records only the tested read-only desired/installed/inferred and drift gates as actual.
- `docs/architecture/package-ownership.md` — advances the private builder-core API and stage boundary through Task 5.
- `packages/builder-core/AGENTS.md` — makes read-only diagnostics current while preserving later-stage prohibitions.
- `packages/builder-core/README.md` — documents the doctor/diff boundary and evidence limits.
- `packages/builder-core/src/diagnostics/diff-project.ts` — implements explicit structural differences and invalid-control short-circuiting.
- `packages/builder-core/src/diagnostics/doctor.ts` — implements stable diagnostic mapping, ordering, deduplication, and health.
- `packages/builder-core/src/diagnostics/project-inspection.ts` — composes fixed control reads, resolution, and inference without using rejected catalogs.
- `packages/builder-core/src/index.ts` — exports only the approved doctor/diff functions and result types.
- `packages/builder-core/src/inference/infer-repository.ts` — reuses the shared internal reader cache without changing inference policy.
- `packages/builder-core/src/repository/cache-reader.ts` — owns the internal per-operation promise cache.
- `packages/builder-core/tests/diagnostics.test.mjs` — protects exact API, policy, ordering, invalid inputs, content safety, caching, and no-write behavior.
- `tests/package-boundaries/private-packages.test.mjs` — enforces the exact Task 5 source and direct-owner boundary.

Gate artifacts outside the frozen source comparison:

- `docs/implementation-evidence/2026-08-05-read-only-project-diagnostics-verification.md`
- `docs/review-packets/2026-08-05-read-only-project-diagnostics.md`

The separately owned root `AGENTS.md` edit is not a Task 5 changed file and is absent from the implementation commits and comparison.

## Verification summary

- Initial RED: diagnostics 0/16 and private boundaries 4/6, failing only on absent Task 5 API/files/owners.
- First review-repair RED: diagnostics 20/22, failing on profile-default misclassification and malformed-catalog exception.
- Combined-failure RED: focused diff test 0/1, failing because the valid project contract failure was omitted beside invalid state.
- Final builder-core verification: 69/69 tests plus build, checked schemas, typecheck, and zero-warning lint.
- Final package boundaries: 22/22.
- Final constitution: 13/13.
- `git diff --check`: pass.
- Negative write/process/generic-port/later-capability source search: no matches.
- Temporary filesystem snapshots: identical path/type/content bytes before and after doctor and diff.
- Final Task 5 source tree: committed; only the unrelated user-owned root `AGENTS.md` edit remained unstaged.

Full commands, invocation corrections, exact results, and evidence limits are in the [verification evidence](../implementation-evidence/2026-08-05-read-only-project-diagnostics-verification.md).

## Review dispositions

| Review | Material finding | Disposition |
| --- | --- | --- |
| Requirements | Profile-owned missing defaults were reported as project-selected unknowns; combined invalid state plus failed project resolution omitted the project difference | Both received causal tests and repairs; final bounded re-review found no material issue |
| Architecture/anti-overengineering | None | Private ownership, canonical reuse, functional boundaries, and scope were accepted with no material improvement |
| Test evidence | Six gaps in invalid-control, cache-sharing, inference-category, severity-order, exact-union, and ejected-surface protection | All mutation-sensitive checks added; bounded re-review closed all six |
| Input-format/security | A schema-invalid runtime catalog could reach inference and throw before resolver validation | Resolution now gates catalog-backed inference; malformed JS input returns stable safe results; bounded re-review closed the finding |

No material finding remains. No reviewer edited the repository or took external action.

## Risks and deferred work

- Filesystem no-write evidence proves tree shape and bytes, not unchanged access timestamps or hostile-kernel guarantees.
- Custom `RepositoryReader` implementations remain trusted ports and must honor their explicit result contract.
- Task 6 owns deterministic portfolio/site skeleton generation. CLI behavior, transformations, migrations, providers, later capabilities, deployment, and generated-application behavior remain deferred.
- Node `22.23.0` remains pinned while official Node `22.23.2` contains relevant HIGH-severity security fixes. A separate compatibility/security increment is required before P1 completion or a current-security/release claim; this packet does not authorize it.
- No accessibility-conformance, translation, visual, deployment, production-safety, or human-usability claim is made.

## Rollback and recovery

Revert `1756b7d`, `f60140d`, then `d8b7b55` with focused revert commits and rebuild builder-core. Revert the gate-artifact commit separately if needed. No dependency, lockfile, `.egeria` state, persistent-data, deployment, or provider recovery is required.

## Approval boundary

This packet requests verified-final-diff approval for P1 Task 5 only. Approval does not authorize Task 6, the Node pin increment, push, pull request, merge, workflow dispatch, publication, deployment, provider mutation, production action, permission change, external message, or review-comment response.
