import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { access, copyFile, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";

const templates = new URL("../templates/", import.meta.url);
const revision = "1234567890abcdef1234567890abcdef12345678";

async function configurationFixture(t, artifact = false, jobs = false) {
  const temporary = await mkdtemp(join(tmpdir(), "deployment-artifact-"));
  t.after(() => rm(temporary, { recursive: true, force: true }));
  const root = jobs ? join(temporary, "apps/web") : temporary;
  await mkdir(root, { recursive: true });
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

async function preparedFixture(t, jobs = false) {
  const root = await configurationFixture(t, true, jobs);
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

test("prepared recording refuses selected environment artifact overrides", async t => {
  for (const override of [{ main: ".next/alternate-worker.js" }, { assets: { directory: ".next/alternate-assets" } }, { rules: [{ type: "Text", globs: ["outside.txt"] }] }]) {
    const root = await preparedFixture(t);
    const config = JSON.parse(await readFile(join(root, "wrangler.jsonc"), "utf8"));
    config.env = { staging: { assets: config.assets, ...override } };
    await writeFile(join(root, "wrangler.jsonc"), JSON.stringify(config));
    const result = check(root, "record");
    assert.notEqual(result.status, 0, JSON.stringify(override));
    assert.match(result.stderr, /PREPARED_ARTIFACT_WORKER_UNSUPPORTED/u);
    await assert.rejects(access(join(root, ".open-next/prepared-artifact.json")), { code: "ENOENT" });
  }
  const root = await preparedFixture(t);
  const config = JSON.parse(await readFile(join(root, "wrangler.jsonc"), "utf8"));
  config.env = { staging: { assets: config.assets }, production: { main: "unselected-worker.js" } };
  await writeFile(join(root, "wrangler.jsonc"), JSON.stringify(config));
  assert.equal(check(root, "record").status, 0);
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


test("generated deployment protection checks refuse unsafe native release configurations", () => {
  const result = spawnSync(process.execPath, ["--test", new URL("common/application-environments/apps/web/tests/scripts/deployment-protection.test.mjs", templates).pathname], { encoding: "utf8", timeout: 30000, env: { PATH: process.env.PATH, CI: "true", pnpm_config_verify_deps_before_run: "error" } });
  assert.equal(result.status, 0, result.stdout + result.stderr);
});


test("protected API transport confines credentials and rejects unsafe redirects before another request", async () => {
  const { createApplicationTransport, readTransportSettings } = await import(new URL("common/application-environments/apps/web/tests/e2e/application-transport.ts", templates));
  const environment = { APPLICATION_ENVIRONMENT: "staging", DEPLOY_URL: "https://stage.example.test", NEXT_PUBLIC_SITE_URL: "https://stage.example.test", CF_ACCESS_CLIENT_ID: "synthetic-id", CF_ACCESS_CLIENT_SECRET: "synthetic-secret" };
  for (const change of [{ APPLICATION_ENVIRONMENT: "production" }, { CF_ACCESS_CLIENT_SECRET: undefined }, { DEBUG: "pw:api" }, { NODE_OPTIONS: "--inspect" }, { DEPLOY_URL: "https://other.example.test" }]) {
    assert.throws(() => readTransportSettings(environment.DEPLOY_URL, { ...environment, ...change }), /^Error: APPLICATION_TRANSPORT_/);
  }
  for (const location of ["https://external.example.test/", "//external.example.test/", "http://stage.example.test/", "https://stage.example.test:444/", "https://private:secret@stage.example.test/", "/loop"]) {
    const requests = [];
    const transport = await createApplicationTransport(environment.DEPLOY_URL, environment, { newContext: async () => ({
      get: async (url, options) => { requests.push({ url, options }); return { status: () => 302, headers: () => ({ location }), dispose: async () => {} }; }, dispose: async () => {},
    }) });
    await assert.rejects(transport.getApplicationResponse("/loop"), /^Error: APPLICATION_TRANSPORT_/);
    assert.equal(requests.length, 1, location);
    assert.equal(requests[0].options.maxRedirects, 0);
    assert.equal(requests[0].options.maxRetries, 0);
    assert.equal(requests[0].options.headers["CF-Access-Client-Secret"], "synthetic-secret");
    await assert.rejects(transport.getApplicationResponse("https://external.example.test/"));
    assert.equal(requests.length, 1);
    await transport.dispose();
  }
  const requests = [];
  const transport = await createApplicationTransport(environment.DEPLOY_URL, environment, { newContext: async () => ({
    get: async url => { requests.push(url); return { status: () => url.endsWith("/start") ? 307 : 200, headers: () => url.endsWith("/start") ? { location: "/fr-CA", vary: "Accept-Language" } : {}, text: async () => "synthetic page", dispose: async () => {} }; }, dispose: async () => {},
  }) });
  const manual = await transport.getApplicationResponse("/start", { redirect: "manual" });
  assert.equal(manual.status(), 307);
  assert.equal(manual.headers().location, "/fr-CA");
  assert.equal(requests.length, 1);
  assert.equal((await transport.getApplicationResponse("/start")).url(), "https://stage.example.test/fr-CA");
  assert.equal(requests.length, 3);
  await transport.dispose();
});

test("browser transport refuses redirects in every mode without continuing a browser request", async () => {
  const { createApplicationTransport } = await import(new URL("common/application-environments/apps/web/tests/e2e/application-transport.ts", templates));
  for (const target of ["development", "staging", "production"]) {
    const origin = target === "development" ? "http://localhost:3000" : "https://application.example.test";
    const environment = { APPLICATION_ENVIRONMENT: target, ...(target === "development" ? {} : { DEPLOY_URL: origin, NEXT_PUBLIC_SITE_URL: origin }),
      ...(target === "staging" ? { CF_ACCESS_CLIENT_ID: "synthetic-id", CF_ACCESS_CLIENT_SECRET: "synthetic-secret" } : {}) };
    const transport = await createApplicationTransport(origin, environment, { newContext: async () => ({ dispose: async () => {} }) });
    let handler;
    await transport.installBrowserProtection({ routeWebSocket: async () => {}, route: async (_pattern, value) => { handler = value; } });
    const calls = [];
    await handler({ request: () => ({ url: () => origin + "/redirect", headers: () => ({}) }),
      continue: async () => { calls.push("continue"); },
      fetch: async options => { calls.push("fetch"); assert.equal(options.maxRedirects, 0); assert.equal(options.maxRetries, 0);
        assert.equal(options.headers["CF-Access-Client-Secret"], environment.CF_ACCESS_CLIENT_SECRET);
        return { status: () => 307, dispose: async () => { calls.push("dispose"); } }; },
      fulfill: async () => { calls.push("fulfill"); }, abort: async () => { calls.push("abort"); },
    });
    assert.deepEqual(calls, ["fetch", "abort", "dispose"], target);
    assert.throws(() => transport.assertBrowserRequests(), /APPLICATION_TRANSPORT_BROWSER_REQUEST_BLOCKED/u);
    await transport.dispose();
  }
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
  await writeFile(join(root, "wrangler.jsonc"), JSON.stringify({ main: "worker.mjs", assets: { directory: ".open-next/assets" }, rules: [{ type: "Text", globs: ["**/.open-next/assets/BUILD_ID"], fallthrough: false }] }));
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
