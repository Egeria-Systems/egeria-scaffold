import { afterEach, describe, expect, it, vi } from "vitest";
import { readContactSettings, resolveContactSettings } from "../../src/integrations/contact-form-web3forms/contact-settings";

const accessKey = "00000000-0000-4000-8000-000000000001";
afterEach(() => { vi.unstubAllEnvs(); });

describe("contact build configuration", () => {
  it("permits absent configuration only in development", () => {
    for (const value of [undefined, ""]) {
      expect(resolveContactSettings(value, "development")).toEqual({ ok: true, settings: undefined });
      for (const target of ["staging", "production"] as const) {
        expect(resolveContactSettings(value, target)).toEqual({ ok: false, issue: { field: "NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY", reason: "missing" } });
      }
    }
  });
  it("accepts only exact public UUIDs without normalizing malformed values", () => {
    for (const target of ["development", "staging", "production"] as const) {
      for (const value of [accessKey, "ABCDEFAB-1234-4321-ABCD-0123456789AB"]) {
        expect(resolveContactSettings(value, target)).toEqual({ ok: true, settings: { accessKey: value } });
      }
      for (const value of [null, false, 123, {}, " ", ` ${accessKey}`, `${accessKey}\n`, "private-rejected-sentinel"]) {
        expect(resolveContactSettings(value, target)).toEqual({ ok: false, issue: { field: "NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY", reason: "invalid" } });
      }
    }
  });
  it("reads the compiled target and key lazily with field-only failures", () => {
    vi.stubEnv("NEXT_PUBLIC_APPLICATION_ENVIRONMENT", "development");
    vi.stubEnv("NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY", "");
    expect(readContactSettings()).toBeUndefined();
    vi.stubEnv("NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY", accessKey);
    expect(readContactSettings()).toEqual({ accessKey });
    vi.stubEnv("NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY", "private-rejected-sentinel");
    expect(readContactSettings).toThrow("CONTACT_CONFIGURATION_INVALID:NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY:invalid");
    vi.stubEnv("NEXT_PUBLIC_APPLICATION_ENVIRONMENT", "private-target-sentinel");
    expect(readContactSettings).toThrow("APPLICATION_ENVIRONMENT_INVALID:APPLICATION_ENVIRONMENT:invalid");
  });
});
