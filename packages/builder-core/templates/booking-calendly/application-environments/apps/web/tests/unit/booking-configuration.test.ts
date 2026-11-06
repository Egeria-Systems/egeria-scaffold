import { describe, expect, it } from "vitest";
import { resolveBookingDestination } from "../../src/integrations/booking-calendly/booking-settings";

const destinations = ["https://calendly.com/synthetic-development/intro", "https://www.calendly.com:443/synthetic-production/intro"];

describe("booking configuration", () => {
  for (const target of ["development", "staging", "production"] as const) {
    it(`requires a selected release destination and preserves accepted ${target} input`, () => {
      for (const value of [undefined, ""]) {
        expect(resolveBookingDestination(value, target)).toEqual(target === "development"
          ? { ok: true, destination: undefined }
          : { ok: false, issue: { field: "NEXT_PUBLIC_CALENDLY_URL", reason: "missing" } });
      }
      for (const destination of destinations) expect(resolveBookingDestination(destination, target)).toEqual({ ok: true, destination });
    });
    it(`rejects unsafe ${target} destinations without reflecting their values`, () => {
      for (const value of [null, 3, false, {}, " ", "http://calendly.com/a", "https://calendly.com/", "https://other.test/a", "https://calendly.com.other.test/a", "https://private-sentinel@calendly.com/a", "https://calendly.com/a?private-sentinel", "https://calendly.com/a#private-sentinel", "https://calendly.com/a ", "https://calendly.com:444/a", `https://calendly.com/${"a".repeat(2048)}`]) {
        expect(resolveBookingDestination(value, target)).toEqual({ ok: false, issue: { field: "NEXT_PUBLIC_CALENDLY_URL", reason: "invalid" } });
      }
    });
  }
});
