import { expect, test, type Page, type Request, type Response } from "@playwright/test";
import { writeFile } from "node:fs/promises";

const subject = Object.freeze({
  descriptorVersion: "0.3.0",
  behaviorContractDigest:
    "sha256:24a3cb3361cd8f72a12a1926b512e087adb31ad120a62b70e06a68d9dcf90c99",
});
const browserCases = Object.freeze([
  "browser-error",
  "unhandled-rejection",
  "react-boundary",
  "selected-browser-catch",
  "duplicate-suppression",
]);
const serverCases = Object.freeze([
  "next-request-error",
  "selected-server-catch",
  "diagnostic-failure-containment",
]);
const localChecks = Object.freeze([
  "generated-browser-error-unhandled",
  "generated-unhandled-rejection-unhandled",
  "generated-react-boundary-handled",
  "generated-selected-browser-catch-handled",
  "generated-duplicate-suppression",
  "browser-private-context-omitted",
  "generated-next-request-error",
  "generated-selected-server-catch-context",
  "generated-diagnostic-failure-containment",
]);
const prohibitedBrowserContextKey =
  /^(?:authorization|cookie|credential|filename|header|ip|path|referrer|request|response|token|url|useragent)$/iu;

type UnknownRecord = Readonly<Record<string, unknown>>;

function readRevision(): string {
  const value = process.env.EXPECTED_REVISION;
  if (value === undefined || !/^[0-9a-f]{40}$/u.test(value)) {
    throw new Error("CERTIFICATION_REVISION_INVALID");
  }
  return value;
}

function readScope(): "browser-only" | "local-full" {
  const value = process.env.OBSERVABILITY_DIAGNOSTICS_SCOPE ?? "browser-only";
  if (value !== "browser-only" && value !== "local-full") {
    throw new Error("CERTIFICATION_SCOPE_INVALID");
  }
  return value;
}

function readReceiptPath(): string {
  const value = process.env.OBSERVABILITY_DIAGNOSTICS_BROWSER_RECEIPT_PATH;
  if (value === undefined || value.length === 0) {
    throw new Error("CERTIFICATION_RECEIPT_PATH_INVALID");
  }
  return value;
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readEnvelope(request: Request): UnknownRecord | undefined {
  if (!request.url().endsWith("/api/observability")) return undefined;
  try {
    const value = request.postDataJSON() as unknown;
    return isRecord(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

function readErrorReport(request: Request): UnknownRecord | undefined {
  const envelope = readEnvelope(request);
  return envelope?.type === "error-report" && isRecord(envelope.report)
    ? envelope.report
    : undefined;
}

function readEvent(report: UnknownRecord): UnknownRecord {
  if (!isRecord(report.event)) {
    throw new Error("CERTIFICATION_EVENT_INVALID");
  }
  return report.event;
}

function readEventIdentifier(report: UnknownRecord): string {
  const context = readEvent(report).context;
  if (!isRecord(context) || typeof context.eventId !== "string") {
    throw new Error("CERTIFICATION_EVENT_IDENTIFIER_INVALID");
  }
  return context.eventId;
}

function collectKeys(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(collectKeys);
  if (!isRecord(value)) return [];
  return Object.entries(value).flatMap(([key, entry]) => [key, ...collectKeys(entry)]);
}

function isErrorResponse(response: Response): boolean {
  return response.status() === 202 && readErrorReport(response.request()) !== undefined;
}

async function captureAfter(page: Page, action: () => Promise<void>) {
  const responsePromise = page.waitForResponse(isErrorResponse);
  await action();
  await responsePromise;
  await expect(
    page.getByRole("heading", { name: "Diagnostics certification" }),
  ).toBeVisible();
}

function expectBrowserSemantics(reports: readonly UnknownRecord[]) {
  expect(reports).toHaveLength(5);
  for (const report of reports) {
    expect(Object.keys(report).sort()).toEqual([
      "capture",
      "diagnostics",
      "event",
    ]);
    const event = readEvent(report);
    expect(Object.keys(event.context as UnknownRecord).sort()).toEqual([
      "eventId",
      "service",
    ]);
    expect(collectKeys(report).filter((key) => prohibitedBrowserContextKey.test(key))).toEqual([]);
  }

  expect(reports.map(({ capture }) => capture)).toEqual([
    { mechanism: "browser-error-event", handled: false },
    { mechanism: "browser-unhandled-rejection", handled: false },
    {
      mechanism: "selected-catch",
      handled: true,
      operation: "certification-browser",
    },
    { mechanism: "browser-error-event", handled: false },
    { mechanism: "react-error-boundary", handled: true },
  ]);
  expect(reports.map((report) => readEvent(report).attributes)).toEqual([
    { capture_mechanism: "browser-error-event", handled: false },
    { capture_mechanism: "browser-unhandled-rejection", handled: false },
    {
      capture_mechanism: "selected-catch",
      handled: true,
      operation: "certification-browser",
    },
    { capture_mechanism: "browser-error-event", handled: false },
    { capture_mechanism: "react-error-boundary", handled: true },
  ]);
}

async function exerciseLocalServerCases(page: Page, revision: string) {
  const suffix = revision.slice(0, 16);
  const route = "/api/certification/diagnostics";
  const selected = await page.request.get(
    `${route}?case=selected-server-catch&marker=diagnostics-server-${suffix}`,
  );
  expect(selected.status()).toBe(204);

  const failure = await page.request.get(
    `${route}?case=diagnostic-failure-containment&marker=diagnostics-failure-${suffix}`,
  );
  expect(failure.status()).toBe(200);
  expect(await failure.json()).toEqual({
    ok: true,
    diagnosticAttempts: 1,
    deliveryResult: "provider-rejected",
    applicationResult: "preserved",
    healthRecords: 1,
    originalRecords: 1,
    recursiveDiagnosticAttempts: 0,
    scheduledTasks: 1,
  });

  const requestError = await page.request.get(
    `${route}?case=next-request-error&marker=diagnostics-next-${suffix}`,
  );
  expect(requestError.status()).toBe(500);
}

test("the generated reporters exercise the bounded error-diagnostics matrix", async ({ page }) => {
  const revision = readRevision();
  const scope = readScope();
  const receiptPath = readReceiptPath();
  const errorReports: UnknownRecord[] = [];
  let suppressedWebVitalRequests = 0;
  let escapedWebVitalRequests = 0;

  await page.exposeFunction("__recordSuppressedWebVitalRequest", () => {
    suppressedWebVitalRequests += 1;
  });
  await page.addInitScript(() => {
    const nativeFetch = globalThis.fetch.bind(globalThis);
    globalThis.fetch = async (...arguments_: Parameters<typeof fetch>) => {
      const [input, init] = arguments_;
      const requestUrl =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      if (
        new URL(requestUrl, globalThis.location.href).pathname ===
          "/api/observability" &&
        typeof init?.body === "string"
      ) {
        try {
          const envelope = JSON.parse(init.body) as unknown;
          if (
            typeof envelope === "object" &&
            envelope !== null &&
            Reflect.get(envelope, "type") === "operational-event"
          ) {
            const event = Reflect.get(envelope, "event");
            if (
              typeof event === "object" &&
              event !== null &&
              Reflect.get(event, "name") === "browser.web.vital"
            ) {
              const recordSuppression = Reflect.get(
                globalThis,
                "__recordSuppressedWebVitalRequest",
              );
              if (typeof recordSuppression === "function") {
                await recordSuppression();
              }
              return new Response(null, { status: 202 });
            }
          }
        } catch {
          // The original fetch owns malformed or non-JSON request handling.
        }
      }
      return nativeFetch(...arguments_);
    };
  });

  await page.route("**/api/observability", async (route) => {
    const envelope = readEnvelope(route.request());
    const event = envelope?.event;
    if (
      envelope?.type === "operational-event" &&
      isRecord(event) &&
      event.name === "browser.web.vital"
    ) {
      escapedWebVitalRequests += 1;
      await route.fulfill({ status: 202 });
      return;
    }
    await route.continue();
  });
  page.on("request", (request) => {
    const report = readErrorReport(request);
    if (report !== undefined) errorReports.push(report);
  });

  await page.goto("/certification/diagnostics");
  await expect(
    page.getByRole("heading", { name: "Diagnostics certification" }),
  ).toBeVisible();

  await captureAfter(page, () =>
    page.getByRole("button", { name: "Capture browser error" }).click(),
  );
  await captureAfter(page, () =>
    page
      .getByRole("button", { name: "Capture unhandled rejection" })
      .click(),
  );
  await captureAfter(page, () =>
    page
      .getByRole("button", { name: "Capture selected browser catch" })
      .click(),
  );
  const duplicateStart = errorReports.length;
  await captureAfter(page, () =>
    page
      .getByRole("button", { name: "Capture duplicate suppression" })
      .click(),
  );
  await page.waitForTimeout(250);
  expect(errorReports.length - duplicateStart).toBe(1);

  const boundaryResponse = page.waitForResponse(isErrorResponse);
  await page.goto("/certification/diagnostics?case=react-boundary");
  await boundaryResponse;
  await expect(
    page.getByRole("heading", { name: "Something went wrong" }),
  ).toBeVisible();
  await page.evaluate(() => {
    Reflect.set(globalThis, "__diagnosticsCertificationRecover", true);
  });
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(
    page.getByRole("heading", { name: "Diagnostics certification" }),
  ).toBeVisible();

  expect(errorReports.map((report) => readEvent(report).name)).toEqual([
    "browser.window.error",
    "browser.unhandled.rejection",
    "browser.caught.error",
    "browser.window.error",
    "browser.react.boundary",
  ]);
  expectBrowserSemantics(errorReports);
  const eventIdentifiers = errorReports.map(readEventIdentifier);
  expect(new Set(eventIdentifiers).size).toBe(5);

  if (scope === "local-full") {
    await exerciseLocalServerCases(page, revision);
  }
  await page.close();
  expect(suppressedWebVitalRequests).toBeGreaterThan(0);
  expect(suppressedWebVitalRequests).toBeLessThanOrEqual(16);
  expect(escapedWebVitalRequests).toBe(0);

  const localFull = scope === "local-full";
  await writeFile(
    receiptPath,
    `${JSON.stringify({
      ok: true,
      capability: "observability",
      version: "0.3.0",
      subject,
      revision,
      scope,
      cases: localFull ? [...browserCases, ...serverCases] : browserCases,
      eventIdentifiers,
      counts: localFull
        ? {
            cases: 8,
            captureInvocations: 9,
            acceptedOriginals: 8,
            syntheticApplicationRequests: 10,
            diagnosticDeliveryFailures: 1,
          }
        : {
            cases: 5,
            captureInvocations: 6,
            acceptedOriginals: 5,
            syntheticApplicationRequests: 7,
            expectedWorkersRecords: 5,
            expectedBetterStackRecords: 5,
            diagnosticDeliveryFailures: 0,
          },
      providerRecordsClaimed: false,
      checks: localFull
        ? localChecks
        : [
            "generated-browser-error",
            "generated-unhandled-rejection",
            "generated-react-boundary",
            "generated-selected-catch",
            "generated-duplicate-suppression",
            "browser-private-context-omitted",
            "automatic-web-vitals-not-transmitted",
          ],
      suppressedWebVitalRequests,
    })}\n`,
    { encoding: "utf8", flag: "wx", mode: 0o600 },
  );
});
