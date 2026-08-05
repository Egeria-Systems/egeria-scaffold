# Semantic Executable Naming Preparation Evidence

**Evidence date:** 2026-08-05

**Scope:** Read-only inventory and current official-source review for normalizing roadmap-phase labels out of live executable names before P1 Task 3.

**Implementation status:** Not started. This record supports the separately approval-gated Task 2A plan and does not authorize code changes.

## Exact repository state

- Branch: local `main`
- HEAD: `3d2f0042bb7993a1e745c36b81962677a9a27b43` (`Resolve P1 capabilities`)
- Worktree: clean
- Remote refs: not fetched because this naming-only plan depends on the accepted local P1 sequence, not remote freshness
- P1 plan SHA-256 before this amendment: `a8ab503b6688e22d678c15d399611a4011db3f86e7e66efcce7ddcabc784aa22`
- Lockfile SHA-256: `f454284272a7ee9932d9470f288b72ac1479b3c806807dfdff3591fe9dea8fc0`

## Decision and classification

Roadmap phase labels describe delivery order and historical provenance. They do not describe the responsibility of a source module, API symbol, error identifier, package script, workflow command, schema title, generated path, or ordinary test boundary. Live executable names therefore use domain or responsibility language.

Phase labels remain valid only where the phase is the subject of the artifact:

- roadmap headings and task/gate references;
- dated plans, implementation evidence, compatibility records, and review packets;
- historical phase status in current architecture documentation;
- phase-specific invariant identifiers and tests whose purpose is to validate that historical record.

Those historical artifacts are not rewritten because doing so would falsify the exact commands and names used by accepted earlier stages.

## Current live naming inventory

The current tree contains these phase-labelled executable names:

| Surface | Current name | Semantic replacement |
| --- | --- | --- |
| builder-core source | `catalog/p1-capabilities.ts` | `catalog/capability-catalog.ts` |
| builder-core source | `profiles/p1-profiles.ts` | `profiles/profile-recipes.ts` |
| exported type | `P1PackageVersions` | `CapabilityPackageVersions` |
| exported function | `createP1CapabilityCatalog` | `createCapabilityCatalog` |
| exported value | `p1ProfileRecipes` | `profileRecipes` |
| stable issue code | `P1_PACKAGE_VERSION_INVALID` | `CAPABILITY_PACKAGE_VERSION_INVALID` |
| profile JSON Schema title | `Egeria P1 profile recipe` | `Egeria portfolio and site profile recipe` |
| root script | `build:p0.3` | `build:builder` |
| root script | `lint:p0.3` | `lint:builder` |
| root script | `typecheck:p0.3` | `typecheck:builder` |
| root script | `verify:p0.2` | `verify:compatibility-proof` |
| root script | `verify:p0.3` | `verify:builder-packages` |

The same atomic change normalizes ordinary current-behavior test titles:

| Current test title | Semantic replacement |
| --- | --- |
| `builder-core exports the executable P1 contract boundary` | `builder-core exports the executable contract boundary` |
| `the P1 catalog declares the exact six executable capability contracts` | `the portfolio and site catalog declares the exact six executable capability contracts` |
| `P1 package versions must be exact stable releases and issues do not echo inputs` | `capability package versions must be exact stable releases and issues do not echo inputs` |
| `P1 keeps schemas private and reserves every later-stage builder surface` | `builder-core keeps schemas private and reserves every later-stage builder surface` |
| `the root workspace remains private and pins the P0.2 toolchain` | `the root workspace remains private and pins the compatibility-proof toolchain` |

Direct consumers exist in builder-core exports/tests, package-boundary and constitution tests, the root README and contributing guide, and the manual compatibility workflow. No public package exports or generated repository contracts currently consume these names.

The active P1 plan also contains two future phase-labelled executable names. Task 2A replaces planned `p1-release-catalog.ts` with `verified-package-versions.ts` and planned `verify:p1` with `verify:builder-kernel` before either is implemented.

No other live source, API, script, workflow, configuration key, schema identifier/title, error code, generated path, or ordinary current-behavior test identifier uses a `pX`/`PX` phase label. P0.1, P0.2, P0.3, P1, P2, and later labels found elsewhere are historical or roadmap references covered by the explicit exception above.

## Current official documentation

Reviewed on 2026-08-05:

- [pnpm `run`](https://pnpm.io/cli/run) defines execution by the manifest script name and treats a plain command argument as a literal script name. The command contract therefore changes only when every caller is migrated to the new semantic key.
- [GitHub Actions workflow syntax](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#jobsjob_idstepsrun) defines `jobs.<job_id>.steps[*].run` as execution of the configured shell command. The compatibility workflow must change in the same atomic rename as the root script it invokes.
- [npm scripts](https://docs.npmjs.com/cli/v11/using-npm/scripts/) leaves ordinary package script naming to the package manifest; no platform requirement justifies phase-coded keys.

No dependency version, provider API, permission, secret, deployment behavior, generated repository, or lockfile changes in this normalization. It introduces no new security-advisory surface. Final implementation verification must still run the builder-core, package-boundary, constitution, compatibility-proof, and diff gates because names are direct executable consumers.

## Consolidated contradiction batch

1. The accepted P0.3 verification record says `lint:p0.3` was intentionally stage-scoped. The user's newer explicit direction supersedes that live-name choice. The accepted record remains unchanged as historical evidence; only the current script and current consumers migrate.
2. “Normalize every current occurrence” could be read as rewriting phase history. That would damage provenance and conflict with accepted review records. The resolved scope is every live or planned executable name, while phase-subject historical artifacts retain their phase labels.

No blocking uncertainty remains. The rename can occur atomically on clean `main` before Task 3 because builder-core is private, the CLI is still empty, and all direct consumers are repository-owned.
