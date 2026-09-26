import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";

import { resolveBookingDestination } from "./src/integrations/booking-calendly/booking-settings.ts";

import { resolveBuildApplicationEnvironment } from "./src/configuration/application-environment.ts";


import { resolveAnalyticsConfiguration } from "./src/integrations/analytics/analytics-configuration.ts";
import { analyticsSettings } from "./src/integrations/analytics/analytics-settings.ts";

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

const analytics = resolveAnalyticsConfiguration(analyticsSettings, {
  enabled: process.env.NEXT_PUBLIC_ANALYTICS_ENABLED,
  cloudflareToken: process.env.NEXT_PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN,
  googleMeasurementId: process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID,
  clarityProjectId: process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID,
  googleSiteVerification: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
}, target.value);
if (!analytics.ok) {
  throw new Error(`ANALYTICS_CONFIGURATION_INVALID:${analytics.issue.field}:${analytics.issue.reason}`);
}

initOpenNextCloudflareForDev();

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_APPLICATION_ENVIRONMENT: target.value,
    NEXT_PUBLIC_ANALYTICS_ENABLED: process.env.NEXT_PUBLIC_ANALYTICS_ENABLED ?? "",
    NEXT_PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN: analytics.configuration.cloudflareToken ?? "",
    NEXT_PUBLIC_GA4_MEASUREMENT_ID: analytics.configuration.googleMeasurementId ?? "",
    NEXT_PUBLIC_CLARITY_PROJECT_ID: analytics.configuration.clarityProjectId ?? "",
    NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION: analytics.configuration.googleSiteVerification ?? "",
    NEXT_PUBLIC_SITE_URL: analytics.configuration.siteOrigin ?? "",
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
