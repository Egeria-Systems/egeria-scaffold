"use client";

import { useEffect } from "react";

import { reportReactBoundaryError } from "../../src/infrastructure/observability/browser-reporter";
import { readErrorFallbackCopy } from "../../src/infrastructure/observability/error-copy";
import { ErrorFallback } from "../../src/presentation/error-fallback";

type WorkErrorBoundaryProperties = Readonly<{
  error: Error;
  reset: () => void;
}>;

export default function WorkErrorBoundary({
  error,
  reset,
}: WorkErrorBoundaryProperties) {
  useEffect(() => {
    reportReactBoundaryError(error, { boundary: "page" });
  }, [error]);

  return <ErrorFallback copy={readErrorFallbackCopy()} onRetry={reset} />;
}
