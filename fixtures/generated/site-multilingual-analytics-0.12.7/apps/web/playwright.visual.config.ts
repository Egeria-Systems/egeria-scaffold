import { defineConfig } from "@playwright/test";

import { createBrowserQualityConfig } from "./playwright.config.shared";

const baseURL = "http://127.0.0.1:3101";
const baseConfiguration = createBrowserQualityConfig({
  baseURL,
  webServer: {
    command:
      "pnpm exec opennextjs-cloudflare preview -- --ip 127.0.0.1 --port 3101",
    url: baseURL,
    reuseExistingServer: false,
    timeout: 180_000,
  },
});

export default defineConfig(baseConfiguration, {
  testDir: "./tests/visual",
  workers: 1,
  use: {
    locale: "en-CA",
    timezoneId: "America/Toronto",
    colorScheme: "light",
    contextOptions: {
      reducedMotion: "reduce",
    },
  },
  expect: {
    toHaveScreenshot: {
      threshold: 0,
      maxDiffPixels: 0,
      animations: "disabled",
      caret: "hide",
      scale: "css",
    },
  },
});
