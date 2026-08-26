import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { sectionRegistry } from "../../src/sections/section-registry";

const webRoot = resolve(import.meta.dirname, "../..");

describe("section composition generated ownership", () => {
  it("binds the exact package properties and managed surfaces", async () => {
    const manifest = JSON.parse(
      await readFile(resolve(webRoot, "package.json"), "utf8"),
    ) as { devDependencies: Record<string, string> };
    expect({
      "@tailwindcss/postcss": manifest.devDependencies["@tailwindcss/postcss"],
      postcss: manifest.devDependencies.postcss,
      tailwindcss: manifest.devDependencies.tailwindcss,
    }).toEqual({
      "@tailwindcss/postcss": "4.3.3",
      postcss: "8.5.26",
      tailwindcss: "4.3.3",
    });

    const state = JSON.parse(
      await readFile(resolve(webRoot, "../../.egeria/state.json"), "utf8"),
    ) as {
      managedSurfaces: Array<{
        fingerprint: string;
        fingerprintTarget: unknown;
        identifier: string;
        mergeStrategy: string;
        owner: { kind: string; identifier?: string };
        ownership: string;
        path: string;
      }>;
    };
    const surfaces = state.managedSurfaces.filter(
      ({ owner }) =>
        owner.kind === "capability" &&
        owner.identifier === "section-composition",
    );
    expect(
      surfaces.map(({ fingerprint, owner, ...surface }) => surface),
    ).toEqual([
      {
        identifier: "section-composition-global-styles",
        path: "apps/web/app/globals.css",
        ownership: "application-owned",
        fingerprintTarget: { kind: "file" },
        mergeStrategy: "replace-file",
      },
      {
        identifier: "section-composition-postcss-configuration",
        path: "apps/web/postcss.config.mjs",
        ownership: "application-owned",
        fingerprintTarget: { kind: "file" },
        mergeStrategy: "replace-file",
      },
      {
        identifier: "section-composition-postcss-package",
        path: "apps/web/package.json",
        ownership: "merge-managed",
        fingerprintTarget: {
          kind: "json-value",
          pointer: "/devDependencies/postcss",
        },
        mergeStrategy: "json-property",
      },
      {
        identifier: "section-composition-presentation",
        path: "apps/web/src/presentation/content-page.tsx",
        ownership: "application-owned",
        fingerprintTarget: { kind: "file" },
        mergeStrategy: "replace-file",
      },
      {
        identifier: "section-composition-registry",
        path: "apps/web/src/sections/section-registry.tsx",
        ownership: "application-owned",
        fingerprintTarget: { kind: "file" },
        mergeStrategy: "replace-file",
      },
      {
        identifier: "section-composition-tailwind-package",
        path: "apps/web/package.json",
        ownership: "merge-managed",
        fingerprintTarget: {
          kind: "json-value",
          pointer: "/devDependencies/tailwindcss",
        },
        mergeStrategy: "json-property",
      },
      {
        identifier: "section-composition-tailwind-postcss-package",
        path: "apps/web/package.json",
        ownership: "merge-managed",
        fingerprintTarget: {
          kind: "json-value",
          pointer: "/devDependencies/@tailwindcss~1postcss",
        },
        mergeStrategy: "json-property",
      },
    ]);
    expect(
      surfaces.every(({ fingerprint }) =>
        /^sha256:[0-9a-f]{64}$/u.test(fingerprint),
      ),
    ).toBe(true);
  });

  it("binds the four typed registry shapes to both supported profiles", () => {
    expect(Object.keys(sectionRegistry)).toEqual([
      "hero",
      "text",
      "project-list",
      "call-to-action",
    ]);
    expect(
      Object.fromEntries(
        Object.entries(sectionRegistry).map(([type, entry]) => [
          type,
          {
            type: entry.type,
            contentSchemaVersion: entry.contentSchemaVersion,
            approvedVariants: entry.approvedVariants,
            supportedProfiles: entry.supportedProfiles,
            analyticsDeclarations: entry.analyticsDeclarations,
            migrationHooks: entry.migrationHooks,
          },
        ]),
      ),
    ).toEqual({
      hero: {
        type: "hero",
        contentSchemaVersion: "1.0.0",
        approvedVariants: ["default"],
        supportedProfiles: ["portfolio", "site"],
        analyticsDeclarations: [],
        migrationHooks: [],
      },
      text: {
        type: "text",
        contentSchemaVersion: "1.0.0",
        approvedVariants: ["default"],
        supportedProfiles: ["portfolio", "site"],
        analyticsDeclarations: [],
        migrationHooks: [],
      },
      "project-list": {
        type: "project-list",
        contentSchemaVersion: "1.0.0",
        approvedVariants: ["default"],
        supportedProfiles: ["portfolio", "site"],
        analyticsDeclarations: [],
        migrationHooks: [],
      },
      "call-to-action": {
        type: "call-to-action",
        contentSchemaVersion: "1.0.0",
        approvedVariants: ["default"],
        supportedProfiles: ["portfolio", "site"],
        analyticsDeclarations: [],
        migrationHooks: [],
      },
    });
  });

  it("binds PostCSS and the semantic style protections", async () => {
    const postcss = await readFile(
      resolve(webRoot, "postcss.config.mjs"),
      "utf8",
    );
    expect(postcss).toBe(`const postcssConfiguration = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default postcssConfiguration;
`);

    const styles = await readFile(resolve(webRoot, "app/globals.css"), "utf8");
    expect(styles.startsWith('@import "tailwindcss";\n')).toBe(true);
    expect(styles).toContain("@theme inline");
    expect(styles).toContain("--design-color-canvas: #f6f5ef;");
    expect(styles).toContain("--design-color-ink: #17211f;");
    expect(styles).toContain("--design-color-accent: #0b6959;");
    expect(styles).toContain("--design-color-focus: #b45309;");
    expect(styles).toContain(":focus-visible");
    expect(styles).toContain("overflow-wrap: anywhere;");
    expect(styles).toContain("@media (forced-colors: active)");
    expect(styles).toContain("@media (prefers-reduced-motion: reduce)");
  });
});
