# Contributing

Read root [AGENTS.md](AGENTS.md), the [approved source plan](docs/roadmaps/2026-08-04-nextjs-boilerplate-builder-best-reconciled-plan.md), the applicable architecture documents and accepted ADRs, and current evidence before proposing a change.

The canonical implementation lifecycle is [docs/governance/review-and-contribution.md](docs/governance/review-and-contribution.md). It separates preparation evidence, implementation-plan approval, and verified-final-diff approval. Approval of one gate never implies authority for another.

The canonical mapping from architecture invariants to actual or planned automation is [docs/architecture/enforcement-map.md](docs/architecture/enforcement-map.md). Update that owner when enforcement responsibility changes; do not duplicate its matrix here.

The current package topology is a private executable `apps/cli`, private `packages/builder-core`, public replaceable `packages/standards`, and public replaceable `packages/observability`. The exact APIs, consumers, and publication guards belong to [package ownership](docs/architecture/package-ownership.md). The approved builder kernel also owns exact committed portfolio/site fixtures and a fixed-root isolated verifier. The current client-ready portfolio stage includes generated validated YAML/Markdown content, standards-owned copy enforcement, a bounded typed section registry, and a responsive Tailwind interface with semantic design tokens and externalized skip-navigation copy. Browser accessibility automation, visual assessment, and Calendly remain separately reviewed increments.

Run the current repository contract with:

```bash
pnpm run test:constitution
```

Run `pnpm run verify:builder-kernel` for the complete approved builder kernel and current client-ready portfolio increments, including deterministic fixture regeneration and isolated fresh-install/lint/typecheck/Next/OpenNext verification. This command performs public-registry reads and local builds but does not preview, deploy, publish, mutate a provider, assess visual quality, or establish accessibility conformance.

Run `pnpm run verify:builder-packages` for the current package, lint, build, type, and Changeset gates. Any later public API change requires an approved Changeset; use `pnpm changeset:status` to inspect version intent. Contributors must not publish public packages from a local checkout. Changeset metadata, public package manifests, successful dry-run packs, and a green manual workflow are safeguards, not release authority. Publication through [`.github/workflows/package-release.yml`](.github/workflows/package-release.yml) remains an external action requiring exact-commit validation and explicit human approval.

Make small, focused, test-driven commits. Preserve user work and the approved increment boundary. Push, pull-request creation, merge, deployment, publication, production action, and external messaging each require their own explicit authority.
