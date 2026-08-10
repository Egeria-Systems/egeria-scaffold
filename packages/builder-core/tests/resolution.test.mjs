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

test("the portfolio and site catalog declares the exact six executable capability contracts", async () => {
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
      version: "0.3.0",
      deliveryMode: "source-generated",
      stateClassifications: ["repository-stateful"],
      removalPolicy: "reviewed",
      dependencies: ["standards"],
      optionalIntegrations: [],
      conflicts: [],
      supportedProfiles: ["portfolio", "site"],
      requiredPackages: ["yaml"],
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
          identifier: "section-composition-home-route",
          owner: { kind: "capability", identifier: "section-composition" },
          path: "apps/web/app/page.tsx",
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
        { kind: "file", path: "apps/web/app/page.tsx" },
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
      version: "0.1.0",
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
      version: "0.1.0",
      deliveryMode: "hybrid",
      stateClassifications: ["repository-stateful", "external-stateful"],
      removalPolicy: "reviewed",
      dependencies: ["deployment-cloudflare"],
      optionalIntegrations: [],
      conflicts: [],
      supportedProfiles: ["portfolio", "site"],
      requiredPackages: ["@egeria-systems/observability"],
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
          identifier: "observability-registration",
          owner: { kind: "capability", identifier: "observability" },
          path:
            "apps/web/src/infrastructure/observability/installed-capability.ts",
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
          packageName: "@egeria-systems/observability",
          version: "4.5.6",
        },
        {
          kind: "file",
          path:
            "apps/web/src/infrastructure/observability/installed-capability.ts",
        },
      ],
      migrationPlanners: [],
      verificationPlan: ["package-resolution", "typecheck", "next-build"],
      documentationEvidenceRequirements: [
        "public-package-version-and-provenance",
        "analytics-separation",
      ],
      removalAndRecoveryRequirements: [
        "review-package-and-registration-removal",
      ],
    },
    {
      identifier: "site-routing",
      version: "0.2.0",
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
  ]);
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
    observability: "0.1.0",
  });
  assert.equal(Object.isFrozen(core.verifiedCapabilityPackageVersions), true);
  assert.throws(() => {
    core.verifiedCapabilityPackageVersions.standards = "9.9.9";
  }, TypeError);
  assert.equal(core.verifiedCapabilityPackageVersions.standards, "0.1.0");

  const catalog = assertOk(core.createVerifiedCapabilityCatalog());
  assert.equal(catalog.length, 6);
  assert.deepEqual(
    catalog.map(({ identifier }) => identifier),
    [
      "standards",
      "content-files",
      "section-composition",
      "deployment-cloudflare",
      "observability",
      "site-routing",
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
        version: "0.1.0",
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
      recipeVersion: "0.5.0",
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
      recipeVersion: "0.5.0",
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
  assert.equal(portfolio.recipeVersion, "0.5.0");
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
      version: "0.3.0",
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
      version: "0.1.0",
      deliveryMode: "hybrid",
      stateClassifications: ["repository-stateful", "external-stateful"],
      removalPolicy: "reviewed",
    },
    {
      identifier: "observability",
      version: "0.1.0",
      deliveryMode: "hybrid",
      stateClassifications: ["repository-stateful", "external-stateful"],
      removalPolicy: "reviewed",
    },
    {
      identifier: "site-routing",
      version: "0.2.0",
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
    "booking-calendly",
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
