import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { chmod, lstat, mkdir, mkdtemp, readFile, readdir, readlink, rename, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import test from "node:test";

const execFileAsync = promisify(execFile);
const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const builtEntry = resolve(packageRoot, "dist/index.js");
const typeScriptCompiler = resolve(packageRoot, "node_modules/typescript/bin/tsc");
const core = await import(pathToFileURL(builtEntry));
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

function createDescriptor(identifier, probes) {
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

function createState(overrides = {}) {
  return {
    schemaVersion: "1.0.0",
    builderVersion: "0.0.0",
    projectSchemaVersion: "1.0.0",
    origin: { profile: "portfolio", recipeVersion: "0.1.0" },
    installedCapabilities: [],
    appliedMigrations: [],
    managedSurfaces: [],
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

function createSurface({
  identifier,
  path,
  ownership = "managed",
  fingerprintTarget = { kind: "file" },
  mergeStrategy = "replace-file",
  fingerprint,
}) {
  return {
    identifier,
    owner: { kind: "builder-kernel" },
    path,
    ownership,
    fingerprintTarget,
    mergeStrategy,
    fingerprint,
  };
}

async function snapshotDirectory(root) {
  const entries = [];

  async function visit(path, relativePath) {
    const stats = await lstat(path);
    const common = {
      path: relativePath,
      mode: stats.mode,
      size: stats.size,
      modified: stats.mtimeMs,
    };

    if (stats.isSymbolicLink()) {
      entries.push({ ...common, kind: "symlink", target: await readlink(path) });
      return;
    }

    if (stats.isDirectory()) {
      entries.push({ ...common, kind: "directory" });
      const names = (await readdir(path)).sort();

      for (const name of names) {
        await visit(join(path, name), relativePath === "." ? name : `${relativePath}/${name}`);
      }

      return;
    }

    if (stats.isFile()) {
      try {
        entries.push({ ...common, kind: "file", content: (await readFile(path)).toString("base64") });
      } catch (error) {
        entries.push({ ...common, kind: "file", readError: error?.code ?? "unknown" });
      }
      return;
    }

    entries.push({ ...common, kind: "other" });
  }

  await visit(root, ".");
  return entries;
}

async function withUnchangedTemporaryDirectory(setup, exercise) {
  const owner = await mkdtemp(join(tmpdir(), "egeria-repository-reader-"));

  try {
    const value = await setup(owner);
    const before = await snapshotDirectory(owner);
    const result = await exercise(value);
    const after = await snapshotDirectory(owner);
    assert.deepEqual(after, before, "read-only scenario changed its temporary directory");
    return result;
  } finally {
    await rm(owner, { recursive: true, force: true });
  }
}

function stateFiles(state, files = {}) {
  return {
    ".egeria/state.json": core.serializeStateJson(state),
    ...files,
  };
}

test("builder-core exports the approved read-only inference API", () => {
  for (const exportName of [
    "createFileSystemRepositoryReader",
    "createInMemoryRepositoryReader",
    "inferRepository",
  ]) {
    assert.equal(typeof core[exportName], "function", `missing ${exportName}`);
  }
});

test("the package root exposes every approved read-only inference type", async () => {
  const temporaryRoot = await mkdtemp(join(tmpdir(), "egeria-inference-types-"));

  try {
    const packageScope = join(temporaryRoot, "node_modules", "@egeria-systems");
    const consumer = join(temporaryRoot, "consumer.ts");
    await mkdir(packageScope, { recursive: true });
    await symlink(packageRoot, join(packageScope, "builder-core"), "dir");
    await writeFile(
      consumer,
      `import type {
  CapabilityEvidence,
  EvidenceCategory,
  ProbeEvidence,
  ProbeEvidenceStatus,
  RepositoryInference,
  RepositoryReader,
  RepositoryReadErrorCode,
  RepositoryReadResult,
  RepositoryStateEvidence,
  SurfaceEvidence,
  SurfaceEvidenceStatus,
} from "@egeria-systems/builder-core";

const errorCode: RepositoryReadErrorCode = "READ_FAILED";
const readResult: RepositoryReadResult = { kind: "error", code: errorCode };
const reader: RepositoryReader = { readText: async () => readResult };
const probeStatus: ProbeEvidenceStatus = "present";
const probe: ProbeEvidence = { kind: "file", path: "file.txt", status: probeStatus };
const category: EvidenceCategory = "confirmed";
const capability: CapabilityEvidence = { identifier: "example", category, probes: [probe] };
const surfaceStatus: SurfaceEvidenceStatus = "confirmed";
const surface: SurfaceEvidence = { identifier: "surface", path: "file.txt", status: surfaceStatus };
const state: RepositoryStateEvidence = { kind: "missing" };
const inference: RepositoryInference = { state, capabilities: [capability], surfaces: [surface] };
void [reader, inference];
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

test("the in-memory reader validates paths before returning content or absence", async () => {
  const reader = core.createInMemoryRepositoryReader({
    "apps/web/file.txt": "safe content",
  });

  assert.deepEqual(await reader.readText("apps/web/file.txt"), {
    kind: "file",
    content: "safe content",
  });
  assert.deepEqual(await reader.readText("apps/web/missing.txt"), { kind: "missing" });

  for (const path of [
    "/absolute.txt",
    "../outside.txt",
    "apps/../outside.txt",
    "apps\\outside.txt",
    "C:/outside.txt",
    "apps/web/line\nbreak.txt",
  ]) {
    assert.deepEqual(await reader.readText(path), {
      kind: "error",
      code: "PATH_INVALID",
    });
  }
});

test("the filesystem reader returns a safe file and missing result without changing its root", async () => {
  await withUnchangedTemporaryDirectory(
    async (owner) => {
      const root = join(owner, "repository");
      await mkdir(join(root, "apps", "web"), { recursive: true });
      await writeFile(join(root, "apps", "web", "file.txt"), "safe content", "utf8");
      return core.createFileSystemRepositoryReader(root);
    },
    async (reader) => {
      assert.deepEqual(await reader.readText("apps/web/file.txt"), {
        kind: "file",
        content: "safe content",
      });
      assert.deepEqual(await reader.readText("apps/web/missing.txt"), { kind: "missing" });
    },
  );
});

test("the filesystem reader rejects invalid roots and requested paths without mutation", async () => {
  const cases = [
    async (owner) => join(owner, "missing-root"),
    async (owner) => {
      const root = join(owner, "root-file");
      await writeFile(root, "not a directory", "utf8");
      return root;
    },
    async (owner) => {
      const target = join(owner, "target");
      const root = join(owner, "root-link");
      await mkdir(target);
      await symlink(target, root);
      return root;
    },
  ];

  for (const setupRoot of cases) {
    await withUnchangedTemporaryDirectory(
      setupRoot,
      async (root) => {
        const reader = core.createFileSystemRepositoryReader(root);
        assert.deepEqual(await reader.readText("apps/web/file.txt"), {
          kind: "error",
          code: "PATH_INVALID",
        });
      },
    );
  }

  await withUnchangedTemporaryDirectory(
    async (owner) => {
      const root = join(owner, "repository");
      await mkdir(root);
      return core.createFileSystemRepositoryReader(root);
    },
    async (reader) => {
      assert.deepEqual(await reader.readText("../outside.txt"), {
        kind: "error",
        code: "PATH_INVALID",
      });
    },
  );
});

test("the filesystem reader rejects symlink ancestors and leaves without following them", async () => {
  for (const leaf of [false, true]) {
    await withUnchangedTemporaryDirectory(
      async (owner) => {
        const root = join(owner, "repository");
        const outside = join(owner, "outside.txt");
        await mkdir(join(root, "apps"), { recursive: true });
        await writeFile(outside, "outside secret", "utf8");

        if (leaf) {
          await mkdir(join(root, "apps", "web"));
          await symlink(outside, join(root, "apps", "web", "file.txt"));
        } else {
          await symlink(owner, join(root, "apps", "web"));
        }

        return core.createFileSystemRepositoryReader(root);
      },
      async (reader) => {
        assert.deepEqual(await reader.readText("apps/web/file.txt"), { kind: "symlink" });
      },
    );
  }
});

test("the filesystem reader keeps one root identity across reads", async () => {
  const owner = await mkdtemp(join(tmpdir(), "egeria-repository-identity-"));

  try {
    const root = join(owner, "repository");
    const priorRoot = join(owner, "prior-repository");
    await mkdir(root);
    await writeFile(join(root, "file.txt"), "repository-a", "utf8");
    const reader = core.createFileSystemRepositoryReader(root);

    assert.deepEqual(await reader.readText("file.txt"), {
      kind: "file",
      content: "repository-a",
    });

    await rename(root, priorRoot);
    await mkdir(root);
    await writeFile(join(root, "file.txt"), "repository-b", "utf8");

    assert.deepEqual(await reader.readText("file.txt"), {
      kind: "error",
      code: "PATH_INVALID",
    });
  } finally {
    await rm(owner, { recursive: true, force: true });
  }
});

test("the filesystem reader fixes its root identity at construction", async () => {
  const owner = await mkdtemp(join(tmpdir(), "egeria-repository-construction-"));

  try {
    const root = join(owner, "repository");
    const priorRoot = join(owner, "prior-repository");
    await mkdir(root);
    await writeFile(join(root, "file.txt"), "repository-a", "utf8");
    const reader = core.createFileSystemRepositoryReader(root);

    await rename(root, priorRoot);
    await mkdir(root);
    await writeFile(join(root, "file.txt"), "repository-b", "utf8");

    assert.deepEqual(await reader.readText("file.txt"), {
      kind: "error",
      code: "PATH_INVALID",
    });
  } finally {
    await rm(owner, { recursive: true, force: true });
  }
});

test("the filesystem reader bounds type, size, UTF-8, and read failures without mutation", async () => {
  const scenarios = [
    {
      expected: { kind: "error", code: "FILE_TYPE_UNSUPPORTED" },
      setup: async (path) => mkdir(path, { recursive: true }),
    },
    {
      expected: { kind: "error", code: "FILE_TOO_LARGE" },
      setup: async (path) => writeFile(path, Buffer.alloc(1024 * 1024 + 1, 97)),
    },
    {
      expected: { kind: "error", code: "FILE_ENCODING_INVALID" },
      setup: async (path) => writeFile(path, Buffer.from([0xc3, 0x28])),
    },
    {
      expected: { kind: "error", code: "READ_FAILED" },
      setup: async (path) => {
        await writeFile(path, "unreadable", "utf8");
        await chmod(path, 0);
      },
    },
  ];

  for (const scenario of scenarios) {
    await withUnchangedTemporaryDirectory(
      async (owner) => {
        const root = join(owner, "repository");
        const path = join(root, "apps", "web", "target");
        await mkdir(dirname(path), { recursive: true });
        await scenario.setup(path);
        return core.createFileSystemRepositoryReader(root);
      },
      async (reader) => {
        assert.deepEqual(await reader.readText("apps/web/target"), scenario.expected);
      },
    );
  }
});

test("probe evidence is deterministic, exact, RFC 6901 aware, and content-safe", async () => {
  const descriptor = createDescriptor("probe-evidence", [
    { kind: "package", path: "apps/web/package.json", section: "dependencies", packageName: "example", version: "1.2.3" },
    { kind: "json-value", path: "apps/web/config.json", pointer: "/a~1b/~0key", expected: true },
    { kind: "file", path: "apps/web/present.txt" },
    { kind: "json-value", path: "apps/web/config.json", pointer: "/missing", expected: "expected-public-value" },
    { kind: "package", path: "apps/web/package.json", section: "devDependencies", packageName: "other", version: "1.0.0" },
  ]);
  const reader = core.createInMemoryRepositoryReader({
    "apps/web/config.json": JSON.stringify({ "a/b": { "~key": true }, private: "super-secret-json" }),
    "apps/web/package.json": JSON.stringify({
      dependencies: { example: "1.2.3" },
      devDependencies: { other: "9.9.9-super-secret-version" },
    }),
    "apps/web/present.txt": "super-secret-file-content",
  });
  const inference = await core.inferRepository({ reader, catalog: [descriptor] });

  assert.equal(inference.state.kind, "missing");
  assert.deepEqual(inference.capabilities, [
    {
      identifier: "probe-evidence",
      category: "partial",
      probes: [
        { kind: "file", path: "apps/web/present.txt", status: "present" },
        { kind: "json-value", path: "apps/web/config.json", status: "present" },
        { kind: "json-value", path: "apps/web/config.json", status: "missing", code: "JSON_MEMBER_MISSING" },
        { kind: "package", path: "apps/web/package.json", status: "present" },
        { kind: "package", path: "apps/web/package.json", status: "mismatched", code: "PACKAGE_VERSION_MISMATCH" },
      ],
    },
  ]);
  assert.doesNotMatch(
    JSON.stringify(inference),
    /super-secret|9\.9\.9|expected-public-value|1\.2\.3/,
  );
});

test("probe failures distinguish missing, mismatch, and ambiguity", async () => {
  const invalidJson = createDescriptor("invalid-json", [
      { kind: "json-value", path: "invalid.json", pointer: "/enabled", expected: true },
    ]);
  const missingPackageSection = createDescriptor("missing-package-section", [
      { kind: "package", path: "package.json", section: "dependencies", packageName: "missing", version: "1.0.0" },
    ]);
  const mismatchedJson = createDescriptor("mismatched-json", [
      { kind: "json-value", path: "valid.json", pointer: "/enabled", expected: true },
    ]);
  const catalog = [
    invalidJson,
    missingPackageSection,
    mismatchedJson,
  ];
  const inference = await core.inferRepository({
    catalog,
    reader: core.createInMemoryRepositoryReader(stateFiles(createState({
      installedCapabilities: catalog.map((descriptor) => installCapability(descriptor)),
    }), {
      "invalid.json": "{ private-token",
      "package.json": JSON.stringify({ dependencies: {} }),
      "valid.json": JSON.stringify({ enabled: false }),
    })),
  });

  assert.deepEqual(inference.capabilities, [
    {
      identifier: "invalid-json",
      category: "ambiguous",
      probes: [{ kind: "json-value", path: "invalid.json", status: "ambiguous", code: "JSON_INVALID" }],
    },
    {
      identifier: "mismatched-json",
      category: "contradictory",
      probes: [{ kind: "json-value", path: "valid.json", status: "mismatched", code: "JSON_VALUE_MISMATCH" }],
    },
    {
      identifier: "missing-package-section",
      category: "contradictory",
      probes: [{ kind: "package", path: "package.json", status: "missing", code: "PACKAGE_MEMBER_MISSING" }],
    },
  ]);
});

test("capability inference applies the approved category precedence and omission rule", async () => {
  const confirmed = createDescriptor("confirmed", [{ kind: "file", path: "confirmed.txt" }]);
  const contradictory = createDescriptor("contradictory", [
    { kind: "file", path: "contradictory-present.txt" },
    { kind: "file", path: "missing.txt" },
  ]);
  const metadataMismatch = createDescriptor("metadata-mismatch", [{ kind: "file", path: "metadata.txt" }]);
  const probable = createDescriptor("probable", [{ kind: "file", path: "probable.txt" }]);
  const partial = createDescriptor("partial", [
    { kind: "file", path: "partial-present.txt" },
    { kind: "file", path: "partial-missing.txt" },
  ]);
  const absent = createDescriptor("absent", [{ kind: "file", path: "absent.txt" }]);
  const state = createState({
    installedCapabilities: [
      installCapability(confirmed),
      installCapability(contradictory),
      installCapability(metadataMismatch, { version: "0.2.0" }),
      {
        identifier: "unknown-installed",
        version: "0.1.0",
        deliveryMode: "source-generated",
        stateClassifications: ["repository-stateful"],
        removalPolicy: "reviewed",
      },
    ],
  });
  const inference = await core.inferRepository({
    catalog: [probable, confirmed, partial, metadataMismatch, absent, contradictory],
    reader: core.createInMemoryRepositoryReader(stateFiles(state, {
      "confirmed.txt": "present",
      "contradictory-present.txt": "present",
      "metadata.txt": "present",
      "probable.txt": "present",
      "partial-present.txt": "present",
    })),
  });

  assert.deepEqual(
    inference.capabilities.map(({ identifier, category, code }) => ({ identifier, category, ...(code === undefined ? {} : { code }) })),
    [
      { identifier: "confirmed", category: "confirmed" },
      { identifier: "contradictory", category: "contradictory" },
      { identifier: "metadata-mismatch", category: "contradictory", code: "CAPABILITY_METADATA_MISMATCH" },
      { identifier: "partial", category: "partial" },
      { identifier: "probable", category: "probable" },
      { identifier: "unknown-installed", category: "ambiguous", code: "CAPABILITY_DESCRIPTOR_MISSING" },
    ],
  );
});

test("ambiguous probes take precedence over installed metadata mismatch", async () => {
  const descriptor = createDescriptor("ambiguous-precedence", [
    { kind: "json-value", path: "invalid.json", pointer: "/enabled", expected: true },
  ]);
  const state = createState({
    installedCapabilities: [installCapability(descriptor, { version: "0.2.0" })],
  });
  const inference = await core.inferRepository({
    catalog: [descriptor],
    reader: core.createInMemoryRepositoryReader(stateFiles(state, {
      "invalid.json": "{ private-token",
    })),
  });

  assert.deepEqual(inference.capabilities, [{
    identifier: "ambiguous-precedence",
    category: "ambiguous",
    probes: [{
      kind: "json-value",
      path: "invalid.json",
      status: "ambiguous",
      code: "JSON_INVALID",
    }],
  }]);
});

test("state classification sets compare independently of declaration order", async () => {
  const descriptor = {
    ...createDescriptor("classification-set", [{ kind: "file", path: "present.txt" }]),
    stateClassifications: ["repository-stateful", "external-stateful"],
  };
  const state = createState({
    installedCapabilities: [
      installCapability(descriptor, {
        stateClassifications: ["external-stateful", "repository-stateful"],
      }),
    ],
  });
  const inference = await core.inferRepository({
    catalog: [descriptor],
    reader: core.createInMemoryRepositoryReader(stateFiles(state, {
      "present.txt": "present",
    })),
  });

  assert.equal(inference.capabilities[0]?.category, "confirmed");

  const differentState = createState({
    installedCapabilities: [
      installCapability(descriptor, {
        stateClassifications: ["repository-stateful", "persistent-data"],
      }),
    ],
  });
  const differentInference = await core.inferRepository({
    catalog: [descriptor],
    reader: core.createInMemoryRepositoryReader(stateFiles(differentState, {
      "present.txt": "present",
    })),
  });

  assert.equal(differentInference.capabilities[0]?.category, "contradictory");
  assert.equal(
    differentInference.capabilities[0]?.code,
    "CAPABILITY_METADATA_MISMATCH",
  );
});

test("an unreadable, symlinked, or invalid existing state makes catalog declaration evidence ambiguous", async () => {
  const descriptor = createDescriptor("catalog-capability", [{ kind: "file", path: "present.txt" }]);
  const cases = [
    {
      reader: core.createInMemoryRepositoryReader({ ".egeria/state.json": "{ private-state-token", "present.txt": "present" }),
      assertState: (state) => {
        assert.equal(state.kind, "invalid");
        assert.equal(state.issues[0]?.code, "STATE_JSON_INVALID");
      },
    },
    {
      reader: { readText: async (path) => path === ".egeria/state.json" ? { kind: "symlink" } : { kind: "file", content: "present" } },
      assertState: (state) => assert.deepEqual(state, { kind: "ambiguous", code: "STATE_SYMLINK" }),
    },
    {
      reader: { readText: async (path) => path === ".egeria/state.json" ? { kind: "error", code: "READ_FAILED" } : { kind: "file", content: "present" } },
      assertState: (state) => assert.deepEqual(state, { kind: "ambiguous", code: "READ_FAILED" }),
    },
  ];

  for (const { reader, assertState } of cases) {
    const inference = await core.inferRepository({ reader, catalog: [descriptor] });
    assertState(inference.state);
    assert.deepEqual(inference.capabilities, [{
      identifier: "catalog-capability",
      category: "ambiguous",
      probes: [],
      code: "STATE_DECLARATION_AMBIGUOUS",
    }]);
    assert.doesNotMatch(JSON.stringify(inference), /private-state-token/);
  }
});

test("managed and merge-managed surfaces report deterministic drift evidence", async () => {
  const exactText = "exact managed content";
  const exactJson = { nested: { b: 2, a: 1 } };
  const surfaces = [
    createSurface({ identifier: "z-drifted", path: "drifted.txt", fingerprint: core.fingerprintFileContent(encoder.encode("expected")) }),
    createSurface({ identifier: "a-confirmed", path: "confirmed.txt", fingerprint: core.fingerprintFileContent(encoder.encode(exactText)) }),
    createSurface({ identifier: "m-missing", path: "missing.txt", fingerprint: core.fingerprintFileContent(encoder.encode("expected")) }),
    createSurface({
      identifier: "j-json-confirmed",
      path: "config.json",
      ownership: "merge-managed",
      fingerprintTarget: { kind: "json-value", pointer: "/managed" },
      mergeStrategy: "json-property",
      fingerprint: core.fingerprintJsonValue(exactJson),
    }),
    createSurface({
      identifier: "k-json-missing",
      path: "config.json",
      ownership: "merge-managed",
      fingerprintTarget: { kind: "json-value", pointer: "/absent" },
      mergeStrategy: "json-property",
      fingerprint: core.fingerprintJsonValue(true),
    }),
    createSurface({
      identifier: "l-json-ambiguous",
      path: "invalid.json",
      ownership: "merge-managed",
      fingerprintTarget: { kind: "json-value", pointer: "/managed" },
      mergeStrategy: "json-property",
      fingerprint: core.fingerprintJsonValue(true),
    }),
    createSurface({
      identifier: "n-json-drifted",
      path: "config.json",
      ownership: "merge-managed",
      fingerprintTarget: { kind: "json-value", pointer: "/managed" },
      mergeStrategy: "json-property",
      fingerprint: core.fingerprintJsonValue({ nested: { a: 1, b: 3 } }),
    }),
  ];
  const state = createState({ managedSurfaces: surfaces });
  const inference = await core.inferRepository({
    catalog: [],
    reader: core.createInMemoryRepositoryReader(stateFiles(state, {
      "confirmed.txt": exactText,
      "config.json": JSON.stringify({ managed: { nested: { a: 1, b: 2 } } }),
      "drifted.txt": "different private content",
      "invalid.json": "{ private-token",
    })),
  });

  assert.deepEqual(inference.surfaces, [
    { identifier: "a-confirmed", path: "confirmed.txt", status: "confirmed" },
    { identifier: "j-json-confirmed", path: "config.json", status: "confirmed" },
    { identifier: "k-json-missing", path: "config.json", status: "missing", code: "JSON_MEMBER_MISSING" },
    { identifier: "l-json-ambiguous", path: "invalid.json", status: "ambiguous", code: "JSON_INVALID" },
    { identifier: "m-missing", path: "missing.txt", status: "missing" },
    { identifier: "n-json-drifted", path: "config.json", status: "drifted" },
    { identifier: "z-drifted", path: "drifted.txt", status: "drifted" },
  ]);
  assert.doesNotMatch(JSON.stringify(inference), /different private content|private-token/);
});

test("application-owned and ejected surfaces are reported without reading their paths", async () => {
  const reads = [];
  const state = createState({
    managedSurfaces: [
      createSurface({
        identifier: "ejected-surface",
        path: "private/ejected.txt",
        ownership: "ejected",
        fingerprint: core.fingerprintFileContent(encoder.encode("original")),
      }),
      createSurface({
        identifier: "application-surface",
        path: "private/application.txt",
        ownership: "application-owned",
        fingerprint: core.fingerprintFileContent(encoder.encode("original")),
      }),
    ],
  });
  const reader = {
    readText: async (path) => {
      reads.push(path);
      return path === ".egeria/state.json"
        ? { kind: "file", content: core.serializeStateJson(state) }
        : { kind: "error", code: "READ_FAILED" };
    },
  };
  const inference = await core.inferRepository({ reader, catalog: [] });

  assert.deepEqual(reads, [".egeria/state.json"]);
  assert.deepEqual(inference.surfaces, [
    { identifier: "application-surface", path: "private/application.txt", status: "application-owned" },
    { identifier: "ejected-surface", path: "private/ejected.txt", status: "ejected" },
  ]);
});
