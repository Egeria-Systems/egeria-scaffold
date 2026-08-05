# `@egeria-systems/builder-core`

Private ownership boundary for Egeria Systems builder internals.

P1 Task 1 owns executable runtime contracts for capability descriptors, profile recipes, desired project configuration, installed state, and successful migration records. Zod schemas are canonical; checked Draft 2020-12 artifacts live in `schemas/`. After building builder-core, regenerate them with `pnpm run schema:generate` or verify them without writes using `pnpm run schema:check`; `pnpm run verify` runs the required build first.

P1 Task 2 owns the exact six executable capability descriptors for `portfolio` and `site`, their materialized recipes, deterministic dependency-first resolution, and projection into installed-capability manifest entries. Public package probes receive exact stable package versions; workspace, file, Git, URL, range, tag, and prerelease specifications are rejected without being echoed in issues.

P1 Task 3 owns strict YAML 1.2 `project.yaml`, JSON `state.json`, and successful-record JSONL migration codecs. It also owns deterministic SHA-256 fingerprints over exact file bytes or canonical RFC 6901-selected JSON values and pure descriptor-to-installed-surface materialization. These APIs do not create or read repository files.

Repository inference, diagnostics, repository transformation, templates, providers, recovery automation, and every later capability remain outside this increment. The CLI remains empty, and a separate project-schema package is intentionally absent.

The canonical API and lifecycle owner is [package ownership](../../docs/architecture/package-ownership.md).
