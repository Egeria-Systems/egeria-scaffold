import { execFile } from "node:child_process";
import { chmod, lstat, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath, pathToFileURL } from "node:url";

import { verifyGeneratedProject } from "./verify-generated-skeletons.mjs";

const execFileAsync = promisify(execFile);
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cliEntry = resolve(repositoryRoot, "apps/cli/dist/index.js");
const maximumOutputBytes = 1024 * 1024;
const commandTimeoutMilliseconds = 15 * 60 * 1000;
const defaultCalendlyUrl = "https://calendly.com/example/intro";
const expectedCapabilities = Object.freeze([
  "standards",
  "content-files",
  "section-composition",
  "deployment-cloudflare",
  "observability",
  "booking-calendly",
]);
const certificationChecks = Object.freeze([
  "compiled-cli-create",
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

function findEnvironmentValue(name) {
  const normalizedName = name.toLowerCase();
  return Object.entries(process.env).find(
    ([key, value]) =>
      key.toLowerCase() === normalizedName && value !== undefined,
  )?.[1];
}

function createChildEnvironment() {
  const environment = {};

  for (const key of ["PATH", "SystemRoot", "ComSpec", "PATHEXT", "LANG"]) {
    const value = findEnvironmentValue(key);
    if (value !== undefined) {
      environment[key] = value;
    }
  }
  if (process.platform === "darwin") {
    environment.__CF_USER_TEXT_ENCODING = "0x0:0x0:0x0";
  }

  return {
    ...environment,
    CI: "true",
    NEXT_TELEMETRY_DISABLED: "1",
  };
}

async function pathIdentityMatches(identity) {
  try {
    const stats = await lstat(identity.path, { bigint: true });
    return (
      !stats.isSymbolicLink() &&
      stats.isDirectory() &&
      stats.dev === identity.device &&
      stats.ino === identity.inode
    );
  } catch {
    return false;
  }
}

async function createOwnedDirectory() {
  const path = await mkdtemp(join(tmpdir(), "egeria-booking-certification-"));
  await chmod(path, 0o700);
  const stats = await lstat(path, { bigint: true });

  if (stats.isSymbolicLink() || !stats.isDirectory()) {
    fail("CERTIFICATION_SETUP_FAILED");
  }

  return { path, device: stats.dev, inode: stats.ino };
}

async function cleanupOwnedDirectory(identity) {
  if (!(await pathIdentityMatches(identity))) {
    return false;
  }

  try {
    await rm(identity.path, { recursive: true });
    return true;
  } catch {
    return false;
  }
}

async function defaultRunCommand(input) {
  const { stdout } = await execFileAsync(
    input.executable,
    [...input.arguments],
    {
      cwd: input.cwd,
      encoding: "utf8",
      env: input.environment,
      maxBuffer: maximumOutputBytes,
      shell: false,
      timeout: commandTimeoutMilliseconds,
      windowsHide: true,
    },
  );
  return stdout;
}

function parseCommandOutput(output, expectedCommand, failureCode) {
  if (typeof output !== "string") {
    fail(failureCode);
  }
  const lines = output.trimEnd().split("\n");
  if (lines.length !== 1 || lines[0] === "") {
    fail(failureCode);
  }

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
    if (error instanceof BookingCalendlyCertificationError) {
      throw error;
    }
    fail(failureCode);
  }
}

async function runCliCommand(adapters, arguments_, failureCode) {
  let output;
  try {
    output = await adapters.runCommand({
      executable: process.execPath,
      arguments: [cliEntry, ...arguments_],
      cwd: repositoryRoot,
      environment: createChildEnvironment(),
    });
  } catch {
    fail(failureCode);
  }

  return parseCommandOutput(output, arguments_[0], failureCode);
}

function arraysEqual(left, right) {
  return (
    Array.isArray(left) &&
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function requireCreateResult(value) {
  if (
    value.profile !== "portfolio" ||
    !arraysEqual(value.capabilities, expectedCapabilities)
  ) {
    fail("FRESH_SCAFFOLD_CREATE_INVALID");
  }
}

function requireInferenceResult(value) {
  const state = value.result?.state;
  const installedCapabilities = state?.value?.installedCapabilities;
  const capabilities = value.result?.capabilities;
  if (
    state?.kind !== "valid" ||
    !Array.isArray(installedCapabilities) ||
    !installedCapabilities.some(
      (capability) =>
        capability?.identifier === "booking-calendly" &&
        capability.version === "0.1.0",
    ) ||
    !Array.isArray(capabilities) ||
    !capabilities.some(
      (capability) =>
        capability?.identifier === "booking-calendly" &&
        capability.category === "confirmed",
    )
  ) {
    fail("FRESH_SCAFFOLD_INFERENCE_INVALID");
  }
}

function requireDoctorResult(value) {
  if (
    value.result?.healthy !== true ||
    !arraysEqual(value.result?.diagnostics, [])
  ) {
    fail("FRESH_SCAFFOLD_DIAGNOSTICS_INVALID");
  }
}

function requireDiffResult(value) {
  if (
    value.result?.equal !== true ||
    !arraysEqual(value.result?.differences, [])
  ) {
    fail("FRESH_SCAFFOLD_DIFF_INVALID");
  }
}

function requireAdapters(adapters) {
  if (
    adapters === null ||
    typeof adapters !== "object" ||
    typeof adapters.createOwner !== "function" ||
    typeof adapters.runCommand !== "function" ||
    typeof adapters.verifyProject !== "function"
  ) {
    fail("CERTIFICATION_ADAPTER_INVALID");
  }
}

export function certifyBookingCalendly(input = {}) {
  return certifyBookingCalendlyForTesting(input, {
    createOwner: createOwnedDirectory,
    runCommand: defaultRunCommand,
    verifyProject: verifyGeneratedProject,
  });
}

export async function certifyBookingCalendlyForTesting(input, adapters) {
  requireAdapters(adapters);
  const calendlyUrl = input?.calendlyUrl ?? defaultCalendlyUrl;
  let owner;
  try {
    owner = await adapters.createOwner();
  } catch (error) {
    if (error instanceof BookingCalendlyCertificationError) {
      throw error;
    }
    fail("CERTIFICATION_SETUP_FAILED");
  }
  if (!(await pathIdentityMatches(owner))) {
    fail("CERTIFICATION_SETUP_FAILED");
  }

  const projectRoot = join(owner.path, "project");
  let result;
  let pendingError;
  try {
    const create = await runCliCommand(
      adapters,
      [
        "create",
        "--profile",
        "portfolio",
        "--name",
        "acme-portfolio-calendly",
        "--display-name",
        "Acme Portfolio Booking",
        "--directory",
        projectRoot,
        "--calendly-url",
        calendlyUrl,
        "--calendly-mode",
        "popup",
      ],
      "FRESH_SCAFFOLD_CREATE_FAILED",
    );
    requireCreateResult(create);

    const infer = await runCliCommand(
      adapters,
      ["infer", "--directory", projectRoot],
      "FRESH_SCAFFOLD_INFERENCE_FAILED",
    );
    requireInferenceResult(infer);

    const doctor = await runCliCommand(
      adapters,
      ["doctor", "--directory", projectRoot],
      "FRESH_SCAFFOLD_DIAGNOSTICS_FAILED",
    );
    requireDoctorResult(doctor);

    const diff = await runCliCommand(
      adapters,
      ["diff", "--directory", projectRoot],
      "FRESH_SCAFFOLD_DIFF_FAILED",
    );
    requireDiffResult(diff);

    let generatedVerification;
    try {
      generatedVerification = await adapters.verifyProject(
        projectRoot,
        "portfolio-calendly",
      );
    } catch {
      fail("GENERATED_PROJECT_VERIFICATION_FAILED");
    }
    if (
      generatedVerification?.ok !== true ||
      !arraysEqual(generatedVerification.fixtures, ["portfolio-calendly"]) ||
      !arraysEqual(generatedVerification.profiles, ["portfolio"]) ||
      !Array.isArray(generatedVerification.checks)
    ) {
      fail("GENERATED_PROJECT_VERIFICATION_INVALID");
    }

    result = {
      ok: true,
      capability: "booking-calendly",
      version: "0.1.0",
      profile: "portfolio",
      mode: "popup",
      checks: [...certificationChecks, ...generatedVerification.checks],
    };
  } catch (error) {
    pendingError =
      error instanceof BookingCalendlyCertificationError
        ? error
        : new BookingCalendlyCertificationError("CERTIFICATION_FAILED");
  } finally {
    if (!(await cleanupOwnedDirectory(owner))) {
      pendingError = new BookingCalendlyCertificationError(
        "CERTIFICATION_CLEANUP_FAILED",
      );
    }
  }

  if (pendingError !== undefined) {
    throw pendingError;
  }
  return result;
}

function parseArguments(arguments_) {
  if (arguments_.length === 0) {
    return {};
  }
  if (arguments_.length === 2 && arguments_[0] === "--calendly-url") {
    return { calendlyUrl: arguments_[1] };
  }
  return undefined;
}

async function runMain() {
  const input = parseArguments(process.argv.slice(2));
  if (input === undefined) {
    process.stderr.write(
      `${JSON.stringify({
        ok: false,
        code: "CERTIFICATION_ARGUMENT_INVALID",
      })}\n`,
    );
    process.exitCode = 2;
    return;
  }

  try {
    const result = await certifyBookingCalendly(input);
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error) {
    process.stderr.write(
      `${JSON.stringify({
        ok: false,
        code:
          error instanceof BookingCalendlyCertificationError
            ? error.code
            : "CERTIFICATION_FAILED",
      })}\n`,
    );
    process.exitCode = 1;
  }
}

if (
  process.argv[1] !== undefined &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  await runMain();
}
