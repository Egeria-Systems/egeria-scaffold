import { readSiteContent } from "../src/content/read-content";
import { readNotFoundContent } from "../src/routing/read-routing-content";
import { SitePage } from "../src/routing/site-page";

export default function NotFound() {
  const { accessibility, navigation } = readSiteContent();
  const content = readNotFoundContent();

  return (
    <SitePage
      currentPath=""
      sections={content.sections}
      navigation={navigation}
      skipToContent={accessibility.skipToContent}
    />
  );
}
