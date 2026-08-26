import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { cleanup, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import About, { metadata as aboutMetadata } from "../../app/about/page";
import NotFound, { metadata as notFoundMetadata } from "../../app/not-found";
import robots from "../../app/robots";
import sitemap from "../../app/sitemap";
import FeaturedWork, {
  metadata as featuredWorkMetadata,
} from "../../app/work/featured/page";

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
      version: "0.4.0",
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
      {
        identifier: "site-routing-browser-test",
        path: "apps/web/tests/e2e/site-routing.spec.ts",
        ownership: "application-owned",
        fingerprintTarget: { kind: "file" },
        mergeStrategy: "replace-file",
      },
      {
        identifier: "site-routing-component-test",
        path: "apps/web/tests/component/site-page.test.tsx",
        ownership: "application-owned",
        fingerprintTarget: { kind: "file" },
        mergeStrategy: "replace-file",
      },
      {
        identifier: "site-routing-configuration-content",
        path: "apps/web/content/en-CA/routing.yaml",
        ownership: "application-owned",
        fingerprintTarget: { kind: "file" },
        mergeStrategy: "replace-file",
      },
      {
        identifier: "site-routing-content-reader",
        path: "apps/web/src/routing/read-routing-content.ts",
        ownership: "application-owned",
        fingerprintTarget: { kind: "file" },
        mergeStrategy: "replace-file",
      },
      {
        identifier: "site-routing-content-schema",
        path: "apps/web/src/routing/routing-content-schema.ts",
        ownership: "application-owned",
        fingerprintTarget: { kind: "file" },
        mergeStrategy: "replace-file",
      },
      {
        identifier: "site-routing-featured-work-content",
        path: "apps/web/content/en-CA/work-featured.yaml",
        ownership: "application-owned",
        fingerprintTarget: { kind: "file" },
        mergeStrategy: "replace-file",
      },
      {
        identifier: "site-routing-featured-work-route",
        path: "apps/web/app/work/featured/page.tsx",
        ownership: "application-owned",
        fingerprintTarget: { kind: "file" },
        mergeStrategy: "replace-file",
      },
      {
        identifier: "site-routing-not-found-content",
        path: "apps/web/content/en-CA/not-found.yaml",
        ownership: "application-owned",
        fingerprintTarget: { kind: "file" },
        mergeStrategy: "replace-file",
      },
      {
        identifier: "site-routing-not-found-route",
        path: "apps/web/app/not-found.tsx",
        ownership: "application-owned",
        fingerprintTarget: { kind: "file" },
        mergeStrategy: "replace-file",
      },
      {
        identifier: "site-routing-presentation",
        path: "apps/web/src/routing/site-page.tsx",
        ownership: "application-owned",
        fingerprintTarget: { kind: "file" },
        mergeStrategy: "replace-file",
      },
      {
        identifier: "site-routing-robots-route",
        path: "apps/web/app/robots.ts",
        ownership: "application-owned",
        fingerprintTarget: { kind: "file" },
        mergeStrategy: "replace-file",
      },
      {
        identifier: "site-routing-sitemap-route",
        path: "apps/web/app/sitemap.ts",
        ownership: "application-owned",
        fingerprintTarget: { kind: "file" },
        mergeStrategy: "replace-file",
      },
      {
        identifier: "site-routing-unit-test",
        path: "apps/web/tests/unit/routing-content.test.ts",
        ownership: "application-owned",
        fingerprintTarget: { kind: "file" },
        mergeStrategy: "replace-file",
      },
      {
        identifier: "site-routing-work-error-boundary",
        path: "apps/web/app/work/error.tsx",
        ownership: "application-owned",
        fingerprintTarget: { kind: "file" },
        mergeStrategy: "replace-file",
      },
      {
        identifier: "site-routing-work-index-route",
        path: "apps/web/app/work/page.tsx",
        ownership: "application-owned",
        fingerprintTarget: { kind: "file" },
        mergeStrategy: "replace-file",
      },
    ]);
    expect(
      await Promise.all(
        surfaces.map(
          async ({ fingerprint, path }) =>
            fingerprint ===
            `sha256:${createHash("sha256")
              .update(await readFile(resolve(webRoot, "../..", path)))
              .digest("hex")}`,
        ),
      ),
    ).toEqual(Array.from({ length: 17 }, () => true));
  });

  it("renders actual nested and not-found route modules from validated content", () => {
    expect(aboutMetadata).toEqual({
      title: "About",
      description: "Background, working principles, and approach.",
    });
    render(<About />);
    expect(
      screen.getByRole("heading", { level: 1, name: "About" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "About" })).toHaveAttribute(
      "aria-current",
      "page",
    );

    cleanup();
    expect(featuredWorkMetadata).toEqual({
      title: "Featured work",
      description: "A closer look at selected work and its outcomes.",
    });
    render(<FeaturedWork />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Featured work" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Work" })).toHaveAttribute(
      "aria-current",
      "page",
    );

    cleanup();
    expect(notFoundMetadata).toEqual({
      title: "Page not found",
      description: "The requested page could not be found.",
    });
    render(<NotFound />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Page not found" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go home" })).toHaveAttribute(
      "href",
      "/",
    );
  });

  it("derives crawl routes only from safe content-backed navigation", () => {
    expect(robots()).toEqual({
      rules: { userAgent: "*", allow: "/" },
      sitemap: "https://example.com/sitemap.xml",
    });
    expect(sitemap()).toEqual([
      {
        url: "https://example.com/",
        changeFrequency: "monthly",
        priority: 1,
      },
      {
        url: "https://example.com/about",
        changeFrequency: "monthly",
        priority: 0.8,
      },
      {
        url: "https://example.com/work/featured",
        changeFrequency: "monthly",
        priority: 0.8,
      },
    ]);
  });
});
