import { Cause, Effect, Exit, Layer } from "effect";
import { describe, expect, it, vi } from "vitest";
import {
  BuildInformationReader,
  BuildInformationUnavailable,
} from "@/src/application/build-information-reader";
import { readHealth } from "@/src/application/health";
import { createRequestContext } from "@/src/application/request-context";
import { buildInformationReaderLayer } from "@/src/infrastructure/memory/build-information-reader";

const context = createRequestContext({
  randomUUID: () => "b2eb71ea-29a7-4c3d-8cfb-c275356ad015",
  now: () => new Date("2026-09-05T12:34:56.789Z"),
});
const releaseId = "ccbf0677-7e15-4a7e-99a7-770f4c122634";

describe("health application", () => {
  it("does no reader work until execution and reads once from the supplied Layer", async () => {
    const read = vi.fn(() => Effect.succeed(Object.freeze({ releaseId })));
    const layer = Layer.succeed(BuildInformationReader, { read });
    const program = readHealth(context);
    const provided = program.pipe(Effect.provide(layer));

    expect(read).not.toHaveBeenCalled();
    const report = await Effect.runPromise(provided);

    expect(read).toHaveBeenCalledOnce();
    expect(report).toEqual({ status: "ok", requestId: context.requestId, build: { releaseId } });
    expect(Object.keys(report).sort()).toEqual(["build", "requestId", "status"]);
  });

  it("uses a snapshot of the memory adapter success value", async () => {
    const build = { releaseId };
    const layer = buildInformationReaderLayer(build);
    build.releaseId = "b2eb71ea-29a7-4c3d-8cfb-c275356ad015";

    const report = await Effect.runPromise(readHealth(context).pipe(Effect.provide(layer)));

    expect(report.build).toEqual({ releaseId });
    expect(Object.isFrozen(report.build)).toBe(true);
  });

  it("accepts immutable empty memory build information", async () => {
    const report = await Effect.runPromise(
      readHealth(context).pipe(Effect.provide(buildInformationReaderLayer({}))),
    );

    expect(report).toEqual({ status: "ok", requestId: context.requestId, build: {} });
    expect(Object.isFrozen(report.build)).toBe(true);
  });

  it("preserves the memory adapter typed failure without a fallback value", async () => {
    const unavailable = new BuildInformationUnavailable();
    const layer = buildInformationReaderLayer(unavailable);
    const exit = await Effect.runPromiseExit(readHealth(context).pipe(Effect.provide(layer)));

    expect(Exit.isFailure(exit)).toBe(true);
    if (!Exit.isFailure(exit)) throw new Error("Expected unavailable build information");
    expect(exit.cause.reasons).toHaveLength(1);
    const reason = exit.cause.reasons[0];
    if (reason === undefined || !Cause.isFailReason(reason)) {
      throw new Error("Expected a typed failure");
    }
    expect(reason.error).toMatchObject({
      _tag: "BuildInformationUnavailable",
      category: "dependency-unavailable",
      code: "build-information-unavailable",
    });
    expect(Object.isFrozen(reason.error)).toBe(true);
    expect(reason.error).not.toHaveProperty("cause");
    expect(JSON.stringify(reason.error)).not.toContain("stack");
  });
});
