import type { Metadata } from "next";

import { readSiteContent } from "../../../src/content/read-content";
import { readFeaturedWorkContent } from "../../../src/routing/read-routing-content";
import { SitePage } from "../../../src/routing/site-page";

const featuredWorkContent = readFeaturedWorkContent();

export const metadata: Metadata = featuredWorkContent.metadata;

export default function FeaturedWork() {
  const { accessibility, navigation } = readSiteContent();

  return (
    <SitePage
      currentPath="/work/featured"
      sections={featuredWorkContent.sections}
      navigation={navigation}
      skipToContent={accessibility.skipToContent}
    />
  );
}
