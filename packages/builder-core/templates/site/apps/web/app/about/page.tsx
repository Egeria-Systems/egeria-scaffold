import aboutContent from "../../content/en-CA/about.json";
import { parsePageContent } from "../../src/content/content-schema";
import { readSiteContent } from "../../src/content/read-content";
import { ContentPage } from "../../src/presentation/content-page";

export default function About() {
  const content = parsePageContent(aboutContent);
  const { navigation } = readSiteContent();

  return (
    <ContentPage
      heading={content.heading}
      summary={content.summary}
      navigation={navigation}
    />
  );
}
