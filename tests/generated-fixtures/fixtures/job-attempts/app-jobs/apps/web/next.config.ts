import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import { PHASE_PRODUCTION_BUILD } from "next/constants.js";
import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";

import { readPublicBuildEnvironment, resolvePublicBuild } from "./src/configuration/public-build.ts";

const configurationErrorCodes = {
  base: "APPLICATION_BUILD_INVALID",
  contact: "CONTACT_CONFIGURATION_INVALID",
  booking: "BOOKING_CONFIGURATION_INVALID",
  analytics: "ANALYTICS_CONFIGURATION_INVALID",
};

const result = resolvePublicBuild(readPublicBuildEnvironment(), "local");
if (!result.ok) {
  throw new Error(`${configurationErrorCodes[result.source]}:${result.field}:${result.reason}`);
}
const { build: { buildId }, publicValues } = result.value;

initOpenNextCloudflareForDev();

const nextConfig: NextConfig = {
  ...(buildId === undefined ? {} : { generateBuildId: async () => buildId }),
  env: publicValues,
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

export default function configure(phase: string): NextConfig {
  if (phase === PHASE_PRODUCTION_BUILD && buildId === undefined) {
    throw new Error("APPLICATION_BUILD_INVALID:BUILD_SOURCE_REVISION:missing");
  }
  return nextConfig;
}
