import { z } from "zod";

import { capabilityDescriptorSchema } from "./capability.js";
import { certificationRegistrySchema } from "./certification.js";
import { migrationRecordSchema } from "./migration.js";
import { profileRecipeSchema } from "./profile.js";
import { projectConfigurationSchema } from "./project.js";
import { installedStateSchema } from "./state.js";

const schemaEntries = [
  ["capability.schema.json", capabilityDescriptorSchema],
  ["certification-registry.schema.json", certificationRegistrySchema],
  ["migration-record.schema.json", migrationRecordSchema],
  ["profile.schema.json", profileRecipeSchema],
  ["project.schema.json", projectConfigurationSchema],
  ["state.schema.json", installedStateSchema],
] as const;

type JsonValue =
  | null
  | boolean
  | number
  | string
  | readonly JsonValue[]
  | Readonly<{ [key: string]: JsonValue }>;

function sortJsonValue(value: unknown): JsonValue {
  if (value === null || typeof value !== "object") {
    return value as null | boolean | number | string;
  }

  if (Array.isArray(value)) {
    return value.map(sortJsonValue);
  }

  const objectValue = value as Readonly<Record<string, unknown>>;
  const prefixItems = objectValue.prefixItems;
  const tupleBounds =
    Array.isArray(prefixItems) && !("items" in objectValue)
      ? { minItems: prefixItems.length, maxItems: prefixItems.length }
      : {};

  return Object.fromEntries(
    Object.entries({ ...objectValue, ...tupleBounds })
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(([key, nestedValue]) => [key, sortJsonValue(nestedValue)]),
  );
}

export type JsonSchemaArtifactName = (typeof schemaEntries)[number][0];
export type JsonSchemaArtifacts = Readonly<
  Record<JsonSchemaArtifactName, JsonValue>
>;

export function createJsonSchemaArtifacts(): JsonSchemaArtifacts {
  return Object.fromEntries(
    schemaEntries.map(([artifactName, schema]) => [
      artifactName,
      sortJsonValue(
        z.toJSONSchema(schema, {
          target: "draft-2020-12",
          unrepresentable: "throw",
        }),
      ),
    ]),
  ) as JsonSchemaArtifacts;
}
