import type { RepositoryReader } from "../repository/repository-reader.js";
import type { ApplicationEnvironmentProjectConfiguration, ProjectConfiguration } from "../contracts/project.js";
import type { ApplicationEnvironmentInstalledState, InstalledState } from "../contracts/state.js";
import {
  parseMigrationLog,
  parseProjectYaml,
  parseStateJson,
} from "../state/codecs.js";

export type ControlSnapshot<P = ProjectConfiguration, S = InstalledState> = Readonly<{
  projectSource: string;
  stateSource: string;
  migrationSource: string;
  project: Readonly<{ ok: true; value: P }>;
  state: Readonly<{ ok: true; value: S }>;
  migrations: ReturnType<typeof parseMigrationLog> & Readonly<{ ok: true }>;
}>;

export function readControlSnapshot(reader: RepositoryReader, projectSchemaVersion: "2.0.0"): Promise<ControlSnapshot<ApplicationEnvironmentProjectConfiguration, ApplicationEnvironmentInstalledState> | undefined>;
export function readControlSnapshot(reader: RepositoryReader): Promise<ControlSnapshot | undefined>;
export async function readControlSnapshot(
  reader: RepositoryReader,
  projectSchemaVersion?: "2.0.0",
): Promise<ControlSnapshot<ProjectConfiguration | ApplicationEnvironmentProjectConfiguration, InstalledState | ApplicationEnvironmentInstalledState> | undefined> {
  const [projectRead, stateRead, migrationsRead] = await Promise.all([
    reader.readText(".egeria/project.yaml"),
    reader.readText(".egeria/state.json"),
    reader.readText(".egeria/migrations.jsonl"),
  ]);

  if (
    projectRead.kind !== "file" ||
    stateRead.kind !== "file" ||
    migrationsRead.kind !== "file"
  ) {
    return undefined;
  }

  const project = projectSchemaVersion === "2.0.0" ? parseProjectYaml(projectRead.content, "2.0.0") : parseProjectYaml(projectRead.content);
  const state = projectSchemaVersion === "2.0.0" ? parseStateJson(stateRead.content, "2.0.0") : parseStateJson(stateRead.content);
  const migrations = parseMigrationLog(migrationsRead.content);

  return project.ok && state.ok && migrations.ok
    ? {
        projectSource: projectRead.content,
        stateSource: stateRead.content,
        migrationSource: migrationsRead.content,
        project,
        state,
        migrations,
      }
    : undefined;
}
