import type { CapabilityDescriptor } from "../contracts/capability.js";
import type { ProfileRecipe } from "../contracts/profile.js";
import type { ProjectConfiguration } from "../contracts/project.js";
import type { ValidationResult } from "../contracts/result.js";
import type { InstalledState } from "../contracts/state.js";
import type { SkeletonRenderingContext } from "../generation/render-skeleton.js";
import {
  createVitestFourProfileRecipes,
  createVitestFiveProfileRecipes,
  profileRecipes,
} from "../profiles/profile-recipes.js";
import { createCachingRepositoryReader } from "../repository/cache-reader.js";
import type { RepositoryReader } from "../repository/repository-reader.js";
import { parseProjectYaml, parseStateJson } from "../state/codecs.js";
import {
  createCapabilityCatalog,
  createCapabilityCatalogSnapshot,
  vitestFourCapabilityCatalogSnapshot,
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

export function createGenerationRenderingContext(applicationPersistence = false, emailFoundation = false, backgroundJobs = false): SkeletonRenderingContext {
  const base = applicationPersistence ? applicationPersistenceCatalogSnapshot : vitestFiveCapabilityCatalogSnapshot;
  return {
    catalogSnapshot: { ...((emailFoundation || backgroundJobs) ? { ...base, appFoundation: "0.2.0", transactionalEmailResend: "0.1.0" } as const : base),
      ...(backgroundJobs ? { backgroundJobDelivery: "0.1.0", deploymentCloudflare: applicationPersistence ? "0.6.0" : "0.5.0" } as const : {}),
    },
    profiles: createVitestFiveProfileRecipes(),
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

  const deployment = state.installedCapabilities.find(({ identifier }) => identifier === "deployment-cloudflare");
  const persistence = state.installedCapabilities.find(({ identifier }) => identifier === "application-persistence");
  const foundation = state.installedCapabilities.find(({ identifier }) => identifier === "app-foundation");
  const email = state.installedCapabilities.find(({ identifier }) => identifier === "transactional-email-resend");
  const jobs = state.installedCapabilities.find(({ identifier }) => identifier === "background-job-delivery");
  if (jobs !== undefined || deployment?.version === "0.5.0" || deployment?.version === "0.6.0") {
    const currentRecipe = (project.originProfile === "portfolio" && project.recipeVersion === "0.11.0") ||
      (project.originProfile === "site" && project.recipeVersion === "0.12.0") ||
      (project.originProfile === "app" && project.recipeVersion === "0.2.0");
    const routing = state.installedCapabilities.find(({ identifier }) => identifier === "site-routing");
    const sharedTuple = persistence === undefined
      ? standards?.version === "0.5.0" && deployment?.version === "0.5.0"
      : project.originProfile === "app" && persistence.version === "0.1.0" && standards?.version === "0.6.0" && deployment?.version === "0.6.0";
    return currentRecipe && sharedTuple && jobs?.version === "0.1.0" && foundation?.version === "0.2.0" &&
      (email === undefined || email.version === "0.1.0") &&
      (project.originProfile === "portfolio" ? routing === undefined : routing?.version === "0.4.0")
      ? createGenerationRenderingContext(persistence !== undefined, true, true) : undefined;
  }
  if (foundation?.version === "0.2.0" || email !== undefined) {
    const currentRecipe = (project.originProfile === "portfolio" && project.recipeVersion === "0.11.0") ||
      (project.originProfile === "site" && project.recipeVersion === "0.12.0") ||
      (project.originProfile === "app" && project.recipeVersion === "0.2.0");
    const routing = state.installedCapabilities.find(({ identifier }) => identifier === "site-routing");
    const sharedTuple = persistence === undefined
      ? standards?.version === "0.5.0" && deployment?.version === "0.3.0"
      : project.originProfile === "app" && persistence.version === "0.1.0" &&
        standards?.version === "0.6.0" && deployment?.version === "0.4.0";
    return currentRecipe && sharedTuple && foundation?.version === "0.2.0" &&
      (email === undefined || email.version === "0.1.0") &&
      (project.originProfile === "portfolio" ? routing === undefined : routing?.version === "0.4.0")
      ? createGenerationRenderingContext(persistence !== undefined, true) : undefined;
  }
  if (standards?.version === "0.6.0" || deployment?.version === "0.4.0" || persistence !== undefined) {
    return standards?.version === "0.6.0" && deployment?.version === "0.4.0" && persistence?.version === "0.1.0" &&
      project.originProfile === "app" && project.recipeVersion === "0.2.0" &&
      state.installedCapabilities.some(({ identifier, version }) => identifier === "app-foundation" && version === "0.1.0") &&
      state.installedCapabilities.some(({ identifier, version }) => identifier === "site-routing" && version === "0.4.0")
      ? createGenerationRenderingContext(true) : undefined;
  }
  if (standards?.version === "0.5.0") {
    return {
      catalogSnapshot: vitestFiveCapabilityCatalogSnapshot,
      profiles: createVitestFiveProfileRecipes(),
    };
  }
  if (standards?.version !== "0.3.0" && standards?.version !== "0.4.0") {
    return undefined;
  }

  // Retain the diagnostic view and eligibility of this installed generation,
  // including upgraded standards whose original recipe provenance is unchanged.
  return {
    catalogSnapshot: vitestFourCapabilityCatalogSnapshot,
    profiles: createVitestFourProfileRecipes(),
  };
}

type VerifiedProjectSnapshot = Readonly<{
  catalog: readonly CapabilityDescriptor[];
  profiles: readonly ProfileRecipe[];
  renderingContext: SkeletonRenderingContext | undefined;
}>;

export function createVerifiedProjectSnapshot(
  project: ProjectConfiguration | undefined,
  state: InstalledState | undefined,
): ValidationResult<VerifiedProjectSnapshot> {
  const renderingContext =
    project !== undefined && state !== undefined
      ? selectInstalledRenderingContext(project, state)
      : undefined;
  const catalog = renderingContext === undefined
    ? createVerifiedCapabilityCatalog()
    : createCapabilityCatalogSnapshot(
        verifiedCapabilityPackageVersions,
        renderingContext.catalogSnapshot,
      );
  return catalog.ok
    ? {
        ok: true,
        value: {
          catalog: catalog.value,
          profiles: renderingContext?.profiles ?? profileRecipes,
          renderingContext,
        },
      }
    : catalog;
}

export async function readVerifiedProjectSnapshot(
  sourceReader: RepositoryReader,
): Promise<ValidationResult<
  VerifiedProjectSnapshot & Readonly<{ reader: RepositoryReader }>
>> {
  const reader = createCachingRepositoryReader(sourceReader);
  const [projectSource, stateSource] = await Promise.all([
    reader.readText(".egeria/project.yaml"),
    reader.readText(".egeria/state.json"),
  ]);
  const project = projectSource.kind === "file"
    ? parseProjectYaml(projectSource.content)
    : undefined;
  const state = stateSource.kind === "file"
    ? parseStateJson(stateSource.content)
    : undefined;
  const snapshot = createVerifiedProjectSnapshot(
    project?.ok === true ? project.value : undefined,
    state?.ok === true ? state.value : undefined,
  );
  return snapshot.ok
    ? { ok: true, value: { ...snapshot.value, reader } }
    : snapshot;
}
