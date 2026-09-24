import { readFile } from "node:fs/promises";

// Read-only admission of the repository configuration. It cannot verify the
// account, remote queue identities, provisioning, retention or deployed state.
try {
  const environment = process.argv[2];
  if (!["local", "staging", "production"].includes(environment) || process.argv.length !== 3) throw new Error();
  const root = JSON.parse(await readFile("wrangler.jsonc", "utf8"));
  if (root.main !== "worker.mjs") throw new Error();
  const names = new Set();
  for (const name of ["local", "staging", "production"]) {
    const config = name === "local" ? root : root.env?.[name];
    if (!config || config.vars?.JOB_ENVIRONMENT !== name) throw new Error();
    const queue = config.vars.JOB_QUEUE_NAME;
    const dead = config.vars.JOB_DEAD_LETTER_QUEUE_NAME;
    for (const identity of [queue, dead]) {
      if (typeof identity !== "string" || !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/u.test(identity) || names.has(identity)) throw new Error();
      names.add(identity);
    }
    const producers = config.queues?.producers;
    const consumers = config.queues?.consumers;
    if (!Array.isArray(producers) || producers.length !== 2 || !Array.isArray(consumers) || consumers.length !== 1) throw new Error();
    if (producers.find((item) => item.binding === "JOB_QUEUE")?.queue !== queue ||
        producers.find((item) => item.binding === "JOB_DEAD_LETTER_QUEUE")?.queue !== dead) throw new Error();
    const consumer = consumers[0];
    if (consumer.queue !== queue || consumer.dead_letter_queue !== dead || consumer.max_retries !== 3 ||
        consumer.max_batch_size !== 10 || consumer.max_batch_timeout !== 5 || consumer.retry_delay !== 5) throw new Error();
  }
  // This attests to an operator's review of both selected queues' fixed
  // 24-hour retention and inspection ownership. It is not provider readback.
  if (environment !== "local" && process.env.JOB_RETENTION_REVIEWED !== "true") throw new Error();
  process.stdout.write("JOB_CONFIGURATION_VALID\n");
} catch {
  process.stderr.write("JOB_CONFIGURATION_INVALID\n");
  process.exitCode = 1;
}
