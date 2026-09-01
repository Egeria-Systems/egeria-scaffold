import { createFileSystemAtomicFileChangeWriter } from "./atomic-file-change-writer.js";

export type ProfileTransitionFileChange = Readonly<{
  path: string;
  expected:
    | Readonly<{ kind: "missing" }>
    | Readonly<{ kind: "file"; content: Uint8Array }>;
  content: Uint8Array;
}>;

export type ProfileTransitionWriteResult =
  | Readonly<{ ok: true }>
  | Readonly<{ ok: false; sourceChanged: boolean }>;

export interface ProfileTransitionWriter {
  write(
    changes: readonly ProfileTransitionFileChange[],
  ): Promise<ProfileTransitionWriteResult>;
}

type ProfileTransitionWriterHooks = Readonly<{
  beforeParentCreation?: (path: string) => Promise<unknown>;
  beforeCommit?: (path: string) => Promise<unknown>;
}>;

export function createFileSystemProfileTransitionWriter(
  root: string,
  hooks: ProfileTransitionWriterHooks = {},
): ProfileTransitionWriter {
  return createFileSystemAtomicFileChangeWriter(
    root,
    ".egeria-profile-transition-",
    hooks,
  );
}
