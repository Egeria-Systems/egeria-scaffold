type RecipeLockfileVersion = "0.8.0" | "0.9.0" | "0.10.0" | "app-0.1.0" | "portfolio-0.11.0" | "site-0.12.0" | "app-0.2.0";

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
  if (vitest === "5.0.0") {
    if (identity.originProfile === "app") {
      return identity.recipeVersion === "0.2.0" && next === "16.3.3" &&
        eslintConfigNext === "16.3.3" && dependencies.effect === "4.0.0-rc.112"
        ? "app-0.2.0" : undefined;
    }
    if (dependencies.effect !== undefined) return undefined;
    if (identity.originProfile === "portfolio") {
      return identity.recipeVersion === "0.11.0" && next === "16.3.0" &&
        eslintConfigNext === "16.3.0" ? "portfolio-0.11.0" : undefined;
    }
    return identity.originProfile === "site" && identity.recipeVersion === "0.12.0" &&
      next === "16.3.3" && eslintConfigNext === "16.3.3" ? "site-0.12.0" : undefined;
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
    `../../lockfiles/web-recipe-${version}/pnpm-lock.yaml`,
    import.meta.url,
  );
}
