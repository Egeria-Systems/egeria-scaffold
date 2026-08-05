# Read-Only Repository Inference Preparation Evidence

**Date:** 2026-08-05 (America/Toronto)

**Status:** preparation complete; implementation pre-approved but must follow verified Task 3

**Increment:** P1 Task 4 — read-only repository inference

## Approval and dependency

The user pre-approved the bounded local Task 4 lifecycle through implementation and review. Task 4 begins only after Task 3 is implemented, independently reviewed, verified, documented, and committed. It reuses Task 3 canonical JSON, JSON Pointer, codec, and fingerprint behavior. Task 5 doctor/diff remains excluded.

The repository preparation state, sources read, official Node and dependency-security findings, and external-action boundaries are recorded in the sibling [Task 3 preparation evidence](2026-08-05-egeria-state-ownership-preparation.md). The selected Task 4 design is [Read-only repository inference](../superpowers/specs/2026-08-05-repository-inference-design.md); its exact-file plan is [2026-08-05-repository-inference.md](../superpowers/plans/2026-08-05-repository-inference.md).

## Current official evidence

- Current [Node 22 filesystem documentation](https://nodejs.org/download/release/latest-jod/docs/api/fs.html) documents `FileHandle.read`, `lstat`, direct error handling rather than preflight `access`, and explicit handle closing. The design uses a bounded read buffer, leaf identity comparison, repeated ancestor `lstat`, and `finally` closure.
- Current Node documentation describes `TextDecoder` as the WHATWG decoder and states that `fatal: true` throws on decoding errors. This supports fail-closed UTF-8 reads without replacement characters.
- Current Node crypto documentation supports SHA-256 `createHash`, reused from Task 3.
- [RFC 6901](https://www.rfc-editor.org/rfc/rfc6901) remains the pointer-evaluation owner.
- The locked graph audit on 2026-08-05 reported no known vulnerabilities at the moderate threshold. Task 4 adds no dependency.

## Selected inference boundary

- A reader has one operation, `readText`, and one fixed root. It never enumerates or writes.
- Every path is validated before access. Every ancestor is checked with `lstat`; symlinks are evidence rather than followed inputs.
- Each read is capped at 1 MiB and decoded as strict UTF-8.
- Only `.egeria/state.json`, explicit catalog probes, and valid-state surfaces are read.
- Evidence is deterministic and content-free. It may expose stable identifiers, declared paths, categories, statuses, and safe codes only.
- Missing state is known absence. Existing unreadable, symlinked, or invalid state makes declaration-dependent capability evidence ambiguous.
- Managed and merge-managed fingerprints can be confirmed, missing, or drifted. Application-owned and ejected surfaces are never mislabeled as managed drift.

## Consolidated contradictions and uncertainties

The original P1 plan declared `RepositoryInference` as a return type but did not define it. The Task 4 design closes that compile-time gap with narrow state, capability, probe, and surface evidence types. This is required Task 4 behavior, not Task 5 diagnostics.

No blocking uncertainty remains. In particular:

- valid-state capability metadata that differs from the current descriptor is contradictory;
- an installed capability absent from the supplied catalog is ambiguous rather than silently dropped;
- an existing invalid/unreadable state makes all catalog capability declarations ambiguous;
- a missing state plus no present probe omits the capability;
- binary repository surfaces are deferred because the approved reader is text-only;
- filesystem time-of-check/time-of-use exposure is narrowed with open-handle identity and repeated ancestor checks, without inventing a native helper or mutation lock.

## Verification and evidence limits

Unit tests will cover every evidence category, precedence, package and JSON probes, deterministic ordering, managed drift, and content absence. Filesystem tests will cover traversal, absolute paths, leaf and ancestor symlinks, unsupported/unreadable paths, invalid UTF-8, the 1 MiB cap, and an unchanged temporary-tree snapshot.

These checks do not prove behavior under a hostile kernel, network filesystem, concurrent privileged mutation, non-UTF-8/binary managed files, Task 5 policy, repository transformation, production deployment, or provider safety. No external action is authorized.
