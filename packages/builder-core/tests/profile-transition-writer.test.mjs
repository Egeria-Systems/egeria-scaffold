import assert from "node:assert/strict";
import { mkdir, rename, symlink } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

import { createFileSystemProfileTransitionWriter } from "../dist/lifecycle/profile-transition-writer.js";
import {
  assertMissing,
  createTemporaryRoot,
  creation,
  encoder,
  registerAtomicWriterConformanceTests,
} from "./atomic-writer-conformance.mjs";

registerAtomicWriterConformanceTests({
  createWriter: createFileSystemProfileTransitionWriter,
  operationName: "profile-transition",
  fixturePrefix: "profile-transition",
  temporaryFilePrefix: ".egeria-profile-transition-",
  writerModuleUrl: new URL(
    "../dist/lifecycle/profile-transition-writer.js",
    import.meta.url,
  ).href,
  writerExportName: "createFileSystemProfileTransitionWriter",
});

test("profile-transition writer refuses a changed existing ancestor before creating a missing parent", async (context) => {
  const root = await createTemporaryRoot(
    context,
    "egeria-profile-transition-missing-parent-race-",
  );
  const outside = await createTemporaryRoot(
    context,
    "egeria-profile-transition-missing-parent-outside-",
  );
  const application = join(root, "apps", "web", "app");
  const movedApplication = join(root, "apps", "web", "app-original");
  await mkdir(application, { recursive: true });
  const writer = createFileSystemProfileTransitionWriter(root, {
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
