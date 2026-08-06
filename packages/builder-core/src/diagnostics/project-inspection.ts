import type { CapabilityDescriptor } from "../contracts/capability.js";
import type { MigrationRecord } from "../contracts/migration.js";
import type { ProfileRecipe } from "../contracts/profile.js";
import type { ProjectConfiguration } from "../contracts/project.js";
import type {
  ContractIssue,
  ValidationResult,
} from "../contracts/result.js";
import {
  inferRepository,
  type RepositoryInference,
} from "../inference/infer-repository.js";
import {
  resolveCapabilities,
  type ResolvedCapabilities,
} from "../resolution/resolve-capabilities.js";
import { createCachingRepositoryReader } from "../repository/cache-reader.js";
import type { RepositoryReader } from "../repository/repository-reader.js";
import {
  parseMigrationLog,
  parseProjectYaml,
  parseStateJson,
} from "../state/codecs.js";

export const projectConfigurationPath = ".egeria/project.yaml";
export const statePath = ".egeria/state.json";
export const migrationLogPath = ".egeria/migrations.jsonl";

export type ControlFileEvidence<T> =
  | Readonly<{ kind: "valid"; value: T }>
  | Readonly<{ kind: "missing" }>
  | Readonly<{ kind: "invalid"; issues: readonly ContractIssue[] }>
  | Readonly<{ kind: "ambiguous"; code: string }>;

export type ProjectInspection = Readonly<{
  project: ControlFileEvidence<ProjectConfiguration>;
  migrations: ControlFileEvidence<readonly MigrationRecord[]>;
  inference: RepositoryInference;
  resolution?: ValidationResult<ResolvedCapabilities>;
}>;

type ControlFileParser<T> = (source: string) => ValidationResult<T>;

async function readControlFile<T>(
  reader: RepositoryReader,
  path: string,
  parse: ControlFileParser<T>,
): Promise<ControlFileEvidence<T>> {
  const result = await reader.readText(path);

  switch (result.kind) {
    case "missing":
      return { kind: "missing" };
    case "symlink":
      return { kind: "ambiguous", code: "PATH_SYMLINK" };
    case "error":
      return { kind: "ambiguous", code: result.code };
    case "file": {
      const parsed = parse(result.content);
      return parsed.ok
        ? { kind: "valid", value: parsed.value }
        : { kind: "invalid", issues: parsed.issues };
    }
  }
}

export async function inspectProject(input: Readonly<{
  reader: RepositoryReader;
  catalog: readonly CapabilityDescriptor[];
  profiles: readonly ProfileRecipe[];
}>): Promise<ProjectInspection> {
  const reader = createCachingRepositoryReader(input.reader);
  const project = await readControlFile(
    reader,
    projectConfigurationPath,
    parseProjectYaml,
  );
  const state = await readControlFile(
    reader,
    statePath,
    parseStateJson,
  );
  const migrations = await readControlFile(
    reader,
    migrationLogPath,
    parseMigrationLog,
  );
  const controlInference: RepositoryInference = {
    state,
    capabilities: [],
    surfaces: [],
  };

  if (project.kind !== "valid") {
    return { project, migrations, inference: controlInference };
  }

  const resolution = resolveCapabilities(
    {
      profile: project.value.originProfile,
      requestedCapabilities: project.value.selectedCapabilities,
    },
    input.catalog,
    input.profiles,
  );

  if (
    state.kind !== "valid" ||
    migrations.kind !== "valid" ||
    !resolution.ok
  ) {
    return {
      project,
      migrations,
      inference: controlInference,
      resolution,
    };
  }

  const inference = await inferRepository({ reader, catalog: input.catalog });

  return { project, migrations, inference, resolution };
}
