import type {Meal, PlannedTask} from './meal';
import type {ExtendedMeal} from './cookState';
import {stepMinutes} from './executionTimeline';
import {turkeyPreparation} from './turkeyPrep';

export type PlanningReadiness = {
  tasks: PlannedTask[];
  readyAt: string | null;
  startAt: string | null;
  lateMinutes: number;
  suggestedServeAt: string | null;
  partial: boolean;
  conflicts: string[];
};
const stamp = (s: string | null | undefined) => s && Number.isFinite(Date.parse(s)) ? Date.parse(s) : null;
const iso = (n: number) => Number.isFinite(n) && Math.abs(n) <= 8640000000000000 ? new Date(n).toISOString() : null;

/** Read-only pre-cook feasibility over the existing target-derived plan.
 * Never starts a session, edits a fixed anchor, or writes inferred activity.
 * Independent dish paths overlap. Authored template spacing is retained; this
 * does not discover prerequisites or solve equipment capacity (#3). */
export function planningReadiness(meal: Meal, timeline: PlannedTask[], now: number): PlanningReadiness | null {
  const m = meal as ExtendedMeal;
  if (meal.mode === 'cooking' || meal.startedAt || Object.keys(meal.completed).length ||
      (m.events ?? []).some(e => e.kind !== 'removed')) return null;

  const target = stamp(meal.serveAt);
  const groups = new Map<string, PlannedTask[]>();
  const result = new Map<string, PlannedTask>();
  const conflicts: string[] = [];
  const clockValid = Number.isFinite(now) && iso(now) !== null;
  let partial = !clockValid;
  let end: number | null = null;
  let begin: number | null = null;
  const independent = new Set((m.customTasks ?? [])
    .filter(t => !timeline.find(p => p.id === t.id)?.userSequence).map(t => t.id));
  for (const task of timeline) {
    const key = independent.has(task.id) ? task.id : task.dishId;
    const list = groups.get(key) ?? [];
    list.push(task);
    groups.set(key, list);
  }

  // Built-in templates have authored overlap and checkpoints. A duration edit may
  // push their raw timeline past serving; in planning, re-anchor the flexible
  // *whole path* backward instead of carrying that delay into dinner. The clock
  // floor below still decides if this earlier start is actually feasible.
  const backwardPlan = (list: PlannedTask[]): PlannedTask[] => {
    if (target === null || list.some(t => t.userSequence)) return list;
    const ends: number[] = [];
    for (const task of list) {
      const dish = meal.dishes.find(d => d.id === task.dishId);
      const turkey = dish?.preset === 'turkey' ? turkeyPreparation(dish) : null;
      if (turkey && (task.id === dish!.id + ':thaw' ||
          task.id === dish!.id + ':brine' && turkey.brineHours === 0)) continue;
      const start = stamp(task.scheduledAt);
      const minutes = stepMinutes(meal, task) ??
        (turkey && task.id === dish!.id + ':dry' ? turkey.dryHours * 60 : null) ??
        (task.id.endsWith(':serve') || task.isCondition && !task.templateStage ? 0 : null);
      if (start === null || minutes === null) return list; // Never invent unknown timing.
      ends.push(start + minutes * 60000);
    }
    if (!ends.length) return list;
    const overshoot = Math.max(...ends) - target;
    if (overshoot <= 0) return list;
    // A fixed early preparation step constrains its own interval, not every
    // later flexible start. Move only the suffix after the last fixed anchor,
    // bounded by the finishes before it. Keep overlaps/checkpoints intact by
    // translating that suffix together; never squeeze across a known interval.
    const ordered = list.filter(t => stamp(t.scheduledAt) !== null)
      .sort((a,b) => stamp(a.scheduledAt)! - stamp(b.scheduledAt)!);
    const lastFixed = ordered.findLastIndex(t => t.timingMode === 'fixed');
    const movable = ordered.slice(lastFixed + 1);
    if (!movable.length) return list;
    let shift = overshoot;
    if (lastFixed >= 0) {
      const prefixFinish = Math.max(...ordered.slice(0,lastFixed + 1).map(t => {
        const length = stepMinutes(meal,t) ?? (t.isCondition && !t.templateStage || t.id.endsWith(':serve') ? 0 : null);
        return length === null ? Infinity : stamp(t.scheduledAt)! + length * 60000;
      }));
      shift = Math.max(0,Math.min(shift,stamp(movable[0].scheduledAt)! - prefixFinish));
    }
    if (!shift) return list;
    const ids = new Set(movable.map(t => t.id));
    return list.map(task => ids.has(task.id)
      ? {...task,scheduledAt:iso(stamp(task.scheduledAt)! - shift)} : task);
  };
  for (const original of groups.values()) {
    const list = backwardPlan(original);
    const sequential = list.some(t => t.userSequence);
    const tasks = [...list].sort((a, b) => sequential
      ? (a.recipeOrder ?? 0) - (b.recipeOrder ?? 0)
      : (stamp(a.scheduledAt) ?? Infinity) - (stamp(b.scheduledAt) ?? Infinity));
    let cursor: number | null = null;
    let shift = 0;
    for (const task of tasks) {
      const dish = meal.dishes.find(d => d.id === task.dishId);
      const turkey = dish?.preset === 'turkey' ? turkeyPreparation(dish) : null;
      // Unordered template thaw reminders and skipped brining are not intervals.
      // Explicitly ordered turkey preparation is materialized by cookTimeline.
      if (!sequential && turkey && (task.id === dish!.id + ':thaw' ||
          task.id === dish!.id + ':brine' && turkey.brineHours === 0)) {
        result.set(task.id, {...task});
        continue;
      }
      const planned = stamp(task.scheduledAt);
      const length = stepMinutes(meal, task) ??
        (turkey && task.id === dish!.id + ':dry' ? turkey.dryHours * 60 : null) ??
        (task.id.endsWith(':serve') || task.isCondition && !task.templateStage ? 0 : null);
      if (planned === null || length === null || !clockValid) {
        partial = true;
        result.set(task.id, {...task});
        cursor = null;
        continue;
      }
      const earliest: number = sequential
        ? Math.max(now, planned, cursor ?? -Infinity)
        : Math.max(now, planned + shift);
      const fixed = task.timingMode === 'fixed';
      if (fixed && earliest > planned) {
        conflicts.push(task.title + ' keeps its fixed start; the earliest estimated start is ' +
          new Date(earliest).toLocaleString() + '.');
      }
      const start = iso(earliest);
      const finish: number = earliest + length * 60000;
      if (start === null || iso(finish) === null) {
        partial = true;
        result.set(task.id, {...task});
        continue;
      }
      result.set(task.id, {
        ...task,
        scheduledAt: fixed ? task.scheduledAt : start,
        scheduleAdjustmentMinutes: (task.scheduleAdjustmentMinutes ?? 0) +
          (fixed ? 0 : (earliest - planned) / 60000),
      });
      begin = Math.min(begin ?? Infinity, earliest);
      cursor = finish;
      shift = earliest - planned;
      end = Math.max(end ?? -Infinity, finish);
    }
  }
  const readyAt = !partial && end !== null ? iso(end) : null;
  const lateMinutes = readyAt && target !== null
    ? Math.max(0, Math.ceil((Date.parse(readyAt) - target) / 60000)) : 0;
  return {
    tasks: timeline.map(t => result.get(t.id) ?? t),
    readyAt,
    startAt: !partial && begin !== null ? iso(begin) : null,
    lateMinutes,
    suggestedServeAt: lateMinutes && end !== null ? iso(Math.ceil(end / 60000) * 60000) : null,
    partial,
    conflicts,
  };
}
