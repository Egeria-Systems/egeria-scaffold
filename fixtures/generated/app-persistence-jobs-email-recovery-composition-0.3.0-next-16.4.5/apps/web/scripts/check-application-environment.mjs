import { readPublicBuildEnvironment, resolvePublicBuild } from "../src/configuration/public-build.ts";

const configurationErrorCodes = {
  base: "APPLICATION_ENVIRONMENT_INVALID",
  contact: "CONTACT_CONFIGURATION_INVALID",
  booking: "BOOKING_CONFIGURATION_INVALID",
  analytics: "ANALYTICS_CONFIGURATION_INVALID",
};

const args = process.argv.slice(2);
if (args.length !== 1 || (args[0] !== "--local" && args[0] !== "--deployment")) {
  console.error(JSON.stringify({ code: "APPLICATION_ENVIRONMENT_ARGUMENT_INVALID" }));
  process.exitCode = 2;
} else {
  const result = resolvePublicBuild(readPublicBuildEnvironment(), args[0] === "--deployment" ? "deployment" : "local");
  if (!result.ok) {
    console.error(JSON.stringify({ code: configurationErrorCodes[result.source], field: result.field, reason: result.reason }));
    process.exitCode = 1;
  }
}
