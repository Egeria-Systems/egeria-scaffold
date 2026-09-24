// The same synthetic handlers share one Worker only for this local comparison.
import http from "./http.mjs";
import consumer from "./consumer.mjs";
export * from "./http.mjs";

const shared = { fetch: http.fetch, queue: consumer.queue };

export default shared;
