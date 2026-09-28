import { createHash } from "node:crypto";

import { createGenerationRenderingContext, isApplicationEnvironmentRenderingContext, readVerifiedProjectSnapshot, verifiedCapabilityPackageVersions } from "../catalog/verified-package-versions.js";
import { createCapabilityCatalogSnapshot } from "../catalog/capability-catalog.js";
import { fingerprintFileContent, fingerprintJsonValue } from "../ownership/fingerprint.js";
import { prepareCapabilityDependencyChange } from "./prepare-capability-dependency-change.js";
import { readControlSnapshot } from "./lifecycle-control-snapshot.js";
import type { ManagedSurfaceDescriptor } from "../contracts/capability.js";
import type { ProfileIdentifier, ProfileRecipe } from "../contracts/profile.js";
import {
  analyticsSettingsSchema,
  applicationEnvironmentAnalyticsSettingsSchema,
  type ApplicationEnvironmentAnalyticsSettings,
  type AnalyticsSettings,
  type ProjectConfiguration,
  type ApplicationEnvironmentProjectConfiguration,
  calendlyBookingSettingsSchema,
  applicationEnvironmentBookingSettingsSchema,
  type ApplicationEnvironmentBookingSettings,
  web3FormsContactSettingsSchema,
  type Web3FormsContactSettings,
  type CalendlyBookingSettings,
} from "../contracts/project.js";
import type { ContractIssue } from "../contracts/result.js";
import type { InstalledSurface, InstalledState, ApplicationEnvironmentInstalledState } from "../contracts/state.js";
import {
  deriveProjectDiscrepancies,
  inspectProject,
  type ProjectInspection,
} from "../diagnostics/project-inspection.js";
import {
  renderSkeleton,
  type GeneratedFile,
  type RenderedSkeleton,
  type ApplicationEnvironmentRenderingContext,
} from "../generation/render-skeleton.js";
import { createBuilderStateSurfaces } from "../generation/builder-state-surfaces.js";
import type { RepositoryReader } from "../repository/repository-reader.js";
import { serializeProjectYaml } from "../state/codecs.js";
import { stringifyCanonicalJson } from "../serialization/canonical-json.js";
import type { GitWorktreeInspection } from "./git-worktree-inspection.js";

export type CapabilityAdditionAction = Readonly<{
  kind: "create-file" | "replace-file" | "replace-project-configuration";
  path: string;
  ownership: "managed" | "application-owned";
  owner: string;
}>;

export type CapabilityAdditionPlan = Readonly<{
  operation: "add-capability";
  status: "approval-required";
  planFingerprint: `sha256:${string}`;
  baseRevision: string;
  profile: ProfileIdentifier;
  capability: Readonly<{
    identifier: "multilingual" | "application-persistence" | "transactional-email-resend";
    version: "0.1.0";
  }> | Readonly<{ identifier: "analytics" | "contact-form-web3forms" | "booking-calendly"; version: "0.1.0" | "0.2.0" }>
    | Readonly<{ identifier: "background-job-delivery"; version: "0.2.0" }>;
  settings:
    | Readonly<{
        consentPolicy: "explicit-opt-in";
        providers: readonly (
          | "cloudflare-web-analytics"
          | "google-analytics-4"
          | "microsoft-clarity"
        )[];
        operationalIntegrations: readonly (
          | "google-search-console"
          | "looker-studio"
        )[];
        providerIdentifiers: "redacted";
      }>
    | Readonly<{
        mode: "link" | "inline" | "popup";
        destination: "redacted";
      }>
    | ApplicationEnvironmentBookingSettings
    | Readonly<{ accessKey: "redacted" }>
    | null;
  currentCapabilities: readonly string[];
  desiredCapabilities: readonly string[];
  actions: readonly CapabilityAdditionAction[];
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

type CapabilityAdditionPlanBody = Omit<
  CapabilityAdditionPlan,
  "planFingerprint"
>;

export type PlanningFailureCode =
  | "PROJECT_INSPECTION_INVALID"
  | "PROJECT_DRIFT_DETECTED"
  | "PROJECT_EJECTION_UNSUPPORTED"
  | "CAPABILITY_ACTION_CONFLICT"
  | "CAPABILITY_ALREADY_INSTALLED"
  | "CAPABILITY_ADDITION_UNSUPPORTED";

type PlanningIssue = Omit<ContractIssue, "code"> &
  Readonly<{ code: PlanningFailureCode }>;

type PlanningResult<T> =
  | Readonly<{ ok: true; value: T }>
  | Readonly<{
      ok: false;
      issues: readonly PlanningIssue[];
    }>;

type LifecycleProject = ProjectConfiguration | ApplicationEnvironmentProjectConfiguration;
type LifecycleState = InstalledState | ApplicationEnvironmentInstalledState;
type LifecycleInspection = ProjectInspection<LifecycleProject, LifecycleState>;

type ValidInspection = LifecycleInspection &
  Readonly<{
    project: Extract<LifecycleInspection["project"], Readonly<{ kind: "valid" }>>;
    migrations: Extract<
      LifecycleInspection["migrations"],
      Readonly<{ kind: "valid" }>
    >;
    inference: LifecycleInspection["inference"] &
      Readonly<{
        state: Extract<
          LifecycleInspection["inference"]["state"],
          Readonly<{ kind: "valid" }>
        >;
      }>;
    resolution: Extract<
      NonNullable<LifecycleInspection["resolution"]>,
      Readonly<{ ok: true }>
    >;
  }>;

const decoder = new TextDecoder("utf-8", { fatal: true });
const builderOwnedGeneratedDocumentation = new Set([
  "AGENTS.md",
  "README.md",
  "apps/web/AGENTS.md",
]);

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function planningFailure(
  code: PlanningFailureCode,
): PlanningResult<never> {
  const issue: PlanningIssue = {
    code,
    path: [],
    context: { reason: "precondition-refused" },
  };
  return { ok: false, issues: [issue] };
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

function fingerprintPlan(input: Readonly<{
  plan: CapabilityAdditionPlanBody;
  settings: AnalyticsSettings | ApplicationEnvironmentAnalyticsSettings | CalendlyBookingSettings | ApplicationEnvironmentBookingSettings | Web3FormsContactSettings | null;
  git: Extract<GitWorktreeInspection, Readonly<{ ok: true }>>;
  persistenceSnapshot?: string;
}>): `sha256:${string}` {
  const digest = createHash("sha256")
    .update(
      stringifyCanonicalJson({
        plan: input.plan,
        settings: input.settings,
        gitIdentity: input.git.identity,
        ...(input.persistenceSnapshot === undefined ? {} : { persistenceSnapshot: input.persistenceSnapshot }),
      }),
      "utf8",
    )
    .digest("hex");

  return `sha256:${digest}`;
}

function validatedInspection(
  inspection: LifecycleInspection,
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

function hasMaterialDrift(inspection: ValidInspection): boolean {
  const discrepancies = deriveProjectDiscrepancies(inspection);
  const materialCapabilities = discrepancies.capabilities.filter(
    ({ desired, identifier, installed }) =>
      !(
        (
          identifier === "analytics" ||
          identifier === "booking-calendly" ||
          identifier === "multilingual" ||
          identifier === "contact-form-web3forms"
        ) &&
        !desired &&
        !installed
      ),
  );

  return (
    materialCapabilities.length > 0 ||
    discrepancies.surfaces.length > 0 ||
    inspection.inference.capabilities.some(
      ({ category, identifier }) =>
        identifier !== "booking-calendly" &&
        identifier !== "analytics" &&
        identifier !== "multilingual" &&
        identifier !== "contact-form-web3forms" &&
        category !== "confirmed",
    ) ||
    inspection.inference.surfaces.some(
      ({ status }) =>
        status !== "confirmed" && status !== "application-owned" && status !== "ejected",
    )
  );
}

function hasUnsupportedEjection(inspection: ValidInspection): boolean {
  const projectEjections = inspection.project.value.ejectedAreas;
  const stateEjections = inspection.inference.state.value.ejections;

  return (
    projectEjections.length > 0 ||
    stateEjections.length > 0 ||
    inspection.inference.surfaces.some(({ status }) => status === "ejected")
  );
}

async function hasUnavailableApplicationOwnedSurface(
  reader: RepositoryReader,
  rendered: RenderedSkeleton<LifecycleProject>,
): Promise<boolean> {
  const paths = [
    ...new Set(
      rendered.surfaces
        .filter(({ ownership }) => ownership === "application-owned")
        .map(({ path }) => path),
    ),
  ].sort(compareText);

  for (const path of paths) {
    const result = await reader.readText(path);

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

function hasSurfaceInventoryDrift(
  installed: readonly InstalledSurface[],
  expected: readonly ManagedSurfaceDescriptor[],
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

      return (
        installedSurface.path !== surface.path ||
        installedSurface.ownership !== surface.ownership ||
        installedSurface.mergeStrategy !== surface.mergeStrategy ||
        !sameSurfaceOwner(installedSurface.owner, surface.owner) ||
        !sameFingerprintTarget(
          installedSurface.fingerprintTarget,
          surface.fingerprintTarget,
        )
      );
    })
  );
}

function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
  return (
    left.length === right.length &&
    left.every((byte, index) => byte === right[index])
  );
}

function actionOwnership(
  rendered: RenderedSkeleton<LifecycleProject>,
  path: string,
): Pick<CapabilityAdditionAction, "owner" | "ownership"> | undefined {
  if (path === "apps/web/package.json" || path === "pnpm-lock.yaml") {
    return { ownership: "managed", owner: "builder-kernel" };
  }
  const fileSurfaces = rendered.surfaces.filter(
    (surface) =>
      surface.path === path && surface.fingerprintTarget.kind === "file",
  );
  const surface = fileSurfaces[0];

  if (fileSurfaces.length === 0 && builderOwnedGeneratedDocumentation.has(path)) {
    return { ownership: "application-owned", owner: "builder-kernel" };
  }

  if (
    fileSurfaces.length !== 1 ||
    surface === undefined
  ) {
    return undefined;
  }

  return {
    ownership:
      surface.ownership === "application-owned"
        ? "application-owned"
        : "managed",
    owner:
      surface.owner.kind === "builder-kernel"
        ? "builder-kernel"
        : surface.owner.identifier,
  };
}

function changedFiles(
  current: RenderedSkeleton<LifecycleProject>,
  desired: RenderedSkeleton<LifecycleProject>,
):
  | Readonly<{
      created: readonly GeneratedFile[];
      replaced: readonly Readonly<{
        current: GeneratedFile;
        desired: GeneratedFile;
      }>[];
    }>
  | undefined {
  const currentFiles = new Map(current.files.map((file) => [file.path, file]));
  const desiredPaths = new Set(desired.files.map(({ path }) => path));

  if (current.files.some(({ path }) => !desiredPaths.has(path))) {
    return undefined;
  }

  const created: GeneratedFile[] = [];
  const replaced: Readonly<{
    current: GeneratedFile;
    desired: GeneratedFile;
  }>[] = [];

  for (const desiredFile of desired.files) {
    const currentFile = currentFiles.get(desiredFile.path);

    if (currentFile === undefined) {
      created.push(desiredFile);
    } else if (!sameBytes(currentFile.content, desiredFile.content)) {
      replaced.push({ current: currentFile, desired: desiredFile });
    }
  }

  return { created, replaced };
}

async function deriveActions(input: Readonly<{
  reader: RepositoryReader;
  current: RenderedSkeleton<LifecycleProject>;
  desired: RenderedSkeleton<LifecycleProject>;
}>): Promise<PlanningResult<readonly CapabilityAdditionAction[]>> {
  const differences = changedFiles(input.current, input.desired);

  if (differences === undefined) {
    return planningFailure("PROJECT_INSPECTION_INVALID");
  }

  const actions: CapabilityAdditionAction[] = [
    {
      kind: "replace-project-configuration",
      path: ".egeria/project.yaml",
      ownership: "managed",
      owner: "builder-kernel",
    },
  ];

  for (const file of differences.created) {
    const availability = await input.reader.readText(file.path);

    if (availability.kind !== "missing") {
      return planningFailure("CAPABILITY_ACTION_CONFLICT");
    }

    const ownership = actionOwnership(input.desired, file.path);

    if (ownership === undefined) {
      return planningFailure("PROJECT_INSPECTION_INVALID");
    }

    actions.push({ kind: "create-file", path: file.path, ...ownership });
  }

  for (const pair of differences.replaced) {
    const current = await input.reader.readText(pair.current.path);
    let expected: string;

    try {
      expected = decoder.decode(pair.current.content);
    } catch {
      return planningFailure("PROJECT_INSPECTION_INVALID");
    }

    if (current.kind !== "file" || current.content !== expected) {
      return planningFailure("PROJECT_DRIFT_DETECTED");
    }

    const ownership = actionOwnership(input.desired, pair.desired.path);

    if (ownership === undefined) {
      return planningFailure("PROJECT_INSPECTION_INVALID");
    }

    actions.push({ kind: "replace-file", path: pair.desired.path, ...ownership });
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

async function planCapabilityAdditionUnchecked(input: Readonly<{
  reader: RepositoryReader;
  git: Extract<GitWorktreeInspection, Readonly<{ ok: true }>>;
  capability: "analytics" | "booking-calendly" | "multilingual" | "application-persistence" | "transactional-email-resend" | "contact-form-web3forms" | "background-job-delivery";
  settings?: AnalyticsSettings | ApplicationEnvironmentAnalyticsSettings | CalendlyBookingSettings | ApplicationEnvironmentBookingSettings | Web3FormsContactSettings;
  renderingContext?: ApplicationEnvironmentRenderingContext;
}>): Promise<PlanningResult<CapabilityAdditionPlan>> {
  const capabilityValue: unknown = Reflect.get(input, "capability");
  if (input.renderingContext !== undefined && (
    !isApplicationEnvironmentRenderingContext(input.renderingContext) ||
    (capabilityValue !== "contact-form-web3forms" && capabilityValue !== "booking-calendly" && capabilityValue !== "analytics") ||
    (capabilityValue === "contact-form-web3forms" && input.settings !== undefined)
  )) return planningFailure("CAPABILITY_ADDITION_UNSUPPORTED");

  if (
    capabilityValue !== "analytics" &&
    capabilityValue !== "booking-calendly" &&
    capabilityValue !== "multilingual" &&
    capabilityValue !== "application-persistence" &&
    capabilityValue !== "transactional-email-resend" &&
    capabilityValue !== "contact-form-web3forms" &&
    capabilityValue !== "background-job-delivery"
  ) {
    return planningFailure("CAPABILITY_ADDITION_UNSUPPORTED");
  }

  const environmentAnalyticsSettings = input.renderingContext !== undefined && capabilityValue === "analytics"
    ? applicationEnvironmentAnalyticsSettingsSchema.safeParse(input.settings) : undefined;
  const environmentBookingSettings = input.renderingContext !== undefined && capabilityValue === "booking-calendly"
    ? applicationEnvironmentBookingSettingsSchema.safeParse(input.settings) : undefined;
  const settingsResult = input.renderingContext === undefined && capabilityValue === "booking-calendly"
    ? calendlyBookingSettingsSchema.safeParse(input.settings)
    : undefined;
  const contactSettingsResult = input.renderingContext === undefined && capabilityValue === "contact-form-web3forms"
    ? web3FormsContactSettingsSchema.safeParse(input.settings) : undefined;
  const analyticsSettingsResult = input.renderingContext === undefined && capabilityValue === "analytics"
    ? analyticsSettingsSchema.safeParse(input.settings)
    : undefined;
  if (
    (environmentAnalyticsSettings !== undefined && !environmentAnalyticsSettings.success) ||
    (environmentBookingSettings !== undefined && !environmentBookingSettings.success) ||
    (settingsResult !== undefined && !settingsResult.success) ||
    (contactSettingsResult !== undefined && !contactSettingsResult.success) ||
    (analyticsSettingsResult !== undefined && !analyticsSettingsResult.success) ||
    ((capabilityValue === "multilingual" || capabilityValue === "application-persistence" || capabilityValue === "transactional-email-resend" || capabilityValue === "background-job-delivery") && input.settings !== undefined)
  ) {
    return planningFailure("CAPABILITY_ADDITION_UNSUPPORTED");
  }

  const parsedAnalyticsSettings = environmentAnalyticsSettings?.success === true
    ? environmentAnalyticsSettings.data
    : analyticsSettingsResult?.success === true ? analyticsSettingsResult.data : undefined;

  const snapshot = input.renderingContext === undefined
    ? await readVerifiedProjectSnapshot(input.reader)
    : await readVerifiedProjectSnapshot(input.reader, input.renderingContext);

  if (!snapshot.ok) {
    return planningFailure("PROJECT_INSPECTION_INVALID");
  }

  const inspection = validatedInspection(
    await (input.renderingContext === undefined
      ? inspectProject({ reader: snapshot.value.reader, catalog: snapshot.value.catalog, profiles: snapshot.value.profiles })
      : inspectProject({ reader: snapshot.value.reader, catalog: snapshot.value.catalog, profiles: snapshot.value.profiles, projectSchemaVersion: "2.0.0" })),
    snapshot.value.profiles,
  );

  if (inspection === undefined) {
    return planningFailure("PROJECT_INSPECTION_INVALID");
  }

  const project = inspection.project.value;
  if (project.selectedCapabilities.includes("background-job-delivery")) return planningFailure("CAPABILITY_ADDITION_UNSUPPORTED");

  if (hasMaterialDrift(inspection)) {
    return planningFailure("PROJECT_DRIFT_DETECTED");
  }

  if (hasUnsupportedEjection(inspection)) {
    return planningFailure("PROJECT_EJECTION_UNSUPPORTED");
  }

  const state = inspection.inference.state.value;
  if (capabilityValue === "application-persistence" && (
    project.originProfile !== "app" || project.recipeVersion !== "0.2.0" ||
    snapshot.value.renderingContext?.catalogSnapshot.standards !== "0.5.0"
  )) return planningFailure("CAPABILITY_ADDITION_UNSUPPORTED");
  if (input.renderingContext === undefined && (capabilityValue === "transactional-email-resend" || capabilityValue === "contact-form-web3forms" || capabilityValue === "background-job-delivery") && !(
    (project.originProfile === "portfolio" && project.recipeVersion === "0.11.0") ||
    (project.originProfile === "site" && project.recipeVersion === "0.12.0") ||
    (project.originProfile === "app" && project.recipeVersion === "0.2.0")
  )) return planningFailure("CAPABILITY_ADDITION_UNSUPPORTED");
  const capabilityInstalled =
    project.selectedCapabilities.includes(capabilityValue) ||
    state.installedCapabilities.some(
      ({ identifier }) => identifier === capabilityValue,
    );

  if (capabilityInstalled) {
    return planningFailure("CAPABILITY_ALREADY_INSTALLED");
  }

  const targetContext = capabilityValue === "application-persistence" || capabilityValue === "transactional-email-resend" || capabilityValue === "background-job-delivery"
    ? createGenerationRenderingContext(
        capabilityValue === "application-persistence" || project.selectedCapabilities.includes("application-persistence"),
        capabilityValue === "transactional-email-resend" || capabilityValue === "background-job-delivery" || snapshot.value.renderingContext?.catalogSnapshot.appFoundation === "0.2.0",
        capabilityValue === "background-job-delivery",
      ) : snapshot.value.renderingContext;
  const targetCatalog = targetContext === undefined ? { ok: true as const, value: snapshot.value.catalog }
    : createCapabilityCatalogSnapshot(verifiedCapabilityPackageVersions, targetContext.catalogSnapshot);
  if (!targetCatalog.ok) return planningFailure("PROJECT_INSPECTION_INVALID");
  const commonRenderRequest = {
    profile: project.originProfile,
    projectName: project.project.name,
    displayName: project.project.displayName,
    ...(project.selectedCapabilities.includes("multilingual") ? { multilingual: true as const } : {}),
    packageVersions: verifiedCapabilityPackageVersions,
  };
  const legacyProject = project.schemaVersion === "1.0.0" ? project : undefined;
  const renderRequest = {
    ...commonRenderRequest,
    ...(legacyProject?.capabilitySettings["booking-calendly"] === undefined
      ? {}
      : { bookingCalendly: legacyProject.capabilitySettings["booking-calendly"] }),
    ...(legacyProject?.capabilitySettings.analytics === undefined
      ? {}
      : { analytics: legacyProject.capabilitySettings.analytics }),
    ...(project.selectedCapabilities.includes("application-persistence")
      ? { applicationPersistence: true as const } : {}),
    ...(project.selectedCapabilities.includes("transactional-email-resend") ? { transactionalEmailResend: true as const } : {}),
    ...(legacyProject?.capabilitySettings["contact-form-web3forms"] === undefined ? {} : { contactFormWeb3Forms: legacyProject.capabilitySettings["contact-form-web3forms"] }),
  };
  const environmentProject = project.schemaVersion === "2.0.0" ? project : undefined;
  const environmentRenderRequest = {
    ...commonRenderRequest,
    ...(environmentProject?.capabilitySettings.analytics === undefined ? {} : { analytics: environmentProject.capabilitySettings.analytics }),
    ...(environmentProject?.capabilitySettings["booking-calendly"] === undefined ? {} : { bookingCalendly: environmentProject.capabilitySettings["booking-calendly"] }),
    ...(project.selectedCapabilities.includes("contact-form-web3forms") ? { contactFormWeb3Forms: true as const } : {}),
  };
  const currentResult = input.renderingContext === undefined
    ? await renderSkeleton(renderRequest, snapshot.value.renderingContext)
    : await renderSkeleton(environmentRenderRequest, input.renderingContext);

  if (!currentResult.ok) {
    return planningFailure("PROJECT_INSPECTION_INVALID");
  }

  if (
    hasSurfaceInventoryDrift(
      state.managedSurfaces,
      [
        ...currentResult.value.surfaces,
        ...createBuilderStateSurfaces(),
      ],
    ) ||
    await hasUnavailableApplicationOwnedSurface(
      input.reader,
      currentResult.value,
    )
  ) {
    return planningFailure("PROJECT_DRIFT_DETECTED");
  }

  const descriptor = targetCatalog.value.find(
    ({ identifier }) => identifier === capabilityValue,
  );

  if (descriptor?.version !== (input.renderingContext !== undefined || capabilityValue === "background-job-delivery" ? "0.2.0" : "0.1.0")) {
    return planningFailure("PROJECT_INSPECTION_INVALID");
  }

  const desiredResult = input.renderingContext === undefined ? await renderSkeleton({
    ...renderRequest,
    ...(capabilityValue === "analytics" && analyticsSettingsResult?.success === true
      ? { analytics: analyticsSettingsResult.data }
      : capabilityValue === "booking-calendly" && settingsResult?.success === true
        ? { bookingCalendly: settingsResult.data }
        : capabilityValue === "contact-form-web3forms" && contactSettingsResult?.success === true
          ? { contactFormWeb3Forms: contactSettingsResult.data }
        : capabilityValue === "background-job-delivery"
          ? { backgroundJobDelivery: true as const }
        : capabilityValue === "transactional-email-resend"
          ? { transactionalEmailResend: true as const }
        : capabilityValue === "application-persistence"
          ? { applicationPersistence: true as const }
          : { multilingual: true as const }),
  }, targetContext) : await renderSkeleton({
    ...environmentRenderRequest,
    ...(capabilityValue === "contact-form-web3forms" ? { contactFormWeb3Forms: true as const } : {}),
    ...(environmentBookingSettings?.success ? { bookingCalendly: environmentBookingSettings.data } : {}),
    ...(environmentAnalyticsSettings?.success ? { analytics: environmentAnalyticsSettings.data } : {}),
  }, input.renderingContext);

  if (!desiredResult.ok) {
    return planningFailure("PROJECT_INSPECTION_INVALID");
  }

  const currentConfiguration = await input.reader.readText(
    ".egeria/project.yaml",
  );

  if (
    currentConfiguration.kind !== "file" ||
    currentConfiguration.content !== serializeProjectYaml(project)
  ) {
    return planningFailure("PROJECT_DRIFT_DETECTED");
  }

  const prepared = await prepareCapabilityDependencyChange<LifecycleProject>({
    reader: input.reader, current: currentResult.value, desired: desiredResult.value,
  });
  if (!prepared.ok) return planningFailure("PROJECT_DRIFT_DETECTED");
  const actionResult = await deriveActions({ reader: input.reader, ...prepared.value });

  if (!actionResult.ok) {
    return actionResult;
  }

  const currentCapabilities = inspection.resolution.value.capabilities
    .map(({ identifier }) => identifier)
    .sort(compareText);
  const desiredCapabilities = desiredResult.value.resolved.capabilities
    .map(({ identifier }) => identifier)
    .sort(compareText);

  const plan: CapabilityAdditionPlanBody = {
      operation: "add-capability",
      status: "approval-required",
      baseRevision: input.git.identity.revision,
      profile: project.originProfile,
      capability: capabilityValue === "analytics" || capabilityValue === "contact-form-web3forms" || capabilityValue === "booking-calendly"
        ? { identifier: capabilityValue, version: input.renderingContext === undefined ? "0.1.0" : "0.2.0" }
        : capabilityValue === "background-job-delivery"
          ? { identifier: capabilityValue, version: "0.2.0" }
          : { identifier: capabilityValue, version: "0.1.0" },
      settings:
        parsedAnalyticsSettings !== undefined
          ? {
              consentPolicy: parsedAnalyticsSettings.consent.policy,
              providers: [
                ...(parsedAnalyticsSettings.providers.cloudflareWebAnalytics === undefined
                  ? []
                  : ["cloudflare-web-analytics" as const]),
                ...(parsedAnalyticsSettings.providers.googleAnalytics4 === undefined
                  ? []
                  : ["google-analytics-4" as const]),
                ...(parsedAnalyticsSettings.providers.microsoftClarity === undefined
                  ? []
                  : ["microsoft-clarity" as const]),
              ],
              operationalIntegrations: [
                ...(parsedAnalyticsSettings.operationalIntegrations.googleSearchConsole === undefined
                  ? []
                  : ["google-search-console" as const]),
                ...(parsedAnalyticsSettings.operationalIntegrations.lookerStudio === undefined
                  ? []
                  : ["looker-studio" as const]),
              ],
              providerIdentifiers: "redacted",
            }
          : environmentBookingSettings?.success === true ? { mode: environmentBookingSettings.data.mode }
          : settingsResult?.success === true
          ? {
              mode: settingsResult.data.mode,
              destination: "redacted",
            }
          : contactSettingsResult?.success === true ? { accessKey: "redacted" } : null,
      currentCapabilities,
      desiredCapabilities,
      actions: actionResult.value,
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

  let persistenceSnapshot: string | undefined;
  if (input.renderingContext !== undefined || capabilityValue === "application-persistence" || capabilityValue === "transactional-email-resend" || capabilityValue === "background-job-delivery") {
    const controls = input.renderingContext === undefined
      ? await readControlSnapshot(input.reader) : await readControlSnapshot(input.reader, "2.0.0");
    if (controls === undefined) return planningFailure("PROJECT_INSPECTION_INVALID");
    persistenceSnapshot = fingerprintJsonValue({
      current: prepared.value.current.files.map(({ path, content }) => ({ path, fingerprint: fingerprintFileContent(content) })),
      desired: prepared.value.desired.files.map(({ path, content }) => ({ path, fingerprint: fingerprintFileContent(content) })),
      ...(input.renderingContext === undefined ? {} : { renderingContext: input.renderingContext }),
      sourceCatalog: snapshot.value.catalog,
      targetCatalog: targetCatalog.value,
      project: controls.projectSource,
      state: controls.stateSource,
      migrations: controls.migrationSource,
    });
  }
  return {
    ok: true,
    value: {
      ...plan,
      planFingerprint: fingerprintPlan({
        plan,
        settings:
          parsedAnalyticsSettings ?? (environmentBookingSettings?.success === true ? environmentBookingSettings.data
            : settingsResult?.success === true
              ? settingsResult.data
              : contactSettingsResult?.success === true ? contactSettingsResult.data : null),
        git: input.git,
        ...(persistenceSnapshot === undefined ? {} : { persistenceSnapshot }),
      }),
    },
  };
}

export async function planCapabilityAddition(input: Readonly<{
  reader: RepositoryReader;
  git: Extract<GitWorktreeInspection, Readonly<{ ok: true }>>;
  capability: "analytics" | "booking-calendly" | "multilingual" | "application-persistence" | "transactional-email-resend" | "contact-form-web3forms" | "background-job-delivery";
  settings?: AnalyticsSettings | ApplicationEnvironmentAnalyticsSettings | CalendlyBookingSettings | ApplicationEnvironmentBookingSettings | Web3FormsContactSettings;
  renderingContext?: ApplicationEnvironmentRenderingContext;
}>): Promise<PlanningResult<CapabilityAdditionPlan>> {
  return planCapabilityAdditionUnchecked(input);
}
