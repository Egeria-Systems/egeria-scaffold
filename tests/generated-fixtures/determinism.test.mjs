import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createRequire } from "node:module";
import { mkdtemp, readFile, readdir, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath, pathToFileURL } from "node:url";
import test from "node:test";

import { generatedFixtureContracts } from "../../scripts/verify-generated-skeletons.mjs";

const execFileAsync = promisify(execFile);
const repositoryRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const cliEntry = resolve(repositoryRoot, "apps/cli/dist/index.js");
const core = await import(
  pathToFileURL(resolve(repositoryRoot, "packages/builder-core/dist/index.js"))
);
const { parseDocument } = createRequire(resolve(repositoryRoot, "packages/builder-core/package.json"))("yaml");
const maximumOutputBytes = 1024 * 1024;
const commandTimeoutMilliseconds = 45 * 60 * 1000;
const codePointCompare = (left, right) =>
  left < right ? -1 : left > right ? 1 : 0;

const childEnvironment = Object.fromEntries(
  ["PATH", "LANG", "SystemRoot", "ComSpec", "PATHEXT"]
    .filter((key) => process.env[key] !== undefined)
    .map((key) => [key, process.env[key]]),
);

async function pathExists(path) {
  try {
    await readdir(path);
    return true;
  } catch {
    return false;
  }
}

async function snapshotTree(root) {
  const snapshot = [];

  async function visit(directory, relativeDirectory) {
    const entries = (await readdir(directory, { withFileTypes: true })).sort(
      (left, right) => codePointCompare(left.name, right.name),
    );

    for (const entry of entries) {
      const relativePath = relativeDirectory
        ? `${relativeDirectory}/${entry.name}`
        : entry.name;
      const absolutePath = join(directory, entry.name);

      if (entry.isDirectory()) {
        await visit(absolutePath, relativePath);
      } else {
        assert.equal(entry.isFile(), true, `non-regular fixture path: ${relativePath}`);
        snapshot.push({
          path: relativePath,
          content: await readFile(absolutePath, "base64"),
        });
      }
    }
  }

  await visit(root, "");
  return snapshot.sort((left, right) => codePointCompare(left.path, right.path));
}

async function runCli(arguments_) {
  const { stdout, stderr } = await execFileAsync(
    process.execPath,
    [cliEntry, ...arguments_],
    {
      cwd: repositoryRoot,
      encoding: "utf8",
      env: childEnvironment,
      maxBuffer: maximumOutputBytes,
      shell: false,
      timeout: commandTimeoutMilliseconds,
      windowsHide: true,
    },
  );
  assert.equal(stderr, "");
  const lines = stdout.trimEnd().split("\n");
  assert.equal(lines.length, 1, stdout);
  return JSON.parse(lines[0]);
}

async function assertReadOnlyAgreement(directory, before) {
  const inference = await runCli(["infer", "--directory", directory]);
  assert.equal(inference.ok, true);
  assert.equal(inference.command, "infer");
  assert.equal(inference.result.state.kind, "valid");
  assert.ok(
    inference.result.capabilities.every(
      ({ category }) => category === "confirmed",
    ),
  );
  assert.ok(
    inference.result.surfaces.every(({ status }) =>
      ["confirmed", "application-owned"].includes(status),
    ),
  );

  const doctor = await runCli(["doctor", "--directory", directory]);
  assert.deepEqual(doctor, {
    ok: true,
    command: "doctor",
    result: { healthy: true, diagnostics: [] },
  });

  const difference = await runCli(["diff", "--directory", directory]);
  assert.deepEqual(difference, {
    ok: true,
    command: "diff",
    result: { equal: true, differences: [] },
  });
  assert.deepEqual(await snapshotTree(directory), before);
}

function assertPortablePublicLockfile(lockfile) {
  assert.doesNotMatch(
    lockfile,
    /^\s+(?:specifier|version):\s+(?:file|link|workspace):/mu,
  );
  assert.doesNotMatch(
    lockfile,
    /^\s+['"]?(?:file|link|workspace):/mu,
  );
  assert.doesNotMatch(lockfile, /(?:^|[{,]\s*)tarball:/mu);
  assert.match(lockfile, /@egeria-systems\/standards@0\.1\.0/u);
  assert.match(lockfile, /@egeria-systems\/observability@0\.3\.0/u);
  assert.match(lockfile, /@axe-core\/playwright@4\.12\.1/u);
  assert.match(lockfile, /@playwright\/test@1\.62\.1/u);
  assert.match(lockfile, /@testing-library\/dom@10\.4\.1/u);
  assert.match(lockfile, /@testing-library\/jest-dom@7\.0\.1/u);
  assert.match(lockfile, /@testing-library\/react@16\.3\.2/u);
  assert.match(lockfile, /@testing-library\/user-event@14\.6\.3/u);
  assert.match(lockfile, /@vitejs\/plugin-react@6\.0\.5/u);
  assert.match(lockfile, /jsdom@30\.0\.1/u);
  assert.match(lockfile, /vitest@4\.1\.11/u);
  assert.match(lockfile, /raw-loader@4\.0\.2/u);
  assert.match(lockfile, /@tailwindcss\/postcss@4\.3\.3/u);
  assert.match(lockfile, /postcss@8\.5\.26/u);
  assert.match(lockfile, /tailwindcss@4\.3\.3/u);
}

test("representative app fixtures retain exact descriptor ownership, production-site output and workflow ordering", async () => {
  for (const fixture of generatedFixtureContracts.filter(({ profile }) => profile === "app")) {
    const root = resolve(repositoryRoot, fixture.relativeRoot);
    const rendered = await core.renderSkeleton({
      profile: "app", projectName: fixture.projectName, displayName: fixture.displayName,
      packageVersions: { standards: "0.1.0", observability: "0.3.0" },
      ...(fixture.expectedBookingCalendlyVersion ? { bookingCalendly: fixture.expectedCapabilitySettings["booking-calendly"] } : {}),
      ...(fixture.expectedAnalyticsVersion ? { analytics: fixture.expectedCapabilitySettings.analytics } : {}),
      ...(fixture.expectedMultilingualVersion ? { multilingual: true } : {}),
    });
    assert.equal(rendered.ok, true);
    for (const { path, content } of rendered.value.files) {
      assert.deepEqual(await readFile(join(root, path)), Buffer.from(content), path);
    }
    assert.deepEqual(
      [...rendered.value.files.map(({ path }) => path), ".egeria/project.yaml", ".egeria/state.json", ".egeria/migrations.jsonl", "pnpm-lock.yaml"].sort(codePointCompare),
      fixture.expectedFiles,
    );
    const state = core.installedStateSchema.parse(JSON.parse(await readFile(join(root, ".egeria/state.json"), "utf8")));
    assert.deepEqual(state.origin, { profile: "app", recipeVersion: "0.1.0" });
    assert.equal(state.managedSurfaces.length, rendered.value.surfaces.length + 3);
    for (const surface of rendered.value.surfaces) {
      const installed = state.managedSurfaces.find(({ identifier }) => identifier === surface.identifier);
      assert.ok(installed, surface.identifier);
      for (const key of ["owner", "path", "ownership", "fingerprintTarget", "mergeStrategy"]) {
        assert.deepEqual(installed[key], surface[key], `${surface.identifier}: ${key}`);
      }
    }
    const foundation = rendered.value.resolved.capabilities.find(({ identifier }) => identifier === "app-foundation");
    assert.equal(foundation.managedSurfaces.length, 17 + 2, "seventeen files and two package members");
    assert.deepEqual(foundation.managedSurfaces.filter(({ fingerprintTarget }) => fingerprintTarget.kind === "json-value")
      .map(({ fingerprintTarget }) => fingerprintTarget.pointer).sort(), ["/dependencies/effect", "/scripts/test:integration:cloudflare"]);
    assert.deepEqual(await readFile(join(root, "pnpm-lock.yaml")), await readFile(resolve(repositoryRoot, "packages/builder-core/lockfiles/web-recipe-app-0.1.0/pnpm-lock.yaml")));
    const wrangler = JSON.parse(await readFile(join(root, "apps/web/wrangler.jsonc"), "utf8"));
    assert.ok(wrangler.compatibility_flags.includes("enable_request_signal"));
    assert.equal(state.managedSurfaces.find(({ path }) => path === "apps/web/wrangler.jsonc").owner.identifier, "deployment-cloudflare");
    for (const path of [".github/workflows/quality.yml", ".github/workflows/deploy.yml"]) {
      const document = parseDocument(await readFile(join(root, path), "utf8"));
      assert.deepEqual(document.errors, []);
      const steps = Object.values(document.toJS().jobs)[0].steps;
      const integration = steps.findIndex(({ run }) => run === "pnpm --dir apps/web run --if-present test:integration:cloudflare");
      assert.ok(integration > 0);
      assert.equal(steps[integration - 1].run, "pnpm --dir apps/web exec opennextjs-cloudflare build --skipNextBuild");
      assert.equal(steps.filter(({ run }) => run === steps[integration].run).length, 1);
      for (const [index, step] of steps.entries()) {
        if (JSON.stringify(step.env ?? {}).includes("secrets.")) assert.ok(index > integration);
      }
    }
    await assertReadOnlyAgreement(root, await snapshotTree(root));
  }
});

test("compiled project generation matches every committed fixture identifier", async (context) => {
  for (const identifier of ["app", "app-all-optional-integrations"]) {
    assert.equal(
      await pathExists(resolve(repositoryRoot, "fixtures/generated", identifier)),
      true,
      `representative app fixture is absent: ${identifier}`,
    );
  }
  for (const fixtureCase of generatedFixtureContracts) {
    assert.equal(
      await pathExists(resolve(repositoryRoot, fixtureCase.relativeRoot)),
      true,
      `committed fixture is absent: ${fixtureCase.relativeRoot}`,
    );
  }

  const owner = await mkdtemp(join(tmpdir(), "egeria-fixture-determinism-"));

  try {
    for (const fixtureCase of generatedFixtureContracts) {
      const generatedRoots = [
        join(owner, `${fixtureCase.identifier}-first`),
        join(owner, `${fixtureCase.identifier}-second`),
      ];
      const generatedSnapshots = [];

      for (const destination of generatedRoots) {
        const created = await runCli([
          "create",
          ...fixtureCase.createArguments,
          "--directory",
          destination,
        ]);
        assert.deepEqual(created, {
          ok: true,
          command: "create",
          destination: await realpath(destination),
          profile: fixtureCase.profile,
          capabilities: fixtureCase.expectedCapabilities,
        });

        const snapshot = await snapshotTree(destination);
        assert.deepEqual(
          snapshot.map(({ path }) => path),
          fixtureCase.expectedFiles,
        );
        assert.equal(snapshot.length, fixtureCase.expectedFiles.length);

        const state = JSON.parse(
          await readFile(join(destination, ".egeria/state.json"), "utf8"),
        );
        assert.deepEqual(
          state.installedCapabilities.map(({ identifier }) => identifier),
          fixtureCase.expectedCapabilities,
        );
        assert.equal(
          state.origin.recipeVersion,
          fixtureCase.expectedRecipeVersion,
        );
        assert.equal(
          state.installedCapabilities.find(
            ({ identifier }) => identifier === "observability",
          )?.version,
          fixtureCase.expectedObservabilityVersion,
        );
        assert.equal(
          state.installedCapabilities.find(
            ({ identifier }) => identifier === "standards",
          )?.version,
          fixtureCase.expectedStandardsVersion,
        );
        assert.equal(
          state.installedCapabilities.find(
            ({ identifier }) => identifier === "content-files",
          )?.version,
          fixtureCase.expectedContentFilesVersion,
        );
        assert.equal(
          state.installedCapabilities.find(
            ({ identifier }) => identifier === "section-composition",
          )?.version,
          fixtureCase.expectedSectionCompositionVersion,
        );
        assert.equal(
          state.installedCapabilities.find(
            ({ identifier }) => identifier === "deployment-cloudflare",
          )?.version,
          fixtureCase.expectedDeploymentCloudflareVersion,
        );
        assert.equal(
          state.installedCapabilities.find(
            ({ identifier }) => identifier === "site-routing",
          )?.version ?? null,
          fixtureCase.expectedSiteRoutingVersion,
        );
        assert.equal(
          state.installedCapabilities.find(
            ({ identifier }) => identifier === "booking-calendly",
          )?.version ?? null,
          fixtureCase.expectedBookingCalendlyVersion,
        );
        assert.equal(
          state.installedCapabilities.find(
            ({ identifier }) => identifier === "analytics",
          )?.version ?? null,
          fixtureCase.expectedAnalyticsVersion,
        );
        assert.equal(
          state.installedCapabilities.find(
            ({ identifier }) => identifier === "multilingual",
          )?.version ?? null,
          fixtureCase.expectedMultilingualVersion,
        );
        assert.equal(
          state.managedSurfaces.length,
          fixtureCase.expectedSurfaces,
        );
        assert.equal(
          state.installedCapabilities.find(({ identifier }) => identifier === "app-foundation")?.version ?? null,
          fixtureCase.expectedAppFoundationVersion ?? null,
        );
        const projectConfiguration = await readFile(
          join(destination, ".egeria/project.yaml"),
          "utf8",
        );
        const parsedProject = core.parseProjectYaml(projectConfiguration);
        assert.equal(parsedProject.ok, true, JSON.stringify(parsedProject.issues));
        assert.deepEqual(
          parsedProject.value.capabilitySettings,
          fixtureCase.expectedCapabilitySettings,
        );
        assert.deepEqual(state.lastSuccessfulVerification.checks, [
          "contracts",
          "pre-state-inference",
          "lockfile",
          "frozen-install",
          "lint",
          "typecheck",
          "unit-tests",
          "component-tests",
          "next-build",
          "opennext-build",
          ...(fixtureCase.profile === "app" ? ["worker-integration"] : []),
          "post-state-inference",
        ]);

        const lockfile = await readFile(
          join(destination, "pnpm-lock.yaml"),
          "utf8",
        );
        assertPortablePublicLockfile(lockfile);
        await assertReadOnlyAgreement(destination, snapshot);
        generatedSnapshots.push(snapshot);
      }

      assert.deepEqual(generatedSnapshots[1], generatedSnapshots[0]);
      const committedSnapshot = await snapshotTree(
        resolve(repositoryRoot, fixtureCase.relativeRoot),
      );
      assert.deepEqual(committedSnapshot, generatedSnapshots[0]);
      context.diagnostic(
        `${fixtureCase.identifier}: ${committedSnapshot.length} byte-stable files`,
      );
    }
  } finally {
    await rm(owner, { recursive: true, force: true });
  }
});
