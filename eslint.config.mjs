import eslint from "@eslint/js";
import { createTypeScriptStrictConfig } from "@egeria-systems/standards/eslint/typescript-strict";

const builderSourceFiles = [
  "apps/cli/src/**/*.ts",
  "packages/builder-core/src/**/*.ts",
  "packages/observability/src/**/*.ts",
];

export default [
  {
    name: "@egeria-systems/scaffold/ignores",
    ignores: ["**/dist/**", "proofs/**"],
  },
  {
    ...eslint.configs.recommended,
    name: "@egeria-systems/scaffold/recommended",
    files: builderSourceFiles,
  },
  ...createTypeScriptStrictConfig({
    files: builderSourceFiles,
    tsconfigRootDir: import.meta.dirname,
  }),
];
