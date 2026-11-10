# Current queue · November 9, 2026

## Now: release readiness, not feature development

The owner approved and merged the post-brisket work through **PR #131** into dev
at `62f4673` on November 9. The active release candidate is
`feat/118-release-readiness`, with [release PR #132](https://github.com/Warconn/how-many-beers/pull/132)
targeting **main**. This explicit release target supersedes the ordinary feature
PR target of dev. Do not merge into main or deploy production without owner approval.

1. **#118:** investigate the intermittent iPhone/WebKit meal-name miss. A controlled
   delayed application frame reproduces focus moving from Meal name to serving
   time and leaves the saved name as Next cook. Verify the narrow fix in WebKit,
   including immediate Start, serving edits, history, reload and Cook Again.
2. **Preview blocker: upcoming-plan discard.** An accidental empty plan had no
   removal action. Expose the existing retained discard RPC from Home and the
   planner, preserving active cooks/history and immutable retry receipts. No new
   migration. Regress empty/populated, failure, stale and reload paths.
3. Compare dev/main and retain all production fixes; run full unit, browser,
   authentication, account, offline and database-security checks. The owner also
   requested a [user-journey audit](user-journey-coverage.md) and continuous
   whole-cook regression scenarios. Review actual
   desktop/mobile/iPhone screenshots and provide the confirmed feature URL.
4. Complete release acceptance and verify production schema readiness before the
   separately approved production promotion. No hosted database changes are
   authorized in this session.

## Completed implementations in dev

| Issue | Delivery | Status |
| --- | --- | --- |
| #117 fixed-template checkpoint scheduling | PR #128 / `4a3e891` | Implemented in dev |
| #119 preparation-start hierarchy and mobile planner | PR #120 / `960abc9` | Implemented in dev |
| #121 provisional brisket forecast | PR #122 / `ea2873a` | Implemented in dev |
| #123 optional Cooking Mode tools | PR #129 / `ed0a165` | Implemented in dev |
| #124 current/next timing cues | PR #131 / `62f4673` | Implemented in dev |
| #125 direct planned-time edits | PR #131 / `62f4673` | Implemented in dev |
| #126 upcoming preparation time | PR #131 / `62f4673` | Implemented in dev |
| #127 concise new brisket template / 6–8h reserve | PR #131 / `62f4673` | Implemented in dev |

Do not repeat these stories. Their implementation issues are closed with explicit
dev-delivery evidence; closure does not claim production deployment. #130 is
superseded by #131. Preserve the physical cooking model, checkbox-first controls,
Beerometer, fixed/actual distinctions, guest/account boundaries and Hold → Finish.

## Keep open through production verification

- **#61:** retained cancellation, delivered through PR #104.
- **#83:** independent upcoming plans / one active cook, delivered through PR #107.
- **#103:** accepted recipe review/planning UI, delivered through #108/#111/#112.
  The separate personal recipe library belongs to #114.

Both November 5 migrations are owner-confirmed applied/verified in **dev**.
The owner confirmed both are **not yet applied in production** and will apply
them manually before merge. Verify success through the release checklist; do not reapply dev
migrations or run bootstrap/test SQL on hosted Supabase.

## Next feature, after release

**#114: personal saved recipes** is the next candidate for separate owner review.
It is not part of this release and must not be started in this session.

## Deferred

#3 equipment/resource optimization, #11 notifications, #2 URL import, photo/PDF
import, social login, paid features and #69/#70 advanced synchronization remain
outside this release. Do not add incidental UX changes or manual-QA tickets.

See [roadmap](roadmap.md), [release candidate / approval checklist](releases/2026-11-09-readiness.md)
and [core experience](core-cook-experience.md). Handoffs distinguish tested feature
preview, merged dev, production approval and verified production deployment.
