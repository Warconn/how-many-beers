# Approved recipe-first planning

The owner approved this flow and requested the regular dev URL use it. Planning now lives at `/`; `/recipe-first/` redirects to `/` for old bookmarks. Feature previews may still use isolated flows while under review. Dev integration must not require a special side URL. This does not implement a personal recipe library or change hosted storage.

## Try the flow

1. Open `/` and Plan a new cook (or account Plan another cook).
2. Pick a method-labeled template or paste/upload recipe text. The first dish comes
   before the serving-time form. Existing plan dates remain intact when adding dishes.
3. Review the method's name/equipment and existing duration estimates. Drag its collapsed grip to reorder, or focus the grip and use Up/Down keys.
   Edit a step for its title/instructions/duration or removal. Add a step as needed.
   Condition checks retain their guidance; estimates never imply safe doneness.
4. Add to meal to commit through the existing persistence mechanism. A failed save
   retains the review. Back/Cancel leaves the meal untouched; Home asks before
   discarding an open review. App-update reload and sign-out are guarded mid-review.
5. Set serving time in the existing planner and add more dishes using the same flow.
   Normal cooking, independent upcoming plans and saved history remain unchanged.
6. Past cooks → Cook again creates the full historical meal as a new plan. It skips
   mandatory recipe review and never replaces an active cook.

## Isolation and limits

A React context enables only the experimental route. The review component and
shared step controls serve recipe review and meal planning; a helper grafts an
unstarted single-dish draft into its target meal, excluding fabricated cooking
activity and rejecting cross-dish overrides.
The existing template generator, parser, editing/reordering helpers, planner,
Beerometer and account save mechanisms remain the source of behavior.

Review edits are an in-memory uncommitted form until Add to meal, protected by the
normal leave guard. They are not falsely labeled as saved reusable recipes. Existing
meal saves/history are preserved in their existing formats. Feature accounts share
DEV data with dev; use disposable test cooks. Guest trial limits remain unchanged.
The review route requires a connection to reopen; the existing offline shell covers
the ordinary homepage. Existing saved meal data remains compatible with that path.
External sign-in callback navigation still uses the accepted `/` return path; reopen
`/recipe-first/` for the experiment after a callback. Email-code sign-in stays inline.

No fake Your recipes library or Save as recipe action is exposed. Recipe library
persistence and intentional saved-copy updates remain the separate next slice after
flow review. If the owner rejects this experiment, close/revert this PR; no database
cleanup or lifecycle rollback is needed. Keep #103 open until the complete approved
outcome is delivered. URL import, notifications, new bundled methods and #101 phases
are out of scope.

## Validation

Targeted desktop/mobile tests exercise template tailoring/cancel, extracted imported
times, independent dishes, and the unchanged ordinary planner. Account browser tests
cover an active 5-of-8 cook while reviewing/saving a future meal and Cook Again of a
two-dish meal with history/progress unchanged. Unit coverage verifies no current
actuals/serving target mutations, rejected actuals/duplicate IDs/foreign overrides,
known template estimates and uncommitted draft isolation.

Use PR CI for final full-suite results and iPhone/WebKit captures. The local machine
uses system Chromium with video disabled in untracked local configs because the
Playwright ffmpeg binary is not installed here; CI retains normal video/trace policy.

Actual desktop and mobile captures were opened and inspected after simplifying the
review to one Edit action per row, with known template estimates and condition
guidance retained:

- [Desktop method review](screenshots/issue-103-method-desktop.png)
- [Mobile method review](screenshots/issue-103-method-mobile.png)
- [Mobile two-dish meal](screenshots/issue-103-meal-mobile.png)

Local typecheck, all 372 unit tests, fourteen desktop/mobile prototype browser cases,
and three focused desktop account journeys passed. The Cloudflare static export
build passed and includes `/recipe-first/`. Full PR CI and actual iPhone/WebKit
captures remain the final validation gate. No hosted migrations were applied.

Resubmitting a protected add also retains the original dish/custom-step creation
timestamps during an active cook; replay never restarts that timing anchor.

Owner review refinement: condensed row/footer spacing, put Edit beside the estimate,
and renamed the experimental choices Choose a template / Add your own recipe.
The latter explicitly supports writing steps, pasting or uploading text. Grips
support mouse/touch pointer capture with an insertion marker and edge scrolling;
rows commit their new order only on drop. Keyboard Up/Down works without an editor,
retains focus, and announces position. Move controls were removed from the editor.
The pointer test uses native CDP touch on mobile Chromium and mouse pointer input
on desktop/WebKit; a physical iPhone touch check is still useful during owner review.

## Latest visual refinement

The method review shows smaller instructions directly under each step, with the
estimate beneath the title and a quiet Edit action alongside. Only text exceeding
five rendered lines gets Show more / Show less; expansion preserves the complete
instruction, and the decision updates with the available width. Short instructions
need no disclosure. Grips and existing timing reflow are unchanged.

Removed the review's generic guidance footer and Method reference disclosure.
Original recipe text, step instructions and source data are retained. The extra
setup borders/padding and separate Cancel row are removed; name and equipment share
a row on desktop. On this prototype, Review Meal Plan / Hide Meal Plan and the
Meal plan heading clearly name the combined plan for every dish. The ordinary `/`
labels and accepted layout remain unchanged.

Browser checks cover short instructions visible immediately, long instruction
expansion/collapse without data loss, template and imported dishes together in the
Meal plan preview, and retained mouse/touch/keyboard movement.

The same step controls now extend into the meal's dish editor and combined Meal
plan preview: grip at left, Edit at upper right, supporting information beneath
the heading, and Remove inside the open editor with Save/Cancel. See the reusable
[step-row action standard](design-system.md#reusable-step-rows-and-actions-103-review).
Dragging uses the existing timing reflow and saving path; it changes only the
selected dish sequence and retains actual activity and other dishes. The accepted
root page and Cooking Mode are unaffected.

Actual shared-control planner captures:

- [Desktop planning rows](screenshots/issue-103-planning-actions-desktop.png)
- [Mobile planning rows](screenshots/issue-103-planning-actions-mobile.png)
- [Desktop editor actions](screenshots/issue-103-planning-editor-desktop.png)
- [Mobile editor actions](screenshots/issue-103-planning-editor-mobile.png)
