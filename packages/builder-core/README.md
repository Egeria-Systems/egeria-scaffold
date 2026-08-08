# `@egeria-systems/builder-core`

Private ownership boundary for Egeria Systems builder internals.

Builder-core owns executable runtime contracts for capability descriptors, profile recipes, desired project configuration, installed state, and successful migration records. Zod schemas are canonical; checked Draft 2020-12 artifacts live in `schemas/`. After building builder-core, regenerate them with `pnpm run schema:generate` or verify them without writes using `pnpm run schema:check`; `pnpm run verify` runs the required build first.

The catalog boundary owns the exact six executable capability descriptors for `portfolio` and `site`, their materialized recipes, deterministic dependency-first resolution, and projection into installed-capability manifest entries. Generation uses immutable, separately verified `0.1.0` versions for the public standards and observability packages. Public package probes require exact stable versions; workspace, file, Git, URL, range, tag, and prerelease specifications are rejected without being echoed in issues.

The state and ownership boundary owns strict YAML 1.2 `project.yaml`, JSON `state.json`, and successful-record JSONL migration codecs. It also owns deterministic SHA-256 fingerprints over exact file bytes or canonical RFC 6901-selected JSON values and pure descriptor-to-installed-surface materialization. These APIs do not create or read repository files.

The repository-inference boundary owns fixed-root read-only text access and deterministic capability and surface evidence. Filesystem reads reject unsafe paths and requested-path symlinks, require regular files beneath a non-symlink root, cap content at 1 MiB, and require valid UTF-8. Inference reads only `.egeria/state.json`, catalog-declared probes, and valid-state managed surfaces; it returns stable metadata and codes without actual repository values or source content.

The diagnostic boundary owns `doctorRepository` and `diffProject`. Each operation reads the required `.egeria` control files, declared probes, and valid-state managed surfaces through one per-operation cache. Doctor returns stable codes for invalid control contracts and desired, installed, inferred, or surface disagreement. Diff returns explicit structural difference kinds. Neither API returns source content, writes a repository, authorizes a transformation, or claims that a repository is safe to change.

`renderSkeleton` performs deterministic in-memory rendering from explicit allowlisted templates for the `portfolio` and `site` recipes, keeps structured copy in validated YAML 1.2 files, returns validated desired project, resolution, sorted file bytes, and ownership descriptors, and reports stable sanitized failures.

`generateProject` owns bounded creation of one previously absent destination. It injects the immutable verified package versions, writes rendered files and project configuration exclusively in an identity-recorded sibling temporary directory, accepts only one new regular lockfile from the injected verifier, requires probable pre-state inference, delegates isolated verification, writes an empty migration log and validated installed state last, requires confirmed post-state inference with no managed drift, and commits with one rename. Failures clean only an identity-matching source temporary directory. The verifier is an effect boundary; it owns no catalog, state, or lifecycle decision.

`createPnpmGeneratedProjectVerifier` is the concrete effect adapter. It requires pnpm `11.20.0`, prepares the lockfile with scripts disabled and a builder-owned external store, copies the source into a separately owned validation directory, and runs the frozen install, lint, typecheck, Next build, and OpenNext build there. Child processes receive only a narrow platform/process environment, a blank home and npm configuration, the public npm registry, and disabled Next telemetry. Commands use argument-array `execFile` calls with bounded time and output; child output is never returned. Validation and support owners are identity-checked before recursive cleanup.

Portable filesystem rename does not provide a hostile-concurrency no-clobber guarantee on every supported platform. Generation checks destination absence immediately before rename and preserves destinations observed before that check; a target created after the check may still be replaced where the platform's rename semantics permit it.

Existing-repository transformation, clean-Git enforcement, migration execution, persistent-data or provider rollback, recovery automation, providers, and every later capability remain outside this increment. The private CLI is the current thin consumer of generation, inference, and diagnostics; it owns no builder decisions. A separate project-schema package is intentionally absent.

The canonical API and lifecycle owner is [package ownership](../../docs/architecture/package-ownership.md).
