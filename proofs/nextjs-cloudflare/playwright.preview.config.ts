import { createProofPlaywrightConfig } from "./playwright.config.shared";

const baseURL = "http://127.0.0.1:3101";

export default createProofPlaywrightConfig({
  baseURL,
  webServer: {
    command: "pnpm preview",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
