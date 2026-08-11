import {
  operationalErrorCategories,
  operationalEventKinds,
  operationalRuntimes,
  operationalSeverities,
  type CreateOperationalEventOptions,
  type OperationalContext,
  type OperationalErrorCategory,
  type OperationalEvent,
  type OperationalEventInput,
  type OperationalEventResult,
} from "./contracts.js";
import {
  redactOperationalAttributes,
  validateAttributeAllowlist,
} from "./redaction.js";

const eventNamePattern = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/u;
const contextTokenPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
const maximumEventNameLength = 64;
const createdOperationalEvents = new WeakSet();

function includes<const Value extends string>(
  values: readonly Value[],
  value: unknown,
): value is Value {
  return typeof value === "string" && values.includes(value as Value);
}

function createContext(value: unknown): OperationalContext | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined;
  }

  try {
    const record = value as Readonly<Record<string, unknown>>;
    const correlationId = record.correlationId;
    const releaseId = record.releaseId;
    if (
      typeof correlationId !== "string" ||
      !contextTokenPattern.test(correlationId) ||
      (releaseId !== undefined &&
        (typeof releaseId !== "string" ||
          !contextTokenPattern.test(releaseId)))
    ) {
      return undefined;
    }

    return Object.freeze({
      correlationId,
      ...(typeof releaseId === "string" ? { releaseId } : {}),
    });
  } catch {
    return undefined;
  }
}

function createFrozenEvent(input: Readonly<{
  occurredAt: string;
  name: string;
  kind: OperationalEvent["kind"];
  runtime: OperationalEvent["runtime"];
  severity: OperationalEvent["severity"];
  context: OperationalContext;
  errorCategory?: OperationalErrorCategory;
  attributes: OperationalEvent["attributes"];
}>): OperationalEvent {
  const event = Object.freeze({
    schemaVersion: "1.0.0" as const,
    occurredAt: input.occurredAt,
    name: input.name,
    kind: input.kind,
    runtime: input.runtime,
    severity: input.severity,
    context: input.context,
    ...(input.errorCategory === undefined
      ? {}
      : { errorCategory: input.errorCategory }),
    attributes: input.attributes,
  });
  createdOperationalEvents.add(event);
  return event;
}

function resultFailure(
  code: Extract<OperationalEventResult, { ok: false }>["code"],
): OperationalEventResult {
  return Object.freeze({ ok: false, code });
}

function createOperationalEventUnchecked(
  input: OperationalEventInput,
  options: CreateOperationalEventOptions,
): OperationalEventResult {
  if (
    typeof input.name !== "string" ||
    input.name.length > maximumEventNameLength ||
    !eventNamePattern.test(input.name)
  ) {
    return resultFailure("EVENT_NAME_INVALID");
  }
  if (!includes(operationalEventKinds, input.kind)) {
    return resultFailure("EVENT_KIND_INVALID");
  }
  if (!includes(operationalRuntimes, input.runtime)) {
    return resultFailure("EVENT_RUNTIME_INVALID");
  }
  if (!includes(operationalSeverities, input.severity)) {
    return resultFailure("EVENT_SEVERITY_INVALID");
  }

  const context = createContext(input.context);
  if (context === undefined) return resultFailure("EVENT_CONTEXT_INVALID");

  const hasValidErrorCategory = includes(
    operationalErrorCategories,
    input.errorCategory,
  );
  if (
    (input.kind === "application.error" && !hasValidErrorCategory) ||
    (input.kind !== "application.error" && input.errorCategory !== undefined)
  ) {
    return resultFailure("EVENT_ERROR_CATEGORY_INVALID");
  }

  const allowedAttributeNames = options.allowedAttributeNames ?? [];
  if (!validateAttributeAllowlist(allowedAttributeNames)) {
    return resultFailure("EVENT_ATTRIBUTE_POLICY_INVALID");
  }

  let occurredAt: string;
  try {
    occurredAt = options.clock.now().toISOString();
  } catch {
    return resultFailure("EVENT_TIME_INVALID");
  }

  const value = createFrozenEvent({
    occurredAt,
    name: input.name,
    kind: input.kind,
    runtime: input.runtime,
    severity: input.severity,
    context,
    ...(input.errorCategory === undefined
      ? {}
      : { errorCategory: input.errorCategory }),
    attributes: redactOperationalAttributes(
      input.attributes,
      allowedAttributeNames,
    ),
  });
  return Object.freeze({ ok: true, value });
}

export function createOperationalEvent(
  input: OperationalEventInput,
  options: CreateOperationalEventOptions,
): OperationalEventResult {
  try {
    return createOperationalEventUnchecked(input, options);
  } catch {
    return resultFailure("EVENT_INPUT_INVALID");
  }
}

function readBoundedErrorField(
  error: unknown,
  key: "code" | "name",
): string | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  try {
    const value = (error as Readonly<Record<string, unknown>>)[key];
    return typeof value === "string" && value.length <= 64
      ? value
      : undefined;
  } catch {
    return undefined;
  }
}

export function normalizeErrorCategory(
  error: unknown,
): OperationalErrorCategory {
  const name = readBoundedErrorField(error, "name");
  const code = readBoundedErrorField(error, "code");

  if (name === "AbortError" || name === "TimeoutError") return "timeout";
  if (code === "ETIMEDOUT" || code === "ECONNABORTED") return "timeout";
  if (
    code === "ECONNRESET" ||
    code === "ENOTFOUND" ||
    code === "EAI_AGAIN"
  ) {
    return "network";
  }
  if (code?.startsWith("ERR_INVALID_ARG") === true) return "validation";
  if (code === "MODULE_NOT_FOUND" || code === "ERR_MODULE_NOT_FOUND") {
    return "dependency";
  }
  if (code === "CONFIGURATION_ERROR") return "configuration";
  return "unexpected";
}

export function isOperationalEvent(value: unknown): value is OperationalEvent {
  return (
    typeof value === "object" &&
    value !== null &&
    createdOperationalEvents.has(value)
  );
}
