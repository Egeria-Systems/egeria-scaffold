import aboutContentSource from "../../content/en-CA/about.yaml";
import notFoundContentSource from "../../content/en-CA/not-found.yaml";
import routingContentSource from "../../content/en-CA/routing.yaml";
import featuredWorkContentSource from "../../content/en-CA/work-featured.yaml";

import { parseYamlContent } from "../content/content-schema";
import {
  parseRoutedPageContent,
  parseRoutingContent,
  type RoutedPageContent,
  type RoutingContent,
} from "./routing-content-schema";

export function readRoutingContent(): RoutingContent {
  return parseRoutingContent(parseYamlContent(routingContentSource));
}

export function readAboutContent(): RoutedPageContent {
  return parseRoutedPageContent(parseYamlContent(aboutContentSource));
}

export function readNotFoundContent(): RoutedPageContent {
  return parseRoutedPageContent(parseYamlContent(notFoundContentSource));
}

export function readFeaturedWorkContent(): RoutedPageContent {
  return parseRoutedPageContent(parseYamlContent(featuredWorkContentSource));
}
