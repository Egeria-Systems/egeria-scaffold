import siteContent from "../../content/en-CA/site.json";

import { parseSiteContent, type SiteContent } from "./content-schema";

export function readSiteContent(): SiteContent {
  return parseSiteContent(siteContent);
}
