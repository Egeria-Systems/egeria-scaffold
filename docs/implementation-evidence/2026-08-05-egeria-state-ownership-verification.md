# Egeria State Codecs and Hybrid Ownership Verification Evidence

**Execution date:** 2026-08-05 (America/Toronto)

**Status:** Task 3 implementation, evidence-backed repairs, independent review, and final verification are complete. The user's advance authorization permits Task 4 to begin.

**Implementation comparison:** `73e61848a1cf2765f7eca45c5d61cce44316414c..180eeace8c7a055c83d211ae3c6f43cf12145562`

**Commits:**

- `6d4bae635785fc375aa78a57bd47b455f4a99dad` — `Add Egeria state ownership`
- `180eeace8c7a055c83d211ae3c6f43cf12145562` — `Harden state ownership inputs`

The implementation ran on the approved sequential local `main` stream. At final verification the worktree was clean and `main` was twenty-seven commits ahead of unrefreshed local `origin/main`. Remote refs were not fetched because no remote integration or publication was authorized.

## Implemented boundary

Task 3 adds:

- strict YAML 1.2 project parsing and deterministic serialization;
- strict installed-state JSON parsing and recursively sorted serialization;
- successful-record migration JSONL parsing with one-based source lines and compact canonical serialization;
- internal fail-closed canonical JSON and RFC 6901 resolution;
- lowercase SHA-256 fingerprints over exact bytes or canonical selected JSON values;
- runtime-validated descriptor-to-installed-surface projection;
- duplicate, overlapping, and `.egeria/state.json` self-reference rejection; and
- safe issue codes, structural paths, and context without raw source, values, or dynamic keys.

It creates no `.egeria` file, filesystem reader, inference result, diagnostic, planner, migration executor, repository mutation, CLI behavior, provider resource, or later capability.

## TDD record

### Initial RED

Tests and package-boundary expectations were written before production sources.

```text
rtk env CI=true /Users/CoveMB/.volta/tools/image/pnpm/11.20.0/bin/pnpm --filter @egeria-systems/builder-core run build
exit 0; unchanged Task 2 source built successfully

rtk node --test packages/builder-core/tests/state-ownership.test.mjs
expected exit 1; 0 passed, 10 failed because every Task 3 export was absent

rtk node --test tests/package-boundaries/private-packages.test.mjs
expected exit 1; 4 passed, 2 failed on the missing Task 3 source files and boundary documentation
```

The failures were requirement-specific missing-feature failures, not dependency, module-loader, or environment errors.

### Initial GREEN and development correction

The first TypeScript build found one readonly-union narrowing error at JSON Pointer object access. The root cause was `Array.isArray` not preserving the readonly `JsonValue` element type. A narrow typed array guard and object-record access fixed the compiler boundary. The first aggregate verification then found five strict-ESLint unsafe-assignment/narrowing errors around untyped platform/library returns. Replacing `Object.getPrototypeOf` with typed `Reflect.getPrototypeOf`, adding typed array guards, removing an unnecessary assertion, and casting YAML's `toJS` result to `unknown` resolved the actual type boundaries.

After those corrections:

```text
state-ownership.test.mjs: 10/10 passed
private-packages.test.mjs: 6/6 passed
builder-core aggregate tests: 28/28 passed
typecheck and zero-warning lint passed
```

### Review-repair RED and GREEN

Review findings were converted to regression tests before repairs:

```text
rtk node --test packages/builder-core/tests/state-ownership.test.mjs
expected exit 1; 9 passed, 3 failed on dynamic-key leakage, sparse-array acceptance, and invalid runtime descriptor acceptance
```

The repair then:

- rejects sparse and non-index-property arrays before canonicalization;
- sanitizes non-structural schema path segments to `<dynamic>`;
- validates every surface descriptor through `managedSurfaceDescriptorSchema` before ownership checks and returns `SURFACE_TARGET_INVALID` on failure;
- asserts exact YAML and migration serialization;
- verifies recursive nested JSON ordering; and
- covers two distinct full-file owners targeting the same path.

The focused repair suite passed 12/12. The full builder-core suite passed 30/30 with schema checking, typecheck, and zero-warning lint.

## Final commands and results

| Command | Result |
| --- | --- |
| `pnpm --filter @egeria-systems/builder-core run verify` | exit `0`; build, checked schemas, 30/30 tests, no-emit typecheck, and zero-warning lint passed |
| `pnpm run test:package-boundaries` | exit `0`; 22/22 passed, including exact private source and documentation boundaries |
| `pnpm run test:constitution` | exit `0`; 13/13 passed, including local Markdown links |
| `git diff --check` | exit `0` |
| `git status --short --branch` | clean `main...origin/main [ahead 27]` |

No compatibility proof was rerun because Task 3 changes no root workflow, Next/OpenNext/Cloudflare proof, runtime pin, lockfile, or generated application behavior.

## Independent review dispositions

All reviews used frozen candidate `73e61848a1cf2765f7eca45c5d61cce44316414c..6d4bae635785fc375aa78a57bd47b455f4a99dad`; scoped re-reviews inspected repair range `6d4bae635785fc375aa78a57bd47b455f4a99dad..180eeace8c7a055c83d211ae3c6f43cf12145562`.

- **Requirements:** found sparse arrays could collide with `[null]`. Repaired and re-reviewed as addressed; no new material findings.
- **Architecture and anti-overengineering:** found runtime descriptors could bypass canonical schema validation. Repaired with canonical descriptor validation and re-reviewed as addressed; no new material findings.
- **Test evidence:** found sparse-array coverage, causal exact serialization/nested-order assertions, and distinct full-file-overlap coverage missing. All were added and re-reviewed as addressed; no material findings remain.
- **Input-format and security:** found dynamic Zod path segments could expose attacker-controlled keys and confirmed the sparse-array collision. Both were repaired and re-reviewed as addressed; no new material security findings.

Reviewers were read-only and performed no repository edit, recursive delegation, GitHub action, workflow dispatch, deployment, provider call, or external mutation.

## Evidence limits and residual risks

- Task 3 is in-memory. It does not prove filesystem containment, symlink behavior, read-size enforcement, repository inference, diagnostics, or mutation safety.
- YAML aliases, warnings, duplicate keys, tags, multiple documents, malformed JSON, malformed JSONL, invalid runtime descriptors, sparse arrays, cycles, non-finite numbers, pointer misses, overlaps, and dynamic-key leakage are covered. This does not prove resistance to every possible resource-exhaustion input supplied directly by a future caller.
- Node `22.23.0` remains the accepted pin; official `22.23.1` is a later regression-fix patch. No runtime-security or future-vulnerability claim is made.
- The dated moderate-threshold audit in preparation reported no known vulnerabilities. No dependency or lockfile changed.
- Static/unit checks do not establish runtime deployment, production security, accessibility, translation, visual quality, or human usability.

## Rollback and recovery

- Revert `180eeac` and `6d4bae6` with new focused revert commits; do not reset shared `main`.
- Rebuild builder-core after source rollback. Ignored `dist` output is reproducible and non-authoritative.
- No dependency or lockfile rollback exists.
- No `.egeria` repository state, migration record, persistent data, deployment, provider resource, or external system was created or changed.

## Gate disposition

Task 3 meets its local implementation and review checkpoint. The user's explicit advance authorization permits proceeding to Task 4 without another routine approval pause. Task 5 and all external actions remain unauthorized.
