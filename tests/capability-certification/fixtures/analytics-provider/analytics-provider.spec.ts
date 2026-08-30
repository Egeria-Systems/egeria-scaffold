import { writeFileSync } from "node:fs";

import { expect, test, type Page, type Request } from "@playwright/test";

const receiptPath = process.env.ANALYTICS_PROVIDER_BROWSER_RECEIPT_PATH;
const deployedUrl = process.env.PLAYWRIGHT_DEPLOYED_URL;
const requestEnvelopeLimit = 64;
const analyticsConsentStorageKey = "egeria.analytics.consent.v2";
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
  expect(persistedDenialRecord.schemaVersion).toBe(2);
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
  await page.evaluate(() => {
    document.cookie = "_ga=synthetic-certification; Path=/; SameSite=Lax";
    document.cookie = "_clck=synthetic-certification; Path=/; SameSite=Lax";
  });
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
    const captured = classifyUrl(url, applicationRoot.hostname);
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
