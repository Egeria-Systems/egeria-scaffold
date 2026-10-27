import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";

import { resolveBuildApplicationEnvironment } from "./src/configuration/application-environment.ts";

const target = resolveBuildApplicationEnvironment({
  applicationEnvironment: process.env.APPLICATION_ENVIRONMENT,
  publicApplicationEnvironment: process.env.NEXT_PUBLIC_APPLICATION_ENVIRONMENT,
}, "local");
if (!target.ok) {
  throw new Error(`APPLICATION_ENVIRONMENT_INVALID:${target.issue.field}:${target.issue.reason}`);
}

initOpenNextCloudflareForDev();

const nextConfig: NextConfig = {
  env: { NEXT_PUBLIC_APPLICATION_ENVIRONMENT: target.value },
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
