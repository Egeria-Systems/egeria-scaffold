import { z } from "zod";

import {
  semanticVersionSchema,
  stableIdentifierSchema,
} from "./identifiers.js";

const uniqueIdentifierListSchema = z
  .array(stableIdentifierSchema)
  .superRefine((identifiers, context) => {
    if (new Set(identifiers).size !== identifiers.length) {
      context.addIssue({ code: "custom", message: "identifiers must be unique" });
    }
  })
  .readonly();

export const migrationRecordSchema = z
  .strictObject({
    schemaVersion: z.literal("1.0.0"),
    identifier: stableIdentifierSchema,
    kind: z.enum(["migration", "reconciliation"]),
    outcome: z.literal("succeeded"),
    completedAt: z.iso.datetime({ offset: true }),
    fromBuilderVersion: semanticVersionSchema,
    toBuilderVersion: semanticVersionSchema,
    capabilities: uniqueIdentifierListSchema,
    persistentDataAuthorizations: uniqueIdentifierListSchema,
    remainingKnownDrift: uniqueIdentifierListSchema,
    verificationChecks: uniqueIdentifierListSchema,
  })
  .readonly()
  .meta({
    id: "urn:egeria-systems:schema:migration-record:1.0.0",
    title: "Egeria successful migration record",
  });

export type MigrationRecord = z.infer<typeof migrationRecordSchema>;
