import {
  defineConfig,
  devices,
  type PlaywrightTestConfig,
} from "@playwright/test";

interface ProofPlaywrightOptions {
  baseURL: string;
  webServer?: PlaywrightTestConfig["webServer"];
}

export function createProofPlaywrightConfig({
  baseURL,
  webServer,
}: ProofPlaywrightOptions): PlaywrightTestConfig {
  return defineConfig({
    testDir: "./tests/e2e",
    fullyParallel: false,
    forbidOnly: Boolean(process.env.CI),
    retries: process.env.CI ? 1 : 0,
    workers: 1,
    reporter: "list",
    use: {
      ...devices["Desktop Chrome"],
      baseURL,
      trace: "retain-on-failure",
    },
    ...(webServer === undefined ? {} : { webServer }),
  });
}
