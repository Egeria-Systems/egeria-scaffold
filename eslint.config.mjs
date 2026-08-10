import eslint from "@eslint/js";
import { createCopyExternalizationConfig } from "@egeria-systems/standards/eslint/copy-externalization";
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
    ignores: [
      "**/dist/**",
      "**/tests/fixtures/**",
      "packages/builder-core/templates/**/eslint.config.mjs",
      "proofs/**",
    ],
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
  createCopyExternalizationConfig({
    files: [
      "packages/builder-core/templates/**/app/**/*.tsx",
      "packages/builder-core/templates/**/src/integrations/**/*.tsx",
      "packages/builder-core/templates/**/src/presentation/**/*.tsx",
      "packages/builder-core/templates/**/src/sections/**/*.tsx",
    ],
  }),
];
