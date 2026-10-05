import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import test from "node:test";

const moduleUrl = new URL("../../scripts/lib/dependency-audit.mjs", import.meta.url);
const policyUrl = new URL("../../scripts/dependency-audit-exception.json", import.meta.url);
const instant = Date.parse("2026-10-04T18:30:00Z");
const digest = value => createHash("sha256").update(value).digest("hex");
const raw = (exitCode, report, overrides = {}) => ({ exitCode, stdout: Buffer.from(JSON.stringify(report)), stderr: Buffer.alloc(0), signal: null, killed: false, operationalError: false, ...overrides });

function reportFor(graph) {
  return {
    advisories: { "1240992": { id: 1240992, github_advisory_id: "GHSA-vfj7-8cjw-p6xm", module_name: "braces", severity: "high", vulnerable_versions: "<=3.0.3", patched_versions: ">=3.0.4", findings: structuredClone(graph.advisoryFindings) } },
    metadata: { ...graph.dependencyCounts, vulnerabilities: { info: 0, low: 0, moderate: 0, high: 1, critical: 0 } },
  };
}

async function fixture(t) {
  const module = await import(moduleUrl);
  const policyBytes = await readFile(policyUrl);
  const policy = JSON.parse(policyBytes);
  const directory = await mkdtemp(join(tmpdir(), "egeria-audit-contract-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const calls = [];
  const metadata = new Map(policy.fixObservation.packages.map(entry => [entry.url, {
    name: entry.name, "dist-tags": { latest: entry.latest },
    versions: Object.fromEntries(entry.knownVersions.map(version => [version.version, { name: entry.name, version: version.version, dependencies: version.dependencies }])),
    time: Object.fromEntries(entry.knownVersions.map(version => [version.version, version.publishedAt])),
  }]));
  const graph = policy.graphs[0];
  const result = raw(1, reportFor(graph));
  const adapters = {
    now: () => instant,
    readPolicy: async () => policyBytes,
    isHosted: () => false,
    inspectInputs: async () => ({ graph, fingerprint: "same-reviewed-inputs" }),
    fetchBytes: async url => {
      assert.ok(metadata.has(url), `unexpected network request: ${url}`);
      return Buffer.from(JSON.stringify(metadata.get(url)));
    },
    runProcess: async input => { calls.push(input); return result; },
  };
  const input = { executable: "pnpm", cwd: directory, environment: { HOME: directory, NPM_CONFIG_REGISTRY: "https://registry.npmjs.org/" }, timeout: 1234, artifactRoot: join(directory, "receipts") };
  return { module, policy, policyBytes, directory, calls, metadata, graph, result, adapters, input };
}

test("all six admitted graphs preserve the actual failing audit and a separate exception disposition", async t => {
  const h = await fixture(t);
  for (const graph of h.policy.graphs) {
    const result = raw(1, reportFor(graph));
    const receipt = await h.module.runDependencyAudit(h.input, { ...h.adapters, inspectInputs: async () => ({ graph, fingerprint: graph.lockSha256 }), runProcess: async input => { h.calls.push(input); return result; } });
    assert.equal(receipt.status, "accepted-with-security-exception");
    assert.equal(receipt.rawExitCode, 1);
    assert.equal(receipt.graph, graph.id);
    assert.deepEqual(await readFile(join(h.input.artifactRoot, receipt.artifactDirectory, "stdout")), result.stdout);
    assert.deepEqual(await readFile(join(h.input.artifactRoot, receipt.artifactDirectory, "stderr")), result.stderr);
    const process = JSON.parse(await readFile(join(h.input.artifactRoot, receipt.artifactDirectory, "process.json")));
    assert.equal(process.exitCode, 1);
    assert.equal(process.stdoutSha256, digest(result.stdout));
    assert.equal(JSON.parse(await readFile(join(h.input.artifactRoot, receipt.artifactDirectory, "disposition.json"))).status, receipt.status);
  }
  for (const call of h.calls) {
    assert.deepEqual(call.arguments, ["audit", "--audit-level", "moderate", "--json"]);
    assert.equal(call.cwd, h.input.cwd);
    assert.deepEqual(call.environment, h.input.environment);
    assert.equal(call.timeout, 1234);
  }
});

test("ordinary audit success needs no security exception or network fix check", async t => {
  const h = await fixture(t);
  const report = reportFor(h.graph);
  report.advisories = {};
  report.metadata.vulnerabilities.high = 0;
  for (const graph of [h.graph, null]) {
    const result = await h.module.runDependencyAudit(h.input, {
      ...h.adapters,
      now: () => Date.parse("2030-01-01"),
      readPolicy: async () => Buffer.from(JSON.stringify({ ...h.policy, status: "revoked" })),
      isHosted: () => true,
      inspectInputs: async () => ({ graph, fingerprint: "unchanged-inputs" }),
      runProcess: async () => raw(0, report),
      fetchBytes: async () => assert.fail("ordinary success must not request exception metadata"),
    });
    assert.equal(result.status, "passed");
    assert.equal(result.rawExitCode, 0);
    assert.equal(result.graph, graph?.id ?? null);
  }
});

test("ordinary audit success rejects inconsistent dependency totals for every known graph", async t => {
  const h = await fixture(t);
  for (const graph of h.policy.graphs) {
    for (const key of Object.keys(graph.dependencyCounts)) {
      const report = reportFor(graph);
      report.advisories = {};
      report.metadata.vulnerabilities.high = 0;
      report.metadata[key]++;
      const result = raw(0, report);
      let refusal;
      await assert.rejects(h.module.runDependencyAudit(h.input, {
        ...h.adapters,
        inspectInputs: async () => ({ graph, fingerprint: graph.lockSha256 }),
        runProcess: async () => result,
        fetchBytes: async () => assert.fail("inconsistent totals must refuse before exception metadata"),
      }), error => {
        refusal = error.auditDisposition;
        return error.message === "DEPENDENCY_AUDIT_FAILED";
      });
      assert.equal(refusal.rawExitCode, 0);
      assert.deepEqual(await readFile(join(h.input.artifactRoot, refusal.artifactDirectory, "stdout")), result.stdout);
      assert.equal(JSON.parse(await readFile(join(h.input.artifactRoot, refusal.artifactDirectory, "process.json"))).exitCode, 0);
    }
  }
});

for (const status of ["passed", "accepted-with-security-exception", "refused"]) {
  test(`public ${status} audit disposition contains only a relative receipt identifier`, async t => {
    const h = await fixture(t);
    const report = reportFor(h.graph);
    if (status === "passed") {
      report.advisories = {};
      report.metadata.vulnerabilities.high = 0;
    }
    const result = raw(status === "passed" ? 0 : 1, report, status === "refused" ? { stderr: Buffer.from("registry unavailable") } : {});
    const audit = h.module.runDependencyAudit(h.input, { ...h.adapters, runProcess: async () => result });
    let disposition;
    let publicValue;
    if (status === "refused") {
      await assert.rejects(audit, error => {
        disposition = error.auditDisposition;
        publicValue = error;
        return error.message === "DEPENDENCY_AUDIT_FAILED";
      });
    } else {
      disposition = await audit;
      publicValue = disposition;
    }
    assert.equal(disposition.status, status);
    const serialized = JSON.stringify(publicValue);
    assert.equal(serialized.includes(h.input.artifactRoot), false);
    assert.equal(serialized.includes(h.input.environment.HOME), false);
    assert.equal(isAbsolute(disposition.artifactDirectory), false);
    const directory = resolve(h.input.artifactRoot, disposition.artifactDirectory);
    assert.equal(relative(h.input.artifactRoot, directory), disposition.artifactDirectory);
    assert.equal(dirname(directory), h.input.artifactRoot);
    assert.deepEqual(await readFile(join(directory, "stdout")), result.stdout);
    assert.deepEqual(await readFile(join(directory, "stderr")), result.stderr);
    const process = JSON.parse(await readFile(join(directory, "process.json")));
    assert.equal(process.exitCode, result.exitCode);
    assert.equal(process.stdoutSha256, digest(result.stdout));
    assert.equal(process.stderrSha256, digest(result.stderr));
    assert.equal(JSON.parse(await readFile(join(directory, status === "refused" ? "failure.json" : "disposition.json"))).status, status);
  });
}

test("unknown advisories, inconsistent reports and operational audit failures never receive an exception", async t => {
  const h = await fixture(t);
  const cases = [
    value => { value.advisories["1240992"].github_advisory_id = "GHSA-aaaa-bbbb-cccc"; },
    value => { value.advisories["1240992"].severity = "critical"; },
    value => { value.advisories["1240992"].findings[0].version = "3.0.2"; },
    value => { value.advisories["1240992"].findings[0].paths.push("untrusted>braces"); },
    value => { value.advisories["1240992"].findings = []; },
    value => { value.advisories["1240992"].severity = "unknown"; },
    value => { value.advisories["2"] = { ...value.advisories["1240992"], id: 2 }; },
    value => { value.metadata.vulnerabilities.high = 0; },
    value => { value.metadata.totalDependencies++; },
    value => { delete value.metadata.devDependencies; },
    value => { value.error = "registry unavailable"; },
  ];
  const results = cases.map(change => { const report = reportFor(h.graph); change(report); return raw(1, report); });
  for (const override of [{ exitCode: 0 }, { exitCode: 2 }, { exitCode: null, operationalError: true }, { signal: "SIGTERM" }, { killed: true }, { operationalError: true }, { stderr: Buffer.from("registry error") }, { stdout: Buffer.from("{truncated") }, { stdout: Buffer.from([255]) }]) results.push({ ...h.result, ...override });
  for (const result of results) {
    let refusal;
    await assert.rejects(h.module.runDependencyAudit(h.input, { ...h.adapters, runProcess: async () => result }), error => {
      refusal = error.auditDisposition;
      return error.message === "DEPENDENCY_AUDIT_FAILED";
    });
    assert.deepEqual(await readFile(join(h.input.artifactRoot, refusal.artifactDirectory, "stdout")), result.stdout);
    assert.deepEqual(await readFile(join(h.input.artifactRoot, refusal.artifactDirectory, "stderr")), result.stderr);
    assert.equal(JSON.parse(await readFile(join(h.input.artifactRoot, refusal.artifactDirectory, "process.json"))).exitCode, result.exitCode);
  }
});

test("expiry, revocation, input drift and newly published fixes or parents refuse continuation", async t => {
  const h = await fixture(t);
  const cases = [
    { now: () => Date.parse(h.policy.expiresAt) },
    { readPolicy: async () => Buffer.from(JSON.stringify({ ...h.policy, status: "revoked" })) },
    { inspectInputs: async () => ({ graph: null, fingerprint: "unknown-pair" }) },
    { fetchBytes: async () => { throw new Error("offline"); } },
    { fetchBytes: async () => Buffer.from("{}") },
    { fetchBytes: async url => {
      const value = structuredClone(h.metadata.get(url));
      value.versions["3.0.4"] = { name: value.name, version: "3.0.4" };
      value.time["3.0.4"] = "2026-10-04T18:29:00Z";
      return Buffer.from(JSON.stringify(value));
    } },
  ];
  let inspections = 0;
  cases.push({ inspectInputs: async () => ({ graph: h.graph, fingerprint: String(inspections++) }) });
  let ticks = 0;
  cases.push({ now: () => ticks++ === 0 ? instant : Date.parse(h.policy.expiresAt) });
  for (const change of cases) await assert.rejects(h.module.runDependencyAudit(h.input, { ...h.adapters, ...change }), /DEPENDENCY_AUDIT_FAILED/);
});

test("hosted acceptance requires the current identical active public policy", async t => {
  const h = await fixture(t);
  const hostedUrl = "https://raw.githubusercontent.com/Egeria-Systems/egeria-scaffold/application-environment-configuration/scripts/dependency-audit-exception.json";
  const adapters = { ...h.adapters, isHosted: () => true, fetchBytes: async url => url === hostedUrl ? h.policyBytes : h.adapters.fetchBytes(url) };
  assert.equal((await h.module.runDependencyAudit(h.input, adapters)).rawExitCode, 1);
  await assert.rejects(h.module.runDependencyAudit(h.input, { ...adapters, fetchBytes: async url => url === hostedUrl ? Buffer.from("revoked") : h.adapters.fetchBytes(url) }), /DEPENDENCY_AUDIT_FAILED/);
});

test("incomplete test adapters and unwritable evidence fail before they can silently use live services", async t => {
  const h = await fixture(t);
  await assert.rejects(h.module.runDependencyAudit(h.input, { runProcess: h.adapters.runProcess }), /DEPENDENCY_AUDIT_ADAPTER_INVALID/);
  const collision = join(h.directory, "collision");
  await writeFile(collision, "preserve");
  await assert.rejects(h.module.runDependencyAudit({ ...h.input, artifactRoot: collision }, h.adapters));
  assert.equal(await readFile(collision, "utf8"), "preserve");
  assert.equal(h.calls.length, 0);
});

test("input inspection binds lock-policy pairs, caller bytes and reviewed configuration", async t => {
  const h = await fixture(t);
  const cwd = join(h.directory, "project");
  await mkdir(cwd);
  const policy = structuredClone(h.policy);
  const graph = policy.graphs[0];
  await writeFile(join(cwd, "pnpm-lock.yaml"), "lock");
  await writeFile(join(cwd, "pnpm-workspace.yaml"), "policy");
  graph.lockSha256 = digest("lock");
  graph.workspacePolicySha256 = digest("policy");
  const config = join(cwd, graph.eslintConfigPath);
  await mkdir(join(cwd, "apps/web"), { recursive: true });
  await writeFile(config, "reviewed configuration");
  graph.eslintConfigSha256 = digest("reviewed configuration");
  const modules = join(cwd, "apps/web/node_modules");
  for (const row of graph.callerFiles) {
    const file = join(modules, row.package, row.member);
    await mkdir(dirname(file), { recursive: true });
    const content = row.member === "package.json" ? JSON.stringify({ name: row.package, version: row.version }) : `reviewed ${row.package}/${row.member}`;
    row.sha256 = digest(content);
    row.bytes = Buffer.byteLength(content);
    await writeFile(file, content);
  }
  const before = await h.module.inspectDependencyAuditInputs(cwd, policy);
  assert.equal(before.graph.id, graph.id);
  await writeFile(config, "settings.next.rootDir from an untrusted source");
  await assert.rejects(h.module.inspectDependencyAuditInputs(cwd, policy), /DEPENDENCY_AUDIT_INPUT_CHANGED/);
  await writeFile(config, "reviewed configuration");
  const caller = join(modules, "braces/lib/parse.js");
  const callerBefore = await readFile(caller);
  await writeFile(caller, "changed caller");
  await assert.rejects(h.module.inspectDependencyAuditInputs(cwd, policy), /DEPENDENCY_AUDIT_INPUT_CHANGED/);
  await writeFile(caller, callerBefore);
  await writeFile(join(cwd, "pnpm-workspace.yaml"), "different policy");
  assert.equal((await h.module.inspectDependencyAuditInputs(cwd, policy)).graph, null);
});
