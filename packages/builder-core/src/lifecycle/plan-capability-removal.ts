import { createHash } from "node:crypto";

import {
  createVerifiedCapabilityCatalog,
  verifiedCapabilityPackageVersions,
} from "../catalog/verified-package-versions.js";
import type {
  CapabilityDescriptor,
  ManagedSurfaceDescriptor,
} from "../contracts/capability.js";
import type { ContractIssue } from "../contracts/result.js";
import type { InstalledState, InstalledSurface } from "../contracts/state.js";
import {
  deriveProjectDiscrepancies,
  inspectProject,
  type ProjectInspection,
} from "../diagnostics/project-inspection.js";
import { createBuilderStateSurfaces } from "../generation/builder-state-surfaces.js";
import {
  renderSkeleton,
  type GeneratedFile,
  type RenderedSkeleton,
} from "../generation/render-skeleton.js";
import { fingerprintFileContent } from "../ownership/fingerprint.js";
import { profileRecipes } from "../profiles/profile-recipes.js";
import type { RepositoryReader } from "../repository/repository-reader.js";
import { stringifyCanonicalJson } from "../serialization/canonical-json.js";
import { serializeProjectYaml } from "../state/codecs.js";
import {
  guardCapabilityRemovalReferences,
  type CapabilityRemovalReferenceWarning,
} from "./capability-removal-reference-guard.js";
import {
  inspectGitRepositoryInventory,
  type GitWorktreeInspection,
} from "./git-worktree-inspection.js";

export type CapabilityRemovalAction = Readonly<{
  kind:
    | "delete-file"
    | "preserve-file-and-eject"
    | "replace-file"
    | "replace-project-configuration";
  path: string;
  ownership: "application-owned" | "ejected" | "managed";
  owner:
    | "analytics"
    | "booking-calendly"
    | "builder-kernel"
    | "multilingual"
    | "observability"
    | "standards"
    | "site-routing";
}>;

export type CapabilityRemovalReviewRequirement =
  | Readonly<{
      code: "review-surviving-references-to-removed-surfaces";
      scope: "repository";
    }>
  | Readonly<{
      code: "reconcile-preserved-capability-surfaces";
      paths: readonly string[];
    }>
  | Readonly<{
      code: "review-analytics-provider-and-client-storage-disposition";
      scope: "provider-accounts-retained-data-browser-storage-and-cookies";
    }>
  | Readonly<{
      code: "review-capability-removal-reference-warnings";
      warnings: readonly CapabilityRemovalReferenceWarning[];
    }>;

export type CapabilityRemovalPlan = Readonly<{
  operation: "remove-capability";
  status: "approval-required";
  planFingerprint: `sha256:${string}`;
  baseRevision: string;
  profile: "portfolio" | "site";
  capability: Readonly<{
    identifier: "analytics" | "booking-calendly" | "multilingual";
    version: "0.1.0";
  }>;
  currentCapabilities: readonly string[];
  desiredCapabilities: readonly string[];
  actions: readonly CapabilityRemovalAction[];
  reviewRequirements: readonly CapabilityRemovalReviewRequirement[];
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

type CapabilityRemovalPlanBody = Omit<
  CapabilityRemovalPlan,
  "planFingerprint"
>;

export type CapabilityRemovalPlanningFailureCode =
  | "PROJECT_INSPECTION_INVALID"
  | "PROJECT_DRIFT_DETECTED"
  | "PROJECT_EJECTION_INVALID"
  | "CAPABILITY_NOT_INSTALLED"
  | "CAPABILITY_REMOVAL_INVENTORY_INVALID"
  | "CAPABILITY_REMOVAL_REFERENCE_CONFLICT"
  | "CAPABILITY_REMOVAL_UNSUPPORTED";

type PlanningIssue = Omit<ContractIssue, "code"> &
  Readonly<{ code: CapabilityRemovalPlanningFailureCode }>;

type PlanningResult<T> =
  | Readonly<{ ok: true; value: T }>
  | Readonly<{ ok: false; issues: readonly PlanningIssue[] }>;

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

const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });
const removalReferenceTokens = {
  analytics: "analytics",
  "booking-calendly": "calendly",
  multilingual: "multilingual",
} as const;

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function planningFailure(
  code: CapabilityRemovalPlanningFailureCode,
): PlanningResult<never> {
  return {
    ok: false,
    issues: [
      {
        code,
        path: [],
        context: { reason: "precondition-refused" },
      },
    ],
  };
}

function referenceConflict(
  paths: readonly string[],
): PlanningResult<never> {
  return {
    ok: false,
    issues: paths.map((path) => ({
      code: "CAPABILITY_REMOVAL_REFERENCE_CONFLICT",
      path: [path],
      context: { reason: "surviving-reference" },
    })),
  };
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

function matchesSurfaceDescriptor(
  installed: InstalledSurface,
  expected: ManagedSurfaceDescriptor,
): boolean {
  return (
    installed.path === expected.path &&
    installed.mergeStrategy === expected.mergeStrategy &&
    sameSurfaceOwner(installed.owner, expected.owner) &&
    sameFingerprintTarget(
      installed.fingerprintTarget,
      expected.fingerprintTarget,
    )
  );
}

function ejectionPathsAreValid(state: InstalledState, projectPaths: readonly string[]): boolean {
  if (!sameOrderedValues(projectPaths, state.ejections)) {
    return false;
  }

  const ejectionSet = new Set(projectPaths);
  const ejectedSurfacePaths = new Set(
    state.managedSurfaces
      .filter(({ ownership }) => ownership === "ejected")
      .map(({ path }) => path),
  );

  if (
    ejectionSet.size !== projectPaths.length ||
    ejectedSurfacePaths.size !== ejectionSet.size ||
    [...ejectionSet].some((path) => !ejectedSurfacePaths.has(path))
  ) {
    return false;
  }

  return state.managedSurfaces.every((surface) =>
    surface.ownership === "ejected"
      ? ejectionSet.has(surface.path)
      : !ejectionSet.has(surface.path),
  );
}

function hasSurfaceInventoryDrift(
  installed: readonly InstalledSurface[],
  expected: readonly ManagedSurfaceDescriptor[],
  ejections: ReadonlySet<string>,
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

      const ownershipMatches =
        installedSurface.ownership === surface.ownership ||
        (surface.ownership === "application-owned" &&
          installedSurface.ownership === "ejected" &&
          ejections.has(surface.path));

      return (
        !matchesSurfaceDescriptor(installedSurface, surface) ||
        !ownershipMatches
      );
    })
  );
}

function isValidRemovedCapabilityState(input: Readonly<{
  state: InstalledState;
  descriptor: CapabilityDescriptor;
  inferred: ValidInspection["inference"]["capabilities"][number] | undefined;
  ejections: ReadonlySet<string>;
  capability: "analytics" | "booking-calendly" | "multilingual";
}>): boolean {
  const expectedByIdentifier = new Map(
    input.descriptor.managedSurfaces.map((surface) => [
      surface.identifier,
      surface,
    ]),
  );
  const ownedSurfaces = input.state.managedSurfaces.filter(
    ({ owner }) =>
      owner.kind === "capability" && owner.identifier === input.capability,
  );
  const preservedPaths = new Set<string>();

  for (const surface of ownedSurfaces) {
    const expected = expectedByIdentifier.get(surface.identifier);

    if (
      surface.ownership !== "ejected" ||
      !input.ejections.has(surface.path) ||
      expected?.ownership !== "application-owned" ||
      !matchesSurfaceDescriptor(surface, expected)
    ) {
      return false;
    }

    preservedPaths.add(surface.path);
  }

  return (
    input.inferred === undefined ||
    input.inferred.probes.every(
      (probe) => preservedPaths.has(probe.path) || probe.status === "missing",
    )
  );
}

async function hasUnavailableApplicationOwnedSurface(input: Readonly<{
  reader: RepositoryReader;
  rendered: RenderedSkeleton;
  state: InstalledState;
}>): Promise<boolean> {
  const installedByIdentifier = new Map(
    input.state.managedSurfaces.map((surface) => [surface.identifier, surface]),
  );
  const paths = input.rendered.surfaces
    .filter(
      (surface) =>
        surface.ownership === "application-owned" &&
        installedByIdentifier.get(surface.identifier)?.ownership !== "ejected",
    )
    .map(({ path }) => path)
    .sort(compareText);

  for (const path of new Set(paths)) {
    const result = await input.reader.readText(path);

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

function hasMaterialDrift(inspection: ValidInspection): boolean {
  const discrepancies = deriveProjectDiscrepancies(inspection);

  return (
    discrepancies.capabilities.length > 0 ||
    discrepancies.surfaces.length > 0 ||
    inspection.inference.capabilities.some(
      ({ category }) => category !== "confirmed",
    ) ||
    inspection.inference.surfaces.some(
      ({ status }) =>
        status !== "confirmed" &&
        status !== "application-owned" &&
        status !== "ejected",
    )
  );
}

function actionOwner(
  surface: ManagedSurfaceDescriptor,
): CapabilityRemovalAction["owner"] | undefined {
  if (surface.owner.kind === "builder-kernel") {
    return "builder-kernel";
  }

  return [
    "analytics",
    "booking-calendly",
    "multilingual",
    "observability",
    "site-routing",
    "standards",
  ].includes(
    surface.owner.identifier,
  )
    ? surface.owner.identifier as CapabilityRemovalAction["owner"]
    : undefined;
}

function fileSurfaceForPath(
  rendered: RenderedSkeleton,
  path: string,
): ManagedSurfaceDescriptor | undefined {
  const candidates = rendered.surfaces.filter(
    (surface) =>
      surface.path === path && surface.fingerprintTarget.kind === "file",
  );

  return candidates.length === 1 ? candidates[0] : undefined;
}

function installedSurfaceForDescriptor(
  installed: readonly InstalledSurface[],
  descriptor: ManagedSurfaceDescriptor,
): InstalledSurface | undefined {
  return installed.find(
    ({ identifier }) => identifier === descriptor.identifier,
  );
}

function changedFiles(
  current: RenderedSkeleton,
  desired: RenderedSkeleton,
): Readonly<{
  removed: readonly GeneratedFile[];
  replaced: readonly Readonly<{
    current: GeneratedFile;
    desired: GeneratedFile;
  }>[];
}> | undefined {
  const currentFiles = new Map(current.files.map((file) => [file.path, file]));
  const desiredFiles = new Map(desired.files.map((file) => [file.path, file]));
  const removed: GeneratedFile[] = [];
  const replaced: Readonly<{
    current: GeneratedFile;
    desired: GeneratedFile;
  }>[] = [];

  for (const desiredFile of desired.files) {
    const currentFile = currentFiles.get(desiredFile.path);

    if (currentFile === undefined) {
      return undefined;
    }

    if (fingerprintFileContent(currentFile.content) !== fingerprintFileContent(desiredFile.content)) {
      replaced.push({ current: currentFile, desired: desiredFile });
    }
  }

  for (const currentFile of current.files) {
    if (!desiredFiles.has(currentFile.path)) {
      removed.push(currentFile);
    }
  }

  return { removed, replaced };
}

function renderedText(file: GeneratedFile): string | undefined {
  try {
    return decoder.decode(file.content);
  } catch {
    return undefined;
  }
}

async function deriveActions(input: Readonly<{
  reader: RepositoryReader;
  current: RenderedSkeleton;
  desired: RenderedSkeleton;
  state: InstalledState;
  capability: "analytics" | "booking-calendly" | "multilingual";
}>): Promise<PlanningResult<readonly CapabilityRemovalAction[]>> {
  const differences = changedFiles(input.current, input.desired);

  if (differences === undefined) {
    return planningFailure("PROJECT_INSPECTION_INVALID");
  }

  const actions: CapabilityRemovalAction[] = [
    {
      kind: "replace-project-configuration",
      path: ".egeria/project.yaml",
      ownership: "managed",
      owner: "builder-kernel",
    },
  ];

  for (const pair of differences.replaced) {
    const descriptor = fileSurfaceForPath(input.current, pair.current.path);
    const installed = descriptor === undefined
      ? undefined
      : installedSurfaceForDescriptor(input.state.managedSurfaces, descriptor);
    const owner = descriptor === undefined ? undefined : actionOwner(descriptor);
    const expectedText = renderedText(pair.current);
    const current = await input.reader.readText(pair.current.path);

    if (
      descriptor === undefined ||
      installed === undefined ||
      owner === undefined ||
      owner === input.capability ||
      !["application-owned", "managed"].includes(installed.ownership) ||
      installed.fingerprint !== fingerprintFileContent(pair.current.content) ||
      expectedText === undefined ||
      current.kind !== "file" ||
      current.content !== expectedText
    ) {
      return planningFailure("PROJECT_DRIFT_DETECTED");
    }

    actions.push({
      kind: "replace-file",
      path: pair.desired.path,
      ownership:
        installed.ownership === "application-owned"
          ? "application-owned"
          : "managed",
      owner,
    });
  }

  for (const file of differences.removed) {
    const descriptor = fileSurfaceForPath(input.current, file.path);
    const installed = descriptor === undefined
      ? undefined
      : installedSurfaceForDescriptor(input.state.managedSurfaces, descriptor);
    const owner = descriptor === undefined ? undefined : actionOwner(descriptor);

    if (
      descriptor === undefined ||
      installed === undefined ||
      owner !== input.capability ||
      installed.fingerprint !== fingerprintFileContent(file.content)
    ) {
      return planningFailure("PROJECT_DRIFT_DETECTED");
    }

    if (installed.ownership === "ejected") {
      actions.push({
        kind: "preserve-file-and-eject",
        path: file.path,
        ownership: "ejected",
        owner,
      });
      continue;
    }

    const current = await input.reader.readText(file.path);

    if (current.kind !== "file") {
      return planningFailure("PROJECT_DRIFT_DETECTED");
    }

    const currentFingerprint = fingerprintFileContent(
      encoder.encode(current.content),
    );

    if (installed.ownership === "application-owned") {
      actions.push({
        kind:
          currentFingerprint === installed.fingerprint
            ? "delete-file"
            : "preserve-file-and-eject",
        path: file.path,
        ownership:
          currentFingerprint === installed.fingerprint
            ? "application-owned"
            : "ejected",
        owner,
      });
      continue;
    }

    const expectedText = renderedText(file);

    if (
      installed.ownership !== "managed" ||
      expectedText === undefined ||
      current.content !== expectedText
    ) {
      return planningFailure("PROJECT_DRIFT_DETECTED");
    }

    actions.push({
      kind: "delete-file",
      path: file.path,
      ownership: "managed",
      owner,
    });
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

function removalReviewRequirements(
  actions: readonly CapabilityRemovalAction[],
  capability: "analytics" | "booking-calendly" | "multilingual",
  referenceWarnings: readonly CapabilityRemovalReferenceWarning[],
): readonly CapabilityRemovalReviewRequirement[] {
  const preservedPaths = actions
    .flatMap((action) =>
      action.kind === "preserve-file-and-eject" ? [action.path] : [],
    )
    .sort(compareText);

  return [
    {
      code: "review-surviving-references-to-removed-surfaces",
      scope: "repository",
    },
    ...(referenceWarnings.length === 0
      ? []
      : [
          {
            code: "review-capability-removal-reference-warnings" as const,
            warnings: referenceWarnings,
          },
        ]),
    ...(capability === "analytics"
      ? [
          {
            code: "review-analytics-provider-and-client-storage-disposition" as const,
            scope: "provider-accounts-retained-data-browser-storage-and-cookies" as const,
          },
        ]
      : []),
    ...(preservedPaths.length === 0
      ? []
      : [
          {
            code: "reconcile-preserved-capability-surfaces" as const,
            paths: preservedPaths,
          },
        ]),
  ];
}

function fingerprintPlan(input: Readonly<{
  plan: CapabilityRemovalPlanBody;
  project: ValidInspection["project"]["value"];
  state: InstalledState;
  git: Extract<GitWorktreeInspection, Readonly<{ ok: true }>>;
}>): `sha256:${string}` {
  const digest = createHash("sha256")
    .update(
      stringifyCanonicalJson({
        plan: input.plan,
        project: input.project,
        state: input.state,
        gitIdentity: input.git.identity,
      }),
      "utf8",
    )
    .digest("hex");

  return `sha256:${digest}`;
}

export async function planCapabilityRemoval(input: Readonly<{
  reader: RepositoryReader;
  git: Extract<GitWorktreeInspection, Readonly<{ ok: true }>>;
  capability: "analytics" | "booking-calendly" | "multilingual";
  inspectRepositoryInventory?: typeof inspectGitRepositoryInventory;
}>): Promise<PlanningResult<CapabilityRemovalPlan>> {
  const capabilityValue: unknown = Reflect.get(input, "capability");

  if (
    capabilityValue !== "analytics" &&
    capabilityValue !== "booking-calendly" &&
    capabilityValue !== "multilingual"
  ) {
    return planningFailure("CAPABILITY_REMOVAL_UNSUPPORTED");
  }

  const catalog = createVerifiedCapabilityCatalog();

  if (!catalog.ok) {
    return planningFailure("PROJECT_INSPECTION_INVALID");
  }

  const inspection = validatedInspection(
    await inspectProject({
      reader: input.reader,
      catalog: catalog.value,
      profiles: profileRecipes,
    }),
  );

  if (inspection === undefined) {
    return planningFailure("PROJECT_INSPECTION_INVALID");
  }

  const project = inspection.project.value;
  const state = inspection.inference.state.value;
  const desired = project.selectedCapabilities.includes(capabilityValue);
  const installedCapability = state.installedCapabilities.find(
    ({ identifier }) => identifier === capabilityValue,
  );
  const inferred = inspection.inference.capabilities.find(
    ({ identifier }) => identifier === capabilityValue,
  );
  const descriptor = catalog.value.find(
    ({ identifier }) => identifier === capabilityValue,
  );

  if (descriptor?.version !== "0.1.0") {
    return planningFailure("PROJECT_INSPECTION_INVALID");
  }

  if (!ejectionPathsAreValid(state, project.ejectedAreas)) {
    return planningFailure("PROJECT_EJECTION_INVALID");
  }

  if (!desired && installedCapability === undefined) {
    return isValidRemovedCapabilityState({
      state,
      descriptor,
      inferred,
      ejections: new Set(project.ejectedAreas),
      capability: capabilityValue,
    })
      ? planningFailure("CAPABILITY_NOT_INSTALLED")
      : planningFailure("PROJECT_DRIFT_DETECTED");
  }

  if (
    !desired ||
    installedCapability?.version !== "0.1.0" ||
    inferred?.category !== "confirmed"
  ) {
    return planningFailure("PROJECT_DRIFT_DETECTED");
  }

  if (hasMaterialDrift(inspection)) {
    return planningFailure("PROJECT_DRIFT_DETECTED");
  }

  const bookingSettings = project.capabilitySettings["booking-calendly"];
  const analyticsSettings = project.capabilitySettings.analytics;
  if (capabilityValue === "booking-calendly" && bookingSettings === undefined) {
    return planningFailure("PROJECT_INSPECTION_INVALID");
  }
  if (capabilityValue === "analytics" && analyticsSettings === undefined) {
    return planningFailure("PROJECT_INSPECTION_INVALID");
  }

  const renderRequest = {
    profile: project.originProfile,
    projectName: project.project.name,
    displayName: project.project.displayName,
    ...(bookingSettings === undefined ? {} : { bookingCalendly: bookingSettings }),
    ...(project.selectedCapabilities.includes("multilingual")
      ? { multilingual: true as const }
      : {}),
    ...(analyticsSettings === undefined ? {} : { analytics: analyticsSettings }),
    packageVersions: verifiedCapabilityPackageVersions,
  } as const;
  const [current, desiredRender] = await Promise.all([
    renderSkeleton(renderRequest),
    renderSkeleton({
      profile: renderRequest.profile,
      projectName: renderRequest.projectName,
      displayName: renderRequest.displayName,
      ...(capabilityValue === "booking-calendly" || bookingSettings === undefined
        ? {}
        : { bookingCalendly: bookingSettings }),
      ...(capabilityValue === "multilingual"
        ? {}
        : project.selectedCapabilities.includes("multilingual")
          ? { multilingual: true as const }
          : {}),
      ...(capabilityValue === "analytics" || analyticsSettings === undefined
        ? {}
        : { analytics: analyticsSettings }),
      packageVersions: verifiedCapabilityPackageVersions,
    }),
  ]);

  if (!current.ok || !desiredRender.ok) {
    return planningFailure("PROJECT_INSPECTION_INVALID");
  }

  if (
    hasSurfaceInventoryDrift(
      state.managedSurfaces,
      [...current.value.surfaces, ...createBuilderStateSurfaces()],
      new Set(project.ejectedAreas),
    )
  ) {
    return planningFailure("PROJECT_DRIFT_DETECTED");
  }

  if (
    await hasUnavailableApplicationOwnedSurface({
      reader: input.reader,
      rendered: current.value,
      state,
    })
  ) {
    return planningFailure("PROJECT_DRIFT_DETECTED");
  }

  const projectSource = await input.reader.readText(".egeria/project.yaml");

  if (
    projectSource.kind !== "file" ||
    projectSource.content !== serializeProjectYaml(project)
  ) {
    return planningFailure("PROJECT_DRIFT_DETECTED");
  }

  const actions = await deriveActions({
    reader: input.reader,
    current: current.value,
    desired: desiredRender.value,
    state,
    capability: capabilityValue,
  });

  if (!actions.ok) {
    return actions;
  }

  let referenceWarnings: readonly CapabilityRemovalReferenceWarning[];
  try {
    const inventory = await (
      input.inspectRepositoryInventory ?? inspectGitRepositoryInventory
    )({
      root: input.git.identity.root,
      identity: input.git.identity,
    });

    if (!inventory.ok) {
      return planningFailure("CAPABILITY_REMOVAL_INVENTORY_INVALID");
    }

    const guard = await guardCapabilityRemovalReferences({
      reader: input.reader,
      inventory: inventory.value,
      actions: actions.value,
      desiredFiles: desiredRender.value.files,
      referenceToken: removalReferenceTokens[capabilityValue],
    });

    if (!guard.ok) {
      return referenceConflict(guard.conflicts);
    }

    referenceWarnings = guard.warnings;
  } catch {
    return planningFailure("CAPABILITY_REMOVAL_INVENTORY_INVALID");
  }

  const currentCapabilities = current.value.resolved.capabilities
    .map(({ identifier }) => identifier)
    .sort(compareText);
  const desiredCapabilities = desiredRender.value.resolved.capabilities
    .map(({ identifier }) => identifier)
    .sort(compareText);
  const plan: CapabilityRemovalPlanBody = {
    operation: "remove-capability",
    status: "approval-required",
    baseRevision: input.git.identity.revision,
    profile: project.originProfile,
    capability: {
      identifier: capabilityValue,
      version: descriptor.version,
    },
    currentCapabilities,
    desiredCapabilities,
    actions: actions.value,
    reviewRequirements: removalReviewRequirements(
      actions.value,
      capabilityValue,
      referenceWarnings,
    ),
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
        project,
        state,
        git: input.git,
      }),
    },
  };
}
