# Egeria Scaffold

Egeria Scaffold will build versioned, materialized Next.js recipes for Egeria Systems projects. Generated repositories remain ordinary, understandable client-owned codebases; installed capabilities, not a live profile inheritance chain, become authoritative after generation.

## Current phase: P0.2 — Deployed compatibility proof

P0.1 established the repository constitution, architecture decisions, governance, and enforcement ownership. P0.2 owns the smallest private Next.js and Cloudflare compatibility proof. Local, workerd, clean Ubuntu workflow, non-production deployment, Chromium, and axe evidence is complete; verified-final-diff approval remains required before P0.3. No production profile is implemented.

Canonical project documents:

- [Approved source plan](docs/roadmaps/2026-08-04-nextjs-boilerplate-builder-best-reconciled-plan.md)
- [Architecture overview](docs/architecture/overview.md)
- [Capability model](docs/architecture/capability-model.md)
- [Enforcement map](docs/architecture/enforcement-map.md)
- [Program roadmap](docs/roadmaps/program-roadmap.md)
- [Next.js and Cloudflare compatibility record](docs/compatibility/nextjs-cloudflare.md)
- [Executable compatibility proof](proofs/nextjs-cloudflare/)
- [Architecture decision records](docs/adr/README.md)
- [Review and contribution protocol](docs/governance/review-and-contribution.md)
- [Implementation evidence](docs/implementation-evidence/)
- Review packets are added under `docs/review-packets/` after final verification.

Run the constitution contract with:

```bash
pnpm run test:constitution
```

Run the complete local P0.2 proof with:

```bash
pnpm run verify:p0.2
```

Node.js `22.23.0` is pinned through `.nvmrc` and `package.json` Volta configuration. pnpm `11.20.0` is pinned through `packageManager` and exact engine policy. The [compatibility record](docs/compatibility/nextjs-cloudflare.md) owns the exact matrix, runtime distinctions, known limitations, and evidence boundary.

## Deferred to P0.3

P0.3 creates `apps/cli`, the private `packages/builder-core` ownership boundary, public `packages/standards`, the public observability package shell, and approved release tooling. P1 implements project and state schemas inside `builder-core`; no separate schema package is created initially.
