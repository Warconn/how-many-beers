# Current owner-approved sequence (November 4 ET / November 5 UTC, 2026)

**Canonical decisions:** [Product roadmap](product-roadmap.md). Verify live GitHub branches, issues, PRs, CI and current release before starting Codex work. The older October queue below is historical and **must not** be followed for new assignments.

## Shipped baseline

[Production PR #100](https://github.com/Warconn/how-many-beers/pull/100) released #21 visual consistency and #97 checklist-first Cooking Mode plus accepted spacing/Beerometer UI, beyond earlier #96 fixes. These are **completed**. Do not rerun them.

## Merged into dev, production promotion separate

The owner approved dev integration on November 5. Dev commit
`4b4b31f4f996f4c1e2d1593bc48d1930a41f9692` contains:

1. **#61 Retained cancellation:** [PR #104](https://github.com/Warconn/how-many-beers/pull/104), owner-approved Cancel Cook UX, retained records and acknowledgement/ownership protections.
2. **#71 CI feedback:** [PR #102](https://github.com/Warconn/how-many-beers/pull/102), complete browser regression sharding with measured timing/cost evidence.
3. **#83 Multiple upcoming saved cooks:** [PR #107](https://github.com/Warconn/how-many-beers/pull/107), independent account plans, one active cook and quiet automatic saving through the existing status icon.

Cloudflare confirmed the dev preview deployment. Check live integration CI before
calling validation complete. Hosted Supabase migrations remain unverified/unapplied
by this workspace; preserve capability gating until the dev schema supports these
APIs. Production remains #100. Do not repeat delivered implementation.

## Next product priorities, once the above is reviewed

4. **#103 Recipe-first cook creation and reuse:** Next *user experience* priority after #83. Agree on the first small slice of “What are you cooking?” → saved personal recipe / prior Cook Again / create new with template or existing text import → concise editable plan → add other dishes. Preserve separate recipe and cook-session concepts, and avoid a full onboarding wizard. Review design with owner before coding.
5. **#101 Concurrent cooking phases and rolling Beerometer:** Follow as its own design-then-implementation track. Checking a “place on grill” step starts a phase, “remove from heat” ends it; time-based check actions remain optional for readings, concurrent dishes stay visible, Up next is global, and Beerometer estimates total remaining work from **now**. Corrections reflow the forecast, and timer expiry never proves food safe. No notifications or advanced scheduler scope.

After #103/#101, use the app on real multi-dish cooks and reevaluate pain points before adding more features.

## Intentionally Later or closed

- **#2 URL import** and **#11 timers/notifications:** owner explicitly deferred until the core cook experience is stable. Existing text import continues; computing checkpoint due times in #101 is not implementing reminder delivery.
- **#3 advanced cross-dish dependencies**, #6 learned timing, #9 photo/PDF import, #13 voice, #46 monetization, #67 social login and #70 multi-device concurrent edits are later/parked.
- **#105** consolidates closed #68/#69 privacy/data and offline reliability concepts as future considerations. Address concrete security, data loss or legal requirements promptly rather than waiting for a feature cycle.
- **#12/#14/#15/#16/#17/#18** were closed not planned; no expanded equipment profiles, smart probes, sharing, groceries/nutrition, AI coach or alternative bundled methods.

Use feature branches and reviewable PRs into `dev`. No automatic merges, production deployments or hosted schema changes; inspect CI and user-facing screenshots.

The following older queue is historical and superseded by this section.

---

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
