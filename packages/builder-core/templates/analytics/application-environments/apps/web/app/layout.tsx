import type { Metadata } from "next";
import type { ReactNode } from "react";

import {
  readContentConfiguration,
  readSiteContent,
} from "../src/content/read-content";
import { WebVitalsReporter } from "../src/infrastructure/observability/web-vitals-reporter";
import { AnalyticsConsent } from "../src/integrations/analytics/analytics-consent";
import { readAnalyticsContent } from "../src/integrations/analytics/analytics-content";
import { readCompiledAnalyticsConfiguration } from "../src/integrations/analytics/analytics-configuration";
import { analyticsSettings } from "../src/integrations/analytics/analytics-settings";
import "./globals.css";

const { metadata: contentMetadata } = readSiteContent();
const { defaultLocale } = readContentConfiguration();
const analyticsConfiguration = readCompiledAnalyticsConfiguration(analyticsSettings);
const searchVerification = analyticsConfiguration.ok
  ? analyticsConfiguration.configuration.googleSiteVerification
  : undefined;

export const metadata: Metadata = {
  title: contentMetadata.title,
  description: contentMetadata.description,
  ...(searchVerification === undefined
    ? {}
    : { verification: { google: searchVerification } }),
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const analyticsContent = readAnalyticsContent("en-CA");

  return (
    <html lang={defaultLocale}>
      <body>
        {children}
        <AnalyticsConsent settings={analyticsSettings} content={analyticsContent} />
        <WebVitalsReporter />
      </body>
    </html>
  );
}
