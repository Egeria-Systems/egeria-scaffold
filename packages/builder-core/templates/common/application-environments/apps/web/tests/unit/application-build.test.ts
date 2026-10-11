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

  it("refuses release omissions, target disagreement and deployment overrides", () => {
    for (const changed of [{ sourceRevision: undefined }, { sourceRevision: "not-a-revision" }, { siteUrl: undefined }, { publicApplicationEnvironment: "production" }, { deploymentId: "override" }]) {
      expect(resolveApplicationBuild({ ...input, ...changed }, "deployment").ok).toBe(false);
    }
    for (const value of [`egeria-staging-${revision}\n`, `egeria-preview-${revision}`, "random-build", null]) expect(parseApplicationBuildId(value).ok).toBe(false);
  });
});
