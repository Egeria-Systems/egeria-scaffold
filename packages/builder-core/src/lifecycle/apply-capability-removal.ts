import { isAbsolute, resolve } from "node:path";

import {
  createVerifiedCapabilityCatalog,
  verifiedCapabilityPackageVersions,
} from "../catalog/verified-package-versions.js";
import type { ManagedSurfaceDescriptor } from "../contracts/capability.js";
import { ordinaryGenerationVerificationChecks } from "../contracts/generation-verification.js";
import {
  migrationRecordSchema,
  type MigrationRecord,
} from "../contracts/migration.js";
import {
  projectConfigurationSchema,
  type ProjectConfiguration,
} from "../contracts/project.js";
import {
  capabilityRemovalPersistedVerificationChecks,
  capabilityRemovalVerificationChecks,
  installedStateSchema,
  type InstalledState,
  type InstalledSurface,
} from "../contracts/state.js";
import { createBuilderStateSurfaces } from "../generation/builder-state-surfaces.js";
import { renderSkeleton } from "../generation/render-skeleton.js";
import type {
  GeneratedProjectVerification,
  GeneratedProjectVerifier,
} from "../generation/verify-generated-project.js";
import {
  inferRepository,
  type SurfaceEvidenceStatus,
} from "../inference/infer-repository.js";
import { createInstalledManifest } from "../manifest/create-installed-manifest.js";
import { materializeInstalledSurfaces } from "../ownership/materialize-surfaces.js";
import {
  createFileSystemRepositoryReader,
  type RepositoryReader,
} from "../repository/repository-reader.js";
import {
  parseMigrationLog,
  parseProjectYaml,
  parseStateJson,
  serializeProjectYaml,
  serializeStateJson,
} from "../state/codecs.js";
import {
  createFileSystemCapabilityRemovalWriter,
  type CapabilityRemovalFileChange,
  type CapabilityRemovalWriter,
} from "./capability-removal-writer.js";
import {
  inspectGitExpectedChanges,
  inspectGitWorktree,
  sameGitIdentity,
  type GitExpectedChangesInspection,
  type GitWorktreeIdentity,
  type GitWorktreeInspection,
  type GitWorktreeRefusalCode,
} from "./git-worktree-inspection.js";
import {
  persistInstalledState,
  persistMigrationRecord,
  prepareMigrationRecord,
} from "./lifecycle-control-persistence.js";
import {
  planCapabilityRemoval,
  type CapabilityRemovalAction,
  type CapabilityRemovalPlanningFailureCode,
} from "./plan-capability-removal.js";

const encoder = new TextEncoder();
type RemovableCapability = "analytics" | "booking-calendly" | "multilingual";

function removalMigrationIdentifier(
  capability: RemovableCapability,
):
  | "remove-analytics-0-1-0"
  | "remove-booking-calendly-0-1-0"
  | "remove-multilingual-0-1-0" {
  switch (capability) {
    case "analytics":
      return "remove-analytics-0-1-0";
    case "booking-calendly":
      return "remove-booking-calendly-0-1-0";
    case "multilingual":
      return "remove-multilingual-0-1-0";
  }
}

export type CapabilityRemovalPhase =
  | "precondition"
  | "transform"
  | "verify"
  | "re-infer"
  | "persist-migration"
  | "persist-state"
  | "post-state"
  | "final-diff";

export type CapabilityRemovalRecovery = "not-required" | "inspect-worktree";

type CapabilityRemovalLocalFailureCode =
  | "REPOSITORY_OPEN_FAILED"
  | "CAPABILITY_PLAN_APPROVAL_INVALID"
  | "CAPABILITY_ACTION_CONFLICT"
  | "CAPABILITY_TRANSFORM_FAILED"
  | "CAPABILITY_VERIFICATION_FAILED"
  | "CAPABILITY_REINFERENCE_FAILED"
  | "CAPABILITY_MIGRATION_RECORD_INVALID"
  | "CAPABILITY_STATE_CONSTRUCTION_FAILED"
  | "CAPABILITY_MIGRATION_WRITE_FAILED"
  | "CAPABILITY_STATE_WRITE_FAILED"
  | "CAPABILITY_POST_STATE_FAILED";

export type CapabilityRemovalFailureCode =
  | GitWorktreeRefusalCode
  | CapabilityRemovalPlanningFailureCode
  | CapabilityRemovalLocalFailureCode;

export type CapabilityRemovalExecutionResult =
  | Readonly<{
      ok: true;
      value: Readonly<{
        status: "verified-final-diff-approval-required";
        baseRevision: string;
        capability: Readonly<{
          identifier: RemovableCapability;
          version: "0.1.0";
        }>;
        migration: ReturnType<typeof removalMigrationIdentifier>;
        changedPaths: readonly string[];
        preservedPaths: readonly string[];
        verificationChecks: typeof capabilityRemovalVerificationChecks;
      }>;
    }>
  | Readonly<{
      ok: false;
      code: CapabilityRemovalFailureCode;
      phase: CapabilityRemovalPhase;
      recovery: CapabilityRemovalRecovery;
    }>;

type InspectWorktree = (input: Readonly<{
  root: string;
}>) => Promise<GitWorktreeInspection>;

type InspectExpectedChanges = (input: Readonly<{
  root: string;
  identity: GitWorktreeIdentity;
  expectedPaths: readonly string[];
}>) => Promise<GitExpectedChangesInspection>;

type ControlSnapshot = Readonly<{
  projectSource: string;
  stateSource: string;
  migrationSource: string;
  project: ReturnType<typeof parseProjectYaml> & Readonly<{ ok: true }>;
  state: ReturnType<typeof parseStateJson> & Readonly<{ ok: true }>;
  migrations: ReturnType<typeof parseMigrationLog> & Readonly<{ ok: true }>;
}>;

type ExpectedFileState =
  | Readonly<{ kind: "file"; content: Uint8Array }>
  | Readonly<{ kind: "missing" }>;

function failure(
  code: CapabilityRemovalFailureCode,
  phase: CapabilityRemovalPhase,
  recovery: CapabilityRemovalRecovery,
): CapabilityRemovalExecutionResult {
  return { ok: false, code, phase, recovery };
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function sameValues(left: readonly string[], right: readonly string[]): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
  return (
    left.length === right.length &&
    left.every((byte, index) => byte === right[index])
  );
}

async function readExpectedFileStates(
  reader: RepositoryReader,
  expected: ReadonlyMap<string, ExpectedFileState>,
  paths: readonly string[],
): Promise<boolean> {
  for (const path of paths) {
    const expectedState = expected.get(path);
    const actual = await reader.readText(path);

    if (
      expectedState === undefined ||
      (expectedState.kind === "missing" && actual.kind !== "missing") ||
      (expectedState.kind === "file" &&
        (actual.kind !== "file" ||
          !sameBytes(encoder.encode(actual.content), expectedState.content)))
    ) {
      return false;
    }
  }

  return true;
}

async function readControlSnapshot(
  reader: RepositoryReader,
): Promise<ControlSnapshot | undefined> {
  const [projectRead, stateRead, migrationsRead] = await Promise.all([
    reader.readText(".egeria/project.yaml"),
    reader.readText(".egeria/state.json"),
    reader.readText(".egeria/migrations.jsonl"),
  ]);

  if (
    projectRead.kind !== "file" ||
    stateRead.kind !== "file" ||
    migrationsRead.kind !== "file"
  ) {
    return undefined;
  }

  const project = parseProjectYaml(projectRead.content);
  const state = parseStateJson(stateRead.content);
  const migrations = parseMigrationLog(migrationsRead.content);

  return project.ok && state.ok && migrations.ok
    ? {
        projectSource: projectRead.content,
        stateSource: stateRead.content,
        migrationSource: migrationsRead.content,
        project,
        state,
        migrations,
      }
    : undefined;
}

function verificationIsExact(value: GeneratedProjectVerification): boolean {
  return sameValues(value.checks, ordinaryGenerationVerificationChecks);
}

function sameSurfaceDescriptor(
  installed: InstalledSurface,
  descriptor: ManagedSurfaceDescriptor,
): boolean {
  const ownershipMatches =
    installed.ownership === descriptor.ownership ||
    (descriptor.ownership === "application-owned" &&
      installed.ownership === "ejected");

  return (
    installed.identifier === descriptor.identifier &&
    installed.path === descriptor.path &&
    ownershipMatches &&
    installed.mergeStrategy === descriptor.mergeStrategy &&
    installed.owner.kind === descriptor.owner.kind &&
    (installed.owner.kind === "builder-kernel" ||
      (descriptor.owner.kind === "capability" &&
        installed.owner.identifier === descriptor.owner.identifier)) &&
    installed.fingerprintTarget.kind === descriptor.fingerprintTarget.kind &&
    (installed.fingerprintTarget.kind === "file" ||
      (descriptor.fingerprintTarget.kind === "json-value" &&
        installed.fingerprintTarget.pointer ===
          descriptor.fingerprintTarget.pointer))
  );
}

function expectedPendingSurfaceStatus(
  surface: InstalledSurface,
  action: CapabilityRemovalAction | undefined,
): SurfaceEvidenceStatus {
  if (action?.kind === "replace-project-configuration") {
    return "drifted";
  }
  if (surface.ownership === "managed") {
    if (action?.kind === "delete-file") {
      return "missing";
    }
    if (action?.kind === "replace-file") {
      return "drifted";
    }
  }
  if (surface.ownership === "application-owned") {
    return "application-owned";
  }
  if (surface.ownership === "ejected") {
    return "ejected";
  }
  return "confirmed";
}

function requirePendingInference(input: Readonly<{
  inference: Awaited<ReturnType<typeof inferRepository>>;
  currentState: InstalledState;
  desiredCapabilities: readonly string[];
  actions: readonly CapabilityRemovalAction[];
  removedCapability: RemovableCapability;
}>): boolean {
  if (
    input.inference.state.kind !== "valid" ||
    serializeStateJson(input.inference.state.value) !==
      serializeStateJson(input.currentState)
  ) {
    return false;
  }

  const desired = new Set(input.desiredCapabilities);
  const currentIdentifiers = input.currentState.installedCapabilities
    .map(({ identifier }) => identifier)
    .sort(compareText);
  const inferredIdentifiers = input.inference.capabilities
    .map(({ identifier }) => identifier)
    .sort(compareText);
  if (
    !sameValues(currentIdentifiers, inferredIdentifiers) ||
    input.inference.capabilities.some(({ identifier, category }) =>
      identifier === input.removedCapability
        ? category !== "contradictory"
        : !desired.has(identifier) || category !== "confirmed",
    )
  ) {
    return false;
  }

  const actionsByPath = new Map(
    input.actions.map((action) => [action.path, action]),
  );
  const surfacesByIdentifier = new Map(
    input.currentState.managedSurfaces.map((surface) => [
      surface.identifier,
      surface,
    ]),
  );

  return (
    input.inference.surfaces.length ===
      input.currentState.managedSurfaces.length &&
    input.inference.surfaces.every((evidence) => {
      const surface = surfacesByIdentifier.get(evidence.identifier);
      if (surface === undefined) {
        return false;
      }
      return (
        evidence.path === surface.path &&
        evidence.status ===
          expectedPendingSurfaceStatus(
            surface,
            actionsByPath.get(surface.path),
          )
      );
    })
  );
}

function requireFinalInference(input: Readonly<{
  inference: Awaited<ReturnType<typeof inferRepository>>;
  expectedState: InstalledState;
  desiredCapabilities: readonly string[];
  preservedPaths: readonly string[];
  removedCapability: RemovableCapability;
}>): boolean {
  if (
    input.inference.state.kind !== "valid" ||
    serializeStateJson(input.inference.state.value) !==
      serializeStateJson(input.expectedState) ||
    !sameValues(
      input.expectedState.installedCapabilities
        .map(({ identifier }) => identifier)
        .sort(compareText),
      input.desiredCapabilities,
    )
  ) {
    return false;
  }

  const desired = new Set(input.desiredCapabilities);
  const preserved = new Set(input.preservedPaths);
  if (
    input.inference.capabilities.some((evidence) => {
      if (desired.has(evidence.identifier)) {
        return evidence.category !== "confirmed";
      }
      return (
        evidence.identifier !== input.removedCapability ||
        evidence.probes.some(
          (probe) =>
            probe.status !== "missing" &&
            !(probe.status === "present" && preserved.has(probe.path)),
        )
      );
    }) ||
    input.desiredCapabilities.some(
      (identifier) =>
        input.inference.capabilities.find(
          (evidence) => evidence.identifier === identifier,
        )?.category !== "confirmed",
    )
  ) {
    return false;
  }

  const surfacesByIdentifier = new Map(
    input.expectedState.managedSurfaces.map((surface) => [
      surface.identifier,
      surface,
    ]),
  );
  return (
    input.inference.surfaces.length === input.expectedState.managedSurfaces.length &&
    input.inference.surfaces.every((evidence) => {
      const surface = surfacesByIdentifier.get(evidence.identifier);
      const expectedStatus = surface?.ownership === "application-owned"
        ? "application-owned"
        : surface?.ownership === "ejected"
          ? "ejected"
          : "confirmed";
      return surface === undefined
        ? false
        : evidence.path === surface.path && evidence.status === expectedStatus;
    })
  );
}

function createNextProject(
  current: ProjectConfiguration,
  preservedPaths: readonly string[],
  capability: RemovableCapability,
): ProjectConfiguration | undefined {
  const remainingCapabilitySettings = { ...current.capabilitySettings };
  if (capability === "analytics") {
    delete remainingCapabilitySettings.analytics;
  }
  if (capability === "booking-calendly") {
    delete remainingCapabilitySettings["booking-calendly"];
  }
  const parsed = projectConfigurationSchema.safeParse({
    ...current,
    selectedCapabilities: current.selectedCapabilities.filter(
      (identifier) => identifier !== capability,
    ),
    capabilitySettings: remainingCapabilitySettings,
    ejectedAreas: [
      ...new Set([...current.ejectedAreas, ...preservedPaths]),
    ].sort(compareText),
  });
  return parsed.success ? parsed.data : undefined;
}

function createNextState(input: Readonly<{
  current: InstalledState;
  desired: Awaited<ReturnType<typeof renderSkeleton>> & Readonly<{ ok: true }>;
  changedPaths: readonly string[];
  preservedPaths: readonly string[];
  files: ReadonlyMap<string, Uint8Array>;
  migration: MigrationRecord;
  ejections: readonly string[];
  removedCapability: RemovableCapability;
}>): InstalledState | undefined {
  const descriptors = [
    ...input.desired.value.surfaces,
    ...createBuilderStateSurfaces(),
  ].sort((left, right) => compareText(left.identifier, right.identifier));
  const changedPathSet = new Set([
    ...input.changedPaths,
    ".egeria/migrations.jsonl",
  ]);
  const changedDescriptors = descriptors.filter(({ path }) =>
    changedPathSet.has(path),
  );
  const materialized = materializeInstalledSurfaces({
    files: input.files,
    surfaces: changedDescriptors,
  });
  if (!materialized.ok) {
    return undefined;
  }

  const materializedByIdentifier = new Map(
    materialized.value.map((surface) => [surface.identifier, surface]),
  );
  const currentByIdentifier = new Map(
    input.current.managedSurfaces.map((surface) => [surface.identifier, surface]),
  );
  const managedSurfaces: InstalledSurface[] = [];

  for (const descriptor of descriptors) {
    const changed = materializedByIdentifier.get(descriptor.identifier);
    if (changed !== undefined) {
      managedSurfaces.push(changed);
      continue;
    }

    const existing = currentByIdentifier.get(descriptor.identifier);
    if (existing === undefined || !sameSurfaceDescriptor(existing, descriptor)) {
      return undefined;
    }
    managedSurfaces.push(existing);
  }

  for (const path of input.preservedPaths) {
    const candidates = input.current.managedSurfaces.filter(
      (surface) =>
        surface.path === path &&
        surface.owner.kind === "capability" &&
        surface.owner.identifier === input.removedCapability,
    );
    const preserved = candidates[0];
    if (candidates.length !== 1 || preserved === undefined) {
      return undefined;
    }
    managedSurfaces.push({ ...preserved, ownership: "ejected" });
  }
  managedSurfaces.sort((left, right) =>
    compareText(left.identifier, right.identifier),
  );

  const parsed = installedStateSchema.safeParse({
    ...input.current,
    installedCapabilities: createInstalledManifest(input.desired.value.resolved),
    appliedMigrations: [
      ...input.current.appliedMigrations,
      input.migration.identifier,
    ],
    managedSurfaces,
    ejections: input.ejections,
    lastSuccessfulVerification: {
      kind: "capability-removal",
      checks: capabilityRemovalPersistedVerificationChecks,
    },
  });
  return parsed.success ? parsed.data : undefined;
}

export async function applyCapabilityRemoval(input: Readonly<{
  root: string;
  capability: RemovableCapability;
  approvedPlanFingerprint: string;
  verifier: GeneratedProjectVerifier;
  reader?: RepositoryReader;
  writer?: CapabilityRemovalWriter;
  inspectWorktree?: InspectWorktree;
  inspectExpectedChanges?: InspectExpectedChanges;
  now?: () => string;
}>): Promise<CapabilityRemovalExecutionResult> {
  const root = resolve(input.root);
  if (!isAbsolute(input.root) || root !== input.root) {
    return failure(
      "GIT_WORKTREE_IDENTITY_INVALID",
      "precondition",
      "not-required",
    );
  }

  const reader = input.reader ?? createFileSystemRepositoryReader(root);
  const writer = input.writer ?? createFileSystemCapabilityRemovalWriter(root);
  const inspectWorktreeValue = input.inspectWorktree ?? inspectGitWorktree;
  const inspectExpectedChangesValue =
    input.inspectExpectedChanges ?? inspectGitExpectedChanges;

  let initialGit: GitWorktreeInspection;
  try {
    initialGit = await inspectWorktreeValue({ root });
  } catch {
    return failure(
      "GIT_WORKTREE_IDENTITY_INVALID",
      "precondition",
      "not-required",
    );
  }
  if (!initialGit.ok) {
    return failure(initialGit.code, "precondition", "not-required");
  }

  let planResult;
  try {
    planResult = await planCapabilityRemoval({
      reader,
      git: initialGit,
      capability: input.capability,
    });
  } catch {
    return failure("REPOSITORY_OPEN_FAILED", "precondition", "not-required");
  }
  if (!planResult.ok) {
    return failure(
      planResult.issues[0]?.code ?? "PROJECT_INSPECTION_INVALID",
      "precondition",
      "not-required",
    );
  }
  const plan = planResult.value;
  if (input.approvedPlanFingerprint !== plan.planFingerprint) {
    return failure(
      "CAPABILITY_PLAN_APPROVAL_INVALID",
      "precondition",
      "not-required",
    );
  }

  let controls: ControlSnapshot | undefined;
  try {
    controls = await readControlSnapshot(reader);
  } catch {
    controls = undefined;
  }
  if (controls === undefined) {
    return failure("PROJECT_INSPECTION_INVALID", "precondition", "not-required");
  }

  const preservedPaths = plan.actions
    .flatMap((action) =>
      action.kind === "preserve-file-and-eject" ? [action.path] : [],
    )
    .sort(compareText);
  const nextProject = createNextProject(
    controls.project.value,
    preservedPaths,
    input.capability,
  );
  if (nextProject === undefined) {
    return failure("PROJECT_INSPECTION_INVALID", "precondition", "not-required");
  }

  const desired = await renderSkeleton({
    profile: controls.project.value.originProfile,
    projectName: controls.project.value.project.name,
    displayName: controls.project.value.project.displayName,
    ...(input.capability === "analytics" ||
    controls.project.value.capabilitySettings.analytics === undefined
      ? {}
      : { analytics: controls.project.value.capabilitySettings.analytics }),
    ...(input.capability === "booking-calendly" ||
    controls.project.value.capabilitySettings["booking-calendly"] === undefined
      ? {}
      : {
          bookingCalendly:
            controls.project.value.capabilitySettings["booking-calendly"],
        }),
    ...(input.capability === "multilingual"
      ? {}
      : controls.project.value.selectedCapabilities.includes("multilingual")
        ? { multilingual: true as const }
        : {}),
    packageVersions: verifiedCapabilityPackageVersions,
  });
  if (!desired.ok) {
    return failure("PROJECT_INSPECTION_INVALID", "precondition", "not-required");
  }
  const desiredFiles = new Map(
    desired.value.files.map(({ path, content }) => [path, content]),
  );
  desiredFiles.set(
    ".egeria/project.yaml",
    encoder.encode(serializeProjectYaml(nextProject)),
  );

  const changes: CapabilityRemovalFileChange[] = [];
  const transformedExpected = new Map<string, ExpectedFileState>();
  try {
    for (const action of plan.actions) {
      const current = await reader.readText(action.path);
      if (current.kind !== "file") {
        return failure(
          "CAPABILITY_ACTION_CONFLICT",
          "precondition",
          "not-required",
        );
      }
      const expected = encoder.encode(current.content);

      if (action.kind === "preserve-file-and-eject") {
        transformedExpected.set(action.path, { kind: "file", content: expected });
        continue;
      }
      if (action.kind === "delete-file") {
        changes.push({ kind: "delete-file", path: action.path, expected });
        transformedExpected.set(action.path, { kind: "missing" });
        continue;
      }

      const content = desiredFiles.get(action.path);
      if (content === undefined) {
        return failure(
          "CAPABILITY_ACTION_CONFLICT",
          "precondition",
          "not-required",
        );
      }
      changes.push({
        kind: "replace-file",
        path: action.path,
        expected,
        content,
      });
      transformedExpected.set(action.path, { kind: "file", content });
    }
  } catch {
    return failure("REPOSITORY_OPEN_FAILED", "precondition", "not-required");
  }

  let finalCleanGit: GitWorktreeInspection;
  try {
    finalCleanGit = await inspectWorktreeValue({ root });
  } catch {
    return failure(
      "GIT_WORKTREE_IDENTITY_INVALID",
      "precondition",
      "not-required",
    );
  }
  if (!finalCleanGit.ok) {
    return failure(finalCleanGit.code, "precondition", "not-required");
  }
  if (!sameGitIdentity(initialGit.identity, finalCleanGit.identity)) {
    return failure("GIT_WORKTREE_CHANGED", "precondition", "not-required");
  }

  let transformed;
  try {
    transformed = await writer.write(changes);
  } catch {
    transformed = { ok: false as const, sourceChanged: true };
  }
  if (!transformed.ok) {
    return failure(
      "CAPABILITY_TRANSFORM_FAILED",
      "transform",
      transformed.sourceChanged ? "inspect-worktree" : "not-required",
    );
  }

  let verified;
  try {
    verified = await input.verifier.verifyInIsolatedCopy(root);
  } catch {
    return failure(
      "CAPABILITY_VERIFICATION_FAILED",
      "verify",
      "inspect-worktree",
    );
  }
  if (!verified.ok || !verificationIsExact(verified.value)) {
    return failure(
      "CAPABILITY_VERIFICATION_FAILED",
      "verify",
      "inspect-worktree",
    );
  }

  const catalog = createVerifiedCapabilityCatalog();
  if (!catalog.ok) {
    return failure(
      "CAPABILITY_REINFERENCE_FAILED",
      "re-infer",
      "inspect-worktree",
    );
  }
  let pendingInference;
  try {
    pendingInference = await inferRepository({ reader, catalog: catalog.value });
  } catch {
    return failure(
      "CAPABILITY_REINFERENCE_FAILED",
      "re-infer",
      "inspect-worktree",
    );
  }
  if (
    !requirePendingInference({
      inference: pendingInference,
      currentState: controls.state.value,
      desiredCapabilities: plan.desiredCapabilities,
      actions: plan.actions,
      removedCapability: input.capability,
    }) ||
    !(await readExpectedFileStates(
      reader,
      transformedExpected,
      plan.actions.map(({ path }) => path),
    ))
  ) {
    return failure(
      "CAPABILITY_REINFERENCE_FAILED",
      "re-infer",
      "inspect-worktree",
    );
  }

  let completedAt: string;
  try {
    completedAt = (input.now ?? (() => new Date().toISOString()))();
  } catch {
    return failure(
      "CAPABILITY_MIGRATION_RECORD_INVALID",
      "re-infer",
      "inspect-worktree",
    );
  }
  const migration = migrationRecordSchema.safeParse({
    schemaVersion: "1.0.0",
    identifier: removalMigrationIdentifier(input.capability),
    kind: "migration",
    outcome: "succeeded",
    completedAt,
    fromBuilderVersion: controls.state.value.builderVersion,
    toBuilderVersion: controls.state.value.builderVersion,
    capabilities: plan.desiredCapabilities,
    persistentDataAuthorizations: [],
    remainingKnownDrift: [],
    verificationChecks: capabilityRemovalPersistedVerificationChecks,
  });
  if (!migration.success) {
    return failure(
      "CAPABILITY_MIGRATION_RECORD_INVALID",
      "re-infer",
      "inspect-worktree",
    );
  }

  const preparedMigration = prepareMigrationRecord({
    currentSource: controls.migrationSource,
    currentIdentifiers: controls.state.value.appliedMigrations,
    record: migration.data,
  });
  const actualFiles = new Map<string, Uint8Array>();
  for (const [path, expected] of transformedExpected) {
    if (expected.kind === "file") {
      actualFiles.set(path, expected.content);
    }
  }
  actualFiles.set(".egeria/migrations.jsonl", preparedMigration.content);
  const changedActionPaths = plan.actions.flatMap((action) =>
    action.kind === "preserve-file-and-eject" ? [] : [action.path],
  );
  const nextState = createNextState({
    current: controls.state.value,
    desired,
    changedPaths: changedActionPaths,
    preservedPaths,
    files: actualFiles,
    migration: migration.data,
    ejections: nextProject.ejectedAreas,
    removedCapability: input.capability,
  });
  if (nextState === undefined) {
    return failure(
      "CAPABILITY_STATE_CONSTRUCTION_FAILED",
      "re-infer",
      "inspect-worktree",
    );
  }

  const persistedMigration = await persistMigrationRecord({
    prepared: preparedMigration,
    write: async (change) => {
      try {
        return (
          await writer.write([
            {
              kind: "replace-file",
              path: change.path,
              expected: change.expected,
              content: change.content,
            },
          ])
        ).ok;
      } catch {
        return false;
      }
    },
    readSource: async () => {
      try {
        const written = await reader.readText(".egeria/migrations.jsonl");
        return written.kind === "file" ? written.content : undefined;
      } catch {
        return undefined;
      }
    },
  });
  if (!persistedMigration.ok) {
    return failure(
      "CAPABILITY_MIGRATION_WRITE_FAILED",
      "persist-migration",
      "inspect-worktree",
    );
  }

  const persistedState = await persistInstalledState({
    currentSource: controls.stateSource,
    state: nextState,
    write: async (change) => {
      try {
        return (
          await writer.write([
            {
              kind: "replace-file",
              path: change.path,
              expected: change.expected,
              content: change.content,
            },
          ])
        ).ok;
      } catch {
        return false;
      }
    },
  });
  if (!persistedState.ok) {
    return failure(
      "CAPABILITY_STATE_WRITE_FAILED",
      "persist-state",
      "inspect-worktree",
    );
  }
  transformedExpected.set(".egeria/migrations.jsonl", {
    kind: "file",
    content: persistedMigration.content,
  });
  transformedExpected.set(".egeria/state.json", {
    kind: "file",
    content: persistedState.content,
  });

  let finalInference;
  try {
    finalInference = await inferRepository({ reader, catalog: catalog.value });
  } catch {
    return failure(
      "CAPABILITY_POST_STATE_FAILED",
      "post-state",
      "inspect-worktree",
    );
  }
  if (
    !requireFinalInference({
      inference: finalInference,
      expectedState: nextState,
      desiredCapabilities: plan.desiredCapabilities,
      preservedPaths,
      removedCapability: input.capability,
    })
  ) {
    return failure(
      "CAPABILITY_POST_STATE_FAILED",
      "post-state",
      "inspect-worktree",
    );
  }

  const changedPaths = [
    ...changedActionPaths,
    ".egeria/migrations.jsonl",
    ".egeria/state.json",
  ].sort(compareText);
  let finalDiff: GitExpectedChangesInspection;
  try {
    finalDiff = await inspectExpectedChangesValue({
      root,
      identity: initialGit.identity,
      expectedPaths: changedPaths,
    });
  } catch {
    return failure(
      "GIT_WORKTREE_IDENTITY_INVALID",
      "final-diff",
      "inspect-worktree",
    );
  }
  if (!finalDiff.ok) {
    return failure(finalDiff.code, "final-diff", "inspect-worktree");
  }
  if (
    !(await readExpectedFileStates(
      reader,
      transformedExpected,
      [...changedPaths, ...preservedPaths],
    ))
  ) {
    return failure(
      "CAPABILITY_POST_STATE_FAILED",
      "post-state",
      "inspect-worktree",
    );
  }

  return {
    ok: true,
    value: {
      status: "verified-final-diff-approval-required",
      baseRevision: initialGit.identity.revision,
      capability: { identifier: input.capability, version: "0.1.0" },
      migration: removalMigrationIdentifier(input.capability),
      changedPaths,
      preservedPaths,
      verificationChecks: capabilityRemovalVerificationChecks,
    },
  };
}
