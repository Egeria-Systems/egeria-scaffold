import { readFileSync } from "node:fs";

import {
  parsePageContent,
  parseYamlContent,
} from "../../src/content/content-schema";
import { readSiteContent } from "../../src/content/read-content";
import { ContentPage } from "../../src/presentation/content-page";

const aboutContentUrl = new URL(
  "../../content/en-CA/about.yaml",
  import.meta.url,
);

export default function About() {
  const content = parsePageContent(
    parseYamlContent(readFileSync(aboutContentUrl, "utf8")),
  );
  const { navigation } = readSiteContent();

  return (
    <ContentPage
      heading={content.heading}
      summary={content.summary}
      navigation={navigation}
    />
  );
}
