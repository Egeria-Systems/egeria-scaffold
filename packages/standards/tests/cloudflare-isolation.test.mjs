import assert from "node:assert/strict";
import test from "node:test";

import { cloudflareIsolation } from "../eslint/cloudflare-isolation.mjs";

const eslintPackages = [
  ["ESLint 9", "eslint"],
  ["ESLint 10", "eslint-10"],
];

test("the Cloudflare isolation API preserves the proof boundary", () => {
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
            {
              regex:
                "^\\.\\./(?:\\.\\./)*infrastructure/cloudflare(?:/|$)",
              message:
                "Cloudflare adapter imports belong in a composition root.",
            },
          ],
        },
      ],
    },
  });
});

for (const [eslintName, eslintPackage] of eslintPackages) {
  test(`${eslintName} rejects Cloudflare imports in protected code`, async () => {
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
    const adapterMessages = linter.verify(
      'import { readCompatibilityRuntime } from "../infrastructure/cloudflare/read-compatibility-runtime.js";\n',
      [cloudflareIsolation],
      { filename: "src/application/example.ts" },
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
    assert.deepEqual(
      adapterMessages.map(({ message, ruleId, severity }) => ({
        message,
        ruleId,
        severity,
      })),
      [
        {
          message:
            "'../infrastructure/cloudflare/read-compatibility-runtime.js' import is restricted from being used by a pattern. Cloudflare adapter imports belong in a composition root.",
          ruleId: "no-restricted-imports",
          severity: 2,
        },
      ],
    );
  });

  test(`${eslintName} permits provider-neutral imports`, async () => {
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

  test(`${eslintName} permits Cloudflare adapter imports in a composition root`, async () => {
    const { Linter } = await import(eslintPackage);
    const linter = new Linter({ configType: "flat" });

    assert.deepEqual(
      linter.verify(
        'import { readCompatibilityRuntime } from "../../../src/infrastructure/cloudflare/read-compatibility-runtime";\n',
        [cloudflareIsolation],
        { filename: "app/api/compatibility/route.ts" },
      ),
      [],
    );
  });
}
