# acme-portfolio

Generated as a lightweight pnpm workspace with its web application in `apps/web`.

Use the root scripts for local development and verification. Review configuration and application-owned content before release.

## Browser quality checks

Install project dependencies with `pnpm install --frozen-lockfile`, then explicitly install Chromium before the first browser run:

```sh
pnpm --dir apps/web run browser:install
```

Run the same content-agnostic Playwright and axe checks against either local environment:

```sh
pnpm --dir apps/web run test:e2e:dev
pnpm --dir apps/web run test:e2e:preview
```

The development command starts Next.js on loopback port 3100. The preview command builds the OpenNext output and starts Wrangler/workerd on loopback port 3101. They are separate execution environments and do not reuse an ambient server.

To test an already deployed project, supply its public HTTPS root explicitly:

```sh
PLAYWRIGHT_DEPLOYED_URL=https://example.com pnpm --dir apps/web run test:e2e:deployed
```

Deployed mode rejects missing, malformed, non-HTTPS, credential-bearing, query-bearing, and fragment-bearing URLs. It starts no server and is not run by the generated workflow.

Playwright reports and test results are ignored locally and uploaded for seven days when generated CI browser checks fail. Axe and browser checks provide bounded evidence for selected automated and interaction behaviors. Passing them does not establish WCAG conformance, assistive-technology compatibility, or human usability.
