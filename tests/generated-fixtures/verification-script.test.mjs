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
  verifyGeneratedProjectForTesting,
  verifyGeneratedSkeletonsForTesting,
} from "../../scripts/verify-generated-skeletons.mjs";

const repositoryRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const execFileAsync = promisify(execFile);
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
  return { path, device: stats.dev, inode: stats.ino };
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
        relativeRoot: "fixtures/generated/portfolio",
      },
      {
        identifier: "portfolio-calendly",
        profile: "portfolio",
        relativeRoot: "fixtures/generated/portfolio-calendly",
      },
      {
        identifier: "site",
        profile: "site",
        relativeRoot: "fixtures/generated/site",
      },
      {
        identifier: "site-multilingual",
        profile: "site",
        relativeRoot: "fixtures/generated/site-multilingual",
      },
    ],
  );

  for (const contract of generatedFixtureContracts) {
    assert.equal(
      contract.expectedRecipeVersion,
      contract.profile === "site" ? "0.11.0" : "0.10.0",
    );
    assert.equal(contract.expectedStandardsVersion, "0.4.0");
    assert.equal(contract.expectedObservabilityVersion, "0.3.0");
    assert.equal(contract.expectedContentFilesVersion, "0.4.0");
    assert.equal(contract.expectedDeploymentCloudflareVersion, "0.3.0");
    assert.equal(
      contract.expectedSiteRoutingVersion,
      contract.profile === "site" ? "0.4.0" : null,
    );
    assert.equal(
      contract.expectedBookingCalendlyVersion,
      contract.identifier === "portfolio-calendly" ? "0.1.0" : null,
    );
    assert.equal(
      contract.expectedMultilingualVersion,
      contract.identifier === "site-multilingual" ? "0.1.0" : null,
    );
    assert.equal(
      contract.expectedSurfaces,
      contract.identifier === "portfolio-calendly"
        ? 111
        : contract.identifier === "portfolio"
          ? 106
          : contract.identifier === "site"
            ? 123
            : 139,
    );
    assert.equal(
      contract.visualRegression,
      contract.identifier !== "site-multilingual",
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
  assert.equal(basePortfolio.expectedFiles.length, 57);
  assert.equal(site.expectedFiles.length, 74);
  assert.equal(multilingualSite.expectedFiles.length, 90);
  assert.equal(
    calendlyPortfolio.expectedFiles.length,
    57 - 1 + 6,
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
    "fixtures/generated/portfolio/package.json: text: set",
    "fixtures/generated/portfolio/package.json: eol: lf",
    "fixtures/generated/portfolio-calendly/package.json: text: set",
    "fixtures/generated/portfolio-calendly/package.json: eol: lf",
    "fixtures/generated/site/package.json: text: set",
    "fixtures/generated/site/package.json: eol: lf",
    "fixtures/generated/site-multilingual/package.json: text: set",
    "fixtures/generated/site-multilingual/package.json: eol: lf",
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

  assert.equal(baselinePaths.length, 12);
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
    await writeFile(
      workspacePath,
      workspace.replace(
        '  "miniflare>undici": 7.29.0',
        '  "miniflare>undici": 7.29.0\n  next: 16.3.1',
      ),
    );
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
    await writeFile(
      lockfilePath,
      lockfile.replace(
        "  miniflare>undici: 7.29.0",
        "  miniflare>undici: 7.29.1",
      ),
    );
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
    await writeFile(
      tarballLockfilePath,
      tarballLockfile.replace(
        "    resolution: {integrity:",
        "    resolution:\n      tarball: https://example.invalid/package.tgz\n      integrity:",
      ),
    );
    await expectFixtureError(
      () => inspectGeneratedFixture(tarballRoot, "portfolio"),
      "FIXTURE_LOCKFILE_INVALID",
    );

    const snapshotLocatorRoot = await copyFixture(
      owner,
      "portfolio",
      "snapshot-locator",
    );
    const snapshotLockfilePath = join(snapshotLocatorRoot, "pnpm-lock.yaml");
    const snapshotLockfile = await readFile(snapshotLockfilePath, "utf8");
    const alteredSnapshotLockfile = snapshotLockfile.replace(
      "      tslib: 2.8.1",
      "      tslib: git+https://example.invalid/unapproved.git",
    );
    assert.notEqual(alteredSnapshotLockfile, snapshotLockfile);
    await writeFile(snapshotLockfilePath, alteredSnapshotLockfile);
    await expectFixtureError(
      () => inspectGeneratedFixture(snapshotLocatorRoot, "portfolio"),
      "FIXTURE_LOCKFILE_INVALID",
    );
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
          return input.arguments[0] === "--version" ? "11.20.0\n" : "";
        },
      },
    );

    assert.deepEqual(result, {
      ok: true,
      fixtures: ["portfolio-calendly"],
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
    assert.equal(commands.length, 15);
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
              /toHaveAttribute\("lang", "fr-CA"\)[\s\S]+getByRole\("heading", \{ level: 1 \}\)[\s\S]+sessionStorage[\s\S]+retry\.click\(\)[\s\S]+getByTestId\("verifier-recovery"\)/u,
            );
          }
          return input.arguments[0] === "--version" ? "11.20.0\n" : "";
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
          return input.arguments[0] === "--version" ? "11.20.0\n" : "";
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
    assert.equal(commands.length, 16);
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
          return input.arguments[0] === "--version" ? "11.20.0\n" : "";
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
      ["portfolio-calendly-project", "portfolio-project", "site-project"],
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
      resolve(repositoryRoot, "fixtures/generated/site-multilingual"),
      "site-multilingual",
      {
        async createOwner() {
          return createKnownOwner(ownerParent);
        },
        async runCommand(input) {
          commands.push(input.arguments);
          return input.arguments[0] === "--version" ? "11.20.0\n" : "";
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
              return input.arguments[0] === "--version" ? "11.20.0\n" : "";
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
              return input.arguments[0] === "--version" ? "11.20.0\n" : "";
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
  const canonicalRoot = resolve(repositoryRoot, "fixtures/generated/portfolio");
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
          return input.arguments[0] === "--version" ? "11.20.0\n" : "";
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
        return input.arguments[0] === "--version" ? "11.20.0\n" : "";
      },
    });

    assert.deepEqual(result, {
      ok: true,
      fixtures: [
        "portfolio",
        "portfolio-calendly",
        "site",
        "site-multilingual",
      ],
      profiles: ["portfolio", "site"],
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

  const commandsPerFixture = 15;
  const fixtureCommands = generatedFixtureContracts.map((_, index) =>
    commands.slice(
      index * commandsPerFixture,
      (index + 1) * commandsPerFixture,
    ),
  );
  assert.equal(fixtureCommands.every((entries) => entries.length === 15), true);
  const firstCommands = fixtureCommands.map(
    ([command]) => command,
  );
  assert.equal(new Set(firstCommands.map(({ cwd }) => cwd)).size, 4);
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
      4,
      `${key} must be isolated per fixture identifier`,
    );
  }
  assert.equal(
    new Set(fixtureCommands.map((entries) => entries[1].arguments.at(-1))).size,
    4,
    "pnpm stores must be isolated per fixture identifier",
  );

  const argumentLists = commands.map(({ arguments: arguments_ }) => arguments_);
  const perFixture = argumentLists.slice(0, 15).map((arguments_) =>
    arguments_.map((argument) =>
      ownedPath !== undefined && argument.startsWith(ownedPath)
        ? "<owned-path>"
        : argument,
    ),
  );
  for (const arguments_ of fixtureCommands.slice(1)) {
    assert.deepEqual(
      arguments_.map(({ arguments: current }) =>
        current.map((argument) =>
          ownedPath !== undefined && argument.startsWith(ownedPath)
            ? "<owned-path>"
            : argument,
        ),
      ),
      perFixture,
    );
  }
  assert.deepEqual(perFixture, [
    ["--version"],
    ["install", "--frozen-lockfile", "--store-dir", "<owned-path>"],
    ["peers", "check"],
    ["audit", "--audit-level", "moderate"],
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
            if (input.arguments.join(" ") === "audit --audit-level moderate") {
              throw new Error("PRIVATE_VALUE");
            }
            return input.arguments[0] === "--version" ? "11.20.0\n" : "";
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
            return input.arguments[0] === "--version" ? "11.20.0\n" : "";
          },
        }),
      "OPENNEXT_BUILD_FAILED",
    );
    assert.equal(await pathExists(ownedPath), false);
  } finally {
    await rm(ownerParent, { recursive: true, force: true });
  }
});
