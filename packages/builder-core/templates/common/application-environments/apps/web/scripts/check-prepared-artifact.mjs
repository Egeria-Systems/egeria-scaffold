import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { closeSync, constants, fstatSync, lstatSync, openSync, opendirSync, readSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { parseApplicationBuildId } from "../src/configuration/application-build.ts";

const maximumMetadataBytes = 1024 * 1024;
const maximumArtifactBytes = 1024 * 1024 * 1024;
const maximumEntries = 4096;
const receiptPath = ".open-next/prepared-artifact.json";

function refuse(code) { throw new Error(code); }

function directory(path) {
  const info = lstatSync(path);
  if (!info.isDirectory() || info.isSymbolicLink()) refuse("PREPARED_ARTIFACT_PATH_INVALID");
}

function readMetadata(path) {
  const file = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const info = fstatSync(file);
    if (!info.isFile() || info.size > maximumMetadataBytes) refuse("PREPARED_ARTIFACT_METADATA_INVALID");
    const buffer = Buffer.alloc(info.size + 1);
    let bytes = 0;
    while (bytes < buffer.length) {
      const length = readSync(file, buffer, bytes, buffer.length - bytes, null);
      if (length === 0) break;
      bytes += length;
    }
    const after = fstatSync(file);
    if (bytes !== info.size || after.size !== info.size || after.mtimeMs !== info.mtimeMs) refuse("PREPARED_ARTIFACT_CHANGED");
    return buffer.subarray(0, bytes).toString("utf8");
  } finally { closeSync(file); }
}

function bundleInputs(wrangler) {
  if (wrangler.main === ".open-next/worker.js") return [];
  if (wrangler.main !== "worker.mjs" || JSON.stringify(wrangler.rules) !== JSON.stringify([{ type: "Text", globs: [".open-next/assets/BUILD_ID"], fallthrough: false }])) refuse("PREPARED_ARTIFACT_WORKER_UNSUPPORTED");
  const webRoot = resolve(".");
  const repositoryRoot = resolve("../..");
  if (relative(repositoryRoot, webRoot) !== join("apps", "web")) refuse("PREPARED_ARTIFACT_PATH_INVALID");
  const metadata = JSON.parse(readMetadata(".open-next/jobs-inputs.json"));
  if (!metadata?.inputs || typeof metadata.inputs !== "object" || Array.isArray(metadata.inputs) ||
      !metadata.outputs || typeof metadata.outputs !== "object" || Array.isArray(metadata.outputs)) refuse("PREPARED_ARTIFACT_BUNDLE_INVALID");
  const inputs = Object.keys(metadata.inputs);
  const outputs = Object.entries(metadata.outputs);
  if (inputs.length === 0 || inputs.length > maximumEntries || outputs.length === 0 || outputs.length > maximumEntries ||
      !inputs.includes("worker.mjs") || !outputs.some(([, value]) => value.entryPoint === "worker.mjs")) refuse("PREPARED_ARTIFACT_BUNDLE_INVALID");
  // The native metafile identifies transitive inputs. Separately emitted modules
  // live in jobs-bundle and are covered by the complete .open-next traversal.
  for (const [path] of outputs) {
    if (!path.startsWith(".open-next/jobs-bundle/") || relative(webRoot, resolve(path)) !== path) refuse("PREPARED_ARTIFACT_BUNDLE_INVALID");
    if (!lstatSync(path).isFile()) refuse("PREPARED_ARTIFACT_BUNDLE_INVALID");
  }
  const paths = [...inputs, "package.json", "tsconfig.json", "../../package.json", "../../pnpm-lock.yaml", "../../pnpm-workspace.yaml"];
  for (const path of paths) {
    if (isAbsolute(path) || path.includes("\\") || path.includes(":" ) || path.length > 1024 || relative(webRoot, resolve(path)) !== path ||
        !(path === "worker.mjs" || path === "package.json" || path === "tsconfig.json" ||
          path.startsWith("src/") || path.startsWith(".open-next/") || path.startsWith(".wrangler/tmp/") ||
          path.startsWith("node_modules/.pnpm/") || path.startsWith("../../node_modules/.pnpm/") ||
          ["../../package.json", "../../pnpm-lock.yaml", "../../pnpm-workspace.yaml"].includes(path))) refuse("PREPARED_ARTIFACT_BUNDLE_INVALID");
    const inside = relative(repositoryRoot, resolve(path));
    if (inside.startsWith(`..${sep}`) || isAbsolute(inside)) refuse("PREPARED_ARTIFACT_PATH_INVALID");
    let parent = dirname(resolve(path));
    while (parent !== repositoryRoot) { directory(parent); parent = dirname(parent); }
  }
  return paths;
}

function artifactConfiguration(config, target, absolute = false) {
  const selected = target === "development" ? config : { ...config, ...config.env?.[target] };
  const path = value => absolute ? resolve(value) : value;
  const main = selected.main === path(".open-next/worker.js") ? ".open-next/worker.js" : selected.main === path("worker.mjs") ? "worker.mjs" : undefined;
  const rules = main === "worker.mjs" ? [{ type: "Text", globs: [".open-next/assets/BUILD_ID"], fallthrough: false }] : undefined;
  if (!main || selected.assets?.directory !== path(".open-next/assets") || JSON.stringify(selected.rules) !== JSON.stringify(rules)) refuse("PREPARED_ARTIFACT_WORKER_UNSUPPORTED");
  return { ...selected, main };
}

function inspectFiles(extraPaths) {
  const paths = [".next/BUILD_ID", ".next/required-server-files.json", "wrangler.jsonc", ...extraPaths];
  const pending = [".open-next"];
  let entries = paths.length + pending.length;
  while (pending.length > 0) {
    const parent = pending.pop();
    directory(parent);
    const outputDirectory = opendirSync(parent);
    try {
      let entry;
      while ((entry = outputDirectory.readSync()) !== null) {
        const path = join(parent, entry.name);
        if (path === receiptPath) continue;
        entries += 1;
        if (entries > maximumEntries) refuse("PREPARED_ARTIFACT_SIZE_INVALID");
        if (path.length > 1024) refuse("PREPARED_ARTIFACT_PATH_INVALID");
        const info = lstatSync(path);
        if (info.isSymbolicLink()) refuse("PREPARED_ARTIFACT_PATH_INVALID");
        if (info.isDirectory()) pending.push(path);
        else if (info.isFile()) paths.push(path);
        else refuse("PREPARED_ARTIFACT_PATH_INVALID");
      }
    } finally { outputDirectory.closeSync(); }
  }
  let totalBytes = 0;
  return [...new Set(paths)].sort().map(path => {
    const file = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    try {
      const before = fstatSync(file);
      if (!before.isFile() || before.size > maximumArtifactBytes - totalBytes) refuse("PREPARED_ARTIFACT_SIZE_INVALID");
      const hash = createHash("sha256");
      const buffer = Buffer.alloc(64 * 1024);
      let length;
      let bytes = 0;
      while ((length = readSync(file, buffer, 0, buffer.length, null)) !== 0) {
        bytes += length;
        if (bytes > before.size) refuse("PREPARED_ARTIFACT_CHANGED");
        hash.update(buffer.subarray(0, length));
      }
      const after = fstatSync(file);
      if (bytes !== before.size || after.size !== before.size || after.mtimeMs !== before.mtimeMs) refuse("PREPARED_ARTIFACT_CHANGED");
      totalBytes += bytes;
      return { path, sha256: hash.digest("hex") };
    } finally { closeSync(file); }
  });
}

function validateReleaseSource(target, revision) {
  if (target === "development" || process.env.GITHUB_REF !== "refs/heads/main" ||
      process.env.GITHUB_SHA !== revision || process.env.EXPECTED_REVISION !== revision) refuse("PREPARED_ARTIFACT_SOURCE_INVALID");
  const git = args => execFileSync("git", args, {
    encoding: "utf8", timeout: 10000, maxBuffer: maximumMetadataBytes, stdio: ["ignore", "pipe", "pipe"],
    env: { PATH: process.env.PATH, GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: "/dev/null", GIT_OPTIONAL_LOCKS: "0" },
  });
  try {
    if (git(["rev-parse", "HEAD"]).trim() !== revision || git(["status", "--porcelain=v1", "--untracked-files=all"]) !== "") refuse("PREPARED_ARTIFACT_SOURCE_INVALID");
  } catch { refuse("PREPARED_ARTIFACT_SOURCE_INVALID"); }
}

function main() {
  const [mode, target, revision, local, ...extra] = process.argv.slice(2);
  const identity = parseApplicationBuildId(`egeria-${target}-${revision}`);
  if ((mode !== "record" && mode !== "verify") || !identity.ok || extra.length !== 0 || (local !== undefined && local !== "--local")) refuse("PREPARED_ARTIFACT_ARGUMENT_INVALID");
  if (local !== "--local") validateReleaseSource(target, revision);
  directory(".next");
  directory(".open-next");
  directory(".open-next/assets");
  const buildId = readMetadata(".next/BUILD_ID");
  const expectedBuildId = `egeria-${target}-${revision}`;
  const config = JSON.parse(readMetadata(".next/required-server-files.json"))?.config;
  if (buildId !== expectedBuildId || readMetadata(".open-next/assets/BUILD_ID") !== buildId ||
      config?.env?.NEXT_PUBLIC_APPLICATION_ENVIRONMENT !== target || config?.output !== "standalone" || config?.deploymentId !== undefined) refuse("PREPARED_ARTIFACT_IDENTITY_INVALID");
  const wrangler = artifactConfiguration(JSON.parse(readMetadata("wrangler.jsonc")), target);
  const inputs = bundleInputs(wrangler);
  if (wrangler.d1_databases && local !== "--local") {
    directory(".wrangler"); directory(".wrangler/application-database");
    const remote = artifactConfiguration(JSON.parse(readMetadata(".wrangler/application-database/wrangler.remote.json")), target, true);
    if (remote.main !== wrangler.main) refuse("PREPARED_ARTIFACT_WORKER_UNSUPPORTED");
    inputs.push(".wrangler/application-database/wrangler.remote.json");
  }
  const files = inspectFiles(inputs);
  if (!files.some(file => file.path === ".open-next/worker.js")) refuse("PREPARED_ARTIFACT_WORKER_UNSUPPORTED");
  const receipt = { schemaVersion: 1, target, revision, buildId, files };
  const serialized = `${JSON.stringify(receipt)}\n`;
  if (Buffer.byteLength(serialized) > maximumMetadataBytes) refuse("PREPARED_ARTIFACT_SIZE_INVALID");
  if (mode === "record") writeFileSync(receiptPath, serialized, { flag: "wx", mode: 0o600 });
  else if (readMetadata(receiptPath) !== serialized) refuse("PREPARED_ARTIFACT_CHANGED");
  console.log(JSON.stringify({ code: "PREPARED_ARTIFACT_VALID", target, revision }));
}

try { main(); }
catch (error) {
  const code = error instanceof Error && /^PREPARED_ARTIFACT_[A-Z_]+$/u.test(error.message) ? error.message : "PREPARED_ARTIFACT_INVALID";
  console.error(JSON.stringify({ code }));
  process.exitCode = 1;
}
