import type { Metadata } from "next";

import { readSiteContent } from "../../src/content/read-content";
import { readAboutContent } from "../../src/routing/read-routing-content";
import { SitePage } from "../../src/routing/site-page";

const aboutContent = readAboutContent();

export const metadata: Metadata = aboutContent.metadata;

export default function About() {
  const { accessibility, navigation } = readSiteContent();

  return (
    <SitePage
      currentPath="/about"
      sections={aboutContent.sections}
      navigation={navigation}
      skipToContent={accessibility.skipToContent}
    />
  );
}
