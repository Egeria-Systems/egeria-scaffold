import { execFile } from "node:child_process";
import { chmod, mkdir, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import { verifyGeneratedProject } from "./verify-generated-skeletons.mjs";
import { runCertificationCli } from "./lib/certification-cli.mjs";
import {
  cleanupOwnedDirectory,
  createIsolatedProcessEnvironment,
  isolatedProcessOptions,
  pathIdentityMatches,
  readPathIdentity,
} from "./lib/isolated-process.mjs";

const execFileAsync = promisify(execFile);
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cliEntry = resolve(repositoryRoot, "apps/cli/dist/index.js");
const defaultCalendlyUrl = "https://calendly.com/example/intro";
const commandTimeoutMilliseconds = 15 * 60 * 1000;
const projectName = "acme-portfolio-calendly";
const expectedBaseCapabilities = Object.freeze([
  "standards",
  "content-files",
  "section-composition",
  "deployment-cloudflare",
  "observability",
]);
const certificationChecks = Object.freeze([
  "compiled-cli-create-baseline",
  "clean-linked-worktree",
  "compiled-cli-plan-add",
  "compiled-cli-apply-add",
  "state-inference",
  "healthy-diagnostics",
  "exact-diff",
]);

export class BookingCalendlyCertificationError extends Error {
  constructor(code) {
    super(`Booking Calendly certification failed: ${code}`);
    this.name = "BookingCalendlyCertificationError";
    this.code = code;
  }
}

function fail(code) {
  throw new BookingCalendlyCertificationError(code);
}

function arraysEqual(left, right) {
  return (
    Array.isArray(left) &&
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

async function defaultRunCommand(input) {
  const { stdout } = await execFileAsync(
    input.executable,
    [...input.arguments],
    {
      cwd: input.cwd,
      env: input.environment,
      timeout: commandTimeoutMilliseconds,
      ...isolatedProcessOptions,
    },
  );
  return stdout;
}

function productionAdapters() {
  return {
    runCommand: defaultRunCommand,
    verifyProject: verifyGeneratedProject,
  };
}

function requireAdapters(adapters) {
  if (
    adapters === null ||
    typeof adapters !== "object" ||
    typeof adapters.runCommand !== "function" ||
    typeof adapters.verifyProject !== "function"
  ) {
    fail("CERTIFICATION_ADAPTER_INVALID");
  }
}

async function runCommand(adapters, executable, arguments_, failureCode) {
  try {
    const output = await adapters.runCommand({
      executable,
      arguments: [...arguments_],
      cwd: repositoryRoot,
      environment: createIsolatedProcessEnvironment(),
    });
    if (typeof output !== "string") fail(failureCode);
    return output;
  } catch (error) {
    if (error instanceof BookingCalendlyCertificationError) throw error;
    fail(failureCode);
  }
}

function parseCliOutput(output, expectedCommand, failureCode) {
  const lines = output.trimEnd().split("\n");
  if (lines.length !== 1 || lines[0] === "") fail(failureCode);

  try {
    const value = JSON.parse(lines[0]);
    if (
      value === null ||
      typeof value !== "object" ||
      value.ok !== true ||
      value.command !== expectedCommand
    ) {
      fail(failureCode);
    }
    return value;
  } catch (error) {
    if (error instanceof BookingCalendlyCertificationError) throw error;
    fail(failureCode);
  }
}

async function runCliCommand(adapters, arguments_, failureCode) {
  const output = await runCommand(
    adapters,
    process.execPath,
    [cliEntry, ...arguments_],
    failureCode,
  );
  return parseCliOutput(output, arguments_[0], failureCode);
}

async function runGitCommand(adapters, arguments_, failureCode) {
  await runCommand(adapters, "git", arguments_, failureCode);
}

async function createOwnedDirectory(outputRoot) {
  let path;
  if (outputRoot === undefined) {
    path = await mkdtemp(join(tmpdir(), "egeria-calendly-add-certification-"));
    await chmod(path, 0o700);
  } else {
    if (!isAbsolute(outputRoot)) fail("CERTIFICATION_OUTPUT_ROOT_INVALID");
    try {
      await mkdir(outputRoot, { mode: 0o700 });
      await chmod(outputRoot, 0o700);
    } catch {
      fail("CERTIFICATION_OUTPUT_ROOT_INVALID");
    }
    path = outputRoot;
  }

  const identity = await readPathIdentity(path);
  if (identity.isSymbolicLink || !identity.isDirectory) {
    fail("CERTIFICATION_SETUP_FAILED");
  }
  return {
    path: identity.path,
    device: identity.device,
    inode: identity.inode,
  };
}

function requireCreate(value) {
  if (
    value.profile !== "portfolio" ||
    !arraysEqual(value.capabilities, expectedBaseCapabilities)
  ) {
    fail("BASELINE_CREATE_INVALID");
  }
}

function requireAdditionPlan(value) {
  const plan = value.result;
  if (
    plan?.operation !== "add-capability" ||
    plan.status !== "approval-required" ||
    typeof plan.planFingerprint !== "string" ||
    !/^sha256:[a-f0-9]{64}$/u.test(plan.planFingerprint) ||
    plan.profile !== "portfolio" ||
    plan.capability?.identifier !== "booking-calendly" ||
    plan.capability.version !== "0.1.0"
  ) {
    fail("CAPABILITY_ADDITION_PLAN_INVALID");
  }
  return plan.planFingerprint;
}

function requireAddition(value) {
  const result = value.result;
  if (
    result?.status !== "verified-final-diff-approval-required" ||
    result.capability?.identifier !== "booking-calendly" ||
    result.capability.version !== "0.1.0" ||
    result.migration !== "add-booking-calendly-0-1-0"
  ) {
    fail("CAPABILITY_ADDITION_INVALID");
  }
}

function requireInference(value) {
  const installedCapabilities = value.result?.state?.value?.installedCapabilities;
  const inferredCapabilities = value.result?.capabilities;
  if (
    value.result?.state?.kind !== "valid" ||
    !Array.isArray(installedCapabilities) ||
    !installedCapabilities.some(
      ({ identifier, version }) =>
        identifier === "booking-calendly" && version === "0.1.0",
    ) ||
    !Array.isArray(inferredCapabilities) ||
    !inferredCapabilities.some(
      ({ identifier, category }) =>
        identifier === "booking-calendly" && category === "confirmed",
    )
  ) {
    fail("CAPABILITY_ADDITION_INFERENCE_INVALID");
  }
}

function requireDoctor(value) {
  if (
    value.result?.healthy !== true ||
    !arraysEqual(value.result?.diagnostics, [])
  ) {
    fail("CAPABILITY_ADDITION_DIAGNOSTICS_INVALID");
  }
}

function requireDiff(value) {
  if (
    value.result?.equal !== true ||
    !arraysEqual(value.result?.differences, [])
  ) {
    fail("CAPABILITY_ADDITION_DIFF_INVALID");
  }
}

function requireGeneratedVerification(value) {
  if (
    value?.ok !== true ||
    !arraysEqual(value.fixtures, ["portfolio-calendly"]) ||
    !arraysEqual(value.profiles, ["portfolio"]) ||
    !Array.isArray(value.checks)
  ) {
    fail("GENERATED_PROJECT_VERIFICATION_INVALID");
  }
}

async function createFreshAddedProject(input, adapters, owner) {
  const primaryRoot = join(owner.path, "primary");
  const projectRoot = join(owner.path, "project");

  const create = await runCliCommand(
    adapters,
    [
      "create",
      "--profile",
      "portfolio",
      "--name",
      projectName,
      "--display-name",
      "Acme Portfolio Booking",
      "--directory",
      primaryRoot,
    ],
    "BASELINE_CREATE_FAILED",
  );
  requireCreate(create);

  await runGitCommand(
    adapters,
    ["-C", primaryRoot, "init", "--initial-branch", "main"],
    "GIT_BASELINE_SETUP_FAILED",
  );
  await runGitCommand(
    adapters,
    ["-C", primaryRoot, "config", "user.name", "Egeria Certification"],
    "GIT_BASELINE_SETUP_FAILED",
  );
  await runGitCommand(
    adapters,
    [
      "-C",
      primaryRoot,
      "config",
      "user.email",
      "certification@example.invalid",
    ],
    "GIT_BASELINE_SETUP_FAILED",
  );
  await runGitCommand(
    adapters,
    ["-C", primaryRoot, "add", "--all"],
    "GIT_BASELINE_SETUP_FAILED",
  );
  await runGitCommand(
    adapters,
    ["-C", primaryRoot, "commit", "-m", "Create certification baseline"],
    "GIT_BASELINE_SETUP_FAILED",
  );
  await runGitCommand(
    adapters,
    [
      "-C",
      primaryRoot,
      "worktree",
      "add",
      "-b",
      "booking-calendly-certification-worktree",
      projectRoot,
    ],
    "GIT_LINKED_WORKTREE_FAILED",
  );

  const capabilityArguments = [
    "--directory",
    projectRoot,
    "--capability",
    "booking-calendly",
    "--calendly-url",
    input.calendlyUrl,
    "--calendly-mode",
    "popup",
  ];
  const plan = await runCliCommand(
    adapters,
    ["plan-add", ...capabilityArguments],
    "CAPABILITY_ADDITION_PLAN_FAILED",
  );
  const planFingerprint = requireAdditionPlan(plan);
  const addition = await runCliCommand(
    adapters,
    [
      "apply-add",
      ...capabilityArguments,
      "--approved-plan",
      planFingerprint,
    ],
    "CAPABILITY_ADDITION_FAILED",
  );
  requireAddition(addition);

  const inference = await runCliCommand(
    adapters,
    ["infer", "--directory", projectRoot],
    "CAPABILITY_ADDITION_INFERENCE_FAILED",
  );
  requireInference(inference);
  const doctor = await runCliCommand(
    adapters,
    ["doctor", "--directory", projectRoot],
    "CAPABILITY_ADDITION_DIAGNOSTICS_FAILED",
  );
  requireDoctor(doctor);
  const diff = await runCliCommand(
    adapters,
    ["diff", "--directory", projectRoot],
    "CAPABILITY_ADDITION_DIFF_FAILED",
  );
  requireDiff(diff);

  let generatedVerification;
  try {
    generatedVerification = await adapters.verifyProject(
      projectRoot,
      "portfolio-calendly",
      projectName,
    );
  } catch {
    fail("GENERATED_PROJECT_VERIFICATION_FAILED");
  }
  requireGeneratedVerification(generatedVerification);

  return generatedVerification.checks;
}

export function certifyBookingCalendly(input = {}) {
  return certifyBookingCalendlyForTesting(input, productionAdapters());
}

export async function certifyBookingCalendlyForTesting(input = {}, adapters) {
  requireAdapters(adapters);
  const calendlyUrl = input?.calendlyUrl ?? defaultCalendlyUrl;
  const outputRoot = input?.outputRoot;
  let owner;
  let succeeded = false;

  try {
    owner = await createOwnedDirectory(outputRoot);
    if (!(await pathIdentityMatches(owner))) fail("CERTIFICATION_SETUP_FAILED");
    const generatedChecks = await createFreshAddedProject(
      { calendlyUrl },
      adapters,
      owner,
    );
    succeeded = true;
    return {
      ok: true,
      capability: "booking-calendly",
      version: "0.1.0",
      profile: "portfolio",
      mode: "popup",
      ...(outputRoot === undefined ? {} : { retained: true }),
      checks: [...certificationChecks, ...generatedChecks],
    };
  } finally {
    if (owner !== undefined && (!succeeded || outputRoot === undefined)) {
      const cleaned = await cleanupOwnedDirectory(owner);
      if (!cleaned && succeeded) fail("CERTIFICATION_CLEANUP_FAILED");
    }
  }
}

function parseArguments(arguments_) {
  const normalizedArguments =
    arguments_[0] === "--" ? arguments_.slice(1) : arguments_;
  if (normalizedArguments.length === 0) return {};
  if (normalizedArguments.length % 2 !== 0) return undefined;

  const result = {};
  for (let index = 0; index < normalizedArguments.length; index += 2) {
    const name = normalizedArguments[index];
    const value = normalizedArguments[index + 1];
    if (value === undefined) return undefined;
    if (name === "--calendly-url" && result.calendlyUrl === undefined) {
      result.calendlyUrl = value;
      continue;
    }
    if (name === "--output-root" && result.outputRoot === undefined) {
      result.outputRoot = value;
      continue;
    }
    return undefined;
  }
  return result;
}

await runCertificationCli({
  moduleUrl: import.meta.url,
  parseArguments,
  certify: certifyBookingCalendly,
  isCertificationError: (error) =>
    error instanceof BookingCalendlyCertificationError,
});
