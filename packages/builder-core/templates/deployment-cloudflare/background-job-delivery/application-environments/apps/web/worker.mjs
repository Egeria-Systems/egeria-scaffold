import openNext from "./.open-next/worker.js";
import buildIdentity from "./.open-next/assets/BUILD_ID";
import { parseApplicationBuildId } from "./src/configuration/application-build.ts";
import { consumeServerJobs } from "./src/composition/server-jobs.ts";

export * from "./.open-next/worker.js";
const worker = {
  ...openNext,
  queue(batch, environment) {
    const identity = parseApplicationBuildId(buildIdentity);
    if (!identity.ok) throw new Error("JOB_CONFIGURATION_INVALID");
    return consumeServerJobs(batch, environment, identity.value.target);
  },
};
export default worker;
