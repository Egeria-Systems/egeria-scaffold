import { applicationEnvironmentRecipeVersions } from "../contracts/profile.js";

export const currentNextVersion = "16.4.5";
export const retainedNextVersion = "16.4.1";

const environmentLockfileKeys = [
  "portfolio-0.11.7-foundation", "app-0.2.7", "app-0.2.7-persistence",
  "portfolio-0.12.0", "site-0.13.0", "app-0.3.0",
] as const;
type EnvironmentLockfileKey = typeof environmentLockfileKeys[number];
type RecipeLockfileVersion = EnvironmentLockfileKey | `${EnvironmentLockfileKey}-next-${typeof currentNextVersion}`;

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
  if (!environment) return undefined;
  const dependencies = manifest.dependencies;
  const development = manifest.devDependencies;
  if ((dependencies.next !== currentNextVersion && dependencies.next !== retainedNextVersion) || development.vitest !== "5.0.3" ||
      development["eslint-config-next"] !== (profile === "portfolio" ? "16.3.0" : "16.3.3")) return undefined;
  const foundation = dependencies.effect !== undefined;
  if ((foundation && dependencies.effect !== "4.0.0-rc.112") || (profile === "app" && !foundation)) return undefined;
  let key: EnvironmentLockfileKey;
  if (dependencies["drizzle-orm"] !== undefined || development["drizzle-kit"] !== undefined) {
    if (profile !== "app" || dependencies["drizzle-orm"] !== "0.45.2" ||
        development["drizzle-kit"] !== "0.31.10" || development["@cloudflare/workers-types"] !== "5.20261006.1") return undefined;
    key = "app-0.2.7-persistence";
  } else if (profile === "app") {
    key = "app-0.3.0";
  } else if (foundation) {
    key = profile === "portfolio" ? "portfolio-0.11.7-foundation" : "app-0.2.7";
  } else {
    key = profile === "portfolio" ? "portfolio-0.12.0" : "site-0.13.0";
  }
  return dependencies.next === currentNextVersion ? `${key}-next-${currentNextVersion}` : key;
}

export function createRecipeLockfileUrl(version: string): URL {
  const knownEnvironmentLock = environmentLockfileKeys.some(key => version === key || version === `${key}-next-${currentNextVersion}`);
  if (!knownEnvironmentLock && version !== "portfolio-0.11.7" && version !== "site-0.12.7") {
    throw new TypeError("recipe-lockfile-version-unsupported");
  }
  return new URL(`../../lockfiles/web-recipe-${version}/pnpm-lock.yaml`, import.meta.url);
}
