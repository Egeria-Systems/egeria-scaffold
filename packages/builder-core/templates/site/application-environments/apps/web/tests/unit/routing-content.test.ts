import { describe, expect, it } from "vitest";

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
