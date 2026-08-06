import { parseDocument, stringify } from "yaml";
import type { ZodType } from "zod";

import {
  migrationRecordSchema,
  type MigrationRecord,
} from "../contracts/migration.js";
import {
  projectConfigurationSchema,
  type ProjectConfiguration,
} from "../contracts/project.js";
import type {
  ContractIssue,
  ValidationResult,
} from "../contracts/result.js";
import { validateContract } from "../contracts/result.js";
import {
  installedStateSchema,
  type InstalledState,
} from "../contracts/state.js";
import {
  canonicalizeJsonValue,
  stringifyCanonicalJson,
} from "../serialization/canonical-json.js";

const structuralPathSegments = new Set([
  "appliedMigrations",
  "builderCompatibility",
  "builderVersion",
  "capabilities",
  "capabilitySettings",
  "checks",
  "compatibility",
  "completedAt",
  "defaultLocale",
  "deliveryMode",
  "displayName",
  "ejectedAreas",
  "ejections",
  "fingerprint",
  "fingerprintTarget",
  "fromBuilderVersion",
  "identifier",
  "installedCapabilities",
  "kind",
  "lastSuccessfulVerification",
  "managedSurfaces",
  "mergeStrategy",
  "name",
  "node",
  "origin",
  "originProfile",
  "outcome",
  "owner",
  "ownership",
  "path",
  "persistentDataAuthorizations",
  "platformAdapter",
  "pnpm",
  "pointer",
  "project",
  "projectSchemaVersion",
  "recipeVersion",
  "remainingKnownDrift",
  "removalPolicy",
  "schemaVersion",
  "selectedCapabilities",
  "stateClassifications",
  "toBuilderVersion",
  "verificationChecks",
  "version",
]);

function sanitizeIssuePath(
  path: readonly (string | number)[],
): readonly (string | number)[] {
  return path.map((segment) =>
    typeof segment === "string" && !structuralPathSegments.has(segment)
      ? "<dynamic>"
      : segment,
  );
}

function invalidResult(
  code: string,
  path: readonly (string | number)[],
  reason: string,
): ValidationResult<never> {
  return {
    ok: false,
    issues: [{ code, path, context: { reason } }],
  };
}

function validateWithCode<T>(
  schema: ZodType<T>,
  input: unknown,
  code: string,
  pathPrefix: readonly (string | number)[] = [],
): ValidationResult<T> {
  const result = validateContract(schema, input);

  if (result.ok) {
    return result;
  }

  return {
    ok: false,
    issues: result.issues.map(
      (issue): ContractIssue => ({
        code,
        path: [...pathPrefix, ...sanitizeIssuePath(issue.path)],
        context: issue.context,
      }),
    ),
  };
}

function requireValid<T>(
  schema: ZodType<T>,
  value: unknown,
  code: string,
): T {
  const result = validateWithCode(schema, value, code);

  if (!result.ok) {
    throw new TypeError(code);
  }

  return result.value;
}

function withOneTerminalNewline(value: string): string {
  return `${value.replace(/\n+$/u, "")}\n`;
}

export function parseProjectYaml(
  source: string,
): ValidationResult<ProjectConfiguration> {
  try {
    const document = parseDocument(source, {
      version: "1.2",
      schema: "core",
      resolveKnownTags: false,
      strict: true,
      stringKeys: true,
      uniqueKeys: true,
      prettyErrors: true,
    });

    if (document.errors.length > 0) {
      return invalidResult("PROJECT_YAML_INVALID", [], "document-error");
    }

    if (document.warnings.length > 0) {
      return invalidResult("PROJECT_YAML_INVALID", [], "document-warning");
    }

    const value = document.toJS({ maxAliasCount: 0, mapAsMap: false }) as unknown;
    return validateWithCode(
      projectConfigurationSchema,
      value,
      "PROJECT_SCHEMA_INVALID",
    );
  } catch {
    return invalidResult("PROJECT_YAML_INVALID", [], "document-error");
  }
}

export function serializeProjectYaml(value: ProjectConfiguration): string {
  const validated = requireValid(
    projectConfigurationSchema,
    value,
    "PROJECT_SCHEMA_INVALID",
  );
  const source = stringify(validated, {
    version: "1.2",
    schema: "core",
    resolveKnownTags: false,
    sortMapEntries: true,
    aliasDuplicateObjects: false,
    indent: 2,
    lineWidth: 0,
  });

  return withOneTerminalNewline(source);
}

export function parseStateJson(
  source: string,
): ValidationResult<InstalledState> {
  let value: unknown;

  try {
    value = JSON.parse(source) as unknown;
  } catch {
    return invalidResult("STATE_JSON_INVALID", [], "syntax");
  }

  return validateWithCode(
    installedStateSchema,
    value,
    "STATE_SCHEMA_INVALID",
  );
}

export function serializeStateJson(value: InstalledState): string {
  const validated = requireValid(
    installedStateSchema,
    value,
    "STATE_SCHEMA_INVALID",
  );
  const canonical = canonicalizeJsonValue(validated);
  return `${JSON.stringify(canonical, null, 2)}\n`;
}

export function parseMigrationLog(
  source: string,
): ValidationResult<readonly MigrationRecord[]> {
  const records: MigrationRecord[] = [];

  for (const [index, line] of source.split("\n").entries()) {
    if (line.trim().length === 0) {
      continue;
    }

    let value: unknown;

    try {
      value = JSON.parse(line) as unknown;
    } catch {
      return invalidResult("MIGRATION_JSON_INVALID", [index + 1], "syntax");
    }

    const result = validateWithCode(
      migrationRecordSchema,
      value,
      "MIGRATION_SCHEMA_INVALID",
      [index + 1],
    );

    if (!result.ok) {
      return result;
    }

    records.push(result.value);
  }

  return { ok: true, value: records };
}

export function serializeMigrationRecord(value: MigrationRecord): string {
  const validated = requireValid(
    migrationRecordSchema,
    value,
    "MIGRATION_SCHEMA_INVALID",
  );
  return `${stringifyCanonicalJson(validated)}\n`;
}
