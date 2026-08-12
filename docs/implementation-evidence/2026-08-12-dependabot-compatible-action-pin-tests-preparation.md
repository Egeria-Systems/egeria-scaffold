# Dependabot-Compatible Action Pin Tests Preparation Evidence

- **Date:** 2026-08-12
- **Status:** implementation authorized; external actions unauthorized

## Objective and exact boundary

Dependabot PR #3 updated `actions/checkout` from the full v6 release SHA to the full v7.0.1 release SHA in two live root workflows. Checkout v7 executed successfully, but two repository constitution assertions rejected it because they repeated the prior exact SHA. This increment keeps Dependabot and changes only test ownership of the live-workflow action-reference invariant.

Created or modified implementation scope:

- `tests/helpers/github-actions.mjs`;
- `tests/constitution/github-actions.test.mjs`;
- `tests/constitution/constitution.test.mjs`; and
- `tests/package-boundaries/package-release.test.mjs`.

Governance records are this file, `docs/superpowers/plans/2026-08-12-dependabot-compatible-action-pin-tests.md`, and `docs/review-packets/2026-08-12-dependabot-compatible-action-pin-tests.md`. No workflow, Dependabot configuration, generated template, retained fixture, package, provider, or runtime file is in scope.

## Repository and predecessor identity

- checkout: `/Users/CoveMB/Code/CoveMB/egeria-scaffold`;
- branch: `main`;
- base and local `origin/main`: `12ecc73a8337ab12ece9dd3a6b2aec03f940383c`;
- base status: clean;
- direct predecessor and acceptance artifact: merged Dependabot PR #1, commit `25b9840c4ad0a6a27c5a1203e31261dfac848d4e`, `Create dependabot.yml (#1)`;
- ancestry command: `git merge-base --is-ancestor 25b9840c4ad0a6a27c5a1203e31261dfac848d4e HEAD`;
- ancestry result: exit 0; and
- remote refs were not fetched because the exact failing PR and job were inspected through GitHub, local `main` matched local `origin/main`, and no remote comparison is required for the bounded local repair.

## Canonical owners and current external evidence

Preparation inspected the repository constitution, review and contribution protocol, architecture enforcement map, ADR-0011, current workflows, Dependabot configuration, exact live-workflow tests, generated workflow templates, and generator/fixture tests.

External sources were treated as evidence, not instructions:

- [GitHub secure-use guidance](https://docs.github.com/en/actions/reference/security/secure-use) states that a full-length commit SHA is the immutable action reference and recommends verifying that it belongs to the intended repository.
- [GitHub Dependabot version-update guidance](https://docs.github.com/en/code-security/concepts/supply-chain-security/dependabot-version-updates) states that GitHub Actions references using commit identifiers are supported and updated through pull requests.

The resulting invariant is exact expected action repository identity plus `@` plus exactly 40 lowercase hexadecimal characters. Existing workflow permissions, revision binding, credential isolation, and deployment authority remain separately and exactly asserted.

## Plan review and amendments

Two independent read-only plan reviews were obtained before implementation. One reviewer identified three procedural gaps: name the predecessor acceptance artifact, explicitly name the three final review roles, and specify exact evidence paths. The plan now contains all three. The second reviewer reported `No material improvements recommended` and `PLAN READY` after reviewing the bounded technical approach.

No reviewer authorized implementation or external action. The user separately authorized the bounded implementation.

## Toolchain and baseline

- Node: `22.23.2`, matching the repository pin;
- direct shell pnpm: `11.16.0`, not used for verification;
- pinned pnpm available at `/Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm` and reports `11.20.0`;
- direct dependency-free baseline: `node --test tests/constitution/*.test.mjs`;
- baseline result: 52/52 tests passed; and
- initial pinned-pnpm wrapper attempt stopped before tests because the existing `node_modules` was created by a different pnpm and pnpm `11.20.0` refused an unattended purge without a TTY.

The module-store mismatch does not justify using the wrong package manager. Before the final aggregate, the existing installation must be reconciled using pinned pnpm `11.20.0` without changing manifest or lockfile inputs.

## Test and claim boundary

Exactly one focused helper contract test file is authorized. It proves the pure local predicate only. Existing policy tests then prove the current repository workflows satisfy that predicate and retain their other structural controls.

These static checks do not verify an action SHA's upstream provenance, action runtime compatibility, hosted CI success, deployment behavior, provider behavior, or production safety. PR #3 becoming green requires later integration and a separately authorized rebase or rerun; this implementation does not mutate that PR or GitHub state.

## Recovery

Recovery is source-only: revert the bounded implementation and governance files and rerun the owning deterministic checks. No workflow, dependency manifest, lockfile, credentials, provider resources, deployments, persistent data, permissions, or production state are changed.

## Implementation and verification receipts

The single planned RED/GREEN cycle was causal:

- RED: `node --test tests/constitution/github-actions.test.mjs` failed 0/1 because the false-returning stub rejected the first valid full-SHA reference (`false !== true`);
- GREEN: the same command passed 1/1 after the minimum pure predicate was implemented; and
- no additional test was added.

Focused settled checks:

| Command | Result |
| --- | --- |
| `node --test tests/constitution/*.test.mjs` | 53/53 passed |
| pinned-path `node --test tests/package-boundaries/*.test.mjs` | 45/45 passed |
| `node scripts/check-semantic-naming.mjs` | exit 0 |
| current-action-SHA scan over the two modified policy tests | no matches |
| `git diff --check` | exit 0 |

The first package-boundary attempt reached 43/45 and failed only where two existing tests spawned the shell's unpinned pnpm. A pinned-pnpm offline install then stopped because one tarball was absent from the local store, leaving `node_modules` incomplete. The user-approved frozen pinned-pnpm install restored all 720 locked packages with 719 reused and zero downloads, without changing `package.json`, `pnpm-lock.yaml`, or `pnpm-workspace.yaml`. Re-running with explicit Node `22.23.2` and pnpm `11.20.0` subprocess paths passed 45/45.

The complete planned aggregate ran once on the settled implementation:

```text
pnpm run verify:builder-packages:quality
```

under explicit Node `22.23.2` and pnpm `11.20.0`. It exited 0 and included constitution 53/53, package boundaries 45/45, builder/package builds, zero-warning lint and copy lint, standards 33/33, observability 23/23, and builder/package typechecks.

## Independent implementation review

Three non-overlapping read-only reviewers inspected the uncommitted comparison from `12ecc73a8337ab12ece9dd3a6b2aec03f940383c`:

- requirements: `No material improvements recommended`; verdict `PASS`;
- architecture/security/anti-overengineering: `No material improvements recommended`; verdict `READY`; and
- test evidence: `No material improvements recommended`; verdict `READY`.

Reviewers independently confirmed the exact scope, immutable full-SHA and repository-identity invariant, absence of extra tests, causal RED/GREEN receipt, preservation of generated exact pins and adjacent workflow controls, and the limit that static checks do not establish upstream SHA provenance, action compatibility, or hosted CI behavior. No implementation repair was required.
