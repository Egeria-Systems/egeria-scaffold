# Analytics configuration and operations

Analytics selection belongs to `.egeria/project.yaml`; destinations and activation belong to the build environment. This environment-aware generation is an internal candidate until the complete public generator is activated. Use the existing approved internal generation workflow; there is no public environment-selection CLI switch to enable it early.

The generated selection contains only chosen providers, Clarity's audience declaration and optional operational integrations. Keep identifiers, origins and activation values out of project/state controls. Provider identifiers are public browser configuration, not credentials; never supply API keys or private data through these variables.

## Build inputs

Use `apps/web/.env.local` for Next development or supply process variables to the build. Start from `.env.example`, which lists only selected inputs. Never configure analytics in `.dev.vars`: Worker runtime values cannot change compiled browser configuration. Rebuild after any public input changes.

| Input | Selected use |
| --- | --- |
| `APPLICATION_ENVIRONMENT` | `development`, `staging` or `production`; local absence defaults to development |
| `NEXT_PUBLIC_ANALYTICS_ENABLED` | Only exact `true` enables collection; absent, empty, `false`, `TRUE` and all other values are off |
| `NEXT_PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN` | Cloudflare manual Web Analytics site token, 32 hexadecimal characters |
| `NEXT_PUBLIC_GA4_MEASUREMENT_ID` | GA4 stream identifier, `G-` followed by 6–20 uppercase letters/digits |
| `NEXT_PUBLIC_CLARITY_PROJECT_ID` | Clarity project identifier, 8–32 lowercase letters/digits |
| `NEXT_PUBLIC_SITE_URL` | Selected Clarity's exact browser origin; HTTPS for staging/production |
| `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` | Selected Search Console HTML token, 16–128 URL-safe letters/digits/underscore/hyphen; required only in production |

Do not set `NEXT_PUBLIC_APPLICATION_ENVIRONMENT` separately; the build derives it. An independently supplied conflicting value refuses the build. A Clarity origin may have one trailing slash but no credentials, other path, query or fragment. Development also accepts HTTP loopback origins. When Clarity is selected, a different browser origin prevents the whole selected collection set from loading.

Collection defaults off in development and staging. Choose production activation explicitly after setup and review. When off, selected collection identifiers and Clarity origin may be empty. Malformed nonempty selected values refuse validation even when off. With `true` in development, any missing selected runtime identifier/origin leaves all collection off, retains usable consent controls and emits one field-only `ANALYTICS_COLLECTION_DISABLED` diagnostic. Staging/production refuse missing active inputs. Search verification is independent: its selected token is required in production even with collection off. No Search token is emitted outside production.

`check:environment` and `check:environment:deployment` read process variables only; they do not load `.env.local`. Next validates again after its own environment-file loading. Refusals identify `ANALYTICS_CONFIGURATION_INVALID:<field>:<reason>` or the equivalent JSON envelope without echoing values. Correct the named field and rebuild. Never infer provider ownership or account validity from syntax validation.

## Visitor choices and withdrawal

Cloudflare measures aggregate traffic and performance; GA4 measures audiences; Clarity performs consented experience analysis including session replay. Each selected purpose remains visible independently of whether collection is enabled. The single loader requires both complete enabled build configuration and that provider's granted purpose. No Google or Clarity queue is created merely because a different provider's purpose was granted. Advertising storage, user data, personalization and Google Signals remain disabled.

The browser stores one strict version-3 local preference for 180 days. Its context includes the activation flag, application target, every selected runtime destination and selected Clarity origin. Changed configuration, notice or provider-purpose context, expired or malformed records, and earlier record formats grant nothing. A choice saved while collection is off cannot authorize a later enabled build. This local preference is neither identity nor an audit receipt.

A persisted reduction applies supported denial/erasure signals, expires accessible cookies belonging to the selected installation, removes script nodes and reloads into a document omitting denied providers. GA4 uses host-only cookies at `/`, with fixed `egeria_production` or `egeria_nonproduction` prefixes; cleanup is limited to that prefix's base cookie and configured stream cookie. It leaves unrelated GA cookies intact. Clarity uses `_clck` and `_clsk` and can choose broader parent-domain scope; separate registrable nonproduction domains remain necessary.

Removing a script cannot undo code already executed. Google denial can permit cookieless measurement after loading; Clarity denial has a limited no-consent mode, and its cookie-erasure call does not erase provider-held data. Cloudflare's manually loaded beacon has no documented current-document stop operation. In-flight requests and existing provider data require separate consideration.

If a reduction cannot be saved and an earlier grant cannot be removed, the UI reports an incomplete change, activates no new provider, and avoids reloading into that retained grant. Retry saving or close the page. Collection already running may continue. Turning the build flag off and rebuilding stops future document activation; it does not delete provider data or require deleting reusable resources.

## Provider setup and isolation

- **Cloudflare:** use a separate manual Web Analytics site for nonproduction and production. On proxied sites select **Enable with JS Snippet installation**, and disable automatic setup/Pages injection so the consent loader is the only insertion point. The dashboard's **Disable** option also stops intended post-grant collection and is not a replacement for manual setup. Current [site/rule limits](https://developers.cloudflare.com/web-analytics/limits/) allow 10 nonproxied sites and unlimited proxied sites. Rules apply only to proxied sites: Free 0, Pro 5, Business 20 and Enterprise 100. Review [setup](https://developers.cloudflare.com/web-analytics/get-started/) and account eligibility before provisioning; these limits and rules do not supply visitor consent. The builder does not inspect or change account eligibility or automatic injection.
- **GA4:** create distinct nonproduction and production properties/streams; copy each intended web-stream measurement ID. Confirm native page measurement, retention and access settings. The [configuration reference](https://developers.google.com/analytics/devguides/collection/ga4/reference/config) and [cookie controls](https://developers.google.com/tag-platform/security/guides/customize-cookies) describe domain/prefix behavior. The generated host-only scope and prefixes are bounded browser controls, not proof of live account isolation.
- **Clarity:** use separate projects and separate registrable domains for QA and production, such as `https://qa.analytics-test.invalid` and `https://www.analytics-live.invalid` in controlled examples. A sibling staging subdomain alone does not isolate provider cookies that can walk parent domains. Supply the exact site origin and a property not directed to minors. Review masking, retention, audience eligibility and [consent-v2 behavior](https://learn.microsoft.com/en-us/clarity/setup-and-installation/clarity-consent-api-v2) with the account owner. Masking is provider controlled; structural/layout data and unmasked content can still leave the browser. No SDK fork or parent-domain override is introduced.
- **Search Console:** select a production URL-prefix property and its [HTML-tag verification method](https://support.google.com/webmasters/answer/9008080). Verification needs an accessible matching production homepage. Domain properties use a different verification method. Keep staging protection enabled; never open staging Access just to verify this token. This integration emits metadata only.
- **Looker Studio:** select the intended test or production GA4 property explicitly in the [Google Analytics connector](https://docs.cloud.google.com/data-studio/connect-to-google-analytics). Review report sharing and data credentials with the owner. No reporting SDK, browser script or data pipeline is added.

These examples use synthetic values and reserved `.invalid` origins. Replace them only in your approved environment configuration. Actual provider access, eligibility, ownership, masking and retention are operator prerequisites. Controlled local tests do not certify them.

## Worked multilingual contact, booking and analytics example

For a project already generated with these selections, follow the generated `docs/contact-form-web3forms.md` and `docs/booking-calendly.md` guides alongside this guide. The same choices remain installed in all targets; each build supplies its intended destinations. Nonproduction can share explicitly chosen test resources within the project; production uses separate resources.

Start locally with all optional collection off:

```sh
cp apps/web/.env.example apps/web/.env.local
cp apps/web/.dev.vars.example apps/web/.dev.vars
APPLICATION_ENVIRONMENT=development NEXT_PUBLIC_ANALYTICS_ENABLED=false pnpm --dir apps/web run check:environment
pnpm --dir apps/web run dev
```

Next reads the copied `.env.local`; leave collection false there. Fill contact/booking inputs to exercise their test destinations or leave them blank locally to use their fallbacks. For an explicit staging exercise, export all selected release inputs in the same shell:

```sh
export APPLICATION_ENVIRONMENT=staging
export NEXT_PUBLIC_ANALYTICS_ENABLED=true
export NEXT_PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN=0123456789abcdef0123456789abcdef
export NEXT_PUBLIC_GA4_MEASUREMENT_ID=G-TEST123456
export NEXT_PUBLIC_CLARITY_PROJECT_ID=qatest1234
export NEXT_PUBLIC_SITE_URL=https://qa.analytics-test.invalid
export NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION=
export NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY=00000000-0000-4000-8000-000000000001
export NEXT_PUBLIC_CALENDLY_URL=https://calendly.com/egeria-synthetic-nonproduction/intro
pnpm --dir apps/web run check:environment:deployment
pnpm --dir apps/web run test:unit
pnpm --dir apps/web run test:component
pnpm --dir apps/web run build
CLOUDFLARE_ENV=staging pnpm --dir apps/web exec opennextjs-cloudflare build --skipNextBuild
CLOUDFLARE_ENV=staging pnpm --dir apps/web exec opennextjs-cloudflare preview -- --ip 127.0.0.1 --port 3101
```

At loopback, the selected Clarity origin mismatch correctly keeps all collection inactive. Real QA uses the approved HTTPS origin; repository browser tests simulate it with bounded intercepted transport and synthetic provider responses, not DNS or provider traffic. After a permitted grant, observable destinations must match this build: Cloudflare's manual token, GA4's test stream and Clarity's QA project. Contact must target the configured test recipient and booking its test event. Both locale routes retain the same selected purposes.

Build production separately from the same reviewed source after selecting production resources and deciding whether collection should be on:

```sh
export APPLICATION_ENVIRONMENT=production
export NEXT_PUBLIC_ANALYTICS_ENABLED=true
export NEXT_PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN=fedcba9876543210fedcba9876543210
export NEXT_PUBLIC_GA4_MEASUREMENT_ID=G-PROD123456
export NEXT_PUBLIC_CLARITY_PROJECT_ID=prodtest1234
export NEXT_PUBLIC_SITE_URL=https://www.analytics-live.invalid
export NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION=synthetic-production-verification
export NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY=00000000-0000-4000-8000-000000000002
export NEXT_PUBLIC_CALENDLY_URL=https://calendly.com/egeria-synthetic-production/intro
pnpm --dir apps/web run check:environment:deployment
pnpm --dir apps/web run build
CLOUDFLARE_ENV=production pnpm --dir apps/web exec opennextjs-cloudflare build --skipNextBuild
CLOUDFLARE_ENV=production pnpm --dir apps/web exec opennextjs-cloudflare preview -- --ip 127.0.0.1 --port 3101
```

Preview is local evidence, not deployment authority. Serving either artifact with other IDs or another flag cannot retarget it. The generated analytics browser specification requires independent `ANALYTICS_TEST_BUILD_FLAG`, `ANALYTICS_TEST_EXPECTED_CLOUDFLARE_TOKEN`, `ANALYTICS_TEST_EXPECTED_GA4_ID`, `ANALYTICS_TEST_EXPECTED_CLARITY_ID`, `ANALYTICS_TEST_EXPECTED_SITE_ORIGIN`, `ANALYTICS_TEST_EXPECTED_VERIFICATION` and `ANALYTICS_TEST_TARGET` inputs describing the build. Empty expectations must be explicit. Selected contact/booking tests also require their guide's expected-value inputs. Missing expectations fail the harness rather than silently skipping evidence.

## Ownership and recovery

The generated provider contract owns allowed domains, CSP contributions, storage/data disclosures and stable loader identifiers. Localized consent catalogs and this guide are application-owned. Preserve edits during removal; surviving source references and managed drift need review before transformation. Source removal, browser cleanup and provider-account/data disposition are separate decisions.

The lifecycle creates no provider accounts, projects, properties, verifications, reports or resources and deletes none. Revert source independently from compiled configuration or provider data; preserve reusable resources. Automated axe and controlled-browser checks do not establish human accessibility, translation quality, deployed safety or legal compliance. Obtain the relevant human and privacy/security review for the actual audience, deployment and data practices.
