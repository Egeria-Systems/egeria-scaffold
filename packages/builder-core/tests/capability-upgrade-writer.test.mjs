import { createFileSystemCapabilityUpgradeWriter } from "../dist/lifecycle/capability-upgrade-writer.js";
import { registerAtomicWriterConformanceTests } from "./atomic-writer-conformance.mjs";

registerAtomicWriterConformanceTests({
  createWriter: createFileSystemCapabilityUpgradeWriter,
  operationName: "upgrade",
  fixturePrefix: "upgrade",
  temporaryFilePrefix: ".egeria-upgrade-",
  writerModuleUrl: new URL(
    "../dist/lifecycle/capability-upgrade-writer.js",
    import.meta.url,
  ).href,
  writerExportName: "createFileSystemCapabilityUpgradeWriter",
});
