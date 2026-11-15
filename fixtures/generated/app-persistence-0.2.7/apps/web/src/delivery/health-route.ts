import { Cause, Effect, Exit, type Layer } from "effect";
import {
  type BuildInformationReader,
  BuildInformationUnavailable,
} from "@/src/application/build-information-reader";
import { createRequestContext } from "@/src/application/request-context";
import { composeHealth } from "@/src/composition/server-health";

type HealthRouteDependencies = Readonly<{
  readerLayer: Layer.Layer<BuildInformationReader>;
  randomUUID: () => string;
  now: () => Date;
  reportError: (error: unknown) => void | Promise<void>;
}>;

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

export function createHealthRoute(dependencies: HealthRouteDependencies) {
  return async (request: Request): Promise<Response> => {
    // The pinned runtime may finish synchronous work before checking its signal.
    if (request.signal.aborted) throw new DOMException("Request aborted", "AbortError");
    const context = createRequestContext(dependencies);
    const exit = await Effect.runPromiseExit(
      composeHealth(context, dependencies.readerLayer),
      { signal: request.signal },
    );
    if (Exit.isSuccess(exit)) {
      const releaseId = exit.value.build.releaseId;
      return jsonResponse(200, {
        status: "ok",
        requestId: context.requestId,
        build: releaseId === undefined ? {} : { releaseId },
      });
    }

    const reasons = exit.cause.reasons;
    const defect = reasons.find(Cause.isDieReason);
    if (defect === undefined) {
      if (reasons.some(Cause.isInterruptReason)) {
        throw new DOMException("Request aborted", "AbortError");
      }
      if (reasons.length > 0 && reasons.every(
        (reason) => Cause.isFailReason(reason) && reason.error instanceof BuildInformationUnavailable,
      )) {
        return jsonResponse(503, {
          status: "unavailable",
          requestId: context.requestId,
          error: { code: "build-information-unavailable" },
        });
      }
    }

    try {
      await dependencies.reportError(defect === undefined ? exit.cause : defect.defect);
    } catch {
      // Reporting must not replace the bounded response with another failure.
    }
    return jsonResponse(500, {
      status: "error",
      requestId: context.requestId,
      error: { code: "unexpected" },
    });
  };
}
