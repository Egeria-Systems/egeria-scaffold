# Observability error diagnostics package release-candidate evidence

- Date: 2026-08-13
- Status: release candidate in open pull request; package publication not authorized
- Task 5 preparation base: `83d5ef1d4f1676704b5a578f0bf499d745cf01e8`
- Reconciled main: `141747af8c451dde8f60cac56840e4b208cc8d00`
- Reconciliation merge: `c57d14fa3aeddcfe3087dfbe381aa2db46672325`
- Materialized package candidate: `9703299070cf78d6fa8b640ec06c7085ee485121`
- Release-intent CI repair: `babcc71c32ed0854fbccb015f990c005b58289d9`
- Branch: `observability-error-diagnostics`
- Isolated worktree: `.worktrees/observability-error-diagnostics`
- Pull request: [#19](https://github.com/Egeria-Systems/egeria-scaffold/pull/19)

## Outcome

The release candidate materializes only `@egeria-systems/observability@0.3.0`. `@egeria-systems/standards` remains at its already published `0.2.0` version. Changesets generated the observability version and changelog exactly once, consumed the observability Changeset and two empty no-release Changesets, and left no pending Changeset.

The live npm registry guard accepted exact histories `["0.1.0", "0.2.0"]` for both public packages, confirmed that observability `0.3.0` is absent, and confirmed that unchanged standards `0.2.0` remains present. The branch was pushed and pull request #19 was opened under explicit user authority. No release workflow was dispatched and no package was published.

## Approved scope amendments

The user explicitly approved these evidence-backed Task 5 amendments before each change:

- Mechanically consume `.changeset/clarify-observability-boundary.md` and `.changeset/generated-testing-boundary.md` as empty no-release records.
- Update `tests/package-boundaries/private-packages.test.mjs` as a direct manifest-version consumer.
- Apply a lockfile-only transitive `nanoid` update from `3.3.17` to `3.3.18`, without changing a dependency manifest or workflow, after the workflow-equivalent moderate audit was blocked by [GHSA-2v37-7h3g-55p8](https://github.com/advisories/GHSA-2v37-7h3g-55p8).
- Update the packed observability README and nested package instructions to describe the materialized `0.3.0` candidate without implying publication.
- Update the canonical package owner and constitution assertion so the registry contract supports an unchanged published version remaining present while a new target remains absent.
- Repair ordinary pull-request release intent after hosted CI proved that raw Changesets status rejects the already-materialized candidate. The approved exception accepts only the exact base transition from observability/standards `0.2.0`/`0.2.0` to `0.3.0`/`0.2.0`, with the exact public package set and no pending Changeset. Every mismatch or adapter failure falls back to raw Changesets status. No other repository-quality job was removed or relaxed.

The approved implementation plan records every amended file and preserves the prohibition on Task 6+, provider configuration, deployment, publication, and certification-state changes.

## External prerequisite state

The npm package settings were inspected read-only in the user's authenticated Brave session. The trusted-publisher entry for `@egeria-systems/observability` names:

- repository owner and name: `Egeria-Systems/egeria-scaffold`
- workflow: `package-release.yml`
- GitHub environment: `npm-release`
- permissions: `npm publish` and `npm stage publish`
- two-factor setting: require two-factor authentication and disallow bypass tokens

No npm setting, GitHub setting, provider resource, secret, or permission was changed. This is prerequisite evidence only; it is not publication authority. npm documents the identity-bound OIDC model in [Trusted publishing for npm packages](https://docs.npmjs.com/trusted-publishers/).

## Test-driven development record

| Cycle | RED or causal evidence | GREEN evidence |
| --- | --- | --- |
| Single-package subsequent release | The initial focused release state produced 11 expected failures against the prior two-package model and unmaterialized Changeset. | The focused checker passed 18/18; after materialization the combined focused release state passed 31/31. |
| Direct manifest consumer | The complete package-boundary suite exposed the private-package fixture still requiring observability `0.2.0`. | Its focused boundary passed 7/7 after the approved direct-consumer update. |
| Canonical registry contract | The focused constitution file failed 1 of 47 assertions when the new per-package status contract was applied against the stale canonical owner. | It passed 47/47 after the canonical owner described exact history plus present unchanged and absent new target states. |
| Packed release instructions | The packed-package test failed 1 of 4 checks when the tarball contained the stale `0.2.0` and pending-Changeset README. | The packed manifest and README checks passed 4/4 with the materialized `0.3.0` candidate and separate publication authority. |
| Package-generic registry failures | A temporary test mutation that bypassed standards status and history validation caused exactly 2 of 18 focused release checks to fail. | The unchanged generic checker was restored; status failures and invalid histories for either package pass 18/18. |
| Materialized pull-request release intent | Hosted `pnpm exec changeset status --since origin/main` failed because Task 5 had intentionally consumed all Changesets. A temporary mutation removing current-candidate validation caused the focused negative control to fail on the wrong current observability version. | The restored guard accepts only the exact prior/current public-package transition. Base drift, current version drift, current public-set drift, and a pending Changeset are causally rejected; raw Changesets remains the workflow fallback. |

`pnpm run version-packages` was executed exactly once. The resulting manifest, changelog, and Changeset deletions were inspected rather than hand-authored.

## Lockfile repair

The existing PostCSS dependency ranges accept `nanoid@3.3.18`. Two package-manager selector attempts were no-ops because `nanoid` is only a nested dependency. The approved direct lockfile repair changed exactly five references: the resolution key and integrity, snapshot key, and two PostCSS references. A frozen install accepted the lock and verified all 885 entries under the repository supply-chain policy. No dependency manifest, source file, or release workflow changed for the repair.

The GitHub advisory currently identifies versions before `3.3.18` as affected and `3.3.18` as the first patched release: [GHSA-2v37-7h3g-55p8](https://github.com/advisories/GHSA-2v37-7h3g-55p8).

## Verification

All Node and pnpm commands used the Volta-pinned Node `22.23.2` and pnpm `11.20.0` toolchain with `CI=true` where applicable.

| Command | Result |
| --- | --- |
| `pnpm install --frozen-lockfile` | Passed after current-main reconciliation; lockfile accepted and 885 entries passed the supply-chain policy. The initial sandboxed retry hit DNS restrictions before the approved networked retry completed. |
| Focused release, safeguard, and public-package tests | Passed; final release model 18/18, packed observability 4/4, and combined focused release state 31/31. |
| `pnpm run verify:package-release-candidate` | Passed on the exact CI-repair tree: constitution 55/55, package boundaries 49/49, standards 33/33, observability 49/49, plus builder build, lint, copy lint, typecheck, and local release validation. |
| `pnpm run check:package-release pull-request origin/main \|\| pnpm exec changeset status --since origin/main` | Passed through the exact materialized-transition guard; the fallback remains present for every nonmatching candidate or guard failure. |
| `pnpm peers check` | Passed with no issues. |
| `pnpm audit --audit-level=moderate` | Passed; no known vulnerabilities. |
| `pnpm audit --prod --audit-level=moderate` | Passed; no known vulnerabilities. |
| `pnpm audit signatures` | Passed; 885 packages have verified registry signatures. |
| `pnpm run check:package-release registry` | Passed immediately before the implementation commit; both exact histories matched, observability `0.3.0` was absent, and standards `0.2.0` was present. |
| Compatibility-proof `test:unit` | Passed, 4/4, after the lockfile repair. |
| `git diff --cached --check` | Passed before the implementation commit. |

The peer, audit, signature, and compatibility checks were not repeated after documentation and test-only repairs because their Task 5 manifest, dependency, and proof inputs were unchanged. Current accepted-main dependency and workflow inputs were reconciled before the final frozen install and release-candidate gate. An earlier sandboxed frozen-install attempt could not reach the package store; the approved exact-toolchain retry succeeded without adding an unapproved tracked file.

## Independent review

| Review | Material finding | Disposition |
| --- | --- | --- |
| Requirements | None. | No material improvements recommended; ready for the evidence/commit gate. |
| Architecture and anti-overengineering | The packed README and nested instructions still described pre-materialization state; the canonical package owner still required both package targets to be absent. | Repaired under explicit approval. Re-review found no material improvements and no Task 6+, provider, deployment, or certification drift. |
| Test evidence | The tarball test did not inspect the packed README; standards negative registry status and history cases were incomplete. | Repaired with packed-artifact assertions and package-generic negative controls. Re-review found no material improvements and no mutation residue. |
| Security, privacy, and supply chain | None after repair. | No material improvements recommended; registry errors remain content-safe, the release workflow and manifests are unchanged, the lockfile change is exact, and no secret or private data appears in the diff. |
| CI repair requirements and security | None. | No material improvements recommended; the exact revision is read with argument-vector Git commands, failures remain content-safe, and the release workflow, providers, credentials, and certification state are unchanged. |
| CI repair architecture and test evidence | The initial focused contract lacked direct wrong-head, current-public-set, and pending-Changeset negative controls. | Added the causal cases, verified the current-candidate guard with a temporary mutation, restored the guard, and obtained a no-material-improvements recheck. |
| Current-main reconciliation | None. | Requirements/security and architecture/test-evidence rechecks of the committed `origin/main...c57d14f` comparison found no material improvements after the automatic shared-test merge and full verification. |

## Risks, gate, and recovery

- npm and trusted-publisher state can drift after this snapshot. Re-read the registry, npm trusted-publisher entry, GitHub environment, and exact commit identity immediately before any separately approved publication action.
- A registry race remains possible between approval and execution. The workflow's final pre-publication guard must recheck exact histories and per-package version status and fail closed on drift.
- npm versions are immutable. A partially completed publication requires separately approved forward recovery and consumer assessment; never automatically retry or replace an already published version.
- Registry audit and signature results are current snapshots, not proof of complete supply-chain safety. Published provenance and exact artifact contents cannot be verified before publication.
- Local Node, packing, build, lint, typecheck, and compatibility-proof unit checks do not prove hosted workflow behavior, deployment, provider ingestion, production safety, accessibility conformance, or certification.
- The pull-request exception is intentionally one transition only. Once the comparison base no longer has observability/standards `0.2.0`/`0.2.0`, it fails closed and ordinary Changesets status remains mandatory.
- Before publication, recovery is to abandon or revert the local candidate through a separately authorized Git action. No external package, provider, deployment, or certification state has changed.

Draft-pull-request publication and this CI repair were explicitly authorized. Stop before package publication, release-workflow dispatch, Task 6+, deployment, provider configuration, or certification-state changes.
