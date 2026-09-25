import { readFile } from "node:fs/promises";
import { parseDocument } from "yaml";

import {
  createCapabilityCatalogSnapshot,
  applicationPersistenceScripts,
  applicationEnvironmentScripts,
  persistenceDeploymentScripts,
  type CapabilityCatalogSnapshot,
  type CapabilityPackageVersions,
} from "../catalog/capability-catalog.js";
import { createGenerationRenderingContext, isApplicationEnvironmentRenderingContext } from "../catalog/verified-package-versions.js";
import type { ManagedSurfaceDescriptor } from "../contracts/capability.js";
import {
  applicationEnvironmentProjectConfigurationSchema,
  type ApplicationEnvironmentProjectConfiguration,
  type ApplicationEnvironmentAnalyticsSettings,
  type ApplicationEnvironmentBookingSettings,
  type AnalyticsSettings,
  type CalendlyBookingSettings,
  type Web3FormsContactSettings,
  projectConfigurationSchema,
  type ProjectConfiguration,
} from "../contracts/project.js";
import type {
  ContractIssue,
  ValidationResult,
} from "../contracts/result.js";
import { validateContract } from "../contracts/result.js";
import {
  createFileSurfaceDescriptor,
  createJsonValueSurfaceDescriptor,
} from "../contracts/surface-target.js";
import { materializeInstalledSurfaces } from "../ownership/materialize-surfaces.js";
import type { ProfileIdentifier, ProfileRecipe } from "../contracts/profile.js";
import {
  resolveCapabilities,
  type ResolvedCapabilities,
} from "../resolution/resolve-capabilities.js";
import { stringifyCanonicalJson } from "../serialization/canonical-json.js";
import {
  createTemplateCatalog,
  type TemplateCatalogEntry,
} from "./template-catalog.js";
import {
  renderTemplateSource,
  type TemplateTokens,
} from "./render-template.js";

export type GenerationRequest = Readonly<{
  profile: ProfileIdentifier;
  projectName: string;
  displayName: string;
  analytics?: AnalyticsSettings;
  bookingCalendly?: CalendlyBookingSettings;
  contactFormWeb3Forms?: Web3FormsContactSettings;
  multilingual?: true;
  applicationPersistence?: true;
  transactionalEmailResend?: true;
  backgroundJobDelivery?: true;
  packageVersions: CapabilityPackageVersions;
}>;

export type ApplicationEnvironmentGenerationRequest = Readonly<Omit<GenerationRequest, "analytics" | "bookingCalendly" | "contactFormWeb3Forms"> & {
  analytics?: ApplicationEnvironmentAnalyticsSettings;
  bookingCalendly?: ApplicationEnvironmentBookingSettings;
  contactFormWeb3Forms?: true;
}>;

export type GeneratedFile = Readonly<{
  path: string;
  content: Uint8Array;
}>;

export type RenderedSkeleton<P = ProjectConfiguration> = Readonly<{
  project: P;
  resolved: ResolvedCapabilities;
  files: readonly GeneratedFile[];
  surfaces: readonly ManagedSurfaceDescriptor[];
}>;

export type SkeletonRenderingContext = Readonly<{
  catalogSnapshot: CapabilityCatalogSnapshot;
  profiles: readonly ProfileRecipe[];
}>;

export type ApplicationEnvironmentRenderingContext = SkeletonRenderingContext & Readonly<{ projectSchemaVersion: "2.0.0" }>;

const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function generatedIssue(
  code: string,
  path: readonly (string | number)[],
  reason: string,
): ValidationResult<never> {
  return {
    ok: false,
    issues: [{ code, path, context: { reason } }],
  };
}

function createProject(
  request: GenerationRequest | ApplicationEnvironmentGenerationRequest,
  resolved: ResolvedCapabilities,
  applicationEnvironments: boolean,
): ValidationResult<ProjectConfiguration | ApplicationEnvironmentProjectConfiguration> {
  const value = {
    schemaVersion: applicationEnvironments ? "2.0.0" : "1.0.0",
    builderCompatibility: "0.0.0",
    project: {
      name: request.projectName,
      displayName: request.displayName,
      defaultLocale: "en-CA",
    },
    originProfile: request.profile,
    recipeVersion: resolved.recipeVersion,
    platformAdapter: "cloudflare-workers",
    selectedCapabilities: resolved.capabilities.map(
      ({ identifier }) => identifier,
    ),
    capabilitySettings: {
      ...(applicationEnvironments || request.contactFormWeb3Forms === undefined ? {} : { "contact-form-web3forms": request.contactFormWeb3Forms }),
      ...(request.analytics === undefined
        ? {}
        : { analytics: request.analytics }),
      ...(request.bookingCalendly === undefined
        ? {}
        : { "booking-calendly": request.bookingCalendly }),
    },
    ejectedAreas: [],
  };
  return applicationEnvironments
    ? validateContract(applicationEnvironmentProjectConfigurationSchema, value)
    : validateContract(projectConfigurationSchema, value);
}

function remapTokenIssues(
  issues: readonly ContractIssue[],
  index: number,
): readonly ContractIssue[] {
  return issues.map((issue) => ({
    ...issue,
    path: ["templates", index, "tokens"],
  }));
}

export async function renderTemplateCatalogEntry(
  entry: TemplateCatalogEntry,
  index: number,
  root: URL,
  tokens: TemplateTokens,
): Promise<ValidationResult<GeneratedFile>> {
  if (entry.contentKind === "binary") {
    try {
      const source = await readFile(new URL(entry.source, root));

      return {
        ok: true,
        value: {
          path: entry.destination,
          content: new Uint8Array(source),
        },
      };
    } catch {
      return generatedIssue(
        "TEMPLATE_READ_FAILED",
        ["templates", index, "source"],
        "read-failed",
      );
    }
  }

  let source: string;

  try {
    source = await readFile(new URL(entry.source, root), "utf8");
  } catch {
    return generatedIssue(
      "TEMPLATE_READ_FAILED",
      ["templates", index, "source"],
      "read-failed",
    );
  }

  const rendered = renderTemplateSource({
    source: entry.source,
    text: source,
    tokens,
  });

  if (!rendered.ok) {
    return {
      ok: false,
      issues: remapTokenIssues(rendered.issues, index),
    };
  }

  return {
    ok: true,
    value: {
      path: entry.destination,
      content: encoder.encode(rendered.value),
    },
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    (Reflect.getPrototypeOf(value) === Object.prototype ||
      Reflect.getPrototypeOf(value) === null)
  );
}

function enrichApplicationManifest(
  files: readonly GeneratedFile[],
  packageVersions: CapabilityPackageVersions,
  profile: ProfileIdentifier,
  recipeVersion: string,
  persistence: boolean,
  foundation: boolean,
  applicationEnvironments: boolean,
): ValidationResult<readonly GeneratedFile[]> {
  const manifestIndex = files.findIndex(
    ({ path }) => path === "apps/web/package.json",
  );
  const manifestFile = files[manifestIndex];

  if (manifestFile === undefined) {
    return generatedIssue(
      "GENERATED_MANIFEST_INVALID",
      ["files", "apps/web/package.json"],
      "missing-file",
    );
  }

  let manifest: unknown;
  try {
    manifest = JSON.parse(decoder.decode(manifestFile.content)) as unknown;
  } catch {
    return generatedIssue(
      "GENERATED_MANIFEST_INVALID",
      ["files", "apps/web/package.json"],
      "invalid-json",
    );
  }

  if (
    !isPlainObject(manifest) ||
    !isPlainObject(manifest.scripts) ||
    !isPlainObject(manifest.dependencies) ||
    !isPlainObject(manifest.devDependencies)
  ) {
    return generatedIssue(
      "GENERATED_MANIFEST_INVALID",
      ["files", "apps/web/package.json"],
      "missing-section",
    );
  }

  const app = profile === "app" && (recipeVersion === "0.1.0" || recipeVersion === "0.2.0" || (applicationEnvironments && recipeVersion === "0.3.0"));
  const productionSite = app || (profile === "site" && (recipeVersion === "0.11.0" || recipeVersion === "0.12.0" || (applicationEnvironments && recipeVersion === "0.13.0")));
  const enrichedManifest = {
    ...manifest,
    scripts: {
      ...manifest.scripts,
      ...(applicationEnvironments ? applicationEnvironmentScripts : {}),
      ...(foundation
        ? { "test:integration:cloudflare": "vitest run --config vitest.cloudflare.config.ts" }
        : {}),
      ...(persistence ? { ...applicationPersistenceScripts, ...persistenceDeploymentScripts } : {}),
    },
    dependencies: {
      ...manifest.dependencies,
      "@egeria-systems/observability": packageVersions.observability,
      ...((productionSite || foundation) ? { next: "16.3.3" } : {}),
      ...(foundation ? { effect: "4.0.0-rc.112" } : {}),
      ...(persistence ? { "drizzle-orm": "0.45.2" } : {}),
    },
    devDependencies: {
      ...manifest.devDependencies,
      "@egeria-systems/standards": packageVersions.standards,
      ...(persistence ? { "@cloudflare/workers-types": "5.20260730.1", "drizzle-kit": "0.31.10" } : {}),
      ...(app && recipeVersion === "0.1.0" ? { vitest: "4.1.11" } : {}),
      ...(productionSite
        ? { "eslint-config-next": "16.3.3" }
        : {}),
    },
  };
  const nextFiles = files.map((file, index) => {
    if (index === manifestIndex) {
      return {
        path: file.path,
        content: encoder.encode(`${stringifyCanonicalJson(enrichedManifest)}\n`),
      };
    }
    if (applicationEnvironments && file.path === "apps/web/tsconfig.json") {
      const configuration = JSON.parse(decoder.decode(file.content)) as { compilerOptions: Record<string, unknown> };
      return { path: file.path, content: encoder.encode(`${stringifyCanonicalJson({ ...configuration, compilerOptions: { ...configuration.compilerOptions, allowImportingTsExtensions: true } })}\n`) };
    }
    if (applicationEnvironments && file.path === ".gitignore") {
      return { path: file.path, content: encoder.encode(`${decoder.decode(file.content)}.dev.vars*\n!.dev.vars.example\n`) };
    }
    if (applicationEnvironments && file.path === "README.md") {
      return { path: file.path, content: encoder.encode(`${decoder.decode(file.content)}\nSee [Application environments](docs/environments.md) for build inputs, runtime targets and local recovery.\n`) };
    }
    if (foundation && file.path === "pnpm-workspace.yaml") {
      const workspace = parseDocument(decoder.decode(file.content));
      workspace.setIn(["allowBuilds", "msgpackr-extract"], false);
      if (persistence) workspace.setIn(["overrides", "@esbuild-kit/core-utils>esbuild"], "0.25.4");
      return { path: file.path, content: encoder.encode(workspace.toString()) };
    }
    return file;
  });

  return { ok: true, value: nextFiles };
}

function createFileSurface(
  identifier: string,
  path: string,
  ownership: "managed" | "application-owned",
): ManagedSurfaceDescriptor {
  return createFileSurfaceDescriptor({
    identifier,
    owner: { kind: "builder-kernel" },
    path,
    ownership,
  });
}

function createPackageSurface(
  identifier: string,
  pointer: string,
): ManagedSurfaceDescriptor {
  return createJsonValueSurfaceDescriptor(
    {
      identifier,
      owner: { kind: "builder-kernel" },
      path: "apps/web/package.json",
      ownership: "merge-managed",
    },
    pointer,
  );
}

function createBuilderSurfaces(applicationEnvironments: boolean): readonly ManagedSurfaceDescriptor[] {
  return [
    ...(applicationEnvironments ? [
      createFileSurface("builder-application-environment-guide", "docs/environments.md", "application-owned"),
      createFileSurface("builder-build-environment-example", "apps/web/.env.example", "application-owned"),
      createFileSurface("builder-runtime-environment-example", "apps/web/.dev.vars.example", "application-owned"),
    ] : []),
    createFileSurface("builder-gitignore", ".gitignore", "application-owned"),
    createFileSurface("builder-node-version", ".nvmrc", "managed"),
    createFileSurface(
      "builder-root-instructions",
      "AGENTS.md",
      "application-owned",
    ),
    createFileSurface("builder-readme", "README.md", "application-owned"),
    createFileSurface(
      "builder-root-package-manifest",
      "package.json",
      "managed",
    ),
    createFileSurface(
      "builder-workspace-configuration",
      "pnpm-workspace.yaml",
      "managed",
    ),
    createFileSurface(
      "builder-web-instructions",
      "apps/web/AGENTS.md",
      "application-owned",
    ),
    createFileSurface(
      "builder-root-layout",
      "apps/web/app/layout.tsx",
      "application-owned",
    ),
    createFileSurface(
      "builder-home-route",
      "apps/web/app/page.tsx",
      "application-owned",
    ),
    createPackageSurface("builder-web-package-name", "/name"),
    createPackageSurface("builder-web-package-version", "/version"),
    createPackageSurface("builder-web-package-private", "/private"),
    createPackageSurface("builder-web-package-type", "/type"),
    createPackageSurface("builder-web-build-script", "/scripts/build"),
    createPackageSurface(
      "builder-web-cloudflare-build-script",
      "/scripts/build:cloudflare",
    ),
    createPackageSurface(
      "builder-web-cloudflare-type-generation-script",
      "/scripts/cf-typegen",
    ),
    createPackageSurface("builder-web-development-script", "/scripts/dev"),
    createPackageSurface("builder-web-lint-script", "/scripts/lint"),
    createPackageSurface("builder-web-preview-script", "/scripts/preview"),
    createPackageSurface(
      "builder-web-typecheck-script",
      "/scripts/typecheck",
    ),
    createPackageSurface("builder-web-package-next", "/dependencies/next"),
    createPackageSurface("builder-web-package-react", "/dependencies/react"),
    createPackageSurface(
      "builder-web-package-react-dom",
      "/dependencies/react-dom",
    ),
    createPackageSurface(
      "builder-web-package-types-node",
      "/devDependencies/@types~1node",
    ),
    createPackageSurface(
      "builder-web-package-types-react",
      "/devDependencies/@types~1react",
    ),
    createPackageSurface(
      "builder-web-package-types-react-dom",
      "/devDependencies/@types~1react-dom",
    ),
    createPackageSurface(
      "builder-web-package-eslint",
      "/devDependencies/eslint",
    ),
    createPackageSurface(
      "builder-web-package-eslint-next",
      "/devDependencies/eslint-config-next",
    ),
    createPackageSurface(
      "builder-web-package-typescript",
      "/devDependencies/typescript",
    ),
    createPackageSurface(
      "builder-web-package-typescript-eslint",
      "/devDependencies/typescript-eslint",
    ),
  ];
}

function createDesiredSurfaces(
  resolved: ResolvedCapabilities,
  applicationEnvironments: boolean,
): readonly ManagedSurfaceDescriptor[] {
  return [
    ...resolved.capabilities.flatMap(({ managedSurfaces }) => managedSurfaces),
    ...createBuilderSurfaces(applicationEnvironments),
  ].sort((left, right) => compareText(left.identifier, right.identifier));
}

export function renderSkeleton(request: ApplicationEnvironmentGenerationRequest, context: ApplicationEnvironmentRenderingContext): Promise<ValidationResult<RenderedSkeleton<ApplicationEnvironmentProjectConfiguration>>>;
export function renderSkeleton(request: GenerationRequest, context?: SkeletonRenderingContext): Promise<ValidationResult<RenderedSkeleton>>;
export async function renderSkeleton(
  request: GenerationRequest | ApplicationEnvironmentGenerationRequest,
  context?: SkeletonRenderingContext | ApplicationEnvironmentRenderingContext,
): Promise<ValidationResult<RenderedSkeleton<ProjectConfiguration | ApplicationEnvironmentProjectConfiguration>>> {
  const applicationEnvironments = context !== undefined && "projectSchemaVersion" in context;
  const environmentDescriptor = context?.catalogSnapshot.standards === "0.7.0" || context?.catalogSnapshot.appFoundation === "0.3.0" || context?.catalogSnapshot.deploymentCloudflare === "0.7.0";
  if ((applicationEnvironments || environmentDescriptor || (context !== undefined && "projectSchemaVersion" in context)) &&
      (!applicationEnvironments || !isApplicationEnvironmentRenderingContext(context))) {
    return generatedIssue("APPLICATION_ENVIRONMENT_CONTEXT_INVALID", ["context"], "unsupported-context");
  }
  if (applicationEnvironments && Object.hasOwn(request, "contactFormWeb3Forms") && request.contactFormWeb3Forms !== true) {
    return generatedIssue("PROJECT_GENERATION_REQUEST_INVALID", ["request", "contactFormWeb3Forms"], "invalid-selection");
  }
  if (applicationEnvironments && (request.analytics !== undefined || request.applicationPersistence === true || request.transactionalEmailResend === true || request.backgroundJobDelivery === true)) {
    return generatedIssue("APPLICATION_ENVIRONMENT_CAPABILITY_INCOMPLETE", ["request"], "incomplete-capability");
  }
  const packageVersions: CapabilityPackageVersions = {
    standards: request.packageVersions.standards,
    observability: request.packageVersions.observability,
  };
  const renderingContext = context ?? createGenerationRenderingContext(request.applicationPersistence === true, request.transactionalEmailResend === true, request.backgroundJobDelivery === true);
  const retainedFoundation = renderingContext.catalogSnapshot.appFoundation === "0.2.0";
  const catalogResult = createCapabilityCatalogSnapshot(packageVersions, renderingContext.catalogSnapshot);
  if (!catalogResult.ok) {
    return catalogResult;
  }

  const resolutionResult = resolveCapabilities(
    {
      profile: request.profile,
      ...(
        request.contactFormWeb3Forms === undefined &&
        request.analytics === undefined &&
        request.bookingCalendly === undefined &&
        request.multilingual !== true && request.applicationPersistence !== true && request.transactionalEmailResend !== true && request.backgroundJobDelivery !== true && !retainedFoundation
          ? {}
          : {
              requestedCapabilities: [
                ...(request.contactFormWeb3Forms === undefined ? [] : ["contact-form-web3forms"]),
                ...(request.analytics === undefined ? [] : ["analytics"]),
                ...(request.bookingCalendly === undefined
                  ? []
                  : ["booking-calendly"]),
                ...(request.multilingual === true ? ["multilingual"] : []),
                ...(request.applicationPersistence === true ? ["application-persistence"] : []),
                ...(request.transactionalEmailResend === true ? ["transactional-email-resend"] : []),
                ...(request.backgroundJobDelivery === true ? ["background-job-delivery"] : []),
                ...(retainedFoundation ? ["app-foundation"] : []),
              ],
            }
      ),
    },
    catalogResult.value,
    renderingContext.profiles,
  );
  if (!resolutionResult.ok) {
    return resolutionResult;
  }

  const projectResult = createProject(request, resolutionResult.value, applicationEnvironments);
  if (!projectResult.ok) {
    return projectResult;
  }

  const templateCatalogResult = createTemplateCatalog(
    request.profile,
    request.bookingCalendly !== undefined,
    resolutionResult.value.recipeVersion,
    request.multilingual === true,
    request.analytics !== undefined,
    request.applicationPersistence === true,
    resolutionResult.value.capabilities.some(({ identifier }) => identifier === "app-foundation"),
    request.transactionalEmailResend === true,
    request.contactFormWeb3Forms !== undefined,
    request.backgroundJobDelivery === true,
    renderingContext.catalogSnapshot.backgroundJobDelivery,
    applicationEnvironments,
  );
  if (!templateCatalogResult.ok) {
    return templateCatalogResult;
  }

  const tokens: TemplateTokens = {
    projectName: projectResult.value.project.name,
    displayNameJson: JSON.stringify(projectResult.value.project.displayName),
    workerName: projectResult.value.project.name,
    workerEntryJson: JSON.stringify(request.backgroundJobDelivery === true ? "worker.mjs" : ".open-next/worker.js"),
    ...(request.contactFormWeb3Forms === undefined || typeof request.contactFormWeb3Forms !== "object" ? {} : { web3FormsAccessKeyJson: JSON.stringify(request.contactFormWeb3Forms.accessKey) }),
    ...(request.analytics === undefined
      ? {}
      : {
          analyticsSettingsJson: JSON.stringify(request.analytics, null, 2),
        }),
    ...(request.bookingCalendly === undefined ? {} : {
      calendlyModeJson: JSON.stringify(request.bookingCalendly.mode),
      ...("destination" in request.bookingCalendly ? { calendlyDestinationJson: JSON.stringify(request.bookingCalendly.destination) } : {}),
    }),
  };
  const templateRoot = new URL("../../templates/", import.meta.url);
  const files: GeneratedFile[] = [];

  for (const [index, entry] of templateCatalogResult.value.entries()) {
    const result = await renderTemplateCatalogEntry(
      entry,
      index,
      templateRoot,
      tokens,
    );
    if (!result.ok) {
      return result;
    }
    files.push(result.value);
  }

  if (applicationEnvironments) {
    files.push(
      { path: "apps/web/.env.example", content: encoder.encode(`APPLICATION_ENVIRONMENT=development\nNEXT_PUBLIC_SITE_URL=http://localhost:3000\n${request.contactFormWeb3Forms === true ? "NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY=\n" : ""}${request.bookingCalendly === undefined ? "" : "NEXT_PUBLIC_CALENDLY_URL=\n"}`) },
      { path: "apps/web/.dev.vars.example", content: encoder.encode("APPLICATION_ENVIRONMENT=development\nBETTER_STACK_INGESTING_HOST=\nBETTER_STACK_SOURCE_TOKEN=\n") },
    );
  }
  const manifestResult = enrichApplicationManifest(
    files,
    packageVersions,
    projectResult.value.originProfile,
    resolutionResult.value.recipeVersion,
    request.applicationPersistence === true,
    resolutionResult.value.capabilities.some(({ identifier }) => identifier === "app-foundation"),
    applicationEnvironments,
  );
  if (!manifestResult.ok) {
    return manifestResult;
  }

  const sortedFiles = [...manifestResult.value].sort((left, right) =>
    compareText(left.path, right.path),
  );
  const surfaces = createDesiredSurfaces(resolutionResult.value, applicationEnvironments);
  const materialization = materializeInstalledSurfaces({
    files: new Map(sortedFiles.map(({ path, content }) => [path, content])),
    surfaces,
  });

  if (!materialization.ok) {
    return generatedIssue(
      "GENERATED_SURFACE_INVALID",
      ["surfaces"],
      "ownership-validation",
    );
  }

  return {
    ok: true,
    value: {
      project: projectResult.value,
      resolved: resolutionResult.value,
      files: sortedFiles,
      surfaces,
    },
  };
}
