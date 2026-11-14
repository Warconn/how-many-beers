# Personal recipes: manual regression instructions

Use the Cloudflare-confirmed feature URL and commit listed on [PR #134](https://github.com/Warconn/how-many-beers/pull/134).
Run the checklist on desktop and your phone, especially iPhone Safari. Use a test
meal and at least one saved recipe. Keep another upcoming meal and an active cook
or completed history available to check isolation. No production migration is
needed for this chooser correction. The app remains a feature preview.

## Checklist

1. **First dish, templates.** Plan a cook, set its meal name and serving time, then
   Choose a template. Review a method. Back returns to choices; Cancel adding
   leaves the meal empty. Reopen and Add to meal: exactly one dish is added, with
   the requested serving target retained. An untouched template has no recipe-save
   controls and is not automatically saved to the library.
2. **First dish, My recipes.** In an empty test meal choose My recipes. Stay in the
   meal planner. Expect template-style boxes for your saved recipes and one Add
   your own recipe box. No library management screen, URL/hash navigation, Edit,
   Remove or save buttons in the chooser. The header library is a separate path.
3. **Saved selection and Back.** Choose a saved box. Expect the existing editable
   review, with no meal-calendar or cooking controls. The meal is still unchanged.
   Back returns to the same saved choices. Choose it again and Add to meal once.
   Expect one independent dish snapshot, linked to its original saved recipe.
4. **Additional dishes.** Use + Add a dish. Switch between Choose a template and
   My recipes using the same controls as the first dish. Add a saved recipe, even
   the same one again. Only one new dish appears; existing dish edits, serving
   time and other meals are preserved. Cancel adding must add nothing.
5. **Your own text/file.** Select the Add your own recipe box. Paste steps with a
   known duration, or upload .txt/.md. Preview, edit and Back: text and edits remain
   available as appropriate. Cancel adding and reopen: the text-entry draft is
   retained. Add to meal creates one dish; it does not implicitly save a personal
   recipe. Unsupported files should show the existing honest error, not add work.
6. **Empty, unavailable and guest states.** With no saved recipes, expect the
   same Add your own recipe box. While recipes load, the text box remains available and late loading must not
   redirect you. With a failed recipe list, expect an actionable
   inline error/Reload while text creation remains available. Signed-out users
   can create and add a text dish without a forced sign-in; cloud saving remains
   an explicit sign-in action.
7. **First save and update original.** Customize a template or new method, add it
   to the meal and save it below the steps. Reorder wings oil preparation before
   its check, or edit instructions/duration. Update original recipe should update
   the same library entry. Reload and reuse it: authored edits/order persist.
   Other snapshots of the recipe must remain unchanged.
8. **Quiet saves and copies.** Open an unchanged saved recipe: no save controls.
   Changing only a planned meal date/time must not expose recipe saves or alter
   duration/actuals. Make a reusable edit: Update original / Save as copy appear
   together below the step list. Copy suggests a distinct editable _1/_2 name;
   an existing name is rejected. Saving the copy preserves the original and links
   only this meal dish to the new recipe.
9. **Header management.** Header My recipes still opens the dedicated library. It must not
   offer Add your own recipe or pull you into a meal plan; closing it returns to
   the originating screen without creating/changing a plan. Edit/rename and Save changes, or Save as copy, then reload. Cancel discards an
   editor draft. Equipment stays a compact multi-choice checklist without Done
   or stacked selects. Remove asks for confirmation and retains the record; a
   confirmed removal disappears from both library and inline chooser. Existing
   meal dishes and history remain intact.
10. **Resume and recovery.** Reload/sign in again and verify the same meal, saved
    recipes, source association and order. Failed/lost saves must not claim success
    or create duplicates. A newer-device change must not be overwritten silently.
    Check that an active cook's progress/actuals and completed history remain
    unchanged. Continue cooking through Hold → Finish and Cook Again; the new
    cook is independent. Offline/reconnect must retain protected work. A locked
    or conflicting upcoming plan keeps exactly one existing Home escape.

## Automated coverage

| Manual checks | Existing/new regression coverage |
| --- | --- |
| 1–4 | `e2e/auth/personal-recipes.spec.ts`: “Add dish uses template-style…”; `e2e/empty-planner.spec.ts`, `e2e/recipe-first.spec.ts`, `e2e/serving-first.spec.ts` |
| 5 | Personal-recipes “an empty inline recipe picker…”; `recipe-details`, `recipe-extraction`, `imported-duration-ux`, `imported-timing`, `cook-journeys` browser specs |
| 6 | Personal-recipes “loading saved recipes…”, “a failed saved-recipe list…” and “a guest chooses…”; existing guest sign-in and missing migration cases |
| 7–8 | Personal-recipes saved-template/open-step/wings-order/update-original/named-copy/date-only/reload cases; `tests/recipeLink.test.ts` and document adapter suites |
| 9 | Personal-recipes library edit/rename/copy/Cancel/retained-removal and equipment tests; inline chooser test checks removed records are absent while snapshots survive; “header recipe management has no meal-creation shortcut…” covers empty/populated libraries opened from Home/planning |
| 10 | Personal-recipes lost-reply/conflict/fresh-session/active-cook tests; `e2e/auth/upcoming-plans.spec.ts`, `cancel-account.spec.ts`, account/auth suites, production offline suite and `cook-journeys.spec.ts` |

The common `e2e/helpers/recipeEntry.ts` checks that text entry uses the inline
picker and never the management page. Browser suites cover desktop, narrow phone
and iPhone/WebKit. Tests use synthetic accounts/RPC fixtures; disposable PostgreSQL
separately checks ownership, receipts, validation and races. The checklist remains
owner acceptance on the real feature preview, not a claim of physical-device or
hosted-service testing from mocks. PR #134 records exact-head results and any retries.

For developers, the focused gate is
`npm run test:fast -- --config=playwright.accounts.config.ts e2e/auth/personal-recipes.spec.ts`.
The complete gate is `npm run test:full` after locked dependency/browser setup in
AGENTS.md. Real SQL checks use `scripts/test-account-security.sh` against disposable
local PostgreSQL only. Never use the manual checklist as a replacement for E2E
coverage or run these fixtures against a hosted Supabase project.
