import type { CapabilityDescriptor } from "../contracts/capability.js";
import type { ProfileRecipe } from "../contracts/profile.js";
import type { InstalledSurface } from "../contracts/state.js";
import type { RepositoryReader } from "../repository/repository-reader.js";
import {
  inspectProject,
  migrationLogPath,
  projectConfigurationPath,
  statePath,
} from "./project-inspection.js";

export type ProjectDifference = Readonly<{
  kind:
    | "control-file-invalid"
    | "desired-only"
    | "installed-only"
    | "inferred-only"
    | "inference-mismatch"
    | "managed-surface-drift";
  capability?: string;
  path?: string;
}>;

type DiffProjectRequest = Readonly<{
  reader: RepositoryReader;
  catalog: readonly CapabilityDescriptor[];
  profiles: readonly ProfileRecipe[];
}>;

type ProjectDiff = Readonly<{
  equal: boolean;
  differences: readonly ProjectDifference[];
}>;

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function compareDifferences(
  left: ProjectDifference,
  right: ProjectDifference,
): number {
  const kindComparison = compareText(left.kind, right.kind);
  if (kindComparison !== 0) {
    return kindComparison;
  }

  const capabilityComparison = compareText(
    left.capability ?? "",
    right.capability ?? "",
  );
  return capabilityComparison !== 0
    ? capabilityComparison
    : compareText(left.path ?? "", right.path ?? "");
}

function difference(
  kind: ProjectDifference["kind"],
  input: Readonly<{ capability?: string; path?: string }> = {},
): ProjectDifference {
  return {
    kind,
    ...(input.capability === undefined ? {} : { capability: input.capability }),
    ...(input.path === undefined ? {} : { path: input.path }),
  };
}

function uniqueSortedDifferences(
  differences: readonly ProjectDifference[],
): readonly ProjectDifference[] {
  const unique = new Map<string, ProjectDifference>();

  for (const item of differences) {
    const key = JSON.stringify([
      item.kind,
      item.capability ?? "",
      item.path ?? "",
    ]);
    unique.set(key, item);
  }

  return [...unique.values()].sort(compareDifferences);
}

function surfaceKey(surface: Readonly<{ identifier: string; path: string }>): string {
  return `${surface.identifier}\u0000${surface.path}`;
}

function capabilityOwner(surface?: InstalledSurface): string | undefined {
  return surface?.owner.kind === "capability"
    ? surface.owner.identifier
    : undefined;
}

export async function diffProject(
  input: DiffProjectRequest,
): Promise<ProjectDiff> {
  const inspection = await inspectProject(input);
  const invalidControlPaths = [
    ...(inspection.project.kind === "valid" ? [] : [projectConfigurationPath]),
    ...(inspection.inference.state.kind === "valid" ? [] : [statePath]),
    ...(inspection.migrations.kind === "valid" ? [] : [migrationLogPath]),
    ...(inspection.project.kind === "valid" &&
    inspection.resolution?.ok !== true
      ? [projectConfigurationPath]
      : []),
  ];

  if (invalidControlPaths.length > 0) {
    const differences = uniqueSortedDifferences(
      invalidControlPaths.map((path) =>
        difference("control-file-invalid", { path }),
      ),
    );
    return { equal: differences.length === 0, differences };
  }

  if (
    inspection.resolution?.ok !== true ||
    inspection.inference.state.kind !== "valid"
  ) {
    return { equal: true, differences: [] };
  }

  const installedState = inspection.inference.state.value;
  const desired = new Set(
    inspection.resolution.value.capabilities.map(({ identifier }) => identifier),
  );
  const installed = new Set(
    installedState.installedCapabilities.map(({ identifier }) => identifier),
  );
  const differences: ProjectDifference[] = [];

  for (const identifier of [...desired].sort(compareText)) {
    if (!installed.has(identifier)) {
      differences.push(difference("desired-only", { capability: identifier }));
    }
  }

  for (const identifier of [...installed].sort(compareText)) {
    if (!desired.has(identifier)) {
      differences.push(difference("installed-only", { capability: identifier }));
    }
  }

  for (const evidence of inspection.inference.capabilities) {
    if (
      (evidence.category === "probable" || evidence.category === "partial") &&
      !installed.has(evidence.identifier)
    ) {
      differences.push(
        difference("inferred-only", { capability: evidence.identifier }),
      );
    } else if (
      evidence.category === "contradictory" ||
      evidence.category === "ambiguous"
    ) {
      differences.push(
        difference("inference-mismatch", { capability: evidence.identifier }),
      );
    }
  }

  const surfaceByKey = new Map(
    installedState.managedSurfaces.map((surface) => [surfaceKey(surface), surface]),
  );

  for (const evidence of inspection.inference.surfaces) {
    if (
      evidence.status !== "missing" &&
      evidence.status !== "drifted" &&
      evidence.status !== "ambiguous"
    ) {
      continue;
    }

    const capability = capabilityOwner(surfaceByKey.get(surfaceKey(evidence)));
    differences.push(
      difference("managed-surface-drift", {
        ...(capability === undefined ? {} : { capability }),
        path: evidence.path,
      }),
    );
  }

  const sortedDifferences = uniqueSortedDifferences(differences);
  return {
    equal: sortedDifferences.length === 0,
    differences: sortedDifferences,
  };
}
