import type { ProfileRecipe } from "../contracts/profile.js";

export type SupportedProfileRecipeVersion = "0.9.0" | "0.10.0";

const sharedPortfolioCapabilities = [
  "standards",
  "content-files",
  "section-composition",
  "deployment-cloudflare",
  "observability",
] as const;

function createRecipes(input: Readonly<{
  portfolio: "0.9.0" | "0.10.0";
  site: "0.9.0" | "0.10.0" | "0.11.0";
}>): readonly ProfileRecipe[] {
  return [
    {
      identifier: "portfolio",
      schemaVersion: "1.0.0",
      recipeVersion: input.portfolio,
      defaultCapabilities: sharedPortfolioCapabilities,
    },
    {
      identifier: "site",
      schemaVersion: "1.0.0",
      recipeVersion: input.site,
      defaultCapabilities: [...sharedPortfolioCapabilities, "site-routing"],
    },
  ];
}

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

  return createRecipes({ portfolio: recipeVersion, site: recipeVersion });
}

export const profileRecipes = createRecipes({
  portfolio: "0.10.0",
  site: "0.11.0",
});
