import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";

import {
  localizedRoutes,
  resolveLocalizedRoute,
} from "../../../src/i18n/localized-content";
import { readLocalizedCatalog } from "../../../src/i18n/read-localized-content";
import {
  createLanguageAlternates,
  createLocaleSwitchHref,
  isLocale,
  localizePath,
  supportedLocales,
} from "../../../src/i18n/locale";
import { LocalizedBooking } from "../../../src/integrations/booking/localized-booking";
import { LocalizedPage } from "../../../src/presentation/localized-page";

type LocalizedRouteProperties = Readonly<{
  params: Promise<{ locale: string; segments?: string[] }>;
}>;

export function generateStaticParams() {
  return supportedLocales.flatMap((locale) =>
    localizedRoutes.map(({ segments }) => ({ locale, segments: [...segments] })),
  );
}

export async function generateMetadata({
  params,
}: LocalizedRouteProperties): Promise<Metadata> {
  const { locale, segments = [] } = await params;
  if (!isLocale(locale)) {
    notFound();
  }
  const route = resolveLocalizedRoute(locale, segments);
  if (route.kind === "redirect") {
    return {};
  }
  const catalog = readLocalizedCatalog(locale);
  if (route.kind === "not-found") {
    return {
      ...catalog.notFound.metadata,
      robots: { index: false, follow: false },
    };
  }
  const page = catalog.pages[route.identifier];
  if (page === undefined) {
    notFound();
  }
  const unlocalizedPath = segments.length === 0 ? "/" : `/${segments.join("/")}`;
  return {
    ...page.metadata,
    alternates: {
      canonical: localizePath(locale, unlocalizedPath),
      languages: createLanguageAlternates(unlocalizedPath),
    },
  };
}

export default async function LocalizedRoute({ params }: LocalizedRouteProperties) {
  const { locale, segments = [] } = await params;
  if (!isLocale(locale)) {
    notFound();
  }
  const route = resolveLocalizedRoute(locale, segments);
  if (route.kind === "redirect") {
    permanentRedirect(route.path);
  }
  if (route.kind === "not-found") {
    notFound();
  }

  const catalog = readLocalizedCatalog(locale);
  const page = catalog.pages[route.identifier];
  if (page === undefined) {
    notFound();
  }
  const unlocalizedPath = segments.length === 0 ? "/" : `/${segments.join("/")}`;
  const localeSwitch = {
    ...catalog.localeSwitch,
    href: createLocaleSwitchHref(locale, unlocalizedPath),
  };
  return (
    <LocalizedPage
      locale={locale}
      currentPath={route.path}
      sections={page.sections}
      navigation={catalog.navigation}
      localeSwitch={localeSwitch}
      skipToContent={catalog.accessibility.skipToContent}
      navigationLabel={catalog.accessibility.navigationLabel}
    >
      {route.identifier === "home" ? (
        <LocalizedBooking copy={catalog.booking} />
      ) : null}
    </LocalizedPage>
  );
}
