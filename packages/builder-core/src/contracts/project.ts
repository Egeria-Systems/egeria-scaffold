import { z } from "zod";

import {
  safeRelativePathSchema,
  stableIdentifierSchema,
} from "./identifiers.js";
import {
  profileIdentifierSchema,
  profileRecipeVersionSchema,
} from "./profile.js";

const capabilityIdentifierListSchema = z
  .array(stableIdentifierSchema)
  .min(1)
  .superRefine((identifiers, context) => {
    if (new Set(identifiers).size !== identifiers.length) {
      context.addIssue({
        code: "custom",
        message: "selected capabilities must be unique",
      });
    }
  })
  .readonly();

const ejectedAreaListSchema = z
  .array(safeRelativePathSchema)
  .superRefine((areas, context) => {
    if (new Set(areas).size !== areas.length) {
      context.addIssue({ code: "custom", message: "ejected areas must be unique" });
    }
  })
  .readonly();

const displayNameSchema = z
  .string()
  .regex(/^(?=.{1,120}$)(?=.*\S)[^\p{Cc}]+$/u);

export const projectConfigurationSchema = z
  .strictObject({
    schemaVersion: z.literal("1.0.0"),
    builderCompatibility: z.literal("0.0.0"),
    project: z
      .strictObject({
        name: stableIdentifierSchema,
        displayName: displayNameSchema,
        defaultLocale: z.literal("en-CA"),
      })
      .readonly(),
    originProfile: profileIdentifierSchema,
    recipeVersion: profileRecipeVersionSchema,
    platformAdapter: z.literal("cloudflare-workers"),
    selectedCapabilities: capabilityIdentifierListSchema,
    capabilitySettings: z
      .record(stableIdentifierSchema, z.never())
      .readonly(),
    ejectedAreas: ejectedAreaListSchema,
  })
  .readonly()
  .meta({
    id: "urn:egeria-systems:schema:project:1.0.0",
    title: "Egeria project configuration",
  });

export type ProjectConfiguration = z.infer<
  typeof projectConfigurationSchema
>;
