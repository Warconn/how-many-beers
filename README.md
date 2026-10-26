## Production release and outstanding UX bugs (October 26, 2026)

Core Cook Experience release [PR #29](https://github.com/Warconn/how-many-beers/pull/29) reached `main` at `3e7868d`; user confirmed the GitHub Pages production site reflects the release. Current capabilities include Home/resume, Guided Planner, unified template/text-import Add Dish, expandable step controls, and CI Playwright. This is a functional baseline, **not a polished finished planner**.

Production bug backlog:
- [#28](https://github.com/Warconn/how-many-beers/issues/28): Overhaul adding/editing dishes and layered step management. Clarify Add vs contextual Edit and reduce scroll/state confusion.
- [#30](https://github.com/Warconn/how-many-beers/issues/30): Make live combined schedule directly selectable/editable, sync dish changes, preserve recorded actual timestamps. Do not confuse with full dependency optimization (#3).
- [#31](https://github.com/Warconn/how-many-beers/issues/31): Remove redundant Ready When You Are card; replace with compact Start/Continue and preserve warnings.

Next delivery cycle: product decisions and acceptance tests here, implementation via Codex and feature branches, run TypeScript, unit, Playwright and build before PR to `dev`, approve green CI then merge to `dev` for Cloudflare preview, and promote reviewed candidates to `main`. Current Cloudflare Git integration still triggers on `dev` pushes; deployment gating is planned, not configured. Tests should cover both browsers and responsive layouts, refresh/resume and history retention.

## Inline dish step planning (October 26, 2026)

The Guided Cook Planner now treats planning as editable by default. Each menu dish has an expandable list of its own steps, rendered using the existing task editor. Users can edit/remove/reorder those steps and create a custom unscheduled step attached to that dish; the shared Live Schedule continues to be derived from the combined cook state. Templates and recipe imports remain accessible through Add a dish. The former Edit/Done Editing menu toggle is no longer used for step adjustments; advanced equipment and duration settings remain available on demand.

### Test-first acceptance criteria
- Expand brisket steps without opening or mutating brat details.
- Add a custom step to brisket; it remains attached to brisket and survives refresh.
- Task edits preserve existing IDs and recorded completion events.
- The Live Schedule reflects changes to the combined timeline, with unscheduled steps identified as such.
- Verify desktop and mobile flows in Playwright before release.

The compact Start Cooking and complete cooking-mode redesign are separate follow-up work. Only promote `dev` to `main` after green CI and visual review.

## Add Dish consolidation (October 26, 2026)

The Add Dish editor now has two choices inside one surface: **Start from template** (existing starter methods) or **Import a recipe** (paste instructions or upload a .txt/.md file). Selecting an existing dish remains an Edit action on the menu card. The separate full-page Import a Recipe section has been removed to keep the Guided Planner focused. URL import is not yet implemented and must not be presented as a working feature.

Acceptance checks: switch methods without affecting the meal, import a named set of steps, add a template alongside it, verify both dish cards and one schedule, and preserve the cook on reload. Remaining polish is tracked in issue #28.

# How Many Beers? 🍺

**Dinner has a deadline. Brisket does not.**

**Live app:** https://warconn.github.io/how-many-beers/  
**Issues / roadmap:** https://github.com/Warconn/how-many-beers/issues

How Many Beers? is a mobile-first cooking companion that turns a desired **serving time**, curated cooking methods, and user recipes into a **single actionable checklist**. It helps you plan, cook, record what actually happened, and eventually learn from previous sessions.

The experience should feel closer to an intelligent cooking checklist than a recipe blog, generic AI conversation, or complicated project-management app.

> **Status: working public prototype, not a complete MVP.** Source is public, hosted as a static Next.js export on GitHub Pages. All feature claims below distinguish *working today* from *planned or partially built*. We are not designing pricing or premium tiers here.

## Product vision

**Current direction (October 25, 2026): Experience first.** How Many Beers is a cook management companion. Templates and timing intelligence support the cook experience, rather than defining the primary navigation. Our next milestone is [Core Cook Experience v1](docs/core-cook-experience.md): Home/resume, a cook workspace with multiple dishes, one shared timeline, and focused Cooking Mode. This new direction supersedes conflicting older roadmap priorities below.


**“Tell us what you're making and when you're eating. We'll figure out the game plan.”**

Four continuous experiences:

1. **Plan:** Choose a serving time, add dishes, select a trusted template or import a recipe, adjust equipment/quantities, and review an editable schedule.
2. **Cook:** Tap **Start the Cook**. The checklist becomes the primary phone interface. Complete tasks, log readings, make notes, and adapt to real-world progress.
3. **Remember:** **Finish & Save Cook** preserves planned steps and actual events, plus optional outcome notes. Browse and repeat previous sessions.
4. **Improve:** Combine documented cooking methods with *comparable* historical sessions to offer better future timing windows with clear assumptions.

**Model:** One *active cook* can contain several dishes, steps and pieces of equipment. A user can save multiple *completed cooks*. Dishes are not independent cooking sessions. Archived history is **device-local**, so export a backup before clearing browser data or switching devices.

## Product principles

- **Checklist is the hero.** Cooking Mode should hide most setup controls, emphasize the next meaningful action, and show completed steps without clutter.
- **Dinner-time-first.** Schedule backward from a target date/time with real dependencies, safety checks, buffers and uncertainty ranges.
- **Make real cooking easy.** A note, reading, edit or completion can automatically establish the first start event. No needless “Start Step” ritual.
- **Be credible, not overconfident.** “Expected wrap/check” is not an exact deadline. Brisket stall, doneness and safe holding cannot be guaranteed by time alone.
- **Preserve reality.** Planned times, actual events, measurements, changes, and outcome notes are different kinds of data. Replanning must not rewrite history.
- **Useful without AI.** Curated templates, editing, scheduling, logs and past sessions should remain functional without an external model.
- **Human confirmation for imports.** Extracted methods, durations and temperatures are draft suggestions until reviewed.
- **Mobile first, with resilience.** Big tap targets, outdoor readability, safe local persistence and recovery, and eventual offline support.
- **Respect source material.** Link to trusted public recipe references, don't republish proprietary recipes, and don't imply a source endorses the app.

## What works today

As of the latest reviewed source code:

| Capability | Status | Notes |
| --- | --- | --- |
| GitHub Pages static app | **Working** | GitHub Actions publishes a Next.js static export |
| Planning / Cooking Mode | **Working** | Setup stays separate from the live checklist |
| One active cook with multiple dishes | **Working** | Currently saved on the same browser/device |
| Set serving date/time and inspect one timeline | **Working** | Backward-offset schedule, not a full resource planner |
| Add, rename, remove, reorder checklist steps | **Working** | Task IDs and history preserved |
| Step completion, notes and timestamped readings | **Working** | Food and equipment readings, with auto-start event logging |
| Beerometer | **Working** | Total planned/actual start-to-finish duration converted to beers, not time remaining |
| Four curated starter templates | **Working, initial methods** | Meat Church pellet brisket and smoked-fried wings; Traeger grilled beer-bath brats; USDA unstuffed oven turkey; editable assumptions and cited sources. Extra variants tracked in #18 |
| Ribs, chicken and oven-side starter templates | **Basic** | Editable placeholders |
| Plain-text recipe paste / .txt / .md | **Basic** | Line-by-line extraction, not yet reliable recipe understanding |
| Temperature-informed live ETA/replanning | **Not yet** | Steps can be adjusted manually |
| Finish, archive, review and repeat cook sessions | **Working in current implementation** | Browser-local completed sessions with frozen checklists, actual events, optional outcome notes, repeat, delete and JSON backup/restore |
| Weight-aware researched estimates | **Not yet** | Current durations are user-editable placeholders |
| Accounts and cloud sync | **Not yet** | Optional Supabase Auth/Postgres planned in #19; migration and offline sync in #20 |
| URL import / photo/PDF | **Not yet** | Secure server-side ingestion would need a separate API |

**Important:** Existing template cook durations and milestones are starter estimates. Stage references still need validation. A cook is not guaranteed done because a scheduled task time has passed.

## MVP: what “useful enough to share” means

The first proper release should let a cook move clearly from Home to their meal workspace, add several dishes, use a unified timeline, follow Cooking Mode, and resume the same session later. The four starter methods and cook history are already implemented. Advanced estimates and resource scheduling remain later enhancements.

### Must-haves

- [x] One cook with multiple dishes, target serving date/time and an editable checklist preview.
- [x] Focused Cooking Mode with completion tracking, notes, readings and activity timestamps. **[#1](https://github.com/Warconn/how-many-beers/issues/1), closed.**
- [x] Finish, explicitly save, browse and **repeat a previous cook** without destroying its history. **[#8](https://github.com/Warconn/how-many-beers/issues/8).**
- [x] Deliver four sourced starter methods: **pellet brisket, smoked-fried wings, grilled beer-bath brats, and unstuffed oven turkey**. Editable timing assumptions and safe condition checks are included. **[#7](https://github.com/Warconn/how-many-beers/issues/7).** Alternate methods are tracked under **[#18](https://github.com/Warconn/how-many-beers/issues/18)**.
- [ ] **Later, after the core experience:** Make brisket timing input intuitive: weight/cut, smoker temperature, reasonable duration **range**, buffer, safe rest/hold and manual overrides. **[#5](https://github.com/Warconn/how-many-beers/issues/5).**
- [ ] **Later, after the core experience:** Display sensible dependencies and at least basic late/early plan adjustment; do not imply competing oven/grill resources can perform incompatible work simultaneously. **[#3](https://github.com/Warconn/how-many-beers/issues/3).**
- [ ] Preserve data safely across refresh and browser use, with a recovery/export path and realistic mobile/offline behavior. **[#10](https://github.com/Warconn/how-many-beers/issues/10).**
- [ ] Add optional login, private cloud persistence and automatic safe cross-device resume before the broader public beta. **[#19](https://github.com/Warconn/how-many-beers/issues/19), [#20](https://github.com/Warconn/how-many-beers/issues/20).**
- [ ] Real mobile usability tests, food-safety review, clear privacy/storage notices and user feedback. **[#4](https://github.com/Warconn/how-many-beers/issues/4).**

**MVP acceptance test:** Plan a brisket and a side for 3 PM, preview the merged schedule, cook from a phone, check off tasks and log a wrap temperature, finish/save the cook, review its actual timeline tomorrow, then repeat it with a new serving time. No account or paid AI service required.

### Wants: strong follow-ups, not blocking the MVP

- **Recipe URL import**, followed by user review and checklist generation, with text fallback. This comes *before* photo/PDF import. **[#2](https://github.com/Warconn/how-many-beers/issues/2).**
- Smarter on-the-fly recalculation for variable stages, conflicts and risks. **[#3](https://github.com/Warconn/how-many-beers/issues/3).**
- Timers, overdue steps, optional notifications, and clear Now / Next / Later grouping. **[#11](https://github.com/Warconn/how-many-beers/issues/11).**
- Remembering equipment profiles, heat settings, warmup and capacity. **[#12](https://github.com/Warconn/how-many-beers/issues/12).**
- **History-informed schedule suggestions** with transparent evidence and uncertainty, e.g. a 15 lb brisket compared with previous cooks and published method standards. **[#6](https://github.com/Warconn/how-many-beers/issues/6).**
- **Visual polish and branding:** replace decorative emoji and generic card styling with a cohesive minimal design system, consistent icons and subtle custom low-poly/geometric artwork. This is a **wants/polish** item, not a blocker for #5 or #19/#20. **[#21](https://github.com/Warconn/how-many-beers/issues/21).**

### Future state: worthwhile, but not necessary to validate the idea

- Photo/PDF/handwritten recipe extraction. **[#9](https://github.com/Warconn/how-many-beers/issues/9).**
- Voice activity updates with review before saving. **[#13](https://github.com/Warconn/how-many-beers/issues/13).**
- Smart probe/thermometer integrations. **[#14](https://github.com/Warconn/how-many-beers/issues/14).**
- Shared household cooking and invited helpers, after personal accounts and sync. **[#15](https://github.com/Warconn/how-many-beers/issues/15).**
- Ingredient/grocery planning, quantity scaling, meal-prep and optional estimated macros. **[#16](https://github.com/Warconn/how-many-beers/issues/16).**
- A context-aware cooking coach that explains options using observed temperatures and trusted recipe baselines, without autonomously changing a cook. **[#17](https://github.com/Warconn/how-many-beers/issues/17).**

See [all tracked issues](https://github.com/Warconn/how-many-beers/issues) for acceptance criteria. Long-term features are organized into manageable issues rather than treated as requirements for the first useful release.

## Guided Cook Planner increment (October 26, 2026)

The workspace now prioritizes planning actions over a full-width timeline. At desktop sizes it provides a **planning column** (meal name and serving time, dish menu, selected dish editing, readiness and checklist review) alongside a **sticky Live Schedule** companion. The schedule shows four upcoming chronological planned steps by default, with a Show full schedule control. At smaller widths, the columns stack to keep planning controls first.

This release reuses existing cook/session persistence, templates, step actions and cooking mode. The schedule is derived from the same timeline data, not separately persisted. Playwright now covers sidebar placement, responsive stacking and expand/collapse behavior. Follow-up refinements: collapse the detailed checklist preview by default, strengthen per-dish step editing and validate the flow on real devices. Promotion to `main` requires a green CI run, review of visual screenshots and acceptance of the full plan-to-cook journey.

## UX test-driven development

For each core UX increment, follow a red/green/review loop:
1. Write a user-journey Playwright test expressing the intended result, including return navigation and persisted data.
2. Confirm the new test fails for the missing behavior before implementation (red).
3. Implement the minimum coherent experience, retaining existing cook data, history, and event semantics (green).
4. Run Vitest, Playwright for desktop and mobile, plus layout assertions and screenshot capture.
5. Review the generated visual report, accept intentional changes, and only then promote the stable release from `dev` to `main`.

On every push to `dev`, GitHub Actions runs the browser regression suite. Failed traces and screenshots plus per-run screenshots are attached as artifacts. Browser geometry assertions guard the Home layout; pixel-based golden screenshot baselines are a later step and should be approved deliberately.

### Current UX increment: template picker and isolated dish edits

- A cook contains any number of dishes; each is created from a starter template.
- `Add or edit dishes` reveals a separate template-picker surface, not a single enormous settings form.
- Adding a second dish does not replace the first, and one combined timeline remains visible.
- An explicit Edit action on a dish opens **only that dish's** settings.
- Returning Home and refreshing preserves the full menu and cook state.
- Still deferred: dish-level editable step restructuring, recipe intelligence, cross-device sync, and advanced timing predictions.

Acceptance tests live in `e2e/cook-flow.spec.ts`. GitHub workflow: `.github/workflows/browser-tests.yml`.

## Prioritized delivery sequence

**Updated October 25, 2026:** [Core Cook Experience v1](docs/core-cook-experience.md) is the immediate milestone. The previous #5-first roadmap is superseded.

1. **P0.1 Home and resume:** Show existing or in-progress cook prominently; safe start-new flow.
2. **P0.2 Cook workspace:** Organize multiple dishes inside one cook, with a clear merged timeline.
3. **P0.3 Add dish and edit:** Templates seed individual dishes; their steps are editable in context.
4. **P0.4 Focused Cooking Mode:** Clear Now/Next/Later execution and simple navigation back to overview and Home.
5. **P1 Reliability and UX validation:** Retain cook history and event records, improve data safety (#10), and test on real phones (#4).
6. **P2 Product expansion:** Optional account/cloud sync (#19/#20), weight-based brisket estimates (#5), sophisticated dependencies (#3), URL imports (#2), history-informed timing (#6), and full branding (#21).

Existing checklist, starter templates and saved cook features (#1, #7, #8) are reusable foundations, not features to rebuild. Avoid specialized brisket intelligence, new template variants or cloud infrastructure as prerequisites for this UX milestone.

## Example journeys / acceptance scenarios

### Overnight brisket, the primary reference case

- User adds a whole packer brisket and serving time, plus smoker settings and a rest/hold preference.
- App uses sourced *stage guidance* and a conservative duration window; later versions use meat weight and comparable prior cooks.
- Checklist includes trim/season, preheat, cook, bark/stall checks, optional wrap, temperature/tenderness checks, monitored safe hold, slice and serve.
- User logs that the flat reads 169°F, wraps, raises pit temperature, and completes steps at actual times.
- The schedule may show dinner as at risk, but **does not assert a guaranteed stall exit or doneness time**.
- After serving, user saves the outcome and can use it when cooking a different-sized brisket.

### Turkey with multiple methods and dishes

- Oven roast turkey and side dishes share a serving time; oven conflicts are visible.
- Different turkey methods (roast, smoke, deep fry) have their own instructions and validated safety requirements.
- Thermometer checks are explicit conditions, not merely scheduled completions.
- A user may adjust one dish without erasing actual events from another.
- The app does not equate poultry color or cook duration with verified 165°F in the required locations.

### Recipe from a public URL

- User submits a permitted public recipe URL; backend prefers structured `schema.org/Recipe` data where available.
- Parsed ingredients, stages, temperatures, equipment and durations appear as **editable draft data** with original source link.
- Unclear durations remain unknown; user can fix them, then add that recipe to the active cook.
- The app handles inaccessible sites gracefully, and does not redistribute protected recipe content.

### Recovery and saved history

- During a cook, user refreshes and reopens the browser: recorded events and notes remain.
- User finishes and saves a session, starts a new cook, and can still view/clone the old session.
- Changed serving time recalculates future planned times but never changes actual timestamps.
- If local storage fails or is unavailable, the app must warn, not falsely claim successful persistence.

## Architecture: current and proposed

### Current implementation

- **Frontend:** Next.js App Router, React, TypeScript, mobile-first CSS.
- **Host:** Public GitHub Pages via `output: "export"`, with `/how-many-beers` as `basePath`.
- **Data:** Browser-local storage for one active cook and saved history, plus JSON backup/restore. Writes are attempted on changes but are not cloud-backed or guaranteed durable. Optional accounts and sync are planned under #19/#20.
- **Schedule:** Basic TypeScript backward-offset timeline and stage-based templates. It is not yet a true dependency/resource scheduler.
- **Tests:** Vitest domain tests; GitHub Actions typecheck, tests and static build.
- **Security:** No publicly exposed model/API secrets are required for manual planning and local logging.

### Planned private account storage, without changing frontend hosting

Recommendation: keep the static GitHub Pages app, add **Supabase Auth + Postgres** as a browser-accessible backend for optional signed-in cooks. This is **planned, not yet connected or deployed**. A user can remain a guest with local device-only saves. GitHub Pages does not need to run a Next.js server for browser-based Supabase Auth and database requests.

- **#19, account/schema:** Provide familiar social sign-in, prioritizing Google and Apple, with email code/magic-link recovery and Facebook as a requested option to evaluate. Test callbacks at the GitHub Pages project path. Support securely linking multiple verified sign-in identities to one account, avoiding fragmented cook history. Create owner-scoped cook sessions, append-only activity events and optional preferences. Enforce Row Level Security for read/write with cross-account tests; never expose service-role/secret keys in the public repo or frontend.
- **#20, local-first sync:** Save each critical action to durable local storage first, then enqueue it for the signed-in user's cloud archive. Debounce frequent notes. Show **Saved on device**, **Syncing**, **Saved to account**, or **Needs attention**, rather than falsely claiming success. Replay an offline outbox with stable event IDs and retries; preserve actual event timestamps.
- **First login migration:** Detect existing local active cook and archived history and let the user preview and deliberately import or keep local. Do not erase the guest cook or silently replace a newer cloud cook. Duplicate event IDs are idempotent.
- **Conflict policy:** One active cook per owner, many completed ones; append-only activity merges by ID, editable plan state uses revision/optimistic concurrency. When two devices change the same plan, prompt instead of last-write-wins. Make account switching/logout clear private local caches.
- **Storage model:** Versioned sessions hold serving date/time and IANA timezone, dish weight/cut/smoker/method, planned timeline snapshot, estimator assumptions and revision; events retain separate actual occurredAt and cloud receivedAt. Saved sessions remain frozen for repeat/history. Account deletion and export must be supported.
- **Offline/PWA (#10):** Move toward IndexedDB for queued events and cooking sessions, support offline checklist and recover from reloads, quota failures and interrupted writes. Until implemented, local browser data can be lost; keep using JSON backups.
- **Later collaborative cooks (#15):** Invite helpers and manage multi-user permissions only after secure personal cloud sync is working.

Supabase's free plan is useful for a prototype, but free projects can pause after inactivity and do not include managed database backups. Account/cloud persistence must not be represented as reliable production storage until backup, quota, retention, monitoring and RLS testing are addressed. References: https://supabase.com/docs/guides/database/postgres/row-level-security and https://supabase.com/pricing.

### Next boundaries we should keep clean

```text
Browser / static app (GitHub Pages)
  ├─ Plan & preview a cook
  ├─ Checklist, readings, notes, local storage / history
  ├─ Pure TypeScript scheduling and templates
  └─ User-confirmed imports, when available
          │
          ▼
Optional separately hosted API (later)
  ├─ Secure URL recipe fetching / structured extraction
  ├─ Image/PDF/voice processing
  ├─ AI explanations with bounded costs
  └─ Optional account sync and database storage
```

The frontend does **not** need to move away from GitHub Pages just to support a separate serverless recipe-import API. GitHub Pages itself cannot securely fetch arbitrary websites server-side, keep private API keys or run a dynamic Next.js server.

### Data model direction

- **Cook/session:** id, planned serving time/time zone, state (planning, active, completed), dishes, equipment references, source/provenance and version.
- **Dish:** recipe/template reference, cut/weight/quantity, cooking method, cooker, temperatures, rest/hold assumptions.
- **Step:** stable id, dish id, instructions, dependencies, nominal stage duration or min/max window, equipment, conditions, expected readings.
- **Event:** append-only timestamped action such as start, completion, reading, equipment change, note, wrap or reopening.
- **Archive:** frozen completed session snapshot plus original event stream, source versions and optional outcome feedback.
- **Recommendation (later):** source baseline, similar past cook IDs, assumptions, uncertainties and editable suggested start window.

### Cook history and backup behavior

- In Cooking Mode, **Finish & Save Cook** requests confirmation and optional outcome notes. It does not auto-complete unchecked steps.
- Saving snapshots the original planned checklist, recorded completion and start times, notes, measurements and custom tasks.
- Saving writes the archive before rotating the active cook; an interrupted rotation can be retried without duplicating the archived session.
- History supports read-only detail views, search, reuse as a clean future plan, removal with confirmation, and JSON export/restore.
- **Important:** History currently lives in this browser only. Download backups regularly. Clearing browser data, using private browsing, or switching devices can remove or hide the data. This is not cloud sync.
- The Beerometer represents the **duration from cook start to finish**, never the current-time countdown. It uses actual recorded start/finish when available, otherwise scheduled start/finish.

Never use the AI output as the authoritative state mutation mechanism. Validate structured inputs and execute scheduling logic deterministically.

## Known risks and design decisions

1. **Timing accuracy:** There is no universal “hours per pound” rule that precisely predicts brisket. We should use researched methods, bands, cut/weight details and generous buffers, with transparency.
2. **Food safety:** Differentiating recommended pit/texture checkpoints from verified safe internal temperatures and holding practices is mandatory.
3. **Storage risk:** Browser-local active state is temporary. A real history must handle migration, data export and storage errors before users trust it for valuable cook logs.
4. **Recipe copyright/access:** A public URL does not imply permission to republish content, and scraping unsupported websites can fail. Import privately and attribute sources.
5. **Notifications:** Background mobile reminders are not universally reliable from a normal web tab. An installable PWA and potentially push infrastructure need explicit investigation.
6. **Competing equipment:** Just sorting step times is not the same as verifying resource availability and compatible temperature settings.
7. **Progress vs plan:** “Step complete” is user-confirmed; time-based estimates and milestones cannot automatically assert safe doneness.
8. **Platform deployment:** In GitHub repository **Settings → Pages**, the source must remain **GitHub Actions**. Branch-based Jekyll publishing previously served README instead of the app.

## Working locally

Use Node.js 20+:

```bash
npm install
npm run dev
npm run typecheck
npm run test
npm run build
```

Open http://localhost:3000. `npm run build` generates static output in `out/`. Pushes to `main` trigger the build and publishing workflow in [.github/workflows/deploy.yml](.github/workflows/deploy.yml).

## Release checklist and feedback

Before inviting users beyond early personal testing:

- [ ] Validate the four built-in method references and temperature / holding advice.
- [x] Finish and save a cook with original checklist and actual events. Verify during a real on-phone cook before broader launch.
- [ ] Check use on real iPhone Safari, Android Chrome and desktop.
- [ ] Verify refresh, local persistence failures, nighttime timelines and time zones.
- [ ] Test with multiple dishes and incompatible oven/grill conditions.
- [ ] Write a simple local-data and privacy notice.
- [ ] Invite 5–10 home cooks and record feedback against #4.

We should track time-to-first-usable-plan, confusion about step timing, successful cook completion, repeat usage and data-loss incidents, not just page visits.

## License

The repository is **public, but no open-source license has been selected**. Public GitHub visibility does not by itself grant code reuse rights. Choose a license deliberately before accepting external contributions.

## Add and adjust dishes in the menu (#28)

Set the serving time, then use Add a dish for a template or pasted/uploaded text
recipe. Adding closes the picker and expands the new dish directly in the menu.
Click a dish header to open or collapse its steps; selecting another opens only
that dish. There is no separate Edit Dish page, card or Back to menu action.

Edit, reorder, remove and add steps inside the dish. Dish settings is a small,
collapsed disclosure for name, equipment, durations and reference settings. Changes
save as you make them and update the derived Live Schedule. Step numbering and
reordering are scoped to the selected dish. Removing a dish requires confirmation;
recorded activity remains in the cook. Remove dish is visible beside each dish
heading, including collapsed dishes, as a small trash icon with a descriptive
label/tooltip and a 44px touch target, separate from selecting/editing.
Cancelling leaves the cook untouched; removing one dish keeps other dishes and their
open editor intact. IDs and the browser storage schema are unchanged.

Direct Live Schedule editing (#30) and changes to Ready When You Are (#31) remain
out of scope. Recipe URLs are still unsupported. Cooks and history remain device-local.

## Start or continue cooking (#31)

The planner has one compact Start cooking action directly beneath the menu, with
Review checklist alongside it. The full checklist stays closed until requested.
The old Ready When You Are card, repeated serving/step summaries, and extra
Start a fresh plan footer are removed. New cook replacement remains available from Home.

An empty plan or invalid serving date explains why starting is disabled. An active
cook instead shows Continue cooking, which returns to the saved checklist without
changing its start time, notes, completion records or events, even if its plan now
has no valid serving time. Equipment conflicts, untimed-step notices, and the
food-safety reminder remain visible in Plan notes beneath the actions. Warnings
are guidance, not automatic proof that a cook is safe or ready.

No schedule editing (#30) or Remove dish discoverability changes (#33) are included.

## Edit step timing and details (#30)

Edit a step directly in its dish or select it in Live Schedule. The shared inline
editor now includes planned date/time, estimated duration, equipment and an optional
food-temperature target as well as name and instructions. Save/Cancel is explicit.

A manually edited time stays fixed when serving time changes; Use plan timing restores
the original/derived timing. Duration determines the step's estimated finish, without
automatically moving other steps. Unknown durations and untimed steps remain supported.
Live Schedule is chronological even when checklist steps are manually reordered.

See [Step timing rules and manual checks](docs/step-timing.md) for timezone/DST handling,
archive/backup compatibility and the limits of manual planning versus #3 replanning.

## Brisket timing comparisons (#5)

An expanded brisket dish now accepts trimmed weight, cut, wrapping and a cooking profile
and offers an explicit **Use this timing** action. Compare estimated smoke/start windows,
rest and a separate monitored hold buffer; keep manual timing and fixed step overrides.
These are transparent planning comparisons, **not calibrated predictions**. Source sites
were blocked during this implementation; the staged-method weight scaling and uncertainty
allowances are app assumptions. See [timing rules and evidence limits](docs/brisket-estimates.md).
Template instruction updates using the user’s own recipes are the next content follow-up.

## Focused Cooking Mode (#26)

The execution checklist separates **Now**, **Next** (next 30 minutes), **Later** and
**Untimed** steps. Future details expand in place; completed activity stays in its own
section. Navigation, readings, notes and history retain the same cook and timestamps.
The smaller header, optional Beerometer and secondary step options keep attention on
cooking. See [Cooking Mode rules and manual checks](docs/cooking-mode.md).

## Save a plan for later (#39)

Use **Save plan for later** beside Start cooking to confirm a device-local save and
return Home without starting. Home shows the first planned step and cooking start,
with full dates/timezone, plus **Start cooking** and **Resume planning**. Existing
changes still autosave. This keeps one active/planning cook per browser; it does not
add cloud sync or automatic reminders. See [saved-plan behavior](docs/saved-plans.md).
