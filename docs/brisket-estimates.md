# Brisket timing comparisons (#5)

A brisket’s expanded menu card offers weight, cut, wrapping and cooking-profile inputs.
Unknown weight is blank, including on new dishes; old reference weights are not assumed
to be a measured weight. Untrimmed weights require confirmation after trimming.
Inputs persist as a comparison draft. **Use this timing** explicitly applies it;
**Keep manual timing** preserves current times and allows ordinary duration editing.
The rest/hold settings inside the timing comparison also need applying. Pending inputs
never silently update a running cook. The applied snapshot is retained as provenance.

## Evidence and limitations

Review date: October 26, 2026. Direct requests to all three source sites returned
HTTP 403 from this cloud environment, including a retried elevated request. This is
**not a fresh verification of their live pages**. Source context below comes from
issue #5 and the existing reviewed templates. Recipe review with the user’s actual
recipes remains a follow-up; no coefficient here is claimed to be a measured fit.

- [Meat Church Pellet Grill Brisket](https://www.meatchurch.com/blogs/recipes/pellet-grill-brisket):
  issue #5 records a 15–18 lb packer example, starting at 200°F, raising to 225°F near
  165°F internal, then 250–275°F after wrapping once bark is set. It does not establish
  a universal minutes-per-pound rule. **The app’s existing 10–18 h / 16 lb reference
  window is linearly scaled as an explicitly unvalidated planning comparison.**
  It is not sourced as a Meat Church time formula. Do not market it as calibrated.
- [Traeger planning guide](https://www.traeger.com/learn/how-to-smoked-brisket): issue #5
  records a broad 30–60 min/lb guide. This comparison is limited to the 225°F profile,
  and must be rechecked against the live guide before calling it a validated method.
- [USDA food safety](https://www.fsis.usda.gov/food-safety/safe-food-handling-and-preparation/food-safety-basics/steps-keep-food-safe):
  keep safe handling, verified food temperatures and monitored hot holding separate
  from barbecue tenderness and elapsed-time estimates. Holding requires monitoring
  at 140°F or above; an insulated cooler alone is not temperature control.

Flat widens the range by 25% at each end; no wrap increases its upper end by 25%.
These are **app uncertainty allowances**, not source-backed cut/wrap measurements.
Foil gets no speculative speed-up credit. Unsupported starting pit temperatures
produce no recommendation; use manual timing rather than inventing thermal corrections.
An optional 1.5 hr/lb user-recollection comparison is separate from the recommendation;
it assumes smoke time only, with rest/hold additional, and is never the default.

## Calculation and persistence

`estimateBrisket` is a pure deterministic helper. It validates 1–40 lb trimmed weight,
known profile/cut/wrap, profile starting setpoint, valid serving time and 0–720 minutes
for each timing allowance. Minutes round outward to quarter hours. The helper returns
both bounds, assumptions, unknowns, sources, version and the full input snapshot.

- Recommended on-smoker start = serving instant − upper smoke estimate − rest − extra hold buffer.
- Latest plausible start = serving instant − lower smoke estimate − rest. This is risky,
  not a safe guaranteed deadline. The buffer is deliberately absent from this bound.
- Prep starts before the recommended smoker start by `max(prep, preheat)` because these
  activities overlap. Rest and additional holding are counted once each.
- Applying uses the upper smoke bound for `cookMinutes`, rest for `restMinutes` and a
  separate hold buffer in derived stage anchors. Checks/wrap remain condition-driven.
- Profile-specific stage guidance and chosen cut/wrap come from the **applied snapshot**,
  not pending comparisons. General template rewrites are deferred to the recipe follow-up.
- Serving-time changes shift derived steps using elapsed-minute subtraction, including
  overnight/DST boundaries. The original applied snapshot remains unchanged as provenance.
- Fixed per-step overrides retain their exact instants. No automatic dependency shifting,
  doneness prediction, thermometer interpretation or history-based calibration is added.

Optional `dish.brisketPlan` stores draft inputs, manual/estimate mode and the last applied
versioned result. Existing localStorage schemas remain valid. Legacy cook duration and
reference settings stay unchanged until the user applies an estimate. Switching to
manual retains the applied method and buffer, avoiding an unexpected schedule jump.
IDs, completion/events/notes, custom tasks, other dishes, archived snapshots and backups
are preserved. Repeating an archive keeps method provenance and clears actuals as before.

## Verification and manual review

Unit coverage includes 8, 13, 15, 18 and 22 lb packers/flats, both profiles, wrap choices,
unknown/invalid inputs, manual/applied modes, zero rest/buffer, midnight/DST elapsed
arithmetic, fixed overrides, history, backup and repeat. Playwright checks desktop/phone
application, changed weights, manual comparisons, unknown/untrimmed inputs, reload and
recorded-activity preservation. Acceptance tests first failed on the absent planner.

Try a **hypothetical** 15 lb trimmed packer serving at 3 PM: compare the two profiles,
inspect assumptions, adjust rest/buffer, apply, then inspect the combined schedule.
Switch to manual and confirm input comparisons do not move steps. During an active cook,
verify completed timestamps and readings remain unchanged. Recipe/evidence review is
still required before treating these comparisons as calibrated recommendations.
