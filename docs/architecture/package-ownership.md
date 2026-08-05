# Package Ownership

**Status:** Controlling package and API ownership through the P0.3 implementation

**Sources:** [ADR-0005](../adr/0005-evidence-driven-package-extraction.md), [architecture overview](overview.md), and the [approved P0.3 plan](../superpowers/plans/2026-08-04-p0-3-lean-builder-monorepo.md)

This document owns the builder repository's package visibility, current API surface, responsibility, consumers, and publication boundary. The [review and contribution protocol](../governance/review-and-contribution.md) owns implementation and approval gates.

## Ownership matrix

| Location | Package | Visibility | Current P0.3 API | Responsibility and consumers | Publication guard | Stage boundary |
| --- | --- | --- | --- | --- | --- | --- |
| `apps/cli` | `@egeria-systems/cli` | Private application | Empty ESM ownership shell compiled through the strict standards API; no `bin` | Future command input/output; standards configuration consumer | `private: true`; no exports or runtime dependencies | Commands and repository-changing behavior require later approved stages |
| `packages/builder-core` | `@egeria-systems/builder-core` | Private package | Empty ESM ownership shell compiled through the strict standards API | Future project/state schemas and cohesive builder internals; standards configuration consumer and future CLI consumer | `private: true`; no exports or runtime dependencies | P1 is the first executable schema and builder-kernel stage; no separate project-schema package |
| `packages/standards` | `@egeria-systems/standards` | Public ordinary dependency | `./typescript/strict.json`, `./eslint/cloudflare-isolation`, and `./package.json`; no root export | Replaceable static standards consumed by CLI, builder-core, and the Cloudflare proof | Exact exports and file allowlist; contract tests; `prepublishOnly`; public npm/provenance defaults | Only justified, consumed standards APIs may be added |
| `packages/observability` | `@egeria-systems/observability` | Public ordinary dependency | Empty ESM root export with declarations; no exported values | Future provider-neutral observability API; currently an ownership, build, and packaging shell consuming the strict standards configuration | Exact exports and file allowlist; contract tests; `prepublishOnly`; public npm/provenance defaults | Events, redaction, transports, providers, analytics, and Cloudflare bindings remain outside P0.3 |

## Dependency direction

- The CLI and builder-core depend on standards only for development-time compilation. The CLI may depend on builder-core only after an approved executable builder stage creates a concrete need.
- Observability depends on standards only for development-time compilation and has no runtime dependencies.
- Builder-core remains provider-neutral and owns its consuming-boundary ports. It does not depend on the CLI.
- Public packages remain ordinary replaceable dependencies. Public availability does not transfer ownership of generated application code back to this repository.
- Cloudflare types and bindings remain in platform adapters and composition roots; no package may hide them behind a generic platform or database service.

## Versioning and release boundary

P0.3 packages begin at `0.0.0`. Standards and observability now have exact public APIs, package-content allowlists, contract tests, and publication defaults. Their Changesets release intent arrives only in its approved P0.3 increment.

Local release configuration never authorizes publication. npm namespace control, licensing, credentials, exact package contents, provenance, and the external publish command require separate current evidence and explicit human approval.

## Deferred ownership

P0.3 reserves ownership without implementing future behavior. In particular, it creates no `.egeria` schema or state, profile, capability descriptor, generator, migration, provider, transport, application persistence, identity, payment, analytics, or generated client repository.
