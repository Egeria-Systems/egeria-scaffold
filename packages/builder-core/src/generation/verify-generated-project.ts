import { execFile } from "node:child_process";
import {
  chmod,
  cp,
  lstat,
  mkdir,
  mkdtemp,
  open,
  readFile,
  readdir,
  rm,
} from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { promisify } from "node:util";

import { fingerprintFileContent } from "../ownership/fingerprint.js";
import type { ValidationResult } from "../contracts/result.js";

export type GeneratedProjectVerification = Readonly<{
  checks: typeof verificationChecks;
}>;

export interface GeneratedProjectVerifier {
  prepareLockfile(root: string): Promise<ValidationResult<void>>;
  verifyInIsolatedCopy(
    root: string,
  ): Promise<ValidationResult<GeneratedProjectVerification>>;
}

type PathIdentity = Readonly<{
  path: string;
  device: bigint;
  inode: bigint;
}>;

type SupportPaths = Readonly<{
  identity: PathIdentity;
  home: string;
  temporary: string;
  store: string;
  userConfiguration: string;
}>;

type SourceEntry =
  | Readonly<{ kind: "directory" }>
  | Readonly<{ kind: "file"; fingerprint: string }>;

const execFileAsync = promisify(execFile);
const maximumOutputBytes = 1024 * 1024;
const versionTimeoutMilliseconds = 30 * 1000;
const commandTimeoutMilliseconds = 15 * 60 * 1000;
const requiredPnpmVersion = "11.20.0";
const publicRegistry = "https://registry.npmjs.org/";
const recipeLockfile = new URL(
  "../../lockfiles/web-recipe-0.7.0/pnpm-lock.yaml",
  import.meta.url,
);
export const verificationChecks = Object.freeze([
  "lockfile",
  "frozen-install",
  "lint",
  "typecheck",
  "unit-tests",
  "component-tests",
  "next-build",
  "opennext-build",
] as const);

function issue<T>(code: string, reason: string): ValidationResult<T> {
  return {
    ok: false,
    issues: [{ code, path: [], context: { reason } }],
  };
}

function findEnvironmentValue(name: string): string | undefined {
  const normalizedName = name.toLowerCase();
  return Object.entries(process.env).find(
    ([key, value]) => key.toLowerCase() === normalizedName && value !== undefined,
  )?.[1];
}

function createChildEnvironment(support: SupportPaths): NodeJS.ProcessEnv {
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

async function sourceIdentityMatches(identity: PathIdentity): Promise<boolean> {
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

async function cleanupOwnedDirectory(identity: PathIdentity): Promise<boolean> {
  if (!(await sourceIdentityMatches(identity))) {
    return false;
  }

  try {
    await rm(identity.path, { recursive: true });
    return true;
  } catch {
    return false;
  }
}

async function writeExclusive(
  path: string,
  content: Uint8Array = new Uint8Array(),
): Promise<boolean> {
  let handle;
  let failed = false;

  try {
    handle = await open(path, "wx");
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

  return !failed;
}

async function createOwnedDirectory(
  parent: string,
  prefix: string,
): Promise<ValidationResult<PathIdentity>> {
  try {
    const path = await mkdtemp(join(parent, prefix));
    const stats = await lstat(path, { bigint: true });
    if (stats.isSymbolicLink() || !stats.isDirectory()) {
      return issue("VERIFIER_SETUP_FAILED", "invalid-owner");
    }

    await chmod(path, 0o700);
    return {
      ok: true,
      value: { path, device: stats.dev, inode: stats.ino },
    };
  } catch {
    return issue("VERIFIER_SETUP_FAILED", "owner-creation-failed");
  }
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
    if (!(await writeExclusive(userConfiguration))) {
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
  } catch {
    return issue(input.failureCode, "command-failed");
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

  return result.ok && result.value.trim() === requiredPnpmVersion
    ? { ok: true, value: undefined }
    : issue("PNPM_VERSION_INVALID", "version-mismatch");
}

async function snapshotSource(
  root: string,
): Promise<ValidationResult<ReadonlyMap<string, SourceEntry>>> {
  const entries = new Map<string, SourceEntry>();

  async function visit(path: string, relativePath: string): Promise<boolean> {
    let children;
    try {
      children = await readdir(path, { withFileTypes: true });
    } catch {
      return false;
    }

    for (const child of children) {
      const childPath = join(path, child.name);
      const childRelativePath = relativePath
        ? `${relativePath}/${child.name}`
        : child.name;

      if (child.isDirectory()) {
        entries.set(childRelativePath, { kind: "directory" });
        if (!(await visit(childPath, childRelativePath))) {
          return false;
        }
      } else if (child.isFile()) {
        try {
          entries.set(childRelativePath, {
            kind: "file",
            fingerprint: fingerprintFileContent(await readFile(childPath)),
          });
        } catch {
          return false;
        }
      } else {
        return false;
      }
    }

    return true;
  }

  return (await visit(root, ""))
    ? { ok: true, value: entries }
    : issue("SOURCE_SNAPSHOT_FAILED", "source-invalid");
}

function entriesEqual(left: SourceEntry, right: SourceEntry): boolean {
  return (
    left.kind === right.kind &&
    (left.kind === "directory" ||
      (right.kind === "file" && left.fingerprint === right.fingerprint))
  );
}

function onlyLockfileWasAdded(
  before: ReadonlyMap<string, SourceEntry>,
  after: ReadonlyMap<string, SourceEntry>,
): boolean {
  if (
    before.has("pnpm-lock.yaml") ||
    after.get("pnpm-lock.yaml")?.kind !== "file" ||
    after.size !== before.size + 1
  ) {
    return false;
  }

  return [...before].every(([path, entry]) => {
    const current = after.get(path);
    return current !== undefined && entriesEqual(entry, current);
  });
}

function snapshotsEqual(
  left: ReadonlyMap<string, SourceEntry>,
  right: ReadonlyMap<string, SourceEntry>,
): boolean {
  return (
    left.size === right.size &&
    [...left].every(([path, entry]) => {
      const current = right.get(path);
      return current !== undefined && entriesEqual(entry, current);
    })
  );
}

async function prepareLockfile(
  root: string,
): Promise<ValidationResult<void>> {
  const fixedRoot = resolve(root);
  const before = await snapshotSource(fixedRoot);
  if (!before.ok) {
    return issue("LOCKFILE_PREPARATION_FAILED", "source-invalid");
  }

  let lockfileBytes: Uint8Array;
  try {
    lockfileBytes = await readFile(recipeLockfile);
  } catch {
    return issue("LOCKFILE_PREPARATION_FAILED", "recipe-lockfile-unavailable");
  }

  if (
    !(await writeExclusive(join(fixedRoot, "pnpm-lock.yaml"), lockfileBytes))
  ) {
    return issue("LOCKFILE_PREPARATION_FAILED", "lockfile-write-failed");
  }

  const after = await snapshotSource(fixedRoot);
  return after.ok && onlyLockfileWasAdded(before.value, after.value)
    ? { ok: true, value: undefined }
    : issue("LOCKFILE_PREPARATION_FAILED", "source-changed");
}

async function verifyInIsolatedCopy(
  executable: string,
  root: string,
): Promise<ValidationResult<GeneratedProjectVerification>> {
  const fixedRoot = resolve(root);
  const sourceBefore = await snapshotSource(fixedRoot);
  if (!sourceBefore.ok) {
    return issue("FROZEN_INSTALL_FAILED", "source-invalid");
  }

  const owner = await createOwnedDirectory(
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
      const environment = createChildEnvironment(support.value);
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
            arguments: ["run", "build:cloudflare"],
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

        const sourceAfter = await snapshotSource(fixedRoot);
        if (!sourceAfter.ok || !snapshotsEqual(sourceBefore.value, sourceAfter.value)) {
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
    prepareLockfile(root) {
      return prepareLockfile(root);
    },
    verifyInIsolatedCopy(root) {
      return typeof executable === "string" && executable.length > 0
        ? verifyInIsolatedCopy(executable, root)
        : Promise.resolve(issue("PNPM_VERSION_INVALID", "invalid-executable"));
    },
  };
}
