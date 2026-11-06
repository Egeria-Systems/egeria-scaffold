import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFile, mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";

const sourceRoot = fileURLToPath(new URL("../../", import.meta.url));
const admissionLeaf = "packages/builder-core/src/lifecycle/app-transition-visual-admission.cjs";
const compiledPaths = [
  "packages/builder-core/dist/lifecycle/app-profile-transition.js",
  "packages/builder-core/dist/lifecycle/supported-profile-transitions.js",
  "packages/builder-core/dist/ownership/fingerprint.js",
  "packages/builder-core/dist/serialization/canonical-json.js",
];
const currentLockPaths = new Map([
  ["packages/builder-core/lockfiles/web-recipe-app-0.2.6-persistence/pnpm-lock.yaml", "packages/builder-core/lockfiles/web-recipe-app-0.2.7-persistence/pnpm-lock.yaml"],
  ["packages/builder-core/lockfiles/web-recipe-app-0.2.6/pnpm-lock.yaml", "packages/builder-core/lockfiles/web-recipe-app-0.2.7/pnpm-lock.yaml"],
  ["packages/builder-core/lockfiles/web-recipe-portfolio-0.11.6-foundation/pnpm-lock.yaml", "packages/builder-core/lockfiles/web-recipe-portfolio-0.11.7-foundation/pnpm-lock.yaml"],
  ["packages/builder-core/lockfiles/web-recipe-portfolio-0.11.6/pnpm-lock.yaml", "packages/builder-core/lockfiles/web-recipe-portfolio-0.11.7/pnpm-lock.yaml"],
  ["packages/builder-core/lockfiles/web-recipe-site-0.12.6/pnpm-lock.yaml", "packages/builder-core/lockfiles/web-recipe-site-0.12.7/pnpm-lock.yaml"],
]);
const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");
const subsetKey = subset => [...subset].sort().join("+") || "none";

// This disposable fixture supplies unit sentinels, never actual source admission.
// Production function bodies are copied unchanged. Only the copied policy's
// record data changes, including explicit labels for its historical anchors.
export async function createSyntheticAppTransitionAdmission(context) {
  const root = await mkdtemp(join(tmpdir(), "egeria-synthetic-visual-admission-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  const sourceRequire = createRequire(join(sourceRoot, "packages/builder-core/package.json"));
  const historicalPolicy = sourceRequire("./src/lifecycle/app-transition-visual-admission.cjs");
  const sourceProducer = await import(pathToFileURL(join(sourceRoot, "scripts/verify-app-transition-visuals.mjs")));
  const { fingerprintJsonValue } = await import(pathToFileURL(join(sourceRoot, "packages/builder-core/dist/ownership/fingerprint.js")));
  const preparedProjects = new Map();
  for (let bits = 0; bits < 8; bits += 1) {
    const subset = ["analytics", "booking-calendly", "multilingual"].filter((_, index) => bits & (1 << index));
    const prepared = await sourceProducer.prepareProject(sourceRoot, subset, "0.2.7");
    assert.equal(prepared.sourceProject.recipeVersion, "0.11.7");
    assert.equal(prepared.targetProject.recipeVersion, "0.2.7");
    preparedProjects.set(subsetKey(subset), prepared);
  }
  const sourcePaths = historicalPolicy.record.originalSourceFiles
    .map(({ path }) => currentLockPaths.get(path) ?? path).sort();
  assert.equal(sourcePaths.length, 299);
  assert.equal(new Set(sourcePaths).size, sourcePaths.length);
  const pngPaths = [];
  const images = { monolingual: {}, multilingual: {} };
  const baselines = [];
  for (const group of ["monolingual", "multilingual"]) for (const viewport of ["desktop", "mobile"]) {
    const path = `packages/builder-core/templates/portfolio/apps/web/tests/visual/home-visual.spec.ts-snapshots/app-transition-${group === "multilingual" ? "multilingual-" : ""}home-${viewport}-chromium-linux.png`;
    const bytes = await readFile(join(sourceRoot, path));
    pngPaths.push(path);
    images[group][viewport] = bytes;
    baselines.push({ identifier: `${group}-${viewport}`, fingerprint: `sha256:${sha256(bytes)}` });
  }
  const copiedPaths = [...sourcePaths, ...pngPaths, ...compiledPaths];
  for (const path of copiedPaths) {
    await mkdir(dirname(join(root, path)), { recursive: true });
    await copyFile(join(sourceRoot, path), join(root, path));
    assert.deepEqual(await readFile(join(root, path)), await readFile(join(sourceRoot, path)), path);
  }
  const originalSourceFiles = await Promise.all(sourcePaths.map(async path => ({ path, sha256: sha256(await readFile(join(root, path))) })));
  const targetLockfileFingerprint = `sha256:${sha256(await readFile(join(root, "packages/builder-core/lockfiles/web-recipe-app-0.2.7/pnpm-lock.yaml")))}`;
  for (const prepared of preparedProjects.values()) {
    const locks = prepared.files.filter(({ path }) => path === "pnpm-lock.yaml");
    assert.equal(locks.length, 1);
    assert.equal(`sha256:${sha256(locks[0].content)}`, targetLockfileFingerprint);
  }
  const record = {
    ...structuredClone(historicalPolicy.record),
    syntheticUnitFixture: true,
    anchorMeaning: "manifestSha256 and sourceRevision are historical unit sentinels; no current or human admission",
    sourceProfile: { name: "portfolio", version: "0.11.7" },
    targetProfile: { name: "app", version: "0.2.7" },
    targetLockfileFingerprint,
    originalSourceFiles,
    bridgeSourceFiles: Object.fromEntries(Object.keys(historicalPolicy.record.bridgeSourceFiles)
      .map(path => [path, originalSourceFiles.find(file => file.path === path).sha256])),
    subsets: Object.fromEntries([...preparedProjects].map(([key, prepared]) => [key, fingerprintJsonValue(prepared.influencingFingerprints)])),
    baselines: Object.fromEntries(["monolingual", "multilingual"].map(group => [group,
      ["desktop", "mobile"].map(viewport => baselines.find(asset => asset.identifier === `${group}-${viewport}`).fingerprint)])),
  };
  const originalLeaf = await readFile(join(sourceRoot, admissionLeaf), "utf8");
  const startMarker = "const record = freeze(";
  const endMarker = ");\n\nfunction verifyAppTransitionVisualInputIdentity";
  assert.equal(originalLeaf.split(startMarker).length, 2);
  assert.equal(originalLeaf.split(endMarker).length, 2);
  const start = originalLeaf.indexOf(startMarker) + startMarker.length;
  const end = originalLeaf.indexOf(endMarker, start);
  const syntheticLeaf = originalLeaf.slice(0, start) + JSON.stringify(record, null, 2) + originalLeaf.slice(end);
  await writeFile(join(root, admissionLeaf), syntheticLeaf, { flag: "wx", mode: 0o600 });
  copiedPaths.push(admissionLeaf);
  const yamlPackage = sourceRequire.resolve("yaml/package.json");
  assert.equal(JSON.parse(await readFile(yamlPackage, "utf8")).version, "2.9.1");
  await mkdir(join(root, "packages/builder-core/node_modules"), { recursive: true });
  await symlink(await realpath(dirname(yamlPackage)), join(root, "packages/builder-core/node_modules/yaml"), "dir");
  await promisify(execFile)("git", ["init", "--quiet"], { cwd: root, timeout: 10_000 });
  const module = await import(pathToFileURL(join(root, "scripts/verify-app-transition-visuals.mjs")));
  const fixedRequire = createRequire(join(root, "packages/builder-core/package.json"));
  assert.equal(Object.hasOwn(fixedRequire.cache, fixedRequire.resolve("./src/lifecycle/app-transition-visual-admission.cjs")), false);
  return {
    root, module, fixedRequire, preparedProjects, pngPaths, images, copiedPaths,
    verifierUrl: pathToFileURL(join(root, compiledPaths[0])),
    admissionObservations: { policySha256: sha256(Buffer.from(syntheticLeaf)), sourceFiles: originalSourceFiles.map(file => ({ ...file })),
      targetLockfileFingerprint, baselines },
  };
}
