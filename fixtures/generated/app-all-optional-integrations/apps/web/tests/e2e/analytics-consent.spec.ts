import { existsSync, readFileSync } from "node:fs";

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { parse } from "yaml";

import {
  createAnalyticsConsentContext,
  createAnalyticsConsentRecord,
  type AnalyticsConsentRecordV2,
  type AnalyticsPurposeDecision,
} from "../../src/integrations/analytics/analytics-consent-state";
import {
  createAnalyticsProviderDeclarations,
  type AnalyticsProviderIdentifier,
  type AnalyticsPurposeIdentifier,
  type AnalyticsSettings,
} from "../../src/integrations/analytics/analytics-provider-contract";
import { analyticsConsentStorageKey } from "../../src/integrations/analytics/analytics-runtime";
import { analyticsSettings } from "../../src/integrations/analytics/analytics-settings";

const configuredAnalyticsSettings: AnalyticsSettings = analyticsSettings;
const providerDeclarations = createAnalyticsProviderDeclarations(
  configuredAnalyticsSettings,
);
const configuredPurposes = [
  ...new Set(providerDeclarations.map(({ purpose }) => purpose)),
].sort();

type AnalyticsLocale = "en-CA" | "fr-CA";
type LocaleRoute = Readonly<{
  locale: AnalyticsLocale;
  path: string;
  staleGrantStatus: string;
}>;

type ProviderRequest = Readonly<{
  provider: AnalyticsProviderIdentifier;
  script: boolean;
  url: string;
}>;

type RuntimeCommand = Readonly<{
  provider: "google" | "clarity";
  parameters: readonly unknown[];
}>;

function readStaleGrantStatus(locale: AnalyticsLocale): string {
  const source = readFileSync(
    new URL(`../../content/${locale}/analytics.yaml`, import.meta.url),
    "utf8",
  );
  const content: unknown = parse(source);
  if (typeof content !== "object" || content === null) {
    throw new Error("expected the generated analytics locale content");
  }
  const status = Reflect.get(content, "staleGrantRetainedStatus");
  if (typeof status !== "string") {
    throw new Error("expected the localized stale-grant status");
  }
  return status;
}

const localeRoutes: readonly LocaleRoute[] = (
  existsSync(new URL("../../src/i18n/locale.ts", import.meta.url))
    ? [
        { locale: "en-CA", path: "/en-CA" },
        { locale: "fr-CA", path: "/fr-CA" },
      ] as const
    : [{ locale: "en-CA", path: "/" }] as const
).map((route) => ({
  ...route,
  staleGrantStatus: readStaleGrantStatus(route.locale),
}));
const primaryLocalePath = localeRoutes[0]?.path ?? "/";
const cloudflareDeclaration = providerDeclarations.find(
  ({ identifier }) => identifier === "cloudflare-web-analytics",
);
const googleDeclaration = providerDeclarations.find(
  ({ identifier }) => identifier === "google-analytics-4",
);
const clarityDeclaration = providerDeclarations.find(
  ({ identifier }) => identifier === "microsoft-clarity",
);

test.beforeEach(() => {
  test.skip(
    providerDeclarations.length === 0,
    "consent browser behavior requires at least one runtime analytics provider",
  );
});

function action(page: Page, identifier: string): Locator {
  return page.locator(`[data-analytics-consent-action="${identifier}"]`);
}

function purposeChoice(
  page: Page,
  purpose: AnalyticsPurposeIdentifier,
): Locator {
  return page.locator(`[data-analytics-consent-purpose="${purpose}"]`);
}

function sourceMatches(requestUrl: string, declaredSource: string): boolean {
  const request = new URL(requestUrl);
  const wildcardHostname = declaredSource.includes("://*.");
  const source = new URL(declaredSource.replace("://*.", "://"));
  const hostnameMatches = wildcardHostname
    ? request.hostname === source.hostname ||
      request.hostname.endsWith(`.${source.hostname}`)
    : request.hostname === source.hostname;

  return request.protocol === source.protocol && hostnameMatches;
}

function declarationForRequest(requestUrl: string) {
  return providerDeclarations.find((declaration) =>
    [
      declaration.scriptSource,
      ...declaration.imageSources,
      ...declaration.connectSources,
    ].some((source) => sourceMatches(requestUrl, source)),
  );
}

async function interceptProviderRequests(page: Page): Promise<ProviderRequest[]> {
  const requests: ProviderRequest[] = [];
  await page.route("**/*", async (route) => {
    const url = route.request().url();
    const declaration = declarationForRequest(url);
    if (declaration === undefined) {
      await route.continue();
      return;
    }

    requests.push({
      provider: declaration.identifier,
      script: url.startsWith(declaration.scriptSource),
      url,
    });
    await route.fulfill({
      status: 200,
      contentType: "application/javascript",
      headers: { "cache-control": "no-store" },
      body: "",
    });
  });
  return requests;
}

async function waitForNetworkReadiness(page: Page): Promise<void> {
  await page.waitForLoadState("networkidle");
}

function requestedScriptProviders(
  requests: readonly ProviderRequest[],
): readonly AnalyticsProviderIdentifier[] {
  return [
    ...new Set(
      requests
        .filter(({ script }) => script)
        .map(({ provider }) => provider),
    ),
  ].sort();
}

async function expectRequestedProviders(
  requests: readonly ProviderRequest[],
  expected: readonly AnalyticsProviderIdentifier[],
): Promise<void> {
  await expect
    .poll(() => requestedScriptProviders(requests))
    .toEqual([...expected].sort());
}

async function expectProviderScripts(
  page: Page,
  expected: readonly AnalyticsProviderIdentifier[],
): Promise<void> {
  const permitted = new Set(expected);
  for (const declaration of providerDeclarations) {
    await expect(page.locator(`#${declaration.scriptId}`)).toHaveCount(
      permitted.has(declaration.identifier) ? 1 : 0,
    );
  }
}

function decisionsWithGrants(
  granted: readonly AnalyticsPurposeIdentifier[],
): readonly AnalyticsPurposeDecision[] {
  const permitted = new Set(granted);
  return configuredPurposes.map((purpose) => ({
    purpose,
    decision: permitted.has(purpose) ? "granted" : "denied",
  }));
}

async function choosePurposes(
  page: Page,
  purposes: readonly AnalyticsPurposeIdentifier[],
): Promise<void> {
  await action(page, "choose").click();
  for (const purpose of purposes) {
    await purposeChoice(page, purpose).check();
  }
  await action(page, "save").click();
}

async function readStoredRecord(page: Page): Promise<AnalyticsConsentRecordV2> {
  const source = await page.evaluate(
    (key) => window.localStorage.getItem(key),
    analyticsConsentStorageKey,
  );
  expect(source).not.toBeNull();
  if (source === null) {
    throw new Error("expected a stored analytics consent record");
  }
  return JSON.parse(source) as AnalyticsConsentRecordV2;
}

async function preloadRecord(page: Page, record: unknown): Promise<void> {
  await page.addInitScript(
    ({ key, value }) => {
      window.localStorage.setItem(key, value);
    },
    { key: analyticsConsentStorageKey, value: JSON.stringify(record) },
  );
}

async function installRuntimeCommandRecorder(
  page: Page,
): Promise<RuntimeCommand[]> {
  const commands: RuntimeCommand[] = [];
  await page.exposeFunction(
    "__recordAnalyticsCommand",
    (provider: RuntimeCommand["provider"], parameters: readonly unknown[]) => {
      commands.push({ provider, parameters });
    },
  );
  await page.addInitScript(() => {
    const record = (
      provider: "google" | "clarity",
      parameters: readonly unknown[],
    ): void => {
      const binding = Reflect.get(
        window,
        "__recordAnalyticsCommand",
      ) as (
        | ((name: string, values: readonly unknown[]) => Promise<void>)
        | undefined
      );
      if (binding !== undefined) {
        void binding(provider, parameters);
      }
    };

    Reflect.set(window, "gtag", (...parameters: unknown[]) => {
      record("google", parameters);
    });
    Reflect.set(window, "clarity", (...parameters: unknown[]) => {
      record("clarity", parameters);
    });
  });
  return commands;
}

function hasGoogleDenial(commands: readonly RuntimeCommand[]): boolean {
  return commands.some(
    ({ provider, parameters }) =>
      provider === "google" &&
      parameters[0] === "consent" &&
      parameters[1] === "update" &&
      typeof parameters[2] === "object" &&
      parameters[2] !== null &&
      Reflect.get(parameters[2], "analytics_storage") === "denied",
  );
}

function hasClarityDenial(commands: readonly RuntimeCommand[]): boolean {
  return commands.some(
    ({ provider, parameters }) =>
      provider === "clarity" &&
      parameters[0] === "consentv2" &&
      typeof parameters[1] === "object" &&
      parameters[1] !== null &&
      Reflect.get(parameters[1], "analytics_Storage") === "denied",
  );
}

function hasClarityGrant(commands: readonly RuntimeCommand[]): boolean {
  return commands.some(
    ({ provider, parameters }) =>
      provider === "clarity" &&
      parameters[0] === "consentv2" &&
      typeof parameters[1] === "object" &&
      parameters[1] !== null &&
      Reflect.get(parameters[1], "analytics_Storage") === "granted",
  );
}

function hasClarityErasure(commands: readonly RuntimeCommand[]): boolean {
  return commands.some(
    ({ provider, parameters }) =>
      provider === "clarity" &&
      parameters[0] === "consent" &&
      parameters[1] === false,
  );
}

async function preventStorageWritesAndRemoval(page: Page): Promise<void> {
  await page.evaluate(() => {
    const storagePrototype = Object.getPrototypeOf(
      window.localStorage,
    ) as Storage;
    Object.defineProperties(storagePrototype, {
      setItem: {
        configurable: true,
        value: () => {
          throw new DOMException("blocked", "QuotaExceededError");
        },
      },
      removeItem: {
        configurable: true,
        value: () => {
          throw new DOMException("blocked", "SecurityError");
        },
      },
    });
  });
}

async function focusWithTab(page: Page, target: Locator): Promise<void> {
  await expect(target).toBeVisible();
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (await target.evaluate((element) => element === document.activeElement)) {
      return;
    }
    await page.keyboard.press("Tab");
  }
  await expect(target).toBeFocused();
}

test("first visit makes no provider request", async ({ page }) => {
  const providerRequests = await interceptProviderRequests(page);

  await page.goto(primaryLocalePath);

  await expect(page.getByRole("complementary")).toBeVisible();
  await expect(action(page, "allow")).toBeVisible();
  await expectProviderScripts(page, []);
  await waitForNetworkReadiness(page);
  expect(providerRequests).toEqual([]);

  const verificationToken =
    configuredAnalyticsSettings.operationalIntegrations.googleSearchConsole
      ?.verificationToken;
  if (verificationToken !== undefined) {
    await expect(
      page.locator('meta[name="google-site-verification"]'),
    ).toHaveAttribute("content", verificationToken);
  }
});

test("reject all persists denial across reload", async ({ page }) => {
  const providerRequests = await interceptProviderRequests(page);
  await page.goto(primaryLocalePath);

  await action(page, "decline").click();
  await page.reload();

  await expect(action(page, "manage")).toBeVisible();
  await expectProviderScripts(page, []);
  await waitForNetworkReadiness(page);
  expect(providerRequests).toEqual([]);
  const record = await readStoredRecord(page);
  expect(record.schemaVersion).toBe(2);
  expect(record.providerPurposeContext).toEqual(
    createAnalyticsConsentContext(analyticsSettings),
  );
  expect(record.purposes).toEqual(decisionsWithGrants([]));
});

for (const declaration of providerDeclarations) {
  test(`a single ${declaration.purpose} grant loads only its mapped provider`, async ({
    page,
  }) => {
    const providerRequests = await interceptProviderRequests(page);
    await page.goto(primaryLocalePath);

    await choosePurposes(page, [declaration.purpose]);

    await expectRequestedProviders(providerRequests, [declaration.identifier]);
    await expectProviderScripts(page, [declaration.identifier]);
  });
}

test("a representative partial selection loads only its two providers", async ({
  page,
}) => {
  test.skip(
    providerDeclarations.length < 2,
    "a two-provider selection requires at least two configured providers",
  );
  const selected = providerDeclarations.slice(0, 2);
  const providerRequests = await interceptProviderRequests(page);
  await page.goto(primaryLocalePath);

  await choosePurposes(
    page,
    selected.map(({ purpose }) => purpose),
  );

  await expectRequestedProviders(
    providerRequests,
    selected.map(({ identifier }) => identifier),
  );
  await expectProviderScripts(
    page,
    selected.map(({ identifier }) => identifier),
  );
});

test("allow all inserts every provider only once", async ({ page }) => {
  const providerRequests = await interceptProviderRequests(page);
  await page.goto(primaryLocalePath);

  await action(page, "allow").click();
  await expectRequestedProviders(
    providerRequests,
    providerDeclarations.map(({ identifier }) => identifier),
  );
  await expectProviderScripts(
    page,
    providerDeclarations.map(({ identifier }) => identifier),
  );

  await action(page, "manage").click();
  await action(page, "allow").click();

  await expect(action(page, "manage")).toBeVisible();
  await expectProviderScripts(
    page,
    providerDeclarations.map(({ identifier }) => identifier),
  );
  await waitForNetworkReadiness(page);
  for (const declaration of providerDeclarations) {
    expect(
      providerRequests.filter(
        ({ provider, script }) =>
          provider === declaration.identifier && script,
      ),
    ).toHaveLength(1);
  }
});

test("a purpose addition loads only the new provider without navigation", async ({
  page,
}) => {
  test.skip(
    providerDeclarations.length < 2,
    "a purpose addition requires at least two configured providers",
  );
  const [initial, added] = providerDeclarations;
  expect(initial).toBeDefined();
  expect(added).toBeDefined();
  if (initial === undefined || added === undefined) {
    return;
  }

  const providerRequests = await interceptProviderRequests(page);
  await page.goto(primaryLocalePath);
  await choosePurposes(page, [initial.purpose]);
  await expectRequestedProviders(providerRequests, [initial.identifier]);

  let mainFrameNavigations = 0;
  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame()) {
      mainFrameNavigations += 1;
    }
  });
  await action(page, "manage").click();
  await purposeChoice(page, added.purpose).check();
  await action(page, "save").click();

  await expectRequestedProviders(providerRequests, [
    initial.identifier,
    added.identifier,
  ]);
  await expectProviderScripts(page, [initial.identifier, added.identifier]);
  expect(mainFrameNavigations).toBe(0);
});

test("a persisted purpose reduction applies denial and reloads without the removed provider", async ({
  page,
}) => {
  const google = providerDeclarations.find(
    ({ identifier }) => identifier === "google-analytics-4",
  );
  test.skip(google === undefined, "the reduction case requires configured GA4");
  if (google === undefined) {
    return;
  }

  const commands = await installRuntimeCommandRecorder(page);
  const providerRequests = await interceptProviderRequests(page);
  await page.goto(primaryLocalePath);
  await action(page, "allow").click();
  await expectRequestedProviders(
    providerRequests,
    providerDeclarations.map(({ identifier }) => identifier),
  );
  await page.evaluate(() => {
    document.cookie = "_ga=browser-test; Path=/; SameSite=Lax";
    document.cookie = "_clck=browser-test; Path=/; SameSite=Lax";
  });
  const requestsBeforeReduction = providerRequests.length;

  await action(page, "manage").click();
  await purposeChoice(page, google.purpose).uncheck();
  const reloaded = page.waitForEvent("framenavigated", {
    predicate: (frame) => frame === page.mainFrame(),
  });
  await action(page, "save").click();
  await reloaded;
  await expect(action(page, "manage")).toBeVisible();

  const remainingProviders = providerDeclarations
    .filter(({ identifier }) => identifier !== google.identifier)
    .map(({ identifier }) => identifier);
  await expectProviderScripts(page, remainingProviders);
  await expectRequestedProviders(
    providerRequests.slice(requestsBeforeReduction),
    remainingProviders,
  );
  await expect.poll(() => hasGoogleDenial(commands)).toBe(true);
  const record = await readStoredRecord(page);
  expect(
    record.purposes.find(({ purpose }) => purpose === google.purpose)?.decision,
  ).toBe("denied");
  expect(await page.evaluate(() => document.cookie)).not.toContain("_ga=");
  expect(await page.evaluate(() => document.cookie)).toContain("_clck=");
});

test("a notice revision mismatch re-prompts without provider requests", async ({
  page,
}) => {
  const record = createAnalyticsConsentRecord(
    decisionsWithGrants(configuredPurposes),
    createAnalyticsConsentContext(analyticsSettings),
    new Date(),
  );
  await preloadRecord(page, { ...record, noticeVersion: 2 });
  const providerRequests = await interceptProviderRequests(page);

  await page.goto(primaryLocalePath);

  await expect(action(page, "choose")).toBeVisible();
  await expect(page.getByRole("status")).toContainText(/\S/u);
  await expectProviderScripts(page, []);
  await waitForNetworkReadiness(page);
  expect(providerRequests).toEqual([]);
});

test("a provider context mismatch re-prompts without provider requests", async ({
  page,
}) => {
  const record = createAnalyticsConsentRecord(
    decisionsWithGrants(configuredPurposes),
    createAnalyticsConsentContext(analyticsSettings),
    new Date(),
  );
  await preloadRecord(page, {
    ...record,
    providerPurposeContext: record.providerPurposeContext.slice(1),
  });
  const providerRequests = await interceptProviderRequests(page);

  await page.goto(primaryLocalePath);

  await expect(action(page, "choose")).toBeVisible();
  await expect(page.getByRole("status")).toContainText(/\S/u);
  await expectProviderScripts(page, []);
  await waitForNetworkReadiness(page);
  expect(providerRequests).toEqual([]);
});

test("an expired record re-prompts without provider requests", async ({ page }) => {
  const decidedAt = new Date(Date.now() - 181 * 24 * 60 * 60 * 1_000);
  const record = createAnalyticsConsentRecord(
    decisionsWithGrants(configuredPurposes),
    createAnalyticsConsentContext(analyticsSettings),
    decidedAt,
  );
  await preloadRecord(page, record);
  const providerRequests = await interceptProviderRequests(page);

  await page.goto(primaryLocalePath);

  await expect(action(page, "choose")).toBeVisible();
  await expect(page.getByRole("status")).toContainText(/\S/u);
  await expectProviderScripts(page, []);
  await waitForNetworkReadiness(page);
  expect(providerRequests).toEqual([]);
});

for (const { locale, path: localePath, staleGrantStatus } of localeRoutes) {
  test(`failed storage mixed transition stays on ${localePath} with localized incomplete feedback`, async ({
    page,
  }) => {
    test.skip(
      cloudflareDeclaration === undefined ||
        googleDeclaration === undefined ||
        clarityDeclaration === undefined,
      "the mixed transition requires all three analytics providers",
    );
    if (
      cloudflareDeclaration === undefined ||
      googleDeclaration === undefined ||
      clarityDeclaration === undefined
    ) {
      return;
    }
    const commands = await installRuntimeCommandRecorder(page);
    const providerRequests = await interceptProviderRequests(page);
    await page.goto(localePath);
    await choosePurposes(page, [
      googleDeclaration.purpose,
      clarityDeclaration.purpose,
    ]);
    await expectRequestedProviders(
      providerRequests,
      [googleDeclaration.identifier, clarityDeclaration.identifier],
    );
    await expectProviderScripts(page, [
      googleDeclaration.identifier,
      clarityDeclaration.identifier,
    ]);
    await waitForNetworkReadiness(page);
    expect(
      providerRequests.filter(
        ({ provider, script }) =>
          provider === cloudflareDeclaration.identifier && script,
      ),
    ).toEqual([]);
    await expect.poll(() => hasClarityGrant(commands)).toBe(true);
    const commandsBeforeReduction = commands.length;
    const originalUrl = page.url();
    let mainFrameNavigations = 0;
    page.on("framenavigated", (frame) => {
      if (frame === page.mainFrame()) {
        mainFrameNavigations += 1;
      }
    });
    await preventStorageWritesAndRemoval(page);

    await action(page, "manage").click();
    await purposeChoice(page, googleDeclaration.purpose).uncheck();
    await purposeChoice(page, clarityDeclaration.purpose).uncheck();
    await purposeChoice(page, cloudflareDeclaration.purpose).check();
    await action(page, "save").click();

    await expect(page.getByRole("status")).toHaveText(staleGrantStatus);
    await expect(action(page, "save")).toBeVisible();
    await expect(purposeChoice(page, cloudflareDeclaration.purpose)).toBeChecked();
    await expect(purposeChoice(page, googleDeclaration.purpose)).not.toBeChecked();
    await expect(purposeChoice(page, clarityDeclaration.purpose)).not.toBeChecked();
    expect(page.url()).toBe(originalUrl);
    expect(mainFrameNavigations).toBe(0);
    await expectProviderScripts(page, []);
    await waitForNetworkReadiness(page);
    expect(
      providerRequests.filter(
        ({ provider, script }) =>
          provider === cloudflareDeclaration.identifier && script,
      ),
    ).toEqual([]);
    await expect
      .poll(() => hasGoogleDenial(commands.slice(commandsBeforeReduction)))
      .toBe(true);
    await expect
      .poll(() => hasClarityDenial(commands.slice(commandsBeforeReduction)))
      .toBe(true);
    await expect
      .poll(() => hasClarityErasure(commands.slice(commandsBeforeReduction)))
      .toBe(true);
    const retained = await readStoredRecord(page);
    expect(retained.purposes).toEqual(
      decisionsWithGrants([
        googleDeclaration.purpose,
        clarityDeclaration.purpose,
      ]),
    );
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
  });
}

test("two pages synchronize additions and reload reductions into a provider-free document", async ({
  context,
}) => {
  test.skip(
    providerDeclarations.length < 2,
    "cross-page addition and reduction requires at least two providers",
  );
  const [initial, added] = providerDeclarations;
  expect(initial).toBeDefined();
  expect(added).toBeDefined();
  if (initial === undefined || added === undefined) {
    return;
  }

  const firstPage = await context.newPage();
  const secondPage = await context.newPage();
  const firstRequests = await interceptProviderRequests(firstPage);
  const secondRequests = await interceptProviderRequests(secondPage);
  await Promise.all([
    firstPage.goto(primaryLocalePath),
    secondPage.goto(primaryLocalePath),
  ]);
  await Promise.all([
    expect(action(firstPage, "choose")).toBeVisible(),
    expect(action(secondPage, "choose")).toBeVisible(),
  ]);

  await choosePurposes(firstPage, [initial.purpose]);
  await expectRequestedProviders(firstRequests, [initial.identifier]);
  await expectRequestedProviders(secondRequests, [initial.identifier]);
  await expect(action(secondPage, "manage")).toBeVisible();
  const secondInitialRequests = secondRequests.filter(
    ({ provider, script }) => provider === initial.identifier && script,
  ).length;

  await action(firstPage, "manage").click();
  await purposeChoice(firstPage, added.purpose).check();
  await action(firstPage, "save").click();
  await expectRequestedProviders(secondRequests, [
    initial.identifier,
    added.identifier,
  ]);
  expect(
    secondRequests.filter(
      ({ provider, script }) => provider === initial.identifier && script,
    ),
  ).toHaveLength(secondInitialRequests);
  await expectProviderScripts(secondPage, [initial.identifier, added.identifier]);

  const firstRequestsBeforeReduction = firstRequests.length;
  const secondRequestsBeforeReduction = secondRequests.length;
  const firstReloaded = firstPage.waitForEvent("framenavigated", {
    predicate: (frame) => frame === firstPage.mainFrame(),
  });
  const secondReloaded = secondPage.waitForEvent("framenavigated", {
    predicate: (frame) => frame === secondPage.mainFrame(),
  });
  await action(firstPage, "withdraw").click();
  await Promise.all([firstReloaded, secondReloaded]);
  await Promise.all([
    expect(action(firstPage, "manage")).toBeVisible(),
    expect(action(secondPage, "manage")).toBeVisible(),
  ]);

  await expectProviderScripts(firstPage, []);
  await expectProviderScripts(secondPage, []);
  await Promise.all([
    waitForNetworkReadiness(firstPage),
    waitForNetworkReadiness(secondPage),
  ]);
  expect(
    requestedScriptProviders(firstRequests.slice(firstRequestsBeforeReduction)),
  ).toEqual([]);
  expect(
    requestedScriptProviders(secondRequests.slice(secondRequestsBeforeReduction)),
  ).toEqual([]);
  const stored = await readStoredRecord(secondPage);
  expect(stored.purposes.every(({ decision }) => decision === "denied")).toBe(
    true,
  );
});

for (const { locale, path: localePath } of localeRoutes) {
  test(`keyboard-only consent management works on ${localePath}`, async ({
    page,
  }) => {
    const providerRequests = await interceptProviderRequests(page);
    const firstPurpose = configuredPurposes[0];
    expect(firstPurpose).toBeDefined();
    if (firstPurpose === undefined) {
      return;
    }

    await page.goto(localePath);
    await focusWithTab(page, action(page, "choose"));
    await page.keyboard.press("Enter");
    await expect(
      page.locator("#analytics-consent-management-heading"),
    ).toBeFocused();

    await focusWithTab(page, purposeChoice(page, firstPurpose));
    await page.keyboard.press("Space");
    await expect(purposeChoice(page, firstPurpose)).toBeChecked();
    await focusWithTab(page, action(page, "save"));
    await page.keyboard.press("Enter");
    await expect(action(page, "manage")).toBeFocused();

    await page.keyboard.press("Enter");
    await expect(
      page.locator("#analytics-consent-management-heading"),
    ).toBeFocused();
    await focusWithTab(page, action(page, "close"));
    await page.keyboard.press("Enter");
    await expect(action(page, "manage")).toBeFocused();

    await focusWithTab(page, action(page, "withdraw"));
    const reloaded = page.waitForEvent("framenavigated", {
      predicate: (frame) => frame === page.mainFrame(),
    });
    await page.keyboard.press("Enter");
    await reloaded;
    await expect(action(page, "manage")).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    await expect.poll(() => providerRequests.length).toBeGreaterThan(0);
  });
}

for (const { path: localePath } of localeRoutes) {
  test(`the expanded consent control has no automated axe violations on ${localePath}`, async ({
    page,
  }) => {
    const providerRequests = await interceptProviderRequests(page);
    await page.goto(localePath);
    await action(page, "choose").click();

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();

    expect(results.violations).toEqual([]);
    await expectProviderScripts(page, []);
    await waitForNetworkReadiness(page);
    expect(providerRequests).toEqual([]);
  });
}

for (const { path: localePath } of localeRoutes) {
  test(`the expanded consent control does not overflow at 320px on ${localePath}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    const providerRequests = await interceptProviderRequests(page);
    await page.goto(localePath);
    await action(page, "choose").click();

    const dimensions = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));

    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
    await expectProviderScripts(page, []);
    await waitForNetworkReadiness(page);
    expect(providerRequests).toEqual([]);
  });
}
