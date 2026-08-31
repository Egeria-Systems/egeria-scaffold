import { execFile } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import {
  lstat,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { createRequire } from "node:module";
import {
  dirname,
  isAbsolute,
  relative,
  resolve,
  sep,
} from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual, promisify } from "node:util";

const execFileAsync = promisify(execFile);
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const defaultPacketRoot = resolve(
  repositoryRoot,
  "tests/client-journey/fixtures/harbour-light-studio",
);
const requireFromBuilderCore = createRequire(
  resolve(repositoryRoot, "packages/builder-core/package.json"),
);
const { parse } = requireFromBuilderCore("yaml");

const packetManifestSha256 =
  "2948c53b36b367c17891d8166877f77b2ca4ef5610992169e2390a657ffcd667";
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
const expectedContentExpectation = {
  path: "apps/web/tests/e2e/site-routing.spec.ts",
  sourceSha256:
    "8c5bac002c3842dc67e16b4ea05b1a1904057dee4f56761c98bace667ea3f69e",
  targetSha256:
    "2924a763aa465ae8abde4da00e5f9bc27c1fe3760ad0baec79552a9653f5c294",
  from: "https://example.com",
  to: "https://harbour-light.example",
  expectedOccurrences: 3,
};
const expectedProjectCapabilities = [
  "standards",
  "content-files",
  "section-composition",
  "deployment-cloudflare",
  "observability",
  "site-routing",
  "analytics",
  "multilingual",
];
const expectedInstalledCapabilities = [
  { identifier: "standards", version: "0.4.0" },
  { identifier: "content-files", version: "0.4.0" },
  { identifier: "section-composition", version: "0.3.0" },
  { identifier: "deployment-cloudflare", version: "0.3.0" },
  { identifier: "observability", version: "0.3.0" },
  { identifier: "site-routing", version: "0.4.0" },
  { identifier: "analytics", version: "0.1.0" },
  { identifier: "multilingual", version: "0.1.0" },
];

class SyntheticClientPacketError extends Error {
  constructor(code, options) {
    super(code, options);
    this.name = "SyntheticClientPacketError";
    this.code = code;
  }
}

function refuse(code, options) {
  throw new SyntheticClientPacketError(code, options);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function sameJson(left, right) {
  return isDeepStrictEqual(left, right);
}

function isContainedPath(root, candidate) {
  const relativePath = relative(root, candidate);
  return (
    relativePath !== ".." &&
    !relativePath.startsWith(`..${sep}`) &&
    !isAbsolute(relativePath)
  );
}

async function runGit(projectRoot, arguments_) {
  try {
    return await execFileAsync("git", arguments_, {
      cwd: projectRoot,
      encoding: "utf8",
      maxBuffer: 4 * 1024 * 1024,
    });
  } catch (cause) {
    refuse("GIT_BOUNDARY_INVALID", { cause });
  }
}

async function readGitStatus(projectRoot) {
  const { stdout } = await runGit(projectRoot, [
    "status",
    "--porcelain=v1",
    "-z",
    "--untracked-files=all",
  ]);
  return stdout;
}

function parseStatusPaths(status) {
  return status
    .split("\0")
    .filter(Boolean)
    .map((entry) => entry.slice(3))
    .sort();
}

async function resolveRequestRoots(projectRoot, packetRoot) {
  if (typeof projectRoot !== "string" || !isAbsolute(projectRoot)) {
    refuse("PROJECT_ROOT_MUST_BE_ABSOLUTE");
  }
  if (typeof packetRoot !== "string" || !isAbsolute(packetRoot)) {
    refuse("PACKET_ROOT_MUST_BE_ABSOLUTE");
  }

  let resolvedProjectRoot;
  let resolvedPacketRoot;
  try {
    resolvedProjectRoot = await realpath(projectRoot);
    resolvedPacketRoot = await realpath(packetRoot);
  } catch (cause) {
    refuse("APPLICATION_ROOT_MISSING", { cause });
  }

  const { stdout } = await runGit(resolvedProjectRoot, [
    "rev-parse",
    "--show-toplevel",
  ]);
  let gitRoot;
  try {
    gitRoot = await realpath(stdout.trim());
  } catch (cause) {
    refuse("GIT_BOUNDARY_INVALID", { cause });
  }
  if (gitRoot !== resolvedProjectRoot) {
    refuse("PROJECT_ROOT_MUST_EQUAL_GIT_ROOT");
  }
  if ((await readGitStatus(resolvedProjectRoot)) !== "") {
    refuse("PROJECT_ROOT_NOT_CLEAN");
  }

  return { projectRoot: resolvedProjectRoot, packetRoot: resolvedPacketRoot };
}

async function listFiles(root, directory = root) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const absolutePath = resolve(directory, entry.name);
      if (entry.isDirectory()) {
        return listFiles(root, absolutePath);
      }
      if (!entry.isFile()) {
        refuse("PACKET_SPECIAL_FILE_REFUSED");
      }
      return [relative(root, absolutePath).split(sep).join("/")];
    }),
  );
  return nested.flat().sort();
}

function parseManifest(contents) {
  if (!contents.endsWith("\n")) {
    refuse("MANIFEST_INVALID");
  }
  const entries = contents
    .trimEnd()
    .split("\n")
    .map((line) => {
      const match = /^([0-9a-f]{64})  ([^\0\r\n]+)$/u.exec(line);
      if (!match) {
        refuse("MANIFEST_INVALID");
      }
      return { sha256: match[1], path: match[2] };
    });
  if (new Set(entries.map(({ path }) => path)).size !== entries.length) {
    refuse("MANIFEST_INVALID");
  }
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
  } else if (value !== null && typeof value === "object") {
    for (const [entryKey, entryValue] of Object.entries(value)) {
      if (entryKey === key) {
        result.push(entryValue);
      }
      collectValuesForKey(entryValue, key, result);
    }
  }
  return result;
}

function validatePacket(packet) {
  if (!sameJson(Object.keys(packet).sort(), expectedPacketKeys)) {
    refuse("PACKET_SCHEMA_INVALID");
  }
  if (
    packet.schemaVersion !== "1.0.0" ||
    packet.synthetic !== true ||
    packet.identifier !== "harbour-light-studio" ||
    packet.displayName !== "Harbour Light Studio" ||
    packet.profile !== "site" ||
    packet.canonicalOrigin !== "https://harbour-light.example" ||
    packet.destinationRoot !== "apps/web" ||
    packet.defaultLocale !== "en-CA" ||
    !sameJson(packet.locales, ["en-CA", "fr-CA"]) ||
    !sameJson(packet.selectedCapabilities, [
      { identifier: "site-routing", version: "0.4.0" },
      { identifier: "multilingual", version: "0.1.0" },
      { identifier: "analytics", version: "0.1.0" },
    ]) ||
    !sameJson(packet.analytics, {
      consentPolicy: "explicit-opt-in",
      cloudflareWebAnalytics: "selected-external-test-token",
      googleAnalytics4: "disabled",
      microsoftClarity: "disabled",
      searchConsole: "disabled",
      lookerStudio: "disabled",
    }) ||
    packet.bookingCalendly !== "disabled" ||
    !sameJson(packet.supportedRoutes, [
      "/en-CA",
      "/en-CA/about",
      "/en-CA/work/featured",
      "/fr-CA",
      "/fr-CA/about",
      "/fr-CA/work/featured",
    ]) ||
    !sameJson(packet.reviewOwnership, {
      content: "synthetic-fixture-maintainer",
      french: "human-review-required",
      provider: "operator-owned-test-account",
      deployment: "test-deploy-operator",
    }) ||
    packet.payloadManifestSha256 !== packetManifestSha256 ||
    !sameJson(packet.contentCoupledExpectation, expectedContentExpectation) ||
    !sameJson(packet.contentFiles, expectedContentFiles) ||
    !sameJson(packet.prohibitedContentClasses, [
      "non-example-email",
      "non-reserved-domain",
      "home-directory-path",
      "provider-credential",
      "starter-identity",
      "starter-project-copy",
    ]) ||
    packet.allowedExternalPrefix !== "https://example.com/harbour-light/" ||
    !sameJson(packet.deferred, [
      "assets",
      "standalone-legal",
      "standalone-privacy",
      "booking",
      "payment",
      "screening",
      "production-domain",
    ]) ||
    !sameJson(packet.claimLimits, [
      "synthetic-client-journey-only",
      "no-client-approval-claim",
      "no-french-certification-claim",
      "no-provider-certification-claim",
      "no-wcag-conformance-claim",
      "no-production-readiness-claim",
    ])
  ) {
    refuse("PACKET_SCHEMA_INVALID");
  }
}

function validateParsedContent(parsedYaml, contentText) {
  const englishContent = parsedYaml.get(
    "content/en-CA/localized-content.yaml",
  );
  const frenchContent = parsedYaml.get(
    "content/fr-CA/localized-content.yaml",
  );
  const englishAnalytics = parsedYaml.get("content/en-CA/analytics.yaml");
  const frenchAnalytics = parsedYaml.get("content/fr-CA/analytics.yaml");
  if (
    !sameJson(
      describeStructure(frenchContent),
      describeStructure(englishContent),
    ) ||
    !sameJson(
      collectValuesForKey(frenchContent, "id"),
      collectValuesForKey(englishContent, "id"),
    ) ||
    !sameJson(
      describeStructure(frenchAnalytics),
      describeStructure(englishAnalytics),
    )
  ) {
    refuse("LOCALE_STRUCTURE_INVALID");
  }

  const externalLinks = [...parsedYaml.values()]
    .flatMap((value) => collectValuesForKey(value, "href"))
    .filter((value) => typeof value === "string" && /^https:\/\//u.test(value));
  if (
    externalLinks.length === 0 ||
    externalLinks.some(
      (value) => !value.startsWith("https://example.com/harbour-light/"),
    )
  ) {
    refuse("CONTENT_LINK_INVALID");
  }

  if (
    /(?:^|[^0-9a-f])[0-9a-f]{32}(?:[^0-9a-f]|$)/iu.test(contentText) ||
    /(?:password|api[_-]?key|bearer|secret)\s*[:=]/iu.test(contentText) ||
    /(?:\/Users\/|\/home\/|file:\/\/)/u.test(contentText) ||
    /[A-Z0-9._%+-]+@(?!example\.(?:com|net|org)\b)[A-Z0-9.-]+\.[A-Z]{2,}/iu.test(
      contentText,
    ) ||
    /\b(?:Egeria Systems|Your Name|Starter Project)\b/iu.test(contentText)
  ) {
    refuse("PROHIBITED_CONTENT");
  }

  const contentUrls = [...contentText.matchAll(/https:\/\/[^\s"')]+/gu)].map(
    ([value]) => new URL(value),
  );
  if (
    contentUrls.length === 0 ||
    contentUrls.some(
      ({ hostname }) =>
        !["example.com", "harbour-light.example"].includes(hostname),
    )
  ) {
    refuse("PROHIBITED_CONTENT");
  }
}

async function readAndValidatePacket(packetRoot) {
  let packet;
  try {
    packet = JSON.parse(await readFile(resolve(packetRoot, "packet.json"), "utf8"));
  } catch (cause) {
    refuse("PACKET_SCHEMA_INVALID", { cause });
  }
  validatePacket(packet);

  const manifestBytes = await readFile(
    resolve(packetRoot, "PAYLOAD-MANIFEST.sha256"),
  );
  if (sha256(manifestBytes) !== packetManifestSha256) {
    refuse("MANIFEST_DIGEST_MISMATCH");
  }
  const manifestEntries = parseManifest(manifestBytes.toString("utf8"));
  if (
    !sameJson(
      manifestEntries.map(({ path }) => path).sort(),
      expectedContentFiles.toSorted(),
    ) ||
    !sameJson(
      await listFiles(resolve(packetRoot, "content")),
      expectedContentFiles
        .map((path) => path.replace(/^content\//u, ""))
        .toSorted(),
    )
  ) {
    refuse("PACKET_INVENTORY_MISMATCH");
  }

  const parsedYaml = new Map();
  const contentBytes = new Map();
  const contentTexts = [];
  for (const entry of manifestEntries) {
    const bytes = await readFile(resolve(packetRoot, entry.path));
    if (sha256(bytes) !== entry.sha256) {
      refuse("MANIFEST_MEMBER_MISMATCH");
    }
    contentBytes.set(entry.path, bytes);
    const text = bytes.toString("utf8");
    contentTexts.push(text);
    if (entry.path.endsWith(".yaml")) {
      try {
        parsedYaml.set(entry.path, parse(text));
      } catch (cause) {
        refuse("PACKET_YAML_INVALID", { cause });
      }
    }
  }
  validateParsedContent(parsedYaml, contentTexts.join("\n"));

  return { packet, contentBytes };
}

async function assertSafeDestination(projectRoot, absolutePath) {
  if (!isContainedPath(projectRoot, absolutePath)) {
    refuse("DESTINATION_ESCAPES_PROJECT");
  }
  const relativePath = relative(projectRoot, absolutePath);
  const components = relativePath.split(sep);
  let current = projectRoot;
  for (const component of components) {
    current = resolve(current, component);
    let stats;
    try {
      stats = await lstat(current);
    } catch (cause) {
      refuse("DESTINATION_MISSING", { cause });
    }
    if (stats.isSymbolicLink()) {
      refuse("DESTINATION_SYMLINK_REFUSED");
    }
    if (current === absolutePath ? !stats.isFile() : !stats.isDirectory()) {
      refuse("DESTINATION_TYPE_INVALID");
    }
  }
}

async function validateProjectIdentity(projectRoot, packet) {
  const paths = {
    package: resolve(projectRoot, "package.json"),
    webPackage: resolve(projectRoot, "apps/web/package.json"),
    project: resolve(projectRoot, ".egeria/project.yaml"),
    state: resolve(projectRoot, ".egeria/state.json"),
  };
  await Promise.all(
    Object.values(paths).map((path) => assertSafeDestination(projectRoot, path)),
  );

  let packageManifest;
  let webPackageManifest;
  let project;
  let state;
  try {
    packageManifest = JSON.parse(await readFile(paths.package, "utf8"));
    webPackageManifest = JSON.parse(
      await readFile(paths.webPackage, "utf8"),
    );
    project = parse(await readFile(paths.project, "utf8"));
    state = JSON.parse(await readFile(paths.state, "utf8"));
  } catch (cause) {
    refuse("PROJECT_IDENTITY_INVALID", { cause });
  }

  const analytics = project.capabilitySettings?.analytics;
  if (
    packageManifest.name !== packet.identifier ||
    webPackageManifest.name !== `${packet.identifier}-web` ||
    !sameJson(project.project, {
      defaultLocale: packet.defaultLocale,
      displayName: packet.displayName,
      name: packet.identifier,
    }) ||
    project.originProfile !== packet.profile ||
    project.recipeVersion !== "0.11.0" ||
    !sameJson(project.selectedCapabilities, expectedProjectCapabilities) ||
    !sameJson(Object.keys(analytics?.providers ?? {}), [
      "cloudflareWebAnalytics",
    ]) ||
    !/^[0-9a-f]{32}$/u.test(
      analytics?.providers?.cloudflareWebAnalytics?.siteToken ?? "",
    ) ||
    !sameJson(analytics?.operationalIntegrations, {}) ||
    analytics?.consent?.policy !== packet.analytics.consentPolicy ||
    !sameJson(state.origin, {
      profile: packet.profile,
      recipeVersion: "0.11.0",
    }) ||
    !sameJson(
      state.installedCapabilities?.map(({ identifier, version }) => ({
        identifier,
        version,
      })),
      expectedInstalledCapabilities,
    )
  ) {
    refuse("PROJECT_IDENTITY_INVALID");
  }
}

async function stageDeclaredWrites(context) {
  const stagedWrites = [];
  for (const contentPath of expectedContentFiles) {
    const relativePath = `${context.packet.destinationRoot}/${contentPath}`;
    const absolutePath = resolve(context.projectRoot, relativePath);
    await assertSafeDestination(context.projectRoot, absolutePath);
    const stats = await lstat(absolutePath);
    stagedWrites.push({
      absolutePath,
      relativePath,
      originalBytes: await readFile(absolutePath),
      targetBytes: context.contentBytes.get(contentPath),
      mode: stats.mode,
    });
  }

  const expectation = context.packet.contentCoupledExpectation;
  const absolutePath = resolve(context.projectRoot, expectation.path);
  await assertSafeDestination(context.projectRoot, absolutePath);
  const sourceBytes = await readFile(absolutePath);
  const sourceText = sourceBytes.toString("utf8");
  const occurrences = sourceText.split(expectation.from).length - 1;
  if (
    sha256(sourceBytes) !== expectation.sourceSha256 ||
    occurrences !== expectation.expectedOccurrences
  ) {
    refuse("CONTENT_EXPECTATION_DRIFT");
  }
  const targetBytes = Buffer.from(
    sourceText.replaceAll(expectation.from, expectation.to),
    "utf8",
  );
  if (sha256(targetBytes) !== expectation.targetSha256) {
    refuse("CONTENT_EXPECTATION_INVALID");
  }
  const stats = await lstat(absolutePath);
  stagedWrites.push({
    absolutePath,
    relativePath: expectation.path,
    originalBytes: sourceBytes,
    targetBytes,
    mode: stats.mode,
  });

  return stagedWrites
    .map((write) => ({ ...write, sha256: sha256(write.targetBytes) }))
    .sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

async function replaceFile(write, suffix) {
  const temporaryPath = resolve(
    dirname(write.absolutePath),
    `.${randomUUID()}.${suffix}.tmp`,
  );
  try {
    await writeFile(temporaryPath, write.targetBytes, {
      flag: "wx",
      mode: write.mode,
    });
    await rename(temporaryPath, write.absolutePath);
  } finally {
    await rm(temporaryPath, { force: true });
  }
}

async function restoreOriginalWrites(stagedWrites) {
  for (const write of stagedWrites) {
    await replaceFile(
      { ...write, targetBytes: write.originalBytes },
      "rollback",
    );
  }
}

async function rollbackWrites(projectRoot, stagedWrites, cause) {
  let status;
  try {
    await restoreOriginalWrites(stagedWrites);
    status = await readGitStatus(projectRoot);
  } catch (rollbackCause) {
    refuse("ROLLBACK_FAILED", {
      cause: new AggregateError(
        [cause, rollbackCause],
        "Application and rollback both failed",
      ),
    });
  }
  if (status !== "") {
    refuse("ROLLBACK_RECONCILIATION_FAILED", { cause });
  }
}

async function applyWritesWithRollback(
  projectRoot,
  stagedWrites,
  injectWriteFailureAfter,
) {
  try {
    for (const [index, write] of stagedWrites.entries()) {
      if (injectWriteFailureAfter === index) {
        refuse("INJECTED_WRITE_FAILURE");
      }
      await replaceFile(write, "apply");
    }
    if (injectWriteFailureAfter === stagedWrites.length) {
      refuse("INJECTED_WRITE_FAILURE");
    }
  } catch (cause) {
    await rollbackWrites(projectRoot, stagedWrites, cause);
    throw cause;
  }
}

async function reconcileAppliedWrites(projectRoot, stagedWrites) {
  for (const write of stagedWrites) {
    if (sha256(await readFile(write.absolutePath)) !== write.sha256) {
      refuse("APPLIED_BYTES_MISMATCH");
    }
  }
  const expectedPaths = stagedWrites.map(({ relativePath }) => relativePath).sort();
  const actualPaths = parseStatusPaths(await readGitStatus(projectRoot));
  if (!sameJson(actualPaths, expectedPaths)) {
    refuse("APPLIED_PATHS_MISMATCH");
  }
}

function createContentSafeReceipt(stagedWrites) {
  return {
    schemaVersion: "1.0.0",
    synthetic: true,
    packet: "harbour-light-studio",
    manifestSha256: packetManifestSha256,
    writes: stagedWrites.map(({ relativePath, sha256: digest }) => ({
      path: relativePath,
      sha256: digest,
    })),
  };
}

export async function applySyntheticClientPacket({
  projectRoot,
  packetRoot = defaultPacketRoot,
  injectWriteFailureAfter,
}) {
  const roots = await resolveRequestRoots(projectRoot, packetRoot);
  const packetContext = await readAndValidatePacket(roots.packetRoot);
  await validateProjectIdentity(roots.projectRoot, packetContext.packet);
  const context = { ...roots, ...packetContext };
  const stagedWrites = await stageDeclaredWrites(context);
  await applyWritesWithRollback(
    context.projectRoot,
    stagedWrites,
    injectWriteFailureAfter,
  );
  try {
    await reconcileAppliedWrites(context.projectRoot, stagedWrites);
  } catch (cause) {
    await rollbackWrites(context.projectRoot, stagedWrites, cause);
    throw cause;
  }
  return createContentSafeReceipt(stagedWrites);
}

function parseCliArguments(arguments_) {
  if (
    arguments_.length !== 2 ||
    arguments_[0] !== "--project-root" ||
    !isAbsolute(arguments_[1])
  ) {
    refuse("USAGE_INVALID");
  }
  return { projectRoot: arguments_[1] };
}

async function main() {
  try {
    const receipt = await applySyntheticClientPacket(
      parseCliArguments(process.argv.slice(2)),
    );
    process.stdout.write(`${JSON.stringify(receipt)}\n`);
  } catch (error) {
    const code =
      error instanceof SyntheticClientPacketError
        ? error.code
        : "SYNTHETIC_PACKET_APPLICATION_FAILED";
    process.stderr.write(`${JSON.stringify({ ok: false, code })}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
