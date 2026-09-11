import { Cause, Effect, Exit } from "effect";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BuildInformationReader } from "@/src/application/build-information-reader";
import * as buildInformation from "@/src/domain/build-information";
import { buildInformationReaderLayer } from "@/src/infrastructure/cloudflare/build-information-reader";

const { getCloudflareContext } = vi.hoisted(() => ({
  getCloudflareContext: vi.fn<() => Promise<{
    env: { CF_VERSION_METADATA?: unknown };
  }>>(),
}));

vi.mock("@opennextjs/cloudflare", () => ({ getCloudflareContext }));

const releaseId = "ccbf0677-7e15-4a7e-99a7-770f4c122634";
const read = () => Effect.runPromiseExit(
  Effect.gen(function* () {
    const reader = yield* BuildInformationReader;
    return yield* reader.read();
  }).pipe(
    Effect.provide(buildInformationReaderLayer),
  ),
);

beforeEach(() => { getCloudflareContext.mockReset(); });
afterEach(() => { vi.restoreAllMocks(); });

describe("Cloudflare build information reader", () => {
  it("loads metadata lazily once and exposes only its valid identifier", async () => {
    getCloudflareContext.mockResolvedValue({
      env: { CF_VERSION_METADATA: { id: releaseId, tag: "private-provider-tag" } },
    });
    const program = Effect.gen(function* () {
      const reader = yield* BuildInformationReader;
      return yield* reader.read();
    }).pipe(
      Effect.provide(buildInformationReaderLayer),
    );
    expect(getCloudflareContext).not.toHaveBeenCalled();

    const exit = await Effect.runPromiseExit(program);

    expect(exit).toEqual(Exit.succeed({ releaseId }));
    expect(getCloudflareContext).toHaveBeenCalledExactlyOnceWith({ async: true });
    if (!Exit.isSuccess(exit)) throw new Error("Expected valid metadata");
    expect(Object.isFrozen(exit.value)).toBe(true);
  });

  it("treats absent metadata as a valid empty build", async () => {
    getCloudflareContext.mockResolvedValue({ env: {} });
    expect(await read()).toEqual(Exit.succeed({}));
  });

  it.each([
    ["null", null],
    ["missing identifier", {}],
    ["invalid identifier", { id: "private-provider-value" }],
  ])("maps %s metadata to a value-free typed failure", async (_description, metadata) => {
    getCloudflareContext.mockResolvedValue({ env: { CF_VERSION_METADATA: metadata } });
    const exit = await read();

    if (!Exit.isFailure(exit)) throw new Error("Expected unavailable metadata");
    expect(exit.cause.reasons).toHaveLength(1);
    expect(exit.cause.reasons[0]).toMatchObject({
      _tag: "Fail",
      error: {
        _tag: "BuildInformationUnavailable",
        category: "dependency-unavailable",
        code: "build-information-unavailable",
      },
    });
    expect(JSON.stringify(exit)).not.toContain("private-provider-value");
    expect(getCloudflareContext).toHaveBeenCalledOnce();
  });

  it.each(["rejection", "synchronous throw"])("maps provider %s without retaining the error", async (mode) => {
    const providerError = new Error("private-provider-error");
    if (mode === "rejection") getCloudflareContext.mockRejectedValue(providerError);
    else getCloudflareContext.mockImplementation(() => { throw providerError; });

    const exit = await read();

    if (!Exit.isFailure(exit)) throw new Error("Expected unavailable provider");
    expect(exit.cause.reasons).toHaveLength(1);
    expect(exit.cause.reasons[0]).toMatchObject({
      _tag: "Fail",
      error: { _tag: "BuildInformationUnavailable" },
    });
    expect(JSON.stringify(exit)).not.toContain("private-provider-error");
    expect(getCloudflareContext).toHaveBeenCalledOnce();
  });

  it("preserves a parser programming error as a defect", async () => {
    const defect = new Error("private-parser-defect");
    getCloudflareContext.mockResolvedValue({ env: { CF_VERSION_METADATA: { id: releaseId } } });
    vi.spyOn(buildInformation, "parseBuildInformation").mockImplementationOnce(() => { throw defect; });

    const exit = await read();

    if (!Exit.isFailure(exit)) throw new Error("Expected parser defect");
    expect(exit.cause.reasons).toHaveLength(1);
    const reason = exit.cause.reasons[0];
    if (reason === undefined || !Cause.isDieReason(reason)) throw new Error("Expected defect reason");
    expect(reason.defect).toBe(defect);
  });

  it("keeps metadata access exceptions outside expected provider unavailability", async () => {
    const defect = new Error("private-metadata-access-defect");
    getCloudflareContext.mockResolvedValue({
      env: { get CF_VERSION_METADATA() { throw defect; } },
    });

    const exit = await read();

    if (!Exit.isFailure(exit)) throw new Error("Expected metadata access defect");
    expect(exit.cause.reasons).toHaveLength(1);
    const reason = exit.cause.reasons[0];
    if (reason === undefined || !Cause.isDieReason(reason)) throw new Error("Expected defect reason");
    expect(reason.defect).toBe(defect);
  });
});
