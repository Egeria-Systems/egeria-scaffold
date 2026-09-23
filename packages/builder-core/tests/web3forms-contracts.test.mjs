import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import * as core from "../dist/index.js";
import { retainedRenderingContext } from "./retained-generation.mjs";

const settings = { accessKey: "00000000-0000-4000-8000-000000000001" };
const packageVersions = { standards: "0.1.0", observability: "0.3.0" };
const request = profile => ({ profile, projectName: "contact-contract", displayName: "Contact Contract", packageVersions });

test("contact settings accept only an exact public identifier", () => {
  assert.ok(core.web3FormsContactSettingsSchema, "contact settings schema must exist");
  for (const value of [settings, {accessKey: "ABCDEFAB-1234-4321-ABCD-0123456789AB"}])
    assert.equal(core.web3FormsContactSettingsSchema.safeParse(value).success, true);
  for (const value of [undefined, {}, { ...settings, accessKey: " private-value " },
    { ...settings, accessKey: ` ${settings.accessKey}` }, { ...settings, accessKey: `${settings.accessKey}\n` },
    { ...settings, endpoint: "https://example.invalid" }, { ...settings, accessKey: 1 }])
    assert.equal(core.web3FormsContactSettingsSchema.safeParse(value).success, false);
});

test("contact selection is strict, profile-independent and adds only its declared browser surfaces", async () => {
  for (const profile of ["portfolio", "site", "app"]) {
    const result = await core.renderSkeleton({ ...request(profile), contactFormWeb3Forms: settings });
    assert.equal(result.ok, true, JSON.stringify(result.issues));
    assert.deepEqual(result.value.project.capabilitySettings["contact-form-web3forms"], settings);
    const capability = result.value.resolved.capabilities.find(c => c.identifier === "contact-form-web3forms");
    assert.ok(capability, "selected contact capability must resolve");
    assert.deepEqual(capability.dependencies, ["content-files", "section-composition"]);
    assert.equal(capability.removalPolicy, "reviewed");
    assert.equal(result.value.resolved.capabilities.some(c => c.identifier === "transactional-email-resend"), false);
    assert.equal(result.value.resolved.capabilities.some(c => c.identifier === "app-foundation"), profile === "app");
    assert.equal(result.value.files.filter(f => f.path === "apps/web/app/layout.tsx").length, 1);
    for (const path of ["contact-settings.ts", "contact-form.tsx", "submit-contact.ts", "hcaptcha.tsx", "contact-form-placement.tsx"])
      assert.ok(result.value.files.some(f => f.path === `apps/web/src/integrations/contact-form-web3forms/${path}`));
    assert.equal(result.value.files.some(f => /app\/api\/.*contact/.test(f.path)), false);
    const { project } = result.value;
    assert.equal(core.projectConfigurationSchema.safeParse({ ...project, capabilitySettings: {} }).success, false);
    assert.equal(core.projectConfigurationSchema.safeParse({ ...project, selectedCapabilities: project.selectedCapabilities.filter(c => c !== capability.identifier) }).success, false);
  }
});

test("contact generation refuses retained recipes and malformed settings", async () => {
  for (const profile of ["portfolio", "site"]) {
    const result = await core.renderSkeleton({ ...request(profile), contactFormWeb3Forms: settings }, retainedRenderingContext);
    assert.equal(result.ok, false, "retained generation must refuse new contact selection");
  }
  const result = await core.renderSkeleton({ ...request("portfolio"), contactFormWeb3Forms: { accessKey: "private-value" } });
  assert.equal(result.ok, false);
  assert.doesNotMatch(JSON.stringify(result.issues), /private-value/);
});

test("absent contact selection preserves the existing portfolio source", async () => {
  const result = await core.renderSkeleton({ ...request("portfolio"), projectName: "acme-portfolio", displayName: "Acme Portfolio" });
  assert.equal(result.ok, true);
  assert.equal(result.value.files.some(f => f.path.includes("web3forms")), false);
  for (const path of ["apps/web/app/layout.tsx", "apps/web/app/page.tsx"])
    assert.deepEqual(Buffer.from(result.value.files.find(f => f.path === path).content), await readFile(new URL(`../../../fixtures/generated/portfolio/${path}`, import.meta.url)));
});
