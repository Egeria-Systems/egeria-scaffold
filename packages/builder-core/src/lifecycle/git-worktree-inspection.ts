import { execFile } from "node:child_process";
import { lstat } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { TextDecoder } from "node:util";

import { safeRelativePathSchema } from "../contracts/identifiers.js";

const commandTimeoutMilliseconds = 10_000;
const maximumCommandOutputBytes = 1024 * 1024;
const maximumIdentityBytes = 64 * 1024;
const fixedGlobalOptions = [
  "--no-optional-locks",
  "--no-replace-objects",
  "--no-lazy-fetch",
  "-c",
  "core.fsmonitor=false",
  "-c",
  "core.untrackedCache=false",
] as const;
const operationMarkers = [
  "MERGE_HEAD",
  "rebase-merge",
  "rebase-apply",
  "REVERT_HEAD",
  "CHERRY_PICK_HEAD",
  "sequencer",
] as const;
const validStatusBytes = new Set([
  0x20, 0x4d, 0x54, 0x41, 0x44, 0x52, 0x43, 0x55, 0x3f, 0x21,
]);
const unmergedStatuses = new Set(["DD", "AU", "UD", "UA", "DU", "AA", "UU"]);

export type GitCommandResult = Readonly<{
  exitCode: number;
  stdout: Uint8Array;
}>;

export type GitCommandRunner = (
  root: string,
  arguments_: readonly string[],
) => Promise<GitCommandResult>;

export type GitProcessRequest = Readonly<{
  executable: "git";
  arguments: readonly string[];
  options: Readonly<{
    cwd: string;
    shell: false;
    timeout: number;
    maxBuffer: number;
    windowsHide: true;
    encoding: "buffer";
    env: Readonly<Record<string, string>>;
  }>;
}>;

export type GitProcessExecutor = (
  request: GitProcessRequest,
) => Promise<GitCommandResult>;

export type GitExecFile = (
  executable: string,
  arguments_: readonly string[],
  options: GitProcessRequest["options"],
  callback: (
    error: Readonly<{
      code?: string | number | null;
      killed?: boolean;
      signal?: string | null;
    }> | null,
    stdout: string | Uint8Array,
    stderr: string | Uint8Array,
  ) => void,
) => unknown;

export type GitSourceEnvironment = Readonly<
  Record<string, string | undefined>
>;

export type GitMetadataReader = (
  path: string,
) => Promise<"missing" | "present" | "symlink" | "error">;

export type GitWorktreeRefusalCode =
  | "GIT_REPOSITORY_REQUIRED"
  | "GIT_WORKTREE_IDENTITY_INVALID"
  | "GIT_WORKTREE_NOT_ISOLATED"
  | "GIT_BRANCH_REQUIRED"
  | "GIT_OPERATION_IN_PROGRESS"
  | "GIT_WORKTREE_CONFLICTED"
  | "GIT_WORKTREE_DIRTY"
  | "GIT_WORKTREE_CHANGED";

export type GitWorktreeIdentity = Readonly<{
  root: string;
  revision: string;
  attachedRef: string;
  gitDirectory: string;
  commonDirectory: string;
}>;

export type GitWorktreeInspection =
  | Readonly<{
      ok: true;
      identity: GitWorktreeIdentity;
    }>
  | Readonly<{ ok: false; code: GitWorktreeRefusalCode }>;

export type GitCreateTargetInspection =
  | Readonly<{ ok: true }>
  | Readonly<{
      ok: false;
      code: "CAPABILITY_ACTION_CONFLICT" | "GIT_WORKTREE_IDENTITY_INVALID";
    }>;

export type GitExpectedChangesInspection =
  | Readonly<{ ok: true }>
  | Readonly<{ ok: false; code: GitWorktreeRefusalCode }>;

class GitProcessFailure extends Error {
  constructor() {
    super("GIT_PROCESS_FAILED");
    this.name = "GitProcessFailure";
  }
}

function copyOutput(stdout: string | Uint8Array): Uint8Array {
  if (!(stdout instanceof Uint8Array)) {
    throw new GitProcessFailure();
  }

  return new Uint8Array(stdout);
}

export function createGitProcessExecutor(
  executeFile: GitExecFile = execFile,
): GitProcessExecutor {
  return (request) =>
    new Promise((resolvePromise, rejectPromise) => {
      executeFile(
        request.executable,
        [...request.arguments],
        request.options,
        (error, stdout) => {
          try {
            const output = copyOutput(stdout);

            if (error === null) {
              resolvePromise({ exitCode: 0, stdout: output });
              return;
            }

            const exitCode = error.code;

            if (
              typeof exitCode === "number" &&
              error.killed !== true &&
              (error.signal === null || error.signal === undefined)
            ) {
              resolvePromise({ exitCode, stdout: output });
              return;
            }
          } catch {
            // The stable process failure below intentionally contains no child output.
          }

          rejectPromise(new GitProcessFailure());
        },
      );
    });
}

function readPlatformVariable(
  sourceEnvironment: GitSourceEnvironment,
  name: string,
): string | undefined {
  const exactValue = sourceEnvironment[name];

  if (typeof exactValue === "string") {
    return exactValue;
  }

  const matchingKey = Object.keys(sourceEnvironment).find(
    (key) => key.toLowerCase() === name.toLowerCase(),
  );
  const matchingValue =
    matchingKey === undefined ? undefined : sourceEnvironment[matchingKey];
  return typeof matchingValue === "string" ? matchingValue : undefined;
}

function createGitEnvironment(
  sourceEnvironment: GitSourceEnvironment,
  platform: string,
): Readonly<Record<string, string>> {
  const environment: Record<string, string> = {};
  const path = readPlatformVariable(sourceEnvironment, "PATH");

  if (path !== undefined) {
    environment.PATH = path;
  }

  if (platform === "win32") {
    for (const name of ["SystemRoot", "WINDIR", "ComSpec", "PATHEXT"] as const) {
      const value = readPlatformVariable(sourceEnvironment, name);

      if (value !== undefined) {
        environment[name] = value;
      }
    }
  }

  environment.GIT_OPTIONAL_LOCKS = "0";
  environment.GIT_NO_LAZY_FETCH = "1";
  environment.GIT_CONFIG_NOSYSTEM = "1";
  environment.GIT_CONFIG_GLOBAL = platform === "win32" ? "NUL" : "/dev/null";
  environment.LC_ALL = "C";
  return environment;
}

export function createGitCommandRunner(
  input: Readonly<{
    execute?: GitProcessExecutor;
    sourceEnvironment?: GitSourceEnvironment;
    platform?: string;
  }> = {},
): GitCommandRunner {
  const execute = input.execute ?? createGitProcessExecutor();
  const environment = createGitEnvironment(
    input.sourceEnvironment ?? process.env,
    input.platform ?? process.platform,
  );

  return (root, arguments_) =>
    execute({
      executable: "git",
      arguments: [...fixedGlobalOptions, ...arguments_],
      options: {
        cwd: root,
        shell: false,
        timeout: commandTimeoutMilliseconds,
        maxBuffer: maximumCommandOutputBytes,
        windowsHide: true,
        encoding: "buffer",
        env: environment,
      },
    });
}

function refusal(code: GitWorktreeRefusalCode): GitWorktreeInspection {
  return { ok: false, code };
}

function decodeSingleLine(
  output: Uint8Array,
  maximumBytes = maximumIdentityBytes,
): string | undefined {
  if (output.length === 0 || output.length > maximumBytes) {
    return undefined;
  }

  let end = output.length;

  if (output[end - 1] === 0x0a) {
    end -= 1;
    if (end > 0 && output[end - 1] === 0x0d) {
      end -= 1;
    }
  }

  if (end === 0) {
    return undefined;
  }

  const content = output.subarray(0, end);

  if (
    content.some(
      (byte) => byte === 0 || byte === 0x0a || byte === 0x0d,
    )
  ) {
    return undefined;
  }

  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(content);
  } catch {
    return undefined;
  }
}

function decodeAbsolutePath(output: Uint8Array): string | undefined {
  const path = decodeSingleLine(output);

  if (path === undefined || !isAbsolute(path) || resolve(path) !== path) {
    return undefined;
  }

  return path;
}

function isContainedPath(base: string, candidate: string): boolean {
  const relativePath = relative(base, candidate);
  return (
    relativePath !== "" &&
    relativePath !== ".." &&
    !relativePath.startsWith(`..${sep}`) &&
    !isAbsolute(relativePath)
  );
}

function hasRefControlCharacter(value: string): boolean {
  for (const character of value) {
    const codePoint = character.codePointAt(0);

    if (codePoint !== undefined && (codePoint <= 0x20 || codePoint === 0x7f)) {
      return true;
    }
  }

  return false;
}

async function readGitMetadata(
  path: string,
): ReturnType<GitMetadataReader> {
  try {
    const stats = await lstat(path);
    return stats.isSymbolicLink() ? "symlink" : "present";
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      (error.code === "ENOENT" || error.code === "ENOTDIR")
    ) {
      return "missing";
    }

    return "error";
  }
}

type StatusInspection =
  | Readonly<{ kind: "clean" }>
  | Readonly<{
      kind: "dirty";
      paths: readonly string[];
      hasRenameOrCopy: boolean;
    }>
  | Readonly<{ kind: "conflicted" }>
  | Readonly<{ kind: "invalid" }>;
type IndexVisibilityInspection = "visible" | "hidden" | "invalid";

function findNul(output: Uint8Array, start: number): number {
  for (let index = start; index < output.length; index += 1) {
    if (output[index] === 0) {
      return index;
    }
  }

  return -1;
}

function decodeStatusPath(
  output: Uint8Array,
  start: number,
  end: number,
): string | undefined {
  if (end <= start) {
    return undefined;
  }

  try {
    const path = new TextDecoder("utf-8", { fatal: true }).decode(
      output.subarray(start, end),
    );
    return safeRelativePathSchema.safeParse(path).success ? path : undefined;
  } catch {
    return undefined;
  }
}

function inspectStatus(output: Uint8Array): StatusInspection {
  if (output.length === 0) {
    return { kind: "clean" };
  }

  if (
    output.length > maximumCommandOutputBytes ||
    output[output.length - 1] !== 0
  ) {
    return { kind: "invalid" };
  }

  let offset = 0;
  let dirty = false;
  let conflicted = false;
  let hasRenameOrCopy = false;
  const paths: string[] = [];

  while (offset < output.length) {
    const recordEnd = findNul(output, offset);

    if (recordEnd < offset + 4 || output[offset + 2] !== 0x20) {
      return { kind: "invalid" };
    }

    const x = output[offset];
    const y = output[offset + 1];

    if (
      x === undefined ||
      y === undefined ||
      !validStatusBytes.has(x) ||
      !validStatusBytes.has(y)
    ) {
      return { kind: "invalid" };
    }

    const status = String.fromCodePoint(x, y);

    if ((status.includes("?") || status.includes("!")) && status !== "??" && status !== "!!") {
      return { kind: "invalid" };
    }

    const path = decodeStatusPath(output, offset + 3, recordEnd);

    if (path === undefined) {
      return { kind: "invalid" };
    }

    offset = recordEnd + 1;

    if (status === "!!") {
      continue;
    }

    if (unmergedStatuses.has(status)) {
      conflicted = true;
    }

    dirty = true;
    paths.push(path);

    if (status.includes("R") || status.includes("C")) {
      hasRenameOrCopy = true;
      const originalPathEnd = findNul(output, offset);

      if (originalPathEnd <= offset) {
        return { kind: "invalid" };
      }

      if (decodeStatusPath(output, offset, originalPathEnd) === undefined) {
        return { kind: "invalid" };
      }

      offset = originalPathEnd + 1;
    }
  }

  if (conflicted) {
    return { kind: "conflicted" };
  }

  if (new Set(paths).size !== paths.length) {
    return { kind: "invalid" };
  }

  return dirty
    ? { kind: "dirty", paths, hasRenameOrCopy }
    : { kind: "clean" };
}

export function sameGitIdentity(
  left: GitWorktreeIdentity,
  right: GitWorktreeIdentity,
): boolean {
  return (
    left.root === right.root &&
    left.revision === right.revision &&
    left.attachedRef === right.attachedRef &&
    left.gitDirectory === right.gitDirectory &&
    left.commonDirectory === right.commonDirectory
  );
}

function samePathSet(
  actual: readonly string[],
  expected: readonly string[],
): boolean {
  return (
    actual.length === expected.length &&
    new Set(actual).size === actual.length &&
    actual.every((path) => expected.includes(path))
  );
}

function inspectIndexVisibility(output: Uint8Array): IndexVisibilityInspection {
  if (output.length === 0) {
    return "visible";
  }

  if (
    output.length > maximumCommandOutputBytes ||
    output[output.length - 1] !== 0
  ) {
    return "invalid";
  }

  let offset = 0;
  let hidden = false;

  while (offset < output.length) {
    const recordEnd = findNul(output, offset);

    if (recordEnd < offset + 3 || output[offset + 1] !== 0x20) {
      return "invalid";
    }

    const tag = output[offset];

    if (tag === undefined) {
      return "invalid";
    }

    if (tag === 0x53 || (tag >= 0x61 && tag <= 0x7a)) {
      hidden = true;
    } else if (![0x48, 0x4d, 0x52, 0x43, 0x4b, 0x3f, 0x55].includes(tag)) {
      return "invalid";
    }

    offset = recordEnd + 1;
  }

  return hidden ? "hidden" : "visible";
}

async function runInspectionCommand(
  runGit: GitCommandRunner,
  root: string,
  arguments_: readonly string[],
): Promise<GitCommandResult | undefined> {
  try {
    const result = await runGit(root, arguments_);

    if (
      !Number.isSafeInteger(result.exitCode) ||
      result.exitCode < 0 ||
      !(result.stdout instanceof Uint8Array) ||
      result.stdout.length > maximumCommandOutputBytes
    ) {
      return undefined;
    }

    return result;
  } catch {
    return undefined;
  }
}

export async function inspectGitCreateTargets(
  input: Readonly<{
    root: string;
    paths: readonly string[];
    runGit?: GitCommandRunner;
  }>,
): Promise<GitCreateTargetInspection> {
  if (
    !isAbsolute(input.root) ||
    resolve(input.root) !== input.root ||
    input.paths.some(
      (path) => !safeRelativePathSchema.safeParse(path).success,
    )
  ) {
    return { ok: false, code: "GIT_WORKTREE_IDENTITY_INVALID" };
  }

  const runGit = input.runGit ?? createGitCommandRunner();
  const paths = [...new Set(input.paths)].sort();

  for (const path of paths) {
    const result = await runInspectionCommand(runGit, input.root, [
      "check-ignore",
      "--no-index",
      "--quiet",
      "--",
      path,
    ]);

    if (result?.stdout.length !== 0) {
      return { ok: false, code: "GIT_WORKTREE_IDENTITY_INVALID" };
    }

    if (result.exitCode === 0) {
      return { ok: false, code: "CAPABILITY_ACTION_CONFLICT" };
    }

    if (result.exitCode !== 1) {
      return { ok: false, code: "GIT_WORKTREE_IDENTITY_INVALID" };
    }
  }

  return { ok: true };
}

async function inspectGitWorktreeInternal(
  input: Readonly<{
    root: string;
    runGit?: GitCommandRunner;
    readMetadata?: GitMetadataReader;
    expected?: Readonly<{
      identity: GitWorktreeIdentity;
      paths: readonly string[];
    }>;
  }>,
): Promise<GitWorktreeInspection> {
  if (
    !isAbsolute(input.root) ||
    resolve(input.root) !== input.root ||
    input.expected?.paths.some(
      (path) => !safeRelativePathSchema.safeParse(path).success,
    ) === true ||
    (input.expected !== undefined &&
      (input.expected.identity.root !== input.root ||
        new Set(input.expected.paths).size !== input.expected.paths.length))
  ) {
    return refusal("GIT_WORKTREE_IDENTITY_INVALID");
  }

  const runGit = input.runGit ?? createGitCommandRunner();
  const readMetadata = input.readMetadata ?? readGitMetadata;
  const topLevelResult = await runInspectionCommand(runGit, input.root, [
    "rev-parse",
    "--show-toplevel",
  ]);

  if (topLevelResult === undefined) {
    return refusal("GIT_WORKTREE_IDENTITY_INVALID");
  }

  if (topLevelResult.exitCode !== 0) {
    return refusal("GIT_REPOSITORY_REQUIRED");
  }

  const root = decodeAbsolutePath(topLevelResult.stdout);

  if (root === undefined || root !== input.root) {
    return refusal("GIT_WORKTREE_IDENTITY_INVALID");
  }

  const revisionResult = await runInspectionCommand(runGit, root, [
    "rev-parse",
    "--verify",
    "HEAD^{commit}",
  ]);
  const attachedRefResult = await runInspectionCommand(runGit, root, [
    "symbolic-ref",
    "--quiet",
    "HEAD",
  ]);
  const gitDirectoryResult = await runInspectionCommand(runGit, root, [
    "rev-parse",
    "--path-format=absolute",
    "--git-dir",
  ]);
  const commonDirectoryResult = await runInspectionCommand(runGit, root, [
    "rev-parse",
    "--path-format=absolute",
    "--git-common-dir",
  ]);

  if (
    revisionResult === undefined ||
    attachedRefResult === undefined ||
    gitDirectoryResult === undefined ||
    commonDirectoryResult === undefined ||
    revisionResult.exitCode !== 0 ||
    gitDirectoryResult.exitCode !== 0 ||
    commonDirectoryResult.exitCode !== 0
  ) {
    return refusal("GIT_WORKTREE_IDENTITY_INVALID");
  }

  const revision = decodeSingleLine(revisionResult.stdout, 66);
  const gitDirectory = decodeAbsolutePath(gitDirectoryResult.stdout);
  const commonDirectory = decodeAbsolutePath(commonDirectoryResult.stdout);

  if (
    revision === undefined ||
    !/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/u.test(revision) ||
    gitDirectory === undefined ||
    commonDirectory === undefined
  ) {
    return refusal("GIT_WORKTREE_IDENTITY_INVALID");
  }

  if (gitDirectory === commonDirectory) {
    return refusal("GIT_WORKTREE_NOT_ISOLATED");
  }

  if (
    attachedRefResult.exitCode === 1 &&
    attachedRefResult.stdout.length === 0
  ) {
    return refusal("GIT_BRANCH_REQUIRED");
  }

  if (attachedRefResult.exitCode !== 0) {
    return refusal("GIT_WORKTREE_IDENTITY_INVALID");
  }

  const attachedRef = decodeSingleLine(attachedRefResult.stdout);

  if (
    attachedRef === undefined ||
    !attachedRef.startsWith("refs/heads/") ||
    hasRefControlCharacter(attachedRef)
  ) {
    return refusal("GIT_WORKTREE_IDENTITY_INVALID");
  }

  let operationInProgress = false;

  for (const marker of operationMarkers) {
    const markerResult = await runInspectionCommand(runGit, root, [
      "rev-parse",
      "--git-path",
      marker,
    ]);

    if (markerResult?.exitCode !== 0) {
      return refusal("GIT_WORKTREE_IDENTITY_INVALID");
    }

    const markerPath = decodeAbsolutePath(markerResult.stdout);

    if (
      markerPath === undefined ||
      (!isContainedPath(gitDirectory, markerPath) &&
        !isContainedPath(commonDirectory, markerPath))
    ) {
      return refusal("GIT_WORKTREE_IDENTITY_INVALID");
    }

    let metadata;

    try {
      metadata = await readMetadata(markerPath);
    } catch {
      return refusal("GIT_WORKTREE_IDENTITY_INVALID");
    }

    if (
      metadata !== "missing" &&
      metadata !== "present" &&
      metadata !== "symlink"
    ) {
      return refusal("GIT_WORKTREE_IDENTITY_INVALID");
    }

    if (metadata === "present" || metadata === "symlink") {
      operationInProgress = true;
    }
  }

  if (operationInProgress) {
    return refusal("GIT_OPERATION_IN_PROGRESS");
  }

  const indexResult = await runInspectionCommand(runGit, root, [
    "ls-files",
    "-v",
    "-z",
  ]);

  if (indexResult?.exitCode !== 0) {
    return refusal("GIT_WORKTREE_IDENTITY_INVALID");
  }

  const indexVisibility = inspectIndexVisibility(indexResult.stdout);

  if (indexVisibility === "invalid") {
    return refusal("GIT_WORKTREE_IDENTITY_INVALID");
  }

  const statusResult = await runInspectionCommand(runGit, root, [
    "status",
    "--porcelain=v1",
    "-z",
    "--untracked-files=all",
  ]);

  if (statusResult?.exitCode !== 0) {
    return refusal("GIT_WORKTREE_IDENTITY_INVALID");
  }

  const status = inspectStatus(statusResult.stdout);

  if (status.kind === "invalid") {
    return refusal("GIT_WORKTREE_IDENTITY_INVALID");
  }

  if (status.kind === "conflicted") {
    return refusal("GIT_WORKTREE_CONFLICTED");
  }

  const identity = {
    root,
    revision,
    attachedRef,
    gitDirectory,
    commonDirectory,
  };

  if (input.expected !== undefined) {
    if (
      indexVisibility === "hidden" ||
      !sameGitIdentity(identity, input.expected.identity) ||
      status.kind !== "dirty" ||
      status.hasRenameOrCopy ||
      !samePathSet(status.paths, input.expected.paths)
    ) {
      return refusal("GIT_WORKTREE_CHANGED");
    }

    return { ok: true, identity };
  }

  if (status.kind === "dirty" || indexVisibility === "hidden") {
    return refusal("GIT_WORKTREE_DIRTY");
  }

  return {
    ok: true,
    identity,
  };
}

export async function inspectGitWorktree(
  input: Readonly<{
    root: string;
    runGit?: GitCommandRunner;
    readMetadata?: GitMetadataReader;
  }>,
): Promise<GitWorktreeInspection> {
  return inspectGitWorktreeInternal(input);
}

export async function inspectGitExpectedChanges(input: Readonly<{
  root: string;
  identity: GitWorktreeIdentity;
  expectedPaths: readonly string[];
  runGit?: GitCommandRunner;
  readMetadata?: GitMetadataReader;
}>): Promise<GitExpectedChangesInspection> {
  const result = await inspectGitWorktreeInternal({
    root: input.root,
    ...(input.runGit === undefined ? {} : { runGit: input.runGit }),
    ...(input.readMetadata === undefined
      ? {}
      : { readMetadata: input.readMetadata }),
    expected: { identity: input.identity, paths: input.expectedPaths },
  });

  return result.ok ? { ok: true } : result;
}
