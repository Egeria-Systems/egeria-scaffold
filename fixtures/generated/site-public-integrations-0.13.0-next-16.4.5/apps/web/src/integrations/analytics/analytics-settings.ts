import type { AnalyticsSettings } from "./analytics-provider-contract";

export const analyticsSettings = {
  "consent": {
    "policy": "explicit-opt-in"
  },
  "providers": {
    "cloudflareWebAnalytics": true,
    "googleAnalytics4": true,
    "microsoftClarity": {
      "audience": "not-directed-to-minors"
    }
  },
  "operationalIntegrations": {
    "googleSearchConsole": true,
    "lookerStudio": {
      "connector": "google-analytics-4"
    }
  }
} as const satisfies AnalyticsSettings;
