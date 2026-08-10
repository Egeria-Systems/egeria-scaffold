import type { ContractIssue, ValidationResult } from "../contracts/result.js";
import { deriveTemplateDestination } from "./render-template.js";

export type TemplateCatalogEntry = Readonly<{
  source: string;
  destination: string;
}>;

const commonTemplateSources = [
  "common/.gitignore.template",
  "common/.nvmrc",
  "common/AGENTS.md.template",
  "common/README.md.template",
  "common/package.json.template",
  "common/pnpm-workspace.yaml",
  "common/apps/web/AGENTS.md.template",
  "common/apps/web/package.json.template",
  "common/apps/web/tsconfig.json",
  "common/apps/web/eslint.config.mjs",
  "common/apps/web/next.config.ts",
  "common/apps/web/open-next.config.ts",
  "common/apps/web/wrangler.jsonc.template",
  "common/apps/web/app/globals.css",
  "common/apps/web/app/layout.tsx",
  "common/apps/web/app/page.tsx",
  "common/apps/web/content/content.config.yaml",
  "common/apps/web/src/content/content-schema.ts",
  "common/apps/web/src/content/read-content.ts",
  "common/apps/web/src/presentation/content-page.tsx",
  "common/apps/web/src/sections/section-registry.tsx",
  "common/apps/web/src/infrastructure/observability/installed-capability.ts",
] as const;

const portfolioTemplateSources = [
  "portfolio/apps/web/content/en-CA/long-form/introduction.md.template",
  "portfolio/apps/web/content/en-CA/site.yaml.template",
] as const;

const siteTemplateSources = [
  "site/apps/web/content/en-CA/site.yaml.template",
  "site/apps/web/content/en-CA/about.yaml.template",
  "site/apps/web/content/en-CA/long-form/introduction.md.template",
  "site/apps/web/app/about/page.tsx",
] as const;

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
): ValidationResult<readonly TemplateCatalogEntry[]> {
  const sources = [
    ...commonTemplateSources,
    ...(profile === "portfolio"
      ? portfolioTemplateSources
      : siteTemplateSources),
  ];
  const destinations = new Set<string>();
  const entries: TemplateCatalogEntry[] = [];

  for (const [index, source] of sources.entries()) {
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
    entries.push({ source, destination: destinationResult.value });
  }

  return {
    ok: true,
    value: [...entries].sort((left, right) =>
      compareText(left.destination, right.destination),
    ),
  };
}
