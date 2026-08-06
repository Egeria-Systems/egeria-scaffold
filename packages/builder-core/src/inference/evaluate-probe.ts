import type { InferenceProbe } from "../contracts/capability.js";
import {
  canonicalizeJsonValue,
  jsonValuesEqual,
  resolveJsonPointer,
  stringifyCanonicalJson,
  type JsonValue,
} from "../serialization/canonical-json.js";
import type { RepositoryReader } from "../repository/repository-reader.js";

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

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function probeKey(probe: InferenceProbe): string {
  switch (probe.kind) {
    case "file":
      return `${probe.kind}\u0000${probe.path}`;
    case "json-value":
      return `${probe.kind}\u0000${probe.path}\u0000${probe.pointer}\u0000${stringifyCanonicalJson(probe.expected)}`;
    case "package":
      return `${probe.kind}\u0000${probe.path}\u0000${probe.section}\u0000${probe.packageName}\u0000${probe.version}`;
  }
}

function evidence(
  probe: InferenceProbe,
  status: ProbeEvidenceStatus,
  code?: string,
): ProbeEvidence {
  return code === undefined
    ? { kind: probe.kind, path: probe.path, status }
    : { kind: probe.kind, path: probe.path, status, code };
}

function parseJson(content: string): JsonValue | undefined {
  try {
    return canonicalizeJsonValue(JSON.parse(content) as unknown);
  } catch {
    return undefined;
  }
}

function isJsonObject(
  value: JsonValue,
): value is Readonly<Record<string, JsonValue>> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function evaluateJsonValueProbe(
  probe: Extract<InferenceProbe, Readonly<{ kind: "json-value" }>>,
  content: string,
): ProbeEvidence {
  const value = parseJson(content);

  if (value === undefined) {
    return evidence(probe, "ambiguous", "JSON_INVALID");
  }

  const selected = resolveJsonPointer(value, probe.pointer);

  if (!selected.found) {
    return evidence(probe, "missing", "JSON_MEMBER_MISSING");
  }

  return jsonValuesEqual(selected.value, probe.expected)
    ? evidence(probe, "present")
    : evidence(probe, "mismatched", "JSON_VALUE_MISMATCH");
}

function evaluatePackageProbe(
  probe: Extract<InferenceProbe, Readonly<{ kind: "package" }>>,
  content: string,
): ProbeEvidence {
  const value = parseJson(content);

  if (value === undefined || !isJsonObject(value)) {
    return evidence(probe, "ambiguous", "JSON_INVALID");
  }

  const section = value[probe.section];

  if (section === undefined || !isJsonObject(section)) {
    return evidence(probe, "missing", "PACKAGE_MEMBER_MISSING");
  }

  if (!Object.hasOwn(section, probe.packageName)) {
    return evidence(probe, "missing", "PACKAGE_MEMBER_MISSING");
  }

  return section[probe.packageName] === probe.version
    ? evidence(probe, "present")
    : evidence(probe, "mismatched", "PACKAGE_VERSION_MISMATCH");
}

async function evaluateProbe(
  reader: RepositoryReader,
  probe: InferenceProbe,
): Promise<ProbeEvidence> {
  const readResult = await reader.readText(probe.path);

  switch (readResult.kind) {
    case "missing":
      return evidence(probe, "missing");
    case "symlink":
      return evidence(probe, "ambiguous", "PATH_SYMLINK");
    case "error":
      return evidence(probe, "ambiguous", readResult.code);
    case "file":
      switch (probe.kind) {
        case "file":
          return evidence(probe, "present");
        case "json-value":
          return evaluateJsonValueProbe(probe, readResult.content);
        case "package":
          return evaluatePackageProbe(probe, readResult.content);
      }
  }
}

export async function evaluateInferenceProbes(
  reader: RepositoryReader,
  probes: readonly InferenceProbe[],
): Promise<readonly ProbeEvidence[]> {
  const sortedProbes = [...probes].sort((left, right) =>
    compareText(probeKey(left), probeKey(right)),
  );
  const results: ProbeEvidence[] = [];

  for (const probe of sortedProbes) {
    results.push(await evaluateProbe(reader, probe));
  }

  return results;
}
