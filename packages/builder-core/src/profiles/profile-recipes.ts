import { applicationEnvironmentRecipeVersions, type ProfileRecipe } from "../contracts/profile.js";

const sharedPortfolioCapabilities = [
  "standards",
  "content-files",
  "section-composition",
  "deployment-cloudflare",
  "observability",
] as const;

export function createApplicationEnvironmentProfileRecipes(): readonly ProfileRecipe[] {
  return [
    { identifier: "portfolio", schemaVersion: "1.0.0", recipeVersion: applicationEnvironmentRecipeVersions.portfolio, defaultCapabilities: sharedPortfolioCapabilities },
    { identifier: "site", schemaVersion: "1.0.0", recipeVersion: applicationEnvironmentRecipeVersions.site, defaultCapabilities: [...sharedPortfolioCapabilities, "site-routing"] },
    { identifier: "app", schemaVersion: "1.0.0", recipeVersion: applicationEnvironmentRecipeVersions.app, defaultCapabilities: ["app-foundation", "site-routing"] },
  ];
}

export const profileRecipes: readonly ProfileRecipe[] = createApplicationEnvironmentProfileRecipes();
