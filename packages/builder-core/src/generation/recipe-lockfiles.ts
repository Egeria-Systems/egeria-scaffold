import { parseDocument } from "yaml";
import type { InstalledState } from "../contracts/state.js";
import { fingerprintJsonValue } from "../ownership/fingerprint.js";
import { applicationEnvironmentRecipeVersions } from "../contracts/profile.js";

export const currentNextVersion = "16.4.5";

const environmentLockfileKeys = [
  "portfolio-0.11.7-foundation", "app-0.2.7", "app-0.2.7-persistence",
  "portfolio-0.12.0", "site-0.13.0", "app-0.3.0",
] as const;
type EnvironmentLockfileKey = typeof environmentLockfileKeys[number];
type RecipeLockfileVersion = `${EnvironmentLockfileKey}-next-${typeof currentNextVersion}`;

export type RecipeLockfileIdentity = Readonly<{ originProfile: string; recipeVersion: string }>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function parsePackageManifest(source: string): Record<string, unknown> {
  const value: unknown = JSON.parse(source);
  // JSON.parse accepts duplicate keys. The strict parser checks uniqueness.
  const document = parseDocument(source, { schema: "json", uniqueKeys: true, strict: true });
  if (!isRecord(value) || document.errors.length !== 0 || document.warnings.length !== 0) {
    throw new Error("MANIFEST_INVALID");
  }
  return value;
}

export function declaresCurrentNext(manifest: Record<string, unknown>): boolean {
  if (!isRecord(manifest.dependencies) || manifest.dependencies.next !== currentNextVersion) return false;
  return ["devDependencies", "optionalDependencies", "peerDependencies"].every(section => {
    const members = manifest[section];
    return !isRecord(members) || members.next === undefined || members.next === currentNextVersion;
  });
}

export function hasCurrentNextFingerprint(state: InstalledState): boolean {
  const declarations = state.managedSurfaces.filter(surface =>
    surface.identifier === "builder-web-package-next" || (surface.path === "apps/web/package.json" &&
    surface.fingerprintTarget.kind === "json-value" && surface.fingerprintTarget.pointer === "/dependencies/next"));
  const [next] = declarations;
  return declarations.length === 1 && next?.identifier === "builder-web-package-next" &&
    next.path === "apps/web/package.json" && next.owner.kind === "builder-kernel" &&
    next.ownership === "merge-managed" && next.mergeStrategy === "json-property" &&
    next.fingerprintTarget.kind === "json-value" && next.fingerprintTarget.pointer === "/dependencies/next" &&
    !state.ejections.includes(next.path) && next.fingerprint === fingerprintJsonValue(currentNextVersion);
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
  if (!declaresCurrentNext(manifest) || development.vitest !== "5.0.3" ||
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
  return `${key}-next-${currentNextVersion}`;
}

export function createRecipeLockfileUrl(version: string): URL {
  const knownEnvironmentLock = environmentLockfileKeys.some(key => version === `${key}-next-${currentNextVersion}`);
  if (!knownEnvironmentLock) {
    throw new TypeError("recipe-lockfile-version-unsupported");
  }
  return new URL(`../../lockfiles/web-recipe-${version}/pnpm-lock.yaml`, import.meta.url);
}
