import type { Metadata } from "next";
import type { ReactNode } from "react";
import { proofCopy } from "../src/content/read-proof-copy";
import "./globals.css";

export const metadata: Metadata = proofCopy.metadata;

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en-CA">
      <body>{children}</body>
    </html>
  );
}
