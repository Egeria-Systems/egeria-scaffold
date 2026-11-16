import { readCompiledApplicationEnvironment } from "@/src/configuration/application-environment";
import { transactionalEmailConfiguration } from "@/src/infrastructure/cloudflare/transactional-email-configuration";
import { reportTransactionalEmailEvent } from "@/src/infrastructure/observability/transactional-email-events";
import { createResendTransactionalEmailSenderLayer } from "@/src/infrastructure/resend/transactional-email-sender";

export const serverTransactionalEmailLayer = createResendTransactionalEmailSenderLayer({
  compiledTarget: readCompiledApplicationEnvironment,
  configuration: transactionalEmailConfiguration,
  request: (...arguments_) => fetch(...arguments_),
  reportEvent: reportTransactionalEmailEvent,
});
