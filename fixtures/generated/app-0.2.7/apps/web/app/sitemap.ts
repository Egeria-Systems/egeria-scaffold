import type { MetadataRoute } from "next";

import { readSiteContent } from "../src/content/read-content";
import { readRoutingContent } from "../src/routing/read-routing-content";

export default function sitemap(): MetadataRoute.Sitemap {
  const { navigation } = readSiteContent();
  const { baseUrl } = readRoutingContent();

  return navigation
    .filter(({ href }) => href.startsWith("/") && !href.startsWith("//"))
    .map(({ href }) => ({
      url: new URL(href, baseUrl).toString(),
      changeFrequency: "monthly",
      priority: href === "/" ? 1 : 0.8,
    }));
}
