import { constants } from "node:fs";
import { lstat, open } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";

import {
  createCapabilityCatalogSnapshot,
  vitestFiveCapabilityCatalogSnapshot,
} from "../catalog/capability-catalog.js";
import { verifiedCapabilityPackageVersions } from "../catalog/verified-package-versions.js";
import type { ManagedSurfaceDescriptor } from "../contracts/capability.js";
import {
  appGenerationVerificationChecks,
} from "../contracts/generation-verification.js";
import { safeRelativePathSchema } from "../contracts/identifiers.js";
import {
  migrationRecordSchema,
  type MigrationRecord,
} from "../contracts/migration.js";
import {
  appProfileTransitionPersistedVerificationChecks,
  appProfileTransitionVerificationChecks,
  installedStateSchema,
  type InstalledState,
  type InstalledSurface,
} from "../contracts/state.js";
import { createBuilderStateSurfaces } from "../generation/builder-state-surfaces.js";
import {
  type RenderedSkeleton,
} from "../generation/render-skeleton.js";
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
import { serializeProjectYaml, serializeStateJson } from "../state/codecs.js";
import {
  createFileSystemProfileTransitionWriter,
  type ProfileTransitionFileChange,
  type ProfileTransitionWriter,
} from "./profile-transition-writer.js";
import {
  inspectGitCreateTargets,
  inspectGitExpectedChanges,
  inspectGitWorktree,
  sameGitIdentity,
  type GitCreateTargetInspection,
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
  readControlSnapshot,
  type ControlSnapshot,
} from "./lifecycle-control-snapshot.js";
import {
  prepareAppProfileTransitionExecution,
  type PreparedAppProfileTransition,
  type ProfileTransitionPlanningFailureCode,
} from "./plan-profile-transition.js";

const encoder = new TextEncoder();
const maximumExactFileBytes = 16 * 1024 * 1024;

export type ProfileTransitionPhase =
  | "precondition"
  | "transform"
  | "verify"
  | "re-infer"
  | "persist-project"
  | "persist-migration"
  | "persist-state"
  | "post-state"
  | "final-diff";

export type ProfileTransitionRecovery = "not-required" | "inspect-worktree";

type ProfileTransitionLocalFailureCode =
  | "REPOSITORY_OPEN_FAILED"
  | "PROFILE_TRANSITION_PLAN_APPROVAL_INVALID"
  | "PROFILE_TRANSITION_TRANSFORM_FAILED"
  | "PROFILE_TRANSITION_VERIFICATION_FAILED"
  | "PROFILE_TRANSITION_REINFERENCE_FAILED"
  | "PROFILE_TRANSITION_MIGRATION_RECORD_INVALID"
  | "PROFILE_TRANSITION_STATE_CONSTRUCTION_FAILED"
  | "PROFILE_TRANSITION_PROJECT_WRITE_FAILED"
  | "PROFILE_TRANSITION_MIGRATION_WRITE_FAILED"
  | "PROFILE_TRANSITION_STATE_WRITE_FAILED"
  | "PROFILE_TRANSITION_POST_STATE_FAILED"
  | "PROFILE_TRANSITION_FINAL_DIFF_FAILED";

export type ProfileTransitionFailureCode =
  | GitWorktreeRefusalCode
  | ProfileTransitionPlanningFailureCode
  | ProfileTransitionLocalFailureCode;

export type ProfileTransitionExecutionResult =
  | Readonly<{
      ok: true;
      value: Readonly<{
        status: "verified-final-diff-approval-required";
        baseRevision: string;
        transition: Readonly<{
          fromProfile: "portfolio" | "site";
          fromRecipeVersion: string;
          toProfile: "app";
          toRecipeVersion: "0.2.5";
        }>;
        migration:
          | "transition-portfolio-0-11-5-to-app-0-2-5"
          | "transition-site-0-12-5-to-app-0-2-5";
        changedPaths: readonly string[];
        verificationChecks: typeof appProfileTransitionVerificationChecks;
      }>;
    }>
  | Readonly<{
      ok: false;
      code: ProfileTransitionFailureCode;
      phase: ProfileTransitionPhase;
      recovery: ProfileTransitionRecovery;
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

type ExactByteReader = RepositoryReader;

type MaterializedTransition = Readonly<{
  changes: readonly ProfileTransitionFileChange[];
  targetBytes: ReadonlyMap<string, Uint8Array>;
  rendered: RenderedSkeleton;
  currentFiles: ReadonlyMap<string, Uint8Array>;
}>;

type PathIdentity = Readonly<{
  path: string;
  device: bigint;
  inode: bigint;
}>;

function failure(
  code: ProfileTransitionFailureCode,
  phase: ProfileTransitionPhase,
  recovery: ProfileTransitionRecovery,
): ProfileTransitionExecutionResult {
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

function sameStringSet(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return (
    left.length === right.length &&
    new Set(left).size === left.length &&
    left.every((value) => right.includes(value))
  );
}

function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
  return (
    left.length === right.length &&
    left.every((byte, index) => byte === right[index])
  );
}

function sameSurfaceDescriptor(
  installed: InstalledSurface,
  descriptor: ManagedSurfaceDescriptor | InstalledSurface,
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

function samePathIdentity(left: PathIdentity, right: PathIdentity): boolean {
  return left.device === right.device && left.inode === right.inode;
}

function materializeAppTransition(
  prepared: PreparedAppProfileTransition,
): MaterializedTransition | undefined {
  const changes: ProfileTransitionFileChange[] = [];
  for (const action of prepared.plan.actions) {
    const current = prepared.currentFiles.get(action.path);
    const content = prepared.targetFiles.get(action.path);
    if (
      content === undefined ||
      (action.kind === "create-file" ? current !== undefined : current === undefined)
    ) {
      return undefined;
    }
    changes.push({
      path: action.path,
      expected: current === undefined
        ? { kind: "missing" }
        : { kind: "file", content: current },
      content,
    });
  }
  return {
    changes,
    currentFiles: prepared.currentFiles,
    targetBytes: new Map([...prepared.currentFiles, ...prepared.targetFiles]),
    rendered: prepared.rendered,
  };
}

function verificationIsExact(
  value: GeneratedProjectVerification,
): boolean {
  return sameValues(
    value.checks,
    appGenerationVerificationChecks,
  );
}

async function readFileSystemBytes(
  root: string,
  path: string,
  afterRead?: (path: string) => Promise<unknown>,
): Promise<Uint8Array | undefined> {
  if (!safeRelativePathSchema.safeParse(path).success) {
    return undefined;
  }

  const identities: PathIdentity[] = [];
  let current = root;
  try {
    const rootStats = await lstat(root, { bigint: true });
    if (rootStats.isSymbolicLink() || !rootStats.isDirectory()) {
      return undefined;
    }
    identities.push({
      path: root,
      device: rootStats.dev,
      inode: rootStats.ino,
    });

    const segments = path.split("/");
    for (const [index, segment] of segments.entries()) {
      current = join(current, segment);
      const stats = await lstat(current, { bigint: true });
      if (
        stats.isSymbolicLink() ||
        (index === segments.length - 1 ? !stats.isFile() : !stats.isDirectory())
      ) {
        return undefined;
      }
      identities.push({ path: current, device: stats.dev, inode: stats.ino });
    }

    const handle = await open(current, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      const stats = await handle.stat({ bigint: true });
      const expectedLeaf = identities.at(-1);
      if (
        expectedLeaf === undefined ||
        !stats.isFile() ||
        stats.dev !== expectedLeaf.device ||
        stats.ino !== expectedLeaf.inode ||
        stats.size > BigInt(maximumExactFileBytes)
      ) {
        return undefined;
      }
      const content = new Uint8Array(await handle.readFile());
      await afterRead?.(path);

      for (const identity of identities) {
        const currentStats = await lstat(identity.path, { bigint: true });
        if (
          currentStats.isSymbolicLink() ||
          !samePathIdentity(identity, {
            path: identity.path,
            device: currentStats.dev,
            inode: currentStats.ino,
          })
        ) {
          return undefined;
        }
      }
      return content;
    } finally {
      await handle.close().catch(() => undefined);
    }
  } catch {
    return undefined;
  }
}

async function readExactBytes(
  root: string,
  reader: ExactByteReader,
  path: string,
  useFileSystemPathChecks: boolean,
  afterFileSystemRead?: (path: string) => Promise<unknown>,
): Promise<Uint8Array | undefined> {
  if (useFileSystemPathChecks) {
    return readFileSystemBytes(root, path, afterFileSystemRead);
  }
  if (reader.readBytes !== undefined) {
    try {
      const result = await reader.readBytes(path);
      return result.kind === "file" && result.content instanceof Uint8Array
        ? new Uint8Array(result.content)
        : undefined;
    } catch {
      return undefined;
    }
  }

  return readFileSystemBytes(root, path, afterFileSystemRead);
}

async function hasExactBytes(input: Readonly<{
  root: string;
  reader: ExactByteReader;
  expected: ReadonlyMap<string, Uint8Array>;
  paths: readonly string[];
  useFileSystemPathChecks: boolean;
  afterFileSystemRead?: (path: string) => Promise<unknown>;
}>): Promise<boolean> {
  for (const path of input.paths) {
    const expected = input.expected.get(path);
    const actual = await readExactBytes(
      input.root,
      input.reader,
      path,
      input.useFileSystemPathChecks,
      input.afterFileSystemRead,
    );
    if (
      expected === undefined ||
      actual === undefined ||
      !sameBytes(actual, expected)
    ) {
      return false;
    }
  }
  return true;
}

function requirePendingInference(input: Readonly<{
  inference: Awaited<ReturnType<typeof inferRepository>>;
  currentState: InstalledState;
  desiredCapabilities: readonly string[];
  target: MaterializedTransition;
}>): boolean {
  if (
    input.inference.state.kind !== "valid" ||
    serializeStateJson(input.inference.state.value) !==
      serializeStateJson(input.currentState)
  ) {
    return false;
  }

  const capabilities = new Map(
    input.inference.capabilities.map((evidence) => [
      evidence.identifier,
      evidence,
    ]),
  );
  if (
    capabilities.size !== input.desiredCapabilities.length ||
    input.desiredCapabilities.some((identifier) => {
      const evidence = capabilities.get(identifier);
      const added = !input.currentState.installedCapabilities.some(
        (capability) => capability.identifier === identifier,
      );
      return added
        ? evidence?.category !== "probable" ||
            evidence.probes.some(({ status }) => status !== "present")
        : evidence?.category !== "confirmed";
    })
  ) {
    return false;
  }

  const surfaces = new Map(
    input.currentState.managedSurfaces.map((surface) => [
      surface.identifier,
      surface,
    ]),
  );
  const expected = materializeInstalledSurfaces({
        files: input.target.targetBytes,
        surfaces: [...input.target.rendered.surfaces, ...createBuilderStateSurfaces()],
      });
  if (!expected.ok) return false;
  const targetSurfaces = new Map(
    expected.value.map(surface => [surface.identifier, surface]),
  );
  return (
    input.inference.surfaces.length === input.currentState.managedSurfaces.length &&
    input.inference.surfaces.every((evidence) => {
      const surface = surfaces.get(evidence.identifier);
      const targetSurface = targetSurfaces.get(evidence.identifier);
      if (
        surface === undefined || targetSurface === undefined ||
          !sameSurfaceDescriptor(surface, targetSurface)
      ) return false;
      const expectedStatus = surface.ownership === "application-owned"
        ? "application-owned"
        : surface.fingerprint === targetSurface.fingerprint ? "confirmed" : "drifted";
      return (
        evidence.path === surface.path &&
        evidence.status === expectedStatus
      );
    })
  );
}

function createNextState(input: Readonly<{
  current: InstalledState;
  rendered: RenderedSkeleton;
  actionPaths: readonly string[];
  files: ReadonlyMap<string, Uint8Array>;
  migration: MigrationRecord;
}>): InstalledState | undefined {
  const descriptors = [
    ...input.rendered.surfaces,
    ...createBuilderStateSurfaces(),
  ].sort((left, right) => compareText(left.identifier, right.identifier));
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

  const targetManifest = createInstalledManifest(input.rendered.resolved);

  const parsed = installedStateSchema.safeParse({
    ...input.current,
    origin: {
      profile: input.rendered.resolved.profile,
      recipeVersion: input.rendered.resolved.recipeVersion,
    },
    installedCapabilities: targetManifest,
    appliedMigrations: [
      ...input.current.appliedMigrations,
      input.migration.identifier,
    ],
    managedSurfaces,
    lastSuccessfulVerification: {
      kind: "profile-transition",
      checks: appProfileTransitionPersistedVerificationChecks,
    },
  });
  return parsed.success ? parsed.data : undefined;
}

function requireFinalInference(input: Readonly<{
  inference: Awaited<ReturnType<typeof inferRepository>>;
  state: InstalledState;
  desiredCapabilities: readonly string[];
}>): boolean {
  if (
    input.inference.state.kind !== "valid" ||
    serializeStateJson(input.inference.state.value) !==
      serializeStateJson(input.state) ||
    !sameStringSet(
      input.state.installedCapabilities.map(({ identifier }) => identifier),
      input.desiredCapabilities,
    ) ||
    input.inference.capabilities.length !== input.desiredCapabilities.length ||
    input.inference.capabilities.some(
      ({ identifier, category }) =>
        !input.desiredCapabilities.includes(identifier) || category !== "confirmed",
    )
  ) {
    return false;
  }

  const surfaces = new Map(
    input.state.managedSurfaces.map((surface) => [surface.identifier, surface]),
  );
  return (
    input.inference.surfaces.length === input.state.managedSurfaces.length &&
    input.inference.surfaces.every((evidence) => {
      const surface = surfaces.get(evidence.identifier);
      const expectedStatus =
        surface?.ownership === "application-owned"
          ? "application-owned"
          : "confirmed";
      return (
        evidence.path === surface?.path &&
        evidence.status === expectedStatus
      );
    })
  );
}

function finalControlsAgree(input: Readonly<{
  controls: ControlSnapshot;
  projectSource: string;
  expectedState: InstalledState;
  migrationSource: string;
  desiredCapabilities: readonly string[];
}>): boolean {
  return (
    input.controls.projectSource === input.projectSource &&
    serializeProjectYaml(input.controls.project.value) ===
      input.projectSource &&
    input.controls.stateSource === serializeStateJson(input.expectedState) &&
    input.controls.migrationSource === input.migrationSource &&
    sameStringSet(
      input.controls.project.value.selectedCapabilities,
      input.desiredCapabilities,
    ) &&
    input.controls.project.value.recipeVersion === input.expectedState.origin.recipeVersion &&
    input.controls.project.value.originProfile === input.expectedState.origin.profile &&
    sameValues(
      input.controls.migrations.value.map(({ identifier }) => identifier),
      input.expectedState.appliedMigrations,
    )
  );
}

export async function applyProfileTransition(input: Readonly<{
  root: string;
  toProfile: "site" | "app";
  approvedPlanFingerprint: string;
  verifier: GeneratedProjectVerifier;
  reader?: RepositoryReader;
  writer?: ProfileTransitionWriter;
  inspectWorktree?: InspectWorktree;
  inspectCreateTargets?: InspectCreateTargets;
  inspectExpectedChanges?: InspectExpectedChanges;
  constructState?: typeof createNextState;
  afterExactFileRead?: (path: string) => Promise<unknown>;
  now?: () => string;
}>): Promise<ProfileTransitionExecutionResult> {
  const runtimeTarget: unknown = Reflect.get(input, "toProfile");
  if (runtimeTarget !== "app") return failure("PROFILE_TRANSITION_UNSUPPORTED", "precondition", "not-required");
  const root = resolve(input.root);
  if (!isAbsolute(input.root) || root !== input.root) {
    return failure(
      "GIT_WORKTREE_IDENTITY_INVALID",
      "precondition",
      "not-required",
    );
  }

  const useFileSystemPathChecks = input.reader === undefined;
  const reader: ExactByteReader =
    input.reader ?? createFileSystemRepositoryReader(root);
  const writer = input.writer ?? createFileSystemProfileTransitionWriter(root);
  const inspectWorktreeValue = input.inspectWorktree ?? inspectGitWorktree;
  const inspectCreateTargetsValue =
    input.inspectCreateTargets ?? inspectGitCreateTargets;
  const inspectExpectedChangesValue =
    input.inspectExpectedChanges ?? inspectGitExpectedChanges;
  const constructState = input.constructState ?? createNextState;

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

  let appPreparation: PreparedAppProfileTransition;
  try {
    const prepared = await prepareAppProfileTransitionExecution({
      reader, git: initialGit,
      inspectCreateTargets: inspectCreateTargetsValue,
      inspectWorktree: inspectWorktreeValue,
    });
    if (!prepared.ok) {
      return failure(prepared.issues[0]?.code ?? "PROJECT_INSPECTION_INVALID", "precondition", "not-required");
    }
    appPreparation = prepared.value;
  } catch {
    return failure("REPOSITORY_OPEN_FAILED", "precondition", "not-required");
  }
  const plan = appPreparation.plan;
  const migrationIdentifier = plan.source.profile === "portfolio"
    ? "transition-portfolio-0-11-5-to-app-0-2-5"
    : "transition-site-0-12-5-to-app-0-2-5";
  const persistedChecks = appProfileTransitionPersistedVerificationChecks;
  const desiredCapabilities = plan.target.capabilities.map(
    ({ identifier }) => identifier,
  );
  if (input.approvedPlanFingerprint !== plan.planFingerprint) {
    return failure(
      "PROFILE_TRANSITION_PLAN_APPROVAL_INVALID",
      "precondition",
      "not-required",
    );
  }

  let controls: ControlSnapshot | undefined;
  let materialized: MaterializedTransition | undefined;
  try {
    controls = await readControlSnapshot(reader);
    if (controls !== undefined) {
      materialized = materializeAppTransition(appPreparation);
    }
  } catch {
    return failure("REPOSITORY_OPEN_FAILED", "precondition", "not-required");
  }
  if (controls === undefined) {
    return failure("PROJECT_INSPECTION_INVALID", "precondition", "not-required");
  }
  if (
    controls.state.value.appliedMigrations.includes(migrationIdentifier) ||
    controls.migrations.value.some(
      ({ identifier }) => identifier === migrationIdentifier,
    )
  ) {
    return failure(
      "PROJECT_STATE_INCOMPATIBLE",
      "precondition",
      "not-required",
    );
  }
  if (materialized === undefined) {
    return failure(
      "PROFILE_TRANSITION_ACTION_CONFLICT",
      "precondition",
      "not-required",
    );
  }

  // Re-run the complete policy with a new reader cache immediately before writes.
  try {
    const refreshed = await prepareAppProfileTransitionExecution({
      reader,
      git: initialGit,
      inspectCreateTargets: inspectCreateTargetsValue,
      inspectWorktree: inspectWorktreeValue,
    });
    if (!refreshed.ok) return failure(refreshed.issues[0]?.code ?? "PROJECT_INSPECTION_INVALID", "precondition", "not-required");
    if (refreshed.value.plan.planFingerprint !== input.approvedPlanFingerprint) {
      return failure("PROFILE_TRANSITION_PLAN_APPROVAL_INVALID", "precondition", "not-required");
    }
    materialized = materializeAppTransition(refreshed.value);
    if (materialized === undefined) return failure("PROFILE_TRANSITION_ACTION_CONFLICT", "precondition", "not-required");
  } catch {
    return failure("REPOSITORY_OPEN_FAILED", "precondition", "not-required");
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
    return failure(
      createTargets.code === "CAPABILITY_ACTION_CONFLICT"
        ? "PROFILE_TRANSITION_ACTION_CONFLICT"
        : createTargets.code,
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

  for (const [path, source] of [
    [".egeria/project.yaml", controls.projectSource],
    [".egeria/state.json", controls.stateSource],
    [".egeria/migrations.jsonl", controls.migrationSource],
  ] as const) {
    const approved = materialized.currentFiles.get(path);
    if (approved === undefined || !sameBytes(approved, encoder.encode(source))) {
      return failure("PROFILE_TRANSITION_PLAN_APPROVAL_INVALID", "precondition", "not-required");
    }
  }
  if (!(await hasExactBytes({
    root,
    reader,
    expected: materialized.currentFiles,
    paths: [...materialized.currentFiles.keys()],
    useFileSystemPathChecks,
  }))) {
    return failure("PROFILE_TRANSITION_PLAN_APPROVAL_INVALID", "precondition", "not-required");
  }
  try {
    for (const path of createPaths) {
      if ((await reader.readBytes?.(path))?.kind !== "missing") {
        return failure("PROFILE_TRANSITION_ACTION_CONFLICT", "precondition", "not-required");
      }
    }
  } catch {
    return failure("REPOSITORY_OPEN_FAILED", "precondition", "not-required");
  }

  let transformed;
  try {
    transformed = await writer.write(materialized.changes);
  } catch {
    transformed = { ok: false as const, sourceChanged: true };
  }
  if (!transformed.ok) {
    return failure(
      "PROFILE_TRANSITION_TRANSFORM_FAILED",
      "transform",
      transformed.sourceChanged ? "inspect-worktree" : "not-required",
    );
  }

  let verified;
  try {
    verified = await input.verifier.verifyInIsolatedCopy(root);
  } catch {
    return failure(
      "PROFILE_TRANSITION_VERIFICATION_FAILED",
      "verify",
      "inspect-worktree",
    );
  }
  if (!verified.ok || !verificationIsExact(verified.value)) {
    return failure(
      "PROFILE_TRANSITION_VERIFICATION_FAILED",
      "verify",
      "inspect-worktree",
    );
  }

  const targetCatalog = createCapabilityCatalogSnapshot(
    verifiedCapabilityPackageVersions,
    vitestFiveCapabilityCatalogSnapshot,
  );
  if (!targetCatalog.ok) {
    return failure(
      "PROFILE_TRANSITION_REINFERENCE_FAILED",
      "re-infer",
      "inspect-worktree",
    );
  }

  let pendingControls: ControlSnapshot | undefined;
  let pendingInference: Awaited<ReturnType<typeof inferRepository>>;
  try {
    pendingControls = await readControlSnapshot(reader);
    pendingInference = await inferRepository({
      reader,
      catalog: targetCatalog.value,
    });
  } catch {
    return failure(
      "PROFILE_TRANSITION_REINFERENCE_FAILED",
      "re-infer",
      "inspect-worktree",
    );
  }
  const actionPaths = [
    ...plan.actions.map(({ path }) => path),
    ".egeria/project.yaml",
  ];
  const pendingPaths = [...materialized.targetBytes.keys()];
  if (
    pendingControls?.projectSource !==
      controls.projectSource ||
    pendingControls.stateSource !== controls.stateSource ||
    pendingControls.migrationSource !== controls.migrationSource ||
    !requirePendingInference({
      inference: pendingInference,
      currentState: controls.state.value,
      desiredCapabilities,
      target: materialized,
    }) ||
    !(await hasExactBytes({
      root,
      reader,
      expected: materialized.targetBytes,
      paths: pendingPaths,
      useFileSystemPathChecks,
      ...(input.afterExactFileRead === undefined
        ? {}
        : { afterFileSystemRead: input.afterExactFileRead }),
    }))
  ) {
    return failure(
      "PROFILE_TRANSITION_REINFERENCE_FAILED",
      "re-infer",
      "inspect-worktree",
    );
  }

  let completedAt: string;
  try {
    completedAt = (input.now ?? (() => new Date().toISOString()))();
  } catch {
    return failure(
      "PROFILE_TRANSITION_MIGRATION_RECORD_INVALID",
      "persist-migration",
      "inspect-worktree",
    );
  }
  const migration = migrationRecordSchema.safeParse({
    schemaVersion: "1.0.0",
    identifier: migrationIdentifier,
    kind: "migration",
    outcome: "succeeded",
    completedAt,
    fromBuilderVersion: "0.0.0",
    toBuilderVersion: "0.0.0",
    capabilities: desiredCapabilities,
    persistentDataAuthorizations: [],
    remainingKnownDrift: [],
    verificationChecks: persistedChecks,
  });
  if (!migration.success) {
    return failure(
      "PROFILE_TRANSITION_MIGRATION_RECORD_INVALID",
      "persist-migration",
      "inspect-worktree",
    );
  }

  const projectBytes = encoder.encode(serializeProjectYaml(materialized.rendered.project));
  try {
    const written = await writer.write([{
      path: ".egeria/project.yaml",
      expected: { kind: "file", content: encoder.encode(controls.projectSource) },
      content: projectBytes,
    }]);
    const reread = await reader.readBytes?.(".egeria/project.yaml");
    if (!written.ok || reread?.kind !== "file" || !sameBytes(reread.content, projectBytes)) {
      return failure("PROFILE_TRANSITION_PROJECT_WRITE_FAILED", "persist-project", "inspect-worktree");
    }
  } catch {
    return failure("PROFILE_TRANSITION_PROJECT_WRITE_FAILED", "persist-project", "inspect-worktree");
  }
  materialized = {
    ...materialized,
    targetBytes: new Map([
      ...materialized.targetBytes,
      [".egeria/project.yaml", projectBytes],
    ]),
  };

  const preparedMigration = prepareMigrationRecord({
    currentSource: controls.migrationSource,
    currentIdentifiers: controls.state.value.appliedMigrations,
    record: migration.data,
  });
  const persistedMigration = await persistMigrationRecord({
    prepared: preparedMigration,
    write: async (change) => {
      try {
        return (
          await writer.write([
            {
              path: change.path,
              expected: { kind: "file", content: change.expected },
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
      "PROFILE_TRANSITION_MIGRATION_WRITE_FAILED",
      "persist-migration",
      "inspect-worktree",
    );
  }

  const expectedBytes = new Map(materialized.targetBytes);
  expectedBytes.set(".egeria/migrations.jsonl", persistedMigration.content);
  let nextState: InstalledState | undefined;
  try {
    nextState = constructState({
      current: controls.state.value,
      rendered: materialized.rendered,
      actionPaths,
      files: expectedBytes,
      migration: migration.data,
    });
  } catch {
    nextState = undefined;
  }
  if (nextState === undefined) {
    return failure(
      "PROFILE_TRANSITION_STATE_CONSTRUCTION_FAILED",
      "persist-state",
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
              path: change.path,
              expected: { kind: "file", content: change.expected },
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
      "PROFILE_TRANSITION_STATE_WRITE_FAILED",
      "persist-state",
      "inspect-worktree",
    );
  }
  expectedBytes.set(".egeria/state.json", persistedState.content);

  let finalControls: ControlSnapshot | undefined;
  let finalInference: Awaited<ReturnType<typeof inferRepository>>;
  try {
    finalControls = await readControlSnapshot(reader);
    finalInference = await inferRepository({
      reader,
      catalog: targetCatalog.value,
    });
  } catch {
    return failure(
      "PROFILE_TRANSITION_POST_STATE_FAILED",
      "post-state",
      "inspect-worktree",
    );
  }
  if (
    finalControls === undefined ||
    !finalControlsAgree({
      controls: finalControls,
      projectSource: serializeProjectYaml(materialized.rendered.project),
      expectedState: nextState,
      migrationSource: persistedMigration.source,
      desiredCapabilities,
    }) ||
    !requireFinalInference({
      inference: finalInference,
      state: nextState,
      desiredCapabilities,
    })
  ) {
    return failure(
      "PROFILE_TRANSITION_POST_STATE_FAILED",
      "post-state",
      "inspect-worktree",
    );
  }

  const changedPaths = [
    ...actionPaths,
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

  const finalExpected = new Map(expectedBytes);
  if (
    !(await hasExactBytes({
      root,
      reader,
      expected: finalExpected,
      paths: [...finalExpected.keys()].sort(compareText),
      useFileSystemPathChecks,
      ...(input.afterExactFileRead === undefined
        ? {}
        : { afterFileSystemRead: input.afterExactFileRead }),
    }))
  ) {
    return failure(
      "PROFILE_TRANSITION_FINAL_DIFF_FAILED",
      "final-diff",
      "inspect-worktree",
    );
  }

  return {
    ok: true,
    value: {
      status: "verified-final-diff-approval-required",
      baseRevision: initialGit.identity.revision,
      transition: {
        fromProfile: plan.source.profile,
        fromRecipeVersion: plan.source.recipeVersion,
        toProfile: plan.target.profile,
        toRecipeVersion: plan.target.recipeVersion,
      },
      migration: migrationIdentifier,
      changedPaths,
      verificationChecks: appProfileTransitionVerificationChecks,
    },
  };
}
