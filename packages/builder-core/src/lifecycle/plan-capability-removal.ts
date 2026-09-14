import { createHash } from "node:crypto";

import { applicationPersistenceCatalogSnapshot, createCapabilityCatalogSnapshot } from "../catalog/capability-catalog.js";
import {
  createGenerationRenderingContext,
  readVerifiedProjectSnapshot,
  verifiedCapabilityPackageVersions,
} from "../catalog/verified-package-versions.js";
import type {
  CapabilityDescriptor,
  ManagedSurfaceDescriptor,
} from "../contracts/capability.js";
import {
  persistenceRemovalInputSchema,
  type PersistenceRemovalInput,
  type PersistenceRemovalMachineReport,
  type PersistenceRemovalSubject,
} from "../contracts/persistence-removal-evidence.js";
import type { ContractIssue } from "../contracts/result.js";
import type { ProfileIdentifier } from "../contracts/profile.js";
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
import type { ProfileRecipe } from "../contracts/profile.js";
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
  type GitRepositoryInventoryInspection,
} from "./git-worktree-inspection.js";

import { preparePersistenceRenderingChange } from "./prepare-persistence-rendering-change.js";
import { reviewPersistenceRemovalEvidence } from "./review-persistence-removal-evidence.js";

type RemovableCapability = "analytics" | "booking-calendly" | "multilingual" | "application-persistence";

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
    | "application-persistence"
    | "deployment-cloudflare"
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
  profile: ProfileIdentifier;
  capability: Readonly<{
    identifier: RemovableCapability;
    version: "0.1.0";
  }>;
  persistenceRemovalReport?: PersistenceRemovalMachineReport;
  persistenceRemovalSubject?: Omit<PersistenceRemovalSubject, "databases">;
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
  | "CAPABILITY_REMOVAL_UNSUPPORTED"
  | "PERSISTENCE_REMOVAL_INPUT_INVALID"
  | "PERSISTENCE_REMOVAL_SUBJECT_UNAVAILABLE";

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
  "application-persistence": "application-persistence",
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
  profiles: readonly ProfileRecipe[],
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
  const currentProfile = profiles.find(
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
  capability: RemovableCapability;
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
    "application-persistence",
    "deployment-cloudflare",
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
  const candidates = [...rendered.surfaces, ...createBuilderStateSurfaces()].filter(
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
  capability: RemovableCapability;
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
    if (input.capability === "application-persistence" && pair.current.path === "apps/web/package.json") {
      actions.push({ kind: "replace-file", path: pair.current.path, ownership: "managed", owner: "builder-kernel" });
      continue;
    }
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
      (owner !== input.capability && !(input.capability === "application-persistence" && owner === "deployment-cloudflare")) ||
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
  capability: RemovableCapability,
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

function fingerprintValue(value: unknown): `sha256:${string}` {
  return fingerprintFileContent(encoder.encode(stringifyCanonicalJson(value)));
}

async function preparePersistenceReview(input: Readonly<{
  reader: RepositoryReader;
  descriptor: CapabilityDescriptor;
  inventory: Extract<GitRepositoryInventoryInspection, { ok: true }>["value"];
  input: PersistenceRemovalInput;
}>): Promise<PlanningResult<Readonly<{
  report: PersistenceRemovalMachineReport;
  subject: Omit<PersistenceRemovalSubject, "databases">;
}>>> {
  const schemaRoot = "apps/web/src/infrastructure/persistence/";
  const migrationRoot = "apps/web/migrations/";
  const selectedPaths = [...new Set([
    "apps/web/src/infrastructure/persistence/schema.ts",
    ...input.inventory.entries.filter(({ path }) => path.startsWith(schemaRoot) || path.startsWith(migrationRoot)).map(({ path }) => path),
  ])].sort(compareText);
  if (input.inventory.truncated || input.inventory.entries.some(({ path, kind }) =>
    selectedPaths.includes(path) && kind !== "file")) {
    return planningFailure("PERSISTENCE_REMOVAL_SUBJECT_UNAVAILABLE");
  }
  const files: { path: string; fingerprint: string }[] = [];
  for (const path of selectedPaths) {
    const result = input.reader.readBytes === undefined
      ? await input.reader.readText(path) : await input.reader.readBytes(path);
    if (result.kind !== "file") return planningFailure("PERSISTENCE_REMOVAL_SUBJECT_UNAVAILABLE");
    files.push({ path, fingerprint: fingerprintFileContent(typeof result.content === "string" ? encoder.encode(result.content) : result.content) });
  }
  const localArtifactDigests: { reference: string; digest: string }[] = [];
  for (const { reference, path } of input.input.localArtifacts ?? []) {
    const result = input.reader.readBytes === undefined
      ? await input.reader.readText(path) : await input.reader.readBytes(path);
    if (result.kind === "file") {
      localArtifactDigests.push({ reference, digest: fingerprintFileContent(typeof result.content === "string" ? encoder.encode(result.content) : result.content) });
    }
  }
  const subject = {
    descriptorVersion: input.descriptor.version,
    descriptorFingerprint: fingerprintValue(input.descriptor),
    schemaFingerprint: fingerprintValue(files.filter(({ path }) => path.startsWith(schemaRoot))),
    migrationsFingerprint: fingerprintValue(files.filter(({ path }) => path.startsWith(migrationRoot))),
  };
  return { ok: true, value: { subject, report: reviewPersistenceRemovalEvidence({
    expectedSubject: { ...subject, databases: input.input.databases },
    policy: input.input.policy,
    ...(input.input.evidence === undefined ? {} : { evidence: input.input.evidence }),
    localArtifactDigests,
  }) } };
}

async function readPersistencePlanBindings(
  reader: RepositoryReader,
  current: RenderedSkeleton,
  desired: RenderedSkeleton,
  actions: readonly CapabilityRemovalAction[],
  persistenceRemoval: PersistenceRemovalInput | undefined,
  referenceWarnings: readonly CapabilityRemovalReferenceWarning[],
  inventory: Extract<GitRepositoryInventoryInspection, { ok: true }>["value"],
): Promise<unknown> {
  const files = [];
  const selectedPaths = [...new Set([
    ".egeria/project.yaml", ".egeria/state.json", ".egeria/migrations.jsonl",
    ...actions.map(({ path }) => path),
    ...referenceWarnings.flatMap(({ path }) => path === undefined ? [] : [path]),
    ...(persistenceRemoval?.localArtifacts ?? []).map(({ path }) => path),
  ])].sort(compareText);
  for (const path of selectedPaths) {
    const result = reader.readBytes === undefined ? await reader.readText(path) : await reader.readBytes(path);
    files.push({ path, evidence: result.kind === "file"
      ? { kind: "file", fingerprint: fingerprintFileContent(typeof result.content === "string" ? encoder.encode(result.content) : result.content) }
      : result });
  }
  return {
    input: persistenceRemoval ?? null,
    inventory,
    files,
    current: current.files.map(({ path, content }) => ({ path, fingerprint: fingerprintFileContent(content) })),
    desired: desired.files.map(({ path, content }) => ({ path, fingerprint: fingerprintFileContent(content) })),
    currentCapabilities: current.resolved.capabilities,
    desiredCapabilities: desired.resolved.capabilities,
  };
}

function fingerprintPlan(input: Readonly<{
  plan: CapabilityRemovalPlanBody;
  project: ValidInspection["project"]["value"];
  state: InstalledState;
  git: Extract<GitWorktreeInspection, Readonly<{ ok: true }>>;
  persistenceBindings?: unknown;
}>): `sha256:${string}` {
  const digest = createHash("sha256")
    .update(
      stringifyCanonicalJson({
        plan: input.plan,
        project: input.project,
        state: input.state,
        gitIdentity: input.git.identity,
        ...(input.persistenceBindings === undefined ? {} : { persistenceBindings: input.persistenceBindings }),
      }),
      "utf8",
    )
    .digest("hex");

  return `sha256:${digest}`;
}

export async function planCapabilityRemoval(input: Readonly<{
  reader: RepositoryReader;
  git: Extract<GitWorktreeInspection, Readonly<{ ok: true }>>;
  capability: RemovableCapability;
  persistenceRemoval?: PersistenceRemovalInput;
  inspectRepositoryInventory?: typeof inspectGitRepositoryInventory;
}>): Promise<PlanningResult<CapabilityRemovalPlan>> {
  const capabilityValue: unknown = Reflect.get(input, "capability");

  if (
    capabilityValue !== "analytics" &&
    capabilityValue !== "booking-calendly" &&
    capabilityValue !== "multilingual" &&
    capabilityValue !== "application-persistence"
  ) {
    return planningFailure("CAPABILITY_REMOVAL_UNSUPPORTED");
  }

  const persistenceInput = input.persistenceRemoval === undefined
    ? undefined : persistenceRemovalInputSchema.safeParse(input.persistenceRemoval);
  if ((capabilityValue === "application-persistence" && persistenceInput?.success !== true) ||
      (capabilityValue !== "application-persistence" && input.persistenceRemoval !== undefined)) {
    return planningFailure("PERSISTENCE_REMOVAL_INPUT_INVALID");
  }

  const snapshot = await readVerifiedProjectSnapshot(input.reader);

  if (!snapshot.ok) {
    return planningFailure("PROJECT_INSPECTION_INVALID");
  }

  let inspectionCatalog = snapshot.value.catalog;
  if (capabilityValue === "application-persistence" && !inspectionCatalog.some(({ identifier }) => identifier === capabilityValue)) {
    const persistenceCatalog = createCapabilityCatalogSnapshot(verifiedCapabilityPackageVersions, applicationPersistenceCatalogSnapshot);
    const removedDescriptor = persistenceCatalog.ok
      ? persistenceCatalog.value.find(({ identifier }) => identifier === capabilityValue) : undefined;
    if (removedDescriptor === undefined) return planningFailure("PROJECT_INSPECTION_INVALID");
    inspectionCatalog = [...inspectionCatalog, removedDescriptor];
  }

  const inspection = validatedInspection(
    await inspectProject({
      reader: snapshot.value.reader,
      catalog: inspectionCatalog,
      profiles: snapshot.value.profiles,
    }),
    snapshot.value.profiles,
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
  const descriptor = inspectionCatalog.find(
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
    ...(project.selectedCapabilities.includes("application-persistence") ? { applicationPersistence: true as const } : {}),
    packageVersions: verifiedCapabilityPackageVersions,
  } as const;
  const [currentRender, desiredRender] = await Promise.all([
    renderSkeleton(renderRequest, snapshot.value.renderingContext),
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
      ...(capabilityValue !== "application-persistence" && renderRequest.applicationPersistence === true ? { applicationPersistence: true as const } : {}),
      packageVersions: verifiedCapabilityPackageVersions,
    }, capabilityValue === "application-persistence" ? createGenerationRenderingContext(false) : snapshot.value.renderingContext),
  ]);

  if (!currentRender.ok || !desiredRender.ok) {
    return planningFailure("PROJECT_INSPECTION_INVALID");
  }

  const prepared = capabilityValue === "application-persistence"
    ? await preparePersistenceRenderingChange({ reader: input.reader, current: currentRender.value, desired: desiredRender.value })
    : { ok: true as const, value: { current: currentRender.value, desired: desiredRender.value } };
  if (!prepared.ok) {
    return planningFailure("PROJECT_DRIFT_DETECTED");
  }
  const current = { ok: true as const, value: prepared.value.current };
  const targetRender = prepared.value.desired;

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
    desired: targetRender,
    state,
    capability: capabilityValue,
  });

  if (!actions.ok) {
    return actions;
  }

  let referenceWarnings: readonly CapabilityRemovalReferenceWarning[];
  let inventory: Extract<GitRepositoryInventoryInspection, { ok: true }>;
  try {
    const inventoryResult = await (
      input.inspectRepositoryInventory ?? inspectGitRepositoryInventory
    )({
      root: input.git.identity.root,
      identity: input.git.identity,
    });

    if (!inventoryResult.ok) {
      return planningFailure("CAPABILITY_REMOVAL_INVENTORY_INVALID");
    }

    inventory = inventoryResult;
    const guard = await guardCapabilityRemovalReferences({
      reader: input.reader,
      inventory: inventory.value,
      actions: actions.value,
      desiredFiles: targetRender.files,
      ...(capabilityValue === "application-persistence" ? { removedPackages: ["drizzle-orm", "drizzle-kit"] as const } : {}),
      referenceToken: removalReferenceTokens[capabilityValue],
    });

    if (!guard.ok) {
      return referenceConflict(guard.conflicts);
    }

    referenceWarnings = guard.warnings;
  } catch {
    return planningFailure("CAPABILITY_REMOVAL_INVENTORY_INVALID");
  }

  const persistenceReview = persistenceInput?.success === true
    ? await preparePersistenceReview({ reader: input.reader, descriptor, inventory: inventory.value, input: persistenceInput.data })
    : undefined;
  if (persistenceReview !== undefined && !persistenceReview.ok) {
    return persistenceReview;
  }
  const persistenceBindings = project.selectedCapabilities.includes("application-persistence")
    ? await readPersistencePlanBindings(input.reader, current.value, targetRender, actions.value,
        persistenceInput?.success === true ? persistenceInput.data : undefined, referenceWarnings, inventory.value)
    : undefined;

  const currentCapabilities = current.value.resolved.capabilities
    .map(({ identifier }) => identifier)
    .sort(compareText);
  const desiredCapabilities = targetRender.resolved.capabilities
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
    ...(persistenceReview?.ok === true ? { persistenceRemovalReport: persistenceReview.value.report, persistenceRemovalSubject: persistenceReview.value.subject } : {}),
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
        ...(persistenceBindings === undefined ? {} : { persistenceBindings }),
      }),
    },
  };
}
