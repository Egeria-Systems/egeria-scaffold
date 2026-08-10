# Egeria Scaffold

Egeria Scaffold will build versioned, materialized Next.js recipes for Egeria Systems projects. Generated repositories remain ordinary, understandable client-owned codebases; installed capabilities, not a live profile inheritance chain, become authoritative after generation.

## Current implementation status

The repository constitution, architecture decisions, governance, and enforcement ownership are established. The lean package and tooling boundaries have received verified-final-diff approval. The private Next.js and Cloudflare compatibility proof passed its local, workerd, clean Ubuntu workflow, non-production deployment, Chromium, and axe checks and received verified-final-diff approval. The builder kernel has received verified-final-diff approval with executable private project/state contracts, strict codecs, hybrid ownership, read-only inference/doctor/diff, state-last new-directory generation, the private CLI, and committed golden fixtures with isolated build verification. The client-ready portfolio stage is in progress: the current tree extends the approved builder baseline to the exact seven-capability `portfolio`/`site` catalog and implements optional Calendly initial scaffolding. That implementation is awaiting final review.

The builder now generates versioned validated YAML/Markdown content, enforces static visible-copy externalization, materializes a bounded section registry, emits a responsive Tailwind interface with semantic design tokens and externalized skip-navigation copy, and generates Playwright/axe browser-quality foundations for development, OpenNext/workerd preview, and an explicitly supplied HTTPS deployed URL. The retained `portfolio-calendly` fixture joins the base portfolio and site fixtures as representative deterministic evidence. All three pass isolated local Chromium certification in development and workerd preview; the generated workflow and deployed-mode contracts pass static validation. Hosted workflow execution, live deployment, visual assessment, human evaluation, and protected-staging/provider-confirmed Calendly certification remain separately gated. Automation does not establish WCAG conformance.

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

- `apps/cli` is a private executable adapter for exact `create`, `infer`, `doctor`, and `diff` commands. `create` accepts the optional paired `--calendly-url` and `--calendly-mode` selection.
- `packages/builder-core` is private and owns the current runtime contracts, checked schemas, exact seven-capability catalog, recipes, deterministic resolution, state inspection, diagnostics, allowlisted template rendering, and state-last new-directory generation.
- `fixtures/generated/portfolio`, `fixtures/generated/portfolio-calendly`, and `fixtures/generated/site` are committed golden outputs. `verify:generated-skeletons` validates identity-bounded copies and is the fixed-root owner for install, audit, signature, lint, typecheck, build, and explicit browser certification; it never executes in the committed source trees.
- [`packages/standards`](packages/standards/) is a public, replaceable package containing consumed TypeScript and ESLint configuration APIs.
- [`packages/observability`](packages/observability/) is a public, replaceable package with an intentionally empty runtime API.

The [package-ownership document](docs/architecture/package-ownership.md) owns the exact APIs, consumers, and publication guards. Project/state schemas remain inside private builder-core; no separate schema package is created initially.

## Calendly scaffold boundary

Calendly is an explicit optional selection for initial `portfolio` or `site` creation; it is not a recipe default and is not addable later yet. The paired CLI options accept `link`, `inline`, or `popup` plus a bounded HTTPS destination on `calendly.com` or `www.calendly.com` with no query string. Selection and strict settings are recorded together in `.egeria/project.yaml`; the installed capability and managed-surface fingerprints are recorded in `.egeria/state.json` and checked by read-only inference.

Generated link mode uses an ordinary anchor. Inline mode activates a direct cross-origin iframe near the viewport, and popup mode enhances the ordinary anchor with a native dialog and a user-activated iframe. The generated application loads no Calendly host-page script or API. Calendly account configuration, event types, provider data, cookies, retention, and provider cleanup are unmanaged. Source removal is therefore separate from provider cleanup.

The retained fixture's browser specification stubs and fail-closes the Calendly origin while exercising local activation, fallback, dialog cleanup, narrow reflow, and selected axe rules. This evidence does not call Calendly, complete a booking, prove provider availability, run on protected staging, establish hosted deployment or visual quality, replace human accessibility evaluation, or support a WCAG conformance claim. Protected-staging deployment and provider-confirmed certification remain unexecuted and require separate explicit authorization.

Exactly `@egeria-systems/standards@0.1.0` and `@egeria-systems/observability@0.1.0` are publicly available on npm. Both immutable versions have npm registry signatures but no provenance attestations under the explicitly approved bootstrap provenance exception; that exception does not create retroactive provenance. Future releases use npm OIDC trusted publishing plus the manual workflow's explicit provenance request, `NPM_CONFIG_PROVENANCE: "true"`. Changesets remains the versioning and publication owner. Use `pnpm changeset` for an approved later public-package change and `pnpm changeset:status` to inspect pending version intent. The manual [`.github/workflows/package-release.yml`](.github/workflows/package-release.yml) workflow remains the only package-publication path. Local configuration and green checks never authorize publication: the exact release commit and final external action require separate explicit human approval.

## License

Repository-owned source and documentation are licensed under [Apache-2.0](LICENSE). Package publication and repository visibility remain separate approval-gated actions.
