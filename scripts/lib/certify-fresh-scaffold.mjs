import { execFile } from "node:child_process";
import { chmod, mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import { verifyGeneratedProject } from "../verify-generated-skeletons.mjs";
import {
  cleanupOwnedDirectory,
  createIsolatedProcessEnvironment,
  isolatedProcessOptions,
  pathIdentityMatches,
  readPathIdentity,
} from "./isolated-process.mjs";

const execFileAsync = promisify(execFile);
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const cliEntry = resolve(repositoryRoot, "apps/cli/dist/index.js");
const commandTimeoutMilliseconds = 15 * 60 * 1000;
const certificationChecks = Object.freeze([
  "compiled-cli-create",
  "state-inference",
  "healthy-diagnostics",
  "exact-diff",
]);

function fail(configuration, code) {
  throw configuration.createError(code);
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

function parseCommandOutput(configuration, output, expectedCommand, failureCode) {
  if (typeof output !== "string") {
    fail(configuration, failureCode);
  }
  const lines = output.trimEnd().split("\n");
  if (lines.length !== 1 || lines[0] === "") {
    fail(configuration, failureCode);
  }

  try {
    const value = JSON.parse(lines[0]);
    if (
      value === null ||
      typeof value !== "object" ||
      value.ok !== true ||
      value.command !== expectedCommand
    ) {
      fail(configuration, failureCode);
    }
    return value;
  } catch (error) {
    if (configuration.isCertificationError(error)) {
      throw error;
    }
    fail(configuration, failureCode);
  }
}

async function runCliCommand(configuration, adapters, arguments_, failureCode) {
  let output;
  try {
    output = await adapters.runCommand({
      executable: process.execPath,
      arguments: [cliEntry, ...arguments_],
      cwd: repositoryRoot,
      environment: createIsolatedProcessEnvironment(),
    });
  } catch {
    fail(configuration, failureCode);
  }

  return parseCommandOutput(configuration, output, arguments_[0], failureCode);
}

function arraysEqual(left, right) {
  return (
    Array.isArray(left) &&
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function requireCreateResult(configuration, value) {
  if (
    value.profile !== configuration.profile ||
    !arraysEqual(value.capabilities, configuration.expectedCapabilities)
  ) {
    fail(configuration, "FRESH_SCAFFOLD_CREATE_INVALID");
  }
}

function requireInferenceResult(configuration, value) {
  const state = value.result?.state;
  const installedCapabilities = state?.value?.installedCapabilities;
  const capabilities = value.result?.capabilities;
  if (
    state?.kind !== "valid" ||
    !Array.isArray(installedCapabilities) ||
    !installedCapabilities.some(
      (capability) =>
        capability?.identifier === configuration.capabilityIdentifier &&
        capability.version === configuration.capabilityVersion,
    ) ||
    !Array.isArray(capabilities) ||
    !capabilities.some(
      (capability) =>
        capability?.identifier === configuration.capabilityIdentifier &&
        capability.category === "confirmed",
    )
  ) {
    fail(configuration, "FRESH_SCAFFOLD_INFERENCE_INVALID");
  }
}

function requireDoctorResult(configuration, value) {
  if (
    value.result?.healthy !== true ||
    !arraysEqual(value.result?.diagnostics, [])
  ) {
    fail(configuration, "FRESH_SCAFFOLD_DIAGNOSTICS_INVALID");
  }
}

function requireDiffResult(configuration, value) {
  if (
    value.result?.equal !== true ||
    !arraysEqual(value.result?.differences, [])
  ) {
    fail(configuration, "FRESH_SCAFFOLD_DIFF_INVALID");
  }
}

async function requireRecipeVersion(configuration, projectRoot) {
  if (configuration.expectedRecipeVersion === undefined) return;

  let source;
  try {
    source = await readFile(join(projectRoot, ".egeria/project.yaml"), "utf8");
  } catch {
    fail(configuration, "FRESH_SCAFFOLD_RECIPE_INVALID");
  }
  const recipeLines = source
    .split("\n")
    .filter((line) => line.startsWith("recipeVersion:"));
  if (
    recipeLines.length !== 1 ||
    recipeLines[0] !== `recipeVersion: ${configuration.expectedRecipeVersion}`
  ) {
    fail(configuration, "FRESH_SCAFFOLD_RECIPE_INVALID");
  }
}

function requireAdapters(configuration, adapters) {
  if (
    adapters === null ||
    typeof adapters !== "object" ||
    typeof adapters.runCommand !== "function" ||
    typeof adapters.verifyProject !== "function" ||
    (configuration.expectedFixtureChecks !== undefined &&
      typeof adapters.verifyFixture !== "function")
  ) {
    fail(configuration, "CERTIFICATION_ADAPTER_INVALID");
  }
}

function productionAdapters(verifyFixture) {
  return {
    runCommand: defaultRunCommand,
    verifyProject: verifyGeneratedProject,
    ...(verifyFixture === undefined ? {} : { verifyFixture }),
  };
}

async function createOwnedDirectory() {
  const path = await mkdtemp(
    join(tmpdir(), "egeria-fresh-scaffold-certification-"),
  );
  await chmod(path, 0o700);
  const identity = await readPathIdentity(path);

  if (identity.isSymbolicLink || !identity.isDirectory) {
    throw new Error("owned directory setup failed");
  }

  return {
    path: identity.path,
    device: identity.device,
    inode: identity.inode,
  };
}

export function certifyFreshScaffold(configuration, verifyFixture) {
  return certifyFreshScaffoldForTesting(
    configuration,
    productionAdapters(verifyFixture),
  );
}

export async function certifyFreshScaffoldForTesting(configuration, adapters) {
  requireAdapters(configuration, adapters);
  let owner;
  try {
    owner = await createOwnedDirectory();
  } catch {
    fail(configuration, "CERTIFICATION_SETUP_FAILED");
  }
  if (!(await pathIdentityMatches(owner))) {
    fail(configuration, "CERTIFICATION_SETUP_FAILED");
  }

  const projectRoot = join(owner.path, "project");
  let result;
  let pendingError;
  try {
    const create = await runCliCommand(
      configuration,
      adapters,
      [
        "create",
        "--profile",
        configuration.profile,
        "--name",
        configuration.projectName,
        "--display-name",
        configuration.displayName,
        "--directory",
        projectRoot,
        ...configuration.createArguments,
      ],
      "FRESH_SCAFFOLD_CREATE_FAILED",
    );
    requireCreateResult(configuration, create);

    const infer = await runCliCommand(
      configuration,
      adapters,
      ["infer", "--directory", projectRoot],
      "FRESH_SCAFFOLD_INFERENCE_FAILED",
    );
    requireInferenceResult(configuration, infer);

    const doctor = await runCliCommand(
      configuration,
      adapters,
      ["doctor", "--directory", projectRoot],
      "FRESH_SCAFFOLD_DIAGNOSTICS_FAILED",
    );
    requireDoctorResult(configuration, doctor);

    const diff = await runCliCommand(
      configuration,
      adapters,
      ["diff", "--directory", projectRoot],
      "FRESH_SCAFFOLD_DIFF_FAILED",
    );
    requireDiffResult(configuration, diff);

    await requireRecipeVersion(configuration, projectRoot);

    let generatedVerification;
    try {
      generatedVerification = await adapters.verifyProject(
        projectRoot,
        configuration.verifierIdentifier,
        configuration.projectName,
      );
    } catch {
      fail(configuration, "GENERATED_PROJECT_VERIFICATION_FAILED");
    }
    if (
      generatedVerification?.ok !== true ||
      !arraysEqual(generatedVerification.fixtures, [
        configuration.verifierIdentifier,
      ]) ||
      !arraysEqual(generatedVerification.profiles, [configuration.profile]) ||
      !Array.isArray(generatedVerification.checks) ||
      (configuration.expectedVerificationChecks !== undefined &&
        !arraysEqual(
          generatedVerification.checks,
          configuration.expectedVerificationChecks,
        ))
    ) {
      fail(configuration, "GENERATED_PROJECT_VERIFICATION_INVALID");
    }

    let fixtureVerification;
    if (configuration.expectedFixtureChecks !== undefined) {
      try {
        fixtureVerification = await adapters.verifyFixture({
          projectRoot,
          runCommand: adapters.runCommand,
          environment: createIsolatedProcessEnvironment(),
        });
      } catch (error) {
        if (configuration.isCertificationError(error)) throw error;
        fail(configuration, "CERTIFICATION_FIXTURE_VERIFICATION_FAILED");
      }
      if (
        fixtureVerification?.ok !== true ||
        !arraysEqual(
          fixtureVerification.checks,
          configuration.expectedFixtureChecks,
        )
      ) {
        fail(configuration, "CERTIFICATION_FIXTURE_VERIFICATION_INVALID");
      }
    }

    result = {
      ok: true,
      capability: configuration.capabilityIdentifier,
      version: configuration.capabilityVersion,
      profile: configuration.profile,
      ...configuration.receipt,
      checks: [
        ...certificationChecks,
        ...generatedVerification.checks,
        ...(fixtureVerification?.checks ?? []),
      ],
    };
  } catch (error) {
    pendingError = configuration.isCertificationError(error)
      ? error
      : configuration.createError("CERTIFICATION_FAILED");
  } finally {
    if (!(await cleanupOwnedDirectory(owner))) {
      pendingError = configuration.createError("CERTIFICATION_CLEANUP_FAILED");
    }
  }

  if (pendingError !== undefined) {
    throw pendingError;
  }
  return result;
}
