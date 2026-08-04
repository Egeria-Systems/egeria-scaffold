import { defineConfig, globalIgnores } from "eslint/config";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextCoreWebVitals,
  ...nextTypeScript,
  {
    files: ["app/**/*.{ts,tsx}", "src/**/*.{ts,tsx}"],
    ignores: ["src/infrastructure/cloudflare/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@opennextjs/cloudflare",
              message:
                "Cloudflare imports belong in the infrastructure adapter or configuration root.",
            },
          ],
          patterns: [
            {
              group: ["cloudflare:*"],
              message: "Cloudflare imports belong in the infrastructure adapter.",
            },
          ],
        },
      ],
    },
  },
  globalIgnores([
    ".next/**",
    ".open-next/**",
    ".wrangler/**",
    "playwright-report/**",
    "test-results/**",
    "cloudflare-env.d.ts",
    "next-env.d.ts",
  ]),
]);
