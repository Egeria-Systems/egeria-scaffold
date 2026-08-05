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
