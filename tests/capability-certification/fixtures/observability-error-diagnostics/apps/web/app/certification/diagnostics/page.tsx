"use client";

import {
  reportBrowserError,
  reportCaughtBrowserError,
} from "../../../src/infrastructure/observability/browser-reporter";

function throwSyntheticFailure(): never {
  throw new Error("synthetic diagnostics certification failure");
}

export default function DiagnosticsCertificationPage() {
  const boundaryRequested =
    typeof globalThis.location === "object" &&
    new URLSearchParams(globalThis.location.search).get("case") ===
      "react-boundary";
  const recoveryRequested =
    Reflect.get(globalThis, "__diagnosticsCertificationRecover") === true;
  if (boundaryRequested && !recoveryRequested) {
    throwSyntheticFailure();
  }

  function dispatchBrowserError() {
    const error = new Error("synthetic browser error");
    globalThis.dispatchEvent(new ErrorEvent("error", { error }));
  }

  function dispatchUnhandledRejection() {
    const reason = new Error("synthetic unhandled rejection");
    globalThis.dispatchEvent(
      new PromiseRejectionEvent("unhandledrejection", {
        promise: Promise.resolve(),
        reason,
      }),
    );
  }

  function reportSelectedCatch() {
    try {
      throwSyntheticFailure();
    } catch (error) {
      reportCaughtBrowserError(error, {
        operation: "certification-browser",
      });
    }
  }

  function reportDuplicate() {
    const error = new Error("synthetic duplicate error");
    reportBrowserError(error, "window-error");
    reportCaughtBrowserError(error, {
      operation: "certification-duplicate",
    });
  }

  return (
    <main>
      <h1>Diagnostics certification</h1>
      <button onClick={dispatchBrowserError} type="button">
        Capture browser error
      </button>
      <button onClick={dispatchUnhandledRejection} type="button">
        Capture unhandled rejection
      </button>
      <button onClick={reportSelectedCatch} type="button">
        Capture selected browser catch
      </button>
      <button onClick={reportDuplicate} type="button">
        Capture duplicate suppression
      </button>
    </main>
  );
}
