export const cloudflareIsolation = {
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
            message: "Cloudflare imports belong in the infrastructure adapter.",
          },
          {
            regex: "^\\.\\./(?:\\.\\./)*infrastructure/cloudflare(?:/|$)",
            message:
              "Cloudflare adapter imports belong in a composition root.",
          },
        ],
      },
    ],
  },
};

const sourceFiles = "**/*.{js,cjs,mjs,jsx,ts,cts,mts,tsx}";
const providerBoundaries = [
  "src/infrastructure/cloudflare/**",
  "next.config.ts",
  "open-next.config.ts",
  "worker.mjs",
  "tests/integration/cloudflare.test.ts",
  "tests/integration/queue-topology.test.ts",
  "tests/integration/health-worker.test.ts",
  "tests/integration/job-worker.test.ts",
  "tests/integration/fixtures/job-worker.mjs",
  "tests/integration/cloudflare/**",
  "tests/bindings/application-persistence.test.ts",
  "tests/bindings/fixtures/worker.ts",
];
const adapterBoundaries = [
  ...providerBoundaries,
  "src/composition/**",
  "app/api/health/route.ts",
  "app/api/compatibility/route.ts",
];

const providerModules = {
  regex:
    "^(?:(?:@opennextjs/cloudflare|@cloudflare/workers-types|wrangler)(?:/|$)|cloudflare:)",
  caseSensitive: true,
  message:
    "Use Cloudflare provider modules in adapters, platform configuration, or Cloudflare integration tests.",
};
const adapterImports = {
  regex: String.raw`^(?:@/src/|(?:\./|(?:\.\./)+)(?:src/)?)infrastructure/cloudflare(?:/|$)`,
  caseSensitive: true,
  message:
    "Use Cloudflare adapters in platform boundaries or explicit composition roots.",
};
const siblingAdapterImports = {
  ...adapterImports,
  regex: String.raw`^(?:\./|(?:\.\./)+)cloudflare(?:/|$)`,
};

function restrictImports(...patterns) {
  return {
    "no-restricted-imports": ["error", { patterns }],
  };
}

export const cloudflareIsolationConfigs = [
  {
    name: "@egeria-systems/standards/cloudflare-provider-imports",
    files: [sourceFiles],
    ignores: providerBoundaries,
    rules: restrictImports(providerModules),
  },
  {
    name: "@egeria-systems/standards/cloudflare-adapter-imports",
    files: [sourceFiles],
    ignores: adapterBoundaries,
    rules: restrictImports(providerModules, adapterImports),
  },
  {
    name: "@egeria-systems/standards/cloudflare-sibling-adapter-imports",
    files: [["src/infrastructure/**", sourceFiles]],
    ignores: adapterBoundaries,
    rules: restrictImports(providerModules, adapterImports, siblingAdapterImports),
  },
];
