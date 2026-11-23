import { deploymentViewForVersion, publicBuildManagedFiles, supportedDeploymentViews, type CapabilityDescriptor, type RetainedDeploymentView } from "../contracts/capability.js";
import type { ProfileRecipe } from "../contracts/profile.js";
import { projectConfigurationSchema, type ProjectConfiguration } from "../contracts/project.js";
import type { ValidationResult } from "../contracts/result.js";
import { installedStateSchema, type InstalledState } from "../contracts/state.js";
import type { ApplicationEnvironmentRenderingContext } from "../generation/render-skeleton.js";
import { currentNextVersion, retainedNextVersion } from "../generation/recipe-lockfiles.js";
import { retainedAnalyticsConsentTemplates, retainedSectionTemplates } from "../generation/template-catalog.js";
import { fingerprintJsonValue } from "../ownership/fingerprint.js";
import { createApplicationEnvironmentProfileRecipes } from "../profiles/profile-recipes.js";
import { createCachingRepositoryReader } from "../repository/cache-reader.js";
import type { RepositoryReader } from "../repository/repository-reader.js";
import { createInstalledManifest } from "../manifest/create-installed-manifest.js";
import { resolveCapabilities } from "../resolution/resolve-capabilities.js";
import { stringifyCanonicalJson } from "../serialization/canonical-json.js";
import { parseProjectYaml, parseStateJson } from "../state/codecs.js";
import {
  applicationEnvironmentSnapshotFor,
  createCapabilityCatalog,
  createCapabilityCatalogSnapshot,
} from "./capability-catalog.js";

export const verifiedCapabilityPackageVersions = Object.freeze({
  standards: "0.1.0",
  observability: "0.3.0",
} as const);

export function createVerifiedCapabilityCatalog(): ValidationResult<readonly CapabilityDescriptor[]> {
  return createCapabilityCatalog(verifiedCapabilityPackageVersions);
}

export function createGenerationRenderingContext(
  applicationPersistence = false,
  retainAppFoundation = false,
  backgroundJobs = false,
  retainedNext?: typeof retainedNextVersion,
  retainAnalyticsConsent?: true,
  retainDeployment: RetainedDeploymentView = false,
  retainSections?: true,
  retainPublicContentRouting?: true,
): ApplicationEnvironmentRenderingContext {
  return createApplicationEnvironmentRenderingContext(applicationPersistence, retainAppFoundation, backgroundJobs, retainedNext, retainAnalyticsConsent, retainDeployment, retainSections, retainPublicContentRouting);
}

type VerifiedProjectSnapshot = Readonly<{
  catalog: readonly CapabilityDescriptor[];
  profiles: readonly ProfileRecipe[];
  renderingContext: ApplicationEnvironmentRenderingContext;
}>;

function invalidProjectSnapshot(): ValidationResult<never> {
  return {
    ok: false,
    issues: [{ code: "PROJECT_INSPECTION_INVALID", path: [], context: { reason: "installed-controls-invalid" } }],
  };
}

function canonicalInstalledManifest(capabilities: InstalledState["installedCapabilities"]): string {
  return stringifyCanonicalJson(capabilities.map(capability => ({
    ...capability,
    stateClassifications: [...capability.stateClassifications].sort(),
  })).sort((left, right) => left.identifier < right.identifier ? -1 : left.identifier > right.identifier ? 1 : 0));
}

const publicContentRoutingAnchors = [
  ["site-routing", "site-routing-content-schema", "apps/web/src/routing/routing-content-schema.ts", "application-owned",
    "sha256:787c8e043fccd76b79f2d616af2fba35c878007da4be6f1950e03d17f6900724",
    "sha256:98c3284568587549c7a08e17c84f86769d44852dba1468f65fe7ea82200e1222"],
  ["multilingual", "multilingual-content-contract", "apps/web/src/i18n/localized-content.ts", "managed",
    "sha256:af156157ef4e6c8f7802b6625d2b49efdb8b0ffc862d5536b9994d7e7dbf3287",
    "sha256:a5e8906af5f2ea05543329c986cf76b072c882e6801d94dce1cc8cef016becb5"],
  ["booking-calendly", "booking-calendly-french-content", "apps/web/content/fr-CA/booking-calendly.yaml", "application-owned",
    "sha256:8ce430913d009dda290dbcd0cbc194478c93e53a4869304d8fb58215d7b8260c",
    "sha256:2f9ac95d13c0cf6b5ec1c3a41438f160c32bc0735f8c47dffb2afe2fff15a6dd"],
] as const;

function installedPublicContentRouting(
  project: ProjectConfiguration,
  state: InstalledState,
): "retained" | "current" | undefined {
  let view: "retained" | "current" | undefined;
  for (const [owner, identifier, path, ownership, retained, current] of publicContentRoutingAnchors) {
    if (!project.selectedCapabilities.includes(owner)) continue;
    const declarations = state.managedSurfaces.filter(surface => surface.identifier === identifier || surface.path === path);
    const [surface] = declarations;
    if (declarations.length !== 1 || surface?.identifier !== identifier ||
      surface.path !== path || surface.ownership !== ownership ||
      surface.owner.kind !== "capability" || surface.owner.identifier !== owner ||
      surface.fingerprintTarget.kind !== "file" || surface.mergeStrategy !== "replace-file") return undefined;
    const anchorView = surface.fingerprint === retained ? "retained" : surface.fingerprint === current ? "current" : undefined;
    if (anchorView === undefined || (view !== undefined && view !== anchorView)) return undefined;
    view = anchorView;
  }
  return view ?? "current";
}

export function createVerifiedProjectSnapshot(
  project: ProjectConfiguration | undefined,
  state: InstalledState | undefined,
): ValidationResult<VerifiedProjectSnapshot> {
  const projectResult = projectConfigurationSchema.safeParse(project);
  const stateResult = installedStateSchema.safeParse(state);
  if (!projectResult.success || !stateResult.success) return invalidProjectSnapshot();
  const projectValue = projectResult.data;
  const stateValue = stateResult.data;
  if (projectValue.originProfile !== stateValue.origin.profile || projectValue.recipeVersion !== stateValue.origin.recipeVersion) return invalidProjectSnapshot();
  const nextSurface = stateValue.managedSurfaces.find(surface =>
    surface.identifier === "builder-web-package-next" && surface.owner.kind === "builder-kernel" &&
    surface.path === "apps/web/package.json" && surface.ownership === "merge-managed" &&
    surface.fingerprintTarget.kind === "json-value" && surface.fingerprintTarget.pointer === "/dependencies/next");
  if (nextSurface === undefined || stateValue.ejections.includes(nextSurface.path)) return invalidProjectSnapshot();
  const retainsNext = nextSurface.fingerprint === fingerprintJsonValue(retainedNextVersion);
  if (!retainsNext && nextSurface.fingerprint !== fingerprintJsonValue(currentNextVersion)) return invalidProjectSnapshot();
  const analyticsSelected = projectValue.selectedCapabilities.includes("analytics");
  const retainedConsentCount = analyticsSelected ? retainedAnalyticsConsentTemplates.filter(([identifier, path, fingerprint]) =>
    stateValue.managedSurfaces.some(surface => surface.identifier === identifier && surface.path === path &&
      surface.owner.kind === "capability" && surface.owner.identifier === "analytics" &&
      surface.fingerprintTarget.kind === "file" && surface.fingerprint === fingerprint),
  ).length : 0;
  if (retainedConsentCount !== 0 && retainedConsentCount !== retainedAnalyticsConsentTemplates.length) {
    return invalidProjectSnapshot();
  }
  const persistence = projectValue.selectedCapabilities.includes("application-persistence");
  const jobs = projectValue.selectedCapabilities.includes("background-job-delivery");
  const deploymentVersion = stateValue.installedCapabilities.find(({ identifier }) => identifier === "deployment-cloudflare")?.version;
  const deploymentView = deploymentViewForVersion(persistence, jobs, deploymentVersion);
  if (deploymentView === undefined) return invalidProjectSnapshot();
  const matchesDeploymentInventory = publicBuildManagedFiles.every(([identifier, path]) => {
    const declarations = stateValue.managedSurfaces.filter(surface => surface.identifier === identifier || surface.path === path);
    if (deploymentView === true) return declarations.length === 0;
    const [surface] = declarations;
    return declarations.length === 1 && surface?.identifier === identifier && surface.path === path &&
      surface.owner.kind === "capability" && surface.owner.identifier === "deployment-cloudflare" &&
      surface.ownership === "managed" && surface.fingerprintTarget.kind === "file" && surface.mergeStrategy === "replace-file" &&
      !stateValue.ejections.includes(path) && !projectValue.ejectedAreas.includes(path);
  });
  if (!matchesDeploymentInventory) return invalidProjectSnapshot();
  const retainsSectionTemplates = retainedSectionTemplates.every(([identifier, owner, path, fingerprint]) =>
    stateValue.managedSurfaces.some(surface => surface.identifier === identifier && surface.path === path &&
      surface.owner.kind === "capability" && surface.owner.identifier === owner &&
      surface.ownership === "application-owned" && surface.fingerprintTarget.kind === "file" &&
      surface.fingerprint === fingerprint),
  );
  const publicContentRouting = installedPublicContentRouting(projectValue, stateValue);
  if (publicContentRouting === undefined) return invalidProjectSnapshot();
  const renderingContext = createGenerationRenderingContext(
    persistence,
    projectValue.selectedCapabilities.includes("app-foundation"),
    jobs,
    retainsNext ? retainedNextVersion : undefined,
    retainedConsentCount === retainedAnalyticsConsentTemplates.length ? true : undefined,
    deploymentView,
    retainsSectionTemplates ? true : undefined,
    publicContentRouting === "retained" ? true : undefined,
  );
  const catalog = createCapabilityCatalogSnapshot(verifiedCapabilityPackageVersions, renderingContext.catalogSnapshot);
  if (!catalog.ok) return catalog;
  const resolved = resolveCapabilities({ profile: projectValue.originProfile, requestedCapabilities: projectValue.selectedCapabilities }, catalog.value, renderingContext.profiles);
  if (!resolved.ok) return invalidProjectSnapshot();
  const expectedManifest = createInstalledManifest(resolved.value);
  if (canonicalInstalledManifest(expectedManifest) !== canonicalInstalledManifest(stateValue.installedCapabilities)) {
    return invalidProjectSnapshot();
  }
  return { ok: true, value: { catalog: catalog.value, profiles: renderingContext.profiles, renderingContext } };
}

export async function readVerifiedProjectSnapshot(
  sourceReader: RepositoryReader,
  context?: ApplicationEnvironmentRenderingContext,
): Promise<ValidationResult<VerifiedProjectSnapshot & Readonly<{ reader: RepositoryReader }>>> {
  if (context !== undefined && !isApplicationEnvironmentRenderingContext(context)) return invalidProjectSnapshot();
  const reader = createCachingRepositoryReader(sourceReader);
  const [projectSource, stateSource] = await Promise.all([
    reader.readText(".egeria/project.yaml"), reader.readText(".egeria/state.json"),
  ]);
  if (projectSource.kind !== "file" || stateSource.kind !== "file") return invalidProjectSnapshot();
  const project = parseProjectYaml(projectSource.content);
  const state = parseStateJson(stateSource.content);
  if (!project.ok || !state.ok) return invalidProjectSnapshot();
  const snapshot = createVerifiedProjectSnapshot(project.value, state.value);
  return snapshot.ok ? { ok: true, value: { ...snapshot.value, reader } } : snapshot;
}

export function createApplicationEnvironmentRenderingContext(
  applicationPersistence = false,
  retainAppFoundation = false,
  backgroundJobs = false,
  retainedNext?: typeof retainedNextVersion,
  retainAnalyticsConsent?: true,
  retainDeployment: RetainedDeploymentView = false,
  retainSections?: true,
  retainPublicContentRouting?: true,
): ApplicationEnvironmentRenderingContext {
  return {
    projectSchemaVersion: "2.0.0",
    ...(retainedNext === undefined ? {} : { retainedNextVersion: retainedNext }),
    ...(retainAppFoundation ? { retainAppFoundation: true } : {}),
    ...(retainAnalyticsConsent ? { retainAnalyticsConsent: true } : {}),
    ...(retainSections ? { retainSections: true } : {}),
    ...(retainPublicContentRouting ? { retainPublicContentRouting: true } : {}),
    catalogSnapshot: applicationEnvironmentSnapshotFor(applicationPersistence, backgroundJobs, retainDeployment),
    profiles: createApplicationEnvironmentProfileRecipes(),
  };
}

export function isApplicationEnvironmentRenderingContext(value: unknown): value is ApplicationEnvironmentRenderingContext {
  try {
    const retainedNext = typeof value === "object" && value !== null && "retainedNextVersion" in value &&
      value.retainedNextVersion === retainedNextVersion ? retainedNextVersion : undefined;
    const retainAnalyticsConsent = typeof value === "object" && value !== null &&
      "retainAnalyticsConsent" in value && value.retainAnalyticsConsent === true ? true : undefined;
    const retainSections = typeof value === "object" && value !== null &&
      "retainSections" in value && value.retainSections === true ? true : undefined;
    const retainPublicContentRouting = typeof value === "object" && value !== null &&
      "retainPublicContentRouting" in value && value.retainPublicContentRouting === true ? true : undefined;
    const serialized = stringifyCanonicalJson(value);
    return [false, true].some((persistence) =>
      [false, true].some((retainFoundation) =>
        [false, true].some((jobs) => supportedDeploymentViews(jobs).some(retainDeployment =>
          serialized === stringifyCanonicalJson(createApplicationEnvironmentRenderingContext(persistence, retainFoundation, jobs, retainedNext, retainAnalyticsConsent, retainDeployment, retainSections, retainPublicContentRouting))))),
    );
  } catch {
    return false;
  }
}
