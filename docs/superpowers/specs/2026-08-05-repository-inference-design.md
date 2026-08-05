# Read-Only Repository Inference Design

**Status:** Advance-approved for execution after Task 3 verifies

## Scope

Task 4 reads only `.egeria/state.json`, catalog-declared probe paths, and valid-state surface paths. It classifies capability evidence and ownership evidence deterministically. It creates no doctor or diff diagnostic, command, report file, state update, migration entry, plan, mutation, Git action, provider call, or Task 5 surface.

## Chosen structure

A fixed-root `RepositoryReader` is the only filesystem boundary. Probe evaluation and aggregate inference consume that port. The in-memory reader exercises inference without filesystem coupling, while the filesystem reader receives dedicated containment, symlink, size, encoding, and no-write tests.

Alternatives considered:

1. **Narrow discriminated evidence plus bounded reader — selected.** It makes uncertainty explicit and gives Task 5 structured data without implementing Task 5 policy.
2. **Return user-facing diagnostics directly — rejected.** Stable diagnostic codes and doctor/diff policy belong to Task 5.
3. **Enumerate the repository into a generic snapshot — rejected.** Enumeration would access unrelated data and violate the approved fixed-path boundary.

## Public contracts

```ts
export type RepositoryReadErrorCode =
  | "PATH_INVALID"
  | "FILE_TOO_LARGE"
  | "FILE_TYPE_UNSUPPORTED"
  | "FILE_ENCODING_INVALID"
  | "READ_FAILED";

export type RepositoryReadResult =
  | Readonly<{ kind: "file"; content: string }>
  | Readonly<{ kind: "missing" }>
  | Readonly<{ kind: "symlink" }>
  | Readonly<{ kind: "error"; code: RepositoryReadErrorCode }>;

export interface RepositoryReader {
  readText(path: string): Promise<RepositoryReadResult>;
}

export type ProbeEvidenceStatus =
  | "present"
  | "missing"
  | "mismatched"
  | "ambiguous";

export type ProbeEvidence = Readonly<{
  kind: InferenceProbe["kind"];
  path: string;
  status: ProbeEvidenceStatus;
  code?: string;
}>;

export type EvidenceCategory =
  | "confirmed"
  | "probable"
  | "partial"
  | "contradictory"
  | "ambiguous";

export type CapabilityEvidence = Readonly<{
  identifier: string;
  category: EvidenceCategory;
  probes: readonly ProbeEvidence[];
  code?: string;
}>;

export type SurfaceEvidenceStatus =
  | "confirmed"
  | "missing"
  | "drifted"
  | "application-owned"
  | "ejected"
  | "ambiguous";

export type SurfaceEvidence = Readonly<{
  identifier: string;
  path: string;
  status: SurfaceEvidenceStatus;
  code?: string;
}>;

export type RepositoryStateEvidence =
  | Readonly<{ kind: "valid"; value: InstalledState }>
  | Readonly<{ kind: "missing" }>
  | Readonly<{ kind: "invalid"; issues: readonly ContractIssue[] }>
  | Readonly<{ kind: "ambiguous"; code: string }>;

export type RepositoryInference = Readonly<{
  state: RepositoryStateEvidence;
  capabilities: readonly CapabilityEvidence[];
  surfaces: readonly SurfaceEvidence[];
}>;
```

Issue codes and evidence codes are developer-facing identifiers only. No read result, probe result, state error, or inference result contains raw repository content, actual package versions, actual JSON values, credentials, tokens, or secret values.

## Reader boundary

Both readers validate a requested path with the existing safe-relative-path contract before access. The filesystem reader fixes one absolute root at construction and rejects a missing, non-directory, or symlink root as `PATH_INVALID` for every read.

For each accepted path it:

1. resolves within the fixed root;
2. `lstat`s every ancestor and the leaf without following symlinks;
3. returns `symlink` for any symlink segment;
4. requires directory ancestors and a regular-file leaf;
5. opens the leaf read-only, compares the open handle identity with the prior leaf stat, and rechecks ancestors to narrow time-of-check/time-of-use races;
6. reads at most 1 MiB plus one byte and returns `FILE_TOO_LARGE` when the cap is exceeded;
7. decodes strict UTF-8 with fatal errors; and
8. closes the handle in every path.

Missing segments return `missing`. Unsupported file types, invalid UTF-8, and other read failures use only stable codes. The reader never enumerates directories and has no write method. Binary surface inference is outside this text-only increment.

## Probe evidence

Probe order uses a stable lexical key derived from kind and declared metadata. A file probe is present when its path is a readable file. JSON-value and package probes parse the declared file as JSON; invalid JSON, a symlink, or a reader error is ambiguous. Missing members are missing; present unequal values or package versions are mismatched. JSON equality uses the Task 3 canonical JSON rules. Package evidence does not expose the actual installed version.

Capability ordering is lexical by identifier. Classification precedence is:

1. any ambiguous required probe, unknown installed capability descriptor, or unreadable/invalid existing state makes the relevant evidence `ambiguous`;
2. a state-declared capability whose installed metadata differs from the current descriptor, or which has a missing/mismatched probe, is `contradictory`;
3. state-declared plus every probe present is `confirmed`;
4. undeclared plus every probe present is `probable`;
5. undeclared plus at least one but not all probes present is `partial`;
6. undeclared with no present probe is omitted.

A missing `.egeria/state.json` is known absence. An existing invalid, symlinked, or unreadable state makes every catalog capability ambiguous because declaration status cannot be trusted. A valid-state installed capability absent from the supplied catalog is emitted as ambiguous with `CAPABILITY_DESCRIPTOR_MISSING` and no probes.

No confidence number, majority rule, or force option exists.

## Surface evidence

Surface ordering is lexical by identifier then path. Only surfaces from a valid installed state are considered:

- `managed` and `merge-managed` surfaces compare their current file or canonical JSON-value fingerprint with state;
- equal fingerprints are `confirmed`, missing sources are `missing`, unequal fingerprints are `drifted`, and symlink/read/JSON/pointer uncertainty is `ambiguous`;
- `application-owned` surfaces are reported as `application-owned` without drift comparison because later application change is permitted;
- `ejected` surfaces are reported as `ejected` without reading.

This preserves the distinction between evidence and later transformation policy: Task 4 detects managed drift but neither blocks nor authorizes a change. Task 5 will interpret the evidence.

## Security and recovery boundary

The filesystem adapter minimizes access, bounds memory, rejects traversal and symlinks, and never emits content. Tests use a builder-owned temporary directory and confirm its filesystem snapshot is unchanged after reads.

Rollback is a focused source revert plus builder-core rebuild. Inference is read-only, so there is no `.egeria`, Git, dependency, persistent-data, deployment, or provider recovery action.
