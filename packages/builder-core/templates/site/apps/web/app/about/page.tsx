import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  parsePageContent,
  parseYamlContent,
} from "../../src/content/content-schema";
import { readSiteContent } from "../../src/content/read-content";
import { ContentPage } from "../../src/presentation/content-page";

const aboutContentPath = join(process.cwd(), "content/en-CA/about.yaml");

export default function About() {
  const content = parsePageContent(
    parseYamlContent(readFileSync(aboutContentPath, "utf8")),
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
