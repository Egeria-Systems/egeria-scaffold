export type RequestContext = Readonly<{
  requestId: string;
  operation: "health.read";
  startedAt: string;
}>;

export function createRequestContext(input: Readonly<{
  randomUUID: () => string;
  now: () => Date;
}>): RequestContext {
  return Object.freeze({
    requestId: input.randomUUID(),
    operation: "health.read",
    startedAt: input.now().toISOString(),
  });
}
