import { Cause, Effect, Layer } from "effect";
import { describe, expect, it, vi } from "vitest";
import {
  BuildInformationReader,
  BuildInformationUnavailable,
} from "@/src/application/build-information-reader";
import { createHealthRoute } from "@/src/delivery/health-route";
import type { BuildInformation } from "@/src/domain/build-information";
import { buildInformationReaderLayer } from "@/src/infrastructure/memory/build-information-reader";

const requestId = "b2eb71ea-29a7-4c3d-8cfb-c275356ad015";
const releaseId = "ccbf0677-7e15-4a7e-99a7-770f4c122634";
const request = () => new Request("https://example.com/api/health", {
  headers: { "x-request-id": "untrusted-client-identity" },
});

function dependencies(readerLayer: Layer.Layer<BuildInformationReader>) {
  return {
    readerLayer,
    randomUUID: vi.fn(() => requestId),
    now: vi.fn(() => new Date("2026-09-05T12:34:56.789Z")),
    reportError: vi.fn<(error: unknown) => void | Promise<void>>(),
  };
}

function failureLayer(reasons: ReadonlyArray<Cause.Reason<unknown>>) {
  // Deliberately inject failures outside the declared channel to test runtime containment.
  const failure = Effect.failCause(Cause.fromReasons(reasons)) as Effect.Effect<
    never,
    BuildInformationUnavailable
  >;
  return Layer.succeed(BuildInformationReader, { read: () => failure });
}

async function expectResponse(response: Response, status: number, body: unknown) {
  expect(response.status).toBe(status);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(response.headers.get("content-type")).toBe("application/json; charset=utf-8");
  const text = await response.text();
  expect(JSON.parse(text)).toEqual(body);
  expect(text).not.toContain("private-");
  expect(text).not.toContain("untrusted-client-identity");
  expect(text).not.toContain("stack");
  expect(text).not.toContain("cause");
}

describe("health delivery", () => {
  it.each<BuildInformation>([{}, { releaseId }])("returns a bounded success response with build %j", async (build) => {
    const read = vi.fn(() => Effect.succeed(Object.freeze(build)));
    const options = dependencies(Layer.succeed(BuildInformationReader, { read }));

    const response = await createHealthRoute(options)(request());

    await expectResponse(response, 200, { status: "ok", requestId, build });
    expect(read).toHaveBeenCalledOnce();
    expect(options.randomUUID).toHaveBeenCalledOnce();
    expect(options.now).toHaveBeenCalledOnce();
    expect(options.reportError).not.toHaveBeenCalled();
  });

  it("returns a sanitized unavailable response for the memory adapter typed failure", async () => {
    const options = dependencies(buildInformationReaderLayer(new BuildInformationUnavailable()));
    const response = await createHealthRoute(options)(request());

    await expectResponse(response, 503, {
      status: "unavailable", requestId, error: { code: "build-information-unavailable" },
    });
    expect(options.reportError).not.toHaveBeenCalled();
  });

  it("accepts multiple recognized typed reasons as unavailable", async () => {
    const options = dependencies(failureLayer([
      Cause.makeFailReason(new BuildInformationUnavailable()),
      Cause.makeFailReason(new BuildInformationUnavailable()),
    ]));

    await expectResponse(await createHealthRoute(options)(request()), 503, {
      status: "unavailable", requestId, error: { code: "build-information-unavailable" },
    });
    expect(options.reportError).not.toHaveBeenCalled();
  });

  it.each(["defect first", "defect last"])("gives any defect priority over interruption and typed failure: %s", async (order) => {
    const firstDefect = new Error("private-first-defect");
    const secondDefect = new Error("private-second-defect");
    const defects = [Cause.makeDieReason(firstDefect), Cause.makeDieReason(secondDefect)];
    const remaining = [
      Cause.makeFailReason(new BuildInformationUnavailable()),
      Cause.makeInterruptReason(),
      Cause.makeFailReason("private-unrecognized-failure"),
    ];
    const reasons = order === "defect first" ? [...defects, ...remaining] : [...remaining, ...defects];
    const options = dependencies(failureLayer(reasons));

    await expectResponse(await createHealthRoute(options)(request()), 500, {
      status: "error", requestId, error: { code: "unexpected" },
    });
    expect(options.reportError).toHaveBeenCalledExactlyOnceWith(firstDefect);
  });

  it.each<[string, ReadonlyArray<Cause.Reason<unknown>>]>([
    ["interruption alone", [Cause.makeInterruptReason()]],
    ["typed failure first", [Cause.makeFailReason(new BuildInformationUnavailable()), Cause.makeInterruptReason()]],
    ["typed failure last", [Cause.makeInterruptReason(), Cause.makeFailReason(new BuildInformationUnavailable())]],
    ["unrecognized failure", [Cause.makeFailReason("private-unrecognized-failure"), Cause.makeInterruptReason()]],
  ])("propagates a native abort without a response or report for %s", async (_description, reasons) => {
    const options = dependencies(failureLayer(reasons));
    const result = await createHealthRoute(options)(request()).catch((error: unknown) => error);

    expect(result).toBeInstanceOf(DOMException);
    expect(result).toHaveProperty("name", "AbortError");
    expect(options.reportError).not.toHaveBeenCalled();
  });

  it.each<[string, ReadonlyArray<Cause.Reason<unknown>>]>([
    ["unrecognized failure", [Cause.makeFailReason("private-unrecognized-failure")]],
    ["typed failure followed by unknown", [Cause.makeFailReason(new BuildInformationUnavailable()), Cause.makeFailReason("private-unknown")]],
    ["unknown followed by typed failure", [Cause.makeFailReason("private-unknown"), Cause.makeFailReason(new BuildInformationUnavailable())]],
    ["empty cause", []],
  ])("contains %s as an unexpected failure", async (_description, reasons) => {
    const options = dependencies(failureLayer(reasons));

    await expectResponse(await createHealthRoute(options)(request()), 500, {
      status: "error", requestId, error: { code: "unexpected" },
    });
    expect(options.reportError).toHaveBeenCalledOnce();
  });

  it.each(["throw", "reject"])("contains reporter %s while retaining the sanitized response", async (mode) => {
    const defect = new Error("private-original-defect");
    const options = dependencies(failureLayer([Cause.makeDieReason(defect)]));
    const reportingError = new Error("private-reporting-error");
    if (mode === "throw") options.reportError.mockImplementation(() => { throw reportingError; });
    else options.reportError.mockRejectedValue(reportingError);

    await expectResponse(await createHealthRoute(options)(request()), 500, {
      status: "error", requestId, error: { code: "unexpected" },
    });
    expect(options.reportError).toHaveBeenCalledExactlyOnceWith(defect);
  });

  it("contains a synchronous reader defect without leaking its details", async () => {
    const defect = new Error("private-reader-defect");
    const read = vi.fn(() => { throw defect; });
    const options = dependencies(Layer.succeed(BuildInformationReader, { read }));

    await expectResponse(await createHealthRoute(options)(request()), 500, {
      status: "error", requestId, error: { code: "unexpected" },
    });
    expect(read).toHaveBeenCalledOnce();
    expect(options.reportError).toHaveBeenCalledExactlyOnceWith(defect);
  });

  it("does no context or reader work for an already-aborted request", async () => {
    const controller = new AbortController();
    controller.abort();
    const read = vi.fn(() => Effect.succeed({}));
    const options = dependencies(Layer.succeed(BuildInformationReader, { read }));
    const abortedRequest = new Request("https://example.com/api/health", { signal: controller.signal });

    const result = await createHealthRoute(options)(abortedRequest).catch((error: unknown) => error);

    expect(result).toBeInstanceOf(DOMException);
    expect(result).toHaveProperty("name", "AbortError");
    expect(options.randomUUID).not.toHaveBeenCalled();
    expect(options.now).not.toHaveBeenCalled();
    expect(read).not.toHaveBeenCalled();
    expect(options.reportError).not.toHaveBeenCalled();
  });

  it("interrupts an active Effect through the supplied request signal without reporting", async () => {
    let markStarted: () => void = () => { throw new Error("Reader signal not initialized"); };
    const started = new Promise<void>((resolve) => { markStarted = resolve; });
    const read = vi.fn(() => Effect.sync(markStarted).pipe(Effect.flatMap(() => Effect.never)));
    const options = dependencies(Layer.succeed(BuildInformationReader, { read }));
    const controller = new AbortController();
    const activeRequest = new Request("https://example.com/api/health", { signal: controller.signal });
    const outcome = createHealthRoute(options)(activeRequest).catch((error: unknown) => error);

    await started;
    controller.abort();
    const result = await outcome;

    expect(result).toBeInstanceOf(DOMException);
    expect(result).toHaveProperty("name", "AbortError");
    expect(read).toHaveBeenCalledOnce();
    expect(options.reportError).not.toHaveBeenCalled();
  });
});
