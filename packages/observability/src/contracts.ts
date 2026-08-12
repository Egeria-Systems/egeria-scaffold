export const operationalSeverities = Object.freeze([
  "info",
  "warning",
  "error",
] as const);

export const operationalRuntimes = Object.freeze([
  "browser",
  "server",
] as const);

export const operationalEventKinds = Object.freeze([
  "application.error",
  "application.lifecycle",
  "web.vital",
] as const);

export const operationalErrorCategories = Object.freeze([
  "configuration",
  "dependency",
  "network",
  "timeout",
  "validation",
  "unexpected",
] as const);

export const operationalCaptureMechanisms = Object.freeze([
  "browser-error-event",
  "browser-unhandled-rejection",
  "react-error-boundary",
  "next-request-error",
  "selected-catch",
] as const);

export const operationalRouterKinds = Object.freeze([
  "app-router",
  "pages-router",
] as const);

export const operationalRouteTypes = Object.freeze([
  "action",
  "proxy",
  "render",
  "route",
] as const);

export const operationalRenderSources = Object.freeze([
  "react-server-components",
  "react-server-components-payload",
  "server-rendering",
] as const);

export const operationalRenderTypes = Object.freeze([
  "dynamic",
  "dynamic-resume",
] as const);

export const operationalRevalidateReasons = Object.freeze([
  "on-demand",
  "stale",
] as const);

export const sinkFailureReasons = Object.freeze([
  "invalid-event",
  "invalid-result",
  "network-failure",
  "payload-invalid",
  "payload-too-large",
  "provider-rejected",
  "sink-threw",
  "transport-rejected",
] as const);

export type OperationalSeverity = (typeof operationalSeverities)[number];
export type OperationalRuntime = (typeof operationalRuntimes)[number];
export type OperationalEventKind = (typeof operationalEventKinds)[number];
export type OperationalErrorCategory =
  (typeof operationalErrorCategories)[number];
export type OperationalCaptureMechanism =
  (typeof operationalCaptureMechanisms)[number];
export type SinkFailureReason = (typeof sinkFailureReasons)[number];

export type OperationalAttributeValue = boolean | number | string;
export type OperationalAttributes = Readonly<
  Record<string, OperationalAttributeValue>
>;

export type OperationalContext = Readonly<{
  eventId: string;
  correlationId?: string;
  releaseId?: string;
  service: string;
  environment?: string;
}>;

export type OperationalEvent = Readonly<{
  schemaVersion: "2.0.0";
  occurredAt: string;
  name: string;
  kind: OperationalEventKind;
  runtime: OperationalRuntime;
  severity: OperationalSeverity;
  context: OperationalContext;
  errorCategory?: OperationalErrorCategory;
  attributes: OperationalAttributes;
}>;

export type OperationalEventInput = Readonly<{
  name: string;
  kind: OperationalEventKind;
  runtime: OperationalRuntime;
  severity: OperationalSeverity;
  context: Readonly<{
    eventId: string;
    correlationId?: string;
    releaseId?: string;
    service: string;
    environment?: string;
  }>;
  errorCategory?: OperationalErrorCategory;
  attributes?: Readonly<Record<string, unknown>>;
}>;

export type EventClock = Readonly<{
  now: () => Date;
}>;

export type CreateOperationalEventOptions = Readonly<{
  clock: EventClock;
  allowedAttributeNames?: readonly string[];
}>;

export type OperationalEventValidationCode =
  | "EVENT_ATTRIBUTE_POLICY_INVALID"
  | "EVENT_CONTEXT_INVALID"
  | "EVENT_ERROR_CATEGORY_INVALID"
  | "EVENT_INPUT_INVALID"
  | "EVENT_KIND_INVALID"
  | "EVENT_NAME_INVALID"
  | "EVENT_RUNTIME_INVALID"
  | "EVENT_SEVERITY_INVALID"
  | "EVENT_TIME_INVALID";

export type OperationalEventResult =
  | Readonly<{ ok: true; value: OperationalEvent }>
  | Readonly<{ ok: false; code: OperationalEventValidationCode }>;

export type SinkWriteResult =
  | Readonly<{ status: "delivered" }>
  | Readonly<{ status: "failed"; reason: SinkFailureReason }>;

export type OperationalSink = Readonly<{
  identifier: string;
  write: (
    event: OperationalEvent,
  ) => SinkWriteResult | Promise<SinkWriteResult>;
}>;

export type ErrorCaptureContext = Readonly<{
  mechanism: OperationalCaptureMechanism;
  handled: boolean;
  operation?: string;
  routerKind?: (typeof operationalRouterKinds)[number];
  routeType?: (typeof operationalRouteTypes)[number];
  renderSource?: (typeof operationalRenderSources)[number];
  renderType?: (typeof operationalRenderTypes)[number];
  revalidateReason?: (typeof operationalRevalidateReasons)[number];
  requestMethod?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS";
  routeIdentifier?: string;
}>;

export type ExceptionDiagnostics = Readonly<{
  exceptionType: string;
  exceptionMessage?: string;
  exceptionStacktrace?: string;
  exceptionCode?: string;
  exceptionDigest?: string;
  fingerprint: string;
  cause?: ExceptionDiagnostics;
  truncated: boolean;
}>;

export type OperationalErrorReport = Readonly<{
  event: OperationalEvent;
  capture: ErrorCaptureContext;
  diagnostics: ExceptionDiagnostics;
}>;

export type DiagnosticSink = Readonly<{
  identifier: string;
  writeReport: (
    report: OperationalErrorReport,
  ) => SinkWriteResult | Promise<SinkWriteResult>;
}>;

export type CreateOperationalErrorReportOptions = Readonly<
  Record<string, never>
>;

export type OperationalErrorReportValidationCode =
  | "ERROR_REPORT_CAPTURE_INVALID"
  | "ERROR_REPORT_DIAGNOSTICS_INVALID"
  | "ERROR_REPORT_EVENT_INVALID"
  | "ERROR_REPORT_INPUT_INVALID";

export type OperationalErrorReportResult =
  | Readonly<{ ok: true; value: OperationalErrorReport }>
  | Readonly<{
      ok: false;
      code: OperationalErrorReportValidationCode;
    }>;

export type DispatchResult = Readonly<
  | { sink: string; status: "delivered" }
  | { sink: string; status: "failed"; reason: SinkFailureReason }
>;
