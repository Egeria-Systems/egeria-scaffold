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
import type { CalendlyBookingSettings } from "../contracts/project.js";
import {
  capabilityAdditionPersistedVerificationChecks,
  capabilityAdditionVerificationChecks,
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
import { inferRepository } from "../inference/infer-repository.js";
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
  createFileSystemCapabilityAdditionWriter,
  type CapabilityAdditionFileChange,
  type CapabilityAdditionWriter,
} from "./capability-addition-writer.js";
import {
  inspectGitCreateTargets,
  inspectGitExpectedChanges,
  inspectGitWorktree,
  sameGitIdentity,
  type GitCreateTargetInspection,
  type GitExpectedChangesInspection,
  type GitWorktreeIdentity,
  type GitWorktreeRefusalCode,
  type GitWorktreeInspection,
} from "./git-worktree-inspection.js";
import {
  persistInstalledState,
  persistMigrationRecord,
  prepareMigrationRecord,
} from "./lifecycle-control-persistence.js";
import {
  planCapabilityAddition,
  type PlanningFailureCode,
} from "./plan-capability-addition.js";

const encoder = new TextEncoder();
type AddableCapability = "booking-calendly" | "multilingual";

function additionMigrationIdentifier(
  capability: AddableCapability,
): "add-booking-calendly-0-1-0" | "add-multilingual-0-1-0" {
  return capability === "booking-calendly"
    ? "add-booking-calendly-0-1-0"
    : "add-multilingual-0-1-0";
}

export type CapabilityAdditionPhase =
  | "precondition"
  | "transform"
  | "verify"
  | "re-infer"
  | "persist-migration"
  | "persist-state"
  | "post-state"
  | "final-diff";

export type CapabilityAdditionRecovery = "not-required" | "inspect-worktree";

type CapabilityAdditionLocalFailureCode =
  | "REPOSITORY_OPEN_FAILED"
  | "CAPABILITY_PLAN_APPROVAL_INVALID"
  | "CAPABILITY_TRANSFORM_FAILED"
  | "CAPABILITY_VERIFICATION_FAILED"
  | "CAPABILITY_REINFERENCE_FAILED"
  | "CAPABILITY_MIGRATION_RECORD_INVALID"
  | "CAPABILITY_STATE_CONSTRUCTION_FAILED"
  | "CAPABILITY_MIGRATION_WRITE_FAILED"
  | "CAPABILITY_STATE_WRITE_FAILED"
  | "CAPABILITY_POST_STATE_FAILED";

export type CapabilityAdditionFailureCode =
  | GitWorktreeRefusalCode
  | PlanningFailureCode
  | CapabilityAdditionLocalFailureCode;

export type CapabilityAdditionExecutionResult =
  | Readonly<{
      ok: true;
      value: Readonly<{
        status: "verified-final-diff-approval-required";
        baseRevision: string;
        capability: Readonly<{
          identifier: AddableCapability;
          version: "0.1.0";
        }>;
        migration: ReturnType<typeof additionMigrationIdentifier>;
        changedPaths: readonly string[];
        verificationChecks: typeof capabilityAdditionVerificationChecks;
      }>;
    }>
  | Readonly<{
      ok: false;
      code: CapabilityAdditionFailureCode;
      phase: CapabilityAdditionPhase;
      recovery: CapabilityAdditionRecovery;
    }>;

type InspectWorktree = (input: Readonly<{
  root: string;
}>) => Promise<GitWorktreeInspection>;

type InspectCreateTargets = (input: Readonly<{
  root: string;
  paths: readonly string[];
}>) => Promise<GitCreateTargetInspection>;

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

function failure(
  code: CapabilityAdditionFailureCode,
  phase: CapabilityAdditionPhase,
  recovery: CapabilityAdditionRecovery,
): CapabilityAdditionExecutionResult {
  return { ok: false, code, phase, recovery };
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

async function readExactFileBytes(
  reader: RepositoryReader,
  expected: ReadonlyMap<string, Uint8Array>,
  paths: readonly string[],
): Promise<Map<string, Uint8Array> | undefined> {
  const actual = new Map<string, Uint8Array>();

  for (const path of paths) {
    const expectedContent = expected.get(path);
    const result = await reader.readText(path);
    if (expectedContent === undefined || result.kind !== "file") {
      return undefined;
    }

    const content = encoder.encode(result.content);
    if (!sameBytes(content, expectedContent)) {
      return undefined;
    }
    actual.set(path, content);
  }

  return actual;
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

function verificationIsExact(
  value: GeneratedProjectVerification,
): boolean {
  return sameValues(value.checks, ordinaryGenerationVerificationChecks);
}

function sameSurfaceDescriptor(
  installed: InstalledSurface,
  descriptor: ManagedSurfaceDescriptor,
): boolean {
  return (
    installed.identifier === descriptor.identifier &&
    installed.path === descriptor.path &&
    installed.ownership === descriptor.ownership &&
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

function requirePendingInference(
  inference: Awaited<ReturnType<typeof inferRepository>>,
  currentState: InstalledState,
  desiredCapabilities: readonly string[],
  addedCapability: AddableCapability,
  plannedReplacementPaths: readonly string[],
): boolean {
  if (
    inference.state.kind !== "valid" ||
    serializeStateJson(inference.state.value) !== serializeStateJson(currentState)
  ) {
    return false;
  }

  const evidenceByIdentifier = new Map(
    inference.capabilities.map((evidence) => [evidence.identifier, evidence]),
  );
  if (
    evidenceByIdentifier.size !== desiredCapabilities.length ||
    desiredCapabilities.some((identifier) =>
      evidenceByIdentifier.get(identifier)?.category !==
      (identifier === addedCapability ? "probable" : "confirmed"),
    )
  ) {
    return false;
  }

  const plannedReplacements = new Set(plannedReplacementPaths);
  return (
    inference.surfaces.length === currentState.managedSurfaces.length &&
    inference.surfaces.every(({ path, status }) =>
      status === "confirmed" ||
      status === "application-owned" ||
      (status === "drifted" && plannedReplacements.has(path)),
    )
  );
}

function requireFinalInference(
  inference: Awaited<ReturnType<typeof inferRepository>>,
  expectedState: InstalledState,
  desiredCapabilities: readonly string[],
): boolean {
  return (
    inference.state.kind === "valid" &&
    serializeStateJson(inference.state.value) === serializeStateJson(expectedState) &&
    sameValues(
      inference.capabilities.map(({ identifier }) => identifier),
      desiredCapabilities,
    ) &&
    inference.capabilities.every(({ category }) => category === "confirmed") &&
    inference.surfaces.length === expectedState.managedSurfaces.length &&
    inference.surfaces.every(
      ({ status }) => status === "confirmed" || status === "application-owned",
    )
  );
}

function createNextState(input: Readonly<{
  current: InstalledState;
  desired: Awaited<ReturnType<typeof renderSkeleton>> & Readonly<{ ok: true }>;
  actionPaths: readonly string[];
  files: ReadonlyMap<string, Uint8Array>;
  migration: MigrationRecord;
}>): InstalledState | undefined {
  const descriptors = [
    ...input.desired.value.surfaces,
    ...createBuilderStateSurfaces(),
  ].sort((left, right) => left.identifier.localeCompare(right.identifier));
  const changedPaths = new Set([
    ...input.actionPaths,
    ".egeria/migrations.jsonl",
  ]);
  const changedDescriptors = descriptors.filter(({ path }) =>
    changedPaths.has(path),
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

  const parsed = installedStateSchema.safeParse({
    ...input.current,
    installedCapabilities: createInstalledManifest(
      input.desired.value.resolved,
    ),
    appliedMigrations: [
      ...input.current.appliedMigrations,
      input.migration.identifier,
    ],
    managedSurfaces,
    lastSuccessfulVerification: {
      kind: "capability-addition",
      checks: capabilityAdditionPersistedVerificationChecks,
    },
  });
  return parsed.success ? parsed.data : undefined;
}

export async function applyCapabilityAddition(input: Readonly<{
  root: string;
  capability: AddableCapability;
  settings?: CalendlyBookingSettings;
  approvedPlanFingerprint: string;
  verifier: GeneratedProjectVerifier;
  reader?: RepositoryReader;
  writer?: CapabilityAdditionWriter;
  inspectWorktree?: InspectWorktree;
  inspectCreateTargets?: InspectCreateTargets;
  inspectExpectedChanges?: InspectExpectedChanges;
  now?: () => string;
}>): Promise<CapabilityAdditionExecutionResult> {
  const root = resolve(input.root);
  if (!isAbsolute(input.root) || root !== input.root) {
    return failure(
      "GIT_WORKTREE_IDENTITY_INVALID",
      "precondition",
      "not-required",
    );
  }

  const reader = input.reader ?? createFileSystemRepositoryReader(root);
  const writer = input.writer ?? createFileSystemCapabilityAdditionWriter(root);
  const inspectWorktreeValue = input.inspectWorktree ?? inspectGitWorktree;
  const inspectCreateTargetsValue =
    input.inspectCreateTargets ?? inspectGitCreateTargets;
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
    planResult = await planCapabilityAddition({
      reader,
      git: initialGit,
      capability: input.capability,
      ...(input.settings === undefined ? {} : { settings: input.settings }),
    });
  } catch {
    return failure(
      "REPOSITORY_OPEN_FAILED",
      "precondition",
      "not-required",
    );
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

  const controls = await readControlSnapshot(reader);
  if (controls === undefined) {
    return failure(
      "PROJECT_INSPECTION_INVALID",
      "precondition",
      "not-required",
    );
  }

  const desired = await renderSkeleton({
    profile: controls.project.value.originProfile,
    projectName: controls.project.value.project.name,
    displayName: controls.project.value.project.displayName,
    ...(input.capability === "booking-calendly"
      ? { bookingCalendly: input.settings }
      : controls.project.value.capabilitySettings["booking-calendly"] === undefined
        ? {}
        : {
            bookingCalendly:
              controls.project.value.capabilitySettings["booking-calendly"],
          }),
    ...(input.capability === "multilingual" ||
    controls.project.value.selectedCapabilities.includes("multilingual")
      ? { multilingual: true as const }
      : {}),
    packageVersions: verifiedCapabilityPackageVersions,
  });
  if (!desired.ok) {
    return failure(
      "PROJECT_INSPECTION_INVALID",
      "precondition",
      "not-required",
    );
  }

  const desiredFiles = new Map(
    desired.value.files.map(({ path, content }) => [path, content]),
  );
  desiredFiles.set(
    ".egeria/project.yaml",
    encoder.encode(serializeProjectYaml(desired.value.project)),
  );
  const changes: CapabilityAdditionFileChange[] = [];
  for (const action of plan.actions) {
    const content = desiredFiles.get(action.path);
    const current = await reader.readText(action.path);
    if (
      content === undefined ||
      (action.kind === "create-file" && current.kind !== "missing") ||
      (action.kind !== "create-file" && current.kind !== "file")
    ) {
      return failure(
        "CAPABILITY_ACTION_CONFLICT",
        "precondition",
        "not-required",
      );
    }
    changes.push({
      path: action.path,
      expected:
        current.kind === "file"
          ? { kind: "file", content: encoder.encode(current.content) }
          : { kind: "missing" },
      content,
    });
  }

  const createPaths = plan.actions.flatMap((action) =>
    action.kind === "create-file" ? [action.path] : [],
  );
  let createTargets: GitCreateTargetInspection;
  let finalCleanGit: GitWorktreeInspection;
  try {
    createTargets = await inspectCreateTargetsValue({ root, paths: createPaths });
    finalCleanGit = await inspectWorktreeValue({ root });
  } catch {
    return failure(
      "GIT_WORKTREE_IDENTITY_INVALID",
      "precondition",
      "not-required",
    );
  }
  if (!createTargets.ok) {
    return failure(createTargets.code, "precondition", "not-required");
  }
  if (!finalCleanGit.ok) {
    return failure(finalCleanGit.code, "precondition", "not-required");
  }
  if (!sameGitIdentity(initialGit.identity, finalCleanGit.identity)) {
    return failure(
      "GIT_WORKTREE_CHANGED",
      "precondition",
      "not-required",
    );
  }

  const transformed = await writer.write(changes);
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
  const pendingInference = await inferRepository({ reader, catalog: catalog.value });
  if (
    !requirePendingInference(
      pendingInference,
      controls.state.value,
      plan.desiredCapabilities,
      input.capability,
      plan.actions.flatMap((action) =>
        action.kind === "create-file" ? [] : [action.path],
      ),
    )
  ) {
    return failure(
      "CAPABILITY_REINFERENCE_FAILED",
      "re-infer",
      "inspect-worktree",
    );
  }

  const actionPaths = plan.actions.map(({ path }) => path);
  const actualFiles = await readExactFileBytes(
    reader,
    desiredFiles,
    actionPaths,
  );
  if (actualFiles === undefined) {
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
    identifier: additionMigrationIdentifier(input.capability),
    kind: "migration",
    outcome: "succeeded",
    completedAt,
    fromBuilderVersion: controls.state.value.builderVersion,
    toBuilderVersion: controls.state.value.builderVersion,
    capabilities: plan.desiredCapabilities,
    persistentDataAuthorizations: [],
    remainingKnownDrift: [],
    verificationChecks: capabilityAdditionPersistedVerificationChecks,
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
  actualFiles.set(".egeria/migrations.jsonl", preparedMigration.content);
  const nextState = createNextState({
    current: controls.state.value,
    desired,
    actionPaths,
    files: actualFiles,
    migration: migration.data,
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
    write: async (change) =>
      (
        await writer.write([
          {
            path: change.path,
            expected: { kind: "file", content: change.expected },
            content: change.content,
          },
        ])
      ).ok,
    readSource: async () => {
      const written = await reader.readText(".egeria/migrations.jsonl");
      return written.kind === "file" ? written.content : undefined;
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
    write: async (change) =>
      (
        await writer.write([
          {
            path: change.path,
            expected: { kind: "file", content: change.expected },
            content: change.content,
          },
        ])
      ).ok,
  });
  if (!persistedState.ok) {
    return failure(
      "CAPABILITY_STATE_WRITE_FAILED",
      "persist-state",
      "inspect-worktree",
    );
  }
  actualFiles.set(".egeria/state.json", persistedState.content);

  const finalInference = await inferRepository({ reader, catalog: catalog.value });
  if (
    !requireFinalInference(
      finalInference,
      nextState,
      plan.desiredCapabilities,
    )
  ) {
    return failure(
      "CAPABILITY_POST_STATE_FAILED",
      "post-state",
      "inspect-worktree",
    );
  }

  const changedPaths = [
    ...actionPaths,
    ".egeria/migrations.jsonl",
    ".egeria/state.json",
  ].sort();
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
    (await readExactFileBytes(reader, actualFiles, changedPaths)) === undefined
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
      migration: additionMigrationIdentifier(input.capability),
      changedPaths,
      verificationChecks: capabilityAdditionVerificationChecks,
    },
  };
}
