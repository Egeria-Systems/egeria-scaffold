import { readFile } from "node:fs/promises";

import {
  createCapabilityCatalog,
  type CapabilityPackageVersions,
} from "../catalog/capability-catalog.js";
import type { ManagedSurfaceDescriptor } from "../contracts/capability.js";
import {
  projectConfigurationSchema,
  type ProjectConfiguration,
} from "../contracts/project.js";
import type {
  ContractIssue,
  ValidationResult,
} from "../contracts/result.js";
import { validateContract } from "../contracts/result.js";
import { materializeInstalledSurfaces } from "../ownership/materialize-surfaces.js";
import { profileRecipes } from "../profiles/profile-recipes.js";
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
  profile: "portfolio" | "site";
  projectName: string;
  displayName: string;
  packageVersions: CapabilityPackageVersions;
}>;

export type GeneratedFile = Readonly<{
  path: string;
  content: Uint8Array;
}>;

export type RenderedSkeleton = Readonly<{
  project: ProjectConfiguration;
  resolved: ResolvedCapabilities;
  files: readonly GeneratedFile[];
  surfaces: readonly ManagedSurfaceDescriptor[];
}>;

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
  request: GenerationRequest,
  resolved: ResolvedCapabilities,
): ValidationResult<ProjectConfiguration> {
  return validateContract(projectConfigurationSchema, {
    schemaVersion: "1.0.0",
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
    capabilitySettings: {},
    ejectedAreas: [],
  });
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

async function renderEntry(
  entry: TemplateCatalogEntry,
  index: number,
  root: URL,
  tokens: TemplateTokens,
): Promise<ValidationResult<GeneratedFile>> {
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
    !isPlainObject(manifest.dependencies) ||
    !isPlainObject(manifest.devDependencies)
  ) {
    return generatedIssue(
      "GENERATED_MANIFEST_INVALID",
      ["files", "apps/web/package.json"],
      "missing-section",
    );
  }

  const enrichedManifest = {
    ...manifest,
    dependencies: {
      ...manifest.dependencies,
      "@egeria-systems/observability": packageVersions.observability,
    },
    devDependencies: {
      ...manifest.devDependencies,
      "@egeria-systems/standards": packageVersions.standards,
    },
  };
  const nextFiles = files.map((file, index) =>
    index === manifestIndex
      ? {
          path: file.path,
          content: encoder.encode(`${stringifyCanonicalJson(enrichedManifest)}\n`),
        }
      : file,
  );

  return { ok: true, value: nextFiles };
}

function createFileSurface(
  identifier: string,
  path: string,
  ownership: "managed" | "application-owned",
): ManagedSurfaceDescriptor {
  return {
    identifier,
    owner: { kind: "builder-kernel" },
    path,
    ownership,
    fingerprintTarget: { kind: "file" },
    mergeStrategy: "replace-file",
  };
}

function createPackageSurface(
  identifier: string,
  pointer: string,
): ManagedSurfaceDescriptor {
  return {
    identifier,
    owner: { kind: "builder-kernel" },
    path: "apps/web/package.json",
    ownership: "merge-managed",
    fingerprintTarget: { kind: "json-value", pointer },
    mergeStrategy: "json-property",
  };
}

function createBuilderSurfaces(): readonly ManagedSurfaceDescriptor[] {
  return [
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
    createPackageSurface("builder-web-package-name", "/name"),
    createPackageSurface("builder-web-package-version", "/version"),
    createPackageSurface("builder-web-package-private", "/private"),
    createPackageSurface("builder-web-package-type", "/type"),
    createPackageSurface("builder-web-package-scripts", "/scripts"),
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
): readonly ManagedSurfaceDescriptor[] {
  return [
    ...resolved.capabilities.flatMap(({ managedSurfaces }) => managedSurfaces),
    ...createBuilderSurfaces(),
  ].sort((left, right) => compareText(left.identifier, right.identifier));
}

export async function renderSkeleton(
  request: GenerationRequest,
): Promise<ValidationResult<RenderedSkeleton>> {
  const packageVersions: CapabilityPackageVersions = {
    standards: request.packageVersions.standards,
    observability: request.packageVersions.observability,
  };
  const catalogResult = createCapabilityCatalog(packageVersions);
  if (!catalogResult.ok) {
    return catalogResult;
  }

  const resolutionResult = resolveCapabilities(
    { profile: request.profile },
    catalogResult.value,
    profileRecipes,
  );
  if (!resolutionResult.ok) {
    return resolutionResult;
  }

  const projectResult = createProject(request, resolutionResult.value);
  if (!projectResult.ok) {
    return projectResult;
  }

  const templateCatalogResult = createTemplateCatalog(request.profile);
  if (!templateCatalogResult.ok) {
    return templateCatalogResult;
  }

  const tokens: TemplateTokens = {
    projectName: projectResult.value.project.name,
    displayNameJson: JSON.stringify(projectResult.value.project.displayName),
    workerName: projectResult.value.project.name,
  };
  const templateRoot = new URL("../../templates/", import.meta.url);
  const files: GeneratedFile[] = [];

  for (const [index, entry] of templateCatalogResult.value.entries()) {
    const result = await renderEntry(entry, index, templateRoot, tokens);
    if (!result.ok) {
      return result;
    }
    files.push(result.value);
  }

  const manifestResult = enrichApplicationManifest(files, packageVersions);
  if (!manifestResult.ok) {
    return manifestResult;
  }

  const sortedFiles = [...manifestResult.value].sort((left, right) =>
    compareText(left.path, right.path),
  );
  const surfaces = createDesiredSurfaces(resolutionResult.value);
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
