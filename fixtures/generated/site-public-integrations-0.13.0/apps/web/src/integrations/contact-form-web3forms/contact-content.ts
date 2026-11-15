import englishSource from "../../../content/en-CA/contact-form-web3forms.yaml?raw";
import frenchSource from "../../../content/fr-CA/contact-form-web3forms.yaml?raw";
import { hasExactKeys, isNonEmptyString, isUnknownRecord, parseYamlContent } from "../../content/content-schema";

export type ContactLocale = "en-CA" | "fr-CA";
const contentKeys = [
  "heading",
  "summary",
  "unavailable",
  "nameLabel",
  "emailLabel",
  "messageLabel",
  "submitLabel",
  "pendingLabel",
  "nameError",
  "emailError",
  "messageError",
  "captchaError",
  "activateCaptchaLabel",
  "captchaNotice",
  "captchaLoading",
  "captchaUnavailable",
  "captchaExpired",
  "accepted",
  "rejected",
  "rateLimited",
  "unknown",
  "privacy",
  "subject",
  "fallbackLabel"
] as const;
export type ContactContent = Readonly<Record<typeof contentKeys[number], string>>;

export function parseContactContent(value: unknown): ContactContent {
  if (!isUnknownRecord(value) || !hasExactKeys(value, contentKeys) ||
      !contentKeys.every(key => isNonEmptyString(value[key]))) throw new TypeError("CONTACT_CONTENT_INVALID");
  if (typeof value.subject !== "string" || value.subject.length > 120 || /[\r\n]/u.test(value.subject)) throw new TypeError("CONTACT_CONTENT_INVALID");
  return value as ContactContent;
}

export function readContactContent(locale: ContactLocale): ContactContent {
  const sources = { "en-CA": englishSource, "fr-CA": frenchSource };
  return parseContactContent(parseYamlContent(sources[locale]));
}
