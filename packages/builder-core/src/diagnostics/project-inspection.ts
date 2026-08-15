import type { CapabilityDescriptor } from "../contracts/capability.js";
import type { MigrationRecord } from "../contracts/migration.js";
import type { ProfileRecipe } from "../contracts/profile.js";
import type { ProjectConfiguration } from "../contracts/project.js";
import type {
  ContractIssue,
  ValidationResult,
} from "../contracts/result.js";
import type { InstalledSurface } from "../contracts/state.js";
import {
  inferRepository,
  type EvidenceCategory,
  type RepositoryInference,
  type SurfaceEvidenceStatus,
} from "../inference/infer-repository.js";
import {
  resolveCapabilities,
  type ResolvedCapabilities,
} from "../resolution/resolve-capabilities.js";
import { createCachingRepositoryReader } from "../repository/cache-reader.js";
import type { RepositoryReader } from "../repository/repository-reader.js";
import {
  parseMigrationLog,
  parseProjectYaml,
  parseStateJson,
} from "../state/codecs.js";

export const projectConfigurationPath = ".egeria/project.yaml";
export const statePath = ".egeria/state.json";
export const migrationLogPath = ".egeria/migrations.jsonl";

export type ControlFileEvidence<T> =
  | Readonly<{ kind: "valid"; value: T }>
  | Readonly<{ kind: "missing" }>
  | Readonly<{ kind: "invalid"; issues: readonly ContractIssue[] }>
  | Readonly<{ kind: "ambiguous"; code: string }>;

export type ProjectInspection = Readonly<{
  project: ControlFileEvidence<ProjectConfiguration>;
  migrations: ControlFileEvidence<readonly MigrationRecord[]>;
  inference: RepositoryInference;
  resolution?: ValidationResult<ResolvedCapabilities>;
}>;

export type CapabilityDiscrepancyFact = Readonly<{
  identifier: string;
  desired: boolean;
  installed: boolean;
  descriptorMissing: boolean;
  inferenceCategory?: EvidenceCategory;
  inferenceCode?: string;
}>;

export type SurfaceDiscrepancyFact = Readonly<{
  identifier: string;
  path: string;
  status: Extract<SurfaceEvidenceStatus, "missing" | "drifted" | "ambiguous">;
  reason?: string;
  capability?: string;
}>;

export type ProjectDiscrepancies = Readonly<{
  capabilities: readonly CapabilityDiscrepancyFact[];
  surfaces: readonly SurfaceDiscrepancyFact[];
}>;

type ControlFileParser<T> = (source: string) => ValidationResult<T>;

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function surfaceKey(
  surface: Readonly<{ identifier: string; path: string }>,
): string {
  return `${surface.identifier}\u0000${surface.path}`;
}

function capabilityOwner(surface?: InstalledSurface): string | undefined {
  return surface?.owner.kind === "capability"
    ? surface.owner.identifier
    : undefined;
}

export function deriveProjectDiscrepancies(
  inspection: ProjectInspection,
): ProjectDiscrepancies {
  if (
    inspection.resolution?.ok !== true ||
    inspection.inference.state.kind !== "valid"
  ) {
    return { capabilities: [], surfaces: [] };
  }

  const installedState = inspection.inference.state.value;
  const desired = new Set(
    inspection.resolution.value.capabilities.map(({ identifier }) => identifier),
  );
  const installed = new Set(
    installedState.installedCapabilities.map(({ identifier }) => identifier),
  );
  const inferenceByIdentifier = new Map(
    inspection.inference.capabilities.map((evidence) => [
      evidence.identifier,
      evidence,
    ]),
  );
  const capabilityIdentifiers = new Set([
    ...desired,
    ...installed,
    ...inferenceByIdentifier.keys(),
  ]);
  const capabilities = [...capabilityIdentifiers]
    .sort(compareText)
    .map((identifier): CapabilityDiscrepancyFact => {
      const inference = inferenceByIdentifier.get(identifier);
      return {
        identifier,
        desired: desired.has(identifier),
        installed: installed.has(identifier),
        descriptorMissing:
          inference?.code === "CAPABILITY_DESCRIPTOR_MISSING",
        ...(inference === undefined
          ? {}
          : { inferenceCategory: inference.category }),
        ...(inference?.code === undefined
          ? {}
          : { inferenceCode: inference.code }),
      };
    })
    .filter(
      ({
        desired: isDesired,
        descriptorMissing,
        inferenceCategory,
        installed: isInstalled,
      }) =>
        descriptorMissing ||
        isDesired !== isInstalled ||
        inferenceCategory === "contradictory" ||
        inferenceCategory === "ambiguous" ||
        ((inferenceCategory === "probable" ||
          inferenceCategory === "partial") &&
          !isInstalled),
    );
  const surfaceByKey = new Map(
    installedState.managedSurfaces.map((surface) => [surfaceKey(surface), surface]),
  );
  const surfaces = inspection.inference.surfaces
    .filter(
      (evidence): evidence is typeof evidence & {
        status: SurfaceDiscrepancyFact["status"];
      } =>
        evidence.status === "missing" ||
        evidence.status === "drifted" ||
        evidence.status === "ambiguous",
    )
    .map((evidence): SurfaceDiscrepancyFact => {
      const capability = capabilityOwner(surfaceByKey.get(surfaceKey(evidence)));
      return {
        identifier: evidence.identifier,
        path: evidence.path,
        status: evidence.status,
        ...(evidence.code === undefined ? {} : { reason: evidence.code }),
        ...(capability === undefined ? {} : { capability }),
      };
    })
    .sort((left, right) => {
      const identifierComparison = compareText(left.identifier, right.identifier);
      return identifierComparison !== 0
        ? identifierComparison
        : compareText(left.path, right.path);
    });

  return { capabilities, surfaces };
}

async function readControlFile<T>(
  reader: RepositoryReader,
  path: string,
  parse: ControlFileParser<T>,
): Promise<ControlFileEvidence<T>> {
  const result = await reader.readText(path);

  switch (result.kind) {
    case "missing":
      return { kind: "missing" };
    case "symlink":
      return { kind: "ambiguous", code: "PATH_SYMLINK" };
    case "error":
      return { kind: "ambiguous", code: result.code };
    case "file": {
      const parsed = parse(result.content);
      return parsed.ok
        ? { kind: "valid", value: parsed.value }
        : { kind: "invalid", issues: parsed.issues };
    }
  }
}

export async function inspectProject(input: Readonly<{
  reader: RepositoryReader;
  catalog: readonly CapabilityDescriptor[];
  profiles: readonly ProfileRecipe[];
}>): Promise<ProjectInspection> {
  const reader = createCachingRepositoryReader(input.reader);
  const project = await readControlFile(
    reader,
    projectConfigurationPath,
    parseProjectYaml,
  );
  const state = await readControlFile(
    reader,
    statePath,
    parseStateJson,
  );
  const migrations = await readControlFile(
    reader,
    migrationLogPath,
    parseMigrationLog,
  );
  const controlInference: RepositoryInference = {
    state,
    capabilities: [],
    surfaces: [],
  };

  if (project.kind !== "valid") {
    return { project, migrations, inference: controlInference };
  }

  const resolution = resolveCapabilities(
    {
      profile: project.value.originProfile,
      requestedCapabilities: project.value.selectedCapabilities,
    },
    input.catalog,
    input.profiles,
  );

  if (
    state.kind !== "valid" ||
    migrations.kind !== "valid" ||
    !resolution.ok
  ) {
    return {
      project,
      migrations,
      inference: controlInference,
      resolution,
    };
  }

  const inference = await inferRepository({ reader, catalog: input.catalog });

  return { project, migrations, inference, resolution };
}
