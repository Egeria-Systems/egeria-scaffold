import { writeFileSync } from "node:fs";

import { expect, test, type Page, type Request } from "@playwright/test";

const receiptPath = process.env.ANALYTICS_PROVIDER_BROWSER_RECEIPT_PATH;
const providerIdentifiers = [
  "cloudflare-web-analytics",
  "google-analytics-4",
  "microsoft-clarity",
] as const;
type ProviderIdentifier = (typeof providerIdentifiers)[number];

function providerFor(request: Request): ProviderIdentifier | undefined {
  const hostname = new URL(request.url()).hostname;
  if (hostname === "static.cloudflareinsights.com" || hostname === "cloudflareinsights.com") {
    return "cloudflare-web-analytics";
  }
  if (hostname === "www.googletagmanager.com" || hostname.endsWith(".google-analytics.com")) {
    return "google-analytics-4";
  }
  if (hostname === "www.clarity.ms" || hostname.endsWith(".clarity.ms")) {
    return "microsoft-clarity";
  }
  return undefined;
}

function action(page: Page, identifier: "allow" | "decline" | "manage") {
  return page.locator(`[data-analytics-consent-action="${identifier}"]`);
}

test("bounded synthetic consent journey reaches each selected provider only after grant", async ({
  page,
}) => {
  test.skip(receiptPath === undefined, "the protected workflow owns the receipt path");
  if (receiptPath === undefined) return;

  let requests: ProviderIdentifier[] = [];
  page.on("request", (request) => {
    const provider = providerFor(request);
    if (provider !== undefined) requests.push(provider);
  });

  await page.goto("/en-CA");
  await expect(page.getByRole("complementary")).toBeVisible();
  await page.waitForLoadState("networkidle");
  expect(requests).toEqual([]);

  await action(page, "allow").click();
  await expect.poll(() => [...new Set(requests)].sort(), { timeout: 30_000 }).toEqual(
    [...providerIdentifiers].sort(),
  );
  for (const identifier of providerIdentifiers) {
    await expect(page.locator(`#analytics-${identifier}`)).toHaveCount(1);
  }

  await action(page, "manage").click();
  const reloaded = page.waitForEvent("framenavigated", {
    predicate: (frame) => frame === page.mainFrame(),
  });
  await action(page, "decline").click();
  await reloaded;
  requests = [];
  await expect(action(page, "manage")).toBeVisible();
  await page.waitForLoadState("networkidle");
  for (const identifier of providerIdentifiers) {
    await expect(page.locator(`#analytics-${identifier}`)).toHaveCount(0);
  }
  expect(requests).toEqual([]);

  writeFileSync(
    receiptPath,
    `${JSON.stringify({ ok: true, traffic: "synthetic-only", cases: ["fresh-denial", "positive-grant", "complete-withdrawal-reload"], providers: providerIdentifiers, noRequestsBeforeGrant: true, noRequestsAfterWithdrawalReload: true })}\n`,
    { encoding: "utf8", mode: 0o600, flag: "wx" },
  );
});
