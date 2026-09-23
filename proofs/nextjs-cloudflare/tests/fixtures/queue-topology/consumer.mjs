// Test-only failure controls and observations, not business job contracts.
const consumer = {
  async queue(batch, environment) {
    for (const message of batch.messages) {
      const { key, sequence, action } = message.body;
      const report = (stage) => console.log(JSON.stringify({
        proof: "queue-topology", stage, key, sequence, id: message.id,
        attempts: message.attempts, environment: environment.PROOF_ENVIRONMENT,
        queue: batch.queue,
        consumerMarker: environment.CONSUMER_MARKER === "synthetic-consumer",
        httpMarker: environment.HTTP_MARKER === "synthetic-http",
      }));
      if (message.body.environment !== environment.PROOF_ENVIRONMENT) {
        report("wrong-environment");
        message.ack();
        continue;
      }
      if (batch.queue.endsWith("-dead")) {
        report("dead-letter");
        message.ack();
        continue;
      }
      report("attempt");
      if (action === "poison" || (action === "throw-once" && message.attempts === 1)) {
        throw new Error("SYNTHETIC_QUEUE_FAILURE");
      }
      if (action === "retry-once" && message.attempts === 1) {
        message.retry({ delaySeconds: 0 });
        continue;
      }
      if (action !== "return") message.ack();
      report("complete");
    }
  },
};

export default consumer;
