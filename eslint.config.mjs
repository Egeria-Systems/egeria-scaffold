import eslint from "@eslint/js";
import { createTypeScriptStrictConfig } from "@egeria-systems/standards/eslint/typescript-strict";

import noSequencingLabels from "./scripts/eslint/no-sequencing-labels.mjs";

const builderTypeScriptFiles = [
  "apps/cli/src/**/*.ts",
  "packages/builder-core/src/**/*.ts",
  "packages/observability/src/**/*.ts",
];
const builderJavaScriptFiles = ["packages/standards/eslint/**/*.mjs"];
const authoredJavaScriptAndTypeScriptFiles = [
  "**/*.{js,mjs,cjs,jsx,ts,tsx,mts,cts}",
];

export default [
  {
    name: "@egeria-systems/scaffold/ignores",
    ignores: ["**/dist/**", "**/tests/fixtures/**", "proofs/**"],
  },
  {
    ...eslint.configs.recommended,
    name: "@egeria-systems/scaffold/recommended",
    files: [...builderTypeScriptFiles, ...builderJavaScriptFiles],
  },
  {
    name: "@egeria-systems/scaffold/semantic-naming",
    files: authoredJavaScriptAndTypeScriptFiles,
    languageOptions: {
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    plugins: {
      "@egeria-systems/scaffold": {
        rules: {
          "no-sequencing-labels": noSequencingLabels,
        },
      },
    },
    rules: {
      "@egeria-systems/scaffold/no-sequencing-labels": "error",
    },
  },
  ...createTypeScriptStrictConfig({
    files: builderTypeScriptFiles,
    tsconfigRootDir: import.meta.dirname,
  }),
];
