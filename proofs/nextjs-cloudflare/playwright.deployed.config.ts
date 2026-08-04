import { createProofPlaywrightConfig } from "./playwright.config.shared";

const baseURL = process.env.COMPATIBILITY_URL?.replace(/\/+$/, "");

if (!baseURL) {
  throw new Error("COMPATIBILITY_URL is required for deployed proof tests");
}

export default createProofPlaywrightConfig({ baseURL });
