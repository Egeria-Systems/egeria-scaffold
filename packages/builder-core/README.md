# `@egeria-systems/builder-core`

Private ownership boundary for Egeria Systems builder internals.

Builder-core owns executable runtime contracts for capability descriptors, profile recipes, desired project configuration, installed state, and successful migration records. Zod schemas are canonical; checked Draft 2020-12 artifacts live in `schemas/`. After building builder-core, regenerate them with `pnpm run schema:generate` or verify them without writes using `pnpm run schema:check`; `pnpm run verify` runs the required build first.

The catalog boundary owns the exact six executable capability descriptors for `portfolio` and `site`, their materialized recipes, deterministic dependency-first resolution, and projection into installed-capability manifest entries. Public package probes receive exact stable package versions; workspace, file, Git, URL, range, tag, and prerelease specifications are rejected without being echoed in issues.

The state and ownership boundary owns strict YAML 1.2 `project.yaml`, JSON `state.json`, and successful-record JSONL migration codecs. It also owns deterministic SHA-256 fingerprints over exact file bytes or canonical RFC 6901-selected JSON values and pure descriptor-to-installed-surface materialization. These APIs do not create or read repository files.

The repository-inference boundary owns fixed-root read-only text access and deterministic capability and surface evidence. Filesystem reads reject unsafe paths and requested-path symlinks, require regular files beneath a non-symlink root, cap content at 1 MiB, and require valid UTF-8. Inference reads only `.egeria/state.json`, catalog-declared probes, and valid-state managed surfaces; it returns stable metadata and codes without actual repository values or source content.

The diagnostic boundary owns `doctorRepository` and `diffProject`. Each operation reads the required `.egeria` control files, declared probes, and valid-state managed surfaces through one per-operation cache. Doctor returns stable codes for invalid control contracts and desired, installed, inferred, or surface disagreement. Diff returns explicit structural difference kinds. Neither API returns source content, writes a repository, authorizes a transformation, or claims that a repository is safe to change.

P1 Task 6 owns `renderSkeleton` and its request/result types. It performs deterministic in-memory rendering from explicit allowlisted templates for the `portfolio` and `site` recipes, keeps structured copy in validated YAML 1.2 files, returns validated desired project, resolution, sorted file bytes, and ownership descriptors, and reports stable sanitized failures. It does not install or build the returned files and performs no repository write or `.egeria` state update. Task 7 remains separate.

Destination transformation, installed state, providers, recovery automation, and every later capability remain outside this increment. The CLI remains empty, and a separate project-schema package is intentionally absent.

The canonical API and lifecycle owner is [package ownership](../../docs/architecture/package-ownership.md).
