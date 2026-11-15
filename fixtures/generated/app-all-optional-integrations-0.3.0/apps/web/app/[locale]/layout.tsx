import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { readLocalizedCatalog } from "../../src/i18n/read-localized-content";
import {
  createLanguageAlternates,
  isLocale,
  supportedLocales,
} from "../../src/i18n/locale";

type LocaleLayoutProperties = Readonly<{
  children: ReactNode;
  params: Promise<{ locale: string }>;
}>;

export function generateStaticParams() {
  return supportedLocales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: Omit<LocaleLayoutProperties, "children">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) {
    notFound();
  }
  const { metadata } = readLocalizedCatalog(locale);
  return {
    title: metadata.title,
    description: metadata.description,
    alternates: {
      canonical: `/${locale}`,
      languages: createLanguageAlternates("/"),
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: LocaleLayoutProperties) {
  const { locale } = await params;
  if (!isLocale(locale)) {
    notFound();
  }

  return children;
}
