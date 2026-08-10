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
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath, pathToFileURL } from "node:url";

const execFileAsync = promisify(execFile);
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const maximumOutputBytes = 1024 * 1024;
const versionTimeoutMilliseconds = 30 * 1000;
const commandTimeoutMilliseconds = 15 * 60 * 1000;
const requiredPnpmVersion = "11.20.0";
const publicRegistry = "https://registry.npmjs.org/";
const codePointCompare = (left, right) =>
  left < right ? -1 : left > right ? 1 : 0;

const portfolioFiles = Object.freeze([
  ".egeria/migrations.jsonl",
  ".egeria/project.yaml",
  ".egeria/state.json",
  ".github/workflows/quality.yml",
  ".gitignore",
  ".nvmrc",
  "AGENTS.md",
  "README.md",
  "apps/web/AGENTS.md",
  "apps/web/app/globals.css",
  "apps/web/app/layout.tsx",
  "apps/web/app/page.tsx",
  "apps/web/content/content.config.yaml",
  "apps/web/content/en-CA/long-form/introduction.md",
  "apps/web/content/en-CA/site.yaml",
  "apps/web/eslint.config.mjs",
  "apps/web/next.config.ts",
  "apps/web/open-next.config.ts",
  "apps/web/package.json",
  "apps/web/playwright.config.shared.ts",
  "apps/web/playwright.deployed.config.ts",
  "apps/web/playwright.dev.config.ts",
  "apps/web/playwright.preview.config.ts",
  "apps/web/postcss.config.mjs",
  "apps/web/src/content/content-schema.ts",
  "apps/web/src/content/content-source.d.ts",
  "apps/web/src/content/read-content.ts",
  "apps/web/src/infrastructure/observability/installed-capability.ts",
  "apps/web/src/presentation/content-page.tsx",
  "apps/web/src/sections/section-registry.tsx",
  "apps/web/tests/e2e/site-quality.spec.ts",
  "apps/web/tsconfig.json",
  "apps/web/wrangler.jsonc",
  "package.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
].sort(codePointCompare));

export const generatedFixtureContracts = Object.freeze([
  Object.freeze({
    profile: "portfolio",
    projectName: "acme-portfolio",
    displayName: "Acme Portfolio",
    relativeRoot: "fixtures/generated/portfolio",
    expectedFiles: portfolioFiles,
    expectedCapabilities: Object.freeze([
      "standards",
      "content-files",
      "section-composition",
      "deployment-cloudflare",
      "observability",
    ]),
    expectedRecipeVersion: "0.5.0",
    expectedStandardsVersion: "0.2.0",
    expectedContentFilesVersion: "0.4.0",
    expectedSectionCompositionVersion: "0.3.0",
    expectedDeploymentCloudflareVersion: "0.2.0",
    expectedSiteRoutingVersion: null,
    expectedSurfaces: 71,
  }),
  Object.freeze({
    profile: "site",
    projectName: "acme-site",
    displayName: "Acme Site",
    relativeRoot: "fixtures/generated/site",
    expectedFiles: Object.freeze([
      ...portfolioFiles,
      "apps/web/app/about/page.tsx",
      "apps/web/content/en-CA/about.yaml",
    ].sort(codePointCompare)),
    expectedCapabilities: Object.freeze([
      "standards",
      "content-files",
      "section-composition",
      "deployment-cloudflare",
      "observability",
      "site-routing",
    ]),
    expectedRecipeVersion: "0.5.0",
    expectedStandardsVersion: "0.2.0",
    expectedContentFilesVersion: "0.4.0",
    expectedSectionCompositionVersion: "0.3.0",
    expectedDeploymentCloudflareVersion: "0.2.0",
    expectedSiteRoutingVersion: "0.3.0",
    expectedSurfaces: 73,
  }),
]);

const verificationChecks = [
  "pnpm-version",
  "frozen-install",
  "peer-dependencies",
  "dependency-audit",
  "registry-signatures",
  "lint",
  "typecheck",
  "next-build",
  "opennext-build",
  "browser-install",
  "browser-development",
  "browser-preview",
];

const requiredPublicPackages = [
  {
    name: "@egeria-systems/observability",
    field: "dependencies",
    version: "0.1.0",
    integrity:
      "sha512-eCTt6tNP0q2HA0wNpM1VJpZBFZqFpBDekKbno+UUKfWMG5I+KEg3bpt/fKdVO86JrKohlIM6Zo/7qzGDBpmh8g==",
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
      typecheck: "pnpm --dir apps/web run typecheck",
      verify:
        "pnpm run lint && pnpm run typecheck && pnpm run build && pnpm run build:cloudflare",
    },
    engines: { node: "22.23.2", pnpm: "11.20.0" },
    packageManager: "pnpm@11.20.0",
    volta: { node: "22.23.2" },
  };
}

function expectedWebManifest(projectName) {
  return {
    dependencies: {
      "@egeria-systems/observability": "0.1.0",
      "@opennextjs/cloudflare": "1.20.2",
      next: "16.3.0",
      react: "19.2.8",
      "react-dom": "19.2.8",
      yaml: "2.9.0",
    },
    devDependencies: {
      "@axe-core/playwright": "4.12.1",
      "@egeria-systems/standards": "0.1.0",
      "@playwright/test": "1.62.1",
      "@tailwindcss/postcss": "4.3.3",
      "@types/node": "22.20.1",
      "@types/react": "19.2.18",
      "@types/react-dom": "19.2.4",
      eslint: "9.39.5",
      "eslint-config-next": "16.3.0",
      postcss: "8.5.26",
      "raw-loader": "4.0.2",
      tailwindcss: "4.3.3",
      typescript: "6.0.3",
      "typescript-eslint": "8.66.0",
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
      "test:e2e:deployed":
        "playwright test --config playwright.deployed.config.ts",
      "test:e2e:dev": "playwright test --config playwright.dev.config.ts",
      "test:e2e:preview":
        "playwright test --config playwright.preview.config.ts",
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

function fingerprint(content) {
  return createHash("sha256").update(content).digest("hex");
}

function findEnvironmentValue(name) {
  const normalizedName = name.toLowerCase();
  return Object.entries(process.env).find(
    ([key, value]) =>
      key.toLowerCase() === normalizedName && value !== undefined,
  )?.[1];
}

function createChildEnvironment(support) {
  const environment = {};

  for (const key of ["PATH", "SystemRoot", "ComSpec", "PATHEXT", "LANG"]) {
    const value = findEnvironmentValue(key);
    if (value !== undefined) {
      environment[key] = value;
    }
  }
  if (process.platform === "darwin") {
    environment.__CF_USER_TEXT_ENCODING = "0x0:0x0:0x0";
  }

  return {
    ...environment,
    CI: "true",
    NEXT_TELEMETRY_DISABLED: "1",
    HOME: support.home,
    USERPROFILE: support.home,
    TMPDIR: support.temporary,
    TMP: support.temporary,
    TEMP: support.temporary,
    NPM_CONFIG_REGISTRY: publicRegistry,
    NPM_CONFIG_USERCONFIG: support.userConfiguration,
    PLAYWRIGHT_BROWSERS_PATH: support.browsers,
    XDG_CACHE_HOME: support.cache,
  };
}

async function pathIdentityMatches(identity) {
  try {
    const stats = await lstat(identity.path, { bigint: true });
    return (
      !stats.isSymbolicLink() &&
      stats.isDirectory() &&
      stats.dev === identity.device &&
      stats.ino === identity.inode
    );
  } catch {
    return false;
  }
}

async function createOwnedDirectory() {
  const path = await mkdtemp(join(tmpdir(), "egeria-generated-fixtures-"));
  const stats = await lstat(path, { bigint: true });

  if (stats.isSymbolicLink() || !stats.isDirectory()) {
    fail("VERIFICATION_SETUP_FAILED");
  }
  await chmod(path, 0o700);
  return { path, device: stats.dev, inode: stats.ino };
}

async function cleanupOwnedDirectory(identity) {
  if (!(await pathIdentityMatches(identity))) {
    return false;
  }

  try {
    await rm(identity.path, { recursive: true });
    return true;
  } catch {
    return false;
  }
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
    !jsonMatches(webManifest, expectedWebManifest(contract.projectName))
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

function contractForProfile(profile) {
  const contract = generatedFixtureContracts.find(
    (candidate) => candidate.profile === profile,
  );
  if (contract === undefined) {
    fail("FIXTURE_PROFILE_INVALID");
  }
  return contract;
}

export function inspectGeneratedFixture(root, profile) {
  return inspectFixture(resolve(root), contractForProfile(profile));
}

async function defaultRunCommand(input) {
  const { stdout } = await execFileAsync(
    input.executable,
    [...input.arguments],
    {
      cwd: input.cwd,
      encoding: "utf8",
      env: input.environment,
      maxBuffer: maximumOutputBytes,
      shell: false,
      timeout: input.timeout,
      windowsHide: true,
    },
  );
  return stdout;
}

async function runExpectedCommand(runCommand, input, failureCode) {
  try {
    return await runCommand(input);
  } catch {
    fail(failureCode);
  }
}

async function verifyWithAdapters(adapters) {
  const sourcesBefore = await Promise.all(
    generatedFixtureContracts.map(async (contract) => ({
      contract,
      root: resolve(repositoryRoot, contract.relativeRoot),
      snapshot: await inspectFixture(
        resolve(repositoryRoot, contract.relativeRoot),
        contract,
      ),
    })),
  );

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
      const validationRoot = join(owner.path, `${source.contract.profile}-project`);
      const supportRoot = join(owner.path, `${source.contract.profile}-support`);

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
          arguments: ["run", "typecheck"],
          failureCode: "TYPECHECK_FAILED",
        },
        { arguments: ["run", "build"], failureCode: "NEXT_BUILD_FAILED" },
        {
          arguments: ["run", "build:cloudflare"],
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
      ];

      for (const command of commands) {
        await runExpectedCommand(
          adapters.runCommand,
          commandInput(command.arguments),
          command.failureCode,
        );
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
    profiles: generatedFixtureContracts.map(({ profile }) => profile),
    checks: verificationChecks,
  };
}

export function verifyGeneratedSkeletons() {
  return verifyWithAdapters({
    createOwner: createOwnedDirectory,
    runCommand: defaultRunCommand,
  });
}

export function verifyGeneratedSkeletonsForTesting(adapters) {
  if (
    adapters === null ||
    typeof adapters !== "object" ||
    typeof adapters.createOwner !== "function" ||
    typeof adapters.runCommand !== "function"
  ) {
    fail("VERIFICATION_ADAPTER_INVALID");
  }
  return verifyWithAdapters(adapters);
}

async function runMain() {
  try {
    const result = await verifyGeneratedSkeletons();
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
