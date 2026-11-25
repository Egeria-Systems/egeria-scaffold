import type { MetadataRoute } from "next";

import { readRoutingContent } from "../src/routing/read-routing-content";
import { siteRoutes } from "../src/routing/routing-content-schema";

export default function sitemap(): MetadataRoute.Sitemap {
  const { baseUrl } = readRoutingContent();

  return siteRoutes.map(({ segments }) => ({
    url: new URL(segments.length === 0 ? "/" : `/${segments.join("/")}`, baseUrl).toString(),
    changeFrequency: "monthly",
    priority: segments.length === 0 ? 1 : 0.8,
  }));
}
