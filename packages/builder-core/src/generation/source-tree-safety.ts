import {
  chmod,
  lstat,
  mkdtemp,
  readFile,
  readdir,
  rm,
} from "node:fs/promises";
import { join } from "node:path";

import { fingerprintFileContent } from "../ownership/fingerprint.js";

export type PathIdentity = Readonly<{
  path: string;
  device: bigint;
  inode: bigint;
}>;

export type OwnedTemporaryDirectoryResult =
  | Readonly<{ ok: true; value: PathIdentity }>
  | Readonly<{
      ok: false;
      reason: "creation-failed" | "invalid-identity";
    }>;

export type SourceEntry =
  | Readonly<{ kind: "directory" }>
  | Readonly<{ kind: "file"; fingerprint: string }>;

export type LockfileOnlyTransition =
  | "valid"
  | "unexpected-inventory"
  | "source-changed";

export async function readDirectoryIdentity(
  path: string,
): Promise<PathIdentity | undefined> {
  try {
    const stats = await lstat(path, { bigint: true });
    return stats.isSymbolicLink() || !stats.isDirectory()
      ? undefined
      : { path, device: stats.dev, inode: stats.ino };
  } catch {
    return undefined;
  }
}

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

export async function createOwnedTemporaryDirectory(
  parent: string,
  prefix: string,
): Promise<OwnedTemporaryDirectoryResult> {
  let identity: PathIdentity | undefined;

  try {
    const path = await mkdtemp(join(parent, prefix));
    const stats = await lstat(path, { bigint: true });
    if (stats.isSymbolicLink() || !stats.isDirectory()) {
      return { ok: false, reason: "invalid-identity" };
    }

    identity = { path, device: stats.dev, inode: stats.ino };
    await chmod(path, 0o700);
    return { ok: true, value: identity };
  } catch {
    if (identity !== undefined) {
      await cleanupOwnedDirectory(identity);
    }
    return { ok: false, reason: "creation-failed" };
  }
}

export async function snapshotSourceTree(
  root: string,
): Promise<ReadonlyMap<string, SourceEntry> | undefined> {
  const identity = await readDirectoryIdentity(root);
  if (identity === undefined) {
    return undefined;
  }

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

  return (await visit(root, "")) && (await sourceIdentityMatches(identity))
    ? entries
    : undefined;
}

function sourceEntriesEqual(
  left: SourceEntry,
  right: SourceEntry,
): boolean {
  return (
    left.kind === right.kind &&
    (left.kind === "directory" ||
      (right.kind === "file" && left.fingerprint === right.fingerprint))
  );
}

export function classifyLockfileOnlyTransition(
  before: ReadonlyMap<string, SourceEntry>,
  after: ReadonlyMap<string, SourceEntry>,
): LockfileOnlyTransition {
  if (before.has("pnpm-lock.yaml")) {
    return "unexpected-inventory";
  }

  for (const [path, entry] of before) {
    const current = after.get(path);
    if (current === undefined || !sourceEntriesEqual(entry, current)) {
      return "source-changed";
    }
  }

  return after.get("pnpm-lock.yaml")?.kind === "file" &&
    after.size === before.size + 1
    ? "valid"
    : "unexpected-inventory";
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
