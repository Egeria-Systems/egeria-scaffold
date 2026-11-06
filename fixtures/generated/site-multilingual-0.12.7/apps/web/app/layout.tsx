import { headers } from "next/headers";
import type { ReactNode } from "react";

import { isLocale } from "../src/i18n/locale";
import { WebVitalsReporter } from "../src/infrastructure/observability/web-vitals-reporter";
import "./globals.css";

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
