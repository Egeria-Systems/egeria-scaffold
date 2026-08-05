# Egeria State Codecs and Hybrid Ownership Design

**Status:** Approved for execution on 2026-08-05

## Scope

Task 3 adds strict in-memory codecs for the three `.egeria` contracts and deterministic fingerprint materialization for declared surfaces. It creates no repository `.egeria` directory, performs no filesystem write, infers no repository, plans no migration, and changes no provider or persistent data.

The runtime Zod schemas remain canonical. JSON Schema artifacts do not change because this task consumes the existing contracts rather than changing them.

## Chosen structure

One internal canonical JSON/RFC 6901 module serves codecs, ownership materialization, and the next approved inference increment. It is not exported from builder-core. This avoids three subtly different pointer/canonicalization implementations without creating a generic serialization service.

Alternatives considered:

1. **Shared narrow internal functions — selected.** Exact JSON value types, stable recursive object-key sorting, array-order preservation, and pointer resolution remain one cohesive implementation.
2. **Separate helpers in codecs, materialization, and inference — rejected.** Duplication would make fingerprints and probe comparisons capable of disagreeing.
3. **A general serialization or storage service — rejected.** Task 3 has three fixed formats and no storage abstraction requirement.

## Codec contracts

`parseProjectYaml` uses `yaml@2.9.0` `parseDocument` with YAML 1.2 core semantics, strict and unique string keys, known YAML 1.1 tags disabled, and pretty errors enabled for internal parser accuracy. The parsed document must have no errors or warnings. Conversion uses `maxAliasCount: 0` and plain JavaScript objects. Multiple documents, aliases, duplicate keys, invalid tags, and schema-invalid values fail closed. Parser messages and excerpts never cross the public result boundary.

The parser uses these stable issue codes:

- `PROJECT_YAML_INVALID` for YAML/document/conversion failures;
- `PROJECT_SCHEMA_INVALID` for runtime project-schema failures;
- `STATE_JSON_INVALID` and `STATE_SCHEMA_INVALID` for installed state;
- `MIGRATION_JSON_INVALID` and `MIGRATION_SCHEMA_INVALID` for a JSONL record.

Issues contain only a deterministic path, stable code, and safe structural reason. They never echo source, parsed values, YAML excerpts, or JSON text. Migration paths start with the one-based source line number, including blank lines in that count. Blank lines are ignored; an empty or whitespace-only log is valid and returns an empty list.

Serializers first validate their typed input at runtime and throw `TypeError` with a stable code when an invalid value crosses the TypeScript boundary. Project YAML uses YAML 1.2, sorted maps, aliases disabled during construction, two-space indentation, no wrapping, and exactly one terminal newline. State JSON uses recursively sorted object keys, two-space indentation, and exactly one terminal newline. A migration record is one compact canonical JSON object plus one newline.

## Canonical JSON and JSON Pointer

Canonical JSON accepts only JSON values: `null`, booleans, finite numbers, strings, arrays, and plain objects. Object keys sort lexically at every level; array order is preserved. Unsupported values and cyclic structures fail closed. RFC 6901 tokens decode `~1` before `~0`, object members require an own property, and array tokens must be canonical non-negative decimal indices (`0` or a non-zero digit followed by digits). `-`, leading-zero indices, out-of-range indices, and scalar traversal are missing-pointer results.

## Fingerprints and surfaces

`fingerprintFileContent` hashes exact bytes with SHA-256. `fingerprintJsonValue` hashes the UTF-8 bytes of compact canonical JSON. Both return lowercase `sha256:<64 hex>` values.

`materializeInstalledSurfaces` is pure and preserves descriptor order. Before reading any source value, it rejects:

- duplicate surface identifiers;
- any target whose path is `.egeria/state.json`;
- two full-file targets for the same path;
- a full-file target and a JSON-value target on the same path;
- equal or ancestor/descendant JSON pointers on the same path.

Distinct sibling JSON pointers on the same file are allowed because the approved capability catalog owns separate package entries in `apps/web/package.json`.

Missing files return `SURFACE_SOURCE_MISSING`. A JSON target whose source is not valid JSON or whose pointer is missing returns `SURFACE_POINTER_MISSING` with a safe reason. Duplicate, overlapping, or self-referential targets return `SURFACE_TARGET_DUPLICATE`. Raw source bytes and values never enter issues.

The result copies each descriptor into an `InstalledSurface` and adds the calculated fingerprint. Task 3 records application-owned initial fingerprints because the installed-state contract requires them, but it does not imply later overwrite authority. Task 4 distinguishes managed drift from application-owned change.

## Security and recovery boundary

YAML aliases are prohibited, input diagnostics are sanitized, JSON values are finite and acyclic, and `.egeria/state.json` cannot fingerprint itself. The functions have no network, process, filesystem, Git, credential, or provider access.

Rollback is a focused source revert plus a builder-core rebuild. No repository state, migration log, persistent data, or provider resource is created, so those recovery domains do not apply.
