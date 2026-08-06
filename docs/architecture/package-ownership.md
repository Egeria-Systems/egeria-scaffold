# Package Ownership

**Status:** Controlling package and API ownership through deterministic skeleton rendering and private release-candidate verification

**Sources:** [ADR-0005](../adr/0005-evidence-driven-package-extraction.md), [architecture overview](overview.md), the [approved P0.3 plan](../superpowers/plans/2026-08-04-p0-3-lean-builder-monorepo.md), the [approved P1 plan](../superpowers/plans/2026-08-05-p1-builder-kernel.md), and the [approved public-package release plan](../superpowers/plans/2026-08-06-public-package-release.md)

This document owns the builder repository's package visibility, current API surface, responsibility, consumers, and publication boundary. The [review and contribution protocol](../governance/review-and-contribution.md) owns implementation and approval gates.

## Ownership matrix

| Location | Package | Visibility | Current API | Responsibility and consumers | Publication guard | Stage boundary |
| --- | --- | --- | --- | --- | --- | --- |
| `apps/cli` | `@egeria-systems/cli` | Private application | Empty ESM ownership shell compiled and linted through strict standards APIs; no `bin` | Future command input/output; standards configuration consumer | `private: true`; no exports or runtime dependencies | Commands and repository-changing behavior require later approved stages |
| `packages/builder-core` | `@egeria-systems/builder-core` | Private package | Runtime Zod contracts and checked schemas; exact six-capability catalog; `portfolio`/`site` recipes; deterministic resolver; installed-manifest projection; strict `.egeria` codecs; hybrid-ownership fingerprints and surface materialization; fixed-root read-only repository inference; `doctorRepository` and `diffProject`; `renderSkeleton` deterministic in-memory rendering from explicit allowlisted templates and YAML 1.2 structured content | Canonical private owner of project/state schemas, template implementation data, and cohesive builder internals; standards configuration consumer and future CLI consumer | `private: true`; root-only runtime exports plus package metadata; exact source and template allowlists; no publication | The renderer performs no repository write or `.egeria` state update and does not install or build returned files; repository-changing generation remains separate; no separate project-schema package |
| `packages/standards` | `@egeria-systems/standards` | Public ordinary dependency | `./typescript/strict.json`, `./eslint/typescript-strict`, `./eslint/cloudflare-isolation`, and `./package.json`; no root export | Replaceable static standards consumed by the builder root, CLI, builder-core, observability, and the Cloudflare proof | Exact exports and file allowlist; dual-major behavior tests; `prepublishOnly`; public npm/provenance defaults | Only justified, consumed standards APIs may be added |
| `packages/observability` | `@egeria-systems/observability` | Public ordinary dependency | Empty ESM root export with declarations; no exported values | Future provider-neutral observability API; currently an ownership, build, lint, and packaging shell consuming strict standards configuration | Exact exports and file allowlist; contract tests; `prepublishOnly`; public npm/provenance defaults | Events, redaction, transports, providers, analytics, and Cloudflare bindings remain outside P0.3 |

## Dependency direction

- The CLI and builder-core depend on standards only for development-time compilation. Builder-core uses Zod for runtime validation and YAML for its strict in-memory project codec. The CLI may depend on builder-core only after an approved executable CLI stage creates a concrete need.
- Observability depends on standards only for development-time compilation and has no runtime dependencies.
- The builder root uses ESLint `10.8.0` for `apps/cli` and builder-owned source under `packages/*`. The strict type-aware factory applies to TypeScript source; standards configuration source uses the same root's core recommended rules.
- Standards declares and behaviorally tests both ESLint `9.39.5` and `10.8.0`. Dual-major package support does not imply that the accepted P0.2 proof migrated.
- The compatibility proof remains an independent ESLint `9.39.5` and Next configuration consumer. Future generated Next.js projects retain ESLint `9.39.5` while their selected Next plugin graph requires it and must revalidate that graph before changing majors.
- The strict lint factory pins `typescript-eslint` because its strict presets are not semver-stable, enables project-service typed linting, and leaves formatting ownership outside ESLint.
- The repository-local semantic-naming matcher and scanner are the permanent enforcement owner. A temporary root ESLint adapter reuses that matcher for fast feedback through the final P1 implementation task; it is not a standards export or public package API. See the [enforcement map](enforcement-map.md).
- Builder-core remains provider-neutral and owns its consuming-boundary ports. It does not depend on the CLI.
- Public packages remain ordinary replaceable dependencies. Public availability does not transfer ownership of generated application code back to this repository.
- Cloudflare types and bindings remain in platform adapters and composition roots; no package may hide them behind a generic platform or database service.

## Versioning and release boundary

The standards and observability manifests are `0.1.0` release candidates. They are not described as published to the npm registry: registry absence is time-sensitive and must be checked immediately before authentication. Their exact public APIs, package-content allowlists, contract tests, and public publication defaults remain unchanged. The repository-level Changesets default remains restricted, and private-package versioning and tagging are disabled.

Changesets owns package versioning and publication. The manual workflow delegates to Changesets and does not create another release resolver. Package-boundary tests enumerate the only locally publishable packages and execute dry-run packs to enforce exact public tarball contents. Release-context and registry tests fail closed unless the manual [package release workflow](../../.github/workflows/package-release.yml) receives an exact commit on `main` and both target versions are absent.

The manual `package-release.yml` job uses the protected `npm-release` environment. A bootstrap token, when required for the first release, is confined to temporary user configuration and removed unconditionally; later releases use npm OIDC trusted publishing after that trust is configured. Local configuration and a green workflow never authorize publication. npm namespace control, licensing, rights, credentials, exact package contents, provenance, and the external publish command require separate current evidence and explicit human approval under the [review and contribution protocol](../governance/review-and-contribution.md).

## Deferred ownership

The current private builder boundary implements contracts, six capability descriptors, two profile recipes, deterministic resolution, installed-manifest projection, strict state codecs, pure ownership fingerprints/materialization, bounded repository readers, read-only repository inference, content-safe doctor/diff policy, and deterministic in-memory skeleton rendering only. It creates no `.egeria` files and performs no repository write, destination transformation, installation, generated build, migration execution, provider action, transport, application persistence, identity, payment, analytics runtime, or CLI behavior.
