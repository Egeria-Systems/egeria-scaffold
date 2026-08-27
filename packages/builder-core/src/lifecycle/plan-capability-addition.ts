import { createHash } from "node:crypto";

import { createVerifiedCapabilityCatalog, verifiedCapabilityPackageVersions } from "../catalog/verified-package-versions.js";
import type { ManagedSurfaceDescriptor } from "../contracts/capability.js";
import {
  calendlyBookingSettingsSchema,
  type CalendlyBookingSettings,
} from "../contracts/project.js";
import type { ContractIssue } from "../contracts/result.js";
import type { InstalledSurface } from "../contracts/state.js";
import {
  deriveProjectDiscrepancies,
  inspectProject,
  type ProjectInspection,
} from "../diagnostics/project-inspection.js";
import {
  renderSkeleton,
  type GeneratedFile,
  type RenderedSkeleton,
} from "../generation/render-skeleton.js";
import { createBuilderStateSurfaces } from "../generation/builder-state-surfaces.js";
import { profileRecipes } from "../profiles/profile-recipes.js";
import type { RepositoryReader } from "../repository/repository-reader.js";
import { serializeProjectYaml } from "../state/codecs.js";
import { stringifyCanonicalJson } from "../serialization/canonical-json.js";
import type { GitWorktreeInspection } from "./git-worktree-inspection.js";

export type CapabilityAdditionAction = Readonly<{
  kind: "create-file" | "replace-file" | "replace-project-configuration";
  path: string;
  ownership: "managed" | "application-owned";
  owner: string;
}>;

export type CapabilityAdditionPlan = Readonly<{
  operation: "add-capability";
  status: "approval-required";
  planFingerprint: `sha256:${string}`;
  baseRevision: string;
  profile: "portfolio" | "site";
  capability: Readonly<{
    identifier: "booking-calendly" | "multilingual";
    version: "0.1.0";
  }>;
  settings:
    | Readonly<{
        mode: "link" | "inline" | "popup";
        destination: "redacted";
      }>
    | null;
  currentCapabilities: readonly string[];
  desiredCapabilities: readonly string[];
  actions: readonly CapabilityAdditionAction[];
  requiredApprovals: readonly ["transform", "verified-final-diff"];
  persistenceOrder: readonly [
    "transform",
    "verify",
    "re-infer",
    "append-migration-record",
    "persist-state",
    "verify-state-and-inference",
  ];
}>; 

type CapabilityAdditionPlanBody = Omit<
  CapabilityAdditionPlan,
  "planFingerprint"
>;

export type PlanningFailureCode =
  | "PROJECT_INSPECTION_INVALID"
  | "PROJECT_DRIFT_DETECTED"
  | "PROJECT_EJECTION_UNSUPPORTED"
  | "CAPABILITY_ACTION_CONFLICT"
  | "CAPABILITY_ALREADY_INSTALLED"
  | "CAPABILITY_ADDITION_UNSUPPORTED";

type PlanningIssue = Omit<ContractIssue, "code"> &
  Readonly<{ code: PlanningFailureCode }>;

type PlanningResult<T> =
  | Readonly<{ ok: true; value: T }>
  | Readonly<{
      ok: false;
      issues: readonly PlanningIssue[];
    }>;

type ValidInspection = ProjectInspection &
  Readonly<{
    project: Extract<ProjectInspection["project"], Readonly<{ kind: "valid" }>>;
    migrations: Extract<
      ProjectInspection["migrations"],
      Readonly<{ kind: "valid" }>
    >;
    inference: ProjectInspection["inference"] &
      Readonly<{
        state: Extract<
          ProjectInspection["inference"]["state"],
          Readonly<{ kind: "valid" }>
        >;
      }>;
    resolution: Extract<
      NonNullable<ProjectInspection["resolution"]>,
      Readonly<{ ok: true }>
    >;
  }>;

const decoder = new TextDecoder("utf-8", { fatal: true });
const builderOwnedGeneratedDocumentation = new Set([
  "AGENTS.md",
  "README.md",
  "apps/web/AGENTS.md",
]);

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function planningFailure(
  code: PlanningFailureCode,
): PlanningResult<never> {
  const issue: PlanningIssue = {
    code,
    path: [],
    context: { reason: "precondition-refused" },
  };
  return { ok: false, issues: [issue] };
}

function sameOrderedValues(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function fingerprintPlan(input: Readonly<{
  plan: CapabilityAdditionPlanBody;
  settings: CalendlyBookingSettings | null;
  git: Extract<GitWorktreeInspection, Readonly<{ ok: true }>>;
}>): `sha256:${string}` {
  const digest = createHash("sha256")
    .update(
      stringifyCanonicalJson({
        plan: input.plan,
        settings: input.settings,
        gitIdentity: input.git.identity,
      }),
      "utf8",
    )
    .digest("hex");

  return `sha256:${digest}`;
}

function validatedInspection(
  inspection: ProjectInspection,
): ValidInspection | undefined {
  if (
    inspection.project.kind !== "valid" ||
    inspection.migrations.kind !== "valid" ||
    inspection.inference.state.kind !== "valid" ||
    inspection.resolution?.ok !== true
  ) {
    return undefined;
  }

  const project = inspection.project.value;
  const state = inspection.inference.state.value;
  const currentProfile = profileRecipes.find(
    ({ identifier }) => identifier === project.originProfile,
  );
  const migrationIdentifiers = inspection.migrations.value.map(
    ({ identifier }) => identifier,
  );

  if (
    currentProfile?.recipeVersion !== project.recipeVersion ||
    inspection.resolution.value.recipeVersion !== project.recipeVersion ||
    state.origin.profile !== project.originProfile ||
    state.origin.recipeVersion !== project.recipeVersion ||
    !sameOrderedValues(state.appliedMigrations, migrationIdentifiers)
  ) {
    return undefined;
  }

  return inspection as ValidInspection;
}

function hasMaterialDrift(inspection: ValidInspection): boolean {
  const discrepancies = deriveProjectDiscrepancies(inspection);
  const materialCapabilities = discrepancies.capabilities.filter(
    ({ desired, identifier, installed }) =>
      !(
        (identifier === "booking-calendly" || identifier === "multilingual") &&
        !desired &&
        !installed
      ),
  );

  return (
    materialCapabilities.length > 0 ||
    discrepancies.surfaces.length > 0 ||
    inspection.inference.capabilities.some(
      ({ category, identifier }) =>
        identifier !== "booking-calendly" &&
        identifier !== "multilingual" &&
        category !== "confirmed",
    ) ||
    inspection.inference.surfaces.some(
      ({ status }) =>
        status !== "confirmed" && status !== "application-owned" && status !== "ejected",
    )
  );
}

function hasUnsupportedEjection(inspection: ValidInspection): boolean {
  const projectEjections = inspection.project.value.ejectedAreas;
  const stateEjections = inspection.inference.state.value.ejections;

  return (
    projectEjections.length > 0 ||
    stateEjections.length > 0 ||
    inspection.inference.surfaces.some(({ status }) => status === "ejected")
  );
}

async function hasUnavailableApplicationOwnedSurface(
  reader: RepositoryReader,
  rendered: RenderedSkeleton,
): Promise<boolean> {
  const paths = [
    ...new Set(
      rendered.surfaces
        .filter(({ ownership }) => ownership === "application-owned")
        .map(({ path }) => path),
    ),
  ].sort(compareText);

  for (const path of paths) {
    const result = await reader.readText(path);

    if (
      result.kind === "file" ||
      (result.kind === "error" &&
        (result.code === "FILE_ENCODING_INVALID" ||
          result.code === "FILE_TOO_LARGE"))
    ) {
      continue;
    }

    return true;
  }

  return false;
}

function sameSurfaceOwner(
  installed: InstalledSurface["owner"],
  expected: ManagedSurfaceDescriptor["owner"],
): boolean {
  return (
    installed.kind === expected.kind &&
    (installed.kind === "builder-kernel" ||
      (expected.kind === "capability" &&
        installed.identifier === expected.identifier))
  );
}

function sameFingerprintTarget(
  installed: InstalledSurface["fingerprintTarget"],
  expected: ManagedSurfaceDescriptor["fingerprintTarget"],
): boolean {
  return (
    installed.kind === expected.kind &&
    (installed.kind === "file" ||
      (expected.kind === "json-value" &&
        installed.pointer === expected.pointer))
  );
}

function hasSurfaceInventoryDrift(
  installed: readonly InstalledSurface[],
  expected: readonly ManagedSurfaceDescriptor[],
): boolean {
  const installedByIdentifier = new Map(
    installed.map((surface) => [surface.identifier, surface]),
  );

  return (
    installed.length !== expected.length ||
    expected.some((surface) => {
      const installedSurface = installedByIdentifier.get(surface.identifier);

      if (installedSurface === undefined) {
        return true;
      }

      return (
        installedSurface.path !== surface.path ||
        installedSurface.ownership !== surface.ownership ||
        installedSurface.mergeStrategy !== surface.mergeStrategy ||
        !sameSurfaceOwner(installedSurface.owner, surface.owner) ||
        !sameFingerprintTarget(
          installedSurface.fingerprintTarget,
          surface.fingerprintTarget,
        )
      );
    })
  );
}

function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
  return (
    left.length === right.length &&
    left.every((byte, index) => byte === right[index])
  );
}

function actionOwnership(
  rendered: RenderedSkeleton,
  path: string,
): Pick<CapabilityAdditionAction, "owner" | "ownership"> | undefined {
  const fileSurfaces = rendered.surfaces.filter(
    (surface) =>
      surface.path === path && surface.fingerprintTarget.kind === "file",
  );
  const surface = fileSurfaces[0];

  if (fileSurfaces.length === 0 && builderOwnedGeneratedDocumentation.has(path)) {
    return { ownership: "application-owned", owner: "builder-kernel" };
  }

  if (
    fileSurfaces.length !== 1 ||
    surface === undefined
  ) {
    return undefined;
  }

  return {
    ownership:
      surface.ownership === "application-owned"
        ? "application-owned"
        : "managed",
    owner:
      surface.owner.kind === "builder-kernel"
        ? "builder-kernel"
        : surface.owner.identifier,
  };
}

function changedFiles(
  current: RenderedSkeleton,
  desired: RenderedSkeleton,
):
  | Readonly<{
      created: readonly GeneratedFile[];
      replaced: readonly Readonly<{
        current: GeneratedFile;
        desired: GeneratedFile;
      }>[];
    }>
  | undefined {
  const currentFiles = new Map(current.files.map((file) => [file.path, file]));
  const desiredPaths = new Set(desired.files.map(({ path }) => path));

  if (current.files.some(({ path }) => !desiredPaths.has(path))) {
    return undefined;
  }

  const created: GeneratedFile[] = [];
  const replaced: Readonly<{
    current: GeneratedFile;
    desired: GeneratedFile;
  }>[] = [];

  for (const desiredFile of desired.files) {
    const currentFile = currentFiles.get(desiredFile.path);

    if (currentFile === undefined) {
      created.push(desiredFile);
    } else if (!sameBytes(currentFile.content, desiredFile.content)) {
      replaced.push({ current: currentFile, desired: desiredFile });
    }
  }

  return { created, replaced };
}

async function deriveActions(input: Readonly<{
  reader: RepositoryReader;
  current: RenderedSkeleton;
  desired: RenderedSkeleton;
}>): Promise<PlanningResult<readonly CapabilityAdditionAction[]>> {
  const differences = changedFiles(input.current, input.desired);

  if (differences === undefined) {
    return planningFailure("PROJECT_INSPECTION_INVALID");
  }

  const actions: CapabilityAdditionAction[] = [
    {
      kind: "replace-project-configuration",
      path: ".egeria/project.yaml",
      ownership: "managed",
      owner: "builder-kernel",
    },
  ];

  for (const file of differences.created) {
    const availability = await input.reader.readText(file.path);

    if (availability.kind !== "missing") {
      return planningFailure("CAPABILITY_ACTION_CONFLICT");
    }

    const ownership = actionOwnership(input.desired, file.path);

    if (ownership === undefined) {
      return planningFailure("PROJECT_INSPECTION_INVALID");
    }

    actions.push({ kind: "create-file", path: file.path, ...ownership });
  }

  for (const pair of differences.replaced) {
    const current = await input.reader.readText(pair.current.path);
    let expected: string;

    try {
      expected = decoder.decode(pair.current.content);
    } catch {
      return planningFailure("PROJECT_INSPECTION_INVALID");
    }

    if (current.kind !== "file" || current.content !== expected) {
      return planningFailure("PROJECT_DRIFT_DETECTED");
    }

    const ownership = actionOwnership(input.desired, pair.desired.path);

    if (ownership === undefined) {
      return planningFailure("PROJECT_INSPECTION_INVALID");
    }

    actions.push({ kind: "replace-file", path: pair.desired.path, ...ownership });
  }

  return {
    ok: true,
    value: actions.sort((left, right) => {
      const pathComparison = compareText(left.path, right.path);
      return pathComparison === 0
        ? compareText(left.kind, right.kind)
        : pathComparison;
    }),
  };
}

async function planCapabilityAdditionUnchecked(input: Readonly<{
  reader: RepositoryReader;
  git: Extract<GitWorktreeInspection, Readonly<{ ok: true }>>;
  capability: "booking-calendly" | "multilingual";
  settings?: CalendlyBookingSettings;
}>): Promise<PlanningResult<CapabilityAdditionPlan>> {
  const capabilityValue: unknown = Reflect.get(input, "capability");

  if (
    capabilityValue !== "booking-calendly" &&
    capabilityValue !== "multilingual"
  ) {
    return planningFailure("CAPABILITY_ADDITION_UNSUPPORTED");
  }

  const settingsResult = capabilityValue === "booking-calendly"
    ? calendlyBookingSettingsSchema.safeParse(input.settings)
    : undefined;
  if (
    (settingsResult !== undefined && !settingsResult.success) ||
    (capabilityValue === "multilingual" && input.settings !== undefined)
  ) {
    return planningFailure("CAPABILITY_ADDITION_UNSUPPORTED");
  }

  const catalogResult = createVerifiedCapabilityCatalog();

  if (!catalogResult.ok) {
    return planningFailure("PROJECT_INSPECTION_INVALID");
  }

  const inspection = validatedInspection(
    await inspectProject({
      reader: input.reader,
      catalog: catalogResult.value,
      profiles: profileRecipes,
    }),
  );

  if (inspection === undefined) {
    return planningFailure("PROJECT_INSPECTION_INVALID");
  }

  if (hasMaterialDrift(inspection)) {
    return planningFailure("PROJECT_DRIFT_DETECTED");
  }

  if (hasUnsupportedEjection(inspection)) {
    return planningFailure("PROJECT_EJECTION_UNSUPPORTED");
  }

  const project = inspection.project.value;
  const state = inspection.inference.state.value;
  const capabilityInstalled =
    project.selectedCapabilities.includes(capabilityValue) ||
    state.installedCapabilities.some(
      ({ identifier }) => identifier === capabilityValue,
    );

  if (capabilityInstalled) {
    return planningFailure("CAPABILITY_ALREADY_INSTALLED");
  }

  const renderRequest = {
    profile: project.originProfile,
    projectName: project.project.name,
    displayName: project.project.displayName,
    ...(project.capabilitySettings["booking-calendly"] === undefined
      ? {}
      : { bookingCalendly: project.capabilitySettings["booking-calendly"] }),
    ...(project.selectedCapabilities.includes("multilingual")
      ? { multilingual: true as const }
      : {}),
    packageVersions: verifiedCapabilityPackageVersions,
  } as const;
  const currentResult = await renderSkeleton(renderRequest);

  if (!currentResult.ok) {
    return planningFailure("PROJECT_INSPECTION_INVALID");
  }

  if (
    hasSurfaceInventoryDrift(
      state.managedSurfaces,
      [
        ...currentResult.value.surfaces,
        ...createBuilderStateSurfaces(),
      ],
    ) ||
    await hasUnavailableApplicationOwnedSurface(
      input.reader,
      currentResult.value,
    )
  ) {
    return planningFailure("PROJECT_DRIFT_DETECTED");
  }

  const descriptor = catalogResult.value.find(
    ({ identifier }) => identifier === capabilityValue,
  );

  if (descriptor?.version !== "0.1.0") {
    return planningFailure("PROJECT_INSPECTION_INVALID");
  }

  const desiredResult = await renderSkeleton({
    ...renderRequest,
    ...(capabilityValue === "booking-calendly" && settingsResult?.success === true
      ? { bookingCalendly: settingsResult.data }
      : { multilingual: true as const }),
  });

  if (!desiredResult.ok) {
    return planningFailure("PROJECT_INSPECTION_INVALID");
  }

  const currentConfiguration = await input.reader.readText(
    ".egeria/project.yaml",
  );

  if (
    currentConfiguration.kind !== "file" ||
    currentConfiguration.content !== serializeProjectYaml(project)
  ) {
    return planningFailure("PROJECT_DRIFT_DETECTED");
  }

  const actionResult = await deriveActions({
    reader: input.reader,
    current: currentResult.value,
    desired: desiredResult.value,
  });

  if (!actionResult.ok) {
    return actionResult;
  }

  const currentCapabilities = inspection.resolution.value.capabilities
    .map(({ identifier }) => identifier)
    .sort(compareText);
  const desiredCapabilities = desiredResult.value.resolved.capabilities
    .map(({ identifier }) => identifier)
    .sort(compareText);

  const plan: CapabilityAdditionPlanBody = {
      operation: "add-capability",
      status: "approval-required",
      baseRevision: input.git.identity.revision,
      profile: project.originProfile,
      capability: {
        identifier: capabilityValue,
        version: descriptor.version,
      },
      settings:
        settingsResult?.success === true
          ? {
              mode: settingsResult.data.mode,
              destination: "redacted",
            }
          : null,
      currentCapabilities,
      desiredCapabilities,
      actions: actionResult.value,
      requiredApprovals: ["transform", "verified-final-diff"],
      persistenceOrder: [
        "transform",
        "verify",
        "re-infer",
        "append-migration-record",
        "persist-state",
        "verify-state-and-inference",
      ],
  };

  return {
    ok: true,
    value: {
      ...plan,
      planFingerprint: fingerprintPlan({
        plan,
        settings: settingsResult?.success === true ? settingsResult.data : null,
        git: input.git,
      }),
    },
  };
}

export async function planCapabilityAddition(input: Readonly<{
  reader: RepositoryReader;
  git: Extract<GitWorktreeInspection, Readonly<{ ok: true }>>;
  capability: "booking-calendly" | "multilingual";
  settings?: CalendlyBookingSettings;
}>): Promise<PlanningResult<CapabilityAdditionPlan>> {
  return planCapabilityAdditionUnchecked(input);
}
