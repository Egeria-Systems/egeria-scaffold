import { createDocumentMetadata } from "../src/configuration/document-metadata";
import { readCompiledSiteOrigin } from "../src/configuration/site-origin";
import type { Metadata } from "next";
import type { ReactNode } from "react";

import {
  readContentConfiguration,
  readSiteContent,
} from "../src/content/read-content";
import { WebVitalsReporter } from "../src/infrastructure/observability/web-vitals-reporter";
import "./globals.css";

const { metadata: contentMetadata } = readSiteContent();
const { defaultLocale } = readContentConfiguration();

export const metadata: Metadata = {
  ...createDocumentMetadata(readCompiledSiteOrigin(), process.env.NEXT_PUBLIC_APPLICATION_ENVIRONMENT),
  alternates: { canonical: "/" },

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
        <WebVitalsReporter />
      </body>
    </html>
  );
}
