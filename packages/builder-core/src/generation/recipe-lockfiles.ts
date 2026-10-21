import { isLiteralLintProfileRecipe, isViteSecurityProfileRecipe } from "../profiles/profile-recipes.js";

type RecipeLockfileVersion = "0.8.0" | "0.9.0" | "0.10.0" | "app-0.1.0" | "portfolio-0.11.0" | "site-0.12.0" | "app-0.2.0" | "portfolio-0.12.0" | "site-0.13.0" | "app-0.3.0" | "application-persistence" | "portfolio-foundation" | "portfolio-0.11.2" | "site-0.12.2" | "app-0.2.2" | "app-0.2.2-persistence" | "portfolio-0.11.2-foundation" | "portfolio-0.11.3" | "portfolio-0.11.3-foundation" | "site-0.12.3" | "app-0.2.3" | "app-0.2.3-persistence" | "portfolio-0.11.4" | "portfolio-0.11.4-foundation" | "site-0.12.4" | "app-0.2.4" | "app-0.2.4-persistence";

export type RecipeLockfileIdentity = Readonly<{
  originProfile: string;
  recipeVersion: string;
}>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function resolveRecipeLockfileVersion(
  identity: RecipeLockfileIdentity,
  manifest: unknown,
): RecipeLockfileVersion | undefined {
  if (!isRecord(manifest)) {
    return undefined;
  }

  const dependencies = manifest.dependencies;
  const devDependencies = manifest.devDependencies;
  if (!isRecord(dependencies) || !isRecord(devDependencies)) {
    return undefined;
  }

  const next = dependencies.next;
  const eslintConfigNext = devDependencies["eslint-config-next"];
  const vitest = devDependencies.vitest;
  const viteSecurity = isViteSecurityProfileRecipe(identity.originProfile, identity.recipeVersion);
  const literalLintRoots = isLiteralLintProfileRecipe(identity.originProfile, identity.recipeVersion);
  const successor = (identity.originProfile === "portfolio" && identity.recipeVersion === "0.11.2") ||
    (identity.originProfile === "site" && identity.recipeVersion === "0.12.2") ||
    (identity.originProfile === "app" && identity.recipeVersion === "0.2.2");
  const environment = (identity.originProfile === "portfolio" && identity.recipeVersion === "0.12.0") ||
    (identity.originProfile === "site" && identity.recipeVersion === "0.13.0") ||
    (identity.originProfile === "app" && identity.recipeVersion === "0.3.0");
  if (literalLintRoots || successor || environment) {
    if (next !== "16.3.8" || vitest !== "5.0.0" ||
        eslintConfigNext !== (identity.originProfile === "portfolio" ? "16.3.0" : "16.3.3")) return undefined;
    const foundation = dependencies.effect !== undefined;
    if ((foundation && dependencies.effect !== "4.0.0-rc.112") ||
        (identity.originProfile === "app" && !foundation)) return undefined;
    if (dependencies["drizzle-orm"] !== undefined || devDependencies["drizzle-kit"] !== undefined) {
      return (literalLintRoots || successor || environment) && identity.originProfile === "app" && dependencies["drizzle-orm"] === "0.45.2" &&
        devDependencies["drizzle-kit"] === "0.31.10" && devDependencies["@cloudflare/workers-types"] === "5.20260730.1"
        ? viteSecurity || environment ? "app-0.2.4-persistence" : literalLintRoots ? "app-0.2.3-persistence" : "app-0.2.2-persistence" : undefined;
    }
    if (environment) {
      if (identity.originProfile === "app") return "app-0.3.0";
      if (foundation) return identity.originProfile === "portfolio" ? "portfolio-0.11.4-foundation" : "app-0.2.4";
      return identity.originProfile === "portfolio" ? "portfolio-0.12.0" : "site-0.13.0";
    }
    if (viteSecurity) {
      if (identity.originProfile === "app" || (identity.originProfile === "site" && foundation)) return "app-0.2.4";
      return identity.originProfile === "portfolio"
        ? foundation ? "portfolio-0.11.4-foundation" : "portfolio-0.11.4"
        : "site-0.12.4";
    }
    if (literalLintRoots) {
      if (identity.originProfile === "app" || (identity.originProfile === "site" && foundation)) return "app-0.2.3";
      return identity.originProfile === "portfolio"
        ? foundation ? "portfolio-0.11.3-foundation" : "portfolio-0.11.3"
        : "site-0.12.3";
    }
    if (identity.originProfile === "app" || (identity.originProfile === "site" && foundation)) return "app-0.2.2";
    return identity.originProfile === "portfolio"
      ? foundation ? "portfolio-0.11.2-foundation" : "portfolio-0.11.2"
      : "site-0.12.2";
  }
  if (dependencies["drizzle-orm"] !== undefined || devDependencies["drizzle-kit"] !== undefined) {
    return identity.originProfile === "app" && (identity.recipeVersion === "0.2.0") &&
      next === "16.3.3" && eslintConfigNext === "16.3.3" && vitest === "5.0.0" &&
      dependencies.effect === "4.0.0-rc.112" && dependencies["drizzle-orm"] === "0.45.2" &&
      devDependencies["drizzle-kit"] === "0.31.10" &&
      devDependencies["@cloudflare/workers-types"] === "5.20260730.1"
        ? "application-persistence" : undefined;
  }
  if (vitest === "5.0.0") {
    if (identity.originProfile === "app") {
      if (next !== "16.3.3" || eslintConfigNext !== "16.3.3" || dependencies.effect !== "4.0.0-rc.112") return undefined;
      return identity.recipeVersion === "0.2.0" ? "app-0.2.0" : undefined;
    }
    if (dependencies.effect !== undefined) {
      if (dependencies.effect !== "4.0.0-rc.112") return undefined;
      if (identity.originProfile === "portfolio" && next === "16.3.3" && eslintConfigNext === "16.3.0") {
        return identity.recipeVersion === "0.11.0" ? "portfolio-foundation" : undefined;
      }
      if (identity.originProfile !== "site" || next !== "16.3.3" || eslintConfigNext !== "16.3.3") return undefined;
      return identity.recipeVersion === "0.12.0" ? "app-0.2.0" : undefined;
    }
    if (identity.originProfile === "portfolio") {
      if (next !== "16.3.0" || eslintConfigNext !== "16.3.0") return undefined;
      return identity.recipeVersion === "0.11.0" ? "portfolio-0.11.0" : undefined;
    }
    if (identity.originProfile !== "site" || next !== "16.3.3" || eslintConfigNext !== "16.3.3") return undefined;
    return identity.recipeVersion === "0.12.0" ? "site-0.12.0" : undefined;
  }
  if (identity.originProfile === "app") {
    return identity.recipeVersion === "0.1.0" &&
      (vitest === "4.1.10" || vitest === "4.1.11") &&
      next === "16.3.3" &&
      eslintConfigNext === "16.3.3" &&
      dependencies.effect === "4.0.0-rc.112"
      ? "app-0.1.0"
      : undefined;
  }
  if (vitest !== "4.1.10") return undefined;
  if (next === "16.3.0" && eslintConfigNext === "16.3.0") {
    if (
      identity.originProfile === "site" &&
      identity.recipeVersion === "0.10.0"
    ) {
      return "0.8.0";
    }
    return identity.originProfile === "portfolio" &&
      identity.recipeVersion === "0.10.0"
      ? "0.10.0"
      : undefined;
  }
  return identity.originProfile === "site" &&
    identity.recipeVersion === "0.11.0" &&
    next === "16.3.3" &&
    eslintConfigNext === "16.3.3"
    ? "0.9.0"
    : undefined;
}

export function createRecipeLockfileUrl(
  version: RecipeLockfileVersion,
): URL {
  return new URL(
    version === "application-persistence" ? "../../lockfiles/web-application-persistence/pnpm-lock.yaml" : `../../lockfiles/web-recipe-${version}/pnpm-lock.yaml`,
    import.meta.url,
  );
}
