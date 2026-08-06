# Public Package Release Design

**Status:** Approved

**Date:** 2026-08-06

**Approved decisions:** Keep the repository and packages private throughout preparation. License the repository and both public packages under Apache-2.0. Make the existing `Egeria-Systems/egeria-scaffold` repository public only after the exact release candidate passes review. Publish `@egeria-systems/standards@0.1.0` and `@egeria-systems/observability@0.1.0` from that public repository with npm provenance, then keep the source public. Bootstrap the first publication through a short-lived npm credential in GitHub Actions; use npm trusted publishing for later releases.

## Goal

Establish the two approved ordinary public dependencies on npm with exact source, license, package contents, integrity, registry signatures, and public build provenance while exposing neither the repository nor package bytes before the reviewed release boundary.

This release is a prerequisite for P1 atomic project generation. It is a separate increment: release preparation and publication do not authorize or implement the Task 7 builder kernel.

## Non-goals

This increment does not:

- add or expand a public API;
- implement observability behavior;
- change generated projects, capability resolution, `.egeria` state, or the CLI;
- publish builder-core, the CLI, the root workspace, or the compatibility proof;
- create placeholder, private, prerelease, or temporary npm versions;
- create a second public source repository;
- deploy a Worker or mutate any application provider;
- automatically unpublish a partially released package;
- claim that provenance, signatures, package tests, or an advisory scan prove the code secure; or
- make private source exposure reversible after public access, cloning, or forking becomes possible.

## Approaches considered

### 1. Private preparation, just-in-time public source, token bootstrap, then OIDC — selected

Finish licensing, metadata, release automation, versioning, tarball inspection, history/privacy review, deterministic verification, and independent review while the repository remains private. After the exact release diff is approved and present on the private remote, make the repository public and run one manually approved GitHub-hosted publish using a short-lived granular npm token. Configure each now-existing package for trusted publishing, remove the bootstrap secret, revoke the token, and use OIDC thereafter.

This is the smallest design that gives the initial `0.1.0` releases public provenance without creating a second source owner or an unwanted npm history.

### 2. Publish private or placeholder packages before the real release — rejected

An earlier registry version would allow trusted-publisher configuration before `0.1.0`, but it would create permanent package history, add access and visibility transitions, and expose irrelevant bytes when the package becomes public. It does not remove the requirement for public source at the provenance-bearing release.

### 3. Extract the packages to a separate public repository — rejected

A separate repository could leave builder internals private, but it would introduce source synchronization, duplicated governance, and ambiguous canonical ownership for packages currently developed and tested inside the monorepo. The approved program treats these packages as ordinary dependencies owned here; the extraction cost is not justified.

## Repository and license boundary

The public source remains the existing repository:

```text
https://github.com/Egeria-Systems/egeria-scaffold
```

The root contains the canonical Apache License 2.0 text. Each public package contains an identical package-local `LICENSE` so its npm tarball carries the license without relying on a parent directory. Package-boundary tests compare all three bytes and fail on drift.

Both public package manifests declare:

- `license: "Apache-2.0"`;
- the case-correct public Git repository URL;
- their exact monorepo `directory` (`packages/standards` or `packages/observability`);
- existing `publishConfig.access: "public"`;
- existing `publishConfig.provenance: true`; and
- the public npm registry.

No `NOTICE` file is invented. If the rights review discovers incorporated material that requires attribution or an Apache NOTICE, publication stops until the rights holder supplies the required text.

## Private preparation phase

All source changes and checks happen while GitHub still reports the repository as private and both npm package/version queries return absent.

Preparation includes:

1. establish the approved clean combined base containing Task 6 and current semantic-naming work without including the user's unrelated primary-checkout edit;
2. complete the separately approved Node `22.23.2` compatibility increment;
3. add the Apache-2.0 license surfaces and exact package metadata;
4. add a manual, least-privilege release workflow and its structural contract tests;
5. use the existing Changesets owner to version only standards and observability from `0.0.0` to `0.1.0`;
6. build and dry-run-pack both packages, then compare exact file lists, manifest fields, dependency metadata, and tarball hashes against approved expectations;
7. run deterministic repository/package verification and a current locked-graph advisory/signature assessment without publishing;
8. audit every repository surface that will become public; and
9. dispatch independent requirements, architecture/anti-overengineering, test-evidence, and supply-chain/privacy reviewers before producing a release review packet.

The public-surface audit covers the complete Git history and every remote ref intended to remain visible, tracked and relevant untracked files, credentials and personal/client information, dependency licenses, incorporated third-party text/code, GitHub Actions workflow history/logs/artifacts, issues, pull requests, discussions, releases, wiki content, forks, collaborators, secrets/environment configuration, and repository rules. Automated secret scanning is evidence, not proof; a human rights/privacy decision remains required.

The release candidate stops at verified-final-diff approval. No local test, plan approval, review report, or green workflow authorizes push, visibility change, credential creation, or publication.

## Release workflow contract

The repository has one package-publication workflow with a semantic filename and manual `workflow_dispatch` trigger. It:

- accepts only the exact protected `main` release commit;
- uses one concurrency group with cancellation disabled;
- references a GitHub environment named `npm-release`;
- grants only `contents: read` and `id-token: write`;
- runs only on a GitHub-hosted runner;
- pins every third-party action to a reviewed full commit SHA;
- disables package-manager caching for the release job;
- installs exact Node, pnpm, and a release-supported exact npm CLI version selected in the implementation plan;
- performs a frozen install without changing the committed lockfile;
- checks out `main` with full history, then requires both local `main` and `HEAD` to equal the exact approved commit before Changesets runs;
- runs the full relevant deterministic verification once;
- confirms package names and versions are exactly the approved pair at `0.1.0`;
- confirms neither package name nor exact target version exists before the initial release;
- rebuilds and inspects the exact dry-run package contents immediately before publication;
- invokes the existing root `release-packages`/Changesets publication owner rather than adding a competing version resolver;
- requests provenance and public access through the package manifests;
- never logs credentials, npm configuration, package-manager environment, or secret-bearing command output; and
- performs no Git push, tag push, GitHub release, deployment, provider call, or unrelated publication.

The `npm-release` environment supplies one temporary secret named `NPM_BOOTSTRAP_TOKEN` for the first publication only. The workflow maps it to npm authentication without writing it to the repository. The user enters it directly in GitHub and never pastes it into chat, a command transcript, evidence, or a repository file.

The workflow carries `id-token: write` during the bootstrap run because npm provenance uses the GitHub build identity even when registry authentication comes from the short-lived token. After trusted publishers are configured, the same permission provides both OIDC authentication and automatic provenance without a stored write token.

## Exact public release boundary

The operator checklist in the implementation plan separates preparation from irreversible external actions. At the boundary:

1. verify the approved release commit and all relevant private remote state one final time;
2. push only the exact approved commit while the repository is still private, under separate push authorization;
3. create/configure the `npm-release` environment, required reviewer/branch restriction, and temporary secret without exposing its value;
4. confirm npm scope ownership, account 2FA, package-name availability, token scope/expiry, GitHub organization authority, and rights-holder approval;
5. obtain explicit confirmation for the exact visibility change;
6. make `Egeria-Systems/egeria-scaffold` public and immediately recheck visibility, Actions-log exposure, branch/ruleset state, and security settings;
7. obtain explicit confirmation for the exact two-package publication;
8. dispatch the release workflow for the exact `main` commit and approve its `npm-release` environment gate; and
9. stop on any mismatch or partial failure without improvising a second publish.

GitHub documents that a private-to-public transition exposes code, commit history, Actions history/logs, and permits public forks; it can also change repository-rule behavior. Returning the repository to private does not retract source already cloned or forked. Publicization is therefore treated as a durable disclosure, not a reversible toggle.

## Publication concurrency and partial failure

Publication cannot be atomic across npm packages. Changesets `2.31.1` checks registry state and skips an already-published exact version, but its current publisher may attempt the unpublished packages concurrently. The design therefore makes no package-order claim. After any failed workflow, the controller queries both exact registry versions before deciding that either transition succeeded.

If one package publishes and the other fails:

- stop the workflow and record the exact immutable registry state;
- do not rerun blindly, unpublish automatically, change tags, or overwrite a version;
- diagnose every missing publication against the unchanged release commit;
- prepare an approval-ready recovery action that either publishes the missing package from the same source commit or deprecates the published package with an accurate message; and
- require a new explicit external-action approval.

Unpublish is not the normal rollback. A published version is immutable; source rollback, package deprecation/corrective release, token revocation, and repository visibility are separate recovery domains.

## Post-publication verification and trust hardening

Before the release gate is considered satisfied, verify independently from a fresh temporary consumer:

- both exact public manifests and public visibility;
- exact tarball integrity and approved file inventories;
- Apache-2.0 license metadata and included license bytes;
- case-correct repository links and monorepo directories;
- provenance and publish attestations tied to the approved public commit/workflow;
- npm registry signatures and attestations with the current supported npm CLI;
- clean installation of each package from `https://registry.npmjs.org/`;
- standards exports against both declared ESLint peer majors;
- the observability empty-root contract;
- no moderate-or-higher known advisory in the exact installed public graph at the recorded time; and
- no accidental publication of private packages, workspace paths, credentials, build caches, or unrelated files.

After those checks:

1. configure `@egeria-systems/standards` and `@egeria-systems/observability` trusted publishers to the exact GitHub organization, repository, workflow filename, and `npm-release` environment;
2. allow `npm publish` only because the existing Changesets owner invokes that command and the GitHub environment supplies the human approval gate;
3. set package publishing access to require 2FA and disallow traditional tokens where npm permits;
4. delete `NPM_BOOTSTRAP_TOKEN` from the GitHub environment;
5. revoke the granular token at npm and confirm it no longer authenticates;
6. preserve the repository as public so provenance source remains auditable; and
7. record the resulting package settings and evidence without credentials or unrelated account identity.

Future releases use the same manual, environment-protected workflow with OIDC and no npm write secret. Changing the workflow filename, repository identity, GitHub environment, package name, or trusted-publisher claims requires a separately reviewed trust migration.

## Human and agent responsibilities

The agent may prepare local source, tests, documentation, read-only audits, exact tarball previews, workflow configuration, verification commands, review packets, and a user-facing operator checklist. The agent must not ask the user to paste a credential into chat.

The user or authorized organization/package owner performs the credential- and authority-bearing steps from exact instructions:

- confirm rights-holder authority and Apache-2.0 publication approval;
- approve the exact private push;
- create the short-lived granular npm token with the minimum required scope and expiry;
- enter it directly as the protected GitHub environment secret;
- confirm or perform the repository visibility change;
- approve the environment-gated workflow publication;
- configure both npm trusted publishers and publishing-access settings; and
- remove/revoke the bootstrap secret/token.

The implementation plan must provide the exact GitHub/npm UI path, field name, expected value, verification command, stop condition, and recovery note for each human step. Screenshots may aid navigation but are not authority; live UI labels must be revalidated immediately before use.

## Approval gates

This release uses distinct approvals:

1. design approval;
2. written-spec review;
3. exact-file implementation-plan approval;
4. approval after each small local implementation increment;
5. verified-final-diff approval of the private release candidate;
6. separate push approval;
7. just-in-time public-visibility approval;
8. exact package-publication approval; and
9. approval of any partial-publication recovery.

Earlier approval does not pre-authorize a later external action whose exact source commit, package bytes, credentials, registry state, or public disclosure was not yet inspectable.

## Evidence and completion

The release increment creates dated preparation and verification evidence plus a review packet. The packet records the exact comparison, commits, changed files, package inventories and hashes, commands/results, advisory evidence, publicization audit, reviewer dispositions, workflow run, npm integrities, provenance/signatures, trusted-publisher configuration, residual risks, and recovery domains.

The Task 7 public-package gate is complete only when both exact `0.1.0` packages are publicly installable from npm, their manifests/tarballs/licenses match the approved release, provenance and signatures resolve to the exact public source/workflow, the bootstrap credential is removed and revoked, trusted publishing is configured, no material review finding remains, and the release packet receives its own verified-final-diff approval.

Completion does not prove the packages free of vulnerabilities, guarantee future advisory status, validate Task 7 generated projects, or authorize Task 7 implementation. Task 7 begins only after its other approved prerequisites are implemented and reverified on one clean integrated base.

## Current official constraints

- npm provenance requires a public `repository` matching the source and a supported cloud-hosted CI provider: <https://docs.npmjs.com/generating-provenance-statements/>.
- npm trusted publishing requires supported GitHub-hosted OIDC, and automatic provenance requires both public source and a public package: <https://docs.npmjs.com/trusted-publishers/>.
- npm trust configuration requires the package to exist, which is why the initial release needs a temporary bootstrap credential: <https://docs.npmjs.com/cli/v11/commands/npm-trust/>.
- GitHub documents the disclosure and repository-rule consequences of changing private source to public: <https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/managing-repository-settings/setting-repository-visibility>.
- GitHub environments can withhold environment secrets until required review completes, subject to current plan/repository availability: <https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments>.
