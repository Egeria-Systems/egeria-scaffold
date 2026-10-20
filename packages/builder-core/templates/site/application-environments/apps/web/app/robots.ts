import type { MetadataRoute } from "next";

import { readRoutingContent } from "../src/routing/read-routing-content";

export default function robots(): MetadataRoute.Robots {
  const { baseUrl } = readRoutingContent();

  return {
    rules: process.env.NEXT_PUBLIC_APPLICATION_ENVIRONMENT === "production"
      ? { userAgent: "*", allow: "/" }
      : { userAgent: "*", disallow: "/" },
    sitemap: new URL("/sitemap.xml", baseUrl).toString(),
  };
}
