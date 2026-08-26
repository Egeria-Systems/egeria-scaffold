import type { ProfileRecipe } from "../contracts/profile.js";

export type SupportedProfileRecipeVersion = "0.9.0" | "0.10.0";

function isSupportedProfileRecipeVersion(
  value: string,
): value is SupportedProfileRecipeVersion {
  return value === "0.9.0" || value === "0.10.0";
}

export function createProfileRecipeSnapshot(
  recipeVersion: SupportedProfileRecipeVersion,
): readonly ProfileRecipe[] {
  if (!isSupportedProfileRecipeVersion(recipeVersion)) {
    throw new TypeError("profile-recipe-snapshot-version-unsupported");
  }

  return [
    {
      identifier: "portfolio",
      schemaVersion: "1.0.0",
      recipeVersion,
      defaultCapabilities: [
        "standards",
        "content-files",
        "section-composition",
        "deployment-cloudflare",
        "observability",
      ],
    },
    {
      identifier: "site",
      schemaVersion: "1.0.0",
      recipeVersion,
      defaultCapabilities: [
        "standards",
        "content-files",
        "section-composition",
        "deployment-cloudflare",
        "observability",
        "site-routing",
      ],
    },
  ];
}

export const profileRecipes = createProfileRecipeSnapshot("0.10.0");
