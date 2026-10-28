# Account foundation: #19, first delivery

This branch introduces the database ownership foundation and real PostgreSQL regression tests. It does **not** enable sign-in, deploy a hosted database, change guest saving, or complete #19/#20. The existing app remains browser-local until the auth and persistence integrations are reviewed.

## Free-plan fit

Checked against Supabase's own pricing data and billing guide on October 27, 2026:

- Two active Free projects across organizations where the account is owner/admin: use separate dev and production projects.
- 500 MB database size per project; 50,000 monthly active users and 5 GB egress included in the Free plan.
- Automatic database backups are not included; inactive Free projects can pause after one week.
- This is a reasonable alpha starting point for text/JSON cooks. Actual history size, events and indexes must be measured; unlimited history in the product is subject to practical database capacity.
- SMTP/email delivery and OAuth-provider requirements are separate. Configure a suitable email provider for public OTP/magic-link delivery; do not assume Supabase's testing mail service is production-ready. Apple provider setup may have separate membership requirements/costs.
- Establish encrypted backups and a tested restore process before treating hosted account history as dependable production storage. User JSON exports supplement, rather than replace, a database/Auth recovery plan.

Sources: [Supabase pricing](https://supabase.com/pricing), [official pricing source](https://github.com/supabase/supabase/blob/master/packages/shared-data/pricing.ts), [billing guide](https://github.com/supabase/supabase/blob/master/apps/docs/content/guides/platform/billing-on-supabase.mdx). The pricing website is blocked by this workspace's network policy; the current official source files were inspected through GitHub. Recheck dashboard plan details when creating projects. No paid resources have been provisioned.

## Storage and ownership

`cook_sessions` stores an ownership/lifecycle/search envelope with bounded, versioned JSON plan and completed snapshot fields. A partial unique index allows one planning/active cook per owner. Completed cooks remain readable and deletable by their owner, but cannot be rewritten or reopened. Cook Again will create a new record in #20.

`cook_events` stores append-only observations with stable UUIDs, actual occurrence time and a server-controlled receipt time. A composite foreign key binds each event to the same owner as its parent cook. Client event update/delete is denied; deleting an owned cook or deleting its Auth user cascades to its data. New events cannot be added to completed cooks.

RLS is enabled and forced on both tables. Every SELECT/INSERT/UPDATE/DELETE path is owner-scoped or denied. The browser's publishable key is not an administrator credential. `auth.uid()` comes from the verified Supabase session; ownership is never established by a client-supplied ID alone. Owner and record IDs cannot be changed, and revisions/creation/update/receipt timestamps are server-controlled.

The schema bounds names, outcome text and JSON sizes, but is not the complete plan-validation or cloud-save API. #20 must validate the detailed plan structure, use expected-revision compare-and-set writes, handle duplicate event IDs idempotently and archive/create the next cook transactionally. RLS protects accounts; it does not implement concurrent-device reconciliation. Advanced merging/outbox work remains Next.

## Local verification

Run `bash scripts/test-account-security.sh` with Docker available. The script uses a temporary PostgreSQL 16 container with networking disabled and no host port. Its trust authentication exists only inside that disposable test container. It never connects to a hosted project.

`supabase/tests/bootstrap.sql` emulates the required Supabase Auth role/user/UID interface solely for local SQL testing. It is **not** a hosted migration. The tests exercise actual PostgreSQL grants, constraints, triggers and RLS under two identities and an anonymous role. They do not yet verify real JWT validation, PostgREST requests, social providers or hosted Auth configuration; those are explicit #19 integration gates.

The suite covers cross-account reads/updates/deletes, forged ownership, cross-cook event insertion, missing identity, anonymous access, append-only events, invalid/oversized payloads, authoritative metadata, stale revisions, one-open-cook enforcement, completed snapshots and deletion cascades. An isolated negative-control run with RLS disabled fails at forged-owner insertion as expected.

## Hosted setup handoff

1. Owner creates a Supabase organization and two **Free** projects: `how-many-beers-dev` and `how-many-beers-prod`. Select the same appropriate region for both. Keep dashboard access protected with MFA.
2. After reviewing this migration, apply only `supabase/migrations/*.sql` to **dev** using the migration workflow/SQL editor. Never apply `supabase/tests/bootstrap.sql` to a hosted project. Production rollout waits for dev Auth/API integration tests.
3. Configure dev and production separately. The upcoming browser client needs only each project's URL and publishable key. Secret/service-role keys and database passwords belong in protected server/environment configuration, never public code or chat.
4. Configure Google, Apple and email authentication with exact callback allowlists. Production origin is `https://howmanybeers.app`; use an explicit dev origin rather than granting every preview access to production Auth. Use PKCE, verified identity linking and email recovery. Evaluate Facebook explicitly.
5. #19's next delivery adds actual login/callback/session/logout/linking/account-deletion flows and two-account hosted API tests. Admin account deletion uses a protected server function, never a browser service-role key.
6. #20 then connects acknowledged cloud saves, per-account recovery state, revision conflicts, previous cooks/search/details and Cook Again. Keep current guest data protected until that transition is explicit. Do not introduce the temporary new-guest behavior before account persistence/recovery works.

Migrations and test code live in GitHub. User records, real provider credentials and database backups do not. Use schema expansion/backups and reviewed forward fixes for production changes; do not drop private tables as a rollback shortcut.

## Feature-preview testing with the dev project

The owner has created a dev project. Its URL and publishable key are prepared in ignored local environment configuration only; they are not consumed by this database-only slice. No database password or admin key has been supplied, and no hosted migration has been applied by this branch.

Feature previews and the stable dev site can share that dev Supabase project. A user signs in separately on each website origin, while resolving to the same dev Auth user ID and owned database records. Edits are shared between these dev frontends, including the one-active-cook constraint. Use separate dev test accounts when independent cooks are needed. Shared-schema migrations must stay compatible with the dev app and other active previews.

Two different callback settings are involved:

- Google/Apple provider consoles use the **dev Supabase Auth callback**, `https://<dev-project-ref>.supabase.co/auth/v1/callback`.
- Supabase Auth permits the frontend callback for each trusted preview and stable dev origin. The upcoming client will return to that same origin's `/auth/callback/` route to exchange its PKCE code. Add exact callback URLs after confirming the deployed preview URL; do not allow arbitrary preview code to authenticate against production.

Cloudflare build variables for trusted feature previews/stable dev will use the dev project's public URL and publishable key. The live canonical site must keep accounts disabled until its separate production project and provider settings are tested. Cloudflare's labels for production/preview environments do not by themselves establish database isolation: map each actual build/origin explicitly, especially while the Pages production branch is `dev`.

The feature flag is a rollout control, not an authorization boundary. Even if someone accesses the public project endpoint directly, RLS must enforce ownership. This branch adds no login form or working callback route yet; those come in the next #19 slice after the dev migration is reviewed/applied.
