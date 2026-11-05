# Product roadmap and backlog decisions

**Owner decisions: November 4, 2026 (ET).** This is the current priority guide for Codex and product planning. **Before acting, recheck GitHub issue, branch, PR, and CI state.** In-flight means work was started or a PR was opened, not approval to merge or release. The repository's release notes describe what shipped; this page distinguishes delivered functionality from future design.

## Product north star

Help someone decide **what to cook**, tailor the actual method they will follow, coordinate multiple dishes in **one dinner cook**, and get through cooking with clear actions and a trustworthy estimate of **time remaining**.

Prefer a short, mobile-first workflow and grounded timing over speculative features or crowded dashboards. A **cook session** can contain multiple **dishes**. A **recipe** is a reusable method for one dish; a **past cook** is a historical session, possibly containing several dishes. Multiple separately saved **upcoming cook sessions** are a different feature.

## Verified production baseline

[Release PR #100](https://github.com/Warconn/how-many-beers/pull/100) shipped #21's visual system and #97's checklist-first Cooking Mode, including the approved compact layouts and simplified Beerometer. Production `main` release was `190bf6168fbaf9fe2c3d75770200101a26bcc539` with matching validated source tree from `dev`. [Release details](releases/2026-11-05.md). Do **not** reimplement #21, #97, or previous #92/#84/#62/#85/#77/#86 deliveries.

Current released defaults: one primary checklist action, optional physical-start corrections/temperature notes in Step details, account history and Cook Again, built-in templates and editable pasted/.txt/.md recipes. **URL fetching, a reusable personal recipe library, concurrent live phases, multiple upcoming saved sessions, and external notifications are not yet delivered by this release.** Never describe planned behavior as implemented.

## Working order: finish current work before starting new features

| Sequence | Issue | State and direction |
| --- | --- | --- |
| Merged into dev | [#61 Cancel Cook](https://github.com/Warconn/how-many-beers/issues/61) | [PR #104](https://github.com/Warconn/how-many-beers/pull/104) merged after owner acceptance and feature CI/security validation. Retained cancellation is in dev; hosted migration verification and production promotion remain separate. |
| Merged into dev | [#71 Faster CI](https://github.com/Warconn/how-many-beers/issues/71) | [PR #102](https://github.com/Warconn/how-many-beers/pull/102) merged with complete coverage, iPhone/WebKit and measured speed/cost evidence. Further speculative optimization is deferred. |
| Merged into dev | [#83 Multiple upcoming cooks](https://github.com/Warconn/how-many-beers/issues/83) | [PR #107](https://github.com/Warconn/how-many-beers/pull/107) merged after owner review. Multiple free signed-in plans, **one** active cook and automatic saving are in dev. Preserve capability gating and verify hosted migrations separately; not a production claim. |
| After #83, product UX priority | [#103 Recipe-first creation and reuse](https://github.com/Warconn/how-many-beers/issues/103) | First define concise “What are you cooking?” entry with **Your recipes**, **Cook again** and **Create new**; quick tailoring before cooking. Free reusable recipe distinct from history, same chooser for another dish; no new methods or URL importer required. **Design and approve the smallest slice before coding.** |
| Following core experience design | [#101 Active phases and whole-cook Beerometer](https://github.com/Warconn/how-many-beers/issues/101) | Design then independently build meaningful overlapping cooking phases with time-based checkpoints and a rolling whole-cook countdown, not a new global dependency scheduler. Validate real cooks before expanding. |

**Explicitly not authorized:** auto-merge PRs, modify production data or Supabase schemas on hosted systems, push to `main`, or start #101/#103 implementation before product review. Use isolated branches from current `dev`, focused PRs to `dev`, full appropriate CI and visual/account/data tests; obtain owner approval for merging and production promotion.

Dev integration was authorized on November 5 at
`4b4b31f4f996f4c1e2d1593bc48d1930a41f9692`, with Cloudflare preview confirmed.
Recheck its integration CI before final validation claims. No hosted migration or
production change was performed; verify account rollout prerequisites separately.

## Approved design boundaries

### #103: The cook should match the user's method

Starting point: **What are you cooking?** Choose a saved recipe if one exists, use a past cook through Cook Again, or create something new from a source-labeled starter template or existing text import. Review key phases, rough duration and equipment briefly; editing, removing or reordering unneeded steps should be straightforward. Reuse personal modifications later without mutating shared templates or old cooks. For multiple dishes, **Add another dish** should use the same picker.

#56 already improved the zero-dish entry, #25 already delivered template/dish editing. Preserve those. #18 (additional bundled methods) was **closed not planned** because expanding methods is not currently needed. #2 URL import can complement #103 later, but **must not block it**.

### #101: What is happening vs. what needs attention

- Checking a concrete **“Place meat on grill”** action starts that dish's actual grill phase, without a competing Start button. It does not claim the meat finished cooking.
- Checking an explicit **“Remove from heat / End grilling”** action ends that phase. A separate real rest/hold start may begin a following phase.
- Multiple dishes can have independent **Cooking now** phases simultaneously; one **Up next** queue orders actions across them.
- First release uses **time-based checkpoints** (e.g., “Check temperature at +20m”). The action can be checked off **without requiring a numerical temperature**; notes/readings remain optional, and nothing infers safe doneness.
- The **Beerometer reflects time still needed across the entire cook from the current clock**, not the stale original estimated finish, not a sum of overlapping durations, and not just the selected dish. Refresh as time passes and when events occur. If evidence is insufficient during an overrun, clearly communicate uncertainty and request adjustment instead of a false zero/precise finish.
- Correcting an actual phase start/end or step reflows dependent checkpoint times, active phases, global next action, whole-cook ETA and Beerometer without erasing historical events, inventing timestamps or rewriting fixed anchors.
- #3 owns **advanced** cross-dish dependencies/equipment conflict optimization. #11 owns **separate opt-in timers, snooze, alerts and notifications**. Neither belongs inside #101's core phase/checkpoint delivery.

## Later: intentionally deferred until the cook experience is locked in

- [#2 Recipe URL import](https://github.com/Warconn/how-many-beers/issues/2): **Later**. First validate recipe choice, editing and saved reuse via #103. Existing text/paste/file import continues.
- [#11 Timers and notifications](https://github.com/Warconn/how-many-beers/issues/11): **Later**. First validate #101's active phases and time-based *check actions*. Due-time computation is not a browser/push reminder feature.
- [#3 Advanced multi-dish scheduler](https://github.com/Warconn/how-many-beers/issues/3): Later, distinct from concurrently active dish phases in #101.
- [#6 Learned cooking estimates](https://github.com/Warconn/how-many-beers/issues/6), [#9 Image/PDF import](https://github.com/Warconn/how-many-beers/issues/9), [#13 Voice notes](https://github.com/Warconn/how-many-beers/issues/13), [#46 Free/Plus discovery](https://github.com/Warconn/how-many-beers/issues/46), [#67 Social login](https://github.com/Warconn/how-many-beers/issues/67), [#70 Concurrent-device conflict resolution](https://github.com/Warconn/how-many-beers/issues/70): preserve as Later/parked; no active implementation.
- [#105 Account safeguards and offline reliability](https://github.com/Warconn/how-many-beers/issues/105): consolidated **future** record for closed #68 privacy/export/deletion and #69 advanced offline outbox. Do not make speculative advanced sync block core work. **Actual security defects, lost data, or applicable privacy obligations must be handled promptly**, not postponed due to this priority.

### Intentionally closed, not delivered

[#12 Equipment profiles](https://github.com/Warconn/how-many-beers/issues/12), [#14 Smart thermometers](https://github.com/Warconn/how-many-beers/issues/14), [#15 Shared sessions](https://github.com/Warconn/how-many-beers/issues/15), [#16 Groceries/nutrition](https://github.com/Warconn/how-many-beers/issues/16), [#17 AI cooking coach](https://github.com/Warconn/how-many-beers/issues/17), [#18 More bundled cooking methods](https://github.com/Warconn/how-many-beers/issues/18), plus #68/#69, were closed or consolidated at owner's direction. Do not reopen, recreate, or quietly add them to a future Codex batch without a new decision.

## Validation and review philosophy

After #103/#101 delivery, **use the app during several real multi-dish cooks** before deciding what feature is next. Favor actual friction, missed checkpoints, mismatched templates, unclear live timing, data safety and phone usability over feature-count growth. Keep existing source-sensitive food-safety guidance; an estimate or checkbox does not certify a safe cooking endpoint.

This page and [docs/work-queue.md](work-queue.md) control current priority. [AGENTS.md](../AGENTS.md) controls agent workflow. Older dated material in other docs is historical; if it conflicts, favor newer explicit owner decisions while checking actual repository and issue state.
