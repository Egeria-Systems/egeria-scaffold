import { createProofPlaywrightConfig } from "./playwright.config.shared";

const baseURL = "http://127.0.0.1:3101";

export default createProofPlaywrightConfig({
  baseURL,
  webServer: {
    command:
      "pnpm exec opennextjs-cloudflare preview -- --ip 127.0.0.1 --port 3101",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
