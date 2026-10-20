# Booking with Calendly

This selected integration offers an ordinary scheduling link, a lazy inline frame, or a native popup dialog. All three use one validated destination, `NEXT_PUBLIC_CALENDLY_URL`. The browser uses the value selected when its artifact was built. Changing a runtime variable cannot enable an unavailable artifact or retarget an existing one.

The environment-aware generation is currently an internal candidate. Public builder commands retain the previous complete generation until the complete environment candidate activates. Do not add an internal-mode CLI flag or manually rewrite `.egeria` controls to opt in. These instructions apply to an already generated environment-aware project; the selected mode is recorded as `link`, `inline`, or `popup` in its project settings, with no stored URL.

## Prepare an isolated booking setup

Use a Calendly account/user with an appropriate event type and access to its scheduling link. Calendly's [embedding overview](https://calendly.com/help/embed-options-overview) lists inline and popup options for all plans, subject to role, account and feature limits. This repository uses ordinary links, direct frames and a native dialog; it does not install Calendly's popup widget or SDK.

For nonproduction, use a separate account/user connected only to synthetic test calendars, and a controlled test inbox. Development and staging may deliberately share that isolated setup. Use separately owned production resources. A second event type on an account connected to real calendars is not isolation: Calendly's [calendar connection guide](https://calendly.com/help/connect-your-calendar-to-calendly) says connected calendars apply across event types. The current guide permits one connected calendar on Free and up to six per user on paid plans; confirm actual entitlement before setup. Do not connect real calendars merely to try this integration.

Account/calendar creation, permissions, real scheduling and cancellation, recipient notifications and provider data handling require their own authorization and acceptance. The generated checks do not perform those actions or establish a Calendly sandbox.

## Local setup and modes

From the generated repository root, install dependencies with `pnpm install --frozen-lockfile`. Put local Next inputs in `apps/web/.env.local`:

```dotenv
APPLICATION_ENVIRONMENT=development
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_CALENDLY_URL=
```

With the URL blank, booking displays a localized unavailable message and loads no provider resources. If contact is also selected, a blank `NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY` independently makes that integration unavailable. Run `pnpm --dir apps/web run dev` and inspect the home page; multilingual output supports English and French.

For a configured local journey, use the real scheduling URL of your separately approved nonproduction setup. Accepted URLs use HTTPS, `calendly.com` or `www.calendly.com`, and a non-root event path, with no credentials, query, fragment, whitespace or non-default port. A malformed nonempty value fails with a field-only diagnostic. The URL is public browser configuration, not a secret, but avoid personal or production values in logs and test records.

- `link`: an ordinary anchor opens the scheduling destination.
- `inline`: the frame activates when its region approaches the viewport. If IntersectionObserver is unavailable, the frame activates after the next animation frame.
- `popup`: activation opens a native dialog; closing it removes the frame. When native modal support is unavailable, the ordinary anchor remains usable.

Every mode retains ordinary anchor navigation without JavaScript. A blocked embedded document also leaves its anchor available. All paths use the same configured URL.

Next loads `.env.local` from `apps/web`. The plain Node preflight reads process inputs only: it does not load that file. For example, from the repository root:

```sh
APPLICATION_ENVIRONMENT=development NEXT_PUBLIC_CALENDLY_URL= pnpm --dir apps/web run check:environment
```

Do not use `.env.staging` as an automatic application-target mechanism. See the generated `docs/environments.md` guide and [Next environment documentation](https://nextjs.org/docs/app/guides/environment-variables).

## Separate build examples

These booking-only examples use distinctive **synthetic placeholders**, not tested or operational scheduling endpoints. Replace them only with authorized resources before a real build. Never visit or book the synthetic URLs. Keep one reviewed source revision and produce separate staging and production artifacts; do not promote a single public bundle expecting its runtime URL to change.

```sh
APPLICATION_ENVIRONMENT=staging NEXT_PUBLIC_CALENDLY_URL=https://calendly.com/egeria-synthetic-nonproduction/intro pnpm --dir apps/web run check:environment:deployment
APPLICATION_ENVIRONMENT=staging NEXT_PUBLIC_CALENDLY_URL=https://calendly.com/egeria-synthetic-nonproduction/intro pnpm --dir apps/web run build
APPLICATION_ENVIRONMENT=staging NEXT_PUBLIC_CALENDLY_URL=https://calendly.com/egeria-synthetic-nonproduction/intro CLOUDFLARE_ENV=staging pnpm --dir apps/web exec opennextjs-cloudflare build --skipNextBuild

APPLICATION_ENVIRONMENT=production NEXT_PUBLIC_CALENDLY_URL=https://calendly.com/egeria-synthetic-production/intro pnpm --dir apps/web run check:environment:deployment
APPLICATION_ENVIRONMENT=production NEXT_PUBLIC_CALENDLY_URL=https://calendly.com/egeria-synthetic-production/intro pnpm --dir apps/web run build
APPLICATION_ENVIRONMENT=production NEXT_PUBLIC_CALENDLY_URL=https://calendly.com/egeria-synthetic-production/intro CLOUDFLARE_ENV=production pnpm --dir apps/web exec opennextjs-cloudflare build --skipNextBuild
```

If contact is selected, supply its valid target-specific public key to every release preflight and build too; follow the generated `docs/contact-form-web3forms.md` guide. Neither integration depends on the other. Missing selected staging/production configuration is an error. Target validation precedes provider validation, and validation precedes OpenNext initialization.

## Verification and limits

Run `pnpm --dir apps/web run test:unit` and `pnpm --dir apps/web run test:component`. Browser setup is explicit: `pnpm --dir apps/web run browser:install`. Controlled booking browser tests intercept provider traffic; supply independent expected test inputs rather than deriving expectations from product settings. For an unavailable local artifact:

```sh
APPLICATION_ENVIRONMENT=development NEXT_PUBLIC_CALENDLY_URL= BOOKING_TEST_EXPECTED_URL= BOOKING_TEST_MODE=link BOOKING_TEST_MULTILINGUAL=false pnpm --dir apps/web run test:e2e:dev calendly-booking.spec.ts
```

A configured local **controlled** example uses the synthetic nonproduction URL on both independent inputs; the test intercepts navigation before it reaches Calendly:

```sh
APPLICATION_ENVIRONMENT=development NEXT_PUBLIC_CALENDLY_URL=https://calendly.com/egeria-synthetic-nonproduction/intro BOOKING_TEST_EXPECTED_URL=https://calendly.com/egeria-synthetic-nonproduction/intro BOOKING_TEST_MODE=link BOOKING_TEST_MULTILINGUAL=false pnpm --dir apps/web run test:e2e:dev calendly-booking.spec.ts
```

Set the test mode to the generated mode and `BOOKING_TEST_MULTILINGUAL=true` for multilingual output. For configured controlled tests, set `BOOKING_TEST_EXPECTED_URL` to the independently known build URL. `test:e2e:preview` exercises a prepared OpenNext artifact; it must already have been built for the intended target. These test-only expectations do not configure the application. Composed contact tests also receive `CONTACT_TEST_EXPECTED_ACCESS_KEY` and the expected booking URL to audit providers separately.

Controlled frames, unit/component checks and automated accessibility checks establish bounded local evidence only. They do not prove real booking/cancellation, notification delivery, calendar ownership or isolation, webhook behavior, privacy-law compliance, production readiness, or accessibility conformance. Human and separately authorized provider acceptance remain distinct.

## Disable, remove and recover

To disable local testing, blank `NEXT_PUBLIC_CALENDLY_URL` and restart the development server or rebuild the artifact. Keep reusable nonproduction calendars/events. A runtime edit does not disable an existing build. Selected staging/production booking cannot have a blank URL; remove the selection through the supported reviewed lifecycle and rebuild instead.

Builder lifecycle planning and application must use the actual generated repository's clean attached isolated worktree and exact approved plan. Current candidate commands remain internal until activation; do not run a guessed public schema switch. Removal concerns generated source/configuration, not Calendly accounts or provider data. The guide, localized copy, component and tests are application-owned: modified files are preserved/ejected, and re-add refuses collisions. Modified managed/shared files and surviving references require review before removal.

Inspect a failed source or verification operation and its recovery report before retrying. Source/controls, dependencies, build artifacts and provider state are separate recovery domains. Do not delete calendars, events, accounts or user edits to recover a local build. Retain the original approved URL/source revision and rebuild the intended target after a reviewed correction.

Documentation sources checked 2026-09-24; account-specific limits must be verified when provisioning is separately authorized.
