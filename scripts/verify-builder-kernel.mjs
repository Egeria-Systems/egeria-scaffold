import { execFileSync, spawn } from "node:child_process";
import { closeSync, fsyncSync, mkdtempSync, openSync, readdirSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { stripVTControlCharacters } from "node:util";

const requiredGroups = [
  "test:constitution", "test:package-boundaries", "build:builder",
  "test:synthetic-client-journey", "test:generated-fixtures", "test:packages",
  "lint:builder", "typecheck:builder", "test:cli", "test:builder-core",
  "verify:generated-skeletons", "test:capability-certification",
  "check:capability-certification", "test:generated-jobs", "changeset:status",
];

export function allRequiredPassed(results) {
  return results.length === requiredGroups.length &&
    new Set(results.map(result => result.group)).size === requiredGroups.length &&
    results.every(result => requiredGroups.includes(result.group) && result.status === "passed");
}

const rootScript = name => ({ name, executable: "pnpm", args: ["run", name] });
const packageScript = (name, script) => ({
  name: name + " " + script,
  executable: "pnpm",
  args: ["--filter", "@egeria-systems/" + name, "run", script],
});
const buildSucceeded = step => step?.exitCode === 0 && !step.launchError && !step.signal && !step.drainExpired;
const blocked = (name, producer) => ({
  name, status: "blocked", durationMs: 0, diagnostic: "Requires successful " + producer,
});

const diagnosticCodes = new Set([
  "ERR_ASSERTION", "ERR_MODULE_NOT_FOUND", "ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL", "ELIFECYCLE",
  "BROWSER_DEVELOPMENT_FAILED", "BROWSER_PREVIEW_FAILED", "FROZEN_INSTALL_FAILED",
  "NEXT_BUILD_FAILED", "OPENNEXT_BUILD_FAILED", "WORKER_INTEGRATION_FAILED",
  "DEPENDENCY_AUDIT_FAILED", "REGISTRY_SIGNATURE_VERIFICATION_FAILED", "PNPM_VERSION_INVALID",
  "LINT_FAILED", "TYPECHECK_FAILED", "VERIFICATION_FAILED", "PREPARED_ARTIFACT_FAILED",
  "BINDING_INTEGRATION_FAILED", "JOB_BUNDLE_FAILED", "APPLICATION_ENVIRONMENT_INVALID",
]);

// Persist only bounded, recognized observations. Test names, messages, paths and
// URLs are arbitrary child data and may contain credentials or private inputs.
function skeletonEvidence(text) {
  // The verifier emits one structured receipt. Keep fixed-root identities and
  // audit references without retaining arbitrary result fields or child paths.
  let result;
  try { result = JSON.parse(text); } catch { return undefined; }
  if (result?.ok !== true || !Array.isArray(result.fixtures)) return undefined;

  const fixtureNames = new Set(readdirSync("fixtures/generated", { withFileTypes: true })
    .filter(entry => entry.isDirectory()).map(entry => entry.name.replace(/-\d+\.\d+\.\d+$/u, "")));
  const fixtures = list => Array.isArray(list) ? list.filter(name => fixtureNames.has(name)) : [];
  const integration = value => ({ executed: fixtures(value?.executed), skipped: fixtures(value?.skipped) });
  const audits = Array.isArray(result.auditDispositions) ? result.auditDispositions : [];
  const builds = Array.isArray(result.appBuildEvidence) ? result.appBuildEvidence : [];
  return {
    fixtures: fixtures(result.fixtures),
    workerIntegration: integration(result.workerIntegration),
    bindingIntegration: integration(result.bindingIntegration),
    auditDispositions: audits.filter(audit => fixtureNames.has(audit?.fixture) &&
      ["passed", "accepted-with-security-exception"].includes(audit.status) &&
      typeof audit.artifactDirectory === "string" && /^audit-[a-z0-9]{6}$/iu.test(audit.artifactDirectory))
      .map(({ fixture, status, artifactDirectory }) => ({ fixture, status, artifactDirectory })),
    appBuildEvidence: builds.filter(build => fixtureNames.has(build?.fixture) &&
      typeof build.worker?.sha256 === "string" && /^[a-f0-9]{64}$/u.test(build.worker.sha256))
      .map(({ fixture, worker }) => ({ fixture, workerSha256: worker.sha256 })),
  };
}

const sourceRoot = realpathSync(".");
const sourcePath = /^(?:apps|packages|proofs|scripts|tests)\/(?:[a-z0-9_-][a-z0-9_.-]*\/)*[a-z0-9_-][a-z0-9_.-]*\.[cm]?[jt]sx?$/iu;

function sourceLocation(file, line, column, packageRoot = "") {
  try {
    if (file.startsWith("file://")) file = fileURLToPath(file);
    if (file.split("/").includes("..")) return undefined;
    const path = isAbsolute(file) ? relative(sourceRoot, file) : packageRoot ? packageRoot + "/" + file : file;
    if (!sourcePath.test(path) || /(?:^|\/)(?:node_modules|dist)\//u.test(path)) return undefined;
    const absolute = join(sourceRoot, path);
    if (realpathSync(absolute) !== absolute || !statSync(absolute).isFile()) return undefined;
    return path + ":" + line + ":" + column;
  } catch {
    return undefined;
  }
}

function outputObservation(line, skeletonOutput) {
  const text = stripVTControlCharacters(line).trim();
  const prefix = /^((?:apps|packages|proofs)\/[\w.-]+) [\w:-]+: (.+)$/u.exec(text);
  const message = prefix?.[2] ?? text;
  const count = /^(?:# (?:tests|suites|pass|fail|cancelled|skipped|todo) \d{1,9}|1\.\.\d{1,9})$/u.exec(message);
  if (count) return { text: count[0] };
  const testNumber = /^not ok (\d{1,9})(?:\s|$)/u.exec(message);
  if (testNumber) return { text: "not ok " + testNumber[1], priority: 1 };
  if (skeletonOutput && text.startsWith('{"ok":true,')) {
    const evidence = skeletonEvidence(text);
    if (evidence) return { text: JSON.stringify(evidence) };
  }
  const compiler = /^(?:(.{1,600})\((\d{1,7}),(\d{1,5})\): )?error (TS\d{4}):/u.exec(message);
  if (compiler) {
    const [, file, line, column, code] = compiler;
    const location = file && sourceLocation(file, line, column, prefix?.[1]);
    return location ? { text: location + " " + code, priority: 3 } : { text: code, priority: 2 };
  }
  const testLocation = /^location: ['"](.{1,600}):(\d{1,7}):(\d{1,5})['"]$/u.exec(message);
  if (testLocation) {
    const [, file, line, column] = testLocation;
    const location = sourceLocation(file, line, column, prefix?.[1]);
    if (location) return { text: "Test failure at " + location, priority: 3 };
  }
  const category = /^failureType: ['"]?(testTimeoutFailure|testCodeFailure)['"]?$/u.exec(message)?.[1];
  if (category) return { text: category === "testTimeoutFailure" ? "Test timed out" : "Test code failed", priority: 2 };
  const code = /^\{"ok":false,"code":"([A-Z_]+)"/u.exec(message)?.[1] ??
    /^(?:code: ['"]?|\[)?([A-Z][A-Z0-9_]{2,80})(?:['"]?$|[:\s\]])/u.exec(message)?.[1];
  if (diagnosticCodes.has(code)) return { text: code, priority: 2 };
  return undefined;
}

function observeStream(stream, source, record, skeletonOutput) {
  const limit = skeletonOutput ? 1024 * 1024 : 1024;
  const observe = line => record(source, line, skeletonOutput);
  let pending = "";
  let overlong = false;
  stream.setEncoding("utf8").on("data", chunk => {
    const lines = chunk.split("\n");
    for (let index = 0; index < lines.length; index++) {
      const segment = lines[index];
      if (!overlong && pending.length + segment.length <= limit) pending += segment;
      else overlong = true;
      if (index === lines.length - 1) break;
      if (!overlong) observe(pending);
      pending = "";
      overlong = false;
    }
  });
  stream.on("end", () => {
    if (!overlong && pending) observe(pending);
  });
}

function processTable() {
  // Process arguments and environments are deliberately outside this query.
  return execFileSync("/bin/ps", ["-axo", "pid=,ppid=,pgid=,stat="], {
    encoding: "utf8", timeout: 2000, maxBuffer: 4 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"],
  }).trim().split("\n").map(line => {
    const [pid, parent, group, state] = line.trim().split(/\s+/u);
    return { pid: Number(pid), parent: Number(parent), group: Number(group), state };
  });
}

function ownedProcessGroups(group) {
  // Snapshot ancestry before forwarding a signal can orphan an owned subgroup.
  const children = new Map();
  const pending = [];
  const groups = new Set([group]);
  for (const row of processTable()) {
    const { pid, parent } = row;
    if (row.group === group) pending.push(pid);
    if (!children.has(parent)) children.set(parent, []);
    children.get(parent).push(row);
  }
  const seen = new Set();
  while (pending.length > 0) {
    const parent = pending.pop();
    if (seen.has(parent)) continue;
    seen.add(parent);
    for (const child of children.get(parent) ?? []) {
      groups.add(child.group);
      pending.push(child.pid);
    }
  }
  return groups;
}

function signalGroup(group, signal) {
  try {
    process.kill(-group, signal);
    return true;
  } catch (error) {
    if (error.code !== "ESRCH") throw error;
    return false;
  }
}

async function stopOwnedProcesses(child, signal, abandonStreams) {
  if (!child.pid) return "complete";
  let groups = new Set([child.pid]);
  let complete = true;
  try {
    groups = ownedProcessGroups(child.pid);
  } catch {
    complete = false;
  }
  function send(group, value) {
    try {
      return signalGroup(group, value);
    } catch {
      complete = false;
      return false;
    }
  }
  for (const group of groups) send(group, signal);
  // Poll the recorded groups for a bounded grace interval, then escalate.
  for (let attempt = 0; groups.size && attempt < 20; attempt++) {
    await delay(50);
    for (const group of groups) {
      if (!send(group, 0)) groups.delete(group);
    }
  }
  for (const group of groups) send(group, "SIGKILL");
  for (let attempt = 0; groups.size && attempt < 20; attempt++) {
    await delay(50);
    for (const group of groups) {
      if (!send(group, 0)) groups.delete(group);
    }
  }
  if (groups.size) {
    try {
      // A container init may defer reaping a terminated descendant.
      if (processTable().some(row => groups.has(row.group) && !row.state.startsWith("Z"))) complete = false;
    } catch { complete = false; }
  }
  if (abandonStreams()) complete = false;
  return complete ? "complete" : "unconfirmed";
}

async function runChild(step, log, setActive) {
  const started = performance.now();
  let descriptor;
  let capture = "filtered";
  let logPublished = false;
  let firstDiagnostic;
  let launchError;
  let cleanup;
  let closed = false;
  let exitCode = null;
  let signal = null;
  let stopping;
  let releaseClose;
  let drainTimer;
  let drainExpired = false;

  function logLine(line) {
    if (capture === "failed") return;
    try { writeFileSync(descriptor, line + "\n"); } catch { capture = "failed"; }
  }

  try {
    descriptor = openSync(log, "wx", 0o600);
    logPublished = true;
  } catch {
    capture = "failed";
  }

  logLine("Filtered child output. Unrecognized and overlong lines are omitted.");
  const child = spawn(step.executable, step.args, {
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  function abandonStreams() {
    if (closed) return false;
    child.stdout?.destroy();
    child.stderr?.destroy();
    child.unref();
    releaseClose();
    return true;
  }
  function stop(reason) {
    clearTimeout(drainTimer);
    if (exitCode !== null && signal === null) {
      // A reaped leader's numeric group no longer establishes ownership.
      if (abandonStreams()) cleanup = "unconfirmed";
      return;
    }
    stopping ??= stopOwnedProcesses(child, reason, abandonStreams);
  }
  setActive(stop);
  const finished = new Promise(resolveClose => {
    releaseClose = resolveClose;
    child.once("error", error => {
      launchError = ["ENOENT", "EACCES", "EPERM", "EAGAIN"].includes(error.code)
        ? error.code : "spawn error";
    });
    child.once("exit", (code, childSignal) => {
      exitCode = code;
      signal = childSignal;
      if (stopping) return;
      if (childSignal) {
        // After an unexpected exit, a reaped leader cannot prove descendant ownership.
        cleanup = "unconfirmed";
        abandonStreams();
      } else {
        drainTimer = setTimeout(() => {
          if (!abandonStreams()) return;
          drainExpired = true;
          cleanup = "unconfirmed";
        }, 5000);
      }
    });
    child.once("close", () => {
      closed = true;
      clearTimeout(drainTimer);
      resolveClose();
    });
  });
  function record(source, line, skeletonOutput) {
    let observation;
    try { observation = outputObservation(line, skeletonOutput); } catch { capture = "failed"; }
    if (!observation) return;
    if (observation.priority > (firstDiagnostic?.priority ?? 0)) firstDiagnostic = observation;
    logLine(source + " " + observation.text);
  }
  for (const source of ["stdout", "stderr"]) {
    child[source]?.on("error", () => { capture = "failed"; });
    if (child[source]) {
      observeStream(child[source], source, record, source === "stdout" && step.name === "verify:generated-skeletons");
    }
  }
  await finished;
  if (stopping) cleanup = await stopping;
  setActive(undefined);

  const drainEvidence = drainExpired ? { drainExpired } : {};
  logLine(JSON.stringify({ exitCode, signal, launchError, cleanup, ...drainEvidence }));
  if (descriptor !== undefined) {
    try { fsyncSync(descriptor); } catch { capture = "failed"; }
    try { closeSync(descriptor); } catch { capture = "failed"; }
  }
  const status = exitCode === 0 && !launchError && !signal && !drainExpired && capture !== "failed" ? "passed" : "failed";
  const diagnostic = capture === "failed" ? "Child log capture failed"
    : launchError ? "Child launch failed (" + launchError + ")"
    : drainExpired ? "Child stdio remained open after exit. Owned process cleanup could not be confirmed"
    : cleanup === "unconfirmed" ? "Owned process cleanup could not be confirmed"
    : status === "passed" ? null
    : firstDiagnostic?.text ?? (signal ? "Child signal " + signal : "Child exit " + exitCode);
  return { name: step.name, status, durationMs: Math.round(performance.now() - started),
    diagnostic, log: logPublished ? log : null, capture, exitCode, signal, launchError, cleanup, ...drainEvidence };
}

async function main() {
  const directory = mkdtempSync(join(resolve(tmpdir()), "builder-kernel-"));
  console.log("Builder kernel report: " + directory);
  console.log("Required groups: " + requiredGroups.join(", "));
  const journalPath = join(directory, "results.jsonl");
  const journal = openSync(journalPath, "wx", 0o600);
  const results = [];
  let journalFailed = false;
  let interrupted;
  let schedulingStopped;
  let stopActive;

  function interrupt(signal) {
    if (interrupted) return;
    interrupted = signal;
    stopActive?.(signal);
  }
  const onInterrupt = () => interrupt("SIGINT");
  const onTerminate = () => interrupt("SIGTERM");
  process.on("SIGINT", onInterrupt);
  process.on("SIGTERM", onTerminate);

  function publish(row) {
    results.push(row);
    try {
      writeFileSync(journal, JSON.stringify(row) + "\n");
      fsyncSync(journal);
    } catch {
      journalFailed = true;
    }
    console.log(formatRow(row));
  }

  function formatRow(row) {
    const logs = row.steps.flatMap(step => step.log ? [step.log] : []);
    return row.group + " " + row.status + " (" + row.durationMs + " ms)" +
      (row.diagnostic ? " — " + row.diagnostic : "") +
      " — " + (logs.length ? logs.join(", ") : journalPath);
  }

  async function runGroup(group, commands = [rootScript(group)]) {
    if (interrupted || schedulingStopped) {
      publish({ group, status: "unstarted", durationMs: 0, diagnostic: interrupted ?? schedulingStopped, steps: [] });
      return [];
    }
    const started = performance.now();
    const steps = [];
    for (const [index, command] of commands.entries()) {
      const step = typeof command === "function" ? command(steps) : command;
      if (interrupted || schedulingStopped) {
        steps.push({ name: step.name, status: "unstarted", durationMs: 0, diagnostic: interrupted ?? schedulingStopped });
      } else if (step.status === "blocked") {
        steps.push(step);
      } else {
        const suffix = commands.length === 1 ? "" : "-" + (index + 1);
        const result = await runChild(step, join(directory, group + suffix + ".log"), stop => { stopActive = stop; });
        steps.push(interrupted ? { ...result, status: "interrupted",
          diagnostic: result.cleanup === "unconfirmed" ? result.diagnostic : interrupted } : result);
        if (result.cleanup === "unconfirmed") schedulingStopped = "Previous child cleanup could not be confirmed";
      }
    }
    const problem = steps.find(step => step.status === "failed") ?? steps.find(step => step.status === "blocked");
    const interruptedStep = steps.find(step => step.status === "interrupted");
    publish({ group, status: interrupted ? "interrupted" : problem?.status ?? "passed",
      durationMs: Math.round(performance.now() - started),
      diagnostic: interrupted ? interruptedStep?.diagnostic ?? interrupted : problem?.diagnostic ?? null,
      steps });
    return steps;
  }

  try {
    await runGroup("test:constitution");
    await runGroup("test:package-boundaries");
    const [coreBuild, observabilityBuild, cliBuild] = await runGroup("build:builder", [
      packageScript("builder-core", "build"),
      packageScript("observability", "build"),
      steps => buildSucceeded(steps[0]) ? packageScript("cli", "build") : blocked("cli build", "builder-core build"),
    ]);
    const coreReady = buildSucceeded(coreBuild);
    const observabilityReady = buildSucceeded(observabilityBuild);
    const cliReady = buildSucceeded(cliBuild);
    const packet = "tests/client-journey/synthetic-client-packet.test.mjs";

    await runGroup("test:synthetic-client-journey", coreReady ? undefined : [
      { name: packet, executable: process.execPath, args: ["--test", packet] },
      blocked("tests/client-journey/environment-composition.test.mjs", "builder-core build"),
    ]);
    await runGroup("test:generated-fixtures", coreReady && cliReady ? undefined : [
      blocked("test:generated-fixtures", coreReady ? "cli build" : "builder-core build"),
    ]);
    await runGroup("test:packages", observabilityReady ? undefined : [
      packageScript("standards", "test"),
      blocked("observability test", "observability build"),
    ]);
    await runGroup("lint:builder", coreReady ? undefined : [
      blocked("cli lint", "builder-core build"),
      packageScript("builder-core", "lint"),
      packageScript("standards", "lint"),
      packageScript("observability", "lint"),
      rootScript("check:copy-externalization"),
    ]);
    await runGroup("typecheck:builder", coreReady ? undefined : [
      blocked("cli typecheck", "builder-core build"),
      packageScript("builder-core", "typecheck"),
      packageScript("observability", "typecheck"),
    ]);
    await runGroup("test:cli", coreReady ? undefined : [blocked("test:cli", "builder-core build")]);
    await runGroup("test:builder-core", observabilityReady ? undefined : [
      blocked("test:builder-core", "observability build"),
    ]);
    await runGroup("verify:generated-skeletons");
    await runGroup("test:capability-certification");
    await runGroup("check:capability-certification");
    await runGroup("test:generated-jobs");
    await runGroup("changeset:status");
  } finally {
    process.off("SIGINT", onInterrupt);
    process.off("SIGTERM", onTerminate);
    try { closeSync(journal); } catch { journalFailed = true; }
  }

  const missing = requiredGroups.filter(group => !results.some(result => result.group === group));
  if (missing.length) console.error("Missing required results: " + missing.join(", "));
  if (journalFailed) console.error("Results journal capture failed: " + journalPath);
  console.log("Builder kernel results:\n" + results.map(formatRow).join("\n"));
  if (interrupted) return interrupted === "SIGINT" ? 130 : 143;
  return allRequiredPassed(results) && !journalFailed ? 0 : 1;
}

if (import.meta.main) {
  try {
    process.exitCode = await main();
  } catch {
    console.error("Builder kernel reporting could not finish. See any completed report rows.");
    process.exitCode = 1;
  }
}
