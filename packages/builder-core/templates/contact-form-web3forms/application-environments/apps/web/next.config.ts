import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";

import { resolveBuildApplicationEnvironment } from "./src/configuration/application-environment.ts";

import { resolveContactSettings } from "./src/integrations/contact-form-web3forms/contact-settings.ts";

const target = resolveBuildApplicationEnvironment({
  applicationEnvironment: process.env.APPLICATION_ENVIRONMENT,
  publicApplicationEnvironment: process.env.NEXT_PUBLIC_APPLICATION_ENVIRONMENT,
}, "local");
if (!target.ok) {
  throw new Error(`APPLICATION_ENVIRONMENT_INVALID:${target.issue.field}:${target.issue.reason}`);
}

const contact = resolveContactSettings(process.env.NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY, target.value);
if (!contact.ok) {
  throw new Error(`CONTACT_CONFIGURATION_INVALID:${contact.issue.field}:${contact.issue.reason}`);
}

initOpenNextCloudflareForDev();

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_APPLICATION_ENVIRONMENT: target.value,
    NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY: contact.settings?.accessKey ?? "",
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
