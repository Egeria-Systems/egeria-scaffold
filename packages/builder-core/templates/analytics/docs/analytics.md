# Analytics operations

This project contains an explicit-opt-in analytics integration. No selected runtime provider loads before a visitor grants analytics consent. Consent can be declined, granted later, managed, and withdrawn. Withdrawal records denial, sends supported provider denial or erasure signals, expires accessible first-party analytics cookies, and reloads the page.

## Provider purposes

- Cloudflare Web Analytics: aggregate traffic and performance measurement.
- Google Analytics 4: audience measurement. Advertising storage, user data, and personalization remain denied.
- Microsoft Clarity: consented experience analysis. This selection declares that the property is not directed to minors.

Search Console contributes only site-verification metadata. Looker Studio contributes no runtime code and assumes the selected Google Analytics 4 connector.

## Cloudflare installation prerequisite

Cloudflare Web Analytics must use the cookie-free manual integration controlled by this project. For a proxied site, select the Cloudflare dashboard option **Enable with JS Snippet installation** before using the generated loader. Do not use automatic setup or Pages one-click injection because edge injection can load analytics outside the application consent boundary. Cloudflare's **Disable** option is not the repair because it also prevents intended post-grant collection. An unproxied or otherwise manual deployment must still verify that no Cloudflare analytics script or request occurs in denied states. The builder does not inspect or change this provider-account setting.

## Security and data boundary

The generated provider contract is the source of truth for script and connection domains, Content Security Policy contributions, browser storage, cookies, data classes, provider-controlled retention, and stable loader identifiers. Provider identifiers are public browser configuration, not credentials. Do not put provider credentials or private data in these settings.

Microsoft Clarity masking is provider-account controlled. Configured masking prevents masked content from being uploaded, but structural and layout information and unmasked content can still be transmitted. The builder cannot inspect or enforce the project's masking configuration; review it for the actual deployment.

The repository lifecycle does not create, configure, query, or delete provider accounts, sites, properties, projects, streams, verifications, reports, dashboards, or retained provider data. Before removing analytics, review surviving references, provider accounts, retained data, browser storage, cookies, and any application-owned changes to this guide and the localized consent catalogs.

Technical consent controls do not establish legal compliance. Obtain appropriate privacy, legal, security, and human accessibility review for the actual deployment, jurisdiction, audience, providers, configuration, copy, and data practices.
