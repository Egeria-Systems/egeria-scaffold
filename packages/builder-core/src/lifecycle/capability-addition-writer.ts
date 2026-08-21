import { constants, lstatSync } from "node:fs";
import { lstat, mkdir, open } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve, sep } from "node:path";

import { safeRelativePathSchema } from "../contracts/identifiers.js";

export type CapabilityAdditionFileChange = Readonly<{
  path: string;
  expected:
    | Readonly<{ kind: "missing" }>
    | Readonly<{ kind: "file"; content: Uint8Array }>;
  content: Uint8Array;
}>;

export type CapabilityAdditionWriteResult =
  | Readonly<{ ok: true }>
  | Readonly<{ ok: false; sourceChanged: boolean }>;

export interface CapabilityAdditionWriter {
  write(
    changes: readonly CapabilityAdditionFileChange[],
  ): Promise<CapabilityAdditionWriteResult>;
}

type PathIdentity = Readonly<{
  path: string;
  device: bigint;
  inode: bigint;
}>;

type PreparedChange = Readonly<{
  change: CapabilityAdditionFileChange;
  target: string;
  identity?: PathIdentity;
}>;

function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
  return (
    left.length === right.length &&
    left.every((byte, index) => byte === right[index])
  );
}

function captureRoot(root: string): PathIdentity | undefined {
  try {
    const stats = lstatSync(root, { bigint: true });
    return stats.isDirectory() && !stats.isSymbolicLink()
      ? { path: root, device: stats.dev, inode: stats.ino }
      : undefined;
  } catch {
    return undefined;
  }
}

async function identityMatches(identity: PathIdentity): Promise<boolean> {
  try {
    const stats = await lstat(identity.path, { bigint: true });
    return (
      !stats.isSymbolicLink() &&
      stats.dev === identity.device &&
      stats.ino === identity.inode
    );
  } catch {
    return false;
  }
}

async function ensureParentDirectories(
  rootIdentity: PathIdentity,
  path: string,
): Promise<Readonly<{ ok: boolean; sourceChanged: boolean }>> {
  const parent = dirname(path);
  const relativeParent = parent.slice(rootIdentity.path.length).replace(/^[/\\]/u, "");
  let current = rootIdentity.path;
  let sourceChanged = false;

  if (relativeParent.length === 0) {
    return (await identityMatches(rootIdentity))
      ? { ok: true, sourceChanged }
      : { ok: false, sourceChanged };
  }

  for (const segment of relativeParent.split(sep)) {
    current = join(current, segment);
    try {
      const stats = await lstat(current);
      if (stats.isSymbolicLink() || !stats.isDirectory()) {
        return { ok: false, sourceChanged };
      }
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) {
        return { ok: false, sourceChanged };
      }
      try {
        await mkdir(current, { mode: 0o755 });
        sourceChanged = true;
      } catch {
        return { ok: false, sourceChanged };
      }
    }
  }

  return (await identityMatches(rootIdentity))
    ? { ok: true, sourceChanged }
    : { ok: false, sourceChanged };
}

async function parentDirectoriesAreSafe(
  rootIdentity: PathIdentity,
  path: string,
): Promise<boolean> {
  const parent = dirname(path);
  const relativeParent = parent.slice(rootIdentity.path.length).replace(/^[/\\]/u, "");
  let current = rootIdentity.path;
  let missingAncestor = false;

  for (const segment of relativeParent.length === 0
    ? []
    : relativeParent.split(sep)) {
    current = join(current, segment);
    if (missingAncestor) {
      continue;
    }
    try {
      const stats = await lstat(current);
      if (stats.isSymbolicLink() || !stats.isDirectory()) {
        return false;
      }
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) {
        return false;
      }
      missingAncestor = true;
    }
  }

  return identityMatches(rootIdentity);
}

async function prepareChange(
  rootIdentity: PathIdentity,
  change: CapabilityAdditionFileChange,
): Promise<PreparedChange | undefined> {
  const target = join(rootIdentity.path, change.path);
  if (!(await parentDirectoriesAreSafe(rootIdentity, target))) {
    return undefined;
  }

  if (change.expected.kind === "missing") {
    try {
      await lstat(target);
      return undefined;
    } catch (error) {
      return error instanceof Error && "code" in error && error.code === "ENOENT"
        ? { change, target }
        : undefined;
    }
  }

  let handle;
  try {
    handle = await open(target, constants.O_RDONLY | constants.O_NOFOLLOW);
    const stats = await handle.stat({ bigint: true });
    if (stats.isSymbolicLink() || !stats.isFile()) {
      return undefined;
    }
    const content = await handle.readFile();
    return sameBytes(content, change.expected.content)
      ? {
          change,
          target,
          identity: { path: target, device: stats.dev, inode: stats.ino },
        }
      : undefined;
  } catch {
    return undefined;
  } finally {
    await handle?.close().catch(() => undefined);
  }
}

async function writePreparedChange(
  rootIdentity: PathIdentity,
  prepared: PreparedChange,
): Promise<CapabilityAdditionWriteResult> {
  let handle;
  let sourceChanged = false;
  try {
    const parentResult = await ensureParentDirectories(
      rootIdentity,
      prepared.target,
    );
    if (!parentResult.ok) {
      return parentResult;
    }
    sourceChanged = parentResult.sourceChanged;

    if (prepared.change.expected.kind === "missing") {
      handle = await open(prepared.target, "wx", 0o644);
      sourceChanged = true;
    } else {
      handle = await open(
        prepared.target,
        constants.O_WRONLY | constants.O_NOFOLLOW,
      );
      const stats = await handle.stat({ bigint: true });
      if (
        prepared.identity === undefined ||
        !stats.isFile() ||
        stats.dev !== prepared.identity.device ||
        stats.ino !== prepared.identity.inode
      ) {
        return { ok: false, sourceChanged };
      }
      await handle.truncate(0);
      sourceChanged = true;
    }
    await handle.writeFile(prepared.change.content);
    await handle.sync();
    return { ok: true };
  } catch {
    return { ok: false, sourceChanged };
  } finally {
    await handle?.close().catch(() => undefined);
  }
}

export function createFileSystemCapabilityAdditionWriter(
  root: string,
): CapabilityAdditionWriter {
  const fixedRoot = resolve(root);
  const rootIdentity =
    isAbsolute(root) && fixedRoot === root ? captureRoot(fixedRoot) : undefined;

  return {
    async write(changes) {
      if (
        rootIdentity === undefined ||
        changes.length === 0 ||
        new Set(changes.map(({ path }) => path)).size !== changes.length ||
        changes.some(
          ({ path, content, expected }) =>
            !safeRelativePathSchema.safeParse(path).success ||
            !(content instanceof Uint8Array) ||
            (expected.kind === "file" &&
              !(expected.content instanceof Uint8Array)),
        ) ||
        !(await identityMatches(rootIdentity))
      ) {
        return { ok: false, sourceChanged: false };
      }

      const prepared: PreparedChange[] = [];
      for (const change of changes) {
        const result = await prepareChange(rootIdentity, change);
        if (result === undefined) {
          return { ok: false, sourceChanged: false };
        }
        prepared.push(result);
      }

      let sourceChanged = false;
      for (const change of prepared) {
        const result = await writePreparedChange(rootIdentity, change);
        if (!result.ok) {
          return {
            ok: false,
            sourceChanged: sourceChanged || result.sourceChanged,
          };
        }
        sourceChanged = true;
      }

      return (await identityMatches(rootIdentity))
        ? { ok: true }
        : { ok: false, sourceChanged: true };
    },
  };
}
