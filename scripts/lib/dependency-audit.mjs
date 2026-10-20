import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { lstat, mkdir, mkdtemp, open, readFile, realpath, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { isolatedProcessOptions, pathIdentityMatches, readPathIdentity } from "./isolated-process.mjs";

const execute = promisify(execFile);
const policyUrl = new URL("../dependency-audit-exception.json", import.meta.url);
const artifactRoot = fileURLToPath(new URL("../../generated-visual-artifacts/dependency-audit/", import.meta.url));
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
  const thresholdFailure = counts.moderate + counts.high + counts.critical > 0;
  if (result.exitCode !== (advisories.length ? 1 : 0)) refuse();
  if (graph && !same(Object.fromEntries(dependencyCounts.map(key => [key, metadata[key]])), graph.dependencyCounts)) refuse();
  if (!thresholdFailure) return { status: "passed", thresholdExitCode: 0 };
  if (!graph || advisories.length !== 1) refuse();
  const advisory = advisories[0][1];
  if (advisory.github_advisory_id !== "GHSA-vfj7-8cjw-p6xm" || advisory.module_name !== "braces" || advisory.severity !== "high" ||
      advisory.vulnerable_versions !== "<=3.0.3" || !same(advisory.findings, graph.advisoryFindings) ||
      advisory.findings.some(finding => finding.version !== "3.0.3")) refuse();
  return { status: "exception-required", thresholdExitCode: 1 };
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

export async function inspectDependencyAuditInputs(cwd, policy) {
  const root = await realpath(cwd);
  const lock = hash(await readBounded(root, join(root, "pnpm-lock.yaml")));
  const workspace = hash(await readBounded(root, join(root, "pnpm-workspace.yaml")));
  const graph = policy.graphs.find(entry => entry.lockSha256 === lock && entry.workspacePolicySha256 === workspace) ?? null;
  const files = { lock, workspace };
  if (graph) {
    files.configuration = hash(await readBounded(root, join(root, graph.eslintConfigPath)));
    if (files.configuration !== graph.eslintConfigSha256) refuse("DEPENDENCY_AUDIT_INPUT_CHANGED");
    const consumer = dirname(join(root, graph.eslintConfigPath));
    const configuration = await realpath(join(consumer, "node_modules/eslint-config-next"));
    const plugin = await realpath(join(dirname(configuration), "@next/eslint-plugin-next"));
    const glob = await realpath(join(dirname(dirname(plugin)), "fast-glob"));
    const micromatch = await realpath(join(dirname(glob), "micromatch"));
    const braces = await realpath(join(dirname(micromatch), "braces"));
    const packages = { "eslint-config-next": configuration, "@next/eslint-plugin-next": plugin, "fast-glob": glob, micromatch, braces };
    for (const expected of graph.callerFiles) {
      const bytes = await readBounded(root, join(packages[expected.package], expected.member));
      const digest = hash(bytes);
      if (digest !== expected.sha256 || bytes.length !== expected.bytes) refuse("DEPENDENCY_AUDIT_INPUT_CHANGED");
      if (expected.member === "package.json") {
        const manifest = parse(bytes);
        if (manifest.name !== expected.package || manifest.version !== expected.version) refuse("DEPENDENCY_AUDIT_INPUT_CHANGED");
      }
      files[`${expected.package}/${expected.member}`] = digest;
    }
  }
  return { graph, fingerprint: hash(JSON.stringify(canonical(files))) };
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

async function fetchBytes(url) {
  const address = new URL(url);
  if (address.protocol !== "https:" || address.username || address.password || !["registry.npmjs.org", "raw.githubusercontent.com"].includes(address.hostname)) refuse();
  const response = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(30_000), headers: { Accept: "application/json" } });
  if (!response.ok || !response.body) refuse();
  const chunks = [];
  let size = 0;
  for await (const chunk of response.body) {
    size += chunk.length;
    if (size > 16 * 1024 * 1024) refuse();
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function requireActivePolicy(policy, now) {
  if (policy.status !== "active" || policy.advisory !== "GHSA-vfj7-8cjw-p6xm" || policy.package !== "braces" || policy.version !== "3.0.3" ||
      policy.pnpmVersion !== "11.20.0" || !Number.isFinite(now) || !Number.isFinite(Date.parse(policy.expiresAt)) || now >= Date.parse(policy.expiresAt)) refuse();
}

async function checkCurrentPolicy(policy, bytes, adapters, observations) {
  if (!adapters.isHosted()) return;
  const active = policy.hostedActivePolicy;
  if (active.repository !== "Egeria-Systems/egeria-scaffold" || active.ref !== "application-environment-configuration" || active.path !== "scripts/dependency-audit-exception.json") refuse();
  const url = `https://raw.githubusercontent.com/${active.repository}/${active.ref}/${active.path}`;
  const current = await adapters.fetchBytes(url);
  observations.push({ url, sha256: hash(current), bytes: current.length });
  if (!Buffer.from(current).equals(bytes)) refuse();
}

async function checkFixAvailability(policy, adapters, observations) {
  const baseline = Date.parse(policy.fixObservation.observedAt);
  if (!Number.isFinite(baseline) || policy.fixObservation.packages.length !== 5) refuse();
  const names = ["eslint-config-next", "@next/eslint-plugin-next", "fast-glob", "micromatch", "braces"];
  if (!same(policy.fixObservation.packages.map(entry => entry.name).sort(), names.sort())) refuse();
  for (const expected of policy.fixObservation.packages) {
    const address = new URL(expected.url);
    if (address.origin !== "https://registry.npmjs.org" || decodeURIComponent(address.pathname.slice(1)) !== expected.name || address.search || address.hash) refuse();
    const bytes = await adapters.fetchBytes(expected.url);
    const observation = { url: expected.url, sha256: hash(bytes), bytes: bytes.length };
    observations.push(observation);
    const metadata = parse(bytes);
    if (metadata.name !== expected.name || !object(metadata.versions) || !object(metadata.time) || !object(metadata["dist-tags"]) || metadata["dist-tags"].latest !== expected.latest) refuse();
    for (const version of expected.knownVersions) {
      const current = metadata.versions[version.version];
      if (!object(current) || current.name !== expected.name || current.version !== version.version || !same(current.dependencies, version.dependencies) || metadata.time[version.version] !== version.publishedAt) refuse();
    }
    const stable = Object.keys(metadata.versions).filter(version => /^\d+\.\d+\.\d+$/.test(version));
    if (!stable.length || !stable.includes(expected.latest)) refuse();
    observation.latest = metadata["dist-tags"].latest;
    observation.stablePublications = Object.fromEntries(stable.sort().map(version => [version, metadata.time[version]]));
    observation.selectedDependencies = Object.fromEntries(expected.knownVersions.map(version => [version.version, metadata.versions[version.version].dependencies]));
    for (const version of stable) {
      const published = Date.parse(metadata.time[version]);
      if (typeof metadata.time[version] !== "string" || !/^\d{4}-\d{2}-\d{2}T/.test(metadata.time[version]) || !Number.isFinite(published) || published > baseline) refuse();
      if (expected.name === "braces") {
        const [major, minor, patch] = version.split(".").map(Number);
        if (major > 3 || (major === 3 && (minor > 0 || patch > 3))) refuse();
      }
    }
  }
}

// This helper is internal verification machinery. Certification entry points do not call it.
export async function runDependencyAudit(input, injected = {}) {
  const defaults = { now: Date.now, readPolicy: () => readFile(policyUrl), isHosted: () => process.env.GITHUB_ACTIONS === "true", inspectInputs: inspectDependencyAuditInputs, fetchBytes, runProcess };
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
  const observations = [];
  const startedAt = adapters.now();
  let result;
  let graph;
  let policySha256;
  try {
    const policyBytes = Buffer.from(await adapters.readPolicy());
    policySha256 = hash(policyBytes);
    const policy = parse(policyBytes);
    const before = await adapters.inspectInputs(input.cwd, policy);
    graph = before.graph;
    result = await adapters.runProcess({ executable: input.executable, arguments: [...auditArguments], cwd: input.cwd, environment: input.environment, timeout: input.timeout });
    if (!result || !(result.stdout instanceof Uint8Array) || !(result.stderr instanceof Uint8Array)) refuse();
    await save("stdout", result.stdout);
    await save("stderr", result.stderr);
    await save("process.json", JSON.stringify({ executable: input.executable, arguments: auditArguments, graph: graph?.id ?? null, startedAt,
      completedAt: adapters.now(), exitCode: result.exitCode, signal: result.signal ?? null, killed: result.killed === true, operationalError: result.operationalError === true,
      stdoutSha256: hash(result.stdout), stderrSha256: hash(result.stderr) }, null, 2));
    const assessment = inspectReport(result, graph);
    let status = assessment.status;
    if (status === "exception-required") {
      requireActivePolicy(policy, startedAt);
      await checkCurrentPolicy(policy, policyBytes, adapters, observations);
      await checkFixAvailability(policy, adapters, observations);
      if (!Buffer.from(await adapters.readPolicy()).equals(policyBytes)) refuse();
      await checkCurrentPolicy(policy, policyBytes, adapters, observations);
      requireActivePolicy(policy, adapters.now());
      status = "accepted-with-security-exception";
    }
    const after = await adapters.inspectInputs(input.cwd, policy);
    if (after.fingerprint !== before.fingerprint) refuse();
    if (status === "accepted-with-security-exception") requireActivePolicy(policy, adapters.now());
    const disposition = { status, rawExitCode: result.exitCode, thresholdExitCode: assessment.thresholdExitCode, graph: graph?.id ?? null, policySha256,
      ...(status === "accepted-with-security-exception" ? { advisory: policy.advisory, expiresAt: policy.expiresAt } : {}) };
    await save("metadata-observations.json", JSON.stringify(observations, null, 2));
    await save("disposition.json", JSON.stringify(disposition, null, 2));
    return { ...disposition, artifactDirectory: artifactIdentifier };
  } catch {
    await save("failure.json", JSON.stringify({ status: "refused", rawExitCode: result?.exitCode ?? null, graph: graph?.id ?? null, policySha256, observations }, null, 2));
    const error = new Error("DEPENDENCY_AUDIT_FAILED");
    error.auditDisposition = { status: "refused", rawExitCode: result?.exitCode ?? null, artifactDirectory: artifactIdentifier };
    throw error;
  }
}
