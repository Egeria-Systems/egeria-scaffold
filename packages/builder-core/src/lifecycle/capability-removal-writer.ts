import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { constants, lstatSync } from "node:fs";
import { lstat, open } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { safeRelativePathSchema } from "../contracts/identifiers.js";
import {
  fileOperationRequestSchema,
  parseFileOperationResult,
  serializeFileIdentity,
  type FileOperation,
  type FileOperationResult,
  type SerializedFileIdentity,
} from "./capability-removal-file-operation-protocol.js";

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
  parent: PathIdentity;
  identity: FileIdentity;
}>;

type CapabilityRemovalWriterHooks = Readonly<{
  beforeCommit?: (path: string) => Promise<unknown>;
  beforeMutation?: (path: string) => Promise<unknown>;
}>;

const fileOperationPath = fileURLToPath(
  new URL("./capability-removal-file-operation.js", import.meta.url),
);
const maximumOperationOutputBytes = 4 * 1024;
const execFileAsync = promisify(execFile);

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

async function captureParentDirectory(
  rootIdentity: PathIdentity,
  path: string,
): Promise<PathIdentity | undefined> {
  const parent = dirname(path);
  const relativeParent = parent
    .slice(rootIdentity.path.length)
    .replace(/^[/\\]/u, "");
  let current = rootIdentity.path;
  let currentIdentity = rootIdentity;

  for (const segment of relativeParent.length === 0
    ? []
    : relativeParent.split(sep)) {
    current = join(current, segment);
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
    } catch {
      return undefined;
    }
  }

  return (await identityMatches(rootIdentity)) ? currentIdentity : undefined;
}

async function prepareChange(
  rootIdentity: PathIdentity,
  change: CapabilityRemovalFileChange,
): Promise<PreparedChange | undefined> {
  const target = join(rootIdentity.path, change.path);
  const parent = await captureParentDirectory(rootIdentity, target);
  if (parent === undefined) {
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
          parent,
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

function samePathIdentity(left: PathIdentity, right: PathIdentity): boolean {
  return left.device === right.device && left.inode === right.inode;
}

function parseSerializedIdentity(
  value: SerializedFileIdentity,
  path: string,
): FileIdentity {
  return {
    path,
    device: BigInt(value.device),
    inode: BigInt(value.inode),
    mode: value.mode,
    size: BigInt(value.size),
    changeTime: BigInt(value.changeTime),
    modificationTime: BigInt(value.modificationTime),
  };
}

async function runFileOperation(
  parent: PathIdentity,
  operation: FileOperation,
): Promise<FileOperationResult> {
  let childSpawned = false;
  let result: FileOperationResult | undefined;
  try {
    const request = fileOperationRequestSchema.parse({
      parent: {
        device: parent.device.toString(),
        inode: parent.inode.toString(),
      },
      operation,
    });
    const message = JSON.stringify(request);
    const execution = execFileAsync(process.execPath, [fileOperationPath], {
      cwd: parent.path,
      env: {},
      encoding: "buffer",
      maxBuffer: maximumOperationOutputBytes,
      shell: false,
      timeout: 5_000,
      windowsHide: true,
    });
    execution.child.once("spawn", () => {
      childSpawned = true;
    });
    execution.child.stdin?.on("error", () => undefined);
    execution.child.stdin?.end(message);

    const { stdout } = await execution;
    result = parseFileOperationResult(
      operation.kind,
      JSON.parse(stdout.toString("utf8")) as unknown,
    );
  } catch {
    // A helper that started may have changed files before its reply was lost.
  }
  return result ?? { ok: false, sourceChanged: childSpawned };
}

async function removeOwnedTemporary(
  parent: PathIdentity,
  identity: FileIdentity,
): Promise<boolean> {
  const result = await runFileOperation(parent, {
    kind: "remove",
    name: basename(identity.path),
    identity: serializeFileIdentity(identity),
  });
  return result.ok;
}

async function createTemporaryFile(
  prepared: PreparedChange & Readonly<{
    change: Extract<CapabilityRemovalFileChange, { kind: "replace-file" }>;
  }>,
): Promise<
  | Readonly<{ ok: true; identity: FileIdentity }>
  | Readonly<{ ok: false; sourceChanged: boolean }>
> {
  const name = `.egeria-removal-${randomUUID()}.tmp`;
  const path = join(prepared.parent.path, name);
  const result = await runFileOperation(prepared.parent, {
    kind: "create",
    name,
    mode: prepared.identity.mode,
    content: Buffer.from(prepared.change.content).toString("base64"),
  });
  if (!result.ok) {
    return result;
  }
  if (!("identity" in result)) {
    return { ok: false, sourceChanged: true };
  }
  const identity = parseSerializedIdentity(result.identity, path);
  return { ok: true, identity };
}

async function targetStillMatches(
  rootIdentity: PathIdentity,
  prepared: PreparedChange,
): Promise<boolean> {
  const current = await prepareChange(rootIdentity, prepared.change);
  return (
    current !== undefined &&
    samePreparedIdentity(prepared, current) &&
    samePathIdentity(prepared.parent, current.parent)
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
    const temporaryRemoved = await removeOwnedTemporary(
      prepared.parent,
      temporary.identity,
    );
    return {
      ok: false,
      sourceChanged: targetChanged || !temporaryRemoved,
    };
  }

  if (!(await targetStillMatches(rootIdentity, prepared))) {
    await removeOwnedTemporary(prepared.parent, temporary.identity);
    return {
      ok: false,
      sourceChanged: true,
    };
  }

  try {
    await hooks.beforeMutation?.(prepared.change.path);
  } catch {
    const targetChanged = !(await targetStillMatches(rootIdentity, prepared));
    const temporaryRemoved = await removeOwnedTemporary(
      prepared.parent,
      temporary.identity,
    );
    return {
      ok: false,
      sourceChanged: targetChanged || !temporaryRemoved,
    };
  }

  const result = await runFileOperation(prepared.parent, {
    kind: "replace",
    targetName: basename(prepared.target),
    targetIdentity: serializeFileIdentity(prepared.identity),
    expected: Buffer.from(prepared.change.expected).toString("base64"),
    temporaryName: basename(temporary.identity.path),
    temporaryIdentity: serializeFileIdentity(temporary.identity),
  });
  if (result.ok) {
    return result;
  }
  const temporaryRemoved = await removeOwnedTemporary(
    prepared.parent,
    temporary.identity,
  );
  return {
    ok: false,
    sourceChanged: result.sourceChanged || !temporaryRemoved,
  };
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
    await hooks.beforeMutation?.(prepared.change.path);
  } catch {
    return {
      ok: false,
      sourceChanged: !(await targetStillMatches(rootIdentity, prepared)),
    };
  }

  const result = await runFileOperation(prepared.parent, {
    kind: "delete",
    targetName: basename(prepared.target),
    targetIdentity: serializeFileIdentity(prepared.identity),
    expected: Buffer.from(prepared.change.expected).toString("base64"),
  });
  return result.ok
    ? result
    : {
        ok: false,
        sourceChanged:
          result.sourceChanged ||
          !(await targetStillMatches(rootIdentity, prepared)),
      };
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
