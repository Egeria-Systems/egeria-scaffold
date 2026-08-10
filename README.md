# Egeria Scaffold

Egeria Scaffold will build versioned, materialized Next.js recipes for Egeria Systems projects. Generated repositories remain ordinary, understandable client-owned codebases; installed capabilities, not a live profile inheritance chain, become authoritative after generation.

## Current implementation status

The repository constitution, architecture decisions, governance, and enforcement ownership are established. The lean package and tooling boundaries have received verified-final-diff approval. The private Next.js and Cloudflare compatibility proof passed its local, workerd, clean Ubuntu workflow, non-production deployment, Chromium, and axe checks and received verified-final-diff approval. The builder kernel has received verified-final-diff approval with executable private project/state contracts, the exact six-capability `portfolio`/`site` catalog, strict codecs, hybrid ownership, read-only inference/doctor/diff, state-last new-directory generation, the private CLI, and committed golden fixtures with isolated build verification. The client-ready portfolio stage is in progress: the builder now generates versioned validated YAML/Markdown content, enforces static visible-copy externalization, materializes a bounded section registry, emits a responsive Tailwind interface with semantic design tokens and externalized skip-navigation copy, and generates a Playwright/axe browser-quality foundation for development, OpenNext/workerd preview, and an explicitly supplied HTTPS deployed URL. Both generated profiles pass isolated local Chromium certification in development and workerd preview, and the generated workflow and deployed-mode contracts pass static validation. Hosted workflow execution, live deployment, visual assessment, human evaluation, and the remaining portfolio outcomes remain separately gated; automation does not establish WCAG conformance.

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

Run the complete approved builder-kernel gate, including deterministic fixture regeneration and isolated fixture builds, with:

```bash
pnpm run verify:builder-kernel
```

Run the narrower package, lint, build, type, and Changeset gates with:

```bash
pnpm run verify:builder-packages
```

Run the complete local public-package release-candidate gate with:

```bash
pnpm run verify:package-release-candidate
```

Node.js `22.23.2` is pinned through `.nvmrc` and `package.json` Volta configuration. pnpm `11.20.0` is pinned through `packageManager` and exact engine policy. The [compatibility record](docs/compatibility/nextjs-cloudflare.md) owns the exact matrix, runtime distinctions, known limitations, and evidence boundary.

## Current builder topology

- `apps/cli` is a private executable adapter for exact `create`, `infer`, `doctor`, and `diff` commands.
- `packages/builder-core` is private and owns the current runtime contracts, checked schemas, catalog and recipes, deterministic resolution, state inspection, diagnostics, template rendering, and state-last new-directory generation.
- `fixtures/generated/portfolio` and `fixtures/generated/site` are committed golden outputs. `verify:generated-skeletons` validates identity-bounded copies and is the fixed-root owner for install, audit, signature, lint, typecheck, build, and explicit browser certification; it never executes in the committed source trees.
- [`packages/standards`](packages/standards/) is a public, replaceable package containing consumed TypeScript and ESLint configuration APIs.
- [`packages/observability`](packages/observability/) is a public, replaceable package with an intentionally empty runtime API.

The [package-ownership document](docs/architecture/package-ownership.md) owns the exact APIs, consumers, and publication guards. Project/state schemas remain inside private builder-core; no separate schema package is created initially.

Exactly `@egeria-systems/standards@0.1.0` and `@egeria-systems/observability@0.1.0` are publicly available on npm. Both immutable versions have npm registry signatures but no provenance attestations under the explicitly approved bootstrap provenance exception; that exception does not create retroactive provenance. Future releases use npm OIDC trusted publishing plus the manual workflow's explicit provenance request, `NPM_CONFIG_PROVENANCE: "true"`. Changesets remains the versioning and publication owner. Use `pnpm changeset` for an approved later public-package change and `pnpm changeset:status` to inspect pending version intent. The manual [`.github/workflows/package-release.yml`](.github/workflows/package-release.yml) workflow remains the only package-publication path. Local configuration and green checks never authorize publication: the exact release commit and final external action require separate explicit human approval.

## License

Repository-owned source and documentation are licensed under [Apache-2.0](LICENSE). Package publication and repository visibility remain separate approval-gated actions.
