import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmod,
  cp,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  cleanupOwnedDirectory,
  createIsolatedProcessEnvironment,
  isolatedProcessOptions,
  pathIdentityMatches,
  readPathIdentity,
} from "./lib/isolated-process.mjs";

const execFileAsync = promisify(execFile);
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const versionTimeoutMilliseconds = 30 * 1000;
const commandTimeoutMilliseconds = 15 * 60 * 1000;
const requiredPnpmVersion = "11.20.0";
const publicRegistry = "https://registry.npmjs.org/";
const generatedVisualArtifactsRoot = resolve(
  repositoryRoot,
  "generated-visual-artifacts",
);
const visualArtifactMaximumBytes = 16 * 1024 * 1024;
const visualArtifactDirectories = Object.freeze([
  Object.freeze({
    destination: "playwright-report",
    relativeSource: "apps/web/playwright-report",
  }),
  Object.freeze({
    destination: "test-results",
    relativeSource: "apps/web/test-results",
  }),
]);
const codePointCompare = (left, right) =>
  left < right ? -1 : left > right ? 1 : 0;

const portfolioFiles = Object.freeze([
  ".egeria/migrations.jsonl",
  ".egeria/project.yaml",
  ".egeria/state.json",
  ".github/workflows/deploy.yml",
  ".github/workflows/quality.yml",
  ".gitignore",
  ".nvmrc",
  "AGENTS.md",
  "README.md",
  "apps/web/AGENTS.md",
  "apps/web/app/api/observability/route.ts",
  "apps/web/app/error.tsx",
  "apps/web/app/global-error.tsx",
  "apps/web/app/globals.css",
  "apps/web/app/layout.tsx",
  "apps/web/app/page.tsx",
  "apps/web/content/content.config.yaml",
  "apps/web/content/en-CA/long-form/introduction.md",
  "apps/web/content/en-CA/observability.yaml",
  "apps/web/content/en-CA/site.yaml",
  "apps/web/eslint.config.mjs",
  "apps/web/instrumentation-client.ts",
  "apps/web/instrumentation.ts",
  "apps/web/next.config.ts",
  "apps/web/open-next.config.ts",
  "apps/web/package.json",
  "apps/web/playwright.config.shared.ts",
  "apps/web/playwright.deployed.config.ts",
  "apps/web/playwright.dev.config.ts",
  "apps/web/playwright.preview.config.ts",
  "apps/web/playwright.visual.config.ts",
  "apps/web/postcss.config.mjs",
  "apps/web/src/content/content-schema.ts",
  "apps/web/src/content/content-source.d.ts",
  "apps/web/src/content/read-content.ts",
  "apps/web/src/infrastructure/cloudflare/observability-context.ts",
  "apps/web/src/infrastructure/observability/browser-reporter.ts",
  "apps/web/src/infrastructure/observability/error-copy.ts",
  "apps/web/src/infrastructure/observability/installed-capability.ts",
  "apps/web/src/infrastructure/observability/server-reporter.ts",
  "apps/web/src/infrastructure/observability/web-vitals-reporter.tsx",
  "apps/web/src/presentation/content-page.tsx",
  "apps/web/src/presentation/error-fallback.tsx",
  "apps/web/src/sections/section-registry.tsx",
  "apps/web/tests/e2e/site-quality.spec.ts",
  "apps/web/tests/component/content-page.test.tsx",
  "apps/web/tests/setup/component.ts",
  "apps/web/tests/unit/content-schema.test.ts",
  "apps/web/tests/visual/home-visual.spec.ts",
  "apps/web/tests/visual/home-visual.spec.ts-snapshots/home-desktop-chromium-linux.png",
  "apps/web/tests/visual/home-visual.spec.ts-snapshots/home-mobile-chromium-linux.png",
  "apps/web/tsconfig.json",
  "apps/web/vitest.config.ts",
  "apps/web/wrangler.jsonc",
  "package.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
].sort(codePointCompare));

const bookingCalendlyFiles = Object.freeze([
  "apps/web/app/page.tsx",
  "apps/web/content/en-CA/booking-calendly.yaml",
  "apps/web/src/integrations/booking-calendly/booking-content.ts",
  "apps/web/src/integrations/booking-calendly/booking-settings.ts",
  "apps/web/src/integrations/booking-calendly/calendly-booking.tsx",
  "apps/web/tests/e2e/calendly-booking.spec.ts",
].sort(codePointCompare));

const createArguments = ({
  profile,
  projectName,
  displayName,
  bookingCalendly,
}) =>
  Object.freeze([
    "--profile",
    profile,
    "--name",
    projectName,
    "--display-name",
    displayName,
    ...(bookingCalendly === undefined
      ? []
      : [
          "--calendly-url",
          bookingCalendly.destination,
          "--calendly-mode",
          bookingCalendly.mode,
        ]),
  ]);

const noCapabilitySettings = Object.freeze({});
const portfolioCalendlySettings = Object.freeze({
  "booking-calendly": Object.freeze({
    destination: "https://calendly.com/example/intro",
    mode: "popup",
  }),
});

export const generatedFixtureContracts = Object.freeze([
  Object.freeze({
    identifier: "portfolio",
    profile: "portfolio",
    projectName: "acme-portfolio",
    displayName: "Acme Portfolio",
    createArguments: createArguments({
      profile: "portfolio",
      projectName: "acme-portfolio",
      displayName: "Acme Portfolio",
    }),
    expectedCapabilitySettings: noCapabilitySettings,
    relativeRoot: "fixtures/generated/portfolio",
    expectedFiles: portfolioFiles,
    expectedCapabilities: Object.freeze([
      "standards",
      "content-files",
      "section-composition",
      "deployment-cloudflare",
      "observability",
    ]),
    expectedRecipeVersion: "0.10.0",
    expectedStandardsVersion: "0.4.0",
    expectedObservabilityVersion: "0.3.0",
    expectedContentFilesVersion: "0.4.0",
    expectedSectionCompositionVersion: "0.3.0",
    expectedDeploymentCloudflareVersion: "0.3.0",
    expectedSiteRoutingVersion: null,
    expectedBookingCalendlyVersion: null,
    expectedSurfaces: 106,
  }),
  Object.freeze({
    identifier: "portfolio-calendly",
    profile: "portfolio",
    projectName: "acme-portfolio-calendly",
    displayName: "Acme Portfolio Booking",
    createArguments: createArguments({
      profile: "portfolio",
      projectName: "acme-portfolio-calendly",
      displayName: "Acme Portfolio Booking",
      bookingCalendly: portfolioCalendlySettings["booking-calendly"],
    }),
    expectedCapabilitySettings: portfolioCalendlySettings,
    relativeRoot: "fixtures/generated/portfolio-calendly",
    expectedFiles: Object.freeze([
      ...portfolioFiles.filter(
        (path) => path !== "apps/web/app/page.tsx",
      ),
      ...bookingCalendlyFiles,
    ].sort(codePointCompare)),
    expectedCapabilities: Object.freeze([
      "standards",
      "content-files",
      "section-composition",
      "deployment-cloudflare",
      "observability",
      "booking-calendly",
    ]),
    expectedRecipeVersion: "0.10.0",
    expectedStandardsVersion: "0.4.0",
    expectedObservabilityVersion: "0.3.0",
    expectedContentFilesVersion: "0.4.0",
    expectedSectionCompositionVersion: "0.3.0",
    expectedDeploymentCloudflareVersion: "0.3.0",
    expectedSiteRoutingVersion: null,
    expectedBookingCalendlyVersion: "0.1.0",
    expectedSurfaces: 111,
  }),
  Object.freeze({
    identifier: "site",
    profile: "site",
    projectName: "acme-site",
    displayName: "Acme Site",
    createArguments: createArguments({
      profile: "site",
      projectName: "acme-site",
      displayName: "Acme Site",
    }),
    expectedCapabilitySettings: noCapabilitySettings,
    relativeRoot: "fixtures/generated/site",
    expectedFiles: Object.freeze([
      ...portfolioFiles,
      "apps/web/app/about/page.tsx",
      "apps/web/app/not-found.tsx",
      "apps/web/app/robots.ts",
      "apps/web/app/sitemap.ts",
      "apps/web/app/work/error.tsx",
      "apps/web/app/work/featured/page.tsx",
      "apps/web/app/work/page.tsx",
      "apps/web/content/en-CA/about.yaml",
      "apps/web/content/en-CA/not-found.yaml",
      "apps/web/content/en-CA/routing.yaml",
      "apps/web/content/en-CA/work-featured.yaml",
      "apps/web/src/routing/read-routing-content.ts",
      "apps/web/src/routing/routing-content-schema.ts",
      "apps/web/src/routing/site-page.tsx",
      "apps/web/tests/component/site-page.test.tsx",
      "apps/web/tests/e2e/site-routing.spec.ts",
      "apps/web/tests/unit/routing-content.test.ts",
    ].sort(codePointCompare)),
    expectedCapabilities: Object.freeze([
      "standards",
      "content-files",
      "section-composition",
      "deployment-cloudflare",
      "observability",
      "site-routing",
    ]),
    expectedRecipeVersion: "0.11.0",
    expectedStandardsVersion: "0.4.0",
    expectedObservabilityVersion: "0.3.0",
    expectedContentFilesVersion: "0.4.0",
    expectedSectionCompositionVersion: "0.3.0",
    expectedDeploymentCloudflareVersion: "0.3.0",
    expectedSiteRoutingVersion: "0.4.0",
    expectedBookingCalendlyVersion: null,
    expectedSurfaces: 123,
  }),
]);

const verificationChecks = [
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
];
const visualVerificationCheck = "visual-regression";
const defaultVerificationOptions = Object.freeze({ includeVisual: false });
const visualVerificationOptions = Object.freeze({ includeVisual: true });

const requiredPublicPackages = [
  {
    name: "@egeria-systems/observability",
    field: "dependencies",
    version: "0.3.0",
    integrity:
      "sha512-AnqIa6qn1aLYuntoQ1zo9A80ioiStR2mKJg5mq/v/NrKNAFQfP7InXojel9Azst3lLDUUdyDuEDFmCIgyWDwrA==",
  },
  {
    name: "@egeria-systems/standards",
    field: "devDependencies",
    version: "0.1.0",
    integrity:
      "sha512-BmDwcX0T6KT271C4N24jCKn6ymKTqDAFpJjsG6LNpmIoTAz0xApIcqpHFl9dHOqlB2xdhdHwKYfSiELUp04E0Q==",
  },
];

const expectedWorkspacePolicy = `packages:
  - "apps/*"

pmOnFail: error

minimumReleaseAge: 1440
minimumReleaseAgeExclude:
  - "@egeria-systems/observability@0.3.0"

resolutionMode: time-based

overrides:
  "miniflare>undici": 7.29.0

allowBuilds:
  "@parcel/watcher": true
  "@swc/core": true
  esbuild: true
  unrs-resolver: true
  workerd: true
`;

const expectedLockfilePreamble = `lockfileVersion: '9.0'

settings:
  autoInstallPeers: true
  excludeLinksFromLockfile: false

overrides:
  miniflare>undici: 7.29.0

importers:
`;

function expectedRootManifest(projectName) {
  return {
    name: projectName,
    version: "0.0.0",
    private: true,
    scripts: {
      build: "pnpm --dir apps/web run build",
      "build:cloudflare": "pnpm --dir apps/web run build:cloudflare",
      dev: "pnpm --dir apps/web run dev",
      lint: "pnpm --dir apps/web run lint",
      test: "pnpm --dir apps/web run test",
      "test:component": "pnpm --dir apps/web run test:component",
      "test:component:watch": "pnpm --dir apps/web run test:component:watch",
      "test:unit": "pnpm --dir apps/web run test:unit",
      "test:unit:watch": "pnpm --dir apps/web run test:unit:watch",
      "test:watch": "pnpm --dir apps/web run test:watch",
      typecheck: "pnpm --dir apps/web run typecheck",
      verify:
        "pnpm run lint && pnpm run typecheck && pnpm run test && pnpm run build && pnpm --dir apps/web exec opennextjs-cloudflare build --skipNextBuild",
    },
    engines: { node: "22.23.2", pnpm: "11.20.0" },
    packageManager: "pnpm@11.20.0",
    volta: { node: "22.23.2" },
  };
}

function expectedWebManifest(projectName, nextVersion) {
  return {
    dependencies: {
      "@egeria-systems/observability": "0.3.0",
      "@opennextjs/cloudflare": "1.20.2",
      next: nextVersion,
      react: "19.2.8",
      "react-dom": "19.2.8",
      yaml: "2.9.0",
    },
    devDependencies: {
      "@axe-core/playwright": "4.12.1",
      "@egeria-systems/standards": "0.1.0",
      "@playwright/test": "1.62.1",
      "@tailwindcss/postcss": "4.3.3",
      "@testing-library/dom": "10.4.1",
      "@testing-library/jest-dom": "7.0.1",
      "@testing-library/react": "16.3.2",
      "@testing-library/user-event": "14.6.3",
      "@types/node": "22.20.1",
      "@types/react": "19.2.18",
      "@types/react-dom": "19.2.4",
      "@vitejs/plugin-react": "6.0.5",
      eslint: "9.39.5",
      "eslint-config-next": nextVersion,
      jsdom: "30.0.1",
      postcss: "8.5.26",
      "raw-loader": "4.0.2",
      tailwindcss: "4.3.3",
      typescript: "6.0.3",
      "typescript-eslint": "8.66.0",
      vitest: "4.1.10",
      wrangler: "4.118.0",
    },
    name: `${projectName}-web`,
    private: true,
    scripts: {
      "browser:install": "playwright install chromium",
      "browser:install:ci": "playwright install --with-deps chromium",
      build: "next build",
      "build:cloudflare": "opennextjs-cloudflare build",
      "cf-typegen":
        "wrangler types --env-interface CloudflareEnv --include-runtime=false cloudflare-env.d.ts",
      dev: "next dev",
      lint: "eslint . --max-warnings 0",
      preview:
        "opennextjs-cloudflare build && opennextjs-cloudflare preview",
      test: "vitest run",
      "test:component": "vitest run --project component",
      "test:component:watch": "vitest --project component",
      "test:e2e:deployed":
        "playwright test --config playwright.deployed.config.ts",
      "test:e2e:dev": "playwright test --config playwright.dev.config.ts",
      "test:e2e:preview":
        "playwright test --config playwright.preview.config.ts",
      "test:visual": "playwright test --config playwright.visual.config.ts",
      "test:unit": "vitest run --project unit",
      "test:unit:watch": "vitest --project unit",
      "test:watch": "vitest",
      typecheck: "next typegen && tsc --noEmit",
    },
    type: "module",
    version: "0.0.0",
  };
}

export class GeneratedFixtureVerificationError extends Error {
  constructor(code) {
    super(`Generated fixture verification failed: ${code}`);
    this.name = "GeneratedFixtureVerificationError";
    this.code = code;
  }
}

function fail(code) {
  throw new GeneratedFixtureVerificationError(code);
}

export function parseVerificationArguments(arguments_) {
  if (!Array.isArray(arguments_)) {
    fail("VERIFICATION_ARGUMENT_INVALID");
  }
  if (arguments_.length === 0) {
    return defaultVerificationOptions;
  }
  if (arguments_.length === 1 && arguments_[0] === "--visual") {
    return visualVerificationOptions;
  }
  fail("VERIFICATION_ARGUMENT_INVALID");
}

function requireVerificationOptions(options) {
  if (
    options === null ||
    typeof options !== "object" ||
    Object.keys(options).length !== 1 ||
    typeof options.includeVisual !== "boolean"
  ) {
    fail("VERIFICATION_OPTION_INVALID");
  }
}

function fingerprint(content) {
  return createHash("sha256").update(content).digest("hex");
}

function createChildEnvironment(support) {
  return createIsolatedProcessEnvironment({
    HOME: support.home,
    USERPROFILE: support.home,
    TMPDIR: support.temporary,
    TMP: support.temporary,
    TEMP: support.temporary,
    NPM_CONFIG_REGISTRY: publicRegistry,
    NPM_CONFIG_USERCONFIG: support.userConfiguration,
    PLAYWRIGHT_BROWSERS_PATH: support.browsers,
    XDG_CACHE_HOME: support.cache,
  });
}

async function createGeneratedFixtureOwner() {
  const path = await mkdtemp(join(tmpdir(), "egeria-generated-fixtures-"));
  const identity = await readPathIdentity(path);

  if (identity.isSymbolicLink || !identity.isDirectory) {
    fail("VERIFICATION_SETUP_FAILED");
  }
  await chmod(path, 0o700);
  return {
    path: identity.path,
    device: identity.device,
    inode: identity.inode,
  };
}

async function createSupportPaths(root) {
  const home = join(root, "home");
  const browsers = join(root, "playwright-browsers");
  const cache = join(root, "cache");
  const temporary = join(root, "temporary");
  const store = join(root, "store");
  const userConfiguration = join(root, ".npmrc");

  await mkdir(home, { mode: 0o700 });
  await mkdir(browsers, { mode: 0o700 });
  await mkdir(cache, { mode: 0o700 });
  await mkdir(temporary, { mode: 0o700 });
  await mkdir(store, { mode: 0o700 });
  await writeFile(userConfiguration, "", { flag: "wx", mode: 0o600 });

  return { browsers, cache, home, temporary, store, userConfiguration };
}

async function snapshotTree(root) {
  let rootStats;
  try {
    rootStats = await lstat(root);
  } catch {
    fail("FIXTURE_PATH_INVALID");
  }
  if (rootStats.isSymbolicLink() || !rootStats.isDirectory()) {
    fail("FIXTURE_PATH_INVALID");
  }

  const snapshot = [];

  async function visit(directory, relativeDirectory) {
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch {
      fail("FIXTURE_PATH_INVALID");
    }
    entries.sort((left, right) => codePointCompare(left.name, right.name));

    for (const entry of entries) {
      const relativePath = relativeDirectory
        ? `${relativeDirectory}/${entry.name}`
        : entry.name;
      const absolutePath = join(directory, entry.name);

      if (entry.isDirectory()) {
        await visit(absolutePath, relativePath);
      } else if (entry.isFile()) {
        let content;
        try {
          content = await readFile(absolutePath);
        } catch {
          fail("FIXTURE_PATH_INVALID");
        }
        snapshot.push({ path: relativePath, fingerprint: fingerprint(content) });
      } else {
        fail("FIXTURE_PATH_INVALID");
      }
    }
  }

  await visit(root, "");
  return snapshot;
}

function hasLocalSource(value) {
  if (typeof value === "string") {
    return /^(?:file|link|workspace):/u.test(value);
  }
  if (Array.isArray(value)) {
    return value.some(hasLocalSource);
  }
  return (
    value !== null &&
    typeof value === "object" &&
    Object.values(value).some(hasLocalSource)
  );
}

function canonicalJson(value) {
  if (Array.isArray(value)) {
    return value.map(canonicalJson);
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => codePointCompare(left, right))
        .map(([key, entry]) => [key, canonicalJson(entry)]),
    );
  }
  return value;
}

function jsonMatches(actual, expected) {
  return (
    JSON.stringify(canonicalJson(actual)) ===
    JSON.stringify(canonicalJson(expected))
  );
}

async function readJson(path, failureCode) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    fail(failureCode);
  }
}

async function inspectFixture(root, contract) {
  const snapshot = await snapshotTree(root);
  const actualPaths = snapshot.map(({ path }) => path);
  const expectedPathSet = new Set(contract.expectedFiles);
  if (actualPaths.some((path) => !expectedPathSet.has(path))) {
    fail("GENERATED_FIXTURE_FORBIDDEN_ARTIFACT");
  }
  if (
    actualPaths.length !== contract.expectedFiles.length ||
    actualPaths.some((path, index) => path !== contract.expectedFiles[index])
  ) {
    fail("FIXTURE_INVENTORY_INVALID");
  }

  const rootManifest = await readJson(
    join(root, "package.json"),
    "FIXTURE_MANIFEST_INVALID",
  );
  const webManifest = await readJson(
    join(root, "apps/web/package.json"),
    "FIXTURE_MANIFEST_INVALID",
  );
  if (
    rootManifest.name !== contract.projectName ||
    webManifest.name !== `${contract.projectName}-web`
  ) {
    fail("FIXTURE_MANIFEST_INVALID");
  }
  if (hasLocalSource(rootManifest) || hasLocalSource(webManifest)) {
    fail("GENERATED_FIXTURE_LOCAL_DEPENDENCY");
  }
  if (
    !jsonMatches(rootManifest, expectedRootManifest(contract.projectName)) ||
    !jsonMatches(
      webManifest,
      expectedWebManifest(
        contract.projectName,
        contract.identifier === "site" ? "16.3.3" : "16.3.0",
      ),
    )
  ) {
    fail("FIXTURE_MANIFEST_INVALID");
  }
  for (const requiredPackage of requiredPublicPackages) {
    if (
      webManifest[requiredPackage.field]?.[requiredPackage.name] !==
      requiredPackage.version
    ) {
      fail("FIXTURE_MANIFEST_INVALID");
    }
  }

  let workspacePolicy;
  try {
    workspacePolicy = await readFile(
      join(root, "pnpm-workspace.yaml"),
      "utf8",
    );
  } catch {
    fail("FIXTURE_WORKSPACE_POLICY_INVALID");
  }
  if (workspacePolicy !== expectedWorkspacePolicy) {
    fail("FIXTURE_WORKSPACE_POLICY_INVALID");
  }

  let lockfile;
  try {
    lockfile = await readFile(join(root, "pnpm-lock.yaml"), "utf8");
  } catch {
    fail("FIXTURE_LOCKFILE_INVALID");
  }
  if (
    !lockfile.startsWith(expectedLockfilePreamble) ||
    (lockfile.match(/^overrides:/gmu) ?? []).length !== 1 ||
    /:\s+['"]?(?:(?:file|link|workspace|git|github|https?):|git\+)/mu.test(
      lockfile,
    ) ||
    /^\s+['"]?(?:(?:file|link|workspace|git|github|https?):|git\+)/mu.test(
      lockfile,
    ) ||
    /^\s+tarball:/mu.test(lockfile) ||
    /(?:^|[{,]\s*)tarball:/mu.test(lockfile)
  ) {
    fail("FIXTURE_LOCKFILE_INVALID");
  }
  for (const requiredPackage of requiredPublicPackages) {
    if (
      !lockfile.includes(
        `'${requiredPackage.name}@${requiredPackage.version}':\n    resolution: {integrity: ${requiredPackage.integrity}}`,
      )
    ) {
      fail("FIXTURE_LOCKFILE_INVALID");
    }
  }

  return snapshot;
}

function contractForIdentifier(identifier) {
  const contract = generatedFixtureContracts.find(
    (candidate) => candidate.identifier === identifier,
  );
  if (contract === undefined) {
    fail("FIXTURE_IDENTIFIER_INVALID");
  }
  return contract;
}

function contractForGeneratedProject(identifier, expectedProjectName) {
  const contract = contractForIdentifier(identifier);
  if (expectedProjectName === undefined) return contract;
  return Object.freeze({ ...contract, projectName: expectedProjectName });
}

export function inspectGeneratedFixture(root, identifier) {
  return inspectFixture(resolve(root), contractForIdentifier(identifier));
}

async function defaultRunCommand(input) {
  const { stdout } = await execFileAsync(
    input.executable,
    [...input.arguments],
    {
      cwd: input.cwd,
      env: input.environment,
      timeout: input.timeout,
      ...isolatedProcessOptions,
    },
  );
  return stdout;
}

async function measureVisualArtifactTree(root, maximumBytes) {
  let totalBytes = 0;

  async function visit(directory) {
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch {
      fail("VISUAL_ARTIFACT_EXPORT_FAILED");
    }
    entries.sort((left, right) => codePointCompare(left.name, right.name));

    for (const entry of entries) {
      const path = join(directory, entry.name);
      let stats;
      try {
        stats = await lstat(path);
      } catch {
        fail("VISUAL_ARTIFACT_EXPORT_FAILED");
      }
      if (stats.isSymbolicLink()) {
        fail("VISUAL_ARTIFACT_EXPORT_FAILED");
      }
      if (stats.isDirectory()) {
        await visit(path);
      } else if (stats.isFile()) {
        totalBytes += stats.size;
        if (totalBytes > maximumBytes) {
          fail("VISUAL_ARTIFACT_EXPORT_FAILED");
        }
      } else {
        fail("VISUAL_ARTIFACT_EXPORT_FAILED");
      }
    }
  }

  await visit(root);
  return totalBytes;
}

async function captureVisualFailureArtifacts({
  identifier,
  validationRoot,
  artifactRoot = generatedVisualArtifactsRoot,
  maximumBytes = visualArtifactMaximumBytes,
}) {
  await mkdir(artifactRoot, {
    recursive: true,
    mode: 0o700,
  });
  let artifactRootStats;
  try {
    artifactRootStats = await lstat(artifactRoot);
  } catch {
    fail("VISUAL_ARTIFACT_EXPORT_FAILED");
  }
  if (artifactRootStats.isSymbolicLink() || !artifactRootStats.isDirectory()) {
    fail("VISUAL_ARTIFACT_EXPORT_FAILED");
  }
  await chmod(artifactRoot, 0o700);

  let totalBytes = 0;
  const availableArtifacts = [];

  for (const artifact of visualArtifactDirectories) {
    const source = join(validationRoot, artifact.relativeSource);
    let sourceStats;
    try {
      sourceStats = await lstat(source);
    } catch (error) {
      if (error?.code === "ENOENT") continue;
      fail("VISUAL_ARTIFACT_EXPORT_FAILED");
    }
    if (sourceStats.isSymbolicLink() || !sourceStats.isDirectory()) {
      fail("VISUAL_ARTIFACT_EXPORT_FAILED");
    }

    const bytes = await measureVisualArtifactTree(
      source,
      maximumBytes - totalBytes,
    );
    totalBytes += bytes;
    availableArtifacts.push({ ...artifact, bytes, source });
  }

  const outputRoot = await mkdtemp(
    join(artifactRoot, `${identifier}-`),
  );
  await chmod(outputRoot, 0o700);

  for (const artifact of availableArtifacts) {
    await cp(artifact.source, join(outputRoot, artifact.destination), {
      recursive: true,
      force: false,
      errorOnExist: true,
      dereference: false,
    });
  }

  await writeFile(
    join(outputRoot, "failure.json"),
    `${JSON.stringify({
      code: "VISUAL_REGRESSION_FAILED",
      fixture: identifier,
    })}\n`,
    { flag: "wx", mode: 0o600 },
  );
}

export const captureVisualFailureArtifactsForTesting =
  captureVisualFailureArtifacts;

async function runExpectedCommand(runCommand, input, failureCode) {
  try {
    return await runCommand(input);
  } catch {
    fail(failureCode);
  }
}

async function verifySourcesWithAdapters(
  adapters,
  sourcesBefore,
  options = defaultVerificationOptions,
) {
  requireVerificationOptions(options);
  let owner;
  try {
    owner = await adapters.createOwner();
  } catch {
    fail("VERIFICATION_SETUP_FAILED");
  }
  if (!(await pathIdentityMatches(owner))) {
    fail("VERIFICATION_SETUP_FAILED");
  }

  let pendingError;
  try {
    for (const source of sourcesBefore) {
      const validationRoot = join(
        owner.path,
        `${source.contract.identifier}-project`,
      );
      const supportRoot = join(
        owner.path,
        `${source.contract.identifier}-support`,
      );

      await cp(source.root, validationRoot, {
        recursive: true,
        force: false,
        errorOnExist: true,
        dereference: false,
      });
      await mkdir(supportRoot, { mode: 0o700 });
      const support = await createSupportPaths(supportRoot);
      const environment = createChildEnvironment(support);
      const commandInput = (arguments_, timeout = commandTimeoutMilliseconds) => ({
        executable: "pnpm",
        arguments: arguments_,
        cwd: validationRoot,
        environment,
        timeout,
      });

      const version = await runExpectedCommand(
        adapters.runCommand,
        commandInput(["--version"], versionTimeoutMilliseconds),
        "PNPM_VERSION_INVALID",
      );
      if (
        typeof version !== "string" ||
        version.trim() !== requiredPnpmVersion
      ) {
        fail("PNPM_VERSION_INVALID");
      }

      const commands = [
        {
          arguments: [
            "install",
            "--frozen-lockfile",
            "--store-dir",
            support.store,
          ],
          failureCode: "FROZEN_INSTALL_FAILED",
        },
        {
          arguments: ["peers", "check"],
          failureCode: "PEER_DEPENDENCY_CHECK_FAILED",
        },
        {
          arguments: ["audit", "--audit-level", "moderate"],
          failureCode: "DEPENDENCY_AUDIT_FAILED",
        },
        {
          arguments: ["audit", "signatures"],
          failureCode: "REGISTRY_SIGNATURE_CHECK_FAILED",
        },
        { arguments: ["run", "lint"], failureCode: "LINT_FAILED" },
        {
          arguments: ["--dir", "apps/web", "run", "cf-typegen"],
          failureCode: "CLOUDFLARE_TYPE_GENERATION_FAILED",
        },
        {
          arguments: ["run", "typecheck"],
          failureCode: "TYPECHECK_FAILED",
        },
        { arguments: ["run", "test:unit"], failureCode: "UNIT_TESTS_FAILED" },
        {
          arguments: ["run", "test:component"],
          failureCode: "COMPONENT_TESTS_FAILED",
        },
        { arguments: ["run", "build"], failureCode: "NEXT_BUILD_FAILED" },
        {
          arguments: [
            "--dir",
            "apps/web",
            "exec",
            "opennextjs-cloudflare",
            "build",
            "--skipNextBuild",
          ],
          failureCode: "OPENNEXT_BUILD_FAILED",
        },
        {
          arguments: ["--dir", "apps/web", "run", "browser:install"],
          failureCode: "BROWSER_INSTALL_FAILED",
        },
        {
          arguments: ["--dir", "apps/web", "run", "test:e2e:dev"],
          failureCode: "BROWSER_DEVELOPMENT_FAILED",
        },
        {
          arguments: ["--dir", "apps/web", "run", "test:e2e:preview"],
          failureCode: "BROWSER_PREVIEW_FAILED",
        },
        ...(options.includeVisual
          ? [
              {
                arguments: ["--dir", "apps/web", "run", "test:visual"],
                failureCode: "VISUAL_REGRESSION_FAILED",
              },
            ]
          : []),
      ];

      for (const command of commands) {
        try {
          await runExpectedCommand(
            adapters.runCommand,
            commandInput(command.arguments),
            command.failureCode,
          );
        } catch (error) {
          if (
            error instanceof GeneratedFixtureVerificationError &&
            error.code === "VISUAL_REGRESSION_FAILED" &&
            adapters.captureVisualArtifacts !== undefined
          ) {
            try {
              await adapters.captureVisualArtifacts({
                identifier: source.contract.identifier,
                validationRoot,
              });
            } catch {
              error.artifactExportCode = "VISUAL_ARTIFACT_EXPORT_FAILED";
            }
          }
          throw error;
        }
      }
    }
  } catch (error) {
    pendingError =
      error instanceof GeneratedFixtureVerificationError
        ? error
        : new GeneratedFixtureVerificationError("VERIFICATION_FAILED");
  } finally {
    try {
      const sourcesAfter = await Promise.all(
        sourcesBefore.map(({ contract, root }) =>
          inspectFixture(root, contract),
        ),
      );
      if (
        sourcesAfter.some(
          (snapshot, index) =>
            JSON.stringify(snapshot) !==
            JSON.stringify(sourcesBefore[index].snapshot),
        )
      ) {
        pendingError = new GeneratedFixtureVerificationError(
          "FIXTURE_SOURCE_CHANGED",
        );
      }
    } catch {
      pendingError = new GeneratedFixtureVerificationError(
        "FIXTURE_SOURCE_CHANGED",
      );
    }

    if (!(await cleanupOwnedDirectory(owner))) {
      pendingError = new GeneratedFixtureVerificationError(
        "VERIFICATION_CLEANUP_FAILED",
      );
    }
  }

  if (pendingError !== undefined) {
    throw pendingError;
  }

  return {
    ok: true,
    fixtures: sourcesBefore.map(({ contract }) => contract.identifier),
    profiles: [
      ...new Set(sourcesBefore.map(({ contract }) => contract.profile)),
    ],
    checks: options.includeVisual
      ? [...verificationChecks, visualVerificationCheck]
      : verificationChecks,
  };
}

export function verifyGeneratedSkeletons(options = defaultVerificationOptions) {
  return verifyGeneratedSkeletonsForTesting(
    {
      captureVisualArtifacts: captureVisualFailureArtifacts,
      createOwner: createGeneratedFixtureOwner,
      runCommand: defaultRunCommand,
    },
    options,
  );
}

function requireAdapters(adapters) {
  if (
    adapters === null ||
    typeof adapters !== "object" ||
    typeof adapters.createOwner !== "function" ||
    typeof adapters.runCommand !== "function" ||
    (adapters.captureVisualArtifacts !== undefined &&
      typeof adapters.captureVisualArtifacts !== "function")
  ) {
    fail("VERIFICATION_ADAPTER_INVALID");
  }
}

async function sourceForRoot(root, contract) {
  const fixedRoot = resolve(root);
  return {
    contract,
    root: fixedRoot,
    snapshot: await inspectFixture(fixedRoot, contract),
  };
}

export async function verifyGeneratedSkeletonsForTesting(
  adapters,
  options = defaultVerificationOptions,
) {
  requireAdapters(adapters);
  const sources = await Promise.all(
    generatedFixtureContracts.map((contract) =>
      sourceForRoot(resolve(repositoryRoot, contract.relativeRoot), contract),
    ),
  );
  return verifySourcesWithAdapters(adapters, sources, options);
}

export function verifyGeneratedProject(
  root,
  identifier,
  expectedProjectName,
  options = defaultVerificationOptions,
) {
  return verifyGeneratedProjectForTesting(
    root,
    identifier,
    {
      captureVisualArtifacts: captureVisualFailureArtifacts,
      createOwner: createGeneratedFixtureOwner,
      runCommand: defaultRunCommand,
    },
    expectedProjectName,
    options,
  );
}

export async function verifyGeneratedProjectForTesting(
  root,
  identifier,
  adapters,
  expectedProjectName,
  options = defaultVerificationOptions,
) {
  requireAdapters(adapters);
  const contract = contractForGeneratedProject(
    identifier,
    expectedProjectName,
  );
  const source = await sourceForRoot(root, contract);
  return verifySourcesWithAdapters(adapters, [source], options);
}

async function runMain() {
  try {
    const options = parseVerificationArguments(process.argv.slice(2));
    const result = await verifyGeneratedSkeletons(options);
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error) {
    const code =
      error instanceof GeneratedFixtureVerificationError
        ? error.code
        : "VERIFICATION_FAILED";
    process.stderr.write(
      `${JSON.stringify({
        ok: false,
        code,
        ...(error?.artifactExportCode === undefined
          ? {}
          : { artifactExportCode: error.artifactExportCode }),
      })}\n`,
    );
    process.exitCode = 1;
  }
}

if (
  process.argv[1] !== undefined &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  await runMain();
}
