import { describe, expect, it, vi } from "vitest";
import { createRequestContext } from "@/src/application/request-context";

describe("request context", () => {
  it("uses the injected identity and clock once and freezes the result", () => {
    const randomUUID = vi.fn(() => "b2eb71ea-29a7-4c3d-8cfb-c275356ad015");
    const now = vi.fn(() => new Date("2026-09-05T12:34:56.789Z"));

    const context = createRequestContext({ randomUUID, now });

    expect(context).toEqual({
      requestId: "b2eb71ea-29a7-4c3d-8cfb-c275356ad015",
      operation: "health.read",
      startedAt: "2026-09-05T12:34:56.789Z",
    });
    expect(Object.isFrozen(context)).toBe(true);
    expect(randomUUID).toHaveBeenCalledOnce();
    expect(now).toHaveBeenCalledOnce();
  });

  it("creates independent values without retaining the injected Date", () => {
    const date = new Date("2026-09-05T12:34:56.789Z");
    const randomUUID = vi.fn<() => string>()
      .mockReturnValueOnce("b2eb71ea-29a7-4c3d-8cfb-c275356ad015")
      .mockReturnValueOnce("ccbf0677-7e15-4a7e-99a7-770f4c122634");
    const first = createRequestContext({ randomUUID, now: () => date });
    date.setUTCFullYear(2027);
    const second = createRequestContext({ randomUUID, now: () => date });

    expect(first.startedAt).toBe("2026-09-05T12:34:56.789Z");
    expect(second.startedAt).toBe("2027-09-05T12:34:56.789Z");
    expect(first.requestId).not.toBe(second.requestId);
    expect(first).not.toBe(second);
  });
});
