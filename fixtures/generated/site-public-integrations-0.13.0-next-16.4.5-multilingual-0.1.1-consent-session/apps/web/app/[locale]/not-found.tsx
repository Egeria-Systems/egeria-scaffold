import { headers } from "next/headers";

import { localeFromMiddlewareHeader } from "../../src/i18n/localized-content";
import { readLocalizedCatalog } from "../../src/i18n/read-localized-content";
import { createLocaleSwitchHref } from "../../src/i18n/locale";
import { LocalizedPage } from "../../src/presentation/localized-page";

export default async function LocalizedNotFound() {
  const requestHeaders = await headers();
  const locale = localeFromMiddlewareHeader(
    requestHeaders.get("x-egeria-locale"),
  );
  const catalog = readLocalizedCatalog(locale);
  const localeSwitch = {
    ...catalog.localeSwitch,
    href: createLocaleSwitchHref(locale, "/"),
  };
  return (
    <LocalizedPage
      locale={locale}
      currentPath=""
      sections={catalog.notFound.sections}
      navigation={catalog.navigation}
      localeSwitch={localeSwitch}
      skipToContent={catalog.accessibility.skipToContent}
      navigationLabel={catalog.accessibility.navigationLabel}
    />
  );
}
