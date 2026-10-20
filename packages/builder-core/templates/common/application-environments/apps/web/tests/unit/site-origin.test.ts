import { afterEach, describe, expect, it, vi } from "vitest";
import { readCompiledSiteOrigin, resolveSiteOrigin } from "@/src/configuration/site-origin";

afterEach(() => vi.unstubAllEnvs());

describe("site origin", () => {
  it("normalizes the single configured origin and defaults only development", () => {
    expect(resolveSiteOrigin({ target: "staging", value: "https://EXAMPLE.com:443/" })).toEqual({ ok: true, value: "https://example.com" });
    expect(resolveSiteOrigin({ target: "development", value: undefined })).toEqual({ ok: true, value: "http://localhost:3000" });
    for (const target of ["staging", "production"] as const) expect(resolveSiteOrigin({ target, value: undefined }).ok).toBe(false);
  });

  it("refuses credentials, extra URL components and nonlocal HTTP without echoing inputs", () => {
    for (const value of ["https://private-sentinel@example.com", "https://example.com/path", "https://example.com?", "https://example.com#", " https://example.com", "http://example.com", "https://example.com\\other"]) {
      const result = resolveSiteOrigin({ target: "production", value });
      expect(result.ok).toBe(false);
      expect(JSON.stringify(result)).not.toContain("private-sentinel");
    }
  });

  it("reads the literal compiled target and origin", () => {
    vi.stubEnv("NEXT_PUBLIC_APPLICATION_ENVIRONMENT", "staging");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://staging.example.test");
    expect(readCompiledSiteOrigin()).toBe("https://staging.example.test");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    expect(() => readCompiledSiteOrigin()).toThrow("SITE_ORIGIN_INVALID");
  });
});
