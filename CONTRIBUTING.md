# Contributing

Read root [AGENTS.md](AGENTS.md), the [approved source plan](docs/roadmaps/2026-08-04-nextjs-boilerplate-builder-best-reconciled-plan.md), the applicable architecture documents and accepted ADRs, and current evidence before proposing a change.

The canonical implementation lifecycle is [docs/governance/review-and-contribution.md](docs/governance/review-and-contribution.md). It separates preparation evidence, implementation-plan approval, and verified-final-diff approval. Approval of one gate never implies authority for another.

The canonical mapping from architecture invariants to actual or planned automation is [docs/architecture/enforcement-map.md](docs/architecture/enforcement-map.md). Update that owner when enforcement responsibility changes; do not duplicate its matrix here.

The current package topology is a private executable `apps/cli`, private `packages/builder-core`, public replaceable `packages/standards`, and public replaceable `packages/observability`. The exact APIs, consumers, and publication guards belong to [package ownership](docs/architecture/package-ownership.md). The executable builder currently has seven capability descriptors for `portfolio` and `site`; `booking-calendly` is the only optional initial-scaffolding capability and leaves both recipe defaults unchanged. The builder retains exact `portfolio`, `portfolio-calendly`, and `site` fixtures and verifies them through one fixed-root isolated harness.

The current client-ready portfolio work includes generated validated YAML/Markdown content, standards-owned copy enforcement, a bounded typed section registry, a responsive Tailwind interface with semantic design tokens and externalized skip-navigation copy, and a standards-owned generated Playwright/axe quality foundation. The Calendly selection uses paired URL/mode arguments, strict desired-state settings, declared ownership and inference probes, direct cross-origin iframes, native-dialog popup enhancement, and an ordinary-link fallback. Browser installation is explicit; all three fixtures are certified locally in development and workerd preview. The Calendly browser proof stubs the provider origin. It does not establish provider behavior, a real booking, hosted workflow or deployment execution, visual quality, human accessibility, or WCAG conformance. Calendly account configuration and provider data are unmanaged; protected-staging/provider-confirmed certification and any provider cleanup remain unexecuted, separately authorized outcomes.

Run the current repository contract with:

```bash
pnpm run test:constitution
```

Run `pnpm run verify:builder-kernel` for the complete approved builder kernel and current client-ready portfolio increments, including deterministic regeneration of all three retained fixtures, isolated fresh-install/lint/typecheck/Next/OpenNext verification, explicit Chromium installation, and development/workerd Playwright suites. This command performs public-registry reads, local builds, and local server/browser execution; it does not deploy, call a supplied deployed URL or live Calendly, publish, mutate a provider, prove hosted CI, assess visual quality, or establish accessibility conformance.

Run `pnpm run verify:builder-packages` for the current package, lint, build, type, and Changeset gates. Any later public API change requires an approved Changeset; use `pnpm changeset:status` to inspect version intent. Contributors must not publish public packages from a local checkout. Changeset metadata, public package manifests, successful dry-run packs, and a green manual workflow are safeguards, not release authority. Publication through [`.github/workflows/package-release.yml`](.github/workflows/package-release.yml) remains an external action requiring exact-commit validation and explicit human approval.

Make small, focused, test-driven commits. Preserve user work and the approved increment boundary. Push, pull-request creation, merge, deployment, publication, production action, and external messaging each require their own explicit authority.
