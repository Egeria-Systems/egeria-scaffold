"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";

import { defaultLocale, isLocale } from "../src/i18n/locale";
import { readLocalizedCatalog } from "../src/i18n/read-localized-content";
import { reportReactBoundaryError } from "../src/infrastructure/observability/browser-reporter";
import { ErrorFallback } from "../src/presentation/error-fallback";

type ErrorBoundaryProps = Readonly<{
  error: Error;
  reset: () => void;
}>;

export default function ErrorBoundary({ error, reset }: ErrorBoundaryProps) {
  const parameters = useParams<{ locale?: string }>();
  const locale =
    parameters.locale !== undefined && isLocale(parameters.locale)
      ? parameters.locale
      : defaultLocale;

  useEffect(() => {
    reportReactBoundaryError(error, { boundary: "page" });
  }, [error]);

  return (
    <ErrorFallback copy={readLocalizedCatalog(locale).error} onRetry={reset} />
  );
}
