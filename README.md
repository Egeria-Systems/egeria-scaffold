# Egeria Scaffold

Egeria Scaffold will build versioned, materialized Next.js recipes for Egeria Systems projects. Generated repositories remain ordinary, understandable client-owned codebases; installed capabilities, not a live profile inheritance chain, become authoritative after generation.

## Current phase: P0.3 complete

P0.1 established the repository constitution, architecture decisions, governance, and enforcement ownership. P0.2's private Next.js and Cloudflare compatibility proof passed its local, workerd, clean Ubuntu workflow, non-production deployment, Chromium, and axe gates and received verified-final-diff approval. P0.3 established the lean package and tooling boundaries and received verified-final-diff approval. P1 preparation and exact-file planning may begin, but P1 implementation remains separately plan-gated. No production profile is implemented.

Canonical project documents:

- [Approved source plan](docs/roadmaps/2026-08-04-nextjs-boilerplate-builder-best-reconciled-plan.md)
- [Architecture overview](docs/architecture/overview.md)
- [Capability model](docs/architecture/capability-model.md)
- [Enforcement map](docs/architecture/enforcement-map.md)
- [Package ownership](docs/architecture/package-ownership.md)
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

Run the current P0.3 package, lint, build, type, and Changeset gates with:

```bash
pnpm run verify:p0.3
```

Node.js `22.23.0` is pinned through `.nvmrc` and `package.json` Volta configuration. pnpm `11.20.0` is pinned through `packageManager` and exact engine policy. The [compatibility record](docs/compatibility/nextjs-cloudflare.md) owns the exact matrix, runtime distinctions, known limitations, and evidence boundary.

## Current P0.3 topology

- `apps/cli` is a private, empty command ownership shell with no executable `bin`.
- `packages/builder-core` is private and reserves cohesive builder internals plus project/state schema ownership without implementing them yet.
- `packages/standards` is a public, replaceable package containing consumed TypeScript and ESLint configuration APIs.
- `packages/observability` is a public, replaceable package with an intentionally empty runtime API.

The [package-ownership document](docs/architecture/package-ownership.md) owns the exact APIs, consumers, and publication guards. P1 is the first executable project/state schema stage; no separate schema package is created initially.

Changesets records version intent for the two public packages. Use `pnpm changeset` for an approved public-package change and `pnpm changeset:status` to inspect the current release plan. Local release configuration does not authorize an external release: publication is a separate action that requires explicit human approval.
