import assert from "node:assert/strict";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import test from "node:test";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const builtEntry = resolve(packageRoot, "dist/index.js");
const core = await import(pathToFileURL(builtEntry));
const encoder = new TextEncoder();

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

function assertOk(result) {
  assert.equal(result.ok, true, JSON.stringify(result.issues));
  return result.value;
}

function assertIssue(result, code, pathPrefix = []) {
  assert.equal(result.ok, false);
  assert.equal(result.issues[0]?.code, code);
  assert.deepEqual(result.issues[0]?.path.slice(0, pathPrefix.length), pathPrefix);
}

function createFileSurface(identifier, path = "apps/web/tsconfig.json") {
  return {
    identifier,
    owner: { kind: "capability", identifier: "standards" },
    path,
    ownership: "managed",
    fingerprintTarget: { kind: "file" },
    mergeStrategy: "replace-file",
  };
}

function createJsonSurface(identifier, pointer, path = "apps/web/package.json") {
  return {
    identifier,
    owner: { kind: "capability", identifier: "standards" },
    path,
    ownership: "merge-managed",
    fingerprintTarget: { kind: "json-value", pointer },
    mergeStrategy: "json-property",
  };
}

test("builder-core exports the approved state codec and ownership API", () => {
  for (const exportName of [
    "fingerprintFileContent",
    "fingerprintJsonValue",
    "materializeInstalledSurfaces",
    "parseMigrationLog",
    "parseProjectYaml",
    "parseStateJson",
    "serializeMigrationRecord",
    "serializeProjectYaml",
    "serializeStateJson",
  ]) {
    assert.equal(typeof core[exportName], "function", `missing ${exportName}`);
  }
});

test("project YAML uses strict YAML 1.2 semantics and deterministic serialization", () => {
  const source = `schemaVersion: 1.0.0
builderCompatibility: 0.0.0
project:
  name: sample-portfolio
  displayName: No
  defaultLocale: en-CA
originProfile: portfolio
recipeVersion: 0.1.0
platformAdapter: cloudflare-workers
selectedCapabilities:
  - standards
capabilitySettings: {}
ejectedAreas: []
`;

  const parsed = assertOk(core.parseProjectYaml(source));
  assert.equal(parsed.project.displayName, "No");

  const serialized = core.serializeProjectYaml(validProject);
  assert.equal(
    serialized,
    `builderCompatibility: 0.0.0
capabilitySettings: {}
ejectedAreas: []
originProfile: portfolio
platformAdapter: cloudflare-workers
project:
  defaultLocale: en-CA
  displayName: Sample Portfolio
  name: sample-portfolio
recipeVersion: 0.1.0
schemaVersion: 1.0.0
selectedCapabilities:
  - standards
`,
  );
  assert.equal(serialized, core.serializeProjectYaml(validProject));
  assert.deepEqual(assertOk(core.parseProjectYaml(serialized)), validProject);
});

test("project YAML rejects unsafe document features without echoing source", () => {
  const cases = [
    `schemaVersion: 1.0.0\nschemaVersion: 1.0.0\nsecret: duplicate-value\n`,
    `project: &project { name: secret-anchor }\ncopy: *project\n`,
    `schemaVersion: 1.0.0\n---\nsecret: second-document\n`,
    `schemaVersion: !!timestamp 2026-08-05\nsecret: tagged-value\n`,
  ];

  for (const source of cases) {
    const result = core.parseProjectYaml(source);
    assertIssue(result, "PROJECT_YAML_INVALID");
    assert.doesNotMatch(JSON.stringify(result.issues), /secret|duplicate-value|secret-anchor|second-document|tagged-value/);
  }

  const schemaResult = core.parseProjectYaml(`schemaVersion: 1.0.0
builderCompatibility: 0.0.0
project:
  name: sample-portfolio
  displayName: Sample Portfolio
  defaultLocale: en-CA
originProfile: portfolio
recipeVersion: 0.1.0
platformAdapter: cloudflare-workers
selectedCapabilities:
  - standards
capabilitySettings: {}
ejectedAreas: []
unknownKey: secret-schema-value
`);
  assertIssue(schemaResult, "PROJECT_SCHEMA_INVALID");
  assert.doesNotMatch(JSON.stringify(schemaResult.issues), /secret-schema-value/);

  const dynamicKeyResult = core.parseProjectYaml(`schemaVersion: 1.0.0
builderCompatibility: 0.0.0
project:
  name: sample-portfolio
  displayName: Sample Portfolio
  defaultLocale: en-CA
originProfile: portfolio
recipeVersion: 0.1.0
platformAdapter: cloudflare-workers
selectedCapabilities:
  - standards
capabilitySettings:
  leaked-key: secret-setting
ejectedAreas: []
`);
  assertIssue(dynamicKeyResult, "PROJECT_SCHEMA_INVALID");
  assert.doesNotMatch(
    JSON.stringify(dynamicKeyResult.issues),
    /leaked-key|secret-setting/,
  );
});

test("state JSON is strict, canonical, and content-safe", () => {
  const serialized = core.serializeStateJson(validState);
  assert.equal(serialized.endsWith("\n"), true);
  assert.equal(serialized.endsWith("\n\n"), false);
  assert.equal(serialized, core.serializeStateJson(validState));
  assert.ok(serialized.indexOf('"appliedMigrations"') < serialized.indexOf('"builderVersion"'));
  assert.deepEqual(assertOk(core.parseStateJson(serialized)), validState);

  const invalidJson = core.parseStateJson('{"token":"secret-state"');
  assertIssue(invalidJson, "STATE_JSON_INVALID");
  assert.doesNotMatch(JSON.stringify(invalidJson.issues), /secret-state/);

  const invalidSchema = core.parseStateJson(
    JSON.stringify({ ...validState, token: "secret-state" }),
  );
  assertIssue(invalidSchema, "STATE_SCHEMA_INVALID");
  assert.doesNotMatch(JSON.stringify(invalidSchema.issues), /secret-state/);
});

test("migration JSONL preserves source line numbers and serializes one canonical record", () => {
  assert.deepEqual(assertOk(core.parseMigrationLog("\n  \n")), []);

  const line = core.serializeMigrationRecord(validMigrationRecord);
  assert.equal(
    line,
    `${JSON.stringify({
      capabilities: ["standards"],
      completedAt: "2026-08-05T16:00:00.000Z",
      fromBuilderVersion: "0.0.0",
      identifier: "initial-generation-reconciliation",
      kind: "reconciliation",
      outcome: "succeeded",
      persistentDataAuthorizations: [],
      remainingKnownDrift: [],
      schemaVersion: "1.0.0",
      toBuilderVersion: "0.0.0",
      verificationChecks: ["contracts"],
    })}\n`,
  );
  assert.deepEqual(assertOk(core.parseMigrationLog(`\n${line}\n`)), [validMigrationRecord]);

  const invalidJson = core.parseMigrationLog(`\n\n{"token":"secret-migration"\n`);
  assertIssue(invalidJson, "MIGRATION_JSON_INVALID", [3]);
  assert.doesNotMatch(JSON.stringify(invalidJson.issues), /secret-migration/);

  const invalidSchema = core.parseMigrationLog(
    `\n${JSON.stringify({ ...validMigrationRecord, token: "secret-migration" })}\n`,
  );
  assertIssue(invalidSchema, "MIGRATION_SCHEMA_INVALID", [2]);
  assert.doesNotMatch(JSON.stringify(invalidSchema.issues), /secret-migration/);
});

test("serializers reject invalid runtime values with stable TypeError codes", () => {
  assert.throws(
    () => core.serializeProjectYaml({ ...validProject, token: "secret-project" }),
    (error) => error instanceof TypeError && error.message === "PROJECT_SCHEMA_INVALID",
  );
  assert.throws(
    () => core.serializeStateJson({ ...validState, token: "secret-state" }),
    (error) => error instanceof TypeError && error.message === "STATE_SCHEMA_INVALID",
  );
  assert.throws(
    () => core.serializeMigrationRecord({ ...validMigrationRecord, outcome: "planned" }),
    (error) => error instanceof TypeError && error.message === "MIGRATION_SCHEMA_INVALID",
  );
});

test("file and canonical JSON fingerprints use exact lowercase SHA-256", () => {
  assert.equal(
    core.fingerprintFileContent(encoder.encode("hello")),
    "sha256:2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
  );
  assert.equal(
    core.fingerprintJsonValue({ b: 2, a: 1 }),
    "sha256:43258cff783fe7036d8a43033f830adfc60ec037382473548ac742b888292777",
  );
  assert.equal(
    core.fingerprintJsonValue({ a: 1, b: 2 }),
    core.fingerprintJsonValue({ b: 2, a: 1 }),
  );
  assert.notEqual(
    core.fingerprintJsonValue([1, 2]),
    core.fingerprintJsonValue([2, 1]),
  );
  assert.equal(
    core.fingerprintJsonValue({ z: { b: 2, a: 1 }, a: [{ d: 4, c: 3 }] }),
    core.fingerprintJsonValue({ a: [{ c: 3, d: 4 }], z: { a: 1, b: 2 } }),
  );
});

test("canonical JSON rejects sparse arrays and non-index array properties", () => {
  assert.throws(
    () => core.fingerprintJsonValue(new Array(1)),
    (error) => error instanceof TypeError && error.message === "JSON_VALUE_INVALID",
  );

  const arrayWithProperty = [];
  arrayWithProperty.extra = "secret-array-property";
  assert.throws(
    () => core.fingerprintJsonValue(arrayWithProperty),
    (error) => error instanceof TypeError && error.message === "JSON_VALUE_INVALID",
  );
});

test("surface materialization hashes exact bytes and escaped JSON Pointer values", () => {
  const fileSurface = createFileSurface("standards-typescript");
  const jsonSurface = createJsonSurface(
    "standards-package",
    "/a~1b/~0key/0",
  );
  const files = new Map([
    ["apps/web/tsconfig.json", encoder.encode("hello")],
    [
      "apps/web/package.json",
      encoder.encode(JSON.stringify({ "a/b": { "~key": ["first", "second"] } })),
    ],
  ]);

  const surfaces = assertOk(
    core.materializeInstalledSurfaces({
      files,
      surfaces: [jsonSurface, fileSurface],
    }),
  );

  assert.deepEqual(
    surfaces.map(({ identifier }) => identifier),
    ["standards-package", "standards-typescript"],
  );
  assert.equal(
    surfaces[0].fingerprint,
    core.fingerprintJsonValue("first"),
  );
  assert.equal(
    surfaces[1].fingerprint,
    core.fingerprintFileContent(encoder.encode("hello")),
  );
});

test("surface materialization returns sanitized missing-source and pointer issues", () => {
  const missingSource = core.materializeInstalledSurfaces({
    files: new Map(),
    surfaces: [createFileSurface("standards-typescript")],
  });
  assertIssue(missingSource, "SURFACE_SOURCE_MISSING", ["surfaces", 0]);

  for (const [content, pointer] of [
    ["{\"token\":\"secret-json\"", "/token"],
    [JSON.stringify({ items: ["secret-json"] }), "/items/01"],
    [JSON.stringify({ token: "secret-json" }), "/missing"],
  ]) {
    const result = core.materializeInstalledSurfaces({
      files: new Map([["apps/web/package.json", encoder.encode(content)]]),
      surfaces: [createJsonSurface("standards-package", pointer)],
    });
    assertIssue(result, "SURFACE_POINTER_MISSING", ["surfaces", 0]);
    assert.doesNotMatch(JSON.stringify(result.issues), /secret-json/);
  }
});

test("surface materialization validates runtime descriptors before projection", () => {
  const result = core.materializeInstalledSurfaces({
    files: new Map([
      ["apps/web/tsconfig.json", encoder.encode("hello")],
    ]),
    surfaces: [
      {
        ...createFileSurface("standards-typescript"),
        ownership: "ejected",
        secretProperty: "secret-descriptor",
      },
    ],
  });

  assertIssue(result, "SURFACE_TARGET_INVALID", ["surfaces", 0]);
  assert.doesNotMatch(JSON.stringify(result.issues), /secret-descriptor/);
});

test("surface materialization rejects duplicate, self, and overlapping ownership targets", () => {
  const cases = [
    [
      createFileSurface("duplicate"),
      createFileSurface("duplicate", "apps/web/eslint.config.mjs"),
    ],
    [createFileSurface("state", ".egeria/state.json")],
    [
      createFileSurface("package-file", "apps/web/package.json"),
      createJsonSurface("package-pointer", "/dependencies/example"),
    ],
    [
      createFileSurface("package-file-first", "apps/web/package.json"),
      createFileSurface("package-file-second", "apps/web/package.json"),
    ],
    [
      createJsonSurface("package-parent", "/dependencies"),
      createJsonSurface("package-child", "/dependencies/example"),
    ],
    [
      createJsonSurface("package-first", "/dependencies/example"),
      createJsonSurface("package-second", "/dependencies/example"),
    ],
  ];

  for (const surfaces of cases) {
    const result = core.materializeInstalledSurfaces({
      files: new Map(),
      surfaces,
    });
    assertIssue(result, "SURFACE_TARGET_DUPLICATE");
  }

  const siblingSurfaces = [
    createJsonSurface("package-a", "/dependencies/a"),
    createJsonSurface("package-b", "/dependencies/b"),
  ];
  const siblingResult = core.materializeInstalledSurfaces({
    files: new Map([
      [
        "apps/web/package.json",
        encoder.encode(JSON.stringify({ dependencies: { a: "1.0.0", b: "2.0.0" } })),
      ],
    ]),
    surfaces: siblingSurfaces,
  });
  assert.equal(siblingResult.ok, true, JSON.stringify(siblingResult.issues));
});
