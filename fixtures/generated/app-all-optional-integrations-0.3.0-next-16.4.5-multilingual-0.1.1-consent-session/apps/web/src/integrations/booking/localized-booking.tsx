import type { LocalizedBookingContent } from "../../i18n/localized-content";
import { readBookingContent } from "../booking-calendly/booking-content";
import { bookingCalendlySettings } from "../booking-calendly/booking-settings";
import { CalendlyBooking } from "../booking-calendly/calendly-booking";

export function LocalizedBooking({
  copy,
  locale,
}: Readonly<{ copy: LocalizedBookingContent; locale: "en-CA" | "fr-CA" }>) {
  const bookingContent = { ...readBookingContent(locale), ...copy };
  return <CalendlyBooking settings={bookingCalendlySettings} copy={bookingContent} />;
}
