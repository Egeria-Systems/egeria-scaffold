import { describe, expect, it } from "vitest";
import { parseApplicationEnvironment, resolveBuildApplicationEnvironment, validateRuntimeApplicationEnvironment } from "@/src/configuration/application-environment";

describe("application environment", () => {
  it("defaults only absent local build configuration", () => {
    for (const value of [undefined, ""]) {
      expect(resolveBuildApplicationEnvironment({ applicationEnvironment: value }, "local")).toEqual({ ok: true, value: "development" });
      expect(resolveBuildApplicationEnvironment({ applicationEnvironment: value }, "deployment").ok).toBe(false);
      expect(validateRuntimeApplicationEnvironment(value, "development").ok).toBe(false);
    }
  });

  it("requires exact targets and rejects malformed input without retaining it", () => {
    for (const value of [" ", "Production", "private-sentinel", null, 7]) {
      expect(parseApplicationEnvironment(value)).toEqual({ ok: false, issue: { field: "APPLICATION_ENVIRONMENT", reason: "invalid" } });
    }
    for (const value of ["development", "staging", "production"] as const) {
      expect(parseApplicationEnvironment(value)).toEqual({ ok: true, value });
      expect(validateRuntimeApplicationEnvironment(value, value)).toEqual({ ok: true, value });
    }
  });

  it("derives the public target and requires an explicit deployment target", () => {
    expect(resolveBuildApplicationEnvironment({ applicationEnvironment: "development" }, "deployment").ok).toBe(false);
    expect(resolveBuildApplicationEnvironment({ applicationEnvironment: undefined, publicApplicationEnvironment: "staging" }, "deployment").ok).toBe(false);
    expect(resolveBuildApplicationEnvironment({ applicationEnvironment: "staging", publicApplicationEnvironment: "staging" }, "deployment")).toEqual({ ok: true, value: "staging" });
    expect(resolveBuildApplicationEnvironment({ applicationEnvironment: "staging", publicApplicationEnvironment: "production" }, "local")).toEqual({ ok: false, issue: { field: "NEXT_PUBLIC_APPLICATION_ENVIRONMENT", reason: "mismatch" } });
    expect(validateRuntimeApplicationEnvironment("production", "staging")).toEqual({ ok: false, issue: { field: "APPLICATION_ENVIRONMENT", reason: "mismatch" } });
  });
});
