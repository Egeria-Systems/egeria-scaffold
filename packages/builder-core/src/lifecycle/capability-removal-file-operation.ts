import { constants, type BigIntStats } from "node:fs";
import { lstat, open, rename, unlink } from "node:fs/promises";

import {
  fileOperationRequestSchema,
  parseFileOperationResult,
  serializeFileIdentity,
  type FileOperationRequest,
  type FileOperationResult,
  type SerializedFileIdentity,
} from "./capability-removal-file-operation-protocol.js";

const maximumRequestBytes = 2 * 1024 * 1024;

async function readRequest(): Promise<FileOperationRequest> {
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  for await (const chunk of process.stdin as AsyncIterable<Uint8Array>) {
    const bytes = Buffer.from(chunk);
    totalBytes += bytes.length;
    if (totalBytes > maximumRequestBytes) {
      throw new TypeError("request-too-large");
    }
    chunks.push(bytes);
  }
  return fileOperationRequestSchema.parse(
    JSON.parse(Buffer.concat(chunks).toString("utf8")),
  );
}

function serializeIdentity(stats: BigIntStats): SerializedFileIdentity {
  return serializeFileIdentity({
    device: stats.dev,
    inode: stats.ino,
    mode: Number(stats.mode & 0o777n),
    size: stats.size,
    changeTime: stats.ctimeNs,
    modificationTime: stats.mtimeNs,
  });
}

function identityMatches(
  stats: BigIntStats,
  identity: SerializedFileIdentity,
): boolean {
  return (
    !stats.isSymbolicLink() &&
    stats.isFile() &&
    stats.dev === BigInt(identity.device) &&
    stats.ino === BigInt(identity.inode) &&
    Number(stats.mode & 0o777n) === identity.mode &&
    stats.size === BigInt(identity.size) &&
    stats.ctimeNs === BigInt(identity.changeTime) &&
    stats.mtimeNs === BigInt(identity.modificationTime)
  );
}

async function parentMatches(
  parent: FileOperationRequest["parent"],
): Promise<boolean> {
  try {
    const stats = await lstat(".", { bigint: true });
    return (
      stats.isDirectory() &&
      !stats.isSymbolicLink() &&
      stats.dev === BigInt(parent.device) &&
      stats.ino === BigInt(parent.inode)
    );
  } catch {
    return false;
  }
}

async function fileMatches(
  name: string,
  identity: SerializedFileIdentity,
  expected?: string,
): Promise<boolean> {
  let handle;
  try {
    handle = await open(name, constants.O_RDONLY | constants.O_NOFOLLOW);
    const stats = await handle.stat({ bigint: true });
    if (!identityMatches(stats, identity)) {
      return false;
    }
    return expected === undefined
      ? true
      : (await handle.readFile()).equals(Buffer.from(expected, "base64"));
  } catch {
    return false;
  } finally {
    await handle?.close().catch(() => undefined);
  }
}

async function createFile(
  operation: Extract<FileOperationRequest["operation"], { kind: "create" }>,
): Promise<FileOperationResult> {
  let handle;
  let created = false;
  try {
    handle = await open(operation.name, "wx", operation.mode);
    created = true;
    const initialStats = await handle.stat({ bigint: true });
    if (initialStats.isSymbolicLink() || !initialStats.isFile()) {
      throw new TypeError("invalid-created-file");
    }
    await handle.chmod(operation.mode);
    await handle.writeFile(Buffer.from(operation.content, "base64"));
    await handle.sync();
    const finalStats = await handle.stat({ bigint: true });
    const identity = serializeIdentity(finalStats);
    await handle.close();
    handle = undefined;
    return { ok: true, identity };
  } catch {
    await handle?.close().catch(() => undefined);
    // Node has no descriptor-relative unlink. Retain a created path so recovery
    // cannot delete a concurrent replacement after a pathname identity check.
    return { ok: false, sourceChanged: created };
  }
}

async function runOperation(
  request: FileOperationRequest,
): Promise<FileOperationResult> {
  if (!(await parentMatches(request.parent))) {
    return { ok: false, sourceChanged: false };
  }

  const operation = request.operation;
  if (operation.kind === "create") {
    return createFile(operation);
  }
  if (operation.kind === "remove") {
    if (!(await fileMatches(operation.name, operation.identity))) {
      return { ok: false, sourceChanged: true };
    }
    try {
      await unlink(operation.name);
      return { ok: true };
    } catch {
      return { ok: false, sourceChanged: true };
    }
  }
  if (operation.kind === "replace") {
    if (
      !(await fileMatches(
        operation.targetName,
        operation.targetIdentity,
        operation.expected,
      )) ||
      !(await fileMatches(
        operation.temporaryName,
        operation.temporaryIdentity,
      ))
    ) {
      return { ok: false, sourceChanged: true };
    }
    try {
      await rename(operation.temporaryName, operation.targetName);
      return { ok: true };
    } catch {
      return { ok: false, sourceChanged: true };
    }
  }

  if (
    !(await fileMatches(
      operation.targetName,
      operation.targetIdentity,
      operation.expected,
    ))
  ) {
    return { ok: false, sourceChanged: true };
  }
  try {
    await unlink(operation.targetName);
    return { ok: true };
  } catch {
    return {
      ok: false,
      sourceChanged: !(await fileMatches(
        operation.targetName,
        operation.targetIdentity,
        operation.expected,
      )),
    };
  }
}

const request = await readRequest().catch(() => undefined);
const result: FileOperationResult = request === undefined
  ? { ok: false, sourceChanged: false }
  : parseFileOperationResult(
      request.operation.kind,
      await runOperation(request).catch(() => undefined),
    ) ?? { ok: false, sourceChanged: true };
process.stdout.write(JSON.stringify(result));
