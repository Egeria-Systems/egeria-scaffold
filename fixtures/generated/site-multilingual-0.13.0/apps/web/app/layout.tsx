import { readCompiledSiteOrigin } from "../src/configuration/site-origin";
import type { Metadata } from "next";
import { headers } from "next/headers";
import type { ReactNode } from "react";

import { isLocale } from "../src/i18n/locale";
import { WebVitalsReporter } from "../src/infrastructure/observability/web-vitals-reporter";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(readCompiledSiteOrigin()),
  ...(process.env.NEXT_PUBLIC_APPLICATION_ENVIRONMENT === "production" ? {} : { robots: { index: false, follow: false } }),
};

export default async function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const requestHeaders = await headers();
  const requestedLocale = requestHeaders.get("x-egeria-locale");
  const locale = requestedLocale !== null && isLocale(requestedLocale)
    ? requestedLocale
    : "en-CA";

  return (
    <html lang={locale}>
      <body>
        {children}
        <WebVitalsReporter />
      </body>
    </html>
  );
}
