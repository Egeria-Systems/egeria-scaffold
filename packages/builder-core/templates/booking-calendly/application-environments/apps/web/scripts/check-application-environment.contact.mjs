import { resolveBookingDestination } from "../src/integrations/booking-calendly/booking-settings.ts";
import { resolveApplicationBuild } from "../src/configuration/application-build.ts";
import { resolveContactSettings } from "../src/integrations/contact-form-web3forms/contact-settings.ts";

const args = process.argv.slice(2);
if (args.length !== 1 || (args[0] !== "--local" && args[0] !== "--deployment")) {
  console.error(JSON.stringify({ code: "APPLICATION_ENVIRONMENT_ARGUMENT_INVALID" }));
  process.exitCode = 2;
} else {
  const result = resolveApplicationBuild({
    applicationEnvironment: process.env.APPLICATION_ENVIRONMENT,
    publicApplicationEnvironment: process.env.NEXT_PUBLIC_APPLICATION_ENVIRONMENT,
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
    sourceRevision: process.env.BUILD_SOURCE_REVISION,
    deploymentId: process.env.NEXT_DEPLOYMENT_ID,
  }, args[0] === "--deployment" ? "deployment" : "local");
  if (!result.ok) {
    console.error(JSON.stringify({ code: "APPLICATION_ENVIRONMENT_INVALID", ...result.issue }));
    process.exitCode = 1;
  } else {
    const contact = resolveContactSettings(process.env.NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY, result.value.target);
    if (!contact.ok) {
      console.error(JSON.stringify({ code: "CONTACT_CONFIGURATION_INVALID", ...contact.issue }));
      process.exitCode = 1;
    } else {
      const booking = resolveBookingDestination(process.env.NEXT_PUBLIC_CALENDLY_URL, result.value.target);
      if (!booking.ok) {
        console.error(JSON.stringify({ code: "BOOKING_CONFIGURATION_INVALID", ...booking.issue }));
        process.exitCode = 1;
      }
    }
  }
}
