import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { access, copyFile, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";

const templates = new URL("../templates/", import.meta.url);
const revision = "1234567890abcdef1234567890abcdef12345678";

async function configurationFixture(t, artifact = false) {
  const root = await mkdtemp(join(tmpdir(), "deployment-artifact-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const files = [
    ["common/apps/web/src/configuration/application-environment.ts", "src/configuration/application-environment.ts"],
    ["common/application-environments/apps/web/src/configuration/site-origin.ts", "src/configuration/site-origin.ts"],
    ["common/application-environments/apps/web/src/configuration/application-build.ts", "src/configuration/application-build.ts"],
    ...(artifact ? [["common/application-environments/apps/web/scripts/check-prepared-artifact.mjs", "scripts/check-prepared-artifact.mjs"]] : []),
  ];
  await writeFile(join(root, "package.json"), '{"type":"module"}\n');
  for (const [source, destination] of files) {
    assert.equal(await access(new URL(source, templates)).then(() => true, () => false), true, `Missing candidate implementation: ${source}`);
    await mkdir(dirname(join(root, destination)), { recursive: true });
    await copyFile(new URL(source, templates), join(root, destination));
  }
  return root;
}

test("site origin defaults only for development and preserves native URL normalization", async t => {
  const root = await configurationFixture(t);
  const { resolveSiteOrigin } = await import(pathToFileURL(join(root, "src/configuration/site-origin.ts")));
  assert.deepEqual(resolveSiteOrigin({ target: "development", value: undefined }), { ok: true, value: "http://localhost:3000" });
  for (const [value, expected] of [["https://EXAMPLE.test:443/", "https://example.test"], ["https://éxample.test/", "https://xn--xample-9ua.test"], ["https://example.test:8443", "https://example.test:8443"]]) {
    assert.deepEqual(resolveSiteOrigin({ target: "staging", value }), { ok: true, value: expected });
  }
  for (const value of ["http://localhost:3000", "http://127.0.0.1:3000", "http://[::1]:3000"]) {
    assert.equal(resolveSiteOrigin({ target: "development", value }).ok, true);
    assert.equal(resolveSiteOrigin({ target: "staging", value }).ok, false);
  }
});

test("site origin rejects destinations that can redirect identity or disclose private inputs", async t => {
  const root = await configurationFixture(t);
  const { resolveSiteOrigin } = await import(pathToFileURL(join(root, "src/configuration/site-origin.ts")));
  for (const target of ["staging", "production"]) {
    for (const value of [undefined, "", " https://example.test", "https://example.test ", "https://private:sentinel@example.test", "https://example.test/path", "https://example.test?", "https://example.test#", "http://example.test", "javascript:sentinel", "https://example.test\\path", {}, null]) {
      const result = resolveSiteOrigin({ target, value });
      assert.equal(result.ok, false);
      assert.equal(result.issue.field, "NEXT_PUBLIC_SITE_URL");
      assert.equal(JSON.stringify(result).includes("sentinel"), false);
    }
  }
});

test("release build identity requires a matching target and exact source revision", async t => {
  const root = await configurationFixture(t);
  const { resolveApplicationBuild, parseApplicationBuildId } = await import(pathToFileURL(join(root, "src/configuration/application-build.ts")));
  const input = { applicationEnvironment: "staging", siteUrl: "https://stage.example.test/", sourceRevision: revision };
  assert.deepEqual(resolveApplicationBuild(input, "deployment"), { ok: true, value: { target: "staging", siteOrigin: "https://stage.example.test", buildId: `egeria-staging-${revision}` } });
  assert.deepEqual(parseApplicationBuildId(`egeria-production-${revision}`), { ok: true, value: { target: "production", revision } });
  assert.equal(resolveApplicationBuild({ applicationEnvironment: undefined }, "local").ok, true);
  for (const extra of [{ sourceRevision: undefined }, { sourceRevision: revision.toUpperCase() }, { sourceRevision: `${revision}\n` }, { sourceRevision: "short" }, { publicApplicationEnvironment: "production" }, { deploymentId: "override" }, { applicationEnvironment: "development" }]) {
    assert.equal(resolveApplicationBuild({ ...input, ...extra }, "deployment").ok, false);
  }
  for (const value of [`egeria-staging-${revision}\n`, `egeria-staging-${revision.toUpperCase()}`, `egeria-preview-${revision}`, revision, null]) {
    assert.equal(parseApplicationBuildId(value).ok, false);
  }
});

async function preparedFixture(t) {
  const root = await configurationFixture(t, true);
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
