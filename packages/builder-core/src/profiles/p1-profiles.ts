import type { ProfileRecipe } from "../contracts/profile.js";

export const p1ProfileRecipes: readonly ProfileRecipe[] = [
  {
    identifier: "portfolio",
    schemaVersion: "1.0.0",
    recipeVersion: "0.1.0",
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
    recipeVersion: "0.1.0",
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
