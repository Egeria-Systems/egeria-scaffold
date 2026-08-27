import type { Metadata } from "next";
import { headers } from "next/headers";

import { localeFromHeader } from "../../src/i18n/localized-content";
import { readLocalizedCatalog } from "../../src/i18n/read-localized-content";
import { LocalizedPage } from "../../src/presentation/localized-page";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function LocalizedNotFound() {
  const requestHeaders = await headers();
  const locale = localeFromHeader(requestHeaders.get("x-egeria-locale"));
  const catalog = readLocalizedCatalog(locale);
  return (
    <LocalizedPage
      locale={locale}
      currentPath=""
      sections={catalog.notFound.sections}
      navigation={catalog.navigation}
      localeSwitch={catalog.localeSwitch}
      skipToContent={catalog.accessibility.skipToContent}
      navigationLabel={catalog.accessibility.navigationLabel}
    />
  );
}
