import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { access, copyFile, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";

const revision = "1234567890abcdef1234567890abcdef12345678";
async function configurationFixture(t, jobs = false) {
  const temporary = await mkdtemp(join(tmpdir(), "prepared-artifact-contract-"));
  t.after(() => rm(temporary, { recursive: true, force: true }));
  const root = jobs ? join(temporary, "apps/web") : temporary;
  await mkdir(root, { recursive: true });
  await writeFile(join(root, "package.json"), '{"type":"module"}\n');
  for (const path of ["src/configuration/application-environment.ts", "src/configuration/site-origin.ts", "src/configuration/application-build.ts", "scripts/check-prepared-artifact.mjs"]) {
    await mkdir(dirname(join(root, path)), { recursive: true });
    await copyFile(new URL(`../../${path}`, import.meta.url), join(root, path));
  }
  return root;
}

async function preparedFixture(t, jobs = false) {
  const root = await configurationFixture(t, jobs);
  for (const directory of [".next", ".open-next/assets", ".open-next/server-functions/default"]) await mkdir(join(root, directory), { recursive: true });
  await writeFile(join(root, ".next/BUILD_ID"), `egeria-staging-${revision}`);
  await writeFile(join(root, ".next/required-server-files.json"), JSON.stringify({ config: { output: "standalone", env: { NEXT_PUBLIC_APPLICATION_ENVIRONMENT: "staging" } } }));
  await writeFile(join(root, ".open-next/assets/BUILD_ID"), `egeria-staging-${revision}`);
  await writeFile(join(root, ".open-next/worker.js"), "export default { fetch() {} };\n");
  await writeFile(join(root, ".open-next/server-functions/default/handler.mjs"), "export const handler = 1;\n");
  await writeFile(join(root, "wrangler.jsonc"), JSON.stringify({ main: ".open-next/worker.js", assets: { directory: ".open-next/assets" } }));
  return root;
}

function check(root, mode = "verify", target = "staging", sourceRevision = revision, local = true) {
  return spawnSync(process.execPath, ["--experimental-strip-types", "scripts/check-prepared-artifact.mjs", mode, target, sourceRevision, ...(local ? ["--local"] : [])], {
    cwd: root, encoding: "utf8", timeout: 10000,
    env: { PATH: process.env.PATH, CI: "true", WRANGLER_SEND_METRICS: "false", pnpm_config_verify_deps_before_run: "error", NODE_NO_WARNINGS: "1" },
  });
}

test("prepared artifact records actual output once and verifies without changing its receipt", async t => {
  const root = await preparedFixture(t);
  const record = check(root, "record");
  assert.equal(record.status, 0, record.stderr);
  const receiptPath = join(root, ".open-next/prepared-artifact.json");
  const before = await readFile(receiptPath, "utf8");
  const receipt = JSON.parse(before);
  assert.equal(receipt.target, "staging");
  assert.equal(receipt.revision, revision);
  assert.ok(receipt.files.some(file => file.path === ".open-next/worker.js"));
  assert.equal(check(root).status, 0);
  assert.equal(await readFile(receiptPath, "utf8"), before);
  assert.notEqual(check(root, "record").status, 0);
  assert.equal(await readFile(receiptPath, "utf8"), before);
});

test("prepared artifact refuses retargeting and altered, added or missing deployment bytes", async t => {
  for (const alteration of ["worker", "asset", "missing", "config", "copied-id"]) {
    const root = await preparedFixture(t);
    assert.equal(check(root, "record").status, 0);
    if (alteration === "worker") await writeFile(join(root, ".open-next/worker.js"), "changed");
    if (alteration === "asset") await writeFile(join(root, ".open-next/assets/extra.js"), "changed");
    if (alteration === "missing") await rm(join(root, ".open-next/server-functions/default/handler.mjs"));
    if (alteration === "config") await writeFile(join(root, "wrangler.jsonc"), '{"main":"different.js"}');
    if (alteration === "copied-id") await writeFile(join(root, ".open-next/assets/BUILD_ID"), `egeria-production-${revision}`);
    assert.notEqual(check(root).status, 0, alteration);
  }
  const root = await preparedFixture(t);
  assert.equal(check(root, "record").status, 0);
  assert.notEqual(check(root, "verify", "production").status, 0);
  assert.notEqual(check(root, "verify", "staging", "a".repeat(40)).status, 0);
});

test("prepared recording rejects inconsistent metadata, output symlinks and unprepared wrapper entrypoints", async t => {
  for (const alteration of ["target", "revision", "symlink", "wrapper", "deployment-id"]) {
    const root = await preparedFixture(t);
    if (alteration === "target") await writeFile(join(root, ".next/required-server-files.json"), JSON.stringify({ config: { output: "standalone", env: { NEXT_PUBLIC_APPLICATION_ENVIRONMENT: "production" } } }));
    if (alteration === "revision") await writeFile(join(root, ".open-next/assets/BUILD_ID"), `egeria-staging-${"b".repeat(40)}`);
    if (alteration === "symlink") await symlink(join(root, "package.json"), join(root, ".open-next/assets/escape.json"));
    if (alteration === "wrapper") await writeFile(join(root, "wrangler.jsonc"), JSON.stringify({ main: "worker.mjs", assets: { directory: ".open-next/assets" } }));
    if (alteration === "deployment-id") await writeFile(join(root, ".next/required-server-files.json"), JSON.stringify({ config: { deploymentId: "different", output: "standalone", env: { NEXT_PUBLIC_APPLICATION_ENVIRONMENT: "staging" } } }));
    const result = check(root, "record");
    assert.notEqual(result.status, 0, alteration);
    assert.equal(await access(join(root, ".open-next/prepared-artifact.json")).then(() => true, () => false), false);
  }
});

test("release verification refuses absent GitHub source authority and malformed arguments", async t => {
  const root = await preparedFixture(t);
  const release = check(root, "record", "staging", revision, false);
  assert.notEqual(release.status, 0);
  assert.equal(release.stderr.includes("PREPARED_ARTIFACT_SOURCE_INVALID"), true, release.stderr);
  assert.notEqual(check(root, "unexpected").status, 0);
  assert.notEqual(check(root, "record", "preview").status, 0);
});

test("prepared recording bounds metadata and total output entries, including empty directories", async t => {
  const largeMetadataRoot = await preparedFixture(t);
  await writeFile(join(largeMetadataRoot, ".next/required-server-files.json"), " ".repeat(1024 * 1024 + 1));
  const largeMetadata = check(largeMetadataRoot, "record");
  assert.notEqual(largeMetadata.status, 0);
  assert.equal(largeMetadata.stderr.includes("PREPARED_ARTIFACT_METADATA_INVALID"), true);

  const manyEntriesRoot = await preparedFixture(t);
  for (let parent = 0; parent < 65; parent += 1) {
    for (let child = 0; child < 65; child += 1) {
      await mkdir(join(manyEntriesRoot, ".open-next/assets", String(parent), String(child)), { recursive: true });
    }
  }
  const manyEntries = check(manyEntriesRoot, "record");
  assert.notEqual(manyEntries.status, 0);
  assert.equal(manyEntries.stderr.includes("PREPARED_ARTIFACT_SIZE_INVALID"), true);
  assert.equal(await access(join(manyEntriesRoot, ".open-next/prepared-artifact.json")).then(() => true, () => false), false);
});


async function preparedJobsFixture(t) {
  const root = await preparedFixture(t, true);
  for (const path of ["src/composition", "src/application", ".open-next/jobs-bundle", "../../node_modules/.pnpm/synthetic/node_modules/synthetic"]) await mkdir(join(root, path), { recursive: true });
  const sources = {
    "worker.mjs": "import './src/composition/server-jobs.ts';\n",
    "src/composition/server-jobs.ts": "import '../application/job-handlers.ts';\n",
    "src/application/job-handlers.ts": "export const handlers = [];\n",
    "../../node_modules/.pnpm/synthetic/node_modules/synthetic/index.js": "export const dependency = 1;\n",
  };
  for (const [path, value] of Object.entries(sources)) await writeFile(join(root, path), value);
  for (const [path, value] of [["tsconfig.json", "{}"], ["../../package.json", '{"private":true}'], ["../../pnpm-lock.yaml", "lockfileVersion: 9"], ["../../pnpm-workspace.yaml", "packages: [apps/web]"]]) await writeFile(join(root, path), value);
  await writeFile(join(root, ".open-next/jobs-bundle/worker.js"), "export default {};\n");
  await writeFile(join(root, ".open-next/jobs-bundle/build-id.txt"), `egeria-staging-${revision}`);
  await writeFile(join(root, ".open-next/jobs-inputs.json"), JSON.stringify({ inputs: Object.fromEntries(Object.keys(sources).map(path => [path, { bytes: 1, imports: [] }])), outputs: { ".open-next/jobs-bundle/worker.js": { entryPoint: "worker.mjs" } } }));
  await writeFile(join(root, "wrangler.jsonc"), JSON.stringify({ main: "worker.mjs", assets: { directory: ".open-next/assets" }, rules: [{ type: "Text", globs: [".open-next/assets/BUILD_ID"], fallthrough: false }] }));
  return root;
}

test("prepared jobs receipt binds native metadata inputs and separately emitted modules", async t => {
  for (const changed of ["src/application/job-handlers.ts", "worker.mjs", "../../node_modules/.pnpm/synthetic/node_modules/synthetic/index.js", ".open-next/jobs-bundle/build-id.txt"]) {
    const root = await preparedJobsFixture(t);
    const record = check(root, "record");
    assert.equal(record.status, 0, record.stderr);
    const receipt = JSON.parse(await readFile(join(root, ".open-next/prepared-artifact.json"), "utf8"));
    assert.ok(receipt.files.some(value => value.path === changed));
    assert.equal(check(root).status, 0);
    await writeFile(join(root, changed), "changed");
    assert.notEqual(check(root).status, 0);
  }
});

test("native bundle input discovery fails closed on escape, symlinks, virtual or missing inputs", async t => {
  for (const input of ["../../../outside.js", "src/missing.ts", "virtual:unknown", ".env.local", "src/linked/secret.ts"]) {
    const root = await preparedJobsFixture(t);
    const metadata = JSON.parse(await readFile(join(root, ".open-next/jobs-inputs.json"), "utf8"));
    metadata.inputs[input] = { bytes: 1, imports: [] };
    await writeFile(join(root, ".open-next/jobs-inputs.json"), JSON.stringify(metadata));
    if (input.includes("linked")) await symlink(join(root, "src/application"), join(root, "src/linked"));
    assert.notEqual(check(root, "record").status, 0, input);
    assert.equal(await access(join(root, ".open-next/prepared-artifact.json")).then(() => true, () => false), false);
  }
});
