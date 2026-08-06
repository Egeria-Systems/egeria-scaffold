import type {
  RepositoryReader,
  RepositoryReadResult,
} from "./repository-reader.js";

export function createCachingRepositoryReader(
  reader: RepositoryReader,
): RepositoryReader {
  const reads = new Map<string, Promise<RepositoryReadResult>>();

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
  };
}
