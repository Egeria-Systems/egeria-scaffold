import { resolveAnalyticsConfiguration } from "../src/integrations/analytics/analytics-configuration.ts";
import { analyticsSettings } from "../src/integrations/analytics/analytics-settings.ts";
import { resolveBookingDestination } from "../src/integrations/booking-calendly/booking-settings.ts";
import { resolveBuildApplicationEnvironment } from "../src/configuration/application-environment.ts";

const args = process.argv.slice(2);
if (args.length !== 1 || (args[0] !== "--local" && args[0] !== "--deployment")) {
  console.error(JSON.stringify({ code: "APPLICATION_ENVIRONMENT_ARGUMENT_INVALID" }));
  process.exitCode = 2;
} else {
  const result = resolveBuildApplicationEnvironment({
    applicationEnvironment: process.env.APPLICATION_ENVIRONMENT,
    publicApplicationEnvironment: process.env.NEXT_PUBLIC_APPLICATION_ENVIRONMENT,
  }, args[0] === "--deployment" ? "deployment" : "local");
  if (!result.ok) {
    console.error(JSON.stringify({ code: "APPLICATION_ENVIRONMENT_INVALID", ...result.issue }));
    process.exitCode = 1;
  } else {
    const booking = resolveBookingDestination(process.env.NEXT_PUBLIC_CALENDLY_URL, result.value);
    if (!booking.ok) {
      console.error(JSON.stringify({ code: "BOOKING_CONFIGURATION_INVALID", ...booking.issue }));
      process.exitCode = 1;
    }
  }
  if (process.exitCode === undefined) {
    const analytics = resolveAnalyticsConfiguration(analyticsSettings, {
      enabled: process.env.NEXT_PUBLIC_ANALYTICS_ENABLED,
      cloudflareToken: process.env.NEXT_PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN,
      googleMeasurementId: process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID,
      clarityProjectId: process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID,
      googleSiteVerification: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
      siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
    }, result.value);
    if (!analytics.ok) {
      console.error(JSON.stringify({ code: "ANALYTICS_CONFIGURATION_INVALID", ...analytics.issue }));
      process.exitCode = 1;
    }
  }

}
