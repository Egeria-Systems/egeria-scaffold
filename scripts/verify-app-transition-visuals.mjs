import { execFile, spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import * as filesystem from "node:fs/promises";
import { constants } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir, freemem, cpus } from "node:os";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";

import { runDependencyAudit } from "./lib/dependency-audit.mjs";
import { cleanupOwnedDirectory, createIsolatedProcessEnvironment, isolatedProcessOptions, pathIdentityMatches, readPathIdentity } from "./lib/isolated-process.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const execute = promisify(execFile);
const artifactRoot = "generated-visual-artifacts/app-transitions";
const snapshotDirectory = "apps/web/tests/visual/home-visual.spec.ts-snapshots";
const templateDirectory = `packages/builder-core/templates/portfolio/${snapshotDirectory}`;
const viewports = Object.freeze({ desktop: { width: 1440, height: 900 }, mobile: { width: 320, height: 800 } });
const historicalHashes = Object.freeze({
  "monolingual-desktop": "6f6dd1ddd3049d998ac51b4da17b7eb66ca481b89f9e4947fb68b0bce1af50d5",
  "monolingual-mobile": "00e95d03593487ac4a6bb3e08afe9a1df475ecb76b8b1f1da676259ccf551d27",
  "multilingual-desktop": "d737921e3ceba92f58c1aa0fd728d7e8ecfd20dafb3e8241487e105d8f8aab8c",
  "multilingual-mobile": "b2eecb8f5a8d18f8b4f7516073b57f7faca8df1e947df37883e301d61403fd17",
});

export const appTransitionVisualToolchain = Object.freeze({
  platform: "linux", architecture: "x64", node: "22.23.2", pnpm: "11.20.0",
  playwright: "1.62.1", browserRevision: "1234", browserVersion: "151.0.7922.34",
});

function freezeRuntimePolicy(value) {
  for (const child of Object.values(value)) if (child && typeof child === "object") freezeRuntimePolicy(child);
  return Object.freeze(value);
}

export const appTransitionRuntimePolicy = freezeRuntimePolicy({
  base: {
    reference: "mcr.microsoft.com/playwright@sha256:dcc5531e97840b9b5e794f2814476b21571c5124a3fca2267d73041f56e7580e",
    index: "sha256:dcc5531e97840b9b5e794f2814476b21571c5124a3fca2267d73041f56e7580e",
    platform: "sha256:c091b21d9fae78c76e85cd4356431e9b018402f172a214fc7d7a5e9a7e29d8ac",
  },
  dockerfile: "FROM --platform=linux/amd64 mcr.microsoft.com/playwright@sha256:dcc5531e97840b9b5e794f2814476b21571c5124a3fca2267d73041f56e7580e\nUSER 0:0\nCOPY [\"libc6_2.39-0ubuntu8.9_amd64.deb\", \"libc-bin_2.39-0ubuntu8.9_amd64.deb\", \"zlib1g_1%3a1.3.dfsg-3.1ubuntu2.2_amd64.deb\", \"/tmp/patched-runtime-packages/\"]\nRUN DEBIAN_FRONTEND=noninteractive dpkg --install /tmp/patched-runtime-packages/libc6_2.39-0ubuntu8.9_amd64.deb /tmp/patched-runtime-packages/libc-bin_2.39-0ubuntu8.9_amd64.deb /tmp/patched-runtime-packages/zlib1g_1%3a1.3.dfsg-3.1ubuntu2.2_amd64.deb \\\n    && dpkg --audit > /tmp/patched-runtime-dpkg-audit.txt \\\n    && test ! -s /tmp/patched-runtime-dpkg-audit.txt \\\n    && apt-get check\nUSER 1001:1001\n",
  dockerfileSha256: "84e13c8a72b7a3692778e4b9819649b578d4c6029b13e717d72d5fb83373c3e6",
  packages: [
    { name: "libc-bin", before: "2.39-0ubuntu8.7", version: "2.39-0ubuntu8.9", filename: "libc-bin_2.39-0ubuntu8.9_amd64.deb", bytes: 682164, sha256: "066398a06ef1a218d4109461d4c636eafe83322ad19b179de9ef7af42b3fec58", url: "https://archive.ubuntu.com/ubuntu/pool/main/g/glibc/libc-bin_2.39-0ubuntu8.9_amd64.deb" },
    { name: "libc6", before: "2.39-0ubuntu8.7", version: "2.39-0ubuntu8.9", filename: "libc6_2.39-0ubuntu8.9_amd64.deb", bytes: 3264314, sha256: "ff5557d99b51f761c4b7c92368b9cc45565eda17df9bf9eb4b134d09825008be", url: "https://archive.ubuntu.com/ubuntu/pool/main/g/glibc/libc6_2.39-0ubuntu8.9_amd64.deb" },
    { name: "zlib1g", before: "1:1.3.dfsg-3.1ubuntu2.1", version: "1:1.3.dfsg-3.1ubuntu2.2", filename: "zlib1g_1%3a1.3.dfsg-3.1ubuntu2.2_amd64.deb", bytes: 62988, sha256: "84b9cf5752b29c9f92c27cd4c4ba9bbcc70b5ccf9b1b515421a28ae23212e273", url: "https://archive.ubuntu.com/ubuntu/pool/main/z/zlib/zlib1g_1.3.dfsg-3.1ubuntu2.2_amd64.deb" },
  ],
  security: { user: "1001:1001", readOnlyRoot: true, capDrop: ["ALL"], noNewPrivileges: true, network: "bridge", ports: 0,
    shmBytes: 1073741824, memoryBytes: 6442450944, swapBytes: 6442450944, cpus: 4, pids: 512,
    mountRoles: ["workspace", "scratch", "node", "pnpm", "receipt"] },
});
export const appTransitionRuntimePolicySha256 = digest(json(appTransitionRuntimePolicy));
const runtimeReceiptPath = "/run/app-transition-runtime.json";
const runtimeScratchPath = "/tmp/app-transition-runtime";
const runtimeSha256 = value => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const runtimeImageId = value => typeof value === "string" && /^sha256:[a-f0-9]{64}$/.test(value);
function runtimeKeys(value, keys) {
  if (!value || typeof value !== "object" || Array.isArray(value) || !same(Object.keys(value).sort(), [...keys].sort())) fail("VISUAL_ENVIRONMENT_UNSUPPORTED");
}
function runtimeShims(value) {
  try { if (typeof value === "string" && same(JSON.parse(value), { node: false })) return value; } catch {}
  fail("VISUAL_ENVIRONMENT_UNSUPPORTED");
}

export function validateAppTransitionRuntimeReceipt(bytes, expected = {}) {
  try {
    if (!Buffer.isBuffer(bytes) || bytes.length > 65536) fail("VISUAL_ENVIRONMENT_UNSUPPORTED");
    const receipt = JSON.parse(bytes.toString("utf8"));
    if (!bytes.equals(Buffer.from(json(receipt)))) fail("VISUAL_ENVIRONMENT_UNSUPPORTED");
    runtimeKeys(receipt, ["schemaVersion", "policySha256", "sourceRevision", "image", "packages", "tools", "security"]);
    if (receipt.schemaVersion !== 1 || receipt.policySha256 !== appTransitionRuntimePolicySha256 || !/^[a-f0-9]{40}$/.test(receipt.sourceRevision)) fail("VISUAL_ENVIRONMENT_UNSUPPORTED");
    const { image, packages, tools, security } = receipt;
    runtimeKeys(image, ["engineId", "baseIndex", "basePlatform", "baseLayers", "layers"]);
    if (!runtimeImageId(image.engineId) || image.baseIndex !== appTransitionRuntimePolicy.base.index || image.basePlatform !== appTransitionRuntimePolicy.base.platform || !Array.isArray(image.baseLayers) || !Array.isArray(image.layers) || image.baseLayers.length !== 7 || image.layers.length !== 9 || !image.layers.every(runtimeImageId) || !same(image.layers.slice(0, 7), image.baseLayers)) fail("VISUAL_ENVIRONMENT_UNSUPPORTED");
    runtimeKeys(packages, ["beforeCount", "afterCount", "beforeSha256", "afterSha256", "changes", "buildExitCode"]);
    const changes = appTransitionRuntimePolicy.packages.map(({ name, before, version }) => ({ name, before, version, architecture: "amd64", status: "install ok installed" }));
    if (packages.beforeCount !== 514 || packages.afterCount !== 514 || !runtimeSha256(packages.beforeSha256) || !runtimeSha256(packages.afterSha256) || !same(packages.changes, changes) || packages.buildExitCode !== 0) fail("VISUAL_ENVIRONMENT_UNSUPPORTED");
    runtimeKeys(tools, ["node", "pnpm"]); runtimeKeys(tools.node, ["version", "sha256"]); runtimeKeys(tools.pnpm, ["version", "sha256", "closure", "globalShims"]);
    runtimeKeys(tools.pnpm.closure, ["sha256", "files", "bytes"]);
    if (tools.node.version !== appTransitionVisualToolchain.node || tools.pnpm.version !== appTransitionVisualToolchain.pnpm || ![tools.node.sha256, tools.pnpm.sha256, tools.pnpm.closure.sha256].every(runtimeSha256) || !Number.isInteger(tools.pnpm.closure.files) || tools.pnpm.closure.files < 2 || tools.pnpm.closure.files > 1024 || !Number.isInteger(tools.pnpm.closure.bytes) || tools.pnpm.closure.bytes < 1 || tools.pnpm.closure.bytes > 256 * 1024 * 1024 || !same(security, appTransitionRuntimePolicy.security)) fail("VISUAL_ENVIRONMENT_UNSUPPORTED");
    runtimeShims(tools.pnpm.globalShims);
    const receiptSha256 = digest(bytes);
    const observed = { imageId: image.engineId, sourceRevision: receipt.sourceRevision, receiptSha256,
      nodeSha256: tools.node.sha256, pnpmSha256: tools.pnpm.sha256, closureSha256: tools.pnpm.closure.sha256 };
    if (Object.entries(expected).some(([key, value]) => !(key in observed) || observed[key] !== value)) fail("VISUAL_ENVIRONMENT_UNSUPPORTED");
    return { receipt, receiptSha256 };
  } catch { fail("VISUAL_ENVIRONMENT_UNSUPPORTED"); }
}

export async function readAppTransitionRuntimeReceipt(path, expected = {}) {
  let handle;
  try {
    handle = await filesystem.open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    const before = await handle.stat();
    if (!before.isFile() || before.nlink !== 1 || before.uid !== process.getuid() || (before.mode & 0o777) !== 0o600 || before.size > 65536) fail("VISUAL_ENVIRONMENT_UNSUPPORTED");
    const buffer = Buffer.alloc(65537); let length = 0;
    while (length < buffer.length) {
      const result = await handle.read(buffer, length, buffer.length - length, null);
      if (result.bytesRead === 0) break;
      length += result.bytesRead;
    }
    const bytes = buffer.subarray(0, length);
    const after = await filesystem.lstat(path); const held = await handle.stat();
    if (after.isSymbolicLink() || ![after, held].every(stat => stat.dev === before.dev && stat.ino === before.ino && stat.size === before.size && stat.mtimeMs === before.mtimeMs && stat.ctimeMs === before.ctimeMs) || bytes.length !== before.size) fail("VISUAL_ENVIRONMENT_UNSUPPORTED");
    return validateAppTransitionRuntimeReceipt(bytes, expected);
  } catch { fail("VISUAL_ENVIRONMENT_UNSUPPORTED"); }
  finally { await handle?.close(); }
}

export async function inspectAppTransitionRuntimeExecutable(path) {
  try {
    const stat = await filesystem.lstat(path);
    if (!stat.isFile() || stat.isSymbolicLink() || !(stat.mode & 0o100)) fail("VISUAL_TOOLCHAIN_INVALID");
    const bytes = await boundedRead(filesystem, dirname(path), path.split(sep).at(-1), 256 * 1024 * 1024);
    if (bytes.length < 64 || !bytes.subarray(0, 7).equals(Buffer.from([127, 69, 76, 70, 2, 1, 1])) || ![2, 3].includes(bytes.readUInt16LE(16)) || bytes.readUInt16LE(18) !== 62) fail("VISUAL_TOOLCHAIN_INVALID");
    return digest(bytes);
  } catch { fail("VISUAL_TOOLCHAIN_INVALID"); }
}

export async function inspectAppTransitionPnpmClosure(directory) {
  try {
    const root = await filesystem.lstat(directory);
    if (!root.isDirectory() || root.isSymbolicLink()) fail("VISUAL_TOOLCHAIN_INVALID");
    const entries = []; let total = 0;
    async function visit(path) {
      if (!safeRelative(path)) fail("VISUAL_TOOLCHAIN_INVALID");
      const absolute = join(directory, path); const before = await filesystem.lstat(absolute);
      if (before.isSymbolicLink()) fail("VISUAL_TOOLCHAIN_INVALID");
      if (before.isDirectory()) {
        for (const name of (await filesystem.readdir(absolute)).sort()) await visit(`${path}/${name}`);
      } else {
        if (!before.isFile() || (before.nlink !== 1 && !(path === "pnpm" && before.nlink <= 4)) || entries.length >= 1024 || before.size > 256 * 1024 * 1024 - total || (path === "pnpm" && !(before.mode & 0o100))) fail("VISUAL_TOOLCHAIN_INVALID");
        const content = await boundedRead(filesystem, directory, path, 256 * 1024 * 1024 - total);
        const after = await filesystem.lstat(absolute);
        if (after.ctimeMs !== before.ctimeMs || after.ino !== before.ino || after.dev !== before.dev) fail("VISUAL_TOOLCHAIN_INVALID");
        entries.push({ path, bytes: content.length, sha256: digest(content), mode: before.mode & 0o777 }); total += content.length;
      }
    }
    await visit("pnpm"); await visit("dist");
    if (entries.length < 2 || !entries.some(({ path }) => path.startsWith("dist/"))) fail("VISUAL_TOOLCHAIN_INVALID");
    entries.sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0);
    return { entries, sha256: digest(json(entries)), files: entries.length, bytes: total };
  } catch { fail("VISUAL_TOOLCHAIN_INVALID"); }
}

export async function stageAppTransitionPnpmClosure(source, destination) {
  const before = await inspectAppTransitionPnpmClosure(source);
  await filesystem.mkdir(destination, { mode: 0o700 });
  for (const entry of before.entries) {
    const target = await safePath(filesystem, destination, entry.path, { create: true });
    const content = await boundedRead(filesystem, source, entry.path, entry.bytes);
    if (digest(content) !== entry.sha256) fail("VISUAL_TOOLCHAIN_INVALID");
    await writeExclusive(filesystem, destination, entry.path, content);
    await filesystem.chmod(target, entry.mode);
  }
  if (!same(before, await inspectAppTransitionPnpmClosure(source)) || !same(before, await inspectAppTransitionPnpmClosure(destination))) fail("VISUAL_TOOLCHAIN_INVALID");
  return before;
}

export function createAppTransitionRuntimeInvocation(input) {
  try {
    if (!same(Object.keys(input).sort(), ["repositoryRoot", "scratchRoot", "nodeExecutable", "pnpmDirectory", "receiptPath", "imageId", "arguments"].sort())) fail("VISUAL_RUNTIME_INVOCATION_INVALID");
    const paths = [input.repositoryRoot, input.scratchRoot, input.nodeExecutable, input.pnpmDirectory, input.receiptPath];
    if (!paths.every(path => typeof path === "string" && isAbsolute(path) && resolve(path) === path && !/[\\,\r\n\0]/.test(path)) || new Set(paths).size !== 5 || !runtimeImageId(input.imageId) || !Array.isArray(input.arguments)) fail("VISUAL_RUNTIME_INVOCATION_INVALID");
    const options = parseAppTransitionVisualArguments(input.arguments);
    if (options.mode === "promote" || options.recipeVersion !== "0.2.3") fail("VISUAL_RUNTIME_INVOCATION_INVALID");
    const create = ["create", "--platform=linux/amd64", "--user=1001:1001", "--cap-drop=ALL", "--security-opt=no-new-privileges", "--read-only", "--network=bridge", "--shm-size=1g", "--memory=6g", "--memory-swap=6g", "--cpus=4", "--pids-limit=512", "--workdir=/workspace"];
    const targets = ["/workspace", runtimeScratchPath, "/opt/app-visual-tools/node", "/opt/app-visual-tools/pnpm", runtimeReceiptPath];
    paths.forEach((path, index) => create.push("--mount", `type=bind,source=${path},target=${targets[index]}${index > 1 ? ",readonly" : ""}`));
    create.push(input.imageId, "/bin/sleep", "infinity");
    return { create, install: ["pnpm", "install", "--frozen-lockfile", "--store-dir", join(runtimeScratchPath, "store")], command: ["pnpm", "run", "verify:app-transition-visuals", "--", ...input.arguments] };
  } catch { fail("VISUAL_RUNTIME_INVOCATION_INVALID"); }
}

export function inspectAppTransitionPackageDelta(beforeText, afterText) {
  try {
    function inventory(text) {
      if (typeof text !== "string" || Buffer.byteLength(text) > 4 * 1024 * 1024) fail("VISUAL_RUNTIME_PACKAGES_INVALID");
      const values = text.trim().split(/\n\s*\n/).map(paragraph => {
        const fields = new Map([...paragraph.matchAll(/^([A-Za-z-]+): (.*)$/gm)].map(([, key, value]) => [key, value]));
        const record = { name: fields.get("Package"), version: fields.get("Version"), architecture: fields.get("Architecture"), status: fields.get("Status") };
        if (Object.values(record).some(value => typeof value !== "string" || !value)) fail("VISUAL_RUNTIME_PACKAGES_INVALID");
        return record;
      }).sort((left, right) => `${left.name}:${left.architecture}` < `${right.name}:${right.architecture}` ? -1 : 1);
      if (values.length !== 514 || new Set(values.map(({ name, architecture }) => `${name}:${architecture}`)).size !== 514) fail("VISUAL_RUNTIME_PACKAGES_INVALID");
      return values;
    }
    const before = inventory(beforeText); const after = inventory(afterText); const changes = [];
    for (let index = 0; index < before.length; index++) {
      const previous = before[index]; const current = after[index];
      if (previous.name !== current.name || previous.architecture !== current.architecture || previous.status !== current.status) fail("VISUAL_RUNTIME_PACKAGES_INVALID");
      if (previous.version !== current.version) changes.push({ name: previous.name, before: previous.version, version: current.version, architecture: current.architecture, status: current.status });
    }
    if (!same(changes, appTransitionRuntimePolicy.packages.map(({ name, before, version }) => ({ name, before, version, architecture: "amd64", status: "install ok installed" })))) fail("VISUAL_RUNTIME_PACKAGES_INVALID");
    return { beforeCount: before.length, afterCount: after.length, beforeSha256: digest(json(before)), afterSha256: digest(json(after)), changes, buildExitCode: 0 };
  } catch { fail("VISUAL_RUNTIME_PACKAGES_INVALID"); }
}

export async function runHostedAppTransitionCommand(input) {
  const { executable, arguments: arguments_, cwd, environment, logDirectory, signal } = input;
  const maximumBytes = input.maximumBytes ?? 64 * 1024 * 1024;
  if (process.platform === "win32" || !Number.isInteger(maximumBytes) || maximumBytes < 1 || maximumBytes > 64 * 1024 * 1024 || !Number.isFinite(input.timeout) || input.timeout < 1 || input.timeout > 43 * 60 * 1000) fail("VISUAL_RUNTIME_COMMAND_INVALID");
  const stem = randomUUID(); const stdout = []; const stderr = []; let bytes = 0; let timedOut = false; let overflow = false; let aborted = false; let spawnFailed = false;
  let finished = false; let terminationRequested = false; let streamsClosed = false; let escalationPerformed = false; let drainTimedOut = false; let observedExit; let escalationTimer; let drainTimer; let exitDrainTimer; let complete;
  const terminationSignals = [];
  const child = spawn(executable, arguments_, { cwd, env: environment, shell: false, detached: true, stdio: ["ignore", "pipe", "pipe"] });
  const processGroupId = Number.isInteger(child.pid) && child.pid > 0 && child.pid !== process.pid ? child.pid : null;
  function signalOwnedGroup(value) {
    if (processGroupId === null) { terminationSignals.push({ signal: value, status: "unavailable" }); return; }
    try { process.kill(-processGroupId, value); terminationSignals.push({ signal: value, status: "sent" }); }
    catch (error) { terminationSignals.push({ signal: value, status: error.code === "ESRCH" ? "gone" : "failed" }); }
  }
  function terminate() {
    if (terminationRequested || finished) return;
    terminationRequested = true;
    signalOwnedGroup("SIGTERM");
    escalationTimer = setTimeout(() => {
      if (finished) return;
      signalOwnedGroup("SIGKILL"); escalationPerformed = true;
      if (streamsClosed) { complete(false); return; }
      drainTimer = setTimeout(() => { drainTimedOut = true; complete(true); }, 1000);
    }, 250);
  }
  function capture(chunks, value) {
    if (finished) return;
    const available = maximumBytes - bytes; const kept = value.subarray(0, Math.max(0, available));
    if (kept.length) chunks.push(kept);
    bytes += kept.length;
    if (value.length > available) { overflow = true; terminate(); }
  }
  child.stdout.on("data", value => capture(stdout, value)); child.stderr.on("data", value => capture(stderr, value));
  const timeout = setTimeout(() => { timedOut = true; terminate(); }, input.timeout);
  const abort = () => { aborted = true; terminate(); };
  const native = await new Promise(resolve => {
    complete = forced => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout); clearTimeout(escalationTimer); clearTimeout(drainTimer); clearTimeout(exitDrainTimer);
      signal?.removeEventListener("abort", abort);
      if (forced) { child.stdout.destroy(); child.stderr.destroy(); child.unref(); }
      resolve(observedExit ?? { exitCode: null, signal: null });
    };
    child.on("error", () => { spawnFailed = true; terminate(); });
    child.on("exit", (exitCode, signal) => {
      observedExit = { exitCode, signal };
      if (!terminationRequested && !finished) exitDrainTimer = setTimeout(terminate, 250);
    });
    child.on("close", () => {
      streamsClosed = true;
      if (!terminationRequested || escalationPerformed) complete(false);
    });
    signal?.addEventListener("abort", abort, { once: true }); if (signal?.aborted) abort();
  });
  const captureComplete = !overflow && !drainTimedOut;
  const output = { stdout: Buffer.concat(stdout), stderr: Buffer.concat(stderr) }; let captureExitCode = 0;
  for (const [name, content] of Object.entries(output)) {
    try { await filesystem.writeFile(join(logDirectory, `${stem}.${name}.log`), content, { flag: "wx", mode: 0o600 }); }
    catch { captureExitCode = 1; }
  }
  const result = { ...native, processGroupId, terminationRequested, terminationSignals, drainTimedOut, captureComplete,
    exitObserved: observedExit !== undefined, captureId: stem, captureExitCode, timedOut, overflow, aborted, spawnFailed,
    success: native.exitCode === 0 && native.signal === null && captureExitCode === 0 && captureComplete && !terminationRequested && !timedOut && !aborted && !spawnFailed,
    stdout: output.stdout.toString("utf8"), stderr: output.stderr.toString("utf8"), bytes };
  try { await filesystem.writeFile(join(logDirectory, `${stem}.status.json`), json({ executable, arguments: arguments_, cwd, ...native,
    processGroupId, terminationRequested, terminationSignals, drainTimedOut, captureComplete, exitObserved: observedExit !== undefined,
    captureId: stem, captureExitCode, timedOut, overflow, aborted, spawnFailed, bytes }), { flag: "wx", mode: 0o600 }); }
  catch { result.captureExitCode = 1; result.success = false; }
  return result;
}

function appTransitionCommandEvidence(stage, result) {
  return { stage, captureId: result.captureId ?? null, exitCode: result.exitCode ?? null, signal: result.signal ?? null,
    captureExitCode: result.captureExitCode ?? 1, captureComplete: result.captureComplete === true,
    drainTimedOut: result.drainTimedOut === true, timedOut: result.timedOut === true, overflow: result.overflow === true,
    aborted: result.aborted === true };
}

export async function finishAppTransitionHostedRuntime(input) {
  if (typeof input.containerId !== "string" || input.containerId.length !== 64 || !/^[a-f0-9]{64}$/.test(input.containerId)) fail("VISUAL_RUNTIME_INVOCATION_INVALID");
  const deadline = performance.now() + 30000;
  const command = input.runCommand ?? runHostedAppTransitionCommand;
  const commands = []; const capture = { mainBytes: input.mainCapture?.bytes ?? 0, mainAborted: input.mainCapture?.signal?.aborted === true, teardownBytes: 0 };
  async function attempt(stage, arguments_, cap, maximumBytes) {
    const timeout = Math.floor(Math.min(cap, deadline - performance.now() - 2000));
    let result;
    try {
      if (timeout <= 0) fail("VISUAL_RUNTIME_STOP_UNKNOWN");
      result = await command({ executable: "docker", arguments: arguments_, cwd: input.cwd, environment: input.environment,
        logDirectory: input.logDirectory, timeout, maximumBytes });
    } catch {
      result = { success: false, exitCode: null, signal: null, captureExitCode: 1, captureComplete: false, bytes: 0 };
    }
    capture.teardownBytes += result.bytes ?? 0;
    commands.push(appTransitionCommandEvidence(stage, result));
    return result;
  }
  const stop = await attempt("derived-stop", ["stop", "--timeout=10", input.containerId], 15000, 256 * 1024);
  const inspection = await attempt("stopped-inspect", ["inspect", input.containerId], 10000, 768 * 1024);
  let stopped = null;
  if (inspection.success) {
    try {
      const state = JSON.parse(inspection.stdout)[0].State;
      if (state.Running === false && state.Pid === 0 && Number.isInteger(state.ExitCode) && typeof state.OOMKilled === "boolean")
        stopped = { running: false, pid: 0, exitCode: state.ExitCode, oomKilled: state.OOMKilled };
    } catch {}
  }
  capture.mainAborted = input.mainCapture?.signal?.aborted === true;
  const mainFailure = input.failure ?? (capture.mainAborted ? input.mainCapture.signal.reason ?? new Error("VISUAL_RUNTIME_COMMAND_FAILED") : undefined);
  const failure = mainFailure ?? (stopped === null ? new Error("VISUAL_RUNTIME_STOP_UNKNOWN") : !stop.success ? new Error("VISUAL_RUNTIME_STOP_FAILED") : undefined);
  return { failure, stopped, commands, capture };
}

export function validateAppTransitionRuntimeEntry(environment, expected) {
  if (expected.script !== "node scripts/verify-app-transition-visuals.mjs") fail("VISUAL_ENVIRONMENT_UNSUPPORTED");
  const markers = ["npm_lifecycle_event", "npm_package_json", "PNPM_SCRIPT_SRC_DIR", "npm_lifecycle_script", "npm_execpath"];
  if (environment.pnpm_config_verify_deps_before_run === "error" && markers.every(key => environment[key] === undefined)) return { kind: "direct" };
  let options;
  try { options = parseAppTransitionVisualArguments(expected.arguments); } catch { fail("VISUAL_ENVIRONMENT_UNSUPPORTED"); }
  if (options.mode === "promote" || options.recipeVersion !== "0.2.3") fail("VISUAL_ENVIRONMENT_UNSUPPORTED");
  const lifecycleScript = `${expected.script}${expected.arguments.length ? ` ${expected.arguments.join(" ")}` : ""}`;
  if (environment.pnpm_config_verify_deps_before_run !== "false" ||
      environment.npm_lifecycle_event !== "verify:app-transition-visuals" || environment.npm_package_json !== join(expected.repositoryRoot, "package.json") ||
      environment.PNPM_SCRIPT_SRC_DIR !== expected.repositoryRoot || environment.npm_lifecycle_script !== lifecycleScript || environment.npm_execpath !== expected.pnpmExecutable) fail("VISUAL_ENVIRONMENT_UNSUPPORTED");
  return { kind: "canonical-lifecycle" };
}

async function inspectRuntimeFilesystem() {
  const root = await filesystem.mkdtemp(join(runtimeScratchPath, "qualification-"));
  await filesystem.chmod(root, 0o700); const identity = await readPathIdentity(root);
  try {
    await writeExclusive(filesystem, root, "case-a", "lower"); await writeExclusive(filesystem, root, "case-A", "upper");
    const lower = await filesystem.lstat(join(root, "case-a")); const upper = await filesystem.lstat(join(root, "case-A"));
    await filesystem.link(join(root, "case-a"), join(root, "hardlink"));
    await filesystem.symlink("case-a", join(root, "link"));
    const linked = await filesystem.lstat(join(root, "hardlink")); const symbolic = await filesystem.lstat(join(root, "link"));
    const observed = { uid: process.getuid(), gid: process.getgid(), directoryMode: (await filesystem.lstat(root)).mode & 0o777,
      fileModes: [lower.mode & 0o777, upper.mode & 0o777], caseDistinct: lower.ino !== upper.ino,
      hardlinkIdentity: linked.ino === lower.ino, symbolicLinkObserved: symbolic.isSymbolicLink() };
    process.stdout.write(json({ runtimeFilesystem: observed }));
    if (observed.uid !== 1001 || observed.gid !== 1001 || observed.directoryMode !== 0o700 || observed.fileModes.some(mode => mode !== 0o600) || !observed.caseDistinct || !observed.hardlinkIdentity || !observed.symbolicLinkObserved) fail("VISUAL_ENVIRONMENT_UNSUPPORTED");
  } finally { await cleanupOwnedDirectory(identity); }
}

export async function inspectAppTransitionHostedEnvironment() {
  if (process.platform !== "linux" || process.arch !== "x64" || process.versions.node !== appTransitionVisualToolchain.node || process.getuid() !== 1001 || process.getgid() !== 1001 || process.env.GITHUB_ACTIONS !== "true") fail("VISUAL_ENVIRONMENT_UNSUPPORTED");
  const shims = runtimeShims(process.env.PNPM_CONFIG_GLOBAL_SHIMS);
  const release = await filesystem.readFile("/etc/os-release", "utf8");
  if (!/^VERSION_CODENAME=noble$/m.test(release)) fail("VISUAL_ENVIRONMENT_UNSUPPORTED");
  await filesystem.access("/.dockerenv");
  const source = await execute("git", ["-c", "safe.directory=/workspace", "rev-parse", "HEAD"], { ...isolatedProcessOptions, cwd: repositoryRoot });
  const nodeSha256 = await inspectAppTransitionRuntimeExecutable("/opt/app-visual-tools/node");
  const pnpmSha256 = await inspectAppTransitionRuntimeExecutable("/opt/app-visual-tools/pnpm/pnpm");
  const closure = await inspectAppTransitionPnpmClosure("/opt/app-visual-tools/pnpm");
  const expected = { imageId: process.env.EGERIA_VISUAL_IMAGE, receiptSha256: process.env.EGERIA_VISUAL_RUNTIME_RECEIPT_SHA256,
    sourceRevision: source.stdout.trim(), nodeSha256, pnpmSha256, closureSha256: closure.sha256 };
  if (!runtimeImageId(expected.imageId) || !runtimeSha256(expected.receiptSha256)) fail("VISUAL_ENVIRONMENT_UNSUPPORTED");
  const runtime = await readAppTransitionRuntimeReceipt(runtimeReceiptPath, expected);
  const manifest = JSON.parse((await boundedRead(filesystem, repositoryRoot, "package.json", 1024 * 1024)).toString("utf8"));
  validateAppTransitionRuntimeEntry(process.env, { repositoryRoot, pnpmExecutable: "/opt/app-visual-tools/pnpm/pnpm", script: manifest.scripts?.["verify:app-transition-visuals"], arguments: process.argv.slice(2) });
  if (runtime.receipt.tools.pnpm.globalShims !== shims || runtime.receipt.tools.pnpm.closure.files !== closure.files || runtime.receipt.tools.pnpm.closure.bytes !== closure.bytes) fail("VISUAL_ENVIRONMENT_UNSUPPORTED");
  const version = await execute("pnpm", ["--version"], { ...isolatedProcessOptions, env: createIsolatedProcessEnvironment({ HOME: join(runtimeScratchPath, "home"), PNPM_CONFIG_GLOBAL_SHIMS: shims, pnpm_config_verify_deps_before_run: "error" }) });
  if (version.stdout.trim() !== appTransitionVisualToolchain.pnpm) fail("VISUAL_ENVIRONMENT_UNSUPPORTED");
  for (const name of ["home", "temporary", "cache", "store", "pnpmHome"]) {
    const path = join(runtimeScratchPath, name); const stat = await filesystem.lstat(path);
    if (!stat.isDirectory() || stat.isSymbolicLink() || stat.uid !== 1001 || (stat.mode & 0o777) !== 0o700) fail("VISUAL_ENVIRONMENT_UNSUPPORTED");
  }
  await inspectRuntimeFilesystem();
  return { ...appTransitionVisualToolchain, runtime };
}

export async function runHostedAppTransitionVisuals(input) {
  const { arguments: arguments_, repositoryRoot: root, nodeExecutable, pnpmBinDirectory } = input;
  if (!same(Object.keys(input).sort(), ["arguments", "repositoryRoot", "nodeExecutable", "pnpmBinDirectory"].sort()) || process.platform !== "linux" || process.arch !== "x64" || process.getuid() !== 1001 || process.getgid() !== 1001 || process.versions.node !== appTransitionVisualToolchain.node) fail("VISUAL_ENVIRONMENT_UNSUPPORTED");
  const options = parseAppTransitionVisualArguments(arguments_);
  if (options.mode === "promote" || options.recipeVersion !== "0.2.3") fail("VISUAL_RUNTIME_INVOCATION_INVALID");
  const shims = runtimeShims(process.env.PNPM_CONFIG_GLOBAL_SHIMS);
  const rootStat = await filesystem.lstat(root);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink() || rootStat.uid !== 1001 || await filesystem.realpath(root) !== root || await filesystem.realpath(nodeExecutable) !== nodeExecutable) fail("VISUAL_ENVIRONMENT_UNSUPPORTED");
  const privateRoot = await filesystem.mkdtemp(join(process.env.RUNNER_TEMP ?? tmpdir(), "app-transition-runtime-"));
  await filesystem.chmod(privateRoot, 0o700);
  const scratch = join(privateRoot, "scratch"); const logs = join(privateRoot, "native"); const context = join(privateRoot, "context");
  for (const path of [scratch, logs, context]) await filesystem.mkdir(path, { mode: 0o700 });
  const support = {};
  for (const name of ["home", "temporary", "cache", "store", "pnpmHome"]) { support[name] = join(scratch, name); await filesystem.mkdir(support[name], { mode: 0o700 }); }
  await writeExclusive(filesystem, scratch, "user.npmrc", "");
  const environment = createIsolatedProcessEnvironment({ HOME: support.home, TMPDIR: support.temporary, XDG_CACHE_HOME: support.cache });
  const deadline = performance.now() + 43 * 60 * 1000; const producerDeadline = performance.now() + 10 * 60 * 1000;
  let derivedId; let baselineId; let imageId; let runtime; let dockerRoot; let capturedBytes = 0; let stopped; let failure; let capture;
  const records = []; const resources = []; const controller = new AbortController(); let monitor; let measuring = false; let lastMeasurement = performance.now();
  const deadlineTimer = setTimeout(() => controller.abort(new Error("VISUAL_RUNTIME_COMMAND_FAILED")), 43 * 60 * 1000);
  async function measure(minimum) {
    const facts = [];
    for (const [role, path] of [["workspace", root], ["scratch", scratch], ...(dockerRoot ? [["docker", dockerRoot]] : [])]) {
      const stat = await filesystem.statfs(path, { bigint: true }); const available = Number(stat.bavail * stat.bsize);
      facts.push({ role, available });
    }
    const observed = { at: Date.now(), filesystems: facts, memoryFree: freemem(), cpus: cpus().length };
    resources.push(observed); lastMeasurement = performance.now();
    if (facts.some(({ available }) => available < minimum)) fail("VISUAL_RUNTIME_CAPACITY_INSUFFICIENT");
    return observed;
  }
  async function native(stage, executable, args, cap = 30000, producing = true) {
    const remaining = (producing ? Math.min(deadline, producerDeadline) : deadline) - performance.now();
    if (remaining <= 0 || capturedBytes >= 64 * 1024 * 1024) fail("VISUAL_RUNTIME_COMMAND_FAILED");
    const result = await runHostedAppTransitionCommand({ executable, arguments: args, cwd: root, environment, logDirectory: logs,
      timeout: Math.max(1, Math.min(cap, remaining)), maximumBytes: 64 * 1024 * 1024 - capturedBytes, signal: controller.signal });
    capturedBytes += result.bytes;
    records.push(appTransitionCommandEvidence(stage, result));
    if (!result.success) fail("VISUAL_RUNTIME_COMMAND_FAILED");
    return result.stdout.trim();
  }
  async function docker(stage, args, cap, producing) { return native(stage, "docker", args, cap, producing); }
  try {
    const initial = await measure(12.5 * 1024 ** 3);
    if (initial.memoryFree < 6 * 1024 ** 3) fail("VISUAL_RUNTIME_CAPACITY_INSUFFICIENT");
    dockerRoot = await docker("docker-storage", ["info", "--format", "{{.DockerRootDir}}"]);
    await measure(12.5 * 1024 ** 3);
    monitor = setInterval(async () => {
      if (measuring) { if (performance.now() - lastMeasurement > 5000) controller.abort(new Error("VISUAL_RUNTIME_CAPACITY_INSUFFICIENT")); return; }
      measuring = true;
      try { await measure(2 * 1024 ** 3); } catch { controller.abort(new Error("VISUAL_RUNTIME_CAPACITY_INSUFFICIENT")); } finally { measuring = false; }
    }, 1000);
    const sourceRevision = await native("source", "git", ["rev-parse", "HEAD"]);
    if (!/^[a-f0-9]{40}$/.test(sourceRevision) || await native("clean-source", "git", ["status", "--porcelain"])) fail("VISUAL_SOURCE_CHANGED");
    const pnpmDirectory = join(privateRoot, "pnpm"); const closure = await stageAppTransitionPnpmClosure(pnpmBinDirectory, pnpmDirectory);
    await writeExclusive(filesystem, privateRoot, "pnpm-closure.json", json(closure));
    const tools = { node: { version: (await native("node-version", nodeExecutable, ["--version"], 10000)).replace(/^v/, ""), sha256: await inspectAppTransitionRuntimeExecutable(nodeExecutable) },
      pnpm: { version: await native("pnpm-host-version", join(pnpmDirectory, "pnpm"), ["--version"], 10000), sha256: closure.entries.find(({ path }) => path === "pnpm").sha256,
        closure: { sha256: closure.sha256, files: closure.files, bytes: closure.bytes }, globalShims: shims } };
    if (await inspectAppTransitionRuntimeExecutable(join(pnpmDirectory, "pnpm")) !== tools.pnpm.sha256) fail("VISUAL_TOOLCHAIN_INVALID");
    if (tools.node.version !== appTransitionVisualToolchain.node || tools.pnpm.version !== appTransitionVisualToolchain.pnpm || digest(appTransitionRuntimePolicy.dockerfile) !== appTransitionRuntimePolicy.dockerfileSha256) fail("VISUAL_TOOLCHAIN_INVALID");
    for (const item of appTransitionRuntimePolicy.packages) {
      const timeout = Math.floor(Math.min(120000, producerDeadline - performance.now())); if (timeout <= 0) fail("VISUAL_RUNTIME_COMMAND_FAILED");
      const response = await fetch(item.url, { redirect: "error", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(timeout)]) });
      if (!response.ok) fail("VISUAL_RUNTIME_PACKAGES_INVALID");
      const chunks = []; let size = 0;
      for await (const chunk of response.body) { size += chunk.length; if (size > item.bytes) fail("VISUAL_RUNTIME_PACKAGES_INVALID"); chunks.push(chunk); }
      const bytes = Buffer.concat(chunks);
      if (size !== item.bytes || digest(bytes) !== item.sha256) fail("VISUAL_RUNTIME_PACKAGES_INVALID");
      await writeExclusive(filesystem, context, item.filename, bytes);
      const fields = await native("package-identity", "dpkg-deb", ["--show", "--showformat=${Package}\t${Version}\t${Architecture}", join(context, item.filename)]);
      if (fields !== `${item.name}\t${item.version}\tamd64`) fail("VISUAL_RUNTIME_PACKAGES_INVALID");
    }
    await writeExclusive(filesystem, context, "Dockerfile", appTransitionRuntimePolicy.dockerfile);
    await docker("base-pull", ["pull", "--platform=linux/amd64", appTransitionRuntimePolicy.base.reference], 600000);
    const index = JSON.parse(await docker("base-index", ["buildx", "imagetools", "inspect", "--raw", appTransitionRuntimePolicy.base.reference]));
    if (index.manifests?.filter(({ platform }) => platform.os === "linux" && platform.architecture === "amd64").map(({ digest }) => digest).join() !== appTransitionRuntimePolicy.base.platform) fail("VISUAL_ENVIRONMENT_UNSUPPORTED");
    const base = JSON.parse(await docker("base-image", ["image", "inspect", appTransitionRuntimePolicy.base.reference]))[0];
    if (base.Os !== "linux" || base.Architecture !== "amd64" || base.RootFS?.Layers?.length !== 7) fail("VISUAL_ENVIRONMENT_UNSUPPORTED");
    baselineId = await docker("inert-base-create", ["create", "--platform=linux/amd64", appTransitionRuntimePolicy.base.reference]);
    if (!/^[a-f0-9]{64}$/.test(baselineId)) fail("VISUAL_ENVIRONMENT_UNSUPPORTED");
    await docker("base-inventory", ["cp", `${baselineId}:/var/lib/dpkg/status`, join(privateRoot, "base-status")]);
    const iid = join(privateRoot, "image-id");
    await docker("patched-image-build", ["buildx", "build", "--platform=linux/amd64", "--network=none", "--load", "--iidfile", iid, context], 600000);
    const builtReference = (await filesystem.readFile(iid, "utf8")).trim(); if (!runtimeImageId(builtReference)) fail("VISUAL_ENVIRONMENT_UNSUPPORTED");
    const image = JSON.parse(await docker("patched-image", ["image", "inspect", builtReference]))[0];
    imageId = image.Id;
    if (!runtimeImageId(imageId) || image.Os !== "linux" || image.Architecture !== "amd64" || image.RootFS?.Layers?.length !== 9 || !same(image.RootFS.Layers.slice(0, 7), base.RootFS.Layers) || image.Config.User !== "1001:1001") fail("VISUAL_ENVIRONMENT_UNSUPPORTED");
    const receiptPath = join(privateRoot, "receipt.json"); const receiptHandle = await filesystem.open(receiptPath, "wx", 0o600);
    try {
      const invocation = createAppTransitionRuntimeInvocation({ repositoryRoot: root, scratchRoot: scratch, nodeExecutable, pnpmDirectory, receiptPath, imageId, arguments: arguments_ });
      derivedId = await docker("derived-create", invocation.create);
      if (!/^[a-f0-9]{64}$/.test(derivedId)) fail("VISUAL_ENVIRONMENT_UNSUPPORTED");
      const actual = JSON.parse(await docker("derived-inspect", ["inspect", derivedId]))[0]; const config = actual.HostConfig;
      const expectedMounts = [[root, "/workspace", true], [scratch, runtimeScratchPath, true], [nodeExecutable, "/opt/app-visual-tools/node", false], [pnpmDirectory, "/opt/app-visual-tools/pnpm", false], [receiptPath, runtimeReceiptPath, false]];
      if (actual.Image !== imageId || actual.Config.User !== "1001:1001" || actual.State.Running || actual.State.Pid !== 0 || !config.ReadonlyRootfs || !same(config.CapDrop, ["ALL"]) || !config.SecurityOpt?.includes("no-new-privileges") || config.NetworkMode !== "bridge" || config.ShmSize !== 1073741824 || config.Memory !== 6442450944 || config.MemorySwap !== 6442450944 || config.NanoCpus !== 4000000000 || config.PidsLimit !== 512 || config.Privileged || config.PublishAllPorts || Object.keys(config.PortBindings ?? {}).length || actual.Mounts.length !== 5 || expectedMounts.some(([source, target, writable]) => !actual.Mounts.some(mount => mount.Type === "bind" && mount.Source === source && mount.Destination === target && mount.RW === writable))) fail("VISUAL_ENVIRONMENT_UNSUPPORTED");
      await docker("derived-inventory", ["cp", `${derivedId}:/var/lib/dpkg/status`, join(privateRoot, "derived-status")]);
      const packages = inspectAppTransitionPackageDelta(await filesystem.readFile(join(privateRoot, "base-status"), "utf8"), await filesystem.readFile(join(privateRoot, "derived-status"), "utf8"));
      const receipt = { schemaVersion: 1, policySha256: appTransitionRuntimePolicySha256, sourceRevision,
        image: { engineId: imageId, baseIndex: appTransitionRuntimePolicy.base.index, basePlatform: appTransitionRuntimePolicy.base.platform, baseLayers: base.RootFS.Layers, layers: image.RootFS.Layers }, packages, tools, security: appTransitionRuntimePolicy.security };
      const bytes = Buffer.from(json(receipt)); runtime = validateAppTransitionRuntimeReceipt(bytes);
      await receiptHandle.writeFile(bytes); await receiptHandle.sync();
      const guestSupport = Object.fromEntries(Object.keys(support).map(name => [name, join(runtimeScratchPath, name)]));
      const guestEnvironment = { ...appTransitionOwnedEnvironment(guestSupport, join(runtimeScratchPath, "user.npmrc")),
        PATH: "/opt/app-visual-tools/pnpm:/opt/app-visual-tools:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
        LANG: "C.UTF-8", EGERIA_VISUAL_IMAGE: imageId, EGERIA_VISUAL_RUNTIME_RECEIPT_SHA256: runtime.receiptSha256,
        GIT_CONFIG_COUNT: "1", GIT_CONFIG_KEY_0: "safe.directory", GIT_CONFIG_VALUE_0: "/workspace" };
      const exec = ["exec", "--user=1001:1001", derivedId, "/usr/bin/env", "-i", ...Object.entries(guestEnvironment).map(([key, value]) => `${key}=${value}`)];
      await docker("derived-start", ["start", derivedId]);
      await docker("guest-qualification", [...exec, "node", "--input-type=module", "-e", 'import {inspectAppTransitionHostedEnvironment} from "/workspace/scripts/verify-app-transition-visuals.mjs"; await inspectAppTransitionHostedEnvironment();'], 120000);
      await docker("root-frozen-install", [...exec, ...invocation.install], 900000, false);
      const node = await docker("installed-node", [...exec, "pnpm", "exec", "node", "--version"], 10000, false);
      if (node !== `v${appTransitionVisualToolchain.node}`) fail("VISUAL_TOOLCHAIN_INVALID");
      await measure(7 * 1024 ** 3);
      await docker("canonical-visuals", [...exec, ...invocation.command], 43 * 60 * 1000, false);
    } finally { await receiptHandle.close(); }
  } catch (error) { failure = controller.signal.aborted ? controller.signal.reason : error; }
  finally {
    clearInterval(monitor); clearTimeout(deadlineTimer);
    if (derivedId) {
      const completion = await finishAppTransitionHostedRuntime({ containerId: derivedId, failure,
        mainCapture: { bytes: capturedBytes, signal: controller.signal }, cwd: root, environment, logDirectory: logs });
      failure = completion.failure; stopped = completion.stopped; capture = completion.capture;
      records.push(...completion.commands);
    }
    const summary = { schemaVersion: 1, status: failure ? "failed" : "completed", code: failure ? (/^VISUAL_[A-Z_]+$/.test(failure.message) ? failure.message : "VISUAL_RUNTIME_FAILED") : null,
      ...(runtime ? { runtime } : {}), ...(imageId ? { imageId } : {}), baselineNeverStarted: true, resources, commands: records, capture: capture ?? null, stop: stopped ?? null };
    await writeExclusive(filesystem, privateRoot, "native-summary.json", json({ ...summary, derivedId: derivedId ?? null, baselineId: baselineId ?? null }));
    const destination = await safePath(filesystem, root, artifactRoot, { directories: true });
    await writeExclusive(filesystem, destination, `runtime-${randomUUID()}.json`, json(summary));
  }
  if (failure) throw failure;
  return { status: "completed", imageId, runtime };
}

function appTransitionOwnedEnvironment(support, userConfig) {
  return createIsolatedProcessEnvironment({ HOME: support.home, USERPROFILE: support.home,
    TMPDIR: support.temporary, TMP: support.temporary, TEMP: support.temporary, XDG_CACHE_HOME: support.cache,
    PNPM_HOME: support.pnpmHome, npm_config_store_dir: support.store,
    NPM_CONFIG_USERCONFIG: userConfig, NPM_CONFIG_REGISTRY: "https://registry.npmjs.org/",
    pnpm_config_verify_deps_before_run: "error", PNPM_CONFIG_GLOBAL_SHIMS: runtimeShims(process.env.PNPM_CONFIG_GLOBAL_SHIMS ?? '{"node":false}'),
    CI: "true", GITHUB_ACTIONS: "true", NEXT_TELEMETRY_DISABLED: "1", WRANGLER_SEND_METRICS: "false",
    PLAYWRIGHT_BROWSERS_PATH: "/ms-playwright" });
}

async function prepareAppTransitionBuilder(root, command) {
  const owned = await filesystem.mkdtemp(join(tmpdir(), "egeria-app-transition-builder-"));
  await filesystem.chmod(owned, 0o700); const identity = await readPathIdentity(owned);
  try {
    const support = {};
    for (const name of ["home", "temporary", "cache", "store", "pnpmHome"]) support[name] = await safePath(filesystem, owned, name, { directories: true });
    await writeExclusive(filesystem, owned, "user.npmrc", "");
    const result = await command({ executable: "pnpm", arguments: ["--filter", "@egeria-systems/builder-core", "run", "build"], cwd: root, environment: appTransitionOwnedEnvironment(support, join(owned, "user.npmrc")) });
    if (result.exitCode !== 0) fail("VISUAL_BUILDER_BUILD_FAILED");
  } finally { await cleanupOwnedDirectory(identity); }
}

const subsets = Object.freeze(Array.from({ length: 8 }, (_, bits) =>
  ["analytics", "booking-calendly", "multilingual"].filter((_, index) => bits & (1 << index))));
const assets = Object.freeze(Object.entries(historicalHashes).map(([identifier, historicalSha256]) => {
  const [group, viewport] = identifier.split("-");
  return Object.freeze({ identifier, group, viewport, historicalSha256,
    templatePath: `${templateDirectory}/app-transition-${group === "multilingual" ? "multilingual-" : ""}home-${viewport}-chromium-linux.png` });
}));

function fail(code) { throw new Error(code); }
function digest(bytes) { return createHash("sha256").update(bytes).digest("hex"); }
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  return value;
}
function json(value) { return `${JSON.stringify(canonical(value), null, 2)}\n`; }
function same(left, right) { return json(left) === json(right); }
function portable(path) { return path.split(sep).join("/"); }
function safeRelative(path) {
  return typeof path === "string" && path.length > 0 && !path.includes("\\") && !path.includes("\0") && !path.startsWith("/") && path.split("/").every((part) => part !== "" && part !== "." && part !== "..");
}

export function parseAppTransitionVisualArguments(arguments_) {
  const values = arguments_[0] === "--" ? arguments_.slice(1) : arguments_;
  const recipeArguments = values.filter(value => value.startsWith("--app-recipe-version="));
  if (recipeArguments.length > 1) fail("VISUAL_ARGUMENT_INVALID");
  const recipeVersion = recipeArguments[0]?.slice("--app-recipe-version=".length);
  if (recipeVersion !== undefined && !["0.2.2", "0.2.3"].includes(recipeVersion)) fail("VISUAL_ARGUMENT_INVALID");
  const modes = values.filter(value => !recipeArguments.includes(value));
  const recipe = recipeVersion === undefined ? {} : { recipeVersion };
  if (modes.length === 0) return { mode: "compare", ...recipe };
  if (modes.length === 1 && modes[0] === "--candidates") return { mode: "candidates", ...recipe };
  if (modes.length === 1 && recipeVersion === undefined) {
    const match = /^--promote-reviewed-manifest-sha256=([a-f0-9]{64})$/.exec(modes[0]);
    if (match) return { mode: "promote", digest: match[1] };
  }
  return fail("VISUAL_ARGUMENT_INVALID");
}

async function safePath(fs, root, path, { directories = false, create = directories } = {}) {
  if (!safeRelative(path)) fail("VISUAL_PATH_UNSAFE");
  const rootStat = await fs.lstat(root);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) fail("VISUAL_PATH_UNSAFE");
  const parts = path.split("/");
  let current = root;
  for (let index = 0; index < parts.length; index += 1) {
    current = join(current, parts[index]);
    const directory = index < parts.length - 1 || directories;
    let stats;
    try { stats = await fs.lstat(current); } catch (error) {
      if (error.code !== "ENOENT") throw error;
      if (directory && create) {
        await fs.mkdir(current, { mode: 0o700 });
        stats = await fs.lstat(current);
      } else continue;
    }
    if (stats.isSymbolicLink() || (directory ? !stats.isDirectory() : !stats.isFile())) fail("VISUAL_PATH_UNSAFE");
  }
  return current;
}

async function boundedRead(fs, root, path, maximum = 16 * 1024 * 1024) {
  const absolute = await safePath(fs, root, path);
  const handle = await fs.open(absolute, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const stats = await handle.stat();
    if (!stats.isFile() || stats.size > maximum) fail("VISUAL_ARTIFACT_INVALID");
    const bytes = await handle.readFile();
    const after = await fs.lstat(absolute);
    if (bytes.length !== stats.size || after.isSymbolicLink() || after.dev !== stats.dev || after.ino !== stats.ino || after.size !== stats.size || after.mtimeMs !== stats.mtimeMs) fail("VISUAL_ARTIFACT_INVALID");
    return bytes;
  } finally { await handle.close(); }
}

async function writeExclusive(fs, root, path, bytes) {
  if (dirname(path) !== ".") await safePath(fs, root, portable(dirname(path)), { directories: true });
  const absolute = await safePath(fs, root, path);
  const handle = await fs.open(absolute, "wx", 0o600);
  try { await handle.writeFile(bytes); } finally { await handle.close(); }
}

function validateImage(bytes, viewport) {
  const expected = viewports[viewport];
  if (!(bytes instanceof Uint8Array) || bytes.length < 24 || bytes.length > 8 * 1024 * 1024) fail("VISUAL_IMAGE_INVALID");
  const buffer = Buffer.from(bytes);
  if (!buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) || buffer.toString("ascii", 12, 16) !== "IHDR" || buffer.readUInt32BE(16) !== expected.width || buffer.readUInt32BE(20) !== expected.height) fail("VISUAL_IMAGE_INVALID");
}

async function snapshotSource(root) {
  const { stdout } = await execute("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], { ...isolatedProcessOptions, cwd: root });
  const excluded = new Set(assets.map(({ templatePath }) => templatePath));
  const paths = [...new Set(stdout.split("\0").filter(Boolean))].filter((path) => !excluded.has(path) && (
    ["package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml", ".npmrc"].includes(path) ||
    /^packages\/builder-core\/(src\/|templates\/|lockfiles\/|scripts\/|package.json$|tsconfig)/.test(path) ||
    ["scripts/verify-app-transition-visuals.mjs", "scripts/lib/isolated-process.mjs",
      "scripts/lib/dependency-audit.mjs", "scripts/dependency-audit-exception.json"].includes(path)
  )).sort();
  const files = [];
  for (const path of paths) files.push({ path, sha256: digest(await boundedRead(filesystem, root, path)) });
  async function compiled(directory) {
    const absolute = await safePath(filesystem, root, directory, { directories: true, create: false });
    for (const entry of await filesystem.readdir(absolute, { withFileTypes: true })) {
      const path = `${directory}/${entry.name}`;
      if (entry.isSymbolicLink()) fail("VISUAL_PATH_UNSAFE");
      if (entry.isDirectory()) await compiled(path);
      else if (entry.isFile()) files.push({ path, sha256: digest(await boundedRead(filesystem, root, path)) });
      else fail("VISUAL_PATH_UNSAFE");
    }
  }
  await compiled("packages/builder-core/dist");
  files.sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0);
  const { stdout: revision } = await execute("git", ["rev-parse", "HEAD"], { ...isolatedProcessOptions, cwd: root });
  return { revision: revision.trim(), files };
}

async function inspectEnvironment() {
  return inspectAppTransitionHostedEnvironment();
}

async function promote(options, adapters) {
  const { filesystem: fs, repositoryRoot: root } = adapters;
  const parent = await safePath(fs, root, artifactRoot, { directories: true, create: false });
  const matches = [];
  const entries = await fs.readdir(parent, { withFileTypes: true }).catch(error => {
    if (error.code === "ENOENT") fail("VISUAL_REVIEWED_MANIFEST_MISSING");
    throw error;
  });
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.isSymbolicLink()) continue;
    const path = `${artifactRoot}/${entry.name}/candidate-manifest.json`;
    try {
      const bytes = await boundedRead(fs, root, path);
      if (digest(bytes) === options.digest) matches.push({ path, bytes });
    } catch (error) { if (error.code !== "ENOENT") throw error; }
  }
  if (matches.length !== 1) fail("VISUAL_REVIEWED_MANIFEST_MISSING");
  const { path, bytes } = matches[0];
  const manifest = JSON.parse(bytes.toString("utf8"));
  if (!Buffer.from(json(manifest)).equals(bytes) || manifest.schemaVersion !== 2 || manifest.status !== "candidates" || !same(manifest.toolchain, appTransitionVisualToolchain) || manifest.cases.length !== 8 || manifest.assets.length !== 4 || !same(manifest.cases.map(({ subset }) => subset), subsets)) fail("VISUAL_MANIFEST_INVALID");
  try { runtimeKeys(manifest.runtime, ["receipt", "receiptSha256"]); validateAppTransitionRuntimeReceipt(Buffer.from(json(manifest.runtime.receipt)), { receiptSha256: manifest.runtime.receiptSha256, sourceRevision: manifest.source.revision }); } catch { fail("VISUAL_MANIFEST_INVALID"); }
  if (!same(await adapters.snapshotSource(), manifest.source)) fail("VISUAL_SOURCE_CHANGED");
  const approved = [];
  for (let index = 0; index < assets.length; index += 1) {
    const entry = manifest.assets[index];
    const definition = assets[index];
    if (entry.identifier !== definition.identifier || entry.templatePath !== definition.templatePath || !safeRelative(entry.candidatePath)) fail("VISUAL_MANIFEST_INVALID");
    const content = await boundedRead(fs, root, `${portable(dirname(path))}/${entry.candidatePath}`);
    if (digest(content) !== entry.sha256) fail("VISUAL_CANDIDATE_CHANGED");
    validateImage(content, definition.viewport);
    for (const item of manifest.cases.filter(({ subset }) => subset.includes("multilingual") === (definition.group === "multilingual"))) {
      if (item.images[definition.viewport].sha256 !== entry.sha256) fail("VISUAL_MANIFEST_INVALID");
      const actual = await boundedRead(fs, root, `${portable(dirname(path))}/${item.images[definition.viewport].path}`);
      if (digest(actual) !== entry.sha256) fail("VISUAL_CANDIDATE_CHANGED");
    }
    const destination = await safePath(fs, root, definition.templatePath);
    if (await fs.lstat(destination).then(() => true, (error) => { if (error.code !== "ENOENT") throw error; return false; })) fail("VISUAL_PROMOTION_COLLISION");
    approved.push({ path: definition.templatePath, candidatePath: `${portable(dirname(path))}/${entry.candidatePath}`, content });
  }
  const written = [];
  try {
    for (const entry of approved) {
      if (!same(await adapters.snapshotSource(), manifest.source) || digest(await boundedRead(fs, root, path)) !== options.digest) fail("VISUAL_SOURCE_CHANGED");
      for (const candidate of approved) if (!Buffer.from(await boundedRead(fs, root, candidate.candidatePath)).equals(candidate.content)) fail("VISUAL_CANDIDATE_CHANGED");
      await writeExclusive(fs, root, entry.path, entry.content);
      written.push(entry.path);
    }
    if (!same(await adapters.snapshotSource(), manifest.source) || digest(await boundedRead(fs, root, path)) !== options.digest) fail("VISUAL_SOURCE_CHANGED");
    for (const entry of approved) if (!Buffer.from(await boundedRead(fs, root, entry.path)).equals(entry.content)) fail("VISUAL_CANDIDATE_CHANGED");
  } catch (error) {
    if (written.length > 0) {
      const partial = new Error("VISUAL_PROMOTION_PARTIAL");
      partial.writtenPaths = written;
      throw partial;
    }
    throw error;
  }
  return { status: "promoted", manifestSha256: options.digest, paths: written };
}

export async function verifyAppTransitionVisuals(options, injected = {}) {
  if (options.recipeVersion !== undefined && (!["0.2.2", "0.2.3"].includes(options.recipeVersion) || options.mode === "promote")) fail("VISUAL_ARGUMENT_INVALID");
  if (!["candidates", "compare", "promote"].includes(options.mode) || (options.mode === "promote" && !/^[a-f0-9]{64}$/.test(options.digest))) fail("VISUAL_ARGUMENT_INVALID");
  const root = injected.repositoryRoot ?? repositoryRoot;
  const adapters = { filesystem, repositoryRoot: root, inspectEnvironment, snapshotSource: () => snapshotSource(root), executeCase,
    prepareBuilder: () => prepareAppTransitionBuilder(root, injected.runCommand ?? runCommand), ...injected };
  if (options.mode === "promote") return promote(options, adapters);
  const { runtime, ...toolchain } = await adapters.inspectEnvironment();
  if (!same(toolchain, appTransitionVisualToolchain) || !runtime) fail("VISUAL_ENVIRONMENT_UNSUPPORTED");
  runtimeKeys(runtime, ["receipt", "receiptSha256"]);
  validateAppTransitionRuntimeReceipt(Buffer.from(json(runtime.receipt)), { receiptSha256: runtime.receiptSha256 });
  await adapters.prepareBuilder();
  const source = await adapters.snapshotSource();
  if (source.revision !== runtime.receipt.sourceRevision) fail("VISUAL_SOURCE_CHANGED");
  const fs = adapters.filesystem;
  const runPath = `${artifactRoot}/${randomUUID()}`;
  const run = await safePath(fs, root, runPath, { directories: true });
  const identity = await readPathIdentity(run);
  const cases = [];
  try {
    for (const subset of subsets) {
      if (!(await pathIdentityMatches(identity))) fail("VISUAL_ROOT_CHANGED");
      const name = subset.length ? subset.join("-") : "default";
      const casePath = `${runPath}/${name}`;
      const artifactDirectory = await safePath(fs, root, casePath, { directories: true });
      const baselines = {};
      if (options.mode === "compare") {
        for (const asset of assets.filter(({ group }) => (group === "multilingual") === subset.includes("multilingual"))) baselines[asset.viewport] = await boundedRead(fs, root, asset.templatePath);
      }
      const value = await adapters.executeCase({ subset, mode: options.mode, baselines, artifactDirectory, repositoryRoot: root, recipeVersion: options.recipeVersion });
      if (!(await pathIdentityMatches(identity))) fail("VISUAL_ROOT_CHANGED");
      if (!value.project?.files?.length || !value.influencingFingerprints?.length) fail("VISUAL_INPUT_IDENTITY_MISSING");
      const images = {};
      for (const viewport of Object.keys(viewports)) {
        const content = value.images[viewport];
        validateImage(content, viewport);
        const path = `${name}/${viewport}-actual.png`;
        await writeExclusive(fs, run, path, content);
        images[viewport] = { path, sha256: digest(content), ...viewports[viewport] };
        if (options.mode === "compare" && !Buffer.from(content).equals(baselines[viewport])) fail("VISUAL_COMPARISON_FAILED");
      }
      cases.push({ subset, project: value.project, influencingFingerprints: value.influencingFingerprints, checks: value.checks, images });
    }
    const representatives = [];
    for (const asset of assets) {
      const group = cases.filter(({ subset }) => subset.includes("multilingual") === (asset.group === "multilingual"));
      const representative = group[0].images[asset.viewport];
      if (group.length !== 4 || group.some(({ images }) => images[asset.viewport].sha256 !== representative.sha256)) fail("VISUAL_SUBSET_MISMATCH");
      representatives.push({ ...asset, candidatePath: representative.path, sha256: representative.sha256, historicalMatch: representative.sha256 === asset.historicalSha256 });
    }
    if (!same(source, await adapters.snapshotSource())) fail("VISUAL_SOURCE_CHANGED");
    if (!(await pathIdentityMatches(identity))) fail("VISUAL_ROOT_CHANGED");
    const manifest = { schemaVersion: 2, runtime, status: options.mode === "candidates" ? "candidates" : "compared", source, toolchain, cases, assets: representatives };
    const bytes = Buffer.from(json(manifest));
    const manifestPath = `${runPath}/${options.mode === "candidates" ? "candidate" : "comparison"}-manifest.json`;
    await writeExclusive(fs, root, manifestPath, bytes);
    return { status: manifest.status, manifestPath, manifestSha256: digest(bytes), assets: representatives };
  } catch (error) {
    const sourceUnchanged = same(source, await adapters.snapshotSource());
    if (await pathIdentityMatches(identity)) await writeExclusive(fs, run, "failure.json", json({ code: /^VISUAL_[A-Z_]+$/.test(error.message) ? error.message : "VISUAL_VERIFICATION_FAILED", sourceUnchanged, cases }));
    if (!sourceUnchanged) fail("VISUAL_SOURCE_CHANGED");
    throw error;
  }
}

async function prepareProject(root, subset, recipeVersion = "0.2.2") {
  if (!["0.2.2", "0.2.3"].includes(recipeVersion)) fail("VISUAL_RECIPE_IDENTITY_INVALID");
  const core = await import(pathToFileURL(join(root, "packages/builder-core/dist/index.js")));
  const policy = await import(pathToFileURL(join(root, "packages/builder-core/dist/lifecycle/app-profile-transition.js")));
  const validation = await import(pathToFileURL(join(root, "packages/builder-core/dist/lifecycle/app-transition-content-validation.js")));
  const lockfiles = await import(pathToFileURL(join(root, "packages/builder-core/dist/generation/recipe-lockfiles.js")));
  const request = {
    ...policy.appTransitionVisualProject,
    packageVersions: core.verifiedCapabilityPackageVersions,
    ...(subset.includes("analytics") ? { analytics: policy.appTransitionVisualAnalyticsSettings } : {}),
    ...(subset.includes("booking-calendly") ? { bookingCalendly: policy.appTransitionVisualBookingSettings } : {}),
    ...(subset.includes("multilingual") ? { multilingual: true } : {}),
  };
  const { createGenerationRenderingContext } = await import(pathToFileURL(join(root, "packages/builder-core/dist/catalog/verified-package-versions.js")));
  const recipes = await import(pathToFileURL(join(root, "packages/builder-core/dist/profiles/profile-recipes.js")));
  const context = { ...createGenerationRenderingContext(), profiles: recipeVersion === "0.2.3" ? recipes.createLiteralLintProfileRecipes() : recipes.createDependencySecurityProfileRecipes() };
  const source = await core.renderSkeleton({ ...request, profile: "portfolio" }, context);
  const target = await core.renderSkeleton({ ...request, profile: "app" }, context);
  if (!source.ok || !target.ok) fail("VISUAL_RENDER_FAILED");
  if (source.value.project.schemaVersion !== "1.0.0" || source.value.project.originProfile !== "portfolio" || source.value.project.recipeVersion !== (recipeVersion === "0.2.3" ? "0.11.3" : "0.11.2") ||
      target.value.project.schemaVersion !== "1.0.0" || target.value.project.originProfile !== "app" || target.value.project.recipeVersion !== recipeVersion) fail("VISUAL_RECIPE_IDENTITY_INVALID");
  const prepared = policy.prepareAppProfileTransition({ source: source.value, target: target.value,
    currentFiles: new Map(source.value.files.map(({ path, content }) => [path, content])),
    validators: await validation.loadAppTransitionContentValidators() });
  if (!prepared.ok) fail("VISUAL_PREPARATION_FAILED");
  const manifest = JSON.parse(Buffer.from(prepared.value.files.find(({ path }) => path === "apps/web/package.json").content).toString("utf8"));
  const version = lockfiles.resolveRecipeLockfileVersion(target.value.project, manifest);
  if (version !== `app-${recipeVersion}`) fail("VISUAL_LOCKFILE_INVALID");
  const lockfile = await filesystem.readFile(lockfiles.createRecipeLockfileUrl(version));
  return { request, sourceProject: source.value.project, targetProject: target.value.project,
    files: [...prepared.value.files, { path: "pnpm-lock.yaml", content: lockfile }], influencingFingerprints: prepared.value.influencingFingerprints };
}

export function createAppTransitionVisualSpec(source, multilingual) {
  const skip = 'test.skip(\n  true,\n  "Multilingual projects are outside the established generated visual matrix.",\n);\n\n';
  if (multilingual && !source.includes(skip)) fail("VISUAL_SPEC_UNRECOGNIZED");
  let result = multilingual ? source.replace(skip, "") : source;
  result = `import { writeFile } from "node:fs/promises";\n${result}`;
  result = result.replace('const normalizedHeroHeading = "Reviewed visual baseline";', `const unexpectedExternalRequests: string[] = [];\ntest.beforeEach(() => { unexpectedExternalRequests.length = 0; });\ntest.afterEach(() => { expect(unexpectedExternalRequests).toEqual([]); });\n\nconst normalizedHeroHeading = "Reviewed visual baseline";`);
  if ((result.match(/async \(\{ page \}\)/g) ?? []).length !== 2) fail("VISUAL_SPEC_UNRECOGNIZED");
  result = result.replaceAll("async ({ page })", "async ({ page }, testInfo)");
  for (const viewport of Object.keys(viewports)) {
    const assertion = `  await expect(page).toHaveScreenshot("home-${viewport}.png");`;
    if (!result.includes(assertion)) fail("VISUAL_SPEC_UNRECOGNIZED");
    // Playwright's pixel comparator can ignore antialiasing differences even
    // at zero tolerance. Stabilize retained actual bytes independently of the
    // expected image; exact reproduction and baseline checks remain separate.
    result = result.replace(assertion, `  let previousCapture: Buffer = Buffer.alloc(0);\n  let captureAttempt = 0;\n  await expect.poll(async () => {\n    const actual = await page.screenshot({ path: testInfo.outputPath(\`${viewport}-capture-\${captureAttempt++}.png\`), animations: "disabled", caret: "hide", scale: "css" });\n    const unchanged = previousCapture.equals(actual);\n    previousCapture = actual;\n    return unchanged;\n  }, { timeout: 5_000 }).toBe(true);\n  await writeFile(testInfo.outputPath("${viewport}-captured.png"), previousCapture);\n${assertion}`);
  }
  // Every exercised provider remains intercepted. Unexpected external traffic
  // fails the visual proof instead of contacting a live provider.
  result = result.replace("  await page.setViewportSize(viewport);", `  await page.route("**/*", async (route) => {\n    const url = new URL(route.request().url());\n    if (url.hostname === "127.0.0.1" || url.hostname === "localhost") await route.continue();\n    else { unexpectedExternalRequests.push(url.origin); await route.abort(); }\n  });\n  await page.setViewportSize(viewport);`);
  return result;
}

function visualTests(report) {
  const visit = suites => suites.flatMap(suite => [...(suite.specs ?? []).flatMap(spec => spec.tests ?? []), ...visit(suite.suites ?? [])]);
  return visit(report.suites ?? []);
}

export function validateAppTransitionVisualReport(report, candidate) {
  const tests = visualTests(report);
  if (tests.length !== 2 || (report.errors ?? []).length || tests.some(test => test.results?.length !== 1 || !["passed", "failed"].includes(test.results[0].status))) fail("VISUAL_TEST_EXECUTION_INVALID");
  for (const test of tests) {
    const result = test.results[0];
    if (result.status === "passed") continue;
    if (!candidate || !result.errors?.length || result.errors.some(error => !/toHaveScreenshot/.test(error.message ?? ""))) fail("VISUAL_COMPARISON_FAILED");
  }
}

async function runCommand(input) {
  try {
    const result = await execute(input.executable, input.arguments, { ...isolatedProcessOptions, cwd: input.cwd, env: input.environment, timeout: 15 * 60 * 1000 });
    return { exitCode: 0, stdout: result.stdout, stderr: result.stderr };
  } catch (error) {
    return { exitCode: Number.isInteger(error.code) ? error.code : -1, stdout: String(error.stdout ?? ""), stderr: String(error.stderr ?? "") };
  }
}

async function inspectBrowser(project, environment, command) {
  const require = createRequire(join(project, "apps/web/package.json"));
  const testRequire = createRequire(require.resolve("@playwright/test/package.json"));
  const playwrightRequire = createRequire(testRequire.resolve("playwright/package.json"));
  const playwrightPackage = playwrightRequire.resolve("playwright-core/package.json");
  const installed = JSON.parse(await filesystem.readFile(playwrightPackage, "utf8"));
  const browsers = JSON.parse(await filesystem.readFile(join(dirname(playwrightPackage), "browsers.json"), "utf8"));
  const chromium = browsers.browsers.find(browser => browser.name === "chromium");
  const shell = browsers.browsers.find(browser => browser.name === "chromium-headless-shell");
  if (installed.version !== appTransitionVisualToolchain.playwright || [chromium, shell].some(browser => browser?.revision !== appTransitionVisualToolchain.browserRevision || browser?.browserVersion !== appTransitionVisualToolchain.browserVersion)) fail("VISUAL_ENVIRONMENT_UNSUPPORTED");
  const executable = `/ms-playwright/chromium_headless_shell-${shell.revision}/chrome-headless-shell-linux64/chrome-headless-shell`;
  const version = await command({ executable, arguments: ["--version"], cwd: project, environment });
  if (version.exitCode !== 0 || !version.stdout.includes(appTransitionVisualToolchain.browserVersion)) fail("VISUAL_ENVIRONMENT_UNSUPPORTED");
  return { executable, version: version.stdout.trim(), packageSha256: digest(await filesystem.readFile(playwrightPackage)), browsersSha256: digest(await filesystem.readFile(join(dirname(playwrightPackage), "browsers.json"))) };
}

export function inspectEffectSourceBoundary(sourceFiles, appFoundation) {
  for (const { path, content } of sourceFiles) {
    if (!/\.[cm]?[jt]sx?$/.test(path) || path.includes("/tests/")) continue;
    const source = Buffer.from(content).toString("utf8");
    if (/\b(?:from\s*|import\s*(?:\(\s*)?)["']effect(?:\/[^"']*)?["']/.test(source) &&
        (!appFoundation || !/^apps\/web\/src\/(application|infrastructure|composition|delivery)\//.test(path) || /["']use client["']/.test(source))) fail("VISUAL_EFFECT_BOUNDARY_INVALID");
  }
}

export async function inspectAppEffectBuild(project, sourceFiles) {
  inspectEffectSourceBoundary(sourceFiles, true);
  const require = createRequire(join(project, "apps/web/package.json"));
  const effectPackagePath = require.resolve("effect/package.json");
  const effectPackage = JSON.parse(await filesystem.readFile(effectPackagePath, "utf8"));
  if (effectPackage.version !== "4.0.0-rc.112") fail("VISUAL_EFFECT_BOUNDARY_INVALID");
  const effectRoot = dirname(effectPackagePath);
  const markers = new Set();
  async function inventory(root, directory, inspect) {
    const absolute = await safePath(filesystem, root, directory, { directories: true, create: false });
    const files = [];
    for (const entry of await filesystem.readdir(absolute, { withFileTypes: true })) {
      const path = `${directory}/${entry.name}`;
      if (entry.isSymbolicLink()) fail("VISUAL_PATH_UNSAFE");
      if (entry.isDirectory()) files.push(...await inventory(root, path, inspect));
      else if (entry.isFile()) {
        const stats = await filesystem.lstat(join(root, path));
        files.push({ path, bytes: stats.size });
        if (path.endsWith(".js")) await inspect(await boundedRead(filesystem, root, path, 32 * 1024 * 1024), path);
      } else fail("VISUAL_PATH_UNSAFE");
    }
    return files.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  }
  await inventory(effectRoot, "dist", async content => {
    for (const match of content.toString("utf8").matchAll(/["']((?:~effect|effect)\/[A-Za-z0-9_./-]+)["']/g)) markers.add(match[1]);
  });
  if (markers.size === 0) fail("VISUAL_EFFECT_MARKERS_MISSING");
  const client = await inventory(project, "apps/web/.next/static", async content => {
    const source = content.toString("utf8");
    if ([...markers].some(marker => source.includes(marker))) fail("VISUAL_EFFECT_CLIENT_BUNDLE");
  });
  if (!client.some(({ path }) => path.endsWith(".js"))) fail("VISUAL_CLIENT_BUNDLE_MISSING");
  const server = await inventory(project, "apps/web/.next/server", async () => {});
  const workerPath = "apps/web/.open-next/server-functions/default/handler.mjs";
  const worker = await boundedRead(filesystem, project, workerPath, 32 * 1024 * 1024);
  return {
    effect: { version: effectPackage.version, license: effectPackage.license, dependencies: effectPackage.dependencies ?? {}, optionalDependencies: effectPackage.optionalDependencies ?? {}, scripts: effectPackage.scripts ?? {}, packageSha256: digest(await filesystem.readFile(effectPackagePath)) },
    client: { files: client, bytes: client.reduce((sum, file) => sum + file.bytes, 0), inspectedEffectMarkers: [...markers].sort() },
    server: { files: server.length, bytes: server.reduce((sum, file) => sum + file.bytes, 0) },
    worker: { path: workerPath, bytes: worker.length, sha256: digest(worker) },
    limits: "Exact source imports and installed Effect identity markers inspected; byte counts do not establish performance or production safety.",
  };
}

async function retainBrowserArtifacts(fs, project, destination) {
  const files = [];
  let total = 0;
  async function visit(path) {
    const absolute = await safePath(fs, project, path, { directories: true, create: false });
    let entries;
    try { entries = await fs.readdir(absolute, { withFileTypes: true }); } catch (error) { if (error.code === "ENOENT") return; throw error; }
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name, "en"))) {
      const child = `${path}/${entry.name}`;
      if (entry.isSymbolicLink()) fail("VISUAL_PATH_UNSAFE");
      if (entry.isDirectory()) { await visit(child); continue; }
      if (!entry.isFile()) fail("VISUAL_ARTIFACT_INVALID");
      if (!/\.(png|json|txt|md)$/.test(entry.name)) continue;
      const content = await boundedRead(fs, project, child);
      total += content.length;
      if (total > 16 * 1024 * 1024) fail("VISUAL_ARTIFACT_LIMIT");
      await writeExclusive(fs, destination, child, content);
      files.push({ path: child, sha256: digest(content) });
    }
  }
  // The final path here is a directory, validated separately from file reads.
  for (const path of ["apps/web/test-results"]) {
    try {
      const stats = await fs.lstat(join(project, path));
      if (!stats.isDirectory() || stats.isSymbolicLink()) fail("VISUAL_PATH_UNSAFE");
      await visit(path);
    } catch (error) { if (error.code !== "ENOENT") throw error; }
  }
  return files;
}

export async function executeAppTransitionVisualCase(input, injected = {}) {
  if (input.recipeVersion !== undefined && !["0.2.2", "0.2.3"].includes(input.recipeVersion)) fail("VISUAL_RECIPE_IDENTITY_INVALID");
  const fs = injected.filesystem ?? filesystem;
  const command = injected.runCommand ?? runCommand;
  if (injected.runCommand && typeof injected.runAudit !== "function") fail("VISUAL_AUDIT_ADAPTER_INVALID");
  const audit = injected.runAudit ?? runDependencyAudit;
  const prepared = await (injected.prepareProject ?? prepareProject)(input.repositoryRoot, input.subset, input.recipeVersion);
  const root = await fs.mkdtemp(join(tmpdir(), "egeria-app-transition-visual-"));
  const identity = await readPathIdentity(root);
  await fs.chmod(root, 0o700);
  const project = await safePath(fs, root, "project", { directories: true });
  const support = {};
  for (const name of ["home", "temporary", "cache", "store", "pnpmHome"]) support[name] = await safePath(fs, root, name, { directories: true });
  await writeExclusive(fs, root, "user.npmrc", "");
  const environment = appTransitionOwnedEnvironment(support, join(root, "user.npmrc"));
  const files = new Map(prepared.files.map(({ path, content }) => [path, content]));
  const specPath = "apps/web/tests/visual/home-visual.spec.ts";
  files.set(specPath, Buffer.from(createAppTransitionVisualSpec(Buffer.from(files.get(specPath)).toString("utf8"), input.subset.includes("multilingual"))));
  for (const [viewport, content] of Object.entries(input.baselines)) files.set(`${snapshotDirectory}/home-${viewport}-chromium-linux.png`, content);
  const checks = [];
  let expectedFiles;
  let browser;
  let build;
  async function checked(name, arguments_) {
    if (!(await pathIdentityMatches(identity))) fail("VISUAL_ROOT_CHANGED");
    if (name === "dependency-audit") {
      try {
        const disposition = await audit({ executable: "pnpm", cwd: project, environment, timeout: 15 * 60 * 1000 });
        if (!(await pathIdentityMatches(identity))) fail("VISUAL_ROOT_CHANGED");
        checks.push({ name, exitCode: disposition.rawExitCode, disposition });
        const auditAccepted = disposition.status === "passed"
          ? disposition.thresholdExitCode === 0 && [0, 1].includes(disposition.rawExitCode)
          : disposition.status === "accepted-with-security-exception" && disposition.thresholdExitCode === 1 && disposition.rawExitCode === 1;
        if (!auditAccepted) fail("VISUAL_PROJECT_CHECK_FAILED");
      } catch (error) {
        if (error.auditDisposition) checks.push({ name, exitCode: error.auditDisposition.rawExitCode, disposition: error.auditDisposition });
        fail("VISUAL_PROJECT_CHECK_FAILED");
      }
      return;
    }
    const result = await command({ executable: "pnpm", arguments: arguments_, cwd: project, environment });
    if (!(await pathIdentityMatches(identity))) fail("VISUAL_ROOT_CHANGED");
    await writeExclusive(fs, input.artifactDirectory, `${name}.log`, `${result.stdout}\n${result.stderr}`);
    checks.push({ name, exitCode: result.exitCode });
    if (result.exitCode !== 0) fail("VISUAL_PROJECT_CHECK_FAILED");
  }
  try {
    for (const [path, content] of files) await writeExclusive(fs, project, path, content);
    expectedFiles = [...files].map(([path, content]) => ({ path, sha256: digest(content) })).sort((a, b) => a.path.localeCompare(b.path, "en"));
    const commands = [
      ["frozen-install", ["install", "--frozen-lockfile", "--store-dir", support.store]],
      ["peer-dependencies", ["peers", "check"]],
      ["dependency-audit", ["audit", "--audit-level", "info", "--json"]],
      ["registry-signatures", ["audit", "signatures"]],
      ["lint", ["run", "lint"]],
      ["cloudflare-types", ["--dir", "apps/web", "run", "cf-typegen"]],
      ["typecheck", ["run", "typecheck"]],
      ["unit", ["run", "test:unit"]],
      ["component", ["run", "test:component"]],
      ["next-build", ["run", "build"]],
      ["opennext-build", ["--dir", "apps/web", "exec", "opennextjs-cloudflare", "build", "--skipNextBuild"]],
      ["worker-integration", ["--dir", "apps/web", "run", "test:integration:cloudflare"]],
      ["browser-development", ["--dir", "apps/web", "run", "test:e2e:dev"]],
      ["browser-preview", ["--dir", "apps/web", "run", "test:e2e:preview"]],
    ];
    for (const [name, arguments_] of commands) {
      await checked(name, arguments_);
      if (name === "opennext-build") {
        build = await (injected.inspectBuild ?? inspectAppEffectBuild)(project, prepared.files);
        checks.push({ name: "effect-source-and-bundle-boundary", exitCode: 0 });
      }
    }
    browser = await (injected.inspectBrowser ?? inspectBrowser)(project, environment, command);
    const captures = {};
    for (const pass of input.mode === "candidates" ? ["candidate", "reproduction"] : ["comparison"]) {
      const passRoot = await safePath(fs, input.artifactDirectory, pass, { directories: true });
      const reportPath = join(root, `${pass}-report.json`);
      const result = await command({ executable: "pnpm", arguments: ["--dir", "apps/web", "run", "test:visual", "--reporter=json", "--retries=0"], cwd: project, environment: { ...environment, PLAYWRIGHT_JSON_OUTPUT_FILE: reportPath } });
      if (!(await pathIdentityMatches(identity))) fail("VISUAL_ROOT_CHANGED");
      await writeExclusive(fs, passRoot, "process.log", `${result.stdout}\n${result.stderr}`);
      const retained = await retainBrowserArtifacts(fs, project, passRoot);
      const report = await boundedRead(fs, root, `${pass}-report.json`);
      await writeExclusive(fs, passRoot, "report.json", report);
      validateAppTransitionVisualReport(JSON.parse(report.toString("utf8")), pass === "candidate");
      if (![0, 1].includes(result.exitCode) || (pass !== "candidate" && result.exitCode !== 0)) fail("VISUAL_COMPARISON_FAILED");
      checks.push({ name: pass, exitCode: result.exitCode, artifacts: retained });
      for (const viewport of Object.keys(viewports)) {
        const matches = retained.filter(({ path }) => path.endsWith(`/${viewport}-captured.png`));
        if (matches.length !== 1) fail("VISUAL_CAPTURE_MISSING");
        const content = await boundedRead(fs, passRoot, matches[0].path);
        validateImage(content, viewport);
        if (captures[viewport] && !Buffer.from(captures[viewport]).equals(content)) fail("VISUAL_REPRODUCTION_FAILED");
        captures[viewport] = content;
        if (pass === "candidate") {
          const path = `${snapshotDirectory}/home-${viewport}-chromium-linux.png`;
          // This target and file are solely owned by this disposable proof.
          await safePath(fs, project, path);
          await fs.writeFile(join(project, path), content);
          files.set(path, content);
        }
      }
    }
    return { images: captures, project: { request: prepared.request, sourceProject: prepared.sourceProject, targetProject: prepared.targetProject, files: expectedFiles, browser, build, rootIdentity: { device: String(identity.device), inode: String(identity.inode), birthtimeNanoseconds: String(identity.birthtimeNanoseconds) } }, influencingFingerprints: prepared.influencingFingerprints, checks };
  } catch (error) {
    if (await pathIdentityMatches(identity)) {
      const failureRoot = await safePath(fs, input.artifactDirectory, "failure", { directories: true });
      const artifacts = await retainBrowserArtifacts(fs, project, failureRoot);
      await writeExclusive(fs, failureRoot, "failure.json", json({ code: /^VISUAL_[A-Z_]+$/.test(error.message) ? error.message : "VISUAL_VERIFICATION_FAILED", checks, artifacts }));
    }
    throw error;
  } finally {
    if (!(await pathIdentityMatches(identity))) fail("VISUAL_ROOT_CHANGED");
    try {
      if (expectedFiles) for (const [path, content] of files) {
        if (!Buffer.from(await boundedRead(fs, project, path)).equals(content)) fail("VISUAL_PROJECT_CHANGED");
      }
    } finally {
      if (!(await cleanupOwnedDirectory(identity))) fail("VISUAL_CLEANUP_REFUSED");
    }
  }
}

const executeCase = executeAppTransitionVisualCase;

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.stdout.write(json(await verifyAppTransitionVisuals(parseAppTransitionVisualArguments(process.argv.slice(2)))));
  } catch (error) {
    process.stderr.write(json({ ok: false, code: /^VISUAL_[A-Z_]+$/.test(error.message) ? error.message : "VISUAL_VERIFICATION_FAILED", ...(error.writtenPaths ? { writtenPaths: error.writtenPaths } : {}) }));
    process.exitCode = 1;
  }
}
