import type { ReactNode } from "react";

import type { NavigationItem, PageSection } from "../content/content-schema";
import type { Locale } from "../i18n/locale";
import { SectionComposition } from "../sections/section-registry";

export type LocalizedPageProperties = Readonly<{
  locale: Locale;
  currentPath: string;
  sections: readonly PageSection[];
  navigation: readonly NavigationItem[];
  localeSwitch: Readonly<{ href: string; label: string }>;
  skipToContent: string;
  navigationLabel: string;
  children?: ReactNode;
}>;

export function LocalizedPage({
  locale,
  currentPath,
  sections,
  navigation,
  localeSwitch,
  skipToContent,
  navigationLabel,
  children,
}: LocalizedPageProperties) {
  return (
    <>
      <a href="#main-content" className="fixed left-4 top-4 z-50 inline-flex min-h-11 min-w-11 -translate-y-24 items-center justify-center rounded-md bg-accent py-3 pe-4 ps-4 font-semibold text-accent-contrast shadow-lg transition-transform focus:translate-y-0 motion-reduce:transition-none">
        {skipToContent}
      </a>
      <nav aria-label={navigationLabel} className="pt-6 pe-4 ps-4 sm:pt-8 sm:pe-6 sm:ps-6 lg:pt-12 lg:pe-8 lg:ps-8">
        <ul className="mx-auto flex w-full max-w-5xl flex-wrap gap-2 border-b border-line pb-6">
          {navigation.map((item) => {
            const current = item.href === currentPath;
            return (
              <li key={item.href}>
                <a href={item.href} aria-current={current ? "page" : undefined} className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-md py-2 pe-3 ps-3 font-semibold underline decoration-2 underline-offset-4 ${current ? "bg-accent text-accent-contrast" : "text-accent hover:text-accent-hover"}`}>
                  {item.label}
                </a>
              </li>
            );
          })}
          <li className="ms-auto">
            <a href={localeSwitch.href} hrefLang={locale === "fr-CA" ? "en-CA" : "fr-CA"} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md py-2 pe-3 ps-3 font-semibold text-accent underline decoration-2 underline-offset-4 hover:text-accent-hover">
              {localeSwitch.label}
            </a>
          </li>
        </ul>
      </nav>
      <main id="main-content" tabIndex={-1} className="min-h-screen py-6 pe-4 ps-4 sm:py-8 sm:pe-6 sm:ps-6 lg:py-12 lg:pe-8 lg:ps-8">
        <article className="mx-auto flex w-full max-w-5xl flex-col gap-16 sm:gap-20">
          <SectionComposition sections={sections} />
          {children}
        </article>
      </main>
    </>
  );
}
