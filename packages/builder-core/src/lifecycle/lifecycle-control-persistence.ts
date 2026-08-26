import type { MigrationRecord } from "../contracts/migration.js";
import type { InstalledState } from "../contracts/state.js";
import {
  parseMigrationLog,
  serializeMigrationRecord,
  serializeStateJson,
} from "../state/codecs.js";

const encoder = new TextEncoder();

type LifecycleControlPath =
  | ".egeria/migrations.jsonl"
  | ".egeria/state.json";

export type LifecycleControlFileChange = Readonly<{
  path: LifecycleControlPath;
  expected: Uint8Array;
  content: Uint8Array;
}>;

type LifecycleControlWriter = (
  change: LifecycleControlFileChange,
) => Promise<boolean>;

export type PreparedMigrationRecord = Readonly<{
  currentSource: string;
  source: string;
  content: Uint8Array;
  expectedIdentifiers: readonly string[];
}>;

type LifecycleControlPersistenceResult =
  | Readonly<{ ok: false }>
  | Readonly<{
      ok: true;
      source: string;
      content: Uint8Array;
    }>;

function sameValues(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

export function prepareMigrationRecord(input: Readonly<{
  currentSource: string;
  currentIdentifiers: readonly string[];
  record: MigrationRecord;
}>): PreparedMigrationRecord {
  const separator =
    input.currentSource.length > 0 && !input.currentSource.endsWith("\n")
      ? "\n"
      : "";
  const source = `${input.currentSource}${separator}${serializeMigrationRecord(input.record)}`;

  return {
    currentSource: input.currentSource,
    source,
    content: encoder.encode(source),
    expectedIdentifiers: [...input.currentIdentifiers, input.record.identifier],
  };
}

export async function persistMigrationRecord(input: Readonly<{
  prepared: PreparedMigrationRecord;
  write: LifecycleControlWriter;
  readSource: () => Promise<string | undefined>;
}>): Promise<LifecycleControlPersistenceResult> {
  const writeSucceeded = await input.write({
    path: ".egeria/migrations.jsonl",
    expected: encoder.encode(input.prepared.currentSource),
    content: input.prepared.content,
  });
  if (!writeSucceeded) {
    return { ok: false };
  }

  const writtenSource = await input.readSource();
  if (writtenSource !== input.prepared.source) {
    return { ok: false };
  }

  const parsed = parseMigrationLog(writtenSource);
  if (
    !parsed.ok ||
    !sameValues(
      parsed.value.map(({ identifier }) => identifier),
      input.prepared.expectedIdentifiers,
    )
  ) {
    return { ok: false };
  }

  return {
    ok: true,
    source: input.prepared.source,
    content: input.prepared.content,
  };
}

export async function persistInstalledState(input: Readonly<{
  currentSource: string;
  state: InstalledState;
  write: LifecycleControlWriter;
}>): Promise<LifecycleControlPersistenceResult> {
  const source = serializeStateJson(input.state);
  const content = encoder.encode(source);
  const writeSucceeded = await input.write({
    path: ".egeria/state.json",
    expected: encoder.encode(input.currentSource),
    content,
  });

  return writeSucceeded
    ? { ok: true, source, content }
    : { ok: false };
}
