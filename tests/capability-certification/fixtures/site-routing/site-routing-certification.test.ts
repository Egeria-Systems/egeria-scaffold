import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  parsePageContent,
  parseYamlContent,
} from "../../src/content/content-schema";

const webRoot = resolve(import.meta.dirname, "../..");

describe("site routing generated ownership", () => {
  it("binds the exact installed subject and application-owned surfaces", async () => {
    const state = JSON.parse(
      await readFile(resolve(webRoot, "../../.egeria/state.json"), "utf8"),
    ) as {
      installedCapabilities: Array<{
        deliveryMode: string;
        identifier: string;
        removalPolicy: string;
        stateClassifications: string[];
        version: string;
      }>;
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

    expect(
      state.installedCapabilities.find(
        ({ identifier }) => identifier === "site-routing",
      ),
    ).toEqual({
      identifier: "site-routing",
      version: "0.3.0",
      deliveryMode: "source-generated",
      stateClassifications: ["repository-stateful"],
      removalPolicy: "reviewed",
    });

    const surfaces = state.managedSurfaces.filter(
      ({ owner }) =>
        owner.kind === "capability" && owner.identifier === "site-routing",
    );
    expect(
      surfaces.map(({ fingerprint, owner, ...surface }) => surface),
    ).toEqual([
      {
        identifier: "site-routing-about-content",
        path: "apps/web/content/en-CA/about.yaml",
        ownership: "application-owned",
        fingerprintTarget: { kind: "file" },
        mergeStrategy: "replace-file",
      },
      {
        identifier: "site-routing-about-route",
        path: "apps/web/app/about/page.tsx",
        ownership: "application-owned",
        fingerprintTarget: { kind: "file" },
        mergeStrategy: "replace-file",
      },
    ]);
    expect(
      surfaces.every(({ fingerprint }) =>
        /^sha256:[0-9a-f]{64}$/u.test(fingerprint),
      ),
    ).toBe(true);
  });

  it("parses the exact generated about-route content", async () => {
    const source = await readFile(
      resolve(webRoot, "content/en-CA/about.yaml"),
      "utf8",
    );

    expect(parsePageContent(parseYamlContent(source))).toEqual({
      sections: [
        {
          id: "introduction",
          type: "hero",
          variant: "default",
          enabled: true,
          content: {
            heading: "About",
            summary: "Background and approach.",
          },
        },
        {
          id: "principles",
          type: "text",
          variant: "default",
          enabled: true,
          content: {
            heading: "Working principles",
            body: "Clear communication, careful craft, and practical outcomes guide the work.",
          },
        },
      ],
    });
  });
});
