# Contributing

Read root [AGENTS.md](AGENTS.md), the [approved source plan](docs/roadmaps/2026-08-04-nextjs-boilerplate-builder-best-reconciled-plan.md), the applicable architecture documents and accepted ADRs, and current private local evidence before proposing a change.

The canonical implementation lifecycle is [docs/governance/review-and-contribution.md](docs/governance/review-and-contribution.md). It separates preparation evidence, implementation-plan approval, and verified-final-diff approval. Approval of one gate never implies authority for another.

The canonical mapping from architecture invariants to actual or planned automation is [docs/architecture/enforcement-map.md](docs/architecture/enforcement-map.md). Update that owner when enforcement responsibility changes; do not duplicate its matrix here.

The current package topology is a private executable `apps/cli`, private `packages/builder-core`, public replaceable `packages/standards`, and public replaceable `packages/observability`. The exact APIs, consumers, and publication guards belong to [package ownership](docs/architecture/package-ownership.md). The [current environment generation](docs/architecture/capability-model.md#current-environment-generation) owns supported profiles, capability selections, and the fixed fixture inventory.

[ADR-0020](docs/adr/0020-application-environments.md#target-and-configuration-ownership) owns current Calendly destination configuration. The [historical Calendly record](docs/architecture/capability-model.md#executable-calendly-boundary) describes synthetic browser behavior and the separate protected-staging, booking, confirmation, cancellation, and cleanup evidence for `booking-calendly@0.1.0`.

Run the repository constitution tests with this command.

```bash
pnpm run test:constitution
```

Run `pnpm run verify:builder-kernel` for the current builder candidate, including package tests, deterministic regeneration of the current fixtures, and isolated Next/OpenNext and Chromium verification. Claims about visual quality, human accessibility, production readiness, or WCAG conformance require separate evidence. See the [kernel and visual verification commands](README.md#app-lifecycle-and-verification) for the toolchain and evidence boundaries.

Run `pnpm run verify:generated-visuals` for fixed-root visual verification on its own. If you also need the kernel suite, run `pnpm run verify:builder-kernel -- --include-fixed-visuals` to include those comparisons in one fixed-root verification pass. App-transition visual verification remains a separate command. The [capability model](docs/architecture/capability-model.md#executable-visual-regression-boundary) owns the required environment, visual matrix, baseline-update procedure, diagnostics, retention, and evidence limits.

The automatic read-only [repository quality workflow](.github/workflows/repository-quality.yml) classifies scope for draft and ready pull requests and pushes to `main`. Draft pull requests generate app-transition visual candidates when the classifier selects them. Run affected checks locally while drafting. Hosted-only failures may first surface when the pull request is marked ready, and checks skipped on drafts remain unverified.

Marking a pull request ready runs all applicable hosted quality jobs, including ordinary app-transition visual comparisons when selected. Later updates, reopenings and pushes to `main` run the applicable checks again. Dependency review runs only for ready pull requests. The [enforcement map](docs/architecture/enforcement-map.md) records the checks and their evidence limits. Generated and proof verification build standalone Next output once, transform it with OpenNext `--skipNextBuild`, and start preview directly from the prepared `.open-next` output.

Run `pnpm run verify:builder-packages` for the current package, lint, build, type, and Changeset gates. Any later public API change requires an approved Changeset; use `pnpm changeset:status` to inspect version intent. Contributors must not publish public packages from a local checkout. Changeset metadata, public package manifests, successful dry-run packs, and a green manual workflow are safeguards, not release authority. Publication through [`.github/workflows/package-release.yml`](.github/workflows/package-release.yml) remains an external action requiring exact-commit validation and explicit human approval.

Make small, focused, test-driven commits. Preserve user work and the approved increment boundary. Follow the [commit and push authorization rule](docs/governance/review-and-contribution.md#commit-and-push-authorization) and obtain explicit authority for pull-request creation, merge, deployment, publication, production action, and external messaging.
