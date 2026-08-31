import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import test from "node:test";

import { applySyntheticClientPacket } from "../../scripts/apply-synthetic-client-packet.mjs";

const execFileAsync = promisify(execFile);

const repositoryRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const packetRoot = resolve(
  repositoryRoot,
  "tests/client-journey/fixtures/harbour-light-studio",
);
const generatedFixtureRoot = resolve(
  repositoryRoot,
  "fixtures/generated/site-multilingual-analytics",
);
const adapterPath = resolve(
  repositoryRoot,
  "scripts/apply-synthetic-client-packet.mjs",
);
const deployedSpecPath = resolve(
  repositoryRoot,
  "tests/client-journey/synthetic-client-deployed.spec.ts",
);
const requireFromBuilderCore = createRequire(
  resolve(repositoryRoot, "packages/builder-core/package.json"),
);
const { parse, stringify } = requireFromBuilderCore("yaml");

const expectedPacketKeys = [
  "allowedExternalPrefix",
  "analytics",
  "bookingCalendly",
  "canonicalOrigin",
  "claimLimits",
  "contentCoupledExpectation",
  "contentFiles",
  "defaultLocale",
  "deferred",
  "destinationRoot",
  "displayName",
  "identifier",
  "locales",
  "payloadManifestSha256",
  "profile",
  "prohibitedContentClasses",
  "reviewOwnership",
  "schemaVersion",
  "selectedCapabilities",
  "supportedRoutes",
  "synthetic",
];

const expectedContentFiles = [
  "content/en-CA/localized-content.yaml",
  "content/fr-CA/localized-content.yaml",
  "content/en-CA/analytics.yaml",
  "content/fr-CA/analytics.yaml",
  "content/en-CA/routing.yaml",
  "content/en-CA/site.yaml",
  "content/en-CA/about.yaml",
  "content/en-CA/work-featured.yaml",
  "content/en-CA/not-found.yaml",
  "content/en-CA/observability.yaml",
  "content/en-CA/long-form/introduction.md",
];
const expectedWritePaths = [
  ...expectedContentFiles.map((path) => `apps/web/${path}`),
  "apps/web/tests/e2e/site-routing.spec.ts",
].toSorted();

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function listFiles(root, directory = root) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nestedFiles = await Promise.all(
    entries.map(async (entry) => {
      const absolutePath = resolve(directory, entry.name);
      if (entry.isDirectory()) {
        return listFiles(root, absolutePath);
      }

      return [relative(root, absolutePath).split(sep).join("/")];
    }),
  );

  return nestedFiles.flat().sort();
}

function parseManifest(contents) {
  assert.ok(contents.endsWith("\n"), "manifest must have a final newline");
  const entries = contents
    .trimEnd()
    .split("\n")
    .map((line) => {
      const match = /^([0-9a-f]{64})  ([^\0\r\n]+)$/u.exec(line);
      assert.ok(match, `invalid manifest entry: ${line}`);
      return { sha256: match[1], path: match[2] };
    });

  assert.equal(new Set(entries.map(({ path }) => path)).size, entries.length);
  return entries;
}

function describeStructure(value, path = "$", result = []) {
  if (Array.isArray(value)) {
    result.push(`${path}:array:${value.length}`);
    value.forEach((entry, index) =>
      describeStructure(entry, `${path}[${index}]`, result),
    );
    return result;
  }

  if (value !== null && typeof value === "object") {
    const keys = Object.keys(value).sort();
    result.push(`${path}:object:${keys.join(",")}`);
    keys.forEach((key) => describeStructure(value[key], `${path}.${key}`, result));
    return result;
  }

  result.push(`${path}:${typeof value}`);
  return result;
}

function collectValuesForKey(value, key, result = []) {
  if (Array.isArray(value)) {
    value.forEach((entry) => collectValuesForKey(entry, key, result));
    return result;
  }

  if (value !== null && typeof value === "object") {
    for (const [entryKey, entryValue] of Object.entries(value)) {
      if (entryKey === key) {
        result.push(entryValue);
      }
      collectValuesForKey(entryValue, key, result);
    }
  }

  return result;
}

function collectStrings(value, result = []) {
  if (typeof value === "string") {
    result.push(value);
  } else if (Array.isArray(value)) {
    value.forEach((entry) => collectStrings(entry, result));
  } else if (value !== null && typeof value === "object") {
    Object.values(value).forEach((entry) => collectStrings(entry, result));
  }
  return result;
}

async function runGit(projectRoot, arguments_) {
  return execFileAsync("git", arguments_, {
    cwd: projectRoot,
    encoding: "utf8",
  });
}

async function createProjectFixture({ preserveFixtureIdentity = false } = {}) {
  const ownerRoot = await mkdtemp(join(tmpdir(), "egeria-synthetic-client-"));
  const projectRoot = resolve(ownerRoot, "project");
  await cp(generatedFixtureRoot, projectRoot, { recursive: true });
  if (!preserveFixtureIdentity) {
    const packagePath = resolve(projectRoot, "package.json");
    const packageManifest = JSON.parse(await readFile(packagePath, "utf8"));
    await writeFile(
      packagePath,
      `${JSON.stringify({ ...packageManifest, name: "harbour-light-studio" }, null, 2)}\n`,
    );
    const webPackagePath = resolve(projectRoot, "apps/web/package.json");
    const webPackageManifest = JSON.parse(
      await readFile(webPackagePath, "utf8"),
    );
    await writeFile(
      webPackagePath,
      `${JSON.stringify({ ...webPackageManifest, name: "harbour-light-studio-web" }, null, 2)}\n`,
    );

    const projectPath = resolve(projectRoot, ".egeria/project.yaml");
    const project = parse(await readFile(projectPath, "utf8"));
    project.project.name = "harbour-light-studio";
    project.project.displayName = "Harbour Light Studio";
    project.capabilitySettings.analytics.providers = {
      cloudflareWebAnalytics:
        project.capabilitySettings.analytics.providers.cloudflareWebAnalytics,
    };
    project.capabilitySettings.analytics.operationalIntegrations = {};
    await writeFile(projectPath, stringify(project));
  }
  await runGit(projectRoot, ["init", "-b", "main"]);
  await runGit(projectRoot, ["config", "user.name", "Synthetic Journey Test"]);
  await runGit(projectRoot, [
    "config",
    "user.email",
    "synthetic-journey@example.com",
  ]);
  await runGit(projectRoot, ["add", "."]);
  await runGit(projectRoot, ["commit", "-m", "Record generated fixture"]);

  return {
    ownerRoot,
    projectRoot,
    async cleanup() {
      await rm(ownerRoot, { recursive: true, force: true });
    },
  };
}

async function copyPacketFixture() {
  const ownerRoot = await mkdtemp(join(tmpdir(), "egeria-synthetic-packet-"));
  const copiedPacketRoot = resolve(ownerRoot, "packet");
  await cp(packetRoot, copiedPacketRoot, { recursive: true });
  return {
    ownerRoot,
    packetRoot: copiedPacketRoot,
    async cleanup() {
      await rm(ownerRoot, { recursive: true, force: true });
    },
  };
}

async function readStatusPaths(projectRoot) {
  const { stdout } = await runGit(projectRoot, [
    "status",
    "--porcelain=v1",
    "-z",
    "--untracked-files=all",
  ]);
  return stdout
    .split("\0")
    .filter(Boolean)
    .map((entry) => entry.slice(3))
    .sort();
}

async function assertRefusalWithoutAdditionalWrites({
  projectRoot,
  packetRoot: customPacketRoot = packetRoot,
  invoke = () =>
    applySyntheticClientPacket({
      projectRoot,
      packetRoot: customPacketRoot,
    }),
}) {
  const beforeStatus = await readStatusPaths(projectRoot);
  await assert.rejects(invoke);
  assert.deepEqual(await readStatusPaths(projectRoot), beforeStatus);
}

test("the tracked Harbour Light packet is exact, synthetic, and internally reconciled", async () => {
  const packet = JSON.parse(await readFile(resolve(packetRoot, "packet.json"), "utf8"));

  assert.deepEqual(Object.keys(packet).sort(), expectedPacketKeys);
  assert.equal(packet.schemaVersion, "1.0.0");
  assert.equal(packet.synthetic, true);
  assert.equal(packet.identifier, "harbour-light-studio");
  assert.equal(packet.displayName, "Harbour Light Studio");
  assert.equal(packet.profile, "site");
  assert.equal(packet.canonicalOrigin, "https://harbour-light.example");
  assert.equal(packet.destinationRoot, "apps/web");
  assert.equal(packet.defaultLocale, "en-CA");
  assert.deepEqual(packet.locales, ["en-CA", "fr-CA"]);
  assert.deepEqual(packet.selectedCapabilities, [
    { identifier: "site-routing", version: "0.4.0" },
    { identifier: "multilingual", version: "0.1.0" },
    { identifier: "analytics", version: "0.1.0" },
  ]);
  assert.deepEqual(packet.analytics, {
    consentPolicy: "explicit-opt-in",
    cloudflareWebAnalytics: "selected-external-test-token",
    googleAnalytics4: "disabled",
    microsoftClarity: "disabled",
    searchConsole: "disabled",
    lookerStudio: "disabled",
  });
  assert.equal(packet.bookingCalendly, "disabled");
  assert.deepEqual(packet.supportedRoutes, [
    "/en-CA",
    "/en-CA/about",
    "/en-CA/work/featured",
    "/fr-CA",
    "/fr-CA/about",
    "/fr-CA/work/featured",
  ]);
  assert.deepEqual(packet.contentFiles, expectedContentFiles);
  assert.deepEqual(packet.prohibitedContentClasses, [
    "non-example-email",
    "non-reserved-domain",
    "home-directory-path",
    "provider-credential",
    "starter-identity",
    "starter-project-copy",
  ]);
  assert.equal(
    packet.payloadManifestSha256,
    "2948c53b36b367c17891d8166877f77b2ca4ef5610992169e2390a657ffcd667",
  );

  const manifestBytes = await readFile(
    resolve(packetRoot, "PAYLOAD-MANIFEST.sha256"),
  );
  assert.equal(sha256(manifestBytes), packet.payloadManifestSha256);
  const manifestEntries = parseManifest(manifestBytes.toString("utf8"));
  assert.deepEqual(
    manifestEntries.map(({ path }) => path).sort(),
    expectedContentFiles.toSorted(),
  );
  assert.deepEqual(
    await listFiles(resolve(packetRoot, "content")),
    expectedContentFiles
      .map((path) => path.replace(/^content\//u, ""))
      .toSorted(),
  );
  assert.ok(!manifestEntries.some(({ path }) => path === "packet.json"));

  const parsedYaml = new Map();
  const contentTexts = [];
  for (const entry of manifestEntries) {
    const bytes = await readFile(resolve(packetRoot, entry.path));
    assert.equal(sha256(bytes), entry.sha256, entry.path);
    const text = bytes.toString("utf8");
    contentTexts.push(text);
    if (entry.path.endsWith(".yaml")) {
      parsedYaml.set(entry.path, parse(text));
    }
  }

  const englishContent = parsedYaml.get(
    "content/en-CA/localized-content.yaml",
  );
  const frenchContent = parsedYaml.get(
    "content/fr-CA/localized-content.yaml",
  );
  assert.deepEqual(
    describeStructure(frenchContent),
    describeStructure(englishContent),
  );
  assert.deepEqual(
    collectValuesForKey(frenchContent, "id"),
    collectValuesForKey(englishContent, "id"),
  );
  assert.deepEqual(
    describeStructure(parsedYaml.get("content/fr-CA/analytics.yaml")),
    describeStructure(parsedYaml.get("content/en-CA/analytics.yaml")),
  );

  const yamlStrings = [...parsedYaml.values()].flatMap((value) =>
    collectStrings(value),
  );
  const externalLinks = [...parsedYaml.values()]
    .flatMap((value) => collectValuesForKey(value, "href"))
    .filter((value) => /^https:\/\//u.test(value));
  assert.ok(externalLinks.length > 0);
  assert.ok(
    externalLinks.every((value) =>
      value.startsWith("https://example.com/harbour-light/"),
    ),
  );

  const contentText = contentTexts.join("\n");
  assert.doesNotMatch(contentText, /(?:^|[^0-9a-f])[0-9a-f]{32}(?:[^0-9a-f]|$)/iu);
  assert.doesNotMatch(contentText, /(?:password|api[_-]?key|bearer|secret)\s*[:=]/iu);
  assert.doesNotMatch(contentText, /(?:\/Users\/|\/home\/|file:\/\/)/u);
  assert.doesNotMatch(contentText, /[A-Z0-9._%+-]+@(?!example\.(?:com|net|org)\b)[A-Z0-9.-]+\.[A-Z]{2,}/iu);
  const contentUrls = [...contentText.matchAll(/https:\/\/[^\s"')]+/gu)].map(
    ([value]) => new URL(value),
  );
  assert.ok(contentUrls.length > 0);
  assert.ok(
    contentUrls.every(({ hostname }) =>
      ["example.com", "harbour-light.example"].includes(hostname),
    ),
  );
  assert.doesNotMatch(contentText, /\b(?:Egeria Systems|Your Name|Starter Project)\b/iu);
});

test("the adapter applies exactly the declared writes and emits a bounded receipt", async () => {
  const fixture = await createProjectFixture();
  try {
    const receipt = await applySyntheticClientPacket({
      projectRoot: fixture.projectRoot,
    });

    assert.deepEqual(await readStatusPaths(fixture.projectRoot), expectedWritePaths);
    assert.deepEqual(Object.keys(receipt), [
      "schemaVersion",
      "synthetic",
      "packet",
      "manifestSha256",
      "writes",
    ]);
    assert.equal(receipt.schemaVersion, "1.0.0");
    assert.equal(receipt.synthetic, true);
    assert.equal(receipt.packet, "harbour-light-studio");
    assert.equal(
      receipt.manifestSha256,
      "2948c53b36b367c17891d8166877f77b2ca4ef5610992169e2390a657ffcd667",
    );
    assert.deepEqual(
      receipt.writes.map(({ path }) => path),
      expectedWritePaths,
    );
    assert.ok(
      receipt.writes.every(
        (write) =>
          Object.keys(write).join(",") === "path,sha256" &&
          !write.path.startsWith("/") &&
          /^[0-9a-f]{64}$/u.test(write.sha256),
      ),
    );

    const receiptText = JSON.stringify(receipt);
    assert.doesNotMatch(receiptText, /(?:\/Users\/|\/home\/|file:\/\/)/u);
    assert.doesNotMatch(receiptText, /Harbour Light Studio/u);
    assert.doesNotMatch(receiptText, /harbour-light\.example/u);
    assert.doesNotMatch(receiptText, /selected-external-test-token/u);
  } finally {
    await fixture.cleanup();
  }

  const cliFixture = await createProjectFixture();
  try {
    const { stdout, stderr } = await execFileAsync(
      process.execPath,
      [adapterPath, "--project-root", cliFixture.projectRoot],
      { cwd: repositoryRoot, encoding: "utf8" },
    );
    assert.equal(stderr, "");
    assert.equal(stdout.trimEnd().split("\n").length, 1);
    assert.deepEqual(
      JSON.parse(stdout).writes.map(({ path }) => path),
      expectedWritePaths,
    );
  } finally {
    await cliFixture.cleanup();
  }
});

test("the deployed journey clears consent once and proves grant persistence", async () => {
  const source = await readFile(deployedSpecPath, "utf8");

  assert.match(source, /sessionStorage\.getItem\("synthetic-client-initialized"\)/u);
  assert.match(source, /sessionStorage\.setItem\("synthetic-client-initialized", "true"\)/u);
  assert.match(source, /const requestsBeforePersistedGrantReload = providerRequests\.length/u);
  assert.match(source, /await page\.reload\(\{ waitUntil: "networkidle" \}\)/u);
  assert.match(
    source,
    /providerRequests\.length[\s\S]+requestsBeforePersistedGrantReload/u,
  );
  assert.match(source, /await expect\(action\(page, "manage"\)\)\.toBeVisible\(\)/u);
});

test("the adapter refuses packet, manifest, content, and source drift before writing", async () => {
  const cases = [
    {
      name: "unsupported schema",
      mutate: async (copiedPacketRoot) => {
        const path = resolve(copiedPacketRoot, "packet.json");
        const packet = JSON.parse(await readFile(path, "utf8"));
        packet.schemaVersion = "2.0.0";
        await writeFile(path, `${JSON.stringify(packet, null, 2)}\n`);
      },
    },
    {
      name: "non-synthetic packet",
      mutate: async (copiedPacketRoot) => {
        const path = resolve(copiedPacketRoot, "packet.json");
        const packet = JSON.parse(await readFile(path, "utf8"));
        packet.synthetic = false;
        await writeFile(path, `${JSON.stringify(packet, null, 2)}\n`);
      },
    },
    {
      name: "wrong identity",
      mutate: async (copiedPacketRoot) => {
        const path = resolve(copiedPacketRoot, "packet.json");
        const packet = JSON.parse(await readFile(path, "utf8"));
        packet.identifier = "different-synthetic-studio";
        await writeFile(path, `${JSON.stringify(packet, null, 2)}\n`);
      },
    },
    {
      name: "manifest member mismatch",
      mutate: async (copiedPacketRoot) => {
        await writeFile(
          resolve(copiedPacketRoot, "content/en-CA/about.yaml"),
          "metadata: [malformed\n",
        );
      },
    },
    {
      name: "manifest missing entry",
      mutate: async (copiedPacketRoot) => {
        const path = resolve(copiedPacketRoot, "PAYLOAD-MANIFEST.sha256");
        const lines = (await readFile(path, "utf8")).trimEnd().split("\n");
        await writeFile(path, `${lines.slice(1).join("\n")}\n`);
      },
    },
    {
      name: "manifest extra entry",
      mutate: async (copiedPacketRoot) => {
        const path = resolve(copiedPacketRoot, "PAYLOAD-MANIFEST.sha256");
        const contents = await readFile(path, "utf8");
        await writeFile(path, `${contents}${"0".repeat(64)}  content/extra.yaml\n`);
      },
    },
    {
      name: "undeclared packet path",
      mutate: async (copiedPacketRoot) => {
        await writeFile(resolve(copiedPacketRoot, "content/extra.yaml"), "safe: true\n");
      },
    },
  ];

  for (const testCase of cases) {
    const project = await createProjectFixture();
    const copiedPacket = await copyPacketFixture();
    try {
      await testCase.mutate(copiedPacket.packetRoot);
      await assertRefusalWithoutAdditionalWrites({
        projectRoot: project.projectRoot,
        packetRoot: copiedPacket.packetRoot,
      });
    } catch (error) {
      error.message = `${testCase.name}: ${error.message}`;
      throw error;
    } finally {
      await copiedPacket.cleanup();
      await project.cleanup();
    }
  }

  for (const replacement of [
    "https://harbour-light.example/extra",
    "https://different.example",
  ]) {
    const project = await createProjectFixture();
    try {
      const sourcePath = resolve(
        project.projectRoot,
        "apps/web/tests/e2e/site-routing.spec.ts",
      );
      const source = await readFile(sourcePath, "utf8");
      await writeFile(
        sourcePath,
        source.replace("https://example.com", replacement),
      );
      await runGit(project.projectRoot, ["add", sourcePath]);
      await runGit(project.projectRoot, ["commit", "-m", "Introduce source drift"]);
      await assertRefusalWithoutAdditionalWrites({
        projectRoot: project.projectRoot,
      });
    } finally {
      await project.cleanup();
    }
  }
});

test("the adapter refuses unsafe repository boundaries and rolls back injected failure", async () => {
  const wrongProject = await createProjectFixture({
    preserveFixtureIdentity: true,
  });
  try {
    await assertRefusalWithoutAdditionalWrites({
      projectRoot: wrongProject.projectRoot,
    });
  } finally {
    await wrongProject.cleanup();
  }

  const dirtyProject = await createProjectFixture();
  try {
    await writeFile(resolve(dirtyProject.projectRoot, "dirty.txt"), "dirty\n");
    await assertRefusalWithoutAdditionalWrites({
      projectRoot: dirtyProject.projectRoot,
    });
  } finally {
    await dirtyProject.cleanup();
  }

  const destinationSymlinkProject = await createProjectFixture();
  try {
    const destination = resolve(
      destinationSymlinkProject.projectRoot,
      "apps/web/content/en-CA/about.yaml",
    );
    const backingFile = resolve(destinationSymlinkProject.projectRoot, "about.yaml");
    await rename(destination, backingFile);
    await symlink(backingFile, destination);
    await runGit(destinationSymlinkProject.projectRoot, ["add", "-A"]);
    await runGit(destinationSymlinkProject.projectRoot, [
      "commit",
      "-m",
      "Introduce destination symlink",
    ]);
    await assertRefusalWithoutAdditionalWrites({
      projectRoot: destinationSymlinkProject.projectRoot,
    });
  } finally {
    await destinationSymlinkProject.cleanup();
  }

  const ancestorSymlinkProject = await createProjectFixture();
  try {
    const contentRoot = resolve(
      ancestorSymlinkProject.projectRoot,
      "apps/web/content",
    );
    const backingRoot = resolve(
      ancestorSymlinkProject.projectRoot,
      "apps/web/content-real",
    );
    await rename(contentRoot, backingRoot);
    await symlink(backingRoot, contentRoot);
    await runGit(ancestorSymlinkProject.projectRoot, ["add", "-A"]);
    await runGit(ancestorSymlinkProject.projectRoot, [
      "commit",
      "-m",
      "Introduce ancestor symlink",
    ]);
    await assertRefusalWithoutAdditionalWrites({
      projectRoot: ancestorSymlinkProject.projectRoot,
    });
  } finally {
    await ancestorSymlinkProject.cleanup();
  }

  const relativeProject = await createProjectFixture();
  try {
    await assertRefusalWithoutAdditionalWrites({
      projectRoot: relativeProject.projectRoot,
      invoke: () =>
        applySyntheticClientPacket({
          projectRoot: relative(repositoryRoot, relativeProject.projectRoot),
        }),
    });
  } finally {
    await relativeProject.cleanup();
  }

  await assert.rejects(
    applySyntheticClientPacket({
      projectRoot: resolve(tmpdir(), "missing-synthetic-client-project"),
    }),
  );

  const nonGitOwner = await mkdtemp(join(tmpdir(), "egeria-synthetic-nongit-"));
  const nonGitRoot = resolve(nonGitOwner, "project");
  try {
    await mkdir(nonGitRoot);
    await assert.rejects(applySyntheticClientPacket({ projectRoot: nonGitRoot }));
  } finally {
    await rm(nonGitOwner, { recursive: true, force: true });
  }

  const rollbackProject = await createProjectFixture();
  try {
    await assert.rejects(
      applySyntheticClientPacket({
        projectRoot: rollbackProject.projectRoot,
        injectWriteFailureAfter: 3,
      }),
    );
    assert.deepEqual(await readStatusPaths(rollbackProject.projectRoot), []);
  } finally {
    await rollbackProject.cleanup();
  }
});
