import { describe, expect, it } from "vitest";
import { parseBuildInformation } from "@/src/domain/build-information";

const releaseId = "b2eb71ea-29a7-4c3d-8cfb-c275356ad015";

describe("build information", () => {
  it("accepts absent metadata as an immutable empty value", () => {
    const result = parseBuildInformation(undefined);

    expect(result).toEqual({ valid: true, value: {} });
    if (!result.valid) throw new Error("Expected valid absent metadata");
    expect(Object.isFrozen(result.value)).toBe(true);
  });

  it("copies only the canonical release identifier into an immutable value", () => {
    const metadata = { id: releaseId, tag: "private-tag", timestamp: "private-time" };
    const result = parseBuildInformation(metadata);
    metadata.id = "ccbf0677-7e15-4a7e-99a7-770f4c122634";

    expect(result).toEqual({ valid: true, value: { releaseId } });
    if (!result.valid) throw new Error("Expected valid build metadata");
    expect(Object.isFrozen(result.value)).toBe(true);
  });

  it.each([
    ["null", null],
    ["string", releaseId],
    ["array", []],
    ["missing identifier", {}],
    ["undefined identifier", { id: undefined }],
    ["null identifier", { id: null }],
    ["numeric identifier", { id: 123 }],
    ["empty identifier", { id: "" }],
    ["uppercase identifier", { id: releaseId.toUpperCase() }],
    ["padded identifier", { id: ` ${releaseId} ` }],
    ["identifier without separators", { id: releaseId.replaceAll("-", "") }],
    ["non-hexadecimal identifier", { id: "g2eb71ea-29a7-4c3d-8cfb-c275356ad015" }],
    ["sensitive malformed identifier", { id: "private-provider-value" }],
  ])("returns only a value-free invalid result for %s", (_description, metadata) => {
    expect(parseBuildInformation(metadata)).toEqual({ valid: false });
  });
});
