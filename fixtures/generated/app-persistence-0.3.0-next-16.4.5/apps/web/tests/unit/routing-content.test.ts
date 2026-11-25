import { describe, expect, it, vi } from "vitest";

import sitemap from "../../app/sitemap";

vi.mock("../../src/content/read-content", () => ({
  readSiteContent: () => ({
    navigation: [
      { href: "/", label: "Home" },
      { href: "/work", label: "Work index" },
      { href: "/work/featured", label: "Featured work" },
    ],
  }),
}));

vi.mock("../../src/routing/read-routing-content", () => ({
  readRoutingContent: () => ({ baseUrl: "https://example.test/" }),
}));

it("lists canonical site pages independently of the editor's navigation", () => {
  expect(sitemap()).toEqual([
    { url: "https://example.test/", changeFrequency: "monthly", priority: 1 },
    { url: "https://example.test/about", changeFrequency: "monthly", priority: 0.8 },
    { url: "https://example.test/work/featured", changeFrequency: "monthly", priority: 0.8 },
  ]);
});

import {
  parseRoutedPageContent,
} from "../../src/routing/routing-content-schema";

const routedPage = {
  metadata: { title: "About", description: "About this work." },
  sections: [
    {
      id: "introduction",
      type: "hero",
      variant: "default",
      enabled: true,
      content: { heading: "About", summary: "About this work." },
    },
  ],
};

describe("site routing content", () => {
  it("accepts exact page metadata", () => {
    expect(parseRoutedPageContent(routedPage)).toEqual(routedPage);
  });

  it("rejects incomplete page metadata", () => {
    expect(() =>
      parseRoutedPageContent({ sections: routedPage.sections }),
    ).toThrowError("CONTENT_INVALID");
  });
});
