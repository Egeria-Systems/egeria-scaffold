type RecipeLockfileVersion = "0.8.0" | "0.9.0" | "0.10.0";

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
