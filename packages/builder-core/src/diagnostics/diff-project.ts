import type { CapabilityDescriptor } from "../contracts/capability.js";
import type { ProfileRecipe } from "../contracts/profile.js";
import type { RepositoryReader } from "../repository/repository-reader.js";
import {
  deriveProjectDiscrepancies,
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

  const discrepancies = deriveProjectDiscrepancies(inspection);
  const differences: ProjectDifference[] = [];

  for (const fact of discrepancies.capabilities) {
    if (fact.desired && !fact.installed) {
      differences.push(
        difference("desired-only", { capability: fact.identifier }),
      );
    }
    if (!fact.desired && fact.installed) {
      differences.push(
        difference("installed-only", { capability: fact.identifier }),
      );
    }
    if (
      (fact.inferenceCategory === "probable" ||
        fact.inferenceCategory === "partial") &&
      !fact.installed
    ) {
      differences.push(
        difference("inferred-only", { capability: fact.identifier }),
      );
    } else if (
      fact.inferenceCategory === "contradictory" ||
      fact.inferenceCategory === "ambiguous"
    ) {
      differences.push(
        difference("inference-mismatch", { capability: fact.identifier }),
      );
    }
  }

  for (const fact of discrepancies.surfaces) {
    differences.push(
      difference("managed-surface-drift", {
        ...(fact.capability === undefined
          ? {}
          : { capability: fact.capability }),
        path: fact.path,
      }),
    );
  }

  const sortedDifferences = uniqueSortedDifferences(differences);
  return {
    equal: sortedDifferences.length === 0,
    differences: sortedDifferences,
  };
}
