import { readFile, readdir } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packageRoots = ["apps", "packages", "proofs"];
const semverPattern =
  /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

const expectedPublicPackages = Object.freeze([
  Object.freeze({
    name: "@egeria-systems/observability",
    path: "packages/observability",
    version: "0.3.0",
    publishedVersions: Object.freeze(["0.1.0", "0.2.0"]),
    expectedVersionStatus: "absent",
  }),
  Object.freeze({
    name: "@egeria-systems/standards",
    path: "packages/standards",
    version: "0.2.0",
    publishedVersions: Object.freeze(["0.1.0", "0.2.0"]),
    expectedVersionStatus: "present",
  }),
]);

const createProblem = (code, message) => Object.freeze({ code, message });
const freezeProblems = (problems) => Object.freeze(problems);

function comparePackageIdentity(left, right) {
  return (
    left.name.localeCompare(right.name) || left.path.localeCompare(right.path)
  );
}

function publicPackageIdentity(packages) {
  return packages
    .filter(({ private: isPrivate }) => isPrivate !== true)
    .map(({ name, path }) => ({ name, path }))
    .sort(comparePackageIdentity);
}

function identitiesAgree(packages) {
  return (
    JSON.stringify(publicPackageIdentity(packages)) ===
    JSON.stringify(
      expectedPublicPackages
        .map(({ name, path }) => ({ name, path }))
        .sort(comparePackageIdentity),
    )
  );
}

export function checkReleaseContext({
  githubRef,
  githubSha,
  releaseCommit,
}) {
  const problems = [];

  if (githubRef !== "refs/heads/main") {
    problems.push(
      createProblem(
        "RELEASE_REF_INVALID",
        "Package release requires the main branch reference.",
      ),
    );
  }
  if (!/^[0-9a-f]{40}$/.test(releaseCommit ?? "")) {
    problems.push(
      createProblem(
        "RELEASE_COMMIT_INVALID",
        "The release commit must be a lowercase 40-character Git SHA.",
      ),
    );
  }
  if (githubSha !== releaseCommit) {
    problems.push(
      createProblem(
        "RELEASE_COMMIT_MISMATCH",
        "The checked-out commit does not match the approved release commit.",
      ),
    );
  }

  return freezeProblems(problems);
}

export function checkLocalCandidate({ packages, pendingChangesets }) {
  const problems = [];

  if (!identitiesAgree(packages)) {
    return freezeProblems([
      createProblem(
        "PUBLIC_PACKAGE_SET_INVALID",
        "Only the approved standards and observability package paths may be public.",
      ),
    ]);
  }

  const packagesByName = new Map(
    packages.map((packageRecord) => [packageRecord.name, packageRecord]),
  );
  for (const expectedPackage of expectedPublicPackages) {
    const version = packagesByName.get(expectedPackage.name)?.version;

    if (!semverPattern.test(version ?? "") || version === "0.0.0") {
      problems.push(
        createProblem(
          "PUBLIC_PACKAGE_VERSION_INVALID",
          "Every public package must have a valid nonzero semantic version.",
        ),
      );
    } else if (version !== expectedPackage.version) {
      problems.push(
        createProblem(
          "PUBLIC_PACKAGE_VERSION_UNEXPECTED",
          "The public package candidate must use the approved release-candidate version.",
        ),
      );
    }
  }

  if (pendingChangesets.length > 0) {
    problems.push(
      createProblem(
        "PENDING_CHANGESET",
        "The release candidate must contain no unmaterialized Changeset.",
      ),
    );
  }

  return freezeProblems(problems);
}

function registryResultIdentity(registryResults) {
  return registryResults
    .map(({ name, version }) => ({ name, version }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

export function checkRegistryState({
  packages,
  pendingChangesets,
  registryResults,
}) {
  const localProblems = checkLocalCandidate({ packages, pendingChangesets });

  if (localProblems.length > 0) {
    return localProblems;
  }

  const expectedResults = expectedPublicPackages.map(({ name, version }) => ({
    name,
    version,
  }));
  if (
    JSON.stringify(registryResultIdentity(registryResults)) !==
    JSON.stringify(registryResultIdentity(expectedResults))
  ) {
    return freezeProblems([
      createProblem(
        "REGISTRY_RESULT_SET_INVALID",
        "Registry validation must cover both exact public package versions once.",
      ),
    ]);
  }

  const expectedPackagesByName = new Map(
    expectedPublicPackages.map((packageRecord) => [
      packageRecord.name,
      packageRecord,
    ]),
  );
  if (
    registryResults.some(({ name, packageStatus, status, versions }) => {
      const expectedPackage = expectedPackagesByName.get(name);

      return (
        packageStatus !== "present" ||
        status !== expectedPackage?.expectedVersionStatus ||
        !Array.isArray(versions) ||
        JSON.stringify([...versions].sort()) !==
          JSON.stringify(expectedPackage?.publishedVersions)
      );
    })
  ) {
    return freezeProblems([
      createProblem(
        "REGISTRY_STATE_INVALID",
        "Each public package history and exact candidate-version status must match the approved registry state.",
      ),
    ]);
  }

  return freezeProblems([]);
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function workspaceManifestPaths() {
  const manifestPaths = [join(repositoryRoot, "package.json")];

  for (const packageRoot of packageRoots) {
    const rootPath = join(repositoryRoot, packageRoot);
    const entries = await readdir(rootPath, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        manifestPaths.push(join(rootPath, entry.name, "package.json"));
      }
    }
  }

  return manifestPaths;
}

async function loadPackageRecords() {
  return Promise.all(
    (await workspaceManifestPaths()).map(async (manifestPath) => {
      const manifest = await readJson(manifestPath);

      return {
        name: manifest.name,
        path: relative(repositoryRoot, dirname(manifestPath)) || ".",
        private: manifest.private,
        version: manifest.version,
      };
    }),
  );
}

export function selectPendingChangesets(fileNames) {
  return fileNames
    .filter((file) => file.endsWith(".md") && file !== "README.md")
    .sort();
}

export async function loadPendingChangesets() {
  return selectPendingChangesets(
    await readdir(join(repositoryRoot, ".changeset")),
  );
}

export function classifyRegistryResponseStatus(statusCode) {
  if (statusCode === 404) return "absent";
  if (statusCode === 200) return "present";
  if (statusCode >= 300 && statusCode < 400) return "redirect";
  if (statusCode === 429) return "rate-limited";
  if (statusCode === 401 || statusCode === 403) {
    return "authentication-failed";
  }
  return "unexpected";
}

async function requestRegistryStatus(url, request) {
  try {
    const response = await request(url, { redirect: "manual" });

    return classifyRegistryResponseStatus(response.status);
  } catch {
    return "network-failed";
  }
}

function readPublishedVersions(packument) {
  if (
    typeof packument !== "object" ||
    packument === null ||
    Array.isArray(packument)
  ) {
    return undefined;
  }

  const { versions } = packument;
  if (
    typeof versions !== "object" ||
    versions === null ||
    Array.isArray(versions)
  ) {
    return undefined;
  }

  const publishedVersions = Object.keys(versions).sort();

  return publishedVersions.every((version) => semverPattern.test(version))
    ? Object.freeze(publishedVersions)
    : undefined;
}

async function requestRegistryHistory(url, request) {
  try {
    const response = await request(url, { redirect: "manual" });
    const packageStatus = classifyRegistryResponseStatus(response.status);

    if (packageStatus !== "present") {
      return { packageStatus, versions: Object.freeze([]) };
    }

    const versions = readPublishedVersions(await response.json());

    return versions
      ? { packageStatus, versions }
      : { packageStatus: "invalid-response", versions: Object.freeze([]) };
  } catch {
    return {
      packageStatus: "network-failed",
      versions: Object.freeze([]),
    };
  }
}

export async function readRegistryPackageState({
  name,
  version,
  request = fetch,
}) {
  const packageUrl = `https://registry.npmjs.org/${encodeURIComponent(name)}`;
  const [packageHistory, status] = await Promise.all([
    requestRegistryHistory(packageUrl, request),
    requestRegistryStatus(`${packageUrl}/${version}`, request),
  ]);

  return { name, version, ...packageHistory, status };
}

async function loadRegistryResults() {
  return Promise.all(
    expectedPublicPackages.map(({ name, version }) =>
      readRegistryPackageState({ name, version }),
    ),
  );
}

async function run(mode) {
  if (mode === "context") {
    return checkReleaseContext({
      githubRef: process.env.GITHUB_REF,
      githubSha: process.env.GITHUB_SHA,
      releaseCommit: process.env.RELEASE_COMMIT,
    });
  }

  const packages = await loadPackageRecords();
  const pendingChangesets = await loadPendingChangesets();

  if (mode === "local") {
    return checkLocalCandidate({ packages, pendingChangesets });
  }
  if (mode === "registry") {
    return checkRegistryState({
      packages,
      pendingChangesets,
      registryResults: await loadRegistryResults(),
    });
  }

  return freezeProblems([
    createProblem(
      "RELEASE_CHECK_MODE_INVALID",
      "Release check mode must be context, local, or registry.",
    ),
  ]);
}

async function main() {
  try {
    const problems = await run(process.argv[2]);

    for (const { code, message } of problems) {
      console.error(`${code}: ${message}`);
    }
    if (problems.length > 0) process.exitCode = 1;
  } catch {
    console.error("RELEASE_CHECK_FAILED: Release validation could not complete.");
    process.exitCode = 1;
  }
}

if (
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  await main();
}
