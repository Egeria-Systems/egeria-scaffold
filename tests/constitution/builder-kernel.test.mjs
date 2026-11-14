import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { copyFile, mkdir, mkdtemp, readFile, readdir, rm, stat, symlink, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { test } from "node:test";

const root = new URL("../../", import.meta.url);
const manifest = JSON.parse(await readFile(new URL("package.json", root), "utf8"));
const command = "verify:builder-kernel";
const runner = "scripts/verify-builder-kernel.mjs";
const expectedGroups = [
  "test:constitution", "test:package-boundaries", "build:builder",
  "test:synthetic-client-journey", "test:generated-fixtures", "test:packages",
  "lint:builder", "typecheck:builder", "test:cli", "test:builder-core",
  "verify:generated-skeletons", "test:capability-certification",
  "check:capability-certification", "test:generated-jobs", "changeset:status",
];
const packetFile = "tests/client-journey/synthetic-client-packet.test.mjs";
const compositionFile = "tests/client-journey/environment-composition.test.mjs";
const packageCommand = (name, script) => "--filter @egeria-systems/" + name + " run " + script;
const coreBuild = packageCommand("builder-core", "build");
const observabilityBuild = packageCommand("observability", "build");
const cliBuild = packageCommand("cli", "build");
const expectedCommands = expectedGroups.flatMap(group => group === "build:builder"
  ? [coreBuild, observabilityBuild, cliBuild] : ["run " + group]);

const controlledChild = String.raw`
import { appendFileSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { execFileSync, spawn } from "node:child_process";
import { basename, join } from "node:path";
const command = process.argv.slice(2).join(" ");
if (process.version !== process.env.KERNEL_NODE_VERSION) throw new Error("Unexpected nested Node version");
if (command === "run test:constitution" &&
    execFileSync("pnpm", ["--version"], { encoding: "utf8" }).trim() !== process.env.KERNEL_PNPM_VERSION) {
  throw new Error("Unexpected nested pnpm version");
}
process.chdir(process.env.KERNEL_FIXTURE_ROOT);
appendFileSync("trace", command + "\n");
const fixture = JSON.parse(process.env.KERNEL_FIXTURE);
if (fixture.failCapture && command === "run test:constitution") {
  const report = readdirSync(process.env.TMPDIR).find(name => name.startsWith("builder-kernel-"));
  mkdirSync(join(process.env.TMPDIR, report, "test:package-boundaries.log"));
  mkdirSync(join(process.env.TMPDIR, report, "build:builder-1.log"));
}
if (fixture.interrupt && command === "run test:package-boundaries") {
  const descendant = spawn(process.execPath, ["listener.mjs"], { detached: true, stdio: "inherit" });
  writeFileSync("owned-pid", String(descendant.pid));
  setInterval(() => {}, 1000);
}
if (fixture.killChild === command) {
  const outerIdentity = JSON.parse(readFileSync("outer-process.json", "utf8"));
  const ps = (fields, pid) => execFileSync("/bin/ps", ["-o", fields, "-p", String(pid)], {
    encoding: "utf8", timeout: 1000,
  }).trim();
  const chain = [];
  let pid = process.pid;
  for (let depth = 0; depth < 12 && pid > 1; depth++) {
    const identity = /^(\d+)\s+(\d+)\s+(\d+)\s+(.+)$/u.exec(ps("pid=,ppid=,pgid=,comm=", pid));
    if (!identity || Number(identity[1]) !== pid) throw new Error("Fixture ancestry changed");
    const [, , parent, group, executable] = identity;
    chain.push({ pid, ppid: Number(parent), pgid: Number(group), executable: basename(executable) });
    if (pid === outerIdentity.pid) break;
    pid = Number(parent);
  }

  const outer = chain.at(-1);
  if (outer?.pid !== outerIdentity.pid || outer.ppid !== outerIdentity.ppid || outer.pgid !== outer.pid ||
      !ps("args=", outer.pid).endsWith(" run verify:builder-kernel")) {
    throw new Error("Public fixture ancestry could not be proven");
  }

  // Only inspect arguments within the now-proven fixture ancestry. The stage
  // target is the reporter's direct child even when pnpm inserts a wrapper.
  const reporterIndex = chain.findIndex(member => member.executable === "node" &&
    ps("args=", member.pid).endsWith(" scripts/verify-builder-kernel.mjs"));
  const reporter = chain[reporterIndex];
  const stage = chain[reporterIndex - 1];
  if (!stage || reporter.pid === outer.pid || stage.ppid !== reporter.pid || stage.pgid !== stage.pid ||
      !ps("args=", stage.pid).endsWith(" " + command) ||
      Number(ps("ppid=", stage.pid)) !== reporter.pid) {
    throw new Error("Direct fixture stage ancestry could not be proven");
  }
  writeFileSync("signal-target.json", JSON.stringify({ outer, reporter, stage, controlled: chain[0] }), { flag: "wx" });
  process.kill(stage.pid, "SIGKILL");
}
if (fixture.repairDiagnostics && command === "run typecheck:builder") {
  console.error("\u001b[31mpackages/builder-core typecheck: src/fixture.ts(4,12): error TS2322: Bearer fixtureSecretValueNeverRetain\u001b[0m");
  console.error("packages/builder-core typecheck: src/fixtureSecretValueNeverRetain.ts(1,1): error TS2322: synthetic");
  console.error("packages/builder-core typecheck: src/alias.ts(1,1): error TS2322: synthetic");
  console.error("[ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL] fixtureSecretValueNeverRetain");
  process.exit(2);
}
if (fixture.failures?.includes(command)) {
  console.log("\u001b[31mnot ok 1 - \u001b[0m");
  console.error("BROWSER_PREVIEW_FAILED");
  console.error("authorization=Bearer fixtureSecretValueNeverRetain");
  console.error("x".repeat(20000) + "/private/fixtureSecretValueNeverRetain");
  console.log("# fail 1");
  process.exitCode = 7;
} else {
  if (command === "run verify:generated-skeletons") {
    console.log(JSON.stringify({
      ok: true, fixtures: ["portfolio", "fixtureSecretValueNeverRetain"],
      workerIntegration: { executed: [], skipped: ["portfolio"] },
      bindingIntegration: { executed: [], skipped: ["portfolio"] },
      auditDispositions: [{ fixture: "portfolio", status: "passed", artifactDirectory: "audit-abc123" }],
      appBuildEvidence: [], extra: "fixtureSecretValueNeverRetain",
    }));
  }
  console.log("# pass 1");
  appendFileSync("completed", command + "\n");
}
`;
const listener = String.raw`
import { createServer } from "node:net";
import { writeFileSync } from "node:fs";
process.on("SIGINT", () => {});
process.on("SIGTERM", () => {});
const server = createServer();
server.listen(0, "127.0.0.1", () => writeFileSync("ready", String(server.address().port)));
`;

const drainListener = String.raw`
import { appendFileSync, renameSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
const token = JSON.parse(process.env.KERNEL_FIXTURE).drainToken;
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => appendFileSync("drain-signals", signal + "\n"));
}
const watchdog = setTimeout(() => {
  server.close();
  server.closeAllConnections();
}, 15000);
const server = createServer((request, response) => {
  if (request.headers.authorization !== "Bearer " + token ||
      (request.url !== "/alive" && request.url !== "/close")) {
    response.writeHead(404, { connection: "close" }).end();
    return;
  }
  if (request.url === "/close") {
    clearTimeout(watchdog);
    server.close();
  }
  response.writeHead(200, { connection: "close" }).end(token);
});
server.listen(0, "127.0.0.1", () => {
  writeFileSync("drain-port.tmp", String(server.address().port));
  renameSync("drain-port.tmp", "drain-port");
});
`;

// Run at the actual pnpm stage entry. A pnpm package script may run in a different group.
const holdStagePipe = String.raw`
const { execFileSync, spawn } = require("node:child_process");
const { writeFileSync } = require("node:fs");
const { join } = require("node:path");
const fixture = JSON.parse(process.env.KERNEL_FIXTURE);
if (process.argv.slice(2).join(" ") === fixture.holdPipeAfterExit) {
  const directory = process.env.KERNEL_FIXTURE_ROOT;
  const descendant = spawn(process.execPath, [join(directory, "drain-listener.mjs")], {
    cwd: directory, stdio: "inherit",
  });
  const groupOf = pid => Number(execFileSync("/bin/ps", ["-o", "pgid=", "-p", String(pid)], { encoding: "utf8" }));
  if (groupOf(process.pid) !== process.pid || groupOf(descendant.pid) !== process.pid) {
    throw new Error("Fixture listener escaped the stage group");
  }
  writeFileSync(join(directory, "drain-leader"), String(process.pid), { flag: "wx" });
  process.exit(0);
}
`;

async function controlDrainListener(port, token, action) {
  const response = await fetch("http://127.0.0.1:" + port + "/" + action, {
    headers: { authorization: "Bearer " + token },
    signal: AbortSignal.timeout(1000),
  });
  assert.equal(response.status, 200);
  assert.equal(await response.text(), token);
}

async function fixtureInvocation(context, options = {}, sharedReports) {
  const directory = await mkdtemp(join(tmpdir(), "kernel-entry-"));
  const reports = sharedReports ?? join(directory, "reports");
  if (!sharedReports) await mkdir(reports);
  await mkdir(join(directory, "tests/client-journey"), { recursive: true });
  await mkdir(join(directory, "packages/builder-core/dist"), { recursive: true });
  await mkdir(join(directory, "fixtures/generated/portfolio-0.12.0"), { recursive: true });
  await writeFile(join(directory, "packages/builder-core/dist/index.js"), "stale build");
  await writeFile(join(directory, packetFile), [
    'import { appendFileSync } from "node:fs";',
    'appendFileSync("trace", ' + JSON.stringify("node --test " + packetFile + "\n") + ");",
  ].join("\n"));
  const scripts = Object.fromEntries(expectedGroups.map(group => [
    group, "node controlled.mjs run " + group,
  ]));
  if (options.repairDiagnostics) {
    await mkdir(join(directory, "tests/package-boundaries"));
    await writeFile(join(directory, "tests/package-boundaries/assertion.test.mjs"), [
      'import assert from "node:assert/strict";',
      'import { test } from "node:test";',
      'test("rejects a drifted lock fixtureSecretValueNeverRetain", () => {',
      '  assert.equal("unexpected", "expected", "authorization=Bearer fixtureSecretValueNeverRetain");',
      '});',
    ].join("\n"));
    scripts["test:package-boundaries"] = "node --test tests/package-boundaries/assertion.test.mjs";
    const source = join(directory, "packages/builder-core/src");
    await mkdir(source);
    await writeFile(join(source, "fixture.ts"), "export {};\n");
    await symlink(join(directory, "tests/package-boundaries/assertion.test.mjs"), join(source, "alias.ts"));
  }
  scripts["check:copy-externalization"] = "node controlled.mjs run check:copy-externalization";
  scripts[command] = manifest.scripts[command];
  await writeFile(join(directory, "package.json"), JSON.stringify({ private: true, scripts }));
  await writeFile(join(directory, "pnpm-workspace.yaml"),
    "packages: ['packages/*']\nverifyDepsBeforeRun: false\n");
  for (const [name, scriptNames] of [
    ["builder-core", ["build", "lint", "typecheck"]],
    ["cli", ["build"]],
    ["observability", ["build", "lint", "typecheck"]],
    ["standards", ["lint", "test"]],
  ]) {
    const packageRoot = join(directory, "packages", name);
    await mkdir(packageRoot, { recursive: true });
    const scripts = Object.fromEntries(scriptNames.map(script => [
      script, "node ../../controlled.mjs " + packageCommand(name, script),
    ]));
    await writeFile(join(packageRoot, "package.json"),
      JSON.stringify({ name: "@egeria-systems/" + name, private: true, scripts }));
  }
  if (manifest.scripts[command].includes(runner)) {
    await mkdir(join(directory, "scripts"));
    await copyFile(new URL(runner, root), join(directory, runner));
  }

  const pnpm = process.env.npm_execpath ?? "pnpm";
  const executable = pnpm.endsWith(".mjs") || pnpm.endsWith(".cjs") ? process.execPath : pnpm;
  const prefix = executable === process.execPath ? [pnpm] : [];
  const version = spawn(executable, [...prefix, "--version"], { cwd: directory });
  let versionOutput = "";
  version.stdout.setEncoding("utf8").on("data", data => { versionOutput += data; });
  assert.deepEqual(await once(version, "close"), [0, null]);
  assert.equal("pnpm@" + versionOutput.trim(), manifest.packageManager);

  await writeFile(join(directory, "controlled.mjs"), controlledChild);
  await writeFile(join(directory, "listener.mjs"), listener);
  const environment = { ...process.env };
  delete environment.NODE_TEST_CONTEXT;
  if (options.holdPipeAfterExit) {
    const preload = join(directory, "hold-stage-pipe.cjs");
    await writeFile(preload, holdStagePipe);
    await writeFile(join(directory, "drain-listener.mjs"), drainListener);
    environment.NODE_OPTIONS = [environment.NODE_OPTIONS, "--require=" + JSON.stringify(preload)].filter(Boolean).join(" ");
  }
  const child = spawn(executable, [...prefix, "run", command], {
    cwd: directory,
    detached: true,
    env: { ...environment, KERNEL_FIXTURE_ROOT: directory, KERNEL_NODE_VERSION: process.version,
      KERNEL_PNPM_VERSION: manifest.packageManager.slice("pnpm@".length),
      TMPDIR: reports, KERNEL_FIXTURE: JSON.stringify(options) },
    stdio: ["ignore", "pipe", "pipe"],
  });
  await writeFile(join(directory, "outer-process.json"), JSON.stringify({ pid: child.pid, ppid: process.pid }));
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8").on("data", data => { stdout += data; });
  child.stderr.setEncoding("utf8").on("data", data => { stderr += data; });
  const closed = once(child, "close");
  context.after(async () => {
    if (options.drainToken) {
      const port = Number(await readOptional(join(directory, "drain-port")));
      if (port) {
        // The listener may already have closed. Its watchdog bounds fallback teardown.
        try { await controlDrainListener(port, options.drainToken, "close"); } catch {}
      }
    }
    if (child.exitCode === null && child.signalCode === null) {
      process.kill(-child.pid, "SIGTERM");
    }
    const ownedPid = Number(await readOptional(join(directory, "owned-pid")));
    if (ownedPid > 0) {
      try { process.kill(-ownedPid, "SIGKILL"); } catch (error) {
        if (error.code !== "ESRCH") throw error;
      }
    }
    await closed;
    await rm(directory, { recursive: true, force: true });
  });

  return {
    directory, reports, child,
    async finish() {
      const [code, signal] = await closed;
      const trace = (await readOptional(join(directory, "trace"))).trim().split("\n");
      const completed = (await readOptional(join(directory, "completed"))).trim().split("\n");
      return { code, signal, stdout, stderr, trace, completed };
    },
  };
}

async function readOptional(path) {
  try { return await readFile(path, "utf8"); } catch (error) {
    if (error.code === "ENOENT") return "";
    throw error;
  }
}

async function readReport(invocation, previousDirectory) {
  const directories = (await readdir(invocation.reports)).filter(name => name.startsWith("builder-kernel-"))
    .map(name => join(invocation.reports, name));
  assert.equal(directories.length, previousDirectory ? 2 : 1, "public command must retain one report per invocation");
  if (previousDirectory) assert.ok(directories.includes(previousDirectory));
  const directory = directories.find(path => path !== previousDirectory);
  const journal = join(directory, "results.jsonl");
  assert.equal((await stat(directory)).mode & 0o777, 0o700);
  assert.equal((await stat(journal)).mode & 0o777, 0o600);
  const rows = (await readFile(journal, "utf8")).trim().split("\n").map(line => JSON.parse(line));
  assert.deepEqual(rows.map(row => row.group), expectedGroups);
  for (const row of rows) assert.ok(Number.isFinite(row.durationMs) && row.durationMs >= 0);
  return { directory, rows: Object.fromEntries(rows.map(row => [row.group, row])) };
}

test("the public kernel command finishes independent groups after failures", { timeout: 60000 }, async context => {
  const invocation = await fixtureInvocation(context, {
    failures: ["run test:constitution", "run test:generated-jobs"],
  });
  const result = await invocation.finish();
  assert.equal(result.trace[0], "run test:constitution",
    "nested pnpm must resolve to the controlled child\n" + result.stdout + result.stderr);
  assert.notEqual(result.code, 0);
  assert.ok(result.completed.includes("run changeset:status"), "later independent Changesets check must finish");
  const { rows } = await readReport(invocation);
  for (const group of ["test:constitution", "test:generated-jobs"]) {
    const row = rows[group];
    assert.equal(row.status, "failed");
    assert.equal(row.steps[0].exitCode, 7);
    assert.equal(row.diagnostic, "BROWSER_PREVIEW_FAILED");
    const log = await readFile(row.steps[0].log, "utf8");
    assert.match(log, /stderr.*BROWSER_PREVIEW_FAILED/u);
    assert.match(log, /stdout.*# fail 1/u);
    assert.doesNotMatch(log + result.stdout + result.stderr, /fixtureSecretValueNeverRetain|\x1b/u);
  }
  assert.equal(rows["changeset:status"].status, "passed");
});

test("the public kernel report retains safe repair locations for assertions and prefixed compiler failures", {
  timeout: 60000,
}, async context => {
  const invocation = await fixtureInvocation(context, { repairDiagnostics: true });
  const result = await invocation.finish();
  assert.notEqual(result.code, 0);
  const { rows } = await readReport(invocation);
  const assertion = rows["test:package-boundaries"];
  const compiler = rows["typecheck:builder"];
  assert.equal(assertion.status, "failed");
  assert.match(assertion.diagnostic, /Test failure at tests\/package-boundaries\/assertion\.test\.mjs:3:\d+/u);
  assert.match(compiler.diagnostic, /packages\/builder-core\/src\/fixture\.ts:4:12.*TS2322/u);
  const assertionLog = await readFile(assertion.steps[0].log, "utf8");
  const compilerLog = await readFile(compiler.steps[0].log, "utf8");
  assert.match(assertionLog, /ERR_ASSERTION/u);
  assert.match(compilerLog, /ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL/u);
  assert.doesNotMatch(assertionLog + compilerLog + result.stdout + result.stderr,
    /fixtureSecretValueNeverRetain|src\/alias\.ts|\x1b/u);
});

async function snapshotReport(directory) {
  const files = [];
  for (const name of (await readdir(directory)).sort()) {
    const path = join(directory, name);
    files.push({ name, mode: (await stat(path)).mode & 0o777, bytes: await readFile(path) });
  }
  return { mode: (await stat(directory)).mode & 0o777, files };
}

test("the public kernel command runs each required group in reader-before-writer order", { timeout: 120000 }, async context => {
  const first = await fixtureInvocation(context);
  const result = await first.finish();
  assert.equal(result.code, 0, result.stderr);
  assert.deepEqual(result.trace, expectedCommands);
  assert.deepEqual(result.completed, expectedCommands);
  const { directory, rows } = await readReport(first);
  for (const row of Object.values(rows)) {
    assert.equal(row.status, "passed");
    for (const step of row.steps) {
      assert.equal((await stat(step.log)).mode & 0o777, 0o600);
      assert.match(await readFile(step.log, "utf8"), /# pass 1/u);
    }
  }
  const skeletonLog = await readFile(rows["verify:generated-skeletons"].steps[0].log, "utf8");
  assert.match(skeletonLog, /"fixtures":\["portfolio"\]/u);
  assert.match(skeletonLog, /"artifactDirectory":"audit-abc123"/u);
  assert.doesNotMatch(skeletonLog, /fixtureSecretValueNeverRetain/u);
  const firstReport = await snapshotReport(directory);
  const second = await fixtureInvocation(context, {}, first.reports);
  assert.equal((await second.finish()).code, 0);
  const secondReport = await readReport(second, directory);
  assert.notEqual(secondReport.directory, directory);
  assert.deepEqual(await snapshotReport(directory), firstReport);
});

test("a failed core build blocks dependent readers but runs independent portions", { timeout: 60000 }, async context => {
  const invocation = await fixtureInvocation(context, { failures: [coreBuild] });
  const result = await invocation.finish();
  assert.notEqual(result.code, 0);
  const expected = expectedCommands.flatMap(childCommand => {
    if ([cliBuild, "run test:generated-fixtures", "run test:cli"].includes(childCommand)) return [];
    if (childCommand === "run test:synthetic-client-journey") return ["node --test " + packetFile];
    if (childCommand === "run lint:builder") return [
      packageCommand("builder-core", "lint"), packageCommand("standards", "lint"),
      packageCommand("observability", "lint"), "run check:copy-externalization",
    ];
    if (childCommand === "run typecheck:builder") return [
      packageCommand("builder-core", "typecheck"), packageCommand("observability", "typecheck"),
    ];
    return [childCommand];
  });
  assert.deepEqual(result.trace, expected);
  const { rows } = await readReport(invocation);
  assert.equal(rows["build:builder"].status, "failed");
  const journey = rows["test:synthetic-client-journey"];
  assert.equal(journey.status, "blocked");
  assert.deepEqual(journey.steps.map(step => [step.name, step.status]), [
    [packetFile, "passed"], [compositionFile, "blocked"],
  ]);
  for (const group of ["test:generated-fixtures", "test:cli", "lint:builder", "typecheck:builder"]) {
    assert.equal(rows[group].status, "blocked");
    assert.match(rows[group].diagnostic, /builder-core/u);
  }
  assert.equal(rows["test:builder-core"].status, "passed");
  assert.equal(rows["verify:generated-skeletons"].status, "passed");
});

test("an observability build failure still runs the ordinary journey and standards", { timeout: 60000 }, async context => {
  const invocation = await fixtureInvocation(context, { failures: [observabilityBuild] });
  const result = await invocation.finish();
  assert.notEqual(result.code, 0);
  assert.deepEqual(result.trace, expectedCommands.flatMap(childCommand => {
    if (childCommand === "run test:builder-core") return [];
    return [childCommand === "run test:packages" ? packageCommand("standards", "test") : childCommand];
  }));
  const { rows } = await readReport(invocation);
  assert.equal(rows["test:packages"].status, "blocked");
  assert.equal(rows["test:builder-core"].status, "blocked");
});

test("a CLI build failure blocks fixtures while the self-preparing CLI suite still runs", { timeout: 60000 }, async context => {
  const invocation = await fixtureInvocation(context, { failures: [cliBuild] });
  const result = await invocation.finish();
  assert.notEqual(result.code, 0);
  assert.deepEqual(result.trace, expectedCommands.filter(childCommand => childCommand !== "run test:generated-fixtures"));
  const { rows } = await readReport(invocation);
  assert.equal(rows["test:generated-fixtures"].status, "blocked");
  assert.equal(rows["test:cli"].status, "passed");
});

test("a capture refusal and unexpected child signal are failures with separate statuses", { timeout: 60000 }, async context => {
  const invocation = await fixtureInvocation(context, {
    failCapture: true, killChild: "run test:packages",
  });
  const result = await invocation.finish();
  assert.notEqual(result.code, 0);
  assert.ok(result.completed.includes("run test:generated-jobs"),
    "independent generated-jobs must finish after the earlier child signal");
  const { rows } = await readReport(invocation);
  const capture = rows["test:package-boundaries"];
  assert.equal(capture.status, "failed");
  assert.equal(capture.steps[0].capture, "failed");
  assert.match(capture.diagnostic, /log/u);
  const coreBuild = rows["build:builder"].steps[0];
  assert.equal(coreBuild.status, "failed");
  assert.equal(coreBuild.exitCode, 0);
  assert.equal(rows["test:generated-fixtures"].status, "passed");
  const target = JSON.parse(await readFile(join(invocation.directory, "signal-target.json"), "utf8"));
  assert.equal(target.outer.pid, invocation.child.pid);
  assert.equal(target.stage.ppid, target.reporter.pid);
  assert.equal(target.stage.pgid, target.stage.pid);
  context.diagnostic("Owned signal ancestry " + JSON.stringify(target));
  const signalled = rows["test:packages"];
  assert.equal(signalled.status, "failed");
  assert.equal(signalled.steps[0].signal, "SIGKILL");
  assert.equal(signalled.steps[0].capture, "filtered");
  assert.equal(rows["test:generated-jobs"].status, "passed");
});

async function waitForFile(path, invocation) {
  for (let attempt = 0; attempt < 400; attempt++) {
    const content = await readOptional(path);
    if (content) return content;
    assert.equal(invocation.child.exitCode, null, "public command exited before readiness");
    await delay(20);
  }
  assert.fail("timed out waiting for controlled child readiness");
}

async function startDrainFixture(context) {
  const token = randomUUID();
  const invocation = await fixtureInvocation(context, { holdPipeAfterExit: coreBuild, drainToken: token });
  const leader = await waitForFile(join(invocation.directory, "drain-leader"), invocation);
  const port = Number(await waitForFile(join(invocation.directory, "drain-port"), invocation));
  for (let attempt = 0; attempt < 100; attempt++) {
    const observed = spawnSync("/bin/ps", ["-o", "stat=", "-p", leader], { encoding: "utf8" });
    if (observed.status === 1) {
      await controlDrainListener(port, token, "alive");
      return { invocation, port, token };
    }
    assert.equal(observed.status, 0);
    await delay(20);
  }
  assert.fail("stage leader did not exit while the listener held its pipes");
}

async function assertDrainListenerUnsignalled(invocation, port, token) {
  await controlDrainListener(port, token, "alive");
  assert.equal(await readOptional(join(invocation.directory, "drain-signals")), "");
  await controlDrainListener(port, token, "close");
}

test("a normal stage exit with inherited pipes times out without signalling the listener", {
  timeout: 65000,
  skip: process.platform === "win32" ? "requires Unix process-group evidence" : false,
}, async context => {
  const { invocation, port, token } = await startDrainFixture(context);
  const result = await invocation.finish();
  assert.deepEqual([result.code, result.signal], [1, null]);
  await assertDrainListenerUnsignalled(invocation, port, token);

  const { rows } = await readReport(invocation);
  assert.equal(rows["build:builder"].status, "failed");
  const [core, observability, cli] = rows["build:builder"].steps;
  assert.equal(core.status, "failed");
  assert.equal(core.exitCode, 0);
  assert.equal(core.signal, null);
  assert.equal(core.cleanup, "unconfirmed");
  assert.equal(core.drainExpired, true);
  assert.match(core.diagnostic, /stdio remained open after exit/u);
  const log = await readFile(core.log, "utf8");
  assert.deepEqual(JSON.parse(log.trim().split("\n").at(-1)),
    { exitCode: 0, signal: null, cleanup: "unconfirmed", drainExpired: true });
  assert.equal(observability.status, "unstarted");
  assert.equal(cli.status, "unstarted");
  for (const group of expectedGroups.slice(3)) assert.equal(rows[group].status, "unstarted", group);
  assert.deepEqual(result.trace, ["run test:constitution", "run test:package-boundaries"]);
});

test("inherited pipes closing within the grace allow the serial schedule to continue", {
  timeout: 65000,
  skip: process.platform === "win32" ? "requires Unix process-group evidence" : false,
}, async context => {
  const { invocation, port, token } = await startDrainFixture(context);
  await assertDrainListenerUnsignalled(invocation, port, token);

  const result = await invocation.finish();
  const { rows } = await readReport(invocation);
  assert.deepEqual([result.code, result.signal], [0, null]);
  assert.equal(rows["build:builder"].steps[0].status, "passed");
  assert.equal(rows["build:builder"].steps[0].drainExpired, undefined);
  assert.deepEqual(result.trace, expectedCommands.filter(command => command !== coreBuild));
});

test("a foreground interrupt during normal-exit drain releases pipes without signalling the listener", {
  timeout: 65000,
  skip: process.platform === "win32" ? "requires Unix process-group evidence" : false,
}, async context => {
  const { invocation, port, token } = await startDrainFixture(context);
  process.kill(-invocation.child.pid, "SIGINT");
  const result = await invocation.finish();
  assert.ok(result.signal === "SIGINT" || result.code === 130);
  await assertDrainListenerUnsignalled(invocation, port, token);

  const { rows } = await readReport(invocation);
  assert.equal(rows["build:builder"].status, "interrupted");
  const [core, observability, cli] = rows["build:builder"].steps;
  assert.equal(core.exitCode, 0);
  assert.equal(core.signal, null);
  assert.equal(core.drainExpired, undefined);
  assert.equal(core.cleanup, "unconfirmed");
  assert.equal(observability.status, "unstarted");
  assert.equal(cli.status, "unstarted");
  for (const group of expectedGroups.slice(3)) assert.equal(rows[group].status, "unstarted", group);
});

test("foreground interruption flushes completed results and releases an owned separate listener", {
  timeout: 60000,
}, async context => {
  const invocation = await fixtureInvocation(context, { interrupt: true });
  const port = Number(await waitForFile(join(invocation.directory, "ready"), invocation));
  const ownedPid = Number(await readFile(join(invocation.directory, "owned-pid"), "utf8"));
  const report = (await readdir(invocation.reports)).find(name => name.startsWith("builder-kernel-"));
  assert.match(await readFile(join(invocation.reports, report, "results.jsonl"), "utf8"), /test:constitution/u);
  const sentinel = createServer();
  sentinel.listen(0, "127.0.0.1");
  await once(sentinel, "listening");
  context.after(() => sentinel.close());

  process.kill(-invocation.child.pid, "SIGINT");
  const result = await invocation.finish();
  assert.ok(result.signal || result.code !== 0);
  const { rows } = await readReport(invocation);
  assert.equal(rows["test:constitution"].status, "passed");
  assert.equal(rows["test:package-boundaries"].status, "interrupted");
  assert.equal(rows["build:builder"].status, "unstarted");
  assert.equal(rows["changeset:status"].status, "unstarted");
  assert.deepEqual(result.trace, ["run test:constitution", "run test:package-boundaries"]);
  assert.equal(sentinel.listening, true);
  const rebound = createServer();
  rebound.listen(port, "127.0.0.1");
  await once(rebound, "listening");
  await new Promise(resolve => rebound.close(resolve));
  const state = spawnSync("/bin/ps", ["-o", "stat=", "-p", String(ownedPid)], { encoding: "utf8" });
  assert.ok(state.status === 1 || /^Z/u.test(state.stdout.trim()), "owned listener is no longer running");
  assert.equal(rows["test:package-boundaries"].steps[0].cleanup, "complete");
});

test("missing, duplicate and unknown results cannot satisfy required coverage", async () => {
  const { allRequiredPassed } = await import("../../scripts/verify-builder-kernel.mjs");
  const complete = expectedGroups.map(group => ({ group, status: "passed" }));
  const missing = complete.slice(0, -1);
  assert.equal(allRequiredPassed(complete), true);
  assert.equal(allRequiredPassed(missing), false);
  assert.equal(allRequiredPassed([...missing, complete[0]]), false);
  assert.equal(allRequiredPassed([...missing, { group: "other", status: "passed" }]), false);
  assert.equal(allRequiredPassed([...missing, { ...complete.at(-1), status: "unknown" }]), false);
});
