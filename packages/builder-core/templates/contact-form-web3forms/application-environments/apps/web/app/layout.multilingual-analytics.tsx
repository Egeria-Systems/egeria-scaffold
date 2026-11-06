import { headers } from "next/headers";
import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";

import { isLocale } from "../src/i18n/locale";
import { WebVitalsReporter } from "../src/infrastructure/observability/web-vitals-reporter";
import { AnalyticsConsent } from "../src/integrations/analytics/analytics-consent";
import { readAnalyticsContent } from "../src/integrations/analytics/analytics-content";
import { readCompiledAnalyticsConfiguration } from "../src/integrations/analytics/analytics-configuration";
import { analyticsSettings } from "../src/integrations/analytics/analytics-settings";
import { ContactFormPlacement } from "../src/integrations/contact-form-web3forms/contact-form-placement";
import "./globals.css";

const analyticsConfiguration = readCompiledAnalyticsConfiguration(analyticsSettings);
const searchVerification = analyticsConfiguration.ok
  ? analyticsConfiguration.configuration.googleSiteVerification
  : undefined;

export const metadata: Metadata = searchVerification === undefined
  ? {}
  : { verification: { google: searchVerification } };

export default async function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const requestHeaders = await headers();
  const requestedLocale = requestHeaders.get("x-egeria-locale");
  const locale = requestedLocale !== null && isLocale(requestedLocale)
    ? requestedLocale
    : "en-CA";
  const analyticsContent = readAnalyticsContent(locale);

  return (
    <html lang={locale}>
      <body>
        {children}
        <Suspense fallback={null}>
          <ContactFormPlacement multilingual={true} />
        </Suspense>
        <AnalyticsConsent settings={analyticsSettings} content={analyticsContent} />
        <WebVitalsReporter />
      </body>
    </html>
  );
}
