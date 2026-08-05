import { z } from "zod";

import { stableIdentifierSchema } from "./identifiers.js";

export const profileIdentifierSchema = z.enum(["portfolio", "site"]);

export const profileRecipeSchema = z
  .strictObject({
    identifier: profileIdentifierSchema,
    schemaVersion: z.literal("1.0.0"),
    recipeVersion: z.literal("0.1.0"),
    defaultCapabilities: z.array(stableIdentifierSchema).min(1).readonly(),
  })
  .superRefine((profile, context) => {
    if (new Set(profile.defaultCapabilities).size !== profile.defaultCapabilities.length) {
      context.addIssue({
        code: "custom",
        message: "default capabilities must be unique",
        path: ["defaultCapabilities"],
      });
    }
  })
  .readonly()
  .meta({
    id: "urn:egeria-systems:schema:profile:1.0.0",
    title: "Egeria P1 profile recipe",
  });

export type ProfileIdentifier = z.infer<typeof profileIdentifierSchema>;
export type ProfileRecipe = z.infer<typeof profileRecipeSchema>;
