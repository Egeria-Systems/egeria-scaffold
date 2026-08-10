import {
  defineConfig,
  devices,
  type PlaywrightTestConfig,
} from "@playwright/test";

type BrowserQualityOptions = Readonly<{
  baseURL: string;
  webServer?: PlaywrightTestConfig["webServer"];
}>;

export function createBrowserQualityConfig({
  baseURL,
  webServer,
}: BrowserQualityOptions): PlaywrightTestConfig {
  return defineConfig({
    testDir: "./tests/e2e",
    outputDir: "./test-results",
    fullyParallel: false,
    forbidOnly: Boolean(process.env.CI),
    retries: process.env.CI ? 1 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: [
      ["list"],
      ["html", { open: "never", outputFolder: "playwright-report" }],
    ],
    use: {
      baseURL,
      trace: "retain-on-failure",
      screenshot: "only-on-failure",
      video: "retain-on-failure",
    },
    projects: [
      {
        name: "chromium",
        use: { ...devices["Desktop Chrome"] },
      },
    ],
    ...(webServer === undefined ? {} : { webServer }),
  });
}
