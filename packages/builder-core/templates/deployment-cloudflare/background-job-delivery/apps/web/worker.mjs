import openNext from "./.open-next/worker.js";
import { consumeServerJobs } from "./src/composition/server-jobs.ts";

export * from "./.open-next/worker.js";
const worker = { ...openNext, queue: consumeServerJobs };
export default worker;
