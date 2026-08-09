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

const schemaArtifactNames = [
  "capability.schema.json",
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

const validInstalledSurface = {
  identifier: "standards-typescript",
  owner: { kind: "capability", identifier: "standards" },
  path: "apps/web/tsconfig.json",
  ownership: "managed",
  fingerprintTarget: { kind: "file" },
  mergeStrategy: "replace-file",
  fingerprint: `sha256:${"a".repeat(64)}`,
};

const validState = {
  schemaVersion: "1.0.0",
  builderVersion: "0.0.0",
  projectSchemaVersion: "1.0.0",
  origin: { profile: "portfolio", recipeVersion: "0.1.0" },
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
    checks: [
      "contracts",
      "pre-state-inference",
      "lockfile",
      "frozen-install",
      "lint",
      "typecheck",
      "next-build",
      "opennext-build",
      "post-state-inference",
    ],
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

test("builder-core exports the executable contract boundary", () => {
  for (const exportName of [
    "capabilityDeliveryModeSchema",
    "capabilityDescriptorSchema",
    "capabilityRemovalPolicySchema",
    "capabilityStateClassificationSchema",
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
  assertAccepts(contracts.projectConfigurationSchema, validProject);
  assertAccepts(contracts.profileRecipeSchema, validProfile);
  assertAccepts(contracts.projectConfigurationSchema, {
    ...validProject,
    recipeVersion: "0.2.0",
  });
  assertAccepts(contracts.profileRecipeSchema, {
    ...validProfile,
    recipeVersion: "0.2.0",
  });

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
  assertRejects(contracts.projectConfigurationSchema, {
    ...validProject,
    recipeVersion: "0.3.0",
  });
  assertRejects(contracts.profileRecipeSchema, {
    ...validProfile,
    recipeVersion: "0.3.0",
  });
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
  assertAccepts(contracts.installedStateSchema, {
    ...validState,
    origin: { ...validState.origin, recipeVersion: "0.2.0" },
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
  assertRejects(contracts.installedStateSchema, {
    ...validState,
    origin: { ...validState.origin, recipeVersion: "0.3.0" },
  });
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
  const displayNamePattern = /^(?=.{1,120}$)(?=.*\S)[^\p{Cc}]+$/u;
  const projectDisplayNamePattern =
    generated["project.schema.json"].properties.project.properties.displayName
      .pattern;

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
