import type { Metadata } from "next";

import { readSiteContent } from "../src/content/read-content";
import { readNotFoundContent } from "../src/routing/read-routing-content";
import { SitePage } from "../src/routing/site-page";

const notFoundContent = readNotFoundContent();

export const metadata: Metadata = notFoundContent.metadata;

export default function NotFound() {
  const { accessibility, navigation } = readSiteContent();

  return (
    <SitePage
      currentPath=""
      sections={notFoundContent.sections}
      navigation={navigation}
      skipToContent={accessibility.skipToContent}
    />
  );
}
