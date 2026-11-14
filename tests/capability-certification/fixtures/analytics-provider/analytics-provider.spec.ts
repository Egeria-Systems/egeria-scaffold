import { writeFileSync } from "node:fs";
import { createServer } from "node:http";

import { test as browserTest, type APIResponse, type Page, type Request, type Route } from "@playwright/test";
import { expect, test } from "./application-test";

const receiptPath = process.env.ANALYTICS_PROVIDER_BROWSER_RECEIPT_PATH;
const deployedUrl = process.env.DEPLOY_URL;
const requestEnvelopeLimit = 64;
const analyticsConsentStorageKey = "egeria.analytics.consent.v3";
const partialGrantPurpose = "aggregate-traffic-and-performance";
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

function classifyUrl(url: string, applicationOrigin: string): ExternalRequest | undefined {
  const target = new URL(url);
  if (target.origin === applicationOrigin) return undefined;
  if (target.protocol !== "https:" || target.username || target.password || target.port) {
    return { provider: "unexpected", kind: "external" };
  }
  const hostname = target.hostname;
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

function classifyRequest(request: Request, applicationOrigin: string): ExternalRequest | undefined {
  return classifyUrl(request.url(), applicationOrigin);
}

function action(page: Page, identifier: "allow" | "decline" | "manage") {
  return page.locator(`[data-analytics-consent-action="${identifier}"]`);
}

function purposeChoice(page: Page, purpose: string) {
  return page.locator(`[data-analytics-consent-purpose="${purpose}"]`);
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

async function providerCookieCount(page: Page): Promise<number> {
  return page.evaluate(() =>
    document.cookie
      .split(";")
      .map((cookie) => cookie.split("=", 1)[0]?.trim())
      .filter(
        (name) =>
          name === "egeria_production_ga" ||
          name?.startsWith("egeria_production_ga_") === true ||
          name === "egeria_nonproduction_ga" ||
          name?.startsWith("egeria_nonproduction_ga_") === true ||
          name === "_ga" ||
          name?.startsWith("_ga_") === true ||
          name === "_clck" ||
          name === "_clsk",
      ).length,
  );
}

async function readConsentRecord(page: Page): Promise<{
  schemaVersion: number;
  purposes: readonly { purpose: string; decision: string }[];
} | null> {
  return page.evaluate((key) => {
    const source = window.localStorage.getItem(key);
    return source === null ? null : JSON.parse(source);
  }, analyticsConsentStorageKey);
}

function deniedPurposeCount(
  record: { purposes: readonly { decision: string }[] },
): number {
  return record.purposes.filter(({ decision }) => decision === "denied").length;
}

async function relayProviderRequest(route: Route): Promise<void> {
  // Access credentials remain exclusively in the shared same-origin transport.
  const headers = Object.fromEntries(Object.entries(route.request().headers()).filter(([name]) =>
    !["cf-access-client-id", "cf-access-client-secret", "authorization", "proxy-authorization"].includes(name.toLowerCase()),
  ));
  let response: APIResponse | undefined;
  try {
    response = await route.fetch({ headers, maxRedirects: 0, maxRetries: 0, timeout: 10000 });
    if ([301, 302, 303, 307, 308].includes(response.status())) {
      await route.abort("blockedbyclient");
      return;
    }
    await route.fulfill({ response });
  } catch {
    await route.abort("blockedbyclient").catch(() => {});
  } finally {
    await response?.dispose();
  }
}

browserTest("provider transport rejects redirects before contacting another origin", async ({ page }) => {
  let allowedRequests = 0;
  let redirectedRequests = 0;
  let redirectDestination = "";
  const allowed = createServer((_request, response) => {
    allowedRequests += 1;
    response.writeHead(302, { location: redirectDestination });
    response.end();
  });
  const forbidden = createServer((_request, response) => {
    redirectedRequests += 1;
    response.end("unexpected destination");
  });
  const servers = [allowed, forbidden];
  try {
    for (const server of servers) {
      await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", resolve);
      });
    }
    const [allowedOrigin, forbiddenOrigin] = servers.map(server => {
      const address = server.address();
      if (address === null || typeof address === "string") throw new Error("CONTROLLED_SERVER_ADDRESS_INVALID");
      return `http://127.0.0.1:${address.port}`;
    });
    redirectDestination = `${forbiddenOrigin}/redirected`;
    const requestURL = `${allowedOrigin}/provider`;
    await page.route(requestURL, relayProviderRequest);
    await expect(page.goto(requestURL)).rejects.toThrow();
    expect(allowedRequests).toBe(1);
    expect(redirectedRequests).toBe(0);
  } finally {
    for (const server of servers) {
      server.closeAllConnections();
      if (server.listening) await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
  }
});

test("bounded synthetic consent journey reaches each provider collection only after grant", async ({
  page,
  openApplicationPage,
}) => {
  test.skip(
    receiptPath === undefined || deployedUrl === undefined,
    "the protected workflow owns the receipt path and deployed root",
  );
  if (receiptPath === undefined || deployedUrl === undefined) return;

  const applicationRoot = new URL(deployedUrl);
  expect(applicationRoot.pathname).toBe("/");
  const target = process.env.APPLICATION_ENVIRONMENT;
  expect(["staging", "production"]).toContain(target);
  const googleCookiePrefix = target === "production" ? "egeria_production" : "egeria_nonproduction";
  const requests: ExternalRequest[] = [];
  page.on("request", (request) => {
    const captured = classifyRequest(request, applicationRoot.origin);
    if (captured !== undefined) requests.push(captured);
  });
  await page.route("**/*", async (route) => {
    const request = route.request();
    const external = classifyRequest(request, applicationRoot.origin);
    if (external === undefined) return route.fallback();
    if (external.provider === "unexpected" || request.isNavigationRequest() || requests.length > requestEnvelopeLimit) {
      return route.abort("blockedbyclient");
    }
    await relayProviderRequest(route);
  });

  await openApplicationPage(page, "/en-CA");
  await expect(page.getByRole("complementary")).toBeVisible();
  await page.waitForLoadState("networkidle");
  expect(requests).toEqual([]);
  expect(await readConsentRecord(page)).toBeNull();
  const freshDenial = {
    providerRequests: 0,
    unexpectedExternalRequests: 0,
    consentRecordPersisted: false,
    providerCookieCount: await providerCookieCount(page),
  };
  expect(freshDenial.providerCookieCount).toBe(0);

  const persistedDenialStartIndex = requests.length;
  await action(page, "decline").click();
  await page.reload();
  await expect(action(page, "manage")).toBeVisible();
  await page.waitForLoadState("networkidle");
  const persistedDenialRequests = requests.slice(persistedDenialStartIndex);
  expect(providerRequests(persistedDenialRequests)).toEqual([]);
  expect(unexpectedRequestCount(persistedDenialRequests)).toBe(0);
  const persistedDenialRecord = await readConsentRecord(page);
  expect(persistedDenialRecord).not.toBeNull();
  if (persistedDenialRecord === null) return;
  expect(persistedDenialRecord.schemaVersion).toBe(3);
  expect(deniedPurposeCount(persistedDenialRecord)).toBe(3);
  const persistedDenialReload = {
    providerRequests: 0,
    unexpectedExternalRequests: 0,
    consentRecordPersisted: true,
    consentRecordSchemaVersion: persistedDenialRecord.schemaVersion,
    deniedPurposeCount: deniedPurposeCount(persistedDenialRecord),
    providerCookieCount: await providerCookieCount(page),
  };
  expect(persistedDenialReload.providerCookieCount).toBe(0);

  const grantStartIndex = requests.length;
  await action(page, "manage").click();
  await purposeChoice(page, partialGrantPurpose).check();
  await page.locator('[data-analytics-consent-action="save"]').click();
  await expect
    .poll(() => {
      const counts = providerCounts(
        providerRequests(requests.slice(grantStartIndex)),
      );
      return (
        counts.cloudflareWebAnalytics.scriptRequests > 0 &&
        counts.cloudflareWebAnalytics.collectionRequests > 0
      );
    })
    .toBe(true);
  await page.waitForLoadState("networkidle");
  const partialGrantRequests = requests.slice(grantStartIndex);
  const partialGrantProviderRequests = providerRequests(partialGrantRequests);
  const partialGrantProviders = providerCounts(partialGrantProviderRequests);
  expect(partialGrantProviders.googleAnalytics4).toEqual({
    scriptRequests: 0,
    collectionRequests: 0,
  });
  expect(partialGrantProviders.microsoftClarity).toEqual({
    scriptRequests: 0,
    collectionRequests: 0,
  });
  expect(unexpectedRequestCount(partialGrantRequests)).toBe(0);
  const partialGrant = {
    providerRequests: partialGrantProviderRequests.length,
    unexpectedExternalRequests: 0,
    grantedPurpose: partialGrantPurpose,
    grantedProvider: "cloudflareWebAnalytics" as const,
    providers: partialGrantProviders,
  };

  await action(page, "manage").click();
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
  await page.evaluate((prefix) => {
    document.cookie = `${prefix}_ga=synthetic-certification; Path=/; SameSite=Lax; Secure`;
    document.cookie = "_clck=synthetic-certification; Path=/; SameSite=Lax";
  }, googleCookiePrefix);
  const providerCookiesBeforeWithdrawal = await providerCookieCount(page);
  expect(providerCookiesBeforeWithdrawal).toBeGreaterThanOrEqual(2);

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
    const captured = classifyUrl(url, applicationRoot.origin);
    if (captured !== undefined) withdrawalRequests.push(captured);
  }
  expect(providerRequests(withdrawalRequests)).toEqual([]);
  expect(unexpectedRequestCount(withdrawalRequests)).toBe(0);
  expect(requests.length).toBeLessThanOrEqual(requestEnvelopeLimit);
  const withdrawalRecord = await readConsentRecord(page);
  expect(withdrawalRecord).not.toBeNull();
  if (withdrawalRecord === null) return;
  expect(deniedPurposeCount(withdrawalRecord)).toBe(3);
  const providerCookiesAfterWithdrawal = await providerCookieCount(page);
  expect(providerCookiesAfterWithdrawal).toBe(0);

  const grantRequests = providerRequests(requests.slice(grantStartIndex));
  writeFileSync(
    receiptPath,
    `${JSON.stringify({
      schemaVersion: "1.1.0",
      traffic: "synthetic-only",
      requestEnvelopeLimit,
      totalExternalRequests: requests.length,
      unexpectedExternalRequests: unexpectedRequestCount(requests),
      cases: [
        "fresh-denial",
        "persisted-denial-reload",
        "purpose-specific-partial-grant",
        "positive-grant",
        "complete-withdrawal-reload",
      ],
      providers: providerCounts(grantRequests),
      freshDenial,
      persistedDenialReload,
      partialGrant,
      fullGrant: {
        providerRequests: grantRequests.length,
        unexpectedExternalRequests: 0,
      },
      withdrawalReload: {
        providerRequests: 0,
        unexpectedExternalRequests: 0,
        captureStartedBeforeAction: true,
        networkIdleObserved: true,
        consentRecordPersisted: true,
        deniedPurposeCount: deniedPurposeCount(withdrawalRecord),
        providerCookiesBeforeWithdrawal,
        providerCookiesAfterWithdrawal,
      },
      providerSourceBoundary: {
        classifiedProviderRequests: grantRequests.length,
        unexpectedExternalRequests: unexpectedRequestCount(requests),
      },
    })}\n`,
    { encoding: "utf8", mode: 0o600, flag: "wx" },
  );
});
