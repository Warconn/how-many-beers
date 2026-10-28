# Account cooks: #20 initial delivery

This feature adds account-backed saving, retrieval and completed history behind `NEXT_PUBLIC_ENABLE_CLOUD_COOKS=true`. It also requires the account configuration in [account foundation](account-foundation.md). Both flags default to false. This document describes implemented feature-branch behavior, not a production rollout.

## Enable the dev preview

1. In the dev Supabase SQL editor, apply the reviewed migrations in order: [001 ownership foundation](../supabase/migrations/202610280001_account_foundation.sql), then [002 account workspace](../supabase/migrations/202610280002_account_cook_workspace.sql). If 001 is already applied, run only 002. Never run `supabase/tests/bootstrap.sql` against hosted Supabase. Record the migration versions before later adopting CLI migration deployment.
2. In Cloudflare Pages **Preview** build variables, retain the configured dev account URL/key/origin and add `NEXT_PUBLIC_ENABLE_CLOUD_COOKS=true`. Rebuild `feat/19-account-foundation` and use its allowlisted [branch alias](https://feat-19-account-foundation.how-many-beers.pages.dev/). This flag is compiled into the app; changing it alone does not change an existing build. Keep canonical production disabled.
3. In Supabase **Authentication → Email Templates → Magic Link**, use the [code-only template](../supabase/templates/sign-in-code.html), containing `{{ .Token }}`. Review **Confirm Signup** too if email confirmation is enabled for new users. The frontend requests and verifies an email OTP; the dashboard template controls whether the delivered email contains a code or a link. Passwords are not implemented. Old link and social callbacks remain compatible.
4. Test the hosted checklist below. The public publishable key cannot apply migrations, change templates or configure Cloudflare. No secret key belongs in the browser or repository.

Migration 002 revokes direct authenticated table writes and introduces RPC writes. Deploy the compatible client before enabling cloud saving; older sign-in-only previews do not write cooks. Disabling the flag stops access through this UI, but does not delete account records. Keep backups and use reviewed forward migrations rather than dropping private tables.

## Cooking experience

A signed-in account has one active/planning cook and a searchable list of completed cooks. Edits save automatically. Save plan, Start, Finish, Cook Again, delete and restore wait for the server to acknowledge the transaction before showing success or advancing. Finish atomically archives the cook and creates the next empty plan. Completed snapshots are immutable; Cook Again uses fresh cook/task identities and clears recorded activity. History retains notes, measurements, outcomes and actual event timestamps.

A fresh guest can plan and cook in memory. Sign-in is offered when keeping a plan or completed cook; Finish without saving discards that cook. Guests do not accumulate persistent cook/history records. Routine UI does not describe browser storage. Account users see a compact saving/saved indicator, and actual failures have retry/export actions.

Existing pre-account saved cooks are protected. Sign-in opens account cooks directly. Optional import/backup tools, including earlier cook/history counts, live under Account → Earlier cooks; they never block planning or cooking. Replacing a meaningful account cook requires confirmation. History is combined by stable archive ID with the account copy taking precedence. Original legacy records remain intact, and earlier unimported records remain downloadable through Account. A durable ownership reservation precedes upload so another account/guest cannot claim the same original private records after a failed upload. Backup/export remains available for account cooks and recovery data.

## Storage and access

Supabase Auth supplies the verified user UUID. `cook_sessions` stores bounded plans and immutable completed snapshots; `cook_events` stores append-only observations. `cook_workspaces` contains only per-owner revision/idempotency metadata. Forced RLS scopes reads to `auth.uid()`. The publishable key grants no private access without an authenticated session.

Two authenticated RPCs, `load_cook_workspace` and `save_cook_workspace`, explicitly require `expected_owner = auth.uid()`. This also rejects an old request if the SDK session switches accounts before sending it. Private helpers are not executable by browser roles. Direct authenticated table writes are revoked so callers cannot bypass the transactional API. Functions pin an empty search path and qualify database objects.

Saving locks the owner's workspace row, checks its authoritative revision, validates the payload and applies all active/history/event changes in one transaction. A stable write UUID permits idempotent retry of the last request, including a committed request whose response was lost. Stale revisions cannot overwrite a newer cook or resurrect deleted history. Previously stored event payloads must remain present and unchanged. Legacy event IDs are retained in payloads and mapped to deterministic database UUIDs; occurred-at times remain actual client observations, distinct from server receipt times. Explicit cook deletion cascades events.

Serving targets include an absolute instant so opening another device in a different timezone does not shift dinner. Existing completed JSON snapshots are preserved rather than rewritten in the reader's timezone.

## Recovery and separation

An owner-keyed IndexedDB cache holds the acknowledged base, newest desired snapshot and at most one immutable pending request. It contains cooking data, not additional Auth tokens. New edits remain responsive during network failure, and pending edits survive reload. A same-origin Web Lock permits one writer per account; IndexedDB compare-before-write provides another stale-cache guard. Unsupported Web Locks retain the cache and server revision checks.

The UI claims Saved to account only after server acknowledgment. A failed critical transition retains the previous view and a recoverable candidate instead of claiming completion. Retry reconciles the last write UUID first. Export includes pending work; a separate recovery download preserves the exact pending record. Storage failures remain visible, including a warning if cloud saving succeeded but the recovery cache could not be updated.

A stale device/tab freezes writes and offers backup plus an explicit reload of the account version. This release does not automatically merge divergent plans/events. Ordinary sign-out is blocked while work is unsaved; deliberate Sign out anyway retains private recovery for the same account. Switching identity clears private visible state and drafts before showing the next account. Cache data is never treated as authorization: a cold reload must verify the account online before exposing private cooks. An already verified open session can continue editing during a temporary outage and send after authentication recovers.

This protects accounts within the application; it does not encrypt cached cooking data against someone with access to the browser profile or an XSS vulnerability. Auth storage uses the official SDK. Account deletion/privacy workflows and production backup/restore remain #19 release gates.

## Limits and deferred work

This initial API loads and saves the full workspace. Requests are bounded to 32 MB; individual plans are limited to 1 MB, completed snapshots to 2 MB and event payloads to 64 KB. These are technical safety limits, not paid tiers. Pagination, incremental history transfer and measured per-account capacity are needed before large histories approach those limits. Exports and quota warnings provide recovery; they do not replace database backups.

Full offline cold-start authorization, an extended event outbox/backoff system, automatic conflict merging and simultaneous live multi-device editing remain the advanced #20 phase. OAuth linking and authenticated account deletion are separate #19 work.

## Verification

- `npm run test`: account cache/state-machine tests, lost responses, pending reload recovery, owner separation, quota failures, serialized writes and timezone preservation, plus existing domain tests.
- `bash scripts/test-account-security.sh`: isolated real PostgreSQL grants/RLS/transactions, original ownership tests and upgraded RPC tests. Covers forged owners, anonymous denial, stale revisions, idempotence, event immutability, completed snapshots, late-error rollback and deletion cascades. The bootstrap Auth shim does not validate actual JWTs.
- `npx playwright test --config playwright.accounts.config.ts`: desktop Chromium/iPhone WebKit UI with simulated Auth/RPC responses. Exercises fresh-browser retrieval, history/Cook Again, guest import, account switching, IndexedDB recovery, failed writes, stale-device recovery and lost Finish responses. Separate Auth, cooking and built-offline suites remain required.

Before enabling real dev account saving, verify with two actual accounts on phone and desktop: code delivery/expiry; save/start/finish; recall on a second device; identical notes/events/outcome; failure/retry; sign-out/switch; and denied cross-owner/anonymous PostgREST requests. Simulated browser responses and the PostgreSQL Auth shim do not establish hosted JWT, SMTP, schema-cache or provider behavior. No hosted administrative setup was performed from this workspace.
