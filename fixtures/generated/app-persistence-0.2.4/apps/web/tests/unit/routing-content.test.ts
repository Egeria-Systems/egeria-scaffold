import { describe, expect, it } from "vitest";

import {
  parseRoutedPageContent,
  parseRoutingContent,
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
  it("accepts exact HTTPS site identity and page metadata", () => {
    expect(parseRoutingContent({ baseUrl: "https://example.com" })).toEqual({
      baseUrl: "https://example.com/",
    });
    expect(parseRoutedPageContent(routedPage)).toEqual(routedPage);
  });

  it("rejects unsafe origins and incomplete page metadata", () => {
    expect(() =>
      parseRoutingContent({ baseUrl: "http://example.com" }),
    ).toThrowError("CONTENT_INVALID");
    expect(() =>
      parseRoutingContent({ baseUrl: "https://user@example.com" }),
    ).toThrowError("CONTENT_INVALID");
    expect(() =>
      parseRoutedPageContent({ sections: routedPage.sections }),
    ).toThrowError("CONTENT_INVALID");
  });
});
