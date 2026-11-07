import { defineConfig, devices } from "@playwright/test";
// Only these owned HTTPS loopback canaries use ephemeral self-signed certificates.
export default defineConfig({ testDir: "./tests/transport", outputDir: "./test-results/transport", workers: 1, retries: 0,
  reporter: [["list"]], use: { ...devices["Desktop Chrome"], ignoreHTTPSErrors: true, serviceWorkers: "block", trace: "off", video: "off", screenshot: "off" } });
