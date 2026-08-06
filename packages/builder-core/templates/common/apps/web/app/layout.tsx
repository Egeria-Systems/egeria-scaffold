import type { Metadata } from "next";
import type { ReactNode } from "react";

import { readSiteContent } from "../src/content/read-content";
import "./globals.css";

const { metadata: contentMetadata } = readSiteContent();

export const metadata: Metadata = {
  title: contentMetadata.title,
  description: contentMetadata.description,
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en-CA">
      <body>{children}</body>
    </html>
  );
}
