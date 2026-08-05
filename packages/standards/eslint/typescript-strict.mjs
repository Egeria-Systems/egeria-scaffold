import { isAbsolute } from "node:path";
import typescriptEslint from "typescript-eslint";

const defaultFiles = ["**/*.{ts,tsx,mts,cts}"];

export function createTypeScriptStrictConfig({
  files = defaultFiles,
  tsconfigRootDir,
}) {
  if (!isAbsolute(tsconfigRootDir)) {
    throw new TypeError("tsconfigRootDir must be an absolute path");
  }

  return [
    ...typescriptEslint.configs.strictTypeChecked,
    ...typescriptEslint.configs.stylisticTypeChecked,
  ].map((config) => ({
    ...config,
    files,
    languageOptions: {
      ...config.languageOptions,
      parserOptions: {
        ...config.languageOptions?.parserOptions,
        projectService: true,
        tsconfigRootDir,
      },
    },
  }));
}
