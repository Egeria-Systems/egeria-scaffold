import { describe, expect, it } from "vitest";
import { resolveApplicationDatabaseEnvironment } from "../../src/configuration/application-database";

describe("application database target mapping", () => {
  it.each([
    ["development", "local"],
    ["staging", "staging"],
    ["production", "production"],
  ] as const)("maps validated %s to %s", (application, database) => {
    expect(resolveApplicationDatabaseEnvironment(application)).toBe(database);
  });
});
