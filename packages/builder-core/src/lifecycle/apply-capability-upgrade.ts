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
  capabilityUpgradePersistedVerificationChecks,
  capabilityUpgradeVerificationChecks,
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
import {
  fingerprintFileContent,
  fingerprintJsonValue,
} from "../ownership/fingerprint.js";
import { materializeInstalledSurfaces } from "../ownership/materialize-surfaces.js";
import {
  createFileSystemRepositoryReader,
  type RepositoryReader,
} from "../repository/repository-reader.js";
import {
  canonicalizeJsonValue,
  resolveJsonPointer,
  stringifyCanonicalJson,
  type JsonValue,
} from "../serialization/canonical-json.js";
import {
  parseMigrationLog,
  parseProjectYaml,
  parseStateJson,
  serializeMigrationRecord,
  serializeProjectYaml,
  serializeStateJson,
} from "../state/codecs.js";
import {
  createFileSystemCapabilityUpgradeWriter,
  type CapabilityUpgradeFileChange,
  type CapabilityUpgradeWriter,
} from "./capability-upgrade-writer.js";
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
  planCapabilityUpgrade,
  type CapabilityUpgradeAction,
  type CapabilityUpgradePlan,
  type CapabilityUpgradePlanningFailureCode,
} from "./plan-capability-upgrade.js";

const encoder = new TextEncoder();
const migrationIdentifier = "upgrade-standards-0-3-0-to-0-4-0";
const visualTestScript =
  "playwright test --config playwright.visual.config.ts";
const maximumExactFileBytes = 16 * 1024 * 1024;
const exactActionShape = [
  ["replace-file", ".github/workflows/quality.yml"],
  ["set-json-value", "apps/web/package.json"],
  ["create-file", "apps/web/playwright.visual.config.ts"],
  ["create-file", "apps/web/tests/visual/home-visual.spec.ts"],
  [
    "create-file",
    "apps/web/tests/visual/home-visual.spec.ts-snapshots/home-desktop-chromium-linux.png",
  ],
  [
    "create-file",
    "apps/web/tests/visual/home-visual.spec.ts-snapshots/home-mobile-chromium-linux.png",
  ],
] as const;

export type CapabilityUpgradePhase =
  | "precondition"
  | "transform"
  | "verify"
  | "re-infer"
  | "persist-migration"
  | "persist-state"
  | "post-state"
  | "final-diff";

export type CapabilityUpgradeRecovery = "not-required" | "inspect-worktree";

type CapabilityUpgradeLocalFailureCode =
  | "REPOSITORY_OPEN_FAILED"
  | "CAPABILITY_PLAN_APPROVAL_INVALID"
  | "CAPABILITY_TRANSFORM_FAILED"
  | "CAPABILITY_VERIFICATION_FAILED"
  | "CAPABILITY_REINFERENCE_FAILED"
  | "CAPABILITY_MIGRATION_RECORD_INVALID"
  | "CAPABILITY_STATE_CONSTRUCTION_FAILED"
  | "CAPABILITY_MIGRATION_WRITE_FAILED"
  | "CAPABILITY_STATE_WRITE_FAILED"
  | "CAPABILITY_POST_STATE_FAILED"
  | "CAPABILITY_FINAL_DIFF_FAILED";

export type CapabilityUpgradeFailureCode =
  | GitWorktreeRefusalCode
  | CapabilityUpgradePlanningFailureCode
  | CapabilityUpgradeLocalFailureCode;

export type CapabilityUpgradeExecutionResult =
  | Readonly<{
      ok: true;
      value: Readonly<{
        status: "verified-final-diff-approval-required";
        baseRevision: string;
        capability: Readonly<{
          identifier: "standards";
          fromVersion: "0.3.0";
          toVersion: "0.4.0";
        }>;
        migration: typeof migrationIdentifier;
        changedPaths: readonly string[];
        verificationChecks: typeof capabilityUpgradeVerificationChecks;
      }>;
    }>
  | Readonly<{
      ok: false;
      code: CapabilityUpgradeFailureCode;
      phase: CapabilityUpgradePhase;
      recovery: CapabilityUpgradeRecovery;
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

type ExactByteReadResult =
  | Readonly<{ kind: "file"; content: Uint8Array }>
  | Readonly<{ kind: "missing" | "invalid" }>;

type ExactByteReader = RepositoryReader &
  Readonly<{
    readBytes?: (path: string) => Promise<ExactByteReadResult>;
  }>;

type ControlSnapshot = Readonly<{
  projectSource: string;
  stateSource: string;
  migrationSource: string;
  project: ReturnType<typeof parseProjectYaml> & Readonly<{ ok: true }>;
  state: ReturnType<typeof parseStateJson> & Readonly<{ ok: true }>;
  migrations: ReturnType<typeof parseMigrationLog> & Readonly<{ ok: true }>;
}>;

type MaterializedUpgrade = Readonly<{
  changes: readonly CapabilityUpgradeFileChange[];
  targetBytes: ReadonlyMap<string, Uint8Array>;
  rendered: RenderedSkeleton;
}>;

type PathIdentity = Readonly<{
  path: string;
  device: bigint;
  inode: bigint;
}>;

function failure(
  code: CapabilityUpgradeFailureCode,
  phase: CapabilityUpgradePhase,
  recovery: CapabilityUpgradeRecovery,
): CapabilityUpgradeExecutionResult {
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

function isJsonObject(
  value: JsonValue,
): value is Readonly<Record<string, JsonValue>> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function withVisualTestScript(source: string): Uint8Array | undefined {
  try {
    const manifest = canonicalizeJsonValue(JSON.parse(source) as unknown);
    if (!isJsonObject(manifest)) {
      return undefined;
    }

    const scripts = manifest.scripts;
    if (
      scripts === undefined ||
      !isJsonObject(scripts) ||
      Object.hasOwn(scripts, "test:visual")
    ) {
      return undefined;
    }

    return encoder.encode(
      `${stringifyCanonicalJson({
        ...manifest,
        scripts: { ...scripts, "test:visual": visualTestScript },
      })}\n`,
    );
  } catch {
    return undefined;
  }
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
  plan: CapabilityUpgradePlan,
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

function hasExactActionShape(actions: readonly CapabilityUpgradeAction[]): boolean {
  return (
    JSON.stringify(actions.map(({ kind, path }) => [kind, path])) ===
    JSON.stringify(exactActionShape)
  );
}

async function materializeUpgrade(input: Readonly<{
  reader: RepositoryReader;
  controls: ControlSnapshot;
  plan: CapabilityUpgradePlan;
}>): Promise<MaterializedUpgrade | undefined> {
  if (!hasExactActionShape(input.plan.actions)) {
    return undefined;
  }

  const rendered = await renderSkeleton({
    profile: input.controls.project.value.originProfile,
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
  const changes: CapabilityUpgradeFileChange[] = [];
  const targetBytes = new Map<string, Uint8Array>();

  for (const action of input.plan.actions) {
    const current = await input.reader.readText(action.path);
    let content: Uint8Array | undefined;

    if (action.kind === "set-json-value") {
      if (current.kind !== "file") {
        return undefined;
      }
      const manifest = (() => {
        try {
          return canonicalizeJsonValue(JSON.parse(current.content) as unknown);
        } catch {
          return undefined;
        }
      })();
      if (
        manifest === undefined ||
        resolveJsonPointer(manifest, action.pointer).found ||
        fingerprintJsonValue(visualTestScript) !== action.targetFingerprint
      ) {
        return undefined;
      }
      content = withVisualTestScript(current.content);
    } else {
      content = renderedFiles.get(action.path);
      if (
        content === undefined ||
        fingerprintFileContent(content) !== action.targetFingerprint
      ) {
        return undefined;
      }
    }

    if (
      content === undefined ||
      (action.kind === "create-file" && current.kind !== "missing") ||
      (action.kind !== "create-file" && current.kind !== "file")
    ) {
      return undefined;
    }

    changes.push({
      path: action.path,
      expected:
        current.kind === "file"
          ? { kind: "file", content: encoder.encode(current.content) }
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
): Promise<Uint8Array | undefined> {
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

  return readFileSystemBytes(root, path);
}

async function hasExactBytes(input: Readonly<{
  root: string;
  reader: ExactByteReader;
  expected: ReadonlyMap<string, Uint8Array>;
  paths: readonly string[];
}>): Promise<boolean> {
  for (const path of input.paths) {
    const expected = input.expected.get(path);
    const actual = await readExactBytes(input.root, input.reader, path);
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
      return identifier === "standards"
        ? evidence?.category !== "contradictory" ||
            evidence.code !== "CAPABILITY_METADATA_MISMATCH" ||
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
        surface?.identifier === "standards-quality-workflow"
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

  const standards = input.current.installedCapabilities.filter(
    ({ identifier }) => identifier === "standards",
  );
  if (standards.length !== 1 || standards[0]?.version !== "0.3.0") {
    return undefined;
  }

  const parsed = installedStateSchema.safeParse({
    ...input.current,
    installedCapabilities: input.current.installedCapabilities.map(
      (capability) =>
        capability.identifier === "standards"
          ? { ...capability, version: "0.4.0" }
          : capability,
    ),
    appliedMigrations: [
      ...input.current.appliedMigrations,
      input.migration.identifier,
    ],
    managedSurfaces,
    lastSuccessfulVerification: {
      kind: "capability-upgrade",
      checks: capabilityUpgradePersistedVerificationChecks,
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
  original: ControlSnapshot;
  expectedState: InstalledState;
  migrationSource: string;
  desiredCapabilities: readonly string[];
}>): boolean {
  return (
    input.controls.projectSource === input.original.projectSource &&
    serializeProjectYaml(input.controls.project.value) ===
      input.original.projectSource &&
    input.controls.stateSource === serializeStateJson(input.expectedState) &&
    input.controls.migrationSource === input.migrationSource &&
    sameStringSet(
      input.controls.project.value.selectedCapabilities,
      input.desiredCapabilities,
    ) &&
    input.controls.project.value.recipeVersion ===
      input.original.project.value.recipeVersion &&
    input.controls.project.value.originProfile ===
      input.original.project.value.originProfile &&
    sameValues(
      input.controls.migrations.value.map(({ identifier }) => identifier),
      input.expectedState.appliedMigrations,
    )
  );
}

export async function applyCapabilityUpgrade(input: Readonly<{
  root: string;
  capability: "standards";
  toVersion: "0.4.0";
  approvedPlanFingerprint: string;
  verifier: GeneratedProjectVerifier;
  reader?: RepositoryReader;
  writer?: CapabilityUpgradeWriter;
  inspectWorktree?: InspectWorktree;
  inspectCreateTargets?: InspectCreateTargets;
  inspectExpectedChanges?: InspectExpectedChanges;
  now?: () => string;
}>): Promise<CapabilityUpgradeExecutionResult> {
  const root = resolve(input.root);
  if (!isAbsolute(input.root) || root !== input.root) {
    return failure(
      "GIT_WORKTREE_IDENTITY_INVALID",
      "precondition",
      "not-required",
    );
  }

  const reader: ExactByteReader =
    input.reader ?? createFileSystemRepositoryReader(root);
  const writer = input.writer ?? createFileSystemCapabilityUpgradeWriter(root);
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

  let planResult: Awaited<ReturnType<typeof planCapabilityUpgrade>>;
  try {
    planResult = await planCapabilityUpgrade({
      reader,
      git: initialGit,
      capability: input.capability,
      toVersion: input.toVersion,
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
  let materialized: MaterializedUpgrade | undefined;
  try {
    controls = await readControlSnapshot(reader);
    if (controls !== undefined && controlEvidenceMatches(controls, plan)) {
      materialized = await materializeUpgrade({ reader, controls, plan });
    }
  } catch {
    return failure("REPOSITORY_OPEN_FAILED", "precondition", "not-required");
  }
  if (controls === undefined) {
    return failure("PROJECT_INSPECTION_INVALID", "precondition", "not-required");
  }
  if (!controlEvidenceMatches(controls, plan)) {
    return failure(
      "CAPABILITY_PLAN_APPROVAL_INVALID",
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
      "CAPABILITY_ACTION_CONFLICT",
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
    return failure(createTargets.code, "precondition", "not-required");
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

  const targetCatalog = createCapabilityCatalogSnapshot(
    verifiedCapabilityPackageVersions,
    { standards: "0.4.0" },
  );
  if (!targetCatalog.ok) {
    return failure(
      "CAPABILITY_REINFERENCE_FAILED",
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
      "CAPABILITY_REINFERENCE_FAILED",
      "re-infer",
      "inspect-worktree",
    );
  }
  const actionPaths = plan.actions.map(({ path }) => path);
  if (
    pendingControls?.projectSource !== controls.projectSource ||
    pendingControls.stateSource !== controls.stateSource ||
    pendingControls.migrationSource !== controls.migrationSource ||
    !requirePendingInference({
      inference: pendingInference,
      currentState: controls.state.value,
      desiredCapabilities: plan.desiredCapabilities,
    }) ||
    !(await hasExactBytes({
      root,
      reader,
      expected: materialized.targetBytes,
      paths: actionPaths,
    }))
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
    capabilities: plan.desiredCapabilities,
    persistentDataAuthorizations: [],
    remainingKnownDrift: [],
    verificationChecks: capabilityUpgradePersistedVerificationChecks,
  });
  if (!migration.success) {
    return failure(
      "CAPABILITY_MIGRATION_RECORD_INVALID",
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
      "CAPABILITY_MIGRATION_WRITE_FAILED",
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
      "CAPABILITY_MIGRATION_WRITE_FAILED",
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
    nextState = createNextState({
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
      "CAPABILITY_STATE_CONSTRUCTION_FAILED",
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
      "CAPABILITY_STATE_WRITE_FAILED",
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
      "CAPABILITY_POST_STATE_FAILED",
      "post-state",
      "inspect-worktree",
    );
  }
  if (
    finalControls === undefined ||
    !finalControlsAgree({
      controls: finalControls,
      original: controls,
      expectedState: nextState,
      migrationSource,
      desiredCapabilities: plan.desiredCapabilities,
    }) ||
    !requireFinalInference({
      inference: finalInference,
      state: nextState,
      desiredCapabilities: plan.desiredCapabilities,
    })
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
  finalExpected.set(
    ".egeria/project.yaml",
    encoder.encode(controls.projectSource),
  );
  if (
    !(await hasExactBytes({
      root,
      reader,
      expected: finalExpected,
      paths: [...changedPaths, ".egeria/project.yaml"],
    }))
  ) {
    return failure(
      "CAPABILITY_FINAL_DIFF_FAILED",
      "final-diff",
      "inspect-worktree",
    );
  }

  return {
    ok: true,
    value: {
      status: "verified-final-diff-approval-required",
      baseRevision: initialGit.identity.revision,
      capability: {
        identifier: "standards",
        fromVersion: "0.3.0",
        toVersion: "0.4.0",
      },
      migration: migrationIdentifier,
      changedPaths,
      verificationChecks: capabilityUpgradeVerificationChecks,
    },
  };
}
