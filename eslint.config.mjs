import eslint from "@eslint/js";
import { createTypeScriptStrictConfig } from "@egeria-systems/standards/eslint/typescript-strict";

const builderTypeScriptFiles = [
  "apps/cli/src/**/*.ts",
  "packages/builder-core/src/**/*.ts",
  "packages/observability/src/**/*.ts",
];
const builderJavaScriptFiles = ["packages/standards/eslint/**/*.mjs"];

export default [
  {
    name: "@egeria-systems/scaffold/ignores",
    ignores: ["**/dist/**", "proofs/**"],
  },
  {
    ...eslint.configs.recommended,
    name: "@egeria-systems/scaffold/recommended",
    files: [...builderTypeScriptFiles, ...builderJavaScriptFiles],
  },
  ...createTypeScriptStrictConfig({
    files: builderTypeScriptFiles,
    tsconfigRootDir: import.meta.dirname,
  }),
];
