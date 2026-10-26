import { readFile } from "node:fs/promises";
import { createRecipeLockfileUrl, resolveRecipeLockfileVersion } from "../generation/recipe-lockfiles.js";
import { loadAppTransitionContentValidators } from "./app-transition-content-validation.js";
import { appTransitionBaselinePaths, appTransitionVisualProject, appTransitionVisualBookingSettings, appTransitionVisualAnalyticsSettings, verifyAppTransitionVisualInputRecord, prepareAppProfileTransition, selectAppTransitionVisuals, type AppTransitionDisposition, type AppTransitionVisualEvidence, type AppTransitionPreparation, type AppTransitionFailureCode } from "./app-profile-transition.js";

import { createCapabilityCatalogSnapshot } from "../catalog/capability-catalog.js";
import { createVerifiedProjectSnapshot, verifiedCapabilityPackageVersions } from "../catalog/verified-package-versions.js";
import type { ManagedSurfaceDescriptor } from "../contracts/capability.js";
import type { ContractIssue } from "../contracts/result.js";
import type { InstalledSurface } from "../contracts/state.js";
import {
  inspectProject,
  type ProjectInspection,
} from "../diagnostics/project-inspection.js";
import { createBuilderStateSurfaces } from "../generation/builder-state-surfaces.js";
import {
  renderSkeleton,
  type RenderedSkeleton,
} from "../generation/render-skeleton.js";
import { createInstalledManifest } from "../manifest/create-installed-manifest.js";
import { fingerprintFileContent } from "../ownership/fingerprint.js";
import { createCachingRepositoryReader } from "../repository/cache-reader.js";
import type { RepositoryReader } from "../repository/repository-reader.js";
import { stringifyCanonicalJson } from "../serialization/canonical-json.js";
import {
  parseMigrationLog,
  parseProjectYaml,
  parseStateJson,
} from "../state/codecs.js";
import { inspectGitCreateTargets, inspectGitWorktree, sameGitIdentity, type GitWorktreeInspection } from "./git-worktree-inspection.js";
import {
  resolveSupportedProfileTransition,
  type SupportedProfileTransitionResolutionFailureCode,
} from "./supported-profile-transitions.js";

export type ProfileTransitionPlanningFailureCode =
  | AppTransitionFailureCode
  | SupportedProfileTransitionResolutionFailureCode
  | "PROFILE_INFERENCE_AMBIGUOUS"
  | "PROFILE_TRANSITION_ACTION_CONFLICT"
  | "PROJECT_DRIFT_DETECTED"
  | "PROJECT_EJECTION_UNSUPPORTED"
  | "PROJECT_INSPECTION_INVALID"
  | "PROJECT_STATE_INCOMPATIBLE";

export type ProfileTransitionControlFileEvidence = Readonly<{
  path:
    | ".egeria/migrations.jsonl"
    | ".egeria/project.yaml"
    | ".egeria/state.json";
  fingerprint: `sha256:${string}`;
}>;

export type ProfileTransitionCapabilitySubject = Readonly<{
  identifier: string;
  version: string;
}>;

export type ProfileTransitionPlan = AppProfileTransitionPlan;

type PlanningIssue = Omit<ContractIssue, "code"> &
  Readonly<{ code: ProfileTransitionPlanningFailureCode }>;
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
type ControlSources = Readonly<{
  sources: ReadonlyMap<(typeof controlPaths)[number], string>;
  project: Extract<ReturnType<typeof parseProjectYaml>, Readonly<{ ok: true }>>;
  state: Extract<ReturnType<typeof parseStateJson>, Readonly<{ ok: true }>>;
  migrations: Extract<
    ReturnType<typeof parseMigrationLog>,
    Readonly<{ ok: true }>
  >;
}>;

const encoder = new TextEncoder();
const controlPaths = [
  ".egeria/migrations.jsonl",
  ".egeria/project.yaml",
  ".egeria/state.json",
] as const;
function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
  return (
    left.length === right.length &&
    left.every((byte, index) => byte === right[index])
  );
}

function planningFailure(
  code: ProfileTransitionPlanningFailureCode,
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

function sameOrderedValues<T>(left: readonly T[], right: readonly T[]): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function sameJson(left: unknown, right: unknown): boolean {
  return stringifyCanonicalJson(left) === stringifyCanonicalJson(right);
}

function validInspection(
  inspection: ProjectInspection,
): ValidInspection | undefined {
  return inspection.project.kind === "valid" &&
    inspection.migrations.kind === "valid" &&
    inspection.inference.state.kind === "valid" &&
    inspection.resolution?.ok === true
    ? (inspection as ValidInspection)
    : undefined;
}

async function readControlSources(
  reader: RepositoryReader,
): Promise<ControlSources | undefined> {
  const sources = new Map<(typeof controlPaths)[number], string>();

  for (const path of controlPaths) {
    const result = await reader.readText(path);
    if (result.kind !== "file") {
      return undefined;
    }
    sources.set(path, result.content);
  }

  const project = parseProjectYaml(sources.get(".egeria/project.yaml") ?? "");
  const state = parseStateJson(sources.get(".egeria/state.json") ?? "");
  const migrations = parseMigrationLog(
    sources.get(".egeria/migrations.jsonl") ?? "",
  );

  return project.ok && state.ok && migrations.ok
    ? { sources, project, state, migrations }
    : undefined;
}

function capabilitySubjects(
  rendered: RenderedSkeleton,
): readonly ProfileTransitionCapabilitySubject[] {
  return rendered.resolved.capabilities
    .map(({ identifier, version }) => ({ identifier, version }))
    .sort((left, right) => compareText(left.identifier, right.identifier));
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

function sameInstalledSurfaceDescriptor(
  installed: InstalledSurface,
  expected: ManagedSurfaceDescriptor,
): boolean {
  return (
    installed.identifier === expected.identifier &&
    installed.path === expected.path &&
    installed.ownership === expected.ownership &&
    installed.mergeStrategy === expected.mergeStrategy &&
    sameSurfaceOwner(installed.owner, expected.owner) &&
    sameFingerprintTarget(
      installed.fingerprintTarget,
      expected.fingerprintTarget,
    )
  );
}

function exactSurfaceInventory(
  installed: readonly InstalledSurface[],
  expected: readonly ManagedSurfaceDescriptor[],
): boolean {
  const installedByIdentifier = new Map(
    installed.map((surface) => [surface.identifier, surface]),
  );

  return (
    installed.length === expected.length &&
    installedByIdentifier.size === installed.length &&
    expected.every((surface) => {
      const current = installedByIdentifier.get(surface.identifier);
      return (
        current !== undefined &&
        sameInstalledSurfaceDescriptor(current, surface)
      );
    })
  );
}

function expectedSourceSurfaces(input: Readonly<{
  rendered: RenderedSkeleton;
}>): readonly ManagedSurfaceDescriptor[] {
  return [...input.rendered.surfaces, ...createBuilderStateSurfaces()];
}

function hasExactAgreement(
  inspection: ValidInspection,
  controls: ControlSources,
  rendered: RenderedSkeleton,
): PlanningResult<void> {
  const project = inspection.project.value;
  const state = inspection.inference.state.value;
  const desiredIdentifiers = rendered.resolved.capabilities.map(
    ({ identifier }) => identifier,
  );
  const expectedManifest = createInstalledManifest(rendered.resolved);
  const migrationIdentifiers = inspection.migrations.value.map(
    ({ identifier }) => identifier,
  );
  const inferenceByIdentifier = new Map(
    inspection.inference.capabilities.map((evidence) => [
      evidence.identifier,
      evidence,
    ]),
  );
  const siteRouting = inferenceByIdentifier.get("site-routing");

  if (
    siteRouting !== undefined &&
    (siteRouting.category === "partial" ||
      siteRouting.category === "ambiguous" ||
      siteRouting.category === "contradictory")
  ) {
    return planningFailure("PROFILE_INFERENCE_AMBIGUOUS");
  }

  const unexpectedInference = inspection.inference.capabilities.some(
    ({ category, identifier }) =>
      !desiredIdentifiers.includes(identifier) &&
      identifier !== "site-routing" &&
      (category === "ambiguous" ||
        category === "contradictory" ||
        category === "partial" ||
        category === "probable"),
  );
  if (unexpectedInference) {
    return planningFailure("PROFILE_INFERENCE_AMBIGUOUS");
  }

  if (
    project.originProfile !== rendered.resolved.profile ||
    project.recipeVersion !== rendered.resolved.recipeVersion ||
    state.origin.profile !== project.originProfile ||
    state.origin.recipeVersion !== project.recipeVersion ||
    rendered.resolved.profile !== project.originProfile ||
    rendered.resolved.recipeVersion !== project.recipeVersion ||
    !sameOrderedValues(project.selectedCapabilities, desiredIdentifiers) ||
    !sameJson(state.installedCapabilities, expectedManifest) ||
    !sameOrderedValues(state.appliedMigrations, migrationIdentifiers) ||
    !desiredIdentifiers.every(
      (identifier) =>
        inferenceByIdentifier.get(identifier)?.category === "confirmed",
    ) ||
    controls.project.value.originProfile !== project.originProfile ||
    controls.state.value.origin.profile !== state.origin.profile
  ) {
    return planningFailure("PROJECT_STATE_INCOMPATIBLE");
  }

  return { ok: true, value: undefined };
}

function encodeBytes(bytes: Uint8Array | undefined): string | null {
  return bytes === undefined ? null : Buffer.from(bytes).toString("base64");
}

export type AppProfileTransitionPlan = Readonly<{
  operation: "transition-profile";
  status: "approval-required";
  planFingerprint: `sha256:${string}`;
  source: Readonly<{
    profile: "portfolio" | "site";
    recipeVersion: string;
    capabilities: readonly ProfileTransitionCapabilitySubject[];
  }>;
  target: Readonly<{
    profile: "app";
    recipeVersion: "0.2.7";
    capabilities: readonly ProfileTransitionCapabilitySubject[];
  }>;
  actions: readonly AppTransitionDisposition[];
  dispositions: readonly AppTransitionDisposition[];
  requiredApprovals: readonly [
    "transform",
    "verified-final-diff"
  ];
  persistenceOrder: readonly ["transform", "verify", "re-infer", "append-migration-record", "persist-state", "verify-state-and-inference"];
}>;
export type ReadReviewedAppTransitionVisualEvidence = (input: Readonly<{
  source: RenderedSkeleton;
  target: RenderedSkeleton;
  prepared: AppTransitionPreparation;
}>) => Promise<AppTransitionVisualEvidence | undefined>;
async function readReviewedAppTransitionVisualEvidence(input: Readonly<{
  source: RenderedSkeleton;
  target: RenderedSkeleton;
  prepared: AppTransitionPreparation;
}>): Promise<AppTransitionVisualEvidence | undefined> {
  if (input.source.project.originProfile !== "portfolio") {
    return undefined;
  }
  const canonical = prepareAppProfileTransition({
    source: input.source, target: input.target, currentFiles: new Map(input.source.files.map(({ path, content }) => [path, content])), validators: await loadAppTransitionContentValidators()
  });
  if (!canonical.ok || !sameJson(canonical.value.influencingFingerprints, input.prepared.influencingFingerprints)) {
    return undefined;
  }
  // Until the fixed-input identity and the four reviewed assets are present,
  // runtime planning must refuse. The producer owns their sole promotion path.
  if (input.source.project.project.name !== appTransitionVisualProject.projectName || input.source.project.project.displayName !== appTransitionVisualProject.displayName) {
    return undefined;
  }
  const booking = input.source.project.capabilitySettings["booking-calendly"];
  const analytics = input.source.project.capabilitySettings.analytics;
  if ((booking !== undefined && !sameJson(booking, appTransitionVisualBookingSettings)) || (analytics !== undefined && !sameJson(analytics, appTransitionVisualAnalyticsSettings))) {
    return undefined;
  }
  const optionalCapabilities = input.source.project.selectedCapabilities.filter(identifier => ["analytics", "booking-calendly", "multilingual"].includes(identifier));
  const manifest = input.target.files.find(({ path }) => path === "apps/web/package.json");
  if (manifest === undefined) return undefined;
  const lockVersion = resolveRecipeLockfileVersion(input.target.project, JSON.parse(new TextDecoder().decode(manifest.content)));
  if (lockVersion === undefined) return undefined;
  const targetLockfileFingerprint = fingerprintFileContent(new Uint8Array(await readFile(createRecipeLockfileUrl(lockVersion))));
  const inputRecord = verifyAppTransitionVisualInputRecord({
    optionalCapabilities,
    influencingFingerprints: canonical.value.influencingFingerprints,
    targetLockfileFingerprint,
  });
  if (!inputRecord.ok) return undefined;
  const multilingual = input.source.project.selectedCapabilities.includes("multilingual");
  try {
    const baselines = await Promise.all(appTransitionBaselinePaths.map(async (path, index) => ({ path, content: new Uint8Array(await readFile(new URL(`../../templates/portfolio/apps/web/tests/visual/home-visual.spec.ts-snapshots/app-transition-${multilingual ? "multilingual-" : ""}home-${index === 0 ? "desktop" : "mobile"}-chromium-linux.png`, import.meta.url))) })));
    const approvedBaselines = verifyAppTransitionVisualInputRecord({
      optionalCapabilities,
      influencingFingerprints: canonical.value.influencingFingerprints,
      targetLockfileFingerprint,
      baselines,
    });
    if (!approvedBaselines.ok) return undefined;
    const manifestFingerprint = fingerprintFileContent(encoder.encode(stringifyCanonicalJson({
      inputRecordFingerprint: inputRecord.value.fingerprint, targetLockfileFingerprint, influencingFingerprints: canonical.value.influencingFingerprints, optionalCapabilities, baselines: baselines.map(({ path, content }) => ({ path, fingerprint: fingerprintFileContent(content) }))
    })));
    return {
      manifestFingerprint, sourceProfile: "portfolio", optionalCapabilities, influencingFingerprints: canonical.value.influencingFingerprints, baselines, targetLockfileFingerprint
    };
  }
  catch {
    return undefined;
  }
}
export type PreparedAppProfileTransition = Readonly<{
  plan: AppProfileTransitionPlan;
  currentFiles: ReadonlyMap<string, Uint8Array>;
  targetFiles: ReadonlyMap<string, Uint8Array>;
  rendered: RenderedSkeleton;
}>;

// Private builder boundary: the public planner exposes only the redacted plan.
// Execution consumes the same proved bytes instead of duplicating domain policy.
export async function prepareAppProfileTransitionExecution(input: Readonly<{
  reader: RepositoryReader;
  git: Extract<GitWorktreeInspection, Readonly<{
    ok: true;
  }>>;
  readReviewedVisualEvidence?: ReadReviewedAppTransitionVisualEvidence;
  inspectCreateTargets?: typeof inspectGitCreateTargets;
  inspectWorktree?: typeof inspectGitWorktree;
}>): Promise<PlanningResult<PreparedAppProfileTransition>> {
  const identity = input.git.identity;
  if (!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(identity.revision) || !identity.root.startsWith("/") || !identity.attachedRef.startsWith("refs/heads/") || !identity.gitDirectory.startsWith(`${identity.commonDirectory}/worktrees/`)) {
    return planningFailure("PROJECT_INSPECTION_INVALID");
  }
  const reader = createCachingRepositoryReader(input.reader);
  const controls = await readControlSources(reader);
  if (controls === undefined) {
    return planningFailure("PROJECT_STATE_INCOMPATIBLE");
  }
  const project = controls.project.value;
  if (project.selectedCapabilities.includes("contact-form-web3forms")) {
    return planningFailure("PROFILE_TRANSITION_UNSUPPORTED");
  }
  if (project.ejectedAreas.length > 0 || controls.state.value.ejections.length > 0) {
    return planningFailure("PROJECT_EJECTION_UNSUPPORTED");
  }
  const snapshot = createVerifiedProjectSnapshot(project, controls.state.value);
  if (!snapshot.ok || snapshot.value.renderingContext === undefined) {
    return planningFailure("PROJECT_STATE_INCOMPATIBLE");
  }
  const renderingContext = snapshot.value.renderingContext;
  const targetRecipeVersion = snapshot.value.profiles.find(({ identifier }) => identifier === "app")?.recipeVersion;
  if (targetRecipeVersion !== "0.2.7") {
    return planningFailure("PROFILE_TRANSITION_EDGE_MISSING");
  }
  const edge = resolveSupportedProfileTransition({
    fromProfile: project.originProfile, fromRecipeVersion: project.recipeVersion, toProfile: "app", toRecipeVersion: targetRecipeVersion
  });
  if (!edge.ok) {
    return planningFailure(edge.code);
  }
  if (project.originProfile !== "portfolio" && project.originProfile !== "site") {
    return planningFailure("PROFILE_TRANSITION_SOURCE_UNSUPPORTED");
  }
  const catalog = createCapabilityCatalogSnapshot(verifiedCapabilityPackageVersions, renderingContext.catalogSnapshot);
  if (!catalog.ok) {
    return planningFailure("PROJECT_INSPECTION_INVALID");
  }
  const inspected = validInspection(await inspectProject({
    reader, catalog: catalog.value, profiles: renderingContext.profiles
  }));
  if (inspected === undefined) {
    return planningFailure("PROJECT_STATE_INCOMPATIBLE");
  }
  const renderInput = {
    projectName: project.project.name, displayName: project.project.displayName, packageVersions: verifiedCapabilityPackageVersions, ...(project.capabilitySettings["booking-calendly"] === undefined ? {} : { bookingCalendly: project.capabilitySettings["booking-calendly"] }), ...(project.capabilitySettings.analytics === undefined ? {} : { analytics: project.capabilitySettings.analytics }), ...(project.selectedCapabilities.includes("multilingual") ? { multilingual: true as const } : {})
  };
  const sourceResult = await renderSkeleton({ ...renderInput, profile: project.originProfile }, renderingContext);
  const targetResult = await renderSkeleton({ ...renderInput, profile: "app" }, renderingContext);
  if (!sourceResult.ok || !targetResult.ok) {
    return planningFailure("PROJECT_INSPECTION_INVALID");
  }
  const source = sourceResult.value;
  const target = targetResult.value;
  const agreement = hasExactAgreement(inspected, controls, source);
  if (!agreement.ok) {
    return agreement;
  }
  if (!sameJson(project, source.project)) {
    return planningFailure("PROJECT_STATE_INCOMPATIBLE");
  }
  if (inspected.inference.surfaces.some(({ status }) => status === "ejected")) {
    return planningFailure("PROJECT_EJECTION_UNSUPPORTED");
  }
  if (inspected.inference.surfaces.some(({ status }) => status !== "confirmed" && status !== "application-owned") || !exactSurfaceInventory(controls.state.value.managedSurfaces, expectedSourceSurfaces({ rendered: source }))) {
    return planningFailure("PROJECT_DRIFT_DETECTED");
  }
  const currentFiles = new Map<string, Uint8Array>();
  const sourcePaths = new Set(source.files.map(({ path }) => path));
  for (const path of [...new Set([...source.files, ...target.files].map(({ path }) => path))].sort(compareText)) {
    const read = await reader.readBytes?.(path);
    if (read?.kind === "file") {
      if (read.content.length > 1024 * 1024) {
        return planningFailure("PROJECT_INSPECTION_INVALID");
      }
      currentFiles.set(path, read.content);
    }
    else if (read?.kind !== "missing" || sourcePaths.has(path)) {
      return planningFailure("PROJECT_DRIFT_DETECTED");
    }
  }
  const prepared = prepareAppProfileTransition({
    source, target, currentFiles, validators: await loadAppTransitionContentValidators()
  });
  if (!prepared.ok) {
    return prepared;
  }
  const evidence = project.originProfile === "portfolio" ? await (input.readReviewedVisualEvidence ?? readReviewedAppTransitionVisualEvidence)({
    source, target, prepared: prepared.value
  }) : undefined;
  const selected = selectAppTransitionVisuals({
    prepared: prepared.value, source, evidence
  });
  if (!selected.ok) {
    return selected;
  }
  // Replacements bind the recognized installed source fingerprint, including
  // application-owned route/configuration and selected visual baselines.
  for (const disposition of selected.value.dispositions) {
    if (disposition.kind !== "replace-file") {
      continue;
    }
    const original = source.files.find(({ path }) => path === disposition.path);
    const installed = controls.state.value.managedSurfaces.filter(surface => surface.path === disposition.path && surface.fingerprintTarget.kind === "file");
    if (original === undefined || !sameBytes(currentFiles.get(disposition.path) ?? new Uint8Array(), original.content) || installed.length !== 1 || installed[0]?.fingerprint !== fingerprintFileContent(original.content)) {
      return planningFailure("PROJECT_DRIFT_DETECTED");
    }
  }
  const currentLock = await reader.readBytes?.("pnpm-lock.yaml");
  const sourceManifest = source.files.find(({ path }) => path === "apps/web/package.json");
  const targetManifest = target.files.find(({ path }) => path === "apps/web/package.json");
  if (sourceManifest === undefined || targetManifest === undefined) {
    return planningFailure("PROJECT_INSPECTION_INVALID");
  }
  const fromLock = resolveRecipeLockfileVersion({ originProfile: project.originProfile, recipeVersion: project.recipeVersion }, JSON.parse(new TextDecoder().decode(sourceManifest.content)));
  const toLock = resolveRecipeLockfileVersion({ originProfile: "app", recipeVersion: targetRecipeVersion }, JSON.parse(new TextDecoder().decode(targetManifest.content)));
  if (fromLock === undefined || toLock !== `app-${targetRecipeVersion}`) {
    return planningFailure("PROJECT_INSPECTION_INVALID");
  }
  const sourceLock = new Uint8Array(await readFile(createRecipeLockfileUrl(fromLock)));
  const targetLock = new Uint8Array(await readFile(createRecipeLockfileUrl(toLock)));
  if (evidence?.targetLockfileFingerprint !== undefined && evidence.targetLockfileFingerprint !== fingerprintFileContent(targetLock)) {
    return planningFailure("PROFILE_TRANSITION_VISUAL_EVIDENCE_REQUIRED");
  }
  if (currentLock?.kind !== "file" || !sameBytes(currentLock.content, sourceLock)) {
    return planningFailure("PROJECT_DRIFT_DETECTED");
  }
  const lockDisposition: AppTransitionDisposition = {
    kind: "replace-file", path: "pnpm-lock.yaml", reason: "recognized-source", owner: "builder-kernel", ownership: "managed"
  };
  const dispositions = [...selected.value.dispositions, lockDisposition].sort((a, b) => compareText(a.path, b.path));
  const plan = {
    operation: "transition-profile", status: "approval-required", source: {
      profile: project.originProfile, recipeVersion: project.recipeVersion, capabilities: capabilitySubjects(source)
    }, target: {
      profile: "app", recipeVersion: targetRecipeVersion, capabilities: capabilitySubjects(target)
    }, actions: dispositions.filter(({ kind }) => kind !== "preserve-file"), dispositions, requiredApprovals: ["transform", "verified-final-diff"], persistenceOrder: ["transform", "verify", "re-infer", "append-migration-record", "persist-state", "verify-state-and-inference"]
  } as const;
  const createTargets = await (input.inspectCreateTargets ?? inspectGitCreateTargets)({ root: identity.root, paths: plan.actions.filter(({ kind }) => kind === "create-file").map(({ path }) => path) });
  if (!createTargets.ok) {
    return planningFailure("PROFILE_TRANSITION_ACTION_CONFLICT");
  }
  const finalGit = await (input.inspectWorktree ?? inspectGitWorktree)({ root: identity.root });
  if (!finalGit.ok || !sameGitIdentity(identity, finalGit.identity)) {
    return planningFailure("PROJECT_INSPECTION_INVALID");
  }
  const fingerprintMaterial = {
    plan, rawControls: Object.fromEntries(controls.sources), parsedControls: {
      project: controls.project.value, state: controls.state.value, migrations: controls.migrations.value
    }, recipes: renderingContext.profiles, sourceCatalog: catalog.value, targetCatalog: catalog.value, sourceManifest: createInstalledManifest(source.resolved), targetManifest: createInstalledManifest(target.resolved), sourceSurfaces: expectedSourceSurfaces({ rendered: source }), targetSurfaces: expectedSourceSurfaces({ rendered: target }), sourceFiles: [...currentFiles].map(([path, content]) => ({ path, content: encodeBytes(content) })), targetFiles: selected.value.files.map(({ path, content }) => ({ path, content: encodeBytes(content) })), sourceLock: encodeBytes(sourceLock), targetLock: encodeBytes(targetLock), preservedFingerprints: selected.value.preservedFingerprints, influencingFingerprints: selected.value.influencingFingerprints, visualEvidence: evidence === undefined ? null : { ...evidence, baselines: evidence.baselines.map(({ path, content }) => ({ path, content: encodeBytes(content) })) }, gitIdentity: identity
  };
  return { ok: true, value: {
    plan: { ...plan, planFingerprint: fingerprintFileContent(encoder.encode(stringifyCanonicalJson(fingerprintMaterial))) },
    currentFiles: new Map([
      ...currentFiles,
      ["pnpm-lock.yaml", currentLock.content],
      ...[...controls.sources].map(([path, content]) => [path, encoder.encode(content)] as const),
    ]),
    targetFiles: new Map([
      ...selected.value.files.map(({ path, content }) => [path, content] as const),
      ["pnpm-lock.yaml", targetLock],
    ]),
    rendered: target,
  } };
}
export async function planProfileTransition(input: Readonly<{
  reader: RepositoryReader;
  git: Extract<GitWorktreeInspection, Readonly<{
    ok: true;
  }>>;
  toProfile: "site" | "app";
  readReviewedVisualEvidence?: ReadReviewedAppTransitionVisualEvidence;
  inspectCreateTargets?: typeof inspectGitCreateTargets;
  inspectWorktree?: typeof inspectGitWorktree;
}>): Promise<PlanningResult<AppProfileTransitionPlan>> {
  try {
    if (input.toProfile === "app") {
      const prepared = await prepareAppProfileTransitionExecution(input);
      return prepared.ok ? { ok: true, value: prepared.value.plan } : prepared;
    }
    return planningFailure("PROFILE_TRANSITION_UNSUPPORTED");
  }
  catch {
    return planningFailure("PROJECT_INSPECTION_INVALID");
  }
}
