# Account foundation: #19, schema and sign-in preview

This branch introduces the database ownership foundation, real PostgreSQL regression tests and an opt-in sign-in preview. Email links/codes, configured Google/Apple buttons, PKCE callbacks, verified session display and device sign-out are implemented. Accounts default to disabled. No hosted migration has been applied by this branch, and cook saving remains browser-local even after signing in. #19 and #20 are not complete.

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

## Account UI and verification

The shared header offers **Sign in** or **Account** on Home, planning, cooking and history. It opens a native modal dialog that leaves the cook and recipe/step drafts mounted, traps focus, supports Escape/Close and restores focus to the account button. The compact phone header uses an account icon with the same accessible label. Email code sign-in can finish in place without navigating away. The standalone `/account/` screen uses the same form and only offers social providers enabled in build configuration. `/account/callback/` exchanges a PKCE code, clears URL parameters immediately and returns to the same origin's account screen. Arbitrary return URLs are ignored. Identity display is verified through Auth `getUser`, rather than trusted from a cached profile. The shared session provider verifies identity across the application, suppresses cached identity during verification, clears identity after sign-out and offers retry if verification fails. Session refresh uses the official SDK. Sign-out clears this origin's session across same-origin tabs; other website origins/devices retain their own sessions. Browser-local cooks are neither uploaded nor removed by login/logout.

For redirect/email-link sign-ins, Back to cook can restore the prior Home/planning/cooking/history view in the same tab and for the same cook. A one-use, one-hour hint in sessionStorage holds only a fixed view name and cook ID; it never accepts an external destination. A different tab, changed cook, invalid/expired hint or blocked tab storage falls back to Home. These hints do not serialize unsaved editors: redirects retain the existing before-unload draft warning. In-place email code sign-in keeps editors mounted. Explicit app updates are blocked while the account dialog is open.

Run `npx playwright test --config playwright.auth.config.ts` for desktop Chromium and iPhone WebKit tests with **simulated Auth responses**. They cover email sign-in, reload, sign-out preserving legacy data, invalid codes, OAuth return, cancelled/failed callbacks, cached-profile verification, cross-tab sign-out, in-place planner drafts, cooking/history access, return to the same cooking view and recoverable verification failure. These tests do not establish real provider, SMTP, JWT or hosted API behavior. CI also runs existing application/offline regression suites. `npm install` uses a compatible PostCSS 8 patch override to address transitive security advisories without changing the Next.js major version.

## Dev setup handoff

The owner created dev project `txwfjuolsuauzeridxkv`. Its URL and publishable key are prepared in ignored `.env.local`; credentials are not committed. On October 28, 2026, the owner confirmed that a real email sign-in link arrived and sign-in worked on the dev feature preview. Google and Apple are not configured yet. This is user-reported live email validation; migration application, hosted two-account API isolation, real refresh/recovery and provider behavior have not been independently verified here. No hosted setup has been performed from this workspace. A publishable key cannot perform administrative setup.

1. If it has not already been applied, in the **dev Supabase SQL editor**, review and run [`202610280001_account_foundation.sql`](../supabase/migrations/202610280001_account_foundation.sql). Never run `supabase/tests/bootstrap.sql` or the local test scripts against hosted Supabase. Keep a record of the applied migration; reconcile the CLI migration baseline before future `db push` use. Production can wait until dev works.
2. Under **Authentication → URL Configuration**, set the dev Site URL to `https://dev.how-many-beers.pages.dev`. Add exact redirect URLs:
   - `https://feat-19-account-foundation.how-many-beers.pages.dev/account/callback/`
   - `https://dev.how-many-beers.pages.dev/account/callback/` when testing integrated dev
   - `http://localhost:3000/account/callback/` only when running locally with `DEPLOY_TARGET=cloudflare`
   The branch alias was observed in the Cloudflare deployment check; changing branches or origins requires an explicit allowlist update. Do not broadly permit arbitrary preview origins.
3. Start with **email** enabled. The built-in mail service restricts test recipients; use an allowed organization/team email for initial testing or configure custom SMTP for other recipients. The default magic-link template supports opening the link in the same browser that requested it. To offer code entry, the template must also include `{{ .Token }}`. PKCE links opened in another browser cannot use the original browser's verifier; request another email or enter the code in the original browser.
4. Configure Google and/or Apple in **Authentication → Sign In / Providers** when ready. Their provider console redirect is **`https://txwfjuolsuauzeridxkv.supabase.co/auth/v1/callback`**, which differs from the frontend callback above. Keep client secrets in Supabase's provider settings. Enable only configured providers in the frontend. Google requests basic identity, not Gmail access. Apple membership/relay-email behavior needs separate verification.
5. In the **Cloudflare Pages Preview build variables**, set the following and rebuild this branch. These are build-time values; changing them requires another build:

   ```dotenv
   NEXT_PUBLIC_ENABLE_ACCOUNTS=true
   NEXT_PUBLIC_AUTH_ENV=development
   NEXT_PUBLIC_SUPABASE_URL=https://txwfjuolsuauzeridxkv.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<dev publishable key already supplied>
   NEXT_PUBLIC_ACCOUNT_ORIGINS=https://feat-19-account-foundation.how-many-beers.pages.dev
   NEXT_PUBLIC_AUTH_PROVIDERS=
   ```

   Leave providers blank for email-only testing; use `google` or `google,apple` after those providers are configured. Origins are comma-separated exact origins without trailing slashes. Add stable dev only when intentionally enabling it. Preview deployment URLs containing a commit hash are not implicitly trusted; use the allowlisted stable branch alias. Keep `DEPLOY_TARGET=cloudflare` as in existing root builds. `.env.example` lists the defaults for local builds.
6. Open the feature branch alias and choose **Sign in** in the header, or visit `/account/`. Test email delivery/link/code, reload, sign-out, cancelled/expired links, and each configured provider on desktop and iPhone. Use two separate test accounts to verify hosted PostgREST ownership once the migration is applied. The account page explicitly explains that cloud cook saving is not available yet.

Cloudflare's Production/Preview labels do not establish database isolation: this project currently builds `dev` as its Pages production branch. Do not enable accounts in that build environment without mapping its actual served origins. The canonical `https://howmanybeers.app` rejects dev auth configuration even if accidentally allowlisted; production requires a separate project and explicit `NEXT_PUBLIC_AUTH_ENV=production`. Keep canonical production disabled for this delivery. The origin/feature gates control rollout; verified JWTs and RLS remain the authorization boundary.

## Remaining #19 and #20 gates

- Real hosted Auth/API tests, including two-user/anonymous isolation, actual JWT expiry/refresh, provider failures and iPhone callbacks.
- Verified identity linking, linked-method settings, safe unlink/recovery rules and Apple relay-email cases. Signing in with another provider must not imply histories have been merged. Evaluate Facebook provider inclusion explicitly before marking #19 complete.
- Authenticated export/account deletion and privacy/retention instructions. Admin deletion needs a protected server function; never put a service-role key in the static app.
- #20: acknowledged cloud saves, validated plan payloads, per-account recovery, safe legacy-data migration, revision conflicts, history/details and Cook Again. Temporary guest behavior must wait for a safe transition.

Feature previews and stable dev can share the dev Auth users and eventual owned cooks, while each origin maintains its own session. Use separate test accounts when independent active cooks are needed. Shared migrations must remain compatible with active dev/preview code. User records, provider secrets and backups stay outside GitHub. Use reviewed forward fixes and restore plans for production changes rather than dropping private data as a rollback.
