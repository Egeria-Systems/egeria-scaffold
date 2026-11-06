import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const repositoryRoot = resolve(import.meta.dirname, "../..");
const privateRoots = Object.freeze([
  "docs/implementation-evidence/",
  "docs/review-packets/",
  "docs/superpowers/",
]);
const trackedAcceptedArtifacts = Object.freeze([
  "docs/implementation-evidence/2026-08-16-observability-error-diagnostics-certification-receipt.md",
  "docs/implementation-evidence/2026-08-18-generated-cloudflare-deployment-certification-receipt.md",
  "docs/implementation-evidence/2026-08-20-generated-visual-regression-certification-receipt.md",
  "docs/implementation-evidence/2026-08-25-content-files-certification-receipt.md",
  "docs/implementation-evidence/2026-08-25-profile-transition-lifecycle-certification-receipt.md",
  "docs/implementation-evidence/2026-08-25-standards-lifecycle-certification-receipt.md",
  "docs/implementation-evidence/2026-08-26-production-site-routing-certification-receipt.md",
  "docs/implementation-evidence/2026-08-26-section-composition-certification-receipt.md",
  "docs/implementation-evidence/2026-08-26-site-routing-certification-receipt.md",
  "docs/implementation-evidence/2026-08-27-multilingual-certification-receipt.md",
  "docs/implementation-evidence/2026-08-28-analytics-capability-certification-receipt.md",
  "docs/implementation-evidence/2026-09-13-app-foundation-app-certification-receipt.md",
  "docs/implementation-evidence/2026-09-13-content-files-app-certification-receipt.md",
  "docs/implementation-evidence/2026-09-13-multilingual-app-certification-receipt.md",
  "docs/implementation-evidence/2026-09-13-section-composition-app-certification-receipt.md",
  "docs/implementation-evidence/2026-09-13-site-routing-app-certification-receipt.md",
  "docs/implementation-evidence/2026-09-13-standards-app-certification-receipt.md",
  "docs/implementation-evidence/2026-09-15-deployment-cloudflare-app-certification-receipt.md",
  "docs/implementation-evidence/2026-09-15-observability-app-certification-receipt.md",
  "docs/implementation-evidence/2026-09-23-web3forms-certification-receipt.md",
  "docs/implementation-evidence/retired-recipe-visuals/app-0.2.1/apps/web/tests/visual/home-visual.spec.ts-snapshots/home-desktop-chromium-linux.png",
  "docs/implementation-evidence/retired-recipe-visuals/app-0.2.1/apps/web/tests/visual/home-visual.spec.ts-snapshots/home-mobile-chromium-linux.png",
  "docs/implementation-evidence/retired-recipe-visuals/app-0.2.2/apps/web/tests/visual/home-visual.spec.ts-snapshots/home-desktop-chromium-linux.png",
  "docs/implementation-evidence/retired-recipe-visuals/app-0.2.2/apps/web/tests/visual/home-visual.spec.ts-snapshots/home-mobile-chromium-linux.png",
  "docs/implementation-evidence/retired-recipe-visuals/app-0.2.3/apps/web/tests/visual/home-visual.spec.ts-snapshots/home-desktop-chromium-linux.png",
  "docs/implementation-evidence/retired-recipe-visuals/app-0.2.3/apps/web/tests/visual/home-visual.spec.ts-snapshots/home-mobile-chromium-linux.png",
  "docs/implementation-evidence/retired-recipe-visuals/app-0.2.4/apps/web/tests/visual/home-visual.spec.ts-snapshots/home-desktop-chromium-linux.png",
  "docs/implementation-evidence/retired-recipe-visuals/app-0.2.4/apps/web/tests/visual/home-visual.spec.ts-snapshots/home-mobile-chromium-linux.png",
  "docs/implementation-evidence/retired-recipe-visuals/app-all-optional-integrations-0.2.1/apps/web/tests/visual/home-visual.spec.ts-snapshots/home-desktop-chromium-linux.png",
  "docs/implementation-evidence/retired-recipe-visuals/app-all-optional-integrations-0.2.1/apps/web/tests/visual/home-visual.spec.ts-snapshots/home-mobile-chromium-linux.png",
  "docs/implementation-evidence/retired-recipe-visuals/app-all-optional-integrations-0.2.2/apps/web/tests/visual/home-visual.spec.ts-snapshots/home-desktop-chromium-linux.png",
  "docs/implementation-evidence/retired-recipe-visuals/app-all-optional-integrations-0.2.2/apps/web/tests/visual/home-visual.spec.ts-snapshots/home-mobile-chromium-linux.png",
  "docs/implementation-evidence/retired-recipe-visuals/app-all-optional-integrations-0.2.3/apps/web/tests/visual/home-visual.spec.ts-snapshots/home-desktop-chromium-linux.png",
  "docs/implementation-evidence/retired-recipe-visuals/app-all-optional-integrations-0.2.3/apps/web/tests/visual/home-visual.spec.ts-snapshots/home-mobile-chromium-linux.png",
  "docs/implementation-evidence/retired-recipe-visuals/app-all-optional-integrations-0.2.4/apps/web/tests/visual/home-visual.spec.ts-snapshots/home-desktop-chromium-linux.png",
  "docs/implementation-evidence/retired-recipe-visuals/app-all-optional-integrations-0.2.4/apps/web/tests/visual/home-visual.spec.ts-snapshots/home-mobile-chromium-linux.png",
  "docs/implementation-evidence/retired-recipe-visuals/app-all-optional-integrations/apps/web/tests/visual/home-visual.spec.ts-snapshots/home-desktop-chromium-linux.png",
  "docs/implementation-evidence/retired-recipe-visuals/app-all-optional-integrations/apps/web/tests/visual/home-visual.spec.ts-snapshots/home-mobile-chromium-linux.png",
  "docs/implementation-evidence/retired-recipe-visuals/app-persistence-0.2.1/apps/web/tests/visual/home-visual.spec.ts-snapshots/home-desktop-chromium-linux.png",
  "docs/implementation-evidence/retired-recipe-visuals/app-persistence-0.2.1/apps/web/tests/visual/home-visual.spec.ts-snapshots/home-mobile-chromium-linux.png",
  "docs/implementation-evidence/retired-recipe-visuals/app-persistence-0.2.2/apps/web/tests/visual/home-visual.spec.ts-snapshots/home-desktop-chromium-linux.png",
  "docs/implementation-evidence/retired-recipe-visuals/app-persistence-0.2.2/apps/web/tests/visual/home-visual.spec.ts-snapshots/home-mobile-chromium-linux.png",
  "docs/implementation-evidence/retired-recipe-visuals/app-persistence-0.2.3/apps/web/tests/visual/home-visual.spec.ts-snapshots/home-desktop-chromium-linux.png",
  "docs/implementation-evidence/retired-recipe-visuals/app-persistence-0.2.3/apps/web/tests/visual/home-visual.spec.ts-snapshots/home-mobile-chromium-linux.png",
  "docs/implementation-evidence/retired-recipe-visuals/app-persistence-0.2.4/apps/web/tests/visual/home-visual.spec.ts-snapshots/home-desktop-chromium-linux.png",
  "docs/implementation-evidence/retired-recipe-visuals/app-persistence-0.2.4/apps/web/tests/visual/home-visual.spec.ts-snapshots/home-mobile-chromium-linux.png",
  "docs/implementation-evidence/retired-recipe-visuals/app-persistence-email-0.2.1/apps/web/tests/visual/home-visual.spec.ts-snapshots/home-desktop-chromium-linux.png",
  "docs/implementation-evidence/retired-recipe-visuals/app-persistence-email-0.2.1/apps/web/tests/visual/home-visual.spec.ts-snapshots/home-mobile-chromium-linux.png",
  "docs/implementation-evidence/retired-recipe-visuals/app-persistence-email-0.2.2/apps/web/tests/visual/home-visual.spec.ts-snapshots/home-desktop-chromium-linux.png",
  "docs/implementation-evidence/retired-recipe-visuals/app-persistence-email-0.2.2/apps/web/tests/visual/home-visual.spec.ts-snapshots/home-mobile-chromium-linux.png",
  "docs/implementation-evidence/retired-recipe-visuals/app-persistence-email-0.2.3/apps/web/tests/visual/home-visual.spec.ts-snapshots/home-desktop-chromium-linux.png",
  "docs/implementation-evidence/retired-recipe-visuals/app-persistence-email-0.2.3/apps/web/tests/visual/home-visual.spec.ts-snapshots/home-mobile-chromium-linux.png",
  "docs/implementation-evidence/retired-recipe-visuals/app-persistence-email-0.2.4/apps/web/tests/visual/home-visual.spec.ts-snapshots/home-desktop-chromium-linux.png",
  "docs/implementation-evidence/retired-recipe-visuals/app-persistence-email-0.2.4/apps/web/tests/visual/home-visual.spec.ts-snapshots/home-mobile-chromium-linux.png",
  "docs/implementation-evidence/retired-recipe-visuals/app-persistence-email/apps/web/tests/visual/home-visual.spec.ts-snapshots/home-desktop-chromium-linux.png",
  "docs/implementation-evidence/retired-recipe-visuals/app-persistence-email/apps/web/tests/visual/home-visual.spec.ts-snapshots/home-mobile-chromium-linux.png",
  "docs/implementation-evidence/retired-recipe-visuals/app-persistence/apps/web/tests/visual/home-visual.spec.ts-snapshots/home-desktop-chromium-linux.png",
  "docs/implementation-evidence/retired-recipe-visuals/app-persistence/apps/web/tests/visual/home-visual.spec.ts-snapshots/home-mobile-chromium-linux.png",
  "docs/implementation-evidence/retired-recipe-visuals/app/apps/web/tests/visual/home-visual.spec.ts-snapshots/home-desktop-chromium-linux.png",
  "docs/implementation-evidence/retired-recipe-visuals/app/apps/web/tests/visual/home-visual.spec.ts-snapshots/home-mobile-chromium-linux.png",
  "docs/implementation-evidence/retired-recipe-visuals/portfolio-0.11.1/apps/web/tests/visual/home-visual.spec.ts-snapshots/home-desktop-chromium-linux.png",
  "docs/implementation-evidence/retired-recipe-visuals/portfolio-0.11.1/apps/web/tests/visual/home-visual.spec.ts-snapshots/home-mobile-chromium-linux.png",
  "docs/implementation-evidence/retired-recipe-visuals/portfolio-0.11.2/apps/web/tests/visual/home-visual.spec.ts-snapshots/home-desktop-chromium-linux.png",
  "docs/implementation-evidence/retired-recipe-visuals/portfolio-0.11.2/apps/web/tests/visual/home-visual.spec.ts-snapshots/home-mobile-chromium-linux.png",
  "docs/implementation-evidence/retired-recipe-visuals/portfolio-0.11.3/apps/web/tests/visual/home-visual.spec.ts-snapshots/home-desktop-chromium-linux.png",
  "docs/implementation-evidence/retired-recipe-visuals/portfolio-0.11.3/apps/web/tests/visual/home-visual.spec.ts-snapshots/home-mobile-chromium-linux.png",
  "docs/implementation-evidence/retired-recipe-visuals/portfolio-0.11.3/transition-inputs.json",
  "docs/implementation-evidence/retired-recipe-visuals/portfolio-0.11.4/apps/web/tests/visual/home-visual.spec.ts-snapshots/home-desktop-chromium-linux.png",
  "docs/implementation-evidence/retired-recipe-visuals/portfolio-0.11.4/apps/web/tests/visual/home-visual.spec.ts-snapshots/home-mobile-chromium-linux.png",
  "docs/implementation-evidence/retired-recipe-visuals/portfolio-calendly-0.11.1/apps/web/tests/visual/home-visual.spec.ts-snapshots/home-desktop-chromium-linux.png",
  "docs/implementation-evidence/retired-recipe-visuals/portfolio-calendly-0.11.1/apps/web/tests/visual/home-visual.spec.ts-snapshots/home-mobile-chromium-linux.png",
  "docs/implementation-evidence/retired-recipe-visuals/portfolio-calendly-0.11.2/apps/web/tests/visual/home-visual.spec.ts-snapshots/home-desktop-chromium-linux.png",
  "docs/implementation-evidence/retired-recipe-visuals/portfolio-calendly-0.11.2/apps/web/tests/visual/home-visual.spec.ts-snapshots/home-mobile-chromium-linux.png",
  "docs/implementation-evidence/retired-recipe-visuals/portfolio-calendly-0.11.3/apps/web/tests/visual/home-visual.spec.ts-snapshots/home-desktop-chromium-linux.png",
  "docs/implementation-evidence/retired-recipe-visuals/portfolio-calendly-0.11.3/apps/web/tests/visual/home-visual.spec.ts-snapshots/home-mobile-chromium-linux.png",
  "docs/implementation-evidence/retired-recipe-visuals/portfolio-calendly-0.11.4/apps/web/tests/visual/home-visual.spec.ts-snapshots/home-desktop-chromium-linux.png",
  "docs/implementation-evidence/retired-recipe-visuals/portfolio-calendly-0.11.4/apps/web/tests/visual/home-visual.spec.ts-snapshots/home-mobile-chromium-linux.png",
  "docs/implementation-evidence/retired-recipe-visuals/portfolio-calendly/apps/web/tests/visual/home-visual.spec.ts-snapshots/home-desktop-chromium-linux.png",
  "docs/implementation-evidence/retired-recipe-visuals/portfolio-calendly/apps/web/tests/visual/home-visual.spec.ts-snapshots/home-mobile-chromium-linux.png",
  "docs/implementation-evidence/retired-recipe-visuals/portfolio-email-0.11.1/apps/web/tests/visual/home-visual.spec.ts-snapshots/home-desktop-chromium-linux.png",
  "docs/implementation-evidence/retired-recipe-visuals/portfolio-email-0.11.1/apps/web/tests/visual/home-visual.spec.ts-snapshots/home-mobile-chromium-linux.png",
  "docs/implementation-evidence/retired-recipe-visuals/portfolio-email-0.11.2/apps/web/tests/visual/home-visual.spec.ts-snapshots/home-desktop-chromium-linux.png",
  "docs/implementation-evidence/retired-recipe-visuals/portfolio-email-0.11.2/apps/web/tests/visual/home-visual.spec.ts-snapshots/home-mobile-chromium-linux.png",
  "docs/implementation-evidence/retired-recipe-visuals/portfolio-email-0.11.3/apps/web/tests/visual/home-visual.spec.ts-snapshots/home-desktop-chromium-linux.png",
  "docs/implementation-evidence/retired-recipe-visuals/portfolio-email-0.11.3/apps/web/tests/visual/home-visual.spec.ts-snapshots/home-mobile-chromium-linux.png",
  "docs/implementation-evidence/retired-recipe-visuals/portfolio-email-0.11.4/apps/web/tests/visual/home-visual.spec.ts-snapshots/home-desktop-chromium-linux.png",
  "docs/implementation-evidence/retired-recipe-visuals/portfolio-email-0.11.4/apps/web/tests/visual/home-visual.spec.ts-snapshots/home-mobile-chromium-linux.png",
  "docs/implementation-evidence/retired-recipe-visuals/portfolio-email/apps/web/tests/visual/home-visual.spec.ts-snapshots/home-desktop-chromium-linux.png",
  "docs/implementation-evidence/retired-recipe-visuals/portfolio-email/apps/web/tests/visual/home-visual.spec.ts-snapshots/home-mobile-chromium-linux.png",
  "docs/implementation-evidence/retired-recipe-visuals/portfolio/apps/web/tests/visual/home-visual.spec.ts-snapshots/home-desktop-chromium-linux.png",
  "docs/implementation-evidence/retired-recipe-visuals/portfolio/apps/web/tests/visual/home-visual.spec.ts-snapshots/home-mobile-chromium-linux.png",
  "docs/implementation-evidence/retired-recipe-visuals/public-generation-retirement.json",
  "docs/implementation-evidence/retired-recipe-visuals/site-0.12.1/apps/web/tests/visual/home-visual.spec.ts-snapshots/home-desktop-chromium-linux.png",
  "docs/implementation-evidence/retired-recipe-visuals/site-0.12.1/apps/web/tests/visual/home-visual.spec.ts-snapshots/home-mobile-chromium-linux.png",
  "docs/implementation-evidence/retired-recipe-visuals/site-0.12.2/apps/web/tests/visual/home-visual.spec.ts-snapshots/home-desktop-chromium-linux.png",
  "docs/implementation-evidence/retired-recipe-visuals/site-0.12.2/apps/web/tests/visual/home-visual.spec.ts-snapshots/home-mobile-chromium-linux.png",
  "docs/implementation-evidence/retired-recipe-visuals/site-0.12.3/apps/web/tests/visual/home-visual.spec.ts-snapshots/home-desktop-chromium-linux.png",
  "docs/implementation-evidence/retired-recipe-visuals/site-0.12.3/apps/web/tests/visual/home-visual.spec.ts-snapshots/home-mobile-chromium-linux.png",
  "docs/implementation-evidence/retired-recipe-visuals/site-0.12.4/apps/web/tests/visual/home-visual.spec.ts-snapshots/home-desktop-chromium-linux.png",
  "docs/implementation-evidence/retired-recipe-visuals/site-0.12.4/apps/web/tests/visual/home-visual.spec.ts-snapshots/home-mobile-chromium-linux.png",
  "docs/implementation-evidence/retired-recipe-visuals/site-contact-form-0.12.1/apps/web/tests/visual/home-visual.spec.ts-snapshots/home-desktop-chromium-linux.png",
  "docs/implementation-evidence/retired-recipe-visuals/site-contact-form-0.12.1/apps/web/tests/visual/home-visual.spec.ts-snapshots/home-mobile-chromium-linux.png",
  "docs/implementation-evidence/retired-recipe-visuals/site-contact-form-0.12.2/apps/web/tests/visual/home-visual.spec.ts-snapshots/home-desktop-chromium-linux.png",
  "docs/implementation-evidence/retired-recipe-visuals/site-contact-form-0.12.2/apps/web/tests/visual/home-visual.spec.ts-snapshots/home-mobile-chromium-linux.png",
  "docs/implementation-evidence/retired-recipe-visuals/site-contact-form-0.12.3/apps/web/tests/visual/home-visual.spec.ts-snapshots/home-desktop-chromium-linux.png",
  "docs/implementation-evidence/retired-recipe-visuals/site-contact-form-0.12.3/apps/web/tests/visual/home-visual.spec.ts-snapshots/home-mobile-chromium-linux.png",
  "docs/implementation-evidence/retired-recipe-visuals/site-contact-form-0.12.4/apps/web/tests/visual/home-visual.spec.ts-snapshots/home-desktop-chromium-linux.png",
  "docs/implementation-evidence/retired-recipe-visuals/site-contact-form-0.12.4/apps/web/tests/visual/home-visual.spec.ts-snapshots/home-mobile-chromium-linux.png",
  "docs/implementation-evidence/retired-recipe-visuals/site-contact-form/apps/web/tests/visual/home-visual.spec.ts-snapshots/home-desktop-chromium-linux.png",
  "docs/implementation-evidence/retired-recipe-visuals/site-contact-form/apps/web/tests/visual/home-visual.spec.ts-snapshots/home-mobile-chromium-linux.png",
  "docs/implementation-evidence/retired-recipe-visuals/site-multilingual-0.12.1/apps/web/tests/visual/home-visual.spec.ts-snapshots/home-desktop-chromium-linux.png",
  "docs/implementation-evidence/retired-recipe-visuals/site-multilingual-0.12.1/apps/web/tests/visual/home-visual.spec.ts-snapshots/home-mobile-chromium-linux.png",
  "docs/implementation-evidence/retired-recipe-visuals/site-multilingual-0.12.2/apps/web/tests/visual/home-visual.spec.ts-snapshots/home-desktop-chromium-linux.png",
  "docs/implementation-evidence/retired-recipe-visuals/site-multilingual-0.12.2/apps/web/tests/visual/home-visual.spec.ts-snapshots/home-mobile-chromium-linux.png",
  "docs/implementation-evidence/retired-recipe-visuals/site-multilingual-0.12.3/apps/web/tests/visual/home-visual.spec.ts-snapshots/home-desktop-chromium-linux.png",
  "docs/implementation-evidence/retired-recipe-visuals/site-multilingual-0.12.3/apps/web/tests/visual/home-visual.spec.ts-snapshots/home-mobile-chromium-linux.png",
  "docs/implementation-evidence/retired-recipe-visuals/site-multilingual-0.12.4/apps/web/tests/visual/home-visual.spec.ts-snapshots/home-desktop-chromium-linux.png",
  "docs/implementation-evidence/retired-recipe-visuals/site-multilingual-0.12.4/apps/web/tests/visual/home-visual.spec.ts-snapshots/home-mobile-chromium-linux.png",
  "docs/implementation-evidence/retired-recipe-visuals/site-multilingual-analytics-0.12.1/apps/web/tests/visual/home-visual.spec.ts-snapshots/home-desktop-chromium-linux.png",
  "docs/implementation-evidence/retired-recipe-visuals/site-multilingual-analytics-0.12.1/apps/web/tests/visual/home-visual.spec.ts-snapshots/home-mobile-chromium-linux.png",
  "docs/implementation-evidence/retired-recipe-visuals/site-multilingual-analytics-0.12.2/apps/web/tests/visual/home-visual.spec.ts-snapshots/home-desktop-chromium-linux.png",
  "docs/implementation-evidence/retired-recipe-visuals/site-multilingual-analytics-0.12.2/apps/web/tests/visual/home-visual.spec.ts-snapshots/home-mobile-chromium-linux.png",
  "docs/implementation-evidence/retired-recipe-visuals/site-multilingual-analytics-0.12.3/apps/web/tests/visual/home-visual.spec.ts-snapshots/home-desktop-chromium-linux.png",
  "docs/implementation-evidence/retired-recipe-visuals/site-multilingual-analytics-0.12.3/apps/web/tests/visual/home-visual.spec.ts-snapshots/home-mobile-chromium-linux.png",
  "docs/implementation-evidence/retired-recipe-visuals/site-multilingual-analytics-0.12.4/apps/web/tests/visual/home-visual.spec.ts-snapshots/home-desktop-chromium-linux.png",
  "docs/implementation-evidence/retired-recipe-visuals/site-multilingual-analytics-0.12.4/apps/web/tests/visual/home-visual.spec.ts-snapshots/home-mobile-chromium-linux.png",
  "docs/implementation-evidence/retired-recipe-visuals/site-multilingual-analytics/apps/web/tests/visual/home-visual.spec.ts-snapshots/home-desktop-chromium-linux.png",
  "docs/implementation-evidence/retired-recipe-visuals/site-multilingual-analytics/apps/web/tests/visual/home-visual.spec.ts-snapshots/home-mobile-chromium-linux.png",
  "docs/implementation-evidence/retired-recipe-visuals/site-multilingual/apps/web/tests/visual/home-visual.spec.ts-snapshots/home-desktop-chromium-linux.png",
  "docs/implementation-evidence/retired-recipe-visuals/site-multilingual/apps/web/tests/visual/home-visual.spec.ts-snapshots/home-mobile-chromium-linux.png",
  "docs/implementation-evidence/retired-recipe-visuals/site/apps/web/tests/visual/home-visual.spec.ts-snapshots/home-desktop-chromium-linux.png",
  "docs/implementation-evidence/retired-recipe-visuals/site/apps/web/tests/visual/home-visual.spec.ts-snapshots/home-mobile-chromium-linux.png",
  "docs/implementation-evidence/retired-recipe-visuals/transition-inputs.json",
]);
const syntheticMacHome = (...segments) =>
  ["", "Users", ...segments, ""].join("/");
const syntheticUnixHome = (root, ...segments) =>
  ["", root, ...segments].join("/");
const syntheticWindowsHome = (...segments) =>
  ["C:", "Users", ...segments].join("\\");
const allowedSyntheticHomePaths = new Map([
  [
    "packages/observability/tests/diagnostics.test.mjs",
    new Set([
      syntheticMacHome("alice"),
      syntheticMacHome("Alice Smith"),
      syntheticMacHome("Alice Smith (Admin)"),
    ]),
  ],
  [
    "packages/observability/tests/server.test.mjs",
    new Set([
      syntheticMacHome("Alice Smith"),
      syntheticMacHome("Alice Smith (Admin)"),
    ]),
  ],
]);
const userHomePatterns = Object.freeze([
  /\/Users\/[^/\0\r\n]+(?:\/|$)/gu,
  /\/home\/[^/\0\r\n]+(?:\/|$)/gu,
  /[A-Za-z]:\\Users\\[^\\\0\r\n]+(?:\\|$)/gu,
]);
const utf8Decoder = new TextDecoder("utf-8", { fatal: true });

async function listTrackedPaths() {
  const { stdout } = await execFileAsync("git", ["ls-files", "-z"], {
    cwd: repositoryRoot,
    encoding: "utf8",
  });
  return stdout.split("\0").filter(Boolean);
}

function detectPersonalHomePaths(source) {
  return userHomePatterns.flatMap((pattern) => {
    pattern.lastIndex = 0;
    return [...source.matchAll(pattern)].map((match) => match[0]);
  });
}

test("personal home-directory detection covers supported platform forms", () => {
  for (const path of [
    syntheticUnixHome("Users", "ron", "private"),
    syntheticUnixHome("Users", "alice"),
    syntheticUnixHome("home", "n0ra", "private"),
    syntheticUnixHome("home", "alice"),
    syntheticWindowsHome("r0n", "private"),
    syntheticWindowsHome("alice"),
  ]) {
    const matches = detectPersonalHomePaths(path);
    assert.equal(matches.length, 1, path);
    assert.equal(path.startsWith(matches[0]), true, path);
  }

  assert.deepEqual(detectPersonalHomePaths("docs/private-workflow.md"), []);
});

test("private workflow artifact roots keep only accepted content-safe artifacts tracked", async () => {
  const trackedPaths = await listTrackedPaths();

  for (const root of privateRoots) {
    await assert.doesNotReject(() =>
      execFileAsync(
        "git",
        ["check-ignore", "--quiet", "--no-index", `${root}privacy-probe.md`],
        { cwd: repositoryRoot },
      ),
    );
    const trackedWithinRoot = trackedPaths.filter(
      (path) => path === root.slice(0, -1) || path.startsWith(root),
    );
    assert.deepEqual(
      trackedWithinRoot,
      root === "docs/implementation-evidence/" ? trackedAcceptedArtifacts : [],
      root,
    );
  }

  for (const trackedAcceptedArtifact of trackedAcceptedArtifacts) {
    await assert.rejects(
      () =>
        execFileAsync(
          "git",
          ["check-ignore", "--quiet", "--no-index", trackedAcceptedArtifact],
          { cwd: repositoryRoot },
        ),
      (error) => Number(error.code) === 1,
    );
  }
});

test("tracked text excludes personal home-directory paths", async () => {
  const unexpectedMatches = [];

  for (const path of await listTrackedPaths()) {
    let bytes;
    try {
      bytes = await readFile(resolve(repositoryRoot, path));
    } catch (error) {
      if (error?.code === "ENOENT") continue;
      throw error;
    }
    if (bytes.includes(0)) {
      continue;
    }

    let source;
    try {
      source = utf8Decoder.decode(bytes);
    } catch {
      continue;
    }

    for (const match of detectPersonalHomePaths(source)) {
      if (allowedSyntheticHomePaths.get(path)?.has(match) === true) {
        continue;
      }
      unexpectedMatches.push(`${path}:personal-home-path`);
    }
  }

  assert.deepEqual([...new Set(unexpectedMatches)].sort(), []);
});
