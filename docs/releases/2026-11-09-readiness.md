# November 9 release candidate

[Release PR #132](https://github.com/Warconn/how-many-beers/pull/132) targets main
from `feat/118-release-readiness`. Preparation is authorized; production merge,
deployment and hosted database changes are not. #114 remains the next separate
feature candidate and is not implemented here.

## Integration audit

Baseline dev is `62f4673be1119d9d8b946b50e5790ab284ec34a7` (owner-approved #131);
main is `190bf61`. Before integration there were 70 dev-only commits and six
main-only commits. All six main-only commits were historical PR merges
(#100/#96/#88/#66/#53/#43), with no main-only non-merge commits or merge-resolution
patches. Integrating main into this candidate produced `fbbcb8b` and **the same
tree as baseline dev**, `67c5e39ef5025afc12040001b90c6a428efb889b`.
Main is now an ancestor of the candidate. No production fix was dropped, and
neither protected branch was changed by this preparation.

## #118 meal-name editing

After Add to meal acknowledges saving, the old implementation unconditionally
queued focus on the serving-time input. A delayed frame could steal focus after
the user selected Meal name but before typing. That leaves the intended name
unentered, explaining an archived “Next cook” without lost cook/event records.

The regression holds application frames at the post-add interaction boundary,
selects Meal name, releases frames and types using the real keyboard target. It
does not re-focus the locator, sleep, delay save acknowledgements or weaken saving
assertions. It also changes serving time and starts immediately, reloads the
cook, archives actuals, checks pre-existing history and uses Cook Again.

The fix preserves the existing fallback focus when no input is selected, while
respecting an input the user has already chosen. It changes no persistence schema,
save protocol, actual timestamp or historical record. This reproduces one concrete
cause of #118; it does not prove every possible intermittent metadata problem has
the same cause.

### Verification evidence

- Local `npm ci --no-audit --no-fund`, typecheck and all **444 unit tests** pass.
- `DEPLOY_TARGET=cloudflare npm run build` passes locally, including the static
  offline shell (44 assets). This builds files only; it does not deploy.
- The new test fails against the old code at the name assertion (Next cook), then
  passes against the fix through Start, reload, finish/history and Cook Again in
  actual system Chromium. The preserved-history screenshot was visually reviewed.
- `bash scripts/test-account-security.sh` passes clean installation, seeded upgrade,
  ownership/lifecycle denials, retries and competing cancellation/promotion/save
  races in disposable PostgreSQL. No hosted project was accessed.
- Required `npm run test:full` was attempted locally: units pass, then Playwright
  cannot launch its absent bundled browsers. Browser installation is blocked by
  this environment's OS privileges/download policy. The focused run explicitly
  uses installed system Chromium; it is not a substitute for WebKit.
- [Before-fix CI](https://github.com/Warconn/how-many-beers/actions/runs/42699764176)
  confirms the controlled reproduction on desktop Chromium and iPhone WebKit,
  both failing on the initial attempt and retry with Next cook instead of the
  entered name. The original intermittent iPhone history test also failed once
  and passed its retry in that run. The other 77 account cases passed.
  Failure traces are retained in artifact `13712250897`.
  Final Chromium/WebKit, auth, account, offline, build and database results must
  be green on the release candidate SHA in [PR #132 checks](https://github.com/Warconn/how-many-beers/pull/132/checks).
  Review actual desktop/mobile/iPhone PNGs from that run, not only its test totals.

The PR handoff records the final SHA, suite totals, inspected screenshots and exact
Cloudflare-reported feature URL. A successful preview is not a production release.

### Account test input boundary found during the expanded run

Run `42704839870` passed its gates with one iPhone retry in the existing imported-
duration test. Its trace shows datetime `fill()` during the Add transaction while
`.cook-content` was `inert`; the existing application save guard rejected the
synthetic edit. Every RPC retained the old target. This is distinct from deferred
focus stealing a real unlocked edit in #118. The duration test now waits for method
review dismissal and removal of `inert`, then asserts both the entered target and
its exact account acknowledgement before testing durations. The original name/
history scenario also observes this real interaction boundary. No input assertion,
timeout, retry policy or application save protection was weakened. The final PR
checks must pass again after this test correction.

## User-journey coverage

The [coverage map](../user-journey-coverage.md) links implemented entry points,
known real-cook regressions, account/guest/offline scenarios and their browser
specs. Additional continuous UI journeys cover new overnight brisket through Hold
and a template plus uploaded recipe through history/Cook Again. They supplement
the existing targeted tests; hosted accounts and physical iPhone acceptance remain
explicit boundaries. #114 is excluded.

## Production prerequisites and approval gate

- Obtain explicit owner approval before merging #132. Cloudflare deploys main
  automatically; do not treat merge as a harmless metadata operation.
- Confirm the production Supabase project has the required reviewed schema/RPCs:
  `202611050001_retained_cancellation.sql` and
  `202611050002_saved_upcoming_plans.sql`. Only **dev** application is confirmed.
  The owner confirmed on November 9 that neither is applied to production and
  will apply them manually before merge. Run the complete files in this order:
  [retained cancellation](https://github.com/Warconn/how-many-beers/blob/62f4673be1119d9d8b946b50e5790ab284ec34a7/supabase/migrations/202611050001_retained_cancellation.sql),
  then [saved upcoming plans](https://github.com/Warconn/how-many-beers/blob/62f4673be1119d9d8b946b50e5790ab284ec34a7/supabase/migrations/202611050002_saved_upcoming_plans.sql).
  Each file includes its transaction and schema-cache reload. They are migrations
  applied once, not bootstrap/test SQL. Await success confirmation and account
  verification before marking this gate complete. No hosted SQL was run here.
- Existing capability gates preserve older-schema account behavior. They do not
  establish that retained cancellation and multiple upcoming plans are available
  in production. Keep #61/#83/#103 open until production acceptance is verified.
- Preserve existing production environment variables, exact-origin authentication
  and the separate production Supabase project. Preview sessions/data belong to
  dev and do not establish production account correctness.
- Check the exact candidate SHA, all CI gates and the deployed feature URL before
  final approval. Automated account coverage uses mocked authentication/RPCs;
  disposable PostgreSQL verifies migration/security/race behavior. Neither is a
  claim of hosted production verification.

## Owner acceptance on the feature preview

1. On iPhone, add brisket, immediately edit Meal name and serving time, then Start.
   Reload/resume: name, target and checked steps should remain.
2. Finish that disposable cook, find its name in Past cooks, inspect recorded
   steps, then Cook Again. The old cook stays intact; the new plan has no actuals.
3. With an active cook, save/edit a separate upcoming plan. Check its Start
   preparing/serving times and confirm active progress did not change.
4. Check direct planned-time editing and the collapsed current/next timing cues.
   Planned-time edits must preserve duration and actuals; Hold → Finish stays intact.
5. Briefly go offline/reconnect during a disposable cook. Resume/check progress
   and confirm honest save status. Use the Account menu for any update action.

After separately approved deployment, repeat account sign-in, history, saving,
cancellation and upcoming-plan checks on https://howmanybeers.app before closing
#61/#83/#103. Record the deployed SHA. For rollback, restore the previously verified
application commit through an approved release; do not drop retained records or
reverse additive migrations into unsafe legacy RPCs.
