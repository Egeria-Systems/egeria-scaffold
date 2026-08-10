import bookingContentSource from "../../../content/en-CA/booking-calendly.yaml";

import {
  parseYamlContent,
} from "../../content/content-schema";

export type BookingContent = Readonly<{
  heading: string;
  summary: string;
  linkLabel: string;
  frameTitle: string;
  popupHeading: string;
  closeLabel: string;
}>;

const bookingContentKeys = [
  "heading",
  "summary",
  "linkLabel",
  "frameTitle",
  "popupHeading",
  "closeLabel",
] as const;

function isUnknownRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasDisallowedControlCharacter(value: string): boolean {
  for (const character of value) {
    const codeUnit = character.charCodeAt(0);

    if (
      codeUnit <= 0x08 ||
      codeUnit === 0x0b ||
      codeUnit === 0x0c ||
      (codeUnit >= 0x0e && codeUnit <= 0x1f) ||
      (codeUnit >= 0x7f && codeUnit <= 0x9f)
    ) {
      return true;
    }
  }

  return false;
}

function isCopyValue(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    !hasDisallowedControlCharacter(value)
  );
}

export function parseBookingContent(value: unknown): BookingContent {
  if (!isUnknownRecord(value)) {
    throw new TypeError("CONTENT_INVALID");
  }

  const keys = Object.keys(value).sort();
  const expectedKeys = [...bookingContentKeys].sort();

  if (
    keys.length !== expectedKeys.length ||
    !keys.every((key, index) => key === expectedKeys[index]) ||
    !isCopyValue(value.heading) ||
    !isCopyValue(value.summary) ||
    !isCopyValue(value.linkLabel) ||
    !isCopyValue(value.frameTitle) ||
    !isCopyValue(value.popupHeading) ||
    !isCopyValue(value.closeLabel)
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
  };
}

export function readBookingContent(): BookingContent {
  return parseBookingContent(parseYamlContent(bookingContentSource));
}
