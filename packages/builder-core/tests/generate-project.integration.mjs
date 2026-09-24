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
