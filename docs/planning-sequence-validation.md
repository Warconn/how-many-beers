# Unrestricted planning sequence validation (#92 refinement)

The owner rejected template-phase restrictions after reviewing #93. Planning now
allows every dish step to move, with subsequent free starts based on preceding
known durations. Fixed and recorded anchors remain in place with named conflicts.
Readiness checks remain manual, and physical cooking time is not consumed merely
by checking off a loading action. See [timing contract](step-timing.md).

## Local evidence

- The new move reproduction fails on both desktop and mobile against dev
  `4f48697`: the cook step stays below preheat and the rejected phase message appears.
- Final typecheck and 276 unit tests pass. Coverage includes every adjacent move
  across all seven templates, unequal durations, fixed/unknown timing, added dish
  and General prep steps, old-data compatibility, actual starts, overrun/reopen,
  imported roast/cooling, wings rest, archive/backup and Cook Again ID remapping.
- 46 targeted desktop/mobile browser checks pass across planning reorder, duration
  reflow, imported timing, step editing and live execution forecasts.
- Four focused account browser checks pass on desktop and an iPhone-sized Chromium
  profile, including unrestricted moves, edited duration, reload, other-dish
  isolation and unchanged history. Real iPhone WebKit and full authentication,
  account, regression and production/offline suites are required in the PR CI.
- Beerometer component and styling are unchanged. Reordered-plan forecasts use
  the same sequential assumptions for the card, upcoming action and whole cook.

## Screenshot review

Actual local application screenshots were inspected at desktop and phone sizes.
The phone plan shows the changed 150-minute cook followed by the updated preheat
start; the desktop Live Schedule agrees. Cooking retains one clear current action,
its duration/finish, and the next check's “Check when ready” label.

| Scenario | Desktop | Phone |
| --- | --- | --- |
| Old rejected move | [Before](screenshots/issue-92-flex-before-desktop.png) | [Before](screenshots/issue-92-flex-before-mobile.png) |
| Move + duration edit | [After](screenshots/issue-92-flex-after-desktop.png) | [After](screenshots/issue-92-flex-after-mobile.png) |
| Cooking + actual start + reload | [Cooking](screenshots/issue-92-flex-cooking-desktop.png) | [Cooking](screenshots/issue-92-flex-cooking-mobile.png) |

## Deliberate limits and compatibility

The chosen order is authoritative, including serving or readiness checks in unusual
positions. Instructions and food-safety guidance remain visible; estimates cannot
verify doneness. Unknown work still needs an estimate for a precise finish.
Unedited/older plans retain their original timing. A new planning move opts that
dish into the sequential model, which can replace overlapping template allowances
with sequential work. General prep is separate. This does not add cross-dish
resource optimization or modify production. CI/deployment evidence is recorded in
the PR; local account tests use the existing mocked account backend.
