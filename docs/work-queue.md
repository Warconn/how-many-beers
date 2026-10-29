# Work queue: October 28, 2026

October 28 account status: PR #58 contains the opt-in #19 sign-in foundation and initial #20 account saving/history implementation. Email-code delivery needs the supplied Supabase template; cloud cooks require migration 002 and the preview build flag. Hosted two-account/retrieval QA, account linking/deletion/privacy and advanced synchronization remain open. See [setup and limits](account-cooks.md). Continue this delivery before starting Next work.


Owner priority: **#50 first tonight, then #19 and the initial #20 slice**. This follows the execution-queue clarification in PR #51. This is a prepared work order for the next kickoff, not a claim that background jobs have been scheduled.

## Tonight

1. **#50: Home cleanup.** Remove the redundant hero eyebrow and top-of-Home local/offline status block. Remove install/offline help and routine offline-readiness text everywhere; preserve active-cook save feedback, errors, storage, background PWA behavior and safe app updates. Verify first-visit/returning Home, responsive screenshots, resume, failed saves and built-app offline/update behavior.
2. Review the independently prepared Home change, **PR #49** (personal templates + prominent Beerometer), and **PR #51** (durable execution priorities). Integrate approved PRs into dev before branching the next work. Production promotion remains separate.

## Overnight implementation order

1. **#19: Free account foundation.** Authentication, stable identity/ownership, owner-only schema/RLS and account lifecycle. Follow the issue's approved login-provider choices. Test with two accounts, denied/expired authentication, sign-out and ownership isolation. Requires a configured Supabase project/public client configuration and provider setup; record unavailable setup as a blocker instead of inventing credentials or claiming live authentication works. Start with repository code/schema and reviewable setup instructions where possible.
2. **#20: Account-backed cooks and history MVP.** Depends on #19's identity and ownership contract. Save/resume one active/planning cook, archive/search/open previous cooks and Cook Again. Test acknowledged writes, recovery, account switching, cross-device retrieval and guest transition behavior. Full concurrent-edit merging/offline outbox remains its later phase.

## Next, outside the immediate overnight queue

No fixed relative order in this bucket is approved; choose a product priority after the Now scope is complete.

- **#11: Due/overdue cues and opt-in timers.** Extend the existing guided cook; test edits, resume, cancellation, overnight/DST and missed alerts. Keep platform background-notification limits explicit.
- **#2: Recipe URL import.** Secure server-side retrieval, structured extraction and Review & Edit; test SSRF protections, blocked/unsupported pages and missing timing. Photo/PDF remains #9.
- **#3:** Deeper cross-dish scheduling.
- Separate reusable recipe library, advanced #20 concurrent-edit/outbox work and #21 cross-app design adoption.

For each implementation: isolated feature branch, focused tests and appropriate CI, reviewable PR to dev. Do not merge or promote to production without explicit approval.

## Parallel verification

- **#4:** Real iPhone/Android cook, keyboard/touch/outdoor accessibility and first-cook feedback; include remaining #10 suspension/eviction checks.
- **#5:** Independently review method sources and distinguish measured observations from guessed weights and app allowances. Personal notes improve templates but do not establish a calibrated timing model.
- **#45:** Release/canonical-site and social-preview verification. Branding code is already implemented.

Equipment profiles (#12), learned predictions (#6), probe integration and AI remain later work. Do not pull Next/Later items into the immediate coding queue ahead of unfinished #19/#20 Now scope.
