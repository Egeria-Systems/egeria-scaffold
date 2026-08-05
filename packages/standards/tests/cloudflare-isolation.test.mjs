import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import test from "node:test";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const configPath = resolve(packageRoot, "eslint/cloudflare-isolation.mjs");
const eslintPackages = [
  ["ESLint 9", "eslint"],
  ["ESLint 10", "eslint-10"],
];

async function loadCloudflareIsolation() {
  try {
    await access(configPath);
  } catch {
    assert.fail(
      "eslint/cloudflare-isolation.mjs must be a public standards API",
    );
  }

  const standardsModule = await import(pathToFileURL(configPath));
  return standardsModule.cloudflareIsolation;
}

test("the Cloudflare isolation API preserves the proof boundary", async () => {
  const cloudflareIsolation = await loadCloudflareIsolation();

  assert.deepEqual(cloudflareIsolation, {
    name: "@egeria-systems/standards/cloudflare-isolation",
    files: ["app/**/*.{ts,tsx}", "src/**/*.{ts,tsx}"],
    ignores: ["src/infrastructure/cloudflare/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@opennextjs/cloudflare",
              message:
                "Cloudflare imports belong in the infrastructure adapter or configuration root.",
            },
          ],
          patterns: [
            {
              group: ["cloudflare:*"],
              message:
                "Cloudflare imports belong in the infrastructure adapter.",
            },
          ],
        },
      ],
    },
  });
});

for (const [eslintName, eslintPackage] of eslintPackages) {
  test(`${eslintName} rejects Cloudflare imports in protected code`, async () => {
    const cloudflareIsolation = await loadCloudflareIsolation();
    const { Linter } = await import(eslintPackage);
    const linter = new Linter({ configType: "flat" });

    const packageMessages = linter.verify(
      'import { getCloudflareContext } from "@opennextjs/cloudflare";\n',
      [cloudflareIsolation],
      { filename: "src/application/example.ts" },
    );
    const runtimeMessages = linter.verify(
      'import { env } from "cloudflare:workers";\n',
      [cloudflareIsolation],
      { filename: "src/domain/example.ts" },
    );

    assert.deepEqual(
      packageMessages.map(({ message, ruleId, severity }) => ({
        message,
        ruleId,
        severity,
      })),
      [
        {
          message:
            "'@opennextjs/cloudflare' import is restricted from being used. Cloudflare imports belong in the infrastructure adapter or configuration root.",
          ruleId: "no-restricted-imports",
          severity: 2,
        },
      ],
    );
    assert.deepEqual(
      runtimeMessages.map(({ message, ruleId, severity }) => ({
        message,
        ruleId,
        severity,
      })),
      [
        {
          message:
            "'cloudflare:workers' import is restricted from being used by a pattern. Cloudflare imports belong in the infrastructure adapter.",
          ruleId: "no-restricted-imports",
          severity: 2,
        },
      ],
    );
  });

  test(`${eslintName} permits provider-neutral imports`, async () => {
    const cloudflareIsolation = await loadCloudflareIsolation();
    const { Linter } = await import(eslintPackage);
    const linter = new Linter({ configType: "flat" });

    assert.deepEqual(
      linter.verify(
        'import { requestContext } from "../ports/request-context.js";\n',
        [cloudflareIsolation],
        { filename: "src/application/example.ts" },
      ),
      [],
    );
  });
}
