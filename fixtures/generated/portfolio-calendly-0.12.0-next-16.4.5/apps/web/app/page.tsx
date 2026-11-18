import { readSiteContent } from "../src/content/read-content";
import { readBookingContent } from "../src/integrations/booking-calendly/booking-content";
import { bookingCalendlySettings } from "../src/integrations/booking-calendly/booking-settings";
import { CalendlyBooking } from "../src/integrations/booking-calendly/calendly-booking";
import { ContentPage } from "../src/presentation/content-page";

export default function Home() {
  const content = readSiteContent();
  const bookingContent = readBookingContent();

  return (
    <ContentPage
      sections={content.home.sections}
      navigation={content.navigation}
      skipToContent={content.accessibility.skipToContent}
    >
      <CalendlyBooking settings={bookingCalendlySettings} copy={bookingContent} />
    </ContentPage>
  );
}
