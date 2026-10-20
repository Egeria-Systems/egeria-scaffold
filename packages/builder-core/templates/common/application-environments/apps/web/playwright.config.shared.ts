import { defineConfig, devices, type PlaywrightTestConfig } from "@playwright/test";
import { readTransportSettings } from "./tests/e2e/application-transport";

type BrowserQualityOptions = Readonly<{ baseURL: string; webServer?: PlaywrightTestConfig["webServer"] }>;
export function createBrowserQualityConfig({ baseURL, webServer }: BrowserQualityOptions): PlaywrightTestConfig {
  const { protectedStaging } = readTransportSettings(baseURL, process.env);
  return defineConfig({
    testDir: "./tests/e2e", outputDir: "./test-results", fullyParallel: false, forbidOnly: Boolean(process.env.CI),
    retries: protectedStaging ? 0 : process.env.CI ? 1 : 0, ...(process.env.CI ? { workers: 1 } : {}),
    reporter: protectedStaging ? [["list"]] : [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
    use: { baseURL, serviceWorkers: "block", trace: protectedStaging ? "off" : "retain-on-failure",
      screenshot: protectedStaging ? "off" : "only-on-failure", video: protectedStaging ? "off" : "retain-on-failure" },
    projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
    ...(webServer === undefined ? {} : { webServer }),
  });
}
