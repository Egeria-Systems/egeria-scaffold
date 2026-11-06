import { getCloudflareContext } from "@opennextjs/cloudflare";
import { Effect } from "effect";
import { TransactionalEmailFailure } from "@/src/application/transactional-email-sender";

export const transactionalEmailConfiguration: Effect.Effect<unknown, TransactionalEmailFailure> = Effect.tryPromise({
  try: async () => (await getCloudflareContext({ async: true })).env,
  catch: () => new TransactionalEmailFailure("transactional-email-configuration"),
});
