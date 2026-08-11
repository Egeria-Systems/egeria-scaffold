import { reportBrowserError } from "./src/infrastructure/observability/browser-reporter";

globalThis.addEventListener("error", () => {
  reportBrowserError("window-error");
});

globalThis.addEventListener("unhandledrejection", () => {
  reportBrowserError("unhandled-rejection");
});
