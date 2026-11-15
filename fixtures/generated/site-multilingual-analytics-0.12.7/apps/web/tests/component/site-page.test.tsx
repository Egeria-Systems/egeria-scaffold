import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SitePage } from "../../src/routing/site-page";

describe("site page navigation", () => {
  it("identifies only the current route and renders content-backed labels", () => {
    render(
      <SitePage
        currentPath="/about"
        navigation={[
          { href: "/", label: "Home" },
          { href: "/about", label: "About" },
        ]}
        sections={[
          {
            id: "introduction",
            type: "hero",
            variant: "default",
            enabled: true,
            content: { heading: "About", summary: "Background." },
          },
        ]}
        skipToContent="Skip to content"
      />,
    );

    expect(screen.getByRole("link", { name: "About" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Home" })).not.toHaveAttribute(
      "aria-current",
    );
    expect(screen.getByRole("heading", { level: 1, name: "About" })).toBeVisible();
  });
});
