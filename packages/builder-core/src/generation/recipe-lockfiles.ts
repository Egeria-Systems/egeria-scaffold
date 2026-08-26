type RecipeLockfileVersion = "0.8.0" | "0.9.0";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function resolveRecipeLockfileVersion(
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
    return "0.8.0";
  }
  return next === "16.3.3" && eslintConfigNext === "16.3.3"
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
