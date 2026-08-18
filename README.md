# Egeria Scaffold

Egeria Scaffold will build versioned, materialized Next.js recipes for Egeria Systems projects. Generated repositories remain ordinary, understandable client-owned codebases; installed capabilities, not a live profile inheritance chain, become authoritative after generation.

## Current implementation status

The repository constitution, architecture decisions, governance, and enforcement ownership are established. The lean package and tooling boundaries have received verified-final-diff approval. The private Next.js and Cloudflare compatibility proof passed its local, workerd, clean Ubuntu workflow, non-production deployment, Chromium, and axe checks and received verified-final-diff approval. The builder kernel has received verified-final-diff approval with executable private project/state contracts, strict codecs, hybrid ownership, read-only inference/doctor/diff, state-last new-directory generation, the private CLI, and committed golden fixtures with isolated build verification. The client-ready portfolio stage is in progress: the current candidate extends the approved builder baseline to the exact seven-capability `portfolio`/`site` catalog at recipe `0.9.0`, implements optional Calendly initial scaffolding, installs exact `observability@0.3.0` error diagnostics, adds generated unit/component testing plus read-only quality CI, and materializes a separate manual protected Cloudflare deployment workflow under exact pending `deployment-cloudflare@0.3.0`. The tracked certification registry records exact `standards@0.3.0` and `observability@0.3.0` subjects as certified; deployment has no inherited evidence and remains task-linked pending. Standards remains bound to its renewed eight-outcome private receipt at descendant `d7c63b0aaa9bebd56c075f16f1e5d86519853698`. Observability certification binds all three required outcomes to exact evidence revision `bdcc55f1bfa6eca392ce3e36bdc35adb6f085bad`, successful diagnostics run `31925083913`, and successful cleanup/recovery run `31925927776`. The private protected-staging receipt at `ee1e1df10fa2be2f09333efecd86de7f7a131d49` remains historical evidence only for the prior certified `observability@0.2.0` subject and its narrower claim. Current certification proves only the bounded accepted synthetic journeys and recorded recovery; generated deployment structure does not establish hosted execution, environment protection, credential validity, provider mutation, cleanup/recovery, visual or performance quality, production readiness, or WCAG conformance.

The builder now generates versioned validated YAML/Markdown content, enforces static visible-copy externalization, materializes a bounded section registry, emits a responsive Tailwind interface with semantic design tokens and externalized skip-navigation copy, and generates named Vitest unit/component projects plus Playwright/axe browser-quality foundations. Unit tests use Node; component tests use jsdom, Testing Library, the actual generated `ContentPage`, and Vite's native TypeScript-path resolution. Browser checks cover development, OpenNext/workerd preview, and an explicitly supplied HTTPS deployed URL. One automatic read-only repository workflow exposes stable `scope`, `builder-and-packages`, `generated-projects`, `compatibility-proof`, and `dependency-review` jobs without secrets, deployment, publication, provider mutation, or write permissions. Conservative job-level scoping skips only irrelevant deep work, pull-request dependency review rejects moderate-or-higher runtime and development dependency changes, and reusable pnpm caches are disabled. The predecessor three-workflow topology passed GitHub Actions for exact candidate `93e4e9f6ea944329de7c47c9e8bf34382774b1f8`; that remains historical evidence, not a hosted result for the consolidated workflow. The builder also generates provider-neutral safe operational events and distinct restricted error reports, stream-bounded same-origin browser ingestion, Next.js server/browser capture, App Router local and global error boundaries, externalized recovery copy, Cloudflare Workers Logs custom logging with invocation logs disabled, version metadata, and an optional Better Stack adapter that activates only when its two secrets are configured. Workers custom records receive only bounded safe context; only the Better Stack diagnostic adapter receives bounded restricted messages and stacks. That provider-specific encoding remains behind a provider-neutral diagnostic-sink contract and composition boundary. Message and stack sanitization reduces exposure but is not a privacy guarantee, and this increment does not source-map deobfuscate stack strings. Cloudflare Web Analytics remains absent. The retained `portfolio-calendly` fixture joins the base portfolio and site fixtures as representative deterministic evidence. Private local implementation and generated-fixture evidence covers deterministic production regeneration plus isolated public-registry install, audit/signature verification, Wrangler types, lint/typecheck, named unit/component tests, one standalone Next build followed by the OpenNext `--skipNextBuild` transform, and development/direct-workerd-preview Chromium checks for all three retained fixtures. That local evidence alone does not establish deployed/provider behavior or cleanup/recovery. The separately accepted current-subject receipt records the bounded `observability@0.3.0` deployed/provider journey and cleanup/recovery; it does not prove durable delivery, production readiness, privacy completeness, visual quality, human accessibility, or WCAG conformance. The private protected-staging receipt remains historical evidence only for `observability@0.2.0`; its `waitUntil()` delivery remained best-effort and non-durable, Cloudflare platform/framework logs remained separate provider-controlled records, and retention and quotas remained plan-dependent.

Generated `.github/workflows/deploy.yml` requires an exact lowercase `main` revision and the fixed GitHub `production` environment. It runs the full local generated verification sequence before its only credential-bearing step, exposes only the account identifier and API token there, deploys already prepared OpenNext output, and follows with the strict HTTPS deployed Playwright/axe check. Generation does not configure GitHub/Cloudflare, access credentials, dispatch, deploy, or certify. Source, Worker/provider, route/domain, credential, and data recovery remain separate.

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

Implementation evidence, review packets, and implementation plans are private local workflow artifacts. Git excludes them from ordinary tracking by default, and the repository contract scans tracked text for personal home-directory paths to reduce accidental machine-specific leakage.

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
- `fixtures/generated/portfolio`, `fixtures/generated/portfolio-calendly`, and `fixtures/generated/site` are committed golden outputs. `verify:generated-skeletons` validates identity-bounded copies and is the fixed-root owner for install, audit, signature, lint, typecheck, named unit/component tests, build, and explicit browser certification; it never executes in the committed source trees.
- [`packages/standards`](packages/standards/) is a public, replaceable package containing consumed TypeScript and ESLint configuration APIs.
- [`packages/observability`](packages/observability/) is a public, replaceable, zero-runtime-dependency package for bounded operational events, redaction, failure-contained dispatch, provider protocol encoding, browser delivery, and test assertions.

The [package-ownership document](docs/architecture/package-ownership.md) owns the exact APIs, consumers, and publication guards. Project/state schemas remain inside private builder-core; no separate schema package is created initially.

## Calendly scaffold boundary

Calendly is an explicit optional selection for initial `portfolio` or `site` creation; it is not a recipe default and is not addable later yet. The paired CLI options accept `link`, `inline`, or `popup` plus a bounded HTTPS destination on `calendly.com` or `www.calendly.com` with no query string. Selection and strict settings are recorded together in `.egeria/project.yaml`; the installed capability and managed-surface fingerprints are recorded in `.egeria/state.json` and checked by read-only inference.

Generated link mode uses an ordinary anchor. Inline mode activates a direct cross-origin iframe near the viewport, and popup mode enhances the ordinary anchor with a native dialog and a user-activated iframe. The generated application loads no Calendly host-page script or API. Calendly account configuration, event types, provider data, cookies, retention, and provider cleanup are unmanaged. Source removal is therefore separate from provider cleanup.

The retained fixture's recurring browser specification stubs and fail-closes the Calendly origin while exercising local activation, fallback, dialog cleanup, narrow reflow, and selected axe rules. Those automated checks do not call Calendly or prove ongoing provider availability. A separate private local provider receipt records the one-time exact-revision staging, booking, confirmation, cancellation, and cleanup evidence that certifies `booking-calendly@0.1.0`. Neither evidence set establishes production readiness or visual quality, replaces human accessibility evaluation, or supports a WCAG conformance claim.

Exact `0.1.0` and `0.2.0` releases of `@egeria-systems/standards` and exact `0.1.0` through `0.3.0` releases of `@egeria-systems/observability` are publicly available on npm. The immutable bootstrap `0.1.0` releases have registry signatures but no provenance attestations under their approved one-time exception. The `0.2.0` releases and observability `0.3.0` were published through npm OIDC trusted publishing with explicit provenance and have registry signatures and provenance attestations. Generated repositories deliberately retain exact `@egeria-systems/standards@0.1.0` while installing exact `@egeria-systems/observability@0.3.0`; public availability does not certify the current capability subject. Changesets remains the versioning and publication owner. The manual [`.github/workflows/package-release.yml`](.github/workflows/package-release.yml) workflow is the only package-publication path: it is dispatched manually with the exact `main` commit after separate explicit human approval and performs no application deployment. Local configuration and green checks never authorize publication or deployment.

## License

Repository-owned source and documentation are licensed under [Apache-2.0](LICENSE). Package publication and repository visibility remain separate approval-gated actions.
