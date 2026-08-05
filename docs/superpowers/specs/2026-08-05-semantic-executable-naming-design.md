# Semantic Executable Naming Design

**Status:** Approved direction; exact Task 2A implementation awaits plan approval

## Problem

Roadmap labels such as P0.3 and P1 communicate sequencing, not software responsibility. Using them in source paths, API symbols, error codes, package scripts, or workflow commands makes those surfaces harder to understand and creates arbitrary rename pressure when the roadmap advances.

The issue is currently bounded but will spread if later P1 tasks consume the Task 2 names or add the planned phase-labelled release catalog and aggregate verification command.

## Decision

Live executable names use domain or responsibility language. Roadmap labels remain only when the phase itself is the subject: roadmaps, task and gate references, historical evidence, review packets, compatibility records, phase status, and explicitly phase-scoped invariants.

No temporary compatibility aliases are needed. Builder-core is private, the CLI has no executable command yet, and every current consumer is repository-owned. The change therefore performs one atomic rename and rejects both old and new names coexisting.

## Semantic boundaries

The capability catalog is named for what it contains, not when it was introduced:

- `catalog/capability-catalog.ts`
- `CapabilityPackageVersions`
- `createCapabilityCatalog`

The recipe collection is similarly direct:

- `profiles/profile-recipes.ts`
- `profileRecipes`

The package-version validation issue becomes `CAPABILITY_PACKAGE_VERSION_INVALID`. The profile schema title becomes `Egeria portfolio and site profile recipe`, which describes its actual restricted contract.

Root commands describe their verification target:

- `build:builder`, `lint:builder`, and `typecheck:builder` cover builder applications and packages while excluding the compatibility proof;
- `verify:compatibility-proof` delegates to the private Next.js/Cloudflare proof;
- `verify:builder-packages` covers the current package, lint, build, type, test, and Changesets boundary;
- the final P1 aggregate will be `verify:builder-kernel`.

The separately verified future package pin module is `verified-package-versions.ts`.

## Enforcement

The repository constitution prohibits roadmap phase labels in new executable filenames/directories, API symbols, stable error identifiers, script or configuration keys, workflow command names, schema identifiers/titles, CLI surfaces, generated paths, and ordinary test or fixture identifiers.

Tests protect the structural boundary:

- exact builder-core source paths and exports use semantic names;
- old exports, source paths, issue codes, and script keys are absent;
- the generated schema title is semantic and checked byte-for-byte;
- root scripts and the GitHub workflow agree;
- package, lint, release, and constitution consumers use only the semantic commands.

Tests may retain a phase label only when their actual subject is a historical phase record or phase-specific invariant.

## Migration and recovery

Task 2A runs before Task 3, when the consumer set is smallest. It changes no runtime logic, capability metadata, profile content, dependency, lockfile, provider state, generated repository, or public package API.

Rollback is a source revert of the focused normalization commit. There is no persistent-data or provider recovery domain. Historical records continue to show the names that were true when those records were accepted.
