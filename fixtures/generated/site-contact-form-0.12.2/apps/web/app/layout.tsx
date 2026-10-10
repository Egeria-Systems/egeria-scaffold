import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";

import {
  readContentConfiguration,
  readSiteContent,
} from "../src/content/read-content";
import { WebVitalsReporter } from "../src/infrastructure/observability/web-vitals-reporter";
import { ContactFormPlacement } from "../src/integrations/contact-form-web3forms/contact-form-placement";
import "./globals.css";

const { metadata: contentMetadata } = readSiteContent();
const { defaultLocale } = readContentConfiguration();

export const metadata: Metadata = {
  title: contentMetadata.title,
  description: contentMetadata.description,
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang={defaultLocale}>
      <body>
        {children}
        <Suspense fallback={null}>
          <ContactFormPlacement multilingual={false} />
        </Suspense>
        <WebVitalsReporter />
      </body>
    </html>
  );
}
