import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

function isDirectInvocation(moduleUrl, arguments_) {
  return (
    arguments_[1] !== undefined &&
    pathToFileURL(resolve(arguments_[1])).href === moduleUrl
  );
}

export async function runCertificationCli(configuration, runtime = process) {
  if (!isDirectInvocation(configuration.moduleUrl, runtime.argv)) {
    return;
  }

  const input = await configuration.parseArguments(runtime.argv.slice(2));
  if (input === undefined) {
    runtime.stderr.write(
      `${JSON.stringify({
        ok: false,
        code: "CERTIFICATION_ARGUMENT_INVALID",
      })}\n`,
    );
    runtime.exitCode = 2;
    return;
  }

  try {
    const result = await configuration.certify(input);
    runtime.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error) {
    runtime.stderr.write(
      `${JSON.stringify({
        ok: false,
        code: configuration.isCertificationError(error)
          ? error.code
          : "CERTIFICATION_FAILED",
      })}\n`,
    );
    runtime.exitCode = 1;
  }
}
