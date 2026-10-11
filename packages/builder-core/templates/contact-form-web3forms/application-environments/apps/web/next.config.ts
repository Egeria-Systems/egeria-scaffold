import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";

import { resolveApplicationBuild } from "./src/configuration/application-build.ts";

import { resolveContactSettings } from "./src/integrations/contact-form-web3forms/contact-settings.ts";

const build = resolveApplicationBuild({
  applicationEnvironment: process.env.APPLICATION_ENVIRONMENT,
  publicApplicationEnvironment: process.env.NEXT_PUBLIC_APPLICATION_ENVIRONMENT,
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
  sourceRevision: process.env.BUILD_SOURCE_REVISION,
  deploymentId: process.env.NEXT_DEPLOYMENT_ID,
}, "local");
if (!build.ok) {
  throw new Error(`APPLICATION_BUILD_INVALID:${build.issue.field}:${build.issue.reason}`);
}
const target = build.value.target;
const buildId = build.value.buildId;

const contact = resolveContactSettings(process.env.NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY, target);
if (!contact.ok) {
  throw new Error(`CONTACT_CONFIGURATION_INVALID:${contact.issue.field}:${contact.issue.reason}`);
}

initOpenNextCloudflareForDev();

const nextConfig: NextConfig = {
  ...(buildId === undefined ? {} : { generateBuildId: async () => buildId }),
  env: {
    NEXT_PUBLIC_APPLICATION_ENVIRONMENT: target,
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
