import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ErrorBoundary from "../../app/error";
import { LocalizedPage } from "../../src/presentation/localized-page";

vi.mock("next/navigation", () => ({
  useParams: () => ({ locale: "fr-CA" }),
}));
vi.mock("../../src/i18n/read-localized-content", () => ({
  readLocalizedCatalog: (locale: string) => {
    if (locale !== "fr-CA") throw new Error("unexpected locale");
    return {
      error: {
        heading: "Localized error heading",
        summary: "Localized error summary",
        retryLabel: "Localized retry action",
      },
    };
  },
}));
vi.mock("../../src/infrastructure/observability/browser-reporter", () => ({
  reportReactBoundaryError: vi.fn(),
}));

describe("localized page", () => {
  it("renders localized navigation, current-page state, and the locale switch", () => {
    const navigation = [{ href: "/fr-CA", label: "Current route" }];
    const localeSwitch = { href: "/en-CA", label: "Switch locale" };
    render(
      <LocalizedPage
        locale="fr-CA"
        currentPath="/fr-CA"
        sections={[
          {
            id: "introduction",
            type: "hero",
            variant: "default",
            enabled: true,
            content: {
              heading: "Localized heading",
              summary: "Localized summary",
            },
          },
        ]}
        navigation={navigation}
        localeSwitch={localeSwitch}
        skipToContent="Skip test content"
        navigationLabel="Test navigation"
      />,
    );
    expect(screen.getByRole("link", { name: "Current route" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Switch locale" })).toHaveAttribute(
      "href",
      "/en-CA",
    );
  });

  it("renders authored localized CTA and project destinations exactly", () => {
    const ctaHref = "/fr-CA/about?x=1&y=2#team";
    const projectHref = "/fr-CA/work/featured?source=project#details";
    const localeSwitch = { href: "/en-CA", label: "English" };
    render(
      <LocalizedPage
        locale="fr-CA"
        currentPath="/fr-CA"
        sections={[
          {
            id: "contact", type: "call-to-action", variant: "default", enabled: true,
            content: { heading: "Contact", summary: "Résumé", label: "Ouvrir", href: ctaHref },
          },
          {
            id: "featured", type: "project-list", variant: "default", enabled: true,
            content: {
              heading: "Projets",
              projects: [{ title: "Projet", summary: "Résumé du projet", href: projectHref }],
            },
          },
        ]}
        navigation={[{ href: "/fr-CA", label: "Accueil" }]}
        localeSwitch={localeSwitch}
        skipToContent="Aller au contenu"
        navigationLabel="Navigation principale"
      />,
    );
    expect(screen.getByRole("link", { name: "Ouvrir" })).toHaveAttribute("href", ctaHref);
    expect(screen.getByRole("link", { name: "Projet" })).toHaveAttribute("href", projectHref);
  });

  it("renders ordinary route failures in the active locale", () => {
    const reset = () => {};
    render(<ErrorBoundary error={new Error("test")} reset={reset} />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Localized error heading" }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Localized retry action" }),
    ).toBeVisible();
  });
});
