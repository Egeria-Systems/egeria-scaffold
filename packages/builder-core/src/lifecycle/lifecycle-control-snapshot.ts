import type { RepositoryReader } from "../repository/repository-reader.js";
import {
  parseMigrationLog,
  parseProjectYaml,
  parseStateJson,
} from "../state/codecs.js";

export type ControlSnapshot = Readonly<{
  projectSource: string;
  stateSource: string;
  migrationSource: string;
  project: ReturnType<typeof parseProjectYaml> & Readonly<{ ok: true }>;
  state: ReturnType<typeof parseStateJson> & Readonly<{ ok: true }>;
  migrations: ReturnType<typeof parseMigrationLog> & Readonly<{ ok: true }>;
}>;

export async function readControlSnapshot(
  reader: RepositoryReader,
): Promise<ControlSnapshot | undefined> {
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

  const project = parseProjectYaml(projectRead.content);
  const state = parseStateJson(stateRead.content);
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
