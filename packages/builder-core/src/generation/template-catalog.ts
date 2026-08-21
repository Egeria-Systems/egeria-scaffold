import type { ContractIssue, ValidationResult } from "../contracts/result.js";
import { deriveTemplateDestination } from "./render-template.js";

export type TemplateCatalogEntry = Readonly<{
  source: string;
  destination: string;
  contentKind: "text" | "binary";
}>;

type TemplateSource = Readonly<{
  source: string;
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
  "common/apps/web/performance-policy.json",
  "common/apps/web/instrumentation-client.ts",
  "common/apps/web/instrumentation.ts",
  "common/apps/web/playwright.config.shared.ts",
  "common/apps/web/playwright.deployed.config.ts",
  "common/apps/web/playwright.dev.config.ts",
  "common/apps/web/playwright.preview.config.ts",
  "common/apps/web/playwright.visual.config.ts",
  "common/apps/web/scripts/run-performance-budgets.mjs",
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
    "portfolio/apps/web/performance-baseline.json",
    "portfolio/apps/web/performance-budget.json",
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

const siteTemplateSources: readonly TemplateSource[] = [
  ...textTemplateSources([
    "site/apps/web/performance-baseline.json",
    "site/apps/web/performance-budget.json",
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

const bookingCalendlyTemplateSources = textTemplateSources([
  "booking-calendly/apps/web/app/page.tsx",
  "booking-calendly/apps/web/content/en-CA/booking-calendly.yaml",
  "booking-calendly/apps/web/src/integrations/booking-calendly/booking-content.ts",
  "booking-calendly/apps/web/src/integrations/booking-calendly/booking-settings.ts.template",
  "booking-calendly/apps/web/src/integrations/booking-calendly/calendly-booking.tsx",
  "booking-calendly/apps/web/tests/e2e/calendly-booking.spec.ts",
] as const);

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
): ValidationResult<readonly TemplateCatalogEntry[]> {
  const sources = [
    ...commonTemplateSources.filter(
      ({ source }) => !includeBookingCalendly || source !== commonHomeRouteSource,
    ),
    ...(profile === "portfolio"
      ? portfolioTemplateSources
      : siteTemplateSources),
    ...(includeBookingCalendly ? bookingCalendlyTemplateSources : []),
  ];
  const destinations = new Set<string>();
  const entries: TemplateCatalogEntry[] = [];

  for (const [index, { source, contentKind }] of sources.entries()) {
    const destinationResult = deriveTemplateDestination(source);

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
