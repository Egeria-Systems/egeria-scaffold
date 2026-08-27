import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LocalizedPage } from "../../src/presentation/localized-page";

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
});
