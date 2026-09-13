import { readSiteContent } from "../src/content/read-content";
import { SitePage } from "../src/routing/site-page";

export default function Home() {
  const content = readSiteContent();

  return (
    <SitePage
      currentPath="/"
      sections={content.home.sections}
      navigation={content.navigation}
      skipToContent={content.accessibility.skipToContent}
    />
  );
}
