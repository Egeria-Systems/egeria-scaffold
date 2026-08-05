import { z } from "zod";

const stableIdentifierPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const stableSemanticVersionPattern =
  /^(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)$/;
const sha256FingerprintPattern = /^sha256:[a-f0-9]{64}$/;

function containsNoControlCharacters(value: string): boolean {
  for (const character of value) {
    const codePoint = character.codePointAt(0);

    if (codePoint !== undefined && (codePoint <= 31 || codePoint === 127)) {
      return false;
    }
  }

  return true;
}

export const stableIdentifierSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(stableIdentifierPattern)
  .meta({ id: "urn:egeria-systems:schema:stable-identifier:1.0.0" });

export const semanticVersionSchema = z
  .string()
  .regex(stableSemanticVersionPattern)
  .meta({ id: "urn:egeria-systems:schema:semantic-version:1.0.0" });

export const safeRelativePathSchema = z
  .string()
  .min(1)
  .max(1024)
  .regex(
    /^(?!\/)(?![A-Za-z]:\/)(?!.*\\)(?!.*(?:^|\/)\.{1,2}(?:\/|$))(?!.*\/\/)[^/]+(?:\/[^/]+)*$/,
  )
  .refine(containsNoControlCharacters, "path contains control characters")
  .meta({ id: "urn:egeria-systems:schema:safe-relative-path:1.0.0" });

export const fingerprintSchema = z
  .string()
  .regex(sha256FingerprintPattern)
  .meta({ id: "urn:egeria-systems:schema:sha256-fingerprint:1.0.0" });

export const jsonPointerSchema = z
  .string()
  .regex(/^(?:\/(?:[^~/]|~[01])*)*$/)
  .meta({ id: "urn:egeria-systems:schema:json-pointer:1.0.0" });

export type StableIdentifier = z.infer<typeof stableIdentifierSchema>;
export type SemanticVersion = z.infer<typeof semanticVersionSchema>;
export type SafeRelativePath = z.infer<typeof safeRelativePathSchema>;
export type Fingerprint = z.infer<typeof fingerprintSchema>;
