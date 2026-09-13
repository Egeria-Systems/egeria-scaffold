import type { MetadataRoute } from "next";

import { readRoutingContent } from "../src/routing/read-routing-content";

export default function robots(): MetadataRoute.Robots {
  const { baseUrl } = readRoutingContent();

  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: new URL("/sitemap.xml", baseUrl).toString(),
  };
}
