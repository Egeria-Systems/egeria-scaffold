import { describe, expect, it } from "vitest";
import { parseApplicationBuildId, resolveApplicationBuild } from "@/src/configuration/application-build";

describe("application build identity", () => {
  const revision = "a".repeat(40);
  const input = { applicationEnvironment: "staging", siteUrl: "https://staging.example.test", sourceRevision: revision };

  it("binds the compiled target to the exact source revision", () => {
    expect(resolveApplicationBuild(input, "deployment")).toEqual({ ok: true, value: { target: "staging", siteOrigin: input.siteUrl, buildId: `egeria-staging-${revision}` } });
    expect(parseApplicationBuildId(`egeria-staging-${revision}`)).toEqual({ ok: true, value: { target: "staging", revision } });
    expect(resolveApplicationBuild({ applicationEnvironment: undefined }, "local")).toEqual({ ok: true, value: { target: "development", siteOrigin: "http://localhost:3000" } });
  });

  it("preserves revision-bound identity with absent or empty deployment IDs", () => {
    for (const mode of ["local", "deployment"] as const) {
      for (const deploymentId of [undefined, ""]) {
        expect(resolveApplicationBuild({ ...input, deploymentId }, mode)).toEqual({ ok: true, value: { target: "staging", siteOrigin: input.siteUrl, buildId: `egeria-staging-${revision}` } });
      }
    }
  });

  it("preserves local defaults with absent or empty deployment IDs", () => {
    for (const deploymentId of [undefined, ""]) {
      expect(resolveApplicationBuild({ applicationEnvironment: undefined, deploymentId }, "local")).toEqual({ ok: true, value: { target: "development", siteOrigin: "http://localhost:3000" } });
    }
  });

  it("rejects nonempty and non-string deployment IDs without coercion", () => {
    for (const mode of ["local", "deployment"] as const) {
      for (const deploymentId of ["override", " ", null, false, 0]) {
        expect(resolveApplicationBuild({ ...input, deploymentId }, mode)).toEqual({ ok: false, issue: { field: "deploymentId", reason: "invalid" } });
      }
    }
  });

  it("refuses release omissions, target disagreement and deployment overrides", () => {
    for (const changed of [{ sourceRevision: undefined }, { sourceRevision: "not-a-revision" }, { siteUrl: undefined }, { publicApplicationEnvironment: "production" }, { deploymentId: "override" }]) {
      expect(resolveApplicationBuild({ ...input, ...changed }, "deployment").ok).toBe(false);
    }
    for (const value of [`egeria-staging-${revision}\n`, `egeria-preview-${revision}`, "random-build", null]) expect(parseApplicationBuildId(value).ok).toBe(false);
  });
});
