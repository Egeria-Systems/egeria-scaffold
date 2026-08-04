import { createProofPlaywrightConfig } from "./playwright.config.shared";

const baseURL = "http://127.0.0.1:3100";

export default createProofPlaywrightConfig({
  baseURL,
  webServer: {
    command: "pnpm dev",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
