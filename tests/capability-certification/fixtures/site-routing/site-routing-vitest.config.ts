import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const contentRoot = `${resolve(import.meta.dirname, "../../content").replaceAll("\\", "/")}/`;

export default defineConfig({
  plugins: [
    {
      name: "site-routing-generated-content",
      enforce: "pre",
      async load(identifier) {
        const path = identifier.split("?", 1)[0]?.replaceAll("\\", "/");
        if (
          path === undefined ||
          !path.startsWith(contentRoot) ||
          !/\.(?:md|ya?ml)$/u.test(path)
        ) {
          return undefined;
        }

        return `export default ${JSON.stringify(await readFile(path, "utf8"))};`;
      },
    },
    react(),
  ],
  resolve: { tsconfigPaths: true },
  test: {
    environment: "jsdom",
    globals: false,
    include: ["tests/component/site-routing-certification.test.tsx"],
    setupFiles: ["./tests/setup/component.ts"],
  },
});
