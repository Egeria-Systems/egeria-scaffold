import { headers } from "next/headers";
import { Suspense, type ReactNode } from "react";

import { isLocale } from "../src/i18n/locale";
import { WebVitalsReporter } from "../src/infrastructure/observability/web-vitals-reporter";
import { ContactFormPlacement } from "../src/integrations/contact-form-web3forms/contact-form-placement";
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
        <Suspense fallback={null}>
          <ContactFormPlacement multilingual={true} />
        </Suspense>
        <WebVitalsReporter />
      </body>
    </html>
  );
}
