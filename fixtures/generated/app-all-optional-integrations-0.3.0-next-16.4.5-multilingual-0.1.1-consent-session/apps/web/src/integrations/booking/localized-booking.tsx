import type { Locale } from "../../i18n/locale";
import { readBookingContent } from "../booking-calendly/booking-content";
import { bookingCalendlySettings } from "../booking-calendly/booking-settings";
import { CalendlyBooking } from "../booking-calendly/calendly-booking";

export function LocalizedBooking({ locale }: Readonly<{ locale: Locale }>) {
  return <CalendlyBooking settings={bookingCalendlySettings} copy={readBookingContent(locale)} />;
}
