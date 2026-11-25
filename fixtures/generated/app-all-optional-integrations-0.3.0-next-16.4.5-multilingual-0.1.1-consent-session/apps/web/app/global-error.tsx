"use client";

import { useEffect, useSyncExternalStore } from "react";

import frenchCatalogSource from "../content/fr-CA/localized-content.yaml";
import { isUnknownRecord, parseYamlContent } from "../src/content/content-schema";
import { defaultLocale, isLocale } from "../src/i18n/locale";
import { reportReactBoundaryError } from "../src/infrastructure/observability/browser-reporter";
import { parseErrorFallbackCopy, readErrorFallbackCopy } from "../src/infrastructure/observability/error-copy";
import { ErrorFallback } from "../src/presentation/error-fallback";

type GlobalErrorBoundaryProps = Readonly<{
  error: Error;
  reset: () => void;
  retry?: () => void;
}>;

const subscribe = () => () => undefined;
const readServerLocale = () => defaultLocale;

function readBrowserLocale() {
  const segment = window.location.pathname.split("/")[1] ?? "";
  return isLocale(segment) ? segment : defaultLocale;
}

function readFrenchErrorCopy() {
  try {
    const catalog = parseYamlContent(frenchCatalogSource);
    return parseErrorFallbackCopy(isUnknownRecord(catalog) ? catalog.error : undefined);
  } catch {
    return undefined;
  }
}

export default function GlobalErrorBoundary({ error, reset, retry }: GlobalErrorBoundaryProps) {
  const locale = useSyncExternalStore(subscribe, readBrowserLocale, readServerLocale);
  const frenchCopy = locale === "fr-CA" ? readFrenchErrorCopy() : undefined;
  const copy = frenchCopy ?? readErrorFallbackCopy();

  useEffect(() => {
    reportReactBoundaryError(error, { boundary: "global" });
  }, [error]);

  return (
    <html lang={frenchCopy === undefined ? defaultLocale : locale}>
      <body>
        <ErrorFallback copy={copy} onRetry={retry ?? reset} />
      </body>
    </html>
  );
}
