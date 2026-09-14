# Application persistence

`APP_DB` is an optional Cloudflare D1 binding. Drizzle defines application schema and generates SQL; Wrangler applies SQL and owns the `d1_migrations` ledger. Do not also run a Drizzle runtime migrator against this database.

The starter schema is empty. Add tables only for a concrete application requirement. Keep Cloudflare bindings and Drizzle in infrastructure or composition code. When a use case needs persistence, define a narrow port at that consuming boundary and implement its D1 adapter; do not introduce a generic database service or expose D1 types through domain, presentation, or client code.

## Local development

The managed `apps/web/wrangler.jsonc` selects synthetic local storage by default. Its database IDs are deliberately unusable for remote operations. Nothing is provisioned by generation. No Cloudflare credentials or account are needed for these checks:

```sh
pnpm --dir apps/web run db:check
pnpm --dir apps/web run cf-typegen
pnpm --dir apps/web run test:integration:bindings
```

Edit `apps/web/src/infrastructure/persistence/schema.ts` for the application. Generate and inspect SQL before applying it:

```sh
pnpm --dir apps/web run db:generate
pnpm --dir apps/web run db:migrations:hash
pnpm --dir apps/web run db:migrate:local
```

Drizzle writes application SQL and its generation metadata under `apps/web/migrations/`. An empty schema creates no business migration; the directory can be absent until the first real schema change. `db:migrate:local` is for existing migrations and Wrangler refuses an absent directory. Do not add placeholder SQL merely to make that command succeed.

The migration hash covers the ordered top-level SQL filenames and the SHA-256 of each file's exact bytes. It excludes Drizzle generation metadata because Wrangler does not execute that metadata. Renaming, adding, removing, or changing SQL requires a new review and hash. A migration file must be a regular file no larger than 1 MiB; symlinked SQL or migration directories are refused. A larger migration needs an explicit change to this reviewed boundary.

The binding specifications use synthetic test-only schema, SQL, and isolated workerd storage. They demonstrate the installed D1/Drizzle binding and D1 prepared-batch failure behavior. They do not prove deployed schema compatibility, account permissions, production performance, recovery availability, or correctness of later application SQL. Drizzle callback transactions are not a general D1 transaction guarantee; no retry or cancellation guarantee for already-started database work is supplied.

## Remote configuration and approval

GitHub Actions is the deployment and remote-migration authority. Configure protected GitHub environments named exactly `staging` and `production`, with main-branch restrictions, required reviewers, and prevention of self-approval where the GitHub plan supports it. If required protection is unavailable, establish the approved human control before running these workflows. Generated workflow text cannot configure or prove those protections.

After separately authorizing and creating the two remote databases, record their distinct IDs as these non-secret variables in both selected GitHub environments:

- `STAGING_APPLICATION_DATABASE_ID`
- `PRODUCTION_APPLICATION_DATABASE_ID`

Each environment separately supplies its least-privilege `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` secrets. Use the narrowest account permissions and resource scope available for that environment; review Cloudflare's actual token-scoping limits. Production also needs its HTTPS `DEPLOY_URL` variable for the existing deployed browser checks. Never put tokens, exports, private records, or recovery contents in workflow inputs.

Do not edit database IDs into the managed Wrangler file. Preflight reads the explicit variables, validates distinct UUIDs and the expected selected ID, and writes an ignored derived configuration at `apps/web/.wrangler/application-database/wrangler.remote.json`. Its main, asset, and migration paths resolve against the original application directory. Each named environment explicitly repeats its bindings and variables because Wrangler does not inherit those entries. The derived file contains database IDs but no credentials. It is disposable configuration, not authoritative state, an approval record, or a recovery backup.

Remote preflight rejects a missing or unknown environment, missing/duplicate/malformed IDs, a different expected database, a different actual checkout revision, a non-main dispatch, changed source files, and a changed migration hash. Generated remote commands specify the environment and derived config and disable automatic provisioning. There is no default-production command or generated resource-creation command.

## Reviewed database migrations

Use the manual **Migrate application database** workflow only after explicit approval for the selected environment and persistent-data change. Review the exact `main` revision and all SQL represented by `db:migrations:hash`, including already-applied files. Do not edit previously applied SQL: Wrangler's ledger tracks migration names and does not provide historical content-integrity checking for you.

The dispatch records:

- The explicit `staging` or `production` environment and expected database ID.
- The exact reviewed main revision and SQL migration-set SHA-256.
- A non-secret source-review reference covering SQL effects, schema compatibility with current and next application versions, and operation order.
- A non-secret recovery-point reference covering the actual selected database, export/bookmark evidence, write consistency, retention, and recovery procedure.

These references identify human-reviewed records; the script validates their presence and format, not the truth of remote recovery claims. Obtain a current recovery point through a separately authorized provider operation. Review writes occurring after an export, maintenance or write-quiescence needs, restore/readback results, and any accepted data-loss window. Do not enter a fabricated reference or treat a local fixture result as remote evidence.

The workflow verifies locally without credentials, applies the reviewed SQL to local storage, and runs the binding lane. It recomputes preflight before and inside the single credential-bearing migration step. Wrangler applies unapplied SQL to the explicitly selected remote database using the `d1_migrations` ledger. On failure, inspect that ledger and the actual schema before deciding what to do next: an individual failing migration is rolled back, but earlier successful migrations may already be applied. The workflow does not automatically retry, roll back earlier SQL, restore data, or deploy source. See [Cloudflare's migration command behavior](https://developers.cloudflare.com/d1/wrangler-commands/).

Production deployment remains the separate manual **Deploy production** workflow with exact-main approval, protected production environment, existing local and browser checks, and deployed smoke checks. Its expected database ID and migration hash bind the selected target and source set; they do not inspect the remote ledger. Human approval must confirm that the production schema supports the deployed code and that any required separately approved migration completed. Deployment itself never applies SQL. Deployment and migration share a non-cancelling concurrency group for the target environment; other tools or repositories are outside that queue and need their own coordination.

## Export, recovery, and removal

Source rollback and persistent-data recovery are separate operations. Reverting a commit, removing a package or binding, or deleting local `.wrangler` storage does not reverse a remote schema/data change, revoke credentials, delete a remote database, or satisfy an export obligation.

Before an approved export or recovery, record the exact environment/database identity, source revision, schema/migration identity, export digest and location reference, consistency window, retention policy, and observed outcomes. Keep data and recovery material outside Git and review logs in an access-controlled store. Validate a restore in an explicitly isolated destination and read back the required records before claiming recovery. Record whether each observation is synthetic local evidence or a separately authorized deployed check.

D1 Time Travel availability and retention depend on the actual storage system and account plan. Verify the selected database and current limits before relying on a bookmark; a bookmark reference alone does not prove that a restore will work. Export has documented SQL, virtual-table, and import limitations; test the chosen procedure against the real schema. Review [Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/), [account limits](https://developers.cloudflare.com/d1/platform/limits/), and [import/export constraints](https://developers.cloudflare.com/d1/best-practices/import-export-data/) for the approved operation. Restoring a prior point can lose subsequent writes and must have its own explicit authorization and consistency decision.

Persistence source removal requires the builder's export-and-remove evidence review. First, the machine reviews only supplied evidence and explicitly selected local artifacts, checks supported identities/digests and reported outcomes, and lists missing or inconclusive evidence and human checks. It performs no export, remote restore, provider deletion, or external-model upload. A locally verified fact remains distinct from an operator-reported remote result. Wrong-target evidence, changed inputs, digest mismatch, or a failed required recovery check blocks removal.

Next, a human reviews the machine recommendation, every required uncertainty/disposition, export/recovery evidence, and exact source-removal diff, and approves that fingerprinted plan. New evidence or a changed plan requires new review. The executor rechecks the bound snapshot before its first write; a machine recommendation cannot replace human acceptance or bypass an integrity failure.

### Prepare the source-removal review

Work in the clean dedicated linked worktree required by the builder. Keep review JSON and export artifacts outside Git; an ignored location such as `apps/web/.wrangler/removal-evidence/` avoids changing the planned source diff. The CLI's JSON file arguments resolve from your shell's working directory; artifact paths inside the envelope resolve from the target repository root. Do not paste private export contents into either review file.

Create a removal input file with this structure, replacing the examples with actual reviewed identities, policy and dates:

```json
{
  "databases": [
    { "environment": "local", "databaseId": "local-application-database" }
  ],
  "policy": {
    "exportNotBefore": "2026-09-14T00:00:00Z",
    "retainUntil": "2026-10-14T00:00:00Z",
    "recoveryRequirements": [{ "environment": "local", "scope": "local" }],
    "writeConsistency": "writes-paused"
  }
}
```

Declare every affected environment: `local`, `staging`, or `production`, each at most once with a distinct database identity. A local-only example does not discharge staging or production obligations. Remote identities are operator-supplied and need human verification against the actual account. Recovery requirements must cover those exact environments; require `deployed` scope where a local restore cannot prove the required outcome. Retention dates are reviewed requirements, not a built-in retention recommendation.

Run `plan-remove --directory <absolute-worktree> --capability application-persistence --persistence-removal <input.json>`. The returned `persistenceRemovalSubject` provides descriptor version/fingerprint and schema/migrations fingerprints. Combine these with the declared databases as `evidence.subject`; use evidence schema version `1.0.0`. For each database, supply its exact identity and these records:

- `export`: artifact reference, SHA-256 digest, completion time and observed outcome.
- `recovery`: artifact reference/digest, the restored export digest, local or deployed scope, restoration and readback outcomes.
- `writeConsistency`: the selected policy mode and observed outcome.
- `retention`: retained-until time and observed outcome.

Outcomes are `passed`, `failed`, or `unavailable`; digests use `sha256:` followed by the 64 lowercase hexadecimal digits. Optional `localArtifacts` entries contain `{ "reference": "local-export", "path": "apps/web/.wrangler/removal-evidence/export.sql" }`. The builder reads at most six explicitly selected regular files, each no larger than 1 MiB, with no symlink traversal. Unavailable or larger artifacts remain explicit human-review uncertainty; declaring a digest alone does not verify artifact contents. The versioned builder contracts validate the envelope and reject unknown fields.

Run planning again after completing actual evidence. A recommendation of `obtain-more-evidence` or `blocked` must be resolved before execution. For `ready-for-human-review`, have a person review each item in `persistenceRemovalReport.requiredReviewItems` and the exact source plan. Prepare the separate human-review JSON with the report's `reportFingerprint` and a `dispositions` array containing each required identifier exactly once and its actual `accepted`, `rejected`, or `unresolved` disposition. The executor requires all dispositions accepted. Never generate those acceptances merely because the machine report is ready.

Only after that review, run `apply-remove` with the same directory, capability and input file, plus `--persistence-human-review <human-review.json>` and `--approved-plan <planFingerprint>`. Inspect and approve the resulting verified final diff through the normal builder workflow. Changing source, evidence, artifacts, policy or identities invalidates the earlier review. Preserve a failed execution prefix for inspection; do not retry blindly or delete recovery material.

Preserve application schema, SQL, exports, custom code/dependencies/scripts, and ejected surfaces unless an exact approved removal disposition authorizes otherwise. Review surviving imports and tools that depend on Drizzle or removed source. Source removal leaves remote data and provider resources intact. Export, restoration, deletion, credential revocation, retention expiry, and provider cleanup each retain their own authorization and recovery scope.
