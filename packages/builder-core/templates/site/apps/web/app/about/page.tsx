import aboutContentSource from "../../content/en-CA/about.yaml";

import {
  parsePageContent,
  parseYamlContent,
} from "../../src/content/content-schema";
import { readSiteContent } from "../../src/content/read-content";
import { ContentPage } from "../../src/presentation/content-page";

export default function About() {
  const content = parsePageContent(
    parseYamlContent(aboutContentSource),
  );
  const { accessibility, navigation } = readSiteContent();

  return (
    <ContentPage
      sections={content.sections}
      navigation={navigation}
      skipToContent={accessibility.skipToContent}
    />
  );
}
