import { constants } from "node:fs";
import { lstat, open } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";
import { TextDecoder } from "node:util";

import { safeRelativePathSchema } from "../contracts/identifiers.js";

const maximumTextFileBytes = 1024 * 1024;

export type RepositoryReadErrorCode =
  | "PATH_INVALID"
  | "FILE_TOO_LARGE"
  | "FILE_TYPE_UNSUPPORTED"
  | "FILE_ENCODING_INVALID"
  | "READ_FAILED";

export type RepositoryReadResult =
  | Readonly<{ kind: "file"; content: string }>
  | Readonly<{ kind: "missing" }>
  | Readonly<{ kind: "symlink" }>
  | Readonly<{ kind: "error"; code: RepositoryReadErrorCode }>;

export interface RepositoryReader {
  readText(path: string): Promise<RepositoryReadResult>;
}

type RepositoryReadFailure =
  | Readonly<{ kind: "missing" }>
  | Readonly<{ kind: "symlink" }>
  | Readonly<{ kind: "error"; code: RepositoryReadErrorCode }>;

type PathIdentity = Readonly<{
  path: string;
  device: number | bigint;
  inode: number | bigint;
}>;

function readError(
  code: RepositoryReadErrorCode,
): Readonly<{ kind: "error"; code: RepositoryReadErrorCode }> {
  return { kind: "error", code };
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

function isMissingError(error: unknown): boolean {
  return isNodeError(error) && error.code === "ENOENT";
}

function sameIdentity(
  identity: PathIdentity,
  stats: Readonly<{ dev: number | bigint; ino: number | bigint }>,
): boolean {
  return identity.device === stats.dev && identity.inode === stats.ino;
}

async function validateRoot(root: string): Promise<PathIdentity | undefined> {
  try {
    const stats = await lstat(root, { bigint: true });

    if (stats.isSymbolicLink() || !stats.isDirectory()) {
      return undefined;
    }

    return { path: root, device: stats.dev, inode: stats.ino };
  } catch {
    return undefined;
  }
}

async function inspectRequestedPath(
  rootIdentity: PathIdentity,
  path: string,
): Promise<
  | Readonly<{
      kind: "file";
      path: string;
      identity: PathIdentity;
      ancestors: readonly PathIdentity[];
    }>
  | RepositoryReadFailure
> {
  const segments = path.split("/");
  const ancestors: PathIdentity[] = [rootIdentity];
  let currentPath = rootIdentity.path;

  for (const [index, segment] of segments.entries()) {
    currentPath = join(currentPath, segment);

    try {
      const stats = await lstat(currentPath, { bigint: true });

      if (stats.isSymbolicLink()) {
        return { kind: "symlink" };
      }

      const identity = {
        path: currentPath,
        device: stats.dev,
        inode: stats.ino,
      };
      const isLeaf = index === segments.length - 1;

      if (isLeaf) {
        return stats.isFile()
          ? { kind: "file", path: currentPath, identity, ancestors }
          : readError("FILE_TYPE_UNSUPPORTED");
      }

      if (!stats.isDirectory()) {
        return readError("FILE_TYPE_UNSUPPORTED");
      }

      ancestors.push(identity);
    } catch (error) {
      return isMissingError(error) ? { kind: "missing" } : readError("READ_FAILED");
    }
  }

  return readError("PATH_INVALID");
}

async function recheckAncestors(
  ancestors: readonly PathIdentity[],
): Promise<RepositoryReadResult | undefined> {
  for (const ancestor of ancestors) {
    try {
      const stats = await lstat(ancestor.path, { bigint: true });

      if (stats.isSymbolicLink()) {
        return { kind: "symlink" };
      }

      if (!stats.isDirectory() || !sameIdentity(ancestor, stats)) {
        return readError("READ_FAILED");
      }
    } catch {
      return readError("READ_FAILED");
    }
  }

  return undefined;
}

async function readOpenedFile(
  path: string,
  identity: PathIdentity,
  ancestors: readonly PathIdentity[],
): Promise<RepositoryReadResult> {
  let handle;

  try {
    handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    const openedStats = await handle.stat({ bigint: true });

    if (!openedStats.isFile() || !sameIdentity(identity, openedStats)) {
      return readError("READ_FAILED");
    }

    if (openedStats.size > BigInt(maximumTextFileBytes)) {
      return readError("FILE_TOO_LARGE");
    }

    const ancestorError = await recheckAncestors(ancestors);

    if (ancestorError !== undefined) {
      return ancestorError;
    }

    const buffer = Buffer.allocUnsafe(maximumTextFileBytes + 1);
    let totalBytes = 0;

    while (totalBytes < buffer.length) {
      const { bytesRead } = await handle.read(
        buffer,
        totalBytes,
        buffer.length - totalBytes,
        null,
      );

      if (bytesRead === 0) {
        break;
      }

      totalBytes += bytesRead;
    }

    if (totalBytes > maximumTextFileBytes) {
      return readError("FILE_TOO_LARGE");
    }

    try {
      const decoder = new TextDecoder("utf-8", {
        fatal: true,
        ignoreBOM: true,
      });
      return {
        kind: "file",
        content: decoder.decode(buffer.subarray(0, totalBytes)),
      };
    } catch {
      return readError("FILE_ENCODING_INVALID");
    }
  } catch (error) {
    if (isNodeError(error) && error.code === "ELOOP") {
      return { kind: "symlink" };
    }

    return readError("READ_FAILED");
  } finally {
    await handle?.close().catch(() => undefined);
  }
}

export function createFileSystemRepositoryReader(
  root: string,
): RepositoryReader {
  const fixedRoot = resolve(root);
  const absoluteRoot = isAbsolute(root);

  return {
    async readText(path: string): Promise<RepositoryReadResult> {
      if (!absoluteRoot || !safeRelativePathSchema.safeParse(path).success) {
        return readError("PATH_INVALID");
      }

      const rootIdentity = await validateRoot(fixedRoot);

      if (rootIdentity === undefined) {
        return readError("PATH_INVALID");
      }

      const inspected = await inspectRequestedPath(rootIdentity, path);

      if (inspected.kind !== "file") {
        return inspected;
      }

      return readOpenedFile(
        inspected.path,
        inspected.identity,
        inspected.ancestors,
      );
    },
  };
}

export function createInMemoryRepositoryReader(
  files: Readonly<Record<string, string>>,
): RepositoryReader {
  const snapshot = new Map(Object.entries(files));

  return {
    readText(path: string): Promise<RepositoryReadResult> {
      if (!safeRelativePathSchema.safeParse(path).success) {
        return Promise.resolve(readError("PATH_INVALID"));
      }

      const content = snapshot.get(path);
      return Promise.resolve(
        content === undefined ? { kind: "missing" } : { kind: "file", content },
      );
    },
  };
}
