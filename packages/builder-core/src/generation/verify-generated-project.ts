import { execFile } from "node:child_process";
import {
  cp,
  lstat,
  mkdir,
  open,
  readFile,
  realpath,
} from "node:fs/promises";
import {
  delimiter,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from "node:path";
import { promisify } from "node:util";

import { ordinaryGenerationVerificationChecks } from "../contracts/generation-verification.js";
import type { ValidationResult } from "../contracts/result.js";
import {
  createRecipeLockfileUrl,
  resolveRecipeLockfileVersion,
  type RecipeLockfileIdentity,
} from "./recipe-lockfiles.js";
import {
  classifyLockfileOnlyTransition,
  cleanupOwnedDirectory,
  createOwnedTemporaryDirectory,
  readDirectoryIdentity,
  snapshotSourceTree,
  sourceIdentityMatches,
  sourceTreesEqual,
  type PathIdentity,
} from "./source-tree-safety.js";

export type GeneratedProjectVerification = Readonly<{
  checks: typeof verificationChecks;
}>;

export interface GeneratedProjectVerifier {
  prepareLockfile(
    root: string,
    identity: RecipeLockfileIdentity,
  ): Promise<ValidationResult<void>>;
  verifyInIsolatedCopy(
    root: string,
  ): Promise<ValidationResult<GeneratedProjectVerification>>;
}

type ToolResolutionOptions = Readonly<{
  platform?: "win32" | "posix";
  environment?: Readonly<Record<string, string | undefined>>;
}>;

type SupportPaths = Readonly<{
  identity: PathIdentity;
  home: string;
  temporary: string;
  store: string;
  userConfiguration: string;
}>;

type ExclusiveWriteResult =
  | Readonly<{ ok: true }>
  | Readonly<{ ok: false; sourceChanged: boolean }>;

type ExclusiveFileOperations = Readonly<{
  open(path: string, flags: "wx"): Promise<{
    stat(options: { bigint: true }): Promise<{
      isFile(): boolean;
      isSymbolicLink(): boolean;
      dev: bigint;
      ino: bigint;
    }>;
    writeFile(content: Uint8Array): Promise<unknown>;
    close(): Promise<unknown>;
  }>;
}>;

type ExclusiveFileWriter = (
  path: string,
  content?: Uint8Array,
) => Promise<ExclusiveWriteResult>;

const execFileAsync = promisify(execFile);
const maximumOutputBytes = 1024 * 1024;
const versionTimeoutMilliseconds = 30 * 1000;
const commandTimeoutMilliseconds = 15 * 60 * 1000;
const requiredPnpmVersion = "11.20.0";
const publicRegistry = "https://registry.npmjs.org/";
const exclusiveFileOperations: ExclusiveFileOperations = {
  open,
};
export const verificationChecks = ordinaryGenerationVerificationChecks;

function issue<T>(code: string, reason: string): ValidationResult<T> {
  return {
    ok: false,
    issues: [{ code, path: [], context: { reason } }],
  };
}

function findEnvironmentValue(
  name: string,
  environment: Readonly<Record<string, string | undefined>> = process.env,
): string | undefined {
  const normalizedName = name.toLowerCase();
  return Object.entries(environment).find(
    ([key, value]) => key.toLowerCase() === normalizedName && value !== undefined,
  )?.[1];
}

function createChildEnvironment(
  support: SupportPaths,
  toolEnvironment: Readonly<Record<string, string>> = {},
): NodeJS.ProcessEnv {
  const environment: NodeJS.ProcessEnv = {};

  for (const key of ["PATH", "SystemRoot", "ComSpec", "PATHEXT", "LANG"] as const) {
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
    ...toolEnvironment,
    CI: "true",
    NEXT_TELEMETRY_DISABLED: "1",
    HOME: support.home,
    USERPROFILE: support.home,
    TMPDIR: support.temporary,
    TMP: support.temporary,
    TEMP: support.temporary,
    NPM_CONFIG_REGISTRY: publicRegistry,
    NPM_CONFIG_USERCONFIG: support.userConfiguration,
  };
}

function executableNames(
  executable: string,
  options: ToolResolutionOptions,
): readonly string[] {
  if (options.platform !== "win32") {
    return [executable];
  }

  const extensions = (findEnvironmentValue("PATHEXT", options.environment) ?? "")
    .split(";")
    .filter((extension) => extension.length > 0)
    .map((extension) =>
      extension.startsWith(".") ? extension : `.${extension}`,
    );
  const executableLower = executable.toLowerCase();
  return extensions.some((extension) =>
    executableLower.endsWith(extension.toLowerCase()),
  )
    ? [executable]
    : [executable, ...extensions.map((extension) => `${executable}${extension}`)];
}

export async function resolveExecutablePath(
  executable: string,
  options: ToolResolutionOptions = {},
): Promise<string | undefined> {
  const platform =
    options.platform ?? (process.platform === "win32" ? "win32" : "posix");
  const candidates = isAbsolute(executable)
    ? [executable]
    : (findEnvironmentValue("PATH", options.environment) ?? "")
        .split(platform === "win32" ? ";" : delimiter)
        .filter((entry) => entry.length > 0)
        .flatMap((entry) =>
          executableNames(executable, { ...options, platform }).map((name) =>
            join(entry, name),
          ),
        );

  for (const candidate of candidates) {
    try {
      const stats = await lstat(candidate);
      if (stats.isFile() || stats.isSymbolicLink()) {
        return resolve(candidate);
      }
    } catch {
      // Continue to the next fixed PATH candidate.
    }
  }

  return undefined;
}

function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
  return (
    left.length === right.length &&
    left.every((byte, index) => byte === right[index])
  );
}

async function isVoltaShim(
  executablePath: string,
  bin: string,
  platform: "win32" | "posix",
): Promise<boolean> {
  const executable = await realpath(executablePath);
  const expectedShim = await realpath(
    join(bin, platform === "win32" ? "volta-shim.exe" : "volta-shim"),
  );
  if (executable === expectedShim) {
    return true;
  }

  if (platform !== "win32") {
    return false;
  }

  const [executableContent, expectedShimContent] = await Promise.all([
    readFile(executable),
    readFile(expectedShim),
  ]);
  return sameBytes(executableContent, expectedShimContent);
}

export async function derivePnpmToolEnvironment(
  executable: string,
  options: ToolResolutionOptions = {},
): Promise<Readonly<Record<string, string>>> {
  const platform =
    options.platform ?? (process.platform === "win32" ? "win32" : "posix");
  const executablePath = await resolveExecutablePath(executable, {
    ...options,
    platform,
  });
  if (executablePath === undefined) {
    return {};
  }

  try {
    const bin = await realpath(dirname(executablePath));
    if (!(await isVoltaShim(executablePath, bin, platform))) {
      return {};
    }

    const voltaHome = await realpath(dirname(bin));
    const stats = await lstat(voltaHome);
    return stats.isDirectory() && !stats.isSymbolicLink()
      ? { VOLTA_HOME: voltaHome, VOLTA_FEATURE_PNPM: "1" }
      : {};
  } catch {
    return {};
  }
}

export async function writeExclusive(
  path: string,
  content: Uint8Array = new Uint8Array(),
  operations: ExclusiveFileOperations = exclusiveFileOperations,
): Promise<ExclusiveWriteResult> {
  let handle;
  let created = false;
  let failed = false;

  try {
    handle = await operations.open(path, "wx");
    created = true;
    const stats = await handle.stat({ bigint: true });
    if (stats.isSymbolicLink() || !stats.isFile()) {
      throw new Error("invalid-created-file");
    }
    await handle.writeFile(content);
  } catch {
    failed = true;
  } finally {
    try {
      await handle?.close();
    } catch {
      failed = true;
    }
  }

  if (!failed) {
    return { ok: true };
  }

  if (!created) {
    return { ok: false, sourceChanged: false };
  }

  // Node does not expose an identity-conditional unlink. A path-based remove
  // could delete a replacement created after this handle was opened, so the
  // caller must fail closed and let the identity-owned staging root clean up.
  return { ok: false, sourceChanged: true };
}

async function createSupportPaths(
  identity: PathIdentity,
): Promise<ValidationResult<SupportPaths>> {
  const home = join(identity.path, "home");
  const temporary = join(identity.path, "temporary");
  const store = join(identity.path, "store");
  const userConfiguration = join(identity.path, ".npmrc");

  try {
    await mkdir(home, { mode: 0o700 });
    await mkdir(temporary, { mode: 0o700 });
    await mkdir(store, { mode: 0o700 });
    if (!(await writeExclusive(userConfiguration)).ok) {
      return issue("VERIFIER_SETUP_FAILED", "user-configuration-failed");
    }

    return {
      ok: true,
      value: { identity, home, temporary, store, userConfiguration },
    };
  } catch {
    return issue("VERIFIER_SETUP_FAILED", "support-creation-failed");
  }
}

export function commandFailureReason(error: unknown): string {
  const metadata: string[] = [];

  if (typeof error === "object" && error !== null) {
    try {
      const failure = error as Readonly<{
        code?: unknown;
        killed?: unknown;
      }>;
      const exitCode: unknown = failure.code;
      const killed: unknown = failure.killed;

      if (typeof exitCode === "number" && Number.isSafeInteger(exitCode)) {
        metadata.push(`exit-code=${String(exitCode)}`);
      }
      if (typeof killed === "boolean") {
        metadata.push(`timed-out=${killed ? "true" : "false"}`);
      }
    } catch {
      return "command-failed";
    }
  }

  return ["command-failed", ...metadata].join(";");
}

async function runCommand(input: Readonly<{
  executable: string;
  arguments: readonly string[];
  cwd: string;
  environment: NodeJS.ProcessEnv;
  timeout: number;
  failureCode: string;
}>): Promise<ValidationResult<string>> {
  try {
    const { stdout } = await execFileAsync(input.executable, [...input.arguments], {
      cwd: input.cwd,
      encoding: "utf8",
      env: input.environment,
      maxBuffer: maximumOutputBytes,
      shell: false,
      timeout: input.timeout,
      windowsHide: true,
    });
    return { ok: true, value: stdout };
  } catch (error) {
    return issue(input.failureCode, commandFailureReason(error));
  }
}

async function requirePnpmVersion(input: Readonly<{
  executable: string;
  cwd: string;
  environment: NodeJS.ProcessEnv;
}>): Promise<ValidationResult<void>> {
  const result = await runCommand({
    ...input,
    arguments: ["--version"],
    timeout: versionTimeoutMilliseconds,
    failureCode: "PNPM_VERSION_INVALID",
  });

  if (!result.ok) {
    return result;
  }

  return result.value.trim() === requiredPnpmVersion
    ? { ok: true, value: undefined }
    : issue("PNPM_VERSION_INVALID", "version-mismatch");
}

export async function prepareLockfile(
  root: string,
  recipeIdentity: RecipeLockfileIdentity,
  writer: ExclusiveFileWriter = writeExclusive,
): Promise<ValidationResult<void>> {
  const fixedRoot = resolve(root);
  const identity = await readDirectoryIdentity(fixedRoot);
  if (identity === undefined) {
    return issue("LOCKFILE_PREPARATION_FAILED", "source-invalid");
  }

  const before = await snapshotSourceTree(fixedRoot);
  if (
    before === undefined ||
    !(await sourceIdentityMatches(identity))
  ) {
    return issue("LOCKFILE_PREPARATION_FAILED", "source-invalid");
  }

  let lockfileBytes: Uint8Array;
  try {
    const manifestSource = await readFile(
      join(fixedRoot, "apps/web/package.json"),
      "utf8",
    );
    const lockfileVersion = resolveRecipeLockfileVersion(
      recipeIdentity,
      JSON.parse(manifestSource) as unknown,
    );
    if (lockfileVersion === undefined) {
      return issue(
        "LOCKFILE_PREPARATION_FAILED",
        "recipe-lockfile-unavailable",
      );
    }
    lockfileBytes = await readFile(createRecipeLockfileUrl(lockfileVersion));
  } catch {
    return issue("LOCKFILE_PREPARATION_FAILED", "recipe-lockfile-unavailable");
  }

  const writeResult = await writer(
    join(fixedRoot, "pnpm-lock.yaml"),
    lockfileBytes,
  );
  if (!writeResult.ok) {
    return issue(
      "LOCKFILE_PREPARATION_FAILED",
      writeResult.sourceChanged
        ? "lockfile-write-failed-source-changed"
        : "lockfile-write-failed",
    );
  }

  if (!(await sourceIdentityMatches(identity))) {
    return issue("LOCKFILE_PREPARATION_FAILED", "source-changed");
  }

  const after = await snapshotSourceTree(fixedRoot);
  return after !== undefined &&
    classifyLockfileOnlyTransition(before, after) === "valid"
    ? { ok: true, value: undefined }
    : issue("LOCKFILE_PREPARATION_FAILED", "source-changed");
}

async function verifyInIsolatedCopy(
  executable: string,
  root: string,
): Promise<ValidationResult<GeneratedProjectVerification>> {
  const fixedRoot = resolve(root);
  const sourceBefore = await snapshotSourceTree(fixedRoot);
  if (sourceBefore === undefined) {
    return issue("FROZEN_INSTALL_FAILED", "source-invalid");
  }

  const owner = await createOwnedTemporaryDirectory(
    dirname(fixedRoot),
    ".egeria-validation-",
  );
  if (!owner.ok) {
    return issue("FROZEN_INSTALL_FAILED", "validation-creation-failed");
  }

  let result: ValidationResult<GeneratedProjectVerification>;
  try {
    const validationRoot = join(owner.value.path, "project");
    const supportRoot = join(owner.value.path, "support");
    await cp(fixedRoot, validationRoot, {
      recursive: true,
      force: false,
      errorOnExist: true,
      dereference: false,
      filter: (source) =>
        !relative(fixedRoot, source).split(sep).includes(".git"),
    });
    await mkdir(supportRoot, { mode: 0o700 });
    const supportStats = await lstat(supportRoot, { bigint: true });
    const support = await createSupportPaths({
      path: supportRoot,
      device: supportStats.dev,
      inode: supportStats.ino,
    });

    if (!support.ok) {
      result = issue("FROZEN_INSTALL_FAILED", "support-creation-failed");
    } else {
      const environment = createChildEnvironment(
        support.value,
        await derivePnpmToolEnvironment(executable),
      );
      const version = await requirePnpmVersion({
        executable,
        cwd: validationRoot,
        environment,
      });

      if (!version.ok) {
        result = version;
      } else {
        const commands = [
          {
            arguments: [
              "install",
              "--frozen-lockfile",
              "--store-dir",
              support.value.store,
            ],
            failureCode: "FROZEN_INSTALL_FAILED",
          },
          { arguments: ["run", "lint"], failureCode: "LINT_FAILED" },
          {
            arguments: ["run", "typecheck"],
            failureCode: "TYPECHECK_FAILED",
          },
          {
            arguments: ["run", "test:unit"],
            failureCode: "UNIT_TESTS_FAILED",
          },
          {
            arguments: ["run", "test:component"],
            failureCode: "COMPONENT_TESTS_FAILED",
          },
          { arguments: ["run", "build"], failureCode: "NEXT_BUILD_FAILED" },
          {
            arguments: [
              "--dir",
              "apps/web",
              "exec",
              "opennextjs-cloudflare",
              "build",
              "--skipNextBuild",
            ],
            failureCode: "OPENNEXT_BUILD_FAILED",
          },
        ] as const;
        result = { ok: true, value: { checks: verificationChecks } };

        for (const command of commands) {
          const commandResult = await runCommand({
            executable,
            arguments: command.arguments,
            cwd: validationRoot,
            environment,
            timeout: commandTimeoutMilliseconds,
            failureCode: command.failureCode,
          });
          if (!commandResult.ok) {
            result = commandResult;
            break;
          }
        }

        const sourceAfter = await snapshotSourceTree(fixedRoot);
        if (
          sourceAfter === undefined ||
          !sourceTreesEqual(sourceBefore, sourceAfter)
        ) {
          result = issue("FROZEN_INSTALL_FAILED", "source-changed");
        }
      }
    }
  } catch {
    result = issue("FROZEN_INSTALL_FAILED", "validation-failed");
  } finally {
    if (!(await cleanupOwnedDirectory(owner.value))) {
      result = issue("VALIDATION_CLEANUP_FAILED", "cleanup-failed");
    }
  }

  return result;
}

export function createPnpmGeneratedProjectVerifier(input: Readonly<{
  pnpmExecutable: string;
}>): GeneratedProjectVerifier {
  const executable = input.pnpmExecutable;

  return {
    prepareLockfile(root, identity) {
      return prepareLockfile(root, identity);
    },
    verifyInIsolatedCopy(root) {
      return typeof executable === "string" && executable.length > 0
        ? verifyInIsolatedCopy(executable, root)
        : Promise.resolve(issue("PNPM_VERSION_INVALID", "invalid-executable"));
    },
  };
}
