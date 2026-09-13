import { execFile } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import * as filesystem from "node:fs/promises";
import { constants } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";

import { cleanupOwnedDirectory, createIsolatedProcessEnvironment, isolatedProcessOptions, pathIdentityMatches, readPathIdentity } from "./lib/isolated-process.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const execute = promisify(execFile);
const artifactRoot = "generated-visual-artifacts/app-transitions";
const snapshotDirectory = "apps/web/tests/visual/home-visual.spec.ts-snapshots";
const templateDirectory = `packages/builder-core/templates/portfolio/${snapshotDirectory}`;
const viewports = Object.freeze({ desktop: { width: 1440, height: 900 }, mobile: { width: 320, height: 800 } });
const historicalHashes = Object.freeze({
  "monolingual-desktop": "6f6dd1ddd3049d998ac51b4da17b7eb66ca481b89f9e4947fb68b0bce1af50d5",
  "monolingual-mobile": "00e95d03593487ac4a6bb3e08afe9a1df475ecb76b8b1f1da676259ccf551d27",
  "multilingual-desktop": "d737921e3ceba92f58c1aa0fd728d7e8ecfd20dafb3e8241487e105d8f8aab8c",
  "multilingual-mobile": "b2eecb8f5a8d18f8b4f7516073b57f7faca8df1e947df37883e301d61403fd17",
});

export const appTransitionVisualToolchain = Object.freeze({
  platform: "linux", architecture: "x64", node: "22.23.2", pnpm: "11.20.0",
  playwright: "1.62.1", browserRevision: "1234", browserVersion: "151.0.7922.34",
  image: "mcr.microsoft.com/playwright:v1.62.1-noble@sha256:dcc5531e97840b9b5e794f2814476b21571c5124a3fca2267d73041f56e7580e",
});

const subsets = Object.freeze(Array.from({ length: 8 }, (_, bits) =>
  ["analytics", "booking-calendly", "multilingual"].filter((_, index) => bits & (1 << index))));
const assets = Object.freeze(Object.entries(historicalHashes).map(([identifier, historicalSha256]) => {
  const [group, viewport] = identifier.split("-");
  return Object.freeze({ identifier, group, viewport, historicalSha256,
    templatePath: `${templateDirectory}/app-transition-${group === "multilingual" ? "multilingual-" : ""}home-${viewport}-chromium-linux.png` });
}));

function fail(code) { throw new Error(code); }
function digest(bytes) { return createHash("sha256").update(bytes).digest("hex"); }
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  return value;
}
function json(value) { return `${JSON.stringify(canonical(value), null, 2)}\n`; }
function same(left, right) { return json(left) === json(right); }
function portable(path) { return path.split(sep).join("/"); }
function safeRelative(path) {
  return typeof path === "string" && path.length > 0 && !path.includes("\\") && !path.includes("\0") && !path.startsWith("/") && path.split("/").every((part) => part !== "" && part !== "." && part !== "..");
}

export function parseAppTransitionVisualArguments(arguments_) {
  const values = arguments_[0] === "--" ? arguments_.slice(1) : arguments_;
  if (values.length === 0) return { mode: "compare" };
  if (values.length === 1 && values[0] === "--candidates") return { mode: "candidates" };
  if (values.length === 1) {
    const match = /^--promote-reviewed-manifest-sha256=([a-f0-9]{64})$/.exec(values[0]);
    if (match) return { mode: "promote", digest: match[1] };
  }
  return fail("VISUAL_ARGUMENT_INVALID");
}

async function safePath(fs, root, path, { directories = false, create = directories } = {}) {
  if (!safeRelative(path)) fail("VISUAL_PATH_UNSAFE");
  const rootStat = await fs.lstat(root);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) fail("VISUAL_PATH_UNSAFE");
  const parts = path.split("/");
  let current = root;
  for (let index = 0; index < parts.length; index += 1) {
    current = join(current, parts[index]);
    const directory = index < parts.length - 1 || directories;
    let stats;
    try { stats = await fs.lstat(current); } catch (error) {
      if (error.code !== "ENOENT") throw error;
      if (directory && create) {
        await fs.mkdir(current, { mode: 0o700 });
        stats = await fs.lstat(current);
      } else continue;
    }
    if (stats.isSymbolicLink() || (directory ? !stats.isDirectory() : !stats.isFile())) fail("VISUAL_PATH_UNSAFE");
  }
  return current;
}

async function boundedRead(fs, root, path, maximum = 16 * 1024 * 1024) {
  const absolute = await safePath(fs, root, path);
  const handle = await fs.open(absolute, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const stats = await handle.stat();
    if (!stats.isFile() || stats.size > maximum) fail("VISUAL_ARTIFACT_INVALID");
    const bytes = await handle.readFile();
    const after = await fs.lstat(absolute);
    if (bytes.length !== stats.size || after.isSymbolicLink() || after.dev !== stats.dev || after.ino !== stats.ino || after.size !== stats.size || after.mtimeMs !== stats.mtimeMs) fail("VISUAL_ARTIFACT_INVALID");
    return bytes;
  } finally { await handle.close(); }
}

async function writeExclusive(fs, root, path, bytes) {
  if (dirname(path) !== ".") await safePath(fs, root, portable(dirname(path)), { directories: true });
  const absolute = await safePath(fs, root, path);
  const handle = await fs.open(absolute, "wx", 0o600);
  try { await handle.writeFile(bytes); } finally { await handle.close(); }
}

function validateImage(bytes, viewport) {
  const expected = viewports[viewport];
  if (!(bytes instanceof Uint8Array) || bytes.length < 24 || bytes.length > 8 * 1024 * 1024) fail("VISUAL_IMAGE_INVALID");
  const buffer = Buffer.from(bytes);
  if (!buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) || buffer.toString("ascii", 12, 16) !== "IHDR" || buffer.readUInt32BE(16) !== expected.width || buffer.readUInt32BE(20) !== expected.height) fail("VISUAL_IMAGE_INVALID");
}

async function snapshotSource(root) {
  const { stdout } = await execute("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], { ...isolatedProcessOptions, cwd: root });
  const excluded = new Set(assets.map(({ templatePath }) => templatePath));
  const paths = [...new Set(stdout.split("\0").filter(Boolean))].filter((path) => !excluded.has(path) && (
    ["package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml", ".npmrc"].includes(path) ||
    /^packages\/builder-core\/(src\/|templates\/|lockfiles\/|scripts\/|package.json$|tsconfig)/.test(path) ||
    path === "scripts/verify-app-transition-visuals.mjs" || path === "scripts/lib/isolated-process.mjs"
  )).sort();
  const files = [];
  for (const path of paths) files.push({ path, sha256: digest(await boundedRead(filesystem, root, path)) });
  async function compiled(directory) {
    const absolute = await safePath(filesystem, root, directory, { directories: true, create: false });
    for (const entry of await filesystem.readdir(absolute, { withFileTypes: true })) {
      const path = `${directory}/${entry.name}`;
      if (entry.isSymbolicLink()) fail("VISUAL_PATH_UNSAFE");
      if (entry.isDirectory()) await compiled(path);
      else if (entry.isFile()) files.push({ path, sha256: digest(await boundedRead(filesystem, root, path)) });
      else fail("VISUAL_PATH_UNSAFE");
    }
  }
  await compiled("packages/builder-core/dist");
  files.sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0);
  const { stdout: revision } = await execute("git", ["rev-parse", "HEAD"], { ...isolatedProcessOptions, cwd: root });
  return { revision: revision.trim(), files };
}

async function inspectEnvironment() {
  if (process.platform !== "linux" || process.arch !== "x64" || process.versions.node !== appTransitionVisualToolchain.node) fail("VISUAL_ENVIRONMENT_UNSUPPORTED");
  const { stdout } = await execute("pnpm", ["--version"], isolatedProcessOptions);
  if (stdout.trim() !== appTransitionVisualToolchain.pnpm) fail("VISUAL_ENVIRONMENT_UNSUPPORTED");
  const release = await filesystem.readFile("/etc/os-release", "utf8");
  if (!/^VERSION_CODENAME=noble$/m.test(release)) fail("VISUAL_ENVIRONMENT_UNSUPPORTED");
  await filesystem.access("/.dockerenv");
  // OCI identity is verified by the invoking Docker command or pinned CI job;
  // it cannot be independently discovered from a container filesystem.
  if (process.env.EGERIA_VISUAL_IMAGE !== appTransitionVisualToolchain.image) fail("VISUAL_ENVIRONMENT_UNSUPPORTED");
  return appTransitionVisualToolchain;
}

async function promote(options, adapters) {
  const { filesystem: fs, repositoryRoot: root } = adapters;
  const parent = await safePath(fs, root, artifactRoot, { directories: true, create: false });
  const matches = [];
  const entries = await fs.readdir(parent, { withFileTypes: true }).catch(error => {
    if (error.code === "ENOENT") fail("VISUAL_REVIEWED_MANIFEST_MISSING");
    throw error;
  });
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.isSymbolicLink()) continue;
    const path = `${artifactRoot}/${entry.name}/candidate-manifest.json`;
    try {
      const bytes = await boundedRead(fs, root, path);
      if (digest(bytes) === options.digest) matches.push({ path, bytes });
    } catch (error) { if (error.code !== "ENOENT") throw error; }
  }
  if (matches.length !== 1) fail("VISUAL_REVIEWED_MANIFEST_MISSING");
  const { path, bytes } = matches[0];
  const manifest = JSON.parse(bytes.toString("utf8"));
  if (!Buffer.from(json(manifest)).equals(bytes) || manifest.schemaVersion !== 1 || manifest.status !== "candidates" || !same(manifest.toolchain, appTransitionVisualToolchain) || manifest.cases.length !== 8 || manifest.assets.length !== 4 || !same(manifest.cases.map(({ subset }) => subset), subsets)) fail("VISUAL_MANIFEST_INVALID");
  if (!same(await adapters.snapshotSource(), manifest.source)) fail("VISUAL_SOURCE_CHANGED");
  const approved = [];
  for (let index = 0; index < assets.length; index += 1) {
    const entry = manifest.assets[index];
    const definition = assets[index];
    if (entry.identifier !== definition.identifier || entry.templatePath !== definition.templatePath || !safeRelative(entry.candidatePath)) fail("VISUAL_MANIFEST_INVALID");
    const content = await boundedRead(fs, root, `${portable(dirname(path))}/${entry.candidatePath}`);
    if (digest(content) !== entry.sha256) fail("VISUAL_CANDIDATE_CHANGED");
    validateImage(content, definition.viewport);
    for (const item of manifest.cases.filter(({ subset }) => subset.includes("multilingual") === (definition.group === "multilingual"))) {
      if (item.images[definition.viewport].sha256 !== entry.sha256) fail("VISUAL_MANIFEST_INVALID");
      const actual = await boundedRead(fs, root, `${portable(dirname(path))}/${item.images[definition.viewport].path}`);
      if (digest(actual) !== entry.sha256) fail("VISUAL_CANDIDATE_CHANGED");
    }
    const destination = await safePath(fs, root, definition.templatePath);
    if (await fs.lstat(destination).then(() => true, (error) => { if (error.code !== "ENOENT") throw error; return false; })) fail("VISUAL_PROMOTION_COLLISION");
    approved.push({ path: definition.templatePath, candidatePath: `${portable(dirname(path))}/${entry.candidatePath}`, content });
  }
  const written = [];
  try {
    for (const entry of approved) {
      if (!same(await adapters.snapshotSource(), manifest.source) || digest(await boundedRead(fs, root, path)) !== options.digest) fail("VISUAL_SOURCE_CHANGED");
      for (const candidate of approved) if (!Buffer.from(await boundedRead(fs, root, candidate.candidatePath)).equals(candidate.content)) fail("VISUAL_CANDIDATE_CHANGED");
      await writeExclusive(fs, root, entry.path, entry.content);
      written.push(entry.path);
    }
    if (!same(await adapters.snapshotSource(), manifest.source) || digest(await boundedRead(fs, root, path)) !== options.digest) fail("VISUAL_SOURCE_CHANGED");
    for (const entry of approved) if (!Buffer.from(await boundedRead(fs, root, entry.path)).equals(entry.content)) fail("VISUAL_CANDIDATE_CHANGED");
  } catch (error) {
    if (written.length > 0) {
      const partial = new Error("VISUAL_PROMOTION_PARTIAL");
      partial.writtenPaths = written;
      throw partial;
    }
    throw error;
  }
  return { status: "promoted", manifestSha256: options.digest, paths: written };
}

export async function verifyAppTransitionVisuals(options, injected = {}) {
  if (!["candidates", "compare", "promote"].includes(options.mode) || (options.mode === "promote" && !/^[a-f0-9]{64}$/.test(options.digest))) fail("VISUAL_ARGUMENT_INVALID");
  const root = injected.repositoryRoot ?? repositoryRoot;
  const adapters = { filesystem, repositoryRoot: root, inspectEnvironment, snapshotSource: () => snapshotSource(root), executeCase,
    prepareBuilder: async () => {
      const result = await runCommand({ executable: "pnpm", arguments: ["--filter", "@egeria-systems/builder-core", "run", "build"], cwd: root, environment: createIsolatedProcessEnvironment() });
      if (result.exitCode !== 0) fail("VISUAL_BUILDER_BUILD_FAILED");
    }, ...injected };
  if (options.mode === "promote") return promote(options, adapters);
  const toolchain = await adapters.inspectEnvironment();
  if (!same(toolchain, appTransitionVisualToolchain)) fail("VISUAL_ENVIRONMENT_UNSUPPORTED");
  await adapters.prepareBuilder();
  const source = await adapters.snapshotSource();
  const fs = adapters.filesystem;
  const runPath = `${artifactRoot}/${randomUUID()}`;
  const run = await safePath(fs, root, runPath, { directories: true });
  const identity = await readPathIdentity(run);
  const cases = [];
  try {
    for (const subset of subsets) {
      if (!(await pathIdentityMatches(identity))) fail("VISUAL_ROOT_CHANGED");
      const name = subset.length ? subset.join("-") : "default";
      const casePath = `${runPath}/${name}`;
      const artifactDirectory = await safePath(fs, root, casePath, { directories: true });
      const baselines = {};
      if (options.mode === "compare") {
        for (const asset of assets.filter(({ group }) => (group === "multilingual") === subset.includes("multilingual"))) baselines[asset.viewport] = await boundedRead(fs, root, asset.templatePath);
      }
      const value = await adapters.executeCase({ subset, mode: options.mode, baselines, artifactDirectory, repositoryRoot: root });
      if (!(await pathIdentityMatches(identity))) fail("VISUAL_ROOT_CHANGED");
      if (!value.project?.files?.length || !value.influencingFingerprints?.length) fail("VISUAL_INPUT_IDENTITY_MISSING");
      const images = {};
      for (const viewport of Object.keys(viewports)) {
        const content = value.images[viewport];
        validateImage(content, viewport);
        const path = `${name}/${viewport}-actual.png`;
        await writeExclusive(fs, run, path, content);
        images[viewport] = { path, sha256: digest(content), ...viewports[viewport] };
        if (options.mode === "compare" && !Buffer.from(content).equals(baselines[viewport])) fail("VISUAL_COMPARISON_FAILED");
      }
      cases.push({ subset, project: value.project, influencingFingerprints: value.influencingFingerprints, checks: value.checks, images });
    }
    const representatives = [];
    for (const asset of assets) {
      const group = cases.filter(({ subset }) => subset.includes("multilingual") === (asset.group === "multilingual"));
      const representative = group[0].images[asset.viewport];
      if (group.length !== 4 || group.some(({ images }) => images[asset.viewport].sha256 !== representative.sha256)) fail("VISUAL_SUBSET_MISMATCH");
      representatives.push({ ...asset, candidatePath: representative.path, sha256: representative.sha256, historicalMatch: representative.sha256 === asset.historicalSha256 });
    }
    if (!same(source, await adapters.snapshotSource())) fail("VISUAL_SOURCE_CHANGED");
    if (!(await pathIdentityMatches(identity))) fail("VISUAL_ROOT_CHANGED");
    const manifest = { schemaVersion: 1, status: options.mode === "candidates" ? "candidates" : "compared", source, toolchain, cases, assets: representatives };
    const bytes = Buffer.from(json(manifest));
    const manifestPath = `${runPath}/${options.mode === "candidates" ? "candidate" : "comparison"}-manifest.json`;
    await writeExclusive(fs, root, manifestPath, bytes);
    return { status: manifest.status, manifestPath, manifestSha256: digest(bytes), assets: representatives };
  } catch (error) {
    const sourceUnchanged = same(source, await adapters.snapshotSource());
    if (await pathIdentityMatches(identity)) await writeExclusive(fs, run, "failure.json", json({ code: /^VISUAL_[A-Z_]+$/.test(error.message) ? error.message : "VISUAL_VERIFICATION_FAILED", sourceUnchanged, cases }));
    if (!sourceUnchanged) fail("VISUAL_SOURCE_CHANGED");
    throw error;
  }
}

async function prepareProject(root, subset) {
  const core = await import(pathToFileURL(join(root, "packages/builder-core/dist/index.js")));
  const policy = await import(pathToFileURL(join(root, "packages/builder-core/dist/lifecycle/app-profile-transition.js")));
  const validation = await import(pathToFileURL(join(root, "packages/builder-core/dist/lifecycle/app-transition-content-validation.js")));
  const lockfiles = await import(pathToFileURL(join(root, "packages/builder-core/dist/generation/recipe-lockfiles.js")));
  const request = {
    ...policy.appTransitionVisualProject,
    packageVersions: core.verifiedCapabilityPackageVersions,
    ...(subset.includes("analytics") ? { analytics: policy.appTransitionVisualAnalyticsSettings } : {}),
    ...(subset.includes("booking-calendly") ? { bookingCalendly: policy.appTransitionVisualBookingSettings } : {}),
    ...(subset.includes("multilingual") ? { multilingual: true } : {}),
  };
  const source = await core.renderSkeleton({ ...request, profile: "portfolio" });
  const target = await core.renderSkeleton({ ...request, profile: "app" });
  if (!source.ok || !target.ok) fail("VISUAL_RENDER_FAILED");
  const prepared = policy.prepareAppProfileTransition({ source: source.value, target: target.value,
    currentFiles: new Map(source.value.files.map(({ path, content }) => [path, content])),
    validators: await validation.loadAppTransitionContentValidators() });
  if (!prepared.ok) fail("VISUAL_PREPARATION_FAILED");
  const manifest = JSON.parse(Buffer.from(prepared.value.files.find(({ path }) => path === "apps/web/package.json").content).toString("utf8"));
  const version = lockfiles.resolveRecipeLockfileVersion(target.value.project, manifest);
  if (version !== "app-0.2.0") fail("VISUAL_LOCKFILE_INVALID");
  const lockfile = await filesystem.readFile(lockfiles.createRecipeLockfileUrl(version));
  return { request, sourceProject: source.value.project, targetProject: target.value.project,
    files: [...prepared.value.files, { path: "pnpm-lock.yaml", content: lockfile }], influencingFingerprints: prepared.value.influencingFingerprints };
}

export function createAppTransitionVisualSpec(source, multilingual) {
  const skip = 'test.skip(\n  true,\n  "Multilingual projects are outside the established generated visual matrix.",\n);\n\n';
  if (multilingual && !source.includes(skip)) fail("VISUAL_SPEC_UNRECOGNIZED");
  let result = multilingual ? source.replace(skip, "") : source;
  result = `import { writeFile } from "node:fs/promises";\n${result}`;
  result = result.replace('const normalizedHeroHeading = "Reviewed visual baseline";', `const unexpectedExternalRequests: string[] = [];\ntest.beforeEach(() => { unexpectedExternalRequests.length = 0; });\ntest.afterEach(() => { expect(unexpectedExternalRequests).toEqual([]); });\n\nconst normalizedHeroHeading = "Reviewed visual baseline";`);
  if ((result.match(/async \(\{ page \}\)/g) ?? []).length !== 2) fail("VISUAL_SPEC_UNRECOGNIZED");
  result = result.replaceAll("async ({ page })", "async ({ page }, testInfo)");
  for (const viewport of Object.keys(viewports)) {
    const assertion = `  await expect(page).toHaveScreenshot("home-${viewport}.png");`;
    if (!result.includes(assertion)) fail("VISUAL_SPEC_UNRECOGNIZED");
    // Playwright's pixel comparator can ignore antialiasing differences even
    // at zero tolerance. Stabilize retained actual bytes independently of the
    // expected image; exact reproduction and baseline checks remain separate.
    result = result.replace(assertion, `  try {\n${assertion}\n  } finally {\n    let previousCapture: Buffer = Buffer.alloc(0);\n    let captureAttempt = 0;\n    await expect.poll(async () => {\n      const actual = await page.screenshot({ path: testInfo.outputPath(\`${viewport}-capture-\${captureAttempt++}.png\`), animations: "disabled", caret: "hide", scale: "css" });\n      const unchanged = previousCapture.equals(actual);\n      previousCapture = actual;\n      return unchanged;\n    }, { timeout: 5_000 }).toBe(true);\n    await writeFile(testInfo.outputPath("${viewport}-captured.png"), previousCapture);\n  }`);
  }
  // Every exercised provider remains intercepted. Unexpected external traffic
  // fails the visual proof instead of contacting a live provider.
  result = result.replace("  await page.setViewportSize(viewport);", `  await page.route("**/*", async (route) => {\n    const url = new URL(route.request().url());\n    if (url.hostname === "127.0.0.1" || url.hostname === "localhost") await route.continue();\n    else { unexpectedExternalRequests.push(url.origin); await route.abort(); }\n  });\n  await page.setViewportSize(viewport);`);
  return result;
}

function visualTests(report) {
  const visit = suites => suites.flatMap(suite => [...(suite.specs ?? []).flatMap(spec => spec.tests ?? []), ...visit(suite.suites ?? [])]);
  return visit(report.suites ?? []);
}

export function validateAppTransitionVisualReport(report, candidate) {
  const tests = visualTests(report);
  if (tests.length !== 2 || (report.errors ?? []).length || tests.some(test => test.results?.length !== 1 || !["passed", "failed"].includes(test.results[0].status))) fail("VISUAL_TEST_EXECUTION_INVALID");
  for (const test of tests) {
    const result = test.results[0];
    if (result.status === "passed") continue;
    if (!candidate || !result.errors?.length || result.errors.some(error => !/toHaveScreenshot/.test(error.message ?? ""))) fail("VISUAL_COMPARISON_FAILED");
  }
}

async function runCommand(input) {
  try {
    const result = await execute(input.executable, input.arguments, { ...isolatedProcessOptions, cwd: input.cwd, env: input.environment, timeout: 15 * 60 * 1000 });
    return { exitCode: 0, stdout: result.stdout, stderr: result.stderr };
  } catch (error) {
    return { exitCode: Number.isInteger(error.code) ? error.code : -1, stdout: String(error.stdout ?? ""), stderr: String(error.stderr ?? "") };
  }
}

async function inspectBrowser(project, environment, command) {
  const require = createRequire(join(project, "apps/web/package.json"));
  const testRequire = createRequire(require.resolve("@playwright/test/package.json"));
  const playwrightRequire = createRequire(testRequire.resolve("playwright/package.json"));
  const playwrightPackage = playwrightRequire.resolve("playwright-core/package.json");
  const installed = JSON.parse(await filesystem.readFile(playwrightPackage, "utf8"));
  const browsers = JSON.parse(await filesystem.readFile(join(dirname(playwrightPackage), "browsers.json"), "utf8"));
  const chromium = browsers.browsers.find(browser => browser.name === "chromium");
  const shell = browsers.browsers.find(browser => browser.name === "chromium-headless-shell");
  if (installed.version !== appTransitionVisualToolchain.playwright || [chromium, shell].some(browser => browser?.revision !== appTransitionVisualToolchain.browserRevision || browser?.browserVersion !== appTransitionVisualToolchain.browserVersion)) fail("VISUAL_ENVIRONMENT_UNSUPPORTED");
  const executable = `/ms-playwright/chromium_headless_shell-${shell.revision}/chrome-headless-shell-linux64/chrome-headless-shell`;
  const version = await command({ executable, arguments: ["--version"], cwd: project, environment });
  if (version.exitCode !== 0 || !version.stdout.includes(appTransitionVisualToolchain.browserVersion)) fail("VISUAL_ENVIRONMENT_UNSUPPORTED");
  return { executable, version: version.stdout.trim(), packageSha256: digest(await filesystem.readFile(playwrightPackage)), browsersSha256: digest(await filesystem.readFile(join(dirname(playwrightPackage), "browsers.json"))) };
}

export function inspectEffectSourceBoundary(sourceFiles, appFoundation) {
  for (const { path, content } of sourceFiles) {
    if (!/\.[cm]?[jt]sx?$/.test(path) || path.includes("/tests/")) continue;
    const source = Buffer.from(content).toString("utf8");
    if (/\b(?:from\s*|import\s*(?:\(\s*)?)["']effect(?:\/[^"']*)?["']/.test(source) &&
        (!appFoundation || !/^apps\/web\/src\/(application|infrastructure|composition|delivery)\//.test(path) || /["']use client["']/.test(source))) fail("VISUAL_EFFECT_BOUNDARY_INVALID");
  }
}

export async function inspectAppEffectBuild(project, sourceFiles) {
  inspectEffectSourceBoundary(sourceFiles, true);
  const require = createRequire(join(project, "apps/web/package.json"));
  const effectPackagePath = require.resolve("effect/package.json");
  const effectPackage = JSON.parse(await filesystem.readFile(effectPackagePath, "utf8"));
  if (effectPackage.version !== "4.0.0-rc.112") fail("VISUAL_EFFECT_BOUNDARY_INVALID");
  const effectRoot = dirname(effectPackagePath);
  const markers = new Set();
  async function inventory(root, directory, inspect) {
    const absolute = await safePath(filesystem, root, directory, { directories: true, create: false });
    const files = [];
    for (const entry of await filesystem.readdir(absolute, { withFileTypes: true })) {
      const path = `${directory}/${entry.name}`;
      if (entry.isSymbolicLink()) fail("VISUAL_PATH_UNSAFE");
      if (entry.isDirectory()) files.push(...await inventory(root, path, inspect));
      else if (entry.isFile()) {
        const stats = await filesystem.lstat(join(root, path));
        files.push({ path, bytes: stats.size });
        if (path.endsWith(".js")) await inspect(await boundedRead(filesystem, root, path, 32 * 1024 * 1024), path);
      } else fail("VISUAL_PATH_UNSAFE");
    }
    return files.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  }
  await inventory(effectRoot, "dist", async content => {
    for (const match of content.toString("utf8").matchAll(/["']((?:~effect|effect)\/[A-Za-z0-9_./-]+)["']/g)) markers.add(match[1]);
  });
  if (markers.size === 0) fail("VISUAL_EFFECT_MARKERS_MISSING");
  const client = await inventory(project, "apps/web/.next/static", async content => {
    const source = content.toString("utf8");
    if ([...markers].some(marker => source.includes(marker))) fail("VISUAL_EFFECT_CLIENT_BUNDLE");
  });
  if (!client.some(({ path }) => path.endsWith(".js"))) fail("VISUAL_CLIENT_BUNDLE_MISSING");
  const server = await inventory(project, "apps/web/.next/server", async () => {});
  const workerPath = "apps/web/.open-next/server-functions/default/handler.mjs";
  const worker = await boundedRead(filesystem, project, workerPath, 32 * 1024 * 1024);
  return {
    effect: { version: effectPackage.version, license: effectPackage.license, dependencies: effectPackage.dependencies ?? {}, optionalDependencies: effectPackage.optionalDependencies ?? {}, scripts: effectPackage.scripts ?? {}, packageSha256: digest(await filesystem.readFile(effectPackagePath)) },
    client: { files: client, bytes: client.reduce((sum, file) => sum + file.bytes, 0), inspectedEffectMarkers: [...markers].sort() },
    server: { files: server.length, bytes: server.reduce((sum, file) => sum + file.bytes, 0) },
    worker: { path: workerPath, bytes: worker.length, sha256: digest(worker) },
    limits: "Exact source imports and installed Effect identity markers inspected; byte counts do not establish performance or production safety.",
  };
}

async function retainBrowserArtifacts(fs, project, destination) {
  const files = [];
  let total = 0;
  async function visit(path) {
    const absolute = await safePath(fs, project, path, { directories: true, create: false });
    let entries;
    try { entries = await fs.readdir(absolute, { withFileTypes: true }); } catch (error) { if (error.code === "ENOENT") return; throw error; }
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name, "en"))) {
      const child = `${path}/${entry.name}`;
      if (entry.isSymbolicLink()) fail("VISUAL_PATH_UNSAFE");
      if (entry.isDirectory()) { await visit(child); continue; }
      if (!entry.isFile()) fail("VISUAL_ARTIFACT_INVALID");
      if (!/\.(png|json|txt|md)$/.test(entry.name)) continue;
      const content = await boundedRead(fs, project, child);
      total += content.length;
      if (total > 16 * 1024 * 1024) fail("VISUAL_ARTIFACT_LIMIT");
      await writeExclusive(fs, destination, child, content);
      files.push({ path: child, sha256: digest(content) });
    }
  }
  // The final path here is a directory, validated separately from file reads.
  for (const path of ["apps/web/test-results"]) {
    try {
      const stats = await fs.lstat(join(project, path));
      if (!stats.isDirectory() || stats.isSymbolicLink()) fail("VISUAL_PATH_UNSAFE");
      await visit(path);
    } catch (error) { if (error.code !== "ENOENT") throw error; }
  }
  return files;
}

export async function executeAppTransitionVisualCase(input, injected = {}) {
  const fs = injected.filesystem ?? filesystem;
  const command = injected.runCommand ?? runCommand;
  const prepared = await (injected.prepareProject ?? prepareProject)(input.repositoryRoot, input.subset);
  const root = await fs.mkdtemp(join(tmpdir(), "egeria-app-transition-visual-"));
  const identity = await readPathIdentity(root);
  await fs.chmod(root, 0o700);
  const project = await safePath(fs, root, "project", { directories: true });
  const support = {};
  for (const name of ["home", "temporary", "cache", "store"]) support[name] = await safePath(fs, root, name, { directories: true });
  await writeExclusive(fs, root, "user.npmrc", "");
  const environment = createIsolatedProcessEnvironment({ HOME: support.home, USERPROFILE: support.home, TMPDIR: support.temporary, TMP: support.temporary, TEMP: support.temporary, XDG_CACHE_HOME: support.cache, NPM_CONFIG_USERCONFIG: join(root, "user.npmrc"), NPM_CONFIG_REGISTRY: "https://registry.npmjs.org/", PLAYWRIGHT_BROWSERS_PATH: "/ms-playwright" });
  const files = new Map(prepared.files.map(({ path, content }) => [path, content]));
  const specPath = "apps/web/tests/visual/home-visual.spec.ts";
  files.set(specPath, Buffer.from(createAppTransitionVisualSpec(Buffer.from(files.get(specPath)).toString("utf8"), input.subset.includes("multilingual"))));
  for (const [viewport, content] of Object.entries(input.baselines)) files.set(`${snapshotDirectory}/home-${viewport}-chromium-linux.png`, content);
  const checks = [];
  let expectedFiles;
  let browser;
  let build;
  async function checked(name, arguments_) {
    if (!(await pathIdentityMatches(identity))) fail("VISUAL_ROOT_CHANGED");
    const result = await command({ executable: "pnpm", arguments: arguments_, cwd: project, environment });
    if (!(await pathIdentityMatches(identity))) fail("VISUAL_ROOT_CHANGED");
    await writeExclusive(fs, input.artifactDirectory, `${name}.log`, `${result.stdout}\n${result.stderr}`);
    checks.push({ name, exitCode: result.exitCode });
    if (result.exitCode !== 0) fail("VISUAL_PROJECT_CHECK_FAILED");
  }
  try {
    for (const [path, content] of files) await writeExclusive(fs, project, path, content);
    expectedFiles = [...files].map(([path, content]) => ({ path, sha256: digest(content) })).sort((a, b) => a.path.localeCompare(b.path, "en"));
    const commands = [
      ["frozen-install", ["install", "--frozen-lockfile", "--store-dir", support.store]],
      ["peer-dependencies", ["peers", "check"]],
      ["dependency-audit", ["audit", "--audit-level", "moderate"]],
      ["registry-signatures", ["audit", "signatures"]],
      ["lint", ["run", "lint"]],
      ["cloudflare-types", ["--dir", "apps/web", "run", "cf-typegen"]],
      ["typecheck", ["run", "typecheck"]],
      ["unit", ["run", "test:unit"]],
      ["component", ["run", "test:component"]],
      ["next-build", ["run", "build"]],
      ["opennext-build", ["--dir", "apps/web", "exec", "opennextjs-cloudflare", "build", "--skipNextBuild"]],
      ["worker-integration", ["--dir", "apps/web", "run", "test:integration:cloudflare"]],
      ["browser-development", ["--dir", "apps/web", "run", "test:e2e:dev"]],
      ["browser-preview", ["--dir", "apps/web", "run", "test:e2e:preview"]],
    ];
    for (const [name, arguments_] of commands) {
      await checked(name, arguments_);
      if (name === "opennext-build") {
        build = await (injected.inspectBuild ?? inspectAppEffectBuild)(project, prepared.files);
        checks.push({ name: "effect-source-and-bundle-boundary", exitCode: 0 });
      }
    }
    browser = await (injected.inspectBrowser ?? inspectBrowser)(project, environment, command);
    const captures = {};
    for (const pass of input.mode === "candidates" ? ["candidate", "reproduction"] : ["comparison"]) {
      const passRoot = await safePath(fs, input.artifactDirectory, pass, { directories: true });
      const reportPath = join(root, `${pass}-report.json`);
      const result = await command({ executable: "pnpm", arguments: ["--dir", "apps/web", "run", "test:visual", "--reporter=json", "--retries=0"], cwd: project, environment: { ...environment, PLAYWRIGHT_JSON_OUTPUT_FILE: reportPath } });
      if (!(await pathIdentityMatches(identity))) fail("VISUAL_ROOT_CHANGED");
      await writeExclusive(fs, passRoot, "process.log", `${result.stdout}\n${result.stderr}`);
      const retained = await retainBrowserArtifacts(fs, project, passRoot);
      const report = await boundedRead(fs, root, `${pass}-report.json`);
      await writeExclusive(fs, passRoot, "report.json", report);
      validateAppTransitionVisualReport(JSON.parse(report.toString("utf8")), pass === "candidate");
      if (![0, 1].includes(result.exitCode) || (pass !== "candidate" && result.exitCode !== 0)) fail("VISUAL_COMPARISON_FAILED");
      checks.push({ name: pass, exitCode: result.exitCode, artifacts: retained });
      for (const viewport of Object.keys(viewports)) {
        const matches = retained.filter(({ path }) => path.endsWith(`/${viewport}-captured.png`));
        if (matches.length !== 1) fail("VISUAL_CAPTURE_MISSING");
        const content = await boundedRead(fs, passRoot, matches[0].path);
        validateImage(content, viewport);
        if (captures[viewport] && !Buffer.from(captures[viewport]).equals(content)) fail("VISUAL_REPRODUCTION_FAILED");
        captures[viewport] = content;
        if (pass === "candidate") {
          const path = `${snapshotDirectory}/home-${viewport}-chromium-linux.png`;
          // This target and file are solely owned by this disposable proof.
          await safePath(fs, project, path);
          await fs.writeFile(join(project, path), content);
          files.set(path, content);
        }
      }
    }
    return { images: captures, project: { request: prepared.request, sourceProject: prepared.sourceProject, targetProject: prepared.targetProject, files: expectedFiles, browser, build, rootIdentity: { device: String(identity.device), inode: String(identity.inode), birthtimeNanoseconds: String(identity.birthtimeNanoseconds) } }, influencingFingerprints: prepared.influencingFingerprints, checks };
  } catch (error) {
    if (await pathIdentityMatches(identity)) {
      const failureRoot = await safePath(fs, input.artifactDirectory, "failure", { directories: true });
      const artifacts = await retainBrowserArtifacts(fs, project, failureRoot);
      await writeExclusive(fs, failureRoot, "failure.json", json({ code: /^VISUAL_[A-Z_]+$/.test(error.message) ? error.message : "VISUAL_VERIFICATION_FAILED", checks, artifacts }));
    }
    throw error;
  } finally {
    if (!(await pathIdentityMatches(identity))) fail("VISUAL_ROOT_CHANGED");
    try {
      if (expectedFiles) for (const [path, content] of files) {
        if (!Buffer.from(await boundedRead(fs, project, path)).equals(content)) fail("VISUAL_PROJECT_CHANGED");
      }
    } finally {
      if (!(await cleanupOwnedDirectory(identity))) fail("VISUAL_CLEANUP_REFUSED");
    }
  }
}

const executeCase = executeAppTransitionVisualCase;

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.stdout.write(json(await verifyAppTransitionVisuals(parseAppTransitionVisualArguments(process.argv.slice(2)))));
  } catch (error) {
    process.stderr.write(json({ ok: false, code: /^VISUAL_[A-Z_]+$/.test(error.message) ? error.message : "VISUAL_VERIFICATION_FAILED", ...(error.writtenPaths ? { writtenPaths: error.writtenPaths } : {}) }));
    process.exitCode = 1;
  }
}
