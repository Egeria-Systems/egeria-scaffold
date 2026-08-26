import type {
  RepositoryByteReadResult,
  RepositoryReader,
  RepositoryReadResult,
} from "./repository-reader.js";

export function createCachingRepositoryReader(
  reader: RepositoryReader,
): RepositoryReader {
  const reads = new Map<string, Promise<RepositoryReadResult>>();
  const byteReads = new Map<string, Promise<RepositoryByteReadResult>>();

  return {
    readText(path: string): Promise<RepositoryReadResult> {
      const prior = reads.get(path);

      if (prior !== undefined) {
        return prior;
      }

      const current = reader.readText(path);
      reads.set(path, current);
      return current;
    },
    ...(reader.readBytes === undefined
      ? {}
      : {
          readBytes(path: string): Promise<RepositoryByteReadResult> {
            const prior = byteReads.get(path);
            if (prior !== undefined) {
              return prior;
            }

            const current = reader.readBytes?.(path);
            if (current === undefined) {
              return Promise.resolve({ kind: "error", code: "READ_FAILED" });
            }
            byteReads.set(path, current);
            return current;
          },
        }),
  };
}
