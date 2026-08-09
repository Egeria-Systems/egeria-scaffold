import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  parseContentConfiguration,
  parseMarkdownContent,
  parseSiteContent,
  parseYamlContent,
  type ContentConfiguration,
  type LongFormDocument,
  type SiteContent,
} from "./content-schema";

const contentConfigurationPath = join(
  process.cwd(), "content/content.config.yaml",
);
const introductionContentPath = join(
  process.cwd(), "content/en-CA/long-form/introduction.md",
);
const siteContentPath = join(process.cwd(), "content/en-CA/site.yaml");

export function readContentConfiguration(): ContentConfiguration {
  return parseContentConfiguration(
    parseYamlContent(readFileSync(contentConfigurationPath, "utf8")),
  );
}

export function readIntroductionContent(): LongFormDocument {
  return parseMarkdownContent(readFileSync(introductionContentPath, "utf8"));
}

export function readSiteContent(): SiteContent {
  return parseSiteContent(
    parseYamlContent(readFileSync(siteContentPath, "utf8")),
  );
}
