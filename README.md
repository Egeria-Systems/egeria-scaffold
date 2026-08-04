# Egeria Scaffold

Egeria Scaffold will build versioned, materialized Next.js recipes for Egeria Systems projects. Generated repositories remain ordinary, understandable client-owned codebases; installed capabilities, not a live profile inheritance chain, become authoritative after generation.

## Current phase: P0.1 — Constitution and ADRs

P0.1 establishes the repository constitution, architecture decisions, governance, and enforcement ownership. No production profile is implemented in P0.1.

Canonical project documents:

- [Approved source plan](docs/roadmaps/2026-08-04-nextjs-boilerplate-builder-best-reconciled-plan.md)
- [Architecture overview](docs/architecture/overview.md)
- [Capability model](docs/architecture/capability-model.md)
- [Enforcement map](docs/architecture/enforcement-map.md)
- [Program roadmap](docs/roadmaps/program-roadmap.md)
- [Architecture decision records](docs/adr/README.md)
- [Review and contribution protocol](docs/governance/review-and-contribution.md)
- [Implementation evidence](docs/implementation-evidence/)
- Review packets are added under `docs/review-packets/` after final verification.

Run the dependency-free constitution contract with:

```bash
pnpm run test:constitution
```

## Deferred to P0.2

P0.2 selects and proves the exact compatible pnpm, Next.js, OpenNext Cloudflare adapter, Wrangler, TypeScript, ESLint, Vitest, Playwright, and axe versions. It must demonstrate local Next development, production-like workerd preview, generated binding types, unit and Cloudflare integration tests, accessibility smoke tests, and a non-production GitHub Actions deployment.

The Volta Node.js `22.23.0` pin is the approved P0.1 development runtime. It is not deployed compatibility proof.

## Deferred to P0.3

P0.3 creates `apps/cli`, private `packages/builder-core`, public `packages/standards`, the public observability package shell, and approved release tooling. Project and state schemas remain inside `builder-core`; no separate schema package is created initially.
