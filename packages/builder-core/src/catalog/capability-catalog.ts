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

function createDescriptors(
  packageVersions: CapabilityPackageVersions,
): readonly CapabilityDescriptor[] {
  return [
    {
      identifier: "standards",
      version: "0.1.0",
      deliveryMode: "package-backed",
      stateClassifications: ["repository-stateful"],
      removalPolicy: "reviewed",
      dependencies: [],
      ...sharedCapabilityMetadata,
      supportedProfiles: ["portfolio", "site"],
      requiredPackages: ["@egeria-systems/standards"],
      platformResources: [],
      adapterSemanticRequirements: [],
      managedSurfaces: [
        createPackageSurface(
          "standards-package",
          "standards",
          "/devDependencies/@egeria-systems~1standards",
        ),
        createFileSurface(
          "standards-typescript-configuration",
          "standards",
          "apps/web/tsconfig.json",
          "managed",
        ),
        createFileSurface(
          "standards-eslint-configuration",
          "standards",
          "apps/web/eslint.config.mjs",
          "managed",
        ),
      ],
      inferenceProbes: [
        createPackageProbe(
          "devDependencies",
          "@egeria-systems/standards",
          packageVersions.standards,
        ),
        createFileProbe("apps/web/tsconfig.json"),
        createFileProbe("apps/web/eslint.config.mjs"),
      ],
      verificationPlan: ["package-resolution", "lint", "typecheck"],
      documentationEvidenceRequirements: [
        "public-package-version-and-provenance",
      ],
      removalAndRecoveryRequirements: [
        "review-package-and-configuration-removal",
      ],
    },
    {
      identifier: "content-files",
      version: "0.3.0",
      deliveryMode: "source-generated",
      stateClassifications: ["repository-stateful"],
      removalPolicy: "reviewed",
      dependencies: ["standards"],
      ...sharedCapabilityMetadata,
      supportedProfiles: ["portfolio", "site"],
      requiredPackages: ["yaml"],
      platformResources: [],
      adapterSemanticRequirements: [],
      managedSurfaces: [
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
          "content-files-reader",
          "content-files",
          "apps/web/src/content/read-content.ts",
          "application-owned",
        ),
      ],
      inferenceProbes: [
        createPackageProbe("dependencies", "yaml", "2.9.0"),
        createFileProbe("apps/web/content/content.config.yaml"),
        createFileProbe(
          "apps/web/content/en-CA/long-form/introduction.md",
        ),
        createFileProbe("apps/web/content/en-CA/site.yaml"),
        createFileProbe("apps/web/src/content/content-schema.ts"),
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
        createFileSurface(
          "section-composition-home-route",
          "section-composition",
          "apps/web/app/page.tsx",
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
        createPackageProbe("devDependencies", "postcss", "8.5.22"),
        createPackageProbe("devDependencies", "tailwindcss", "4.3.3"),
        createFileProbe("apps/web/app/globals.css"),
        createFileProbe("apps/web/app/page.tsx"),
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
      version: "0.1.0",
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
      version: "0.1.0",
      deliveryMode: "hybrid",
      stateClassifications: ["repository-stateful", "external-stateful"],
      removalPolicy: "reviewed",
      dependencies: ["deployment-cloudflare"],
      ...sharedCapabilityMetadata,
      supportedProfiles: ["portfolio", "site"],
      requiredPackages: ["@egeria-systems/observability"],
      platformResources: [],
      adapterSemanticRequirements: [],
      managedSurfaces: [
        createPackageSurface(
          "observability-package",
          "observability",
          "/dependencies/@egeria-systems~1observability",
        ),
        createFileSurface(
          "observability-registration",
          "observability",
          "apps/web/src/infrastructure/observability/installed-capability.ts",
          "managed",
        ),
      ],
      inferenceProbes: [
        createPackageProbe(
          "dependencies",
          "@egeria-systems/observability",
          packageVersions.observability,
        ),
        createFileProbe(
          "apps/web/src/infrastructure/observability/installed-capability.ts",
        ),
      ],
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
      version: "0.1.0",
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
