import {
  createFileSystemRepositoryReader,
  createPnpmGeneratedProjectVerifier,
  createVerifiedCapabilityCatalog,
  diffProject,
  doctorRepository,
  generateProject,
  inferRepository,
  profileRecipes,
  type GeneratedProjectVerifier,
  type RepositoryReader,
} from "@egeria-systems/builder-core";
import { resolve } from "node:path";

import { parseCliArguments, type CliCommand } from "./arguments.js";

export type CliOutput = Readonly<{
  write(value: string): void;
  writeError(value: string): void;
}>;

type CliRunnerDependencies = Readonly<{
  createVerifier(): GeneratedProjectVerifier;
  createReader?(root: string): RepositoryReader;
}>;

type CliRunner = (
  arguments_: readonly string[],
  output: CliOutput,
) => Promise<0 | 1 | 2>;

function writeJson(
  write: (value: string) => void,
  value: unknown,
): void {
  write(JSON.stringify(value));
}

function createCliRepositoryReader(root: string): RepositoryReader {
  const reader = createFileSystemRepositoryReader(root);

  return {
    async readText(path) {
      const result = await reader.readText(path);

      if (result.kind === "error" && result.code === "PATH_INVALID") {
        throw new TypeError("repository-open-failed");
      }

      return result;
    },
  };
}

async function runCreate(
  command: Extract<CliCommand, Readonly<{ kind: "create" }>>,
  output: CliOutput,
  dependencies: CliRunnerDependencies,
): Promise<0 | 1> {
  const result = await generateProject({
    request: {
      profile: command.profile,
      projectName: command.projectName,
      displayName: command.displayName,
    },
    destination: resolve(command.directory),
    verifier: dependencies.createVerifier(),
  });

  if (!result.ok) {
    writeJson(output.writeError, {
      ok: false,
      command: "create",
      issues: result.issues,
    });
    return 1;
  }

  writeJson(output.write, {
    ok: true,
    command: "create",
    destination: result.value.destination,
    profile: command.profile,
    capabilities: result.value.state.installedCapabilities.map(
      ({ identifier }) => identifier,
    ),
  });
  return 0;
}

async function runReadOnly(
  command: Extract<CliCommand, Readonly<{ kind: "infer" | "doctor" | "diff" }>>,
  output: CliOutput,
  catalog: ReturnType<typeof createVerifiedCapabilityCatalog> & {
    ok: true;
  },
  dependencies: CliRunnerDependencies,
): Promise<0 | 1> {
  try {
    const reader = (dependencies.createReader ??
      createCliRepositoryReader)(resolve(command.directory));
    if (command.kind === "infer") {
      const result = await inferRepository({ reader, catalog: catalog.value });
      writeJson(output.write, { ok: true, command: "infer", result });
      return 0;
    }

    if (command.kind === "doctor") {
      const result = await doctorRepository({
        reader,
        catalog: catalog.value,
        profiles: profileRecipes,
      });
      writeJson(output.write, { ok: true, command: "doctor", result });
      return result.healthy ? 0 : 1;
    }

    const result = await diffProject({
      reader,
      catalog: catalog.value,
      profiles: profileRecipes,
    });
    writeJson(output.write, { ok: true, command: "diff", result });
    return result.equal ? 0 : 1;
  } catch {
    writeJson(output.writeError, {
      ok: false,
      code: "REPOSITORY_OPEN_FAILED",
    });
    return 1;
  }
}

export function createCliRunner(
  dependencies: CliRunnerDependencies,
): CliRunner {
  return async (arguments_, output) => {
    const parsed = parseCliArguments(arguments_);

    if (!parsed.ok) {
      writeJson(output.writeError, {
        ok: false,
        code: "CLI_ARGUMENT_INVALID",
      });
      return 2;
    }

    if (parsed.value.kind === "create") {
      try {
        return await runCreate(parsed.value, output, dependencies);
      } catch {
        writeJson(output.writeError, {
          ok: false,
          code: "PROJECT_GENERATION_FAILED",
        });
        return 1;
      }
    }

    const catalog = createVerifiedCapabilityCatalog();
    if (!catalog.ok) {
      writeJson(output.writeError, {
        ok: false,
        code: "VERIFIED_CATALOG_INVALID",
      });
      return 1;
    }

    return runReadOnly(parsed.value, output, catalog, dependencies);
  };
}

const productionRunner = createCliRunner({
  createVerifier: () =>
    createPnpmGeneratedProjectVerifier({ pnpmExecutable: "pnpm" }),
});

export async function runCli(
  arguments_: readonly string[],
  output: CliOutput,
): Promise<0 | 1 | 2> {
  return productionRunner(arguments_, output);
}
