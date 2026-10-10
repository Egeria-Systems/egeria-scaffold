import {
  applyCapabilityAddition as applyCapabilityAdditionDefault,
  applyCapabilityRemoval as applyCapabilityRemovalDefault,
  applyCapabilityUpgrade as applyCapabilityUpgradeDefault,
  applyProfileTransition as applyProfileTransitionDefault,
  createApplicationEnvironmentRenderingContext,
  type ApplicationEnvironmentRenderingContext,
  createFileSystemRepositoryReader,
  createPnpmGeneratedProjectVerifier,
  readVerifiedProjectSnapshot,
  diffProject,
  doctorRepository,
  generateProject,
  inspectGitCreateTargets as inspectGitCreateTargetsDefault,
  inspectGitRepositoryInventory as inspectGitRepositoryInventoryDefault,
  inferRepository,
  inspectGitWorktree as inspectGitWorktreeDefault,
  planCapabilityAddition,
  planCapabilityRemoval,
  planCapabilityUpgrade,
  planProfileTransition as planProfileTransitionDefault,
  persistenceRemovalHumanReviewSchema,
  persistenceRemovalInputSchema,
  jobRemovalInputSchema,
  jobRemovalHumanReviewSchema,
  type JobRemovalInput,
  type JobRemovalHumanReview,
  type CapabilityAdditionPlan,
  type CapabilityAdditionExecutionResult,
  type CapabilityRemovalPlan,
  type CapabilityRemovalExecutionResult,
  type CapabilityRemovalPlanningFailureCode,
  type CapabilityUpgradeExecutionResult,
  type CapabilityUpgradePlan,
  type CapabilityUpgradePlanningFailureCode,
  type ProfileTransitionPlan,
  type AppProfileTransitionPlan,
  type ProfileTransitionExecutionResult,
  type ProfileTransitionPlanningFailureCode,
  type GeneratedProjectVerifier,
  type GitCreateTargetInspection,
  type GitRepositoryInventoryInspection,
  type GitWorktreeInspection,
  type PlanningFailureCode,
  type PersistenceRemovalHumanReview,
  type PersistenceRemovalInput,
  type RepositoryReader,
} from "@egeria-systems/builder-core";
import { constants } from "node:fs";
import { open } from "node:fs/promises";
import { resolve } from "node:path";

import { parseCliArguments, type ApplicationEnvironmentCliCommand, type CliCommand } from "./arguments.js";

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
  planProfileTransition?: typeof planProfileTransitionDefault;
  createReader?(root: string): RepositoryReader;
  inspectGitCreateTargets?(input: Readonly<{
    root: string;
    paths: readonly string[];
  }>): Promise<GitCreateTargetInspection>;
  inspectGitRepositoryInventory?(input: Parameters<
    typeof inspectGitRepositoryInventoryDefault
  >[0]): Promise<GitRepositoryInventoryInspection>;
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
  plan: ProfileTransitionPlan | AppProfileTransitionPlan;
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
    "CAPABILITY_REMOVAL_INVENTORY_INVALID",
    "CAPABILITY_REMOVAL_REFERENCE_CONFLICT",
    "CAPABILITY_REMOVAL_UNSUPPORTED",
    "JOB_REMOVAL_INPUT_INVALID",
    "JOB_REMOVAL_SUBJECT_UNAVAILABLE",
    "PERSISTENCE_REMOVAL_INPUT_INVALID",
    "PERSISTENCE_REMOVAL_SUBJECT_UNAVAILABLE",
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
    "PROFILE_TRANSITION_CONTENT_INVALID",
    "PROFILE_TRANSITION_EDGE_MISSING",
    "PROFILE_TRANSITION_SOURCE_UNSUPPORTED",
    "PROFILE_TRANSITION_UNSUPPORTED",
    "PROFILE_TRANSITION_VISUAL_EVIDENCE_REQUIRED",
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

async function readJsonInput(path: string): Promise<unknown> {
  const maximumBytes = 256 * 1024;
  const file = await open(
    resolve(path),
    constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
  );
  try {
    const metadata = await file.stat();
    if (!metadata.isFile() || metadata.size > maximumBytes) {
      throw new TypeError("invalid-json-input");
    }
    const buffer = Buffer.alloc(maximumBytes + 1);
    let length = 0;
    while (length < buffer.length) {
      const { bytesRead } = await file.read(
        buffer, length, buffer.length - length, length,
      );
      if (bytesRead === 0) break;
      length += bytesRead;
    }
    if (length > maximumBytes) throw new TypeError("invalid-json-input");
    return JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(buffer.subarray(0, length)),
    ) as unknown;
  } finally {
    await file.close();
  }
}

async function readRemovalInputs(
  command: Extract<CliCommand, Readonly<{ kind: "plan-remove" | "apply-remove" }>>,
): Promise<Readonly<{
  persistenceRemoval?: PersistenceRemovalInput;
  persistenceRemovalHumanReview?: PersistenceRemovalHumanReview;
  jobRemoval?: JobRemovalInput;
  jobRemovalHumanReview?: JobRemovalHumanReview;
}>> {
  return {
    ...(command.jobRemovalPath === undefined ? {} : {jobRemoval:jobRemovalInputSchema.parse(await readJsonInput(command.jobRemovalPath))}),
    ...(command.kind !== "apply-remove" || command.jobRemovalHumanReviewPath === undefined ? {} : {jobRemovalHumanReview:jobRemovalHumanReviewSchema.parse(await readJsonInput(command.jobRemovalHumanReviewPath))}),
    ...(command.persistenceRemovalPath === undefined ? {} : {
      persistenceRemoval: persistenceRemovalInputSchema.parse(
        await readJsonInput(command.persistenceRemovalPath),
      ),
    }),
    ...(command.kind !== "apply-remove" || command.persistenceRemovalHumanReviewPath === undefined ? {} : {
      persistenceRemovalHumanReview: persistenceRemovalHumanReviewSchema.parse(
        await readJsonInput(command.persistenceRemovalHumanReviewPath),
      ),
    }),
  };
}

function writeInvalidArguments(output: CliOutput): 2 {
  writeJson(output.writeError, { ok: false, code: "CLI_ARGUMENT_INVALID" });
  return 2;
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

function createRequest<C extends Extract<CliCommand | ApplicationEnvironmentCliCommand, { kind: "create" }>>(command: C): Omit<C, "kind" | "directory"> {
  const request = { ...command };
  Reflect.deleteProperty(request, "kind");
  Reflect.deleteProperty(request, "directory");
  return request;
}

async function runCreate(
  input: Readonly<{ command: Extract<CliCommand, { kind: "create" }>; renderingContext?: never }> |
    Readonly<{ command: Extract<ApplicationEnvironmentCliCommand, { kind: "create" }>; renderingContext: ApplicationEnvironmentRenderingContext }>,
  output: CliOutput,
  dependencies: CliRunnerDependencies,
): Promise<0 | 1> {
  const command = input.command;
  if (input.renderingContext !== undefined && (command.analytics !== undefined || command.bookingCalendly !== undefined || command.contactFormWeb3Forms !== undefined || command.applicationPersistence === true || command.transactionalEmailResend === true || command.backgroundJobDelivery === true)) {
    writeJson(output.writeError, { ok: false, command: "create", issues: [{ code: "APPLICATION_ENVIRONMENT_CAPABILITY_INCOMPLETE", path: ["request"], context: { reason: "incomplete-capability" } }] });
    return 1;
  }
  const destination = resolve(command.directory);
  const verifier = dependencies.createVerifier();
  const result = input.renderingContext === undefined
    ? await generateProject({ request: createRequest(input.command), destination, verifier })
    : await generateProject({ request: createRequest(input.command), destination, verifier, renderingContext: input.renderingContext });

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
  dependencies: CliRunnerDependencies,
  projectSchemaVersion?: "2.0.0",
): Promise<0 | 1> {
  try {
    const reader = (dependencies.createReader ??
      createCliRepositoryReader)(resolve(command.directory));
    const snapshot = projectSchemaVersion === "2.0.0"
      ? await readVerifiedProjectSnapshot(reader, createApplicationEnvironmentRenderingContext())
      : await readVerifiedProjectSnapshot(reader);
    if (!snapshot.ok) {
      writeJson(output.writeError, { ok: false, code: projectSchemaVersion === "2.0.0" ? "PROJECT_INSPECTION_INVALID" : "VERIFIED_CATALOG_INVALID" });
      return 1;
    }
    if (command.kind === "infer") {
      const request = { reader: snapshot.value.reader, catalog: snapshot.value.catalog };
      const result = projectSchemaVersion === "2.0.0"
        ? await inferRepository({ ...request, projectSchemaVersion: "2.0.0" })
        : await inferRepository(request);
      writeJson(output.write, { ok: true, command: "infer", result });
      return 0;
    }

    if (command.kind === "doctor") {
      const result = await doctorRepository({
        reader: snapshot.value.reader,
        catalog: snapshot.value.catalog,
        profiles: snapshot.value.profiles,
        ...(projectSchemaVersion === "2.0.0" ? { projectSchemaVersion } : {}),
      });
      writeJson(output.write, { ok: true, command: "doctor", result });
      return result.healthy ? 0 : 1;
    }

    const result = await diffProject({
      reader: snapshot.value.reader,
      catalog: snapshot.value.catalog,
      profiles: snapshot.value.profiles,
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

function writePlanRemoveRefusal(
  output: CliOutput,
  code: string,
  capability: Extract<CliCommand, Readonly<{ kind: "plan-remove" }>>["capability"],
  conflicts: readonly string[] = [],
): 1 {
  writeJson(output.writeError, {
    ok: false,
    command: "plan-remove",
    code,
    ...(code === "CAPABILITY_NOT_INSTALLED"
      ? { capability }
      : {}),
    ...(code === "CAPABILITY_REMOVAL_REFERENCE_CONFLICT" &&
    conflicts.length > 0
      ? { conflicts }
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
      ...(command.settings === undefined ? {} : { settings: command.settings }),
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
): Promise<0 | 1 | 2> {
  let persistenceInputs;
  try {
    persistenceInputs = await readRemovalInputs(command);
  } catch {
    return writeInvalidArguments(output);
  }
  const root = resolve(command.directory);
  const initialGit = await inspectForPlan(root, dependencies);

  if (!initialGit.ok) {
    return writePlanRemoveRefusal(output, initialGit.code, command.capability);
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
        ...persistenceInputs,
        inspectRepositoryInventory:
          dependencies.inspectGitRepositoryInventory ??
          inspectGitRepositoryInventoryDefault,
      }),
    };
  } catch {
    outcome = { kind: "failure", code: "REPOSITORY_OPEN_FAILED" };
  }

  const finalGit = await inspectForPlan(root, dependencies);

  if (!finalGit.ok) {
    return writePlanRemoveRefusal(output, finalGit.code, command.capability);
  }

  if (!sameGitIdentity(initialGit, finalGit)) {
    return writePlanRemoveRefusal(
      output,
      "GIT_WORKTREE_CHANGED",
      command.capability,
    );
  }

  if (outcome.kind === "failure") {
    return writePlanRemoveRefusal(output, outcome.code, command.capability);
  }

  if (!outcome.result.ok) {
    const code = outcome.result.issues[0]?.code;
    const conflicts = outcome.result.issues.flatMap((issue) => {
      const path = issue.path.length === 1 ? issue.path[0] : undefined;
      return typeof path === "string" ? [path] : [];
    });
    return writePlanRemoveRefusal(
      output,
      code !== undefined && isRemovalPlannerRefusalCode(code)
        ? code
        : "REPOSITORY_OPEN_FAILED",
      command.capability,
      conflicts,
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
      ...(command.settings === undefined ? {} : { settings: command.settings }),
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
): Promise<0 | 1 | 2> {
  let persistenceInputs;
  try {
    persistenceInputs = await readRemovalInputs(command);
  } catch {
    return writeInvalidArguments(output);
  }
  let result: CapabilityRemovalExecutionResult;
  try {
    result = await (
      dependencies.applyCapabilityRemoval ?? applyCapabilityRemovalDefault
    )({
      root: resolve(command.directory),
      capability: command.capability,
      ...persistenceInputs,
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
      ...(result.conflicts === undefined
        ? {}
        : { conflicts: result.conflicts }),
      ...(result.code === "CAPABILITY_NOT_INSTALLED"
        ? { capability: command.capability }
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
  projectSchemaVersion?: "2.0.0",
): CliRunner {
  return async (arguments_, output) => {
    if (projectSchemaVersion === "2.0.0") {
      const parsed = parseCliArguments(arguments_, "2.0.0");
      if (!parsed.ok) return writeInvalidArguments(output);
      if (parsed.value.kind !== "create") return runReadOnly(parsed.value, output, dependencies, "2.0.0");
      try {
        return await runCreate({ command: parsed.value, renderingContext: createApplicationEnvironmentRenderingContext() }, output, dependencies);
      } catch {
        writeJson(output.writeError, { ok: false, code: "PROJECT_GENERATION_FAILED" });
        return 1;
      }
    }
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
        return await runCreate({ command: parsed.value }, output, dependencies);
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

    return runReadOnly(parsed.value, output, dependencies);
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
