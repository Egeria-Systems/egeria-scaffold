import {
  applyCapabilityAddition as applyCapabilityAdditionDefault,
  createFileSystemRepositoryReader,
  createPnpmGeneratedProjectVerifier,
  createVerifiedCapabilityCatalog,
  diffProject,
  doctorRepository,
  generateProject,
  inspectGitCreateTargets as inspectGitCreateTargetsDefault,
  inferRepository,
  inspectGitWorktree as inspectGitWorktreeDefault,
  planCapabilityAddition,
  profileRecipes,
  type CapabilityAdditionPlan,
  type CapabilityAdditionExecutionResult,
  type GeneratedProjectVerifier,
  type GitCreateTargetInspection,
  type GitWorktreeInspection,
  type PlanningFailureCode,
  type RepositoryReader,
} from "@egeria-systems/builder-core";
import { resolve } from "node:path";

import { parseCliArguments, type CliCommand } from "./arguments.js";

export type CliOutput = Readonly<{
  write(value: string): void;
  writeError(value: string): void;
}>;

type CliRunnerDependencies = Readonly<{
  createVerifier(): GeneratedProjectVerifier;
  applyCapabilityAddition?(input: Parameters<
    typeof applyCapabilityAdditionDefault
  >[0]): Promise<CapabilityAdditionExecutionResult>;
  createReader?(root: string): RepositoryReader;
  inspectGitCreateTargets?(input: Readonly<{
    root: string;
    paths: readonly string[];
  }>): Promise<GitCreateTargetInspection>;
  inspectGitWorktree?(input: Readonly<{ root: string }>): Promise<GitWorktreeInspection>;
}>;

type CliRunner = (
  arguments_: readonly string[],
  output: CliOutput,
) => Promise<0 | 1 | 2>;

type PlanAddSuccess = Readonly<{
  ok: true;
  command: "plan-add";
  result: CapabilityAdditionPlan;
}>;

const plannerRefusalCodes = new Set<PlanningFailureCode>([
  "PROJECT_INSPECTION_INVALID",
  "PROJECT_DRIFT_DETECTED",
  "PROJECT_EJECTION_UNSUPPORTED",
  "CAPABILITY_ACTION_CONFLICT",
  "CAPABILITY_ALREADY_INSTALLED",
  "CAPABILITY_ADDITION_UNSUPPORTED",
]);

function isPlannerRefusalCode(code: string): code is PlanningFailureCode {
  return plannerRefusalCodes.has(code as PlanningFailureCode);
}

function writeJson(
  write: (value: string) => void,
  value: unknown,
): void {
  write(JSON.stringify(value));
}

function createCliRepositoryReader(root: string): RepositoryReader {
  const reader = createFileSystemRepositoryReader(root);

  return {
    async readText(path) {
      const result = await reader.readText(path);

      if (result.kind === "error" && result.code === "PATH_INVALID") {
        throw new TypeError("repository-open-failed");
      }

      return result;
    },
  };
}

async function runCreate(
  command: Extract<CliCommand, Readonly<{ kind: "create" }>>,
  output: CliOutput,
  dependencies: CliRunnerDependencies,
): Promise<0 | 1> {
  const result = await generateProject({
    request: {
      profile: command.profile,
      projectName: command.projectName,
      displayName: command.displayName,
      ...(command.bookingCalendly === undefined
        ? {}
        : { bookingCalendly: command.bookingCalendly }),
    },
    destination: resolve(command.directory),
    verifier: dependencies.createVerifier(),
  });

  if (!result.ok) {
    writeJson(output.writeError, {
      ok: false,
      command: "create",
      issues: result.issues,
    });
    return 1;
  }

  writeJson(output.write, {
    ok: true,
    command: "create",
    destination: result.value.destination,
    profile: command.profile,
    capabilities: result.value.state.installedCapabilities.map(
      ({ identifier }) => identifier,
    ),
  });
  return 0;
}

async function runReadOnly(
  command: Extract<CliCommand, Readonly<{ kind: "infer" | "doctor" | "diff" }>>,
  output: CliOutput,
  catalog: ReturnType<typeof createVerifiedCapabilityCatalog> & {
    ok: true;
  },
  dependencies: CliRunnerDependencies,
): Promise<0 | 1> {
  try {
    const reader = (dependencies.createReader ??
      createCliRepositoryReader)(resolve(command.directory));
    if (command.kind === "infer") {
      const result = await inferRepository({ reader, catalog: catalog.value });
      writeJson(output.write, { ok: true, command: "infer", result });
      return 0;
    }

    if (command.kind === "doctor") {
      const result = await doctorRepository({
        reader,
        catalog: catalog.value,
        profiles: profileRecipes,
      });
      writeJson(output.write, { ok: true, command: "doctor", result });
      return result.healthy ? 0 : 1;
    }

    const result = await diffProject({
      reader,
      catalog: catalog.value,
      profiles: profileRecipes,
    });
    writeJson(output.write, { ok: true, command: "diff", result });
    return result.equal ? 0 : 1;
  } catch {
    writeJson(output.writeError, {
      ok: false,
      code: "REPOSITORY_OPEN_FAILED",
    });
    return 1;
  }
}

function writePlanAddRefusal(output: CliOutput, code: string): 1 {
  writeJson(output.writeError, {
    ok: false,
    command: "plan-add",
    code,
  });
  return 1;
}

function sameGitIdentity(
  left: Extract<GitWorktreeInspection, Readonly<{ ok: true }>>,
  right: Extract<GitWorktreeInspection, Readonly<{ ok: true }>>,
): boolean {
  return (
    left.identity.root === right.identity.root &&
    left.identity.revision === right.identity.revision &&
    left.identity.attachedRef === right.identity.attachedRef &&
    left.identity.gitDirectory === right.identity.gitDirectory &&
    left.identity.commonDirectory === right.identity.commonDirectory
  );
}

async function inspectForPlan(
  root: string,
  dependencies: CliRunnerDependencies,
): Promise<GitWorktreeInspection> {
  try {
    return await (dependencies.inspectGitWorktree ?? inspectGitWorktreeDefault)({
      root,
    });
  } catch {
    return { ok: false, code: "GIT_WORKTREE_IDENTITY_INVALID" };
  }
}

async function inspectCreateTargetsForPlan(
  root: string,
  paths: readonly string[],
  dependencies: CliRunnerDependencies,
): Promise<GitCreateTargetInspection> {
  try {
    return await (
      dependencies.inspectGitCreateTargets ?? inspectGitCreateTargetsDefault
    )({ root, paths });
  } catch {
    return { ok: false, code: "GIT_WORKTREE_IDENTITY_INVALID" };
  }
}

async function runPlanAdd(
  command: Extract<CliCommand, Readonly<{ kind: "plan-add" }>>,
  output: CliOutput,
  dependencies: CliRunnerDependencies,
): Promise<0 | 1> {
  const root = resolve(command.directory);
  const initialGit = await inspectForPlan(root, dependencies);

  if (!initialGit.ok) {
    return writePlanAddRefusal(output, initialGit.code);
  }

  let result;

  try {
    const reader = (dependencies.createReader ?? createCliRepositoryReader)(root);
    result = await planCapabilityAddition({
      reader,
      git: initialGit,
      capability: command.capability,
      settings: command.settings,
    });
  } catch {
    return writePlanAddRefusal(output, "REPOSITORY_OPEN_FAILED");
  }

  if (!result.ok) {
    const code = result.issues[0]?.code;
    return writePlanAddRefusal(
      output,
      code !== undefined && isPlannerRefusalCode(code)
        ? code
        : "REPOSITORY_OPEN_FAILED",
    );
  }

  const createTargets = result.value.actions.flatMap((action) =>
    action.kind === "create-file" ? [action.path] : [],
  );
  const targetInspection = await inspectCreateTargetsForPlan(
    root,
    createTargets,
    dependencies,
  );

  if (!targetInspection.ok) {
    return writePlanAddRefusal(output, targetInspection.code);
  }

  const finalGit = await inspectForPlan(root, dependencies);

  if (!finalGit.ok) {
    return writePlanAddRefusal(output, finalGit.code);
  }

  if (!sameGitIdentity(initialGit, finalGit)) {
    return writePlanAddRefusal(output, "GIT_WORKTREE_CHANGED");
  }

  const success: PlanAddSuccess = {
    ok: true,
    command: "plan-add",
    result: result.value,
  };
  writeJson(output.write, success);
  return 0;
}

async function runApplyAdd(
  command: Extract<CliCommand, Readonly<{ kind: "apply-add" }>>,
  output: CliOutput,
  dependencies: CliRunnerDependencies,
): Promise<0 | 1> {
  let result: CapabilityAdditionExecutionResult;
  try {
    result = await (
      dependencies.applyCapabilityAddition ?? applyCapabilityAdditionDefault
    )({
      root: resolve(command.directory),
      capability: command.capability,
      settings: command.settings,
      approvedPlanFingerprint: command.approvedPlanFingerprint,
      verifier: dependencies.createVerifier(),
    });
  } catch {
    writeJson(output.writeError, {
      ok: false,
      command: "apply-add",
      code: "CAPABILITY_EXECUTION_FAILED",
      phase: "precondition",
      recovery: "not-required",
    });
    return 1;
  }

  if (!result.ok) {
    writeJson(output.writeError, {
      ok: false,
      command: "apply-add",
      code: result.code,
      phase: result.phase,
      recovery: result.recovery,
    });
    return 1;
  }

  writeJson(output.write, {
    ok: true,
    command: "apply-add",
    result: result.value,
  });
  return 0;
}

export function createCliRunner(
  dependencies: CliRunnerDependencies,
): CliRunner {
  return async (arguments_, output) => {
    const parsed = parseCliArguments(arguments_);

    if (!parsed.ok) {
      writeJson(output.writeError, {
        ok: false,
        code: "CLI_ARGUMENT_INVALID",
      });
      return 2;
    }

    if (parsed.value.kind === "create") {
      try {
        return await runCreate(parsed.value, output, dependencies);
      } catch {
        writeJson(output.writeError, {
          ok: false,
          code: "PROJECT_GENERATION_FAILED",
        });
        return 1;
      }
    }

    if (parsed.value.kind === "plan-add") {
      return runPlanAdd(parsed.value, output, dependencies);
    }

    if (parsed.value.kind === "apply-add") {
      return runApplyAdd(parsed.value, output, dependencies);
    }

    const catalog = createVerifiedCapabilityCatalog();
    if (!catalog.ok) {
      writeJson(output.writeError, {
        ok: false,
        code: "VERIFIED_CATALOG_INVALID",
      });
      return 1;
    }

    return runReadOnly(parsed.value, output, catalog, dependencies);
  };
}

const productionRunner = createCliRunner({
  createVerifier: () =>
    createPnpmGeneratedProjectVerifier({ pnpmExecutable: "pnpm" }),
});

export async function runCli(
  arguments_: readonly string[],
  output: CliOutput,
): Promise<0 | 1 | 2> {
  return productionRunner(arguments_, output);
}
