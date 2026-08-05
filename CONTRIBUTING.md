# Contributing

Read root [AGENTS.md](AGENTS.md), the [approved source plan](docs/roadmaps/2026-08-04-nextjs-boilerplate-builder-best-reconciled-plan.md), the applicable architecture documents and accepted ADRs, and current evidence before proposing a change.

The canonical implementation lifecycle is [docs/governance/review-and-contribution.md](docs/governance/review-and-contribution.md). It separates preparation evidence, implementation-plan approval, and verified-final-diff approval. Approval of one gate never implies authority for another.

The canonical mapping from architecture invariants to actual or planned automation is [docs/architecture/enforcement-map.md](docs/architecture/enforcement-map.md). Update that owner when enforcement responsibility changes; do not duplicate its matrix here.

The current package topology is a private `apps/cli`, private `packages/builder-core`, public replaceable `packages/standards`, and public replaceable `packages/observability`. The exact APIs, consumers, and publication guards belong to [package ownership](docs/architecture/package-ownership.md). P1 remains the first executable project/state schema stage inside builder-core.

Run the current repository contract with:

```bash
pnpm run test:constitution
```

Run `pnpm run verify:p0.3` for the current package, lint, build, type, and Changeset gates. A public-package change must include an approved Changeset; use `pnpm changeset:status` to inspect version intent. Changeset metadata, public package manifests, and a successful dry-run pack are safeguards, not release authority. Publication remains an external action requiring explicit human approval.

Make small, focused, test-driven commits. Preserve user work and the approved increment boundary. Push, pull-request creation, merge, deployment, publication, production action, and external messaging each require their own explicit authority.
