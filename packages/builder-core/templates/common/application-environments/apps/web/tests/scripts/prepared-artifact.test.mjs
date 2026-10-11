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

function virtualBuiltinInput(specifier = "async_hooks") {
  return { bytes: 66, imports: [{ path: specifier, kind: "import-statement", external: true }], format: "cjs" };
}

test("prepared jobs receipts accept native virtual builtins without requiring physical files", async t => {
  for (const specifier of ["async_hooks", "node:fs/promises"]) {
    const root = await preparedJobsFixture(t);
    const metadataPath = join(root, ".open-next/jobs-inputs.json");
    const metadata = JSON.parse(await readFile(metadataPath, "utf8"));
    metadata.inputs[`node-built-in-modules:${specifier}`] = virtualBuiltinInput(specifier);
    await writeFile(metadataPath, JSON.stringify(metadata));
    const record = check(root, "record");
    assert.equal(record.status, 0, `${specifier}: ${record.stderr}`);
    const receipt = JSON.parse(await readFile(join(root, ".open-next/prepared-artifact.json"), "utf8"));
    assert.ok(receipt.files.some(file => file.path === ".open-next/jobs-inputs.json"));
    assert.equal(check(root).status, 0);
  }
});

test("prepared jobs receipts reject changes to otherwise valid virtual builtin metadata", async t => {
  const root = await preparedJobsFixture(t);
  const metadataPath = join(root, ".open-next/jobs-inputs.json");
  const metadata = JSON.parse(await readFile(metadataPath, "utf8"));
  metadata.inputs["node-built-in-modules:async_hooks"] = virtualBuiltinInput();
  await writeFile(metadataPath, JSON.stringify(metadata));
  const record = check(root, "record");
  assert.equal(record.status, 0, record.stderr);
  const receiptPath = join(root, ".open-next/prepared-artifact.json");
  const receipt = await readFile(receiptPath, "utf8");
  metadata.inputs["node-built-in-modules:async_hooks"].bytes = 67;
  await writeFile(metadataPath, JSON.stringify(metadata));
  const verify = check(root);
  assert.equal(verify.status, 1);
  assert.ok(verify.stderr.includes("PREPARED_ARTIFACT_CHANGED"), verify.stderr);
  assert.equal(await readFile(receiptPath, "utf8"), receipt);
});

test("native bundle virtual inputs require a real builtin and matching producer metadata", async t => {
  const valid = virtualBuiltinInput();
  for (const [input, value] of [
    ["node-built-in-modules:not-a-node-builtin", virtualBuiltinInput("not-a-node-builtin")],
    ["unknown:async_hooks", valid],
    ["node-built-in-modules:", virtualBuiltinInput("")],
    ...[null, [], "invalid", {},
      { ...valid, bytes: -1 }, { ...valid, bytes: 1.5 },
      { ...valid, bytes: Number.MAX_SAFE_INTEGER + 1 }, { ...valid, bytes: "66" },
      { ...valid, format: "esm" },
      { ...valid, imports: null }, { ...valid, imports: {} }, { ...valid, imports: [] },
      { ...valid, imports: [null] }, { ...valid, imports: [...valid.imports, ...valid.imports] },
      { ...valid, imports: [{ ...valid.imports[0], path: "fs" }] },
      { ...valid, imports: [{ ...valid.imports[0], kind: "require-call" }] },
      { ...valid, imports: [{ ...valid.imports[0], external: false }] },
    ].map(value => ["node-built-in-modules:async_hooks", value]),
  ]) {
    const root = await preparedJobsFixture(t);
    const metadataPath = join(root, ".open-next/jobs-inputs.json");
    const metadata = JSON.parse(await readFile(metadataPath, "utf8"));
    metadata.inputs[input] = value;
    await writeFile(metadataPath, JSON.stringify(metadata));
    const record = check(root, "record");
    assert.equal(record.status, 1, `${input}: ${JSON.stringify(value)}`);
    assert.ok(record.stderr.includes("PREPARED_ARTIFACT_BUNDLE_INVALID"), record.stderr);
    assert.equal(await access(join(root, ".open-next/prepared-artifact.json")).then(() => true, () => false), false);
  }
});

test("native bundle input discovery fails closed on escape, symlinks, unknown virtual or missing inputs", async t => {
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

const tracedServerRoot = ".open-next/server-functions/default";
const tracedPackages = `${tracedServerRoot}/node_modules/.pnpm`;
const tracedAliases = [
  { path: `${tracedServerRoot}/apps/web/node_modules/next`, target: "../../../node_modules/.pnpm/next@1.0.0/node_modules/next" },
  { path: `${tracedPackages}/next@1.0.0/node_modules/peer`, target: "../../peer@1.0.0/node_modules/peer" },
  { path: `${tracedPackages}/node_modules/next`, target: "../next@1.0.0/node_modules/next" },
];

async function preparedLinkedFixture(t, jobs = false) {
  const root = await (jobs ? preparedJobsFixture(t) : preparedFixture(t));
  for (const path of [`${tracedPackages}/next@1.0.0/node_modules/next/index.js`, `${tracedPackages}/peer@1.0.0/node_modules/peer/index.js`]) {
    await mkdir(dirname(join(root, path)), { recursive: true });
    await writeFile(join(root, path), "export const dependency = 1;\n");
  }
  for (const { path, target } of tracedAliases) {
    await mkdir(dirname(join(root, path)), { recursive: true });
    await symlink(target, join(root, path));
  }
  return root;
}

test("prepared receipts preserve traced directory aliases and canonical content in plain and jobs artifacts", async t => {
  for (const jobs of [false, true]) {
    const root = await preparedLinkedFixture(t, jobs);
    if (jobs) {
      const path = join(root, ".open-next/jobs-inputs.json");
      const metadata = JSON.parse(await readFile(path, "utf8"));
      metadata.inputs["node-built-in-modules:async_hooks"] = virtualBuiltinInput();
      await writeFile(path, JSON.stringify(metadata));
    }
    const record = check(root, "record");
    assert.equal(record.status, 0, record.stderr);
    const receiptPath = join(root, ".open-next/prepared-artifact.json");
    const bytes = await readFile(receiptPath, "utf8");
    const receipt = JSON.parse(bytes);
    assert.deepEqual(receipt.symlinks, tracedAliases);
    assert.equal(receipt.files.filter(file => file.path === `${tracedPackages}/next@1.0.0/node_modules/next/index.js`).length, 1);
    assert.equal(receipt.files.some(file => file.path.includes("/node_modules/next/index.js") && file.path.startsWith(`${tracedServerRoot}/apps/`)), false);
    assert.equal(check(root).status, 0);
    assert.equal(await readFile(receiptPath, "utf8"), bytes);
    assert.notEqual(check(root, "record").status, 0);
    assert.equal(await readFile(receiptPath, "utf8"), bytes);
  }
});

test("prepared receipts detect traced content and alias topology changes even between equal-content targets", async t => {
  for (const change of ["content", "retarget", "add", "remove", "directory", "file", "receipt", "legacy"]) {
    const root = await preparedLinkedFixture(t);
    const record = check(root, "record");
    assert.equal(record.status, 0, record.stderr);
    const receiptPath = join(root, ".open-next/prepared-artifact.json");
    const aliasPath = join(root, tracedAliases[2].path);
    if (change === "content") await writeFile(join(root, `${tracedPackages}/next@1.0.0/node_modules/next/index.js`), "changed");
    if (change === "retarget") { await rm(aliasPath); await symlink("../peer@1.0.0/node_modules/peer", aliasPath); }
    if (change === "add") await symlink("../next@1.0.0/node_modules/next", join(root, `${tracedPackages}/node_modules/extra`));
    if (["remove", "directory", "file"].includes(change)) await rm(aliasPath);
    if (change === "directory") await mkdir(aliasPath);
    if (change === "file") await writeFile(aliasPath, "ordinary file");
    if (change === "receipt" || change === "legacy") {
      const receipt = JSON.parse(await readFile(receiptPath, "utf8"));
      if (change === "receipt") receipt.symlinks.pop();
      else { receipt.schemaVersion = 1; delete receipt.symlinks; }
      await writeFile(receiptPath, `${JSON.stringify(receipt)}\n`);
    }
    const beforeVerify = await readFile(receiptPath, "utf8");
    const verify = check(root);
    assert.equal(verify.status, 1, change);
    assert.ok(verify.stderr.includes("PREPARED_ARTIFACT_CHANGED"), `${change}: ${verify.stderr}`);
    assert.equal(await readFile(receiptPath, "utf8"), beforeVerify);
  }
});

test("traced aliases refuse escapes, intermediate links, missing or file targets and directory cycles", async t => {
  for (const change of ["absolute-internal", "absolute-external", "outside-artifact", "outside-project", "other-function", "missing", "file-target", "link-target", "link-parent", "alias-parent-traversal", "link-loop", "ancestor", "mutual-directories", "assets", "jobs-bundle", "other-location", "backslash", "colon"]) {
    const root = await preparedLinkedFixture(t);
    const aliasPath = join(root, tracedAliases[2].path);
    await rm(aliasPath);
    let target = "../next@1.0.0/node_modules/next";
    if (change === "absolute-internal") target = join(root, tracedPackages, "next@1.0.0/node_modules/next");
    if (change === "absolute-external") target = dirname(root);
    if (change === "outside-artifact") { target = "../../../../../../outside"; await mkdir(join(root, "outside")); }
    if (change === "outside-project") target = "../../../../../../../../outside";
    if (change === "other-function") { target = "../../../../other"; await mkdir(join(root, ".open-next/server-functions/other")); }
    if (change === "missing") target = "../missing/node_modules/package";
    if (change === "file-target") target += "/index.js";
    if (["link-target", "alias-parent-traversal", "link-loop"].includes(change)) {
      await symlink(change === "link-loop" ? "next" : target, join(root, tracedPackages, "node_modules/alias"));
      target = change === "alias-parent-traversal" ? "alias/../next" : "alias";
    }
    if (change === "link-parent") {
      await symlink("next@1.0.0", join(root, tracedPackages, "package-alias"));
      target = "../package-alias/node_modules/next";
    }
    if (change === "ancestor") target = "..";
    if (change === "mutual-directories") {
      for (const [name, peer] of [["cycle-a", "cycle-b"], ["cycle-b", "cycle-a"]]) {
        await mkdir(join(root, tracedServerRoot, "node_modules", name));
        await symlink(`../${peer}`, join(root, tracedServerRoot, "node_modules", name, "peer"));
      }
    }
    if (["assets", "jobs-bundle", "other-location"].includes(change)) {
      const parent = change === "other-location" ? ".open-next/server-functions/other/node_modules" : `.open-next/${change}`;
      await mkdir(join(root, parent, "physical"), { recursive: true });
      await symlink("physical", join(root, parent, "alias"));
    }
    if (change === "backslash") target = "..\\next";
    if (change === "colon") target = "node:next";
    await symlink(target, aliasPath);
    const record = check(root, "record");
    assert.equal(record.status, 1, change);
    assert.ok(record.stderr.includes("PREPARED_ARTIFACT_PATH_INVALID"), `${change}: ${record.stderr}`);
    assert.equal(await access(join(root, ".open-next/prepared-artifact.json")).then(() => true, () => false), false);
  }
});

test("traced aliases count toward the artifact entry limit", async t => {
  const root = await preparedLinkedFixture(t);
  for (let index = 0; index < 4100; index += 1) {
    await symlink("../next@1.0.0/node_modules/next", join(root, tracedPackages, "node_modules", `alias-${index}`));
  }
  const record = check(root, "record");
  assert.equal(record.status, 1);
  assert.ok(record.stderr.includes("PREPARED_ARTIFACT_SIZE_INVALID"), record.stderr);
  assert.equal(await access(join(root, ".open-next/prepared-artifact.json")).then(() => true, () => false), false);
});
