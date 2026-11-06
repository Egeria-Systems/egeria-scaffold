import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CalendlyBooking } from "../../src/integrations/booking-calendly/calendly-booking";
import type { BookingContent } from "../../src/integrations/booking-calendly/booking-content";

const destination = "https://calendly.com/synthetic-development/intro";
const unavailableMessages = {
  "en-CA": "Online booking is currently unavailable. Please use the contact details below.",
  "fr-CA": "La prise de rendez-vous en ligne est actuellement indisponible. Veuillez utiliser les coordonnées ci-dessous.",
} as const;

const content: Readonly<Record<"en-CA" | "fr-CA", BookingContent>> = {
  "en-CA": { heading: "Book a conversation", summary: "Choose a time that works for you.", linkLabel: "Schedule with Calendly", frameTitle: "Calendly scheduling page", popupHeading: "Choose a time", closeLabel: "Close scheduling", unavailable: unavailableMessages["en-CA"] },
  "fr-CA": { heading: "Planifier une conversation", summary: "Choisissez une heure qui vous convient.", linkLabel: "Prendre rendez-vous avec Calendly", frameTitle: "Page de prise de rendez-vous Calendly", popupHeading: "Choisir une heure", closeLabel: "Fermer la prise de rendez-vous", unavailable: unavailableMessages["fr-CA"] },
};

describe("booking availability", () => {
  for (const mode of ["link", "inline", "popup"] as const) {
    it(`keeps unavailable ${mode} local across locales and configuration changes`, () => {
      const unavailableSettings = { mode, destination: undefined };
      const configuredSettings = { mode, destination };
      const view = render(<CalendlyBooking settings={unavailableSettings} copy={content["en-CA"]} />);
      for (const locale of ["en-CA", "fr-CA"] as const) {
        view.rerender(<CalendlyBooking settings={unavailableSettings} copy={content[locale]} />);
        expect(screen.getByText(unavailableMessages[locale])).toBeVisible();
        expect(screen.getByRole("region", { name: content[locale].heading })).toBeVisible();
        expect(view.container.querySelectorAll("a, iframe, dialog, script, button")).toHaveLength(0);
      }
      view.rerender(<CalendlyBooking settings={configuredSettings} copy={content["en-CA"]} />);
      expect(screen.getByRole("link")).toHaveAttribute("href", destination);
      view.rerender(<CalendlyBooking settings={unavailableSettings} copy={content["en-CA"]} />);
      expect(screen.getByText(unavailableMessages["en-CA"])).toBeVisible();
      expect(view.container.querySelectorAll("a, iframe, dialog, script, button")).toHaveLength(0);
    });
  }
});
