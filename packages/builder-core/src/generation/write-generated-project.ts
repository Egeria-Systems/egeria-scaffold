import {
  chmod,
  lstat,
  mkdir,
  mkdtemp,
  open,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
} from "node:fs/promises";
import { basename, dirname, join, parse, resolve } from "node:path";

import {
  createVerifiedCapabilityCatalog,
  verifiedCapabilityPackageVersions,
} from "../catalog/verified-package-versions.js";
import type {
  CapabilityDescriptor,
  ManagedSurfaceDescriptor,
} from "../contracts/capability.js";
import { safeRelativePathSchema } from "../contracts/identifiers.js";
import type {
  ContractIssue,
  ValidationResult,
} from "../contracts/result.js";
import { validateContract } from "../contracts/result.js";
import {
  installedStateSchema,
  type InstalledState,
} from "../contracts/state.js";
import { inferRepository } from "../inference/infer-repository.js";
import { createInstalledManifest } from "../manifest/create-installed-manifest.js";
import { fingerprintFileContent } from "../ownership/fingerprint.js";
import { materializeInstalledSurfaces } from "../ownership/materialize-surfaces.js";
import { createFileSystemRepositoryReader } from "../repository/repository-reader.js";
import { serializeProjectYaml, serializeStateJson } from "../state/codecs.js";
import {
  renderSkeleton,
  type GenerationRequest,
  type RenderedSkeleton,
} from "./render-skeleton.js";
import {
  verificationChecks,
  type GeneratedProjectVerification,
  type GeneratedProjectVerifier,
} from "./verify-generated-project.js";

export type ProjectGenerationRequest = Omit<
  GenerationRequest,
  "packageVersions"
>;

export type GeneratedProject = Readonly<{
  destination: string;
  state: InstalledState;
}>;

type PathIdentity = Readonly<{
  path: string;
  device: bigint;
  inode: bigint;
}>;

type Destination = Readonly<{
  path: string;
  parent: string;
}>;

type SourceEntry =
  | Readonly<{ kind: "directory" }>
  | Readonly<{ kind: "file"; fingerprint: string }>;

const encoder = new TextEncoder();
const exactRequestKeys = [
  "displayName",
  "profile",
  "projectName",
] as const;
function issue(
  code: string,
  path: readonly (string | number)[] = [],
  reason = "operation-failed",
): ValidationResult<never> {
  return {
    ok: false,
    issues: [{ code, path, context: { reason } }],
  };
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

function isMissingError(error: unknown): boolean {
  return isNodeError(error) && error.code === "ENOENT";
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const prototype = Reflect.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function validateRequest(
  value: unknown,
): ValidationResult<ProjectGenerationRequest> {
  if (!isPlainObject(value)) {
    return issue(
      "PROJECT_GENERATION_REQUEST_INVALID",
      ["request"],
      "invalid-shape",
    );
  }

  const keys = Object.keys(value).sort();
  if (
    keys.length !== exactRequestKeys.length ||
    keys.some((key, index) => key !== exactRequestKeys[index])
  ) {
    return issue(
      "PROJECT_GENERATION_REQUEST_INVALID",
      ["request"],
      "invalid-keys",
    );
  }

  return {
    ok: true,
    value: {
      profile: value.profile as ProjectGenerationRequest["profile"],
      projectName: value.projectName as string,
      displayName: value.displayName as string,
    },
  };
}

async function requireAbsent(path: string): Promise<ValidationResult<void>> {
  try {
    await lstat(path);
    return issue("DESTINATION_EXISTS", [], "already-exists");
  } catch (error) {
    return isMissingError(error)
      ? { ok: true, value: undefined }
      : issue("DESTINATION_CHECK_FAILED", [], "inspection-failed");
  }
}

async function resolveDestination(
  value: unknown,
): Promise<ValidationResult<Destination>> {
  if (typeof value !== "string" || value.length === 0 || value.includes("\0")) {
    return issue("DESTINATION_PARENT_INVALID", [], "invalid-path");
  }

  const requestedPath = resolve(value);
  const leaf = basename(requestedPath);

  if (leaf.length === 0 || requestedPath === parse(requestedPath).root) {
    return issue("DESTINATION_PARENT_INVALID", [], "invalid-leaf");
  }

  let canonicalParent: string;
  try {
    canonicalParent = await realpath(dirname(requestedPath));
    const parentStats = await lstat(canonicalParent);
    if (parentStats.isSymbolicLink() || !parentStats.isDirectory()) {
      return issue("DESTINATION_PARENT_INVALID", [], "invalid-parent");
    }
  } catch {
    return issue("DESTINATION_PARENT_INVALID", [], "invalid-parent");
  }

  const destination = join(canonicalParent, leaf);
  const absent = await requireAbsent(destination);

  return absent.ok
    ? { ok: true, value: { path: destination, parent: canonicalParent } }
    : absent;
}

async function createSourceRoot(
  parent: string,
): Promise<ValidationResult<PathIdentity>> {
  let identity: PathIdentity | undefined;

  try {
    const path = await mkdtemp(join(parent, ".egeria-create-"));
    const stats = await lstat(path, { bigint: true });

    if (stats.isSymbolicLink() || !stats.isDirectory()) {
      return issue(
        "TEMPORARY_DIRECTORY_AMBIGUOUS",
        [],
        "invalid-source",
      );
    }

    identity = { path, device: stats.dev, inode: stats.ino };
    await chmod(path, 0o700);
    return { ok: true, value: identity };
  } catch {
    if (identity !== undefined) {
      await cleanupSource(identity);
    }
    return issue(
      "TEMPORARY_DIRECTORY_CREATE_FAILED",
      [],
      "creation-failed",
    );
  }
}

async function sourceIdentityMatches(identity: PathIdentity): Promise<boolean> {
  try {
    const stats = await lstat(identity.path, { bigint: true });
    return (
      !stats.isSymbolicLink() &&
      stats.isDirectory() &&
      stats.dev === identity.device &&
      stats.ino === identity.inode
    );
  } catch {
    return false;
  }
}

async function requireSourceIdentity(
  identity: PathIdentity,
): Promise<ValidationResult<void>> {
  return (await sourceIdentityMatches(identity))
    ? { ok: true, value: undefined }
    : issue(
        "TEMPORARY_DIRECTORY_AMBIGUOUS",
        [],
        "identity-changed",
      );
}

async function cleanupSource(identity: PathIdentity): Promise<boolean> {
  if (!(await sourceIdentityMatches(identity))) {
    return false;
  }

  try {
    await rm(identity.path, { recursive: true });
    return true;
  } catch {
    return false;
  }
}

async function writeExclusive(
  root: string,
  path: string,
  content: Uint8Array,
  failureCode: string,
): Promise<ValidationResult<void>> {
  if (!safeRelativePathSchema.safeParse(path).success) {
    return issue(failureCode, [], "invalid-path");
  }

  const absolutePath = join(root, path);
  let handle;
  let failed = false;

  try {
    await mkdir(dirname(absolutePath), { recursive: true, mode: 0o700 });
    handle = await open(absolutePath, "wx");
    await handle.writeFile(content);
  } catch {
    failed = true;
  } finally {
    try {
      await handle?.close();
    } catch {
      failed = true;
    }
  }

  return failed
    ? issue(failureCode, [], "exclusive-write-failed")
    : { ok: true, value: undefined };
}

async function writeInitialFiles(
  source: PathIdentity,
  rendered: RenderedSkeleton,
  projectContent: Uint8Array,
): Promise<ValidationResult<void>> {
  const files = [
    { path: ".egeria/project.yaml", content: projectContent },
    ...rendered.files,
  ];

  for (const file of files) {
    const written = await writeExclusive(
      source.path,
      file.path,
      file.content,
      "PROJECT_WRITE_FAILED",
    );
    if (!written.ok) {
      return written;
    }
  }

  return { ok: true, value: undefined };
}

async function snapshotSource(
  root: string,
): Promise<ValidationResult<ReadonlyMap<string, SourceEntry>>> {
  const entries = new Map<string, SourceEntry>();

  async function visit(path: string, relativePath: string): Promise<boolean> {
    let children;
    try {
      children = await readdir(path, { withFileTypes: true });
    } catch {
      return false;
    }

    for (const child of children) {
      const childPath = join(path, child.name);
      const childRelativePath = relativePath
        ? `${relativePath}/${child.name}`
        : child.name;

      if (child.isDirectory()) {
        entries.set(childRelativePath, { kind: "directory" });
        if (!(await visit(childPath, childRelativePath))) {
          return false;
        }
      } else if (child.isFile()) {
        try {
          entries.set(childRelativePath, {
            kind: "file",
            fingerprint: fingerprintFileContent(await readFile(childPath)),
          });
        } catch {
          return false;
        }
      } else {
        return false;
      }
    }

    return true;
  }

  return (await visit(root, ""))
    ? { ok: true, value: entries }
    : issue("SOURCE_SNAPSHOT_FAILED", [], "snapshot-failed");
}

function sourceEntriesEqual(left: SourceEntry, right: SourceEntry): boolean {
  return (
    left.kind === right.kind &&
    (left.kind === "directory" ||
      (right.kind === "file" && left.fingerprint === right.fingerprint))
  );
}

function validatePreparedLockfile(
  before: ReadonlyMap<string, SourceEntry>,
  after: ReadonlyMap<string, SourceEntry>,
): ValidationResult<void> {
  const lockfile = after.get("pnpm-lock.yaml");

  if (
    before.has("pnpm-lock.yaml") ||
    lockfile?.kind !== "file" ||
    after.size !== before.size + 1
  ) {
    return issue(
      "LOCKFILE_PREPARATION_INVALID",
      [],
      "unexpected-inventory",
    );
  }

  for (const [path, entry] of before) {
    const current = after.get(path);
    if (current === undefined || !sourceEntriesEqual(entry, current)) {
      return issue(
        "LOCKFILE_PREPARATION_INVALID",
        [],
        "source-changed",
      );
    }
  }

  return { ok: true, value: undefined };
}

function expectedCapabilityIdentifiers(
  rendered: RenderedSkeleton,
): readonly string[] {
  return rendered.resolved.capabilities
    .map(({ identifier }) => identifier)
    .sort();
}

async function requirePreStateInference(
  source: PathIdentity,
  rendered: RenderedSkeleton,
  catalog: readonly CapabilityDescriptor[],
): Promise<ValidationResult<void>> {
  const inference = await inferRepository({
    reader: createFileSystemRepositoryReader(source.path),
    catalog,
  });

  if (
    inference.state.kind !== "missing" ||
    inference.surfaces.length !== 0 ||
    inference.capabilities.some(({ category }) => category !== "probable") ||
    inference.capabilities.map(({ identifier }) => identifier).join("\0") !==
      expectedCapabilityIdentifiers(rendered).join("\0")
  ) {
    return issue(
      "PRE_STATE_INFERENCE_FAILED",
      [],
      "evidence-mismatch",
    );
  }

  return { ok: true, value: undefined };
}

function verificationIsExact(value: unknown): value is GeneratedProjectVerification {
  if (!isPlainObject(value) || !Array.isArray(value.checks)) {
    return false;
  }

  return (
    value.checks.length === verificationChecks.length &&
    value.checks.every(
      (check, index) => check === verificationChecks[index],
    )
  );
}

function createBuilderStateSurfaces(): readonly ManagedSurfaceDescriptor[] {
  return [
    {
      identifier: "builder-project-configuration",
      owner: { kind: "builder-kernel" },
      path: ".egeria/project.yaml",
      ownership: "managed",
      fingerprintTarget: { kind: "file" },
      mergeStrategy: "replace-file",
    },
    {
      identifier: "builder-dependency-lockfile",
      owner: { kind: "builder-kernel" },
      path: "pnpm-lock.yaml",
      ownership: "managed",
      fingerprintTarget: { kind: "file" },
      mergeStrategy: "replace-file",
    },
    {
      identifier: "builder-migration-log",
      owner: { kind: "builder-kernel" },
      path: ".egeria/migrations.jsonl",
      ownership: "managed",
      fingerprintTarget: { kind: "file" },
      mergeStrategy: "replace-file",
    },
  ];
}

async function createInstalledState(input: Readonly<{
  source: PathIdentity;
  rendered: RenderedSkeleton;
  projectContent: Uint8Array;
}>): Promise<ValidationResult<InstalledState>> {
  let lockfileContent: Uint8Array;
  try {
    lockfileContent = await readFile(join(input.source.path, "pnpm-lock.yaml"));
  } catch {
    return issue("STATE_CONSTRUCTION_FAILED", [], "lockfile-read-failed");
  }

  const files = new Map(
    input.rendered.files.map(({ path, content }) => [path, content]),
  );
  files.set(".egeria/project.yaml", input.projectContent);
  files.set("pnpm-lock.yaml", lockfileContent);
  files.set(".egeria/migrations.jsonl", new Uint8Array());

  const materialized = materializeInstalledSurfaces({
    files,
    surfaces: [
      ...input.rendered.surfaces,
      ...createBuilderStateSurfaces(),
    ].sort((left, right) =>
      left.identifier < right.identifier
        ? -1
        : left.identifier > right.identifier
          ? 1
          : 0,
    ),
  });
  if (!materialized.ok) {
    return issue(
      "STATE_CONSTRUCTION_FAILED",
      [],
      "surface-materialization-failed",
    );
  }

  const state = validateContract(installedStateSchema, {
    schemaVersion: "1.0.0",
    builderVersion: "0.0.0",
    projectSchemaVersion: "1.0.0",
    origin: {
      profile: input.rendered.project.originProfile,
      recipeVersion: input.rendered.project.recipeVersion,
    },
    installedCapabilities: createInstalledManifest(input.rendered.resolved),
    appliedMigrations: [],
    managedSurfaces: materialized.value,
    ejections: [],
    compatibility: {
      node: "22.23.2",
      pnpm: "11.20.0",
      platformAdapter: "cloudflare-workers",
    },
    lastSuccessfulVerification: {
      kind: "generation",
      checks: [
        "contracts",
        "pre-state-inference",
        ...verificationChecks,
        "post-state-inference",
      ],
    },
  });

  return state.ok
    ? state
    : issue("STATE_CONSTRUCTION_FAILED", [], "contract-invalid");
}

async function requirePostStateInference(
  source: PathIdentity,
  rendered: RenderedSkeleton,
  catalog: readonly CapabilityDescriptor[],
  state: InstalledState,
): Promise<ValidationResult<void>> {
  const inference = await inferRepository({
    reader: createFileSystemRepositoryReader(source.path),
    catalog,
  });

  if (
    inference.state.kind !== "valid" ||
    inference.capabilities.some(({ category }) => category !== "confirmed") ||
    inference.capabilities.map(({ identifier }) => identifier).join("\0") !==
      expectedCapabilityIdentifiers(rendered).join("\0") ||
    inference.surfaces.length !== state.managedSurfaces.length ||
    inference.surfaces.some(
      ({ status }) => status !== "confirmed" && status !== "application-owned",
    )
  ) {
    return issue(
      "POST_STATE_INFERENCE_FAILED",
      [],
      "evidence-mismatch",
    );
  }

  return { ok: true, value: undefined };
}

async function executeGeneration(input: Readonly<{
  source: PathIdentity;
  destination: Destination;
  rendered: RenderedSkeleton;
  catalog: readonly CapabilityDescriptor[];
  verifier: GeneratedProjectVerifier;
}>): Promise<ValidationResult<GeneratedProject>> {
  const projectContent = encoder.encode(
    serializeProjectYaml(input.rendered.project),
  );
  const initialWrite = await writeInitialFiles(
    input.source,
    input.rendered,
    projectContent,
  );
  if (!initialWrite.ok) {
    return initialWrite;
  }

  const beforeLockfile = await snapshotSource(input.source.path);
  if (!beforeLockfile.ok) {
    return beforeLockfile;
  }

  const prepared = await input.verifier.prepareLockfile(input.source.path);
  const sourceAfterPreparation = await requireSourceIdentity(input.source);
  if (!sourceAfterPreparation.ok) {
    return sourceAfterPreparation;
  }
  if (!prepared.ok) {
    return prepared;
  }

  const afterLockfile = await snapshotSource(input.source.path);
  if (!afterLockfile.ok) {
    return issue(
      "LOCKFILE_PREPARATION_INVALID",
      [],
      "source-inventory-invalid",
    );
  }
  const lockfileValid = validatePreparedLockfile(
    beforeLockfile.value,
    afterLockfile.value,
  );
  if (!lockfileValid.ok) {
    return lockfileValid;
  }

  const preStateInference = await requirePreStateInference(
    input.source,
    input.rendered,
    input.catalog,
  );
  if (!preStateInference.ok) {
    return preStateInference;
  }

  const verified = await input.verifier.verifyInIsolatedCopy(input.source.path);
  const sourceAfterVerification = await requireSourceIdentity(input.source);
  if (!sourceAfterVerification.ok) {
    return sourceAfterVerification;
  }
  if (!verified.ok) {
    return verified;
  }
  if (!verificationIsExact(verified.value)) {
    return issue(
      "GENERATED_VERIFICATION_INVALID",
      [],
      "checks-mismatch",
    );
  }

  const migrationWrite = await writeExclusive(
    input.source.path,
    ".egeria/migrations.jsonl",
    new Uint8Array(),
    "MIGRATION_WRITE_FAILED",
  );
  if (!migrationWrite.ok) {
    return migrationWrite;
  }

  const state = await createInstalledState({
    source: input.source,
    rendered: input.rendered,
    projectContent,
  });
  if (!state.ok) {
    return state;
  }

  const stateWrite = await writeExclusive(
    input.source.path,
    ".egeria/state.json",
    encoder.encode(serializeStateJson(state.value)),
    "STATE_WRITE_FAILED",
  );
  if (!stateWrite.ok) {
    return stateWrite;
  }

  const postStateInference = await requirePostStateInference(
    input.source,
    input.rendered,
    input.catalog,
    state.value,
  );
  if (!postStateInference.ok) {
    return postStateInference;
  }

  const finalSourceIdentity = await requireSourceIdentity(input.source);
  if (!finalSourceIdentity.ok) {
    return finalSourceIdentity;
  }
  const finalDestinationCheck = await requireAbsent(input.destination.path);
  if (!finalDestinationCheck.ok) {
    return finalDestinationCheck;
  }

  try {
    await rename(input.source.path, input.destination.path);
  } catch {
    return issue("DESTINATION_COMMIT_FAILED", [], "rename-failed");
  }

  return {
    ok: true,
    value: { destination: input.destination.path, state: state.value },
  };
}

function appendCleanupFailure(
  result: Readonly<{ ok: false; issues: readonly ContractIssue[] }>,
): ValidationResult<never> {
  if (
    result.issues.some(
      ({ code }) => code === "TEMPORARY_DIRECTORY_AMBIGUOUS",
    )
  ) {
    return result;
  }

  return {
    ok: false,
    issues: [
      ...result.issues,
      {
        code: "CLEANUP_FAILED",
        path: [],
        context: { reason: "source-not-owned" },
      },
    ],
  };
}

export async function generateProject(input: Readonly<{
  request: ProjectGenerationRequest;
  destination: string;
  verifier: GeneratedProjectVerifier;
}>): Promise<ValidationResult<GeneratedProject>> {
  const request = validateRequest(input.request);
  if (!request.ok) {
    return request;
  }

  const catalog = createVerifiedCapabilityCatalog();
  if (!catalog.ok) {
    return issue("VERIFIED_CATALOG_INVALID", [], "catalog-invalid");
  }

  const destination = await resolveDestination(input.destination);
  if (!destination.ok) {
    return destination;
  }

  const rendered = await renderSkeleton({
    ...request.value,
    packageVersions: verifiedCapabilityPackageVersions,
  });
  if (!rendered.ok) {
    return rendered;
  }

  const source = await createSourceRoot(destination.value.parent);
  if (!source.ok) {
    return source;
  }

  let result: ValidationResult<GeneratedProject>;
  try {
    result = await executeGeneration({
      source: source.value,
      destination: destination.value,
      rendered: rendered.value,
      catalog: catalog.value,
      verifier: input.verifier,
    });
  } catch {
    result = issue(
      "PROJECT_GENERATION_FAILED",
      [],
      "unexpected-failure",
    );
  }

  if (result.ok) {
    return result;
  }

  return (await cleanupSource(source.value))
    ? result
    : appendCleanupFailure(result);
}
