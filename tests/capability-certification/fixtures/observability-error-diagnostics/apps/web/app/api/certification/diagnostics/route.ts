import {
  createOperationalErrorReport,
  createOperationalEvent,
  dispatchOperationalErrorReport,
  dispatchOperationalEvent,
  type DiagnosticSink,
} from "@egeria-systems/observability";
import { createStructuredLogSink } from "@egeria-systems/observability/server";

import { reportCaughtServerError } from "../../../../src/infrastructure/observability/server-reporter";

const markerPattern = /^diagnostics-[a-z]+-[0-9a-f]{16}$/u;
const cases = Object.freeze([
  "next-request-error",
  "selected-server-catch",
  "diagnostic-failure-containment",
] as const);
const captureAttributes = Object.freeze({
  capture_mechanism: "selected-catch",
  handled: true,
  operation: "certification-failure",
});

function emptyResponse(status: number): Response {
  return new Response(null, { status });
}

function readInput(request: Request) {
  const url = new URL(request.url);
  const actualKeys = [...url.searchParams.keys()].sort();
  if (
    actualKeys.length !== 2 ||
    actualKeys[0] !== "case" ||
    actualKeys[1] !== "marker"
  ) {
    return undefined;
  }
  const requestedCase = url.searchParams.get("case");
  const marker = url.searchParams.get("marker");
  if (
    !cases.includes(requestedCase as (typeof cases)[number]) ||
    marker === null ||
    !markerPattern.test(marker)
  ) {
    return undefined;
  }
  return Object.freeze({
    case: requestedCase as (typeof cases)[number],
    marker,
  });
}

function createStructuredSink() {
  return createStructuredLogSink({
    identifier: "cloudflare-workers-logs",
    write: (record) => console.info(record),
  });
}

async function exerciseDiagnosticFailure(marker: string): Promise<Response> {
  const event = createOperationalEvent(
    {
      name: "server.caught.error",
      kind: "application.error",
      runtime: "server",
      severity: "error",
      context: { eventId: marker, service: "web" },
      errorCategory: "unexpected",
      attributes: captureAttributes,
    },
    {
      allowedAttributeNames: [
        "capture_mechanism",
        "handled",
        "operation",
      ],
      clock: { now: () => new Date() },
    },
  );
  if (!event.ok) return emptyResponse(500);
  const report = createOperationalErrorReport(
    event.value,
    new Error("synthetic controlled diagnostic failure"),
    {
      mechanism: "selected-catch",
      handled: true,
      operation: "certification-failure",
    },
    {},
  );
  if (!report.ok) return emptyResponse(500);

  let diagnosticAttempts = 0;
  const rejectingDiagnosticSink: DiagnosticSink = Object.freeze({
    identifier: "better-stack",
    writeReport: () => {
      diagnosticAttempts += 1;
      return Object.freeze({
        status: "failed" as const,
        reason: "provider-rejected" as const,
      });
    },
  });
  const structuredSink = createStructuredSink();
  const delivery = await dispatchOperationalErrorReport(report.value, {
    operationalSinks: [structuredSink],
    diagnosticSinks: [rejectingDiagnosticSink],
  });
  const diagnosticResult = delivery.find(
    (result) => result.sink === "better-stack",
  );
  if (
    diagnosticAttempts !== 1 ||
    diagnosticResult?.status !== "failed" ||
    diagnosticResult.reason !== "provider-rejected"
  ) {
    return emptyResponse(500);
  }

  const health = createOperationalEvent(
    {
      name: "observability.delivery.failed",
      kind: "application.lifecycle",
      runtime: "server",
      severity: "warning",
      context: { eventId: `${marker}-health`, service: "web" },
      attributes: { reason: "provider-rejected", sink: "better-stack" },
    },
    {
      allowedAttributeNames: ["reason", "sink"],
      clock: { now: () => new Date() },
    },
  );
  if (!health.ok) return emptyResponse(500);
  const healthDelivery = await dispatchOperationalEvent(health.value, [
    structuredSink,
  ]);
  if (healthDelivery[0]?.status !== "delivered") {
    return emptyResponse(500);
  }

  return Response.json({
    ok: true,
    diagnosticAttempts,
    deliveryResult: "provider-rejected",
    applicationResult: "preserved",
    healthRecords: 1,
  });
}

export async function GET(request: Request): Promise<Response> {
  const input = readInput(request);
  if (input === undefined) return emptyResponse(400);

  if (input.case === "next-request-error") {
    throw new Error("synthetic Next request error");
  }
  if (input.case === "selected-server-catch") {
    try {
      throw new Error("synthetic selected server error");
    } catch (error) {
      await reportCaughtServerError(error, {
        operation: "certification-server",
        correlationId: input.marker,
      });
    }
    return emptyResponse(204);
  }
  return exerciseDiagnosticFailure(input.marker);
}
