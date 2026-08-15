import { lstat, readFile, readdir, rm } from "node:fs/promises";
import { join } from "node:path";

import { fingerprintFileContent } from "../ownership/fingerprint.js";

export type PathIdentity = Readonly<{
  path: string;
  device: bigint;
  inode: bigint;
}>;

export type SourceEntry =
  | Readonly<{ kind: "directory" }>
  | Readonly<{ kind: "file"; fingerprint: string }>;

export async function sourceIdentityMatches(
  identity: PathIdentity,
): Promise<boolean> {
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

export async function cleanupOwnedDirectory(
  identity: PathIdentity,
): Promise<boolean> {
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

export async function snapshotSourceTree(
  root: string,
): Promise<ReadonlyMap<string, SourceEntry> | undefined> {
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

  return (await visit(root, "")) ? entries : undefined;
}

export function sourceEntriesEqual(
  left: SourceEntry,
  right: SourceEntry,
): boolean {
  return (
    left.kind === right.kind &&
    (left.kind === "directory" ||
      (right.kind === "file" && left.fingerprint === right.fingerprint))
  );
}

export function sourceTreesEqual(
  left: ReadonlyMap<string, SourceEntry>,
  right: ReadonlyMap<string, SourceEntry>,
): boolean {
  return (
    left.size === right.size &&
    [...left].every(([path, entry]) => {
      const current = right.get(path);
      return current !== undefined && sourceEntriesEqual(entry, current);
    })
  );
}
