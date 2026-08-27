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
        heading: "Une erreur s’est produite",
        summary: "Veuillez réessayer.",
        retryLabel: "Réessayer",
      },
    };
  },
}));
vi.mock("../../src/infrastructure/observability/browser-reporter", () => ({
  reportReactBoundaryError: vi.fn(),
}));

describe("localized page", () => {
  it("renders localized navigation, current-page state, and the locale switch", () => {
    const navigation = [{ href: "/fr-CA", label: "Accueil" }];
    const localeSwitch = { href: "/en-CA", label: "English" };
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
            content: { heading: "Bonjour", summary: "Bienvenue." },
          },
        ]}
        navigation={navigation}
        localeSwitch={localeSwitch}
        skipToContent="Passer au contenu"
        navigationLabel="Navigation principale"
      />,
    );
    expect(screen.getByRole("link", { name: "Accueil" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "English" })).toHaveAttribute(
      "href",
      "/en-CA",
    );
  });

  it("renders ordinary route failures in the active locale", () => {
    const reset = () => {};
    render(<ErrorBoundary error={new Error("test")} reset={reset} />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Une erreur s’est produite" }),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Réessayer" })).toBeVisible();
  });
});
