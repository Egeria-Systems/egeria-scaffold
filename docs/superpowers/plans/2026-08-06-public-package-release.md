# Public Package Release Implementation Plan

> **Status:** Approved for local implementation. Do not take an external action.

**Goal:** Publish exactly `@egeria-systems/standards@0.1.0` and `@egeria-systems/observability@0.1.0` from the reviewed public `Egeria-Systems/egeria-scaffold` source with Apache-2.0 license files, exact tarballs, npm provenance/signatures, and post-bootstrap trusted publishing.

**Architecture:** Keep a functional validation core and an imperative release shell. Existing Changesets remains the only version/publication owner. A read-only release check validates the approved commit, exact public package set, candidate manifests, and all-or-nothing absent registry state before publication. GitHub Actions supplies the only publication runtime; the workflow is manual, environment-gated, exact-commit-bound, cache-free, and least privilege. External visibility, credentials, publication, and trust settings remain separate human gates.

**Pinned tools:** Node `22.23.2` (prerequisite), pnpm `11.20.0`, npm `12.0.2`, Changesets `2.31.1`, `actions/checkout` commit `3d3c42e5aac5ba805825da76410c181273ba90b1`, `pnpm/setup` commit `c9883cc79df532ad1a7b81bf9ab944ceb090d65c`, Gitleaks `8.30.1` for temporary private audit only.

The Volta default is already pnpm `11.20.0`; do not mutate it. Before every implementation session, verify `command -v pnpm` and `pnpm --version`. If the desktop fallback still resolves pnpm `11.16.0`, substitute `/Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm` for every `pnpm` command below. Never continue under the repository-incompatible fallback.

**Approved design:** [Public package release design](../specs/2026-08-06-public-package-release-design.md)

**Preparation evidence:** [Public package release preparation](../../implementation-evidence/2026-08-06-public-package-release-preparation.md)

## Stop gates and operator timing

The user should not act in GitHub or npm during local implementation.

The controller must stop at each numbered gate:

1. **Prerequisite gate:** Task 6 is integrated and approved; Node `22.23.2` compatibility is implemented and approved; one exact clean combined base exists.
2. **Local increment gates:** make and verify each focused commit below. The user's standing approval covers a no-choice continuation to the next local increment; stop if a material contradiction, failed proof, or user choice appears.
3. **Private release-candidate gate:** independent reviews, final local verification, complete public-surface audit, exact tarballs, and the private review packet are approved.
4. **Private push gate:** obtain a separate explicit approval to update remote `main` to the exact release candidate while the repository is still private.
5. **Human setup gate:** only now does the user create the one-day npm token and protected GitHub environment secret. The token never enters chat or a local command.
6. **Visibility gate:** obtain a separate explicit approval for the exact durable private-to-public disclosure.
7. **Publication gate:** after publicization checks pass, obtain a separate explicit approval for the exact two-package workflow run.
8. **Partial-failure gate:** any mixed registry result stops; no rerun, deprecation, unpublish, or corrective publish without a new approved recovery plan.
9. **Post-release hardening gate:** the user configures both trusted publishers, disallows traditional tokens, deletes the GitHub secret, and revokes the npm token from exact instructions.
10. **Completion gate:** post-release evidence is committed, reviewed, and approved. Any second push of evidence remains separately authorized.

## Exact file inventory

### Planning artifacts created before implementation

- Modify `docs/superpowers/specs/2026-08-06-public-package-release-design.md`
- Create `docs/implementation-evidence/2026-08-06-public-package-release-preparation.md`
- Create `docs/superpowers/plans/2026-08-06-public-package-release.md`

### Local release-candidate implementation

- Create `LICENSE`
- Modify `README.md`
- Modify `CONTRIBUTING.md`
- Modify `package.json`
- Modify `pnpm-lock.yaml`
- Create `.github/workflows/package-release.yml`
- Delete `.changeset/lean-builder-monorepo.md` through `changeset version`
- Modify `packages/standards/package.json`
- Modify `packages/standards/README.md`
- Create `packages/standards/LICENSE`
- Create `packages/standards/CHANGELOG.md` through `changeset version`
- Modify `packages/observability/package.json`
- Modify `packages/observability/README.md`
- Create `packages/observability/LICENSE`
- Create `packages/observability/CHANGELOG.md` through `changeset version`
- Create `scripts/check-package-release.mjs`
- Modify `tests/package-boundaries/internal-linting.test.mjs`
- Modify `tests/package-boundaries/release-safeguards.test.mjs`
- Create `tests/package-boundaries/package-release.test.mjs`
- Modify `tests/package-boundaries/private-packages.test.mjs`
- Modify `tests/package-boundaries/public-observability.test.mjs`
- Modify `tests/package-boundaries/public-standards.test.mjs`
- Modify `tests/constitution/constitution.test.mjs`
- Modify `docs/architecture/package-ownership.md`
- Modify `docs/architecture/enforcement-map.md`
- Create `docs/implementation-evidence/2026-08-06-public-package-release-verification.md`
- Create `docs/review-packets/2026-08-06-public-package-release.md`

No other implementation, workflow, package, schema, template, generated-project, provider, deployment, or state file is in scope. In particular, do not edit the user's primary-checkout `AGENTS.md`.

## Prerequisite and isolation procedure

### Step 1: verify the prerequisite base

From the primary repository, read-only checks must establish:

```bash
git status --short --branch
git worktree list --porcelain
git log --oneline --decorate -15
git merge-base --is-ancestor 3200f98a80bde382c0a945efafb7fff648509bca main
rg -n '22\.23\.2' .nvmrc package.json .github/workflows/compatibility-proof.yml docs/compatibility/nextjs-cloudflare.md tests/constitution
```

Expected:

- Task 6 is an ancestor of the selected base through its approved integration;
- every canonical runtime pin is `22.23.2` and the Node compatibility review packet is approved;
- `main` has no merge/rebase/cherry-pick/revert in progress;
- the primary user-owned status is recorded and preserved; and
- package APIs and release files still match the preparation evidence.

Stop if any prerequisite is absent, if the base contains an unapproved change, or if the current package/release surface drifted.

### Step 2: create the isolated implementation worktree

After Gate 1 approval, create a semantic branch from the exact current approved base:

```bash
git worktree add -b public-package-release /private/tmp/egeria-scaffold-public-package-release main
git -C /private/tmp/egeria-scaffold-public-package-release status --short --branch
git -C /private/tmp/egeria-scaffold-public-package-release rev-parse HEAD
```

Record the resulting base SHA in the verification evidence. The new worktree must be clean. If the branch or path already exists, stop and inspect it; do not delete or reuse it blindly.

Install only from the committed lockfile with the exact repository tool:

```bash
cd /private/tmp/egeria-scaffold-public-package-release
CI=true /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm install --frozen-lockfile
node --version
/Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm --version
```

Expected versions at this point: Node `v22.23.2`, pnpm `11.20.0`.

## Increment 1: license and public package metadata

### Files

- Create `LICENSE`
- Create `packages/standards/LICENSE`
- Create `packages/observability/LICENSE`
- Modify `packages/standards/package.json`
- Modify `packages/observability/package.json`
- Modify `packages/standards/README.md`
- Modify `packages/observability/README.md`
- Modify `README.md`
- Modify `tests/package-boundaries/public-observability.test.mjs`
- Modify `tests/package-boundaries/public-standards.test.mjs`
- Modify `tests/package-boundaries/release-safeguards.test.mjs`

### RED

Add a focused test named `public source and package licenses are exact` that:

- reads all three license files;
- requires byte equality;
- requires SHA-256 `cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30`;
- requires each public manifest to declare `license: "Apache-2.0"`;
- requires normalized repository objects:

```json
{
  "type": "git",
  "url": "git+https://github.com/Egeria-Systems/egeria-scaffold.git",
  "directory": "packages/standards"
}
```

and the identical object with `directory: "packages/observability"`;
- preserves the existing exact exports, files, scripts, peer/dependency metadata, and `publishConfig`; and
- changes dry-run expected file lists only by adding `LICENSE`.

Run:

```bash
node --test --test-name-pattern='public source and package licenses are exact|public package manifests constrain exports and publication|public package dry runs contain only approved files' tests/package-boundaries/release-safeguards.test.mjs
```

Expected RED: missing license paths and manifest metadata. Existing package behavior should remain green.

### GREEN

Using `apply_patch`, add the exact official Apache-2.0 text to all three license paths. Add only `license` and the normalized monorepo `repository` object to each public manifest.

Update the package READMEs to:

- describe current public APIs without executable phase labels;
- link to the exact public source directory;
- state Apache-2.0 and link package-local `LICENSE`;
- preserve the standards peer/API and observability empty-root limits; and
- make no claim that npm publication has already occurred.

Add a root README license section and preserve the separately updated Node compatibility wording from the prerequisite increment.

Run:

```bash
node --test --test-name-pattern='public source and package licenses are exact|public package manifests constrain exports and publication|public package dry runs contain only approved files' tests/package-boundaries/release-safeguards.test.mjs
pnpm run check:semantic-naming
git diff --check
```

Expected GREEN: all selected tests pass; dry-run packs contain exact existing files plus `LICENSE`; no package API changes.

### Commit and stop

Inspect the exact diff, stage only the nine files listed for this increment, and commit:

```text
License public package sources
```

Stop for explicit increment approval. Do not begin versioning.

## Increment 2: materialize and verify the `0.1.0` candidate

### Files

- Modify `package.json`
- Delete `.changeset/lean-builder-monorepo.md` through the existing command
- Modify `packages/standards/package.json` through the existing command
- Create `packages/standards/CHANGELOG.md` through the existing command
- Modify `packages/observability/package.json` through the existing command
- Create `packages/observability/CHANGELOG.md` through the existing command
- Create `scripts/check-package-release.mjs`
- Modify `tests/package-boundaries/internal-linting.test.mjs`
- Modify `tests/package-boundaries/release-safeguards.test.mjs`
- Create `tests/package-boundaries/package-release.test.mjs`
- Modify `tests/package-boundaries/private-packages.test.mjs`
- Modify `tests/package-boundaries/public-observability.test.mjs`
- Modify `tests/package-boundaries/public-standards.test.mjs`

The complete quality RED identified these direct manifest/script contract consumers after version materialization. The user's standing amendment approval covers their exact expectation updates; no production surface is added by this amendment.

### Interface contract

`scripts/check-package-release.mjs` owns only release validation. It exports pure helpers and has three CLI modes:

```text
node scripts/check-package-release.mjs context
node scripts/check-package-release.mjs local
node scripts/check-package-release.mjs registry
```

`context` validates only explicit workflow context:

- `GITHUB_REF` is exactly `refs/heads/main`;
- `RELEASE_COMMIT` is exactly 40 lowercase hexadecimal characters;
- `GITHUB_SHA` equals `RELEASE_COMMIT`.

`local` validates only local candidate state:

- the only public package paths/names are standards and observability;
- both versions are valid nonzero semver values;
- for this initial candidate both are exactly `0.1.0`;
- no pending Changeset Markdown file exists except `.changeset/README.md`;

`registry` first applies the same local validation and then queries only the two exact target versions:

- each exact registry URL returns HTTP 404;
- HTTP 200 for either package, a mixed 200/404 state, a redirect, rate limit, authentication response, or network error fails closed;
- response bodies are never logged; and
- the command performs no write or publish.

The pure core receives package records, environment values, and registry status values and returns immutable problem records. The CLI shell owns file reads, `fetch`, safe error rendering, and exit status. Do not add a generic release service, provider abstraction, registry port, or package-discovery framework.

Add root scripts:

```json
{
  "check:package-release": "node scripts/check-package-release.mjs",
  "verify:builder-packages:quality": "pnpm run test:constitution && pnpm run test:package-boundaries && pnpm run lint:builder && pnpm run build:builder && pnpm run test:packages && pnpm run typecheck:builder",
  "verify:builder-packages": "pnpm run verify:builder-packages:quality && pnpm run changeset:status",
  "verify:package-release-candidate": "pnpm run verify:builder-packages:quality && pnpm run check:package-release -- local"
}
```

The exact existing commands remain unchanged; the shared quality aggregate removes duplication. `changeset:status`, `version-packages`, and `release-packages` remain owned by Changesets.

### RED

In `release-safeguards.test.mjs`, replace the pending-initial-changeset assertion with a candidate assertion requiring:

- both manifest versions exactly `0.1.0`;
- no pending release Markdown other than `.changeset/README.md`;
- both exact `CHANGELOG.md` headings and the initial release summary;
- private packages unchanged; and
- the new root script composition exactly as specified.

In `package-release.test.mjs`, test the pure release checks:

- exact main/commit context accepted;
- invalid ref, uppercase/short SHA, and mismatched SHA rejected;
- exact two-package `0.1.0` candidate accepted;
- missing, extra, renamed, private, zero, or wrong-version records rejected;
- all-404 registry state accepted;
- present, mixed, redirect, rate-limit, and network-failure states rejected without including a response body or credential-like input in the returned error.

Run:

```bash
node --test tests/package-boundaries/release-safeguards.test.mjs tests/package-boundaries/package-release.test.mjs
```

Expected RED: missing verifier/scripts, versions remain `0.0.0`, pending Changeset remains, and changelogs are absent.

### GREEN

Implement the minimum validator and script composition. Then invoke the existing version owner exactly once:

```bash
pnpm run version-packages
```

Do not hand-edit generated versions/changelogs or preserve an empty/spent Changeset. Inspect all generated files. Confirm no private package was versioned and no dependency range changed.

Run focused GREEN without network by stubbing the registry through the pure test boundary:

```bash
node --test tests/package-boundaries/release-safeguards.test.mjs tests/package-boundaries/package-release.test.mjs
pnpm run verify:builder-packages:quality
pnpm run check:semantic-naming
git diff --check
```

Do not run `changeset status` on this isolated branch after the changeset is consumed; its nonzero changed-package/no-changeset result is expected until the exact candidate is remote `main`. The release-candidate aggregate is the branch check. The workflow reruns `changeset status` after checkout from `main`.

### Commit and stop

Stage only the files listed for this increment and commit:

```text
Prepare public package release candidate
```

Stop for explicit increment approval.

## Increment 3: guarded manual publication workflow

### Files

- Modify `package.json`
- Modify `pnpm-lock.yaml`
- Create `.github/workflows/package-release.yml`
- Modify `scripts/check-package-release.mjs`
- Modify `tests/package-boundaries/package-release.test.mjs`
- Modify `tests/package-boundaries/release-safeguards.test.mjs`

### RED

Extend the workflow/release tests to require:

- exact root `npm: "12.0.2"` development dependency;
- workflow name `Package release` and filename `package-release.yml`;
- only `workflow_dispatch`, with required string input `release_commit`;
- no push, pull-request, schedule, release, or reusable-workflow trigger;
- permissions exactly `contents: read` and `id-token: write`;
- concurrency group `package-release`, cancellation disabled;
- one job gated to `refs/heads/main`, `ubuntu-24.04`, environment `npm-release`;
- checkout SHA `3d3c42e5aac5ba805825da76410c181273ba90b1`, `persist-credentials: false`;
- pnpm setup SHA `c9883cc79df532ad1a7b81bf9ab944ceb090d65c`, pnpm `11.20.0`, runtime `node@22.23.2`, cache `false`, install `false`;
- frozen install and exact `pnpm exec npm --version` assertion for `12.0.2`;
- context validation before verification;
- `pnpm run verify:package-release-candidate`, `pnpm run changeset:status`, peer check, and moderate audit before the final registry check;
- `registry` validation exactly once, immediately before authentication;
- `NPM_BOOTSTRAP_TOKEN` referenced only by a configuration step, never echoed and never passed to the publish step;
- npm user configuration removed in an `if: always()` cleanup;
- the only publish command is `pnpm run release-packages`;
- no cache action, setup-node action, Git push/tag push, GitHub release, deployment, Wrangler, provider, or private package publication; and
- mutation-style workflow tests fail if verification moves into the secret-bearing block, a secret is mapped to publish, or cleanup is removed.

Run:

```bash
node --test --test-name-pattern='package release workflow|release registry state|root release commands' tests/package-boundaries/package-release.test.mjs tests/package-boundaries/release-safeguards.test.mjs
```

Expected RED: npm dependency, lock entry, and workflow are absent.

### GREEN

Add the exact npm CLI through the package manager:

```bash
pnpm add --workspace-root --save-dev --save-exact npm@12.0.2
```

Create `.github/workflows/package-release.yml` with this semantic flow:

1. manual exact-commit input;
2. main-only job and `npm-release` environment;
3. checkout without persisted credentials;
4. exact pnpm/Node setup with cache/install disabled;
5. frozen install;
6. exact npm/context assertion;
7. complete release-candidate verification, raw Changesets main-ref status, peer check, and audit;
8. final all-404 `registry` check exactly once;
9. conditional temporary npm user authentication when `NPM_BOOTSTRAP_TOKEN` exists;
10. `pnpm run release-packages` with no token mapped directly to the step; and
11. unconditional npm user-authentication cleanup.

The authentication configuration command must be:

```bash
pnpm exec npm config set --location=user //registry.npmjs.org/:_authToken "$NPM_BOOTSTRAP_TOKEN"
```

inside a non-verbose conditional shell block. The cleanup command must be:

```bash
pnpm exec npm config delete --location=user //registry.npmjs.org/:_authToken
```

No repository `.npmrc` is created. When the secret is absent in later releases, npm `12.0.2` uses the configured trusted-publisher OIDC identity.

Run:

```bash
pnpm install --frozen-lockfile
pnpm exec npm --version
node --test --test-name-pattern='package release workflow|release registry state|root release commands' tests/package-boundaries/package-release.test.mjs tests/package-boundaries/release-safeguards.test.mjs
pnpm audit --audit-level=moderate
pnpm peers check
pnpm run verify:package-release-candidate
pnpm run check:semantic-naming
git diff --check
```

Expected: npm `12.0.2`; focused and candidate suites green; no moderate-or-higher known advisory at the recorded time; no lock drift after frozen install.

### Commit and stop

Stage only the six files listed for this increment and commit:

```text
Add guarded package release workflow
```

Stop for explicit increment approval. Do not create a GitHub environment or npm token.

## Increment 4: canonical release documentation

### Files

- Modify `tests/constitution/constitution.test.mjs`
- Modify `README.md`
- Modify `CONTRIBUTING.md`
- Modify `docs/architecture/package-ownership.md`
- Modify `docs/architecture/enforcement-map.md`

### RED

Add constitution assertions requiring the canonical owners to state:

- manifests are `0.1.0` release candidates without claiming live registry publication;
- Changesets owns version/publication and the release workflow does not create another resolver;
- `package-release.yml`, `npm-release`, exact-commit validation, bootstrap-token removal, and later OIDC trust are named;
- local configuration and a green workflow never self-authorize publication;
- the enforcement row maps package publication to manifest/API/tarball tests, release-context/registry tests, and the manual workflow;
- root README links Apache-2.0, source package paths, and the manual release boundary; and
- contributing guidance forbids local publication and requires approved Changesets for later public API changes.

Run:

```bash
node --test --test-name-pattern='package ownership documentation records the approved release boundary|repository documentation describes the builder topology' tests/constitution/constitution.test.mjs
```

Expected RED: the canonical documents describe only pre-release P0.3 safeguards.

### GREEN

Update only the canonical release/status paragraphs. Preserve package APIs, provider boundaries, phase history, and direct-main development rules. Do not copy the entire operator procedure into architecture documents; link this approved plan and the review protocol.

Run:

```bash
node --test tests/constitution/constitution.test.mjs
pnpm run verify:package-release-candidate
pnpm run check:semantic-naming
git diff --check
```

### Commit and stop

Stage only the five files listed for this increment and commit:

```text
Document package release controls
```

Stop for explicit increment approval.

## Private public-surface and rights audit

Do this only after all local increments are approved and the candidate worktree is clean.

### Refresh exact remote surfaces

Read live state without pushing:

```bash
git fetch --prune origin '+refs/heads/*:refs/remotes/origin/*' '+refs/tags/*:refs/tags/*'
git ls-remote --heads --tags origin
gh api repos/Egeria-Systems/egeria-scaffold --jq '{visibility,default_branch,archived,disabled,open_issues_count,has_issues,has_wiki,has_discussions}'
gh api 'repos/Egeria-Systems/egeria-scaffold/branches?per_page=100' --jq '[.[] | {name,sha:.commit.sha,protected}]'
gh api 'repos/Egeria-Systems/egeria-scaffold/actions/runs?per_page=100' --jq '[.workflow_runs[] | {id,name,status,conclusion,head_sha,created_at}]'
gh api 'repos/Egeria-Systems/egeria-scaffold/releases?per_page=100' --jq '[.[] | {tag_name,draft,prerelease,published_at}]'
gh api 'repos/Egeria-Systems/egeria-scaffold/forks?per_page=100' --jq 'length'
```

Stop if visibility is not private, an unknown ref/release/fork exists, remote `main` moved outside the approved ancestry, or an external surface cannot be audited.

### Run the redacted history scanner

Create a temporary directory outside the repository. Download only the official Darwin arm64 Gitleaks `8.30.1` archive, verify SHA-256 `b40ab0ae55c505963e365f271a8d3846efbc170aa17f2607f13df610a9aeb6a5`, extract it there, and confirm `gitleaks version` is `8.30.1`.

Run:

```bash
gitleaks git --log-opts='--all' --redact=100 --no-banner --report-format=json --report-path=/private/tmp/egeria-public-audit/history.json .
gitleaks dir --redact=100 --no-banner --report-format=json --report-path=/private/tmp/egeria-public-audit/directory.json .
```

Stream each historical Actions log through `gitleaks stdin --redact=100 --no-banner`; never print or commit a raw log. Store only redacted temporary reports. Any finding must be inspected privately and classified before continuing. A real secret in any future-public history blocks publication and requires revocation plus an approved history-remediation decision; do not rewrite history automatically.

### Human privacy and rights decision

The user/authorized rights holder must privately review and explicitly confirm all of the following:

- every commit author identity/email is acceptable for public history;
- no client, personal, recovery, credential, contractual, or proprietary material exists in any commit/ref;
- all tracked current files and relevant untracked inputs are intended for publication;
- all four historical Actions logs/artifacts are safe to expose;
- issues, pull requests, discussions, releases, wiki, forks, collaborators, environment names, and repository metadata are safe;
- Apache-2.0 may be granted for repository-owned source and documentation;
- incorporated third-party text/code and dependency licenses do not require an unprovided attribution or `NOTICE`; and
- package READMEs, tarballs, metadata, and source links are accurate.

Run the clean-worktree license inventory and inspect all nonpermissive, unknown, custom, or missing entries:

```bash
pnpm licenses list --prod --json
pnpm audit --audit-level=moderate
```

If the license inventory errors, an entry is unknown, or rights are uncertain, stop. Automated output is not legal advice or proof of title.

## Independent review and private candidate packet

Create a self-contained exact comparison packet and dispatch four read-only reviewers with no inherited assumptions, no edits, no recursive delegation, no GitHub comments, and no external action:

1. **Requirements reviewer:** approved design, exact-file plan, two package/version targets, user gates, and non-goals.
2. **Architecture/anti-overengineering reviewer:** Changesets ownership, functional core/imperative shell, package/API boundaries, canonical documentation, and unnecessary abstraction/churn.
3. **Test-evidence reviewer:** RED/GREEN causality, mutation protection, branch-vs-main Changesets behavior, workflow assertion strength, and limits of static evidence.
4. **Supply-chain/privacy specialist:** action/npm pins, permissions, token exposure, provenance preconditions, registry race/partial failure, license/tarball contents, public-history audit, and recovery.

Wait for all reviewers. Validate findings against the current tree, reconcile duplicates/conflicts, repair only evidence-backed material defects, and rerun only affected checks before the final suite.

Create and commit:

- `docs/implementation-evidence/2026-08-06-public-package-release-verification.md`;
- `docs/review-packets/2026-08-06-public-package-release.md`.

The packet must record the exact base/candidate SHAs and commits, changed files, RED/GREEN record, action/npm/tool evidence, tarball inventories and hashes, remote/public-surface audit, human rights/privacy confirmation without identity details, reviewer dispositions, commands/results, risks, unproven properties, deferred work, and separate source/package/token/visibility recovery domains.

Commit:

```text
Record private package release review
```

## Final private deterministic verification

Run once after all candidate inputs and reviewer repairs settle:

```bash
pnpm install --frozen-lockfile
pnpm exec npm --version
pnpm audit --audit-level=moderate
pnpm peers check
pnpm run verify:package-release-candidate
pnpm run check:package-release -- registry
pnpm run check:semantic-naming
git diff --check
git status --short --branch
PUBLIC_RELEASE_BASE_SHA="$(git merge-base main HEAD)"
test "$PUBLIC_RELEASE_BASE_SHA" = "$(git merge-base --fork-point main HEAD)"
git diff --stat "$PUBLIC_RELEASE_BASE_SHA"...HEAD
git diff --name-status "$PUBLIC_RELEASE_BASE_SHA"...HEAD
git log --oneline "$PUBLIC_RELEASE_BASE_SHA"..HEAD
```

Create actual tarballs outside the repository with `pnpm pack --pack-destination`, record SHA-256 and SHA-512 for each, inspect each archive, and confirm exact inventories:

Standards:

```text
LICENSE
README.md
eslint/cloudflare-isolation.mjs
eslint/typescript-strict.mjs
package.json
typescript/strict.json
```

Observability:

```text
LICENSE
README.md
dist/index.d.ts
dist/index.js
package.json
```

No `CHANGELOG.md` is shipped because neither existing `files` allowlist includes it. Do not broaden the tarballs merely because Changesets creates repository changelogs.

Present the private packet and stop for verified-final-diff approval. At this point the user still does nothing in npm or repository settings.

## External operator runbook

The controller must refresh live UI documentation immediately before displaying these instructions because npm and GitHub labels can change. The user never pastes a secret into chat.

### Operator action 1: approve the exact private push

After private candidate approval, the controller presents:

- exact candidate SHA;
- exact remote `main` SHA;
- proof the update is fast-forward;
- exact changed-file list; and
- confirmation repository visibility is still private.

Only after explicit push approval, update remote `main` from the release branch using an explicit refspec. Do not push another branch, tags, or a GitHub release. Verify live remote `main` equals the approved SHA and repository visibility remains private.

### Operator action 2: confirm authority and rights

The user confirms, without sharing account identity or evidence secrets in chat:

- they are authorized to make `Egeria-Systems/egeria-scaffold` public;
- they control npm scope `@egeria-systems` and can publish public scoped packages;
- npm account 2FA is enabled;
- Apache-2.0 publication is authorized;
- the private public-surface audit is accepted; and
- the exact two package/version names remain desired.

Stop on any negative or uncertain answer.

### Operator action 3: create the one-day npm bootstrap token

Only now, in a private browser session:

1. Sign in to `npmjs.com` with 2FA.
2. Open profile picture → **Access Tokens** → **Generate New Token**.
3. Token name: `egeria-scaffold-first-publication`.
4. Description: `One-time bootstrap for standards and observability 0.1.0`.
5. Check **Bypass two-factor authentication** because the GitHub workflow is noninteractive.
6. Leave **Allowed IP Ranges** empty; GitHub-hosted runner egress is not fixed.
7. Under **Packages and scopes**, choose **Read and write** and **Only select packages and scopes**; select only `@egeria-systems`.
8. Under **Organizations**, choose **No access**; organization-management access does not grant package publication and is not needed.
9. Set the shortest supported expiry: one day/custom next calendar day.
10. Review the summary, generate the token, and copy it once to a secure temporary clipboard/password-manager item.

Stop if the scope cannot be selected, write access is broader than `@egeria-systems`, bypass-2FA is unavailable, or expiry exceeds the shortest supported duration without an explicit risk approval.

### Operator action 4: configure the GitHub `npm-release` environment

While the repository is still private:

1. Open `Egeria-Systems/egeria-scaffold` → **Settings** → **Environments**.
2. Create exactly `npm-release`.
3. Under deployment branches/tags, choose selected branches/tags and add only `main`.
4. If required reviewers are available, select the authorized release reviewer. If a distinct reviewer is available, enable prevent-self-review; if the operator is the only eligible reviewer, leave prevent-self-review disabled and record that limitation.
5. Disable administrator bypass if the control is available and doing so will not make the sole authorized release impossible.
6. Under environment secrets, add exactly `NPM_BOOTSTRAP_TOKEN` and paste the token directly into GitHub.
7. Save, then close/delete the temporary local clipboard/password-manager copy when safe.

The user reports only completion or a UI mismatch, never the value. The controller verifies environment name, branch policy, reviewer/bypass metadata where the API exposes it, and only the secret's name—not its value.

### Operator action 5: make the repository public

After a fresh read-only history/registry/remote check and a separate explicit visibility approval:

1. Open repository **Settings** → **General** → **Danger Zone**.
2. Choose **Change repository visibility** → **Make public**.
3. Confirm the exact repository `Egeria-Systems/egeria-scaffold` and GitHub's durable-disclosure warnings.

Immediately verify:

- live visibility is `public`;
- public source at the approved commit is readable without authentication;
- Actions history/log exposure matches the audit;
- `main` still equals the approved SHA;
- the `npm-release` environment still exists with only `main` allowed;
- branch/ruleset state is re-read because publicization disables push rulesets;
- secret scanning and push protection are enabled where available; and
- no unknown fork, release, tag, issue, workflow run, or settings change appeared.

If required reviewers were unavailable while the repository was private but become available after publicization, return immediately to **Settings** → **Environments** → **npm-release**, add the authorized reviewer, enable prevent-self-review when a distinct eligible reviewer exists, and save before continuing. Reverify the environment metadata. Do not weaken an existing reviewer rule.

Stop before publication on any mismatch. Making the repository private again is not represented as retraction or rollback.

### Operator action 6: approve and run exact publication

After confirming both registry URLs still return 404, the controller reads the exact public remote-main SHA into `APPROVED_PUBLIC_MAIN_SHA` and renders its actual 40-character value—never a placeholder—in a separate publication approval request naming:

```text
@egeria-systems/standards@0.1.0
@egeria-systems/observability@0.1.0
source commit: ${APPROVED_PUBLIC_MAIN_SHA}
workflow: .github/workflows/package-release.yml
environment: npm-release
```

After approval, the user:

1. Opens repository **Actions** → **Package release**.
2. Selects **Run workflow**.
3. Selects branch `main`.
4. Enters the exact approved 40-character SHA in `release_commit`.
5. Starts the workflow.
6. Approves the `npm-release` environment gate when prompted and confirms the displayed commit/environment.

The controller monitors without approving on the user's behalf. If the job skips, fails, or either package appears before the final check, stop. Never rerun blindly.

## Partial-publication recovery

After any workflow failure, query both exact versions independently.

If neither exists, keep the repository public, preserve logs, diagnose, and require a new publication approval before retrying the unchanged commit.

If exactly one exists:

- record the immutable published name/version/integrity/provenance;
- do not rerun, unpublish, deprecate, retag, or change source;
- prepare a recovery comparison using the same source commit;
- prefer publishing the missing package from that unchanged commit if the defect is external and safely repaired;
- use deprecation/corrective release only with an accurate user-approved message; and
- require a new explicit recovery approval.

If both exist but the workflow failed later, treat publication as successful and continue verification; do not publish again.

npm unpublish is not routine rollback. A used name/version cannot be reused, and removal can break consumers. Source revert, registry deprecation/corrective version, token revocation, trusted-publisher settings, and repository visibility are independent recovery domains.

## Post-publication verification

Before removing the bootstrap credential, verify from fresh temporary npm consumers using exact Node `22.23.2` and npm `12.0.2`:

1. query each public packument and record version, public access, license, repository/directory, dist integrity, signatures, attestations, and tarball URL;
2. download each registry tarball and compare exact file inventories and Apache license SHA-256;
3. install standards with ESLint `9.39.5` in one temp consumer and ESLint `10.8.0` in another; import all declared exports and run the established strict/cloudflare behavioral controls;
4. install observability in a third temp consumer and assert its root module exports no values;
5. run `npm audit signatures` in each npm-installed consumer;
6. run `npm audit --audit-level=moderate` and record the dated result;
7. inspect npm's provenance view for exact build environment, workflow run, source commit, workflow file, and transparency-log entry; and
8. confirm private workspace names are still absent from the public registry and no extra repository file was packed.

Provenance/signatures prove linkage and integrity, not harmlessness, security, accessibility, or runtime fitness beyond the executed contracts.

## Operator action 7: configure trusted publishing and remove bootstrap access

For each exact package on npmjs.com:

1. Open package → **Settings** → **Trusted publishing**.
2. Select **GitHub Actions**.
3. Organization or user: `Egeria-Systems`.
4. Repository: `egeria-scaffold`.
5. Workflow filename: `package-release.yml` (filename only, including extension).
6. Environment: `npm-release`.
7. Allowed actions: `npm publish` only.
8. Save and re-open the settings to confirm exact case-sensitive values.
9. Under **Publishing access**, select **Require two-factor authentication and disallow tokens** and save.

Then:

1. GitHub repository → **Settings** → **Environments** → `npm-release` → delete environment secret `NPM_BOOTSTRAP_TOKEN`.
2. npm profile → **Access Tokens** → find `egeria-scaffold-first-publication` → delete/revoke it → confirm.
3. Verify through GitHub's API that the environment secret name is absent.
4. Verify through npm's token list/UI that the token is absent; record only its name/ID disposition, never token material.

The user reports completion, not credentials. If trusted publishing cannot be saved exactly, keep the token only for the minimum time needed to diagnose under a new approval; do not claim completion.

## Post-release evidence increment

Update the existing verification evidence and review packet with:

- exact public workflow run URL/ID/conclusion;
- public source commit and visibility check;
- both npm integrities, signatures, attestations, provenance links, and tarball inventories;
- temporary consumer commands/results;
- trusted-publisher field values;
- publishing-access state;
- GitHub secret deletion and npm token revocation evidence without values;
- any partial-failure disposition;
- residual risk that OIDC authentication is configured but not exercised until the next approved version; and
- package/source/token/visibility recovery state.

Run documentation/semantic/whitespace checks, commit:

```text
Record public package release evidence
```

Stop for final completion approval. A push of this evidence commit requires its own explicit authorization and must not create tags, a GitHub release, or a pull request.

## Completion criteria

The increment is complete only when:

- both exact `0.1.0` packages are public and installable;
- manifests, tarballs, Apache license bytes, APIs, and integrities match the candidate;
- provenance/signatures resolve to the exact public source/workflow;
- standards passes both peer-major controls and observability remains empty;
- no private package or unintended file was published;
- the repository remains public;
- both trusted publishers and token-disallow settings are configured;
- `NPM_BOOTSTRAP_TOKEN` is deleted and the npm token is revoked;
- all material review findings are resolved;
- verification evidence and the review packet are complete; and
- the user approves the final completion packet.

Only then may the independent Task 7 atomic generation prerequisite check be rerun on a clean integrated base. This release never authorizes Task 7 implementation by itself.
