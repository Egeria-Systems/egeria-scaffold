import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";

import { resolveBookingDestination } from "./src/integrations/booking-calendly/booking-settings.ts";

import { resolveBuildApplicationEnvironment } from "./src/configuration/application-environment.ts";


const target = resolveBuildApplicationEnvironment({
  applicationEnvironment: process.env.APPLICATION_ENVIRONMENT,
  publicApplicationEnvironment: process.env.NEXT_PUBLIC_APPLICATION_ENVIRONMENT,
}, "local");
if (!target.ok) {
  throw new Error(`APPLICATION_ENVIRONMENT_INVALID:${target.issue.field}:${target.issue.reason}`);
}

const booking = resolveBookingDestination(process.env.NEXT_PUBLIC_CALENDLY_URL, target.value);
if (!booking.ok) {
  throw new Error(`BOOKING_CONFIGURATION_INVALID:${booking.issue.field}:${booking.issue.reason}`);
}

initOpenNextCloudflareForDev();

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_APPLICATION_ENVIRONMENT: target.value,
    NEXT_PUBLIC_CALENDLY_URL: booking.destination ?? "",
  },
  output: "standalone",
  outputFileTracingRoot: fileURLToPath(new URL("../../", import.meta.url)),
  reactStrictMode: true,
  turbopack: {
    rules: {
      "*.{md,yaml,yml}": {
        loaders: ["raw-loader"],
        as: "*.js",
      },
    },
  },
};

export default nextConfig;
