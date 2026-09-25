import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { cp, lstat, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import test from "node:test";

import {
  createFileSystemRepositoryReader,
  createApplicationEnvironmentRenderingContext,
  createPnpmGeneratedProjectVerifier,
  generateProject,
  inferRepository,
  readVerifiedProjectSnapshot,
} from "../dist/index.js";
import { derivePnpmToolEnvironment } from "../dist/generation/verify-generated-project.js";

const execFileAsync = promisify(execFile);
const publicRegistry = "https://registry.npmjs.org/";
const packages = [
  {
    name: "@egeria-systems/standards",
    version: "0.1.0",
    integrity:
      "sha512-BmDwcX0T6KT271C4N24jCKn6ymKTqDAFpJjsG6LNpmIoTAz0xApIcqpHFl9dHOqlB2xdhdHwKYfSiELUp04E0Q==",
    directory: "packages/standards",
    hasAttestations: false,
  },
  {
    name: "@egeria-systems/observability",
    version: "0.3.0",
    integrity:
      "sha512-AnqIa6qn1aLYuntoQ1zo9A80ioiStR2mKJg5mq/v/NrKNAFQf" +
      "P" +
      "7InXojel9Azst3lLDUUdyDuEDFmCIgyWDwrA==",
    directory: "packages/observability",
    hasAttestations: true,
  },
];

function assertSuccess(result) {
  assert.equal(result.ok, true, JSON.stringify(result.issues));
  return result.value;
}

function createLiveEnvironment(supportRoot) {
  const environment = {
    CI: "true",
    NEXT_TELEMETRY_DISABLED: "1",
    HOME: join(supportRoot, "home"),
    USERPROFILE: join(supportRoot, "home"),
    TMPDIR: join(supportRoot, "temporary"),
    TMP: join(supportRoot, "temporary"),
    TEMP: join(supportRoot, "temporary"),
    NPM_CONFIG_REGISTRY: publicRegistry,
    NPM_CONFIG_USERCONFIG: join(supportRoot, ".npmrc"),
  };

  for (const key of ["PATH", "LANG", "SystemRoot", "ComSpec", "PATHEXT"]) {
    if (process.env[key] !== undefined) {
      environment[key] = process.env[key];
    }
  }

  return environment;
}

async function prepareLiveSupport(root) {
  const environment = createLiveEnvironment(root);
  await mkdir(environment.HOME, { recursive: true, mode: 0o700 });
  await mkdir(environment.TMPDIR, { mode: 0o700 });
  await mkdir(join(root, "store"), { mode: 0o700 });
  await writeFile(environment.NPM_CONFIG_USERCONFIG, "");
  return { environment, store: join(root, "store") };
}

async function runPnpm(arguments_, options) {
  return execFileAsync("pnpm", arguments_, {
    ...options,
    encoding: "utf8",
    maxBuffer: 5 * 1024 * 1024,
    shell: false,
    timeout: 15 * 60 * 1000,
    windowsHide: true,
  });
}

async function fetchPackageManifest(packageName, version) {
  const response = await fetch(
    `${publicRegistry}${encodeURIComponent(packageName)}/${version}`,
    { signal: AbortSignal.timeout(30_000) },
  );
  assert.equal(response.ok, true, `${packageName}: ${response.status}`);
  return response.json();
}

async function assertAbsent(path) {
  await assert.rejects(lstat(path), { code: "ENOENT" });
}

async function validatePublicGraph(owner, profile, destination) {
  const validationRoot = join(owner, `${profile}-audit-project`);
  const supportRoot = join(owner, `${profile}-audit-support`);
  await cp(destination, validationRoot, {
    recursive: true,
    force: false,
    errorOnExist: true,
    dereference: false,
  });
  await mkdir(supportRoot, { mode: 0o700 });
  const support = await prepareLiveSupport(supportRoot);

  await runPnpm(
    ["install", "--frozen-lockfile", "--store-dir", support.store],
    { cwd: validationRoot, env: support.environment },
  );
  await runPnpm(["audit", "--audit-level", "moderate"], {
    cwd: validationRoot,
    env: support.environment,
  });
  await runPnpm(["audit", "signatures"], {
    cwd: validationRoot,
    env: support.environment,
  });
}

test("public portfolio and site projects install, build, audit, and infer", async (context) => {
  const owner = await mkdtemp(join(tmpdir(), "egeria-public-generation-"));

  try {
    for (const expectedPackage of packages) {
      const manifest = await fetchPackageManifest(
        expectedPackage.name,
        expectedPackage.version,
      );
      assert.equal(manifest.name, expectedPackage.name);
      assert.equal(manifest.version, expectedPackage.version);
      assert.equal(manifest.license, "Apache-2.0");
      assert.deepEqual(manifest.repository, {
        type: "git",
        url: "git+https://github.com/Egeria-Systems/egeria-scaffold.git",
        directory: expectedPackage.directory,
      });
      assert.equal(manifest.dist.integrity, expectedPackage.integrity);
      assert.ok(manifest.dist.signatures.length > 0);
      assert.equal(
        manifest.dist.attestations !== undefined,
        expectedPackage.hasAttestations,
      );
    }

    const lockfileHashes = {};

    for (const profile of ["portfolio", "site"]) {
      const destination = join(owner, profile);
      const generated = assertSuccess(
        await generateProject({
          request: {
            profile,
            projectName: `public-${profile}`,
            displayName: `Public ${profile}`,
          },
          destination,
          verifier: createPnpmGeneratedProjectVerifier({
            pnpmExecutable: "pnpm",
          }),
        }),
      );
      assert.equal(
        generated.state.managedSurfaces.length,
        profile === "portfolio" ? 106 : 123,
      );

      const lockfile = await readFile(join(destination, "pnpm-lock.yaml"));
      const lockfileText = lockfile.toString("utf8");
      for (const expectedPackage of packages) {
        assert.ok(lockfileText.includes(expectedPackage.name));
        assert.ok(lockfileText.includes(expectedPackage.integrity));
      }
      lockfileHashes[profile] = createHash("sha256")
        .update(lockfile)
        .digest("hex");

      for (const path of [
        "node_modules",
        "apps/web/node_modules",
        "apps/web/.next",
        "apps/web/.open-next",
        "apps/web/.wrangler",
        ".pnpm-store",
      ]) {
        await assertAbsent(join(destination, path));
      }

      const snapshot = assertSuccess(await readVerifiedProjectSnapshot(
        createFileSystemRepositoryReader(generated.destination),
      ));
      const inference = await inferRepository({ reader: snapshot.reader, catalog: snapshot.catalog });
      assert.equal(inference.state.kind, "valid");
      assert.ok(
        inference.capabilities.every(
          ({ category }) => category === "confirmed",
        ),
      );
      assert.ok(
        inference.surfaces.every(({ status }) =>
          ["confirmed", "application-owned"].includes(status),
        ),
      );

      await validatePublicGraph(owner, profile, destination);
    }

    context.diagnostic(
      JSON.stringify({
        packageIntegrities: Object.fromEntries(
          packages.map(({ name, integrity }) => [name, integrity]),
        ),
        lockfileHashes,
      }),
    );
  } finally {
    await rm(owner, { recursive: true, force: true });
  }
});

test("application environment generation validates real target builds and the same Worker across runtime configurations", { timeout: 30 * 60 * 1000 }, async (context) => {
  const owner = await mkdtemp(join(tmpdir(), "egeria-application-environment-"));
  context.diagnostic(`Retained local evidence: ${owner}`);
  const commands = [];
  const renderingContext = createApplicationEnvironmentRenderingContext();
  const destination = join(owner, "generated");
  const generated = assertSuccess(await generateProject({
    request: { profile: "app", projectName: "environment-example", displayName: "Environment Example" },
    destination, renderingContext,
    verifier: createPnpmGeneratedProjectVerifier({ pnpmExecutable: "pnpm" }),
  }));
  assert.equal(generated.state.schemaVersion, "2.0.0");
  const snapshot = assertSuccess(await readVerifiedProjectSnapshot(createFileSystemRepositoryReader(destination), renderingContext));
  const inference = await inferRepository({ reader: snapshot.reader, catalog: snapshot.catalog, projectSchemaVersion: "2.0.0" });
  assert.equal(inference.state.kind, "valid");
  assert.ok(inference.capabilities.every(({ category }) => category === "confirmed"));
  assert.ok(inference.surfaces.every(({ status }) => status === "confirmed" || status === "application-owned"));
  await writeFile(join(owner, "generation-state.json"), JSON.stringify(generated.state, null, 2));

  const project = join(owner, "browser-proof");
  await cp(destination, project, { recursive: true, force: false, errorOnExist: true, dereference: false });
  const supportRoot = join(owner, "support");
  await mkdir(supportRoot);
  const support = await prepareLiveSupport(supportRoot);
  const environment = { ...support.environment, ...await derivePnpmToolEnvironment("pnpm"), WRANGLER_SEND_METRICS: "false" };
  async function run(name, arguments_, additions = {}) {
    const command = { name, arguments: arguments_, applicationEnvironment: additions.APPLICATION_ENVIRONMENT ?? "loaded-by-next-or-default" };
    try {
      const result = await runPnpm(arguments_, { cwd: project, env: { ...environment, ...additions } });
      await writeFile(join(owner, `${name}.log`), result.stdout + result.stderr);
      commands.push({ ...command, exitCode: 0 });
    } catch (error) {
      await writeFile(join(owner, `${name}.log`), (error.stdout ?? "") + (error.stderr ?? ""));
      commands.push({ ...command, exitCode: error.code });
      throw error;
    } finally { await writeFile(join(owner, "commands.json"), JSON.stringify(commands, null, 2)); }
  }
  const app = join(project, "apps/web");
  await mkdir(join(app, "app/environment-proof"));
  await writeFile(join(app, "app/environment-proof/page.tsx"), `"use client";
import { readCompiledApplicationEnvironment } from "@/src/configuration/application-environment";
export default function EnvironmentProof() {
  const target = readCompiledApplicationEnvironment();
  return <output data-application-environment={target.ok ? target.value : "invalid"}>{process.env.NEXT_PUBLIC_SITE_URL}</output>;
}
`);
  await writeFile(join(app, "tests/integration/browser-environment.test.ts"), `
import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";
import { createTestHarness } from "wrangler";

it("keeps the public build target and public values fixed when runtime configuration changes", async () => {
  const target = process.env.APPLICATION_ENVIRONMENT;
  if (target === undefined) throw new Error("Expected explicit proof target");
  const selected = "https://" + target + "-selected-public-sentinel.example";
  const forbidden = ["server-secret-sentinel", "runtime-secret-sentinel", "other-target-public-sentinel", "unloaded-staging-public-sentinel"];
  const workerBefore = await readFile(".open-next/worker.js");
  for (const runtime of [target, target === "production" ? "staging" : "production"]) {
    const server = createTestHarness({ workers: [{ configPath: "./wrangler.jsonc", vars: { APPLICATION_ENVIRONMENT: runtime }, secrets: { SERVER_ONLY_PROOF: "runtime-secret-sentinel" } }] });
    try {
      await server.listen();
      const response = await server.fetch("/environment-proof");
      expect(response.status).toBe(200);
      const body = await response.text();
      expect(body).toContain('data-application-environment="' + target + '"');
      expect(body).toContain(selected);
      for (const sentinel of forbidden) expect(body).not.toContain(sentinel);
      const scripts = [...body.matchAll(/<script[^>]+src="([^"]+)"/g)].map(match => match[1]).filter((path): path is string => path !== undefined);
      expect(scripts.length).toBeGreaterThan(0);
      let browserCode = "";
      for (const path of scripts) {
        const script = await server.fetch(path);
        expect(script.status).toBe(200);
        browserCode += await script.text();
      }
      expect(browserCode).toContain(selected);
      for (const sentinel of forbidden) expect(browserCode).not.toContain(sentinel);
      expect(await readFile(".open-next/worker.js")).toEqual(workerBefore);
    } finally { await server.close(); }
  }
}, 120_000);
`);
  await run("install", ["install", "--frozen-lockfile", "--store-dir", support.store]);
  await run("typecheck", ["--dir", "apps/web", "run", "typecheck"]);
  await run("unit", ["--dir", "apps/web", "run", "test:unit"]);
  await run("component", ["--dir", "apps/web", "run", "test:component"]);
  for (const target of ["development", "staging", "production"]) {
    const selected = `https://${target}-selected-public-sentinel.example`;
    await writeFile(join(app, ".env.local"), `APPLICATION_ENVIRONMENT=${target === "production" ? "staging" : target}\nNEXT_PUBLIC_SITE_URL=${selected}\nSERVER_ONLY_PROOF=server-secret-sentinel\n`);
    await writeFile(join(app, ".env.production"), "NEXT_PUBLIC_SITE_URL=https://other-target-public-sentinel.example\n");
    await writeFile(join(app, ".env.staging"), "NEXT_PUBLIC_SITE_URL=https://unloaded-staging-public-sentinel.example\n");
    await run(`${target}-preflight`, ["--dir", "apps/web", "run", target === "development" ? "check:environment" : "check:environment:deployment"], { APPLICATION_ENVIRONMENT: target });
    const buildEnvironment = target === "production" ? { APPLICATION_ENVIRONMENT: target } : {};
    await run(`${target}-next`, ["--dir", "apps/web", "run", "build"], buildEnvironment);
    await run(`${target}-opennext`, ["--dir", "apps/web", "exec", "opennextjs-cloudflare", "build", "--skipNextBuild"], { APPLICATION_ENVIRONMENT: target });
    await run(`${target}-worker`, ["--dir", "apps/web", "run", "test:integration:cloudflare"], { APPLICATION_ENVIRONMENT: target });
    const staticRoot = join(app, ".open-next/assets/_next/static");
    const staticFiles = await readdir(staticRoot, { recursive: true, withFileTypes: true });
    const buffers = await Promise.all(staticFiles.filter(entry => entry.isFile()).map(entry => readFile(join(entry.parentPath, entry.name))));
    const browserBytes = Buffer.concat(buffers);
    assert.ok(browserBytes.includes(selected));
    for (const sentinel of ["server-secret-sentinel", "runtime-secret-sentinel", "other-target-public-sentinel", "unloaded-staging-public-sentinel"]) assert.equal(browserBytes.includes(sentinel), false, sentinel);
    await writeFile(join(owner, `${target}-artifact.json`), JSON.stringify({ target, syntheticClientConsumer: true, staticFiles: buffers.length, browserSha256: createHash("sha256").update(browserBytes).digest("hex"), workerSha256: createHash("sha256").update(await readFile(join(app, ".open-next/worker.js"))).digest("hex") }, null, 2));
  }
});


test("environment contact builds freeze selected public values in controlled browser journeys", { timeout: 45 * 60 * 1000 }, async (context) => {
  const owner = await mkdtemp(join(tmpdir(), "egeria-environment-contact-"));
  context.diagnostic(`Retained contact evidence: ${owner}`);
  const renderingContext = createApplicationEnvironmentRenderingContext();
  const keyA = "00000000-0000-4000-8000-000000000001";
  const keyB = "00000000-0000-4000-8000-000000000002";
  const invalidKey = "invalid-contact-input-sentinel";
  const supportRoot = join(owner, "support");
  await mkdir(supportRoot);
  const support = await prepareLiveSupport(supportRoot);
  const environment = { ...support.environment, ...await derivePnpmToolEnvironment("pnpm"), WRANGLER_SEND_METRICS: "false" };
  const commands = [];
  const artifacts = [];
  const destination = join(owner, "generated");
  const generated = assertSuccess(await generateProject({
    request: { profile: "site", projectName: "contact-example", displayName: "Contact Example", multilingual: true, contactFormWeb3Forms: true },
    destination, renderingContext,
    verifier: createPnpmGeneratedProjectVerifier({ pnpmExecutable: "pnpm" }),
  }));
  assert.equal(generated.state.schemaVersion, "2.0.0");
  assert.equal(generated.state.installedCapabilities.find(value => value.identifier === "contact-form-web3forms")?.version, "0.2.0");
  await writeFile(join(owner, "generation-state.json"), JSON.stringify(generated.state, null, 2));
  const project = join(owner, "browser-proof");
  await cp(destination, project, { recursive: true, force: false, errorOnExist: true, dereference: false });
  const app = join(project, "apps/web");

  async function run(name, arguments_, additions = {}, succeeds = true, cwd = project) {
    let result;
    try {
      result = await runPnpm(arguments_, { cwd, env: { ...environment, ...additions } });
      commands.push({ name, arguments: arguments_, exitCode: 0 });
    } catch (error) {
      result = { stdout: error.stdout ?? "", stderr: error.stderr ?? "" };
      commands.push({ name, arguments: arguments_, exitCode: error.code });
      if (succeeds) {
        await writeFile(join(owner, `${name}.log`), result.stdout + result.stderr);
        throw error;
      }
    } finally { await writeFile(join(owner, "commands.json"), JSON.stringify(commands, null, 2)); }
    await writeFile(join(owner, `${name}.log`), result.stdout + result.stderr);
    assert.equal(commands.at(-1).exitCode === 0, succeeds, name);
    return result;
  }

  async function sourceDigest() {
    const paths = await readdir(destination, { recursive: true, withFileTypes: true });
    const relativePaths = paths.filter(entry => entry.isFile())
      .map(entry => join(entry.parentPath, entry.name).slice(destination.length + 1)).sort();
    const digest = createHash("sha256");
    for (const path of relativePaths) {
      digest.update(path); digest.update(await readFile(join(project, path)));
    }
    return digest.digest("hex");
  }

  async function browser(name, mode, target, runtimeKey, expectedKey, cwd = project) {
    const reportPath = join(owner, `${name}.json`);
    await run(name, ["--dir", "apps/web", "run", `test:e2e:${mode}`, "--reporter=json", "web3forms-contact.spec.ts"], {
      APPLICATION_ENVIRONMENT: target,
      ...(mode === "dev" ? { WATCHPACK_POLLING: "true" } : {}),
      ...(mode === "preview" && target !== "development" ? { CLOUDFLARE_ENV: target } : {}),
      NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY: runtimeKey,
      CONTACT_TEST_EXPECTED_ACCESS_KEY: expectedKey,
      PLAYWRIGHT_JSON_OUTPUT_FILE: reportPath,
    }, true, cwd);
    const report = JSON.parse(await readFile(reportPath, "utf8"));
    assert.equal(report.stats.expected, expectedKey === "" ? 3 : 7, name);
    assert.equal(report.stats.unexpected, 0, name);
    assert.equal(report.stats.flaky, 0, name);
    return { executed: report.stats.expected, skipped: report.stats.skipped, expectedKey: expectedKey === "" ? "absent" : expectedKey === keyA ? "synthetic-A" : "synthetic-B" };
  }

  await run("install", ["install", "--frozen-lockfile", "--store-dir", support.store]);
  await run("browser-install", ["--dir", "apps/web", "run", "browser:install"]);
  // The state-last generator already ran actual lint, typecheck, unit/component and both builds in isolation.
  // These process checks exercise the selected preflight itself, without loading Next environment files.
  for (const target of ["development", "staging", "production"]) {
    for (const [label, key] of [["absent", ""], ["invalid", invalidKey], ["configured", keyA]]) {
      const succeeds = label === "configured" || (target === "development" && label === "absent");
      const result = await run(`${target}-${label}-preflight`, ["--dir", "apps/web", "run", target === "development" ? "check:environment" : "check:environment:deployment"], {
        APPLICATION_ENVIRONMENT: target, NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY: key,
      }, succeeds);
      if (!succeeds) assert.match(result.stderr, /"code":"CONTACT_CONFIGURATION_INVALID","field":"NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY","reason":"(?:missing|invalid)"/u);
      assert.equal((result.stdout + result.stderr).includes(invalidKey), false);
      if (target !== "development" && label !== "configured") {
        const failedBuild = await run(`${target}-${label}-build`, ["--dir", "apps/web", "run", "build"], {
          APPLICATION_ENVIRONMENT: target, NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY: key,
        }, false);
        assert.match(failedBuild.stderr, /CONTACT_CONFIGURATION_INVALID:NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY:(?:missing|invalid)/u);
        assert.equal((failedBuild.stdout + failedBuild.stderr).includes(invalidKey), false);
      }
    }
  }
  for (const command of ["check:environment", "build"]) {
    const conflict = await run(`target-conflict-${command.replace(":", "-")}`, ["--dir", "apps/web", "run", command], {
      APPLICATION_ENVIRONMENT: "staging", NEXT_PUBLIC_APPLICATION_ENVIRONMENT: "production", NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY: invalidKey,
    }, false);
    assert.match(conflict.stderr, /APPLICATION_ENVIRONMENT_INVALID/u);
    assert.doesNotMatch(conflict.stderr, /CONTACT_CONFIGURATION_INVALID|invalid-contact-input-sentinel/u);
  }
  await browser("development-absent", "dev", "development", "", "");
  await browser("development-configured", "dev", "development", keyA, keyA);
  const sourceHash = await sourceDigest();
  for (const [target, buildKey, runtimeKey] of [["development", "", keyB], ["staging", keyA, keyB], ["production", keyB, keyA]]) {
    assert.equal(await sourceDigest(), sourceHash);
    await run(`${target}-next`, ["--dir", "apps/web", "run", "build"], {
      APPLICATION_ENVIRONMENT: target, NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY: buildKey,
    });
    await run(`${target}-opennext`, ["--dir", "apps/web", "exec", "opennextjs-cloudflare", "build", "--skipNextBuild"], {
      APPLICATION_ENVIRONMENT: target, NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY: buildKey,
      ...(target === "development" ? {} : { CLOUDFLARE_ENV: target }),
    });
    const worker = await readFile(join(app, ".open-next/worker.js"));
    const staticRoot = join(app, ".open-next/assets/_next/static");
    const entries = await readdir(staticRoot, { recursive: true, withFileTypes: true });
    const assets = await Promise.all(entries.filter(entry => entry.isFile()).map(entry => readFile(join(entry.parentPath, entry.name))));
    const before = createHash("sha256").update(worker).update(Buffer.concat(assets)).digest("hex");
    const observed = await browser(`${target}-prepared`, "preview", target, runtimeKey, buildKey);
    assert.deepEqual(await readFile(join(app, ".open-next/worker.js")), worker);
    assert.equal(await sourceDigest(), sourceHash);
    artifacts.push({ target, sourceHash, artifactHash: before, buildKey: buildKey === "" ? "absent" : buildKey === keyA ? "synthetic-A" : "synthetic-B", runtimeKey: runtimeKey === keyA ? "synthetic-A" : "synthetic-B", ...observed });
    await writeFile(join(owner, "artifacts.json"), JSON.stringify(artifacts, null, 2));
  }

  const portfolio = join(owner, "portfolio");
  assertSuccess(await generateProject({ request: { profile: "portfolio", projectName: "contact-portfolio", displayName: "Contact Portfolio", contactFormWeb3Forms: true },
    destination: portfolio, renderingContext, verifier: createPnpmGeneratedProjectVerifier({ pnpmExecutable: "pnpm" }),
  }));
  await run("portfolio-install", ["install", "--frozen-lockfile", "--store-dir", support.store], {}, true, portfolio);
  await browser("portfolio-configured", "dev", "development", keyA, keyA, portfolio);
  context.diagnostic(JSON.stringify({ owner, artifacts, portfolio: "configured one-page home and fallback; all provider requests intercepted" }));
});

for (const [profile, bookingMode, contact, multilingual] of [
  ["portfolio", "link", false, false],
  ["app", "inline", true, false],
  ["site", "popup", true, true],
]) {
  test(`environment booking builds freeze ${profile} selected values in controlled browsers`, { timeout: 60 * 60 * 1000 }, async context => {
    const owner = await mkdtemp(join(tmpdir(), `egeria-environment-booking-${profile}-`));
    context.diagnostic(`Retained booking evidence: ${owner}`);
    const urlA = "https://calendly.com/egeria-synthetic-nonproduction/intro";
    const urlB = "https://calendly.com/egeria-synthetic-production/intro";
    const keyA = "00000000-0000-4000-8000-000000000001";
    const keyB = "00000000-0000-4000-8000-000000000002";
    const invalidUrl = "invalid-booking-input-sentinel";
    const supportRoot = join(owner, "support");
    await mkdir(supportRoot);
    const support = await prepareLiveSupport(supportRoot);
    const environment = { ...support.environment, ...await derivePnpmToolEnvironment("pnpm"), WRANGLER_SEND_METRICS: "false" };
    const commands = [];
    const artifacts = [];
    const destination = join(owner, "generated");
    const generated = assertSuccess(await generateProject({
      request: { profile, projectName: `booking-${profile}`, displayName: "Booking Example", bookingCalendly: { mode: bookingMode },
        ...(contact ? { contactFormWeb3Forms: true } : {}), ...(multilingual ? { multilingual: true } : {}),
      },
      destination, renderingContext: createApplicationEnvironmentRenderingContext(),
      verifier: createPnpmGeneratedProjectVerifier({ pnpmExecutable: "pnpm" }),
    }));
    assert.equal(generated.state.schemaVersion, "2.0.0");
    assert.equal(generated.state.installedCapabilities.find(value => value.identifier === "booking-calendly")?.version, "0.2.0");
    await writeFile(join(owner, "generation-state.json"), JSON.stringify(generated.state, null, 2));
    const project = join(owner, "browser-proof");
    await cp(destination, project, { recursive: true, force: false, errorOnExist: true, dereference: false });
    const app = join(project, "apps/web");

    async function run(name, arguments_, additions = {}, succeeds = true) {
      let result;
      try {
        result = await runPnpm(arguments_, { cwd: project, env: { ...environment, ...additions } });
        commands.push({ name, arguments: arguments_, exitCode: 0 });
      } catch (error) {
        result = { stdout: error.stdout ?? "", stderr: error.stderr ?? "" };
        commands.push({ name, arguments: arguments_, exitCode: error.code });
        if (succeeds) {
          await writeFile(join(owner, `${name}.log`), result.stdout + result.stderr);
          throw error;
        }
      } finally { await writeFile(join(owner, "commands.json"), JSON.stringify(commands, null, 2)); }
      await writeFile(join(owner, `${name}.log`), result.stdout + result.stderr);
      assert.equal(commands.at(-1).exitCode === 0, succeeds, name);
      return result;
    }

    const entries = await readdir(destination, { recursive: true, withFileTypes: true });
    const sourcePaths = entries.filter(entry => entry.isFile()).map(entry => join(entry.parentPath, entry.name).slice(destination.length + 1)).sort();
    async function sourceDigest() {
      const digest = createHash("sha256");
      for (const path of sourcePaths) { digest.update(path); digest.update(await readFile(join(project, path))); }
      return digest.digest("hex");
    }
    async function artifactDigest() {
      const staticRoot = join(app, ".open-next/assets");
      const entries = await readdir(staticRoot, { recursive: true, withFileTypes: true });
      const paths = entries.filter(entry => entry.isFile()).map(entry => join(entry.parentPath, entry.name).slice(staticRoot.length + 1)).sort();
      const digest = createHash("sha256");
      for (const path of paths) { digest.update(path); digest.update(await readFile(join(staticRoot, path))); }
      return { workerSha256: createHash("sha256").update(await readFile(join(app, ".open-next/worker.js"))).digest("hex"), staticSha256: digest.digest("hex"), staticFiles: paths.length };
    }
    async function browser(name, mode, target, runtimeUrl, expectedUrl, runtimeKey, expectedKey) {
      const reportPath = join(owner, `${name}.json`);
      await run(name, ["--dir", "apps/web", "run", `test:e2e:${mode}`, "--reporter=json", "--output", join(owner, `${name}-results`), "calendly-booking.spec.ts", ...(contact ? ["web3forms-contact.spec.ts"] : [])], {
        APPLICATION_ENVIRONMENT: target,
        ...(mode === "dev" ? { WATCHPACK_POLLING: "true" } : {}),
        ...(mode === "preview" && target !== "development" ? { CLOUDFLARE_ENV: target } : {}),
        NEXT_PUBLIC_CALENDLY_URL: runtimeUrl,
        NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY: runtimeKey,
        BOOKING_TEST_EXPECTED_URL: expectedUrl,
        BOOKING_TEST_MODE: bookingMode,
        BOOKING_TEST_MULTILINGUAL: String(multilingual),
        CONTACT_TEST_EXPECTED_ACCESS_KEY: expectedKey,
        PLAYWRIGHT_JSON_OUTPUT_FILE: reportPath,
      });
      const report = JSON.parse(await readFile(reportPath, "utf8"));
      const bookingCount = (expectedUrl === "" ? 2 : bookingMode === "link" ? 3 : 5) * (multilingual ? 2 : 1);
      assert.equal(report.stats.expected, bookingCount + (contact ? expectedKey === "" ? 3 : 7 : 0), name);
      assert.equal(report.stats.unexpected, 0, name);
      assert.equal(report.stats.flaky, 0, name);
      const label = value => value === "" ? "absent" : value === urlA || value === keyA ? "synthetic-A" : "synthetic-B";
      return { executed: report.stats.expected, skipped: report.stats.skipped, expectedUrl: label(expectedUrl), expectedKey: label(expectedKey), runtimeUrl: label(runtimeUrl), runtimeKey: label(runtimeKey) };
    }

    await run("install", ["install", "--frozen-lockfile", "--store-dir", support.store]);
    await run("browser-install", ["--dir", "apps/web", "run", "browser:install"]);
    for (const target of ["development", "staging", "production"]) {
      for (const [label, url] of [["absent", ""], ["invalid", invalidUrl], ["configured", urlA]]) {
        const succeeds = label === "configured" || (target === "development" && label === "absent");
        const inputs = { APPLICATION_ENVIRONMENT: target, NEXT_PUBLIC_CALENDLY_URL: url, NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY: contact ? keyA : "" };
        const result = await run(`${target}-${label}-preflight`, ["--dir", "apps/web", "run", target === "development" ? "check:environment" : "check:environment:deployment"], inputs, succeeds);
        if (!succeeds) assert.match(result.stderr, /"code":"BOOKING_CONFIGURATION_INVALID","field":"NEXT_PUBLIC_CALENDLY_URL","reason":"(?:missing|invalid)"/u);
        assert.equal((result.stdout + result.stderr).includes(invalidUrl), false);
        if (!succeeds) {
          const failed = await run(`${target}-${label}-build`, ["--dir", "apps/web", "run", "build"], inputs, false);
          assert.match(failed.stderr, /BOOKING_CONFIGURATION_INVALID:NEXT_PUBLIC_CALENDLY_URL:(?:missing|invalid)/u);
          assert.equal((failed.stdout + failed.stderr).includes(invalidUrl), false);
          await assertAbsent(join(app, ".open-next/worker.js"));
        }
      }
    }
    for (const command of ["check:environment", "build"]) {
      const conflict = await run(`target-conflict-${command.replace(":", "-")}`, ["--dir", "apps/web", "run", command], {
        APPLICATION_ENVIRONMENT: "staging", NEXT_PUBLIC_APPLICATION_ENVIRONMENT: "production", NEXT_PUBLIC_CALENDLY_URL: invalidUrl, NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY: "invalid-contact-input-sentinel",
      }, false);
      assert.match(conflict.stderr, /APPLICATION_ENVIRONMENT_INVALID/u);
      assert.doesNotMatch(conflict.stderr, /BOOKING_CONFIGURATION_INVALID|CONTACT_CONFIGURATION_INVALID|invalid-booking-input-sentinel|invalid-contact-input-sentinel/u);
    }
    // This temporary copy is the app root Next actually reads; plain preflight must not load its local file.
    await writeFile(join(app, ".env.local"), `NEXT_PUBLIC_CALENDLY_URL=${invalidUrl}\n`);
    const localInputs = { APPLICATION_ENVIRONMENT: "development", NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY: contact ? keyA : "" };
    await run("env-local-plain-preflight", ["--dir", "apps/web", "run", "check:environment"], localInputs);
    const localFileFailure = await run("env-local-next-build", ["--dir", "apps/web", "run", "build"], localInputs, false);
    assert.match(localFileFailure.stderr, /BOOKING_CONFIGURATION_INVALID:NEXT_PUBLIC_CALENDLY_URL:invalid/u);
    assert.equal((localFileFailure.stdout + localFileFailure.stderr).includes(invalidUrl), false);
    await rm(join(app, ".env.local"));

    const developments = multilingual ? [["neither", "", ""], ["booking-only", urlA, ""], ["contact-only", "", keyA], ["both", urlA, keyA]]
      : [["absent", "", ""], ["configured", urlA, contact ? keyA : ""]];
    for (const [label, url, key] of developments) await browser(`development-${label}`, "dev", "development", url, url, key, key);
    const sourceHash = await sourceDigest();
    for (const [target, buildUrl, runtimeUrl, buildKey, runtimeKey] of [
      ["development", "", urlB, "", contact ? keyB : ""],
      ["staging", urlA, urlB, contact ? keyA : "", contact ? keyB : ""],
      ["production", urlB, urlA, contact ? keyB : "", contact ? keyA : ""],
    ]) {
      assert.equal(await sourceDigest(), sourceHash);
      const inputs = { APPLICATION_ENVIRONMENT: target, NEXT_PUBLIC_CALENDLY_URL: buildUrl, NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY: buildKey };
      await run(`${target}-next`, ["--dir", "apps/web", "run", "build"], inputs);
      await run(`${target}-opennext`, ["--dir", "apps/web", "exec", "opennextjs-cloudflare", "build", "--skipNextBuild"], {
        ...inputs, ...(target === "development" ? {} : { CLOUDFLARE_ENV: target }),
      });
      const before = await artifactDigest();
      const observed = await browser(`${target}-prepared`, "preview", target, runtimeUrl, buildUrl, runtimeKey, buildKey);
      assert.deepEqual(await artifactDigest(), before, "worker and sorted static assets must remain byte-identical after runtime challenge");
      assert.equal(await sourceDigest(), sourceHash);
      artifacts.push({ profile, bookingMode, target, sourceHash, ...before, ...observed });
      await writeFile(join(owner, "artifacts.json"), JSON.stringify(artifacts, null, 2));
    }
    context.diagnostic(JSON.stringify({ owner, artifacts, providers: "all third-party attempts intercepted before navigation" }));
  });
}
