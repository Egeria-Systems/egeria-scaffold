import { writeFile } from "node:fs/promises";
import { isAbsolute } from "node:path";

import { test } from "@playwright/test";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

test.use({ trace: "off", screenshot: "off", video: "off" });

function fail(code: string): never {
  throw new Error(code);
}

function hasExactKeys(
  value: unknown,
  expectedKeys: readonly string[],
): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const actualKeys = Object.keys(value).sort();
  return (
    actualKeys.length === expectedKeys.length &&
    actualKeys.every((key, index) => key === [...expectedKeys].sort()[index])
  );
}

function readCorrelationId(envelope: unknown): string | undefined {
  if (!hasExactKeys(envelope, ["event", "schemaVersion"])) return undefined;
  if (envelope.schemaVersion !== "1.0.0") return undefined;
  const event = envelope.event;
  if (
    !hasExactKeys(event, [
      "attributes",
      "context",
      "errorCategory",
      "kind",
      "name",
      "runtime",
      "severity",
    ]) ||
    event.name !== "browser.window.error" ||
    event.kind !== "application.error" ||
    event.runtime !== "browser" ||
    event.severity !== "error" ||
    event.errorCategory !== "unexpected" ||
    !hasExactKeys(event.attributes, ["source"]) ||
    event.attributes.source !== "window-error" ||
    !hasExactKeys(event.context, ["correlationId"]) ||
    typeof event.context.correlationId !== "string" ||
    !uuidPattern.test(event.context.correlationId)
  ) {
    return undefined;
  }
  return event.context.correlationId;
}

function readRequestEnvelope(request: {
  postDataJSON(): unknown;
}): unknown {
  try {
    return request.postDataJSON();
  } catch {
    return undefined;
  }
}

function readReceiptPath(): string {
  const path = process.env.OBSERVABILITY_BROWSER_RECEIPT_PATH;
  if (typeof path !== "string" || !isAbsolute(path)) {
    fail("OBSERVABILITY_BROWSER_RECEIPT_PATH_INVALID");
  }
  return path;
}

test("generated browser error reporter omits ambient request metadata", async ({
  page,
}) => {
  const receiptPath = readReceiptPath();
  const navigation = await page.goto("/");
  if (navigation === null || navigation.status() !== 200) {
    fail("OBSERVABILITY_BROWSER_NAVIGATION_FAILED");
  }

  const pageUrl = new URL(page.url());
  await page.context().addCookies([
    {
      name: "observability-certification",
      value: "synthetic",
      url: pageUrl.origin,
      sameSite: "Lax",
    },
  ]);

  const responsePromise = page.waitForResponse((response) => {
    const responseUrl = new URL(response.url());
    const request = response.request();
    return (
      responseUrl.origin === pageUrl.origin &&
      responseUrl.pathname === "/api/observability" &&
      responseUrl.search === "" &&
      request.method() === "POST" &&
      readCorrelationId(readRequestEnvelope(request)) !== undefined
    );
  });

  await page.evaluate(() => {
    globalThis.dispatchEvent(new ErrorEvent("error"));
  });

  const response = await responsePromise;
  if (response.status() !== 202) {
    fail("OBSERVABILITY_BROWSER_RESPONSE_INVALID");
  }
  const request = response.request();
  const headers = await request.allHeaders();
  const headerNames = Object.keys(headers).map((name) => name.toLowerCase());
  if (headerNames.includes("cookie") || headerNames.includes("referer")) {
    fail("OBSERVABILITY_BROWSER_HEADERS_INVALID");
  }

  const browserReporterCorrelationId = readCorrelationId(
    readRequestEnvelope(request),
  );
  if (browserReporterCorrelationId === undefined) {
    fail("OBSERVABILITY_BROWSER_ENVELOPE_INVALID");
  }

  const receipt = {
    ok: true,
    capability: "observability",
    version: "0.2.0",
    browserReporterCorrelationId,
    checks: [
      "browser-window-error-dispatched",
      "same-origin-request-observed",
      "cookie-omitted",
      "referer-omitted",
      "browser-error-envelope-accepted",
    ],
  };
  await writeFile(receiptPath, `${JSON.stringify(receipt)}\n`, {
    encoding: "utf8",
    flag: "wx",
    mode: 0o600,
  });
});
