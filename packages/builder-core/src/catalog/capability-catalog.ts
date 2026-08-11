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
  return {
    identifier,
    owner: { kind: "capability", identifier: capability },
    path,
    ownership,
    fingerprintTarget: { kind: "file" },
    mergeStrategy: "replace-file",
  };
}

function createPackageSurface(
  identifier: string,
  capability: string,
  pointer: string,
): ManagedSurfaceDescriptor {
  return {
    identifier,
    owner: { kind: "capability", identifier: capability },
    path: "apps/web/package.json",
    ownership: "merge-managed",
    fingerprintTarget: { kind: "json-value", pointer },
    mergeStrategy: "json-property",
  };
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

function createDescriptors(
  packageVersions: CapabilityPackageVersions,
): readonly CapabilityDescriptor[] {
  return [
    {
      identifier: "standards",
      version: "0.2.0",
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
      ],
      threatReviewLevel: "elevated",
      platformResources: [],
      adapterSemanticRequirements: [],
      managedSurfaces: [
        createPackageSurface(
          "standards-axe-playwright-package",
          "standards",
          "/devDependencies/@axe-core~1playwright",
        ),
        createPackageSurface(
          "standards-browser-install-ci-script",
          "standards",
          "/scripts/browser:install:ci",
        ),
        createPackageSurface(
          "standards-browser-install-script",
          "standards",
          "/scripts/browser:install",
        ),
        createFileSurface(
          "standards-browser-quality-specification",
          "standards",
          "apps/web/tests/e2e/site-quality.spec.ts",
          "application-owned",
        ),
        createPackageSurface(
          "standards-deployed-browser-test-script",
          "standards",
          "/scripts/test:e2e:deployed",
        ),
        createPackageSurface(
          "standards-development-browser-test-script",
          "standards",
          "/scripts/test:e2e:dev",
        ),
        createFileSurface(
          "standards-eslint-configuration",
          "standards",
          "apps/web/eslint.config.mjs",
          "managed",
        ),
        createPackageSurface(
          "standards-package",
          "standards",
          "/devDependencies/@egeria-systems~1standards",
        ),
        createFileSurface(
          "standards-playwright-deployed-configuration",
          "standards",
          "apps/web/playwright.deployed.config.ts",
          "managed",
        ),
        createFileSurface(
          "standards-playwright-development-configuration",
          "standards",
          "apps/web/playwright.dev.config.ts",
          "managed",
        ),
        createPackageSurface(
          "standards-playwright-package",
          "standards",
          "/devDependencies/@playwright~1test",
        ),
        createFileSurface(
          "standards-playwright-preview-configuration",
          "standards",
          "apps/web/playwright.preview.config.ts",
          "managed",
        ),
        createFileSurface(
          "standards-playwright-shared-configuration",
          "standards",
          "apps/web/playwright.config.shared.ts",
          "managed",
        ),
        createPackageSurface(
          "standards-preview-browser-test-script",
          "standards",
          "/scripts/test:e2e:preview",
        ),
        createFileSurface(
          "standards-quality-workflow",
          "standards",
          ".github/workflows/quality.yml",
          "managed",
        ),
        createFileSurface(
          "standards-typescript-configuration",
          "standards",
          "apps/web/tsconfig.json",
          "managed",
        ),
      ],
      inferenceProbes: [
        createPackageProbe(
          "devDependencies",
          "@axe-core/playwright",
          "4.12.1",
        ),
        createJsonValueProbe(
          "apps/web/package.json",
          "/scripts/browser:install:ci",
          "playwright install --with-deps chromium",
        ),
        createJsonValueProbe(
          "apps/web/package.json",
          "/scripts/browser:install",
          "playwright install chromium",
        ),
        createFileProbe("apps/web/tests/e2e/site-quality.spec.ts"),
        createJsonValueProbe(
          "apps/web/package.json",
          "/scripts/test:e2e:deployed",
          "playwright test --config playwright.deployed.config.ts",
        ),
        createJsonValueProbe(
          "apps/web/package.json",
          "/scripts/test:e2e:dev",
          "playwright test --config playwright.dev.config.ts",
        ),
        createFileProbe("apps/web/eslint.config.mjs"),
        createPackageProbe(
          "devDependencies",
          "@egeria-systems/standards",
          packageVersions.standards,
        ),
        createFileProbe("apps/web/playwright.deployed.config.ts"),
        createFileProbe("apps/web/playwright.dev.config.ts"),
        createPackageProbe(
          "devDependencies",
          "@playwright/test",
          "1.62.1",
        ),
        createFileProbe("apps/web/playwright.preview.config.ts"),
        createFileProbe("apps/web/playwright.config.shared.ts"),
        createJsonValueProbe(
          "apps/web/package.json",
          "/scripts/test:e2e:preview",
          "playwright test --config playwright.preview.config.ts",
        ),
        createFileProbe(".github/workflows/quality.yml"),
        createFileProbe("apps/web/tsconfig.json"),
      ],
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
      ...sharedCapabilityMetadata,
      supportedProfiles: ["portfolio", "site"],
      requiredPackages: ["raw-loader", "yaml"],
      platformResources: [],
      adapterSemanticRequirements: [],
      managedSurfaces: [
        createPackageSurface(
          "content-files-raw-loader-package",
          "content-files",
          "/devDependencies/raw-loader",
        ),
        createPackageSurface(
          "content-files-yaml-package",
          "content-files",
          "/dependencies/yaml",
        ),
        createFileSurface(
          "content-files-configuration",
          "content-files",
          "apps/web/content/content.config.yaml",
          "application-owned",
        ),
        createFileSurface(
          "content-files-long-form-introduction",
          "content-files",
          "apps/web/content/en-CA/long-form/introduction.md",
          "application-owned",
        ),
        createFileSurface(
          "content-files-site-content",
          "content-files",
          "apps/web/content/en-CA/site.yaml",
          "application-owned",
        ),
        createFileSurface(
          "content-files-schema",
          "content-files",
          "apps/web/src/content/content-schema.ts",
          "application-owned",
        ),
        createFileSurface(
          "content-files-source-declarations",
          "content-files",
          "apps/web/src/content/content-source.d.ts",
          "application-owned",
        ),
        createFileSurface(
          "content-files-reader",
          "content-files",
          "apps/web/src/content/read-content.ts",
          "application-owned",
        ),
      ],
      inferenceProbes: [
        createPackageProbe("devDependencies", "raw-loader", "4.0.2"),
        createPackageProbe("dependencies", "yaml", "2.9.0"),
        createFileProbe("apps/web/content/content.config.yaml"),
        createFileProbe(
          "apps/web/content/en-CA/long-form/introduction.md",
        ),
        createFileProbe("apps/web/content/en-CA/site.yaml"),
        createFileProbe("apps/web/src/content/content-schema.ts"),
        createFileProbe("apps/web/src/content/content-source.d.ts"),
        createFileProbe("apps/web/src/content/read-content.ts"),
      ],
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
      managedSurfaces: [
        createFileSurface(
          "section-composition-global-styles",
          "section-composition",
          "apps/web/app/globals.css",
          "application-owned",
        ),
        createPackageSurface(
          "section-composition-postcss-package",
          "section-composition",
          "/devDependencies/postcss",
        ),
        createPackageSurface(
          "section-composition-tailwind-package",
          "section-composition",
          "/devDependencies/tailwindcss",
        ),
        createPackageSurface(
          "section-composition-tailwind-postcss-package",
          "section-composition",
          "/devDependencies/@tailwindcss~1postcss",
        ),
        createFileSurface(
          "section-composition-postcss-configuration",
          "section-composition",
          "apps/web/postcss.config.mjs",
          "application-owned",
        ),
        createFileSurface(
          "section-composition-presentation",
          "section-composition",
          "apps/web/src/presentation/content-page.tsx",
          "application-owned",
        ),
        createFileSurface(
          "section-composition-registry",
          "section-composition",
          "apps/web/src/sections/section-registry.tsx",
          "application-owned",
        ),
      ],
      inferenceProbes: [
        createPackageProbe(
          "devDependencies",
          "@tailwindcss/postcss",
          "4.3.3",
        ),
        createPackageProbe("devDependencies", "postcss", "8.5.26"),
        createPackageProbe("devDependencies", "tailwindcss", "4.3.3"),
        createFileProbe("apps/web/app/globals.css"),
        createFileProbe("apps/web/postcss.config.mjs"),
        createFileProbe("apps/web/src/presentation/content-page.tsx"),
        createFileProbe("apps/web/src/sections/section-registry.tsx"),
      ],
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
      managedSurfaces: [
        createPackageSurface(
          "deployment-cloudflare-package",
          "deployment-cloudflare",
          "/dependencies/@opennextjs~1cloudflare",
        ),
        createPackageSurface(
          "deployment-cloudflare-wrangler-package",
          "deployment-cloudflare",
          "/devDependencies/wrangler",
        ),
        createFileSurface(
          "deployment-cloudflare-next-configuration",
          "deployment-cloudflare",
          "apps/web/next.config.ts",
          "managed",
        ),
        createFileSurface(
          "deployment-cloudflare-open-next-configuration",
          "deployment-cloudflare",
          "apps/web/open-next.config.ts",
          "managed",
        ),
        createFileSurface(
          "deployment-cloudflare-wrangler-configuration",
          "deployment-cloudflare",
          "apps/web/wrangler.jsonc",
          "managed",
        ),
      ],
      inferenceProbes: [
        createPackageProbe(
          "dependencies",
          "@opennextjs/cloudflare",
          "1.20.2",
        ),
        createPackageProbe("devDependencies", "wrangler", "4.118.0"),
        createFileProbe("apps/web/next.config.ts"),
        createFileProbe("apps/web/open-next.config.ts"),
        createFileProbe("apps/web/wrangler.jsonc"),
      ],
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
        createPackageSurface(
          "observability-package",
          "observability",
          "/dependencies/@egeria-systems~1observability",
        ),
        createFileSurface(
          "observability-browser-ingest-route",
          "observability",
          "apps/web/app/api/observability/route.ts",
          "application-owned",
        ),
        createFileSurface(
          "observability-browser-instrumentation",
          "observability",
          "apps/web/instrumentation-client.ts",
          "application-owned",
        ),
        createFileSurface(
          "observability-browser-reporter",
          "observability",
          "apps/web/src/infrastructure/observability/browser-reporter.ts",
          "application-owned",
        ),
        createFileSurface(
          "observability-cloudflare-context",
          "observability",
          "apps/web/src/infrastructure/cloudflare/observability-context.ts",
          "application-owned",
        ),
        createFileSurface(
          "observability-registration",
          "observability",
          "apps/web/src/infrastructure/observability/installed-capability.ts",
          "managed",
        ),
        createFileSurface(
          "observability-server-instrumentation",
          "observability",
          "apps/web/instrumentation.ts",
          "application-owned",
        ),
        createFileSurface(
          "observability-server-reporter",
          "observability",
          "apps/web/src/infrastructure/observability/server-reporter.ts",
          "application-owned",
        ),
        createFileSurface(
          "observability-web-vitals-reporter",
          "observability",
          "apps/web/src/infrastructure/observability/web-vitals-reporter.tsx",
          "application-owned",
        ),
      ],
      inferenceProbes: [
        createPackageProbe(
          "dependencies",
          "@egeria-systems/observability",
          packageVersions.observability,
        ),
        createFileProbe("apps/web/app/api/observability/route.ts"),
        createFileProbe("apps/web/instrumentation-client.ts"),
        createFileProbe("apps/web/instrumentation.ts"),
        createFileProbe(
          "apps/web/src/infrastructure/cloudflare/observability-context.ts",
        ),
        createFileProbe(
          "apps/web/src/infrastructure/observability/browser-reporter.ts",
        ),
        createFileProbe(
          "apps/web/src/infrastructure/observability/installed-capability.ts",
        ),
        createFileProbe(
          "apps/web/src/infrastructure/observability/server-reporter.ts",
        ),
        createFileProbe(
          "apps/web/src/infrastructure/observability/web-vitals-reporter.tsx",
        ),
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
      managedSurfaces: [
        createFileSurface(
          "site-routing-about-route",
          "site-routing",
          "apps/web/app/about/page.tsx",
          "application-owned",
        ),
        createFileSurface(
          "site-routing-about-content",
          "site-routing",
          "apps/web/content/en-CA/about.yaml",
          "application-owned",
        ),
      ],
      inferenceProbes: [
        createFileProbe("apps/web/app/about/page.tsx"),
        createFileProbe("apps/web/content/en-CA/about.yaml"),
      ],
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
      managedSurfaces: [
        createFileSurface(
          "booking-calendly-browser-specification",
          "booking-calendly",
          "apps/web/tests/e2e/calendly-booking.spec.ts",
          "application-owned",
        ),
        createFileSurface(
          "booking-calendly-client-component",
          "booking-calendly",
          "apps/web/src/integrations/booking-calendly/calendly-booking.tsx",
          "application-owned",
        ),
        createFileSurface(
          "booking-calendly-content",
          "booking-calendly",
          "apps/web/content/en-CA/booking-calendly.yaml",
          "application-owned",
        ),
        createFileSurface(
          "booking-calendly-content-reader",
          "booking-calendly",
          "apps/web/src/integrations/booking-calendly/booking-content.ts",
          "application-owned",
        ),
        createFileSurface(
          "booking-calendly-settings",
          "booking-calendly",
          "apps/web/src/integrations/booking-calendly/booking-settings.ts",
          "managed",
        ),
      ],
      inferenceProbes: [
        createFileProbe("apps/web/tests/e2e/calendly-booking.spec.ts"),
        createFileProbe(
          "apps/web/src/integrations/booking-calendly/calendly-booking.tsx",
        ),
        createFileProbe("apps/web/content/en-CA/booking-calendly.yaml"),
        createFileProbe(
          "apps/web/src/integrations/booking-calendly/booking-content.ts",
        ),
        createFileProbe(
          "apps/web/src/integrations/booking-calendly/booking-settings.ts",
        ),
      ],
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
