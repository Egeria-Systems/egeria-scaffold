import { applicationEnvironmentRecipeVersions, publicRecipeVersions } from "../contracts/profile.js";

const recipeLockfileVersions = [
  "portfolio-0.11.5", "portfolio-0.11.5-foundation", "site-0.12.5", "app-0.2.5", "app-0.2.5-persistence",
  "portfolio-0.12.0", "site-0.13.0", "app-0.3.0",
] as const;
type RecipeLockfileVersion = typeof recipeLockfileVersions[number];

export type RecipeLockfileIdentity = Readonly<{ originProfile: string; recipeVersion: string }>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function resolveRecipeLockfileVersion(
  identity: RecipeLockfileIdentity,
  manifest: unknown,
): RecipeLockfileVersion | undefined {
  if (!isRecord(manifest) || !isRecord(manifest.dependencies) || !isRecord(manifest.devDependencies)) return undefined;
  const profile = identity.originProfile;
  if (profile !== "portfolio" && profile !== "site" && profile !== "app") return undefined;
  const environment = identity.recipeVersion === applicationEnvironmentRecipeVersions[profile];
  if (!environment && identity.recipeVersion !== publicRecipeVersions[profile]) return undefined;
  const dependencies = manifest.dependencies;
  const development = manifest.devDependencies;
  if (dependencies.next !== "16.3.8" || development.vitest !== "5.0.3" ||
      development["eslint-config-next"] !== (profile === "portfolio" ? "16.3.0" : "16.3.3")) return undefined;
  const foundation = dependencies.effect !== undefined;
  if ((foundation && dependencies.effect !== "4.0.0-rc.112") || (profile === "app" && !foundation)) return undefined;
  if (dependencies["drizzle-orm"] !== undefined || development["drizzle-kit"] !== undefined) {
    return profile === "app" && dependencies["drizzle-orm"] === "0.45.2" &&
      development["drizzle-kit"] === "0.31.10" && development["@cloudflare/workers-types"] === "5.20260730.1"
      ? "app-0.2.5-persistence" : undefined;
  }
  if (environment) {
    if (profile === "app") return "app-0.3.0";
    if (foundation) return profile === "portfolio" ? "portfolio-0.11.5-foundation" : "app-0.2.5";
    return profile === "portfolio" ? "portfolio-0.12.0" : "site-0.13.0";
  }
  if (profile === "app" || (profile === "site" && foundation)) return "app-0.2.5";
  return profile === "portfolio"
    ? foundation ? "portfolio-0.11.5-foundation" : "portfolio-0.11.5"
    : "site-0.12.5";
}

export function createRecipeLockfileUrl(version: string): URL {
  if (!recipeLockfileVersions.some(value => value === version)) {
    throw new TypeError("recipe-lockfile-version-unsupported");
  }
  return new URL(`../../lockfiles/web-recipe-${version}/pnpm-lock.yaml`, import.meta.url);
}
