import type { CapabilityDescriptor } from "../contracts/capability.js";
import type { ProfileRecipe } from "../contracts/profile.js";
import type { ContractIssue } from "../contracts/result.js";
import type { InstalledSurface } from "../contracts/state.js";
import type { RepositoryStateEvidence } from "../inference/infer-repository.js";
import type { RepositoryReader } from "../repository/repository-reader.js";
import {
  inspectProject,
  migrationLogPath,
  projectConfigurationPath,
  statePath,
  type ControlFileEvidence,
  type ProjectInspection,
} from "./project-inspection.js";

export type DiagnosticSeverity = "error" | "warning" | "info";

type DiagnosticCode =
  | "PROJECT_INVALID"
  | "STATE_INVALID"
  | "MIGRATION_LOG_INVALID"
  | "BUILDER_VERSION_INCOMPATIBLE"
  | "PROJECT_CAPABILITY_UNKNOWN"
  | "STATE_CAPABILITY_UNKNOWN"
  | "DESIRED_INSTALLED_MISMATCH"
  | "INSTALLED_INFERENCE_CONTRADICTION"
  | "INFERENCE_AMBIGUOUS"
  | "MANAGED_SURFACE_DRIFT";

export type Diagnostic = Readonly<{
  code: DiagnosticCode;
  severity: DiagnosticSeverity;
  capability?: string;
  path?: string;
  context: Readonly<Record<string, string>>;
}>;

type DoctorRepositoryRequest = Readonly<{
  reader: RepositoryReader;
  catalog: readonly CapabilityDescriptor[];
  profiles: readonly ProfileRecipe[];
}>;

type DoctorResult = Readonly<{
  healthy: boolean;
  diagnostics: readonly Diagnostic[];
}>;

const severityRank: Readonly<Record<DiagnosticSeverity, number>> = {
  error: 0,
  warning: 1,
  info: 2,
};

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function compareOptionalText(left?: string, right?: string): number {
  return compareText(left ?? "", right ?? "");
}

function compareDiagnostics(left: Diagnostic, right: Diagnostic): number {
  const severityComparison = severityRank[left.severity] - severityRank[right.severity];

  if (severityComparison !== 0) {
    return severityComparison;
  }

  const codeComparison = compareText(left.code, right.code);
  if (codeComparison !== 0) {
    return codeComparison;
  }

  const capabilityComparison = compareOptionalText(
    left.capability,
    right.capability,
  );
  if (capabilityComparison !== 0) {
    return capabilityComparison;
  }

  const pathComparison = compareOptionalText(left.path, right.path);
  return pathComparison !== 0
    ? pathComparison
    : compareText(JSON.stringify(left.context), JSON.stringify(right.context));
}

function diagnostic(
  code: DiagnosticCode,
  severity: DiagnosticSeverity,
  input: Readonly<{
    capability?: string;
    path?: string;
    context?: Readonly<Record<string, string>>;
  }> = {},
): Diagnostic {
  return {
    code,
    severity,
    ...(input.capability === undefined ? {} : { capability: input.capability }),
    ...(input.path === undefined ? {} : { path: input.path }),
    context: input.context ?? {},
  };
}

function issueBeginsAt(issue: ContractIssue, field: string): boolean {
  return issue.path[0] === field;
}

function invalidControlDiagnostics(
  evidence: ControlFileEvidence<unknown> | RepositoryStateEvidence,
  input: Readonly<{
    code: "PROJECT_INVALID" | "STATE_INVALID" | "MIGRATION_LOG_INVALID";
    path: string;
    versionField?: "builderCompatibility" | "builderVersion";
    versionReason?: "project-builder-compatibility" | "state-builder-version";
  }>,
): readonly Diagnostic[] {
  switch (evidence.kind) {
    case "valid":
      return [];
    case "missing":
      return [
        diagnostic(input.code, "error", {
          path: input.path,
          context: { reason: "missing" },
        }),
      ];
    case "ambiguous":
      return [
        diagnostic(input.code, "error", {
          path: input.path,
          context: { reason: evidence.code },
        }),
      ];
    case "invalid": {
      const versionField = input.versionField;
      const hasVersionIssue =
        versionField !== undefined &&
        evidence.issues.some((issue) => issueBeginsAt(issue, versionField));
      const hasOtherIssue = evidence.issues.some(
        (issue) =>
          versionField === undefined || !issueBeginsAt(issue, versionField),
      );
      return [
        ...(hasVersionIssue && input.versionReason !== undefined
          ? [
              diagnostic("BUILDER_VERSION_INCOMPATIBLE", "error", {
                path: input.path,
                context: { reason: input.versionReason },
              }),
            ]
          : []),
        ...(hasOtherIssue
          ? [
              diagnostic(input.code, "error", {
                path: input.path,
                context: { reason: "invalid" },
              }),
            ]
          : []),
      ];
    }
  }
}

function controlDiagnostics(
  inspection: ProjectInspection,
): readonly Diagnostic[] {
  return [
    ...invalidControlDiagnostics(inspection.project, {
      code: "PROJECT_INVALID",
      path: projectConfigurationPath,
      versionField: "builderCompatibility",
      versionReason: "project-builder-compatibility",
    }),
    ...invalidControlDiagnostics(inspection.inference.state, {
      code: "STATE_INVALID",
      path: statePath,
      versionField: "builderVersion",
      versionReason: "state-builder-version",
    }),
    ...invalidControlDiagnostics(inspection.migrations, {
      code: "MIGRATION_LOG_INVALID",
      path: migrationLogPath,
    }),
  ];
}

function surfaceKey(surface: Readonly<{ identifier: string; path: string }>): string {
  return `${surface.identifier}\u0000${surface.path}`;
}

function capabilityOwner(surface?: InstalledSurface): string | undefined {
  return surface?.owner.kind === "capability"
    ? surface.owner.identifier
    : undefined;
}

function uniqueSortedDiagnostics(
  diagnostics: readonly Diagnostic[],
): readonly Diagnostic[] {
  const unique = new Map<string, Diagnostic>();

  for (const item of diagnostics) {
    const key = JSON.stringify([
      item.severity,
      item.code,
      item.capability ?? "",
      item.path ?? "",
      item.context,
    ]);
    unique.set(key, item);
  }

  return [...unique.values()].sort(compareDiagnostics);
}

function resolvedDiagnostics(inspection: ProjectInspection): readonly Diagnostic[] {
  if (inspection.resolution?.ok !== true) {
    return [];
  }

  const state = inspection.inference.state;
  if (state.kind !== "valid") {
    return [];
  }

  const desired = new Set(
    inspection.resolution.value.capabilities.map(({ identifier }) => identifier),
  );
  const installed = new Set(
    state.value.installedCapabilities.map(({ identifier }) => identifier),
  );
  const unknownStateCapabilities = new Set(
    inspection.inference.capabilities
      .filter(({ code }) => code === "CAPABILITY_DESCRIPTOR_MISSING")
      .map(({ identifier }) => identifier),
  );
  const diagnostics: Diagnostic[] = [];

  for (const identifier of [...unknownStateCapabilities].sort(compareText)) {
    diagnostics.push(
      diagnostic("STATE_CAPABILITY_UNKNOWN", "error", {
        capability: identifier,
        path: statePath,
      }),
    );
  }

  for (const identifier of [...new Set([...desired, ...installed])].sort(compareText)) {
    if (unknownStateCapabilities.has(identifier)) {
      continue;
    }

    if (desired.has(identifier) && !installed.has(identifier)) {
      diagnostics.push(
        diagnostic("DESIRED_INSTALLED_MISMATCH", "error", {
          capability: identifier,
          context: { relation: "desired-only" },
        }),
      );
    } else if (!desired.has(identifier) && installed.has(identifier)) {
      diagnostics.push(
        diagnostic("DESIRED_INSTALLED_MISMATCH", "error", {
          capability: identifier,
          context: { relation: "installed-only" },
        }),
      );
    }
  }

  for (const evidence of inspection.inference.capabilities) {
    if (unknownStateCapabilities.has(evidence.identifier)) {
      continue;
    }

    if (evidence.category === "contradictory") {
      diagnostics.push(
        diagnostic("INSTALLED_INFERENCE_CONTRADICTION", "error", {
          capability: evidence.identifier,
          context: { category: evidence.category },
        }),
      );
    } else if (
      (evidence.category === "probable" || evidence.category === "partial") &&
      !installed.has(evidence.identifier)
    ) {
      diagnostics.push(
        diagnostic("INSTALLED_INFERENCE_CONTRADICTION", "warning", {
          capability: evidence.identifier,
          context: { category: evidence.category },
        }),
      );
    } else if (evidence.category === "ambiguous") {
      diagnostics.push(
        diagnostic("INFERENCE_AMBIGUOUS", "warning", {
          capability: evidence.identifier,
          context: { category: evidence.category },
        }),
      );
    }
  }

  const surfaceByKey = new Map(
    state.value.managedSurfaces.map((surface) => [surfaceKey(surface), surface]),
  );

  for (const evidence of inspection.inference.surfaces) {
    const surface = surfaceByKey.get(surfaceKey(evidence));
    const capability = capabilityOwner(surface);

    if (evidence.status === "missing" || evidence.status === "drifted") {
      diagnostics.push(
        diagnostic("MANAGED_SURFACE_DRIFT", "warning", {
          ...(capability === undefined ? {} : { capability }),
          path: evidence.path,
          context: { status: evidence.status },
        }),
      );
    } else if (evidence.status === "ambiguous") {
      diagnostics.push(
        diagnostic("INFERENCE_AMBIGUOUS", "warning", {
          ...(capability === undefined ? {} : { capability }),
          path: evidence.path,
          context: { reason: evidence.code ?? "ambiguous" },
        }),
      );
    }
  }

  return diagnostics;
}

export async function doctorRepository(
  input: DoctorRepositoryRequest,
): Promise<DoctorResult> {
  const inspection = await inspectProject(input);
  const controls = controlDiagnostics(inspection);

  if (controls.length > 0) {
    const diagnostics = uniqueSortedDiagnostics(controls);
    return { healthy: diagnostics.length === 0, diagnostics };
  }

  if (inspection.resolution?.ok !== true) {
    const unknown = inspection.resolution?.issues.find(
      ({ code }) => code === "CAPABILITY_UNKNOWN",
    );
    const capability = unknown?.context.identifier;
    const diagnostics = uniqueSortedDiagnostics([
      capability === undefined
        ? diagnostic("PROJECT_INVALID", "error", {
            path: projectConfigurationPath,
            context: { reason: "desired-resolution" },
          })
        : diagnostic("PROJECT_CAPABILITY_UNKNOWN", "error", {
            capability,
            path: projectConfigurationPath,
          }),
    ]);
    return { healthy: false, diagnostics };
  }

  const diagnostics = uniqueSortedDiagnostics(resolvedDiagnostics(inspection));
  return { healthy: diagnostics.length === 0, diagnostics };
}
