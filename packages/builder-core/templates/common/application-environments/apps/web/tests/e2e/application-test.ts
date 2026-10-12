import { test as base, expect, type Page } from "@playwright/test";
import { assertTransportDiagnostics, createApplicationTransport, type OpenApplicationPage, type ResponseOptions, type ApplicationResponse } from "./application-transport";

type Fixtures = {
  applicationTransport: Awaited<ReturnType<typeof createApplicationTransport>>;
  getApplicationResponse: (path: string, options?: ResponseOptions) => Promise<ApplicationResponse>;
  openApplicationPage: OpenApplicationPage;
};
export const test = base.extend<Fixtures>({
  applicationTransport: [async ({ context, baseURL, playwright }, provideFixture, testInfo) => {
    if (!baseURL) throw new Error("APPLICATION_TRANSPORT_ORIGIN_INVALID");
    const transport = await createApplicationTransport(baseURL, process.env, playwright.request);
    try {
      assertTransportDiagnostics(transport.settings, testInfo.project.use);
      await transport.installBrowserProtection(context);
      // Common quality checks may scroll a selected inline booking into view.
      // Its dedicated spec replaces this exact navigation stub with its own audit.
      const bookingURL = process.env.BOOKING_TEST_EXPECTED_URL;
      if (bookingURL) await context.route(url => url.href === bookingURL, async route => {
        if (!route.request().isNavigationRequest()) return route.fallback();
        await route.fulfill({ contentType: "text/html", body: '<!doctype html><html lang="en"><head><title>Synthetic scheduling</title><link rel="icon" href="data:,"></head><body><main>Synthetic scheduling</main></body></html>' });
      });
      if (process.env.DEPLOY_URL) await transport.waitForApplication();
      await provideFixture(transport);
      transport.assertBrowserRequests();
    } finally { await transport.dispose(); }
  }, { auto: true }],
  getApplicationResponse: async ({ applicationTransport }, provideFixture) => { await provideFixture(applicationTransport.getApplicationResponse); },
  openApplicationPage: async ({ applicationTransport }, provideFixture) => { await provideFixture(applicationTransport.openApplicationPage); },
});
export { expect };
export type { OpenApplicationPage, Page };
