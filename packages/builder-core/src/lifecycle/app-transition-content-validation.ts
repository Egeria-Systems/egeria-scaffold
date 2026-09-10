export type AppTransitionContentValidators = Readonly<{
  parseYaml(source: string): unknown;
  parseSite(value: unknown): unknown;
  parseMarkdown(source: string): unknown;
  parseConfiguration(value: unknown): unknown;
  parseBooking(value: unknown): unknown;
  parseAnalytics(value: unknown): unknown;
  parseErrorCopy(value: unknown): unknown;
  parseRouting(value: unknown): unknown;
  parseRoutedPage(value: unknown): unknown;
  parseLocalized(value: unknown, locale: "en-CA" | "fr-CA", profile: "portfolio" | "site"): unknown;
  assertParity(reference: unknown, candidate: unknown, profile: "portfolio" | "site"): void;
}>;
type ContentModule = Readonly<{
  parseYamlContent: AppTransitionContentValidators["parseYaml"];
  parseSiteContent: AppTransitionContentValidators["parseSite"];
  parseMarkdownContent: AppTransitionContentValidators["parseMarkdown"];
  parseContentConfiguration: AppTransitionContentValidators["parseConfiguration"];
}>;
type RoutingModule = Readonly<{
  parseRoutingContent: AppTransitionContentValidators["parseRouting"];
  parseRoutedPageContent: AppTransitionContentValidators["parseRoutedPage"];
}>;
type LocalizedModule = Readonly<{
  parseLocalizedCatalog(value: unknown, locale: "en-CA" | "fr-CA"): unknown;
  assertTranslationParity(reference: unknown, candidate: unknown): void;
}>;
export async function loadAppTransitionContentValidators(): Promise<AppTransitionContentValidators> {
  const content = await import(new URL("../content-validation/content-schema.js", import.meta.url).href) as ContentModule;
  const portfolio = await import(new URL("../content-validation/portfolio/localized-content.js", import.meta.url).href) as LocalizedModule;
  const site = await import(new URL("../content-validation/site/localized-content.js", import.meta.url).href) as LocalizedModule;
  const routing = await import(new URL("../content-validation/routing-content-schema.js", import.meta.url).href) as RoutingModule;
  const booking = await import(new URL("../content-validation/booking-content.js", import.meta.url).href) as Readonly<{parseBookingContent: AppTransitionContentValidators["parseBooking"]}>;
  const analytics = await import(new URL("../content-validation/analytics-content.js", import.meta.url).href) as Readonly<{parseAnalyticsContent: AppTransitionContentValidators["parseAnalytics"]}>;
  const errors = await import(new URL("../content-validation/error-copy.js", import.meta.url).href) as Readonly<{parseErrorFallbackCopy: AppTransitionContentValidators["parseErrorCopy"]}>;
  const localized = { portfolio, site };
  return {
    parseYaml: content.parseYamlContent,
    parseSite: content.parseSiteContent,
    parseMarkdown: content.parseMarkdownContent,
    parseConfiguration: content.parseContentConfiguration,
    parseBooking: booking.parseBookingContent,
    parseAnalytics: analytics.parseAnalyticsContent,
    parseErrorCopy: errors.parseErrorFallbackCopy,
    parseRouting: routing.parseRoutingContent,
    parseRoutedPage: routing.parseRoutedPageContent,
    parseLocalized: (value, locale, profile) => localized[profile].parseLocalizedCatalog(value, locale),
    assertParity: (reference, candidate, profile) => { localized[profile].assertTranslationParity(reference, candidate); },
  };
}
