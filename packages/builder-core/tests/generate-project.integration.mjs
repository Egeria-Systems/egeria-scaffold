import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { cp, lstat, mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from "node:fs/promises";
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

const environmentAnalyticsSelection = {
  consent: { policy: "explicit-opt-in" },
  providers: { cloudflareWebAnalytics: true, googleAnalytics4: true, microsoftClarity: { audience: "not-directed-to-minors" } },
  operationalIntegrations: { googleSearchConsole: true, lookerStudio: { connector: "google-analytics-4" } },
};

for (const [name, profile, contact, booking, multilingual, searchOnly] of [
  ["composed-site", "site", true, "popup", true, false],
  ["portfolio", "portfolio", false, undefined, false, false],
  ["application", "app", false, "inline", false, false],
  ["search-only", "site", false, undefined, false, true],
]) {
  test(`environment analytics builds freeze ${name} activation and destinations`, { timeout: 90 * 60 * 1000 }, async context => {
    const owner = await mkdtemp(join(tmpdir(), `egeria-environment-analytics-${name}-`));
    context.diagnostic(`Retained analytics evidence: ${owner}`);
    const supportRoot = join(owner, "support");
    await mkdir(supportRoot);
    const support = await prepareLiveSupport(supportRoot);
    const environment = { ...support.environment, ...await derivePnpmToolEnvironment("pnpm"), WRANGLER_SEND_METRICS: "false" };
    const commands = [];
    const artifacts = [];
    const identifiersA = {
      NEXT_PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN: "0123456789abcdef0123456789abcdef",
      NEXT_PUBLIC_GA4_MEASUREMENT_ID: "G-TEST123456",
      NEXT_PUBLIC_CLARITY_PROJECT_ID: "qatest1234",
      NEXT_PUBLIC_SITE_URL: "https://qa.analytics-test.invalid",
      NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION: "synthetic-nonproduction-verification",
      NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY: contact ? "00000000-0000-4000-8000-000000000001" : "",
      NEXT_PUBLIC_CALENDLY_URL: booking === undefined ? "" : "https://calendly.com/egeria-synthetic-nonproduction/intro",
    };
    const identifiersB = {
      NEXT_PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN: "fedcba9876543210fedcba9876543210",
      NEXT_PUBLIC_GA4_MEASUREMENT_ID: "G-PROD123456",
      NEXT_PUBLIC_CLARITY_PROJECT_ID: "prodtest1234",
      NEXT_PUBLIC_SITE_URL: "https://www.analytics-live.invalid",
      NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION: "synthetic-production-verification",
      NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY: contact ? "00000000-0000-4000-8000-000000000002" : "",
      NEXT_PUBLIC_CALENDLY_URL: booking === undefined ? "" : "https://calendly.com/egeria-synthetic-production/intro",
    };
    const analytics = searchOnly ? { consent: { policy: "explicit-opt-in" }, providers: {}, operationalIntegrations: { googleSearchConsole: true } } : environmentAnalyticsSelection;
    const destination = join(owner, "generated");
    const generated = assertSuccess(await generateProject({
      request: { profile, projectName: `analytics-${name}`, displayName: "Analytics Example", analytics,
        ...(contact ? { contactFormWeb3Forms: true } : {}), ...(booking === undefined ? {} : { bookingCalendly: { mode: booking } }), ...(multilingual ? { multilingual: true } : {}),
      }, destination, renderingContext: createApplicationEnvironmentRenderingContext(),
      verifier: createPnpmGeneratedProjectVerifier({ pnpmExecutable: "pnpm" }),
    }));
    assert.equal(generated.state.installedCapabilities.find(value => value.identifier === "analytics")?.version, "0.2.0");
    await writeFile(join(owner, "generation-state.json"), JSON.stringify(generated.state, null, 2));
    const project = join(owner, "browser-proof");
    await cp(destination, project, { recursive: true, force: false, errorOnExist: true, dereference: false });
    const app = join(project, "apps/web");
    async function run(label, arguments_, additions = {}, succeeds = true) {
      let result;
      try {
        result = await runPnpm(arguments_, { cwd: project, env: { ...environment, ...additions } });
        commands.push({ label, arguments: arguments_, exitCode: 0 });
      } catch (error) {
        result = { stdout: error.stdout ?? "", stderr: error.stderr ?? "" };
        commands.push({ label, arguments: arguments_, exitCode: error.code });
        if (succeeds) { await writeFile(join(owner, `${label}.log`), result.stdout + result.stderr); throw error; }
      } finally { await writeFile(join(owner, "commands.json"), JSON.stringify(commands, null, 2)); }
      await writeFile(join(owner, `${label}.log`), result.stdout + result.stderr);
      assert.equal(commands.at(-1).exitCode === 0, succeeds, label);
      return result;
    }
    const entries = await readdir(destination, { recursive: true, withFileTypes: true });
    const sourcePaths = entries.filter(entry => entry.isFile()).map(entry => join(entry.parentPath, entry.name).slice(destination.length + 1)).sort();
    async function sourceDigest() {
      const hash = createHash("sha256");
      for (const path of sourcePaths) { hash.update(path); hash.update(await readFile(join(project, path))); }
      return hash.digest("hex");
    }
    async function artifactDigest() {
      const staticRoot = join(app, ".open-next/assets");
      const entries = await readdir(staticRoot, { recursive: true, withFileTypes: true });
      const paths = entries.filter(entry => entry.isFile()).map(entry => join(entry.parentPath, entry.name).slice(staticRoot.length + 1)).sort();
      const hash = createHash("sha256");
      for (const path of paths) { hash.update(path); hash.update(await readFile(join(staticRoot, path))); }
      return { workerSha256: createHash("sha256").update(await readFile(join(app, ".open-next/worker.js"))).digest("hex"), staticSha256: hash.digest("hex"), staticFiles: paths.length };
    }
    async function browser(label, mode, build, runtime) {
      const expectedOrigin = build.NEXT_PUBLIC_SITE_URL || "https://qa.analytics-test.invalid";
      const configPath = join(app, "playwright.analytics-acceptance.config.ts");
      await writeFile(configPath, `import config from "./playwright.preview.config";\nexport default { ...config, retries: 0, use: { ...config.use, baseURL: ${JSON.stringify(expectedOrigin)} }, ${mode === "dev" ? 'webServer: { command: "pnpm run dev --hostname 127.0.0.1 --port 3101", url: "http://127.0.0.1:3101", reuseExistingServer: false, timeout: 180000 },' : ""} };\n`);
      const reportPath = join(owner, `${label}.json`);
      await run(label, ["--dir", "apps/web", "exec", "playwright", "test", "--config", configPath, "tests/e2e/analytics-consent.spec.ts", "--reporter=json", "--output", join(owner, `${label}-results`)], {
        ...runtime,
        ...(mode === "dev" ? { WATCHPACK_POLLING: "true" } : {}),
        ...(mode === "preview" && build.APPLICATION_ENVIRONMENT !== "development" ? { CLOUDFLARE_ENV: build.APPLICATION_ENVIRONMENT } : {}),
        ANALYTICS_TEST_BUILD_FLAG: build.NEXT_PUBLIC_ANALYTICS_ENABLED,
        ANALYTICS_TEST_EXPECTED_CLOUDFLARE_TOKEN: searchOnly ? "" : build.NEXT_PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN,
        ANALYTICS_TEST_EXPECTED_GA4_ID: searchOnly ? "" : build.NEXT_PUBLIC_GA4_MEASUREMENT_ID,
        ANALYTICS_TEST_EXPECTED_CLARITY_ID: searchOnly ? "" : build.NEXT_PUBLIC_CLARITY_PROJECT_ID,
        ANALYTICS_TEST_EXPECTED_SITE_ORIGIN: searchOnly ? "" : build.NEXT_PUBLIC_SITE_URL,
        ANALYTICS_TEST_EXPECTED_VERIFICATION: build.APPLICATION_ENVIRONMENT === "production" ? build.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION : "",
        ANALYTICS_TEST_TARGET: build.APPLICATION_ENVIRONMENT,
        CONTACT_TEST_EXPECTED_ACCESS_KEY: build.NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY,
        BOOKING_TEST_EXPECTED_URL: build.NEXT_PUBLIC_CALENDLY_URL,
        ...(booking === undefined ? {} : { BOOKING_TEST_MODE: booking }),
        PLAYWRIGHT_JSON_OUTPUT_FILE: reportPath,
      });
      const report = JSON.parse(await readFile(reportPath, "utf8"));
      const active = build.NEXT_PUBLIC_ANALYTICS_ENABLED === "true" && build.NEXT_PUBLIC_GA4_MEASUREMENT_ID !== "";
      const expected = searchOnly ? 1 : 14 + (multilingual ? 2 : 1) * (active ? 2 : 1) + (active ? 1 : 0) + (contact || booking !== undefined ? 1 : 0);
      assert.equal(report.stats.expected, expected, label);
      assert.equal(report.stats.skipped, 0, label);
      assert.equal(report.stats.unexpected, 0, label);
      assert.equal(report.stats.flaky, 0, label);
      return { executed: report.stats.expected, skipped: report.stats.skipped, report: reportPath };
    }
    await run("install", ["install", "--frozen-lockfile", "--store-dir", support.store]);
    await run("browser-install", ["--dir", "apps/web", "run", "browser:install"]);
    if (name === "composed-site") {
      for (const [label, overrides, pattern] of [
        ["missing-active", { NEXT_PUBLIC_GA4_MEASUREMENT_ID: "" }, /ANALYTICS_CONFIGURATION_INVALID.*NEXT_PUBLIC_GA4_MEASUREMENT_ID.*missing/u],
        ["invalid-off", { NEXT_PUBLIC_ANALYTICS_ENABLED: "false", NEXT_PUBLIC_GA4_MEASUREMENT_ID: "invalid-analytics-input-sentinel" }, /ANALYTICS_CONFIGURATION_INVALID.*NEXT_PUBLIC_GA4_MEASUREMENT_ID.*invalid/u],
        ["production-verification", { APPLICATION_ENVIRONMENT: "production", NEXT_PUBLIC_ANALYTICS_ENABLED: "false", NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION: "" }, /ANALYTICS_CONFIGURATION_INVALID.*NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION.*missing/u],
        ["target-conflict", { NEXT_PUBLIC_APPLICATION_ENVIRONMENT: "production", NEXT_PUBLIC_GA4_MEASUREMENT_ID: "invalid-analytics-input-sentinel" }, /APPLICATION_ENVIRONMENT_INVALID/u],
      ]) {
        for (const command of ["check:environment:deployment", "build"]) {
          const result = await run(`${label}-${command.replaceAll(":", "-")}`, ["--dir", "apps/web", "run", command], { ...identifiersA, APPLICATION_ENVIRONMENT: "staging", NEXT_PUBLIC_ANALYTICS_ENABLED: "true", ...overrides }, false);
          assert.match(result.stderr, pattern);
          assert.doesNotMatch(result.stdout + result.stderr, /invalid-analytics-input-sentinel/u);
        }
      }
      await writeFile(join(app, ".env.local"), "NEXT_PUBLIC_GA4_MEASUREMENT_ID=invalid-local-input-sentinel\n");
      const local = { APPLICATION_ENVIRONMENT: "development", NEXT_PUBLIC_ANALYTICS_ENABLED: "false" };
      await run("env-local-process-only", ["--dir", "apps/web", "run", "check:environment"], local);
      const rejected = await run("env-local-next-load", ["--dir", "apps/web", "run", "build"], local, false);
      assert.match(rejected.stderr, /ANALYTICS_CONFIGURATION_INVALID:NEXT_PUBLIC_GA4_MEASUREMENT_ID:invalid/u);
      assert.doesNotMatch(rejected.stdout + rejected.stderr, /invalid-local-input-sentinel/u);
      await rm(join(app, ".env.local")); // this test's own deliberately invalid input
      const partial = { ...identifiersA, APPLICATION_ENVIRONMENT: "development", NEXT_PUBLIC_ANALYTICS_ENABLED: "true", NEXT_PUBLIC_GA4_MEASUREMENT_ID: "", NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY: "", NEXT_PUBLIC_CALENDLY_URL: "", NEXT_PUBLIC_SITE_URL: "http://127.0.0.1:3101" };
      await browser("development-missing-local-inputs", "dev", partial, partial);
    }
    const sourceHash = await sourceDigest();
    const matrix = searchOnly ? [["development", "false", identifiersA, identifiersB], ["staging", "false", identifiersA, identifiersB], ["production", "false", identifiersB, identifiersA]] :
      name === "composed-site" ? [["development", "false", identifiersA, identifiersB], ["staging", "true", identifiersA, identifiersB], ["production", "true", identifiersB, identifiersA]] :
        [["development", "false", identifiersA, identifiersB], ["development", "true", identifiersA, identifiersB]];
    for (const [target, flag, identifiers, contradiction] of matrix) {
      assert.equal(await sourceDigest(), sourceHash);
      const label = `${target}-${flag}`;
      const build = { ...identifiers, APPLICATION_ENVIRONMENT: target, NEXT_PUBLIC_ANALYTICS_ENABLED: flag };
      const runtime = { ...contradiction, APPLICATION_ENVIRONMENT: target, NEXT_PUBLIC_ANALYTICS_ENABLED: flag === "true" ? "false" : "true" };
      await run(`${label}-next`, ["--dir", "apps/web", "run", "build"], build);
      await run(`${label}-opennext`, ["--dir", "apps/web", "exec", "opennextjs-cloudflare", "build", "--skipNextBuild"], { ...build, ...(target === "development" ? {} : { CLOUDFLARE_ENV: target }) });
      const before = await artifactDigest();
      const staticEntries = await readdir(join(app, ".open-next/assets"), { recursive: true, withFileTypes: true });
      const chunks = [];
      for (const entry of staticEntries) if (entry.isFile() && entry.name.endsWith(".js")) chunks.push(await readFile(join(entry.parentPath, entry.name), "utf8"));
      const browserBytes = chunks.join("\n");
      if (!searchOnly) {
        for (const key of ["NEXT_PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN", "NEXT_PUBLIC_GA4_MEASUREMENT_ID", "NEXT_PUBLIC_CLARITY_PROJECT_ID"]) {
          assert.ok(browserBytes.includes(identifiers[key]), key);
          assert.equal(browserBytes.includes(contradiction[key]), false, key);
        }
      }
      assert.equal(browserBytes.includes(identifiersA.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION), false);
      if (target !== "production") assert.equal(browserBytes.includes(identifiersB.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION), false);
      const observed = await browser(`${label}-runtime-challenge`, "preview", build, runtime);
      assert.deepEqual(await artifactDigest(), before);
      assert.equal(await sourceDigest(), sourceHash);
      artifacts.push({ name, profile, target, sourceHash, rawBuildFlag: flag, build, runtime, ...before, ...observed });
      await writeFile(join(owner, "artifacts.json"), JSON.stringify(artifacts, null, 2));
      if (name === "composed-site" && flag === "false") {
        const reportPath = join(owner, "disabled-neighbor-browser.json");
        await run("disabled-neighbor-browser", ["--dir", "apps/web", "run", "test:e2e:preview", "--reporter=json", "--output", join(owner, "disabled-neighbor-results"), "web3forms-contact.spec.ts", "calendly-booking.spec.ts"], {
          ...runtime, CONTACT_TEST_EXPECTED_ACCESS_KEY: build.NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY, BOOKING_TEST_EXPECTED_URL: build.NEXT_PUBLIC_CALENDLY_URL,
          BOOKING_TEST_MODE: booking, BOOKING_TEST_MULTILINGUAL: String(multilingual), PLAYWRIGHT_JSON_OUTPUT_FILE: reportPath,
        });
        const report = JSON.parse(await readFile(reportPath, "utf8"));
        assert.equal(report.stats.expected, 17);
        assert.equal(report.stats.unexpected, 0);
        assert.equal(report.stats.flaky, 0);
        assert.deepEqual(await artifactDigest(), before);
      }
    }
    context.diagnostic(JSON.stringify({ owner, artifacts, providerBoundary: "synthetic intercepted requests only" }));
  });
}


test("environment persistence generation and lifecycle preserve target isolation", { timeout: 60 * 60 * 1000 }, async context => {
  const owner = await realpath(await mkdtemp(join(tmpdir(), "egeria-environment-persistence-")));
  context.diagnostic(`Retained local persistence evidence: ${owner}`);
  const primary = join(owner, "primary");
  const linked = join(owner, "linked");
  const commands = [];
  const cliUrl = new URL("../../../apps/cli/dist/run-cli.js", import.meta.url).href;
  const coreUrl = new URL("../dist/index.js", import.meta.url).href;
  async function command(label, executable, arguments_, cwd = owner) {
    try {
      const result = await execFileAsync(executable, arguments_, { cwd, encoding: "utf8", maxBuffer: 5 * 1024 * 1024, timeout: 20 * 60 * 1000, env: { PATH: process.env.PATH, LANG: process.env.LANG } });
      await writeFile(join(owner, `${label}.log`), result.stdout + result.stderr);
      commands.push({ label, executable, exitCode: 0 });
      return result.stdout;
    } catch (error) {
      await writeFile(join(owner, `${label}.log`), (error.stdout ?? "") + (error.stderr ?? ""));
      commands.push({ label, executable, exitCode: error.code });
      throw error;
    } finally { await writeFile(join(owner, "commands.json"), JSON.stringify(commands, null, 2)); }
  }
  async function cli(label, arguments_) {
    const source = `import { createCliRunner } from ${JSON.stringify(cliUrl)};
import { createPnpmGeneratedProjectVerifier } from ${JSON.stringify(coreUrl)};
const run = createCliRunner({ createVerifier: () => createPnpmGeneratedProjectVerifier({ pnpmExecutable: "pnpm" }) }, "2.0.0");
process.exitCode = await run(${JSON.stringify(arguments_)}, { write: value => process.stdout.write(value), writeError: value => process.stderr.write(value) });`;
    return JSON.parse(await command(label, process.execPath, ["--input-type=module", "-e", source]));
  }
  async function commitFixture(label, root) {
    await command(`${label}-add`, "git", ["add", "-A"], root);
    await command(`${label}-commit`, "git", ["commit", "-m", label], root);
  }
  const created = await cli("create", ["create", "--profile", "app", "--name", "persistence-example", "--display-name", "Persistence Example", "--directory", primary, "--application-persistence", "--multilingual", "--contact-form-web3forms", "--booking-calendly", "--calendly-mode", "link", "--google-analytics-4"]);
  assert.equal(created.ok, true);
  const initialState = JSON.parse(await readFile(join(primary, ".egeria/state.json"), "utf8"));
  assert.equal(initialState.schemaVersion, "2.0.0");
  for (const lane of ["cloudflare-types", "unit-tests", "next-build", "opennext-build", "worker-integration", "binding-integration"]) assert.ok(initialState.lastSuccessfulVerification.checks.includes(lane));
  const initialProject = await readFile(join(primary, ".egeria/project.yaml"));
  const initialLock = await readFile(join(primary, "pnpm-lock.yaml"));
  for (const operation of ["infer", "doctor"]) assert.equal((await cli(`initial-${operation}`, [operation, "--directory", primary])).ok, true);
  await command("fixture-init", "git", ["init", "--initial-branch=main", primary]);
  await command("fixture-name", "git", ["config", "user.name", "Persistence Integration Test"], primary);
  await command("fixture-email", "git", ["config", "user.email", "persistence-test@example.test"], primary);
  await commitFixture("generated-persistence", primary);
  await command("fixture-worktree", "git", ["worktree", "add", "-b", "persistence-lifecycle-test", linked], primary);

  // This evidence and its acceptances exercise only the synthetic source-removal contract.
  const inputPath = join(owner, "removal.json");
  const reviewPath = join(owner, "review.json");
  const databases = [{ environment: "local", databaseId: "local-test-database" }];
  const input = { databases, policy: { exportNotBefore: "2026-09-26T00:00:00Z", retainUntil: "2026-10-26T00:00:00Z", recoveryRequirements: [{ environment: "local", scope: "local" }], writeConsistency: "writes-paused" } };
  await writeFile(inputPath, JSON.stringify(input));
  const removalArguments = ["--directory", linked, "--capability", "application-persistence", "--persistence-removal", inputPath];
  const initialPlan = (await cli("removal-subject", ["plan-remove", ...removalArguments])).plan;
  const exportBytes = "synthetic local contract export\n";
  const recoveryBytes = "synthetic local contract recovery\n";
  const digest = bytes => `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
  await mkdir(join(linked, ".wrangler/removal-evidence"), { recursive: true });
  await writeFile(join(linked, ".wrangler/removal-evidence/export.sql"), exportBytes);
  await writeFile(join(linked, ".wrangler/removal-evidence/recovery.json"), recoveryBytes);
  input.evidence = { schemaVersion: "1.0.0", subject: { ...initialPlan.persistenceRemovalSubject, databases }, databases: [{ ...databases[0],
    export: { artifactReference: "local-export", digest: digest(exportBytes), completedAt: "2026-09-26T01:00:00Z", outcome: "passed" },
    recovery: { artifactReference: "local-recovery", digest: digest(recoveryBytes), exportDigest: digest(exportBytes), scope: "local", restoration: "passed", readback: "passed" },
    writeConsistency: { mode: "writes-paused", outcome: "passed" }, retention: { retainedUntil: "2026-10-26T00:00:00Z", outcome: "passed" },
  }] };
  input.localArtifacts = [{ reference: "local-export", path: ".wrangler/removal-evidence/export.sql" }, { reference: "local-recovery", path: ".wrangler/removal-evidence/recovery.json" }];
  await writeFile(inputPath, JSON.stringify(input));
  const removalPlan = (await cli("plan-remove", ["plan-remove", ...removalArguments])).plan;
  assert.equal(removalPlan.persistenceRemovalReport.recommendation, "ready-for-human-review");
  await writeFile(reviewPath, JSON.stringify({ reportFingerprint: removalPlan.persistenceRemovalReport.reportFingerprint, dispositions: removalPlan.persistenceRemovalReport.requiredReviewItems.map(({ identifier }) => ({ identifier, disposition: "accepted" })) }));
  const removed = await cli("apply-remove", ["apply-remove", ...removalArguments, "--persistence-human-review", reviewPath, "--approved-plan", removalPlan.planFingerprint]);
  assert.equal(removed.ok, true);
  assert.equal(removed.result.status, "verified-final-diff-approval-required");
  const removedState = JSON.parse(await readFile(join(linked, ".egeria/state.json"), "utf8"));
  assert.equal(removedState.installedCapabilities.find(({ identifier }) => identifier === "standards").version, "0.7.0");
  assert.equal(removedState.installedCapabilities.find(({ identifier }) => identifier === "deployment-cloudflare").version, "0.7.0");
  assert.equal(removedState.installedCapabilities.some(({ identifier }) => identifier === "application-persistence"), false);
  assert.equal(removedState.lastSuccessfulVerification.checks.includes("binding-integration"), false);
  await commitFixture("removed-persistence", linked);
  const additionArguments = ["--directory", linked, "--capability", "application-persistence"];
  const additionPlan = (await cli("plan-readd", ["plan-add", ...additionArguments])).result;
  const added = await cli("apply-readd", ["apply-add", ...additionArguments, "--approved-plan", additionPlan.planFingerprint]);
  assert.equal(added.ok, true);
  assert.equal(added.result.status, "verified-final-diff-approval-required");
  const finalState = JSON.parse(await readFile(join(linked, ".egeria/state.json"), "utf8"));
  assert.deepEqual(finalState.appliedMigrations, ["remove-application-persistence-0-2-0", "add-application-persistence-0-2-0"]);
  for (const [identifier, version] of [["application-persistence", "0.2.0"], ["standards", "0.8.0"], ["deployment-cloudflare", "0.8.0"], ["app-foundation", "0.3.0"]]) assert.equal(finalState.installedCapabilities.find(capability => capability.identifier === identifier).version, version);
  assert.ok(finalState.lastSuccessfulVerification.checks.includes("binding-integration"));
  assert.deepEqual(await readFile(join(linked, ".egeria/project.yaml")), initialProject);
  assert.deepEqual(await readFile(join(linked, "pnpm-lock.yaml")), initialLock);
  for (const operation of ["infer", "doctor"]) assert.equal((await cli(`final-${operation}`, [operation, "--directory", linked])).ok, true);
  await writeFile(join(owner, "verification-evidence.json"), JSON.stringify({ initial: initialState.lastSuccessfulVerification, removed: removedState.lastSuccessfulVerification, restored: finalState.lastSuccessfulVerification, localSyntheticOnly: true, providerAccess: false }, null, 2));
});

test("environment email generation and lifecycle preserve recipient isolation", { timeout: 90 * 60 * 1000 }, async context => {
  const owner = await realpath(await mkdtemp(join(tmpdir(), "egeria-environment-email-")));
  context.diagnostic(`Retained local email evidence: ${owner}`);
  const cliUrl = new URL("../../../apps/cli/dist/run-cli.js", import.meta.url).href;
  const coreUrl = new URL("../dist/index.js", import.meta.url).href;
  const commands = [];
  const receipts = [];
  const supportRoot = join(owner, "support");
  await mkdir(supportRoot);
  const support = await prepareLiveSupport(supportRoot);
  const environment = { ...support.environment, ...await derivePnpmToolEnvironment("pnpm"), WRANGLER_SEND_METRICS: "false" };
  const digest = bytes => createHash("sha256").update(bytes).digest("hex");
  async function command(label, executable, arguments_, cwd = owner, additions = {}) {
    try {
      const result = await execFileAsync(executable, arguments_, { cwd, encoding: "utf8", maxBuffer: 5 * 1024 * 1024, timeout: 20 * 60 * 1000, env: { ...environment, ...additions } });
      await writeFile(join(owner, `${label}.log`), result.stdout + result.stderr);
      commands.push({ label, executable, arguments: arguments_, exitCode: 0 });
      return result.stdout;
    } catch (error) {
      await writeFile(join(owner, `${label}.log`), (error.stdout ?? "") + (error.stderr ?? ""));
      commands.push({ label, executable, arguments: arguments_, exitCode: error.code });
      throw error;
    } finally { await writeFile(join(owner, "commands.json"), JSON.stringify(commands, null, 2)); }
  }
  async function cli(label, arguments_) {
    const source = `import { createCliRunner } from ${JSON.stringify(cliUrl)};
import { createPnpmGeneratedProjectVerifier } from ${JSON.stringify(coreUrl)};
const run = createCliRunner({ createVerifier: () => createPnpmGeneratedProjectVerifier({ pnpmExecutable: "pnpm" }) }, "2.0.0");
process.exitCode = await run(${JSON.stringify(arguments_)}, { write: value => process.stdout.write(value), writeError: value => process.stderr.write(value) });`;
    return JSON.parse(await command(label, process.execPath, ["--input-type=module", "-e", source]));
  }
  async function record(label, root, email, persistence) {
    const state = JSON.parse(await readFile(join(root, ".egeria/state.json"), "utf8"));
    const versions = Object.fromEntries(state.installedCapabilities.map(({ identifier, version }) => [identifier, version]));
    assert.equal(versions["transactional-email-resend"], email ? "0.2.0" : undefined);
    assert.equal(versions["application-persistence"], persistence ? "0.2.0" : undefined);
    if (email || label.includes("remove")) assert.equal(versions["app-foundation"], "0.3.0");
    assert.equal(versions["site-routing"], state.origin.profile === "portfolio" ? undefined : "0.4.0");
    for (const operation of ["infer", "doctor"]) assert.equal((await cli(`${label}-${operation}`, [operation, "--directory", root])).ok, true);
    receipts.push({ label, root, versions, verification: state.lastSuccessfulVerification,
      projectSha256: digest(await readFile(join(root, ".egeria/project.yaml"))), lockSha256: digest(await readFile(join(root, "pnpm-lock.yaml"))) });
    await writeFile(join(owner, "verification-evidence.json"), JSON.stringify({ receipts, localSyntheticOnly: true, liveProviderAccess: false }, null, 2));
  }
  async function commitFixture(label, root) {
    await command(`${label}-add-files`, "git", ["add", "-A"], root);
    await command(`${label}-commit`, "git", ["commit", "-m", label], root);
  }
  const projects = new Map();
  for (const profile of ["portfolio", "site", "app"]) {
    const primary = join(owner, `${profile}-primary`);
    const selected = profile === "portfolio" ? [] : ["--transactional-email-resend"];
    const neighbors = profile === "app" ? ["--application-persistence", "--contact-form-web3forms", "--booking-calendly", "--calendly-mode", "link", "--google-analytics-4"] : [];
    const created = await cli(`${profile}-create`, ["create", "--profile", profile, "--name", "email-example", "--display-name", "Email Example", "--directory", primary, ...selected, ...neighbors]);
    assert.equal(created.ok, true);
    await record(`${profile}-create`, primary, profile !== "portfolio", profile === "app");
    if (profile === "site") { projects.set(profile, primary); continue; }
    await command(`${profile}-init`, "git", ["init", "--initial-branch=main", primary]);
    await command(`${profile}-name`, "git", ["config", "user.name", "Email Integration Test"], primary);
    await command(`${profile}-identity`, "git", ["config", "user.email", "email-test@example.test"], primary);
    await commitFixture(`${profile}-generated`, primary);
    const primaryProject = await readFile(join(primary, ".egeria/project.yaml"));
    const primaryLock = await readFile(join(primary, "pnpm-lock.yaml"));
    const linked = join(owner, `${profile}-linked`);
    await command(`${profile}-worktree`, "git", ["worktree", "add", "-b", `${profile}-email-lifecycle-test`, linked], primary);
    const neighborPaths = profile === "app" ? ["apps/web/src/configuration/application-database.ts", "apps/web/src/integrations/contact-form-web3forms/contact-settings.ts", "apps/web/src/integrations/booking-calendly/booking-settings.ts", "apps/web/src/integrations/analytics/analytics-configuration.ts"] : [];
    const neighborBytes = new Map(await Promise.all(neighborPaths.map(async path => [path, await readFile(join(linked, path))])));
    for (const [index, operation] of (profile === "portfolio" ? ["add", "remove", "add"] : ["remove", "add"]).entries()) {
      const label = `${profile}-${index}-${operation}`;
      const arguments_ = ["--directory", linked, "--capability", "transactional-email-resend"];
      const envelope = await cli(`${label}-plan`, [`plan-${operation}`, ...arguments_]);
      const plan = operation === "add" ? envelope.result : envelope.plan;
      assert.equal(plan.capability.version, "0.2.0");
      const executed = await cli(`${label}-apply`, [`apply-${operation}`, ...arguments_, "--approved-plan", plan.planFingerprint]);
      assert.equal(executed.ok, true);
      assert.equal(executed.result.status, "verified-final-diff-approval-required");
      await record(label, linked, operation === "add", profile === "app");
      for (const [path, bytes] of neighborBytes) assert.deepEqual(await readFile(join(linked, path)), bytes);
      if (profile === "app") assert.deepEqual(await readFile(join(linked, "pnpm-lock.yaml")), primaryLock);
      await commitFixture(label, linked);
    }
    assert.deepEqual(await readFile(join(primary, ".egeria/project.yaml")), primaryProject);
    assert.deepEqual(await readFile(join(primary, "pnpm-lock.yaml")), primaryLock);
    projects.set(profile, linked);
  }

  const workerProject = join(owner, "intercepted-worker");
  await cp(projects.get("portfolio"), workerProject, { recursive: true, filter: source => ![".git", "node_modules", ".next", ".open-next", ".wrangler"].includes(source.split("/").at(-1)) });
  const app = join(workerProject, "apps/web");
  await mkdir(join(app, "app/email-proof"));
  await writeFile(join(app, "app/email-proof/route.ts"), `import { Cause, Effect, Exit } from "effect";
import { TransactionalEmailSender } from "@/src/application/transactional-email-sender";
import { serverTransactionalEmailLayer } from "@/src/composition/server-transactional-email";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  let attemptedCalls = 0;
  const previous = globalThis.fetch;
  globalThis.fetch = async input => {
    if (input !== "https://api.resend.com/emails") throw new Error("Unexpected transport");
    attemptedCalls += 1;
    return Response.json({ id: "synthetic-acceptance" });
  };
  try {
    const recipient = new URL(request.url).searchParams.has("unauthorized") ? "different@example.test" : "allowed@example.test";
    const program = Effect.gen(function* () {
      const sender = yield* TransactionalEmailSender;
      return yield* sender.send({ to: recipient, subject: "Synthetic example", text: "Synthetic message", idempotencyKey: "worker-example-001" });
    }).pipe(Effect.provide(serverTransactionalEmailLayer));
    const result = await Effect.runPromiseExit(program);
    const reason = Exit.isFailure(result) ? result.cause.reasons.find(Cause.isFailReason) : undefined;
    return Response.json({ outcome: Exit.isSuccess(result) ? "accepted" : reason?.error.code ?? "unexpected-failure", attemptedCalls });
  } finally { globalThis.fetch = previous; }
}
`);
  const harnessPath = join(app, "email-proof.mjs");
  await writeFile(harnessPath, `import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createTestHarness } from "wrangler";
const target = process.env.APPLICATION_ENVIRONMENT;
const generated = JSON.parse(await readFile("wrangler.jsonc", "utf8"));
const base = { ...generated, main: resolve(".open-next/worker.js"), assets: { ...generated.assets, directory: resolve(".open-next/assets") } };
delete base.env; delete base.$schema;
const valid = { ...base.vars, APPLICATION_ENVIRONMENT: target, RESEND_API_KEY: "re_controlled_test_credential", TRANSACTIONAL_EMAIL_FROM: "sender@example.test", TRANSACTIONAL_EMAIL_DOMAIN: "example.test", ...(target === "production" ? {} : { TRANSACTIONAL_EMAIL_ALLOWED_RECIPIENTS: "allowed@example.test,second@example.test" }) };
const cases = [
  { name: "matching", values: valid, outcome: "accepted", calls: 1 },
  { name: "missing-target", values: { ...valid, APPLICATION_ENVIRONMENT: undefined }, outcome: "transactional-email-configuration", calls: 0 },
  { name: "invalid-target", values: { ...valid, APPLICATION_ENVIRONMENT: "invalid" }, outcome: "transactional-email-configuration", calls: 0 },
  { name: "opposite-target", values: { ...valid, APPLICATION_ENVIRONMENT: target === "production" ? "staging" : "production" }, outcome: "transactional-email-configuration", calls: 0 },
  { name: "invalid-key", values: { ...valid, RESEND_API_KEY: "invalid" }, outcome: "transactional-email-configuration", calls: 0 },
  { name: "invalid-sender", values: { ...valid, TRANSACTIONAL_EMAIL_FROM: "invalid" }, outcome: "transactional-email-configuration", calls: 0 },
  ...(target === "production" ? [{ name: "ignored-list", values: { ...valid, TRANSACTIONAL_EMAIL_ALLOWED_RECIPIENTS: "invalid" }, outcome: "accepted", calls: 1 }] : [
    { name: "missing-list", values: { ...valid, TRANSACTIONAL_EMAIL_ALLOWED_RECIPIENTS: undefined }, outcome: "transactional-email-configuration", calls: 0 },
    { name: "malformed-list", values: { ...valid, TRANSACTIONAL_EMAIL_ALLOWED_RECIPIENTS: "allowed@example.test," }, outcome: "transactional-email-configuration", calls: 0 },
    { name: "unauthorized", values: valid, query: "?unauthorized", outcome: "transactional-email-authorization", calls: 0 },
  ]),
  { name: "restored", values: valid, outcome: "accepted", calls: 1 },
];
const outcomes = [];
for (const scenario of cases) {
  const configPath = resolve("email-proof.wrangler.json");
  await writeFile(configPath, JSON.stringify({ ...base, vars: scenario.values }));
  const server = createTestHarness({ workers: [{ configPath }] });
  try {
    await server.listen();
    const response = await server.fetch("/email-proof" + (scenario.query ?? ""), { method: "POST" });
    assert.equal(response.status, 200, scenario.name);
    const result = await response.json();
    assert.deepEqual(result, { outcome: scenario.outcome, attemptedCalls: scenario.calls }, scenario.name);
    outcomes.push({ name: scenario.name, ...result });
  } finally { await server.close(); }
}
await writeFile(process.argv[2], JSON.stringify({ target, outcomes }, null, 2));
`);
  await command("worker-install", "pnpm", ["install", "--frozen-lockfile", "--store-dir", support.store], workerProject);
  await command("worker-consumer-typecheck", "pnpm", ["--dir", "apps/web", "run", "typecheck"], workerProject);
  async function hashTree(root) {
    const paths = (await readdir(root, { recursive: true, withFileTypes: true })).filter(entry => entry.isFile()).map(entry => join(entry.parentPath, entry.name)).sort();
    const hash = createHash("sha256");
    for (const path of paths) hash.update(path.slice(root.length)).update(await readFile(path));
    return { sha256: hash.digest("hex"), files: paths.length };
  }
  const sourceBefore = await hashTree(join(app, "src"));
  const consumerBefore = await readFile(join(app, "app/email-proof/route.ts"));
  const artifactEvidence = [];
  for (const target of ["development", "staging", "production"]) {
    await command(`${target}-build`, "pnpm", ["--dir", "apps/web", "run", "build:cloudflare"], workerProject, { APPLICATION_ENVIRONMENT: target });
    const artifact = { target, worker: await hashTree(join(app, ".open-next")), source: sourceBefore, consumerSha256: digest(consumerBefore) };
    await command(`${target}-challenges`, process.execPath, [harnessPath, join(owner, `${target}-outcomes.json`)], app, { APPLICATION_ENVIRONMENT: target });
    assert.deepEqual(await hashTree(join(app, ".open-next")), artifact.worker);
    assert.deepEqual(await hashTree(join(app, "src")), sourceBefore);
    assert.deepEqual(await readFile(join(app, "app/email-proof/route.ts")), consumerBefore);
    artifactEvidence.push(artifact);
    await writeFile(join(owner, "worker-artifacts.json"), JSON.stringify(artifactEvidence, null, 2));
  }

  // These temporary consumers use existing jobs contracts without candidate admission or a product job flow.
  const jobsRoot = new URL("../templates/background-job-delivery/apps/web/", import.meta.url);
  for (const path of ["src/application/job-delivery.ts", "src/application/job-handlers.ts", "src/composition/server-jobs.ts", "src/infrastructure/cloudflare/job-delivery.ts", "src/infrastructure/memory/job-delivery.ts", "tests/unit/job-delivery.test.ts"]) {
    await mkdir(join(app, path, ".."), { recursive: true });
    await writeFile(join(app, path), await readFile(new URL(path, jobsRoot)));
  }
  await writeFile(join(app, "tests/unit/independent-email-jobs.test.ts"), `import { Effect, Exit } from "effect";
import { expect, it, vi } from "vitest";
import { JobDispatcher, type JobEnvelope } from "@/src/application/job-delivery";
import { createCloudflareJobDispatcherLayer } from "@/src/infrastructure/cloudflare/job-delivery";
it("optional absence and invalid independent queue configuration cause no external work", async () => {
  const request = vi.fn<typeof fetch>();
  vi.stubGlobal("fetch", request);
  try {
    expect(await Effect.runPromise(Effect.succeed("email-absent"))).toBe("email-absent");
    for (const target of ["local", "staging", "production"] as const) {
      for (const invalid of ["environment", "binding", "envelope"] as const) {
        const send = vi.fn();
        const configuration = { JOB_ENVIRONMENT: invalid === "environment" ? undefined : target, JOB_QUEUE_NAME: "jobs-" + target, JOB_DEAD_LETTER_QUEUE_NAME: "jobs-" + target + "-dead", JOB_QUEUE: invalid === "binding" ? undefined : { send }, JOB_DEAD_LETTER_QUEUE: { send } };
        const layer = createCloudflareJobDispatcherLayer({ configuration: Effect.succeed(configuration), handlers: [{ type: "synthetic", version: 1, repeatSafety: "monotonic", validate: () => true, handle: () => Effect.void }] });
        const envelope: JobEnvelope = { version: 1, environment: invalid === "envelope" ? target === "production" ? "local" : "production" : target, operationId: "00000000-0000-4000-8000-000000000001", jobType: "synthetic", jobVersion: 1, payload: {} };
        const result = await Effect.runPromiseExit(Effect.flatMap(JobDispatcher, dispatcher => dispatcher.dispatch(envelope)).pipe(Effect.provide(layer)));
        expect(Exit.isFailure(result)).toBe(true);
        expect(send).not.toHaveBeenCalled();
      }
    }
    expect(request).not.toHaveBeenCalled();
  } finally { vi.unstubAllGlobals(); }
});
`);
  await command("independent-consumers", "pnpm", ["--dir", "apps/web", "run", "test:unit", "job-delivery.test.ts", "independent-email-jobs.test.ts"], workerProject);
  context.diagnostic(JSON.stringify({ owner, generationReceipts: receipts.length, builtTargets: artifactEvidence.length, transport: "intercepted-only", persistenceBindingChecks: "app generation and lifecycle receipts", jobsCandidateAdmitted: false }));
});
