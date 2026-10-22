import type { CapabilityDescriptor } from "../contracts/capability.js";
import type { ProfileRecipe } from "../contracts/profile.js";
import { projectConfigurationSchema, type ProjectConfiguration } from "../contracts/project.js";
import type { ValidationResult } from "../contracts/result.js";
import { installedStateSchema, type InstalledState } from "../contracts/state.js";
import type { ApplicationEnvironmentRenderingContext, SkeletonRenderingContext } from "../generation/render-skeleton.js";
import {
  createApplicationEnvironmentProfileRecipes,
  createCurrentProfileRecipes,
  profileRecipes,
} from "../profiles/profile-recipes.js";
import { createCachingRepositoryReader } from "../repository/cache-reader.js";
import type { RepositoryReader } from "../repository/repository-reader.js";
import { createInstalledManifest } from "../manifest/create-installed-manifest.js";
import { resolveCapabilities } from "../resolution/resolve-capabilities.js";
import { stringifyCanonicalJson } from "../serialization/canonical-json.js";
import { parseProjectYaml, parseStateJson } from "../state/codecs.js";
import {
  applicationEnvironmentCatalogSnapshot,
  createCapabilityCatalog,
  createCapabilityCatalogSnapshot,
  vitestFiveCapabilityCatalogSnapshot,
  applicationPersistenceCatalogSnapshot,
} from "./capability-catalog.js";

export const verifiedCapabilityPackageVersions = Object.freeze({
  standards: "0.1.0",
  observability: "0.3.0",
} as const);

export function createVerifiedCapabilityCatalog(): ValidationResult<
  readonly CapabilityDescriptor[]
> {
  return createCapabilityCatalog(verifiedCapabilityPackageVersions);
}

export function createGenerationRenderingContext(
  applicationPersistence = false,
  emailFoundation = false,
  backgroundJobs = false,
  backgroundJobVersion: "0.1.0" | "0.2.0" = "0.2.0",
): SkeletonRenderingContext {
  const base = applicationPersistence ? applicationPersistenceCatalogSnapshot : vitestFiveCapabilityCatalogSnapshot;
  return {
    catalogSnapshot: { ...((emailFoundation || backgroundJobs) ? { ...base, appFoundation: "0.2.0", transactionalEmailResend: "0.1.0" } as const : base),
      ...(backgroundJobs ? { backgroundJobDelivery: backgroundJobVersion, deploymentCloudflare: applicationPersistence ? "0.6.0" : "0.5.0" } as const : {}),
    },
    profiles: createCurrentProfileRecipes(),
  };
}

function selectInstalledRenderingContext(
  project: ProjectConfiguration,
  state: InstalledState,
): SkeletonRenderingContext | undefined {
  const standards = state.installedCapabilities.find(
    ({ identifier }) => identifier === "standards",
  );
  if (
    project.originProfile !== state.origin.profile ||
    project.recipeVersion !== state.origin.recipeVersion
  ) {
    return undefined;
  }

  const profiles = createCurrentProfileRecipes();
  const currentRecipe = profiles.some(({ identifier, recipeVersion }) =>
    identifier === project.originProfile && recipeVersion === project.recipeVersion);
  if (!currentRecipe) return undefined;

  const deployment = state.installedCapabilities.find(({ identifier }) => identifier === "deployment-cloudflare");
  const persistence = state.installedCapabilities.find(({ identifier }) => identifier === "application-persistence");
  const foundation = state.installedCapabilities.find(({ identifier }) => identifier === "app-foundation");
  const email = state.installedCapabilities.find(({ identifier }) => identifier === "transactional-email-resend");
  const jobs = state.installedCapabilities.find(({ identifier }) => identifier === "background-job-delivery");
  if (jobs !== undefined || deployment?.version === "0.5.0" || deployment?.version === "0.6.0") {
    const routing = state.installedCapabilities.find(({ identifier }) => identifier === "site-routing");
    const sharedTuple = persistence === undefined
      ? standards?.version === "0.5.1" && deployment?.version === "0.5.0"
      : project.originProfile === "app" && persistence.version === "0.1.0" && standards?.version === "0.6.1" && deployment?.version === "0.6.0";
    return sharedTuple && (jobs?.version === "0.1.0" || jobs?.version === "0.2.0") && foundation?.version === "0.2.0" &&
      (email === undefined || email.version === "0.1.0") &&
      (project.originProfile === "portfolio" ? routing === undefined : routing?.version === "0.4.0")
      ? { ...createGenerationRenderingContext(persistence !== undefined, true, true, jobs.version), profiles } : undefined;
  }
  if (foundation?.version === "0.2.0" || email !== undefined) {
    const routing = state.installedCapabilities.find(({ identifier }) => identifier === "site-routing");
    const sharedTuple = persistence === undefined
      ? standards?.version === "0.5.1" && deployment?.version === "0.3.0"
      : project.originProfile === "app" && persistence.version === "0.1.0" &&
        standards?.version === "0.6.1" && deployment?.version === "0.4.0";
    return sharedTuple && foundation?.version === "0.2.0" &&
      (email === undefined || email.version === "0.1.0") &&
      (project.originProfile === "portfolio" ? routing === undefined : routing?.version === "0.4.0")
      ? { ...createGenerationRenderingContext(persistence !== undefined, true), profiles } : undefined;
  }
  if (standards?.version === "0.6.1" || deployment?.version === "0.4.0" || persistence !== undefined) {
    return standards?.version === "0.6.1" && deployment?.version === "0.4.0" && persistence?.version === "0.1.0" &&
      project.originProfile === "app" &&
      state.installedCapabilities.some(({ identifier, version }) => identifier === "app-foundation" && version === "0.1.0") &&
      state.installedCapabilities.some(({ identifier, version }) => identifier === "site-routing" && version === "0.4.0")
      ? { ...createGenerationRenderingContext(true), profiles } : undefined;
  }
  if (standards?.version === "0.5.1") {
    return {
      catalogSnapshot: vitestFiveCapabilityCatalogSnapshot,
      profiles,
    };
  }
  return undefined;
}

type VerifiedProjectSnapshot<C = SkeletonRenderingContext | undefined> = Readonly<{
  catalog: readonly CapabilityDescriptor[];
  profiles: readonly ProfileRecipe[];
  renderingContext: C;
}>;

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
  const invalid = (): ValidationResult<never> => ({
    ok: false,
    issues: [{ code: "PROJECT_INSPECTION_INVALID", path: ["recipeVersion"], context: { reason: "unsupported-installed-tuple" } }],
  });
  if ((project !== undefined || state !== undefined) &&
      (project === undefined || state === undefined ||
        !projectConfigurationSchema.safeParse(project).success ||
        !installedStateSchema.safeParse(state).success)) return invalid();
  const renderingContext = project !== undefined && state !== undefined
    ? selectInstalledRenderingContext(project, state) : undefined;
  if (project !== undefined && renderingContext === undefined) return invalid();
  const catalog = renderingContext === undefined
    ? createVerifiedCapabilityCatalog()
    : createCapabilityCatalogSnapshot(
        verifiedCapabilityPackageVersions,
        renderingContext.catalogSnapshot,
      );
  if (!catalog.ok) return catalog;
  if (project !== undefined && state !== undefined) {
    const resolved = resolveCapabilities({
      profile: project.originProfile,
      requestedCapabilities: project.selectedCapabilities,
    }, catalog.value, renderingContext?.profiles ?? profileRecipes);
    if (!resolved.ok || canonicalInstalledManifest(createInstalledManifest(resolved.value)) !==
        canonicalInstalledManifest(state.installedCapabilities)) return invalid();
  }
  return { ok: true, value: {
    catalog: catalog.value,
    profiles: renderingContext?.profiles ?? profileRecipes,
    renderingContext,
  } };
}

export function readVerifiedProjectSnapshot(sourceReader: RepositoryReader, context: ApplicationEnvironmentRenderingContext): Promise<ValidationResult<VerifiedProjectSnapshot<ApplicationEnvironmentRenderingContext> & Readonly<{ reader: RepositoryReader }>>>;
export function readVerifiedProjectSnapshot(sourceReader: RepositoryReader): Promise<ValidationResult<VerifiedProjectSnapshot & Readonly<{ reader: RepositoryReader }>>>;
export async function readVerifiedProjectSnapshot(
  sourceReader: RepositoryReader,
  context?: ApplicationEnvironmentRenderingContext,
): Promise<ValidationResult<
  VerifiedProjectSnapshot & Readonly<{ reader: RepositoryReader }>
>> {
  const reader = createCachingRepositoryReader(sourceReader);
  const [projectSource, stateSource] = await Promise.all([
    reader.readText(".egeria/project.yaml"),
    reader.readText(".egeria/state.json"),
  ]);
  if (context !== undefined) {
    const invalid = (): ValidationResult<never> => ({
      ok: false,
      issues: [{ code: "PROJECT_INSPECTION_INVALID", path: [], context: { reason: "candidate-controls-invalid" } }],
    });
    if (!isApplicationEnvironmentRenderingContext(context) ||
        projectSource.kind !== "file" || stateSource.kind !== "file") return invalid();
    const project = parseProjectYaml(projectSource.content, "2.0.0");
    const state = parseStateJson(stateSource.content, "2.0.0");
    if (!project.ok || !state.ok || project.value.originProfile !== state.value.origin.profile ||
        project.value.recipeVersion !== state.value.origin.recipeVersion) return invalid();
    const catalog = createCapabilityCatalogSnapshot(verifiedCapabilityPackageVersions, context.catalogSnapshot);
    if (!catalog.ok) return catalog;
    const resolved = resolveCapabilities({ profile: project.value.originProfile, requestedCapabilities: project.value.selectedCapabilities }, catalog.value, context.profiles);
    if (!resolved.ok || canonicalInstalledManifest(createInstalledManifest(resolved.value)) !== canonicalInstalledManifest(state.value.installedCapabilities)) return invalid();
    return { ok: true, value: { reader, catalog: catalog.value, profiles: context.profiles, renderingContext: context } };
  }
  const project = projectSource.kind === "file"
    ? parseProjectYaml(projectSource.content)
    : undefined;
  const state = stateSource.kind === "file"
    ? parseStateJson(stateSource.content)
    : undefined;
  if ((projectSource.kind !== "missing" && project?.ok !== true) ||
      (stateSource.kind !== "missing" && state?.ok !== true)) {
    return { ok: false, issues: [{ code: "PROJECT_INSPECTION_INVALID", path: [], context: { reason: "unsupported-installed-tuple" } }] };
  }
  const snapshot = createVerifiedProjectSnapshot(
    project?.ok === true ? project.value : undefined,
    state?.ok === true ? state.value : undefined,
  );
  return snapshot.ok
    ? { ok: true, value: { ...snapshot.value, reader } }
    : snapshot;
}

export function createApplicationEnvironmentRenderingContext(): ApplicationEnvironmentRenderingContext {
  return {
    projectSchemaVersion: "2.0.0",
    catalogSnapshot: applicationEnvironmentCatalogSnapshot,
    profiles: createApplicationEnvironmentProfileRecipes(),
  };
}

export function isApplicationEnvironmentRenderingContext(value: unknown): value is ApplicationEnvironmentRenderingContext {
  try {
    return stringifyCanonicalJson(value) === stringifyCanonicalJson(createApplicationEnvironmentRenderingContext());
  } catch {
    return false;
  }
}
