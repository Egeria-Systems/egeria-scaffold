import { execFile } from "node:child_process";
import { promisify } from "node:util";

import {
  createIsolatedProcessEnvironment,
  isolatedProcessOptions,
} from "./isolated-process.mjs";

const execFileAsync = promisify(execFile);
const gitTimeoutMilliseconds = 30_000;

export function createCertificationRepositoryReaders(
  {
    repositoryRoot,
    revisionArguments,
    exactRevisionPattern,
    createError,
    isCertificationError,
    errorCodes,
  },
  executeGit = execFileAsync,
) {
  const options = () => ({
    cwd: repositoryRoot,
    env: createIsolatedProcessEnvironment(),
    timeout: gitTimeoutMilliseconds,
    ...isolatedProcessOptions,
  });

  async function readCurrentRevision() {
    try {
      const { stdout } = await executeGit("git", revisionArguments, options());
      const revision = stdout.trim();
      if (!exactRevisionPattern.test(revision)) {
        throw createError(errorCodes.revisionInvalid);
      }
      return revision;
    } catch (error) {
      if (isCertificationError(error)) throw error;
      throw createError(errorCodes.revisionUnavailable);
    }
  }

  async function readRepositoryStatus() {
    try {
      const { stdout } = await executeGit(
        "git",
        ["status", "--porcelain=v1", "-z", "--untracked-files=all"],
        options(),
      );
      return stdout;
    } catch {
      throw createError(errorCodes.worktreeUnavailable);
    }
  }

  async function readRepositoryIndexEntries() {
    try {
      const { stdout } = await executeGit(
        "git",
        ["ls-files", "-v", "-z"],
        options(),
      );
      return stdout;
    } catch {
      throw createError(errorCodes.worktreeUnavailable);
    }
  }

  return Object.freeze({
    readCurrentRevision,
    readRepositoryStatus,
    readRepositoryIndexEntries,
  });
}

export function createCertificationPreflight({
  adapters,
  requiredAdapterFunctions,
  createError,
  isCertificationError,
  errorCodes,
}) {
  function requireAdapters() {
    if (
      adapters === null ||
      typeof adapters !== "object" ||
      requiredAdapterFunctions.some(
        (name) => typeof adapters[name] !== "function",
      )
    ) {
      throw createError(errorCodes.adapterInvalid);
    }
  }

  async function readAdapter(name, unavailableCode) {
    try {
      return await adapters[name]();
    } catch (error) {
      if (isCertificationError(error)) throw error;
      throw createError(unavailableCode);
    }
  }

  async function requireRevision(revision) {
    const current = await readAdapter(
      "readCurrentRevision",
      errorCodes.revisionUnavailable,
    );
    if (current !== revision) {
      throw createError(errorCodes.revisionMismatch);
    }
  }

  function readRepositoryStatus() {
    return readAdapter(
      "readRepositoryStatus",
      errorCodes.worktreeUnavailable,
    );
  }

  function readRepositoryIndexEntries() {
    return readAdapter(
      "readRepositoryIndexEntries",
      errorCodes.worktreeUnavailable,
    );
  }

  function requireCleanStatus(status) {
    if (typeof status !== "string") {
      throw createError(errorCodes.worktreeUnavailable);
    }
    if (status.length !== 0) {
      throw createError(errorCodes.worktreeDirty);
    }
  }

  function requireOrdinaryIndexEntries(indexEntries) {
    if (typeof indexEntries !== "string") {
      throw createError(errorCodes.worktreeUnavailable);
    }
    if (indexEntries.length === 0) return;

    const entries = indexEntries.split("\0");
    if (entries.at(-1) !== "") {
      throw createError(errorCodes.worktreeUnavailable);
    }
    entries.pop();
    for (const entry of entries) {
      if (entry.length < 3 || entry[1] !== " ") {
        throw createError(errorCodes.worktreeUnavailable);
      }
      if (entry[0] !== "H") {
        throw createError(errorCodes.indexFlags);
      }
    }
  }

  return Object.freeze({
    requireAdapters,
    requireRevision,
    readRepositoryStatus,
    readRepositoryIndexEntries,
    requireCleanStatus,
    requireOrdinaryIndexEntries,
  });
}
