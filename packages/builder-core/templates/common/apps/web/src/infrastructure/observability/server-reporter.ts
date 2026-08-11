import {
  createOperationalEvent,
  dispatchOperationalEvent,
  normalizeErrorCategory,
  type OperationalAttributeValue,
  type OperationalErrorCategory,
  type OperationalEventInput,
} from "@egeria-systems/observability";
import {
  createBetterStackSink,
  createStructuredLogSink,
} from "@egeria-systems/observability/server";

import { readObservabilityRuntimeContext } from "../cloudflare/observability-context";

export type BrowserOperationalInput = Readonly<{
  name:
    | "browser.window.error"
    | "browser.unhandled.rejection"
    | "browser.web.vital";
  kind: "application.error" | "web.vital";
  severity: "error" | "info";
  correlationId: string;
  errorCategory?: OperationalErrorCategory;
  attributes: Readonly<Record<string, OperationalAttributeValue>>;
  allowedAttributeNames: readonly string[];
}>;

async function requestBetterStack(input: Readonly<{
  url: string;
  method: "POST";
  headers: Readonly<Record<string, string>>;
  body: string;
  timeoutMilliseconds: number;
}>): Promise<Readonly<{ status: number }>> {
  const response = await fetch(input.url, {
    method: input.method,
    headers: input.headers,
    body: input.body,
    signal: AbortSignal.timeout(input.timeoutMilliseconds),
  });
  return Object.freeze({ status: response.status });
}

async function reportOperationalInput(
  input: OperationalEventInput,
  allowedAttributeNames: readonly string[],
): Promise<void> {
  try {
    const context = await readObservabilityRuntimeContext();
    const event = createOperationalEvent(
      {
        ...input,
        context: {
          ...input.context,
          ...(context.releaseId === undefined
            ? {}
            : { releaseId: context.releaseId }),
        },
      },
      {
        allowedAttributeNames,
        clock: { now: () => new Date() },
      },
    );
    if (!event.ok) return;

    const sinks = [
      createStructuredLogSink({
        identifier: "cloudflare-workers-logs",
        write: (record) => console.info(record),
      }),
    ];
    const betterStack = createBetterStackSink({
      ingestingHost: context.ingestingHost,
      sourceToken: context.sourceToken,
      request: requestBetterStack,
      timeoutMilliseconds: 5_000,
    });
    if (betterStack.ok) sinks.push(betterStack.value);

    const delivery = dispatchOperationalEvent(event.value, sinks).then(
      () => undefined,
      () => undefined,
    );
    context.schedule(delivery);
  } catch {
    // Operational reporting must never become an application failure.
  }
}

export async function reportServerError(error: unknown): Promise<void> {
  await reportOperationalInput(
    {
      name: "server.request.error",
      kind: "application.error",
      runtime: "server",
      severity: "error",
      context: { correlationId: crypto.randomUUID() },
      errorCategory: normalizeErrorCategory(error),
      attributes: {},
    },
    [],
  );
}

export async function reportBrowserEvent(
  input: BrowserOperationalInput,
): Promise<void> {
  await reportOperationalInput(
    {
      name: input.name,
      kind: input.kind,
      runtime: "browser",
      severity: input.severity,
      context: { correlationId: input.correlationId },
      ...(input.errorCategory === undefined
        ? {}
        : { errorCategory: input.errorCategory }),
      attributes: input.attributes,
    },
    input.allowedAttributeNames,
  );
}
