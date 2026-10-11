import { createBrowserQualityConfig } from "./playwright.config.shared";
const baseURL = "http://127.0.0.1:3101";
const target = process.env.APPLICATION_ENVIRONMENT;
if (!["development", "staging", "production"].includes(target ?? "")) throw new Error("APPLICATION_ENVIRONMENT_INVALID");
const selection = target === "development" ? "" : ` --env ${target}`;
export default createBrowserQualityConfig({ baseURL, webServer: {
  command: `pnpm exec opennextjs-cloudflare preview${selection} -- --ip 127.0.0.1 --port 3101`,
  url: baseURL, reuseExistingServer: false, timeout: 180000,
} });
