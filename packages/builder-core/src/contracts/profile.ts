import { z } from "zod";

import { stableIdentifierSchema } from "./identifiers.js";

export const profileIdentifierSchema = z.enum(["portfolio", "site", "app"]);
export const profileRecipeVersionSchema = z.enum(["0.12.0", "0.13.0", "0.3.0"]);

export const profileRecipeSchema = z
  .strictObject({
    identifier: profileIdentifierSchema,
    schemaVersion: z.literal("1.0.0"),
    recipeVersion: profileRecipeVersionSchema,
    defaultCapabilities: z.array(stableIdentifierSchema).min(1).readonly(),
  })
  .superRefine((profile, context) => {
    if (profile.recipeVersion !== applicationEnvironmentRecipeVersions[profile.identifier]) {
      context.addIssue({ code: "custom", message: "recipe version must match profile", path: ["recipeVersion"] });
    }

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
    title: "Egeria portfolio, site, and app profile recipe",
  });

export type ProfileIdentifier = z.infer<typeof profileIdentifierSchema>;
export type ProfileRecipe = z.infer<typeof profileRecipeSchema>;

export const applicationEnvironmentRecipeVersions = Object.freeze({
  portfolio: "0.12.0",
  site: "0.13.0",
  app: "0.3.0",
} as const);
