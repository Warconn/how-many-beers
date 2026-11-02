# Application visual pass (#21): review evidence

Baseline: dev `4577b01`, identical application content to production release #96
(`925cbac`). Main contains only the additional release merge commit; there were no
unmerged remote PRs at kickoff. No production merge is part of this work.

## Reconciliation

Confirmed shipped development tickets #92, #84, #62, #85, #77 and #86 are closed
completed, with release/PR/test evidence added to their issue descriptions. #87 is
already a closed historical queue and its description now points to the new
baseline. #21, #61 and #83 remain open in the approved order. No manual QA or
acceptance-testing tickets were created.

[#97](https://github.com/Warconn/how-many-beers/issues/97) is a focused development
follow-up: the existing visible physical Start/log controls still compete with a
simple checkbox journey. #84's layout/progress/finishing scope remains complete.
Recommend coordinating #97 with the polish sequence as a separate functional PR,
not hiding the problem or changing actual-start semantics in #21.

## What changed

Shared functional-view typography, 4 px spacing scale, warm surfaces, control
radii, semantic text colors, 44 px control targets, readable 16 px fields, focus
rings and reduced-motion behavior. A small original round-stroke SVG family
replaces decorative emoji and mixed navigation/move/remove/account symbols.
History uses shorter copy, a truthful empty-state action and unwrapped mobile
buttons. The approved logo, accepted layouts, short editor and state transitions
remain the foundation. See [design system](design-system.md).

## Before/after screenshots

Actual local desktop and phone images were opened and inspected for type, spacing,
information density, wrapping and action hierarchy. These are review artifacts,
not new pixel-test goldens.

| View | Desktop before / after | Phone before / after |
| --- | --- | --- |
| Planning | [Before](screenshots/issue-21-planning-desktop-before.png) / [After](screenshots/issue-21-planning-desktop-after.png) | [Before](screenshots/issue-21-planning-mobile-before.png) / [After](screenshots/issue-21-planning-mobile-after.png) |
| Active cook | [Before](screenshots/issue-21-cooking-desktop-before.png) / [After](screenshots/issue-21-cooking-desktop-after.png) | [Before](screenshots/issue-21-cooking-mobile-before.png) / [After](screenshots/issue-21-cooking-mobile-after.png) |
| History | [Before](screenshots/issue-21-history-desktop-before.png) / [After](screenshots/issue-21-history-desktop-after.png) | [Before](screenshots/issue-21-history-mobile-before.png) / [After](screenshots/issue-21-history-mobile-after.png) |
| Empty planner | [Desktop](screenshots/issue-21-empty-planner-desktop.png) | [Phone](screenshots/issue-21-empty-planner-mobile.png) |
| Empty history | [Desktop](screenshots/issue-21-empty-history-desktop.png) | [Phone](screenshots/issue-21-empty-history-mobile.png) |

Separate Beerometer screenshots were inspected and computed color, typography,
spacing, border and radius styles compared for every descendant in planning and
cooking, at desktop and phone sizes. All four computed-style comparisons match
the released baseline; values/metrics also agree. Raster antialiasing/page placement
can differ, so the region captures are evidence rather than cross-platform goldens.
Its component, existing CSS, artwork and domain calculations have no changes.

## Tests

- TypeScript and all 276 unit tests pass.
- 38 final focused desktop/mobile checks pass: design-system behavior, contrast,
  keyboard focus, readable fields, error state, reduced motion, empty views,
  current cook/actual preservation, history, save/resume and duration reflow.
- Earlier 36 focused desktop/mobile checks also passed for branding, step editing,
  reorder and Cooking Mode layout, including completed and reopened states.
- Six focused account checks pass with the existing mocked backend, desktop and
  iPhone-sized Chromium: fresh-context recovery, finished history/actuals and
  unrestricted planning sequence/duration persistence. Real WebKit is required in CI.
- New design assertions were first run against the released application and failed
  on missing shared icons/type consistency and history emoji. Before images are
  from that baseline, not reconstructed mockups.
- Full PR CI must include Chromium, real iPhone/WebKit, authentication, accounts,
  regression and the production/offline build. Final evidence belongs in the PR.

No domain, account/auth logic, storage schema, Supabase migration or data ownership
changes are included. [Lifecycle planning](cook-lifecycle-plan.md) is investigation
only. #97 remains an explicit functional limitation; no claim is made that optional
physical-start and logging controls have been removed from normal cooking.
