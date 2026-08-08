import { readSiteContent } from "../src/content/read-content";
import { ContentPage } from "../src/presentation/content-page";

export default function Home() {
  const content = readSiteContent();

  return (
    <ContentPage
      heading={content.home.heading}
      summary={content.home.summary}
      navigation={content.navigation}
    />
  );
}
