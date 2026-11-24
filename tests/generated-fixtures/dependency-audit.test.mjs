import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import test from "node:test";

import { inspectDependencyAuditInputs, runDependencyAudit } from "../../scripts/lib/dependency-audit.mjs";

const instant = Date.parse("2026-11-18T16:00:00Z");
const digest = bytes => createHash("sha256").update(bytes).digest("hex");
const dependencyCounts = { dependencies: 3, devDependencies: 2, optionalDependencies: 1, totalDependencies: 5 };

function reportFor(severity, advisoryId = "GHSA-fc5q-39xc-vjpf", packageName = "picomatch") {
  return {
    advisories: severity === undefined ? {} : {
      "1240992": {
        id: 1240992,
        github_advisory_id: advisoryId,
        module_name: packageName,
        severity,
        vulnerable_versions: "<=4.0.7",
        findings: [{ version: "4.0.7", dev: true, optional: false, bundled: false, paths: ["apps__web>vitest>picomatch"] }],
      },
    },
    metadata: {
      ...dependencyCounts,
      vulnerabilities: { info: 0, low: 0, moderate: 0, high: 0, critical: 0, ...(severity && { [severity]: 1 }) },
    },
  };
}

function raw(exitCode, report, overrides = {}) {
  return {
    exitCode, stdout: Buffer.from(JSON.stringify(report)), stderr: Buffer.alloc(0),
    signal: null, killed: false, operationalError: false, ...overrides,
  };
}

async function fixture(t, result, graph = null) {
  const directory = await mkdtemp(join(tmpdir(), "egeria-audit-contract-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const calls = [];
  const input = {
    executable: "pnpm", cwd: directory, environment: { LANG: "C", AUDIT_TEST_DIRECTORY: directory },
    timeout: 1234, artifactRoot: join(directory, "receipts"),
  };
  const adapters = {
    now: () => instant,
    inspectInputs: async () => ({ graph, fingerprint: "unchanged" }),
    runProcess: async arguments_ => {
      calls.push(arguments_);
      return result;
    },
  };
  return { directory, input, adapters, calls };
}

async function assertReceipt(input, disposition, result) {
  assert.equal(isAbsolute(disposition.artifactDirectory), false);
  const directory = resolve(input.artifactRoot, disposition.artifactDirectory);
  assert.equal(relative(input.artifactRoot, directory), disposition.artifactDirectory);
  assert.equal(dirname(directory), input.artifactRoot);
  assert.equal(JSON.stringify(disposition).includes(input.cwd), false);
  assert.deepEqual(await readFile(join(directory, "stdout")), result.stdout);
  assert.deepEqual(await readFile(join(directory, "stderr")), result.stderr);
  const process = JSON.parse(await readFile(join(directory, "process.json")));
  assert.equal(process.exitCode, result.exitCode);
  assert.equal(process.stdoutSha256, digest(result.stdout));
  assert.equal(process.stderrSha256, digest(result.stderr));
  const receiptName = disposition.status === "refused" ? "failure.json" : "disposition.json";
  const receipt = JSON.parse(await readFile(join(directory, receiptName)));
  assert.equal(receipt.status, disposition.status);
  assert.equal(receipt.rawExitCode, result.exitCode);
}

test("a valid audit runs without an exception policy or registry metadata adapter", async t => {
  const result = raw(0, reportFor());
  const { input, adapters, calls } = await fixture(t, result);
  const disposition = await runDependencyAudit(input, adapters);
  assert.equal(disposition.status, "passed");
  assert.equal(disposition.rawExitCode, 0);
  assert.equal(disposition.thresholdExitCode, 0);
  assert.deepEqual(calls, [{
    executable: "pnpm", arguments: ["audit", "--audit-level", "info", "--json"],
    cwd: input.cwd, environment: input.environment, timeout: input.timeout,
  }]);
  await assertReceipt(input, disposition, result);
});

for (const severity of ["info", "low"]) {
  test("a complete " + severity + " audit preserves the native exit and passes the threshold", async t => {
    const result = raw(1, reportFor(severity));
    const { input, adapters } = await fixture(t, result);
    const disposition = await runDependencyAudit(input, adapters);
    assert.equal(disposition.rawExitCode, 1);
    assert.equal(disposition.thresholdExitCode, 0);
    assert.equal(disposition.status, "passed");
    await assertReceipt(input, disposition, result);
  });
}

test("blocking findings retain failed evidence, including the formerly reviewed advisories", async t => {
  const reports = [
    reportFor("moderate", "GHSA-abcd-1234-efgh", "synthetic"),
    reportFor("high", "GHSA-vfj7-8cjw-p6xm", "braces"),
    reportFor("high"),
    reportFor("critical", "GHSA-abcd-1234-efgh", "synthetic"),
  ];
  for (const report of reports) {
    const result = raw(1, report);
    const { input, adapters } = await fixture(t, result);
    let disposition;
    await assert.rejects(runDependencyAudit(input, adapters), error => {
      assert.equal(error.message, "DEPENDENCY_AUDIT_FAILED");
      disposition = error.auditDisposition;
      assert.equal(disposition.status, "refused");
      return true;
    });
    await assertReceipt(input, disposition, result);
  }
});

test("malformed reports, inconsistent counts and native failures refuse approval", async t => {
  const mismatchedCounts = reportFor("low");
  mismatchedCounts.metadata.vulnerabilities.low = 0;
  const duplicatedFindingPath = reportFor("low");
  const [finding] = duplicatedFindingPath.advisories["1240992"].findings;
  finding.paths.push(finding.paths[0]);
  for (const result of [
    raw(0, reportFor("low")),
    raw(1, reportFor()),
    raw(1, mismatchedCounts),
    raw(1, duplicatedFindingPath),
    raw(0, reportFor(), { stdout: Buffer.from("{") }),
    raw(0, reportFor(), { stderr: Buffer.from("unexpected native diagnostic") }),
    raw(2, reportFor()), raw(0, reportFor(), { operationalError: true }),
    raw(0, reportFor(), { signal: "SIGTERM" }), raw(0, reportFor(), { killed: true }),
  ]) {
    const { input, adapters } = await fixture(t, result);
    await assert.rejects(runDependencyAudit(input, adapters), /DEPENDENCY_AUDIT_FAILED/);
  }
});

test("known graph counts still reject an otherwise valid audit", async t => {
  const report = reportFor();
  const graph = { id: "portfolio", dependencyCounts: { ...dependencyCounts, devDependencies: 1 } };
  const { input, adapters } = await fixture(t, raw(0, report), graph);
  await assert.rejects(runDependencyAudit(input, adapters), /DEPENDENCY_AUDIT_FAILED/);
});

test("real generated inputs identify a known graph and bind both audit files", async t => {
  const committed = new URL("../../fixtures/generated/portfolio-0.12.0-next-16.4.5/", import.meta.url);
  const directory = await mkdtemp(join(tmpdir(), "egeria-audit-inputs-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const names = ["pnpm-lock.yaml", "pnpm-workspace.yaml"];
  for (const name of names) await writeFile(join(directory, name), await readFile(new URL(name, committed)));
  const recognized = await inspectDependencyAuditInputs(directory);
  assert.equal(recognized.graph.id, "portfolio");
  for (const name of names) {
    const path = join(directory, name);
    const original = await readFile(path);
    await writeFile(path, "changed input");
    const changed = await inspectDependencyAuditInputs(directory);
    assert.equal(changed.graph, null);
    assert.notEqual(changed.fingerprint, recognized.fingerprint);
    await writeFile(path, original);
  }
  const result = raw(0, reportFor());
  const { input, adapters } = await fixture(t, result);
  const lock = join(directory, "pnpm-lock.yaml");
  await writeFile(lock, "unrecognized dependency lock");
  await assert.rejects(runDependencyAudit({ ...input, cwd: directory }, {
    ...adapters,
    inspectInputs: inspectDependencyAuditInputs,
    runProcess: async () => {
      await writeFile(lock, "changed during audit");
      return result;
    },
  }), /DEPENDENCY_AUDIT_FAILED/);
  await rm(lock);
  await symlink(new URL("pnpm-lock.yaml", committed), lock);
  await assert.rejects(inspectDependencyAuditInputs(directory), /DEPENDENCY_AUDIT_INPUT_CHANGED/);
});

test("incomplete adapters and unwritable evidence refuse before executing the audit", async t => {
  const { directory, input, adapters, calls } = await fixture(t, raw(0, reportFor()));
  await assert.rejects(runDependencyAudit(input, { runProcess: adapters.runProcess }), /DEPENDENCY_AUDIT_ADAPTER_INVALID/);
  const collision = join(directory, "collision");
  await writeFile(collision, "preserve");
  await assert.rejects(runDependencyAudit({ ...input, artifactRoot: collision }, adapters));
  assert.equal(await readFile(collision, "utf8"), "preserve");
  assert.deepEqual(await readdir(directory), ["collision"]);
  assert.equal(calls.length, 0);
});
