import {
  applyCapabilityAddition as applyCapabilityAdditionDefault,
  applyCapabilityRemoval as applyCapabilityRemovalDefault,
  applyCapabilityUpgrade as applyCapabilityUpgradeDefault,
  applyProfileTransition as applyProfileTransitionDefault,
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
  planCapabilityRemoval,
  planCapabilityUpgrade,
  planProfileTransition as planProfileTransitionDefault,
  profileRecipes,
  type CapabilityAdditionPlan,
  type CapabilityAdditionExecutionResult,
  type CapabilityRemovalPlan,
  type CapabilityRemovalExecutionResult,
  type CapabilityRemovalPlanningFailureCode,
  type CapabilityUpgradeExecutionResult,
  type CapabilityUpgradePlan,
  type CapabilityUpgradePlanningFailureCode,
  type ProfileTransitionPlan,
  type ProfileTransitionExecutionResult,
  type ProfileTransitionPlanningFailureCode,
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
  applyCapabilityRemoval?(input: Parameters<
    typeof applyCapabilityRemovalDefault
  >[0]): Promise<CapabilityRemovalExecutionResult>;
  applyCapabilityUpgrade?(input: Parameters<
    typeof applyCapabilityUpgradeDefault
  >[0]): Promise<CapabilityUpgradeExecutionResult>;
  applyProfileTransition?(input: Parameters<
    typeof applyProfileTransitionDefault
  >[0]): Promise<ProfileTransitionExecutionResult>;
  planProfileTransition?(input: Parameters<
    typeof planProfileTransitionDefault
  >[0]): ReturnType<typeof planProfileTransitionDefault>;
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

type PlanRemoveSuccess = Readonly<{
  ok: true;
  command: "plan-remove";
  plan: CapabilityRemovalPlan;
}>;

type PlanUpgradeSuccess = Readonly<{
  ok: true;
  command: "plan-upgrade";
  plan: CapabilityUpgradePlan;
}>;

type PlanProfileTransitionSuccess = Readonly<{
  ok: true;
  command: "plan-profile-transition";
  plan: ProfileTransitionPlan;
}>;

const plannerRefusalCodes = new Set<PlanningFailureCode>([
  "PROJECT_INSPECTION_INVALID",
  "PROJECT_DRIFT_DETECTED",
  "PROJECT_EJECTION_UNSUPPORTED",
  "CAPABILITY_ACTION_CONFLICT",
  "CAPABILITY_ALREADY_INSTALLED",
  "CAPABILITY_ADDITION_UNSUPPORTED",
]);

const removalPlannerRefusalCodes =
  new Set<CapabilityRemovalPlanningFailureCode>([
    "PROJECT_INSPECTION_INVALID",
    "PROJECT_DRIFT_DETECTED",
    "PROJECT_EJECTION_INVALID",
    "CAPABILITY_NOT_INSTALLED",
    "CAPABILITY_REMOVAL_UNSUPPORTED",
  ]);

const upgradePlannerRefusalCodes =
  new Set<CapabilityUpgradePlanningFailureCode>([
    "CAPABILITY_ACTION_CONFLICT",
    "CAPABILITY_ALREADY_CURRENT",
    "CAPABILITY_UPGRADE_EDGE_MISSING",
    "CAPABILITY_UPGRADE_UNSUPPORTED",
    "CAPABILITY_VERSION_AMBIGUOUS",
    "PROJECT_DRIFT_DETECTED",
    "PROJECT_EJECTION_UNSUPPORTED",
    "PROJECT_INSPECTION_INVALID",
    "PROJECT_STATE_INCOMPATIBLE",
  ]);

const profileTransitionPlannerRefusalCodes =
  new Set<ProfileTransitionPlanningFailureCode>([
    "PROFILE_ALREADY_CURRENT",
    "PROFILE_INFERENCE_AMBIGUOUS",
    "PROFILE_TRANSITION_ACTION_CONFLICT",
    "PROFILE_TRANSITION_EDGE_MISSING",
    "PROFILE_TRANSITION_SOURCE_UNSUPPORTED",
    "PROFILE_TRANSITION_UNSUPPORTED",
    "PROJECT_DRIFT_DETECTED",
    "PROJECT_EJECTION_UNSUPPORTED",
    "PROJECT_INSPECTION_INVALID",
    "PROJECT_STATE_INCOMPATIBLE",
  ]);

function isPlannerRefusalCode(code: string): code is PlanningFailureCode {
  return plannerRefusalCodes.has(code as PlanningFailureCode);
}

function isRemovalPlannerRefusalCode(
  code: string,
): code is CapabilityRemovalPlanningFailureCode {
  return removalPlannerRefusalCodes.has(
    code as CapabilityRemovalPlanningFailureCode,
  );
}

function isUpgradePlannerRefusalCode(
  code: string,
): code is CapabilityUpgradePlanningFailureCode {
  return upgradePlannerRefusalCodes.has(
    code as CapabilityUpgradePlanningFailureCode,
  );
}

function isProfileTransitionPlannerRefusalCode(
  code: string,
): code is ProfileTransitionPlanningFailureCode {
  return profileTransitionPlannerRefusalCodes.has(
    code as ProfileTransitionPlanningFailureCode,
  );
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
    ...(reader.readBytes === undefined
      ? {}
      : {
          async readBytes(path) {
            const result = await reader.readBytes?.(path);
            if (result === undefined) {
              throw new TypeError("repository-open-failed");
            }
            if (result.kind === "error" && result.code === "PATH_INVALID") {
              throw new TypeError("repository-open-failed");
            }
            return result;
          },
        }),
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

function writePlanRemoveRefusal(output: CliOutput, code: string): 1 {
  writeJson(output.writeError, {
    ok: false,
    command: "plan-remove",
    code,
    ...(code === "CAPABILITY_NOT_INSTALLED"
      ? { capability: "booking-calendly" }
      : {}),
  });
  return 1;
}

function writePlanUpgradeRefusal(output: CliOutput, code: string): 1 {
  writeJson(output.writeError, {
    ok: false,
    command: "plan-upgrade",
    code,
  });
  return 1;
}

function writePlanProfileTransitionRefusal(
  output: CliOutput,
  code: string,
): 1 {
  writeJson(output.writeError, {
    ok: false,
    command: "plan-profile-transition",
    code,
    recovery: "not-required",
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

async function runPlanRemove(
  command: Extract<CliCommand, Readonly<{ kind: "plan-remove" }>>,
  output: CliOutput,
  dependencies: CliRunnerDependencies,
): Promise<0 | 1> {
  const root = resolve(command.directory);
  const initialGit = await inspectForPlan(root, dependencies);

  if (!initialGit.ok) {
    return writePlanRemoveRefusal(output, initialGit.code);
  }

  let outcome:
    | Readonly<{
        kind: "result";
        result: Awaited<ReturnType<typeof planCapabilityRemoval>>;
      }>
    | Readonly<{ kind: "failure"; code: "REPOSITORY_OPEN_FAILED" }>;

  try {
    const reader = (dependencies.createReader ?? createCliRepositoryReader)(root);
    outcome = {
      kind: "result",
      result: await planCapabilityRemoval({
        reader,
        git: initialGit,
        capability: command.capability,
      }),
    };
  } catch {
    outcome = { kind: "failure", code: "REPOSITORY_OPEN_FAILED" };
  }

  const finalGit = await inspectForPlan(root, dependencies);

  if (!finalGit.ok) {
    return writePlanRemoveRefusal(output, finalGit.code);
  }

  if (!sameGitIdentity(initialGit, finalGit)) {
    return writePlanRemoveRefusal(output, "GIT_WORKTREE_CHANGED");
  }

  if (outcome.kind === "failure") {
    return writePlanRemoveRefusal(output, outcome.code);
  }

  if (!outcome.result.ok) {
    const code = outcome.result.issues[0]?.code;
    return writePlanRemoveRefusal(
      output,
      code !== undefined && isRemovalPlannerRefusalCode(code)
        ? code
        : "REPOSITORY_OPEN_FAILED",
    );
  }

  const success: PlanRemoveSuccess = {
    ok: true,
    command: "plan-remove",
    plan: outcome.result.value,
  };
  writeJson(output.write, success);
  return 0;
}

async function runPlanUpgrade(
  command: Extract<CliCommand, Readonly<{ kind: "plan-upgrade" }>>,
  output: CliOutput,
  dependencies: CliRunnerDependencies,
): Promise<0 | 1> {
  const root = resolve(command.directory);
  const initialGit = await inspectForPlan(root, dependencies);

  if (!initialGit.ok) {
    return writePlanUpgradeRefusal(output, initialGit.code);
  }

  let outcome:
    | Readonly<{
        kind: "result";
        result: Awaited<ReturnType<typeof planCapabilityUpgrade>>;
      }>
    | Readonly<{ kind: "failure"; code: "REPOSITORY_OPEN_FAILED" }>;

  try {
    const reader = (dependencies.createReader ?? createCliRepositoryReader)(root);
    outcome = {
      kind: "result",
      result: await planCapabilityUpgrade({
        reader,
        git: initialGit,
        capability: command.capability,
        toVersion: command.toVersion,
      }),
    };
  } catch {
    outcome = { kind: "failure", code: "REPOSITORY_OPEN_FAILED" };
  }

  let targetFailure: string | undefined;
  if (outcome.kind === "result" && outcome.result.ok) {
    const createTargets = outcome.result.value.actions.flatMap((action) =>
      action.kind === "create-file" ? [action.path] : [],
    );
    const targetInspection = await inspectCreateTargetsForPlan(
      root,
      createTargets,
      dependencies,
    );

    if (!targetInspection.ok) {
      targetFailure = targetInspection.code;
    }
  }

  const finalGit = await inspectForPlan(root, dependencies);

  if (!finalGit.ok) {
    return writePlanUpgradeRefusal(output, finalGit.code);
  }

  if (!sameGitIdentity(initialGit, finalGit)) {
    return writePlanUpgradeRefusal(output, "GIT_WORKTREE_CHANGED");
  }

  if (targetFailure !== undefined) {
    return writePlanUpgradeRefusal(output, targetFailure);
  }

  if (outcome.kind === "failure") {
    return writePlanUpgradeRefusal(output, outcome.code);
  }

  if (!outcome.result.ok) {
    const code = outcome.result.issues[0]?.code;
    return writePlanUpgradeRefusal(
      output,
      code !== undefined && isUpgradePlannerRefusalCode(code)
        ? code
        : "REPOSITORY_OPEN_FAILED",
    );
  }

  const success: PlanUpgradeSuccess = {
    ok: true,
    command: "plan-upgrade",
    plan: outcome.result.value,
  };
  writeJson(output.write, success);
  return 0;
}

async function runPlanProfileTransition(
  command: Extract<
    CliCommand,
    Readonly<{ kind: "plan-profile-transition" }>
  >,
  output: CliOutput,
  dependencies: CliRunnerDependencies,
): Promise<0 | 1> {
  const root = resolve(command.directory);
  const initialGit = await inspectForPlan(root, dependencies);

  if (!initialGit.ok) {
    return writePlanProfileTransitionRefusal(output, initialGit.code);
  }

  let outcome:
    | Readonly<{
        kind: "result";
        result: Awaited<ReturnType<typeof planProfileTransitionDefault>>;
      }>
    | Readonly<{ kind: "failure"; code: "REPOSITORY_OPEN_FAILED" }>;

  try {
    const reader = (dependencies.createReader ?? createCliRepositoryReader)(root);
    outcome = {
      kind: "result",
      result: await (
        dependencies.planProfileTransition ?? planProfileTransitionDefault
      )({
        reader,
        git: initialGit,
        toProfile: command.toProfile,
      }),
    };
  } catch {
    outcome = { kind: "failure", code: "REPOSITORY_OPEN_FAILED" };
  }

  let targetFailure: string | undefined;
  if (outcome.kind === "result" && outcome.result.ok) {
    const createTargets = outcome.result.value.actions.flatMap((action) =>
      action.kind === "create-file" ? [action.path] : [],
    );
    const targetInspection = await inspectCreateTargetsForPlan(
      root,
      createTargets,
      dependencies,
    );
    if (!targetInspection.ok) {
      targetFailure =
        targetInspection.code === "CAPABILITY_ACTION_CONFLICT"
          ? "PROFILE_TRANSITION_ACTION_CONFLICT"
          : targetInspection.code;
    }
  }

  const finalGit = await inspectForPlan(root, dependencies);
  if (!finalGit.ok) {
    return writePlanProfileTransitionRefusal(output, finalGit.code);
  }
  if (!sameGitIdentity(initialGit, finalGit)) {
    return writePlanProfileTransitionRefusal(output, "GIT_WORKTREE_CHANGED");
  }
  if (targetFailure !== undefined) {
    return writePlanProfileTransitionRefusal(output, targetFailure);
  }
  if (outcome.kind === "failure") {
    return writePlanProfileTransitionRefusal(output, outcome.code);
  }
  if (!outcome.result.ok) {
    const code = outcome.result.issues[0]?.code;
    return writePlanProfileTransitionRefusal(
      output,
      code !== undefined && isProfileTransitionPlannerRefusalCode(code)
        ? code
        : "REPOSITORY_OPEN_FAILED",
    );
  }

  const success: PlanProfileTransitionSuccess = {
    ok: true,
    command: "plan-profile-transition",
    plan: outcome.result.value,
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
      recovery: "inspect-worktree",
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

async function runApplyRemove(
  command: Extract<CliCommand, Readonly<{ kind: "apply-remove" }>>,
  output: CliOutput,
  dependencies: CliRunnerDependencies,
): Promise<0 | 1> {
  let result: CapabilityRemovalExecutionResult;
  try {
    result = await (
      dependencies.applyCapabilityRemoval ?? applyCapabilityRemovalDefault
    )({
      root: resolve(command.directory),
      capability: command.capability,
      approvedPlanFingerprint: command.approvedPlanFingerprint,
      verifier: dependencies.createVerifier(),
    });
  } catch {
    writeJson(output.writeError, {
      ok: false,
      command: "apply-remove",
      code: "CAPABILITY_EXECUTION_FAILED",
      phase: "precondition",
      recovery: "inspect-worktree",
    });
    return 1;
  }

  if (!result.ok) {
    writeJson(output.writeError, {
      ok: false,
      command: "apply-remove",
      code: result.code,
      ...(result.code === "CAPABILITY_NOT_INSTALLED"
        ? { capability: "booking-calendly" }
        : { phase: result.phase, recovery: result.recovery }),
    });
    return 1;
  }

  writeJson(output.write, {
    ok: true,
    command: "apply-remove",
    result: result.value,
  });
  return 0;
}

async function runApplyUpgrade(
  command: Extract<CliCommand, Readonly<{ kind: "apply-upgrade" }>>,
  output: CliOutput,
  dependencies: CliRunnerDependencies,
): Promise<0 | 1> {
  let result: CapabilityUpgradeExecutionResult;
  try {
    result = await (
      dependencies.applyCapabilityUpgrade ?? applyCapabilityUpgradeDefault
    )({
      root: resolve(command.directory),
      capability: command.capability,
      toVersion: command.toVersion,
      approvedPlanFingerprint: command.approvedPlanFingerprint,
      verifier: dependencies.createVerifier(),
    });
  } catch {
    writeJson(output.writeError, {
      ok: false,
      command: "apply-upgrade",
      code: "CAPABILITY_EXECUTION_FAILED",
      phase: "precondition",
      recovery: "inspect-worktree",
    });
    return 1;
  }

  if (!result.ok) {
    writeJson(output.writeError, {
      ok: false,
      command: "apply-upgrade",
      code: result.code,
      phase: result.phase,
      recovery: result.recovery,
    });
    return 1;
  }

  writeJson(output.write, {
    ok: true,
    command: "apply-upgrade",
    result: result.value,
  });
  return 0;
}

async function runApplyProfileTransition(
  command: Extract<
    CliCommand,
    Readonly<{ kind: "apply-profile-transition" }>
  >,
  output: CliOutput,
  dependencies: CliRunnerDependencies,
): Promise<0 | 1> {
  let result: ProfileTransitionExecutionResult;
  try {
    result = await (
      dependencies.applyProfileTransition ?? applyProfileTransitionDefault
    )({
      root: resolve(command.directory),
      toProfile: command.toProfile,
      approvedPlanFingerprint: command.approvedPlanFingerprint,
      verifier: dependencies.createVerifier(),
    });
  } catch {
    writeJson(output.writeError, {
      ok: false,
      command: "apply-profile-transition",
      code: "PROFILE_TRANSITION_EXECUTION_FAILED",
      phase: "precondition",
      recovery: "inspect-worktree",
    });
    return 1;
  }

  if (!result.ok) {
    writeJson(output.writeError, {
      ok: false,
      command: "apply-profile-transition",
      code: result.code,
      phase: result.phase,
      recovery: result.recovery,
    });
    return 1;
  }

  writeJson(output.write, {
    ok: true,
    command: "apply-profile-transition",
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
      writeJson(
        output.writeError,
        arguments_[0] === "plan-profile-transition" ||
          arguments_[0] === "apply-profile-transition"
          ? {
              ok: false,
              command: arguments_[0],
              code: "CLI_ARGUMENT_INVALID",
              recovery: "not-required",
            }
          : {
              ok: false,
              code: "CLI_ARGUMENT_INVALID",
            },
      );
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

    if (parsed.value.kind === "plan-remove") {
      return runPlanRemove(parsed.value, output, dependencies);
    }

    if (parsed.value.kind === "plan-upgrade") {
      return runPlanUpgrade(parsed.value, output, dependencies);
    }

    if (parsed.value.kind === "plan-profile-transition") {
      return runPlanProfileTransition(parsed.value, output, dependencies);
    }

    if (parsed.value.kind === "apply-add") {
      return runApplyAdd(parsed.value, output, dependencies);
    }

    if (parsed.value.kind === "apply-remove") {
      return runApplyRemove(parsed.value, output, dependencies);
    }

    if (parsed.value.kind === "apply-upgrade") {
      return runApplyUpgrade(parsed.value, output, dependencies);
    }

    if (parsed.value.kind === "apply-profile-transition") {
      return runApplyProfileTransition(parsed.value, output, dependencies);
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
