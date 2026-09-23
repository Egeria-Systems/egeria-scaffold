// Synthetic local proof entry point; never a deployment target.
import openNext from "../../../.open-next/worker.js";
export * from "../../../.open-next/worker.js";

const http = {
  async fetch(request, environment, context) {
    const pathname = new URL(request.url).pathname;
    if (pathname === "/__queue-proof/bindings") {
      return Response.json({
        httpMarker: environment.HTTP_MARKER === "synthetic-http",
        consumerMarker: environment.CONSUMER_MARKER === "synthetic-consumer",
      });
    }
    if (pathname === "/__queue-proof/enqueue" && request.method === "POST") {
      if (!environment.QUEUE) {
        return Response.json({ error: "QUEUE_BINDING_MISSING" }, { status: 503 });
      }
      const messages = await request.json();
      await environment.QUEUE.sendBatch(messages.map((body) => ({ body })));
      return new Response(null, { status: 202 });
    }
    return openNext.fetch(request, environment, context);
  },
};

export default http;
