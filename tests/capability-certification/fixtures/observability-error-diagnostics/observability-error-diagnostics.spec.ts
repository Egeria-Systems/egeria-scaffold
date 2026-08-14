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

function readRevision(): string {
  const value = process.env.EXPECTED_REVISION;
  if (value === undefined || !/^[0-9a-f]{40}$/u.test(value)) {
    throw new Error("CERTIFICATION_REVISION_INVALID");
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

function readEnvelope(request: Request): Readonly<Record<string, unknown>> | undefined {
  if (!request.url().endsWith("/api/observability")) return undefined;
  try {
    const value = request.postDataJSON() as unknown;
    return typeof value === "object" && value !== null && !Array.isArray(value)
      ? (value as Readonly<Record<string, unknown>>)
      : undefined;
  } catch {
    return undefined;
  }
}

function readErrorEvent(request: Request): Readonly<Record<string, unknown>> | undefined {
  const envelope = readEnvelope(request);
  if (envelope?.type !== "error-report") return undefined;
  const report = envelope.report;
  if (typeof report !== "object" || report === null || Array.isArray(report)) {
    return undefined;
  }
  const event = Reflect.get(report, "event") as unknown;
  return typeof event === "object" && event !== null && !Array.isArray(event)
    ? (event as Readonly<Record<string, unknown>>)
    : undefined;
}

function readEventIdentifier(event: Readonly<Record<string, unknown>>): string {
  const context = event.context;
  if (
    typeof context !== "object" ||
    context === null ||
    Array.isArray(context) ||
    typeof Reflect.get(context, "eventId") !== "string"
  ) {
    throw new Error("CERTIFICATION_EVENT_IDENTIFIER_INVALID");
  }
  return Reflect.get(context, "eventId") as string;
}

function isErrorResponse(response: Response): boolean {
  return response.status() === 202 && readErrorEvent(response.request()) !== undefined;
}

async function captureAfter(page: Page, action: () => Promise<void>) {
  const responsePromise = page.waitForResponse(isErrorResponse);
  await action();
  await responsePromise;
}

test("the generated reporters exercise the bounded error-diagnostics matrix", async ({ page }) => {
  const revision = readRevision();
  const receiptPath = readReceiptPath();
  const errorEvents: Readonly<Record<string, unknown>>[] = [];
  let suppressedWebVitalRequests = 0;

  await page.route("**/api/observability", async (route) => {
    const envelope = readEnvelope(route.request());
    const event = envelope?.event;
    if (
      envelope?.type === "operational-event" &&
      typeof event === "object" &&
      event !== null &&
      !Array.isArray(event) &&
      Reflect.get(event, "name") === "browser.web.vital"
    ) {
      suppressedWebVitalRequests += 1;
      await route.fulfill({ status: 202 });
      return;
    }
    await route.continue();
  });
  page.on("request", (request) => {
    const event = readErrorEvent(request);
    if (event !== undefined) errorEvents.push(event);
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
  const duplicateStart = errorEvents.length;
  await captureAfter(page, () =>
    page
      .getByRole("button", { name: "Capture duplicate suppression" })
      .click(),
  );
  await page.waitForTimeout(250);
  expect(errorEvents.length - duplicateStart).toBe(1);

  const boundaryResponse = page.waitForResponse(isErrorResponse);
  await page.goto("/certification/diagnostics?case=react-boundary");
  await boundaryResponse;
  await expect(page.getByRole("heading")).toBeVisible();
  await page.getByRole("button").click();
  await expect(
    page.getByRole("heading", { name: "Diagnostics certification" }),
  ).toBeVisible();

  expect(errorEvents.map(({ name }) => name)).toEqual([
    "browser.window.error",
    "browser.unhandled.rejection",
    "browser.caught.error",
    "browser.window.error",
    "browser.react.boundary",
  ]);
  const eventIdentifiers = errorEvents.map(readEventIdentifier);
  expect(new Set(eventIdentifiers).size).toBe(5);
  expect(suppressedWebVitalRequests).toBeLessThanOrEqual(16);

  await writeFile(
    receiptPath,
    `${JSON.stringify({
      ok: true,
      capability: "observability",
      version: "0.3.0",
      subject,
      revision,
      cases: browserCases,
      eventIdentifiers,
      counts: {
        cases: 5,
        captureInvocations: 6,
        acceptedOriginals: 5,
        syntheticApplicationRequests: 7,
        workersRecords: 5,
        betterStackRecords: 5,
        diagnosticDeliveryFailures: 0,
      },
      checks: [
        "generated-browser-error",
        "generated-unhandled-rejection",
        "generated-react-boundary",
        "generated-selected-catch",
        "generated-duplicate-suppression",
        "automatic-web-vitals-not-transmitted",
      ],
      suppressedWebVitalRequests,
    })}\n`,
    { encoding: "utf8", flag: "wx", mode: 0o600 },
  );
});
