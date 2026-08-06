# Egeria Scaffold

Egeria Scaffold will build versioned, materialized Next.js recipes for Egeria Systems projects. Generated repositories remain ordinary, understandable client-owned codebases; installed capabilities, not a live profile inheritance chain, become authoritative after generation.

## Current phase: P1 in progress

P0.1 established the repository constitution, architecture decisions, governance, and enforcement ownership. P0.2's private Next.js and Cloudflare compatibility proof passed its local, workerd, clean Ubuntu workflow, non-production deployment, Chromium, and axe gates and received verified-final-diff approval. P0.3 established the lean package and tooling boundaries and received verified-final-diff approval. P1 now has executable private project/state contracts plus the exact six-capability `portfolio`/`site` catalog, recipes, resolver, and installed-manifest projection. Generation, `.egeria` codecs and files, inference, diagnostics, CLI behavior, and generated profile skeletons remain unimplemented and separately gated.

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

Run the complete local compatibility proof with:

```bash
pnpm run verify:compatibility-proof
```

Run the current builder package, lint, build, type, and Changeset gates with:

```bash
pnpm run verify:builder-packages
```

Run the complete local public-package release-candidate gate with:

```bash
pnpm run verify:package-release-candidate
```

Node.js `22.23.2` is pinned through `.nvmrc` and `package.json` Volta configuration. pnpm `11.20.0` is pinned through `packageManager` and exact engine policy. The [compatibility record](docs/compatibility/nextjs-cloudflare.md) owns the exact matrix, runtime distinctions, known limitations, and evidence boundary.

## Current builder topology

- `apps/cli` is a private, empty command ownership shell with no executable `bin`.
- `packages/builder-core` is private and owns the P1 runtime contracts, checked schemas, catalog and recipes, deterministic resolution, state inspection, diagnostics, and in-memory skeleton rendering.
- [`packages/standards`](packages/standards/) is a public, replaceable package containing consumed TypeScript and ESLint configuration APIs.
- [`packages/observability`](packages/observability/) is a public, replaceable package with an intentionally empty runtime API.

The [package-ownership document](docs/architecture/package-ownership.md) owns the exact APIs, consumers, and publication guards. Project/state schemas remain inside private builder-core; no separate schema package is created initially.

The two public package manifests are `0.1.0` release candidates; this repository does not claim they are live on npm. Changesets owns their version and publication plan. Use `pnpm changeset` for an approved later public-package change and `pnpm changeset:status` to inspect pending version intent. The manual [`.github/workflows/package-release.yml`](.github/workflows/package-release.yml) workflow is the only package-publication path. Local configuration and green checks never authorize publication: the exact release commit and final external action require separate explicit human approval.

## License

Repository-owned source and documentation are licensed under [Apache-2.0](LICENSE). Package publication and repository visibility remain separate approval-gated actions.
