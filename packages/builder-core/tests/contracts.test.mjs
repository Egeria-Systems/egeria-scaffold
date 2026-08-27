import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import test from "node:test";

const execFileAsync = promisify(execFile);
const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const builtEntry = resolve(packageRoot, "dist/index.js");
const contracts = await import(pathToFileURL(builtEntry));
const surfaceTargets = await import(
  pathToFileURL(resolve(packageRoot, "dist/contracts/surface-target.js"))
);

const schemaArtifactNames = [
  "capability.schema.json",
  "certification-registry.schema.json",
  "migration-record.schema.json",
  "profile.schema.json",
  "project.schema.json",
  "state.schema.json",
];

const validCapability = {
  identifier: "standards",
  version: "0.1.0",
  deliveryMode: "package-backed",
  stateClassifications: ["repository-stateful"],
  removalPolicy: "reviewed",
  dependencies: [],
  optionalIntegrations: [],
  conflicts: [],
  supportedProfiles: ["portfolio", "site"],
  requiredPackages: ["@egeria-systems/standards"],
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
      identifier: "standards-typescript",
      owner: { kind: "capability", identifier: "standards" },
      path: "apps/web/tsconfig.json",
      ownership: "managed",
      fingerprintTarget: { kind: "file" },
      mergeStrategy: "replace-file",
    },
  ],
  inferenceProbes: [{ kind: "file", path: "apps/web/tsconfig.json" }],
  migrationPlanners: [],
  verificationPlan: ["typecheck"],
  documentationEvidenceRequirements: [],
  removalAndRecoveryRequirements: ["restore dependency manifest"],
};

const validProfile = {
  identifier: "portfolio",
  schemaVersion: "1.0.0",
  recipeVersion: "0.1.0",
  defaultCapabilities: ["standards"],
};

const validProject = {
  schemaVersion: "1.0.0",
  builderCompatibility: "0.0.0",
  project: {
    name: "sample-portfolio",
    displayName: "Sample Portfolio",
    defaultLocale: "en-CA",
  },
  originProfile: "portfolio",
  recipeVersion: "0.1.0",
  platformAdapter: "cloudflare-workers",
  selectedCapabilities: ["standards"],
  capabilitySettings: {},
  ejectedAreas: [],
};

const validCalendlyBookingSettings = {
  destination: "https://calendly.com/acme/intro",
  mode: "popup",
};

const validAnalyticsSettings = {
  consent: { policy: "explicit-opt-in" },
  providers: {
    cloudflareWebAnalytics: {
      siteToken: "0123456789abcdef0123456789abcdef",
    },
    googleAnalytics4: { measurementId: "G-TEST123456" },
    microsoftClarity: {
      projectId: "clarity123",
      audience: "not-directed-to-minors",
    },
  },
  operationalIntegrations: {
    googleSearchConsole: {
      verificationToken: "search-console-verification-token",
    },
    lookerStudio: { connector: "google-analytics-4" },
  },
};

const validInstalledSurface = {
  identifier: "standards-typescript",
  owner: { kind: "capability", identifier: "standards" },
  path: "apps/web/tsconfig.json",
  ownership: "managed",
  fingerprintTarget: { kind: "file" },
  mergeStrategy: "replace-file",
  fingerprint: `sha256:${"a".repeat(64)}`,
};

const legacyVerificationChecks = [
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

const currentVerificationChecks = [
  "contracts",
  "pre-state-inference",
  "lockfile",
  "frozen-install",
  "lint",
  "typecheck",
  "unit-tests",
  "component-tests",
  "next-build",
  "opennext-build",
  "post-state-inference",
];

const persistedVerificationChecks = [
  "contracts",
  "plan-approval",
  "pre-state-inference",
  "lockfile",
  "frozen-install",
  "lint",
  "typecheck",
  "unit-tests",
  "component-tests",
  "next-build",
  "opennext-build",
  "post-change-inference",
];

const capabilityUpgradePersistedVerificationChecks = [
  "contracts",
  "plan-approval",
  "pre-state-inference",
  "lockfile",
  "frozen-install",
  "lint",
  "typecheck",
  "unit-tests",
  "component-tests",
  "next-build",
  "opennext-build",
  "post-change-inference",
];

const capabilityAdditionVerificationChecks = [
  ...persistedVerificationChecks,
  "migration-record",
  "post-state-inference",
];

const capabilityRemovalVerificationChecks = [
  ...persistedVerificationChecks,
  "migration-record",
  "post-state-inference",
];

const capabilityUpgradeVerificationChecks = [
  ...capabilityUpgradePersistedVerificationChecks,
  "migration-record",
  "post-state-inference",
];

const profileTransitionPersistedVerificationChecks = [
  ...capabilityUpgradePersistedVerificationChecks,
];

const profileTransitionVerificationChecks = [
  ...profileTransitionPersistedVerificationChecks,
  "migration-record",
  "post-state-inference",
];

const readableRecipeVersions = [
  "0.1.0",
  "0.2.0",
  "0.3.0",
  "0.4.0",
  "0.5.0",
  "0.6.0",
  "0.7.0",
  "0.8.0",
  "0.9.0",
  "0.10.0",
  "0.11.0",
];

const validState = {
  schemaVersion: "1.0.0",
  builderVersion: "0.0.0",
  projectSchemaVersion: "1.0.0",
  origin: { profile: "portfolio", recipeVersion: "0.7.0" },
  installedCapabilities: [
    {
      identifier: "standards",
      version: "0.1.0",
      deliveryMode: "package-backed",
      stateClassifications: ["repository-stateful"],
      removalPolicy: "reviewed",
    },
  ],
  appliedMigrations: [],
  managedSurfaces: [validInstalledSurface],
  ejections: [],
  compatibility: {
    node: "22.23.2",
    pnpm: "11.20.0",
    platformAdapter: "cloudflare-workers",
  },
  lastSuccessfulVerification: {
    kind: "generation",
    checks: currentVerificationChecks,
  },
};

const validMigrationRecord = {
  schemaVersion: "1.0.0",
  identifier: "initial-generation-reconciliation",
  kind: "reconciliation",
  outcome: "succeeded",
  completedAt: "2026-08-05T16:00:00.000Z",
  fromBuilderVersion: "0.0.0",
  toBuilderVersion: "0.0.0",
  capabilities: ["standards"],
  persistentDataAuthorizations: [],
  remainingKnownDrift: [],
  verificationChecks: ["contracts"],
};

function assertAccepts(schema, value) {
  const result = schema.safeParse(value);
  assert.equal(result.success, true, JSON.stringify(result.error?.issues));
}

function assertRejects(schema, value) {
  assert.equal(schema.safeParse(value).success, false);
}

function assertMergeTargetIssue(schema, value, path) {
  const result = schema.safeParse(value);
  assert.equal(result.success, false);
  assert.deepEqual(result.error.issues, [
    {
      code: "custom",
      message: "merge strategy must match its fingerprint target",
      path,
    },
  ]);
}

test("managed-surface constructors bind target and merge policy without changing ownership", () => {
  const builderSurface = surfaceTargets.createFileSurfaceDescriptor({
    identifier: "builder-project-configuration",
    owner: { kind: "builder-kernel" },
    path: ".egeria/project.yaml",
    ownership: "managed",
  });
  const capabilitySurface = surfaceTargets.createJsonValueSurfaceDescriptor(
    {
      identifier: "standards-package",
      owner: { kind: "capability", identifier: "standards" },
      path: "apps/web/package.json",
      ownership: "merge-managed",
    },
    "/devDependencies/@egeria-systems~1standards",
  );

  assert.deepEqual(builderSurface, {
    identifier: "builder-project-configuration",
    owner: { kind: "builder-kernel" },
    path: ".egeria/project.yaml",
    ownership: "managed",
    fingerprintTarget: { kind: "file" },
    mergeStrategy: "replace-file",
  });
  assert.deepEqual(capabilitySurface, {
    identifier: "standards-package",
    owner: { kind: "capability", identifier: "standards" },
    path: "apps/web/package.json",
    ownership: "merge-managed",
    fingerprintTarget: {
      kind: "json-value",
      pointer: "/devDependencies/@egeria-systems~1standards",
    },
    mergeStrategy: "json-property",
  });
});

test("builder-core exports the executable contract boundary", () => {
  for (const exportName of [
    "capabilityDeliveryModeSchema",
    "capabilityUpgradePersistedVerificationChecks",
    "capabilityUpgradeVerificationChecks",
    "profileTransitionPersistedVerificationChecks",
    "profileTransitionVerificationChecks",
    "capabilityDescriptorSchema",
    "capabilityRemovalPolicySchema",
    "capabilityStateClassificationSchema",
    "analyticsSettingsSchema",
    "calendlyBookingSettingsSchema",
    "certificationRegistrySchema",
    "createJsonSchemaArtifacts",
    "fingerprintSchema",
    "inferenceProbeSchema",
    "installedStateSchema",
    "managedSurfaceDescriptorSchema",
    "migrationRecordSchema",
    "profileRecipeSchema",
    "projectConfigurationSchema",
    "safeRelativePathSchema",
    "semanticVersionSchema",
    "stableIdentifierSchema",
    "surfaceOwnershipModeSchema",
    "validateContract",
  ]) {
    assert.ok(exportName in contracts, `missing ${exportName}`);
  }
});

test("identifier, version, path, and fingerprint contracts reject unsafe values", () => {
  for (const value of ["standards", "site-routing", "identity-2fa"]) {
    assertAccepts(contracts.stableIdentifierSchema, value);
  }
  for (const value of ["Standards", "site_routing", "-site", "site-", "site--routing", ""]) {
    assertRejects(contracts.stableIdentifierSchema, value);
  }

  for (const value of ["0.0.0", "1.2.3", "12.0.34"]) {
    assertAccepts(contracts.semanticVersionSchema, value);
  }
  for (const value of ["1", "1.2", "v1.2.3", "1.2.3-beta.1", "01.2.3"]) {
    assertRejects(contracts.semanticVersionSchema, value);
  }

  for (const value of ["apps/web/package.json", ".egeria/project.yaml", "README.md"]) {
    assertAccepts(contracts.safeRelativePathSchema, value);
  }
  for (const value of [
    "",
    "/apps/web",
    "../secret",
    "apps/../secret",
    "apps//web",
    "apps\\web",
    "apps/\u0000web",
  ]) {
    assertRejects(contracts.safeRelativePathSchema, value);
  }

  assertAccepts(contracts.fingerprintSchema, `sha256:${"f".repeat(64)}`);
  assertRejects(contracts.fingerprintSchema, `sha256:${"F".repeat(64)}`);
  assertRejects(contracts.fingerprintSchema, `sha256:${"f".repeat(63)}`);
});

test("capability vocabulary accepts every enum boundary and rejects invented values", () => {
  for (const value of ["package-backed", "source-generated", "hybrid"]) {
    assertAccepts(contracts.capabilityDeliveryModeSchema, value);
  }
  assertRejects(contracts.capabilityDeliveryModeSchema, "vendored");

  for (const value of [
    "stateless",
    "repository-stateful",
    "external-stateful",
    "persistent-data",
  ]) {
    assertAccepts(contracts.capabilityStateClassificationSchema, value);
  }
  assertRejects(contracts.capabilityStateClassificationSchema, "privileged");

  for (const value of [
    "automatic",
    "reviewed",
    "export-and-remove",
    "eject-only",
    "unsupported",
  ]) {
    assertAccepts(contracts.capabilityRemovalPolicySchema, value);
  }
  assertRejects(contracts.capabilityRemovalPolicySchema, "delete-provider");

  for (const value of ["managed", "merge-managed", "application-owned", "ejected"]) {
    assertAccepts(contracts.surfaceOwnershipModeSchema, value);
  }
  assertRejects(contracts.surfaceOwnershipModeSchema, "generator-owned");
});

test("capability descriptors are strict and preserve state-classification invariants", () => {
  assertAccepts(contracts.capabilityDescriptorSchema, validCapability);
  assertAccepts(contracts.capabilityDescriptorSchema, {
    ...validCapability,
    identifier: "health-check",
    stateClassifications: ["stateless"],
    managedSurfaces: [],
    inferenceProbes: [],
  });

  const { version, ...capabilityWithoutVersion } = validCapability;
  assertRejects(contracts.capabilityDescriptorSchema, {
    ...capabilityWithoutVersion,
    schemaVersion: version,
  });
  assertRejects(contracts.capabilityDescriptorSchema, {
    ...validCapability,
    schemaVersion: validCapability.version,
  });

  assertRejects(contracts.capabilityDescriptorSchema, {
    ...validCapability,
    stateClassifications: [],
  });
  assertRejects(contracts.capabilityDescriptorSchema, {
    ...validCapability,
    stateClassifications: ["repository-stateful", "repository-stateful"],
  });
  assertRejects(contracts.capabilityDescriptorSchema, {
    ...validCapability,
    stateClassifications: ["stateless", "repository-stateful"],
  });
  assertRejects(contracts.capabilityDescriptorSchema, {
    ...validCapability,
    undeclaredMetadata: [],
  });
});

test("probe and managed-surface unions reject mismatched or unsafe structures", () => {
  for (const probe of [
    { kind: "file", path: "apps/web/tsconfig.json" },
    {
      kind: "json-value",
      path: "apps/web/package.json",
      pointer: "/private",
      expected: true,
    },
    {
      kind: "package",
      path: "apps/web/package.json",
      section: "dependencies",
      packageName: "@egeria-systems/observability",
      version: "0.1.0",
    },
  ]) {
    assertAccepts(contracts.inferenceProbeSchema, probe);
  }

  assertRejects(contracts.inferenceProbeSchema, {
    kind: "package",
    path: "../package.json",
    section: "peerDependencies",
    packageName: "example",
    version: "1.0.0",
  });
  for (const surface of [
    {
      ...validCapability.managedSurfaces[0],
      mergeStrategy: "json-property",
    },
    {
      ...validCapability.managedSurfaces[0],
      fingerprintTarget: {
        kind: "json-value",
        pointer: "/dependencies/example",
      },
      mergeStrategy: "replace-file",
    },
  ]) {
    assertMergeTargetIssue(
      contracts.managedSurfaceDescriptorSchema,
      surface,
      ["mergeStrategy"],
    );
  }
  assertRejects(contracts.managedSurfaceDescriptorSchema, {
    ...validCapability.managedSurfaces[0],
    ownership: "ejected",
  });
});

test("project configuration is strict and materializes safe capability identifiers", () => {
  for (const recipeVersion of readableRecipeVersions) {
    assertAccepts(contracts.projectConfigurationSchema, {
      ...validProject,
      recipeVersion,
    });
    assertAccepts(contracts.profileRecipeSchema, {
      ...validProfile,
      recipeVersion,
    });
  }

  assertRejects(contracts.projectConfigurationSchema, {
    ...validProject,
    capabilitySettings: { standards: {} },
  });
  assertRejects(contracts.projectConfigurationSchema, {
    ...validProject,
    selectedCapabilities: ["standards", "standards"],
  });
  assertRejects(contracts.projectConfigurationSchema, {
    ...validProject,
    ejectedAreas: ["../apps/web"],
  });
  assertRejects(contracts.projectConfigurationSchema, {
    ...validProject,
    secret: "must-not-exist",
  });
  assertRejects(contracts.profileRecipeSchema, {
    ...validProfile,
    identifier: "app",
  });
  for (const recipeVersion of ["0.12.0", "0.10", "latest"]) {
    assertRejects(contracts.projectConfigurationSchema, {
      ...validProject,
      recipeVersion,
    });
    assertRejects(contracts.profileRecipeSchema, {
      ...validProfile,
      recipeVersion,
    });
  }
});

test("Calendly settings enforce paired capability state and sanitized destinations", () => {
  const maximumDestination = "https://calendly.com/".padEnd(2_048, "a");

  assertAccepts(contracts.calendlyBookingSettingsSchema, {
    destination: "https://www.calendly.com/acme/intro",
    mode: "link",
  });

  for (const mode of ["link", "inline", "popup"]) {
    const capabilitySettings = {
      "booking-calendly": {
        destination: maximumDestination,
        mode,
      },
    };

    assertAccepts(
      contracts.calendlyBookingSettingsSchema,
      capabilitySettings["booking-calendly"],
    );
    assertAccepts(contracts.projectConfigurationSchema, {
      ...validProject,
      selectedCapabilities: ["standards", "booking-calendly"],
      capabilitySettings,
    });
  }

  assertRejects(contracts.projectConfigurationSchema, {
    ...validProject,
    selectedCapabilities: ["standards", "booking-calendly"],
  });
  assertRejects(contracts.projectConfigurationSchema, {
    ...validProject,
    capabilitySettings: {
      "booking-calendly": validCalendlyBookingSettings,
    },
  });
  assertRejects(contracts.projectConfigurationSchema, {
    ...validProject,
    capabilitySettings: { unknown: {} },
  });
  assertRejects(contracts.calendlyBookingSettingsSchema, {
    ...validCalendlyBookingSettings,
    mode: "widget",
  });
  assertRejects(contracts.calendlyBookingSettingsSchema, {
    ...validCalendlyBookingSettings,
    extra: true,
  });

  const rejectedDestinations = [
    "http://calendly.com/acme/intro",
    "https://calendar.example/acme/intro",
    "https://calendar.example/calendly.com/acme/intro",
    "https://calendly.com/",
    "https://user:password@calendly.com/acme/intro",
    "https://calendly.com/acme/intro#booking",
    "https://www.calendly.com/acme/intro?month=2026-08",
    "https://calendly.com/acme/intro?email=person%40example.com&token=private-token",
    " https://calendly.com/acme/intro",
    "https://calendly.com/acme/intro ",
    "https://calendly.com/acme /intro",
    `${maximumDestination}a`,
  ];

  for (const destination of rejectedDestinations) {
    assertRejects(contracts.calendlyBookingSettingsSchema, {
      destination,
      mode: "popup",
    });

    const result = contracts.validateContract(
      contracts.projectConfigurationSchema,
      {
        ...validProject,
        selectedCapabilities: ["standards", "booking-calendly"],
        capabilitySettings: {
          "booking-calendly": { destination, mode: "popup" },
        },
      },
    );
    assert.equal(result.ok, false);
    const serializedIssues = JSON.stringify(result.issues);
    assert.doesNotMatch(serializedIssues, new RegExp(
      destination.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"),
      "u",
    ));
    for (const sensitiveFragment of [
      "month=2026-08",
      "person%40example.com",
      "private-token",
    ]) {
      if (destination.includes(sensitiveFragment)) {
        assert.equal(serializedIssues.includes(sensitiveFragment), false);
      }
    }
  }
});

test("Calendly settings accept only the default explicit HTTPS port", () => {
  assertAccepts(contracts.calendlyBookingSettingsSchema, {
    destination: "https://calendly.com:443/acme/intro",
    mode: "popup",
  });
  assertRejects(contracts.calendlyBookingSettingsSchema, {
    destination: "https://calendly.com:444/acme/intro",
    mode: "popup",
  });
});

test("analytics settings enforce explicit selection, provider dependencies, and redacted rejection", () => {
  assertAccepts(contracts.analyticsSettingsSchema, validAnalyticsSettings);
  assertAccepts(contracts.analyticsSettingsSchema, {
    consent: { policy: "explicit-opt-in" },
    providers: {},
    operationalIntegrations: {
      googleSearchConsole: {
        verificationToken: "search-console-verification-token",
      },
    },
  });
  assertAccepts(contracts.projectConfigurationSchema, {
    ...validProject,
    selectedCapabilities: ["standards", "analytics"],
    capabilitySettings: { analytics: validAnalyticsSettings },
  });

  for (const invalidSettings of [
    {
      ...validAnalyticsSettings,
      consent: { policy: "advanced-consent-mode" },
    },
    {
      ...validAnalyticsSettings,
      providers: {},
      operationalIntegrations: {},
    },
    {
      ...validAnalyticsSettings,
      providers: {
        microsoftClarity: {
          projectId: "clarity123",
          audience: "general-audience",
        },
      },
      operationalIntegrations: {},
    },
    {
      ...validAnalyticsSettings,
      providers: {},
      operationalIntegrations: {
        lookerStudio: { connector: "google-analytics-4" },
      },
    },
  ]) {
    assertRejects(contracts.analyticsSettingsSchema, invalidSettings);
  }

  assertRejects(contracts.projectConfigurationSchema, {
    ...validProject,
    selectedCapabilities: ["standards", "analytics"],
  });
  assertRejects(contracts.projectConfigurationSchema, {
    ...validProject,
    capabilitySettings: { analytics: validAnalyticsSettings },
  });

  for (const [field, invalidSettings, sensitiveValue] of [
    [
      "cloudflare",
      {
        ...validAnalyticsSettings,
        providers: {
          ...validAnalyticsSettings.providers,
          cloudflareWebAnalytics: { siteToken: "private-cloudflare-token" },
        },
      },
      "private-cloudflare-token",
    ],
    [
      "google",
      {
        ...validAnalyticsSettings,
        providers: {
          ...validAnalyticsSettings.providers,
          googleAnalytics4: { measurementId: "private-google-id" },
        },
      },
      "private-google-id",
    ],
    [
      "clarity",
      {
        ...validAnalyticsSettings,
        providers: {
          ...validAnalyticsSettings.providers,
          microsoftClarity: { projectId: "private!clarity", audience: "not-directed-to-minors" },
        },
      },
      "private!clarity",
    ],
    [
      "search-console",
      {
        ...validAnalyticsSettings,
        operationalIntegrations: {
          ...validAnalyticsSettings.operationalIntegrations,
          googleSearchConsole: { verificationToken: "private token" },
        },
      },
      "private token",
    ],
  ]) {
    const result = contracts.validateContract(
      contracts.analyticsSettingsSchema,
      invalidSettings,
    );
    assert.equal(result.ok, false, field);
    assert.equal(JSON.stringify(result.issues).includes(sensitiveValue), false);
  }
});

test("project display names preserve Unicode while rejecting controls and whitespace-only input", () => {
  const acceptedDisplayNames = [
    "Sample Portfolio",
    "Égeria Studio",
    "👩‍💻 Studio",
    "😀".repeat(120),
  ];
  const rejectedDisplayNames = [
    "",
    " ".repeat(4),
    "😀".repeat(121),
    "Line one\nLine two",
    "unsafe\u0000name",
    "next\u0085line",
  ];

  for (const displayName of acceptedDisplayNames) {
    assertAccepts(contracts.projectConfigurationSchema, {
      ...validProject,
      project: { ...validProject.project, displayName },
    });
  }

  for (const displayName of rejectedDisplayNames) {
    const result = contracts.validateContract(
      contracts.projectConfigurationSchema,
      {
        ...validProject,
        project: { ...validProject.project, displayName },
      },
    );

    assert.equal(result.ok, false);
    assert.deepEqual(result.issues.map((issue) => issue.path), [
      ["project", "displayName"],
    ]);
    assert.ok(result.issues.every((issue) => !("input" in issue)));
    if (displayName.trim().length > 0) {
      assert.equal(
        JSON.stringify(result.issues).includes(
          JSON.stringify(displayName).slice(1, -1),
        ),
        false,
      );
    }
  }
});

test("installed state is strict and records the exact successful generation checks", () => {
  assertAccepts(contracts.installedStateSchema, validState);
  for (const recipeVersion of [
    "0.1.0",
    "0.2.0",
    "0.3.0",
    "0.4.0",
    "0.5.0",
    "0.6.0",
  ]) {
    assertAccepts(contracts.installedStateSchema, {
      ...validState,
      origin: { ...validState.origin, recipeVersion },
      lastSuccessfulVerification: {
        kind: "generation",
        checks: legacyVerificationChecks,
      },
    });
    assertRejects(contracts.installedStateSchema, {
      ...validState,
      origin: { ...validState.origin, recipeVersion },
    });
  }
  assertAccepts(contracts.installedStateSchema, {
    ...validState,
    origin: { ...validState.origin, recipeVersion: "0.8.0" },
  });
  assertAccepts(contracts.installedStateSchema, {
    ...validState,
    origin: { ...validState.origin, recipeVersion: "0.9.0" },
  });
  assertAccepts(contracts.installedStateSchema, {
    ...validState,
    origin: { ...validState.origin, recipeVersion: "0.10.0" },
  });
  assertRejects(contracts.installedStateSchema, {
    ...validState,
    lastSuccessfulVerification: {
      kind: "generation",
      checks: legacyVerificationChecks,
    },
  });
  assertRejects(contracts.installedStateSchema, {
    ...validState,
    origin: { ...validState.origin, recipeVersion: "0.8.0" },
    lastSuccessfulVerification: {
      kind: "generation",
      checks: legacyVerificationChecks,
    },
  });
  assertRejects(contracts.installedStateSchema, {
    ...validState,
    origin: { ...validState.origin, recipeVersion: "0.9.0" },
    lastSuccessfulVerification: {
      kind: "generation",
      checks: legacyVerificationChecks,
    },
  });
  assertRejects(contracts.installedStateSchema, {
    ...validState,
    origin: { ...validState.origin, recipeVersion: "0.10.0" },
    lastSuccessfulVerification: {
      kind: "generation",
      checks: legacyVerificationChecks,
    },
  });
  for (const surface of [
    { ...validInstalledSurface, mergeStrategy: "json-property" },
    {
      ...validInstalledSurface,
      fingerprintTarget: {
        kind: "json-value",
        pointer: "/dependencies/example",
      },
      mergeStrategy: "replace-file",
    },
  ]) {
    assertMergeTargetIssue(
      contracts.installedStateSchema,
      { ...validState, managedSurfaces: [surface] },
      ["managedSurfaces", 0, "mergeStrategy"],
    );
  }
  assertRejects(contracts.installedStateSchema, {
    ...validState,
    builderVersion: "0.0.1",
  });
  assertRejects(contracts.installedStateSchema, {
    ...validState,
    lastSuccessfulVerification: {
      ...validState.lastSuccessfulVerification,
      checks: validState.lastSuccessfulVerification.checks.slice(0, -1),
    },
  });
  assertRejects(contracts.installedStateSchema, {
    ...validState,
    managedSurfaces: [
      {
        ...validInstalledSurface,
        fingerprint: `sha256:${"A".repeat(64)}`,
      },
    ],
  });
  assertRejects(contracts.installedStateSchema, {
    ...validState,
    credentials: { token: "must-not-exist" },
  });
});

test("installed state records only the exact capability-addition verification receipt", () => {
  const capabilityAdditionState = {
    ...validState,
    origin: { ...validState.origin, recipeVersion: "0.10.0" },
    appliedMigrations: ["add-booking-calendly-0-1-0"],
    lastSuccessfulVerification: {
      kind: "capability-addition",
      checks: persistedVerificationChecks,
    },
  };

  assertAccepts(contracts.installedStateSchema, capabilityAdditionState);
  assertRejects(contracts.installedStateSchema, {
    ...capabilityAdditionState,
    lastSuccessfulVerification: {
      ...capabilityAdditionState.lastSuccessfulVerification,
      checks: persistedVerificationChecks.slice(0, -1),
    },
  });
  assertRejects(contracts.installedStateSchema, {
    ...capabilityAdditionState,
    lastSuccessfulVerification: {
      kind: "generation",
      checks: persistedVerificationChecks,
    },
  });
});

test("installed state records only the exact capability-removal verification receipt", () => {
  const capabilityRemovalState = {
    ...validState,
    origin: { ...validState.origin, recipeVersion: "0.10.0" },
    appliedMigrations: ["remove-booking-calendly-0-1-0"],
    lastSuccessfulVerification: {
      kind: "capability-removal",
      checks: persistedVerificationChecks,
    },
  };

  assertAccepts(contracts.installedStateSchema, capabilityRemovalState);
  assertRejects(contracts.installedStateSchema, {
    ...capabilityRemovalState,
    lastSuccessfulVerification: {
      ...capabilityRemovalState.lastSuccessfulVerification,
      checks: persistedVerificationChecks.slice(0, -1),
    },
  });
  assertRejects(contracts.installedStateSchema, {
    ...capabilityRemovalState,
    lastSuccessfulVerification: {
      ...capabilityRemovalState.lastSuccessfulVerification,
      checks: [...persistedVerificationChecks, "unexpected-check"],
    },
  });
  assertRejects(contracts.installedStateSchema, {
    ...capabilityRemovalState,
    lastSuccessfulVerification: {
      ...capabilityRemovalState.lastSuccessfulVerification,
      checks: [
        persistedVerificationChecks[1],
        persistedVerificationChecks[0],
        ...persistedVerificationChecks.slice(2),
      ],
    },
  });
  assertRejects(contracts.installedStateSchema, {
    ...capabilityRemovalState,
    lastSuccessfulVerification: {
      ...capabilityRemovalState.lastSuccessfulVerification,
      checks: [
        ...persistedVerificationChecks,
        "migration-record",
        "post-state-inference",
      ],
    },
  });
  assertRejects(contracts.installedStateSchema, {
    ...capabilityRemovalState,
    lastSuccessfulVerification: {
      kind: "generation",
      checks: persistedVerificationChecks,
    },
  });
});

test("installed state records only the exact capability-upgrade verification receipt", () => {
  const capabilityUpgradeState = {
    ...validState,
    origin: { ...validState.origin, recipeVersion: "0.10.0" },
    appliedMigrations: ["upgrade-standards-0-3-0-to-0-4-0"],
    lastSuccessfulVerification: {
      kind: "capability-upgrade",
      checks: capabilityUpgradePersistedVerificationChecks,
    },
  };

  assert.deepEqual(
    contracts.capabilityUpgradePersistedVerificationChecks,
    capabilityUpgradePersistedVerificationChecks,
  );
  assert.deepEqual(
    contracts.capabilityUpgradeVerificationChecks,
    capabilityUpgradeVerificationChecks,
  );
  assertAccepts(contracts.installedStateSchema, capabilityUpgradeState);
  for (const checks of [
    capabilityUpgradePersistedVerificationChecks.slice(0, -1),
    [
      capabilityUpgradePersistedVerificationChecks[1],
      capabilityUpgradePersistedVerificationChecks[0],
      ...capabilityUpgradePersistedVerificationChecks.slice(2),
    ],
    [
      capabilityUpgradePersistedVerificationChecks[0],
      capabilityUpgradePersistedVerificationChecks[0],
      ...capabilityUpgradePersistedVerificationChecks.slice(2),
    ],
    [...capabilityUpgradePersistedVerificationChecks, "unexpected-check"],
    currentVerificationChecks,
    capabilityAdditionVerificationChecks,
    capabilityRemovalVerificationChecks,
  ]) {
    assertRejects(contracts.installedStateSchema, {
      ...capabilityUpgradeState,
      lastSuccessfulVerification: {
        kind: "capability-upgrade",
        checks,
      },
    });
  }
});

test("migration records describe only completed migration or reconciliation work", () => {
  assertAccepts(contracts.migrationRecordSchema, validMigrationRecord);
  assertAccepts(contracts.migrationRecordSchema, {
    ...validMigrationRecord,
    identifier: "capability-migration",
    kind: "migration",
  });
  assertRejects(contracts.migrationRecordSchema, {
    ...validMigrationRecord,
    outcome: "planned",
  });
  assertRejects(contracts.migrationRecordSchema, {
    ...validMigrationRecord,
    completedAt: "not-a-date",
  });
  assertRejects(contracts.migrationRecordSchema, {
    ...validMigrationRecord,
    providerToken: "must-not-exist",
  });
});

test("contract failures have deterministic paths without echoing invalid values", () => {
  const result = contracts.validateContract(contracts.projectConfigurationSchema, {
    ...validProject,
    project: { ...validProject.project, name: "Bad Name" },
    selectedCapabilities: ["Bad Capability"],
    ejectedAreas: ["../secret"],
  });

  assert.equal(result.ok, false);
  assert.deepEqual(
    result.issues.map((issue) => issue.path),
    [
      ["ejectedAreas", 0],
      ["project", "name"],
      ["selectedCapabilities", 0],
    ],
  );
  assert.ok(result.issues.every((issue) => issue.code === "CONTRACT_VALIDATION_FAILED"));
  assert.doesNotMatch(JSON.stringify(result.issues), /Bad Name|Bad Capability|\.\.\/secret/);
});

test("checked JSON Schema artifacts match the executable Draft 2020-12 contracts", async () => {
  const generated = contracts.createJsonSchemaArtifacts();
  assert.deepEqual(Object.keys(generated), schemaArtifactNames);
  assert.equal(
    generated["profile.schema.json"].title,
    "Egeria portfolio and site profile recipe",
  );
  assert.equal(
    generated["certification-registry.schema.json"].title,
    "Egeria capability certification coverage registry",
  );
  for (const [artifactName, recipeVersionSchema] of [
    [
      "profile.schema.json",
      generated["profile.schema.json"].properties.recipeVersion,
    ],
    [
      "project.schema.json",
      generated["project.schema.json"].properties.recipeVersion,
    ],
    [
      "state.schema.json",
      generated["state.schema.json"].properties.origin.properties.recipeVersion,
    ],
  ]) {
    assert.deepEqual(
      recipeVersionSchema.enum,
      readableRecipeVersions,
      `${artifactName} must retain every readable recipe version`,
    );
  }
  const verificationCheckTuples =
    generated["state.schema.json"].properties.lastSuccessfulVerification.oneOf
      .flatMap(({ properties }) =>
        properties.checks.anyOf ?? [properties.checks],
      );
  assert.equal(
    generated["state.schema.json"].properties.schemaVersion.const,
    "1.0.0",
  );
  assert.deepEqual(
    generated["state.schema.json"].properties.lastSuccessfulVerification.oneOf.map(
      ({ properties }) => properties.kind.const,
    ),
    [
      "generation",
      "capability-addition",
      "capability-removal",
      "capability-upgrade",
      "profile-transition",
    ],
  );
  const capabilityUpgradeSchema =
    generated["state.schema.json"].properties.lastSuccessfulVerification.oneOf.find(
      ({ properties }) => properties.kind.const === "capability-upgrade",
    );
  assert.deepEqual(
    capabilityUpgradeSchema.properties.checks.prefixItems.map(({ const: value }) => value),
    capabilityUpgradePersistedVerificationChecks,
  );
  const profileTransitionSchema =
    generated["state.schema.json"].properties.lastSuccessfulVerification.oneOf.find(
      ({ properties }) => properties.kind.const === "profile-transition",
    );
  assert.deepEqual(
    profileTransitionSchema.properties.checks.prefixItems.map(
      ({ const: value }) => value,
    ),
    profileTransitionPersistedVerificationChecks,
  );
  for (const tuple of verificationCheckTuples) {
    assert.equal(tuple.minItems, tuple.prefixItems.length);
    assert.equal(tuple.maxItems, tuple.prefixItems.length);
  }
  const displayNamePattern = /^(?=.{1,120}$)(?=.*\S)[^\p{Cc}]+$/u;
  const projectDisplayNamePattern =
    generated["project.schema.json"].properties.project.properties.displayName
      .pattern;
  const calendlyDestinationContract =
    generated["project.schema.json"].properties.capabilitySettings.properties[
      "booking-calendly"
    ].properties.destination;

  assert.deepEqual(
    Object.keys(
      generated["project.schema.json"].properties.capabilitySettings
        .properties,
    ),
    ["analytics", "booking-calendly"],
  );
  assert.equal(
    generated["project.schema.json"].properties.capabilitySettings
      .additionalProperties,
    false,
  );
  assert.equal(calendlyDestinationContract.maxLength, 2_048);
  assert.equal(typeof calendlyDestinationContract.pattern, "string");
  const calendlyDestinationPattern = new RegExp(
    calendlyDestinationContract.pattern,
    "u",
  );
  for (const destination of [
    "https://calendly.com/acme/intro",
    "https://calendly.com:443/acme/intro",
    "https://www.calendly.com/acme/intro",
  ]) {
    assert.match(destination, calendlyDestinationPattern);
  }
  for (const destination of [
    "http://calendly.com/acme/intro",
    "https://calendar.example/calendly.com/acme/intro",
    "https://calendly.com/",
    "https://calendly.com:444/acme/intro",
    "https://user@calendly.com/acme/intro",
    "https://www.calendly.com/acme/intro?month=2026-08",
    "https://calendly.com/acme/intro?email=person%40example.com&token=private-token",
    "https://calendly.com/acme/intro#booking",
    " https://calendly.com/acme/intro",
  ]) {
    assert.doesNotMatch(destination, calendlyDestinationPattern);
  }

  assert.equal(projectDisplayNamePattern, displayNamePattern.source);
  const schemaDisplayNamePattern = new RegExp(projectDisplayNamePattern, "u");
  for (const displayName of [
    "Sample Portfolio",
    "Égeria Studio",
    "👩‍💻 Studio",
    "😀".repeat(120),
  ]) {
    assert.match(displayName, schemaDisplayNamePattern);
  }
  for (const displayName of [
    "",
    " ".repeat(4),
    "😀".repeat(121),
    "Line one\nLine two",
    "unsafe\u0000name",
    "next\u0085line",
  ]) {
    assert.doesNotMatch(displayName, schemaDisplayNamePattern);
  }

  for (const artifactName of schemaArtifactNames) {
    const artifact = JSON.parse(
      await readFile(resolve(packageRoot, "schemas", artifactName), "utf8"),
    );
    assert.equal(
      artifact.$schema,
      "https://json-schema.org/draft/2020-12/schema",
    );
    assert.deepEqual(artifact, generated[artifactName]);
  }
});

test("the schema generator checks artifacts without rewriting them", async () => {
  const artifactPath = resolve(packageRoot, "schemas", schemaArtifactNames[0]);
  const before = await readFile(artifactPath, "utf8");

  await execFileAsync("node", [
    resolve(packageRoot, "scripts/generate-json-schemas.mjs"),
    "--check",
  ]);

  assert.equal(await readFile(artifactPath, "utf8"), before);
  await assert.rejects(
    execFileAsync("node", [
      resolve(packageRoot, "scripts/generate-json-schemas.mjs"),
      "--unsupported",
    ]),
  );
});
