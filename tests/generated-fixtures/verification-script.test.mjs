import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import {
  access,
  chmod,
  cp,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import test from "node:test";

import {
  captureVisualFailureArtifactsForTesting,
  generatedFixtureContracts,
  inspectGeneratedFixture,
  parseVerificationArguments,
  verifyApplicationEnvironmentProjectForTesting,
  verifyGeneratedProjectForTesting,
  verifyGeneratedSkeletonsForTesting as verifySkeletons,
} from "../../scripts/verify-generated-skeletons.mjs";

const repositoryRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const execFileAsync = promisify(execFile);
const fixtureRoot = identifier => generatedFixtureContracts.find(contract => contract.identifier === identifier).relativeRoot;

function verifyGeneratedSkeletonsForTesting(adapters, options) {
  return verifySkeletons({ ...adapters, runAudit: adapters?.runAudit ?? (async input => {
    await adapters.runCommand(input);
    return { status: "passed", rawExitCode: 0, thresholdExitCode: 0 };
  }) }, options);
}

test("the admitted skeleton audit exception never reaches strict single-project certification verification", async t => {
  const parent = await mkdtemp(join(tmpdir(), "egeria-audit-boundary-"));
  t.after(() => rm(parent, { recursive: true, force: true }));
  let admittedAudits = 0;
  const adapters = {
    createOwner: () => createKnownOwner(parent),
    runCommand: successfulCommand,
    runAudit: async () => {
      admittedAudits++;
      return { status: "accepted-with-security-exception", rawExitCode: 1, thresholdExitCode: 1, advisory: "GHSA-vfj7-8cjw-p6xm" };
    },
  };
  const result = await verifyGeneratedSkeletonsForTesting(adapters);
  assert.equal(admittedAudits, generatedFixtureContracts.length);
  assert.equal(result.auditDispositions.length, generatedFixtureContracts.length);
  assert.equal(result.auditDispositions.every(receipt => receipt.rawExitCode === 1), true);
  assert.equal(result.auditDispositions.every(receipt => receipt.thresholdExitCode === 1), true);
  assert.equal(result.status, "completed-with-security-exception");
  const commands = [];
  await expectFixtureError(() => verifyGeneratedProjectForTesting(resolve(repositoryRoot, fixtureRoot("portfolio")), "portfolio", {
    ...adapters,
    runAudit: async () => assert.fail("certification must not use the exception route"),
    runCommand: async input => {
      commands.push(input.arguments);
      if (input.arguments[0] === "audit") throw Object.assign(new Error("raw audit failure"), { code: 1 });
      return successfulCommand(input);
    },
  }), "DEPENDENCY_AUDIT_FAILED");
  assert.equal(commands.some(args => args.includes("lint")), false);
  assert.equal(commands.some(args => args.includes("signatures")), false);
});

test("skeleton verification accepts below-threshold findings while preserving raw audit failures", async t => {
  const parent = await mkdtemp(join(tmpdir(), "egeria-audit-threshold-"));
  t.after(() => rm(parent, { recursive: true, force: true }));
  const commands = [];
  const result = await verifyGeneratedSkeletonsForTesting({
    createOwner: () => createKnownOwner(parent),
    runCommand: successfulCommand,
    runAudit: async input => {
      commands.push(input.arguments);
      return { status: "passed", rawExitCode: 1, thresholdExitCode: 0 };
    },
  });
  assert.equal(result.auditDispositions.length, generatedFixtureContracts.length);
  assert.equal(result.auditDispositions.every(receipt => receipt.status === "passed" && receipt.rawExitCode === 1 && receipt.thresholdExitCode === 0), true);
  assert.equal(result.status, "completed");
  assert.equal(commands.every(arguments_ => JSON.stringify(arguments_) === JSON.stringify(["audit", "--audit-level", "info", "--json"])), true);
});

for (const disposition of [
  { status: "passed", rawExitCode: 0 },
  { status: "passed", rawExitCode: 0, thresholdExitCode: 1 },
  { status: "passed", rawExitCode: 1, thresholdExitCode: 1 },
  { status: "passed", rawExitCode: 2, thresholdExitCode: 0 },
  { status: "accepted-with-security-exception", rawExitCode: 1 },
  { status: "accepted-with-security-exception", rawExitCode: 1, thresholdExitCode: 0 },
  { status: "accepted-with-security-exception", rawExitCode: 0, thresholdExitCode: 1 },
  { status: "refused", rawExitCode: 1, thresholdExitCode: 1 },
])
test(`skeleton verification rejects incoherent audit disposition ${JSON.stringify(disposition)}`, async t => {
  const parent = await mkdtemp(join(tmpdir(), "egeria-audit-invalid-threshold-"));
  t.after(() => rm(parent, { recursive: true, force: true }));
  const commands = [];
  await expectFixtureError(() => verifyGeneratedSkeletonsForTesting({
    createOwner: () => createKnownOwner(parent),
    runCommand: async input => { commands.push(input.arguments); return successfulCommand(input); },
    runAudit: async () => disposition,
  }), "DEPENDENCY_AUDIT_FAILED");
  assert.equal(commands.some(arguments_ => arguments_.includes("signatures") || arguments_.includes("lint")), false);
});
const repositoryGitArguments = Object.freeze([
  "-c",
  `safe.directory=${repositoryRoot}`,
]);

async function pathExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function copyFixture(owner, identifier, label) {
  const fixtureCase = generatedFixtureContracts.find(
    (candidate) => candidate.identifier === identifier,
  );
  assert.notEqual(fixtureCase, undefined);
  const root = join(owner, `${identifier}-${label}`);
  await cp(resolve(repositoryRoot, fixtureCase.relativeRoot), root, {
    recursive: true,
    force: false,
    errorOnExist: true,
    dereference: false,
  });
  return root;
}

async function expectFixtureError(callback, expectedCode) {
  await assert.rejects(callback, (error) => {
    assert.equal(error?.name, "GeneratedFixtureVerificationError");
    assert.equal(error?.code, expectedCode);
    assert.doesNotMatch(String(error), /NPM_TOKEN|PRIVATE_VALUE/u);
    return true;
  });
}

async function createKnownOwner(parent) {
  const path = await mkdtemp(join(parent, "verification-owner-"));
  const stats = await lstat(path, { bigint: true });
  return {
    path,
    device: stats.dev,
    inode: stats.ino,
    birthtimeNanoseconds: stats.birthtimeNs,
  };
}

async function withPortfolioVisualFixture(callback) {
  const ownerParent = await mkdtemp(join(tmpdir(), "egeria-visual-option-"));
  try {
    const sourceRoot = await copyFixture(ownerParent, "portfolio", "source");
    return await callback({ ownerParent, sourceRoot });
  } finally {
    await rm(ownerParent, { recursive: true, force: true });
  }
}

async function writeSyntheticAppBuild(root, { effectVersion = "4.0.0-rc.112", client = "export const browser = true;" } = {}) {
  const files = {
    "apps/web/node_modules/effect/package.json": JSON.stringify({ name: "effect", version: effectVersion, exports: { "./package.json": "./package.json" } }),
    "apps/web/node_modules/effect/dist/index.js": 'export const marker = "~effect/Effect";',
    "apps/web/.next/static/chunks/app.js": client,
    "apps/web/.next/server/app.js": 'export const server = "~effect/Effect";',
    "apps/web/.open-next/server-functions/default/handler.mjs": "export default { fetch() {} };",
  };
  for (const [path, content] of Object.entries(files)) {
    await mkdir(dirname(join(root, path)), { recursive: true });
    await writeFile(join(root, path), content);
  }
}

async function successfulCommand(input) {
  if (input.arguments.at(-1) === "--skipNextBuild") {
    const manifest = JSON.parse(await readFile(join(input.cwd, "apps/web/package.json"), "utf8"));
    if (manifest.dependencies.effect && !await pathExists(join(input.cwd, "apps/web/node_modules/effect/package.json"))) {
      await writeSyntheticAppBuild(input.cwd);
    }
  }
  if (input.arguments[0] === "--version") return "11.20.0\n";
  return "";
}

test("persistence fixture binding verification executes separately and a failed binding lane refuses success", async () => {
  const ownerParent = await mkdtemp(join(tmpdir(), "egeria-binding-order-"));
  try {
    for (const bindingFails of [false, true]) {
      const commands = [];
      let ownedPath;
      const run = () => verifyGeneratedProjectForTesting(
        resolve(repositoryRoot, fixtureRoot("app-persistence")), "app-persistence",
        {
          async createOwner() { const owner = await createKnownOwner(ownerParent); ownedPath = owner.path; return owner; },
          async runCommand(input) {
            commands.push(input.arguments);
            if (bindingFails && input.arguments.at(-1) === "test:integration:bindings") throw new Error("PRIVATE_VALUE");
            return successfulCommand(input);
          },
        },
      );
      if (bindingFails) {
        await expectFixtureError(run, "BINDING_INTEGRATION_FAILED");
        assert.equal(commands.some((arguments_) => arguments_.at(-1) === "browser:install"), false);
      } else {
        const result = await run();
        assert.deepEqual(result.bindingIntegration, { executed: ["app-persistence"], skipped: [] });
        assert.deepEqual(result.workerIntegration, { executed: ["app-persistence"], skipped: [] });
        assert.equal(result.checks.includes("binding-integration"), false);
        const binding = commands.findIndex((arguments_) => arguments_.at(-1) === "test:integration:bindings");
        assert.deepEqual(commands[binding], ["--dir", "apps/web", "run", "test:integration:bindings"]);
        assert.equal(commands[binding - 1].at(-1), "test:integration:cloudflare");
        assert.equal(commands[binding + 1].at(-1), "browser:install");
      }
      assert.equal(await pathExists(ownedPath), false);
    }
  } finally { await rm(ownerParent, { recursive: true, force: true }); }
});

test("persistence fixture must typecheck before application binding types are generated", async () => {
  const ownerParent = await mkdtemp(join(tmpdir(), "egeria-clean-typecheck-"));
  const commands = [];
  try {
    await expectFixtureError(() => verifyGeneratedProjectForTesting(
      resolve(repositoryRoot, fixtureRoot("app-persistence")), "app-persistence",
      {
        async createOwner() { return createKnownOwner(ownerParent); },
        async runCommand(input) {
          commands.push(input.arguments);
          if (input.arguments.at(-1) === "typecheck") {
            assert.equal(await pathExists(join(input.cwd, "apps/web/cloudflare-env.d.ts")), false);
            throw new Error("PRIVATE_VALUE");
          }
          return successfulCommand(input);
        },
      },
    ), "CLEAN_TYPECHECK_FAILED");
    assert.equal(commands.some((arguments_) => arguments_.at(-1) === "cf-typegen"), false);
  } finally {
    await rm(ownerParent, { recursive: true, force: true });
  }
});

test("fixture Effect source imports cannot enter domain, content, presentation or client modules", async () => {
  const owner = await mkdtemp(join(tmpdir(), "egeria-effect-sources-"));
  try {
    for (const [index, [identifier, path, source]] of [
      ["app", "apps/web/src/domain/build-information.ts", 'import { Effect } from "effect";'],
      ["app", "apps/web/src/content/read-content.ts", 'import { Effect } from "effect";'],
      ["app", "apps/web/src/presentation/content-page.tsx", 'import { Effect } from "effect";'],
      ["app", "apps/web/src/application/health.ts", '"use client"; import { Effect } from "effect";'],
      ["portfolio", "apps/web/src/infrastructure/observability/server-reporter.ts", 'import { Effect } from "effect";'],
    ].entries()) {
      const root = await copyFixture(owner, identifier, `source-${index}`);
      await writeFile(join(root, path), source);
      await expectFixtureError(() => inspectGeneratedFixture(root, identifier), "FIXTURE_EFFECT_BOUNDARY_INVALID");
    }
  } finally { await rm(owner, { recursive: true, force: true }); }
});

test("app build evidence refuses client Effect markers and the wrong installed pin before browsers", async () => {
  const owner = await mkdtemp(join(tmpdir(), "egeria-effect-build-"));
  try {
    for (const variant of [{ client: 'export const leaked = "~effect/Effect";' }, { effectVersion: "4.0.0-rc.113" }]) {
      const commands = [];
      await expectFixtureError(() => verifyGeneratedProjectForTesting(
        resolve(repositoryRoot, fixtureRoot("app")), "app",
        {
          createOwner: () => createKnownOwner(owner),
          async runCommand(input) {
            commands.push(input.arguments.at(-1));
            if (input.arguments.at(-1) === "--skipNextBuild") await writeSyntheticAppBuild(input.cwd, variant);
            return successfulCommand(input);
          },
        },
      ), "EFFECT_BUILD_BOUNDARY_FAILED");
      assert.ok(!commands.includes("browser:install"));
    }
  } finally { await rm(owner, { recursive: true, force: true }); }
});

test("fixture dependency graphs keep the approved app lock and native-build denial", async () => {
  const owner = await mkdtemp(join(tmpdir(), "egeria-app-dependency-policy-"));
  try {
    for (const [index, { identifier, path, change, code }] of [
      { identifier: "portfolio", path: "pnpm-lock.yaml", change: (text) => `${text}\n  effect@4.0.0-rc.112: {}\n`, code: "FIXTURE_EFFECT_BOUNDARY_INVALID" },
      { identifier: "app", path: "pnpm-lock.yaml", change: (text) => text.replaceAll("4.0.0-rc.112", "4.0.0-rc.113"), code: "FIXTURE_LOCKFILE_INVALID" },
      { identifier: "app", path: "pnpm-workspace.yaml", change: (text) => text.replace("msgpackr-extract: false", "msgpackr-extract: true"), code: "FIXTURE_WORKSPACE_POLICY_INVALID" },
      { identifier: "app", path: "apps/web/package.json", change: (text) => text.replace("vitest run --config vitest.cloudflare.config.ts", "echo skipped"), code: "FIXTURE_MANIFEST_INVALID" },
      { identifier: "app-persistence", path: "apps/web/package.json", change: (text) => text.replace("vitest run --config vitest.bindings.config.ts", "echo skipped"), code: "FIXTURE_MANIFEST_INVALID" },
      { identifier: "app-persistence", path: "apps/web/package.json", change: (text) => text.replace("0.45.2", "0.45.3"), code: "FIXTURE_MANIFEST_INVALID" },
      { identifier: "app-persistence", path: "pnpm-lock.yaml", change: (text) => text.replace("drizzle-kit@0.31.10", "drizzle-kit@0.31.11"), code: "FIXTURE_LOCKFILE_INVALID" },
      { identifier: "app-persistence", path: "pnpm-workspace.yaml", change: (text) => text.replace('  "@esbuild-kit/core-utils>esbuild": 0.25.4\n', ""), code: "FIXTURE_WORKSPACE_POLICY_INVALID" },
    ].entries()) {
      const root = await copyFixture(owner, identifier, `policy-${index}`);
      const original = await readFile(join(root, path), "utf8");
      const changed = change(original);
      assert.notEqual(changed, original);
      await writeFile(join(root, path), changed);
      await expectFixtureError(() => inspectGeneratedFixture(root, identifier), code);
    }
  } finally { await rm(owner, { recursive: true, force: true }); }
});

test("app Worker integration executes after OpenNext and records non-app absence separately", async () => {
  const ownerParent = await mkdtemp(join(tmpdir(), "egeria-worker-order-"));
  try {
    for (const identifier of ["portfolio", "app", "app-all-optional-integrations"]) {
      const commands = [];
      const result = await verifyGeneratedProjectForTesting(
        resolve(repositoryRoot, fixtureRoot(identifier)), identifier,
        {
          createOwner: () => createKnownOwner(ownerParent),
          async runCommand(input) {
            commands.push(input.arguments);
            return successfulCommand(input);
          },
        },
      );
      const worker = commands.findIndex((arguments_) => arguments_.at(-1) === "test:integration:cloudflare");
      assert.deepEqual(commands[worker], ["--dir", "apps/web", "run", "--if-present", "test:integration:cloudflare"]);
      assert.equal(commands[worker - 1].at(-1), "--skipNextBuild");
      assert.equal(commands[worker + 1].at(-1), "browser:install");
      assert.deepEqual(result.workerIntegration, {
        executed: identifier === "portfolio" ? [] : [identifier],
        skipped: identifier === "portfolio" ? [identifier] : [],
      });
      assert.ok(!result.checks.includes("worker-integration"), "aggregate checks cannot imply execution for every fixture");
      assert.deepEqual(result.bindingIntegration, { executed: [], skipped: [identifier] });
      assert.equal(commands.some((arguments_) => arguments_.at(-1) === "test:integration:bindings"), false);
    }
  } finally {
    await rm(ownerParent, { recursive: true, force: true });
  }
});

test("a freshly rendered Calendly app is verified without adding an immutable fixture", async () => {
  const owner = await mkdtemp(join(tmpdir(), "egeria-calendly-app-verifier-"));
  try {
    const root = await copyFixture(owner, "app", "calendly");
    const { renderSkeleton } = await import("../../packages/builder-core/dist/index.js");
    const rendered = await renderSkeleton({
      profile: "app", projectName: "acme-app", displayName: "Acme App",
      packageVersions: { standards: "0.1.0", observability: "0.3.0" },
      bookingCalendly: { destination: "https://calendly.com/example/intro", mode: "popup" },
    });
    assert.equal(rendered.ok, true);
    for (const { path, content } of rendered.value.files) {
      await mkdir(dirname(join(root, path)), { recursive: true });
      await writeFile(join(root, path), content);
    }
    const result = await verifyGeneratedProjectForTesting(root, "app-calendly", {
      createOwner: () => createKnownOwner(owner),
      runCommand: successfulCommand,
    }, "acme-app", { includeVisual: false });
    assert.deepEqual(result.profiles, ["app"]);
    assert.deepEqual(result.workerIntegration, { executed: ["app-calendly"], skipped: [] });
    assert.equal(result.appBuildEvidence[0].effect.version, "4.0.0-rc.112");
    assert.equal(generatedFixtureContracts.some(({ identifier }) => identifier === "app-calendly"), false);
    await writeFile(join(root, "unmanaged.txt"), "must be rejected");
    await expectFixtureError(() => verifyGeneratedProjectForTesting(root, "app-calendly", {
      createOwner: () => createKnownOwner(owner), runCommand: successfulCommand,
    }, "acme-app", { includeVisual: false }), "GENERATED_FIXTURE_FORBIDDEN_ARTIFACT");
  } finally {
    await rm(owner, { recursive: true, force: true });
  }
});

test("a failing present Worker script refuses success and still cleans its temporary copy", async () => {
  const ownerParent = await mkdtemp(join(tmpdir(), "egeria-worker-failure-"));
  let ownedPath;
  const commands = [];
  try {
    await expectFixtureError(() => verifyGeneratedProjectForTesting(
      resolve(repositoryRoot, fixtureRoot("app")), "app",
      {
        async createOwner() { const owner = await createKnownOwner(ownerParent); ownedPath = owner.path; return owner; },
        async runCommand(input) {
          commands.push(input.arguments.at(-1));
          if (input.arguments.at(-1) === "test:integration:cloudflare") throw new Error("PRIVATE_VALUE");
          return successfulCommand(input);
        },
      },
    ), "WORKER_INTEGRATION_FAILED");
    assert.ok(!commands.includes("browser:install"));
    assert.equal(await pathExists(ownedPath), false);
  } finally {
    await rm(ownerParent, { recursive: true, force: true });
  }
});

test("fixture inspection accepts only the exact portable generated trees", async () => {
  assert.deepEqual(
    generatedFixtureContracts.map(({ identifier, profile, relativeRoot }) => ({
      identifier,
      profile,
      relativeRoot,
    })),
    [
      {
        identifier: "portfolio",
        profile: "portfolio",
        relativeRoot: "fixtures/generated/portfolio-0.11.3",
      },
      {
        identifier: "portfolio-calendly",
        profile: "portfolio",
        relativeRoot: "fixtures/generated/portfolio-calendly-0.11.3",
      },
      {
        identifier: "site",
        profile: "site",
        relativeRoot: "fixtures/generated/site-0.12.3",
      },
      {
        identifier: "site-multilingual",
        profile: "site",
        relativeRoot: "fixtures/generated/site-multilingual-0.12.3",
      },
      {
        identifier: "site-multilingual-analytics",
        profile: "site",
        relativeRoot: "fixtures/generated/site-multilingual-analytics-0.12.3",
      },
      {
        identifier: "app",
        profile: "app",
        relativeRoot: "fixtures/generated/app-0.2.3",
      },
      {
        identifier: "app-all-optional-integrations",
        profile: "app",
        relativeRoot: "fixtures/generated/app-all-optional-integrations-0.2.3",
      },
      {
        identifier: "app-persistence", profile: "app",
        relativeRoot: "fixtures/generated/app-persistence-0.2.3",
      },
      {
        identifier: "portfolio-email", profile: "portfolio",
        relativeRoot: "fixtures/generated/portfolio-email-0.11.3",
      },
      {
        identifier: "app-persistence-email", profile: "app",
        relativeRoot: "fixtures/generated/app-persistence-email-0.2.3",
      },
      { identifier: "site-contact-form", profile: "site", relativeRoot: "fixtures/generated/site-contact-form-0.12.3" },
    ],
  );

  for (const contract of generatedFixtureContracts) {
    assert.equal(
      contract.expectedRecipeVersion,
      contract.profile === "app" ? "0.2.3" : contract.profile === "site" ? "0.12.3" : "0.11.3",
    );
    assert.equal(contract.expectedStandardsVersion, ["app-persistence", "app-persistence-email"].includes(contract.identifier) ? "0.6.0" : "0.5.0");
    assert.equal(contract.expectedObservabilityVersion, "0.3.0");
    assert.equal(contract.expectedContentFilesVersion, "0.4.0");
    assert.equal(contract.expectedDeploymentCloudflareVersion, ["app-persistence", "app-persistence-email"].includes(contract.identifier) ? "0.4.0" : "0.3.0");
    assert.equal(
      contract.expectedSiteRoutingVersion,
      contract.profile === "portfolio" ? null : "0.4.0",
    );
    assert.equal(
      contract.expectedBookingCalendlyVersion,
      ["portfolio-calendly", "app-all-optional-integrations"].includes(contract.identifier) ? "0.1.0" : null,
    );
    assert.equal(
      contract.expectedMultilingualVersion,
      contract.identifier === "site-multilingual" ||
        contract.identifier === "site-multilingual-analytics" ||
        contract.identifier === "app-all-optional-integrations"
        ? "0.1.0"
        : null,
    );
    assert.equal(
      contract.expectedAnalyticsVersion,
      ["site-multilingual-analytics", "app-all-optional-integrations"].includes(contract.identifier) ? "0.1.0" : null,
    );
    assert.equal(
      contract.expectedSurfaces,
      contract.identifier === "portfolio-calendly"
        ? 112
        : contract.identifier === "portfolio"
          ? 107
          : contract.identifier === "site"
            ? 124
            : contract.identifier === "site-multilingual"
              ? 140
              : contract.identifier === "app" ? 143
                : contract.identifier === "app-all-optional-integrations" ? 179
                  : contract.identifier === "app-persistence" ? 162
                    : contract.identifier === "portfolio-email" ? 135
                      : contract.identifier === "app-persistence-email" ? 171 : contract.identifier === "site-contact-form" ? 138 : 155,
    );
    assert.equal(
      contract.visualRegression,
      ![
        "site-multilingual",
        "site-multilingual-analytics",
        "app-all-optional-integrations",
        "app-persistence",
        "portfolio-email",
        "app-persistence-email",
        "site-contact-form",
      ].includes(contract.identifier),
    );
    const snapshot = await inspectGeneratedFixture(
      resolve(repositoryRoot, contract.relativeRoot),
      contract.identifier,
    );
    assert.equal(snapshot.length, contract.expectedFiles.length);
    assert.deepEqual(
      snapshot.map(({ path }) => path),
      contract.expectedFiles,
    );
  }

  const basePortfolio = generatedFixtureContracts.find(
    ({ identifier }) => identifier === "portfolio",
  );
  const calendlyPortfolio = generatedFixtureContracts.find(
    ({ identifier }) => identifier === "portfolio-calendly",
  );
  const site = generatedFixtureContracts.find(
    ({ identifier }) => identifier === "site",
  );
  const multilingualSite = generatedFixtureContracts.find(
    ({ identifier }) => identifier === "site-multilingual",
  );
  const analyticsSite = generatedFixtureContracts.find(
    ({ identifier }) => identifier === "site-multilingual-analytics",
  );
  assert.equal(basePortfolio.expectedFiles.length, 58);
  assert.equal(site.expectedFiles.length, 75);
  assert.equal(multilingualSite.expectedFiles.length, 91);
  assert.equal(analyticsSite.expectedFiles.length, 106);
  assert.equal(
    calendlyPortfolio.expectedFiles.length,
    58 - 1 + 6,
    "six booking sources replace one common home destination and add five distinct paths",
  );
  assert.deepEqual(calendlyPortfolio.createArguments, [
    "--profile",
    "portfolio",
    "--name",
    "acme-portfolio-calendly",
    "--display-name",
    "Acme Portfolio Booking",
    "--calendly-url",
    "https://calendly.com/example/intro",
    "--calendly-mode",
    "popup",
  ]);
  assert.deepEqual(calendlyPortfolio.expectedCapabilitySettings, {
    "booking-calendly": {
      destination: "https://calendly.com/example/intro",
      mode: "popup",
    },
  });
  assert.deepEqual(calendlyPortfolio.expectedCapabilities, [
    "standards",
    "content-files",
    "section-composition",
    "deployment-cloudflare",
    "observability",
    "booking-calendly",
  ]);
  assert.deepEqual(multilingualSite.createArguments, [
    "--profile",
    "site",
    "--name",
    "acme-site-multilingual",
    "--display-name",
    "Acme Site Multilingual",
    "--multilingual",
  ]);
  assert.deepEqual(multilingualSite.expectedCapabilitySettings, {});
  assert.deepEqual(multilingualSite.expectedCapabilities, [
    "standards",
    "content-files",
    "section-composition",
    "deployment-cloudflare",
    "observability",
    "site-routing",
    "multilingual",
  ]);
  assert.deepEqual(analyticsSite.createArguments, [
    "--profile",
    "site",
    "--name",
    "acme-site-multilingual-analytics",
    "--display-name",
    "Acme Site Multilingual Analytics",
    "--multilingual",
    "--cloudflare-web-analytics-token",
    "0123456789abcdef0123456789abcdef",
    "--google-analytics-id",
    "G-ABCDEF1234",
    "--microsoft-clarity-id",
    "clarity123",
    "--microsoft-clarity-audience",
    "not-directed-to-minors",
    "--search-console-verification",
    "search-console-verification-token",
    "--looker-studio",
  ]);
  assert.equal(
    analyticsSite.expectedCapabilitySettings.analytics.consent.policy,
    "explicit-opt-in",
  );
  assert.deepEqual(analyticsSite.expectedCapabilities, [
    "standards",
    "content-files",
    "section-composition",
    "deployment-cloudflare",
    "observability",
    "site-routing",
    "analytics",
    "multilingual",
  ]);
  assert.deepEqual(
    multilingualSite.expectedFiles.filter(
      (path) => !site.expectedFiles.includes(path),
    ),
    [
      "apps/web/app/[locale]/[[...segments]]/page.tsx",
      "apps/web/app/[locale]/layout.tsx",
      "apps/web/app/[locale]/not-found.tsx",
      "apps/web/content/en-CA/localized-content.yaml",
      "apps/web/content/fr-CA/localized-content.yaml",
      "apps/web/middleware.ts",
      "apps/web/src/i18n/locale.ts",
      "apps/web/src/i18n/localized-content.ts",
      "apps/web/src/i18n/localized-profile.ts",
      "apps/web/src/i18n/read-localized-content.ts",
      "apps/web/src/integrations/booking/localized-booking.tsx",
      "apps/web/src/presentation/localized-page.tsx",
      "apps/web/tests/component/multilingual-page.test.tsx",
      "apps/web/tests/e2e/multilingual-routing.spec.ts",
      "apps/web/tests/unit/locale.test.ts",
      "apps/web/tests/unit/localized-content.test.ts",
    ],
  );
  assert.deepEqual(
    analyticsSite.expectedFiles.filter(
      (path) => !multilingualSite.expectedFiles.includes(path),
    ),
    [
      "apps/web/content/en-CA/analytics.yaml",
      "apps/web/content/fr-CA/analytics.yaml",
      "apps/web/src/integrations/analytics/analytics-consent-state.ts",
      "apps/web/src/integrations/analytics/analytics-consent.tsx",
      "apps/web/src/integrations/analytics/analytics-content-source.d.ts",
      "apps/web/src/integrations/analytics/analytics-content.ts",
      "apps/web/src/integrations/analytics/analytics-provider-contract.ts",
      "apps/web/src/integrations/analytics/analytics-runtime.ts",
      "apps/web/src/integrations/analytics/analytics-settings.ts",
      "apps/web/tests/component/analytics-consent.test.tsx",
      "apps/web/tests/e2e/analytics-consent.spec.ts",
      "apps/web/tests/unit/analytics-consent-state.test.ts",
      "apps/web/tests/unit/analytics-provider-contract.test.ts",
      "apps/web/tests/unit/analytics-runtime.test.ts",
      "docs/analytics.md",
    ],
  );
  assert.deepEqual(
    calendlyPortfolio.expectedFiles.filter(
      (path) => !basePortfolio.expectedFiles.includes(path),
    ),
    [
      "apps/web/content/en-CA/booking-calendly.yaml",
      "apps/web/src/integrations/booking-calendly/booking-content.ts",
      "apps/web/src/integrations/booking-calendly/booking-settings.ts",
      "apps/web/src/integrations/booking-calendly/calendly-booking.tsx",
      "apps/web/tests/e2e/calendly-booking.spec.ts",
    ],
  );
});

test("generated fixture text and visual baseline attributes are explicit", async () => {
  const fixturePaths = generatedFixtureContracts.map(
    ({ relativeRoot }) => `${relativeRoot}/package.json`,
  );
  const { stdout: textAttributes } = await execFileAsync(
    "git",
    [
      ...repositoryGitArguments,
      "check-attr",
      "text",
      "eol",
      "--",
      ...fixturePaths,
    ],
    { cwd: repositoryRoot, encoding: "utf8" },
  );

  assert.deepEqual(textAttributes.trimEnd().split("\n"), [
    `${fixtureRoot("portfolio")}/package.json: text: set`,
    `${fixtureRoot("portfolio")}/package.json: eol: lf`,
    `${fixtureRoot("portfolio-calendly")}/package.json: text: set`,
    `${fixtureRoot("portfolio-calendly")}/package.json: eol: lf`,
    `${fixtureRoot("site")}/package.json: text: set`,
    `${fixtureRoot("site")}/package.json: eol: lf`,
    `${fixtureRoot("site-multilingual")}/package.json: text: set`,
    `${fixtureRoot("site-multilingual")}/package.json: eol: lf`,
    `${fixtureRoot("site-multilingual-analytics")}/package.json: text: set`,
    `${fixtureRoot("site-multilingual-analytics")}/package.json: eol: lf`,
    `${fixtureRoot("app")}/package.json: text: set`,
    `${fixtureRoot("app")}/package.json: eol: lf`,
    `${fixtureRoot("app-all-optional-integrations")}/package.json: text: set`,
    `${fixtureRoot("app-all-optional-integrations")}/package.json: eol: lf`,
    `${fixtureRoot("app-persistence")}/package.json: text: set`,
    `${fixtureRoot("app-persistence")}/package.json: eol: lf`,
    `${fixtureRoot("portfolio-email")}/package.json: text: set`,
    `${fixtureRoot("portfolio-email")}/package.json: eol: lf`,
    `${fixtureRoot("app-persistence-email")}/package.json: text: set`,
    `${fixtureRoot("app-persistence-email")}/package.json: eol: lf`,
    `${fixtureRoot("site-contact-form")}/package.json: text: set`,
    `${fixtureRoot("site-contact-form")}/package.json: eol: lf`,
  ]);

  const baselineDirectory =
    "apps/web/tests/visual/home-visual.spec.ts-snapshots";
  const baselineNames = [
    "home-desktop-chromium-linux.png",
    "home-mobile-chromium-linux.png",
  ];
  const baselineRoots = [
    "packages/builder-core/templates/portfolio",
    "packages/builder-core/templates/site",
    ...generatedFixtureContracts.map(({ relativeRoot }) => relativeRoot),
  ];
  const baselinePaths = baselineRoots.flatMap((root) =>
    baselineNames.map((name) => `${root}/${baselineDirectory}/${name}`),
  );
  const { stdout: binaryAttributes } = await execFileAsync(
    "git",
    [
      ...repositoryGitArguments,
      "check-attr",
      "text",
      "binary",
      "--",
      ...baselinePaths,
    ],
    { cwd: repositoryRoot, encoding: "utf8" },
  );

  assert.equal(baselinePaths.length, 26);
  assert.deepEqual(
    binaryAttributes.trimEnd().split("\n"),
    baselinePaths.flatMap((path) => [
      `${path}: text: unset`,
      `${path}: binary: set`,
    ]),
  );
});

test("fixture inspection rejects artifacts, local sources, altered integrity, and links", async () => {
  const owner = await mkdtemp(join(tmpdir(), "egeria-fixture-policy-"));

  try {
    const artifactRoot = await copyFixture(owner, "portfolio", "artifact");
    await writeFile(join(artifactRoot, ".env"), "PRIVATE_VALUE=secret\n", {
      encoding: "utf8",
      mode: 0o600,
    });
    await expectFixtureError(
      () =>
        inspectGeneratedFixture(artifactRoot, "portfolio"),
      "GENERATED_FIXTURE_FORBIDDEN_ARTIFACT",
    );

    const localSourceRoot = await copyFixture(owner, "portfolio", "local-source");
    const webManifestPath = join(localSourceRoot, "apps/web/package.json");
    const webManifest = JSON.parse(await readFile(webManifestPath, "utf8"));
    webManifest.dependencies["@egeria-systems/observability"] =
      "file:../../../../private-package";
    await writeFile(webManifestPath, `${JSON.stringify(webManifest, null, 2)}\n`);
    await expectFixtureError(
      () =>
        inspectGeneratedFixture(localSourceRoot, "portfolio"),
      "GENERATED_FIXTURE_LOCAL_DEPENDENCY",
    );

    const integrityRoot = await copyFixture(owner, "portfolio", "integrity");
    const lockfilePath = join(integrityRoot, "pnpm-lock.yaml");
    const lockfile = await readFile(lockfilePath, "utf8");
    const alteredLockfile = lockfile.replace(
      "sha512-BmDwcX0T6KT271C4N24jCKn6ymKTqDAFpJjsG6LNpmIoTAz0xApIcqpHFl9dHOqlB2xdhdHwKYfSiELUp04E0Q==",
      "sha512-invalid",
    );
    assert.notEqual(alteredLockfile, lockfile);
    await writeFile(lockfilePath, alteredLockfile);
    await expectFixtureError(
      () =>
        inspectGeneratedFixture(integrityRoot, "portfolio"),
      "FIXTURE_LOCKFILE_INVALID",
    );

    const linkedRoot = await copyFixture(owner, "portfolio", "linked");
    await rm(join(linkedRoot, "README.md"));
    await symlink("package.json", join(linkedRoot, "README.md"));
    await expectFixtureError(
      () =>
        inspectGeneratedFixture(linkedRoot, "portfolio"),
      "FIXTURE_PATH_INVALID",
    );
  } finally {
    await rm(owner, { recursive: true, force: true });
  }
});

test("fixture inspection rejects unapproved dependency and execution policy", async () => {
  const owner = await mkdtemp(join(tmpdir(), "egeria-fixture-policy-"));

  try {
    const workspaceOverrideRoot = await copyFixture(
      owner,
      "portfolio",
      "workspace-override",
    );
    const workspacePath = join(workspaceOverrideRoot, "pnpm-workspace.yaml");
    const workspace = await readFile(workspacePath, "utf8");
    const unapprovedWorkspace = workspace.replace(
      '  "miniflare>undici": 7.29.1',
      '  "miniflare>undici": 7.29.1\n  next: 16.3.1',
    );
    assert.notEqual(unapprovedWorkspace, workspace);
    await writeFile(workspacePath, unapprovedWorkspace);
    await expectFixtureError(
      () => inspectGeneratedFixture(workspaceOverrideRoot, "portfolio"),
      "FIXTURE_WORKSPACE_POLICY_INVALID",
    );

    const lockfileOverrideRoot = await copyFixture(
      owner,
      "portfolio",
      "lockfile-override",
    );
    const lockfilePath = join(lockfileOverrideRoot, "pnpm-lock.yaml");
    const lockfile = await readFile(lockfilePath, "utf8");
    const unapprovedLockfile = lockfile.replace(
      "  miniflare>undici: 7.29.1",
      "  miniflare>undici: 7.29.0",
    );
    assert.notEqual(unapprovedLockfile, lockfile);
    await writeFile(lockfilePath, unapprovedLockfile);
    await expectFixtureError(
      () => inspectGeneratedFixture(lockfileOverrideRoot, "portfolio"),
      "FIXTURE_LOCKFILE_INVALID",
    );

    const lifecycleRoot = await copyFixture(owner, "portfolio", "lifecycle");
    const rootManifestPath = join(lifecycleRoot, "package.json");
    const rootManifest = JSON.parse(await readFile(rootManifestPath, "utf8"));
    rootManifest.scripts.preinstall = "node unapproved-install-hook.mjs";
    await writeFile(
      rootManifestPath,
      `${JSON.stringify(rootManifest, null, 2)}\n`,
    );
    await expectFixtureError(
      () => inspectGeneratedFixture(lifecycleRoot, "portfolio"),
      "FIXTURE_MANIFEST_INVALID",
    );

    const remoteSourceRoot = await copyFixture(
      owner,
      "portfolio",
      "remote-source",
    );
    const webManifestPath = join(remoteSourceRoot, "apps/web/package.json");
    const webManifest = JSON.parse(await readFile(webManifestPath, "utf8"));
    webManifest.dependencies.next = "https://example.invalid/next.tgz";
    await writeFile(webManifestPath, `${JSON.stringify(webManifest, null, 2)}\n`);
    await expectFixtureError(
      () => inspectGeneratedFixture(remoteSourceRoot, "portfolio"),
      "FIXTURE_MANIFEST_INVALID",
    );

    const tarballRoot = await copyFixture(owner, "portfolio", "tarball");
    const tarballLockfilePath = join(tarballRoot, "pnpm-lock.yaml");
    const tarballLockfile = await readFile(tarballLockfilePath, "utf8");
    const tarballOverride = tarballLockfile.replace(
      "    resolution: {integrity:",
      "    resolution: {tarball: https://example.invalid/package.tgz, integrity:",
    );
    assert.notEqual(tarballOverride, tarballLockfile);
    await writeFile(tarballLockfilePath, tarballOverride);
    await expectFixtureError(
      () => inspectGeneratedFixture(tarballRoot, "portfolio"),
      "FIXTURE_LOCKFILE_INVALID",
    );

    for (const [index, locator] of [
      "file:../../private-package", "link:../../private-package", "workspace:*",
      "git+https://example.invalid/unapproved.git", "git://example.invalid/unapproved.git",
      "github:unapproved/package", "https://example.invalid/package.tgz", "http://example.invalid/package.tgz",
    ].entries()) {
      const snapshotLocatorRoot = await copyFixture(owner, "portfolio", `snapshot-locator-${index}`);
      const snapshotLockfilePath = join(snapshotLocatorRoot, "pnpm-lock.yaml");
      const snapshotLockfile = await readFile(snapshotLockfilePath, "utf8");
      const alteredSnapshotLockfile = snapshotLockfile.replace("      tslib: 2.8.1", `      tslib: ${locator}`);
      assert.notEqual(alteredSnapshotLockfile, snapshotLockfile);
      await writeFile(snapshotLockfilePath, alteredSnapshotLockfile);
      await expectFixtureError(
        () => inspectGeneratedFixture(snapshotLocatorRoot, "portfolio"),
        "FIXTURE_LOCKFILE_INVALID",
      );
    }
  } finally {
    await rm(owner, { recursive: true, force: true });
  }
});

test("single-root verification runs the exact fixed checks against caller output", async () => {
  const ownerParent = await mkdtemp(join(tmpdir(), "egeria-single-root-"));
  const sourceRoot = await copyFixture(
    ownerParent,
    "portfolio-calendly",
    "source",
  );
  const sourceBefore = await inspectGeneratedFixture(
    sourceRoot,
    "portfolio-calendly",
  );
  const commands = [];
  let ownedPath;

  try {
    const result = await verifyGeneratedProjectForTesting(
      sourceRoot,
      "portfolio-calendly",
      {
        async createOwner() {
          const identity = await createKnownOwner(ownerParent);
          ownedPath = identity.path;
          return identity;
        },
        async runCommand(input) {
          commands.push(input);
          return successfulCommand(input);
        },
      },
    );

    assert.deepEqual(result, {
      ok: true,
      fixtures: ["portfolio-calendly"],
      workerIntegration: { executed: [], skipped: ["portfolio-calendly"] },
      bindingIntegration: { executed: [], skipped: ["portfolio-calendly"] },
      appBuildEvidence: [],
      profiles: ["portfolio"],
      checks: [
        "pnpm-version",
        "frozen-install",
        "peer-dependencies",
        "dependency-audit",
        "registry-signatures",
        "lint",
        "cloudflare-types",
        "typecheck",
        "unit-tests",
        "component-tests",
        "next-build",
        "opennext-build",
        "browser-install",
        "browser-development",
        "browser-preview",
      ],
    });
    assert.equal(commands.length, 16);
    assert.equal(commands.every(({ cwd }) => cwd.startsWith(`${ownedPath}/`)), true);
    assert.equal(await pathExists(ownedPath), false);
    assert.deepEqual(
      await inspectGeneratedFixture(sourceRoot, "portfolio-calendly"),
      sourceBefore,
    );

    await expectFixtureError(
      () =>
        verifyGeneratedProjectForTesting(sourceRoot, "unknown-capability", {
          async createOwner() {
            throw new Error("owner must not be created");
          },
          async runCommand() {
            throw new Error("command must not run");
          },
        }),
      "FIXTURE_IDENTIFIER_INVALID",
    );
  } finally {
    await rm(ownerParent, { recursive: true, force: true });
  }
});

test("multilingual browser verification injects its error-boundary proof only into the isolated copy", async () => {
  const ownerParent = await mkdtemp(join(tmpdir(), "egeria-multilingual-error-proof-"));
  const sourceRoot = await copyFixture(
    ownerParent,
    "site-multilingual",
    "source",
  );
  const sourceBefore = await inspectGeneratedFixture(
    sourceRoot,
    "site-multilingual",
  );
  const routePath = join(
    "apps/web/app/[locale]/error-boundary-proof/page.tsx",
  );
  const specificationPath = join(
    "apps/web/tests/e2e/multilingual-error-boundary.spec.ts",
  );
  let inspectedCopy = false;
  let ownedPath;

  try {
    assert.equal(await pathExists(join(sourceRoot, routePath)), false);
    assert.equal(await pathExists(join(sourceRoot, specificationPath)), false);

    const result = await verifyGeneratedProjectForTesting(
      sourceRoot,
      "site-multilingual",
      {
        async createOwner() {
          const identity = await createKnownOwner(ownerParent);
          ownedPath = identity.path;
          return identity;
        },
        async runCommand(input) {
          if (!inspectedCopy) {
            inspectedCopy = true;
            const routeSource = await readFile(
              join(input.cwd, routePath),
              "utf8",
            );
            assert.match(routeSource, /throw new Error/u);
            assert.match(routeSource, /sessionStorage/u);
            assert.match(routeSource, /data-testid="verifier-recovery"/u);
            assert.match(
              await readFile(join(input.cwd, specificationPath), "utf8"),
              /toHaveAttribute\("lang", "fr-CA"\)[\s\S]+main\[aria-labelledby="error-fallback-heading"\][\s\S]+fallback\.getByRole\("heading", \{ level: 1 \}\)[\s\S]+fallback\.getByRole\("button"\)[\s\S]+sessionStorage[\s\S]+retry\.click\(\)[\s\S]+getByTestId\("verifier-recovery"\)/u,
            );
          }
          return successfulCommand(input);
        },
      },
    );

    assert.equal(result.ok, true);
    assert.equal(inspectedCopy, true);
    assert.equal(await pathExists(ownedPath), false);
    assert.deepEqual(
      await inspectGeneratedFixture(sourceRoot, "site-multilingual"),
      sourceBefore,
    );
    assert.equal(await pathExists(join(sourceRoot, routePath)), false);
    assert.equal(await pathExists(join(sourceRoot, specificationPath)), false);
  } finally {
    await rm(ownerParent, { recursive: true, force: true });
  }
});

test("visual verification accepts only the exact opt-in argument", () => {
  assert.deepEqual(parseVerificationArguments([]), { includeVisual: false });
  assert.deepEqual(parseVerificationArguments(["--visual"]), {
    includeVisual: true,
  });
  for (const arguments_ of [
    ["--unknown"],
    ["--visual", "--visual"],
    ["--visual=true"],
  ]) {
    assert.throws(() => parseVerificationArguments(arguments_), {
      name: "GeneratedFixtureVerificationError",
      code: "VERIFICATION_ARGUMENT_INVALID",
    });
  }
});

test("visual verification runs after prepared preview behavior", async () => {
  await withPortfolioVisualFixture(async ({ ownerParent, sourceRoot }) => {
    const commands = [];
    const result = await verifyGeneratedProjectForTesting(
      sourceRoot,
      "portfolio",
      {
        async createOwner() {
          return createKnownOwner(ownerParent);
        },
        async runCommand(input) {
          commands.push(input.arguments);
          return successfulCommand(input);
        },
      },
      undefined,
      { includeVisual: true },
    );

    assert.deepEqual(result.checks, [
      "pnpm-version",
      "frozen-install",
      "peer-dependencies",
      "dependency-audit",
      "registry-signatures",
      "lint",
      "cloudflare-types",
      "typecheck",
      "unit-tests",
      "component-tests",
      "next-build",
      "opennext-build",
      "browser-install",
      "browser-development",
      "browser-preview",
      "visual-regression",
    ]);
    assert.equal(commands.length, 17);
    assert.deepEqual(commands.at(-2), [
      "--dir",
      "apps/web",
      "run",
      "test:e2e:preview",
    ]);
    assert.deepEqual(commands.at(-1), [
      "--dir",
      "apps/web",
      "run",
      "test:visual",
    ]);
  });
});

test("visual opt-in leaves the multilingual fixture outside the established matrix", async () => {
  const ownerParent = await mkdtemp(join(tmpdir(), "egeria-visual-matrix-"));
  const commands = [];

  try {
    const result = await verifyGeneratedSkeletonsForTesting(
      {
        async createOwner() {
          return createKnownOwner(ownerParent);
        },
        async runCommand(input) {
          commands.push(input);
          return successfulCommand(input);
        },
      },
      { includeVisual: true },
    );

    assert.equal(result.checks.includes("visual-regression"), true);
    assert.deepEqual(
      commands
        .filter(({ arguments: arguments_ }) =>
          arguments_.includes("test:visual"),
        )
        .map(({ cwd }) => basename(cwd))
        .sort(),
      ["app-project", "portfolio-calendly-project", "portfolio-project", "site-project"],
    );
    assert.equal(
      commands.some(
        ({ arguments: arguments_, cwd }) =>
          arguments_.includes("test:visual") &&
          basename(cwd) === "site-multilingual-project",
      ),
      false,
    );
  } finally {
    await rm(ownerParent, { recursive: true, force: true });
  }
});

test("single-project visual opt-in reports only checks that actually run", async () => {
  const ownerParent = await mkdtemp(join(tmpdir(), "egeria-visual-receipt-"));
  const commands = [];

  try {
    const result = await verifyGeneratedProjectForTesting(
      resolve(repositoryRoot, fixtureRoot("site-multilingual")),
      "site-multilingual",
      {
        async createOwner() {
          return createKnownOwner(ownerParent);
        },
        async runCommand(input) {
          commands.push(input.arguments);
          return successfulCommand(input);
        },
      },
      undefined,
      { includeVisual: true },
    );

    assert.equal(result.checks.includes("visual-regression"), false);
    assert.equal(
      commands.some((arguments_) => arguments_.includes("test:visual")),
      false,
    );
  } finally {
    await rm(ownerParent, { recursive: true, force: true });
  }
});

test("preview failures export browser artifacts before owned cleanup", async () => {
  await withPortfolioVisualFixture(async ({ ownerParent, sourceRoot }) => {
    let capturedPreviewFailure;
    let failedOwnerPath;
    const failedArtifactRoot = join(ownerParent, "exported-artifacts");
    await expectFixtureError(
      () =>
        verifyGeneratedProjectForTesting(sourceRoot, "portfolio", {
          async createOwner() {
            const owner = await createKnownOwner(ownerParent);
            failedOwnerPath = owner.path;
            return owner;
          },
          async runCommand(input) {
            if (input.arguments.at(-1) === "test:e2e:preview") {
              await mkdir(join(input.cwd, "apps/web/playwright-report"), {
                recursive: true,
              });
              await mkdir(join(input.cwd, "apps/web/test-results"), {
                recursive: true,
              });
              await writeFile(
                join(input.cwd, "apps/web/playwright-report/index.html"),
                "bounded preview report",
              );
              await writeFile(
                join(input.cwd, "apps/web/test-results/trace.zip"),
                "bounded preview trace",
              );
              throw new Error("PRIVATE_VALUE");
            }
            return successfulCommand(input);
          },
          async captureVisualArtifacts(input) {
            capturedPreviewFailure = {
              failureCode: input.failureCode,
              identifier: input.identifier,
              ownerExists: await pathExists(failedOwnerPath),
              validationRoot: input.validationRoot,
            };
            await captureVisualFailureArtifactsForTesting({
              ...input,
              artifactRoot: failedArtifactRoot,
            });
          },
        }),
      "BROWSER_PREVIEW_FAILED",
    );
    assert.deepEqual(capturedPreviewFailure, {
      failureCode: "BROWSER_PREVIEW_FAILED",
      identifier: "portfolio",
      ownerExists: true,
      validationRoot: join(failedOwnerPath, "portfolio-project"),
    });
    assert.equal(await pathExists(failedOwnerPath), false);
    const exportedDirectories = await readdir(failedArtifactRoot);
    assert.equal(exportedDirectories.length, 1);
    const exportedRoot = join(failedArtifactRoot, exportedDirectories[0]);
    assert.equal(
      await readFile(join(exportedRoot, "playwright-report/index.html"), "utf8"),
      "bounded preview report",
    );
    assert.equal(
      await readFile(join(exportedRoot, "test-results/trace.zip"), "utf8"),
      "bounded preview trace",
    );
    assert.deepEqual(
      JSON.parse(await readFile(join(exportedRoot, "failure.json"), "utf8")),
      { code: "BROWSER_PREVIEW_FAILED", fixture: "portfolio" },
    );
  });
});

test("preview diagnostics retain process and new server evidence without raw output", async () => {
  await withPortfolioVisualFixture(async ({ ownerParent, sourceRoot }) => {
    let ownerPath;
    const artifactRoot = join(ownerParent, "diagnostics");
    const syntheticHome = ["", "Users", "PRIVATE_USER"].join("/");
    await expectFixtureError(() => verifyGeneratedProjectForTesting(sourceRoot, "portfolio", {
      async createOwner() {
        const owner = await createKnownOwner(ownerParent);
        ownerPath = owner.path;
        return owner;
      },
      async runCommand(input) {
        const logs = previewLogDirectory(input.environment.HOME);
        if (input.arguments.at(-1) === "test:e2e:dev") {
          await mkdir(logs, { recursive: true });
          await writeFile(join(logs, "wrangler-2026-09-13_12-00-00.log"), "ECONNREFUSED PRIVATE_OLD_LOG\n");
        }
        if (input.arguments.at(-1) === "test:e2e:preview") {
          await writeFile(join(logs, "wrangler-2026-09-13_12-01-00.log"), [
            "Error in ProxyController: Error inside ProxyWorker",
            "  cause: { message: 'Network connection lost.' }",
            "Authorization: Bearer PRIVATE_TOKEN",
            "Cookie: PRIVATE_COOKIE",
            "request body: PRIVATE_REQUEST response body: PRIVATE_RESPONSE",
            `    at file://${syntheticHome}/project/server.js:1:2`,
          ].join("\n"));
          return execFileAsync(process.execPath, ["-e", [
            `process.stdout.write(${JSON.stringify(`PRIVATE_STDOUT ${syntheticHome}/server C:\\PRIVATE_PATH\n`)});`,
            'process.stderr.write("net::ERR_CONNECTION_REFUSED PRIVATE_STDERR\\n");',
            'process.exitCode = 7;',
          ].join("\n")], { cwd: input.cwd, env: input.environment });
        }
        return successfulCommand(input);
      },
      captureVisualArtifacts: (input) => captureVisualFailureArtifactsForTesting({ ...input, artifactRoot }),
    }), "BROWSER_PREVIEW_FAILED");
    assert.equal(await pathExists(ownerPath), false);
    const outputs = await readdir(artifactRoot);
    assert.equal(outputs.length, 1);
    const outputRoot = join(artifactRoot, outputs[0]);
    assert.ok((await readdir(outputRoot)).includes("preview-diagnostics.json"), "safe preview diagnostics survive owner cleanup");
    const raw = await readFile(join(outputRoot, "preview-diagnostics.json"), "utf8");
    const diagnostics = JSON.parse(raw);
    assert.deepEqual(diagnostics.process, { exitCode: 7, signal: null, killed: false, outputLimitExceeded: false });
    assert.equal(diagnostics.stdout.status, "inspected");
    assert.deepEqual(diagnostics.stdout.indicators, []);
    assert.deepEqual(diagnostics.stderr.indicators, ["connection-refused"]);
    assert.deepEqual(diagnostics.wrangler, {
      status: "inspected", logsInspected: 1,
      indicators: ["proxy-worker-error", "network-connection-lost"],
    });
    assert.doesNotMatch(raw, /PRIVATE_|Authorization|Cookie|Bearer|file:\/\/|\/Users\/|C:\\/u);
    assert.equal((await lstat(join(outputRoot, "preview-diagnostics.json"))).mode & 0o777, 0o600);
    assert.deepEqual(JSON.parse(await readFile(join(outputRoot, "failure.json"), "utf8")), {
      code: "BROWSER_PREVIEW_FAILED", fixture: "portfolio",
    });
  });
});

async function inspectFailedPreviewDiagnostics({ prepare = async () => {}, failPreview, maximumBytes } = {}) {
  return withPortfolioVisualFixture(async ({ ownerParent, sourceRoot }) => {
    let ownerPath;
    let primaryError;
    const artifactRoot = join(ownerParent, "diagnostics");
    await assert.rejects(() => verifyGeneratedProjectForTesting(sourceRoot, "portfolio", {
      async createOwner() {
        const owner = await createKnownOwner(ownerParent);
        ownerPath = owner.path;
        return owner;
      },
      async runCommand(input) {
        if (input.arguments.at(-1) === "test:e2e:dev") await prepare(input, ownerParent);
        if (input.arguments.at(-1) === "test:e2e:preview") await failPreview(input, ownerParent);
        return successfulCommand(input);
      },
      captureVisualArtifacts: (input) => captureVisualFailureArtifactsForTesting({ ...input, artifactRoot, maximumBytes }),
    }), (error) => {
      primaryError = error;
      assert.equal(error.code, "BROWSER_PREVIEW_FAILED");
      assert.doesNotMatch(String(error), /PRIVATE_/u);
      return true;
    });
    assert.equal(await pathExists(ownerPath), false);
    const outputs = await readdir(artifactRoot);
    const raw = outputs.length === 0 ? undefined : await readFile(join(artifactRoot, outputs[0], "preview-diagnostics.json"), "utf8");
    if (raw !== undefined) assert.doesNotMatch(raw, /PRIVATE_|Authorization|Cookie|Bearer|\/Users\//u);
    return { diagnostics: raw === undefined ? undefined : JSON.parse(raw), primaryError, outputs };
  });
}

function previewLogDirectory(home) {
  const configuration = process.platform === "darwin" ? "Library/Preferences"
    : process.platform === "win32" ? "AppData/Roaming/xdg.config" : ".config";
  return join(home, configuration, ".wrangler/logs");
}

test("preview diagnostics inspect the native Wrangler log directory", async () => {
  const result = await inspectFailedPreviewDiagnostics({
    async failPreview(input) {
      const logs = previewLogDirectory(input.environment.HOME);
      await mkdir(logs, { recursive: true });
      await writeFile(join(logs, "wrangler-preview.log"), "Network connection lost. PRIVATE_TOKEN");
      throw new Error("PRIVATE_MESSAGE");
    },
  });
  assert.deepEqual(result.diagnostics.wrangler, { status: "inspected", logsInspected: 1, indicators: ["network-connection-lost"] });
});

test("preview diagnostics inspect only appended bytes of an existing server log", async () => {
  const oldContent = "ECONNREFUSED PRIVATE_OLD_LOG\n";
  const result = await inspectFailedPreviewDiagnostics({
    async prepare(input) {
      const logs = previewLogDirectory(input.environment.HOME);
      await mkdir(logs, { recursive: true });
      await writeFile(join(logs, "wrangler-existing.log"), oldContent);
    },
    async failPreview(input) {
      await writeFile(join(previewLogDirectory(input.environment.HOME), "wrangler-existing.log"),
        `${oldContent}Network connection lost. PRIVATE_NEW_LOG\n`);
      throw Object.assign(new Error("PRIVATE_MESSAGE"), {
        code: "ERR_CHILD_PROCESS_STDIO_MAXBUFFER", signal: "SIGTERM", killed: true,
        stdout: "PRIVATE_STDOUT", stderr: Buffer.from("\u001b[31m✘ [ERROR]\u001b[0m PRIVATE_STDERR"),
      });
    },
  });
  assert.deepEqual(result.diagnostics.wrangler, { status: "inspected", logsInspected: 1, indicators: ["network-connection-lost"] });
  assert.deepEqual(result.diagnostics.process, { exitCode: null, signal: "SIGTERM", killed: true, outputLimitExceeded: true });
  assert.deepEqual(result.diagnostics.stderr.indicators, ["wrangler-error"]);
});

test("preview diagnostic extraction failures preserve the original verification failure", async () => {
  const result = await inspectFailedPreviewDiagnostics({
    async failPreview() {
      throw Object.defineProperty(new Error("PRIVATE_MESSAGE"), "stdout", {
        get() { throw new Error("PRIVATE_DIAGNOSTIC_FAILURE"); },
      });
    },
  });
  assert.deepEqual(result.diagnostics, { status: "refused" });
  assert.equal(result.primaryError.artifactExportCode, undefined);
});

test("preview diagnostics refuse unsupported or oversized command output", async () => {
  for (const stdout of [{ toString() { throw new Error("PRIVATE_GETTER"); } }, "PRIVATE_".repeat(150000)]) {
    const result = await inspectFailedPreviewDiagnostics({
      async failPreview() {
        throw Object.assign(new Error("PRIVATE_MESSAGE"), { stdout, stderr: "PRIVATE_STDERR", code: "PRIVATE_CODE", signal: "PRIVATE_SIGNAL" });
      },
    });
    assert.deepEqual(result.diagnostics.stdout, { status: "refused" });
    assert.deepEqual(result.diagnostics.stderr.indicators, []);
    assert.deepEqual(result.diagnostics.wrangler, { status: "absent" });
    assert.deepEqual(result.diagnostics.process, { exitCode: null, signal: null, killed: false, outputLimitExceeded: false });
  }
});

test("preview diagnostics refuse symlinked server directories and files", async () => {
  for (const target of ["directory", "file"]) {
    const result = await inspectFailedPreviewDiagnostics({
      async failPreview(input, ownerParent) {
        const home = input.environment.HOME;
        const outside = join(ownerParent, "unrelated");
        await mkdir(outside);
        await writeFile(join(outside, "wrangler-private.log"), "Network connection lost. PRIVATE_TOKEN");
        if (target === "directory") {
          await mkdir(dirname(previewLogDirectory(home)), { recursive: true });
          await symlink(outside, previewLogDirectory(home));
        } else {
          await mkdir(previewLogDirectory(home), { recursive: true });
          await symlink(join(outside, "wrangler-private.log"), join(previewLogDirectory(home), "wrangler-linked.log"));
        }
        throw new Error("PRIVATE_MESSAGE");
      },
    });
    assert.deepEqual(result.diagnostics.wrangler, { status: "refused" });
    assert.equal(result.primaryError.artifactExportCode, undefined);
  }
});

test("preview diagnostics refuse excessive server log counts and aggregate bytes", async () => {
  for (const variant of ["count", "bytes"]) {
    const result = await inspectFailedPreviewDiagnostics({
      async failPreview(input) {
        const logs = previewLogDirectory(input.environment.HOME);
        await mkdir(logs, { recursive: true });
        const count = variant === "count" ? 33 : 2;
        for (let index = 0; index < count; index += 1) {
          await writeFile(join(logs, `wrangler-${index}.log`), variant === "bytes" ? "x".repeat(600000) : "Network connection lost. PRIVATE_TOKEN");
        }
        throw new Error("PRIVATE_MESSAGE");
      },
    });
    assert.deepEqual(result.diagnostics.wrangler, { status: "refused" });
  }
});

test("preview diagnostic bytes share the artifact cap without replacing the primary failure", async () => {
  const result = await inspectFailedPreviewDiagnostics({
    maximumBytes: 8,
    async failPreview() { throw new Error("PRIVATE_MESSAGE"); },
  });
  assert.equal(result.diagnostics, undefined);
  assert.deepEqual(result.outputs, []);
  assert.equal(result.primaryError.artifactExportCode, "VISUAL_ARTIFACT_EXPORT_FAILED");
});

test("visual failures export artifacts before owned cleanup", async () => {
  await withPortfolioVisualFixture(async ({ ownerParent, sourceRoot }) => {
    let capturedVisualFailure;
    let failedOwnerPath;
    const failedArtifactRoot = join(ownerParent, "exported-artifacts");
    await expectFixtureError(
      () =>
        verifyGeneratedProjectForTesting(
          sourceRoot,
          "portfolio",
          {
            async createOwner() {
              const owner = await createKnownOwner(ownerParent);
              failedOwnerPath = owner.path;
              return owner;
            },
            async runCommand(input) {
              if (input.arguments.at(-1) === "test:visual") {
                await mkdir(join(input.cwd, "apps/web/playwright-report"), {
                  recursive: true,
                });
                await mkdir(join(input.cwd, "apps/web/test-results"), {
                  recursive: true,
                });
                await writeFile(
                  join(input.cwd, "apps/web/playwright-report/index.html"),
                  "bounded report",
                );
                await writeFile(
                  join(input.cwd, "apps/web/test-results/actual.png"),
                  "bounded image",
                );
                throw new Error("PRIVATE_VALUE");
              }
              return successfulCommand(input);
            },
            async captureVisualArtifacts(input) {
              capturedVisualFailure = {
                identifier: input.identifier,
                ownerExists: await pathExists(failedOwnerPath),
                validationRoot: input.validationRoot,
              };
              await captureVisualFailureArtifactsForTesting({
                ...input,
                artifactRoot: failedArtifactRoot,
              });
            },
          },
          undefined,
          { includeVisual: true },
        ),
      "VISUAL_REGRESSION_FAILED",
    );
    assert.deepEqual(capturedVisualFailure, {
      identifier: "portfolio",
      ownerExists: true,
      validationRoot: join(failedOwnerPath, "portfolio-project"),
    });
    assert.equal(await pathExists(failedOwnerPath), false);
    const exportedDirectories = await readdir(failedArtifactRoot);
    assert.equal(exportedDirectories.length, 1);
    const exportedRoot = join(failedArtifactRoot, exportedDirectories[0]);
    assert.equal(
      await readFile(join(exportedRoot, "playwright-report/index.html"), "utf8"),
      "bounded report",
    );
    assert.equal(
      await readFile(join(exportedRoot, "test-results/actual.png"), "utf8"),
      "bounded image",
    );
    assert.deepEqual(
      JSON.parse(await readFile(join(exportedRoot, "failure.json"), "utf8")),
      { code: "VISUAL_REGRESSION_FAILED", fixture: "portfolio" },
    );
  });
});

test("visual artifact export failure preserves the primary regression code", async () => {
  await withPortfolioVisualFixture(async ({ ownerParent, sourceRoot }) => {
    let failedOwnerPath;
    await assert.rejects(
      () =>
        verifyGeneratedProjectForTesting(
          sourceRoot,
          "portfolio",
          {
            async createOwner() {
              const owner = await createKnownOwner(ownerParent);
              failedOwnerPath = owner.path;
              return owner;
            },
            async runCommand(input) {
              if (input.arguments.at(-1) === "test:visual") {
                throw new Error("PRIVATE_VALUE");
              }
              return successfulCommand(input);
            },
            async captureVisualArtifacts() {
              throw new Error("PRIVATE_EXPORT_VALUE");
            },
          },
          undefined,
          { includeVisual: true },
        ),
      (error) => {
        assert.equal(error?.name, "GeneratedFixtureVerificationError");
        assert.equal(error?.code, "VISUAL_REGRESSION_FAILED");
        assert.equal(
          error?.artifactExportCode,
          "VISUAL_ARTIFACT_EXPORT_FAILED",
        );
        assert.doesNotMatch(String(error), /PRIVATE_/u);
        return true;
      },
    );
    assert.equal(await pathExists(failedOwnerPath), false);
  });
});

test("visual artifact export caps total bytes and restricts its root", async () => {
  const owner = await mkdtemp(join(tmpdir(), "egeria-visual-artifact-cap-"));
  const validationRoot = join(owner, "validation");
  const artifactRoot = join(owner, "artifacts");

  try {
    await mkdir(join(validationRoot, "apps/web/playwright-report"), {
      recursive: true,
    });
    await mkdir(join(validationRoot, "apps/web/test-results"), {
      recursive: true,
    });
    await writeFile(
      join(validationRoot, "apps/web/playwright-report/index.html"),
      "1234",
    );
    await writeFile(
      join(validationRoot, "apps/web/test-results/actual.png"),
      "5678",
    );
    await mkdir(artifactRoot, { mode: 0o700 });
    await chmod(artifactRoot, 0o777);

    await expectFixtureError(
      () =>
        captureVisualFailureArtifactsForTesting({
          identifier: "portfolio",
          validationRoot,
          artifactRoot,
          maximumBytes: 7,
        }),
      "VISUAL_ARTIFACT_EXPORT_FAILED",
    );

    const artifactRootStats = await lstat(artifactRoot);
    assert.equal(artifactRootStats.mode & 0o777, 0o700);
    assert.deepEqual(await readdir(artifactRoot), []);
  } finally {
    await rm(owner, { recursive: true, force: true });
  }
});

test("single-root verification accepts an explicit generated project identity", async () => {
  const ownerParent = await mkdtemp(
    join(tmpdir(), "egeria-single-root-identity-"),
  );
  const canonicalRoot = resolve(repositoryRoot, fixtureRoot("portfolio"));
  const canonicalBefore = await inspectGeneratedFixture(
    canonicalRoot,
    "portfolio",
  );
  const renamedRoot = await copyFixture(
    ownerParent,
    "portfolio",
    "renamed-source",
  );
  let ownedPath;

  try {
    for (const [relativePath, name] of [
      ["package.json", "acme-generated-project"],
      ["apps/web/package.json", "acme-generated-project-web"],
    ]) {
      const manifestPath = join(renamedRoot, relativePath);
      const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
      await writeFile(
        manifestPath,
        `${JSON.stringify({ ...manifest, name }, null, 2)}\n`,
        "utf8",
      );
    }

    const result = await verifyGeneratedProjectForTesting(
      renamedRoot,
      "portfolio",
      {
        async createOwner() {
          const identity = await createKnownOwner(ownerParent);
          ownedPath = identity.path;
          return identity;
        },
        async runCommand(input) {
          return successfulCommand(input);
        },
      },
      "acme-generated-project",
    );

    assert.deepEqual(result.fixtures, ["portfolio"]);
    assert.deepEqual(result.profiles, ["portfolio"]);
    assert.equal(await pathExists(ownedPath), false);
    assert.deepEqual(
      await inspectGeneratedFixture(canonicalRoot, "portfolio"),
      canonicalBefore,
    );
  } finally {
    await rm(ownerParent, { recursive: true, force: true });
  }
});

test("live verification uses fixed copies, a minimal environment, and exact commands", async () => {
  const ownerParent = await mkdtemp(join(tmpdir(), "egeria-fixture-harness-"));
  let ownedPath;
  const commands = [];
  const sourceBefore = await Promise.all(
    generatedFixtureContracts.map(({ identifier, relativeRoot }) =>
      inspectGeneratedFixture(resolve(repositoryRoot, relativeRoot), identifier),
    ),
  );

  const injectedEnvironment = {
    CLOUDFLARE_API_TOKEN: "PRIVATE_VALUE",
    NODE_OPTIONS: "--require=/private/unapproved-module.cjs",
    NPM_CONFIG_USERCONFIG: "/private/unapproved-npmrc",
    NPM_TOKEN: "PRIVATE_VALUE",
    PLAYWRIGHT_BROWSERS_PATH: "/private/unapproved-browsers",
    PLAYWRIGHT_DEPLOYED_URL: "https://private.invalid",
    XDG_CACHE_HOME: "/private/unapproved-cache",
  };
  const previousEnvironment = Object.fromEntries(
    Object.keys(injectedEnvironment).map((key) => [key, process.env[key]]),
  );
  Object.assign(process.env, injectedEnvironment);
  try {
    const result = await verifyGeneratedSkeletonsForTesting({
      async createOwner() {
        const identity = await createKnownOwner(ownerParent);
        ownedPath = identity.path;
        return identity;
      },
      async runCommand(input) {
        commands.push(input);
        assert.equal(input.executable, "pnpm");
        assert.equal(input.environment.NPM_TOKEN, undefined);
        assert.equal(input.environment.NODE_AUTH_TOKEN, undefined);
        assert.equal(input.environment.PLAYWRIGHT_DEPLOYED_URL, undefined);
        assert.equal(input.environment.CLOUDFLARE_API_TOKEN, undefined);
        assert.equal(input.environment.NODE_OPTIONS, undefined);
        assert.equal(input.environment.CI, "true");
        assert.equal(input.environment.NEXT_TELEMETRY_DISABLED, "1");
        assert.equal(
          input.environment.NPM_CONFIG_REGISTRY,
          "https://registry.npmjs.org/",
        );
        assert.equal(input.cwd.startsWith(`${ownedPath}/`), true);
        assert.equal(
          input.environment.PLAYWRIGHT_BROWSERS_PATH.startsWith(
            `${ownedPath}/`,
          ),
          true,
        );
        assert.equal(
          input.environment.XDG_CACHE_HOME.startsWith(`${ownedPath}/`),
          true,
        );
        const inheritedKeys = [
          "PATH",
          "SystemRoot",
          "ComSpec",
          "PATHEXT",
          "LANG",
        ].filter((key) =>
          Object.keys(process.env).some(
            (candidate) => candidate.toLowerCase() === key.toLowerCase(),
          ),
        );
        assert.deepEqual(Object.keys(input.environment).sort(), [
          ...inheritedKeys,
          ...(process.platform === "darwin" ? ["__CF_USER_TEXT_ENCODING"] : []),
          "CI",
          "HOME",
          "NEXT_TELEMETRY_DISABLED",
          "NPM_CONFIG_REGISTRY",
          "NPM_CONFIG_USERCONFIG",
          "PLAYWRIGHT_BROWSERS_PATH",
          "TEMP",
          "TMP",
          "TMPDIR",
          "USERPROFILE",
          "XDG_CACHE_HOME",
        ].sort());
        return successfulCommand(input);
      },
    });

    const { appBuildEvidence, auditDispositions, status, ...verification } = result;
    assert.equal(status, "completed");
    assert.deepEqual(auditDispositions.map(({ fixture }) => fixture), result.fixtures);
    assert.equal(auditDispositions.every(audit => audit.status === "passed" && audit.rawExitCode === 0), true);
    assert.deepEqual(appBuildEvidence.map(({ fixture }) => fixture), ["app", "app-all-optional-integrations", "app-persistence", "portfolio-email", "app-persistence-email"]);
    for (const build of appBuildEvidence) {
      assert.equal(build.effect.version, "4.0.0-rc.112");
      assert.equal(build.client.files.length, 1);
      assert.deepEqual(build.client.inspectedEffectMarkers, ["~effect/Effect"]);
      assert.equal(build.worker.path, "apps/web/.open-next/server-functions/default/handler.mjs");
      assert.match(build.worker.sha256, /^[a-f0-9]{64}$/u);
    }
    assert.deepEqual(verification, {
      ok: true,
      fixtures: [
        "portfolio",
        "portfolio-calendly",
        "site",
        "site-multilingual",
        "site-multilingual-analytics",
        "app",
        "app-all-optional-integrations",
        "app-persistence",
        "portfolio-email",
        "app-persistence-email",
        "site-contact-form",
      ],
      profiles: ["portfolio", "site", "app"],
      workerIntegration: {
        executed: ["app", "app-all-optional-integrations", "app-persistence", "portfolio-email", "app-persistence-email"],
        skipped: ["portfolio", "portfolio-calendly", "site", "site-multilingual", "site-multilingual-analytics", "site-contact-form"],
      },
      bindingIntegration: {
        executed: ["app-persistence", "app-persistence-email"],
        skipped: ["portfolio", "portfolio-calendly", "site", "site-multilingual", "site-multilingual-analytics", "app", "app-all-optional-integrations", "portfolio-email", "site-contact-form"],
      },
      checks: [
        "pnpm-version",
        "frozen-install",
        "peer-dependencies",
        "dependency-audit",
        "registry-signatures",
        "lint",
        "cloudflare-types",
        "typecheck",
        "unit-tests",
        "component-tests",
        "next-build",
        "opennext-build",
        "browser-install",
        "browser-development",
        "browser-preview",
      ],
    });
  } finally {
    for (const [key, value] of Object.entries(previousEnvironment)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }

  const fixtureCommands = generatedFixtureContracts.map(({ identifier }) =>
    commands.filter(({ cwd }) => cwd === join(ownedPath, `${identifier}-project`)),
  );
  assert.deepEqual(fixtureCommands.map((entries) => entries.length), [16, 16, 16, 16, 16, 16, 16, 18, 16, 18, 16]);
  const firstCommands = fixtureCommands.map(
    ([command]) => command,
  );
  assert.equal(
    new Set(firstCommands.map(({ cwd }) => cwd)).size,
    generatedFixtureContracts.length,
  );
  for (const key of [
    "HOME",
    "USERPROFILE",
    "TMPDIR",
    "TMP",
    "TEMP",
    "NPM_CONFIG_USERCONFIG",
    "PLAYWRIGHT_BROWSERS_PATH",
    "XDG_CACHE_HOME",
  ]) {
    assert.equal(
      new Set(firstCommands.map(({ environment }) => environment[key])).size,
      generatedFixtureContracts.length,
      `${key} must be isolated per fixture identifier`,
    );
  }
  assert.equal(
    new Set(fixtureCommands.map((entries) => entries[1].arguments.at(-1))).size,
    generatedFixtureContracts.length,
    "pnpm stores must be isolated per fixture identifier",
  );

  const argumentLists = commands.map(({ arguments: arguments_ }) => arguments_);
  const perFixture = argumentLists.slice(0, 16).map((arguments_) =>
    arguments_.map((argument) =>
      ownedPath !== undefined && argument.startsWith(ownedPath)
        ? "<owned-path>"
        : argument,
    ),
  );
  for (const [fixtureIndex, arguments_] of fixtureCommands.entries()) {
    const expected = generatedFixtureContracts[fixtureIndex].expectedApplicationPersistenceVersion === "0.1.0"
      ? [...perFixture.slice(0, 6), ["run", "typecheck"], ...perFixture.slice(6)]
      : perFixture;
    assert.deepEqual(
      arguments_.filter(({ arguments: current }) => current.at(-1) !== "test:integration:bindings").map(({ arguments: current }) =>
        current.map((argument) =>
          ownedPath !== undefined && argument.startsWith(ownedPath)
            ? "<owned-path>"
            : argument,
        ),
      ),
      expected,
    );
  }
  assert.deepEqual(perFixture, [
    ["--version"],
    ["install", "--frozen-lockfile", "--store-dir", "<owned-path>"],
    ["peers", "check"],
    ["audit", "--audit-level", "info", "--json"],
    ["audit", "signatures"],
    ["run", "lint"],
    ["--dir", "apps/web", "run", "cf-typegen"],
    ["run", "typecheck"],
    ["run", "test:unit"],
    ["run", "test:component"],
    ["run", "build"],
    [
      "--dir",
      "apps/web",
      "exec",
      "opennextjs-cloudflare",
      "build",
      "--skipNextBuild",
    ],
    ["--dir", "apps/web", "run", "--if-present", "test:integration:cloudflare"],
    ["--dir", "apps/web", "run", "browser:install"],
    ["--dir", "apps/web", "run", "test:e2e:dev"],
    ["--dir", "apps/web", "run", "test:e2e:preview"],
  ]);
  assert.equal(await pathExists(ownedPath), false);

  const sourceAfter = await Promise.all(
    generatedFixtureContracts.map(({ identifier, relativeRoot }) =>
      inspectGeneratedFixture(resolve(repositoryRoot, relativeRoot), identifier),
    ),
  );
  assert.deepEqual(sourceAfter, sourceBefore);
  await rm(ownerParent, { recursive: true, force: true });
});

test("live verification reports a stable failure and still removes its owner", async () => {
  const ownerParent = await mkdtemp(join(tmpdir(), "egeria-fixture-failure-"));
  let ownedPath;

  try {
    await expectFixtureError(
      () =>
        verifyGeneratedSkeletonsForTesting({
          async createOwner() {
            const identity = await createKnownOwner(ownerParent);
            ownedPath = identity.path;
            return identity;
          },
          async runCommand(input) {
            if (input.arguments.join(" ") === "audit --audit-level info --json") {
              throw new Error("PRIVATE_VALUE");
            }
            return successfulCommand(input);
          },
        }),
      "DEPENDENCY_AUDIT_FAILED",
    );
    assert.equal(await pathExists(ownedPath), false);
  } finally {
    await rm(ownerParent, { recursive: true, force: true });
  }
});

test("live verification maps the prepared OpenNext transform failure", async () => {
  const ownerParent = await mkdtemp(join(tmpdir(), "egeria-fixture-opennext-"));
  let ownedPath;

  try {
    await expectFixtureError(
      () =>
        verifyGeneratedSkeletonsForTesting({
          async createOwner() {
            const identity = await createKnownOwner(ownerParent);
            ownedPath = identity.path;
            return identity;
          },
          async runCommand(input) {
            if (
              input.arguments.join(" ") ===
              "--dir apps/web exec opennextjs-cloudflare build --skipNextBuild"
            ) {
              throw new Error("PRIVATE_VALUE");
            }
            return successfulCommand(input);
          },
        }),
      "OPENNEXT_BUILD_FAILED",
    );
    assert.equal(await pathExists(ownedPath), false);
  } finally {
    await rm(ownerParent, { recursive: true, force: true });
  }
});


test("active fixture inspection refuses retained dependency cohorts", async () => {
  for (const { identifier, profile } of generatedFixtureContracts) {
    const retainedRecipe = profile === "portfolio" ? "0.11.2" : profile === "site" ? "0.12.2" : "0.2.2";
    for (const root of [identifier, `${identifier}-${retainedRecipe}`]) {
      await expectFixtureError(
        () => inspectGeneratedFixture(resolve(repositoryRoot, "fixtures/generated", root), identifier),
        "FIXTURE_INVENTORY_INVALID",
      );
    }
  }
});

test("active fixture inspection independently refuses retained workspace policies", async () => {
  const owner = await mkdtemp(join(tmpdir(), "retained-fixture-policy-"));
  try {
    for (const { identifier } of generatedFixtureContracts) {
      const root = await copyFixture(owner, identifier, "retained-policy");
      const policyPath = join(root, "pnpm-workspace.yaml");
      const historicalPolicy = await readFile(
        resolve(repositoryRoot, "fixtures/generated", identifier, "pnpm-workspace.yaml"),
      );
      assert.notDeepEqual(await readFile(policyPath), historicalPolicy);
      await writeFile(policyPath, historicalPolicy);
      await expectFixtureError(
        () => inspectGeneratedFixture(root, identifier),
        "FIXTURE_WORKSPACE_POLICY_INVALID",
      );
    }
  } finally {
    await rm(owner, { recursive: true, force: true });
  }
});


test("candidate verification builds each target before recording and never rebuilds prepared output", async t => {
  const core = await import("../../packages/builder-core/dist/index.js");
  const harness = await import("../../scripts/verify-generated-skeletons.mjs");
  assert.equal(typeof harness.verifyApplicationEnvironmentProjectForTesting, "function");
  const parent = await mkdtemp(join(tmpdir(), "environment-verifier-contract-"));
  t.after(() => rm(parent, { recursive: true, force: true }));
  const generated = await core.generateProject({ request: { profile: "portfolio", projectName: "artifact-contract", displayName: "Artifact Contract" },
    destination: join(parent, "source"), renderingContext: core.createApplicationEnvironmentRenderingContext(),
    verifier: { ...core.createPnpmGeneratedProjectVerifier({ pnpmExecutable: "pnpm" }), verifyInIsolatedCopy: async () => ({ ok: true, value: { checks: core.ordinaryGenerationVerificationChecks } }) } });
  assert.equal(generated.ok, true, JSON.stringify(generated));
  const calls = [];
  const result = await harness.verifyApplicationEnvironmentProjectForTesting(generated.value.destination, {
    createOwner: () => createKnownOwner(parent),
    derivePnpmToolEnvironment: async executable => { assert.equal(executable, "pnpm"); return { VOLTA_HOME: "/synthetic/volta", VOLTA_FEATURE_PNPM: "1" }; },
    runCommand: async input => {
      calls.push(input);
      if (input.arguments.includes("record")) {
        await mkdir(join(input.cwd, "apps/web/.open-next"), { recursive: true });
        await writeFile(join(input.cwd, "apps/web/.open-next/prepared-artifact.json"), JSON.stringify({ syntheticHarnessFixture: true, target: input.environment.APPLICATION_ENVIRONMENT }));
      }
      return input.arguments[0] === "--version" ? "11.20.0" : "";
    },
  });
  assert.deepEqual(result.targets.map(value => value.target), ["development", "staging", "production"]);
  for (const target of ["development", "staging", "production"]) {
    const commands = calls.filter(value => value.environment.APPLICATION_ENVIRONMENT === target);
    const record = commands.findIndex(value => value.arguments.includes("record"));
    assert.ok(record > commands.findIndex(value => value.arguments.includes("--skipNextBuild")));
    assert.ok(commands.slice(record + 1).some(value => value.arguments.includes("test:e2e:preview")));
    assert.equal(commands.slice(record + 1).some(value => value.arguments.includes("build") || value.arguments.includes("test:e2e:dev")), false);
    assert.equal(commands.every(value => value.environment.CF_ACCESS_CLIENT_SECRET === undefined && value.environment.CLOUDFLARE_API_TOKEN === undefined), true);
    assert.equal(commands.every(value => value.environment.VOLTA_HOME === "/synthetic/volta" && value.environment.VOLTA_FEATURE_PNPM === "1"), true);
    assert.equal(commands.some(value => value.arguments.includes("--remote") || value.arguments[0] === "audit"), false);
  }
  let retainedPath;
  await assert.rejects(harness.verifyApplicationEnvironmentProjectForTesting(generated.value.destination, {
    createOwner: async () => { const owner = await createKnownOwner(parent); retainedPath = owner.path; return owner; },
    runCommand: async input => {
      if (input.arguments.includes("record")) {
        await mkdir(join(input.cwd, "apps/web/.open-next"), { recursive: true });
        await writeFile(join(input.cwd, "apps/web/.open-next/prepared-artifact.json"), "synthetic-failing-receipt");
      }
      if (input.arguments.includes("test:e2e:preview")) throw new Error("synthetic-preview-failure");
      return input.arguments[0] === "--version" ? "11.20.0" : "";
    },
  }), error => error.code === "BROWSER_PREVIEW_FAILED" && error.retainedEvidencePath === retainedPath);
  assert.equal(await readFile(join(retainedPath, "development-project/apps/web/.open-next/prepared-artifact.json"), "utf8"), "synthetic-failing-receipt");
  assert.equal(JSON.parse(await readFile(join(retainedPath, "verification-failure.json"))).failureCode, "BROWSER_PREVIEW_FAILED");
});

async function createEnvironmentFailureFixture(context, email = false) {
  const core = await import("../../packages/builder-core/dist/index.js");
  const parent = await mkdtemp(join(tmpdir(), "environment-failure-contract-"));
  context.after(() => rm(parent, { recursive: true, force: true }));
  const generated = await core.generateProject({
    request: { profile: "app", projectName: "failure-contract", displayName: "Failure Contract",
      backgroundJobDelivery: true, applicationPersistence: true, ...(email ? { transactionalEmailResend: true } : {}) },
    destination: join(parent, "source"), renderingContext: core.createApplicationEnvironmentRenderingContext(true, false, true),
    verifier: { ...core.createPnpmGeneratedProjectVerifier({ pnpmExecutable: "pnpm" }),
      verifyInIsolatedCopy: async () => ({ ok: true, value: { checks: core.persistenceGenerationVerificationChecks } }) },
  });
  assert.equal(generated.ok, true, JSON.stringify(generated));
  return { parent, source: generated.value.destination };
}

async function recordSyntheticEnvironmentReceipt(input) {
  if (input.arguments.includes("record")) {
    await mkdir(join(input.cwd, "apps/web/.open-next"), { recursive: true });
    await writeFile(join(input.cwd, "apps/web/.open-next/prepared-artifact.json"), `synthetic-${input.environment.APPLICATION_ENVIRONMENT}-receipt`);
  }
  return input.arguments[0] === "--version" ? "11.20.0" : "";
}

test("application environment preview failures retain sanitized diagnostics and the failing target", async context => {
  for (const email of [false, true]) {
    const { parent, source } = await createEnvironmentFailureFixture(context, email);
    const sourceBefore = await readFile(join(source, ".egeria/state.json"));
    const artifactRoot = join(parent, "reports");
    const syntheticHome = ["", "Users", "PRIVATE_USER", "source"].join("/");
    let owner;
    let failure;
    await assert.rejects(verifyApplicationEnvironmentProjectForTesting(source, {
      createOwner: async () => { owner = await createKnownOwner(parent); return owner; },
      derivePnpmToolEnvironment: async () => ({}),
      runCommand: async input => {
        if (input.environment.APPLICATION_ENVIRONMENT === "staging" && input.arguments.includes("test:e2e:preview")) {
          const logs = previewLogDirectory(input.environment.HOME);
          await mkdir(logs, { recursive: true });
          await writeFile(join(logs, "wrangler-2026-09-13_12-01-00.log"), "Error in ProxyController: Error inside ProxyWorker\nNetwork connection lost. Authorization: Bearer PRIVATE_TOKEN");
          await mkdir(join(input.cwd, "apps/web/playwright-report"), { recursive: true });
          await writeFile(join(input.cwd, "apps/web/playwright-report/index.html"), "PRIVATE_REPORT_CONTENT");
          throw Object.assign(new Error("PRIVATE_CAUSE"), {
            code: 7, signal: "SIGTERM", killed: true,
            stdout: `PRIVATE_STDOUT ${syntheticHome}`, stderr: "ECONNREFUSED Cookie: PRIVATE_COOKIE",
          });
        }
        return recordSyntheticEnvironmentReceipt(input);
      },
      captureVisualArtifacts: input => captureVisualFailureArtifactsForTesting({ ...input, artifactRoot }),
    }), error => { failure = error; return error.code === "BROWSER_PREVIEW_FAILED"; });
    assert.equal(failure.verificationFailure?.target, "staging");
    assert.deepEqual(failure.verificationFailure.services, { jobs: true, persistence: true, email });
    assert.equal(failure.verificationFailure.profile, "app");
    assert.equal(failure.verificationFailure.code, "BROWSER_PREVIEW_FAILED");
    const diagnostics = failure.verificationFailure.previewDiagnostics;
    assert.deepEqual(diagnostics.process, { exitCode: 7, signal: "SIGTERM", killed: true, outputLimitExceeded: false });
    assert.deepEqual(diagnostics.stderr.indicators, ["connection-refused"]);
    assert.deepEqual(diagnostics.wrangler, { status: "inspected", logsInspected: 1,
      indicators: ["proxy-worker-error", "network-connection-lost"] });
    assert.equal(failure.retainedEvidencePath, owner.path);
    const retained = JSON.parse(await readFile(join(owner.path, "verification-failure.json"), "utf8"));
    assert.deepEqual(retained.verificationFailure, failure.verificationFailure);
    assert.deepEqual(retained.completedTargets.map(({ target }) => target), ["development"]);
    assert.equal(retained.owner.path, owner.path);
    assert.equal((await lstat(join(owner.path, "verification-failure.json"))).mode & 0o777, 0o600);
    assert.equal(await readFile(join(owner.path, "staging-project/apps/web/.open-next/prepared-artifact.json"), "utf8"), "synthetic-staging-receipt");
    assert.deepEqual(await readFile(join(source, ".egeria/state.json")), sourceBefore);
    const reports = await readdir(artifactRoot);
    assert.equal(reports.length, 1);
    const report = join(artifactRoot, reports[0]);
    const failureReport = await readFile(join(report, "failure.json"), "utf8");
    assert.deepEqual(JSON.parse(failureReport), { code: "BROWSER_PREVIEW_FAILED",
      fixture: email ? "application-environment-app-jobs-persistence-email-staging" : "application-environment-app-jobs-persistence-no-email-staging" });
    const previewReport = await readFile(join(report, "preview-diagnostics.json"), "utf8");
    assert.deepEqual(JSON.parse(previewReport), diagnostics);
    const publicContent = JSON.stringify(failure.verificationFailure) + failureReport + previewReport;
    assert.doesNotMatch(publicContent, /PRIVATE_|Authorization|Cookie|Bearer|\/Users\/|retainedEvidencePath|owner|environmentKeys|arguments|stack|cause/u);
    assert.equal(publicContent.includes(parent), false);
    assert.equal(await readFile(join(report, "playwright-report/index.html"), "utf8"), "PRIVATE_REPORT_CONTENT");
  }
});

test("application environment retention failures preserve the primary verification error", async context => {
  for (const refusal of ["write", "export", "identity", "source"]) {
    const { parent, source } = await createEnvironmentFailureFixture(context);
    let owner;
    let failure;
    let exports = 0;
    await assert.rejects(verifyApplicationEnvironmentProjectForTesting(source, {
      createOwner: async () => {
        owner = await createKnownOwner(parent);
        if (refusal === "write") await writeFile(join(owner.path, "verification-failure.json"), "preserved-existing-evidence");
        return owner;
      },
      derivePnpmToolEnvironment: async () => ({}),
      runCommand: async input => {
        if (input.arguments.includes("test:e2e:preview")) {
          if (refusal === "identity") owner.inode += 1n;
          if (refusal === "source") await writeFile(join(source, "unexpected-source-change"), "synthetic change");
          throw new Error("PRIVATE_PREVIEW_CAUSE");
        }
        return recordSyntheticEnvironmentReceipt(input);
      },
      captureVisualArtifacts: async () => {
        exports++;
        if (refusal === "export") throw new Error("PRIVATE_EXPORT_CAUSE");
      },
    }), error => { failure = error; return true; });
    const primaryCode = refusal === "source" ? "FIXTURE_SOURCE_CHANGED" : "BROWSER_PREVIEW_FAILED";
    assert.equal(failure.code, primaryCode, refusal);
    assert.equal(failure.message, `Generated fixture verification failed: ${primaryCode}`, refusal);
    assert.equal(failure.verificationFailure?.code, primaryCode, refusal);
    assert.equal(failure.verificationFailure.target, "development", refusal);
    assert.doesNotMatch(JSON.stringify(failure.verificationFailure), /PRIVATE_|\/Users\/|owner|stack|cause/u);
    assert.equal(exports, ["identity", "source"].includes(refusal) ? 0 : 1, refusal);
    if (refusal === "export") {
      assert.equal(failure.verificationFailure.artifactExportCode, "VISUAL_ARTIFACT_EXPORT_FAILED");
      assert.equal(failure.retainedEvidencePath, owner.path);
    }
    if (["write", "identity"].includes(refusal)) {
      assert.equal(failure.verificationFailure.evidenceRetentionCode, "VERIFICATION_EVIDENCE_RETENTION_FAILED");
      assert.equal(failure.retainedEvidencePath, undefined);
    }
    if (refusal === "write") assert.equal(await readFile(join(owner.path, "verification-failure.json"), "utf8"), "preserved-existing-evidence");
    if (refusal === "source") assert.equal(failure.verificationFailure.previewDiagnostics, undefined);
  }
});
