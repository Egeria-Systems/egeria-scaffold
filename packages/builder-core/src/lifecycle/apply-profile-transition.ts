import { constants } from "node:fs";
import { lstat, open } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";

import { createCapabilityCatalogSnapshot } from "../catalog/capability-catalog.js";
import { verifiedCapabilityPackageVersions } from "../catalog/verified-package-versions.js";
import type { ManagedSurfaceDescriptor } from "../contracts/capability.js";
import { ordinaryGenerationVerificationChecks } from "../contracts/generation-verification.js";
import { safeRelativePathSchema } from "../contracts/identifiers.js";
import {
  migrationRecordSchema,
  type MigrationRecord,
} from "../contracts/migration.js";
import {
  profileTransitionPersistedVerificationChecks,
  profileTransitionVerificationChecks,
  installedStateSchema,
  type InstalledState,
  type InstalledSurface,
} from "../contracts/state.js";
import { createBuilderStateSurfaces } from "../generation/builder-state-surfaces.js";
import {
  renderSkeleton,
  type RenderedSkeleton,
} from "../generation/render-skeleton.js";
import type {
  GeneratedProjectVerification,
  GeneratedProjectVerifier,
} from "../generation/verify-generated-project.js";
import { inferRepository } from "../inference/infer-repository.js";
import { createInstalledManifest } from "../manifest/create-installed-manifest.js";
import { fingerprintFileContent } from "../ownership/fingerprint.js";
import { materializeInstalledSurfaces } from "../ownership/materialize-surfaces.js";
import {
  createFileSystemRepositoryReader,
  type RepositoryReader,
} from "../repository/repository-reader.js";
import {
  parseMigrationLog,
  parseProjectYaml,
  parseStateJson,
  serializeMigrationRecord,
  serializeProjectYaml,
  serializeStateJson,
} from "../state/codecs.js";
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
  planProfileTransition,
  type ProfileTransitionAction,
  type ProfileTransitionPlan,
  type ProfileTransitionPlanningFailureCode,
} from "./plan-profile-transition.js";

const encoder = new TextEncoder();
const migrationIdentifier = "transition-portfolio-0-10-0-to-site-0-10-0";
const maximumExactFileBytes = 16 * 1024 * 1024;
const exactActionShape = [
  ["replace-file", ".egeria/project.yaml"],
  ["create-file", "apps/web/app/about/page.tsx"],
  ["create-file", "apps/web/content/en-CA/about.yaml"],
  ["replace-file", "apps/web/content/en-CA/long-form/introduction.md"],
  ["replace-file", "apps/web/content/en-CA/site.yaml"],
  [
    "replace-file",
    "apps/web/tests/visual/home-visual.spec.ts-snapshots/home-desktop-chromium-linux.png",
  ],
  [
    "replace-file",
    "apps/web/tests/visual/home-visual.spec.ts-snapshots/home-mobile-chromium-linux.png",
  ],
] as const;

export type ProfileTransitionPhase =
  | "precondition"
  | "transform"
  | "verify"
  | "re-infer"
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
          fromProfile: "portfolio";
          fromRecipeVersion: "0.10.0";
          toProfile: "site";
          toRecipeVersion: "0.10.0";
        }>;
        migration: typeof migrationIdentifier;
        changedPaths: readonly string[];
        verificationChecks: typeof profileTransitionVerificationChecks;
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

type ControlSnapshot = Readonly<{
  projectSource: string;
  stateSource: string;
  migrationSource: string;
  project: ReturnType<typeof parseProjectYaml> & Readonly<{ ok: true }>;
  state: ReturnType<typeof parseStateJson> & Readonly<{ ok: true }>;
  migrations: ReturnType<typeof parseMigrationLog> & Readonly<{ ok: true }>;
}>;

type MaterializedTransition = Readonly<{
  changes: readonly ProfileTransitionFileChange[];
  targetBytes: ReadonlyMap<string, Uint8Array>;
  rendered: RenderedSkeleton;
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

function samePathIdentity(left: PathIdentity, right: PathIdentity): boolean {
  return left.device === right.device && left.inode === right.inode;
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

function controlEvidenceMatches(
  controls: ControlSnapshot,
  plan: ProfileTransitionPlan,
): boolean {
  const sources = new Map([
    [".egeria/migrations.jsonl", controls.migrationSource],
    [".egeria/project.yaml", controls.projectSource],
    [".egeria/state.json", controls.stateSource],
  ]);

  return (
    plan.controlFiles.length === sources.size &&
    plan.controlFiles.every(({ path, fingerprint }) => {
      const source = sources.get(path);
      return (
        source !== undefined &&
        fingerprintFileContent(encoder.encode(source)) === fingerprint
      );
    })
  );
}

function hasExactActionShape(actions: readonly ProfileTransitionAction[]): boolean {
  return (
    JSON.stringify(actions.map(({ kind, path }) => [kind, path])) ===
    JSON.stringify(exactActionShape)
  );
}

async function materializeTransition(input: Readonly<{
  reader: RepositoryReader;
  controls: ControlSnapshot;
  plan: ProfileTransitionPlan;
}>): Promise<MaterializedTransition | undefined> {
  if (!hasExactActionShape(input.plan.actions)) {
    return undefined;
  }

  const rendered = await renderSkeleton({
    profile: "site",
    projectName: input.controls.project.value.project.name,
    displayName: input.controls.project.value.project.displayName,
    packageVersions: verifiedCapabilityPackageVersions,
    ...(input.controls.project.value.capabilitySettings["booking-calendly"] ===
    undefined
      ? {}
      : {
          bookingCalendly:
            input.controls.project.value.capabilitySettings[
              "booking-calendly"
            ],
        }),
  });
  if (!rendered.ok) {
    return undefined;
  }

  const renderedFiles = new Map(
    rendered.value.files.map(({ path, content }) => [path, content]),
  );
  const changes: ProfileTransitionFileChange[] = [];
  const targetBytes = new Map<string, Uint8Array>();

  for (const action of input.plan.actions) {
    const current = await input.reader.readBytes?.(action.path);
    const content =
      action.path === ".egeria/project.yaml"
        ? encoder.encode(serializeProjectYaml(rendered.value.project))
        : renderedFiles.get(action.path);

    if (
      current === undefined ||
      content === undefined ||
      (action.kind === "create-file" && current.kind !== "missing") ||
      (action.kind === "replace-file" &&
        (current.kind !== "file" ||
          action.currentSubject.kind !== "fingerprint" ||
          fingerprintFileContent(current.content) !==
            action.currentSubject.fingerprint)) ||
      fingerprintFileContent(content) !== action.targetFingerprint
    ) {
      return undefined;
    }

    changes.push({
      path: action.path,
      expected:
        current.kind === "file"
          ? { kind: "file", content: current.content }
          : { kind: "missing" },
      content,
    });
    targetBytes.set(action.path, content);
  }

  return { changes, targetBytes, rendered: rendered.value };
}

function verificationIsExact(value: GeneratedProjectVerification): boolean {
  return sameValues(value.checks, ordinaryGenerationVerificationChecks);
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
      return identifier === "site-routing"
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
  return (
    input.inference.surfaces.length === input.currentState.managedSurfaces.length &&
    input.inference.surfaces.every((evidence) => {
      const surface = surfaces.get(evidence.identifier);
      const expectedStatus =
        surface?.identifier === "builder-project-configuration"
          ? "drifted"
          : surface?.ownership === "application-owned"
            ? "application-owned"
            : "confirmed";
      return (
        evidence.path === surface?.path &&
        evidence.status === expectedStatus
      );
    })
  );
}

function appendMigrationSource(current: string, record: MigrationRecord): string {
  const separator = current.length > 0 && !current.endsWith("\n") ? "\n" : "";
  return `${current}${separator}${serializeMigrationRecord(record)}`;
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
      checks: profileTransitionPersistedVerificationChecks,
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
    input.controls.project.value.recipeVersion === "0.10.0" &&
    input.controls.project.value.originProfile === "site" &&
    sameValues(
      input.controls.migrations.value.map(({ identifier }) => identifier),
      input.expectedState.appliedMigrations,
    )
  );
}

export async function applyProfileTransition(input: Readonly<{
  root: string;
  toProfile: "site";
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

  let planResult: Awaited<ReturnType<typeof planProfileTransition>>;
  try {
    planResult = await planProfileTransition({
      reader,
      git: initialGit,
      toProfile: input.toProfile,
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
    if (controls !== undefined && controlEvidenceMatches(controls, plan)) {
      materialized = await materializeTransition({ reader, controls, plan });
    }
  } catch {
    return failure("REPOSITORY_OPEN_FAILED", "precondition", "not-required");
  }
  if (controls === undefined) {
    return failure("PROJECT_INSPECTION_INVALID", "precondition", "not-required");
  }
  if (!controlEvidenceMatches(controls, plan)) {
    return failure(
      "PROFILE_TRANSITION_PLAN_APPROVAL_INVALID",
      "precondition",
      "not-required",
    );
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
    { standards: "0.4.0" },
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
  const actionPaths = plan.actions.map(({ path }) => path);
  if (
    pendingControls?.projectSource !==
      serializeProjectYaml(materialized.rendered.project) ||
    pendingControls.stateSource !== controls.stateSource ||
    pendingControls.migrationSource !== controls.migrationSource ||
    !requirePendingInference({
      inference: pendingInference,
      currentState: controls.state.value,
      desiredCapabilities,
    }) ||
    !(await hasExactBytes({
      root,
      reader,
      expected: materialized.targetBytes,
      paths: actionPaths,
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
    verificationChecks: profileTransitionPersistedVerificationChecks,
  });
  if (!migration.success) {
    return failure(
      "PROFILE_TRANSITION_MIGRATION_RECORD_INVALID",
      "persist-migration",
      "inspect-worktree",
    );
  }

  const migrationSource = appendMigrationSource(
    controls.migrationSource,
    migration.data,
  );
  let migrationWrite;
  try {
    migrationWrite = await writer.write([
      {
        path: ".egeria/migrations.jsonl",
        expected: {
          kind: "file",
          content: encoder.encode(controls.migrationSource),
        },
        content: encoder.encode(migrationSource),
      },
    ]);
  } catch {
    migrationWrite = { ok: false as const, sourceChanged: true };
  }
  if (!migrationWrite.ok) {
    return failure(
      "PROFILE_TRANSITION_MIGRATION_WRITE_FAILED",
      "persist-migration",
      "inspect-worktree",
    );
  }

  let writtenMigration;
  try {
    writtenMigration = await reader.readText(".egeria/migrations.jsonl");
  } catch {
    writtenMigration = { kind: "missing" as const };
  }
  const parsedWrittenMigration =
    writtenMigration.kind === "file"
      ? parseMigrationLog(writtenMigration.content)
      : undefined;
  if (
    writtenMigration.kind !== "file" ||
    writtenMigration.content !== migrationSource ||
    parsedWrittenMigration?.ok !== true ||
    !sameValues(
      parsedWrittenMigration.value.map(({ identifier }) => identifier),
      [...controls.state.value.appliedMigrations, migrationIdentifier],
    )
  ) {
    return failure(
      "PROFILE_TRANSITION_MIGRATION_WRITE_FAILED",
      "persist-migration",
      "inspect-worktree",
    );
  }

  const expectedBytes = new Map(materialized.targetBytes);
  expectedBytes.set(
    ".egeria/migrations.jsonl",
    encoder.encode(migrationSource),
  );
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

  const stateSource = serializeStateJson(nextState);
  let stateWrite;
  try {
    stateWrite = await writer.write([
      {
        path: ".egeria/state.json",
        expected: {
          kind: "file",
          content: encoder.encode(controls.stateSource),
        },
        content: encoder.encode(stateSource),
      },
    ]);
  } catch {
    stateWrite = { ok: false as const, sourceChanged: true };
  }
  if (!stateWrite.ok) {
    return failure(
      "PROFILE_TRANSITION_STATE_WRITE_FAILED",
      "persist-state",
      "inspect-worktree",
    );
  }
  expectedBytes.set(".egeria/state.json", encoder.encode(stateSource));

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
      migrationSource,
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
      paths: changedPaths,
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
      verificationChecks: profileTransitionVerificationChecks,
    },
  };
}
