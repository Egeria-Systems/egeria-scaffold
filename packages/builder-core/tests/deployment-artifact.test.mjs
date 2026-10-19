import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { access, copyFile, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { createServer } from "node:http";
import { createConnection } from "node:net";
import { EventEmitter } from "node:events";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";

const templates = new URL("../templates/", import.meta.url);
const revision = "1234567890abcdef1234567890abcdef12345678";

async function developmentResponseServer(t, handler) {
  const { BrowserDevelopmentResponse: Response } = await import(new URL("common/application-environments/apps/web/scripts/browser-development-server.ts", templates));
  const server = createServer({ ServerResponse: Response }, handler);
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  return headers => new Promise((resolve, reject) => {
    const socket = createConnection({ host: "127.0.0.1", port: server.address().port });
    const chunks = [];
    socket.setTimeout(2000, () => { socket.destroy(); reject(new Error("Response did not settle")); });
    socket.on("data", chunk => chunks.push(chunk));
    socket.on("error", error => { if (error.code !== "ECONNRESET") reject(error); });
    socket.on("close", () => resolve(Buffer.concat(chunks).toString("utf8")));
    socket.on("connect", () => socket.end(`GET / HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n${headers}\r\n`));
  });
}

test("development response barrier refuses browser redirects before any wire output", async t => {
  for (const status of [301, 302, 303, 307, 308]) {
    for (const writer of ["writeHead", "writeHeader", "write", "end", "flushHeaders"]) {
      await t.test(`${status} via ${writer}`, async t => {
        const request = await developmentResponseServer(t, (incoming, response) => {
          delete incoming.headers["sec-fetch-dest"];
          delete incoming.headers["sec-fetch-mode"];
          response.setHeader("Location", "http://127.0.0.1:1/forbidden");
          if (writer === "writeHead" || writer === "writeHeader") response[writer](status);
          else { response.statusCode = status; if (writer === "write") response.write("body"); else response[writer](); }
          response.end();
        });
        for (const headers of ["Sec-Fetch-Dest: document\r\n", "Sec-Fetch-Mode: \r\n"]) {
          assert.equal(await request(headers), "", "A browser redirect must never reach the wire");
        }
        assert.match(await request(""), new RegExp(`^HTTP/1.1 ${status} `), "Metadata-free API redirects remain available");
      });
    }
  }
});

test("development response barrier normalizes status once and preserves allowed streaming", async t => {
  let coercions = 0;
  const refused = await developmentResponseServer(t, (_incoming, response) => {
    response.writeHead({ valueOf: () => { coercions++; return coercions === 1 ? 307.9 : 200; } }, { Location: "/target" });
    response.end();
  });
  assert.equal(await refused("Sec-Fetch-Dest: document\r\n"), "");
  assert.equal(coercions, 1);
  const allowed = await developmentResponseServer(t, (_incoming, response) => {
    response.writeHead(200, "Allowed", { "Content-Type": "text/plain", "X-Owned": "stream" });
    response.flushHeaders(); response.write("first"); response.end("second");
  });
  const wire = await allowed("Sec-Fetch-Dest: document\r\n");
  assert.match(wire, /^HTTP\/1.1 200 Allowed\r\n/u);
  assert.match(wire, /X-Owned: stream\r\n/u);
  assert.match(wire, /5\r\nfirst\r\n6\r\nsecond\r\n0\r\n/u);
});

function developmentShutdownProcess(body) {
  return spawnSync(process.execPath, ["--input-type=module", "--eval", `
    import assert from "node:assert/strict";
    import { createServer } from "node:http";
    import { setImmediate as nextTurn } from "node:timers/promises";
    import { mock } from "node:test";
    import { runDevelopmentServer } from ${JSON.stringify(new URL("common/application-environments/apps/web/scripts/browser-development-server.ts", templates).href)};
    ${body}
  `], { encoding: "utf8", timeout: 5000, env: { PATH: process.env.PATH, CI: "true", COREPACK_ENABLE_NETWORK: "0", COREPACK_ENABLE_DOWNLOAD_PROMPT: "0",
    pnpm_config_verify_deps_before_run: "error", pnpm_config_enable_global_virtual_store: "false" } });
}

test("development shutdown waits for delayed preparation and subsequent cleanup", () => {
  const result = developmentShutdownProcess(`
    const events = [];
    let finishPreparation, finishCleanup, settled = false;
    const preparation = new Promise(resolve => { finishPreparation = resolve; });
    const cleanup = new Promise(resolve => { finishCleanup = resolve; });
    const running = runDevelopmentServer(createServer(), {
      prepare: async () => { await preparation; events.push("initialized"); },
      close: async () => { events.push("cleanup-started"); await cleanup; events.push("cleanup-finished"); },
      getRequestHandler: () => { throw new Error("Must not listen after shutdown"); },
    }).then(() => { settled = true; });
    await nextTurn(); process.emit("SIGTERM"); await nextTurn();
    assert.deepEqual(events, [], "Cleanup cannot precede later initialization");
    finishPreparation(); await nextTurn();
    assert.deepEqual(events, ["initialized", "cleanup-started"]);
    assert.equal(settled, false, "Startup must await shutdown completion");
    finishCleanup(); await running;
    assert.deepEqual(events, ["initialized", "cleanup-started", "cleanup-finished"]);
    assert.equal(process.listenerCount("SIGINT"), 0);
    assert.equal(process.listenerCount("SIGTERM"), 0);
  `);
  assert.equal(result.status, 0, result.stdout + result.stderr);
});

test("development shutdown retains delayed startup and cleanup failures", () => {
  const result = developmentShutdownProcess(`
    let rejectPreparation;
    const preparation = new Promise((_resolve, reject) => { rejectPreparation = reject; });
    const events = [];
    const running = runDevelopmentServer(createServer(), {
      prepare: async () => { try { await preparation; } finally { events.push("preparation-settled"); } },
      close: async () => { events.push("cleanup"); throw new Error("cleanup-sentinel"); },
      getRequestHandler: () => { throw new Error("Must not listen"); },
    }).catch(error => error);
    await nextTurn(); process.emit("SIGTERM"); await nextTurn();
    assert.deepEqual(events, []);
    rejectPreparation(new Error("startup-sentinel"));
    const error = await running;
    const messages = value => [value.message, ...(value.errors ?? []).flatMap(messages)];
    assert.ok(messages(error).includes("startup-sentinel"));
    assert.ok(messages(error).includes("cleanup-sentinel"));
    assert.deepEqual(events, ["preparation-settled", "cleanup"]);
    process.exitCode = 0;
  `);
  assert.equal(result.status, 0, result.stdout + result.stderr);
});

test("development shutdown deadline covers stalled preparation and cleanup", () => {
  for (const stage of ["preparation", "cleanup-after-rejection"]) {
    const result = developmentShutdownProcess(`
      mock.timers.enable({ apis: ["setTimeout"] });
      let rejectPreparation;
      const preparation = new Promise((_resolve, reject) => { rejectPreparation = reject; });
      void runDevelopmentServer(createServer(), {
        prepare: () => preparation,
        close: () => ${stage === "preparation" ? "Promise.resolve()" : "new Promise(() => {})"},
        getRequestHandler: () => { throw new Error("Must not listen"); },
      }).catch(error => { console.error(error); process.exitCode = 2; });
      await nextTurn(); process.emit("SIGTERM"); await nextTurn();
      ${stage === "preparation" ? "" : 'rejectPreparation(new Error("startup-before-deadline")); await nextTurn();'}
      mock.timers.tick(14999); console.log("deadline-still-active");
      mock.timers.tick(1); console.log("deadline-was-lost");
    `);
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stdout, /deadline-still-active/u);
    assert.doesNotMatch(result.stdout, /deadline-was-lost/u);
    assert.match(result.stderr, /BROWSER_DEVELOPMENT_SHUTDOWN_TIMEOUT/u);
    if (stage === "cleanup-after-rejection") assert.match(result.stderr, /startup-before-deadline/u);
  }
});

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

test("default browser transport refuses redirects without continuing a browser request", async () => {
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

test("native development admission requires the complete owned server pairing", async () => {
  const { readDevelopmentTransportMode, guardedDevelopmentServer } = await import(new URL("common/application-environments/apps/web/scripts/browser-development-server.ts", templates));
  const origin = "http://127.0.0.1:3100";
  const metadata = { applicationTransport: "guarded-next-development" };
  assert.equal(readDevelopmentTransportMode(origin, metadata, guardedDevelopmentServer), "guarded-next-development");
  assert.equal(readDevelopmentTransportMode(origin, {}, { command: "pnpm run preview", url: origin }), undefined);
  for (const [baseURL, meta, server] of [
    [origin, {}, guardedDevelopmentServer], [origin, { applicationTransport: "unknown" }, guardedDevelopmentServer],
    ["https://127.0.0.1:3100", metadata, guardedDevelopmentServer], [origin, metadata, null],
    [origin, metadata, [guardedDevelopmentServer]], [origin, metadata, { ...guardedDevelopmentServer, reuseExistingServer: true }],
    [origin, metadata, { ...guardedDevelopmentServer, command: "pnpm run dev" }],
    [origin, metadata, { ...guardedDevelopmentServer, url: "http://localhost:3100" }],
    [origin, metadata, { ...guardedDevelopmentServer, cwd: "/another/project" }],
  ]) assert.throws(() => readDevelopmentTransportMode(baseURL, meta, server), /DEVELOPMENT_CONFIG_INVALID/u);
});

test("guarded native transport continues only validated same-origin requests and owns its pending requests", async () => {
  const { createApplicationTransport } = await import(new URL("common/application-environments/apps/web/tests/e2e/application-transport.ts", templates));
  const origin = "http://127.0.0.1:3100";
  const request = { newContext: async () => ({ dispose: async () => {} }) };
  for (const [baseURL, environment, mode] of [["https://example.test", {}, "guarded-next-development"],
    [origin, { DEPLOY_URL: origin }, "guarded-next-development"], [origin, { CF_ACCESS_CLIENT_ID: "id" }, "guarded-next-development"],
    [origin, {}, "unknown"]]) {
    await assert.rejects(createApplicationTransport(baseURL, environment, request, mode), /APPLICATION_TRANSPORT_/u);
  }
  const transport = await createApplicationTransport(origin, {}, request, "guarded-next-development");
  const context = new EventEmitter();
  let handler;
  context.routeWebSocket = async () => {};
  context.route = async (_pattern, value) => { handler = value; };
  const calls = [];
  const response = { status: () => 200, dispose: async () => {} };
  const route = incoming => ({ request: () => incoming, continue: async (...args) => { assert.deepEqual(args, []); calls.push("continue"); },
    fetch: async () => { calls.push("fetch"); return response; }, fulfill: async () => { calls.push("fulfill"); }, abort: async () => { calls.push("abort"); } });
  await transport.installBrowserProtection(context);
  for (const [navigation, resourceType, expected] of [[true, "document", ["continue"]], [false, "fetch", ["continue"]], [false, "document", ["continue"]]]) {
    calls.length = 0;
    const incoming = { url: () => origin, isNavigationRequest: () => navigation, resourceType: () => resourceType, headers: () => ({}) };
    await handler(route(incoming));
    context.emit("requestfinished", incoming);
    assert.deepEqual(calls, expected);
  }
  transport.assertBrowserRequests();
  calls.length = 0;
  await handler(route({ url: () => "http://127.0.0.1:1/external" }));
  assert.deepEqual(calls, ["abort"]);
  assert.throws(() => transport.assertBrowserRequests(), /BROWSER_REQUEST_BLOCKED/u);
  await transport.dispose();
  assert.equal(context.listenerCount("requestfinished"), 0);
  assert.equal(context.listenerCount("requestfailed"), 0);
});

test("native request failure and deadline stay sticky while disposing only owned listeners", async t => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const { createApplicationTransport } = await import(new URL("common/application-environments/apps/web/tests/e2e/application-transport.ts", templates));
  for (const outcome of ["failure", "timeout", "first-popup-timeout"]) {
    const context = new EventEmitter();
    let handler, pageCloses = 0, contextCloses = 0;
    const incoming = { url: () => "http://127.0.0.1:3100", isNavigationRequest: () => true, resourceType: () => "document",
      frame: () => { if (outcome === "first-popup-timeout") throw new Error("No frame yet"); return { page: () => ({ close: async () => { pageCloses++; } }) }; } };
    context.routeWebSocket = async () => {};
    context.route = async (_pattern, value) => { handler = value; };
    context.close = async () => { contextCloses++; };
    const unrelated = () => {};
    context.on("requestfinished", unrelated);
    const transport = await createApplicationTransport("http://127.0.0.1:3100", {}, { newContext: async () => ({ dispose: async () => {} }) }, "guarded-next-development");
    await transport.installBrowserProtection(context);
    await handler({ request: () => incoming, continue: async () => {} });
    if (outcome === "failure") context.emit("requestfailed", incoming);
    else { t.mock.timers.tick(9999); transport.assertBrowserRequests(); t.mock.timers.tick(1); }
    assert.throws(() => transport.assertBrowserRequests(), /BROWSER_REQUEST_BLOCKED/u);
    assert.equal(pageCloses, outcome === "timeout" ? 1 : 0);
    assert.equal(contextCloses, outcome === "first-popup-timeout" ? 1 : 0);
    await transport.dispose();
    assert.deepEqual(context.listeners("requestfinished"), [unrelated]);
    assert.equal(context.listenerCount("requestfailed"), 0);
  }
});

test("native fetch cancellation requires successful headers and preserves every other failure", async t => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const { createApplicationTransport } = await import(new URL("common/application-environments/apps/web/tests/e2e/application-transport.ts", templates));
  const cases = [
    { name: "fetch abort after 200", status: 200, allowed: true },
    { name: "fetch abort after 202", status: 202, allowed: true },
    { name: "fetch abort after 299", status: 299, allowed: true },
    { name: "abort before headers" },
    { name: "informational response", status: 199 },
    { name: "redirect response", status: 300 },
    { name: "denied response", status: 403 },
    { name: "server error response", status: 500 },
    { name: "document abort", status: 202, resourceType: "document" },
    { name: "script abort", status: 202, resourceType: "script" },
    { name: "non-abort failure", status: 202, error: "net::ERR_CONNECTION_RESET" },
    { name: "another request response", status: 202, unrelatedResponse: true },
    { name: "prior failure stays sticky", status: 202, priorFailure: true },
    { name: "successful headers retain deadline", status: 202, hang: true },
    { name: "finished request clears deadline", status: 202, finished: true, allowed: true },
  ];
  for (const scenario of cases) await t.test(scenario.name, async () => {
    const context = new EventEmitter();
    let handler, pageCloses = 0;
    const incoming = { url: () => "http://127.0.0.1:3100/resource", resourceType: () => scenario.resourceType ?? "fetch",
      failure: () => ({ errorText: scenario.error ?? "net::ERR_ABORTED" }), frame: () => ({ page: () => ({ close: async () => { pageCloses++; } }) }) };
    context.routeWebSocket = async () => {};
    context.route = async (_pattern, value) => { handler = value; };
    const unrelatedListener = () => {};
    context.on("response", unrelatedListener);
    const transport = await createApplicationTransport("http://127.0.0.1:3100", {}, { newContext: async () => ({ dispose: async () => {} }) }, "guarded-next-development");
    try {
      await transport.installBrowserProtection(context);
      const route = request => ({ request: () => request, continue: async () => {} });
      if (scenario.priorFailure) {
        const prior = { ...incoming };
        await handler(route(prior)); context.emit("requestfailed", prior);
      }
      await handler(route(incoming));
      if (scenario.status !== undefined) context.emit("response", { request: () => scenario.unrelatedResponse ? { ...incoming } : incoming, status: () => scenario.status });
      if (scenario.hang) {
        t.mock.timers.tick(9999); transport.assertBrowserRequests(); t.mock.timers.tick(1);
      } else {
        context.emit(scenario.finished ? "requestfinished" : "requestfailed", incoming);
        t.mock.timers.tick(10000);
      }
      if (scenario.allowed) transport.assertBrowserRequests();
      else assert.throws(() => transport.assertBrowserRequests(), /BROWSER_REQUEST_BLOCKED/u);
      assert.equal(pageCloses, scenario.hang ? 1 : 0);
    } finally { await transport.dispose(); }
    assert.deepEqual(context.listeners("response"), [unrelatedListener]);
    assert.equal(context.listenerCount("requestfinished"), 0);
    assert.equal(context.listenerCount("requestfailed"), 0);
  });
});

test("guarded development rendering is candidate-only with standards ownership", async () => {
  const core = await import("../dist/index.js");
  const request = { profile: "portfolio", projectName: "guarded-development", displayName: "Guarded Development", packageVersions: core.verifiedCapabilityPackageVersions };
  const candidate = await core.renderSkeleton(request, core.createApplicationEnvironmentRenderingContext());
  const current = await core.renderSkeleton(request);
  assert.equal(candidate.ok, true); assert.equal(current.ok, true);
  for (const path of ["apps/web/scripts/browser-development-server.ts", "apps/web/playwright.dev.config.ts"]) {
    assert.equal(candidate.value.surfaces.find(surface => surface.path === path)?.owner.identifier, "standards");
    assert.equal(Buffer.from(candidate.value.files.find(file => file.path === path).content).toString("utf8"), await readFile(new URL(`common/application-environments/${path}`, templates), "utf8"));
  }
  assert.equal(current.value.files.some(file => file.path === "apps/web/scripts/browser-development-server.ts"), false);
  assert.equal(Buffer.from(current.value.files.find(file => file.path === "apps/web/playwright.dev.config.ts").content).toString("utf8"), await readFile(new URL("common/apps/web/playwright.dev.config.ts", templates), "utf8"));
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
