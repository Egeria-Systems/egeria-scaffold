import { randomUUID } from "node:crypto";
import { constants, lstatSync } from "node:fs";
import { lstat, open, rename, unlink } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve, sep } from "node:path";

import { safeRelativePathSchema } from "../contracts/identifiers.js";

export type CapabilityRemovalFileChange =
  | Readonly<{
      kind: "replace-file";
      path: string;
      expected: Uint8Array;
      content: Uint8Array;
    }>
  | Readonly<{
      kind: "delete-file";
      path: string;
      expected: Uint8Array;
    }>;

export type CapabilityRemovalWriteResult =
  | Readonly<{ ok: true }>
  | Readonly<{ ok: false; sourceChanged: boolean }>;

export interface CapabilityRemovalWriter {
  write(
    changes: readonly CapabilityRemovalFileChange[],
  ): Promise<CapabilityRemovalWriteResult>;
}

type PathIdentity = Readonly<{
  path: string;
  device: bigint;
  inode: bigint;
}>;

type FileIdentity = PathIdentity &
  Readonly<{
    mode: number;
    size: bigint;
    changeTime: bigint;
    modificationTime: bigint;
  }>;

type PreparedChange = Readonly<{
  change: CapabilityRemovalFileChange;
  target: string;
  identity: FileIdentity;
}>;

type CapabilityRemovalWriterHooks = Readonly<{
  beforeCommit?: (path: string) => Promise<unknown>;
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

async function fileIdentityMatches(identity: FileIdentity): Promise<boolean> {
  try {
    const stats = await lstat(identity.path, { bigint: true });
    return (
      !stats.isSymbolicLink() &&
      stats.isFile() &&
      stats.dev === identity.device &&
      stats.ino === identity.inode &&
      Number(stats.mode & 0o777n) === identity.mode &&
      stats.size === identity.size &&
      stats.ctimeNs === identity.changeTime &&
      stats.mtimeNs === identity.modificationTime
    );
  } catch {
    return false;
  }
}

async function parentDirectoriesAreSafe(
  rootIdentity: PathIdentity,
  path: string,
): Promise<boolean> {
  const parent = dirname(path);
  const relativeParent = parent
    .slice(rootIdentity.path.length)
    .replace(/^[/\\]/u, "");
  let current = rootIdentity.path;

  for (const segment of relativeParent.length === 0
    ? []
    : relativeParent.split(sep)) {
    current = join(current, segment);
    try {
      const stats = await lstat(current);
      if (stats.isSymbolicLink() || !stats.isDirectory()) {
        return false;
      }
    } catch {
      return false;
    }
  }

  return identityMatches(rootIdentity);
}

async function prepareChange(
  rootIdentity: PathIdentity,
  change: CapabilityRemovalFileChange,
): Promise<PreparedChange | undefined> {
  const target = join(rootIdentity.path, change.path);
  if (!(await parentDirectoriesAreSafe(rootIdentity, target))) {
    return undefined;
  }

  let handle;
  try {
    handle = await open(target, constants.O_RDONLY | constants.O_NOFOLLOW);
    const stats = await handle.stat({ bigint: true });
    if (stats.isSymbolicLink() || !stats.isFile()) {
      return undefined;
    }
    const content = await handle.readFile();
    return sameBytes(content, change.expected)
      ? {
          change,
          target,
          identity: {
            path: target,
            device: stats.dev,
            inode: stats.ino,
            mode: Number(stats.mode & 0o777n),
            size: stats.size,
            changeTime: stats.ctimeNs,
            modificationTime: stats.mtimeNs,
          },
        }
      : undefined;
  } catch {
    return undefined;
  } finally {
    await handle?.close().catch(() => undefined);
  }
}

function samePreparedIdentity(
  initial: PreparedChange,
  current: PreparedChange,
): boolean {
  return (
    current.identity.device === initial.identity.device &&
    current.identity.inode === initial.identity.inode &&
    current.identity.mode === initial.identity.mode
  );
}

async function removeOwnedTemporary(identity: FileIdentity): Promise<boolean> {
  if (!(await fileIdentityMatches(identity))) {
    return false;
  }

  try {
    await unlink(identity.path);
    return true;
  } catch {
    return false;
  }
}

async function createTemporaryFile(
  prepared: PreparedChange & Readonly<{
    change: Extract<CapabilityRemovalFileChange, { kind: "replace-file" }>;
  }>,
): Promise<
  | Readonly<{ ok: true; identity: FileIdentity }>
  | Readonly<{ ok: false; sourceChanged: boolean }>
> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const path = join(
      dirname(prepared.target),
      `.egeria-removal-${randomUUID()}.tmp`,
    );
    let handle;
    try {
      handle = await open(path, "wx", prepared.identity.mode);
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "EEXIST") {
        continue;
      }
      return { ok: false, sourceChanged: false };
    }

    let identity: FileIdentity | undefined;
    try {
      const stats = await handle.stat({ bigint: true });
      if (stats.isSymbolicLink() || !stats.isFile()) {
        throw new Error("temporary-file-invalid");
      }
      await handle.chmod(prepared.identity.mode);
      await handle.writeFile(prepared.change.content);
      await handle.sync();
      const finalStats = await handle.stat({ bigint: true });
      identity = {
        path,
        device: finalStats.dev,
        inode: finalStats.ino,
        mode: Number(finalStats.mode & 0o777n),
        size: finalStats.size,
        changeTime: finalStats.ctimeNs,
        modificationTime: finalStats.mtimeNs,
      };
      await handle.close();
      handle = undefined;
      return { ok: true, identity };
    } catch {
      await handle?.close().catch(() => undefined);
      return {
        ok: false,
        sourceChanged:
          identity === undefined || !(await removeOwnedTemporary(identity)),
      };
    }
  }

  return { ok: false, sourceChanged: false };
}

async function targetStillMatches(
  rootIdentity: PathIdentity,
  prepared: PreparedChange,
): Promise<boolean> {
  const current = await prepareChange(rootIdentity, prepared.change);
  return (
    current !== undefined &&
    samePreparedIdentity(prepared, current) &&
    (await parentDirectoriesAreSafe(rootIdentity, prepared.target))
  );
}

async function replacePreparedFile(
  rootIdentity: PathIdentity,
  prepared: PreparedChange & Readonly<{
    change: Extract<CapabilityRemovalFileChange, { kind: "replace-file" }>;
  }>,
  hooks: CapabilityRemovalWriterHooks,
): Promise<CapabilityRemovalWriteResult> {
  const temporary = await createTemporaryFile(prepared);
  if (!temporary.ok) {
    return temporary;
  }

  try {
    await hooks.beforeCommit?.(prepared.change.path);
  } catch {
    const targetChanged = !(await targetStillMatches(rootIdentity, prepared));
    const temporaryRemoved = await removeOwnedTemporary(temporary.identity);
    return {
      ok: false,
      sourceChanged: targetChanged || !temporaryRemoved,
    };
  }

  if (!(await targetStillMatches(rootIdentity, prepared))) {
    await removeOwnedTemporary(temporary.identity);
    return {
      ok: false,
      sourceChanged: true,
    };
  }

  try {
    await rename(temporary.identity.path, prepared.target);
    return { ok: true };
  } catch {
    return {
      ok: false,
      sourceChanged: !(await removeOwnedTemporary(temporary.identity)),
    };
  }
}

async function deletePreparedFile(
  rootIdentity: PathIdentity,
  prepared: PreparedChange,
  hooks: CapabilityRemovalWriterHooks,
): Promise<CapabilityRemovalWriteResult> {
  try {
    await hooks.beforeCommit?.(prepared.change.path);
  } catch {
    return {
      ok: false,
      sourceChanged: !(await targetStillMatches(rootIdentity, prepared)),
    };
  }

  if (!(await targetStillMatches(rootIdentity, prepared))) {
    return { ok: false, sourceChanged: true };
  }

  try {
    await unlink(prepared.target);
    return { ok: true };
  } catch {
    return {
      ok: false,
      sourceChanged: !(await targetStillMatches(rootIdentity, prepared)),
    };
  }
}

export function createFileSystemCapabilityRemovalWriter(
  root: string,
  hooks: CapabilityRemovalWriterHooks = {},
): CapabilityRemovalWriter {
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
          (change) =>
            !safeRelativePathSchema.safeParse(change.path).success ||
            !(change.expected instanceof Uint8Array) ||
            (change.kind === "replace-file" &&
              !(change.content instanceof Uint8Array)),
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
        const result = change.change.kind === "replace-file"
          ? await replacePreparedFile(
              rootIdentity,
              change as PreparedChange & Readonly<{
                change: Extract<
                  CapabilityRemovalFileChange,
                  { kind: "replace-file" }
                >;
              }>,
              hooks,
            )
          : await deletePreparedFile(rootIdentity, change, hooks);
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
