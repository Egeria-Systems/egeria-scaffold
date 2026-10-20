import {
  lstat,
  mkdir,
  open,
  readFile,
  realpath,
  rename,
} from "node:fs/promises";
import { basename, dirname, join, parse, resolve } from "node:path";

import {
  createGenerationRenderingContext,
  isApplicationEnvironmentRenderingContext,
  verifiedCapabilityPackageVersions,
} from "../catalog/verified-package-versions.js";
import { createCapabilityCatalogSnapshot } from "../catalog/capability-catalog.js";
import type {
  CapabilityDescriptor,
} from "../contracts/capability.js";
import { safeRelativePathSchema } from "../contracts/identifiers.js";
import { appGenerationVerificationChecks, persistenceGenerationVerificationChecks } from "../contracts/generation-verification.js";
import type {
  ContractIssue,
  ValidationResult,
} from "../contracts/result.js";
import {
  applicationEnvironmentAnalyticsSettingsSchema,
  applicationEnvironmentBookingSettingsSchema,
  type ApplicationEnvironmentProjectConfiguration,
  type ProjectConfiguration,
  analyticsSettingsSchema,
  type AnalyticsSettings,
  calendlyBookingSettingsSchema,
  web3FormsContactSettingsSchema,
  type Web3FormsContactSettings,
  type CalendlyBookingSettings,
} from "../contracts/project.js";
import { validateContract } from "../contracts/result.js";
import {
  applicationEnvironmentInstalledStateSchema,
  type ApplicationEnvironmentInstalledState,
  installedStateSchema,
  type InstalledState,
} from "../contracts/state.js";
import { inferRepository } from "../inference/infer-repository.js";
import { createInstalledManifest } from "../manifest/create-installed-manifest.js";
import { materializeInstalledSurfaces } from "../ownership/materialize-surfaces.js";
import { createFileSystemRepositoryReader } from "../repository/repository-reader.js";
import { serializeProjectYaml, serializeStateJson } from "../state/codecs.js";
import {
  createBuilderStateSurfaces,
} from "./builder-state-surfaces.js";
import {
  renderSkeleton,
  type ApplicationEnvironmentGenerationRequest,
  type ApplicationEnvironmentRenderingContext,
  type GenerationRequest,
  type RenderedSkeleton,
} from "./render-skeleton.js";
import {
  classifyLockfileOnlyTransition,
  cleanupOwnedDirectory,
  createOwnedTemporaryDirectory,
  snapshotSourceTree,
  sourceIdentityMatches,
  type PathIdentity,
  type SourceEntry,
} from "./source-tree-safety.js";
import {
  verificationChecks,
  type GeneratedProjectVerification,
  type GeneratedProjectVerifier,
} from "./verify-generated-project.js";

export type ProjectGenerationRequest = Omit<
  GenerationRequest,
  "packageVersions"
>;

export type ApplicationEnvironmentProjectGenerationRequest = Omit<ApplicationEnvironmentGenerationRequest, "packageVersions">;

type GenerationSkeleton = RenderedSkeleton<ProjectConfiguration | ApplicationEnvironmentProjectConfiguration>;

export type GeneratedProject<S = InstalledState> = Readonly<{
  destination: string;
  state: S;
}>;

type Destination = Readonly<{
  path: string;
  parent: string;
}>;

const encoder = new TextEncoder();
const requiredRequestKeys = ["displayName", "profile", "projectName"] as const;
const allowedRequestKeys = new Set([
  "analytics",
  "applicationPersistence",
  "transactionalEmailResend",
  "backgroundJobDelivery",
  "bookingCalendly",
  "contactFormWeb3Forms",
  "displayName",
  "multilingual",
  "profile",
  "projectName",
]);
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

function validateRequest(value: unknown, applicationEnvironments: true): ValidationResult<ApplicationEnvironmentProjectGenerationRequest>;
function validateRequest(value: unknown, applicationEnvironments?: false): ValidationResult<ProjectGenerationRequest>;
function validateRequest(
  value: unknown,
  applicationEnvironments = false,
): ValidationResult<ProjectGenerationRequest | ApplicationEnvironmentProjectGenerationRequest> {
  if (!isPlainObject(value)) {
    return issue(
      "PROJECT_GENERATION_REQUEST_INVALID",
      ["request"],
      "invalid-shape",
    );
  }

  const keys = Object.keys(value).sort();
  const includesAnalytics = Object.hasOwn(value, "analytics");
  const includesContact = Object.hasOwn(value, "contactFormWeb3Forms");
  const includesCalendly = Object.hasOwn(value, "bookingCalendly");
  const includesMultilingual = Object.hasOwn(value, "multilingual");
  const includesPersistence = Object.hasOwn(value, "applicationPersistence");
  const includesEmail = Object.hasOwn(value, "transactionalEmailResend");
  const includesJobs = Object.hasOwn(value, "backgroundJobDelivery");
  if (
    requiredRequestKeys.some((key) => !Object.hasOwn(value, key)) ||
    keys.some((key) => !allowedRequestKeys.has(key))
  ) {
    return issue(
      "PROJECT_GENERATION_REQUEST_INVALID",
      ["request"],
      "invalid-keys",
    );
  }

  if (applicationEnvironments) {
    if (includesContact && value.contactFormWeb3Forms !== true) return issue("PROJECT_GENERATION_REQUEST_INVALID", ["request", "contactFormWeb3Forms"], "invalid-selection");
    if (includesAnalytics && !applicationEnvironmentAnalyticsSettingsSchema.safeParse(value.analytics).success) return issue("PROJECT_GENERATION_REQUEST_INVALID", ["request", "analytics"], "invalid-settings");
    const booking = includesCalendly ? applicationEnvironmentBookingSettingsSchema.safeParse(value.bookingCalendly) : undefined;
    if (booking !== undefined && !booking.success) return issue("PROJECT_GENERATION_REQUEST_INVALID", ["request", "bookingCalendly"], "invalid-settings");
    for (const key of ["multilingual", "applicationPersistence", "transactionalEmailResend", "backgroundJobDelivery"] as const) {
      if (Object.hasOwn(value, key) && value[key] !== true) return issue("PROJECT_GENERATION_REQUEST_INVALID", ["request", key], "invalid-selection");
    }
    if (includesAnalytics || includesPersistence || includesEmail || includesJobs) return issue("APPLICATION_ENVIRONMENT_CAPABILITY_INCOMPLETE", ["request"], "incomplete-capability");
    return {
      ok: true,
      value: {
        profile: value.profile as ApplicationEnvironmentProjectGenerationRequest["profile"],
        projectName: value.projectName as string,
        displayName: value.displayName as string,
        ...(booking?.success ? { bookingCalendly: booking.data } : {}),
        ...(includesContact ? { contactFormWeb3Forms: true } : {}),
        ...(includesMultilingual ? { multilingual: true } : {}),
      },
    };
  }

  let contactFormWeb3Forms: Web3FormsContactSettings | undefined;
  if (includesContact) {
    const parsed = web3FormsContactSettingsSchema.safeParse(value.contactFormWeb3Forms);
    if (!parsed.success) return issue("PROJECT_GENERATION_REQUEST_INVALID", ["request", "contactFormWeb3Forms"], "invalid-settings");
    contactFormWeb3Forms = parsed.data;
  }
  let analytics: AnalyticsSettings | undefined;
  if (includesAnalytics) {
    const parsed = analyticsSettingsSchema.safeParse(value.analytics);
    if (!parsed.success) {
      return issue(
        "PROJECT_GENERATION_REQUEST_INVALID",
        ["request", "analytics"],
        "invalid-settings",
      );
    }
    analytics = parsed.data;
  }

  let bookingCalendly: CalendlyBookingSettings | undefined;
  if (includesCalendly) {
    const parsed = calendlyBookingSettingsSchema.safeParse(
      value.bookingCalendly,
    );

    if (!parsed.success) {
      return issue(
        "PROJECT_GENERATION_REQUEST_INVALID",
        ["request", "bookingCalendly"],
        "invalid-settings",
      );
    }
    bookingCalendly = parsed.data;
  }
  if (includesMultilingual && value.multilingual !== true) {
    return issue(
      "PROJECT_GENERATION_REQUEST_INVALID",
      ["request", "multilingual"],
      "invalid-selection",
    );
  }
  if (includesJobs && value.backgroundJobDelivery !== true) {
    return issue("PROJECT_GENERATION_REQUEST_INVALID", ["request", "backgroundJobDelivery"], "invalid-selection");
  }
  if (includesEmail && value.transactionalEmailResend !== true) {
    return issue("PROJECT_GENERATION_REQUEST_INVALID", ["request", "transactionalEmailResend"], "invalid-selection");
  }
  if (includesPersistence && value.applicationPersistence !== true) {
    return issue("PROJECT_GENERATION_REQUEST_INVALID", ["request", "applicationPersistence"], "invalid-selection");
  }

  return {
    ok: true,
    value: {
      profile: value.profile as ProjectGenerationRequest["profile"],
      projectName: value.projectName as string,
      displayName: value.displayName as string,
      ...(contactFormWeb3Forms === undefined ? {} : { contactFormWeb3Forms }),
      ...(analytics === undefined ? {} : { analytics }),
      ...(bookingCalendly === undefined ? {} : { bookingCalendly }),
      ...(includesMultilingual ? { multilingual: true } : {}),
      ...(includesPersistence ? { applicationPersistence: true } : {}),
      ...(includesJobs ? { backgroundJobDelivery: true } : {}),
      ...(includesEmail ? { transactionalEmailResend: true } : {}),
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
  const created = await createOwnedTemporaryDirectory(
    parent,
    ".egeria-create-",
  );
  if (created.ok) {
    return created;
  }

  return created.reason === "invalid-identity"
    ? issue("TEMPORARY_DIRECTORY_AMBIGUOUS", [], "invalid-source")
    : issue(
        "TEMPORARY_DIRECTORY_CREATE_FAILED",
        [],
        "creation-failed",
      );
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
  rendered: GenerationSkeleton,
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

function validatePreparedLockfile(
  before: ReadonlyMap<string, SourceEntry>,
  after: ReadonlyMap<string, SourceEntry>,
): ValidationResult<void> {
  const transition = classifyLockfileOnlyTransition(before, after);
  return transition === "valid"
    ? { ok: true, value: undefined }
    : issue("LOCKFILE_PREPARATION_INVALID", [], transition);
}

function expectedCapabilityIdentifiers(
  rendered: GenerationSkeleton,
): readonly string[] {
  return rendered.resolved.capabilities
    .map(({ identifier }) => identifier)
    .sort();
}

async function requirePreStateInference(
  source: PathIdentity,
  rendered: GenerationSkeleton,
  catalog: readonly CapabilityDescriptor[],
): Promise<ValidationResult<void>> {
  const request = { reader: createFileSystemRepositoryReader(source.path), catalog };
  const inference = rendered.project.schemaVersion === "2.0.0"
    ? await inferRepository({ ...request, projectSchemaVersion: "2.0.0" })
    : await inferRepository(request);

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

function verificationIsExact(
  value: unknown,
  rendered: GenerationSkeleton,
): value is GeneratedProjectVerification {
  if (!isPlainObject(value) || !Array.isArray(value.checks)) {
    return false;
  }

  const checks = value.checks;
  const app = rendered.resolved.capabilities.some(({ identifier }) => identifier === "app-foundation");
  const persistence = rendered.resolved.capabilities.some(({ identifier, version }) => identifier === "application-persistence" && version === "0.1.0");
  const expectedChecks = persistence ? persistenceGenerationVerificationChecks : app ? appGenerationVerificationChecks : verificationChecks;

  return (
    checks.length === expectedChecks.length &&
    expectedChecks.every(
      (expectedCheck, index) => checks[index] === expectedCheck,
    )
  );
}

async function createInstalledState(input: Readonly<{
  source: PathIdentity;
  rendered: GenerationSkeleton;
  projectContent: Uint8Array;
  verification: GeneratedProjectVerification;
}>): Promise<ValidationResult<InstalledState | ApplicationEnvironmentInstalledState>> {
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

  const stateInput = {
    schemaVersion: input.rendered.project.schemaVersion,
    builderVersion: "0.0.0",
    projectSchemaVersion: input.rendered.project.schemaVersion,
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
        ...input.verification.checks,
        "post-state-inference",
      ],
    },
  };

  const state = input.rendered.project.schemaVersion === "2.0.0"
    ? validateContract(applicationEnvironmentInstalledStateSchema, stateInput)
    : validateContract(installedStateSchema, stateInput);
  return state.ok
    ? state
    : issue("STATE_CONSTRUCTION_FAILED", [], "contract-invalid");
}

async function requirePostStateInference(
  source: PathIdentity,
  rendered: GenerationSkeleton,
  catalog: readonly CapabilityDescriptor[],
  state: InstalledState | ApplicationEnvironmentInstalledState,
): Promise<ValidationResult<void>> {
  const request = { reader: createFileSystemRepositoryReader(source.path), catalog };
  const inference = rendered.project.schemaVersion === "2.0.0"
    ? await inferRepository({ ...request, projectSchemaVersion: "2.0.0" })
    : await inferRepository(request);

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
  rendered: GenerationSkeleton;
  catalog: readonly CapabilityDescriptor[];
  verifier: GeneratedProjectVerifier;
}>): Promise<ValidationResult<GeneratedProject<InstalledState | ApplicationEnvironmentInstalledState>>> {
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

  const beforeLockfile = await snapshotSourceTree(input.source.path);
  if (beforeLockfile === undefined) {
    return issue("SOURCE_SNAPSHOT_FAILED", [], "snapshot-failed");
  }

  const prepared = await input.verifier.prepareLockfile(
    input.source.path,
    input.rendered.project,
  );
  const sourceAfterPreparation = await requireSourceIdentity(input.source);
  if (!sourceAfterPreparation.ok) {
    return sourceAfterPreparation;
  }
  if (!prepared.ok) {
    return prepared;
  }

  const afterLockfile = await snapshotSourceTree(input.source.path);
  if (afterLockfile === undefined) {
    return issue(
      "LOCKFILE_PREPARATION_INVALID",
      [],
      "source-inventory-invalid",
    );
  }
  const lockfileValid = validatePreparedLockfile(
    beforeLockfile,
    afterLockfile,
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
  if (!verificationIsExact(verified.value, input.rendered)) {
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
    verification: verified.value,
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

type GenerateProjectInput = Readonly<{
  request: ProjectGenerationRequest;
  destination: string;
  verifier: GeneratedProjectVerifier;
}>;
type ApplicationEnvironmentGenerateProjectInput = Omit<GenerateProjectInput, "request"> & Readonly<{
  request: ApplicationEnvironmentProjectGenerationRequest;
  renderingContext: ApplicationEnvironmentRenderingContext;
}>;

export function generateProject(input: ApplicationEnvironmentGenerateProjectInput): Promise<ValidationResult<GeneratedProject<ApplicationEnvironmentInstalledState>>>;
export function generateProject(input: GenerateProjectInput): Promise<ValidationResult<GeneratedProject>>;
export async function generateProject(input: GenerateProjectInput | ApplicationEnvironmentGenerateProjectInput): Promise<ValidationResult<GeneratedProject<InstalledState | ApplicationEnvironmentInstalledState>>> {
  const candidateContext = "renderingContext" in input ? input.renderingContext : undefined;
  if ("renderingContext" in input && !isApplicationEnvironmentRenderingContext(candidateContext)) {
    return issue("APPLICATION_ENVIRONMENT_CONTEXT_INVALID", ["context"], "unsupported-context");
  }
  const request = candidateContext === undefined ? validateRequest(input.request) : undefined;
  const candidateRequest = candidateContext === undefined ? undefined : validateRequest(input.request, true);
  if (request?.ok === false) {
    return request;
  }
  if (candidateRequest?.ok === false) return candidateRequest;

  const renderingContext = candidateContext ?? createGenerationRenderingContext(request?.value.applicationPersistence === true, request?.value.transactionalEmailResend === true, request?.value.backgroundJobDelivery === true);
  const catalog = createCapabilityCatalogSnapshot(verifiedCapabilityPackageVersions, renderingContext.catalogSnapshot);
  if (!catalog.ok) {
    return issue("VERIFIED_CATALOG_INVALID", [], "catalog-invalid");
  }

  const candidateRendered = candidateContext === undefined || candidateRequest === undefined ? undefined : await renderSkeleton({
    ...candidateRequest.value,
    packageVersions: verifiedCapabilityPackageVersions,
  }, candidateContext);
  if (candidateRendered?.ok === false) return candidateRendered;

  const destination = await resolveDestination(input.destination);
  if (!destination.ok) {
    return destination;
  }

  const rendered = candidateRendered ?? (request === undefined ? issue("PROJECT_GENERATION_REQUEST_INVALID", ["request"], "invalid-shape") : await renderSkeleton({
    ...request.value,
    packageVersions: verifiedCapabilityPackageVersions,
  }, renderingContext));
  if (!rendered.ok) {
    return rendered;
  }

  const source = await createSourceRoot(destination.value.parent);
  if (!source.ok) {
    return source;
  }

  let result: ValidationResult<GeneratedProject<InstalledState | ApplicationEnvironmentInstalledState>>;
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

  return (await cleanupOwnedDirectory(source.value))
    ? result
    : appendCleanupFailure(result);
}
