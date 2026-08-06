# Public Package Release Verification

**Date:** 2026-08-06 (America/Toronto)

**Status:** Public `0.1.0` execution verified; exact bootstrap provenance exception approved; post-release evidence awaiting final completion approval

**Plan:** [Public package release plan](../superpowers/plans/2026-08-06-public-package-release.md)

**Design:** [Public package release design](../superpowers/specs/2026-08-06-public-package-release-design.md)

**Review packet:** [Public package release review](../review-packets/2026-08-06-public-package-release.md)

## Public execution evidence

### Source, workflow, and repository controls

- Public repository source commit: `91a4413f67930f3aa5c85a4d998c450c728942e0`.
- Manual workflow run: [`31128800393`](https://github.com/Egeria-Systems/egeria-scaffold/actions/runs/31128800393), successful `workflow_dispatch` on `main`; every job step completed successfully.
- The repository is public. Protected `main` remained at the exact source SHA. Secret scanning and push protection are enabled.
- The `npm-release` environment allows only `main`, requires one `User` reviewer, and has prevent-self-review disabled because there is one eligible operator. Administrator bypass remains enabled by explicit operator decision.
- The accepted Dependabot branch, pull request, and Copilot review surface did not change `main`.
- No tag or GitHub release was created by us. Changesets-created local tags existed only in the ephemeral runner and were not pushed because checkout credentials were disabled.

### Registry state and immutable artifacts

Exactly these complete public version sets were observed anonymously:

```text
@egeria-systems/standards: ["0.1.0"]
@egeria-systems/observability: ["0.1.0"]
```

For each package, `latest` is `0.1.0`, access is public, the license is Apache-2.0, and the repository is `Egeria-Systems/egeria-scaffold`. The standards directory is `packages/standards`; the observability directory is `packages/observability`. Both versions have npm registry signatures. Neither version has an npm provenance attestation.

Standards registry artifact:

```text
integrity (SHA-512): sha512-BmDwcX0T6KT271C4N24jCKn6ymKTqDAFpJjsG6LNpmIoTAz0xApIcqpHFl9dHOqlB2xdhdHwKYfSiELUp04E0Q==
SHA-1: 2fd05fbec0be0cbfb41e929f2b02a51cc9592c72
SHA-256: ddc7ddce58e16637df45083c0fb6bc5ddd35422b0096044c019cad7c5bf2d2c0

LICENSE
README.md
eslint/cloudflare-isolation.mjs
eslint/typescript-strict.mjs
package.json
typescript/strict.json
```

Observability registry artifact:

```text
integrity (SHA-512): sha512-eCTt6tNP0q2HA0wNpM1VJpZBFZqFpBDekKbno+UUKfWMG5I+KEg3bpt/fKdVO86JrKohlIM6Zo/7qzGDBpmh8g==
SHA-1: a659e750c994d6449a0b477721a276f05bfa96d6
SHA-256: a5a2e7fc764c7663b831e97ec6a049865316f24a108df0c8c3ea71ad51fc6b45

LICENSE
README.md
dist/index.d.ts
dist/index.js
package.json
```

Each registry `LICENSE` has SHA-256 `cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30`, matching the source and private candidate.

The published archives are not byte-identical to the private `pnpm pack` archives. pnpm normalized the published `package.json` by changing key order, removing `prepublishOnly`, and materializing a workspace development dependency. File inventories, license bytes, and every other included byte match. The different archive hashes are therefore recorded as expected package-manager normalization, not a content mismatch.

The private workspace names `@egeria-systems/scaffold`, `@egeria-systems/cli`, and `@egeria-systems/builder-core` remained 404/absent, and no unintended file was published. The package-level 404 observed briefly after exact-version availability was transient npm registry negative-cache propagation. Because the guard also checked the exact-version URL, it failed closed when that URL became present; the earlier URL concern is retracted.

### Fresh isolated consumer verification

Fresh consumers used Node `22.23.2` and npm `12.0.2`:

- Standards with ESLint `9.39.5`: 109 installed packages; all 3/3 established export and behavioral controls passed.
- Standards with ESLint `10.8.0`: 88 installed packages; all 3/3 established export and behavioral controls passed.
- Observability: one installed package; the 1/1 empty-root export control passed.
- `npm audit signatures` passed in all three consumers.
- All moderate-level audits reported zero vulnerabilities at the recorded time.

Signature audit proves registry signature verification, not npm provenance, package security, accessibility, production fitness, or behavior beyond the executed controls.

### Provenance exception and future release boundary

Changesets selected pnpm `11.20.0`'s native publish path. Its publish options did not consume manifest `publishConfig.provenance`, so both immutable `0.1.0` bootstrap versions lack npm provenance. The user explicitly accepted this exact two-version bootstrap provenance exception. It is not retroactive provenance and does not relax the requirement for any future version.

Commit `f640c87a709bc4266c59543942fe093824d02eb9` adds `NPM_CONFIG_PROVENANCE: "true"` only to future publish steps. Its TDD record was RED for the sole missing provenance request, then GREEN at 1/1 focused and 15/15 for the full test file; `git diff --check` passed. Independent review reported no material findings.

Operator confirmation records trusted publishing for both packages with organization `Egeria-Systems`, repository `egeria-scaffold`, workflow filename `package-release.yml`, environment `npm-release`, and allowed action `npm publish` only. Publishing access disallows tokens. GitHub's environment-secrets API now returns zero secrets and an empty name set. Revocation of the npm bootstrap token is operator-confirmed; no token value or identifier is recorded.

OIDC trusted publishing and the explicit provenance environment are configured but remain unexercised until a later separately approved version is published. Future provenance remains mandatory.

### Timing gate and refreshed official documentation

Publication time was `2026-08-06T22:10:51Z`. The generated-project `minimumReleaseAge: 1440` means Task 7 live installation must wait until after `2026-08-07T22:10:51Z` (`2026-08-07 18:10:51 America/Toronto`) and then recheck live registry state before relying on the packages.

The following official documentation was refreshed on 2026-08-06:

- [npm trusted publishers](https://docs.npmjs.com/trusted-publishers/)
- [Viewing package provenance](https://docs.npmjs.com/viewing-package-provenance)
- [npm publish](https://docs.npmjs.com/cli/publish/)
- [Manually running a GitHub Actions workflow](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow)

npm documents OIDC trusted publishing, provenance evidence, and published-version immutability; GitHub documents manual workflow dispatch. These sources do not change the repository's separate human approval gates.

### Current risks and deferred proof

- The immutable `0.1.0` versions have registry signatures but no cryptographic source/workflow provenance.
- Trusted-publisher configuration and the explicit future provenance request are unexercised until a later separately approved version.
- Administrator bypass remains enabled by explicit operator decision.
- Advisory and registry observations are time-sensitive.
- Automated tests, audits, signatures, and static checks do not prove security, legal title, privacy, WCAG conformance, human usability, production fitness, or future-release correctness.

## Post-release comparison

```text
public source: 91a4413f67930f3aa5c85a4d998c450c728942e0
future provenance fix: f640c87a709bc4266c59543942fe093824d02eb9
comparison for final completion review: 91a4413f67930f3aa5c85a4d998c450c728942e0..HEAD
```

The comparison contains the independently reviewed future-workflow fix plus this six-file post-release evidence commit. It does not include a package publication, tag, GitHub release, workflow dispatch, repository setting, credential, or other external mutation.

## Historical private-candidate comparison

```text
worktree: /private/tmp/egeria-scaffold-public-package-release
branch: public-package-release
combined prerequisite base: 8382de8f1377300d6bbeca6b67679d2c20ba6111
release implementation base: 2e721a2d0358f758d0c5794da7126648b46ad527
reviewed implementation candidate: e4201e09460568444a84b35d8fa05d814a2e0b11
release comparison: 2e721a2d0358f758d0c5794da7126648b46ad527..e4201e09460568444a84b35d8fa05d814a2e0b11
review comparison: 8382de8f1377300d6bbeca6b67679d2c20ba6111..e4201e09460568444a84b35d8fa05d814a2e0b11
```

The broader historical review comparison includes the separately reviewed deterministic skeleton-rendering and Node `22.23.2` prerequisites. It records the release implementation from the completed Node prerequisite through the reviewed private candidate; it no longer describes current repository or registry status.

## Historical release implementation commits

```text
3659fc9 License public package sources
7341422 Prepare public package release candidate
f8b751c Add guarded package release workflow
14fb5d9 Document package release controls
ee40d36 Repair package release review findings
e4201e0 Harden package release safeguards
```

## Historical candidate changed files

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

## Historical materialized release candidate

- `@egeria-systems/standards@0.1.0` is public-configured, Apache-2.0 licensed, and retains only its approved TypeScript/ESLint configuration exports.
- `@egeria-systems/observability@0.1.0` is public-configured, Apache-2.0 licensed, and retains its intentionally empty runtime API.
- Root, standards, and observability license files are byte-identical official Apache License 2.0 text with SHA-256 `cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30`.
- Changesets `2.31.1` materialized both minor versions exactly once, deleted the spent release intent, and generated repository changelogs. Private packages remain `0.0.0` and private.
- Changesets remains the sole version/publication owner. The new validator only rejects invalid release context, candidate state, and registry state.
- The manual workflow checks out full-history `main`, binds both `HEAD` and local `main` to the exact approved input, uses the `npm-release` environment, and exposes no publish-time mapped secret.

## Historical private-candidate test-driven record

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

## Historical private-candidate deterministic command evidence

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

## Historical private-candidate tarball evidence

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

## Historical private repository and secret audit

Before publicization, the live read-only GitHub audit found:

- repository visibility `private`, default branch `main`, enabled and unarchived;
- only remote branch `main` at `af299f4aeb602ebf7c3e0fc0c33a2d208cb496fc`, which is an ancestor of this candidate;
- no tags, releases, or forks;
- zero open issues; issues enabled, wiki and discussions disabled; and
- four historical compatibility workflow runs.

The official Darwin arm64 Gitleaks `8.30.1` archive matched approved SHA-256 `b40ab0ae55c505963e365f271a8d3846efbc170aa17f2607f13df610a9aeb6a5`.

- All 103 commits and all refs: no leaks found.
- Four Actions logs streamed directly through redacted stdin scanning: no leaks found; raw logs were neither printed nor stored.
- Directory scan: 33 generic-key matches, all confined to ignored `.next`, `.open-next`, and `.wrangler` proof output; none is tracked.

Automated scanning did not prove privacy or rights. At that historical checkpoint, human review of identities, history, files, third-party material, Actions exposure, repository metadata, and publication authority remained pending. Those gates were later separately approved and executed; this historical scan is not current public-state evidence.

## License inventory

The clean-worktree production inventory completed only when allowed to read the actual pnpm store. Workspace license identifiers were MIT, Apache-2.0, MIT OR Apache-2.0, BSD-2-Clause, BSD-3-Clause, ISC, 0BSD, BlueOak-1.0.0, CC0-1.0, Python-2.0, CC-BY-4.0, and LGPL-3.0-or-later.

- The LGPL entry is the platform binary `@img/sharp-libvips-darwin-arm64`; the CC-BY entry is `caniuse-lite`. Both belong to the private compatibility-proof dependency graph and neither public tarball.
- The standards production/peer tool graph contains permissive identifiers only; observability reports no production licenses.
- Automated inventory is not legal advice or proof of title. Human confirmation was still pending at this historical checkpoint and was resolved separately before public execution.

## Historical pre-release official evidence

- GitHub's official `actions/checkout` documentation confirms `fetch-depth: 0` fetches all branch/tag history, `ref` may name a branch, and `persist-credentials: false` opts out of persisted authentication.
- GitHub's official workflow-event documentation states `workflow_dispatch` uses the last commit and ref of the selected branch/tag.
- npm's official trusted-publishing, provenance, package-metadata, and access-token guidance was the external runbook authority; none of those settings or actions had been exercised at this historical checkpoint.
- Current official Node, pnpm, npm, Changesets, action, and Gitleaks versions/advisories are recorded in the dated [preparation evidence](2026-08-06-public-package-release-preparation.md) and Node verification evidence.

The current npm and GitHub release documentation refreshed after execution is linked in the public execution section above.

## Reviewer dispositions

| Review | Material finding | Repair and final disposition |
|---|---|---|
| Requirements | README contradicted implemented codecs/inference/diagnostics/rendering | accurate implemented versus deferred boundary added and constitution-tested; resolved |
| Architecture/anti-overengineering | raw-SHA checkout did not guarantee Changesets' local `main`; same README contradiction | full-history `main` checkout plus exact `HEAD`/local-main checks; resolved; no other material architecture finding |
| Test evidence | Git assertions lacked mutation protection; HTTP/network adapter untested | independent deletion mutations plus classifier/request-shell tests; resolved; 15/15 focused tests |
| Supply-chain/privacy | exact-version-only check allowed unwanted earlier package history | package-level and exact-version absence, authenticated human name check, and post-publication complete-version-set check; resolved; 7/7 focused tests |
| Future provenance fix | sole missing explicit publish-time provenance request | `f640c87a709bc4266c59543942fe093824d02eb9`; focused 1/1 and full file 15/15 GREEN, diff check passed, independent review found no material issue |

## Historical pre-release blockers (superseded)

These items blocked external action at the private-candidate checkpoint. They are retained as historical provenance and are not current blockers:

- Human privacy, rights, identity, attribution, and authority confirmation was pending; it was later separately confirmed.
- Authenticated npm package-name confirmation was pending; execution later established the exact public version sets.
- The workflow had not run on GitHub; run `31128800393` later completed successfully.
- The token, environment, trusted publishers, public repository, signatures, registry tarballs, and fresh consumers did not yet exist; their current dispositions are recorded above.
- Registry absence and advisory results were time-sensitive and were refreshed at the applicable gates.
- Two-package publication was non-atomic; no mixed result occurred.
- The automation limits remain current and are restated under current risks above.

## Recovery domains

- **Source:** reverting `f640c87` or this evidence increment would affect only future workflow/docs state; any broader source correction requires its own approved comparison and does not alter published registry versions.
- **Package registry:** the `0.1.0` versions are immutable. Any registry correction or deprecation is separate from source rollback and requires new explicit approval; no registry action is recommended by this evidence increment.
- **Credentials and trust:** the bootstrap token and GitHub environment secret are gone. Trusted-publisher or publishing-access changes are separate external actions and require explicit approval.
- **Repository visibility:** the repository is public. Returning it to private would not retract prior disclosure or published packages and requires separate approval.
- **State and migrations:** no `.egeria` state, migration, provider resource, deployment, or client repository changed.
