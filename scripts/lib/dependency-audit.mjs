import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { lstat, mkdir, mkdtemp, open, readFile, realpath, writeFile } from "node:fs/promises";
import { isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { isolatedProcessOptions, pathIdentityMatches, readPathIdentity } from "./isolated-process.mjs";

const execute = promisify(execFile);
const artifactRoot = fileURLToPath(new URL("../../generated-visual-artifacts/dependency-audit/", import.meta.url));
const knownGraphs = [
  {
    "id": "portfolio",
    "lockSha256": "e46a83d2b2fcd45b1368965cc02694cd60d1d9000283341e884287a9df4f3597",
    "workspacePolicySha256": "a91e1b66e04605fff44dc168eddd60cab2027adf6218ef89e29fbde892b022da",
    "dependencyCounts": {
      "dependencies": 321,
      "devDependencies": 453,
      "optionalDependencies": 180,
      "totalDependencies": 876
    }
  },
  {
    "id": "site",
    "lockSha256": "041c4684a58db5b9e12753ce9f132fd02623cd0d8c87fc6d9a27b9d18a35a6ae",
    "workspacePolicySha256": "25f93c3fceeaa13d129748db36f171706ee5ceef5c55a1e529ffcff762057c6b",
    "dependencyCounts": {
      "dependencies": 321,
      "devDependencies": 453,
      "optionalDependencies": 180,
      "totalDependencies": 876
    }
  },
  {
    "id": "app",
    "lockSha256": "17988722d44ecb809a7d73d7eb553b33f422596f7089ab9ee04900242260c10f",
    "workspacePolicySha256": "559a5acf71f6950c2ca20e759c54b04f93afb80c3f5a03a6448ad0f73c3dff1d",
    "dependencyCounts": {
      "dependencies": 325,
      "devDependencies": 453,
      "optionalDependencies": 188,
      "totalDependencies": 888
    }
  },
  {
    "id": "portfolio-email",
    "lockSha256": "526c473aa0bac20c39435216ceac88b6daca911367ac16a9a13dd1ad53fc3070",
    "workspacePolicySha256": "5e0c092b271e3322a583c6a9ce037e8f6943c9719e0658ce8bb8e7bae10d4984",
    "dependencyCounts": {
      "dependencies": 325,
      "devDependencies": 453,
      "optionalDependencies": 188,
      "totalDependencies": 888
    }
  },
  {
    "id": "app-persistence",
    "lockSha256": "e70b7ad107c93d245c32f9f2c7f8424fd1c4a35a2c146679c55f30cc0c977830",
    "workspacePolicySha256": "bce2f25a339e28fdc6ec7d248318ff2b1273a338e23134d760bc67852f23180d",
    "dependencyCounts": {
      "dependencies": 326,
      "devDependencies": 485,
      "optionalDependencies": 213,
      "totalDependencies": 921
    }
  }
];
const severities = ["info", "low", "moderate", "high", "critical"];
const dependencyCounts = ["dependencies", "devDependencies", "optionalDependencies", "totalDependencies"];
const auditArguments = Object.freeze(["audit", "--audit-level", "info", "--json"]);
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const object = value => value !== null && typeof value === "object" && !Array.isArray(value);
const integer = value => Number.isSafeInteger(value) && value >= 0;
const canonical = value => Array.isArray(value) ? value.map(canonical) : object(value)
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
const same = (left, right) => JSON.stringify(canonical(left)) === JSON.stringify(canonical(right));
const parse = bytes => JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
function refuse(code = "DEPENDENCY_AUDIT_FAILED") { throw new Error(code); }

function inspectReport(result, graph) {
  if (result.operationalError || result.signal || result.killed || ![0, 1].includes(result.exitCode) || result.stderr.length) refuse();
  const report = parse(result.stdout);
  if (!object(report) || !same(Object.keys(report).sort(), ["advisories", "metadata"]) || !object(report.advisories) || !object(report.metadata)) refuse();
  const metadata = report.metadata;
  if (!same(Object.keys(metadata).sort(), [...dependencyCounts, "vulnerabilities"].sort()) || !dependencyCounts.every(key => integer(metadata[key])) || !object(metadata.vulnerabilities)) refuse();
  if (!same(Object.keys(metadata.vulnerabilities).sort(), [...severities].sort()) || !severities.every(key => integer(metadata.vulnerabilities[key]))) refuse();
  const counts = Object.fromEntries(severities.map(key => [key, 0]));
  const identities = new Set();
  const advisories = Object.entries(report.advisories);
  for (const [key, advisory] of advisories) {
    if (!object(advisory) || !integer(advisory.id) || String(advisory.id) !== key || !severities.includes(advisory.severity) ||
        typeof advisory.github_advisory_id !== "string" || !/^GHSA-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}$/.test(advisory.github_advisory_id) ||
        identities.has(advisory.github_advisory_id) || typeof advisory.module_name !== "string" || !advisory.module_name ||
        typeof advisory.vulnerable_versions !== "string" || !advisory.vulnerable_versions || !Array.isArray(advisory.findings) || !advisory.findings.length) refuse();
    identities.add(advisory.github_advisory_id);
    counts[advisory.severity]++;
    for (const finding of advisory.findings) {
      if (!object(finding) || !same(Object.keys(finding).sort(), ["bundled", "dev", "optional", "paths", "version"]) ||
          typeof finding.version !== "string" || !finding.version || !Array.isArray(finding.paths) || !finding.paths.length ||
          finding.paths.some(path => typeof path !== "string" || !path) || new Set(finding.paths).size !== finding.paths.length ||
          ["dev", "optional", "bundled"].some(key => typeof finding[key] !== "boolean")) refuse();
    }
  }
  if (!same(counts, metadata.vulnerabilities)) refuse();
  if (result.exitCode !== (advisories.length ? 1 : 0)) refuse();
  if (graph && !same(Object.fromEntries(dependencyCounts.map(key => [key, metadata[key]])), graph.dependencyCounts)) refuse();
  if (counts.moderate + counts.high + counts.critical > 0) refuse();
}

export function isPassingDependencyAudit(disposition) {
  return disposition?.status === "passed" &&
    disposition.thresholdExitCode === 0 && [0, 1].includes(disposition.rawExitCode);
}

function inside(root, path) {
  const part = relative(root, path);
  return part !== ".." && !part.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) && !isAbsolute(part);
}

async function readBounded(root, path) {
  const resolved = await realpath(path);
  if (!inside(root, resolved) || (await lstat(path)).isSymbolicLink()) refuse("DEPENDENCY_AUDIT_INPUT_CHANGED");
  const handle = await open(resolved, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const before = await handle.stat();
    if (!before.isFile() || before.size > 16 * 1024 * 1024) refuse("DEPENDENCY_AUDIT_INPUT_CHANGED");
    const bytes = await handle.readFile();
    const after = await handle.stat();
    const current = await lstat(resolved);
    if (bytes.length !== before.size || after.size !== before.size || after.mtimeMs !== before.mtimeMs || current.ino !== before.ino || current.dev !== before.dev) refuse("DEPENDENCY_AUDIT_INPUT_CHANGED");
    return bytes;
  } finally { await handle.close(); }
}

export async function inspectDependencyAuditInputs(cwd) {
  const root = await realpath(cwd);
  const lock = hash(await readBounded(root, join(root, "pnpm-lock.yaml")));
  const workspace = hash(await readBounded(root, join(root, "pnpm-workspace.yaml")));
  const graph = knownGraphs.find(entry =>
    entry.lockSha256 === lock && entry.workspacePolicySha256 === workspace) ?? null;
  return { graph, fingerprint: hash(JSON.stringify(canonical({ lock, workspace }))) };
}

async function runProcess(input) {
  try {
    const result = await execute(input.executable, input.arguments, {
      ...isolatedProcessOptions, encoding: "buffer", cwd: input.cwd, env: input.environment, timeout: input.timeout,
    });
    return { exitCode: 0, stdout: result.stdout, stderr: result.stderr, signal: null, killed: false, operationalError: false };
  } catch (error) {
    return { exitCode: Number.isInteger(error.code) ? error.code : null, stdout: error.stdout ?? Buffer.alloc(0), stderr: error.stderr ?? Buffer.alloc(0),
      signal: error.signal ?? null, killed: error.killed === true, operationalError: !Number.isInteger(error.code) || error.killed === true || Boolean(error.signal) };
  }
}

// This helper is internal verification machinery. Certification entry points do not call it.
export async function runDependencyAudit(input, injected = {}) {
  const defaults = { now: Date.now, inspectInputs: inspectDependencyAuditInputs, runProcess };
  if (Object.keys(injected).length && Object.keys(defaults).some(key => typeof injected[key] !== "function")) refuse("DEPENDENCY_AUDIT_ADAPTER_INVALID");
  const adapters = Object.keys(injected).length ? injected : defaults;
  const destination = resolve(input.artifactRoot ?? artifactRoot);
  await mkdir(destination, { recursive: true, mode: 0o700 });
  if ((await lstat(destination)).isSymbolicLink()) refuse();
  const directory = await mkdtemp(join(destination, "audit-"));
  const artifactIdentifier = relative(destination, directory);
  const identity = await readPathIdentity(directory);
  const save = async (name, content) => {
    if (!(await pathIdentityMatches(identity))) refuse();
    await writeFile(join(directory, name), content, { flag: "wx", mode: 0o600 });
    if (!(await pathIdentityMatches(identity))) refuse();
  };
  const startedAt = adapters.now();
  let result;
  let graph;
  try {
    const before = await adapters.inspectInputs(input.cwd);
    graph = before.graph;
    result = await adapters.runProcess({ executable: input.executable, arguments: [...auditArguments], cwd: input.cwd, environment: input.environment, timeout: input.timeout });
    if (!result || !(result.stdout instanceof Uint8Array) || !(result.stderr instanceof Uint8Array)) refuse();
    await save("stdout", result.stdout);
    await save("stderr", result.stderr);
    await save("process.json", JSON.stringify({ executable: input.executable, arguments: auditArguments, graph: graph?.id ?? null, startedAt,
      completedAt: adapters.now(), exitCode: result.exitCode, signal: result.signal ?? null, killed: result.killed === true, operationalError: result.operationalError === true,
      stdoutSha256: hash(result.stdout), stderrSha256: hash(result.stderr) }, null, 2));
    inspectReport(result, graph);
    const after = await adapters.inspectInputs(input.cwd);
    if (after.fingerprint !== before.fingerprint) refuse();
    const disposition = { status: "passed", rawExitCode: result.exitCode, thresholdExitCode: 0, graph: graph?.id ?? null };
    await save("disposition.json", JSON.stringify(disposition, null, 2));
    return { ...disposition, artifactDirectory: artifactIdentifier };
  } catch {
    await save("failure.json", JSON.stringify({ status: "refused", rawExitCode: result?.exitCode ?? null, graph: graph?.id ?? null }, null, 2));
    const error = new Error("DEPENDENCY_AUDIT_FAILED");
    error.auditDisposition = { status: "refused", rawExitCode: result?.exitCode ?? null, artifactDirectory: artifactIdentifier };
    throw error;
  }
}
