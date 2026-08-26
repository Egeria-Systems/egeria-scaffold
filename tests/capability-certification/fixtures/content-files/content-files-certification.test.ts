import { describe, expect, it } from "vitest";

import {
  parseContentConfiguration,
  parseMarkdownContent,
  parseYamlContent,
} from "../../src/content/content-schema";

describe("content files certification", () => {
  it("uses strict YAML 1.2 core parsing without aliases", () => {
    expect(parseYamlContent("answer: No\n")).toEqual({ answer: "No" });
    expect(() => parseYamlContent("heading: One\nheading: Two\n")).toThrow(
      new TypeError("CONTENT_INVALID"),
    );
    expect(() =>
      parseYamlContent("shared: &shared value\ncopy: *shared\n"),
    ).toThrow(new TypeError("CONTENT_INVALID"));
  });

  it("accepts only the generated locale configuration", () => {
    expect(
      parseContentConfiguration(
        parseYamlContent(
          "schemaVersion: 1.0.0\ndefaultLocale: en-CA\nlocales:\n  - en-CA\n",
        ),
      ),
    ).toEqual({
      schemaVersion: "1.0.0",
      defaultLocale: "en-CA",
      locales: ["en-CA"],
    });
  });

  it("parses complete Markdown and rejects missing front matter", () => {
    expect(
      parseMarkdownContent(
        "---\ntitle: Acme Portfolio\nsummary: A focused introduction.\n---\nSelected work.\n",
      ),
    ).toEqual({
      frontMatter: {
        title: "Acme Portfolio",
        summary: "A focused introduction.",
      },
      body: "Selected work.",
    });
    expect(() =>
      parseMarkdownContent("---\ntitle: Acme Portfolio\n---\nSelected work.\n"),
    ).toThrow(new TypeError("CONTENT_INVALID"));
  });
});
