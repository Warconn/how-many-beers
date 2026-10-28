# Work queue: October 28, 2026

Owner priority: **#50 first tonight**. This is a prepared work order for the next kickoff, not a claim that background jobs have been scheduled.

## Tonight

1. **#50: Home cleanup.** Remove the redundant hero eyebrow and top-of-Home local/offline status block. Keep install/offline help in a quiet footer disclosure, preserve active-cook feedback, errors, storage and PWA behavior. Verify first-visit/returning Home, responsive screenshots, resume, failed saves and built-app offline/update behavior.
2. Review the independently prepared Home change and **PR #49** (personal templates + prominent Beerometer). Integrate approved PRs into dev before branching the next work. Production promotion remains separate.

## Overnight implementation order

1. **#19: Free account foundation.** Authentication, stable identity/ownership, owner-only schema/RLS and account lifecycle. Follow the issue's approved login-provider choices. Test with two accounts, denied/expired authentication, sign-out and ownership isolation. Requires a configured Supabase project/public client configuration and provider setup; record unavailable setup as a blocker instead of inventing credentials or claiming live authentication works. Start with repository code/schema and reviewable setup instructions where possible.
2. **#20: Account-backed cooks and history MVP.** Depends on #19's identity and ownership contract. Save/resume one active/planning cook, archive/search/open previous cooks and Cook Again. Test acknowledged writes, recovery, account switching, cross-device retrieval and guest transition behavior. Full concurrent-edit merging/offline outbox remains its later phase.
3. **#11: Due/overdue cues and opt-in timers.** Extend the existing guided cook; test editing, resume, cancellation, overnight/DST and missed alerts. Keep platform background-notification limits explicit.
4. **#2: Recipe URL import.** Secure server-side retrieval, structured extraction and a Review & Edit step. Test SSRF protections, blocked/unsupported pages, missing timing and manual fallback. Photo/PDF import remains #9.

For each implementation: isolated feature branch, focused tests and appropriate CI, reviewable PR to dev. Do not merge or promote to production without explicit approval.

## Parallel verification

- **#4:** Real iPhone/Android cook, keyboard/touch/outdoor accessibility and first-cook feedback; include remaining #10 suspension/eviction checks.
- **#5:** Independently review method sources and distinguish measured observations from guessed weights and app allowances. Personal notes improve templates but do not establish a calibrated timing model.
- **#45:** Release/canonical-site and social-preview verification. Branding code is already implemented.

Broader design adoption (#21), advanced cross-dish replanning (#3), equipment profiles (#12), learned predictions (#6), probe integration and AI follow the core account/save/reliability work unless the owner changes priorities.
