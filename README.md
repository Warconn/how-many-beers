# How Many Beers? 🍺

**Dinner has a deadline. Brisket does not.**

How Many Beers? is a mobile-first cooking assistant that turns a serving time and a collection of recipes into an **interactive, intelligent checklist**. Follow the plan, check off steps during the cook, record actual timestamps, and reuse the lessons next time.

The name is lighthearted; the schedule should be useful, transparent, and food-safe. A humorous “beers remaining” countdown might come later as an optional theme, never drinking advice.

> **Status:** MVP in development. [Live deployment](#hosting) is separate from having a public GitHub repository.

## The problem

A brisket cook, holiday turkey, or dinner with three side dishes requires more than a recipe. Home cooks create schedules in Notes, work backward from when guests arrive, and juggle preparation, preheat, long and uncertain cooking windows, wrapping, resting, and equipment conflicts. As soon as one task changes, the static checklist is outdated.

**Product promise:** “Tell us what you're making and when you're eating. We'll figure out the game plan.”

## Principles

- **Checklist first.** Primary interface is “Now / Up next / Later”, not a chatbot.
- **Start with one dish.** Add dishes and methods incrementally; re-coordinate the timeline.
- **Useful without AI.** Curated templates, manual steps and scheduling must work with no API key.
- **Estimates are not facts.** Use time windows and buffers, especially for brisket or other variable cooks.
- **Preserve history.** Actual events and temperatures are never replaced when we recalculate a plan.
- **Human review.** Imported recipes must be reviewed before becoming a schedule.
- **Mobile first.** Big touch targets, autosave, quick resume, minimal typing.
- **Food safety.** Surface validated safe-temperature and holding guidance; never invent doneness guarantees.

## Core user journey

1. Pick the target **serve date/time** (for example Saturday at 3 PM).
2. Add a dish from a built-in template **or import a recipe** (paste text, file or photo).
3. Review extracted prep steps, cooking method, equipment, durations, temperature references, and unknowns.
4. Generate a combined backward schedule with dependencies and an uncertainty buffer.
5. During cooking, check off tasks, log the actual time, add notes or internal-temperature readings.
6. See what's next, what's late, and what could affect dinner; revise incomplete tasks if plans change.
7. Save completed cooks and reuse them for a future meal.

## MVP definition

### P0: Working browser prototype

- [ ] New meal with a serving date/time in local time.
- [ ] Add and remove dishes; choose cooker/method, size, and estimated durations.
- [ ] Templates for **brisket, turkey, ribs, chicken, oven side**.
- [ ] Combined time-ordered checklist with prep, preheat, cook, milestone, rest/hold, and serve steps.
- [ ] Dependencies across steps; parallel dishes where practical.
- [ ] Clear schedule assumptions; no fixed ETA for condition-driven doneness checks.
- [ ] Mark tasks complete/reopen; record actual completion timestamps.
- [ ] Notes and optional temperature log entries.
- [ ] Save the active meal on the device and recover after refresh.
- [ ] Recipe **paste and text-file import** that generates an editable draft.
- [ ] Edit a generated plan rather than having to start over.
- [ ] Mobile responsive and keyboard-accessible experience.

### P1: AI-assisted recipe ingestion

- [ ] Upload recipe screenshots/images or PDFs (limit input size and format).
- [ ] Server-side AI extracts title, ingredients, steps, equipment, prep/cook/rest times and conditional milestones.
- [ ] Validate schema and ask the user about missing or ambiguous values.
- [ ] Show a confirmation screen before adding imported steps to a meal.
- [ ] Keep API credentials server-side; add abuse protection, rate limiting and a clear file-retention policy.
- [ ] Plain manual flow remains functional when AI service is unavailable.

### P2: Live replanning and cook history

- [ ] Record actual *start* as well as completion for a task.
- [ ] Recalculate only **unfinished** dependent steps when cooks run early/late.
- [ ] Highlight equipment conflicts (two oven tasks requiring different temperatures).
- [ ] Show estimated finish **range**, likelihood of schedule slipping and what information is missing.
- [ ] Save previous meal configurations and compare planned versus actual durations.
- [ ] Export a timeline/cook log and duplicate it for next time.

**Explicitly not MVP:** accounts, mandatory login, multi-device sync, voice commands, smart probe pairing, native apps, team collaboration, background notifications, automated recipe websites scraping, and live AI control over a cook.

## Recipe upload design

Accepted starting inputs: pasted recipe text, a `.txt` or `.md` file. Later: `.jpg`, `.png`, `.webp`, and `.pdf`.

**Pipeline:** input → extract candidate steps → validate structure → user review/edit → normalize dependencies and equipment → schedule.

Example draft:

```json
{
  "title": "Brisket",
  "equipment": "pellet smoker",
  "steps": [
    { "id": "prep", "title": "Trim and season", "estimatedMinutes": 45, "dependsOn": [] },
    { "id": "smoke", "title": "Smoke until ready", "estimatedMinutes": null, "dependsOn": ["prep"], "condition": "Check internal temperature and tenderness" }
  ],
  "needsReview": ["Weight, smoker setting, duration window, rest/hold plan"]
}
```

AI is responsible for *extracting* and proposing. Deterministic code owns all dates, dependencies, state changes and equipment validation. Treat uploads as untrusted data. Never invent a missing cook time or recommend serving undercooked food. Only upload material you have rights to use; imported recipes stay user-private and should not be published.

## Data model and scheduling

- **Meal:** id, title, serveAt, localTimeZone, dishes, equipment, tasks, actualEvents, revision.
- **Dish:** id, name, method, equipmentId, weight/servings, source and assumptions.
- **Task:** id, dishId, title, instructions, duration or uncertainty range, prerequisites, optional resource/temperature, timingType.
- **Timing types:** deterministic duration, estimated window, or condition-driven gate (e.g. “probe tender”).
- **Task event:** taskId, action, occurredAt, optional internalTemp, notes and source.
- **Schedule result:** plannedStart/plannedEnd windows, warnings, conflict list and an explanation.

Algorithm:
1. Validate all task references and reject cycles.
2. Anchor every dish's final ready-to-serve step to `serveAt`.
3. Traverse dependencies backward to place prep, cook and rest tasks. Carry min/max durations for uncertain steps.
4. Detect overlapping exclusive resources; do not silently claim one oven/smoker can run at incompatible settings.
5. Present a forward-order “Now / Next / Later” list.
6. On actual events, pin completed task times and update *only unfinished* dependents.
7. When real conditions matter (bark, stall, safe endpoint), request a real measurement or decision rather than declaring task complete automatically.

## First acceptance cases

These are synthetic illustrations based on two kinds of real-world cooking checklists, not copies of any user's private notes.

**Overnight brisket:** 12 lb brisket, pellet smoker, serve Saturday 3 PM. Generate overnight prep/cook guidance with uncertain milestones; support wrap when bark is ready, record a real 10 AM wrap timestamp and measured temperature, end with verified probe tenderness, temperature-monitored holding and slicing. Never guarantee a stall ends at a certain time.

**Holiday turkey + sides:** Prepare turkey and two sides with separate fryer/oven equipment. Make preheat, cooking, carving, and side-dish tasks visible; identify equipment conflicts and permit parallel steps. Safety instructions for frying are not replaced by a generic timer. Poultry needs temperature verification.

**Incomplete recipe:** “Cook until done” with no duration produces an incomplete draft requiring clarification, not a fabricated ETA.

**Refresh:** Complete a few tasks, record a note, refresh, and verify actual events remain.

**Change serving time:** Move dinner one hour later; recalculated pending tasks change, completed task timestamps do not.

## Technical approach

| Layer | Choice |
| --- | --- |
| Client | Next.js App Router, React, TypeScript, mobile-first CSS |
| Planner | Pure TypeScript dependency-aware scheduling engine, covered by tests |
| State | Local storage for first prototype; versioned schema |
| Recipe extraction | Local/manual parser first, server-only model integration later |
| Persistence later | PostgreSQL/Supabase with optional user accounts |
| Deployment | Vercel's Next.js integration from this public repo |
| Quality | TypeScript strict mode, linting, unit tests for scheduler, basic UI smoke tests |

Planned architecture:

```text
src/
  app/                # Routes and layouts
  components/         # Meal setup, import review, checklist and status
  domain/
    scheduling/       # Backward planning, dependency and conflict checks
    recipes/          # Import, normalization and validation
    meals/            # Data types and events
  data/               # Curated safe sample recipes
  lib/                # Storage, date/time and optional telemetry
tests/                # Synthetic brisket, turkey and rescheduling fixtures
```

## Build sequence

| Milestone | Deliverable | Done when |
| --- | --- | --- |
| **M0 Foundation** | App scaffold, scripts, landing screen, public repo | `npm run build` passes |
| **M1 Checklist MVP** | Set serving time, add templates, view plan, check tasks, autosave | A cook can follow and resume a plan on their phone |
| **M2 Recipe intake** | Paste/text import, editable review, image/PDF via secure server route | A new recipe turns into a user-confirmed plan |
| **M3 Intelligent scheduling** | Dependencies, buffers, conflicts, late-task updates | Delays affect only remaining steps and generate explanations |
| **M4 Real feedback** | Share with 5–10 cooks, measure confusing steps, improve UX | Users can complete a real cook without using Notes |
| **M5 Reliability** | Accessibility, tests, safe uploads, export, error states | Supportable public beta |

### Definition of a usable first release

A person on their phone can enter dinner time, add brisket and a side, see editable estimated milestones, check tasks off with timestamps, reload without losing anything, and know what they should do next. They can paste a recipe and review the proposed tasks. No signup and no AI account required.

## Development

```bash
npm install
npm run dev
npm run build
```

Node.js 20+ is recommended. Open http://localhost:3000.

## Hosting on GitHub Pages

The initial UI is a static-exported Next.js application hosted at **https://warconn.github.io/how-many-beers/**.

- The Next.js configuration exports the site to `out/` with `/how-many-beers` as its base path.
- The [Deploy to GitHub Pages workflow](.github/workflows/deploy.yml) builds and publishes the `out/` folder on pushes to `main`.
- In repository **Settings → Pages**, select **GitHub Actions** under **Build and deployment / Source** to enable artifact-based deployment. This is a one-time repo setting.
- Visit **Actions → Deploy to GitHub Pages** to check deployments or trigger one manually.
- The app stores one meal locally in the browser; there is no user account or cloud sync yet.

GitHub Pages hosts **static files only**. Photo/PDF recipe AI processing, shared data, and API secrets will require a separately hosted backend/service later. Never expose AI API keys in browser code.

For local development:

```bash
npm install
npm run dev
```

Run `npm run build` to generate the GitHub Pages static output.

## Future Ideas

- Upload recipe URLs, cookbooks, handwritten cards and video transcripts.
- Voice logging: “Wrapped at 10:05, brisket flat at 169.”
- Smart thermometer/probe integrations.
- Multi-device sync and shared family cook sessions.
- Scheduled notifications and installable PWA offline support.
- Personalized timing ranges learned from previous cooks.
- Grocery lists, recipe scaling, estimated macros and meal prep.
- Cook-log export and better equipment library.
- Optional fun countdown themes, including a nonalcoholic equivalent to “beers until dinner.”

## Content & safety

This is planning software, not a calibrated thermometer, food-safety inspector or guarantee of doneness. Confirm safe temperatures and equipment instructions independently. Estimate times conservatively and don't imply the app can verify food safety from elapsed time alone. We should use credible food-safety sources when implementing specific guidance.

## License

Public visibility is not an open-source license. No code license has been selected yet; choose one deliberately before accepting contributions.
