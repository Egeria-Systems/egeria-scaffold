import { createBrowserQualityConfig } from "./playwright.config.shared";
const baseURL = process.env.DEPLOY_URL;
if (!baseURL) throw new Error("DEPLOYED_URL_REQUIRED");
export default createBrowserQualityConfig({ baseURL });
