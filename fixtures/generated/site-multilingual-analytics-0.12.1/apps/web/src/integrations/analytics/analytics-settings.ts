import type { AnalyticsSettings } from "./analytics-provider-contract";

export const analyticsSettings = {
  "consent": {
    "policy": "explicit-opt-in"
  },
  "providers": {
    "cloudflareWebAnalytics": {
      "siteToken": "0123456789abcdef0123456789abcdef"
    },
    "googleAnalytics4": {
      "measurementId": "G-ABCDEF1234"
    },
    "microsoftClarity": {
      "projectId": "clarity123",
      "audience": "not-directed-to-minors"
    }
  },
  "operationalIntegrations": {
    "googleSearchConsole": {
      "verificationToken": "search-console-verification-token"
    },
    "lookerStudio": {
      "connector": "google-analytics-4"
    }
  }
} as const satisfies AnalyticsSettings;
