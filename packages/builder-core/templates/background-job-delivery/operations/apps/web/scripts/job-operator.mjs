import { constants, lstatSync, readFileSync, realpathSync } from "node:fs";
import { lstat, open, link, rename, unlink, realpath } from "node:fs/promises";
import { dirname, extname, isAbsolute, relative, resolve, sep } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { registerHooks, stripTypeScriptTypes } from "node:module";
import { createHash, randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const maximumFileBytes = 1_048_576;
const fileNames = new Set(["inspection.json", "plan.json", "checkpoint.json", "audit.json"]);
const fail = (code) => { throw new Error(code); };
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");

async function noSymlinks(path) {
  if (!isAbsolute(path) || resolve(path) !== path) fail("job-private-path-invalid");
  let current = path;
  for (;;) {
    if ((await lstat(current)).isSymbolicLink()) fail("job-private-path-invalid");
    const parent = dirname(current); if (parent === current) return; current = parent;
  }
}
function privateFile(stat) {
  if (!stat.isFile() || stat.nlink !== 1 || (stat.mode & 0o077) !== 0 || stat.uid !== process.getuid() || stat.size > maximumFileBytes) fail("job-private-file-invalid");
}
export async function validatePrivatePaths(repositoryRoot, paths) {
  for (const path of paths) {
    await noSymlinks(path);
    const canonical = await realpath(path);
    if (canonical === repositoryRoot || canonical.startsWith(repositoryRoot + sep)) fail("job-private-path-invalid");
  }
}
export async function readPrivateJson(path) {
  await noSymlinks(path);
  const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    privateFile(await handle.stat());
    const buffer = Buffer.alloc(maximumFileBytes + 1);
    let length = 0;
    for (;;) {
      const { bytesRead } = await handle.read(buffer, length, buffer.length - length, null);
      length += bytesRead;
      if (length > maximumFileBytes) fail("job-private-file-invalid");
      if (!bytesRead) break;
    }
    return JSON.parse(buffer.subarray(0, length).toString("utf8"));
  } catch { return fail("job-private-file-invalid"); }
  finally { await handle.close(); }
}
export async function createPrivateStore(directory) {
  await noSymlinks(directory);
  const root = await realpath(directory); const identity = await lstat(root);
  if (!identity.isDirectory() || identity.uid !== process.getuid() || (identity.mode & 0o077) !== 0) fail("job-private-directory-invalid");
  async function guard() {
    const current = await lstat(root);
    if (current.isSymbolicLink() || current.dev !== identity.dev || current.ino !== identity.ino || (current.mode & 0o077) !== 0) fail("job-private-directory-invalid");
  }
  async function syncDirectory() { const handle = await open(root, constants.O_RDONLY | constants.O_DIRECTORY); try { await handle.sync(); } finally { await handle.close(); } }
  function path(name) { if (!fileNames.has(name)) fail("job-private-path-invalid"); return resolve(root, name); }
  return {
    async read(name) {
      await guard();
      try { await lstat(path(name)); } catch (error) { if (error.code === "ENOENT") return undefined; throw error; }
      return readPrivateJson(path(name));
    },
    async write(name, value, exclusive = false) {
      await guard(); const target = path(name); let before;
      try { before = await lstat(target); privateFile(before); } catch (error) { if (error.code !== "ENOENT") throw error; }
      if (before && exclusive) fail("job-private-file-exists");
      const bytes = JSON.stringify(value) + "\n";
      if (Buffer.byteLength(bytes) > maximumFileBytes) fail("job-private-file-invalid");
      const temporary = resolve(root, `.job-write-${randomUUID()}`);
      const handle = await open(temporary, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
      try { await handle.writeFile(bytes); await handle.sync(); }
      finally { await handle.close(); }
      try {
        await guard();
        if (before) {
          const current = await lstat(target); privateFile(current);
          if (current.dev !== before.dev || current.ino !== before.ino || current.size !== before.size || current.mtimeMs !== before.mtimeMs) fail("job-private-file-changed");
          await rename(temporary, target);
        } else {
          await link(temporary, target); await unlink(temporary);
        }
        await syncDirectory();
      } finally { await unlink(temporary).catch((error) => { if (error.code !== "ENOENT") throw error; }); }
    },
    async lock() {
      await guard(); const path = resolve(root, ".job-operator-lock");
      let handle;
      try { handle = await open(path, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600); }
      catch { return fail("job-run-locked"); }
      try { await handle.writeFile(JSON.stringify({ pid: process.pid })); await handle.sync(); await syncDirectory(); }
      catch { await handle.close(); return fail("job-checkpoint-unknown"); }
      const identity = await handle.stat();
      return async () => {
        await handle.close(); await guard(); const current = await lstat(path);
        if (current.dev !== identity.dev || current.ino !== identity.ino) fail("job-run-locked");
        await unlink(path); await syncDirectory();
      };
    },
  };
}

export function createCloudflareTransport({ scope, token, fetch: fetcher = globalThis.fetch, deadline, now = Date.now }) {
  if (typeof token !== "string" || !/^[a-zA-Z0-9_-]{10,4096}$/u.test(token)) fail("job-credential-invalid");
  const prefix = `https://api.cloudflare.com/client/v4/accounts/${scope.accountId}/queues/`;
  async function request(queueId, suffix, body) {
    if (![scope.primary.id, scope.deadLetter.id].includes(queueId) || !/^[a-f0-9]{32}$/u.test(scope.accountId) || !/^[a-f0-9]{32}$/u.test(queueId)) fail("job-resource-mismatch");
    const remaining = Math.min(10_000, deadline() - now());
    if (remaining <= 0) fail("job-operation-bounded");
    const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), remaining);
    try {
      const response = await fetcher(prefix + queueId + suffix, { method: body === undefined ? "GET" : "POST", redirect: "error",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, signal: controller.signal,
        ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      if (!response.ok || !response.body || (response.headers.get("content-length") !== null && Number(response.headers.get("content-length")) > maximumFileBytes)) fail("job-provider-unknown");
      const reader = response.body.getReader(); const chunks = []; let size = 0;
      try {
        for (;;) {
          const part = await reader.read(); if (part.done) break;
          size += part.value.byteLength;
          if (size > maximumFileBytes || now() >= deadline()) { await reader.cancel(); fail("job-provider-unknown"); }
          chunks.push(part.value);
        }
      } finally { reader.releaseLock(); }
      const result = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      if (result.success !== true || (result.errors !== undefined && (!Array.isArray(result.errors) || result.errors.length !== 0))) fail("job-provider-unknown");
      return result.result;
    } catch { return fail("job-provider-unknown"); }
    finally { clearTimeout(timeout); }
  }
  return {
    resource: (id) => request(id, ""),
    peek: async (maximum) => (await request(scope.deadLetter.id, "/messages/peek", { batch_size: maximum }))?.messages,
    send: async (envelope) => { await request(scope.primary.id, "/messages", { body: envelope, content_type: "json" }); },
    remove: async (ref) => {
      if (typeof ref !== "string" || !ref || ref.length > 4096) fail("job-selection-invalid");
      const result = await request(scope.deadLetter.id, "/messages/purge", { refs: [{ ref }] });
      if (result === null || typeof result !== "object" ||
        (result.errors !== undefined && (!Array.isArray(result.errors) || result.errors.length !== 0)) ||
        (result.warnings !== undefined && (result.warnings === null || typeof result.warnings !== "object" || Array.isArray(result.warnings) || Object.keys(result.warnings).length !== 0))) fail("job-provider-unknown");
    },
    metrics: () => request(scope.primary.id, "/metrics"),
  };
}

export async function runOperator({ request: input, context, policy, transport, store, now = Date.now,
  sleep = (milliseconds) => new Promise((done) => setTimeout(done, milliseconds)), interrupted = () => false, verifyCurrent = async () => {} }) {
  const request = policy.validateOperationRequest(input, context, now());
  const release = await store.lock();
  const startedAt = now(); let end = Math.min(startedAt + request.bounds.maxDurationMs, request.expiresAt);
  let calls = 0; let accepted = 0; let removed = 0; let history;
  function bounded() { if (interrupted() || now() >= end || calls >= request.bounds.maxRequests) fail("job-operation-bounded"); }
  async function call(action) { bounded(); calls += 1; return action(); }
  async function resources() {
    const primary = await call(() => transport.resource(request.scope.primary.id));
    const dead = await call(() => transport.resource(request.scope.deadLetter.id));
    policy.validateResources(request.scope, primary, dead);
  }
  async function audit(outcome, fingerprint, count = 0, messageHashes = []) {
    const result = { version: 1, outcome, fingerprint, startedAt, finishedAt: now(), counts: { selected: count, accepted, removed, requests: calls }, messageHashes };
    await store.write("audit.json", [...history, result]);
    return result;
  }
  try {
    history = await store.read("audit.json") ?? [];
    if (!Array.isArray(history) || history.length >= 128) fail("job-audit-full");
    let plan; let checkpoint;
    if (request.command === "replay") {
      plan = policy.validateReplayPlan(await store.read("plan.json"), request, context, now());
      end = Math.min(end, plan.expiresAt);
      const stored = await store.read("checkpoint.json");
      checkpoint = stored === undefined ? { version: 1, fingerprint: plan.fingerprint, complete: false,
        entries: plan.entries.map((entry) => ({ messageHash: policy.fingerprint(entry.messageId), stage: "prepared" })) } : policy.validateCheckpoint(stored, plan);
    }
    await resources();
    if (request.command === "inspect" || request.command === "plan-replay") {
      const messages = policy.validatePeek(await call(() => transport.peek(request.bounds.maxMessages)), request.bounds.maxMessages);
      if (request.command === "inspect") {
        await store.write("inspection.json", { version: 1, scope: request.scope, observedAt: now(), messages });
        return await audit("inspected", policy.fingerprint(request.scope), messages.length);
      }
      plan = policy.buildReplayPlan(request, messages, context.handlers, now());
      await store.write("plan.json", plan, true);
      return await audit("planned", plan.fingerprint, plan.entries.length);
    }
    if (request.command === "drain") {
      let outcome = "unknown"; let empty = 0;
      try {
        for (let index = 0; index < request.bounds.observations; index += 1) {
          const observation = policy.observation(await call(() => transport.metrics()));
          empty = observation === "empty" ? empty + 1 : 0;
          outcome = empty >= 2 ? "observed-quiescent" : "partial";
          if (index + 1 < request.bounds.observations) { bounded(); await sleep(request.bounds.intervalMs); }
        }
        await resources();
      } catch { outcome = "unknown"; }
      return await audit(outcome, policy.fingerprint(request.scope));
    }
    // All resumable state is durable before the first mutation. A started stage
    // after interruption is ambiguous; only human reconciliation can resolve it.
    let outcome = "partial";
    try {
      await store.write("checkpoint.json", checkpoint);
      for (let index = 0; index < plan.entries.length; index += 1) {
        const entry = plan.entries[index];
        if (checkpoint.entries[index].stage === "removed") continue;
        bounded();
        policy.validateReplayPlan(plan, request, context, now());
        await verifyCurrent(); await resources();
        async function advance(stage) {
          const next = { ...checkpoint, entries: checkpoint.entries.map((current, position) => position === index ? { ...current, stage } : current) };
          await store.write("checkpoint.json", next); checkpoint = next;
        }
        if (checkpoint.entries[index].stage === "prepared") {
          const messages = policy.validatePeek(await call(() => transport.peek(request.bounds.maxMessages)), request.bounds.maxMessages);
          const source = messages.find((item) => item.id === entry.messageId);
          if (!source || policy.fingerprint(source.body) !== entry.sourceDigest) fail("job-selection-stale");
          bounded();
          await advance("send-started");
          await call(() => transport.send(entry.envelope)); accepted += 1;
          await advance("send-accepted");
        }
        bounded();
        policy.validateReplayPlan(plan, request, context, now());
        await verifyCurrent(); await resources();
        bounded();
        await advance("removal-started");
        await call(() => transport.remove(entry.ref)); removed += 1;
        await advance("removed");
      }
      checkpoint = { ...checkpoint, complete: true };
      await store.write("checkpoint.json", checkpoint); outcome = "replayed";
    } catch (error) {
      const uncertain = checkpoint.entries.some((entry) => ["send-started", "removal-started"].includes(entry.stage));
      outcome = error.message === "job-operation-bounded" && !uncertain ? "partial" : "unknown";
    }
    return await audit(outcome, plan.fingerprint, plan.entries.length, checkpoint.entries.map((entry) => entry.messageHash));
  } finally { await release(); }
}

// Node's pinned native hooks support the application's @/ and extensionless
// TypeScript imports. No build output, second runner or handler replacement.
export async function loadApplication(root) {
  root = realpathSync(root);
  const files = new Map();
  const sourceRoot = resolve(root, "src") + sep;
  const hooks = registerHooks({
    resolve(specifier, context, next) {
      let target;
      if (specifier.startsWith("@/")) target = resolve(root, specifier.slice(2));
      else if (specifier.startsWith(".") && context.parentURL?.startsWith(pathToFileURL(sourceRoot).href)) target = fileURLToPath(new URL(specifier, context.parentURL));
      if (target !== undefined) {
        if (!target.startsWith(sourceRoot)) fail("job-registry-unsupported");
        if (!extname(target)) target += ".ts";
        if (realpathSync(target) !== target || !lstatSync(target).isFile()) fail("job-registry-unsupported");
        return next(pathToFileURL(target).href, context);
      }
      return next(specifier, context);
    },
    load(url, context, next) {
      if (url.startsWith(pathToFileURL(sourceRoot).href) && url.endsWith(".ts")) {
        const path = fileURLToPath(url); const bytes = readFileSync(path);
        if (bytes.length > maximumFileBytes || files.size > 256) fail("job-registry-unsupported");
        files.set(relative(root, path), digest(bytes));
        return { format: "module", shortCircuit: true, source: stripTypeScriptTypes(bytes.toString("utf8"), { mode: "strip" }) };
      }
      return next(url, context);
    },
  });
  try {
    const policy = await import(pathToFileURL(resolve(root, "src/infrastructure/cloudflare/job-operations.ts")).href);
    const { jobHandlers } = await import(pathToFileURL(resolve(root, "src/application/job-handlers.ts")).href);
    const registryDigest = policy.fingerprint([...files].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0));
    return { policy, handlers: jobHandlers, registryDigest, verifyFiles: () => {
      for (const [path, expected] of files) if (digest(readFileSync(resolve(root, path))) !== expected) fail("job-context-mismatch");
    } };
  } catch { return fail("job-registry-unsupported"); }
  finally { hooks.deregister(); }
}

async function main() {
  const output = process.stdout.write.bind(process.stdout); const errorOutput = process.stderr.write.bind(process.stderr);
  // Imported application validators may throw or log. Only fixed, bounded
  // operator evidence may leave the private execution boundary.
  process.stdout.write = process.stderr.write = () => true;
  let result;
  try {
    if (process.versions.node !== "22.23.2") fail("job-runtime-unsupported");
    const [command, requestFlag, requestPath, directoryFlag, directory, tokenFlag, tokenPath, ...extra] = process.argv.slice(2);
    if (!["inspect", "plan-replay", "replay", "drain"].includes(command) || requestFlag !== "--request" || directoryFlag !== "--directory" || tokenFlag !== "--token-file" || extra.length) fail("job-arguments-invalid");
    const root = realpathSync(process.cwd());
    const execute = promisify(execFile);
    const gitEnvironment = { PATH: process.env.PATH, HOME: "/nonexistent", GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: "/dev/null" };
    const git = async (args) => (await execute("git", args, { cwd: root, env: gitEnvironment, timeout: 10_000, maxBuffer: maximumFileBytes })).stdout.trim();
    const repositoryRoot = realpathSync(await git(["rev-parse", "--show-toplevel"]));
    await validatePrivatePaths(repositoryRoot, [directory, requestPath, tokenPath]);
    const request = await readPrivateJson(requestPath);
    if (request.command !== command || request.authorized !== true) fail("job-unauthorized");
    const revision = await git(["rev-parse", "HEAD"]);
    if (await git(["status", "--porcelain", "--untracked-files=all"])) fail("job-context-dirty");
    // Credentials are only read from the explicitly selected private token file;
    // application imports never inherit ambient provider credentials.
    for (const key of Object.keys(process.env)) delete process.env[key];
    const application = await loadApplication(root);
    const configuration = JSON.parse(readFileSync(resolve(root, "wrangler.jsonc"), "utf8"));
    const context = { ...application, revision, configuration };
    application.policy.validateOperationRequest(request, context, Date.now());
    const store = await createPrivateStore(directory);
    const planExpiresAt = request.command === "replay"
      ? application.policy.validateReplayPlan(await store.read("plan.json"), request, context, Date.now()).expiresAt : request.expiresAt;
    const credential = await readPrivateJson(tokenPath);
    if (Object.keys(credential).join() !== "token") fail("job-credential-invalid");
    const end = Math.min(Date.now() + request.bounds.maxDurationMs, request.expiresAt, planExpiresAt);
    const transport = createCloudflareTransport({ scope: request.scope, token: credential.token, deadline: () => end });
    let interrupted = false;
    const interrupt = () => { interrupted = true; };
    process.once("SIGINT", interrupt); process.once("SIGTERM", interrupt);
    try {
      result = await runOperator({ request, context, policy: application.policy, transport, store, interrupted: () => interrupted,
        verifyCurrent: async () => {
          application.verifyFiles();
          if (await git(["rev-parse", "HEAD"]) !== revision || await git(["status", "--porcelain", "--untracked-files=all"])) fail("job-context-mismatch");
        } });
    } finally { process.removeListener("SIGINT", interrupt); process.removeListener("SIGTERM", interrupt); }
    if (!["inspected", "planned", "replayed", "observed-quiescent"].includes(result.outcome)) process.exitCode = 1;
  } catch {
    process.exitCode = 1; result = { version: 1, outcome: "refused", code: "job-operator-refused" };
  } finally { process.stdout.write = output; process.stderr.write = errorOutput; }
  output(JSON.stringify(result) + "\n");
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) await main();
