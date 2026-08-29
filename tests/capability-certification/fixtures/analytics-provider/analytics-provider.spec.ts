import { writeFileSync } from "node:fs";

import { expect, test, type Page, type Request } from "@playwright/test";

const receiptPath = process.env.ANALYTICS_PROVIDER_BROWSER_RECEIPT_PATH;
const deployedUrl = process.env.PLAYWRIGHT_DEPLOYED_URL;
const requestEnvelopeLimit = 64;
const providerIdentifiers = [
  "cloudflareWebAnalytics",
  "googleAnalytics4",
  "microsoftClarity",
] as const;
type ProviderIdentifier = (typeof providerIdentifiers)[number];
type ProviderRequest = {
  provider: ProviderIdentifier;
  kind: "script" | "collection";
};
type ExternalRequest = ProviderRequest | { provider: "unexpected"; kind: "external" };

function classifyUrl(url: string, applicationHostname: string): ExternalRequest | undefined {
  const hostname = new URL(url).hostname;
  if (hostname === applicationHostname) return undefined;
  if (hostname === "static.cloudflareinsights.com") {
    return { provider: "cloudflareWebAnalytics", kind: "script" };
  }
  if (hostname === "cloudflareinsights.com" || hostname.endsWith(".cloudflareinsights.com")) {
    return { provider: "cloudflareWebAnalytics", kind: "collection" };
  }
  if (hostname === "www.googletagmanager.com") {
    return { provider: "googleAnalytics4", kind: "script" };
  }
  if (
    hostname === "google-analytics.com" ||
    hostname.endsWith(".google-analytics.com") ||
    hostname === "analytics.google.com" ||
    hostname.endsWith(".analytics.google.com")
  ) {
    return { provider: "googleAnalytics4", kind: "collection" };
  }
  if (hostname === "www.clarity.ms") {
    return { provider: "microsoftClarity", kind: "script" };
  }
  if (
    hostname === "clarity.ms" ||
    hostname.endsWith(".clarity.ms") ||
    hostname === "c.bing.com"
  ) {
    return { provider: "microsoftClarity", kind: "collection" };
  }
  return { provider: "unexpected", kind: "external" };
}

function classifyRequest(request: Request, applicationHostname: string): ExternalRequest | undefined {
  return classifyUrl(request.url(), applicationHostname);
}

function action(page: Page, identifier: "allow" | "decline" | "manage") {
  return page.locator(`[data-analytics-consent-action="${identifier}"]`);
}

function providerRequests(requests: ExternalRequest[]) {
  return requests.filter(
    (request): request is ProviderRequest => request.provider !== "unexpected",
  );
}

function unexpectedRequestCount(requests: ExternalRequest[]) {
  return requests.filter(({ provider }) => provider === "unexpected").length;
}

function providerCounts(requests: ProviderRequest[]) {
  return Object.fromEntries(
    providerIdentifiers.map((provider) => [
      provider,
      {
        scriptRequests: requests.filter(
          (request) => request.provider === provider && request.kind === "script",
        ).length,
        collectionRequests: requests.filter(
          (request) => request.provider === provider && request.kind === "collection",
        ).length,
      },
    ]),
  ) as Record<ProviderIdentifier, { scriptRequests: number; collectionRequests: number }>;
}

test("bounded synthetic consent journey reaches each provider collection only after grant", async ({
  page,
}) => {
  test.skip(
    receiptPath === undefined || deployedUrl === undefined,
    "the protected workflow owns the receipt path and deployed root",
  );
  if (receiptPath === undefined || deployedUrl === undefined) return;

  const applicationRoot = new URL(deployedUrl);
  expect(applicationRoot.pathname).toBe("/");
  const requests: ExternalRequest[] = [];
  page.on("request", (request) => {
    const captured = classifyRequest(request, applicationRoot.hostname);
    if (captured !== undefined) requests.push(captured);
  });

  await page.goto("/en-CA");
  await expect(page.getByRole("complementary")).toBeVisible();
  await page.waitForLoadState("networkidle");
  expect(requests).toEqual([]);

  const grantStartIndex = requests.length;
  await action(page, "allow").click();
  await expect
    .poll(
      () => {
        const counts = providerCounts(providerRequests(requests.slice(grantStartIndex)));
        return providerIdentifiers.every(
          (provider) =>
            counts[provider].scriptRequests > 0 &&
            counts[provider].collectionRequests > 0,
        );
      },
      { timeout: 30_000 },
    )
    .toBe(true);
  await page.waitForLoadState("networkidle");
  for (const identifier of [
    "cloudflare-web-analytics",
    "google-analytics-4",
    "microsoft-clarity",
  ]) {
    await expect(page.locator(`#analytics-${identifier}`)).toHaveCount(1);
  }
  expect(unexpectedRequestCount(requests)).toBe(0);
  expect(requests.length).toBeLessThanOrEqual(requestEnvelopeLimit);

  await action(page, "manage").click();
  const reloaded = page.waitForEvent("framenavigated", {
    predicate: (frame) => frame === page.mainFrame(),
  });
  await action(page, "decline").click();
  await reloaded;
  await expect(action(page, "manage")).toBeVisible();
  await page.waitForLoadState("networkidle");
  for (const identifier of [
    "cloudflare-web-analytics",
    "google-analytics-4",
    "microsoft-clarity",
  ]) {
    await expect(page.locator(`#analytics-${identifier}`)).toHaveCount(0);
  }
  const withdrawalRequests: ExternalRequest[] = [];
  const reloadedDocumentResources = await page.evaluate(() =>
    performance.getEntriesByType("resource").map(({ name }) => name),
  );
  for (const url of reloadedDocumentResources) {
    const captured = classifyUrl(url, applicationRoot.hostname);
    if (captured !== undefined) withdrawalRequests.push(captured);
  }
  expect(providerRequests(withdrawalRequests)).toEqual([]);
  expect(unexpectedRequestCount(withdrawalRequests)).toBe(0);
  expect(requests.length).toBeLessThanOrEqual(requestEnvelopeLimit);

  const grantRequests = providerRequests(requests.slice(grantStartIndex));
  writeFileSync(
    receiptPath,
    `${JSON.stringify({
      schemaVersion: "1.0.0",
      traffic: "synthetic-only",
      requestEnvelopeLimit,
      totalExternalRequests: requests.length,
      unexpectedExternalRequests: unexpectedRequestCount(requests),
      cases: [
        "fresh-denial",
        "positive-grant",
        "complete-withdrawal-reload",
      ],
      providers: providerCounts(grantRequests),
      beforeGrant: { providerRequests: 0, unexpectedExternalRequests: 0 },
      afterGrant: {
        providerRequests: grantRequests.length,
        unexpectedExternalRequests: 0,
      },
      withdrawalReload: {
        providerRequests: 0,
        unexpectedExternalRequests: 0,
        captureStartedBeforeAction: true,
        networkIdleObserved: true,
      },
    })}\n`,
    { encoding: "utf8", mode: 0o600, flag: "wx" },
  );
});
