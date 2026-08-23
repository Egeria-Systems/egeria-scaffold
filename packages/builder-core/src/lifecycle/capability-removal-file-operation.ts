import { constants, type BigIntStats } from "node:fs";
import { lstat, open, rename, unlink } from "node:fs/promises";

const maximumRequestBytes = 2 * 1024 * 1024;

type SerializedIdentity = Readonly<{
  device: string;
  inode: string;
  mode: number;
  size: string;
  changeTime: string;
  modificationTime: string;
}>;

type OperationRequest = Readonly<{
  parent: Readonly<{ device: string; inode: string }>;
  operation:
    | Readonly<{
        kind: "create";
        name: string;
        mode: number;
        content: string;
      }>
    | Readonly<{
        kind: "remove";
        name: string;
        identity: SerializedIdentity;
      }>
    | Readonly<{
        kind: "replace";
        targetName: string;
        targetIdentity: SerializedIdentity;
        expected: string;
        temporaryName: string;
        temporaryIdentity: SerializedIdentity;
      }>
    | Readonly<{
        kind: "delete";
        targetName: string;
        targetIdentity: SerializedIdentity;
        expected: string;
      }>;
}>;

type OperationResult =
  | Readonly<{ ok: true; identity?: SerializedIdentity }>
  | Readonly<{ ok: false; sourceChanged: boolean }>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseDecimal(value: unknown): string {
  if (typeof value !== "string" || !/^(?:0|[1-9][0-9]*)$/u.test(value)) {
    throw new TypeError("invalid-decimal");
  }
  return value;
}

function parseMode(value: unknown): number {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 0 ||
    value > 0o777
  ) {
    throw new TypeError("invalid-mode");
  }
  return value;
}

function parseName(value: unknown): string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value === "." ||
    value === ".." ||
    value.includes("/") ||
    value.includes("\\") ||
    value.includes("\0")
  ) {
    throw new TypeError("invalid-name");
  }
  return value;
}

function parseBytes(value: unknown): string {
  if (typeof value !== "string") {
    throw new TypeError("invalid-bytes");
  }
  const bytes = Buffer.from(value, "base64");
  if (bytes.toString("base64") !== value) {
    throw new TypeError("invalid-bytes");
  }
  return value;
}

function parseIdentity(value: unknown): SerializedIdentity {
  if (!isRecord(value)) {
    throw new TypeError("invalid-identity");
  }
  return {
    device: parseDecimal(value.device),
    inode: parseDecimal(value.inode),
    mode: parseMode(value.mode),
    size: parseDecimal(value.size),
    changeTime: parseDecimal(value.changeTime),
    modificationTime: parseDecimal(value.modificationTime),
  };
}

function parseRequest(value: unknown): OperationRequest {
  if (!isRecord(value) || !isRecord(value.parent) || !isRecord(value.operation)) {
    throw new TypeError("invalid-request");
  }
  const parent = {
    device: parseDecimal(value.parent.device),
    inode: parseDecimal(value.parent.inode),
  };
  const operation = value.operation;
  switch (operation.kind) {
    case "create":
      return {
        parent,
        operation: {
          kind: "create",
          name: parseName(operation.name),
          mode: parseMode(operation.mode),
          content: parseBytes(operation.content),
        },
      };
    case "remove":
      return {
        parent,
        operation: {
          kind: "remove",
          name: parseName(operation.name),
          identity: parseIdentity(operation.identity),
        },
      };
    case "replace":
      return {
        parent,
        operation: {
          kind: "replace",
          targetName: parseName(operation.targetName),
          targetIdentity: parseIdentity(operation.targetIdentity),
          expected: parseBytes(operation.expected),
          temporaryName: parseName(operation.temporaryName),
          temporaryIdentity: parseIdentity(operation.temporaryIdentity),
        },
      };
    case "delete":
      return {
        parent,
        operation: {
          kind: "delete",
          targetName: parseName(operation.targetName),
          targetIdentity: parseIdentity(operation.targetIdentity),
          expected: parseBytes(operation.expected),
        },
      };
    default:
      throw new TypeError("invalid-operation");
  }
}

async function readRequest(): Promise<OperationRequest> {
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
  return parseRequest(JSON.parse(Buffer.concat(chunks).toString("utf8")));
}

function serializeIdentity(stats: BigIntStats): SerializedIdentity {
  return {
    device: stats.dev.toString(),
    inode: stats.ino.toString(),
    mode: Number(stats.mode & 0o777n),
    size: stats.size.toString(),
    changeTime: stats.ctimeNs.toString(),
    modificationTime: stats.mtimeNs.toString(),
  };
}

function identityMatches(
  stats: BigIntStats,
  identity: SerializedIdentity,
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
  parent: OperationRequest["parent"],
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
  identity: SerializedIdentity,
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
  operation: Extract<OperationRequest["operation"], { kind: "create" }>,
): Promise<OperationResult> {
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
    let cleanupIdentity: SerializedIdentity | undefined;
    try {
      cleanupIdentity =
        handle === undefined
          ? undefined
          : serializeIdentity(await handle.stat({ bigint: true }));
    } catch {
      cleanupIdentity = undefined;
    }
    await handle?.close().catch(() => undefined);
    if (
      created &&
      cleanupIdentity !== undefined &&
      (await fileMatches(operation.name, cleanupIdentity))
    ) {
      await unlink(operation.name).catch(() => undefined);
    }
    return { ok: false, sourceChanged: created };
  }
}

async function runOperation(request: OperationRequest): Promise<OperationResult> {
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

const result = await readRequest()
  .then(runOperation)
  .catch((): OperationResult => ({ ok: false, sourceChanged: false }));
process.stdout.write(JSON.stringify(result));
