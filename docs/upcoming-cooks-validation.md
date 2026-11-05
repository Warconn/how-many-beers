# Upcoming cooks validation (#83)

Depends on the reviewed #61 implementation in PR #104. This is a separate feature
branch/PR to dev; while #104 is unmerged its commits remain visible in this PR's
ancestry. No hosted migrations, dev merges or production deployments were performed.

Focused browser journeys cover desktop and Pixel-sized mobile Chromium:

- Keep Pumpkin Seeds active with exactly 5/8 steps complete; create two future
  meals, rename/reschedule one, verify date ordering and retrieve on another browser.
  Active meal/events and completed history remain byte-equivalent.
- Cancel the existing cook, atomically start a saved plan, check its steps, finish
  and find the new entry in normal history.
- Transfer a meaningful legacy planning session once when another plan starts.
- Fail the first plan save, export its recovery draft, reload, rediscover/resume it
  and save without changing the current cook.
- Export/import future plans without changing current cooking or completed history.
- Fail a future-plan write, protect its private draft, and return to the real active
  cook without an extra active-workspace write or an invented save acknowledgment.

Actual captures were opened and inspected for hierarchy, information density,
readable dates, touch controls, explicit current/upcoming separation and backup scope:

| View | Desktop | Mobile |
| --- | --- | --- |
| Home/current + future meals | [Capture](screenshots/issue-83-upcoming-desktop.png) | [Capture](screenshots/issue-83-upcoming-mobile.png) |
| Upcoming list | [Capture](screenshots/issue-83-list-desktop.png) | [Capture](screenshots/issue-83-list-mobile.png) |

- Detect a stale future-plan revision without overwriting either record; recovery
  controls remain usable outside inert editing content so the active cook can resume.
- Lose the promotion acknowledgment, confirm the original receipt before re-reading
  its removed source, and retain the exact single cooking-start timestamp.

Full CI adds real iPhone/WebKit account flows plus the existing unit, authentication,
whole-app regression and production/offline suites. The real PostgreSQL harness
covers fresh and seeded upgrades, ownership and terminal guards, revision conflicts,
immutable operation receipts, atomic import failures and actual concurrent promotion,
cancellation and per-plan save sessions. Existing v1 clients cannot erase future
plans or replace a real active cook. See the PR for exact final checks/counts.

Hosted schema verification/application is still required on dev. No Supabase
management connection is configured in this environment. Review the additive #61
migration first, then #83, and verify capabilities before account preview acceptance.
Production remains release #100 until a separate authorized promotion.
