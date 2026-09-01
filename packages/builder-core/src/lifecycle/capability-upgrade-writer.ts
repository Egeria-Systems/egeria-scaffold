import { createFileSystemAtomicFileChangeWriter } from "./atomic-file-change-writer.js";

export type CapabilityUpgradeFileChange = Readonly<{
  path: string;
  expected:
    | Readonly<{ kind: "missing" }>
    | Readonly<{ kind: "file"; content: Uint8Array }>;
  content: Uint8Array;
}>;

export type CapabilityUpgradeWriteResult =
  | Readonly<{ ok: true }>
  | Readonly<{ ok: false; sourceChanged: boolean }>;

export interface CapabilityUpgradeWriter {
  write(
    changes: readonly CapabilityUpgradeFileChange[],
  ): Promise<CapabilityUpgradeWriteResult>;
}

type CapabilityUpgradeWriterHooks = Readonly<{
  beforeParentCreation?: (path: string) => Promise<unknown>;
  beforeCommit?: (path: string) => Promise<unknown>;
}>;

export function createFileSystemCapabilityUpgradeWriter(
  root: string,
  hooks: CapabilityUpgradeWriterHooks = {},
): CapabilityUpgradeWriter {
  return createFileSystemAtomicFileChangeWriter(
    root,
    ".egeria-upgrade-",
    hooks,
  );
}
