import frenchBookingContentSource from "../../../content/fr-CA/booking-calendly.yaml";
import bookingContentSource from "../../../content/en-CA/booking-calendly.yaml";

import {
  hasExactKeys,
  isNonEmptyString,
  isUnknownRecord,
  parseYamlContent,
} from "../../content/content-schema";

export type BookingContent = Readonly<{
  heading: string;
  summary: string;
  linkLabel: string;
  frameTitle: string;
  popupHeading: string;
  closeLabel: string;
  unavailable: string;
}>;

const bookingContentKeys = [
  "heading",
  "summary",
  "linkLabel",
  "frameTitle",
  "popupHeading",
  "closeLabel",
  "unavailable",
] as const;

export function parseBookingContent(value: unknown): BookingContent {
  if (!isUnknownRecord(value)) {
    throw new TypeError("CONTENT_INVALID");
  }

  if (
    !hasExactKeys(value, bookingContentKeys) ||
    !isNonEmptyString(value.heading) ||
    !isNonEmptyString(value.summary) ||
    !isNonEmptyString(value.linkLabel) ||
    !isNonEmptyString(value.frameTitle) ||
    !isNonEmptyString(value.popupHeading) ||
    !isNonEmptyString(value.closeLabel) ||
    !isNonEmptyString(value.unavailable)
  ) {
    throw new TypeError("CONTENT_INVALID");
  }

  return {
    heading: value.heading,
    summary: value.summary,
    linkLabel: value.linkLabel,
    frameTitle: value.frameTitle,
    popupHeading: value.popupHeading,
    closeLabel: value.closeLabel,
    unavailable: value.unavailable,
  };
}

export function readBookingContent(locale: "en-CA" | "fr-CA" = "en-CA"): BookingContent {
  return parseBookingContent(parseYamlContent(locale === "fr-CA" ? frenchBookingContentSource : bookingContentSource));
}
