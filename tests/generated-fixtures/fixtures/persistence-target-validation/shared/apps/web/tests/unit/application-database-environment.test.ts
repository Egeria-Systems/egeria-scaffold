import { describe, expect, it } from "vitest";
import {
  matchesApplicationDatabaseTarget,
  resolveApplicationDatabaseEnvironment,
} from "../../src/configuration/application-database";

describe("application database target mapping", () => {
  it.each([
    ["development", "local"],
    ["staging", "staging"],
    ["production", "production"],
  ] as const)("maps validated %s to %s", (application, database) => {
    expect(resolveApplicationDatabaseEnvironment(application)).toBe(database);
  });
});

describe("application database target agreement", () => {
  it.each([
    ["development", "development", "local"],
    ["staging", "staging", "staging"],
    ["production", "production", "production"],
  ] as const)("accepts %s built with runtime %s and database %s", (compiled, runtime, database) => {
    expect(matchesApplicationDatabaseTarget(compiled, runtime, database)).toBe(true);
  });

  it.each([
    ["a missing runtime target", undefined, "local"],
    ["a database label as runtime target", "local", "local"],
    ["a non-string runtime target", { value: "development" }, "local"],
    ["a conflicting runtime target with the compiled target's database label", "staging", "local"],
    ["a conflicting runtime target with its own database label", "staging", "staging"],
    ["a missing database label", "development", undefined],
    ["an application target as database label", "development", "development"],
    ["a non-string database label", "development", { value: "local" }],
    ["another target's database label", "development", "production"],
  ] as const)("refuses %s", (_case, runtime, database) => {
    expect(matchesApplicationDatabaseTarget("development", runtime, database)).toBe(false);
  });
});
