import type { CapabilityDescriptor } from "../contracts/capability.js";
import type { ContractIssue } from "../contracts/result.js";
import type {
  InstalledCapability,
  InstalledState,
  InstalledSurface,
} from "../contracts/state.js";
import {
  fingerprintFileContent,
  fingerprintJsonValue,
} from "../ownership/fingerprint.js";
import { createCachingRepositoryReader } from "../repository/cache-reader.js";
import type { RepositoryReader } from "../repository/repository-reader.js";
import {
  canonicalizeJsonValue,
  resolveJsonPointer,
  type JsonValue,
} from "../serialization/canonical-json.js";
import { parseStateJson } from "../state/codecs.js";
import {
  evaluateInferenceProbes,
  type ProbeEvidence,
} from "./evaluate-probe.js";

const encoder = new TextEncoder();

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

export type InferRepositoryRequest = Readonly<{
  reader: RepositoryReader;
  catalog: readonly CapabilityDescriptor[];
}>;

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function withCode<T extends object>(value: T, code?: string): T & { code?: string } {
  return code === undefined ? value : { ...value, code };
}

function capabilityEvidence(
  identifier: string,
  category: EvidenceCategory,
  probes: readonly ProbeEvidence[],
  code?: string,
): CapabilityEvidence {
  return withCode({ identifier, category, probes }, code);
}

function surfaceEvidence(
  surface: InstalledSurface,
  status: SurfaceEvidenceStatus,
  code?: string,
): SurfaceEvidence {
  return withCode(
    { identifier: surface.identifier, path: surface.path, status },
    code,
  );
}

async function inferState(
  reader: RepositoryReader,
): Promise<RepositoryStateEvidence> {
  const result = await reader.readText(".egeria/state.json");

  switch (result.kind) {
    case "missing":
      return { kind: "missing" };
    case "symlink":
      return { kind: "ambiguous", code: "STATE_SYMLINK" };
    case "error":
      return { kind: "ambiguous", code: result.code };
    case "file": {
      const parsed = parseStateJson(result.content);
      return parsed.ok
        ? { kind: "valid", value: parsed.value }
        : { kind: "invalid", issues: parsed.issues };
    }
  }
}

function installedMetadataMatches(
  installed: InstalledCapability,
  descriptor: CapabilityDescriptor,
): boolean {
  const descriptorStateClassifications = new Set(
    descriptor.stateClassifications,
  );

  return (
    installed.version === descriptor.version &&
    installed.deliveryMode === descriptor.deliveryMode &&
    installed.removalPolicy === descriptor.removalPolicy &&
    installed.stateClassifications.length ===
      descriptor.stateClassifications.length &&
    installed.stateClassifications.every((classification) =>
      descriptorStateClassifications.has(classification),
    )
  );
}

async function inferCapabilities(
  reader: RepositoryReader,
  catalog: readonly CapabilityDescriptor[],
  state: RepositoryStateEvidence,
): Promise<readonly CapabilityEvidence[]> {
  const sortedCatalog = [...catalog].sort((left, right) =>
    compareText(left.identifier, right.identifier),
  );

  if (state.kind === "invalid" || state.kind === "ambiguous") {
    return sortedCatalog.map((descriptor) =>
      capabilityEvidence(
        descriptor.identifier,
        "ambiguous",
        [],
        "STATE_DECLARATION_AMBIGUOUS",
      ),
    );
  }

  const installedCapabilities =
    state.kind === "valid" ? state.value.installedCapabilities : [];
  const installedByIdentifier = new Map(
    installedCapabilities.map((capability) => [capability.identifier, capability]),
  );
  const descriptorIdentifiers = new Set(
    sortedCatalog.map(({ identifier }) => identifier),
  );
  const results: CapabilityEvidence[] = [];

  for (const descriptor of sortedCatalog) {
    const installed = installedByIdentifier.get(descriptor.identifier);
    const probes = await evaluateInferenceProbes(
      reader,
      descriptor.inferenceProbes,
    );

    if (probes.some(({ status }) => status === "ambiguous")) {
      results.push(
        capabilityEvidence(descriptor.identifier, "ambiguous", probes),
      );
      continue;
    }

    if (installed !== undefined) {
      if (!installedMetadataMatches(installed, descriptor)) {
        results.push(
          capabilityEvidence(
            descriptor.identifier,
            "contradictory",
            probes,
            "CAPABILITY_METADATA_MISMATCH",
          ),
        );
        continue;
      }

      results.push(
        capabilityEvidence(
          descriptor.identifier,
          probes.every(({ status }) => status === "present")
            ? "confirmed"
            : "contradictory",
          probes,
        ),
      );
      continue;
    }

    const presentCount = probes.filter(({ status }) => status === "present").length;

    if (probes.length > 0 && presentCount === probes.length) {
      results.push(
        capabilityEvidence(descriptor.identifier, "probable", probes),
      );
    } else if (presentCount > 0) {
      results.push(
        capabilityEvidence(descriptor.identifier, "partial", probes),
      );
    }
  }

  if (state.kind === "valid") {
    for (const installed of installedCapabilities) {
      if (!descriptorIdentifiers.has(installed.identifier)) {
        results.push(
          capabilityEvidence(
            installed.identifier,
            "ambiguous",
            [],
            "CAPABILITY_DESCRIPTOR_MISSING",
          ),
        );
      }
    }
  }

  return results.sort((left, right) =>
    compareText(left.identifier, right.identifier),
  );
}

function parseJson(content: string): JsonValue | undefined {
  try {
    return canonicalizeJsonValue(JSON.parse(content) as unknown);
  } catch {
    return undefined;
  }
}

async function inferManagedSurface(
  reader: RepositoryReader,
  surface: InstalledSurface,
): Promise<SurfaceEvidence> {
  const result = await reader.readText(surface.path);

  switch (result.kind) {
    case "missing":
      return surfaceEvidence(surface, "missing");
    case "symlink":
      return surfaceEvidence(surface, "ambiguous", "PATH_SYMLINK");
    case "error":
      return surfaceEvidence(surface, "ambiguous", result.code);
    case "file": {
      if (surface.fingerprintTarget.kind === "file") {
        const currentFingerprint = fingerprintFileContent(
          encoder.encode(result.content),
        );
        return surfaceEvidence(
          surface,
          currentFingerprint === surface.fingerprint ? "confirmed" : "drifted",
        );
      }

      const parsed = parseJson(result.content);

      if (parsed === undefined) {
        return surfaceEvidence(surface, "ambiguous", "JSON_INVALID");
      }

      const selected = resolveJsonPointer(
        parsed,
        surface.fingerprintTarget.pointer,
      );

      if (!selected.found) {
        return surfaceEvidence(surface, "missing", "JSON_MEMBER_MISSING");
      }

      const currentFingerprint = fingerprintJsonValue(selected.value);
      return surfaceEvidence(
        surface,
        currentFingerprint === surface.fingerprint ? "confirmed" : "drifted",
      );
    }
  }
}

async function inferSurfaces(
  reader: RepositoryReader,
  state: RepositoryStateEvidence,
): Promise<readonly SurfaceEvidence[]> {
  if (state.kind !== "valid") {
    return [];
  }

  const results: SurfaceEvidence[] = [];

  for (const surface of state.value.managedSurfaces) {
    if (surface.ownership === "application-owned") {
      results.push(surfaceEvidence(surface, "application-owned"));
    } else if (surface.ownership === "ejected") {
      results.push(surfaceEvidence(surface, "ejected"));
    } else {
      results.push(await inferManagedSurface(reader, surface));
    }
  }

  return results.sort((left, right) => {
    const identifierComparison = compareText(left.identifier, right.identifier);
    return identifierComparison === 0
      ? compareText(left.path, right.path)
      : identifierComparison;
  });
}

export async function inferRepository(
  request: InferRepositoryRequest,
): Promise<RepositoryInference> {
  const reader = createCachingRepositoryReader(request.reader);
  const state = await inferState(reader);
  const capabilities = await inferCapabilities(reader, request.catalog, state);
  const surfaces = await inferSurfaces(reader, state);

  return { state, capabilities, surfaces };
}
