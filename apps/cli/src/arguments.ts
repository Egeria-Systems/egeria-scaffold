import {
  profileIdentifierSchema,
  projectConfigurationSchema,
  type ProfileIdentifier,
  type ValidationResult,
} from "@egeria-systems/builder-core";
import { parseArgs } from "node:util";

export type CliCommand =
  | Readonly<{
      kind: "create";
      profile: ProfileIdentifier;
      projectName: string;
      displayName: string;
      directory: string;
    }>
  | Readonly<{
      kind: "infer" | "doctor" | "diff";
      directory: string;
    }>;

const projectFields = projectConfigurationSchema
  .unwrap()
  .shape.project.unwrap().shape;

function invalidArguments(): ValidationResult<never> {
  return {
    ok: false,
    issues: [
      {
        code: "CLI_ARGUMENT_INVALID",
        path: [],
        context: { reason: "invalid-arguments" },
      },
    ],
  };
}

function hasExactOptions(
  tokens: readonly Readonly<{ kind: string; name?: string }>[],
  expectedNames: readonly string[],
): boolean {
  const optionNames = tokens.flatMap((token) =>
    token.kind === "option" && token.name !== undefined ? [token.name] : [],
  );

  return (
    optionNames.length === expectedNames.length &&
    new Set(optionNames).size === expectedNames.length &&
    expectedNames.every((name) => optionNames.includes(name))
  );
}

function validDirectory(value: string | undefined): value is string {
  return value !== undefined && value.length > 0 && !value.includes("\0");
}

function parseCreate(
  arguments_: readonly string[],
): ValidationResult<CliCommand> {
  try {
    const { values, tokens } = parseArgs({
      args: [...arguments_],
      options: {
        profile: { type: "string" },
        name: { type: "string" },
        "display-name": { type: "string" },
        directory: { type: "string" },
      },
      strict: true,
      allowPositionals: false,
      tokens: true,
    });
    const profile = values.profile;
    const projectName = values.name;
    const displayName = values["display-name"];
    const directory = values.directory;
    const parsedProfile = profileIdentifierSchema.safeParse(profile);
    const parsedProjectName = projectFields.name.safeParse(projectName);
    const parsedDisplayName = projectFields.displayName.safeParse(displayName);

    if (
      !hasExactOptions(tokens, [
        "profile",
        "name",
        "display-name",
        "directory",
      ]) ||
      !parsedProfile.success ||
      !parsedProjectName.success ||
      !parsedDisplayName.success ||
      !validDirectory(directory)
    ) {
      return invalidArguments();
    }

    return {
      ok: true,
      value: {
        kind: "create",
        profile: parsedProfile.data,
        projectName: parsedProjectName.data,
        displayName: parsedDisplayName.data,
        directory,
      },
    };
  } catch {
    return invalidArguments();
  }
}

function parseReadOnly(
  kind: "infer" | "doctor" | "diff",
  arguments_: readonly string[],
): ValidationResult<CliCommand> {
  try {
    const { values, tokens } = parseArgs({
      args: [...arguments_],
      options: { directory: { type: "string" } },
      strict: true,
      allowPositionals: false,
      tokens: true,
    });
    const directory = values.directory;

    if (!hasExactOptions(tokens, ["directory"]) || !validDirectory(directory)) {
      return invalidArguments();
    }

    return { ok: true, value: { kind, directory } };
  } catch {
    return invalidArguments();
  }
}

export function parseCliArguments(
  arguments_: readonly string[],
): ValidationResult<CliCommand> {
  const [command, ...commandArguments] = arguments_;

  switch (command) {
    case "create":
      return parseCreate(commandArguments);
    case "infer":
    case "doctor":
    case "diff":
      return parseReadOnly(command, commandArguments);
    default:
      return invalidArguments();
  }
}
