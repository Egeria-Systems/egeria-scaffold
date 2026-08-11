import type { Instrumentation } from "next";

import { reportServerError } from "./src/infrastructure/observability/server-reporter";

export const onRequestError: Instrumentation.onRequestError = (error) =>
  reportServerError(error);
