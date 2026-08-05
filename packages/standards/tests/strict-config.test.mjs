import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const strictConfigPath = resolve(packageRoot, "typescript/strict.json");

async function strictConfigExists() {
  try {
    await access(strictConfigPath);
    return true;
  } catch {
    return false;
  }
}

test("the strict TypeScript API exposes the approved compiler contract", async () => {
  assert.equal(
    await strictConfigExists(),
    true,
    "typescript/strict.json must be a public standards API",
  );

  assert.deepEqual(JSON.parse(await readFile(strictConfigPath, "utf8")), {
    compilerOptions: {
      allowJs: false,
      exactOptionalPropertyTypes: true,
      forceConsistentCasingInFileNames: true,
      isolatedModules: true,
      lib: ["ES2022"],
      module: "NodeNext",
      moduleDetection: "force",
      moduleResolution: "NodeNext",
      noFallthroughCasesInSwitch: true,
      noImplicitOverride: true,
      noImplicitReturns: true,
      noUncheckedIndexedAccess: true,
      noUnusedLocals: true,
      noUnusedParameters: true,
      strict: true,
      target: "ES2022",
      verbatimModuleSyntax: true,
    },
  });
});
