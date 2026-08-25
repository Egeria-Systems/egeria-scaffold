import { execFile } from "node:child_process";
import { dirname, resolve } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import { runCertificationCli } from "./lib/certification-cli.mjs";
import {
  createIsolatedProcessEnvironment,
  isolatedProcessOptions,
} from "./lib/isolated-process.mjs";

const execFileAsync = promisify(execFile);
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const exactRevisionPattern = /^[a-f0-9]{40}$/u;
const commandTimeoutMilliseconds = 30 * 60 * 1000;
const compiledCliPattern =
  "^the compiled (?:plan-upgrade command plans both profiles without changing any byte|apply-upgrade command completes the exact portfolio and site transactions|plan-upgrade command refuses unsafe or unsupported repository states without writes|apply-upgrade command refuses the finite unsafe matrix without mutation)$";
const lifecycleChecks = Object.freeze([
  "compiled-plan-upgrade",
  "compiled-apply-upgrade",
  "already-current-refusal",
  "missing-edge-refusal",
  "verification-failure-prefix",
  "migration-before-state",
  "state-persistence-failure-prefix",
  "exact-final-state",
  "fresh-scaffold",
]);

export class StandardsLifecycleCertificationError extends Error {
  constructor(code) {
    super(`Standards lifecycle certification failed: ${code}`);
    this.name = "StandardsLifecycleCertificationError";
    this.code = code;
  }
}

function fail(code) {
  throw new StandardsLifecycleCertificationError(code);
}

async function readCurrentRevision() {
  try {
    const { stdout } = await execFileAsync(
      "git",
      ["rev-parse", "HEAD"],
      {
        cwd: repositoryRoot,
        env: createIsolatedProcessEnvironment(),
        timeout: 30_000,
        ...isolatedProcessOptions,
      },
    );
    const revision = stdout.trim();
    if (!exactRevisionPattern.test(revision)) fail("EVIDENCE_REVISION_INVALID");
    return revision;
  } catch (error) {
    if (error instanceof StandardsLifecycleCertificationError) throw error;
    fail("EVIDENCE_REVISION_UNAVAILABLE");
  }
}

async function runCommand(input) {
  await execFileAsync(input.executable, input.arguments, {
    cwd: input.cwd,
    env: input.environment,
    timeout: commandTimeoutMilliseconds,
    ...isolatedProcessOptions,
  });
}

function productionAdapters() {
  return { readCurrentRevision, runCommand };
}

function requireAdapters(adapters) {
  if (
    adapters === null ||
    typeof adapters !== "object" ||
    typeof adapters.readCurrentRevision !== "function" ||
    typeof adapters.runCommand !== "function"
  ) {
    fail("CERTIFICATION_ADAPTER_INVALID");
  }
}

async function requireRevision(revision, adapters) {
  let current;
  try {
    current = await adapters.readCurrentRevision();
  } catch (error) {
    if (error instanceof StandardsLifecycleCertificationError) throw error;
    fail("EVIDENCE_REVISION_UNAVAILABLE");
  }
  if (current !== revision) fail("EVIDENCE_REVISION_MISMATCH");
}

async function runEvidenceCommand(adapters, arguments_) {
  try {
    await adapters.runCommand({
      executable: process.execPath,
      arguments: [...arguments_],
      cwd: repositoryRoot,
      environment: createIsolatedProcessEnvironment(),
    });
  } catch {
    fail("LIFECYCLE_EVIDENCE_FAILED");
  }
}

export function certifyStandardsLifecycle(input = {}) {
  return certifyStandardsLifecycleForTesting(input, productionAdapters());
}

export async function certifyStandardsLifecycleForTesting(input = {}, adapters) {
  requireAdapters(adapters);
  const revision = input?.revision;
  if (!exactRevisionPattern.test(revision ?? "")) {
    fail("EVIDENCE_REVISION_INVALID");
  }

  await requireRevision(revision, adapters);
  await runEvidenceCommand(adapters, [
    "--test",
    "--test-name-pattern",
    compiledCliPattern,
    "apps/cli/tests/cli.test.mjs",
  ]);
  await runEvidenceCommand(adapters, [
    "scripts/certify-generated-testing.mjs",
  ]);
  await runEvidenceCommand(adapters, [
    "--test",
    "--test-name-pattern",
    "^standards capability upgrade ",
    "packages/builder-core/tests/apply-capability-upgrade.test.mjs",
  ]);
  await requireRevision(revision, adapters);

  return {
    ok: true,
    capability: "standards",
    version: "0.4.0",
    evidenceRevision: revision,
    profiles: ["portfolio", "site"],
    checks: [...lifecycleChecks],
  };
}

function parseArguments(arguments_) {
  const normalized = arguments_[0] === "--" ? arguments_.slice(1) : arguments_;
  if (
    normalized.length === 2 &&
    normalized[0] === "--revision" &&
    exactRevisionPattern.test(normalized[1] ?? "")
  ) {
    return { revision: normalized[1] };
  }
  return undefined;
}

await runCertificationCli({
  moduleUrl: import.meta.url,
  parseArguments,
  certify: certifyStandardsLifecycle,
  isCertificationError: (error) =>
    error instanceof StandardsLifecycleCertificationError,
});
