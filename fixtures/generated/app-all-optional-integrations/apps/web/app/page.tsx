import { readSiteContent } from "../src/content/read-content";
import { readBookingContent } from "../src/integrations/booking-calendly/booking-content";
import { bookingCalendlySettings } from "../src/integrations/booking-calendly/booking-settings";
import { CalendlyBooking } from "../src/integrations/booking-calendly/calendly-booking";
import { SitePage } from "../src/routing/site-page";

export default function Home() {
  const content = readSiteContent();
  const bookingContent = readBookingContent();

  return (
    <SitePage
      currentPath="/"
      sections={content.home.sections}
      navigation={content.navigation}
      skipToContent={content.accessibility.skipToContent}
    >
      <CalendlyBooking settings={bookingCalendlySettings} copy={bookingContent} />
    </SitePage>
  );
}
