import { readFile } from "node:fs/promises";
import { parseDocument } from "yaml";

import type { ApplicationEnvironmentProjectConfiguration, ProjectConfiguration } from "../contracts/project.js";
import type { ValidationResult } from "../contracts/result.js";
import { createRecipeLockfileUrl, resolveRecipeLockfileVersion } from "../generation/recipe-lockfiles.js";
import type { RenderedSkeleton } from "../generation/render-skeleton.js";
import type { RepositoryReader } from "../repository/repository-reader.js";
import { jsonValuesEqual } from "../serialization/canonical-json.js";

const manifestPath = "apps/web/package.json";
const dependencyGraphMembers = ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies", "pnpm", "overrides", "resolutions"] as const;
const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function parseManifest(source: string): Record<string, unknown> {
  const value: unknown = JSON.parse(source);
  // JSON.parse accepts duplicate keys; YAML's existing parser supplies uniqueness checks.
  const document = parseDocument(source, { schema: "json", uniqueKeys: true, strict: true });
  if (!record(value) || document.errors.length !== 0 || document.warnings.length !== 0) {
    throw new Error("MANIFEST_INVALID");
  }
  return value;
}

function equal(left: unknown, right: unknown): boolean {
  return left === undefined || right === undefined
    ? left === right
    : jsonValuesEqual(left, right);
}

function projectManifestMembers(
  actual: Record<string, unknown>,
  current: Record<string, unknown>,
  desired: Record<string, unknown>,
): Record<string, unknown> {
  const result = { ...actual };
  for (const key of new Set([...Object.keys(current), ...Object.keys(desired)])) {
    if (equal(current[key], desired[key])) continue;
    if (record(current[key]) && record(desired[key]) && record(actual[key])) {
      result[key] = projectManifestMembers(actual[key], current[key], desired[key]);
    } else {
      if (!equal(actual[key], current[key])) throw new Error("MANIFEST_CONFLICT");
      if (desired[key] === undefined) Reflect.deleteProperty(result, key);
      else result[key] = desired[key];
    }
  }
  return result;
}

export async function prepareCapabilityDependencyChange<P extends ProjectConfiguration | ApplicationEnvironmentProjectConfiguration>(input: Readonly<{
  reader: RepositoryReader;
  current: RenderedSkeleton<P>;
  desired: RenderedSkeleton<P>;
}>): Promise<ValidationResult<Readonly<{ current: RenderedSkeleton<P>; desired: RenderedSkeleton<P> }>>> {
  const hasPersistence = (rendered: RenderedSkeleton<P>) => rendered.project.selectedCapabilities.includes("application-persistence");
  const hasFoundation = (rendered: RenderedSkeleton<P>) => rendered.project.selectedCapabilities.includes("app-foundation");
  if (hasPersistence(input.current) === hasPersistence(input.desired) && hasFoundation(input.current) === hasFoundation(input.desired)) {
    return { ok: true, value: { current: input.current, desired: input.desired } };
  }
  try {
    const sourceFile = input.current.files.find(({ path }) => path === manifestPath);
    const targetFile = input.desired.files.find(({ path }) => path === manifestPath);
    const actualFile = await input.reader.readText(manifestPath);
    const actualLock = await input.reader.readText("pnpm-lock.yaml");
    if (sourceFile === undefined || targetFile === undefined || actualFile.kind !== "file" || actualLock.kind !== "file") {
      throw new Error("INPUT_UNAVAILABLE");
    }
    const source = parseManifest(decoder.decode(sourceFile.content));
    const target = parseManifest(decoder.decode(targetFile.content));
    const actual = parseManifest(actualFile.content);
    for (const key of dependencyGraphMembers) {
      if (!equal(actual[key], source[key])) throw new Error("DEPENDENCY_GRAPH_UNSUPPORTED");
    }
    const rootSourceFile = input.current.files.find(({ path }) => path === "package.json");
    const rootActualFile = await input.reader.readText("package.json");
    if (rootSourceFile === undefined || rootActualFile.kind !== "file") throw new Error("ROOT_MANIFEST_UNAVAILABLE");
    const rootSource = parseManifest(decoder.decode(rootSourceFile.content));
    const rootActual = parseManifest(rootActualFile.content);
    for (const key of dependencyGraphMembers) {
      if (!equal(rootActual[key], rootSource[key])) throw new Error("DEPENDENCY_GRAPH_UNSUPPORTED");
    }
    const projected = projectManifestMembers(actual, source, target);
    const sourceVersion = resolveRecipeLockfileVersion(input.current.project, source);
    const targetVersion = resolveRecipeLockfileVersion(input.desired.project, target);
    if (sourceVersion === undefined || targetVersion === undefined) throw new Error("LOCKFILE_UNSUPPORTED");
    const sourceLock = await readFile(createRecipeLockfileUrl(sourceVersion), "utf8");
    const targetLock = await readFile(createRecipeLockfileUrl(targetVersion), "utf8");
    if (sourceLock !== actualLock.content) throw new Error("LOCKFILE_DRIFTED");
    const withFiles = (rendered: RenderedSkeleton<P>, manifest: string, lock: string): RenderedSkeleton<P> => ({
      ...rendered,
      files: [
        ...rendered.files.filter(({ path }) => path !== manifestPath && path !== "pnpm-lock.yaml"),
        { path: manifestPath, content: encoder.encode(manifest) },
        { path: "pnpm-lock.yaml", content: encoder.encode(lock) },
      ].sort((left, right) => left.path.localeCompare(right.path)),
    });
    return { ok: true, value: {
      current: withFiles(input.current, actualFile.content, sourceLock),
      desired: withFiles(input.desired, `${JSON.stringify(projected, null, 2)}\n`, targetLock),
    } };
  } catch {
    return { ok: false, issues: [{ code: "CAPABILITY_DEPENDENCY_CHANGE_UNSUPPORTED", path: [], context: { reason: "precondition-refused" } }] };
  }
}
