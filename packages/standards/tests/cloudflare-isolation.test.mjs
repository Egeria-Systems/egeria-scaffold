import assert from "node:assert/strict";
import test from "node:test";

import typescriptEslint from "typescript-eslint";

import * as isolation from "../eslint/cloudflare-isolation.mjs";

const { cloudflareIsolation } = isolation;

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

test("the complete Cloudflare policy is available as a separate flat config array", () => {
  assert.ok(Array.isArray(isolation.cloudflareIsolationConfigs));
});

const adapterAlias = "@/src/infrastructure/cloudflare/example";
const adapterRelative = "../infrastructure/cloudflare/example";
const adapterFromRootChild = "../src/infrastructure/cloudflare/example";
const adapterFromAppRoute = "../../../src/infrastructure/cloudflare/example";
const openNext = "@opennextjs/cloudflare";
const workersRuntime = "cloudflare:workers";
const workerTypes = "@cloudflare/workers-types";
const namedImport = 'import { example } from "SOURCE";';
const typeImport = 'import type { Example } from "SOURCE";';
const starExport = 'export * from "SOURCE";';

const staticStatements = [
  namedImport,
  'import "SOURCE";',
  typeImport,
  'export { example } from "SOURCE";',
  starExport,
  'export type { Example } from "SOURCE";',
];

const adapterCases = [
  ["src/application/nested/example.ts", "../../infrastructure/cloudflare/example", false],
  ["src/example.ts", "./infrastructure/cloudflare/example", false],
  ["src/domain/example.ts", adapterAlias, false],
  ["src/presentation/example.tsx", adapterRelative, false],
  ["src/content/example.ts", "@/src/infrastructure/cloudflare", false],
  ["src/infrastructure/observability/server-reporter.ts", "../cloudflare/observability-context", false],
  ["src/infrastructure/example.ts", "./cloudflare/observability-context", false],
  ["src/infrastructure/observability/transactional-email-events.ts", adapterAlias, false],
  ["app/page.tsx", adapterFromRootChild, false],
  ["app/api/another/route.ts", adapterFromAppRoute, false],
  ["tests/unit/example.ts", "../../src/infrastructure/cloudflare/example", false],
  ["tests/component/example.tsx", adapterAlias, false],
  ["tests/contract/example.ts", adapterAlias, false],
  ["tests/integration/ordinary.test.ts", adapterAlias, false],
  ["vitest.config.ts", "./src/infrastructure/cloudflare/example", false],
  ["src/composition-extra/example.ts", adapterAlias, false],
  ["src/infrastructure/cloudflare-extra/example.ts", adapterAlias, false],
  ["src/infrastructure/cloudflare/example.ts", "../cloudflare/example", true],
  ["app/api/health/route.ts", adapterAlias, true],
  ["app/api/health/route.ts", adapterFromAppRoute, true],
  ["app/api/compatibility/route.ts", adapterAlias, true],
  ["app/api/compatibility/route.ts", "../../../src/infrastructure/cloudflare/read-compatibility-runtime", true],
  ["tests/integration/fixtures/job-worker.mjs", "../../../src/infrastructure/cloudflare/job-delivery.ts", true],
  ["tests/integration/cloudflare/example.ts", adapterAlias, true],
  ["tests/bindings/application-persistence.test.ts", adapterAlias, true],
  ["src/application/example.ts", "../ports/request-context.js", true],
  ["src/application/example.ts", "../cloudflare/example", true],
  ["src/application/example.ts", "@/src/infrastructure/cloudflare-extra/example", true],
  ["src/application/example.ts", "@/src/content/infrastructure/cloudflare/example", true],
];

const providerCases = [
  ["src/domain/example.ts", workersRuntime, false],
  ["src/application/example.ts", openNext, false],
  ["src/infrastructure/observability/server-reporter.ts", openNext, false],
  ["src/composition/example.ts", openNext, false],
  ["app/api/health/route.ts", workersRuntime, false],
  ["app/api/compatibility/route.ts", openNext, false],
  ["another.config.ts", openNext, false],
  ["tests/unit/example.ts", workerTypes, false, typeImport],
  ["tests/component/example.tsx", openNext, false],
  ["tests/contract/example.ts", "@opennextjs/cloudflare/helpers", false],
  ["tests/integration/ordinary.test.ts", "wrangler", false],
  ["tests/integration/cloudflare-extra/example.ts", workersRuntime, false],
  ["src/infrastructure/cloudflare/example.ts", workersRuntime, true],
  ["next.config.ts", openNext, true],
  ["open-next.config.ts", openNext, true],
  ["worker.mjs", workersRuntime, true],
  ["tests/integration/cloudflare.test.ts", "wrangler", true],
  ["tests/integration/queue-topology.test.ts", "wrangler", true],
  ["tests/integration/health-worker.test.ts", "wrangler", true],
  ["tests/integration/job-worker.test.ts", "wrangler", true],
  ["tests/integration/cloudflare/example.ts", workersRuntime, true],
  ["tests/bindings/application-persistence.test.ts", workerTypes, true, typeImport],
  ["tests/bindings/fixtures/worker.ts", workerTypes, true, typeImport],
  ["tests/bindings/ordinary.test.ts", workerTypes, false, typeImport],
  ["tests/integration/ordinary.test.ts", "wrangler-tools", true],
];

function assertStaticImport(linter, config, filename, source, allowed, statement) {
  const code = statement.replace("SOURCE", source);
  const messages = linter.verify(code, config, { filename });
  const context = `${filename}: ${code}`;

  if (allowed) {
    assert.deepEqual(messages, [], context);
    return;
  }

  assert.deepEqual(
    messages.map(({ ruleId, severity, line }) => ({ ruleId, severity, line })),
    [{ ruleId: "no-restricted-imports", severity: 2, line: 1 }],
    context,
  );
  assert.ok(messages[0].message.includes(source), context);
}

for (const [eslintName, eslintPackage] of eslintPackages) {
  test(`${eslintName} applies the complete static Cloudflare boundary`, async (context) => {
    const { Linter } = await import(eslintPackage);
    const linter = new Linter({ configType: "flat" });
    const config = [
      {
        files: ["**/*.{js,cjs,mjs,jsx,ts,cts,mts,tsx}"],
        languageOptions: { parser: typescriptEslint.parser },
      },
      ...(isolation.cloudflareIsolationConfigs ?? [cloudflareIsolation]),
    ];

    for (const filename of ["src/application/example.ts", "src/composition/example.ts"]) {
      const allowed = filename === "src/composition/example.ts";
      for (const source of [adapterAlias, adapterRelative]) {
        await context.test(`${filename} with ${source}`, () => {
          for (const statement of staticStatements) {
            assertStaticImport(linter, config, filename, source, allowed, statement);
          }
        });
      }
    }
    for (const [filename, source, allowed] of adapterCases) {
      await context.test(`adapter boundary in ${filename} with ${source}`, () => {
        assertStaticImport(linter, config, filename, source, allowed, starExport);
      });
    }
    for (const [filename, source, allowed, statement = namedImport] of providerCases) {
      await context.test(`provider boundary in ${filename} with ${source}`, () => {
        assertStaticImport(linter, config, filename, source, allowed, statement);
      });
    }
  });
}
