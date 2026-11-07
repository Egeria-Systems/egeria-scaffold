import { createBrowserQualityConfig } from "./playwright.config.shared";
import { guardedDevelopmentMode, guardedDevelopmentOrigin, guardedDevelopmentServer } from "./scripts/browser-development-server";

const developmentConfig = {
  ...createBrowserQualityConfig({ baseURL: guardedDevelopmentOrigin, webServer: guardedDevelopmentServer }),
  metadata: { applicationTransport: guardedDevelopmentMode },
};

export default developmentConfig;
