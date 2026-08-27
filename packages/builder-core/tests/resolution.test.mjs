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

test("standards hybrid ownership declares generated unit, component, browser, and visual quality", () => {
  const standards = createCatalog().find(
    ({ identifier }) => identifier === "standards",
  );

  assert.notEqual(standards, undefined);
  assert.equal(standards.version, "0.4.0");
  assert.equal(standards.deliveryMode, "hybrid");
  assert.deepEqual(standards.requiredPackages, [
    "@axe-core/playwright",
    "@egeria-systems/standards",
    "@playwright/test",
    "@testing-library/dom",
    "@testing-library/jest-dom",
    "@testing-library/react",
    "@testing-library/user-event",
    "@vitejs/plugin-react",
    "jsdom",
    "vitest",
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
    "test-process-execution",
  ]);
  assert.equal(standards.threatReviewLevel, "elevated");
  assert.deepEqual(
    standards.managedSurfaces.map(({ identifier }) => identifier).toSorted(),
    [
      "standards-axe-playwright-package",
      "standards-browser-install-ci-script",
      "standards-browser-install-script",
      "standards-browser-quality-specification",
      "standards-component-test-script",
      "standards-component-test-setup",
      "standards-component-test-specification",
      "standards-component-watch-script",
      "standards-deployed-browser-test-script",
      "standards-development-browser-test-script",
      "standards-dom-testing-library-package",
      "standards-eslint-configuration",
      "standards-jest-dom-package",
      "standards-jsdom-package",
      "standards-playwright-deployed-configuration",
      "standards-playwright-development-configuration",
      "standards-playwright-package",
      "standards-playwright-preview-configuration",
      "standards-playwright-shared-configuration",
      "standards-playwright-visual-configuration",
      "standards-preview-browser-test-script",
      "standards-package",
      "standards-quality-workflow",
      "standards-react-testing-library-package",
      "standards-test-script",
      "standards-test-watch-script",
      "standards-typescript-configuration",
      "standards-unit-test-script",
      "standards-unit-test-specification",
      "standards-unit-watch-script",
      "standards-user-event-package",
      "standards-vite-react-package",
      "standards-visual-regression-desktop-baseline",
      "standards-visual-regression-mobile-baseline",
      "standards-visual-regression-specification",
      "standards-visual-regression-test-script",
      "standards-vitest-configuration",
      "standards-vitest-package",
    ].toSorted(),
  );
  assert.equal(standards.inferenceProbes.length, 36);
  const visualSurfaces = new Map(
    standards.managedSurfaces
      .filter(({ identifier }) => identifier.includes("visual"))
      .toSorted((left, right) =>
        left.identifier < right.identifier
          ? -1
          : left.identifier > right.identifier
            ? 1
            : 0,
      )
      .map((surface) => [surface.identifier, surface]),
  );
  assert.deepEqual(
    [...visualSurfaces].map(([identifier, surface]) => ({
      identifier,
      path: surface.path,
      ownership: surface.ownership,
      target: surface.fingerprintTarget,
    })),
    [
      {
        identifier: "standards-playwright-visual-configuration",
        path: "apps/web/playwright.visual.config.ts",
        ownership: "managed",
        target: { kind: "file" },
      },
      {
        identifier: "standards-visual-regression-desktop-baseline",
        path:
          "apps/web/tests/visual/home-visual.spec.ts-snapshots/home-desktop-chromium-linux.png",
        ownership: "application-owned",
        target: { kind: "file" },
      },
      {
        identifier: "standards-visual-regression-mobile-baseline",
        path:
          "apps/web/tests/visual/home-visual.spec.ts-snapshots/home-mobile-chromium-linux.png",
        ownership: "application-owned",
        target: { kind: "file" },
      },
      {
        identifier: "standards-visual-regression-specification",
        path: "apps/web/tests/visual/home-visual.spec.ts",
        ownership: "application-owned",
        target: { kind: "file" },
      },
      {
        identifier: "standards-visual-regression-test-script",
        path: "apps/web/package.json",
        ownership: "merge-managed",
        target: { kind: "json-value", pointer: "/scripts/test:visual" },
      },
    ],
  );
  assert.deepEqual(standards.verificationPlan, [
    "package-resolution",
    "lint",
    "typecheck",
    "unit-tests",
    "component-tests",
    "browser-development",
    "browser-preview",
    "deployed-configuration",
    "visual-regression",
    "workflow-contracts",
  ]);
  assert.deepEqual(standards.documentationEvidenceRequirements, [
    "public-package-version-and-provenance",
    "unit-and-component-testing-claim-boundaries",
    "browser-testing-claim-boundaries",
    "visual-regression-baseline-and-claim-boundaries",
  ]);
  assert.deepEqual(standards.removalAndRecoveryRequirements, [
    "review-package-and-configuration-removal",
    "review-generated-test-surface-removal",
    "review-generated-quality-surface-removal",
    "review-visual-regression-configuration-and-baselines",
  ]);
});

test("the portfolio and site catalog preserves the existing seven executable capability contracts", async () => {
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

  assert.deepEqual(catalog.slice(1, 7), [
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
      version: "0.3.0",
      deliveryMode: "hybrid",
      stateClassifications: ["repository-stateful", "external-stateful"],
      removalPolicy: "reviewed",
      dependencies: ["standards"],
      optionalIntegrations: [],
      conflicts: [],
      supportedProfiles: ["portfolio", "site"],
      requiredPackages: ["@opennextjs/cloudflare", "wrangler"],
      environmentVariables: ["DEPLOY_URL"],
      secrets: ["CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_API_TOKEN"],
      platformResources: ["cloudflare-worker", "cloudflare-static-assets"],
      externalDomains: [],
      contentSecurityPolicyContributions: [],
      browserStorage: [],
      dataClassifications: [],
      retentionAssumptions: [],
      privilegedOperations: ["cloudflare-worker-deployment"],
      threatReviewLevel: "elevated",
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
          identifier: "deployment-cloudflare-workflow",
          owner: { kind: "capability", identifier: "deployment-cloudflare" },
          path: ".github/workflows/deploy.yml",
          ownership: "managed",
          fingerprintTarget: { kind: "file" },
          mergeStrategy: "replace-file",
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
        { kind: "file", path: ".github/workflows/deploy.yml" },
        { kind: "file", path: "apps/web/next.config.ts" },
        { kind: "file", path: "apps/web/open-next.config.ts" },
        { kind: "file", path: "apps/web/wrangler.jsonc" },
      ],
      migrationPlanners: [],
      verificationPlan: [
        "next-build",
        "opennext-build",
        "wrangler-types",
        "deployment-workflow-contracts",
        "browser-deployed",
      ],
      documentationEvidenceRequirements: [
        "nextjs-opennext-cloudflare-compatibility",
        "deployment-authority-and-claim-boundaries",
      ],
      removalAndRecoveryRequirements: [
        "review-deployment-source-and-provider-state-separately",
        "revoke-or-rotate-deployment-credentials-separately",
      ],
    },
    {
      identifier: "observability",
      version: "0.3.0",
      deliveryMode: "hybrid",
      stateClassifications: ["repository-stateful", "external-stateful"],
      removalPolicy: "reviewed",
      dependencies: [
        "content-files",
        "deployment-cloudflare",
        "section-composition",
      ],
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
      dataClassifications: [
        "bounded-operational-telemetry",
        "provider-platform-error-and-exception-logs",
        "restricted-error-diagnostics",
      ],
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
        "separate-operational-and-diagnostic-sinks",
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
        {
          identifier: "observability-page-error-boundary",
          owner: { kind: "capability", identifier: "observability" },
          path: "apps/web/app/error.tsx",
          ownership: "application-owned",
          fingerprintTarget: { kind: "file" },
          mergeStrategy: "replace-file",
        },
        {
          identifier: "observability-global-error-boundary",
          owner: { kind: "capability", identifier: "observability" },
          path: "apps/web/app/global-error.tsx",
          ownership: "application-owned",
          fingerprintTarget: { kind: "file" },
          mergeStrategy: "replace-file",
        },
        {
          identifier: "observability-error-copy-source",
          owner: { kind: "capability", identifier: "observability" },
          path: "apps/web/content/en-CA/observability.yaml",
          ownership: "application-owned",
          fingerprintTarget: { kind: "file" },
          mergeStrategy: "replace-file",
        },
        {
          identifier: "observability-error-copy",
          owner: { kind: "capability", identifier: "observability" },
          path: "apps/web/src/infrastructure/observability/error-copy.ts",
          ownership: "application-owned",
          fingerprintTarget: { kind: "file" },
          mergeStrategy: "replace-file",
        },
        {
          identifier: "observability-error-fallback",
          owner: { kind: "capability", identifier: "observability" },
          path: "apps/web/src/presentation/error-fallback.tsx",
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
        { kind: "file", path: "apps/web/app/error.tsx" },
        { kind: "file", path: "apps/web/app/global-error.tsx" },
        {
          kind: "file",
          path: "apps/web/content/en-CA/observability.yaml",
        },
        {
          kind: "file",
          path: "apps/web/src/infrastructure/observability/error-copy.ts",
        },
        {
          kind: "file",
          path: "apps/web/src/presentation/error-fallback.tsx",
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
      version: "0.4.0",
      deliveryMode: "source-generated",
      stateClassifications: ["repository-stateful"],
      removalPolicy: "reviewed",
      dependencies: ["content-files", "observability", "section-composition"],
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
        ...[
          ["site-routing-not-found-route", "apps/web/app/not-found.tsx"],
          ["site-routing-robots-route", "apps/web/app/robots.ts"],
          ["site-routing-sitemap-route", "apps/web/app/sitemap.ts"],
          ["site-routing-work-error-boundary", "apps/web/app/work/error.tsx"],
          ["site-routing-work-index-route", "apps/web/app/work/page.tsx"],
          [
            "site-routing-featured-work-route",
            "apps/web/app/work/featured/page.tsx",
          ],
          [
            "site-routing-not-found-content",
            "apps/web/content/en-CA/not-found.yaml",
          ],
          [
            "site-routing-configuration-content",
            "apps/web/content/en-CA/routing.yaml",
          ],
          [
            "site-routing-featured-work-content",
            "apps/web/content/en-CA/work-featured.yaml",
          ],
          [
            "site-routing-content-reader",
            "apps/web/src/routing/read-routing-content.ts",
          ],
          [
            "site-routing-content-schema",
            "apps/web/src/routing/routing-content-schema.ts",
          ],
          ["site-routing-presentation", "apps/web/src/routing/site-page.tsx"],
          [
            "site-routing-component-test",
            "apps/web/tests/component/site-page.test.tsx",
          ],
          [
            "site-routing-browser-test",
            "apps/web/tests/e2e/site-routing.spec.ts",
          ],
          [
            "site-routing-unit-test",
            "apps/web/tests/unit/routing-content.test.ts",
          ],
        ].map(([identifier, path]) => ({
          identifier,
          owner: { kind: "capability", identifier: "site-routing" },
          path,
          ownership: "application-owned",
          fingerprintTarget: { kind: "file" },
          mergeStrategy: "replace-file",
        })),
      ],
      inferenceProbes: [
        { kind: "file", path: "apps/web/app/about/page.tsx" },
        { kind: "file", path: "apps/web/content/en-CA/about.yaml" },
        ...[
          "apps/web/app/not-found.tsx",
          "apps/web/app/robots.ts",
          "apps/web/app/sitemap.ts",
          "apps/web/app/work/error.tsx",
          "apps/web/app/work/page.tsx",
          "apps/web/app/work/featured/page.tsx",
          "apps/web/content/en-CA/not-found.yaml",
          "apps/web/content/en-CA/routing.yaml",
          "apps/web/content/en-CA/work-featured.yaml",
          "apps/web/src/routing/read-routing-content.ts",
          "apps/web/src/routing/routing-content-schema.ts",
          "apps/web/src/routing/site-page.tsx",
          "apps/web/tests/component/site-page.test.tsx",
          "apps/web/tests/e2e/site-routing.spec.ts",
          "apps/web/tests/unit/routing-content.test.ts",
        ].map((path) => ({ kind: "file", path })),
      ],
      migrationPlanners: ["upgrade-site-routing-0-3-0-to-0-4-0"],
      verificationPlan: [
        "content-contracts",
        "component-tests",
        "typecheck",
        "next-build",
        "opennext-build",
        "browser-development",
        "browser-preview",
      ],
      documentationEvidenceRequirements: [
        "browser-route-and-navigation-behavior",
        "crawl-metadata-contract",
        "nested-error-and-not-found-behavior",
        "page-and-navigation-migration-contract",
      ],
      removalAndRecoveryRequirements: [
        "review-route-content-and-crawl-metadata-removal",
        "review-redirect-and-navigation-recovery",
      ],
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

test("the catalog declares the exact multilingual capability contract", () => {
  const multilingual = createCatalog().find(
    ({ identifier }) => identifier === "multilingual",
  );

  assert.deepEqual(multilingual, {
    identifier: "multilingual",
    version: "0.1.0",
    deliveryMode: "source-generated",
    stateClassifications: ["repository-stateful"],
    removalPolicy: "reviewed",
    dependencies: ["content-files", "observability", "section-composition"],
    optionalIntegrations: ["booking-calendly", "site-routing"],
    conflicts: [],
    supportedProfiles: ["portfolio", "site"],
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
      ...[
        ["multilingual-locale-middleware", "apps/web/middleware.ts", "managed"],
        [
          "multilingual-locale-layout",
          "apps/web/app/[locale]/layout.tsx",
          "managed",
        ],
        [
          "multilingual-localized-route",
          "apps/web/app/[locale]/[[...segments]]/page.tsx",
          "managed",
        ],
        [
          "multilingual-localized-not-found",
          "apps/web/app/[locale]/not-found.tsx",
          "managed",
        ],
        [
          "multilingual-default-locale-content",
          "apps/web/content/en-CA/localized-content.yaml",
          "application-owned",
        ],
        [
          "multilingual-french-locale-content",
          "apps/web/content/fr-CA/localized-content.yaml",
          "application-owned",
        ],
        ["multilingual-locale-contract", "apps/web/src/i18n/locale.ts", "managed"],
        [
          "multilingual-profile-routes",
          "apps/web/src/i18n/localized-profile.ts",
          "managed",
        ],
        [
          "multilingual-content-contract",
          "apps/web/src/i18n/localized-content.ts",
          "managed",
        ],
        [
          "multilingual-content-reader",
          "apps/web/src/i18n/read-localized-content.ts",
          "managed",
        ],
        [
          "multilingual-page-presentation",
          "apps/web/src/presentation/localized-page.tsx",
          "managed",
        ],
        [
          "multilingual-booking-composition",
          "apps/web/src/integrations/booking/localized-booking.tsx",
          "managed",
        ],
        [
          "multilingual-component-specification",
          "apps/web/tests/component/multilingual-page.test.tsx",
          "managed",
        ],
        [
          "multilingual-browser-specification",
          "apps/web/tests/e2e/multilingual-routing.spec.ts",
          "managed",
        ],
        [
          "multilingual-locale-unit-specification",
          "apps/web/tests/unit/locale.test.ts",
          "managed",
        ],
        [
          "multilingual-content-unit-specification",
          "apps/web/tests/unit/localized-content.test.ts",
          "managed",
        ],
      ].map(([identifier, path, ownership]) => ({
        identifier,
        owner: { kind: "capability", identifier: "multilingual" },
        path,
        ownership,
        fingerprintTarget: { kind: "file" },
        mergeStrategy: "replace-file",
      })),
    ],
    inferenceProbes: [
      ...[
        "apps/web/middleware.ts",
        "apps/web/app/[locale]/layout.tsx",
        "apps/web/app/[locale]/[[...segments]]/page.tsx",
        "apps/web/app/[locale]/not-found.tsx",
        "apps/web/content/en-CA/localized-content.yaml",
        "apps/web/content/fr-CA/localized-content.yaml",
        "apps/web/src/i18n/locale.ts",
        "apps/web/src/i18n/localized-profile.ts",
        "apps/web/src/i18n/localized-content.ts",
        "apps/web/src/i18n/read-localized-content.ts",
        "apps/web/src/presentation/localized-page.tsx",
        "apps/web/src/integrations/booking/localized-booking.tsx",
        "apps/web/tests/component/multilingual-page.test.tsx",
        "apps/web/tests/e2e/multilingual-routing.spec.ts",
        "apps/web/tests/unit/locale.test.ts",
        "apps/web/tests/unit/localized-content.test.ts",
      ].map((path) => ({ kind: "file", path })),
    ],
    migrationPlanners: [
      "add-multilingual-0-1-0",
      "remove-multilingual-0-1-0",
    ],
    verificationPlan: [
      "locale-contracts",
      "content-contracts",
      "component-tests",
      "typecheck",
      "next-build",
      "opennext-build",
      "browser-development",
      "browser-preview",
    ],
    documentationEvidenceRequirements: [
      "locale-prefixed-routing-and-negotiation-contract",
      "translation-parity-and-exact-key-contract",
      "localized-navigation-metadata-and-discovery-contract",
      "human-translation-review-boundary",
    ],
    removalAndRecoveryRequirements: [
      "review-application-owned-locale-catalog-preservation",
      "restore-single-locale-routing-and-discovery-surfaces",
      "verify-closed-booking-and-multilingual-lifecycle",
    ],
  });
});

test("the catalog declares the exact analytics capability contract without observability coupling", () => {
  const analytics = createCatalog().find(
    ({ identifier }) => identifier === "analytics",
  );

  assert.notEqual(analytics, undefined);
  assert.equal(analytics.version, "0.1.0");
  assert.equal(analytics.deliveryMode, "hybrid");
  assert.deepEqual(analytics.stateClassifications, [
    "repository-stateful",
    "external-stateful",
  ]);
  assert.equal(analytics.removalPolicy, "reviewed");
  assert.deepEqual(analytics.dependencies, ["content-files", "section-composition"]);
  assert.deepEqual(analytics.optionalIntegrations, ["multilingual", "site-routing"]);
  assert.equal(analytics.dependencies.includes("observability"), false);
  assert.deepEqual(analytics.supportedProfiles, ["portfolio", "site"]);
  assert.deepEqual(analytics.requiredPackages, []);
  assert.deepEqual(analytics.environmentVariables, []);
  assert.deepEqual(analytics.secrets, []);
  assert.deepEqual(analytics.platformResources, [
    "cloudflare-web-analytics-site",
    "google-analytics-4-property-and-web-stream",
    "google-search-console-property",
    "looker-studio-report",
    "microsoft-clarity-project",
  ]);
  assert.deepEqual(analytics.externalDomains, [
    "*.clarity.ms",
    "analytics.google.com",
    "c.bing.com",
    "cloudflareinsights.com",
    "region1.google-analytics.com",
    "static.cloudflareinsights.com",
    "www.clarity.ms",
    "www.google-analytics.com",
    "www.googletagmanager.com",
  ]);
  assert.deepEqual(analytics.contentSecurityPolicyContributions, [
    "script-src https://static.cloudflareinsights.com https://www.googletagmanager.com https://www.clarity.ms https://*.clarity.ms",
    "connect-src https://cloudflareinsights.com https://www.google-analytics.com https://region1.google-analytics.com https://analytics.google.com https://www.clarity.ms https://*.clarity.ms https://c.bing.com",
  ]);
  assert.deepEqual(analytics.browserStorage, [
    "functional-consent-local-storage",
    "cloudflare-web-analytics-cookie-free",
    "google-analytics-first-party-cookies-_ga-and-_ga_<container-id>",
    "microsoft-clarity-first-party-cookies-_clck-and-_clsk",
    "provider-controlled-third-party-storage",
  ]);
  assert.deepEqual(analytics.dataClassifications, [
    "aggregate-traffic-and-performance-data",
    "audience-measurement-data",
    "consented-experience-and-interaction-data",
    "public-provider-identifiers",
  ]);
  assert.deepEqual(analytics.retentionAssumptions, [
    "cloudflare-provider-controlled-retention",
    "google-provider-controlled-retention",
    "microsoft-provider-controlled-retention",
  ]);
  assert.deepEqual(analytics.privilegedOperations, [
    "provider-account-and-property-configuration",
    "provider-data-access-and-deletion",
    "provider-resource-removal",
  ]);
  assert.equal(analytics.threatReviewLevel, "elevated");
  assert.deepEqual(analytics.adapterSemanticRequirements, [
    "deny-provider-load-before-explicit-grant",
    "deduplicate-provider-loaders-and-navigation-measurement",
    "emit-search-console-verification-metadata-only",
    "keep-advertising-signals-denied",
    "withdraw-consent-clear-accessible-cookies-and-reload",
  ]);
  assert.deepEqual(
    analytics.managedSurfaces.map(({ identifier, path, ownership }) => [
      identifier,
      path,
      ownership,
    ]),
    [
      ["analytics-settings", "apps/web/src/integrations/analytics/analytics-settings.ts", "managed"],
      ["analytics-provider-contract", "apps/web/src/integrations/analytics/analytics-provider-contract.ts", "managed"],
      ["analytics-runtime", "apps/web/src/integrations/analytics/analytics-runtime.ts", "managed"],
      ["analytics-content-reader", "apps/web/src/integrations/analytics/analytics-content.ts", "managed"],
      ["analytics-consent-control", "apps/web/src/integrations/analytics/analytics-consent.tsx", "managed"],
      ["analytics-default-locale-content", "apps/web/content/en-CA/analytics.yaml", "application-owned"],
      ["analytics-french-locale-content", "apps/web/content/fr-CA/analytics.yaml", "application-owned"],
      ["analytics-operator-guide", "docs/analytics.md", "application-owned"],
      ["analytics-provider-contract-specification", "apps/web/tests/unit/analytics-provider-contract.test.ts", "managed"],
      ["analytics-consent-component-specification", "apps/web/tests/component/analytics-consent.test.tsx", "managed"],
      ["analytics-browser-specification", "apps/web/tests/e2e/analytics-consent.spec.ts", "managed"],
    ],
  );
  assert.deepEqual(
    analytics.inferenceProbes,
    analytics.managedSurfaces.map(({ path }) => ({ kind: "file", path })),
  );
  assert.deepEqual(analytics.migrationPlanners, [
    "add-analytics-0-1-0",
    "remove-analytics-0-1-0",
  ]);
  assert.deepEqual(analytics.verificationPlan, [
    "settings-contracts",
    "provider-contracts",
    "content-contracts",
    "component-tests",
    "typecheck",
    "next-build",
    "opennext-build",
    "browser-development",
    "browser-preview",
  ]);
  assert.deepEqual(analytics.documentationEvidenceRequirements, [
    "consent-purpose-and-withdrawal-contract",
    "provider-domain-csp-storage-cookie-data-and-retention-boundary",
    "provider-account-and-retained-data-lifecycle-boundary",
    "provider-identifiers-are-public-not-secrets",
  ]);
  assert.deepEqual(analytics.removalAndRecoveryRequirements, [
    "review-application-owned-copy-and-operator-guide-preservation",
    "review-provider-account-retained-data-storage-and-cookie-disposition",
    "restore-non-analytics-layout-and-remove-unchanged-owned-surfaces",
    "verify-closed-analytics-and-multilingual-lifecycle",
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
    observability: "0.3.0",
  });
  assert.equal(Object.isFrozen(core.verifiedCapabilityPackageVersions), true);
  assert.throws(() => {
    core.verifiedCapabilityPackageVersions.standards = "9.9.9";
  }, TypeError);
  assert.equal(core.verifiedCapabilityPackageVersions.standards, "0.1.0");

  const catalog = assertOk(core.createVerifiedCapabilityCatalog());
  assert.equal(catalog.length, 9);
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
      "multilingual",
      "analytics",
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
        version: "0.3.0",
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
      recipeVersion: "0.10.0",
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
      recipeVersion: "0.11.0",
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
  assert.equal(portfolio.recipeVersion, "0.10.0");
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

    assert.equal(
      selected.recipeVersion,
      profile === "portfolio" ? "0.10.0" : "0.11.0",
    );
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

  for (const profile of ["portfolio", "site"]) {
    const selected = assertOk(
      resolveRequest({ profile, requestedCapabilities: ["multilingual"] }),
    );
    const identifiers = selected.capabilities.map(({ identifier }) => identifier);

    assert.equal(identifiers.includes("multilingual"), true);
    for (const dependency of [
      "content-files",
      "observability",
      "section-composition",
    ]) {
      assert.equal(
        identifiers.indexOf(dependency) < identifiers.indexOf("multilingual"),
        true,
      );
    }
    assert.deepEqual(core.createInstalledManifest(selected).at(-1), {
      identifier: "multilingual",
      version: "0.1.0",
      deliveryMode: "source-generated",
      stateClassifications: ["repository-stateful"],
      removalPolicy: "reviewed",
    });
  }

  assert.deepEqual(core.createInstalledManifest(site), [
    {
      identifier: "standards",
      version: "0.4.0",
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
      version: "0.3.0",
      deliveryMode: "hybrid",
      stateClassifications: ["repository-stateful", "external-stateful"],
      removalPolicy: "reviewed",
    },
    {
      identifier: "observability",
      version: "0.3.0",
      deliveryMode: "hybrid",
      stateClassifications: ["repository-stateful", "external-stateful"],
      removalPolicy: "reviewed",
    },
    {
      identifier: "site-routing",
      version: "0.4.0",
      deliveryMode: "source-generated",
      stateClassifications: ["repository-stateful"],
      removalPolicy: "reviewed",
    },
  ]);
});

test("current public recipes advance only the production site subject", () => {
  assert.deepEqual(
    core.profileRecipes.map(({ identifier, recipeVersion }) => ({
      identifier,
      recipeVersion,
    })),
    [
      { identifier: "portfolio", recipeVersion: "0.10.0" },
      { identifier: "site", recipeVersion: "0.11.0" },
    ],
  );

  const currentSiteRouting = createCatalog().find(
    ({ identifier }) => identifier === "site-routing",
  );
  assert.equal(currentSiteRouting?.version, "0.4.0");
  assert.deepEqual(currentSiteRouting?.migrationPlanners, [
    "upgrade-site-routing-0-3-0-to-0-4-0",
  ]);

  const historicalCatalog = assertOk(
    core.createCapabilityCatalogSnapshot(packageVersions, {
      standards: "0.4.0",
      siteRouting: "0.3.0",
    }),
  );
  assert.equal(
    historicalCatalog.find(({ identifier }) => identifier === "site-routing")
      ?.version,
    "0.3.0",
  );
  assert.deepEqual(core.createProfileRecipeSnapshot("0.10.0"), [
    { ...core.profileRecipes[0], recipeVersion: "0.10.0" },
    { ...core.profileRecipes[1], recipeVersion: "0.10.0" },
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
      "content-files",
      "deployment-cloudflare",
      "section-composition",
      "observability",
      "site-routing",
    ],
  );
});

test("resolution rejects unknown profiles and capability identifiers without implementations", () => {
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
