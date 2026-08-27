import { describe, expect, it } from "vitest";

import {
  createAnalyticsOperationalDeclarations,
  createAnalyticsProviderDeclarations,
} from "../../src/integrations/analytics/analytics-provider-contract";
import {
  parseAnalyticsContent,
  readAnalyticsContent,
} from "../../src/integrations/analytics/analytics-content";
import { analyticsSettings } from "../../src/integrations/analytics/analytics-settings";

describe("analytics provider contract", () => {
  it("declares each selected runtime provider once with a unique purpose", () => {
    const declarations = createAnalyticsProviderDeclarations(analyticsSettings);
    const expectedPurposes = [
      "aggregate-traffic-and-performance",
      "audience-measurement",
      "consented-experience-analysis",
    ].filter((purpose) =>
      declarations.some((declaration) => declaration.purpose === purpose),
    );

    expect(new Set(declarations.map(({ identifier }) => identifier)).size).toBe(
      declarations.length,
    );
    expect(new Set(declarations.map(({ scriptId }) => scriptId)).size).toBe(
      declarations.length,
    );
    expect(new Set(declarations.map(({ purpose }) => purpose))).toEqual(
      new Set(expectedPurposes),
    );
    expect(declarations.every(({ retention }) => retention === "provider-controlled")).toBe(true);
  });

  it("keeps operational integrations out of runtime provider loading", () => {
    const declarations = createAnalyticsOperationalDeclarations(analyticsSettings);

    expect(declarations.every(({ runtimeCode }) => runtimeCode === false)).toBe(true);
    expect(declarations.map(({ identifier }) => identifier)).toEqual([
      ...(analyticsSettings.operationalIntegrations.googleSearchConsole === undefined
        ? []
        : ["google-search-console"]),
      ...(analyticsSettings.operationalIntegrations.lookerStudio === undefined
        ? []
        : ["looker-studio"]),
    ]);
  });

  it("loads exact localized consent content and rejects extra keys", () => {
    const english = readAnalyticsContent("en-CA");
    const french = readAnalyticsContent("fr-CA");

    expect(english.allowLabel).not.toBe(french.allowLabel);
    expect(() => parseAnalyticsContent({ ...english, extra: true })).toThrow(
      "CONTENT_INVALID",
    );
  });
});
