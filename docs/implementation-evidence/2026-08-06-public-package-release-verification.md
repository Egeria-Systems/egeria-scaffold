# Public Package Release Candidate Verification

**Date:** 2026-08-06 (America/Toronto)

**Status:** Private local implementation verified; human rights/privacy confirmation and every external action remain pending

**Plan:** [Public package release plan](../superpowers/plans/2026-08-06-public-package-release.md)

**Design:** [Public package release design](../superpowers/specs/2026-08-06-public-package-release-design.md)

**Review packet:** [Public package release review](../review-packets/2026-08-06-public-package-release.md)

## Exact comparison

```text
worktree: /private/tmp/egeria-scaffold-public-package-release
branch: public-package-release
combined prerequisite base: 8382de8f1377300d6bbeca6b67679d2c20ba6111
release implementation base: 2e721a2d0358f758d0c5794da7126648b46ad527
reviewed implementation candidate: e4201e09460568444a84b35d8fa05d814a2e0b11
release comparison: 2e721a2d0358f758d0c5794da7126648b46ad527..e4201e09460568444a84b35d8fa05d814a2e0b11
review comparison: 8382de8f1377300d6bbeca6b67679d2c20ba6111..e4201e09460568444a84b35d8fa05d814a2e0b11
```

The broader review comparison includes the separately reviewed deterministic skeleton-rendering and Node `22.23.2` prerequisites. This evidence records the public-package release implementation from the completed Node prerequisite through the reviewed private candidate.

## Release implementation commits

```text
3659fc9 License public package sources
7341422 Prepare public package release candidate
f8b751c Add guarded package release workflow
14fb5d9 Document package release controls
ee40d36 Repair package release review findings
e4201e0 Harden package release safeguards
```

## Changed files

- Deleted `.changeset/lean-builder-monorepo.md` through the existing Changesets version command.
- Created `.github/workflows/package-release.yml` and root `LICENSE`.
- Modified `README.md`, `CONTRIBUTING.md`, `package.json`, and `pnpm-lock.yaml`.
- Modified `docs/architecture/enforcement-map.md` and `docs/architecture/package-ownership.md`.
- Modified the approved release design and exact-file plan.
- Created `packages/observability/CHANGELOG.md`, `LICENSE`, and modified its `README.md` and `package.json`.
- Created `packages/standards/CHANGELOG.md`, `LICENSE`, and modified its `README.md` and `package.json`.
- Created `scripts/check-package-release.mjs`.
- Modified `tests/constitution/constitution.test.mjs`.
- Modified package-boundary tests for internal linting, private packages, public standards, public observability, and release safeguards; created `tests/package-boundaries/package-release.test.mjs`.

No package API, observability behavior, private-package visibility, capability, generated-project source, `.egeria` state, CLI behavior, provider, deployment, or client repository changed in the release implementation range.

## Materialized release candidate

- `@egeria-systems/standards@0.1.0` is public-configured, Apache-2.0 licensed, and retains only its approved TypeScript/ESLint configuration exports.
- `@egeria-systems/observability@0.1.0` is public-configured, Apache-2.0 licensed, and retains its intentionally empty runtime API.
- Root, standards, and observability license files are byte-identical official Apache License 2.0 text with SHA-256 `cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30`.
- Changesets `2.31.1` materialized both minor versions exactly once, deleted the spent release intent, and generated repository changelogs. Private packages remain `0.0.0` and private.
- Changesets remains the sole version/publication owner. The new validator only rejects invalid release context, candidate state, and registry state.
- The manual workflow checks out full-history `main`, binds both `HEAD` and local `main` to the exact approved input, uses the `npm-release` environment, and exposes no publish-time mapped secret.

## Test-driven record

### License and metadata

The focused public-package test was changed first and failed because the root and package-local license files were absent. After adding only the official license bytes and approved metadata, the focused three-test selection passed.

### Version and local release validator

Before implementation, manifests remained `0.0.0`, the initial Changeset was pending, changelogs and validator commands were absent, and the release contract was RED. The existing `version-packages` command ran exactly once. The resulting local validator rejects missing/extra public packages, private records, invalid or wrong versions, pending Changesets, incomplete registry results, any non-absent response, and unexpected package history.

### Guarded workflow

Workflow tests were authored before the workflow and exact npm dependency. RED established the missing workflow, missing `npm@12.0.2`, and root dependency-shape disagreement. The implementation added one manual workflow with exact action/runtime pins, minimum permissions, no cache, one final registry check, conditional temporary authentication, Changesets publication, and unconditional cleanup.

The first complete aggregate exposed an incorrect pnpm script separator:

```text
$ node scripts/check-package-release.mjs -- local
RELEASE_CHECK_MODE_INVALID
```

Removing the literal separator from script consumers made the focused suite and complete candidate aggregate green.

### Documentation

Constitution assertions were added before canonical documentation updates and failed because current manifests/workflow controls were not described. README, contributing guidance, package ownership, and the enforcement map were then updated without copying the complete operator runbook.

### Reviewer repairs

The first review pair found a detached raw-SHA checkout incompatible with Changesets' local `main` merge-base and a README status contradiction. Focused tests failed before the workflow and README repair, then passed after full-history `main` checkout, two exact Git assertions, and accurate implemented/deferred wording.

The second pair found missing mutation protection, untested HTTP classification/network handling, and a target-version-only registry guard that could attach `0.1.0` to unexpected earlier history. Focused RED records showed:

```text
workflow assertion deletion: mutation produced no problem
unexpected package history: expected REGISTRY_STATE_INVALID, received no problems
registry adapter exports: missing pure classifier export
package ownership: package-name absence contract missing
```

The minimum repair mutation-protects both Git assertions, separates pure HTTP classification from the request shell, tests both URLs and network failure, and requires both package-level packuments and exact target versions to be absent. Reviewer disposition checks confirmed all findings resolved.

## Final deterministic command evidence

| Command or gate | Result |
|---|---|
| exact pnpm `install --frozen-lockfile` | pass; lockfile current under pnpm `11.20.0` |
| `pnpm exec npm --version` | `12.0.2` |
| exact pnpm `audit --audit-level=moderate` | pass; no known vulnerabilities found |
| exact pnpm `peers check` | pass; no peer dependency issues found |
| exact pnpm `run verify:package-release-candidate` | pass |
| constitution and semantic-naming tests inside aggregate | 20/20 passed |
| package-boundary tests inside aggregate | 41/41 passed |
| standards tests | 14/14 passed |
| observability tests | 1/1 passed |
| builder lint/build/typecheck | pass |
| exact pnpm `run check:package-release registry` | pass; both package packuments and both exact versions absent at check time |
| exact pnpm `run check:semantic-naming` | pass |
| `git diff --check` | pass |
| `git merge-base main HEAD` and `--fork-point` | both `8382de8f1377300d6bbeca6b67679d2c20ba6111` |

The release-branch `changeset status` nonzero changed-package/no-pending-changeset state is expected after version materialization. The workflow checks out `main` with full history and reruns raw Changesets status only after exact commit equality is established.

## Tarball evidence

Tarballs were created outside the repository after builds.

### Standards

```text
SHA-256 b55330f1a3bc4b3e588e5fa85b7506d1827fa884e58a69ca430ebe5c066e6aea
SHA-512 c36a8d65848b8d0ce5fe7f3add051828fab4fd0272c767e9dffa3cb5faddf910b7901ec1d619eee4a1785eb786cef323efcd7cfe47bec7948308e43ee2e33223

LICENSE
README.md
eslint/cloudflare-isolation.mjs
eslint/typescript-strict.mjs
package.json
typescript/strict.json
```

### Observability

```text
SHA-256 25f78da0f31113a6beffe9bac441506836418957a49207b42e3b5f974a237802
SHA-512 7bb43fa99075ce94d49b58e4ed94382249e28f509bb268b5cbfaaebc92c9b3cdf0a3077936fd338380a096b01b521d78b7cf2f451ab7b67a46707af00e6a1363

LICENSE
README.md
dist/index.d.ts
dist/index.js
package.json
```

Neither tarball contains a repository changelog because its existing `files` allowlist does not include one.

## Private repository and secret audit

The live read-only GitHub audit found:

- repository visibility `private`, default branch `main`, enabled and unarchived;
- only remote branch `main` at `af299f4aeb602ebf7c3e0fc0c33a2d208cb496fc`, which is an ancestor of this candidate;
- no tags, releases, or forks;
- zero open issues; issues enabled, wiki and discussions disabled; and
- four historical compatibility workflow runs.

The official Darwin arm64 Gitleaks `8.30.1` archive matched approved SHA-256 `b40ab0ae55c505963e365f271a8d3846efbc170aa17f2607f13df610a9aeb6a5`.

- All 103 commits and all refs: no leaks found.
- Four Actions logs streamed directly through redacted stdin scanning: no leaks found; raw logs were neither printed nor stored.
- Directory scan: 33 generic-key matches, all confined to ignored `.next`, `.open-next`, and `.wrangler` proof output; none is tracked.

Automated scanning does not prove privacy or rights. Human review of identities, history, files, third-party material, Actions exposure, repository metadata, and publication authority remains pending and blocks every external action.

## License inventory

The clean-worktree production inventory completed only when allowed to read the actual pnpm store. Workspace license identifiers were MIT, Apache-2.0, MIT OR Apache-2.0, BSD-2-Clause, BSD-3-Clause, ISC, 0BSD, BlueOak-1.0.0, CC0-1.0, Python-2.0, CC-BY-4.0, and LGPL-3.0-or-later.

- The LGPL entry is the platform binary `@img/sharp-libvips-darwin-arm64`; the CC-BY entry is `caniuse-lite`. Both belong to the private compatibility-proof dependency graph and neither public tarball.
- The standards production/peer tool graph contains permissive identifiers only; observability reports no production licenses.
- Automated inventory is not legal advice or proof of title. Human confirmation of attribution, incorporated material, Apache-2.0 authority, and any NOTICE requirement remains pending.

## Current official evidence revalidated

- GitHub's official `actions/checkout` documentation confirms `fetch-depth: 0` fetches all branch/tag history, `ref` may name a branch, and `persist-credentials: false` opts out of persisted authentication.
- GitHub's official workflow-event documentation states `workflow_dispatch` uses the last commit and ref of the selected branch/tag.
- npm's official trusted-publishing, provenance, package-metadata, access-token, and unpublish guidance remains the external runbook authority; none of those settings or actions was exercised.
- Current official Node, pnpm, npm, Changesets, action, and Gitleaks versions/advisories are recorded in the dated [preparation evidence](2026-08-06-public-package-release-preparation.md) and Node verification evidence.

## Reviewer dispositions

| Review | Material finding | Repair and final disposition |
|---|---|---|
| Requirements | README contradicted implemented codecs/inference/diagnostics/rendering | accurate implemented versus deferred boundary added and constitution-tested; resolved |
| Architecture/anti-overengineering | raw-SHA checkout did not guarantee Changesets' local `main`; same README contradiction | full-history `main` checkout plus exact `HEAD`/local-main checks; resolved; no other material architecture finding |
| Test evidence | Git assertions lacked mutation protection; HTTP/network adapter untested | independent deletion mutations plus classifier/request-shell tests; resolved; 15/15 focused tests |
| Supply-chain/privacy | exact-version-only check allowed unwanted earlier package history | package-level and exact-version absence, authenticated human name check, and post-publication complete-version-set check; resolved; 7/7 focused tests |

## Evidence limits and blockers

- Human privacy, rights, identity, attribution, and authority confirmation is pending. This is a hard blocker, not an automated check.
- Authenticated npm confirmation that neither package name already exists as public or private is pending.
- The workflow is statically and mutation tested but has not run on GitHub.
- No token, environment, secret, trusted publisher, public repository, package publication, provenance statement, signature, registry tarball, or fresh public consumer exists yet.
- Registry absence and advisory results are time-sensitive and must be refreshed at their named external gates.
- Two-package publication is not atomic. A mixed result requires a new recovery approval.
- Automated secret, license, accessibility, and package tests do not prove security, legal title, privacy, WCAG conformance, or production fitness.

## Recovery domains

- **Source:** revert the six release implementation commits together; do not leave versions, workflow, validator, metadata, tests, and documentation mixed.
- **Package registry:** no package was published, so no registry rollback exists. Future deprecation/corrective release is separate from source rollback; unpublish is not treated as routine recovery.
- **Credentials and trust:** no npm token, GitHub secret, environment, or trusted publisher was created or changed.
- **Repository visibility:** the repository remains private; no visibility recovery is needed. A future return to private would not retract prior public disclosure.
- **State and migrations:** no `.egeria` state, migration, provider resource, deployment, or client repository changed.
