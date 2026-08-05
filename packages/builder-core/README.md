# `@egeria-systems/builder-core`

Private ownership boundary for Egeria Systems builder internals.

P1 Task 1 owns executable runtime contracts for capability descriptors, profile recipes, desired project configuration, installed state, and successful migration records. Zod schemas are canonical; checked Draft 2020-12 artifacts live in `schemas/`. After building builder-core, regenerate them with `pnpm run schema:generate` or verify them without writes using `pnpm run schema:check`; `pnpm run verify` runs the required build first.

Capability resolution, `.egeria` codecs and files, inference, diagnostics, repository transformation, templates, providers, and recovery automation remain outside this increment. A separate project-schema package is intentionally absent.

The canonical API and lifecycle owner is [package ownership](../../docs/architecture/package-ownership.md).
