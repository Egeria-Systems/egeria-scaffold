import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { cp, lstat, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import test from "node:test";

import {
  createFileSystemRepositoryReader,
  createPnpmGeneratedProjectVerifier,
  createVerifiedCapabilityCatalog,
  generateProject,
  inferRepository,
} from "../dist/index.js";

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

    const catalog = assertSuccess(createVerifiedCapabilityCatalog());
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
        profile === "portfolio" ? 100 : 102,
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

      const inference = await inferRepository({
        reader: createFileSystemRepositoryReader(generated.destination),
        catalog,
      });
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
