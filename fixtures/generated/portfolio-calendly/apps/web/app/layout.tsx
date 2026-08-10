import type { Metadata } from "next";
import type { ReactNode } from "react";

import {
  readContentConfiguration,
  readSiteContent,
} from "../src/content/read-content";
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
      <body>{children}</body>
    </html>
  );
}
