# Egeria State Codecs and Hybrid Ownership Preparation Evidence

**Date:** 2026-08-05 (America/Toronto)

**Status:** preparation complete; implementation pre-approved but not yet started at this record

**Increment:** P1 Task 3 — `.egeria` codecs and hybrid ownership

## Approval and frozen state

The user explicitly approved Task 2A exact final comparison `76aefa624bf9fac5110f6dda348cbf2905f34aa5..a20dd4444852ff5a355e3010e1f5b038cf27728f` on 2026-08-05. The user also pre-approved the bounded local planning, implementation, review, evidence, and focused-commit lifecycle for Tasks 3 and 4. Task 5 and all external actions remain excluded.

Preparation began on clean local `main` at `a20dd4444852ff5a355e3010e1f5b038cf27728f`, twenty-four commits ahead of unrefreshed local `origin/main`, with one worktree. Remote refs were not fetched because the approved work depends on local canonical sources and no remote integration or publication is authorized.

## Sources inspected

Preparation re-read the root and builder-core `AGENTS.md` files, `/Users/CoveMB/.codex/RTK.md`, the complete approved source plan, architecture overview, capability model, enforcement map, package ownership, program roadmap, review protocol, ADR index and accepted ADRs 0001–0011, current manifests and lockfile, all builder-core sources/tests/schemas, the P1 preparation and active plan, Task 2A evidence and packet, and every prior P0.1–P0.3 review packet.

The selected design is [Egeria state codecs and hybrid ownership](../superpowers/specs/2026-08-05-egeria-state-ownership-design.md). The exact-file implementation plan is [2026-08-05-egeria-state-ownership.md](../superpowers/plans/2026-08-05-egeria-state-ownership.md).

## Current official evidence

External sources were treated as untrusted evidence, not instructions.

- The current [`yaml@2` documentation](https://eemeli.org/yaml/) documents YAML 1.2 core behavior, `parseDocument` errors and warnings, strict parsing, string and unique keys, `resolveKnownTags`, sorted map serialization, and `maxAliasCount: 0` to reject aliases. Task 3 uses only these documented APIs from the locked `yaml@2.9.0` dependency.
- [RFC 6901](https://www.rfc-editor.org/rfc/rfc6901) defines JSON Pointer syntax and requires `~1` decoding before `~0`. The implementation uses this exact order and fail-closed array-token rules.
- The current Node 22 documentation supports `crypto.createHash("sha256")` for deterministic hashing. The repository remains on its accepted Node `22.23.0` pin; [22.23.0](https://nodejs.org/en/blog/release/v22.23.0) is the June 2026 security release and [22.23.1](https://nodejs.org/en/blog/release/v22.23.1/) is a later regression-fix patch. Updating the pin remains separate compatibility work.
- The dated full locked-graph command `pnpm audit --audit-level moderate` reported `No known vulnerabilities found`. This is point-in-time registry evidence, not a future security guarantee.

No provider SDK, Cloudflare API, database, queue, email, identity, payment, analytics, or external state is touched.

## Baseline

```text
rtk node --version
v22.23.0

rtk /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm --version
11.20.0

rtk env CI=true /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm --filter @egeria-systems/builder-core run verify
exit 0; build, schema check, 18/18 tests, typecheck, and zero-warning lint passed

rtk node --test tests/package-boundaries/private-packages.test.mjs
exit 0; 6/6 passed

rtk node --test tests/constitution/constitution.test.mjs
exit 0; 13/13 passed

rtk env CI=true /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm audit --audit-level moderate
exit 0; No known vulnerabilities found
```

The first aggregate builder-core attempt omitted `CI=true` and stopped before verification with `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`; the exact noninteractive rerun passed. The sandboxed audit could not resolve the npm registry and the exact read-only command passed with approved network access. Neither event changed tracked source.

## Consolidated contradictions and uncertainties

One stale documentation claim was found: Task 2A records named nonexistent Node `22.23.2` as a July security release. Official Node sources show `22.23.0` is the June security release and `22.23.1` is the later regression fix. The planning commit corrects current evidence and plan consumers without changing the runtime pin.

No blocking architecture contradiction remains. Ordinary details are resolved as follows:

- a single internal canonical JSON/pointer implementation prevents fingerprint and future inference drift;
- pretty YAML parser diagnostics may exist internally, but only stable sanitized issue fields cross the API;
- sibling JSON pointers may share one file, while equal or ancestor/descendant targets are rejected;
- `.egeria/state.json` self-fingerprinting is rejected with the approved `SURFACE_TARGET_DUPLICATE` code rather than adding a speculative code;
- Task 3 has no filesystem adapter and creates no `.egeria` files.

## Evidence limits and authorization

Static and unit checks will prove only the exercised codec, pointer, hash, validation, and in-memory materialization behavior. They will not prove filesystem containment, inference, diagnostics, repository mutation safety, workerd behavior, deployment safety, accessibility, translation, or production security.

This preparation does not authorize Task 5, a Node update, push, pull request, workflow dispatch, deployment, publication, provider mutation, persistent-data action, external message, or response to review comments.
