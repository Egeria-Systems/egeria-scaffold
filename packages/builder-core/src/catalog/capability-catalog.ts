import {
  capabilityDescriptorSchema,
  type CapabilityDescriptor,
  type InferenceProbe,
  type ManagedSurfaceDescriptor,
} from "../contracts/capability.js";
import { semanticVersionSchema } from "../contracts/identifiers.js";
import type {
  ContractIssue,
  ValidationResult,
} from "../contracts/result.js";
import {
  createFileSurfaceDescriptor,
  createJsonValueSurfaceDescriptor,
} from "../contracts/surface-target.js";

export type CapabilityPackageVersions = Readonly<{
  standards: string;
  observability: string;
}>;

const sharedCapabilityMetadata = {
  optionalIntegrations: [],
  conflicts: [],
  environmentVariables: [],
  secrets: [],
  externalDomains: [],
  contentSecurityPolicyContributions: [],
  browserStorage: [],
  dataClassifications: [],
  retentionAssumptions: [],
  privilegedOperations: [],
  threatReviewLevel: "standard",
  migrationPlanners: [],
} as const;

function createFileSurface(
  identifier: string,
  capability: string,
  path: string,
  ownership: "managed" | "application-owned",
): ManagedSurfaceDescriptor {
  return createFileSurfaceDescriptor({
    identifier,
    owner: { kind: "capability", identifier: capability },
    path,
    ownership,
  });
}

function createPackageSurface(
  identifier: string,
  capability: string,
  pointer: string,
): ManagedSurfaceDescriptor {
  return createJsonValueSurfaceDescriptor(
    {
      identifier,
      owner: { kind: "capability", identifier: capability },
      path: "apps/web/package.json",
      ownership: "merge-managed",
    },
    pointer,
  );
}

function createFileProbe(path: string): InferenceProbe {
  return { kind: "file", path };
}

function createPackageProbe(
  section: "dependencies" | "devDependencies",
  packageName: string,
  version: string,
): InferenceProbe {
  return {
    kind: "package",
    path: "apps/web/package.json",
    section,
    packageName,
    version,
  };
}

function createJsonValueProbe(
  path: string,
  pointer: string,
  expected: string | boolean | number,
): InferenceProbe {
  return {
    kind: "json-value",
    path,
    pointer,
    expected,
  };
}

type CapabilityEvidencePoint = Readonly<{
  managedSurface: ManagedSurfaceDescriptor;
  inferenceProbe: InferenceProbe;
}>;

function createFileEvidencePoint(
  identifier: string,
  capability: string,
  path: string,
  ownership: "managed" | "application-owned",
): CapabilityEvidencePoint {
  return {
    managedSurface: createFileSurface(identifier, capability, path, ownership),
    inferenceProbe: createFileProbe(path),
  };
}

function encodeJsonPointerSegment(value: string): string {
  return value.replaceAll("~", "~0").replaceAll("/", "~1");
}

function createPackageEvidencePoint(
  identifier: string,
  capability: string,
  section: "dependencies" | "devDependencies",
  packageName: string,
  version: string,
): CapabilityEvidencePoint {
  return {
    managedSurface: createPackageSurface(
      identifier,
      capability,
      `/${section}/${encodeJsonPointerSegment(packageName)}`,
    ),
    inferenceProbe: createPackageProbe(section, packageName, version),
  };
}

function createPackageJsonValueEvidencePoint(
  identifier: string,
  capability: string,
  pointer: string,
  expected: string | boolean | number,
): CapabilityEvidencePoint {
  return {
    managedSurface: createPackageSurface(identifier, capability, pointer),
    inferenceProbe: createJsonValueProbe(
      "apps/web/package.json",
      pointer,
      expected,
    ),
  };
}

function projectManagedSurfaces(
  evidencePoints: readonly CapabilityEvidencePoint[],
): readonly ManagedSurfaceDescriptor[] {
  return evidencePoints.map(({ managedSurface }) => managedSurface);
}

function projectInferenceProbes(
  evidencePoints: readonly CapabilityEvidencePoint[],
): readonly InferenceProbe[] {
  return evidencePoints.map(({ inferenceProbe }) => inferenceProbe);
}

function projectEvidencePoints(
  evidencePoints: readonly CapabilityEvidencePoint[],
): Readonly<{
  managedSurfaces: readonly ManagedSurfaceDescriptor[];
  inferenceProbes: readonly InferenceProbe[];
}> {
  return {
    managedSurfaces: projectManagedSurfaces(evidencePoints),
    inferenceProbes: projectInferenceProbes(evidencePoints),
  };
}

function createDescriptors(
  packageVersions: CapabilityPackageVersions,
): readonly CapabilityDescriptor[] {
  const standardsEvidencePoints = [
    createPackageEvidencePoint(
      "standards-axe-playwright-package",
      "standards",
      "devDependencies",
      "@axe-core/playwright",
      "4.12.1",
    ),
    createPackageJsonValueEvidencePoint(
      "standards-browser-install-ci-script",
      "standards",
      "/scripts/browser:install:ci",
      "playwright install --with-deps chromium",
    ),
    createPackageJsonValueEvidencePoint(
      "standards-browser-install-script",
      "standards",
      "/scripts/browser:install",
      "playwright install chromium",
    ),
    createPackageJsonValueEvidencePoint(
      "standards-component-test-script",
      "standards",
      "/scripts/test:component",
      "vitest run --project component",
    ),
    createFileEvidencePoint(
      "standards-component-test-setup",
      "standards",
      "apps/web/tests/setup/component.ts",
      "managed",
    ),
    createFileEvidencePoint(
      "standards-component-test-specification",
      "standards",
      "apps/web/tests/component/content-page.test.tsx",
      "application-owned",
    ),
    createPackageJsonValueEvidencePoint(
      "standards-component-watch-script",
      "standards",
      "/scripts/test:component:watch",
      "vitest --project component",
    ),
    createFileEvidencePoint(
      "standards-browser-quality-specification",
      "standards",
      "apps/web/tests/e2e/site-quality.spec.ts",
      "application-owned",
    ),
    createPackageJsonValueEvidencePoint(
      "standards-deployed-browser-test-script",
      "standards",
      "/scripts/test:e2e:deployed",
      "playwright test --config playwright.deployed.config.ts",
    ),
    createPackageJsonValueEvidencePoint(
      "standards-development-browser-test-script",
      "standards",
      "/scripts/test:e2e:dev",
      "playwright test --config playwright.dev.config.ts",
    ),
    createPackageEvidencePoint(
      "standards-dom-testing-library-package",
      "standards",
      "devDependencies",
      "@testing-library/dom",
      "10.4.1",
    ),
    createFileEvidencePoint(
      "standards-eslint-configuration",
      "standards",
      "apps/web/eslint.config.mjs",
      "managed",
    ),
    createPackageEvidencePoint(
      "standards-jest-dom-package",
      "standards",
      "devDependencies",
      "@testing-library/jest-dom",
      "7.0.1",
    ),
    createPackageEvidencePoint(
      "standards-jsdom-package",
      "standards",
      "devDependencies",
      "jsdom",
      "30.0.1",
    ),
    createPackageEvidencePoint(
      "standards-package",
      "standards",
      "devDependencies",
      "@egeria-systems/standards",
      packageVersions.standards,
    ),
    createFileEvidencePoint(
      "standards-playwright-deployed-configuration",
      "standards",
      "apps/web/playwright.deployed.config.ts",
      "managed",
    ),
    createFileEvidencePoint(
      "standards-playwright-development-configuration",
      "standards",
      "apps/web/playwright.dev.config.ts",
      "managed",
    ),
    createPackageEvidencePoint(
      "standards-playwright-package",
      "standards",
      "devDependencies",
      "@playwright/test",
      "1.62.1",
    ),
    createFileEvidencePoint(
      "standards-playwright-preview-configuration",
      "standards",
      "apps/web/playwright.preview.config.ts",
      "managed",
    ),
    createFileEvidencePoint(
      "standards-playwright-shared-configuration",
      "standards",
      "apps/web/playwright.config.shared.ts",
      "managed",
    ),
    createPackageJsonValueEvidencePoint(
      "standards-preview-browser-test-script",
      "standards",
      "/scripts/test:e2e:preview",
      "playwright test --config playwright.preview.config.ts",
    ),
    createFileEvidencePoint(
      "standards-quality-workflow",
      "standards",
      ".github/workflows/quality.yml",
      "managed",
    ),
    createPackageEvidencePoint(
      "standards-react-testing-library-package",
      "standards",
      "devDependencies",
      "@testing-library/react",
      "16.3.2",
    ),
    createPackageJsonValueEvidencePoint(
      "standards-test-script",
      "standards",
      "/scripts/test",
      "vitest run",
    ),
    createPackageJsonValueEvidencePoint(
      "standards-test-watch-script",
      "standards",
      "/scripts/test:watch",
      "vitest",
    ),
    createFileEvidencePoint(
      "standards-typescript-configuration",
      "standards",
      "apps/web/tsconfig.json",
      "managed",
    ),
    createPackageJsonValueEvidencePoint(
      "standards-unit-test-script",
      "standards",
      "/scripts/test:unit",
      "vitest run --project unit",
    ),
    createFileEvidencePoint(
      "standards-unit-test-specification",
      "standards",
      "apps/web/tests/unit/content-schema.test.ts",
      "application-owned",
    ),
    createPackageJsonValueEvidencePoint(
      "standards-unit-watch-script",
      "standards",
      "/scripts/test:unit:watch",
      "vitest --project unit",
    ),
    createPackageEvidencePoint(
      "standards-user-event-package",
      "standards",
      "devDependencies",
      "@testing-library/user-event",
      "14.6.3",
    ),
    createPackageEvidencePoint(
      "standards-vite-react-package",
      "standards",
      "devDependencies",
      "@vitejs/plugin-react",
      "6.0.5",
    ),
    createFileEvidencePoint(
      "standards-vitest-configuration",
      "standards",
      "apps/web/vitest.config.ts",
      "managed",
    ),
    createPackageEvidencePoint(
      "standards-vitest-package",
      "standards",
      "devDependencies",
      "vitest",
      "4.1.10",
    ),
  ] as const;

  const contentFilesEvidencePoints = [
    createPackageEvidencePoint(
      "content-files-raw-loader-package",
      "content-files",
      "devDependencies",
      "raw-loader",
      "4.0.2",
    ),
    createPackageEvidencePoint(
      "content-files-yaml-package",
      "content-files",
      "dependencies",
      "yaml",
      "2.9.0",
    ),
    createFileEvidencePoint(
      "content-files-configuration",
      "content-files",
      "apps/web/content/content.config.yaml",
      "application-owned",
    ),
    createFileEvidencePoint(
      "content-files-long-form-introduction",
      "content-files",
      "apps/web/content/en-CA/long-form/introduction.md",
      "application-owned",
    ),
    createFileEvidencePoint(
      "content-files-site-content",
      "content-files",
      "apps/web/content/en-CA/site.yaml",
      "application-owned",
    ),
    createFileEvidencePoint(
      "content-files-schema",
      "content-files",
      "apps/web/src/content/content-schema.ts",
      "application-owned",
    ),
    createFileEvidencePoint(
      "content-files-source-declarations",
      "content-files",
      "apps/web/src/content/content-source.d.ts",
      "application-owned",
    ),
    createFileEvidencePoint(
      "content-files-reader",
      "content-files",
      "apps/web/src/content/read-content.ts",
      "application-owned",
    ),
  ] as const;

  const sectionCompositionGlobalStyles = createFileEvidencePoint(
    "section-composition-global-styles",
    "section-composition",
    "apps/web/app/globals.css",
    "application-owned",
  );
  const sectionCompositionPostcssPackage = createPackageEvidencePoint(
    "section-composition-postcss-package",
    "section-composition",
    "devDependencies",
    "postcss",
    "8.5.26",
  );
  const sectionCompositionTailwindPackage = createPackageEvidencePoint(
    "section-composition-tailwind-package",
    "section-composition",
    "devDependencies",
    "tailwindcss",
    "4.3.3",
  );
  const sectionCompositionTailwindPostcssPackage = createPackageEvidencePoint(
    "section-composition-tailwind-postcss-package",
    "section-composition",
    "devDependencies",
    "@tailwindcss/postcss",
    "4.3.3",
  );
  const sectionCompositionPostcssConfiguration = createFileEvidencePoint(
    "section-composition-postcss-configuration",
    "section-composition",
    "apps/web/postcss.config.mjs",
    "application-owned",
  );
  const sectionCompositionPresentation = createFileEvidencePoint(
    "section-composition-presentation",
    "section-composition",
    "apps/web/src/presentation/content-page.tsx",
    "application-owned",
  );
  const sectionCompositionRegistry = createFileEvidencePoint(
    "section-composition-registry",
    "section-composition",
    "apps/web/src/sections/section-registry.tsx",
    "application-owned",
  );

  const deploymentCloudflareEvidencePoints = [
    createPackageEvidencePoint(
      "deployment-cloudflare-package",
      "deployment-cloudflare",
      "dependencies",
      "@opennextjs/cloudflare",
      "1.20.2",
    ),
    createPackageEvidencePoint(
      "deployment-cloudflare-wrangler-package",
      "deployment-cloudflare",
      "devDependencies",
      "wrangler",
      "4.118.0",
    ),
    createFileEvidencePoint(
      "deployment-cloudflare-next-configuration",
      "deployment-cloudflare",
      "apps/web/next.config.ts",
      "managed",
    ),
    createFileEvidencePoint(
      "deployment-cloudflare-open-next-configuration",
      "deployment-cloudflare",
      "apps/web/open-next.config.ts",
      "managed",
    ),
    createFileEvidencePoint(
      "deployment-cloudflare-wrangler-configuration",
      "deployment-cloudflare",
      "apps/web/wrangler.jsonc",
      "managed",
    ),
  ] as const;

  const observabilityPackage = createPackageEvidencePoint(
    "observability-package",
    "observability",
    "dependencies",
    "@egeria-systems/observability",
    packageVersions.observability,
  );
  const observabilityBrowserIngestRoute = createFileEvidencePoint(
    "observability-browser-ingest-route",
    "observability",
    "apps/web/app/api/observability/route.ts",
    "application-owned",
  );
  const observabilityBrowserInstrumentation = createFileEvidencePoint(
    "observability-browser-instrumentation",
    "observability",
    "apps/web/instrumentation-client.ts",
    "application-owned",
  );
  const observabilityBrowserReporter = createFileEvidencePoint(
    "observability-browser-reporter",
    "observability",
    "apps/web/src/infrastructure/observability/browser-reporter.ts",
    "application-owned",
  );
  const observabilityCloudflareContext = createFileEvidencePoint(
    "observability-cloudflare-context",
    "observability",
    "apps/web/src/infrastructure/cloudflare/observability-context.ts",
    "application-owned",
  );
  const observabilityRegistration = createFileEvidencePoint(
    "observability-registration",
    "observability",
    "apps/web/src/infrastructure/observability/installed-capability.ts",
    "managed",
  );
  const observabilityServerInstrumentation = createFileEvidencePoint(
    "observability-server-instrumentation",
    "observability",
    "apps/web/instrumentation.ts",
    "application-owned",
  );
  const observabilityServerReporter = createFileEvidencePoint(
    "observability-server-reporter",
    "observability",
    "apps/web/src/infrastructure/observability/server-reporter.ts",
    "application-owned",
  );
  const observabilityWebVitalsReporter = createFileEvidencePoint(
    "observability-web-vitals-reporter",
    "observability",
    "apps/web/src/infrastructure/observability/web-vitals-reporter.tsx",
    "application-owned",
  );
  const observabilityPageErrorBoundary = createFileEvidencePoint(
    "observability-page-error-boundary",
    "observability",
    "apps/web/app/error.tsx",
    "application-owned",
  );
  const observabilityGlobalErrorBoundary = createFileEvidencePoint(
    "observability-global-error-boundary",
    "observability",
    "apps/web/app/global-error.tsx",
    "application-owned",
  );
  const observabilityErrorCopySource = createFileEvidencePoint(
    "observability-error-copy-source",
    "observability",
    "apps/web/content/en-CA/observability.yaml",
    "application-owned",
  );
  const observabilityErrorCopy = createFileEvidencePoint(
    "observability-error-copy",
    "observability",
    "apps/web/src/infrastructure/observability/error-copy.ts",
    "application-owned",
  );
  const observabilityErrorFallback = createFileEvidencePoint(
    "observability-error-fallback",
    "observability",
    "apps/web/src/presentation/error-fallback.tsx",
    "application-owned",
  );

  const siteRoutingEvidencePoints = [
    createFileEvidencePoint(
      "site-routing-about-route",
      "site-routing",
      "apps/web/app/about/page.tsx",
      "application-owned",
    ),
    createFileEvidencePoint(
      "site-routing-about-content",
      "site-routing",
      "apps/web/content/en-CA/about.yaml",
      "application-owned",
    ),
  ] as const;

  const bookingCalendlyEvidencePoints = [
    createFileEvidencePoint(
      "booking-calendly-browser-specification",
      "booking-calendly",
      "apps/web/tests/e2e/calendly-booking.spec.ts",
      "application-owned",
    ),
    createFileEvidencePoint(
      "booking-calendly-client-component",
      "booking-calendly",
      "apps/web/src/integrations/booking-calendly/calendly-booking.tsx",
      "application-owned",
    ),
    createFileEvidencePoint(
      "booking-calendly-content",
      "booking-calendly",
      "apps/web/content/en-CA/booking-calendly.yaml",
      "application-owned",
    ),
    createFileEvidencePoint(
      "booking-calendly-content-reader",
      "booking-calendly",
      "apps/web/src/integrations/booking-calendly/booking-content.ts",
      "application-owned",
    ),
    createFileEvidencePoint(
      "booking-calendly-settings",
      "booking-calendly",
      "apps/web/src/integrations/booking-calendly/booking-settings.ts",
      "managed",
    ),
  ] as const;

  return [
    {
      identifier: "standards",
      version: "0.3.0",
      deliveryMode: "hybrid",
      stateClassifications: ["repository-stateful"],
      removalPolicy: "reviewed",
      dependencies: [],
      ...sharedCapabilityMetadata,
      supportedProfiles: ["portfolio", "site"],
      requiredPackages: [
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
      ],
      environmentVariables: ["PLAYWRIGHT_DEPLOYED_URL"],
      externalDomains: [
        "cdn.playwright.dev",
        "playwright.download.prss.microsoft.com",
      ],
      retentionAssumptions: ["ci-failure-artifacts-seven-days"],
      privilegedOperations: [
        "browser-binary-installation",
        "browser-process-execution",
        "test-process-execution",
      ],
      threatReviewLevel: "elevated",
      platformResources: [],
      adapterSemanticRequirements: [],
      ...projectEvidencePoints(standardsEvidencePoints),
      verificationPlan: [
        "package-resolution",
        "lint",
        "typecheck",
        "unit-tests",
        "component-tests",
        "browser-development",
        "browser-preview",
        "deployed-configuration",
        "workflow-contracts",
      ],
      documentationEvidenceRequirements: [
        "public-package-version-and-provenance",
        "unit-and-component-testing-claim-boundaries",
        "browser-testing-claim-boundaries",
      ],
      removalAndRecoveryRequirements: [
        "review-package-and-configuration-removal",
        "review-generated-test-surface-removal",
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
      ...sharedCapabilityMetadata,
      supportedProfiles: ["portfolio", "site"],
      requiredPackages: ["raw-loader", "yaml"],
      platformResources: [],
      adapterSemanticRequirements: [],
      ...projectEvidencePoints(contentFilesEvidencePoints),
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
      ...sharedCapabilityMetadata,
      supportedProfiles: ["portfolio", "site"],
      requiredPackages: ["@tailwindcss/postcss", "postcss", "tailwindcss"],
      platformResources: [],
      adapterSemanticRequirements: [],
      managedSurfaces: projectManagedSurfaces([
        sectionCompositionGlobalStyles,
        sectionCompositionPostcssPackage,
        sectionCompositionTailwindPackage,
        sectionCompositionTailwindPostcssPackage,
        sectionCompositionPostcssConfiguration,
        sectionCompositionPresentation,
        sectionCompositionRegistry,
      ]),
      inferenceProbes: projectInferenceProbes([
        sectionCompositionTailwindPostcssPackage,
        sectionCompositionPostcssPackage,
        sectionCompositionTailwindPackage,
        sectionCompositionGlobalStyles,
        sectionCompositionPostcssConfiguration,
        sectionCompositionPresentation,
        sectionCompositionRegistry,
      ]),
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
      ...sharedCapabilityMetadata,
      supportedProfiles: ["portfolio", "site"],
      requiredPackages: ["@opennextjs/cloudflare", "wrangler"],
      platformResources: ["cloudflare-worker", "cloudflare-static-assets"],
      adapterSemanticRequirements: ["node-runtime", "worker-static-assets"],
      ...projectEvidencePoints(deploymentCloudflareEvidencePoints),
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
      version: "0.3.0",
      deliveryMode: "hybrid",
      stateClassifications: ["repository-stateful", "external-stateful"],
      removalPolicy: "reviewed",
      dependencies: [
        "content-files",
        "deployment-cloudflare",
        "section-composition",
      ],
      ...sharedCapabilityMetadata,
      supportedProfiles: ["portfolio", "site"],
      requiredPackages: ["@egeria-systems/observability"],
      secrets: [
        "BETTER_STACK_INGESTING_HOST",
        "BETTER_STACK_SOURCE_TOKEN",
      ],
      platformResources: [
        "better-stack-telemetry-source",
        "cloudflare-workers-logs",
      ],
      externalDomains: ["*.betterstackdata.com"],
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
      managedSurfaces: projectManagedSurfaces([
        observabilityPackage,
        observabilityBrowserIngestRoute,
        observabilityBrowserInstrumentation,
        observabilityBrowserReporter,
        observabilityCloudflareContext,
        observabilityRegistration,
        observabilityServerInstrumentation,
        observabilityServerReporter,
        observabilityWebVitalsReporter,
        observabilityPageErrorBoundary,
        observabilityGlobalErrorBoundary,
        observabilityErrorCopySource,
        observabilityErrorCopy,
        observabilityErrorFallback,
      ]),
      inferenceProbes: [
        ...projectInferenceProbes([
          observabilityPackage,
          observabilityBrowserIngestRoute,
          observabilityBrowserInstrumentation,
          observabilityServerInstrumentation,
          observabilityCloudflareContext,
          observabilityBrowserReporter,
          observabilityRegistration,
          observabilityServerReporter,
          observabilityWebVitalsReporter,
          observabilityPageErrorBoundary,
          observabilityGlobalErrorBoundary,
          observabilityErrorCopySource,
          observabilityErrorCopy,
          observabilityErrorFallback,
        ]),
        createJsonValueProbe(
          "apps/web/wrangler.jsonc",
          "/observability/enabled",
          true,
        ),
        createJsonValueProbe(
          "apps/web/wrangler.jsonc",
          "/observability/head_sampling_rate",
          1,
        ),
        createJsonValueProbe(
          "apps/web/wrangler.jsonc",
          "/observability/logs/invocation_logs",
          false,
        ),
        createJsonValueProbe(
          "apps/web/wrangler.jsonc",
          "/version_metadata/binding",
          "CF_VERSION_METADATA",
        ),
      ],
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
      ...sharedCapabilityMetadata,
      supportedProfiles: ["site"],
      requiredPackages: [],
      platformResources: [],
      adapterSemanticRequirements: [],
      ...projectEvidencePoints(siteRoutingEvidencePoints),
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
      ...sharedCapabilityMetadata,
      supportedProfiles: ["portfolio", "site"],
      requiredPackages: [],
      externalDomains: ["calendly.com", "www.calendly.com"],
      contentSecurityPolicyContributions: [
        "frame-src https://calendly.com https://www.calendly.com",
      ],
      browserStorage: ["provider-controlled-cross-origin-frame"],
      dataClassifications: ["provider-controlled-scheduling-data"],
      retentionAssumptions: ["provider-controlled"],
      threatReviewLevel: "elevated",
      platformResources: [],
      adapterSemanticRequirements: [],
      ...projectEvidencePoints(bookingCalendlyEvidencePoints),
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
  ];
}

function createPackageVersionIssue(
  field: keyof CapabilityPackageVersions,
  packageName: string,
): ContractIssue {
  return {
    code: "CAPABILITY_PACKAGE_VERSION_INVALID",
    path: ["packageVersions", field],
    context: { packageName },
  };
}

export function createCapabilityCatalog(
  packageVersions: CapabilityPackageVersions,
): ValidationResult<readonly CapabilityDescriptor[]> {
  const versionIssues: ContractIssue[] = [];

  if (!semanticVersionSchema.safeParse(packageVersions.standards).success) {
    versionIssues.push(
      createPackageVersionIssue("standards", "@egeria-systems/standards"),
    );
  }
  if (!semanticVersionSchema.safeParse(packageVersions.observability).success) {
    versionIssues.push(
      createPackageVersionIssue(
        "observability",
        "@egeria-systems/observability",
      ),
    );
  }

  if (versionIssues.length > 0) {
    return { ok: false, issues: versionIssues };
  }

  const catalog: CapabilityDescriptor[] = [];
  const catalogIssues: ContractIssue[] = [];

  for (const [index, descriptor] of createDescriptors(packageVersions).entries()) {
    const parsed = capabilityDescriptorSchema.safeParse(descriptor);

    if (parsed.success) {
      catalog.push(parsed.data);
    } else {
      catalogIssues.push({
        code: "CAPABILITY_CATALOG_INVALID",
        path: ["catalog", index],
        context: { reason: parsed.error.issues[0]?.code ?? "unknown" },
      });
    }
  }

  return catalogIssues.length > 0
    ? { ok: false, issues: catalogIssues }
    : { ok: true, value: catalog };
}
