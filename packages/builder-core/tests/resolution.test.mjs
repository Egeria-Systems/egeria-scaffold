import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import test from "node:test";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const builtEntry = resolve(packageRoot, "dist/index.js");
const core = await import(pathToFileURL(builtEntry));
const builtDeclaration = await readFile(
  resolve(packageRoot, "dist/index.d.ts"),
  "utf8",
);

const packageVersions = {
  standards: "1.2.3",
  observability: "4.5.6",
};

function assertOk(result) {
  assert.equal(result.ok, true, JSON.stringify(result.issues));
  return result.value;
}

function assertIssues(result, expectedIssues) {
  assert.equal(result.ok, false);
  assert.deepEqual(result.issues, expectedIssues);
}

function createCatalog() {
  return assertOk(core.createCapabilityCatalog(packageVersions));
}

function resolveRequest(
  request,
  catalog = createCatalog(),
  profiles = core.profileRecipes,
) {
  return core.resolveCapabilities(request, catalog, profiles);
}

test("standards hybrid ownership declares generated browser quality", () => {
  const standards = createCatalog().find(
    ({ identifier }) => identifier === "standards",
  );

  assert.notEqual(standards, undefined);
  assert.equal(standards.version, "0.2.0");
  assert.equal(standards.deliveryMode, "hybrid");
  assert.deepEqual(standards.requiredPackages, [
    "@axe-core/playwright",
    "@egeria-systems/standards",
    "@playwright/test",
  ]);
  assert.deepEqual(standards.environmentVariables, [
    "PLAYWRIGHT_DEPLOYED_URL",
  ]);
  assert.deepEqual(standards.secrets, []);
  assert.deepEqual(standards.externalDomains, [
    "cdn.playwright.dev",
    "playwright.download.prss.microsoft.com",
  ]);
  assert.deepEqual(standards.retentionAssumptions, [
    "ci-failure-artifacts-seven-days",
  ]);
  assert.deepEqual(standards.privilegedOperations, [
    "browser-binary-installation",
    "browser-process-execution",
  ]);
  assert.equal(standards.threatReviewLevel, "elevated");
  assert.deepEqual(
    standards.managedSurfaces.map(({ identifier }) => identifier).toSorted(),
    [
      "standards-axe-playwright-package",
      "standards-browser-install-ci-script",
      "standards-browser-install-script",
      "standards-browser-quality-specification",
      "standards-deployed-browser-test-script",
      "standards-development-browser-test-script",
      "standards-eslint-configuration",
      "standards-playwright-deployed-configuration",
      "standards-playwright-development-configuration",
      "standards-playwright-package",
      "standards-playwright-preview-configuration",
      "standards-playwright-shared-configuration",
      "standards-preview-browser-test-script",
      "standards-package",
      "standards-quality-workflow",
      "standards-typescript-configuration",
    ].toSorted(),
  );
  assert.equal(standards.inferenceProbes.length, 16);
  assert.deepEqual(standards.verificationPlan, [
    "package-resolution",
    "lint",
    "typecheck",
    "browser-development",
    "browser-preview",
    "deployed-configuration",
    "workflow-contracts",
  ]);
  assert.deepEqual(standards.documentationEvidenceRequirements, [
    "public-package-version-and-provenance",
    "browser-testing-claim-boundaries",
  ]);
  assert.deepEqual(standards.removalAndRecoveryRequirements, [
    "review-package-and-configuration-removal",
    "review-generated-quality-surface-removal",
  ]);
});

test("the portfolio and site catalog declares the exact seven executable capability contracts", async () => {
  const catalogEntry = builtDeclaration.match(
    /export \* from "(\.\/catalog\/[^\"]+)\.js";/,
  )?.[1];
  assert.ok(catalogEntry);
  const catalogDeclaration = await readFile(
    resolve(packageRoot, "dist", `${catalogEntry}.d.ts`),
    "utf8",
  );

  assert.equal(typeof core.createCapabilityCatalog, "function");
  assert.ok(Array.isArray(core.profileRecipes));
  assert.match(catalogDeclaration, /\bCapabilityPackageVersions\b/);

  const catalog = createCatalog();
  const bookingCalendly = catalog.find(
    ({ identifier }) => identifier === "booking-calendly",
  );

  assert.notEqual(bookingCalendly, undefined);
  assert.deepEqual(bookingCalendly.externalDomains, [
    "calendly.com",
    "www.calendly.com",
  ]);
  assert.deepEqual(bookingCalendly.contentSecurityPolicyContributions, [
    "frame-src https://calendly.com https://www.calendly.com",
  ]);

  assert.deepEqual(catalog, [
    {
      identifier: "standards",
      version: "0.2.0",
      deliveryMode: "hybrid",
      stateClassifications: ["repository-stateful"],
      removalPolicy: "reviewed",
      dependencies: [],
      optionalIntegrations: [],
      conflicts: [],
      supportedProfiles: ["portfolio", "site"],
      requiredPackages: [
        "@axe-core/playwright",
        "@egeria-systems/standards",
        "@playwright/test",
      ],
      environmentVariables: ["PLAYWRIGHT_DEPLOYED_URL"],
      secrets: [],
      platformResources: [],
      externalDomains: [
        "cdn.playwright.dev",
        "playwright.download.prss.microsoft.com",
      ],
      contentSecurityPolicyContributions: [],
      browserStorage: [],
      dataClassifications: [],
      retentionAssumptions: ["ci-failure-artifacts-seven-days"],
      privilegedOperations: [
        "browser-binary-installation",
        "browser-process-execution",
      ],
      threatReviewLevel: "elevated",
      adapterSemanticRequirements: [],
      managedSurfaces: [
        {
          identifier: "standards-axe-playwright-package",
          owner: { kind: "capability", identifier: "standards" },
          path: "apps/web/package.json",
          ownership: "merge-managed",
          fingerprintTarget: {
            kind: "json-value",
            pointer: "/devDependencies/@axe-core~1playwright",
          },
          mergeStrategy: "json-property",
        },
        {
          identifier: "standards-browser-install-ci-script",
          owner: { kind: "capability", identifier: "standards" },
          path: "apps/web/package.json",
          ownership: "merge-managed",
          fingerprintTarget: {
            kind: "json-value",
            pointer: "/scripts/browser:install:ci",
          },
          mergeStrategy: "json-property",
        },
        {
          identifier: "standards-browser-install-script",
          owner: { kind: "capability", identifier: "standards" },
          path: "apps/web/package.json",
          ownership: "merge-managed",
          fingerprintTarget: {
            kind: "json-value",
            pointer: "/scripts/browser:install",
          },
          mergeStrategy: "json-property",
        },
        {
          identifier: "standards-browser-quality-specification",
          owner: { kind: "capability", identifier: "standards" },
          path: "apps/web/tests/e2e/site-quality.spec.ts",
          ownership: "application-owned",
          fingerprintTarget: { kind: "file" },
          mergeStrategy: "replace-file",
        },
        {
          identifier: "standards-deployed-browser-test-script",
          owner: { kind: "capability", identifier: "standards" },
          path: "apps/web/package.json",
          ownership: "merge-managed",
          fingerprintTarget: {
            kind: "json-value",
            pointer: "/scripts/test:e2e:deployed",
          },
          mergeStrategy: "json-property",
        },
        {
          identifier: "standards-development-browser-test-script",
          owner: { kind: "capability", identifier: "standards" },
          path: "apps/web/package.json",
          ownership: "merge-managed",
          fingerprintTarget: {
            kind: "json-value",
            pointer: "/scripts/test:e2e:dev",
          },
          mergeStrategy: "json-property",
        },
        {
          identifier: "standards-eslint-configuration",
          owner: { kind: "capability", identifier: "standards" },
          path: "apps/web/eslint.config.mjs",
          ownership: "managed",
          fingerprintTarget: { kind: "file" },
          mergeStrategy: "replace-file",
        },
        {
          identifier: "standards-package",
          owner: { kind: "capability", identifier: "standards" },
          path: "apps/web/package.json",
          ownership: "merge-managed",
          fingerprintTarget: {
            kind: "json-value",
            pointer: "/devDependencies/@egeria-systems~1standards",
          },
          mergeStrategy: "json-property",
        },
        {
          identifier: "standards-playwright-deployed-configuration",
          owner: { kind: "capability", identifier: "standards" },
          path: "apps/web/playwright.deployed.config.ts",
          ownership: "managed",
          fingerprintTarget: { kind: "file" },
          mergeStrategy: "replace-file",
        },
        {
          identifier: "standards-playwright-development-configuration",
          owner: { kind: "capability", identifier: "standards" },
          path: "apps/web/playwright.dev.config.ts",
          ownership: "managed",
          fingerprintTarget: { kind: "file" },
          mergeStrategy: "replace-file",
        },
        {
          identifier: "standards-playwright-package",
          owner: { kind: "capability", identifier: "standards" },
          path: "apps/web/package.json",
          ownership: "merge-managed",
          fingerprintTarget: {
            kind: "json-value",
            pointer: "/devDependencies/@playwright~1test",
          },
          mergeStrategy: "json-property",
        },
        {
          identifier: "standards-playwright-preview-configuration",
          owner: { kind: "capability", identifier: "standards" },
          path: "apps/web/playwright.preview.config.ts",
          ownership: "managed",
          fingerprintTarget: { kind: "file" },
          mergeStrategy: "replace-file",
        },
        {
          identifier: "standards-playwright-shared-configuration",
          owner: { kind: "capability", identifier: "standards" },
          path: "apps/web/playwright.config.shared.ts",
          ownership: "managed",
          fingerprintTarget: { kind: "file" },
          mergeStrategy: "replace-file",
        },
        {
          identifier: "standards-preview-browser-test-script",
          owner: { kind: "capability", identifier: "standards" },
          path: "apps/web/package.json",
          ownership: "merge-managed",
          fingerprintTarget: {
            kind: "json-value",
            pointer: "/scripts/test:e2e:preview",
          },
          mergeStrategy: "json-property",
        },
        {
          identifier: "standards-quality-workflow",
          owner: { kind: "capability", identifier: "standards" },
          path: ".github/workflows/quality.yml",
          ownership: "managed",
          fingerprintTarget: { kind: "file" },
          mergeStrategy: "replace-file",
        },
        {
          identifier: "standards-typescript-configuration",
          owner: { kind: "capability", identifier: "standards" },
          path: "apps/web/tsconfig.json",
          ownership: "managed",
          fingerprintTarget: { kind: "file" },
          mergeStrategy: "replace-file",
        },
      ],
      inferenceProbes: [
        {
          kind: "package",
          path: "apps/web/package.json",
          section: "devDependencies",
          packageName: "@axe-core/playwright",
          version: "4.12.1",
        },
        {
          kind: "json-value",
          path: "apps/web/package.json",
          pointer: "/scripts/browser:install:ci",
          expected: "playwright install --with-deps chromium",
        },
        {
          kind: "json-value",
          path: "apps/web/package.json",
          pointer: "/scripts/browser:install",
          expected: "playwright install chromium",
        },
        { kind: "file", path: "apps/web/tests/e2e/site-quality.spec.ts" },
        {
          kind: "json-value",
          path: "apps/web/package.json",
          pointer: "/scripts/test:e2e:deployed",
          expected: "playwright test --config playwright.deployed.config.ts",
        },
        {
          kind: "json-value",
          path: "apps/web/package.json",
          pointer: "/scripts/test:e2e:dev",
          expected: "playwright test --config playwright.dev.config.ts",
        },
        { kind: "file", path: "apps/web/eslint.config.mjs" },
        {
          kind: "package",
          path: "apps/web/package.json",
          section: "devDependencies",
          packageName: "@egeria-systems/standards",
          version: "1.2.3",
        },
        { kind: "file", path: "apps/web/playwright.deployed.config.ts" },
        { kind: "file", path: "apps/web/playwright.dev.config.ts" },
        {
          kind: "package",
          path: "apps/web/package.json",
          section: "devDependencies",
          packageName: "@playwright/test",
          version: "1.62.1",
        },
        { kind: "file", path: "apps/web/playwright.preview.config.ts" },
        { kind: "file", path: "apps/web/playwright.config.shared.ts" },
        {
          kind: "json-value",
          path: "apps/web/package.json",
          pointer: "/scripts/test:e2e:preview",
          expected: "playwright test --config playwright.preview.config.ts",
        },
        { kind: "file", path: ".github/workflows/quality.yml" },
        { kind: "file", path: "apps/web/tsconfig.json" },
      ],
      migrationPlanners: [],
      verificationPlan: [
        "package-resolution",
        "lint",
        "typecheck",
        "browser-development",
        "browser-preview",
        "deployed-configuration",
        "workflow-contracts",
      ],
      documentationEvidenceRequirements: [
        "public-package-version-and-provenance",
        "browser-testing-claim-boundaries",
      ],
      removalAndRecoveryRequirements: [
        "review-package-and-configuration-removal",
        "review-generated-quality-surface-removal",
      ],
    },
    {
      identifier: "content-files",
      version: "0.4.0",
      deliveryMode: "source-generated",
      stateClassifications: ["repository-stateful"],
      removalPolicy: "reviewed",
      dependencies: ["standards"],
      optionalIntegrations: [],
      conflicts: [],
      supportedProfiles: ["portfolio", "site"],
      requiredPackages: ["raw-loader", "yaml"],
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
      managedSurfaces: [
        {
          identifier: "content-files-raw-loader-package",
          owner: { kind: "capability", identifier: "content-files" },
          path: "apps/web/package.json",
          ownership: "merge-managed",
          fingerprintTarget: {
            kind: "json-value",
            pointer: "/devDependencies/raw-loader",
          },
          mergeStrategy: "json-property",
        },
        {
          identifier: "content-files-yaml-package",
          owner: { kind: "capability", identifier: "content-files" },
          path: "apps/web/package.json",
          ownership: "merge-managed",
          fingerprintTarget: {
            kind: "json-value",
            pointer: "/dependencies/yaml",
          },
          mergeStrategy: "json-property",
        },
        {
          identifier: "content-files-configuration",
          owner: { kind: "capability", identifier: "content-files" },
          path: "apps/web/content/content.config.yaml",
          ownership: "application-owned",
          fingerprintTarget: { kind: "file" },
          mergeStrategy: "replace-file",
        },
        {
          identifier: "content-files-long-form-introduction",
          owner: { kind: "capability", identifier: "content-files" },
          path: "apps/web/content/en-CA/long-form/introduction.md",
          ownership: "application-owned",
          fingerprintTarget: { kind: "file" },
          mergeStrategy: "replace-file",
        },
        {
          identifier: "content-files-site-content",
          owner: { kind: "capability", identifier: "content-files" },
          path: "apps/web/content/en-CA/site.yaml",
          ownership: "application-owned",
          fingerprintTarget: { kind: "file" },
          mergeStrategy: "replace-file",
        },
        {
          identifier: "content-files-schema",
          owner: { kind: "capability", identifier: "content-files" },
          path: "apps/web/src/content/content-schema.ts",
          ownership: "application-owned",
          fingerprintTarget: { kind: "file" },
          mergeStrategy: "replace-file",
        },
        {
          identifier: "content-files-source-declarations",
          owner: { kind: "capability", identifier: "content-files" },
          path: "apps/web/src/content/content-source.d.ts",
          ownership: "application-owned",
          fingerprintTarget: { kind: "file" },
          mergeStrategy: "replace-file",
        },
        {
          identifier: "content-files-reader",
          owner: { kind: "capability", identifier: "content-files" },
          path: "apps/web/src/content/read-content.ts",
          ownership: "application-owned",
          fingerprintTarget: { kind: "file" },
          mergeStrategy: "replace-file",
        },
      ],
      inferenceProbes: [
        {
          kind: "package",
          path: "apps/web/package.json",
          section: "devDependencies",
          packageName: "raw-loader",
          version: "4.0.2",
        },
        {
          kind: "package",
          path: "apps/web/package.json",
          section: "dependencies",
          packageName: "yaml",
          version: "2.9.0",
        },
        { kind: "file", path: "apps/web/content/content.config.yaml" },
        {
          kind: "file",
          path: "apps/web/content/en-CA/long-form/introduction.md",
        },
        { kind: "file", path: "apps/web/content/en-CA/site.yaml" },
        { kind: "file", path: "apps/web/src/content/content-schema.ts" },
        {
          kind: "file",
          path: "apps/web/src/content/content-source.d.ts",
        },
        { kind: "file", path: "apps/web/src/content/read-content.ts" },
      ],
      migrationPlanners: [],
      verificationPlan: ["content-contracts", "typecheck"],
      documentationEvidenceRequirements: ["copy-externalization"],
      removalAndRecoveryRequirements: ["review-content-and-source-removal"],
    },
    {
      identifier: "section-composition",
      version: "0.3.0",
      deliveryMode: "source-generated",
      stateClassifications: ["repository-stateful"],
      removalPolicy: "reviewed",
      dependencies: ["content-files"],
      optionalIntegrations: [],
      conflicts: [],
      supportedProfiles: ["portfolio", "site"],
      requiredPackages: ["@tailwindcss/postcss", "postcss", "tailwindcss"],
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
      managedSurfaces: [
        {
          identifier: "section-composition-global-styles",
          owner: { kind: "capability", identifier: "section-composition" },
          path: "apps/web/app/globals.css",
          ownership: "application-owned",
          fingerprintTarget: { kind: "file" },
          mergeStrategy: "replace-file",
        },
        {
          identifier: "section-composition-postcss-package",
          owner: { kind: "capability", identifier: "section-composition" },
          path: "apps/web/package.json",
          ownership: "merge-managed",
          fingerprintTarget: {
            kind: "json-value",
            pointer: "/devDependencies/postcss",
          },
          mergeStrategy: "json-property",
        },
        {
          identifier: "section-composition-tailwind-package",
          owner: { kind: "capability", identifier: "section-composition" },
          path: "apps/web/package.json",
          ownership: "merge-managed",
          fingerprintTarget: {
            kind: "json-value",
            pointer: "/devDependencies/tailwindcss",
          },
          mergeStrategy: "json-property",
        },
        {
          identifier: "section-composition-tailwind-postcss-package",
          owner: { kind: "capability", identifier: "section-composition" },
          path: "apps/web/package.json",
          ownership: "merge-managed",
          fingerprintTarget: {
            kind: "json-value",
            pointer: "/devDependencies/@tailwindcss~1postcss",
          },
          mergeStrategy: "json-property",
        },
        {
          identifier: "section-composition-postcss-configuration",
          owner: { kind: "capability", identifier: "section-composition" },
          path: "apps/web/postcss.config.mjs",
          ownership: "application-owned",
          fingerprintTarget: { kind: "file" },
          mergeStrategy: "replace-file",
        },
        {
          identifier: "section-composition-presentation",
          owner: { kind: "capability", identifier: "section-composition" },
          path: "apps/web/src/presentation/content-page.tsx",
          ownership: "application-owned",
          fingerprintTarget: { kind: "file" },
          mergeStrategy: "replace-file",
        },
        {
          identifier: "section-composition-registry",
          owner: { kind: "capability", identifier: "section-composition" },
          path: "apps/web/src/sections/section-registry.tsx",
          ownership: "application-owned",
          fingerprintTarget: { kind: "file" },
          mergeStrategy: "replace-file",
        },
      ],
      inferenceProbes: [
        {
          kind: "package",
          path: "apps/web/package.json",
          section: "devDependencies",
          packageName: "@tailwindcss/postcss",
          version: "4.3.3",
        },
        {
          kind: "package",
          path: "apps/web/package.json",
          section: "devDependencies",
          packageName: "postcss",
          version: "8.5.26",
        },
        {
          kind: "package",
          path: "apps/web/package.json",
          section: "devDependencies",
          packageName: "tailwindcss",
          version: "4.3.3",
        },
        { kind: "file", path: "apps/web/app/globals.css" },
        { kind: "file", path: "apps/web/postcss.config.mjs" },
        {
          kind: "file",
          path: "apps/web/src/presentation/content-page.tsx",
        },
        {
          kind: "file",
          path: "apps/web/src/sections/section-registry.tsx",
        },
      ],
      migrationPlanners: [],
      verificationPlan: ["typecheck", "next-build"],
      documentationEvidenceRequirements: ["bounded-section-composition"],
      removalAndRecoveryRequirements: [
        "review-route-and-presentation-removal",
      ],
    },
    {
      identifier: "deployment-cloudflare",
      version: "0.2.0",
      deliveryMode: "hybrid",
      stateClassifications: ["repository-stateful", "external-stateful"],
      removalPolicy: "reviewed",
      dependencies: ["standards"],
      optionalIntegrations: [],
      conflicts: [],
      supportedProfiles: ["portfolio", "site"],
      requiredPackages: ["@opennextjs/cloudflare", "wrangler"],
      environmentVariables: [],
      secrets: [],
      platformResources: ["cloudflare-worker", "cloudflare-static-assets"],
      externalDomains: [],
      contentSecurityPolicyContributions: [],
      browserStorage: [],
      dataClassifications: [],
      retentionAssumptions: [],
      privilegedOperations: [],
      threatReviewLevel: "standard",
      adapterSemanticRequirements: ["node-runtime", "worker-static-assets"],
      managedSurfaces: [
        {
          identifier: "deployment-cloudflare-package",
          owner: { kind: "capability", identifier: "deployment-cloudflare" },
          path: "apps/web/package.json",
          ownership: "merge-managed",
          fingerprintTarget: {
            kind: "json-value",
            pointer: "/dependencies/@opennextjs~1cloudflare",
          },
          mergeStrategy: "json-property",
        },
        {
          identifier: "deployment-cloudflare-wrangler-package",
          owner: { kind: "capability", identifier: "deployment-cloudflare" },
          path: "apps/web/package.json",
          ownership: "merge-managed",
          fingerprintTarget: {
            kind: "json-value",
            pointer: "/devDependencies/wrangler",
          },
          mergeStrategy: "json-property",
        },
        {
          identifier: "deployment-cloudflare-next-configuration",
          owner: { kind: "capability", identifier: "deployment-cloudflare" },
          path: "apps/web/next.config.ts",
          ownership: "managed",
          fingerprintTarget: { kind: "file" },
          mergeStrategy: "replace-file",
        },
        {
          identifier: "deployment-cloudflare-open-next-configuration",
          owner: { kind: "capability", identifier: "deployment-cloudflare" },
          path: "apps/web/open-next.config.ts",
          ownership: "managed",
          fingerprintTarget: { kind: "file" },
          mergeStrategy: "replace-file",
        },
        {
          identifier: "deployment-cloudflare-wrangler-configuration",
          owner: { kind: "capability", identifier: "deployment-cloudflare" },
          path: "apps/web/wrangler.jsonc",
          ownership: "managed",
          fingerprintTarget: { kind: "file" },
          mergeStrategy: "replace-file",
        },
      ],
      inferenceProbes: [
        {
          kind: "package",
          path: "apps/web/package.json",
          section: "dependencies",
          packageName: "@opennextjs/cloudflare",
          version: "1.20.2",
        },
        {
          kind: "package",
          path: "apps/web/package.json",
          section: "devDependencies",
          packageName: "wrangler",
          version: "4.118.0",
        },
        { kind: "file", path: "apps/web/next.config.ts" },
        { kind: "file", path: "apps/web/open-next.config.ts" },
        { kind: "file", path: "apps/web/wrangler.jsonc" },
      ],
      migrationPlanners: [],
      verificationPlan: ["next-build", "opennext-build", "wrangler-types"],
      documentationEvidenceRequirements: [
        "nextjs-opennext-cloudflare-compatibility",
      ],
      removalAndRecoveryRequirements: [
        "review-deployment-source-and-provider-state-separately",
      ],
    },
    {
      identifier: "observability",
      version: "0.2.0",
      deliveryMode: "hybrid",
      stateClassifications: ["repository-stateful", "external-stateful"],
      removalPolicy: "reviewed",
      dependencies: ["deployment-cloudflare"],
      optionalIntegrations: [],
      conflicts: [],
      supportedProfiles: ["portfolio", "site"],
      requiredPackages: ["@egeria-systems/observability"],
      environmentVariables: [],
      secrets: [
        "BETTER_STACK_INGESTING_HOST",
        "BETTER_STACK_SOURCE_TOKEN",
      ],
      platformResources: [
        "better-stack-telemetry-source",
        "cloudflare-workers-logs",
      ],
      externalDomains: ["*.betterstackdata.com"],
      contentSecurityPolicyContributions: [],
      browserStorage: [],
      dataClassifications: ["bounded-operational-telemetry"],
      retentionAssumptions: ["provider-controlled-operational-log-retention"],
      privilegedOperations: [
        "cloudflare-secret-configuration",
        "provider-source-configuration",
      ],
      threatReviewLevel: "elevated",
      adapterSemanticRequirements: [
        "cloudflare-execution-context-lifetime",
        "cloudflare-version-metadata",
        "same-origin-browser-ingest",
      ],
      managedSurfaces: [
        {
          identifier: "observability-package",
          owner: { kind: "capability", identifier: "observability" },
          path: "apps/web/package.json",
          ownership: "merge-managed",
          fingerprintTarget: {
            kind: "json-value",
            pointer: "/dependencies/@egeria-systems~1observability",
          },
          mergeStrategy: "json-property",
        },
        {
          identifier: "observability-browser-ingest-route",
          owner: { kind: "capability", identifier: "observability" },
          path: "apps/web/app/api/observability/route.ts",
          ownership: "application-owned",
          fingerprintTarget: { kind: "file" },
          mergeStrategy: "replace-file",
        },
        {
          identifier: "observability-browser-instrumentation",
          owner: { kind: "capability", identifier: "observability" },
          path: "apps/web/instrumentation-client.ts",
          ownership: "application-owned",
          fingerprintTarget: { kind: "file" },
          mergeStrategy: "replace-file",
        },
        {
          identifier: "observability-browser-reporter",
          owner: { kind: "capability", identifier: "observability" },
          path:
            "apps/web/src/infrastructure/observability/browser-reporter.ts",
          ownership: "application-owned",
          fingerprintTarget: { kind: "file" },
          mergeStrategy: "replace-file",
        },
        {
          identifier: "observability-cloudflare-context",
          owner: { kind: "capability", identifier: "observability" },
          path:
            "apps/web/src/infrastructure/cloudflare/observability-context.ts",
          ownership: "application-owned",
          fingerprintTarget: { kind: "file" },
          mergeStrategy: "replace-file",
        },
        {
          identifier: "observability-registration",
          owner: { kind: "capability", identifier: "observability" },
          path:
            "apps/web/src/infrastructure/observability/installed-capability.ts",
          ownership: "managed",
          fingerprintTarget: { kind: "file" },
          mergeStrategy: "replace-file",
        },
        {
          identifier: "observability-server-instrumentation",
          owner: { kind: "capability", identifier: "observability" },
          path: "apps/web/instrumentation.ts",
          ownership: "application-owned",
          fingerprintTarget: { kind: "file" },
          mergeStrategy: "replace-file",
        },
        {
          identifier: "observability-server-reporter",
          owner: { kind: "capability", identifier: "observability" },
          path:
            "apps/web/src/infrastructure/observability/server-reporter.ts",
          ownership: "application-owned",
          fingerprintTarget: { kind: "file" },
          mergeStrategy: "replace-file",
        },
        {
          identifier: "observability-web-vitals-reporter",
          owner: { kind: "capability", identifier: "observability" },
          path:
            "apps/web/src/infrastructure/observability/web-vitals-reporter.tsx",
          ownership: "application-owned",
          fingerprintTarget: { kind: "file" },
          mergeStrategy: "replace-file",
        },
      ],
      inferenceProbes: [
        {
          kind: "package",
          path: "apps/web/package.json",
          section: "dependencies",
          packageName: "@egeria-systems/observability",
          version: "4.5.6",
        },
        {
          kind: "file",
          path: "apps/web/app/api/observability/route.ts",
        },
        {
          kind: "file",
          path: "apps/web/instrumentation-client.ts",
        },
        {
          kind: "file",
          path: "apps/web/instrumentation.ts",
        },
        {
          kind: "file",
          path:
            "apps/web/src/infrastructure/cloudflare/observability-context.ts",
        },
        {
          kind: "file",
          path:
            "apps/web/src/infrastructure/observability/browser-reporter.ts",
        },
        {
          kind: "file",
          path:
            "apps/web/src/infrastructure/observability/installed-capability.ts",
        },
        {
          kind: "file",
          path:
            "apps/web/src/infrastructure/observability/server-reporter.ts",
        },
        {
          kind: "file",
          path:
            "apps/web/src/infrastructure/observability/web-vitals-reporter.tsx",
        },
        {
          kind: "json-value",
          path: "apps/web/wrangler.jsonc",
          pointer: "/observability/enabled",
          expected: true,
        },
        {
          kind: "json-value",
          path: "apps/web/wrangler.jsonc",
          pointer: "/observability/head_sampling_rate",
          expected: 1,
        },
        {
          kind: "json-value",
          path: "apps/web/wrangler.jsonc",
          pointer: "/observability/logs/invocation_logs",
          expected: false,
        },
        {
          kind: "json-value",
          path: "apps/web/wrangler.jsonc",
          pointer: "/version_metadata/binding",
          expected: "CF_VERSION_METADATA",
        },
      ],
      migrationPlanners: [],
      verificationPlan: [
        "package-resolution",
        "observability-contracts",
        "lint",
        "typecheck",
        "next-build",
        "opennext-build",
        "wrangler-types",
        "browser-development",
        "browser-preview",
      ],
      documentationEvidenceRequirements: [
        "public-package-version-and-provenance",
        "analytics-separation",
      ],
      removalAndRecoveryRequirements: [
        "review-deployment-observability-configuration-removal",
        "review-generated-observability-source-removal",
        "review-observability-credential-revocation-or-rotation",
        "review-observability-provider-resource-removal",
        "review-observability-retention-and-data-disposition",
        "review-observability-source-provider-and-credential-recovery-separately",
        "review-package-and-registration-removal",
      ],
    },
    {
      identifier: "site-routing",
      version: "0.3.0",
      deliveryMode: "source-generated",
      stateClassifications: ["repository-stateful"],
      removalPolicy: "reviewed",
      dependencies: ["content-files", "section-composition"],
      optionalIntegrations: [],
      conflicts: [],
      supportedProfiles: ["site"],
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
      managedSurfaces: [
        {
          identifier: "site-routing-about-route",
          owner: { kind: "capability", identifier: "site-routing" },
          path: "apps/web/app/about/page.tsx",
          ownership: "application-owned",
          fingerprintTarget: { kind: "file" },
          mergeStrategy: "replace-file",
        },
        {
          identifier: "site-routing-about-content",
          owner: { kind: "capability", identifier: "site-routing" },
          path: "apps/web/content/en-CA/about.yaml",
          ownership: "application-owned",
          fingerprintTarget: { kind: "file" },
          mergeStrategy: "replace-file",
        },
      ],
      inferenceProbes: [
        { kind: "file", path: "apps/web/app/about/page.tsx" },
        { kind: "file", path: "apps/web/content/en-CA/about.yaml" },
      ],
      migrationPlanners: [],
      verificationPlan: ["typecheck", "next-build"],
      documentationEvidenceRequirements: ["multi-page-routing-contract"],
      removalAndRecoveryRequirements: ["review-route-and-content-removal"],
    },
    {
      identifier: "booking-calendly",
      version: "0.1.0",
      deliveryMode: "source-generated",
      stateClassifications: ["repository-stateful"],
      removalPolicy: "automatic",
      dependencies: ["section-composition"],
      optionalIntegrations: [],
      conflicts: [],
      supportedProfiles: ["portfolio", "site"],
      requiredPackages: [],
      environmentVariables: [],
      secrets: [],
      platformResources: [],
      externalDomains: ["calendly.com", "www.calendly.com"],
      contentSecurityPolicyContributions: [
        "frame-src https://calendly.com https://www.calendly.com",
      ],
      browserStorage: ["provider-controlled-cross-origin-frame"],
      dataClassifications: ["provider-controlled-scheduling-data"],
      retentionAssumptions: ["provider-controlled"],
      privilegedOperations: [],
      threatReviewLevel: "elevated",
      adapterSemanticRequirements: [],
      managedSurfaces: [
        {
          identifier: "booking-calendly-browser-specification",
          owner: { kind: "capability", identifier: "booking-calendly" },
          path: "apps/web/tests/e2e/calendly-booking.spec.ts",
          ownership: "application-owned",
          fingerprintTarget: { kind: "file" },
          mergeStrategy: "replace-file",
        },
        {
          identifier: "booking-calendly-client-component",
          owner: { kind: "capability", identifier: "booking-calendly" },
          path:
            "apps/web/src/integrations/booking-calendly/calendly-booking.tsx",
          ownership: "application-owned",
          fingerprintTarget: { kind: "file" },
          mergeStrategy: "replace-file",
        },
        {
          identifier: "booking-calendly-content",
          owner: { kind: "capability", identifier: "booking-calendly" },
          path: "apps/web/content/en-CA/booking-calendly.yaml",
          ownership: "application-owned",
          fingerprintTarget: { kind: "file" },
          mergeStrategy: "replace-file",
        },
        {
          identifier: "booking-calendly-content-reader",
          owner: { kind: "capability", identifier: "booking-calendly" },
          path:
            "apps/web/src/integrations/booking-calendly/booking-content.ts",
          ownership: "application-owned",
          fingerprintTarget: { kind: "file" },
          mergeStrategy: "replace-file",
        },
        {
          identifier: "booking-calendly-settings",
          owner: { kind: "capability", identifier: "booking-calendly" },
          path:
            "apps/web/src/integrations/booking-calendly/booking-settings.ts",
          ownership: "managed",
          fingerprintTarget: { kind: "file" },
          mergeStrategy: "replace-file",
        },
      ],
      inferenceProbes: [
        {
          kind: "file",
          path: "apps/web/tests/e2e/calendly-booking.spec.ts",
        },
        {
          kind: "file",
          path:
            "apps/web/src/integrations/booking-calendly/calendly-booking.tsx",
        },
        {
          kind: "file",
          path: "apps/web/content/en-CA/booking-calendly.yaml",
        },
        {
          kind: "file",
          path:
            "apps/web/src/integrations/booking-calendly/booking-content.ts",
        },
        {
          kind: "file",
          path:
            "apps/web/src/integrations/booking-calendly/booking-settings.ts",
        },
      ],
      migrationPlanners: [],
      verificationPlan: [
        "typecheck",
        "next-build",
        "browser-development",
        "browser-preview",
      ],
      documentationEvidenceRequirements: [
        "cross-origin-provider-data-boundary",
        "booking-fallback-and-activation-contract",
      ],
      removalAndRecoveryRequirements: [
        "remove-generated-booking-surfaces",
        "exclude-calendly-account-and-provider-data",
      ],
    },
  ]);

  const observability = catalog.find(
    ({ identifier }) => identifier === "observability",
  );
  assert.notEqual(observability, undefined);
  assert.equal(
    observability.managedSurfaces.some(
      ({ path }) => path === "apps/web/wrangler.jsonc",
    ),
    false,
  );
  assert.equal(observability.browserStorage.length, 0);
  assert.doesNotMatch(
    JSON.stringify({
      requiredPackages: observability.requiredPackages,
      platformResources: observability.platformResources,
      externalDomains: observability.externalDomains,
      browserStorage: observability.browserStorage,
      privilegedOperations: observability.privilegedOperations,
    }),
    /analytics|console-(?:capture|interception)|session-replay/iu,
  );
});

test("capability package versions must be exact stable releases and issues do not echo inputs", () => {
  for (const invalidVersion of [
    "workspace:*",
    "file:../standards",
    "git+https://example.invalid/package.git",
    "https://example.invalid/package.tgz",
    "^1.2.3",
    ">=1.2.3",
    "1.2.3-beta.1",
  ]) {
    const result = core.createCapabilityCatalog({
      standards: invalidVersion,
      observability: "4.5.6",
    });

    assertIssues(result, [
      {
        code: "CAPABILITY_PACKAGE_VERSION_INVALID",
        path: ["packageVersions", "standards"],
        context: { packageName: "@egeria-systems/standards" },
      },
    ]);
    assert.doesNotMatch(JSON.stringify(result.issues), new RegExp(invalidVersion.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  const result = core.createCapabilityCatalog({
    standards: "workspace:*",
    observability: "latest",
  });
  assert.deepEqual(
    result.issues.map((issue) => issue.path),
    [
      ["packageVersions", "standards"],
      ["packageVersions", "observability"],
    ],
  );
});

test("the verified generation catalog pins exact public package releases", () => {
  assert.deepEqual(core.verifiedCapabilityPackageVersions, {
    standards: "0.1.0",
    observability: "0.2.0",
  });
  assert.equal(Object.isFrozen(core.verifiedCapabilityPackageVersions), true);
  assert.throws(() => {
    core.verifiedCapabilityPackageVersions.standards = "9.9.9";
  }, TypeError);
  assert.equal(core.verifiedCapabilityPackageVersions.standards, "0.1.0");

  const catalog = assertOk(core.createVerifiedCapabilityCatalog());
  assert.equal(catalog.length, 7);
  assert.deepEqual(
    catalog.map(({ identifier }) => identifier),
    [
      "standards",
      "content-files",
      "section-composition",
      "deployment-cloudflare",
      "observability",
      "site-routing",
      "booking-calendly",
    ],
  );

  const packageProbes = catalog.flatMap((capability) =>
    capability.inferenceProbes.filter(({ kind }) => kind === "package"),
  );
  assert.deepEqual(
    packageProbes.filter(({ packageName }) =>
      packageName.startsWith("@egeria-systems/"),
    ),
    [
      {
        kind: "package",
        path: "apps/web/package.json",
        section: "devDependencies",
        packageName: "@egeria-systems/standards",
        version: "0.1.0",
      },
      {
        kind: "package",
        path: "apps/web/package.json",
        section: "dependencies",
        packageName: "@egeria-systems/observability",
        version: "0.2.0",
      },
    ],
  );
  for (const { version } of packageProbes) {
    assert.match(version, /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/);
    assert.doesNotMatch(
      version,
      /workspace:|file:|git(?:\+|:)|https?:|[~^*<>=|]|latest|next|beta|rc/i,
    );
  }
});

test("portfolio and site recipes resolve to deterministic dependency-first manifests", () => {
  assert.deepEqual(core.profileRecipes, [
    {
      identifier: "portfolio",
      schemaVersion: "1.0.0",
      recipeVersion: "0.6.0",
      defaultCapabilities: [
        "standards",
        "content-files",
        "section-composition",
        "deployment-cloudflare",
        "observability",
      ],
    },
    {
      identifier: "site",
      schemaVersion: "1.0.0",
      recipeVersion: "0.6.0",
      defaultCapabilities: [
        "standards",
        "content-files",
        "section-composition",
        "deployment-cloudflare",
        "observability",
        "site-routing",
      ],
    },
  ]);

  const catalog = createCatalog();
  const portfolio = assertOk(
    resolveRequest({ profile: "portfolio" }, [...catalog].reverse()),
  );
  const site = assertOk(
    resolveRequest(
      {
        profile: "site",
        requestedCapabilities: [
          "site-routing",
          "site-routing",
          "standards",
        ],
      },
      [catalog[3], catalog[0], catalog[5], catalog[2], catalog[4], catalog[1]],
    ),
  );

  assert.equal(portfolio.profile, "portfolio");
  assert.equal(portfolio.recipeVersion, "0.6.0");
  assert.deepEqual(
    portfolio.capabilities.map(({ identifier }) => identifier),
    [
      "standards",
      "content-files",
      "section-composition",
      "deployment-cloudflare",
      "observability",
    ],
  );
  assert.deepEqual(
    site.capabilities.map(({ identifier }) => identifier),
    [
      "standards",
      "content-files",
      "section-composition",
      "deployment-cloudflare",
      "observability",
      "site-routing",
    ],
  );

  for (const profile of ["portfolio", "site"]) {
    const selected = assertOk(
      resolveRequest({
        profile,
        requestedCapabilities: ["booking-calendly"],
      }),
    );
    const selectedIdentifiers = selected.capabilities.map(
      ({ identifier }) => identifier,
    );

    assert.equal(selected.recipeVersion, "0.6.0");
    assert.equal(
      selectedIdentifiers.indexOf("section-composition") <
        selectedIdentifiers.indexOf("booking-calendly"),
      true,
    );
    assert.equal(selectedIdentifiers.at(-1), "booking-calendly");
    assert.deepEqual(core.createInstalledManifest(selected).at(-1), {
      identifier: "booking-calendly",
      version: "0.1.0",
      deliveryMode: "source-generated",
      stateClassifications: ["repository-stateful"],
      removalPolicy: "automatic",
    });
  }

  assert.deepEqual(core.createInstalledManifest(site), [
    {
      identifier: "standards",
      version: "0.2.0",
      deliveryMode: "hybrid",
      stateClassifications: ["repository-stateful"],
      removalPolicy: "reviewed",
    },
    {
      identifier: "content-files",
      version: "0.4.0",
      deliveryMode: "source-generated",
      stateClassifications: ["repository-stateful"],
      removalPolicy: "reviewed",
    },
    {
      identifier: "section-composition",
      version: "0.3.0",
      deliveryMode: "source-generated",
      stateClassifications: ["repository-stateful"],
      removalPolicy: "reviewed",
    },
    {
      identifier: "deployment-cloudflare",
      version: "0.2.0",
      deliveryMode: "hybrid",
      stateClassifications: ["repository-stateful", "external-stateful"],
      removalPolicy: "reviewed",
    },
    {
      identifier: "observability",
      version: "0.2.0",
      deliveryMode: "hybrid",
      stateClassifications: ["repository-stateful", "external-stateful"],
      removalPolicy: "reviewed",
    },
    {
      identifier: "site-routing",
      version: "0.3.0",
      deliveryMode: "source-generated",
      stateClassifications: ["repository-stateful"],
      removalPolicy: "reviewed",
    },
  ]);
});

test("resolution traverses dependency identifiers lexically rather than trusting descriptor order", () => {
  const catalog = createCatalog().map((capability) =>
    capability.identifier === "site-routing"
      ? {
          ...capability,
          dependencies: ["section-composition", "observability"],
        }
      : capability,
  );
  const siteOnlyProfile = {
    ...core.profileRecipes[1],
    defaultCapabilities: ["site-routing"],
  };
  const resolved = assertOk(
    resolveRequest({ profile: "site" }, catalog, [siteOnlyProfile]),
  );

  assert.deepEqual(
    resolved.capabilities.map(({ identifier }) => identifier),
    [
      "standards",
      "deployment-cloudflare",
      "observability",
      "content-files",
      "section-composition",
      "site-routing",
    ],
  );
});

test("resolution rejects unknown profiles and later-stage capability identifiers", () => {
  for (const identifier of ["app", "authenticated-app"]) {
    assertIssues(resolveRequest({ profile: identifier }), [
      {
        code: "PROFILE_UNKNOWN",
        path: ["profile"],
        context: { identifier },
      },
    ]);
  }

  for (const identifier of [
    "app-foundation",
    "application-persistence",
    "transactional-email-resend",
    "background-job-delivery",
    "durable-contact-submissions",
    "multilingual",
    "analytics",
    "cms-payload",
    "identity-core",
    "identity-google",
    "protected-area",
    "account-profile",
    "support-console",
    "identity-2fa",
    "identity-passkeys",
    "payments-stripe",
    "booking-webhooks",
  ]) {
    assertIssues(
      resolveRequest({
        profile: "portfolio",
        requestedCapabilities: [identifier],
      }),
      [
        {
          code: "CAPABILITY_UNKNOWN",
          path: ["requestedCapabilities", 0],
          context: { identifier },
        },
      ],
    );
  }
});

test("resolution validates catalogs and profile recipes before traversing them", () => {
  const catalog = createCatalog();

  assertIssues(
    resolveRequest(
      { profile: "portfolio" },
      [{ ...catalog[0], undeclaredMetadata: [] }, ...catalog.slice(1)],
    ),
    [
      {
        code: "CAPABILITY_CATALOG_INVALID",
        path: ["catalog", 0],
        context: { reason: "unrecognized_keys" },
      },
    ],
  );
  assertIssues(
    resolveRequest({ profile: "portfolio" }, [catalog[0], ...catalog]),
    [
      {
        code: "CAPABILITY_DUPLICATE",
        path: ["catalog", 1, "identifier"],
        context: { identifier: "standards" },
      },
    ],
  );
  assertIssues(
    resolveRequest({ profile: "portfolio" }, catalog, [
      { ...core.profileRecipes[0], schemaVersion: "2.0.0" },
      core.profileRecipes[1],
    ]),
    [
      {
        code: "PROFILE_CATALOG_INVALID",
        path: ["profiles", 0],
        context: { reason: "invalid_value" },
      },
    ],
  );
  assertIssues(
    resolveRequest({ profile: "portfolio" }, catalog, [
      core.profileRecipes[0],
      ...core.profileRecipes,
    ]),
    [
      {
        code: "PROFILE_DUPLICATE",
        path: ["profiles", 1, "identifier"],
        context: { identifier: "portfolio" },
      },
    ],
  );
});

test("resolution reports unsupported capabilities, missing dependencies, cycles, and conflicts", () => {
  const catalog = createCatalog();

  assertIssues(
    resolveRequest(
      { profile: "site" },
      catalog.map((capability) =>
        capability.identifier === "site-routing"
          ? { ...capability, supportedProfiles: ["portfolio"] }
          : capability,
      ),
    ),
    [
      {
        code: "CAPABILITY_UNSUPPORTED",
        path: ["capabilities", "site-routing"],
        context: { identifier: "site-routing", profile: "site" },
      },
    ],
  );

  assertIssues(
    resolveRequest(
      { profile: "portfolio" },
      catalog.map((capability) =>
        capability.identifier === "content-files"
          ? { ...capability, dependencies: ["missing-capability"] }
          : capability,
      ),
    ),
    [
      {
        code: "CAPABILITY_DEPENDENCY_MISSING",
        path: ["capabilities", "content-files", "dependencies", 0],
        context: {
          capability: "content-files",
          dependency: "missing-capability",
        },
      },
    ],
  );

  assertIssues(
    resolveRequest(
      { profile: "portfolio" },
      catalog.map((capability) => {
        if (capability.identifier === "standards") {
          return { ...capability, dependencies: ["content-files"] };
        }
        if (capability.identifier === "content-files") {
          return { ...capability, dependencies: ["standards"] };
        }
        return capability;
      }),
    ),
    [
      {
        code: "CAPABILITY_CYCLE",
        path: ["capabilities", "content-files", "dependencies"],
        context: { cycle: "standards,content-files,standards" },
      },
    ],
  );

  assertIssues(
    resolveRequest(
      { profile: "portfolio" },
      catalog.map((capability) =>
        capability.identifier === "content-files"
          ? { ...capability, conflicts: ["section-composition"] }
          : capability,
      ),
    ),
    [
      {
        code: "CAPABILITY_CONFLICT",
        path: ["capabilities", "content-files", "conflicts", 0],
        context: {
          capability: "content-files",
          conflict: "section-composition",
        },
      },
    ],
  );
});
