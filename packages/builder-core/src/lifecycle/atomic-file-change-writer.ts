import { randomUUID } from "node:crypto";
import { constants, lstatSync } from "node:fs";
import { link, lstat, mkdir, open, rename, unlink } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve, sep } from "node:path";

import { safeRelativePathSchema } from "../contracts/identifiers.js";

export type AtomicFileChange = Readonly<{
  path: string;
  expected:
    | Readonly<{ kind: "missing" }>
    | Readonly<{ kind: "file"; content: Uint8Array }>;
  content: Uint8Array;
}>;

export type AtomicFileWriteResult =
  | Readonly<{ ok: true }>
  | Readonly<{ ok: false; sourceChanged: boolean }>;

export interface AtomicFileChangeWriter {
  write(
    changes: readonly AtomicFileChange[],
  ): Promise<AtomicFileWriteResult>;
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
  change: AtomicFileChange;
  target: string;
  ancestor: PathIdentity;
  identity?: FileIdentity;
}>;

type AtomicFileChangeWriterHooks = Readonly<{
  beforeParentCreation?: (path: string) => Promise<unknown>;
  beforeCommit?: (path: string) => Promise<unknown>;
}>;

type ParentInspection =
  | Readonly<{ kind: "existing"; identity: PathIdentity }>
  | Readonly<{ kind: "missing"; identity: PathIdentity }>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
  return (
    left.length === right.length &&
    left.every((byte, index) => byte === right[index])
  );
}

function samePathIdentity(left: PathIdentity, right: PathIdentity): boolean {
  return left.device === right.device && left.inode === right.inode;
}

function sameFileIdentity(left: FileIdentity, right: FileIdentity): boolean {
  return (
    samePathIdentity(left, right) &&
    left.mode === right.mode &&
    left.size === right.size &&
    left.changeTime === right.changeTime &&
    left.modificationTime === right.modificationTime
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
      stats.isDirectory() &&
      stats.dev === identity.device &&
      stats.ino === identity.inode
    );
  } catch {
    return false;
  }
}

async function inspectParentPath(
  rootIdentity: PathIdentity,
  target: string,
): Promise<ParentInspection | undefined> {
  const parent = dirname(target);
  const relativeParent = parent
    .slice(rootIdentity.path.length)
    .replace(/^[/\\]/u, "");
  let current = rootIdentity.path;
  let currentIdentity = rootIdentity;
  let missing = false;

  for (const segment of relativeParent.length === 0
    ? []
    : relativeParent.split(sep)) {
    current = join(current, segment);
    if (missing) {
      continue;
    }
    try {
      const stats = await lstat(current, { bigint: true });
      if (stats.isSymbolicLink() || !stats.isDirectory()) {
        return undefined;
      }
      currentIdentity = {
        path: current,
        device: stats.dev,
        inode: stats.ino,
      };
    } catch (error) {
      if (
        !(error instanceof Error && "code" in error && error.code === "ENOENT")
      ) {
        return undefined;
      }
      missing = true;
    }
  }

  if (!(await identityMatches(rootIdentity))) {
    return undefined;
  }
  return missing
    ? { kind: "missing", identity: currentIdentity }
    : { kind: "existing", identity: currentIdentity };
}

async function readExpectedFile(
  path: string,
  expected: Uint8Array,
): Promise<FileIdentity | undefined> {
  let handle;
  try {
    handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    const stats = await handle.stat({ bigint: true });
    if (stats.isSymbolicLink() || !stats.isFile()) {
      return undefined;
    }
    const content = await handle.readFile();
    return sameBytes(content, expected)
      ? {
          path,
          device: stats.dev,
          inode: stats.ino,
          mode: Number(stats.mode & 0o777n),
          size: stats.size,
          changeTime: stats.ctimeNs,
          modificationTime: stats.mtimeNs,
        }
      : undefined;
  } catch {
    return undefined;
  } finally {
    await handle?.close().catch(() => undefined);
  }
}

async function prepareChange(
  rootIdentity: PathIdentity,
  change: AtomicFileChange,
): Promise<PreparedChange | undefined> {
  const target = join(rootIdentity.path, change.path);
  const parent = await inspectParentPath(rootIdentity, target);
  if (parent === undefined) {
    return undefined;
  }

  if (change.expected.kind === "missing") {
    if (parent.kind === "missing") {
      return { change, target, ancestor: parent.identity };
    }
    try {
      await lstat(target);
      return undefined;
    } catch (error) {
      return error instanceof Error && "code" in error && error.code === "ENOENT"
        ? { change, target, ancestor: parent.identity }
        : undefined;
    }
  }

  if (parent.kind === "missing") {
    return undefined;
  }
  const identity = await readExpectedFile(target, change.expected.content);
  const confirmedParent = await inspectParentPath(rootIdentity, target);
  return identity !== undefined &&
    confirmedParent?.kind === "existing" &&
    samePathIdentity(parent.identity, confirmedParent.identity)
    ? { change, target, ancestor: confirmedParent.identity, identity }
    : undefined;
}

function validChange(value: unknown): value is AtomicFileChange {
  if (!isRecord(value) || !isRecord(value.expected)) {
    return false;
  }
  return (
    safeRelativePathSchema.safeParse(value.path).success &&
    value.content instanceof Uint8Array &&
    (value.expected.kind === "missing" ||
      (value.expected.kind === "file" &&
        value.expected.content instanceof Uint8Array))
  );
}

function targetPathsConflict(
  changes: readonly AtomicFileChange[],
): boolean {
  const targets = new Set(changes.map(({ path }) => path));
  if (targets.size !== changes.length) {
    return true;
  }
  for (const path of targets) {
    for (
      let separator = path.indexOf("/");
      separator >= 0;
      separator = path.indexOf("/", separator + 1)
    ) {
      if (targets.has(path.slice(0, separator))) {
        return true;
      }
    }
  }
  return false;
}

async function ensureParentDirectories(
  rootIdentity: PathIdentity,
  target: string,
  expectedAncestor: PathIdentity,
): Promise<
  | Readonly<{ ok: true; parent: PathIdentity; sourceChanged: boolean }>
  | Readonly<{ ok: false; sourceChanged: boolean }>
> {
  const parent = dirname(target);
  const relativeParent = parent
    .slice(rootIdentity.path.length)
    .replace(/^[/\\]/u, "");
  let current = rootIdentity.path;
  let currentIdentity = rootIdentity;
  let sourceChanged = false;

  if (
    !(await identityMatches(rootIdentity)) ||
    !(await identityMatches(expectedAncestor))
  ) {
    return { ok: false, sourceChanged: false };
  }

  for (const segment of relativeParent.length === 0
    ? []
    : relativeParent.split(sep)) {
    current = join(current, segment);
    try {
      const stats = await lstat(current, { bigint: true });
      if (stats.isSymbolicLink() || !stats.isDirectory()) {
        return { ok: false, sourceChanged };
      }
      currentIdentity = {
        path: current,
        device: stats.dev,
        inode: stats.ino,
      };
      if (
        current === expectedAncestor.path &&
        !samePathIdentity(currentIdentity, expectedAncestor)
      ) {
        return { ok: false, sourceChanged };
      }
    } catch (error) {
      if (
        !(error instanceof Error && "code" in error && error.code === "ENOENT")
      ) {
        return { ok: false, sourceChanged };
      }
      if (
        !(await identityMatches(currentIdentity)) ||
        !(await identityMatches(expectedAncestor))
      ) {
        return { ok: false, sourceChanged };
      }
      try {
        await mkdir(current, { mode: 0o755 });
        sourceChanged = true;
        const stats = await lstat(current, { bigint: true });
        if (stats.isSymbolicLink() || !stats.isDirectory()) {
          return { ok: false, sourceChanged: true };
        }
        currentIdentity = {
          path: current,
          device: stats.dev,
          inode: stats.ino,
        };
        if (!(await identityMatches(expectedAncestor))) {
          return { ok: false, sourceChanged: true };
        }
      } catch {
        return { ok: false, sourceChanged };
      }
    }
  }

  const confirmed = await inspectParentPath(rootIdentity, target);
  return confirmed?.kind === "existing" &&
    (await identityMatches(expectedAncestor)) &&
    samePathIdentity(currentIdentity, confirmed.identity)
    ? { ok: true, parent: confirmed.identity, sourceChanged }
    : { ok: false, sourceChanged };
}

async function fileStillMatches(identity: FileIdentity): Promise<boolean> {
  let handle;
  try {
    handle = await open(
      identity.path,
      constants.O_RDONLY | constants.O_NOFOLLOW,
    );
    const stats = await handle.stat({ bigint: true });
    return sameFileIdentity(identity, {
      path: identity.path,
      device: stats.dev,
      inode: stats.ino,
      mode: Number(stats.mode & 0o777n),
      size: stats.size,
      changeTime: stats.ctimeNs,
      modificationTime: stats.mtimeNs,
    });
  } catch {
    return false;
  } finally {
    await handle?.close().catch(() => undefined);
  }
}

async function removeOwnedTemporary(identity: FileIdentity): Promise<boolean> {
  if (!(await fileStillMatches(identity))) {
    return false;
  }
  try {
    await unlink(identity.path);
    return true;
  } catch {
    return false;
  }
}

async function removeInstalledTemporary(
  identity: FileIdentity,
  expected: Uint8Array,
): Promise<boolean> {
  let handle;
  try {
    handle = await open(
      identity.path,
      constants.O_RDONLY | constants.O_NOFOLLOW,
    );
    const stats = await handle.stat({ bigint: true });
    const content = await handle.readFile();
    if (
      stats.isSymbolicLink() ||
      !stats.isFile() ||
      stats.dev !== identity.device ||
      stats.ino !== identity.inode ||
      Number(stats.mode & 0o777n) !== identity.mode ||
      stats.size !== identity.size ||
      stats.mtimeNs !== identity.modificationTime ||
      !sameBytes(content, expected)
    ) {
      return false;
    }
  } catch {
    return false;
  } finally {
    await handle?.close().catch(() => undefined);
  }
  try {
    await unlink(identity.path);
    return true;
  } catch {
    return false;
  }
}

async function createTemporaryFile(
  prepared: PreparedChange,
  temporaryFilePrefix: string,
): Promise<
  | Readonly<{ ok: true; identity: FileIdentity }>
  | Readonly<{ ok: false; sourceChanged: boolean }>
> {
  const mode = prepared.identity?.mode ?? 0o644;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const path = join(
      dirname(prepared.target),
      `${temporaryFilePrefix}${randomUUID()}.tmp`,
    );
    let handle;
    try {
      handle = await open(path, "wx", mode);
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "EEXIST") {
        continue;
      }
      return { ok: false, sourceChanged: false };
    }

    let identity: FileIdentity | undefined;
    try {
      const initialStats = await handle.stat({ bigint: true });
      if (initialStats.isSymbolicLink() || !initialStats.isFile()) {
        throw new TypeError("temporary-file-invalid");
      }
      identity = {
        path,
        device: initialStats.dev,
        inode: initialStats.ino,
        mode,
        size: initialStats.size,
        changeTime: initialStats.ctimeNs,
        modificationTime: initialStats.mtimeNs,
      };
      await handle.chmod(mode);
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

function samePreparedChange(
  initial: PreparedChange,
  current: PreparedChange,
): boolean {
  return initial.identity === undefined
    ? current.identity === undefined
    : current.identity !== undefined &&
        sameFileIdentity(initial.identity, current.identity);
}

async function writePreparedChange(
  rootIdentity: PathIdentity,
  prepared: PreparedChange,
  temporaryFilePrefix: string,
  hooks: AtomicFileChangeWriterHooks,
): Promise<AtomicFileWriteResult> {
  try {
    await hooks.beforeParentCreation?.(prepared.change.path);
  } catch {
    return { ok: false, sourceChanged: false };
  }
  const parentResult = await ensureParentDirectories(
    rootIdentity,
    prepared.target,
    prepared.ancestor,
  );
  if (!parentResult.ok) {
    return parentResult;
  }

  const temporary = await createTemporaryFile(prepared, temporaryFilePrefix);
  if (!temporary.ok) {
    return {
      ok: false,
      sourceChanged:
        parentResult.sourceChanged || temporary.sourceChanged,
    };
  }

  const failBeforeInstall = async (
    operationChanged = false,
  ): Promise<AtomicFileWriteResult> => ({
    ok: false,
    sourceChanged:
      parentResult.sourceChanged ||
      operationChanged ||
      !(await removeOwnedTemporary(temporary.identity)),
  });

  try {
    await hooks.beforeCommit?.(prepared.change.path);
  } catch {
    return failBeforeInstall();
  }

  const currentTemporary = await readExpectedFile(
    temporary.identity.path,
    prepared.change.content,
  );
  if (
    currentTemporary === undefined ||
    !sameFileIdentity(temporary.identity, currentTemporary)
  ) {
    return failBeforeInstall();
  }

  const current = await prepareChange(rootIdentity, prepared.change);
  if (
    current === undefined ||
    !samePreparedChange(prepared, current) ||
    !(await identityMatches(prepared.ancestor)) ||
    !samePathIdentity(parentResult.parent, current.ancestor)
  ) {
    return failBeforeInstall();
  }

  if (prepared.identity === undefined) {
    try {
      await link(temporary.identity.path, prepared.target);
    } catch (error) {
      return failBeforeInstall(
        !(error instanceof Error && "code" in error && error.code === "EEXIST"),
      );
    }
    return (await removeInstalledTemporary(
      temporary.identity,
      prepared.change.content,
    ))
      ? { ok: true }
      : { ok: false, sourceChanged: true };
  }

  try {
    await rename(temporary.identity.path, prepared.target);
    return { ok: true };
  } catch {
    await removeOwnedTemporary(temporary.identity);
    return { ok: false, sourceChanged: true };
  }
}

export function createFileSystemAtomicFileChangeWriter(
  root: string,
  temporaryFilePrefix: string,
  hooks: AtomicFileChangeWriterHooks = {},
): AtomicFileChangeWriter {
  const fixedRoot = resolve(root);
  const rootIdentity =
    isAbsolute(root) && fixedRoot === root ? captureRoot(fixedRoot) : undefined;

  return {
    async write(changes) {
      if (
        rootIdentity === undefined ||
        changes.length === 0 ||
        changes.some((change) => !validChange(change)) ||
        targetPathsConflict(changes) ||
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
        const result = await writePreparedChange(
          rootIdentity,
          change,
          temporaryFilePrefix,
          hooks,
        );
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
