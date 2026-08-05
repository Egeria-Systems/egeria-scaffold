# Package Ownership

**Status:** Controlling package and API ownership for the P0.3 review candidate

**Sources:** [ADR-0005](../adr/0005-evidence-driven-package-extraction.md), [architecture overview](overview.md), and the [approved P0.3 plan](../superpowers/plans/2026-08-04-p0-3-lean-builder-monorepo.md)

This document owns the builder repository's package visibility, current API surface, responsibility, consumers, and publication boundary. The [review and contribution protocol](../governance/review-and-contribution.md) owns implementation and approval gates.

## Ownership matrix

| Location | Package | Visibility | Current P0.3 API | Responsibility and consumers | Publication guard | Stage boundary |
| --- | --- | --- | --- | --- | --- | --- |
| `apps/cli` | `@egeria-systems/cli` | Private application | Empty ESM ownership shell compiled and linted through strict standards APIs; no `bin` | Future command input/output; standards configuration consumer | `private: true`; no exports or runtime dependencies | Commands and repository-changing behavior require later approved stages |
| `packages/builder-core` | `@egeria-systems/builder-core` | Private package | Empty ESM ownership shell compiled and linted through strict standards APIs | Future project/state schemas and cohesive builder internals; standards configuration consumer and future CLI consumer | `private: true`; no exports or runtime dependencies | P1 is the first executable schema and builder-kernel stage; no separate project-schema package |
| `packages/standards` | `@egeria-systems/standards` | Public ordinary dependency | `./typescript/strict.json`, `./eslint/typescript-strict`, `./eslint/cloudflare-isolation`, and `./package.json`; no root export | Replaceable static standards consumed by the builder root, CLI, builder-core, observability, and the Cloudflare proof | Exact exports and file allowlist; dual-major behavior tests; `prepublishOnly`; public npm/provenance defaults | Only justified, consumed standards APIs may be added |
| `packages/observability` | `@egeria-systems/observability` | Public ordinary dependency | Empty ESM root export with declarations; no exported values | Future provider-neutral observability API; currently an ownership, build, lint, and packaging shell consuming strict standards configuration | Exact exports and file allowlist; contract tests; `prepublishOnly`; public npm/provenance defaults | Events, redaction, transports, providers, analytics, and Cloudflare bindings remain outside P0.3 |

## Dependency direction

- The CLI and builder-core depend on standards only for development-time compilation. The CLI may depend on builder-core only after an approved executable builder stage creates a concrete need.
- Observability depends on standards only for development-time compilation and has no runtime dependencies.
- The builder root uses ESLint `10.8.0` for `apps/cli` and builder-owned source under `packages/*`. The strict type-aware factory applies to TypeScript source; standards configuration source uses the same root's core recommended rules.
- Standards declares and behaviorally tests both ESLint `9.39.5` and `10.8.0`. Dual-major package support does not imply that the accepted P0.2 proof migrated.
- The compatibility proof remains an independent ESLint `9.39.5` and Next configuration consumer. Future generated Next.js projects retain ESLint `9.39.5` while their selected Next plugin graph requires it and must revalidate that graph before changing majors.
- The strict lint factory pins `typescript-eslint` because its strict presets are not semver-stable, enables project-service typed linting, and leaves formatting ownership outside ESLint.
- Builder-core remains provider-neutral and owns its consuming-boundary ports. It does not depend on the CLI.
- Public packages remain ordinary replaceable dependencies. Public availability does not transfer ownership of generated application code back to this repository.
- Cloudflare types and bindings remain in platform adapters and composition roots; no package may hide them behind a generic platform or database service.

## Versioning and release boundary

P0.3 packages begin at `0.0.0`. Standards and observability have exact public APIs, package-content allowlists, contract tests, and public publication defaults. Changesets 2.31.1 records their versioning intent; the initial Changeset requests minor releases only for those two packages. The repository-level Changesets default remains restricted, and private-package versioning and tagging are disabled.

Package-boundary tests enumerate the only locally publishable packages and execute dry-run packs to enforce the exact public tarball contents. The root version and release scripts delegate to Changesets, which respects each package's private flag and explicit publication configuration.

Local release configuration never authorizes publication. npm namespace control, licensing, credentials, exact package contents, provenance, and the external publish command require separate current evidence and explicit human approval.

## Deferred ownership

P0.3 reserves ownership without implementing future behavior. In particular, it creates no `.egeria` schema or state, profile, capability descriptor, generator, migration, provider, transport, application persistence, identity, payment, analytics, or generated client repository.
