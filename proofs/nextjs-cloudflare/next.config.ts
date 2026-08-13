import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";

initOpenNextCloudflareForDev();

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: fileURLToPath(new URL("../../", import.meta.url)),
  reactStrictMode: true,
};

export default nextConfig;
