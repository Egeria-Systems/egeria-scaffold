import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { PageSection } from "../../../src/content/content-schema";
import { SectionComposition } from "../../../src/sections/section-registry";

const sections: readonly PageSection[] = [
  {
    id: "hero-sentinel",
    type: "hero",
    variant: "default",
    enabled: true,
    content: { heading: "Hero sentinel", summary: "Hero summary" },
  },
  {
    id: "text-sentinel",
    type: "text",
    variant: "default",
    enabled: true,
    content: { heading: "Text sentinel", body: "Text body" },
  },
  {
    id: "projects-sentinel",
    type: "project-list",
    variant: "default",
    enabled: true,
    content: {
      heading: "Projects sentinel",
      projects: [
        {
          title: "Project sentinel",
          summary: "Project summary",
          href: "https://example.com/project-sentinel",
        },
      ],
    },
  },
  {
    id: "action-sentinel",
    type: "call-to-action",
    variant: "default",
    enabled: true,
    content: {
      heading: "Action sentinel",
      summary: "Action summary",
      label: "Action link sentinel",
      href: "mailto:action-sentinel@example.com",
    },
  },
];

describe("section composition presentation", () => {
  it("renders all four typed shapes with semantic structure", () => {
    render(<SectionComposition sections={sections} />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Hero sentinel" }),
    ).toBeInTheDocument();
    for (const name of [
      "Text sentinel",
      "Projects sentinel",
      "Action sentinel",
    ]) {
      expect(screen.getByRole("heading", { level: 2, name })).toBeInTheDocument();
    }
    expect(screen.getByRole("list")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Project sentinel" }),
    ).toHaveAttribute("href", "https://example.com/project-sentinel");
    expect(
      screen.getByRole("link", { name: "Action link sentinel" }),
    ).toHaveAttribute("href", "mailto:action-sentinel@example.com");
  });

  it("keeps disabled registered sections out of presentation", () => {
    render(
      <SectionComposition
        sections={sections.map((section) =>
          section.type === "text" ? { ...section, enabled: false } : section,
        )}
      />,
    );

    expect(screen.queryByText("Text sentinel")).not.toBeInTheDocument();
    expect(screen.getByText("Hero sentinel")).toBeInTheDocument();
    expect(screen.getByText("Projects sentinel")).toBeInTheDocument();
    expect(screen.getByText("Action sentinel")).toBeInTheDocument();
  });
});
