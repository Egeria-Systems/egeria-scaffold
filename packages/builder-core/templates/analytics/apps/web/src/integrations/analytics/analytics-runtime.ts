import {
  createAnalyticsProviderDeclarations,
  type AnalyticsProviderDeclaration,
  type AnalyticsSettings,
} from "./analytics-provider-contract";

export const analyticsConsentPolicy = "explicit-opt-in" as const;
export const analyticsConsentStorageKey = "egeria.analytics.consent.v1";

export type AnalyticsConsentChoice = "granted" | "denied";

type ClarityCommand = ((...parameters: unknown[]) => void) & {
  q?: unknown[][];
};

type AnalyticsWindow = Window & {
  dataLayer?: unknown[][];
  gtag?: (...parameters: unknown[]) => void;
  clarity?: ClarityCommand;
};

type AnalyticsBrowser = Readonly<{
  document: Document;
  window: AnalyticsWindow;
}>;

function currentBrowser(): AnalyticsBrowser {
  return { document, window };
}

function insertScript(
  browser: AnalyticsBrowser,
  declaration: AnalyticsProviderDeclaration,
  source: string,
  configure?: (script: HTMLScriptElement) => void,
): void {
  if (browser.document.getElementById(declaration.scriptId) !== null) {
    return;
  }

  const script = browser.document.createElement("script");
  script.id = declaration.scriptId;
  script.src = source;
  script.async = true;
  configure?.(script);
  browser.document.head.append(script);
}

function loadCloudflareWebAnalytics(
  settings: AnalyticsSettings,
  declaration: AnalyticsProviderDeclaration,
  browser: AnalyticsBrowser,
): void {
  const provider = settings.providers.cloudflareWebAnalytics;
  if (
    provider === undefined ||
    browser.document.getElementById(declaration.scriptId) !== null
  ) {
    return;
  }

  insertScript(browser, declaration, declaration.scriptSource, (script) => {
    script.defer = true;
    script.dataset.cfBeacon = JSON.stringify({ token: provider.siteToken });
  });
}

function configureGoogleConsent(
  browser: AnalyticsBrowser,
  analyticsStorage: "granted" | "denied",
): void {
  browser.window.dataLayer ??= [];
  browser.window.gtag ??= (...parameters: unknown[]) => {
    browser.window.dataLayer?.push(parameters);
  };
  browser.window.gtag("consent", "update", {
    analytics_storage: analyticsStorage,
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
  });
}

function loadGoogleAnalytics4(
  settings: AnalyticsSettings,
  declaration: AnalyticsProviderDeclaration,
  browser: AnalyticsBrowser,
): void {
  const provider = settings.providers.googleAnalytics4;
  if (
    provider === undefined ||
    browser.document.getElementById(declaration.scriptId) !== null
  ) {
    return;
  }

  configureGoogleConsent(browser, "granted");
  browser.window.gtag?.("js", new Date());
  browser.window.gtag?.("config", provider.measurementId, {
    send_page_view: true,
  });
  insertScript(
    browser,
    declaration,
    `${declaration.scriptSource}?id=${encodeURIComponent(provider.measurementId)}`,
  );
}

function clarityCommand(browser: AnalyticsBrowser): ClarityCommand {
  if (browser.window.clarity !== undefined) {
    return browser.window.clarity;
  }

  const command: ClarityCommand = (...parameters: unknown[]) => {
    command.q ??= [];
    command.q.push(parameters);
  };
  browser.window.clarity = command;
  return command;
}

function configureClarityConsent(
  browser: AnalyticsBrowser,
  analyticsStorage: "granted" | "denied",
): void {
  clarityCommand(browser)("consentv2", {
    ad_Storage: "denied",
    analytics_Storage: analyticsStorage,
  });
}

function loadMicrosoftClarity(
  settings: AnalyticsSettings,
  declaration: AnalyticsProviderDeclaration,
  browser: AnalyticsBrowser,
): void {
  const provider = settings.providers.microsoftClarity;
  if (
    provider === undefined ||
    browser.document.getElementById(declaration.scriptId) !== null
  ) {
    return;
  }

  configureClarityConsent(browser, "granted");
  insertScript(
    browser,
    declaration,
    `${declaration.scriptSource}${encodeURIComponent(provider.projectId)}`,
  );
}

export function readAnalyticsConsent(
  browser: AnalyticsBrowser = currentBrowser(),
): AnalyticsConsentChoice | null {
  try {
    const stored = browser.window.localStorage.getItem(analyticsConsentStorageKey);
    return stored === "granted" || stored === "denied" ? stored : null;
  } catch {
    return null;
  }
}

export function writeAnalyticsConsent(
  choice: AnalyticsConsentChoice,
  browser: AnalyticsBrowser = currentBrowser(),
): void {
  try {
    browser.window.localStorage.setItem(analyticsConsentStorageKey, choice);
  } catch {
    // The explicit in-memory choice still governs this page when storage is unavailable.
  }
}

export function loadSelectedAnalytics(
  settings: AnalyticsSettings,
  browser: AnalyticsBrowser = currentBrowser(),
): void {
  if (settings.consent.policy !== analyticsConsentPolicy) {
    return;
  }

  for (const declaration of createAnalyticsProviderDeclarations(settings)) {
    switch (declaration.identifier) {
      case "cloudflare-web-analytics":
        loadCloudflareWebAnalytics(settings, declaration, browser);
        break;
      case "google-analytics-4":
        loadGoogleAnalytics4(settings, declaration, browser);
        break;
      case "microsoft-clarity":
        loadMicrosoftClarity(settings, declaration, browser);
        break;
    }
  }
}

function cookieDomainVariants(hostname: string): readonly string[] {
  const labels = hostname.toLowerCase().replace(/\.$/u, "").split(".");
  const isIpAddress =
    labels.length === 4 && labels.every((label) => /^\d{1,3}$/u.test(label));
  if (
    labels.length < 2 ||
    hostname.includes(":") ||
    isIpAddress
  ) {
    return [];
  }

  return labels
    .slice(0, -1)
    .map((_, index) => labels.slice(index).join("."));
}

function clearAccessibleAnalyticsCookies(browser: AnalyticsBrowser): void {
  const domainVariants = cookieDomainVariants(browser.window.location.hostname);
  for (const cookie of browser.document.cookie.split(";")) {
    const name = cookie.split("=", 1)[0]?.trim();
    if (
      name === "_ga" ||
      name?.startsWith("_ga_") === true ||
      name === "_clck" ||
      name === "_clsk"
    ) {
      browser.document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax`;
      for (const domain of domainVariants) {
        browser.document.cookie =
          `${name}=; Max-Age=0; Path=/; Domain=${domain}; SameSite=Lax`;
      }
    }
  }
}

export function grantAnalyticsConsent(
  settings: AnalyticsSettings,
  browser: AnalyticsBrowser = currentBrowser(),
): void {
  writeAnalyticsConsent("granted", browser);
  loadSelectedAnalytics(settings, browser);
}

export function declineAnalyticsConsent(
  browser: AnalyticsBrowser = currentBrowser(),
): void {
  writeAnalyticsConsent("denied", browser);
}

export function withdrawAnalyticsConsent(
  settings: AnalyticsSettings,
  browser: AnalyticsBrowser = currentBrowser(),
  reload: () => void = () => browser.window.location.reload(),
): void {
  if (settings.providers.googleAnalytics4 !== undefined) {
    configureGoogleConsent(browser, "denied");
  }
  if (settings.providers.microsoftClarity !== undefined) {
    configureClarityConsent(browser, "denied");
    clarityCommand(browser)("consent", false);
  }
  clearAccessibleAnalyticsCookies(browser);
  writeAnalyticsConsent("denied", browser);
  reload();
}

export type AnalyticsConsentRuntime = Readonly<{
  read: () => AnalyticsConsentChoice | null;
  grant: (settings: AnalyticsSettings) => void;
  decline: () => void;
  withdraw: (settings: AnalyticsSettings) => void;
}>;

export const browserAnalyticsConsentRuntime: AnalyticsConsentRuntime = {
  read: () => readAnalyticsConsent(),
  grant: (settings) => grantAnalyticsConsent(settings),
  decline: () => declineAnalyticsConsent(),
  withdraw: (settings) => withdrawAnalyticsConsent(settings),
};
