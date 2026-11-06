# Application environments

`APPLICATION_ENVIRONMENT` selects `development`, `staging` or `production`. Local builds default to development only when the value is absent or empty. Both staging and production use production compilation; `NODE_ENV` does not select the application target.

| Application target | Build selection | Worker runtime selection |
| --- | --- | --- |
| development | Local default, or explicit `development` | Explicit `development`; never defaults at runtime |
| staging | Explicit `staging`, using production compilation | Explicit `staging`, matching the artifact |
| production | Explicit `production`, using production compilation | Explicit `production`, matching the artifact |

Next reads build inputs from `apps/web/.env.local` or explicitly supplied process variables. Worker runtime configuration comes from Wrangler and `apps/web/.dev.vars`. These are separate inputs. Next does not automatically load `.env.staging`. The build derives `NEXT_PUBLIC_APPLICATION_ENVIRONMENT`; do not configure it independently. A conflicting public value refuses the build.

## Local setup

From the workspace root:

```sh
cp apps/web/.env.example apps/web/.env.local
cp apps/web/.dev.vars.example apps/web/.dev.vars
pnpm --dir apps/web run check:environment
pnpm --dir apps/web run dev
```

The preflight checks process inputs only. Next validates again after loading its own environment files. Actual `.env*` and `.dev.vars*` files are ignored; only the examples belong in source control. Never put secrets into a `NEXT_PUBLIC_` variable or Next configuration's `env` map. Public values are visible to visitors and must be selected before compilation.

## Explicit target builds

Supply the prerequisites for every selected service alongside these target inputs. When hosted contact is selected, follow its generated `docs/contact-form-web3forms.md` guide for the public destination and complete build examples.

```sh
APPLICATION_ENVIRONMENT=staging pnpm --dir apps/web run check:environment:deployment
APPLICATION_ENVIRONMENT=staging pnpm --dir apps/web run build
APPLICATION_ENVIRONMENT=production pnpm --dir apps/web run check:environment:deployment
APPLICATION_ENVIRONMENT=production pnpm --dir apps/web run build
```

Build the two targets separately from the same reviewed revision. A runtime variable cannot retarget an existing artifact; changing any public build value requires rebuilding. Missing or malformed deployment targets refuse preflight. Diagnostics identify the field and reason without printing the rejected value.

Wrangler's default target is development. Its named `staging` and `production` declarations provide matching runtime values. Select the matching Wrangler environment when running a local preview of a target artifact. Vars and bindings do not inherit into named environments; retain each declared binding. Local preview is diagnostic evidence. GitHub Actions remains the sole deployment authority, and actual deployment, protected staging and provider operations require their own approval.

## Foundation health example

When application foundation is selected, start the development server using the local setup above. In another terminal, run `curl -i http://localhost:3000/api/health`: a valid development build and runtime target return the existing health payload. Set `APPLICATION_ENVIRONMENT=staging` in `.dev.vars` while keeping the compiled development target, restart the server, and request health again. It must return HTTP 503 with the stable `application-environment-invalid` code before the build-information reader runs. Restore development and restart to recover. Build-information availability is a separate health condition.

For production-like local evidence, build an explicit target, prepare OpenNext output and run its matching local Wrangler preview. Changing only runtime target must yield the same bounded failure; restoring the matching target recovers without changing provider resources. Health does not verify provider ownership or certify deployment safety.

## Service configuration and recovery

The examples contain configuration names only for selected capabilities. Better Stack is optional: leave both runtime provider fields empty for console-only operation. The consuming observability and selected-service guides own provider validation, setup and composed examples as those environment consumers become available.

Use appropriate shared nonproduction provider resources within one project; keep production resources separate. Local persistent state stays simulated. Provider rules or actual security and test-interference boundaries can require finer separation. Analytics collection stays off by default and requires explicit activation plus visitor consent. Common target declarations alone do not prove resource isolation, Access protection, workflow approval or provider behavior.

Correct invalid local configuration and rebuild when build inputs changed. Revert source separately from runtime configuration, provider changes or persistent data. Do not reset a database, drain queues or delete reusable resources to repair a source or target mismatch.

If booking is selected, see the generated `docs/booking-calendly.md` guide for isolated calendars, its fixed public build input, modes and safe recovery.

If analytics is selected, see the generated `docs/analytics.md` guide for build-time activation, consent, separate provider destinations, production Search verification and a complete contact/booking example.
