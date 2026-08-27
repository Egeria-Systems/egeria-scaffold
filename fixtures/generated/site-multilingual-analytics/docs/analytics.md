# Analytics operations

This project contains an explicit-opt-in analytics integration. No selected runtime provider loads before a visitor grants analytics consent. Consent can be declined, granted later, managed, and withdrawn. Withdrawal records denial, sends supported provider denial or erasure signals, expires accessible first-party analytics cookies, and reloads the page.

## Provider purposes

- Cloudflare Web Analytics: aggregate traffic and performance measurement.
- Google Analytics 4: audience measurement. Advertising storage, user data, and personalization remain denied.
- Microsoft Clarity: consented experience analysis. This selection declares that the property is not directed to minors.

Search Console contributes only site-verification metadata. Looker Studio contributes no runtime code and assumes the selected Google Analytics 4 connector.

## Security and data boundary

The generated provider contract is the source of truth for script and connection domains, Content Security Policy contributions, browser storage, cookies, data classes, provider-controlled retention, and stable loader identifiers. Provider identifiers are public browser configuration, not credentials. Do not put provider credentials or private data in these settings.

The repository lifecycle does not create, configure, query, or delete provider accounts, sites, properties, projects, streams, verifications, reports, dashboards, or retained provider data. Before removing analytics, review surviving references, provider accounts, retained data, browser storage, cookies, and any application-owned changes to this guide and the localized consent catalogs.

Technical consent controls do not establish legal compliance. Obtain appropriate privacy, legal, security, and human accessibility review for the actual deployment, jurisdiction, audience, providers, configuration, copy, and data practices.
