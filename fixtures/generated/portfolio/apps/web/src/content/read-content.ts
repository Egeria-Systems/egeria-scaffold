import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  parseSiteContent,
  parseYamlContent,
  type SiteContent,
} from "./content-schema";

const siteContentPath = join(process.cwd(), "content/en-CA/site.yaml");

export function readSiteContent(): SiteContent {
  return parseSiteContent(
    parseYamlContent(readFileSync(siteContentPath, "utf8")),
  );
}
