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

test("upgrade writer refuses a changed existing ancestor before creating a missing parent", async (context) => {
  const root = await createTemporaryRoot(
    context,
    "egeria-upgrade-missing-parent-race-",
  );
  const outside = await createTemporaryRoot(
    context,
    "egeria-upgrade-missing-parent-outside-",
  );
  const application = join(root, "apps", "web", "app");
  const movedApplication = join(root, "apps", "web", "app-original");
  await mkdir(application, { recursive: true });
  const writer = createFileSystemCapabilityUpgradeWriter(root, {
    beforeParentCreation: async (path) => {
      assert.equal(path, "apps/web/app/about/page.tsx");
      await rename(application, movedApplication);
      await symlink(outside, application);
    },
  });

  assert.deepEqual(
    await writer.write([
      creation("apps/web/app/about/page.tsx", encoder.encode("page\n")),
    ]),
    { ok: false, sourceChanged: false },
  );
  await assertMissing(join(outside, "about"));
  await assertMissing(join(movedApplication, "about"));
});
