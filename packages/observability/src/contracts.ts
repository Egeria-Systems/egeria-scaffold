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
export type SinkFailureReason = (typeof sinkFailureReasons)[number];

export type OperationalAttributeValue = boolean | number | string;
export type OperationalAttributes = Readonly<
  Record<string, OperationalAttributeValue>
>;

export type OperationalContext = Readonly<{
  correlationId: string;
  releaseId?: string;
}>;

export type OperationalEvent = Readonly<{
  schemaVersion: "1.0.0";
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
    correlationId: string;
    releaseId?: string;
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

export type DispatchResult = Readonly<
  | { sink: string; status: "delivered" }
  | { sink: string; status: "failed"; reason: SinkFailureReason }
>;
