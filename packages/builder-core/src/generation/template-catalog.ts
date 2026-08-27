import type { ContractIssue, ValidationResult } from "../contracts/result.js";
import { deriveTemplateDestination } from "./render-template.js";

export type TemplateCatalogEntry = Readonly<{
  source: string;
  destination: string;
  contentKind: "text" | "binary";
}>;

type TemplateSource = Readonly<{
  source: string;
  destinationSource?: string;
  contentKind: TemplateCatalogEntry["contentKind"];
}>;

function textTemplateSources(sources: readonly string[]): readonly TemplateSource[] {
  return sources.map((source) => ({ source, contentKind: "text" }));
}

const commonTemplateSources = textTemplateSources([
  "common/.github/workflows/deploy.yml.template",
  "common/.github/workflows/quality.yml.template",
  "common/.gitignore.template",
  "common/.nvmrc",
  "common/AGENTS.md.template",
  "common/README.md.template",
  "common/package.json.template",
  "common/pnpm-workspace.yaml",
  "common/apps/web/AGENTS.md.template",
  "common/apps/web/package.json.template",
  "common/apps/web/postcss.config.mjs",
  "common/apps/web/tsconfig.json",
  "common/apps/web/eslint.config.mjs",
  "common/apps/web/next.config.ts",
  "common/apps/web/open-next.config.ts",
  "common/apps/web/instrumentation-client.ts",
  "common/apps/web/instrumentation.ts",
  "common/apps/web/playwright.config.shared.ts",
  "common/apps/web/playwright.deployed.config.ts",
  "common/apps/web/playwright.dev.config.ts",
  "common/apps/web/playwright.preview.config.ts",
  "common/apps/web/playwright.visual.config.ts",
  "common/apps/web/wrangler.jsonc.template",
  "common/apps/web/app/globals.css",
  "common/apps/web/app/layout.tsx",
  "common/apps/web/app/page.tsx",
  "common/apps/web/app/api/observability/route.ts",
  "common/apps/web/app/error.tsx",
  "common/apps/web/app/global-error.tsx",
  "common/apps/web/content/content.config.yaml",
  "common/apps/web/content/en-CA/observability.yaml",
  "common/apps/web/src/content/content-schema.ts",
  "common/apps/web/src/content/content-source.d.ts",
  "common/apps/web/src/content/read-content.ts",
  "common/apps/web/src/infrastructure/cloudflare/observability-context.ts",
  "common/apps/web/src/infrastructure/observability/browser-reporter.ts",
  "common/apps/web/src/infrastructure/observability/error-copy.ts",
  "common/apps/web/src/infrastructure/observability/installed-capability.ts",
  "common/apps/web/src/infrastructure/observability/server-reporter.ts",
  "common/apps/web/src/infrastructure/observability/web-vitals-reporter.tsx",
  "common/apps/web/src/presentation/content-page.tsx",
  "common/apps/web/src/presentation/error-fallback.tsx",
  "common/apps/web/src/sections/section-registry.tsx",
  "common/apps/web/tests/component/content-page.test.tsx",
  "common/apps/web/tests/e2e/site-quality.spec.ts",
  "common/apps/web/tests/setup/component.ts",
  "common/apps/web/tests/unit/content-schema.test.ts",
  "common/apps/web/tests/visual/home-visual.spec.ts",
  "common/apps/web/vitest.config.ts",
] as const);

const portfolioTemplateSources: readonly TemplateSource[] = [
  ...textTemplateSources([
    "portfolio/apps/web/content/en-CA/long-form/introduction.md.template",
    "portfolio/apps/web/content/en-CA/site.yaml.template",
  ] as const),
  {
    source:
      "portfolio/apps/web/tests/visual/home-visual.spec.ts-snapshots/home-desktop-chromium-linux.png",
    contentKind: "binary",
  },
  {
    source:
      "portfolio/apps/web/tests/visual/home-visual.spec.ts-snapshots/home-mobile-chromium-linux.png",
    contentKind: "binary",
  },
];

const legacySiteTemplateSources: readonly TemplateSource[] = [
  ...textTemplateSources([
    "site/apps/web/content/en-CA/site.yaml.template",
    "site/apps/web/content/en-CA/about.yaml.template",
    "site/apps/web/content/en-CA/long-form/introduction.md.template",
    "site/apps/web/app/about/page.tsx",
  ] as const),
  {
    source:
      "site/apps/web/tests/visual/home-visual.spec.ts-snapshots/home-desktop-chromium-linux.png",
    contentKind: "binary",
  },
  {
    source:
      "site/apps/web/tests/visual/home-visual.spec.ts-snapshots/home-mobile-chromium-linux.png",
    contentKind: "binary",
  },
];

const productionSiteTemplateSources: readonly TemplateSource[] = [
  ...textTemplateSources([
    "site/apps/web/app/page.tsx",
    "site/apps/web/app/not-found.tsx",
    "site/apps/web/app/robots.ts",
    "site/apps/web/app/sitemap.ts",
    "site/apps/web/app/work/error.tsx",
    "site/apps/web/app/work/featured/page.tsx",
    "site/apps/web/app/work/page.tsx",
    "site/apps/web/content/en-CA/long-form/introduction.md.template",
    "site/apps/web/content/en-CA/not-found.yaml.template",
    "site/apps/web/content/en-CA/routing.yaml",
    "site/apps/web/content/en-CA/work-featured.yaml.template",
    "site/apps/web/src/routing/read-routing-content.ts",
    "site/apps/web/src/routing/routing-content-schema.ts",
    "site/apps/web/src/routing/site-page.tsx",
    "site/apps/web/tests/component/site-page.test.tsx",
    "site/apps/web/tests/e2e/site-routing.spec.ts.template",
    "site/apps/web/tests/unit/routing-content.test.ts",
  ] as const),
  {
    source: "site/apps/web/app/about/production-page.tsx",
    destinationSource: "site/apps/web/app/about/page.tsx",
    contentKind: "text",
  },
  {
    source: "site/apps/web/content/en-CA/about.production.yaml.template",
    destinationSource: "site/apps/web/content/en-CA/about.yaml.template",
    contentKind: "text",
  },
  {
    source: "site/apps/web/content/en-CA/site.production.yaml.template",
    destinationSource: "site/apps/web/content/en-CA/site.yaml.template",
    contentKind: "text",
  },
  {
    source:
      "site/apps/web/tests/visual/home-visual.spec.ts-snapshots/home-desktop-chromium-linux.png",
    contentKind: "binary",
  },
  {
    source:
      "site/apps/web/tests/visual/home-visual.spec.ts-snapshots/home-mobile-chromium-linux.png",
    contentKind: "binary",
  },
];

const bookingCalendlyTemplateSources = textTemplateSources([
  "booking-calendly/apps/web/app/page.tsx",
  "booking-calendly/apps/web/content/en-CA/booking-calendly.yaml",
  "booking-calendly/apps/web/src/integrations/booking-calendly/booking-content.ts",
  "booking-calendly/apps/web/src/integrations/booking-calendly/booking-settings.ts.template",
  "booking-calendly/apps/web/src/integrations/booking-calendly/calendly-booking.tsx",
  "booking-calendly/apps/web/tests/e2e/calendly-booking.spec.ts",
] as const);

const analyticsTemplateSources = textTemplateSources([
  "analytics/apps/web/content/en-CA/analytics.yaml",
  "analytics/apps/web/content/fr-CA/analytics.yaml",
  "analytics/apps/web/src/integrations/analytics/analytics-settings.ts.template",
  "analytics/apps/web/src/integrations/analytics/analytics-provider-contract.ts",
  "analytics/apps/web/src/integrations/analytics/analytics-runtime.ts",
  "analytics/apps/web/src/integrations/analytics/analytics-content-source.d.ts",
  "analytics/apps/web/src/integrations/analytics/analytics-content.ts",
  "analytics/apps/web/src/integrations/analytics/analytics-consent.tsx",
  "analytics/apps/web/tests/unit/analytics-provider-contract.test.ts",
  "analytics/apps/web/tests/component/analytics-consent.test.tsx",
  "analytics/apps/web/tests/e2e/analytics-consent.spec.ts",
  "analytics/docs/analytics.md",
] as const);

function analyticsLayoutSource(includeMultilingual: boolean): TemplateSource {
  return {
    source: includeMultilingual
      ? "analytics/multilingual/apps/web/app/layout.tsx"
      : "analytics/apps/web/app/layout.tsx",
    destinationSource: "common/apps/web/app/layout.tsx",
    contentKind: "text",
  };
}

const multilingualCommonTemplateSources = textTemplateSources([
  "multilingual/apps/web/app/error.tsx",
  "multilingual/apps/web/middleware.ts",
  "multilingual/apps/web/app/layout.tsx",
  "multilingual/apps/web/app/[locale]/layout.tsx",
  "multilingual/apps/web/app/[locale]/[[...segments]]/page.tsx",
  "multilingual/apps/web/app/[locale]/not-found.tsx",
  "multilingual/apps/web/src/i18n/locale.ts",
  "multilingual/apps/web/src/i18n/localized-content.ts",
  "multilingual/apps/web/src/i18n/read-localized-content.ts",
  "multilingual/apps/web/src/presentation/localized-page.tsx",
  "multilingual/apps/web/tests/component/multilingual-page.test.tsx",
  "multilingual/apps/web/tests/e2e/multilingual-routing.spec.ts",
  "multilingual/apps/web/tests/unit/locale.test.ts",
  "multilingual/apps/web/tests/unit/localized-content.test.ts",
  "multilingual/apps/web/tests/visual/home-visual.spec.ts",
] as const);

function multilingualProfileSources(
  profile: "portfolio" | "site",
): readonly TemplateSource[] {
  return [
    {
      source: `multilingual/${profile}/apps/web/src/i18n/localized-profile.ts`,
      destinationSource: "common/apps/web/src/i18n/localized-profile.ts",
      contentKind: "text",
    },
    ...["en-CA", "fr-CA"].map((locale) => ({
      source: `multilingual/${profile}/apps/web/content/${locale}/localized-content.yaml.template`,
      destinationSource: `common/apps/web/content/${locale}/localized-content.yaml.template`,
      contentKind: "text" as const,
    })),
    ...(profile === "site"
      ? [
          {
            source: "multilingual/site/apps/web/app/sitemap.ts",
            destinationSource: "site/apps/web/app/sitemap.ts",
            contentKind: "text" as const,
          },
          {
            source:
              "multilingual/site/apps/web/tests/e2e/site-routing.spec.ts.template",
            destinationSource:
              "site/apps/web/tests/e2e/site-routing.spec.ts.template",
            contentKind: "text" as const,
          },
        ]
      : []),
  ];
}

function multilingualBookingSource(
  includeBookingCalendly: boolean,
): TemplateSource {
  return {
    source: includeBookingCalendly
      ? "multilingual/apps/web/src/integrations/booking/localized-booking.calendly.tsx"
      : "multilingual/apps/web/src/integrations/booking/localized-booking.stub.tsx",
    destinationSource:
      "common/apps/web/src/integrations/booking/localized-booking.tsx",
    contentKind: "text",
  };
}

const productionSiteBookingHome: TemplateSource = {
  source: "site/apps/web/app/page-with-booking.tsx",
  destinationSource: "site/apps/web/app/page.tsx",
  contentKind: "text",
};

const commonHomeRouteSource = "common/apps/web/app/page.tsx";

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function remapSourceIssue(
  issue: ContractIssue,
  index: number,
): ContractIssue {
  return {
    ...issue,
    path: ["templates", index, "source"],
  };
}

export function createTemplateCatalog(
  profile: "portfolio" | "site",
  includeBookingCalendly = false,
  recipeVersion = profile === "site" ? "0.11.0" : "0.10.0",
  includeMultilingual = false,
  includeAnalytics = false,
): ValidationResult<readonly TemplateCatalogEntry[]> {
  const productionSite = profile === "site" && recipeVersion === "0.11.0";
  const sources = [
    ...commonTemplateSources.filter(
      ({ source }) =>
        !(
          (includeBookingCalendly || productionSite) &&
          source === commonHomeRouteSource
        ) &&
        !(
          (includeMultilingual || includeAnalytics) &&
          source === "common/apps/web/app/layout.tsx"
        ) &&
        !(includeMultilingual && source === "common/apps/web/app/error.tsx") &&
        !(
          includeMultilingual &&
          source === "common/apps/web/tests/visual/home-visual.spec.ts"
        ),
    ),
    ...(profile === "portfolio"
      ? portfolioTemplateSources
      : productionSite
        ? productionSiteTemplateSources.filter(
            ({ source }) =>
              (!includeBookingCalendly || source !== "site/apps/web/app/page.tsx") &&
              (!includeMultilingual ||
                (source !== "site/apps/web/app/sitemap.ts" &&
                  source !==
                    "site/apps/web/tests/e2e/site-routing.spec.ts.template")),
          )
        : legacySiteTemplateSources),
    ...(includeBookingCalendly
      ? bookingCalendlyTemplateSources.filter(
          ({ source }) =>
            !productionSite || source !== "booking-calendly/apps/web/app/page.tsx",
        )
      : []),
    ...(includeBookingCalendly && productionSite
      ? [productionSiteBookingHome]
      : []),
    ...(includeMultilingual
      ? [
          ...multilingualCommonTemplateSources.filter(
            ({ source }) =>
              !(
                includeAnalytics &&
                source === "multilingual/apps/web/app/layout.tsx"
              ),
          ),
          ...multilingualProfileSources(profile),
          multilingualBookingSource(includeBookingCalendly),
        ]
      : []),
    ...(includeAnalytics
      ? [...analyticsTemplateSources, analyticsLayoutSource(includeMultilingual)]
      : []),
  ];
  const destinations = new Set<string>();
  const entries: TemplateCatalogEntry[] = [];

  for (const [index, { source, destinationSource, contentKind }] of sources.entries()) {
    const destinationResult = deriveTemplateDestination(
      destinationSource ?? source,
    );

    if (!destinationResult.ok) {
      return {
        ok: false,
        issues: destinationResult.issues.map((issue) =>
          remapSourceIssue(issue, index),
        ),
      };
    }

    if (destinations.has(destinationResult.value)) {
      return {
        ok: false,
        issues: [
          {
            code: "TEMPLATE_DESTINATION_DUPLICATE",
            path: ["files", destinationResult.value],
            context: { reason: "duplicate-destination" },
          },
        ],
      };
    }

    destinations.add(destinationResult.value);
    entries.push({ source, destination: destinationResult.value, contentKind });
  }

  return {
    ok: true,
    value: [...entries].sort((left, right) =>
      compareText(left.destination, right.destination),
    ),
  };
}
