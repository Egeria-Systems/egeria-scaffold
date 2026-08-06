# Public Package Release Preparation Evidence

**Date:** 2026-08-06 (America/Toronto)

**Status:** Preparation complete; local implementation approved

**Approved design:** [Public package release design](../superpowers/specs/2026-08-06-public-package-release-design.md)

**Implementation plan:** [Public package release plan](../superpowers/plans/2026-08-06-public-package-release.md)

## Approved increment

Prepare and release exactly these ordinary public dependencies:

- `@egeria-systems/standards@0.1.0`;
- `@egeria-systems/observability@0.1.0`.

The repository and packages remain private during preparation. The existing `Egeria-Systems/egeria-scaffold` repository becomes public only after the private release candidate receives verified-final-diff approval. The initial publish uses a short-lived npm credential inside a manual GitHub-hosted workflow so the first public versions can carry provenance. Later releases use npm trusted publishing. The repository remains public so the provenance source stays auditable.

Apache-2.0 is the approved license. The root and both public package tarballs will contain byte-identical copies of the official license text. No `NOTICE` is invented; a rights or attribution finding stops publication until the rights holder supplies the required text.

This increment does not expand either package API, implement observability behavior, publish a private workspace, deploy infrastructure, or implement atomic project generation.

## Prerequisite boundary

The release implementation must start from one clean integrated base that already contains:

1. the approved Task 6 deterministic skeleton rendering candidate, currently committed at `3200f98a80bde382c0a945efafb7fff648509bca` in `/private/tmp/egeria-scaffold-p1-task-6` but not integrated into `main`; and
2. the separately approved Node `22.23.2` compatibility update, which is not yet implemented.

Those prerequisites remain separate reviewable increments. This release plan does not integrate Task 6 or implement the Node update. If either prerequisite changes package APIs, package contents, tool versions, or the release surface, this preparation evidence and plan must be revalidated before release work begins.

## Frozen local repository state

The preparation review observed:

```text
repository: /Users/CoveMB/Code/CoveMB/egeria-scaffold
branch: main
HEAD: 8382de8f1377300d6bbeca6b67679d2c20ba6111
relationship: main...origin/main [ahead 43]
live origin/main: af299f4aeb602ebf7c3e0fc0c33a2d208cb496fc
```

The primary checkout is not an implementation surface because it contains user-owned work:

```text
 M AGENTS.md
?? docs/implementation-evidence/2026-08-06-atomic-project-generation-preparation.md
?? docs/superpowers/plans/2026-08-06-atomic-project-generation.md
?? docs/superpowers/specs/2026-08-06-public-package-release-design.md
```

The existing worktrees are:

- primary `main` at `8382de8`;
- Task 6 branch `p1-task-6-skeleton-rendering` at `3200f98`;
- semantic-naming branch `semantic-naming-enforcement` at `abd4296`.

Implementation therefore requires a new semantic release branch and isolated worktree after the prerequisite base exists. No user-owned primary-checkout change may be copied, staged, committed, cleaned, stashed, reset, or overwritten.

## Repository sources inspected

Preparation read the current repository rather than relying on conversation memory, including:

- root and package-local `AGENTS.md` files;
- the approved source plan and program roadmap;
- the architecture overview, capability model, enforcement map, and package-ownership owner;
- the accepted ADR index and the applicable accepted package-extraction and GitHub Actions authority decisions;
- the review and contribution protocol;
- root, standards, observability, Changesets, workspace, lockfile, and workflow manifests;
- public/private package-boundary and constitution tests;
- P0.3 preparation, verification evidence, and final review packet;
- current P1 evidence, recent commits, branches, worktrees, and status; and
- the approved public-package release design.

The canonical sources agree that standards and observability are the only public packages, public packages remain replaceable ordinary dependencies, observability stays empty in this increment, Changesets remains the version/publication owner, and local release configuration never authorizes publication.

## Current local package and release state

Verified facts on the frozen tree:

- both public manifests are version `0.0.0`;
- neither manifest currently declares `license` or `repository` metadata;
- no root or package-local `LICENSE` exists;
- both manifests already constrain exports/files and set public access, provenance, and the public npm registry;
- `prepublishOnly` delegates to each package's verification command;
- the root release command is exactly `changeset publish`;
- Changesets `2.31.1` is exact and the only pending release file requests a minor release for each public package;
- root, CLI, builder-core, and the compatibility proof are private;
- current dry-run packs contain only the existing allowlisted API files and omit a license because none exists; and
- the current release-safeguard suite passes 24 tests.

A disposable isolated simulation of `changeset version` confirmed the exact materialization behavior:

- both manifests become `0.1.0`;
- `.changeset/lean-builder-monorepo.md` is deleted;
- each package receives a `CHANGELOG.md` with a `0.1.0` minor entry; and
- raw `changeset status` exits nonzero on the release branch because package files differ from `main` after the changeset has been consumed.

That final behavior is expected, not a reason to preserve a spent or empty changeset. The plan introduces one shared quality aggregate plus a release-candidate verifier for the isolated branch. The existing `changeset status` contract remains authoritative for ordinary package changes and is rerun after the exact release commit becomes remote `main`.

## Baseline verification

The generic desktop `pnpm` resolved to pnpm `11.16.0` under its bundled Node `24.14.0`, so repository commands rejected it. The Volta default and exact repository binary are already pnpm `11.20.0`; no Volta update was necessary. The successful baseline used the exact binary after a frozen install restored only ignored dependency state:

```text
node --version
v22.23.0

/Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm --version
11.20.0

pnpm exec changeset --version
2.31.1

pnpm run test:package-boundaries
24/24 passed

pnpm run check:semantic-naming
passed

git diff --check
passed

pnpm audit --audit-level=moderate
No known vulnerabilities found
```

The current production-license inventory command encountered `ERR_PNPM_MISSING_PACKAGE_INDEX_FILE` for an ignored local virtual-store index even after the frozen install reported the graph current. This does not change committed source or block planning. The license inventory must run successfully from the clean release worktree after its frozen install; otherwise publication stops. A successful automated inventory remains evidence only and does not replace human rights review.

## Live GitHub state

Read-only GitHub API checks on 2026-08-06 established:

- `Egeria-Systems/egeria-scaffold` is private, enabled, and unarchived;
- `main` is the only remote branch, is not protected, and points to `af299f4aeb602ebf7c3e0fc0c33a2d208cb496fc`;
- local `origin/main` matches the live SHA;
- there are no tags, GitHub releases, or forks;
- four historical manual compatibility workflow runs exist and their logs will become public;
- the existing `compatibility` environment has a branch policy and permits administrator bypass;
- the current private-plan API rejects branch protection/rulesets with HTTP 403 and says to upgrade or make the repository public; and
- issues are enabled while wiki and discussions are disabled.

The full source/history, workflow-log, rights, identity, and privacy audit remains an implementation gate because its final input is the integrated release candidate. It must cover every ref and public GitHub surface before visibility changes.

GitHub's current [visibility documentation](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/managing-repository-settings/setting-repository-visibility) states that private-to-public exposes code, Actions history/logs, and activity; anyone may fork; and push rulesets are disabled. Returning private cannot retract clones or public forks. Publicization is therefore a durable disclosure.

Current [environment documentation](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments) confirms that environment secrets are withheld until protection rules pass, subject to repository plan/visibility. The live repository already supports environments while private, but reviewer controls and branch/ruleset availability must be rechecked after it becomes public.

## Live npm and tool evidence

### Target packages

Direct public-registry queries returned HTTP 404 for both exact targets on 2026-08-06:

```text
@egeria-systems/standards@0.1.0
@egeria-systems/observability@0.1.0
```

Absence is time-sensitive and proves neither npm-scope authority nor future availability. The workflow rechecks both immediately before publication and refuses a mixed or already-present state.

### npm CLI

npm `12.0.2` is selected for the locked release graph:

- it is the current stable `latest` release;
- it was published on 2026-07-29, beyond the workspace's 24-hour maturity minimum;
- its Node engine is `^22.22.2 || ^24.15.0 || >=26.0.0`, which includes approved Node `22.23.2`;
- its integrity is `sha512-uIXokLlBj6FpNUTQX1PmT5pz7BlIN9QlixX+zdaSNHsd0qUXsbDLr50xzY6Sw7cJVr0uzHKDOle0swmPW/p5Qw==`; and
- a current GitHub Advisory Database query returned no advisory affecting `npm@12.0.2`.

The implementation pins npm `12.0.2` as a root development dependency so Changesets' child `npm` process resolves from the committed, audited graph. A fresh audit of the resulting transitive graph is mandatory.

### pnpm, Changesets, and Node

- pnpm `11.20.0` requires Node `>=22.13`; registry integrity is `sha512-mm8zCpW2ZEbqCI+vFSFAWooB8H/ecSTMmVjf7VLUu0NnN+ZbCPhfN7Rvy6N1CSVYrFEmK4FoRLIvY0Bu0Wa/7g==`.
- Changesets `2.31.1` remains the stable selected owner; registry integrity is `sha512-uO05WTcRBwuVOJVSW8Cmpqw6q0WDL53ajGCMyszutvOe5toOnunbpM4jZzf+qxBOz7i0AzopZ8diBuewjmF40w==`.
- direct advisory queries returned no current advisory affecting either selected version.
- Node `22.23.2` was released on 2026-07-29 as a security release addressing the listed HTTP/2, permission, HTTPS, DNS, zlib, trace, and report issues. This release plan depends on the separately approved compatibility update rather than changing the runtime itself.

### GitHub Actions

The release workflow will pin:

- `actions/checkout@v7.0.1` to verified commit `3d3c42e5aac5ba805825da76410c181273ba90b1`;
- `pnpm/setup@v2.0.0` to verified commit `c9883cc79df532ad1a7b81bf9ab944ceb090d65c`.

Current repository security-advisory queries returned no advisory for either action. GitHub's [secure-use reference](https://docs.github.com/en/actions/reference/security/secure-use) identifies a full commit SHA as the immutable action reference and recommends minimum token permissions. The selected checkout release contains input-hardening fixes. The exact pnpm setup action installs a checksum-verified self-contained pnpm binary and exact runtime, defaults cache off, and supports `install: false`.

The workflow uses `contents: read`, `id-token: write`, `persist-credentials: false`, a GitHub-hosted Ubuntu 24.04 runner, exact Node/pnpm/npm, no dependency cache, and one `npm-release` environment. The bootstrap secret is mapped only during an ephemeral npm user-configuration step and is deleted from runner configuration in an `always()` cleanup step.

### npm provenance and trusted publishing

Current official npm documentation establishes:

- [trusted publishing](https://docs.npmjs.com/trusted-publishers/) requires npm `>=11.5.1`, Node `>=22.14.0`, a supported hosted runner, `id-token: write`, and exact case-sensitive repository/workflow claims;
- automatic trusted-publisher provenance requires a public repository and public package;
- [provenance generation](https://docs.npmjs.com/generating-provenance-statements/) requires public matching repository metadata and explicit public access for a first scoped release;
- [`repository`](https://docs.npmjs.com/cli/configuring-npm/package-json/) should use the normalized full Git object and a monorepo `directory`;
- [provenance verification](https://docs.npmjs.com/viewing-package-provenance/) uses `npm audit signatures` after an npm install;
- packages do not exist early enough to configure trusted publishing, so first publication needs traditional authentication;
- each package accepts only one trusted publisher configuration at a time; and
- after trust is configured, npm recommends 2FA with traditional tokens disallowed.

The first-publish token must be a short-lived granular token with publish-capable access and bypass-2FA enabled because npm requires either interactive 2FA or such a token for noninteractive first publication. Since the packages do not yet exist, the narrow selectable resource is the `@egeria-systems` package scope, not an organization-management permission. The token receives no organization-management access, no static IP restriction because GitHub-hosted runner addresses are not fixed, and the shortest available one-day expiry. It is entered directly into GitHub and never exposed to the agent or repository.

### Apache-2.0

The official [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0.txt) identifies SPDX `Apache-2.0`. Its current text has SHA-256:

```text
cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30
```

npm's current package metadata guidance accepts the SPDX identifier in `license`. The repository and each public tarball will include the full text. Automated byte comparison does not determine ownership or whether third-party attribution is complete.

### Public-history secret scanning

Gitleaks `8.30.1` is selected only as a temporary private audit tool:

- latest stable release date: 2026-03-21;
- current repository security-advisory query: none;
- Darwin arm64 archive SHA-256: `b40ab0ae55c505963e365f271a8d3846efbc170aa17f2607f13df610a9aeb6a5`.

It will scan the complete Git history/refs, final directory, and streamed historical Actions logs with 100% redaction. Reports remain outside the repository and must not contain secret values. Automated scanning can miss secrets and cannot decide privacy, client confidentiality, licensing, or publication rights.

## Consolidated contradictions and blocking uncertainties

No canonical repository source contradicts the approved release design. The following are real gates rather than design ambiguities:

1. **Integrated base not ready.** Task 6 is approved but not integrated, and Node `22.23.2` is approved but not implemented. Release code must not start first.
2. **Dirty primary checkout.** The release must use an isolated worktree and must preserve the user's `AGENTS.md` edit and untracked planning files.
3. **Authority cannot be inferred.** npm scope ownership, GitHub visibility authority, account 2FA, and rights-holder authority require human confirmation at the external gate.
4. **Repository protection changes with visibility.** Remote `main` is currently unprotected and private-plan protection APIs are unavailable. The exact-commit workflow and environment branch policy prevent publishing a different commit, but environment, ruleset, secret scanning, and bypass controls must be rechecked immediately after publicization.
5. **First token is necessarily scope-wide.** The two packages cannot be individually selected before they exist. A one-day `@egeria-systems` read/write token is the narrowest bootstrap credential; it must be revoked immediately after trusted publishers are configured.
6. **Two-package publication is not atomic.** Changesets may attempt both packages concurrently. Any mixed result stops for a new recovery approval; no blind rerun or automatic unpublish is allowed.
7. **Public disclosure is durable.** Source, history, Actions logs, and identity metadata may be copied or forked. Making the repository private later does not retract them.
8. **Trusted publishing cannot be exercised before the next version.** Configuration can be inspected after `0.1.0`, but OIDC authentication itself remains unproven until a later approved publish. The bootstrap release's provenance remains independently verifiable.

These gates do not block exact-file planning. Any failed authority, rights, privacy, or secret-history check blocks publicization and publication.

## Approval boundary

Approval of the linked plan authorizes only its named local release-candidate implementation, tests, focused commits, private audits, and read-only reviewers after the prerequisite base exists. It does not authorize prerequisite implementation, staging or committing user-owned primary-checkout work, push, remote-main update, repository visibility change, secret creation, npm token creation, workflow dispatch, environment approval, package publication, trusted-publisher mutation, token revocation, or another external action.

The plan identifies exactly when the human operator must act. Until the private release packet and exact commit are approved, the user should do nothing in GitHub or npm.
