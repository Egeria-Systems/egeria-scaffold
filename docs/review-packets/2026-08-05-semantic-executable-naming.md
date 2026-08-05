# Semantic Executable Naming Review Packet

**Recorded:** 2026-08-05

**Task 2A outcome:** APPROVED. The implementation, required independent reviews, and verified final comparison are complete.

## Goal and frozen comparison

Replace roadmap-phase labels on live executable surfaces with responsibility-oriented names before state, inference, generation, and CLI consumers multiply. Preserve catalog, profile, resolution, verification, package, and compatibility behavior apart from the approved profile-schema title and stable package-version issue-code rename.

- Base: `76aefa624bf9fac5110f6dda348cbf2905f34aa5`
- Committed implementation candidate: `2f7d20c856d81caa03a53c418d21fafdb44f47fa`
- Implementation comparison: `76aefa624bf9fac5110f6dda348cbf2905f34aa5..2f7d20c856d81caa03a53c418d21fafdb44f47fa`
- Branch: clean sequential local `main`, twenty-three commits ahead of the unrefreshed local `origin/main` at the implementation candidate
- Gate artifacts: this packet and `docs/implementation-evidence/2026-08-05-semantic-executable-naming-verification.md` are committed after the frozen implementation candidate and will be included in the exact final comparison presented for approval.

Remote refs were not refreshed because remote freshness does not affect this local rename gate. No push, pull request, publication, workflow dispatch, deployment, or provider action is authorized.

## Changed files

### Workflow and current documentation consumers

- `.github/workflows/compatibility-proof.yml`
- `CONTRIBUTING.md`
- `README.md`
- `package.json`

### Private builder-core implementation

- `packages/builder-core/src/catalog/p1-capabilities.ts` renamed to `packages/builder-core/src/catalog/capability-catalog.ts`
- `packages/builder-core/src/profiles/p1-profiles.ts` renamed to `packages/builder-core/src/profiles/profile-recipes.ts`
- `packages/builder-core/src/contracts/profile.ts`
- `packages/builder-core/src/index.ts`
- `packages/builder-core/schemas/profile.schema.json`

### Regression contracts

- `packages/builder-core/tests/contracts.test.mjs`
- `packages/builder-core/tests/resolution.test.mjs`
- `tests/constitution/constitution.test.mjs`
- `tests/package-boundaries/internal-linting.test.mjs`
- `tests/package-boundaries/private-packages.test.mjs`
- `tests/package-boundaries/release-safeguards.test.mjs`

### Gate artifacts

- `docs/implementation-evidence/2026-08-05-semantic-executable-naming-verification.md`
- `docs/review-packets/2026-08-05-semantic-executable-naming.md`

## Exact mapping

The candidate applies all approved mappings without compatibility aliases:

- `catalog/p1-capabilities.ts` to `catalog/capability-catalog.ts`;
- `profiles/p1-profiles.ts` to `profiles/profile-recipes.ts`;
- `P1PackageVersions` to `CapabilityPackageVersions`;
- `createP1CapabilityCatalog` to `createCapabilityCatalog`;
- `p1ProfileRecipes` to `profileRecipes`;
- `P1_PACKAGE_VERSION_INVALID` to `CAPABILITY_PACKAGE_VERSION_INVALID`;
- `Egeria P1 profile recipe` to `Egeria portfolio and site profile recipe`;
- `build:p0.3` to `build:builder`;
- `lint:p0.3` to `lint:builder`;
- `typecheck:p0.3` to `typecheck:builder`;
- `verify:p0.2` to `verify:compatibility-proof`; and
- `verify:p0.3` to `verify:builder-packages`.

Accepted historical plans, evidence, review packets, compatibility records, roadmap/status prose, and phase-subject invariant tests retain the names that were true when recorded.

## Commands and results

| Command or evidence | Result |
| --- | --- |
| Builder-core build before implementation | exit `0` |
| Builder-core RED contract/resolution tests | expected exit `1`; 10 pass, 8 fail on missing semantic names/title |
| Package-boundary RED | expected exit `1`; 19 pass, 3 fail on old paths/scripts |
| Constitution RED | expected exit `1`; 10 pass, 3 fail on old script/docs/workflow consumers |
| `pnpm --filter @egeria-systems/builder-core run verify` | exit `0`; build/schema check/tests 18/18/typecheck/lint pass |
| `pnpm run verify:builder-packages` | exit `0`; constitution 13/13, boundaries 22/22, standards 14/14, observability 1/1, lint/build/typecheck/Changesets pass |
| Sandboxed `pnpm run verify:compatibility-proof` | expected environment failure: `listen EPERM: operation not permitted 127.0.0.1` |
| Approved-loopback `pnpm run verify:compatibility-proof` | exit `0`; unit 4/4, workerd 1/1, dev 4/4, preview 4/4 plus lint/type/build/binding checks |
| Old-live-name search | only negative assertions and accepted historical records remain |
| `git diff --check` | pass |

The [verification record](../implementation-evidence/2026-08-05-semantic-executable-naming-verification.md) contains the exact command forms, RED/GREEN development record, evidence boundaries, and rollback details.

The compatibility proof was local only and did not deploy. Automated axe results do not establish WCAG conformance.

## Independent review outcomes

### Requirements

No material findings.

### Architecture and anti-overengineering

No material findings. The reviewer confirmed that the atomic rename matches the approved map, preserves behavior, removes aliases from live tracked surfaces, retains the private builder-core boundary, and adds no Task 3+ behavior.

### Test evidence

No material findings.

No reviewer edited the repository or performed recursive delegation, GitHub comments, workflow dispatch, deployment, network/provider action, or other external mutation. No repair commit was required.

## Risks and deferred work

- Node.js `22.23.0` contains the June 2026 Node 22 security fixes. Official `22.23.1` is a later regression-fix patch. The pin is intentionally unchanged in this naming-only task; a separate compatibility plan, proof, and approval are required before updating it.
- No dependency or lockfile changed. The dated moderate-threshold npm audit in the plan-revalidation evidence reported no known vulnerabilities for the locked package graph, but cannot establish future safety.
- The compatibility proof exercised Node, workerd, and Chromium locally. It did not deploy and does not establish production safety, cross-browser support, visual or translation quality, human usability, or WCAG conformance.
- Task 3 `.egeria` codecs and hybrid ownership, inference/doctor/diff, skeleton generation, fixtures, CLI behavior, and all later capabilities remain deferred.
- Push, pull request, workflow dispatch, deployment, publication, provider mutation, permissions, production action, and external messaging remain unauthorized.

## Rollback and recovery

- Revert `2f7d20c` with a new focused revert commit; do not reset shared `main`.
- Rebuild builder-core and regenerate checked schemas after the revert. Ignored generated build output is reproducible and non-authoritative.
- No dependency, lockfile, persistent-data, or provider rollback is required because none changed.
- No deployment occurred. Deployment/provider recovery remains a separate explicitly approved domain if later needed.

## Approval disposition

The user explicitly approved verified final comparison `76aefa624bf9fac5110f6dda348cbf2905f34aa5..a20dd4444852ff5a355e3010e1f5b038cf27728f` on 2026-08-05. Task 2A is closed. The user separately pre-approved the bounded local preparation, planning, implementation, review, evidence, and focused commits for Tasks 3 and 4; that instruction does not authorize Task 5 or any push, pull request, workflow dispatch, deployment, publication, provider mutation, or external message.
