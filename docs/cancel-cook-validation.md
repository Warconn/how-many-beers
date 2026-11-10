# Retained cancellation (#61)

> **Current status, November 9:** Retained cancellation is implemented in dev through PR #104. Keep #61 open for production verification. Both November 5 migrations are owner-confirmed verified in dev. Production schema readiness remains a separate release gate; no hosted changes are authorized here. Earlier implementation/rollout notes below are historical.

Implementation is proposed for dev; no hosted migrations, merges or production
changes have been made. Production remains release #100. The UI uses native modal
focus trapping, safe default Keep cooking, Escape dismissal, pending-write protection
and a distinct secondary Cancel cook action on Home/in cooking tools.

Actual [desktop](screenshots/issue-61-cancel-desktop.png) and
[mobile](screenshots/issue-61-cancel-mobile.png) captures were opened and inspected
for hierarchy, density, readable copy and touch targets. The cook stays visible
behind the confirmation; optional tools remain absent from the current action.

Local typecheck and 300 unit tests pass. Targeted browser checks cover durable
legacy cancellation/reload/history/new cook, account receipt acknowledgment,
lost-response reload/retry, server-capability gating and temporary guest behavior.
Full CI adds iPhone/WebKit, authentication, account, regression and production/offline.
Real PostgreSQL clean+seeded upgrades and concurrent cancel/save/finish tests passed
225 assertions; ownership, terminal resurrection protection and original timestamps
were checked. See account-cooks.md for migration/capability rollout and rollback.

New trials retain cancellation only in memory. Legacy canceled records are retained
under a separate key and included in additive v1 backups; omitted older backup data
cannot erase them. Account canceled rows and events remain on the server outside
normal active/history snapshots. No canceled-history/restore interface is introduced.
