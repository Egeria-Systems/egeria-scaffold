import type { CapabilityDescriptor } from "../contracts/capability.js";
import type { ProfileRecipe } from "../contracts/profile.js";
import { projectConfigurationSchema, type ProjectConfiguration } from "../contracts/project.js";
import type { ValidationResult } from "../contracts/result.js";
import { installedStateSchema, type InstalledState } from "../contracts/state.js";
import type { ApplicationEnvironmentRenderingContext } from "../generation/render-skeleton.js";
import { currentNextVersion, retainedNextVersion } from "../generation/recipe-lockfiles.js";
import { retainedAnalyticsConsentTemplates } from "../generation/template-catalog.js";
import { fingerprintJsonValue } from "../ownership/fingerprint.js";
import { createApplicationEnvironmentProfileRecipes } from "../profiles/profile-recipes.js";
import { createCachingRepositoryReader } from "../repository/cache-reader.js";
import type { RepositoryReader } from "../repository/repository-reader.js";
import { createInstalledManifest } from "../manifest/create-installed-manifest.js";
import { resolveCapabilities } from "../resolution/resolve-capabilities.js";
import { stringifyCanonicalJson } from "../serialization/canonical-json.js";
import { parseProjectYaml, parseStateJson } from "../state/codecs.js";
import {
  applicationEnvironmentCatalogSnapshot,
  applicationEnvironmentPersistenceCatalogSnapshot,
  applicationEnvironmentJobsCatalogSnapshot,
  applicationEnvironmentPersistenceJobsCatalogSnapshot,
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
): ApplicationEnvironmentRenderingContext {
  return createApplicationEnvironmentRenderingContext(applicationPersistence, retainAppFoundation, backgroundJobs, retainedNext, retainAnalyticsConsent);
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
  const renderingContext = createGenerationRenderingContext(
    projectValue.selectedCapabilities.includes("application-persistence"),
    projectValue.selectedCapabilities.includes("app-foundation"),
    projectValue.selectedCapabilities.includes("background-job-delivery"),
    retainsNext ? retainedNextVersion : undefined,
    retainedConsentCount === retainedAnalyticsConsentTemplates.length ? true : undefined,
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
): ApplicationEnvironmentRenderingContext {
  return {
    projectSchemaVersion: "2.0.0",
    ...(retainedNext === undefined ? {} : { retainedNextVersion: retainedNext }),
    ...(retainAppFoundation ? { retainAppFoundation: true } : {}),
    ...(retainAnalyticsConsent ? { retainAnalyticsConsent: true } : {}),
    catalogSnapshot: backgroundJobs
      ? (applicationPersistence ? applicationEnvironmentPersistenceJobsCatalogSnapshot : applicationEnvironmentJobsCatalogSnapshot)
      : (applicationPersistence ? applicationEnvironmentPersistenceCatalogSnapshot : applicationEnvironmentCatalogSnapshot),
    profiles: createApplicationEnvironmentProfileRecipes(),
  };
}

export function isApplicationEnvironmentRenderingContext(value: unknown): value is ApplicationEnvironmentRenderingContext {
  try {
    const retainedNext = typeof value === "object" && value !== null && "retainedNextVersion" in value &&
      value.retainedNextVersion === retainedNextVersion ? retainedNextVersion : undefined;
    const retainAnalyticsConsent = typeof value === "object" && value !== null &&
      "retainAnalyticsConsent" in value && value.retainAnalyticsConsent === true ? true : undefined;
    const serialized = stringifyCanonicalJson(value);
    return [false, true].some((persistence) =>
      [false, true].some((retainFoundation) =>
        [false, true].some((jobs) => serialized === stringifyCanonicalJson(createApplicationEnvironmentRenderingContext(persistence, retainFoundation, jobs, retainedNext, retainAnalyticsConsent)))),
    );
  } catch {
    return false;
  }
}
