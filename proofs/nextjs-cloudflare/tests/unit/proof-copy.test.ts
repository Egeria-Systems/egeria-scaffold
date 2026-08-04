import { describe, expect, test } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { parseProofCopy } from "../../src/content/proof-copy";
import { CompatibilityPage } from "../../src/presentation/compatibility-page";

const validCopy = {
  metadata: { title: "Proof", description: "Compatibility evidence" },
  page: {
    eyebrow: "Compatibility proof",
    heading: "Next.js and Cloudflare compatibility proof",
    summary: "A small executable check.",
    facts: [
      { identifier: "runtime", label: "Target runtime", value: "workerd" },
    ],
    runtimeReportLink: "View runtime report",
  },
};

describe("parseProofCopy", () => {
  test("returns typed non-empty copy", () => {
    expect(parseProofCopy(validCopy)).toEqual(validCopy);
  });

  test("rejects duplicate fact identifiers", () => {
    expect(() =>
      parseProofCopy({
        ...validCopy,
        page: {
          ...validCopy.page,
          facts: [validCopy.page.facts[0]!, validCopy.page.facts[0]!],
        },
      }),
    ).toThrow(/duplicate fact identifier: runtime/);
  });

  test("rejects blank user-visible copy", () => {
    expect(() =>
      parseProofCopy({
        ...validCopy,
        page: { ...validCopy.page, heading: " " },
      }),
    ).toThrow(/page.heading/);
  });
});

test("the pure presentation renders semantic typed copy", () => {
  const copy = parseProofCopy(validCopy);
  const markup = renderToStaticMarkup(
    createElement(CompatibilityPage, { copy: copy.page }),
  );

  expect(markup).toContain('<main><article aria-labelledby="proof-heading">');
  expect(markup).toContain(
    '<h1 id="proof-heading">Next.js and Cloudflare compatibility proof</h1>',
  );
  expect(markup).toContain("<dl>");
  expect(markup).toContain(
    '<a href="/api/compatibility">View runtime report</a>',
  );
});
