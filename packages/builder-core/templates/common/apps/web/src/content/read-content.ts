import { readFileSync } from "node:fs";

import {
  parseSiteContent,
  parseYamlContent,
  type SiteContent,
} from "./content-schema";

const siteContentUrl = new URL("../../content/en-CA/site.yaml", import.meta.url);

export function readSiteContent(): SiteContent {
  return parseSiteContent(
    parseYamlContent(readFileSync(siteContentUrl, "utf8")),
  );
}
