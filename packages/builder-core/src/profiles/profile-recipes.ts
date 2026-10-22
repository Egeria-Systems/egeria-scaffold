import { publicRecipeVersions, applicationEnvironmentRecipeVersions, type ProfileRecipe } from "../contracts/profile.js";

const sharedPortfolioCapabilities = [
  "standards",
  "content-files",
  "section-composition",
  "deployment-cloudflare",
  "observability",
] as const;

function createRecipes(input: Readonly<{
  portfolio: "0.11.5" | "0.12.0";
  site: "0.12.5" | "0.13.0";
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

export function createCurrentProfileRecipes(): readonly ProfileRecipe[] {
  return [
    ...createRecipes(publicRecipeVersions),
    { identifier: "app", schemaVersion: "1.0.0", recipeVersion: publicRecipeVersions.app, defaultCapabilities: ["app-foundation", "site-routing"] },
  ];
}

export function isCurrentProfileRecipe(profile: string, recipeVersion: string): boolean {
  return Object.entries(publicRecipeVersions).some(([identifier, version]) => identifier === profile && version === recipeVersion);
}

export const profileRecipes: readonly ProfileRecipe[] = createCurrentProfileRecipes();

export function createApplicationEnvironmentProfileRecipes(): readonly ProfileRecipe[] {
  return [
    ...createRecipes(applicationEnvironmentRecipeVersions),
    { identifier: "app", schemaVersion: "1.0.0", recipeVersion: applicationEnvironmentRecipeVersions.app, defaultCapabilities: ["app-foundation", "site-routing"] },
  ];
}
