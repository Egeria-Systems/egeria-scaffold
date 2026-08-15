import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  readlink,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import test from "node:test";

import { requiredEvidence } from "./certification-contracts.mjs";

const execFileAsync = promisify(execFile);
const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const builtEntry = resolve(packageRoot, "dist/index.js");
const typeScriptCompiler = resolve(packageRoot, "node_modules/typescript/bin/tsc");
const core = await import(pathToFileURL(builtEntry));
const projectInspection = await import(
  pathToFileURL(resolve(packageRoot, "dist/diagnostics/project-inspection.js")),
);
const encoder = new TextEncoder();

const verificationChecks = [
  "contracts",
  "pre-state-inference",
  "lockfile",
  "frozen-install",
  "lint",
  "typecheck",
  "next-build",
  "opennext-build",
  "post-state-inference",
];

function createDescriptor(
  identifier = "standards",
  probes = [{ kind: "file", path: "managed.txt" }],
) {
  return {
    identifier,
    version: "0.1.0",
    deliveryMode: "source-generated",
    stateClassifications: ["repository-stateful"],
    removalPolicy: "reviewed",
    dependencies: [],
    optionalIntegrations: [],
    conflicts: [],
    supportedProfiles: ["portfolio"],
    requiredPackages: [],
    environmentVariables: [],
    secrets: [],
    platformResources: [],
    externalDomains: [],
    contentSecurityPolicyContributions: [],
    browserStorage: [],
    dataClassifications: [],
    retentionAssumptions: [],
    privilegedOperations: [],
    threatReviewLevel: "standard",
    adapterSemanticRequirements: [],
    managedSurfaces: [],
    inferenceProbes: probes,
    migrationPlanners: [],
    verificationPlan: ["contracts"],
    documentationEvidenceRequirements: [],
    removalAndRecoveryRequirements: [],
  };
}

function installCapability(descriptor, overrides = {}) {
  return {
    identifier: descriptor.identifier,
    version: descriptor.version,
    deliveryMode: descriptor.deliveryMode,
    stateClassifications: descriptor.stateClassifications,
    removalPolicy: descriptor.removalPolicy,
    ...overrides,
  };
}

function profile(defaultCapabilities = ["standards"]) {
  return {
    identifier: "portfolio",
    schemaVersion: "1.0.0",
    recipeVersion: "0.1.0",
    defaultCapabilities,
  };
}

function project(selectedCapabilities = ["standards"], overrides = {}) {
  return {
    schemaVersion: "1.0.0",
    builderCompatibility: "0.0.0",
    project: {
      name: "diagnostic-fixture",
      displayName: "Diagnostic Fixture",
      defaultLocale: "en-CA",
    },
    originProfile: "portfolio",
    recipeVersion: "0.1.0",
    platformAdapter: "cloudflare-workers",
    selectedCapabilities,
    capabilitySettings: {},
    ejectedAreas: [],
    ...overrides,
  };
}

function state(installedCapabilities, managedSurfaces = [], overrides = {}) {
  return {
    schemaVersion: "1.0.0",
    builderVersion: "0.0.0",
    projectSchemaVersion: "1.0.0",
    origin: { profile: "portfolio", recipeVersion: "0.1.0" },
    installedCapabilities,
    appliedMigrations: [],
    managedSurfaces,
    ejections: [],
    compatibility: {
      node: "22.23.2",
      pnpm: "11.20.0",
      platformAdapter: "cloudflare-workers",
    },
    lastSuccessfulVerification: {
      kind: "generation",
      checks: verificationChecks,
    },
    ...overrides,
  };
}

function controlFiles(projectValue, stateValue, migrationSource = "") {
  return {
    ".egeria/project.yaml": core.serializeProjectYaml(projectValue),
    ".egeria/state.json": core.serializeStateJson(stateValue),
    ".egeria/migrations.jsonl": migrationSource,
  };
}

function createSurface({
  identifier = "managed-surface",
  capability = "standards",
  path = "managed.txt",
  ownership = "managed",
  fingerprint = core.fingerprintFileContent(encoder.encode("expected")),
} = {}) {
  return {
    identifier,
    owner: { kind: "capability", identifier: capability },
    path,
    ownership,
    fingerprintTarget: { kind: "file" },
    mergeStrategy: "replace-file",
    fingerprint,
  };
}

function minimalFixture(overrides = {}) {
  const descriptor = overrides.descriptor ?? createDescriptor();
  const projectValue = overrides.projectValue ?? project();
  const stateValue = overrides.stateValue ?? state([installCapability(descriptor)]);
  const files = {
    ...controlFiles(projectValue, stateValue),
    "managed.txt": "present",
    ...overrides.files,
  };

  return {
    catalog: overrides.catalog ?? [descriptor],
    profiles: overrides.profiles ?? [profile()],
    files,
  };
}

function requestFromFixture(fixture, reader = core.createInMemoryRepositoryReader(fixture.files)) {
  return { reader, catalog: fixture.catalog, profiles: fixture.profiles };
}

async function snapshotDirectory(root) {
  const entries = [];

  async function visit(path, relativePath) {
    const stats = await lstat(path);

    if (stats.isSymbolicLink()) {
      entries.push({
        path: relativePath,
        kind: "symlink",
        target: await readlink(path),
      });
      return;
    }

    if (stats.isDirectory()) {
      entries.push({ path: relativePath, kind: "directory" });

      for (const name of (await readdir(path)).sort()) {
        await visit(
          join(path, name),
          relativePath === "." ? name : `${relativePath}/${name}`,
        );
      }
      return;
    }

    if (stats.isFile()) {
      entries.push({
        path: relativePath,
        kind: "file",
        content: (await readFile(path)).toString("base64"),
      });
      return;
    }

    entries.push({ path: relativePath, kind: "other" });
  }

  await visit(root, ".");
  return entries;
}

function diagnosticByCode(result, code) {
  return result.diagnostics.filter((diagnostic) => diagnostic.code === code);
}

test("builder-core exports the approved read-only doctor and diff API", () => {
  assert.equal(typeof core.doctorRepository, "function");
  assert.equal(typeof core.diffProject, "function");
});

test("doctor and diff share neutral capability and managed-surface discrepancy facts", () => {
  const standards = createDescriptor("standards");
  const installedOnly = createDescriptor("installed-only");
  const unknownInstalled = {
    ...installCapability(standards),
    identifier: "unknown-installed",
  };
  const capabilitySurface = createSurface({
    identifier: "capability-missing",
    path: "missing.txt",
  });
  const builderSurface = {
    ...createSurface({
      identifier: "builder-ambiguous",
      path: "ambiguous.txt",
    }),
    owner: { kind: "builder-kernel" },
  };
  const installedState = state(
    [
      installCapability(standards),
      installCapability(installedOnly),
      unknownInstalled,
    ],
    [capabilitySurface, builderSurface],
  );

  assert.deepEqual(
    projectInspection.deriveProjectDiscrepancies({
      project: { kind: "valid", value: project() },
      migrations: { kind: "valid", value: [] },
      resolution: {
        ok: true,
        value: {
          capabilities: [standards, createDescriptor("desired-only")],
        },
      },
      inference: {
        state: { kind: "valid", value: installedState },
        capabilities: [
          {
            identifier: "standards",
            category: "contradictory",
            probes: [],
          },
          {
            identifier: "inferred-only",
            category: "probable",
            probes: [],
          },
          {
            identifier: "installed-only",
            category: "confirmed",
            probes: [],
          },
          {
            identifier: "unknown-installed",
            category: "ambiguous",
            probes: [],
            code: "CAPABILITY_DESCRIPTOR_MISSING",
          },
        ],
        surfaces: [
          {
            identifier: "capability-missing",
            path: "missing.txt",
            status: "missing",
          },
          {
            identifier: "builder-ambiguous",
            path: "ambiguous.txt",
            status: "ambiguous",
            code: "READ_FAILED",
          },
          {
            identifier: "confirmed",
            path: "confirmed.txt",
            status: "confirmed",
          },
        ],
      },
    }),
    {
      capabilities: [
        {
          identifier: "desired-only",
          desired: true,
          installed: false,
          descriptorMissing: false,
        },
        {
          identifier: "inferred-only",
          desired: false,
          installed: false,
          descriptorMissing: false,
          inferenceCategory: "probable",
        },
        {
          identifier: "installed-only",
          desired: false,
          installed: true,
          descriptorMissing: false,
          inferenceCategory: "confirmed",
        },
        {
          identifier: "standards",
          desired: true,
          installed: true,
          descriptorMissing: false,
          inferenceCategory: "contradictory",
        },
        {
          identifier: "unknown-installed",
          desired: false,
          installed: true,
          descriptorMissing: true,
          inferenceCategory: "ambiguous",
          inferenceCode: "CAPABILITY_DESCRIPTOR_MISSING",
        },
      ],
      surfaces: [
        {
          identifier: "builder-ambiguous",
          path: "ambiguous.txt",
          status: "ambiguous",
          reason: "READ_FAILED",
        },
        {
          identifier: "capability-missing",
          path: "missing.txt",
          status: "missing",
          capability: "standards",
        },
      ],
    },
  );
});

test("the package root exposes the exact diagnostics types", async () => {
  const temporaryRoot = await mkdtemp(join(tmpdir(), "egeria-diagnostics-types-"));

  try {
    const packageScope = join(temporaryRoot, "node_modules", "@egeria-systems");
    const consumer = join(temporaryRoot, "consumer.ts");
    await mkdir(packageScope, { recursive: true });
    await symlink(packageRoot, join(packageScope, "builder-core"), "dir");
    await writeFile(
      consumer,
      `import type {
  Diagnostic,
  DiagnosticSeverity,
  ProjectDifference,
} from "@egeria-systems/builder-core";

type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends
  (<Value>() => Value extends Right ? 1 : 2)
    ? true
    : false;
type Expect<Value extends true> = Value;
type ExpectedDiagnosticCode =
  | "PROJECT_INVALID"
  | "STATE_INVALID"
  | "MIGRATION_LOG_INVALID"
  | "BUILDER_VERSION_INCOMPATIBLE"
  | "PROJECT_CAPABILITY_UNKNOWN"
  | "STATE_CAPABILITY_UNKNOWN"
  | "DESIRED_INSTALLED_MISMATCH"
  | "INSTALLED_INFERENCE_CONTRADICTION"
  | "INFERENCE_AMBIGUOUS"
  | "MANAGED_SURFACE_DRIFT";
type ExpectedSeverity = "error" | "warning" | "info";
type ExpectedDifferenceKind =
  | "control-file-invalid"
  | "desired-only"
  | "installed-only"
  | "inferred-only"
  | "inference-mismatch"
  | "managed-surface-drift";
type ExactDiagnosticCodes = Expect<
  Equal<Diagnostic["code"], ExpectedDiagnosticCode>
>;
type ExactSeverities = Expect<Equal<DiagnosticSeverity, ExpectedSeverity>>;
type ExactDifferenceKinds = Expect<
  Equal<ProjectDifference["kind"], ExpectedDifferenceKind>
>;

const severities: readonly DiagnosticSeverity[] = ["error", "warning", "info"];
const codes: readonly Diagnostic["code"][] = [
  "PROJECT_INVALID",
  "STATE_INVALID",
  "MIGRATION_LOG_INVALID",
  "BUILDER_VERSION_INCOMPATIBLE",
  "PROJECT_CAPABILITY_UNKNOWN",
  "STATE_CAPABILITY_UNKNOWN",
  "DESIRED_INSTALLED_MISMATCH",
  "INSTALLED_INFERENCE_CONTRADICTION",
  "INFERENCE_AMBIGUOUS",
  "MANAGED_SURFACE_DRIFT",
];
const differences: readonly ProjectDifference["kind"][] = [
  "control-file-invalid",
  "desired-only",
  "installed-only",
  "inferred-only",
  "inference-mismatch",
  "managed-surface-drift",
];
const diagnostic: Diagnostic = { code: codes[0]!, severity: severities[0]!, context: {} };
const difference: ProjectDifference = { kind: differences[0]! };
const exactTypes: readonly [
  ExactDiagnosticCodes,
  ExactSeverities,
  ExactDifferenceKinds,
] = [true, true, true];
// @ts-expect-error invented diagnostic codes are not public API
const inventedDiagnostic: Diagnostic = { code: "INVENTED", severity: "error", context: {} };
// @ts-expect-error invented difference kinds are not public API
const inventedDifference: ProjectDifference = { kind: "invented" };
void [diagnostic, difference, exactTypes, inventedDiagnostic, inventedDifference];
`,
      "utf8",
    );

    try {
      await execFileAsync(
        process.execPath,
        [
          typeScriptCompiler,
          "--noEmit",
          "--strict",
          "--exactOptionalPropertyTypes",
          "--module",
          "NodeNext",
          "--moduleResolution",
          "NodeNext",
          "--target",
          "ES2022",
          consumer,
        ],
        { cwd: temporaryRoot, encoding: "utf8" },
      );
    } catch (error) {
      assert.fail(error?.stdout || error?.stderr || error?.message);
    }
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

test("doctor and diff report a healthy minimal repository", async () => {
  const fixture = minimalFixture();
  const doctor = await core.doctorRepository(requestFromFixture(fixture));
  const difference = await core.diffProject(requestFromFixture(fixture));

  assert.deepEqual(doctor, { healthy: true, diagnostics: [] });
  assert.deepEqual(difference, { equal: true, differences: [] });
});

test("restricted error diagnostics admission advances every direct owner together", async () => {
  const catalog = core.createVerifiedCapabilityCatalog();
  assert.equal(catalog.ok, true);
  const descriptor = catalog.value.find(
    ({ identifier }) => identifier === "observability",
  );
  assert.notEqual(descriptor, undefined);
  assert.equal(descriptor.version, "0.3.0");
  assert.equal(core.verifiedCapabilityPackageVersions.observability, "0.3.0");
  assert.deepEqual(descriptor.dependencies, [
    "content-files",
    "deployment-cloudflare",
    "section-composition",
  ]);
  assert.ok(
    descriptor.dataClassifications.includes("restricted-error-diagnostics"),
  );
  assert.ok(
    descriptor.adapterSemanticRequirements.includes(
      "separate-operational-and-diagnostic-sinks",
    ),
  );

  const newPaths = [
    "apps/web/app/error.tsx",
    "apps/web/app/global-error.tsx",
    "apps/web/content/en-CA/observability.yaml",
    "apps/web/src/infrastructure/observability/error-copy.ts",
    "apps/web/src/presentation/error-fallback.tsx",
  ];
  assert.deepEqual(
    descriptor.managedSurfaces
      .map(({ path }) => path)
      .filter((path) => newPaths.includes(path))
      .sort(),
    newPaths,
  );
  assert.deepEqual(
    descriptor.inferenceProbes
      .filter(({ kind }) => kind === "file")
      .map(({ path }) => path)
      .filter((path) => newPaths.includes(path))
      .sort(),
    newPaths,
  );
  assert.deepEqual(
    core.profileRecipes.map(({ identifier, recipeVersion }) => ({
      identifier,
      recipeVersion,
    })),
    [
      { identifier: "portfolio", recipeVersion: "0.8.0" },
      { identifier: "site", recipeVersion: "0.8.0" },
    ],
  );

  const registry = JSON.parse(
    await readFile(
      new URL("../../../certifications/capabilities.json", import.meta.url),
      "utf8",
    ),
  );
  assert.deepEqual(registry.records.observability, {
    subject: core.createCertificationSubject(
      descriptor,
      requiredEvidence.observability,
    ),
    requiredEvidence: requiredEvidence.observability,
    status: "pending",
    taskPlan:
      "docs/superpowers/plans/2026-08-12-observability-error-diagnostics-certification.md",
    evidence: [],
  });

  const [packageTemplate, workspace, lockfile] = await Promise.all([
    readFile(
      new URL("../templates/common/apps/web/package.json.template", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../templates/common/pnpm-workspace.yaml", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../lockfiles/web-recipe-0.8.0/pnpm-lock.yaml", import.meta.url),
      "utf8",
    ),
  ]);
  assert.equal(
    JSON.parse(packageTemplate).dependencies[
      "@egeria-systems/observability"
    ],
    "0.3.0",
  );
  assert.match(
    workspace,
    /minimumReleaseAgeExclude:\n  - "@egeria-systems\/observability@0\.3\.0"/u,
  );
  assert.match(lockfile, /@egeria-systems\/observability@0\.3\.0/u);
  assert.doesNotMatch(
    lockfile,
    /@egeria-systems\/observability@(?:file:|link:|workspace:)|(?:file:|link:|workspace:).*observability/u,
  );
});

test("doctor and diff agree across the canonical portfolio composition", async () => {
  const catalogResult = core.createCapabilityCatalog({
    standards: "1.2.3",
    observability: "4.5.6",
  });
  assert.equal(catalogResult.ok, true);
  const catalog = catalogResult.value;
  const projectValue = project(
    core.profileRecipes.find(({ identifier }) => identifier === "portfolio")
      .defaultCapabilities,
  );
  const resolution = core.resolveCapabilities(
    {
      profile: projectValue.originProfile,
      requestedCapabilities: projectValue.selectedCapabilities,
    },
    catalog,
    core.profileRecipes,
  );
  assert.equal(resolution.ok, true);

  const canonicalFiles = {
    "apps/web/package.json": `${JSON.stringify({
      dependencies: {
        "@egeria-systems/observability": "4.5.6",
        "@opennextjs/cloudflare": "1.20.2",
        yaml: "2.9.0",
      },
      devDependencies: {
        "@axe-core/playwright": "4.12.1",
        "@egeria-systems/standards": "1.2.3",
        "@playwright/test": "1.62.1",
        "@tailwindcss/postcss": "4.3.3",
        "@testing-library/dom": "10.4.1",
        "@testing-library/jest-dom": "7.0.1",
        "@testing-library/react": "16.3.2",
        "@testing-library/user-event": "14.6.3",
        "@vitejs/plugin-react": "6.0.5",
        jsdom: "30.0.1",
        postcss: "8.5.26",
        "raw-loader": "4.0.2",
        tailwindcss: "4.3.3",
        vitest: "4.1.10",
        wrangler: "4.118.0",
      },
      scripts: {
        "browser:install": "playwright install chromium",
        "browser:install:ci": "playwright install --with-deps chromium",
        test: "vitest run",
        "test:component": "vitest run --project component",
        "test:component:watch": "vitest --project component",
        "test:e2e:deployed":
          "playwright test --config playwright.deployed.config.ts",
        "test:e2e:dev": "playwright test --config playwright.dev.config.ts",
        "test:e2e:preview":
          "playwright test --config playwright.preview.config.ts",
        "test:unit": "vitest run --project unit",
        "test:unit:watch": "vitest --project unit",
        "test:watch": "vitest",
      },
    }, null, 2)}\n`,
    "apps/web/tsconfig.json": "{}\n",
    "apps/web/eslint.config.mjs": "export default [];\n",
    "apps/web/content/content.config.yaml": "{}\n",
    "apps/web/content/en-CA/long-form/introduction.md": "# Introduction\n",
    "apps/web/content/en-CA/site.yaml": "{}\n",
    "apps/web/src/content/content-schema.ts": "export {};\n",
    "apps/web/src/content/content-source.d.ts": "export {};\n",
    "apps/web/src/content/read-content.ts": "export {};\n",
    "apps/web/app/globals.css": "@import \"tailwindcss\";\n",
    "apps/web/app/page.tsx": "export default function Page() {}\n",
    "apps/web/postcss.config.mjs": "export default {};\n",
    "apps/web/src/presentation/content-page.tsx": "export {};\n",
    "apps/web/src/sections/section-registry.tsx": "export {};\n",
    "apps/web/next.config.ts": "export default {};\n",
    "apps/web/open-next.config.ts": "export default {};\n",
    "apps/web/wrangler.jsonc": `${JSON.stringify({
      observability: {
        enabled: true,
        head_sampling_rate: 1,
        logs: { invocation_logs: false },
      },
      version_metadata: { binding: "CF_VERSION_METADATA" },
    }, null, 2)}\n`,
    "apps/web/instrumentation-client.ts": "export {};\n",
    "apps/web/instrumentation.ts": "export {};\n",
    "apps/web/app/api/observability/route.ts": "export {};\n",
    "apps/web/app/error.tsx": "export {};\n",
    "apps/web/app/global-error.tsx": "export {};\n",
    "apps/web/content/en-CA/observability.yaml": "title: Error\n",
    "apps/web/src/infrastructure/cloudflare/observability-context.ts":
      "export {};\n",
    "apps/web/src/infrastructure/observability/browser-reporter.ts":
      "export {};\n",
    "apps/web/src/infrastructure/observability/error-copy.ts":
      "export {};\n",
    "apps/web/src/infrastructure/observability/installed-capability.ts":
      "export {};\n",
    "apps/web/src/infrastructure/observability/server-reporter.ts":
      "export {};\n",
    "apps/web/src/infrastructure/observability/web-vitals-reporter.tsx":
      "export {};\n",
    "apps/web/src/presentation/error-fallback.tsx":
      "export {};\n",
    ".github/workflows/quality.yml": "name: Quality\n",
    "apps/web/playwright.config.shared.ts": "export {};\n",
    "apps/web/playwright.deployed.config.ts": "export {};\n",
    "apps/web/playwright.dev.config.ts": "export {};\n",
    "apps/web/playwright.preview.config.ts": "export {};\n",
    "apps/web/tests/e2e/site-quality.spec.ts": "export {};\n",
    "apps/web/tests/component/content-page.test.tsx": "export {};\n",
    "apps/web/tests/setup/component.ts": "export {};\n",
    "apps/web/tests/unit/content-schema.test.ts": "export {};\n",
    "apps/web/vitest.config.ts": "export {};\n",
  };
  const surfaceResult = core.materializeInstalledSurfaces({
    files: new Map(
      Object.entries(canonicalFiles).map(([path, content]) => [
        path,
        encoder.encode(content),
      ]),
    ),
    surfaces: resolution.value.capabilities.flatMap(
      ({ managedSurfaces }) => managedSurfaces,
    ),
  });
  assert.equal(surfaceResult.ok, true);
  const fixture = {
    catalog,
    profiles: core.profileRecipes,
    files: {
      ...controlFiles(
        projectValue,
        state(
          core.createInstalledManifest(resolution.value),
          surfaceResult.value,
        ),
      ),
      ...canonicalFiles,
    },
  };

  assert.deepEqual(
    await core.doctorRepository(requestFromFixture(fixture)),
    { healthy: true, diagnostics: [] },
  );
  assert.deepEqual(await core.diffProject(requestFromFixture(fixture)), {
    equal: true,
    differences: [],
  });
});

test("doctor maps missing, symlinked, unreadable, and parser-invalid control files without throwing", async () => {
  const base = minimalFixture();
  const cases = [
    {
      path: ".egeria/project.yaml",
      result: { kind: "missing" },
      code: "PROJECT_INVALID",
    },
    {
      path: ".egeria/project.yaml",
      result: { kind: "symlink" },
      code: "PROJECT_INVALID",
    },
    {
      path: ".egeria/state.json",
      result: { kind: "error", code: "READ_FAILED" },
      code: "STATE_INVALID",
    },
    {
      path: ".egeria/migrations.jsonl",
      result: { kind: "symlink" },
      code: "MIGRATION_LOG_INVALID",
    },
    {
      path: ".egeria/project.yaml",
      result: { kind: "file", content: "private-token: [" },
      code: "PROJECT_INVALID",
    },
    {
      path: ".egeria/state.json",
      result: { kind: "file", content: "{ private-token" },
      code: "STATE_INVALID",
    },
    {
      path: ".egeria/migrations.jsonl",
      result: { kind: "file", content: "{ private-token\n" },
      code: "MIGRATION_LOG_INVALID",
    },
  ];

  for (const scenario of cases) {
    const delegate = core.createInMemoryRepositoryReader(base.files);
    const reader = {
      readText: (path) =>
        path === scenario.path
          ? Promise.resolve(scenario.result)
          : delegate.readText(path),
    };
    const result = await core.doctorRepository(requestFromFixture(base, reader));

    assert.deepEqual(
      result.diagnostics.map(({ code, severity, path }) => ({
        code,
        severity,
        path,
      })),
      [{ code: scenario.code, severity: "error", path: scenario.path }],
    );
    assert.equal(result.healthy, false);
    assert.doesNotMatch(JSON.stringify(result), /private-token/);
  }
});

test("doctor maps builder-version issues without returning rejected values", async () => {
  const descriptor = createDescriptor();
  const invalidProject = {
    ...project(),
    builderCompatibility: "private-token-project-version",
    project: { ...project().project, displayName: "" },
  };
  const invalidState = {
    ...state([installCapability(descriptor)]),
    builderVersion: "private-token-state-version",
    projectSchemaVersion: "private-token-schema-version",
  };
  const projectFixture = minimalFixture({
    descriptor,
    files: {
      ".egeria/project.yaml": JSON.stringify(invalidProject),
    },
  });
  const stateFixture = minimalFixture({
    descriptor,
    files: {
      ".egeria/state.json": JSON.stringify(invalidState),
    },
  });

  const projectResult = await core.doctorRepository(
    requestFromFixture(projectFixture),
  );
  assert.deepEqual(projectResult.diagnostics, [
    {
      code: "BUILDER_VERSION_INCOMPATIBLE",
      severity: "error",
      path: ".egeria/project.yaml",
      context: { reason: "project-builder-compatibility" },
    },
    {
      code: "PROJECT_INVALID",
      severity: "error",
      path: ".egeria/project.yaml",
      context: { reason: "invalid" },
    },
  ]);

  const stateResult = await core.doctorRepository(requestFromFixture(stateFixture));
  assert.deepEqual(stateResult.diagnostics, [
    {
      code: "BUILDER_VERSION_INCOMPATIBLE",
      severity: "error",
      path: ".egeria/state.json",
      context: { reason: "state-builder-version" },
    },
    {
      code: "STATE_INVALID",
      severity: "error",
      path: ".egeria/state.json",
      context: { reason: "invalid" },
    },
  ]);
  assert.doesNotMatch(
    JSON.stringify([projectResult, stateResult]),
    /private-token/,
  );
});

test("doctor distinguishes unknown project and state capabilities and suppresses duplicate state findings", async () => {
  const descriptor = createDescriptor();
  const unknownInstalled = {
    ...installCapability(descriptor),
    identifier: "unknown-installed",
  };
  const projectFixture = minimalFixture({
    descriptor,
    projectValue: project(["standards", "unknown-selected"]),
  });
  const stateFixture = minimalFixture({
    descriptor,
    stateValue: state([installCapability(descriptor), unknownInstalled]),
  });

  const projectResult = await core.doctorRepository(
    requestFromFixture(projectFixture),
  );
  assert.deepEqual(projectResult.diagnostics, [
    {
      code: "PROJECT_CAPABILITY_UNKNOWN",
      severity: "error",
      capability: "unknown-selected",
      path: ".egeria/project.yaml",
      context: {},
    },
  ]);

  const stateResult = await core.doctorRepository(requestFromFixture(stateFixture));
  assert.deepEqual(
    stateResult.diagnostics.filter(
      ({ capability }) => capability === "unknown-installed",
    ),
    [
      {
        code: "STATE_CAPABILITY_UNKNOWN",
        severity: "error",
        capability: "unknown-installed",
        path: ".egeria/state.json",
        context: {},
      },
    ],
  );
});

test("doctor treats other resolution failures as an invalid project contract", async () => {
  const fixture = minimalFixture({ profiles: [] });
  const result = await core.doctorRepository(requestFromFixture(fixture));

  assert.deepEqual(result.diagnostics, [
    {
      code: "PROJECT_INVALID",
      severity: "error",
      path: ".egeria/project.yaml",
      context: { reason: "desired-resolution" },
    },
  ]);
});

test("doctor does not attribute an unknown profile default to project selection", async () => {
  const selected = createDescriptor("selected-existing");
  const fixture = minimalFixture({
    descriptor: selected,
    projectValue: project(["selected-existing"]),
    profiles: [profile(["profile-default-missing"])],
  });
  const result = await core.doctorRepository(requestFromFixture(fixture));

  assert.deepEqual(result.diagnostics, [
    {
      code: "PROJECT_INVALID",
      severity: "error",
      path: ".egeria/project.yaml",
      context: { reason: "desired-resolution" },
    },
  ]);
});

test("doctor and diff reject a malformed runtime catalog without throwing", async () => {
  const fixture = minimalFixture({ catalog: [{}] });

  assert.deepEqual(await core.doctorRepository(requestFromFixture(fixture)), {
    healthy: false,
    diagnostics: [
      {
        code: "PROJECT_INVALID",
        severity: "error",
        path: ".egeria/project.yaml",
        context: { reason: "desired-resolution" },
      },
    ],
  });
  assert.deepEqual(await core.diffProject(requestFromFixture(fixture)), {
    equal: false,
    differences: [
      { kind: "control-file-invalid", path: ".egeria/project.yaml" },
    ],
  });
});

test("doctor reports desired-only and installed-only capabilities in lexical order independent of input order", async () => {
  const standards = createDescriptor("standards", [
    { kind: "file", path: "standards.txt" },
  ]);
  const alpha = createDescriptor("alpha", [{ kind: "file", path: "alpha.txt" }]);
  const zulu = createDescriptor("zulu", [{ kind: "file", path: "zulu.txt" }]);
  const fixture = minimalFixture({
    descriptor: standards,
    catalog: [zulu, standards, alpha],
    stateValue: state([
      installCapability(zulu),
      installCapability(standards),
      installCapability(alpha),
    ]),
    files: {
      "managed.txt": undefined,
      "standards.txt": "present",
      "alpha.txt": "present",
      "zulu.txt": "present",
    },
  });
  delete fixture.files["managed.txt"];

  const result = await core.doctorRepository(requestFromFixture(fixture));
  assert.deepEqual(result.diagnostics, [
    {
      code: "DESIRED_INSTALLED_MISMATCH",
      severity: "error",
      capability: "alpha",
      context: { relation: "installed-only" },
    },
    {
      code: "DESIRED_INSTALLED_MISMATCH",
      severity: "error",
      capability: "zulu",
      context: { relation: "installed-only" },
    },
  ]);

  const reorderedFixture = {
    ...fixture,
    catalog: [...fixture.catalog].reverse(),
    files: {
      ...Object.fromEntries(Object.entries(fixture.files).reverse()),
      ".egeria/state.json": core.serializeStateJson(
        state([
          installCapability(alpha),
          installCapability(standards),
          installCapability(zulu),
        ]),
      ),
    },
  };
  assert.deepEqual(
    await core.doctorRepository(requestFromFixture(reorderedFixture)),
    result,
  );

  const desiredOnlyFixture = minimalFixture({
    descriptor: standards,
    stateValue: state([]),
    files: { "managed.txt": undefined },
  });
  delete desiredOnlyFixture.files["managed.txt"];
  const desiredOnlyResult = await core.doctorRepository(
    requestFromFixture(desiredOnlyFixture),
  );
  assert.deepEqual(diagnosticByCode(desiredOnlyResult, "DESIRED_INSTALLED_MISMATCH"), [
    {
      code: "DESIRED_INSTALLED_MISMATCH",
      severity: "error",
      capability: "standards",
      context: { relation: "desired-only" },
    },
  ]);
});

test("doctor preserves probable, partial, contradictory, and ambiguous inference policy", async () => {
  const probable = createDescriptor("standards", [
    { kind: "file", path: "probable.txt" },
  ]);
  const probableFixture = minimalFixture({
    descriptor: probable,
    stateValue: state([]),
    files: { "managed.txt": undefined, "probable.txt": "present" },
  });
  delete probableFixture.files["managed.txt"];
  const probableResult = await core.doctorRepository(
    requestFromFixture(probableFixture),
  );
  assert.deepEqual(
    diagnosticByCode(probableResult, "INSTALLED_INFERENCE_CONTRADICTION"),
    [
      {
        code: "INSTALLED_INFERENCE_CONTRADICTION",
        severity: "warning",
        capability: "standards",
        context: { category: "probable" },
      },
    ],
  );

  const partial = createDescriptor("standards", [
    { kind: "file", path: "present.txt" },
    { kind: "file", path: "missing.txt" },
  ]);
  const partialFixture = minimalFixture({
    descriptor: partial,
    stateValue: state([]),
    files: { "managed.txt": undefined, "present.txt": "present" },
  });
  delete partialFixture.files["managed.txt"];
  const partialResult = await core.doctorRepository(
    requestFromFixture(partialFixture),
  );
  assert.deepEqual(
    diagnosticByCode(partialResult, "INSTALLED_INFERENCE_CONTRADICTION"),
    [
      {
        code: "INSTALLED_INFERENCE_CONTRADICTION",
        severity: "warning",
        capability: "standards",
        context: { category: "partial" },
      },
    ],
  );

  const contradictoryFixture = minimalFixture({
    descriptor: probable,
    files: { "managed.txt": undefined },
  });
  delete contradictoryFixture.files["managed.txt"];
  const contradictoryResult = await core.doctorRepository(
    requestFromFixture(contradictoryFixture),
  );
  assert.deepEqual(
    diagnosticByCode(contradictoryResult, "INSTALLED_INFERENCE_CONTRADICTION"),
    [
      {
        code: "INSTALLED_INFERENCE_CONTRADICTION",
        severity: "error",
        capability: "standards",
        context: { category: "contradictory" },
      },
    ],
  );

  const ambiguous = createDescriptor("standards", [
    { kind: "json-value", path: "private.json", pointer: "/enabled", expected: true },
  ]);
  const ambiguousFixture = minimalFixture({
    descriptor: ambiguous,
    files: { "managed.txt": undefined, "private.json": "{ private-token" },
  });
  delete ambiguousFixture.files["managed.txt"];
  const ambiguousResult = await core.doctorRepository(
    requestFromFixture(ambiguousFixture),
  );
  assert.deepEqual(diagnosticByCode(ambiguousResult, "INFERENCE_AMBIGUOUS"), [
    {
      code: "INFERENCE_AMBIGUOUS",
      severity: "warning",
      capability: "standards",
      context: { category: "ambiguous" },
    },
  ]);
  assert.doesNotMatch(JSON.stringify(ambiguousResult), /private-token/);
});

test("doctor sorts errors before lexically earlier warnings", async () => {
  const contradictory = createDescriptor("contradictory", [
    { kind: "file", path: "missing.txt" },
  ]);
  const ambiguous = createDescriptor("ambiguous", [
    {
      kind: "json-value",
      path: "ambiguous.json",
      pointer: "/enabled",
      expected: true,
    },
  ]);
  const fixture = minimalFixture({
    descriptor: contradictory,
    catalog: [ambiguous, contradictory],
    projectValue: project(["contradictory", "ambiguous"]),
    profiles: [profile(["contradictory", "ambiguous"])],
    stateValue: state([
      installCapability(ambiguous),
      installCapability(contradictory),
    ]),
    files: {
      "managed.txt": undefined,
      "ambiguous.json": "{ private-token",
    },
  });
  delete fixture.files["managed.txt"];

  assert.deepEqual(
    (await core.doctorRepository(requestFromFixture(fixture))).diagnostics,
    [
      {
        code: "INSTALLED_INFERENCE_CONTRADICTION",
        severity: "error",
        capability: "contradictory",
        context: { category: "contradictory" },
      },
      {
        code: "INFERENCE_AMBIGUOUS",
        severity: "warning",
        capability: "ambiguous",
        context: { category: "ambiguous" },
      },
    ],
  );
});

test("diagnostics do not return rejected package values or source excerpts", async () => {
  const descriptor = createDescriptor("standards", [
    {
      kind: "package",
      path: "apps/web/package.json",
      section: "dependencies",
      packageName: "example",
      version: "1.0.0",
    },
  ]);
  const fixture = minimalFixture({
    descriptor,
    files: {
      "managed.txt": undefined,
      "apps/web/package.json": JSON.stringify({
        dependencies: { example: "private-token-version" },
        private: "private source excerpt",
      }),
    },
  });
  delete fixture.files["managed.txt"];

  const result = await core.doctorRepository(requestFromFixture(fixture));
  assert.deepEqual(
    diagnosticByCode(result, "INSTALLED_INFERENCE_CONTRADICTION"),
    [
      {
        code: "INSTALLED_INFERENCE_CONTRADICTION",
        severity: "error",
        capability: "standards",
        context: { category: "contradictory" },
      },
    ],
  );
  assert.doesNotMatch(
    JSON.stringify(result),
    /private-token-version|private source excerpt/,
  );
});

test("doctor reports managed drift, isolates ambiguous surfaces, and ignores application-owned or ejected surfaces", async () => {
  const descriptor = createDescriptor("standards", [
    { kind: "file", path: "probe.txt" },
  ]);
  const drifted = createSurface({ path: "drifted.txt" });
  const missing = createSurface({ identifier: "missing-surface", path: "missing.txt" });
  const applicationOwned = createSurface({
    identifier: "application-surface",
    path: "private/application.txt",
    ownership: "application-owned",
  });
  const ejected = createSurface({
    identifier: "ejected-surface",
    path: "private/ejected.txt",
    ownership: "ejected",
  });
  const fixture = minimalFixture({
    descriptor,
    stateValue: state(
      [installCapability(descriptor)],
      [drifted, missing, applicationOwned, ejected],
    ),
    files: {
      "managed.txt": undefined,
      "probe.txt": "present",
      "drifted.txt": "private changed source",
    },
  });
  delete fixture.files["managed.txt"];
  const result = await core.doctorRepository(requestFromFixture(fixture));

  assert.deepEqual(diagnosticByCode(result, "MANAGED_SURFACE_DRIFT"), [
    {
      code: "MANAGED_SURFACE_DRIFT",
      severity: "warning",
      capability: "standards",
      path: "drifted.txt",
      context: { status: "drifted" },
    },
    {
      code: "MANAGED_SURFACE_DRIFT",
      severity: "warning",
      capability: "standards",
      path: "missing.txt",
      context: { status: "missing" },
    },
  ]);
  assert.doesNotMatch(JSON.stringify(result), /private changed source/);

  const delegate = core.createInMemoryRepositoryReader(fixture.files);
  const ambiguousReader = {
    readText: (path) =>
      path === "missing.txt"
        ? Promise.resolve({ kind: "symlink" })
        : delegate.readText(path),
  };
  const ambiguousResult = await core.doctorRepository(
    requestFromFixture(fixture, ambiguousReader),
  );
  assert.deepEqual(
    ambiguousResult.diagnostics.filter(({ path }) => path === "missing.txt"),
    [
      {
        code: "INFERENCE_AMBIGUOUS",
        severity: "warning",
        capability: "standards",
        path: "missing.txt",
        context: { reason: "PATH_SYMLINK" },
      },
    ],
  );
});

test("doctor and diff ignore an isolated ejected surface", async () => {
  const descriptor = createDescriptor();
  const fixture = minimalFixture({
    descriptor,
    stateValue: state(
      [installCapability(descriptor)],
      [
        createSurface({
          identifier: "ejected-surface",
          path: "private/ejected.txt",
          ownership: "ejected",
        }),
      ],
    ),
  });

  assert.deepEqual(await core.doctorRepository(requestFromFixture(fixture)), {
    healthy: true,
    diagnostics: [],
  });
  assert.deepEqual(await core.diffProject(requestFromFixture(fixture)), {
    equal: true,
    differences: [],
  });
});

test("diff short-circuits invalid control files and resolution failures", async () => {
  const fixture = minimalFixture();
  const delegate = core.createInMemoryRepositoryReader(fixture.files);
  const reader = {
    readText: (path) => {
      if (path === ".egeria/project.yaml" || path === ".egeria/migrations.jsonl") {
        return Promise.resolve({ kind: "missing" });
      }
      return delegate.readText(path);
    },
  };

  assert.deepEqual(await core.diffProject(requestFromFixture(fixture, reader)), {
    equal: false,
    differences: [
      { kind: "control-file-invalid", path: ".egeria/migrations.jsonl" },
      { kind: "control-file-invalid", path: ".egeria/project.yaml" },
    ],
  });

  const resolutionFailure = minimalFixture({ profiles: [] });
  assert.deepEqual(await core.diffProject(requestFromFixture(resolutionFailure)), {
    equal: false,
    differences: [
      { kind: "control-file-invalid", path: ".egeria/project.yaml" },
    ],
  });

  const malformedState = minimalFixture({
    files: { ".egeria/state.json": "{ private-state-token" },
  });
  const malformedStateResult = await core.diffProject(
    requestFromFixture(malformedState),
  );
  assert.deepEqual(malformedStateResult, {
    equal: false,
    differences: [
      { kind: "control-file-invalid", path: ".egeria/state.json" },
    ],
  });
  assert.doesNotMatch(JSON.stringify(malformedStateResult), /private-state-token/);

  const combinedControlFailure = minimalFixture({
    projectValue: project(["standards", "unknown-selected"]),
    files: { ".egeria/state.json": "{ private-state-token" },
  });
  assert.deepEqual(
    await core.diffProject(requestFromFixture(combinedControlFailure)),
    {
      equal: false,
      differences: [
        { kind: "control-file-invalid", path: ".egeria/project.yaml" },
        { kind: "control-file-invalid", path: ".egeria/state.json" },
      ],
    },
  );

  const invalidMigrationWithLatentMismatch = minimalFixture({
    stateValue: state([]),
    files: {
      ".egeria/migrations.jsonl": "{ private-migration-token\n",
    },
  });
  const migrationResult = await core.diffProject(
    requestFromFixture(invalidMigrationWithLatentMismatch),
  );
  assert.deepEqual(migrationResult, {
    equal: false,
    differences: [
      { kind: "control-file-invalid", path: ".egeria/migrations.jsonl" },
    ],
  });
  assert.doesNotMatch(JSON.stringify(migrationResult), /private-migration-token/);
});

test("diff maps desired, installed, inferred, and mismatch evidence without duplicates", async () => {
  const standards = createDescriptor("standards", [
    { kind: "file", path: "standards.txt" },
  ]);
  const probable = createDescriptor("probable", [
    { kind: "file", path: "probable.txt" },
  ]);
  const contradictory = createDescriptor("contradictory", [
    { kind: "file", path: "contradictory.txt" },
  ]);
  const installedOnly = createDescriptor("installed-only", [
    { kind: "file", path: "installed-only.txt" },
  ]);
  const fixture = minimalFixture({
    descriptor: standards,
    catalog: [probable, installedOnly, standards, contradictory],
    stateValue: state([
      installCapability(installedOnly),
      installCapability(contradictory),
    ]),
    files: {
      "managed.txt": undefined,
      "probable.txt": "present",
      "installed-only.txt": "present",
    },
  });
  delete fixture.files["managed.txt"];

  assert.deepEqual(await core.diffProject(requestFromFixture(fixture)), {
    equal: false,
    differences: [
      { kind: "desired-only", capability: "standards" },
      { kind: "inference-mismatch", capability: "contradictory" },
      { kind: "inferred-only", capability: "probable" },
      { kind: "installed-only", capability: "contradictory" },
      { kind: "installed-only", capability: "installed-only" },
    ],
  });
});

test("diff independently maps partial and ambiguous capability evidence", async () => {
  const standards = createDescriptor("standards", [
    { kind: "file", path: "standards.txt" },
  ]);
  const partial = createDescriptor("partial", [
    { kind: "file", path: "partial-present.txt" },
    { kind: "file", path: "partial-missing.txt" },
  ]);
  const partialFixture = minimalFixture({
    descriptor: standards,
    catalog: [partial, standards],
    files: {
      "managed.txt": undefined,
      "standards.txt": "present",
      "partial-present.txt": "present",
    },
  });
  delete partialFixture.files["managed.txt"];
  assert.deepEqual(await core.diffProject(requestFromFixture(partialFixture)), {
    equal: false,
    differences: [{ kind: "inferred-only", capability: "partial" }],
  });

  const ambiguous = createDescriptor("ambiguous", [
    {
      kind: "json-value",
      path: "ambiguous.json",
      pointer: "/enabled",
      expected: true,
    },
  ]);
  const ambiguousFixture = minimalFixture({
    descriptor: standards,
    catalog: [standards, ambiguous],
    files: {
      "managed.txt": undefined,
      "standards.txt": "present",
      "ambiguous.json": "{ private-token",
    },
  });
  delete ambiguousFixture.files["managed.txt"];
  const ambiguousResult = await core.diffProject(
    requestFromFixture(ambiguousFixture),
  );
  assert.deepEqual(ambiguousResult, {
    equal: false,
    differences: [{ kind: "inference-mismatch", capability: "ambiguous" }],
  });
  assert.doesNotMatch(JSON.stringify(ambiguousResult), /private-token/);
});

test("diff maps missing, drifted, and ambiguous managed surfaces with capability owners", async () => {
  const descriptor = createDescriptor("standards", [
    { kind: "file", path: "probe.txt" },
  ]);
  const surfaces = [
    createSurface({ identifier: "missing", path: "missing.txt" }),
    createSurface({ identifier: "drifted", path: "drifted.txt" }),
    createSurface({ identifier: "ambiguous", path: "ambiguous.txt" }),
    createSurface({
      identifier: "application",
      path: "application.txt",
      ownership: "application-owned",
    }),
  ];
  const fixture = minimalFixture({
    descriptor,
    stateValue: state([installCapability(descriptor)], surfaces),
    files: {
      "managed.txt": undefined,
      "probe.txt": "present",
      "drifted.txt": "changed",
    },
  });
  delete fixture.files["managed.txt"];
  const delegate = core.createInMemoryRepositoryReader(fixture.files);
  const reader = {
    readText: (path) =>
      path === "ambiguous.txt"
        ? Promise.resolve({ kind: "error", code: "READ_FAILED" })
        : delegate.readText(path),
  };

  assert.deepEqual(await core.diffProject(requestFromFixture(fixture, reader)), {
    equal: false,
    differences: [
      {
        kind: "managed-surface-drift",
        capability: "standards",
        path: "ambiguous.txt",
      },
      {
        kind: "managed-surface-drift",
        capability: "standards",
        path: "drifted.txt",
      },
      {
        kind: "managed-surface-drift",
        capability: "standards",
        path: "missing.txt",
      },
    ],
  });
});

test("doctor and diff use a read-once cache for every repository path per operation", async () => {
  const descriptor = createDescriptor("standards", [
    { kind: "file", path: ".egeria/project.yaml" },
  ]);
  const fixture = minimalFixture({ descriptor });

  for (const [operation, expected] of [
    [core.doctorRepository, { healthy: true, diagnostics: [] }],
    [core.diffProject, { equal: true, differences: [] }],
  ]) {
    const delegate = core.createInMemoryRepositoryReader(fixture.files);
    const reads = new Map();
    const reader = {
      readText(path) {
        reads.set(path, (reads.get(path) ?? 0) + 1);
        return delegate.readText(path);
      },
    };

    assert.deepEqual(await operation(requestFromFixture(fixture, reader)), expected);
    assert.equal(reads.get(".egeria/state.json"), 1);
    assert.equal(reads.get(".egeria/project.yaml"), 1);
    assert.equal(reads.get(".egeria/migrations.jsonl"), 1);
    assert.equal([...reads.values()].every((count) => count === 1), true);
  }
});

test("doctor and diff leave a filesystem repository byte-for-byte unchanged", async () => {
  const owner = await mkdtemp(join(tmpdir(), "egeria-diagnostics-read-only-"));

  try {
    const root = join(owner, "repository");
    const fixture = minimalFixture();

    for (const [path, content] of Object.entries(fixture.files)) {
      const target = join(root, path);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, content, "utf8");
    }

    const before = await snapshotDirectory(root);
    await core.doctorRepository(
      requestFromFixture(fixture, core.createFileSystemRepositoryReader(root)),
    );
    assert.deepEqual(await snapshotDirectory(root), before);

    await core.diffProject(
      requestFromFixture(fixture, core.createFileSystemRepositoryReader(root)),
    );
    assert.deepEqual(await snapshotDirectory(root), before);
  } finally {
    await rm(owner, { recursive: true, force: true });
  }
});
