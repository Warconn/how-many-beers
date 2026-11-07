import type {Meal, PlannedTask} from './meal';
import type {ExtendedMeal} from './cookState';
import {stepMinutes} from './executionTimeline';
import {turkeyPreparation} from './turkeyPrep';

export type PlanningReadiness = {
  tasks: PlannedTask[];
  readyAt: string | null;
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
  const independent = new Set((m.customTasks ?? [])
    .filter(t => !timeline.find(p => p.id === t.id)?.userSequence).map(t => t.id));
  for (const task of timeline) {
    const key = independent.has(task.id) ? task.id : task.dishId;
    const list = groups.get(key) ?? [];
    list.push(task);
    groups.set(key, list);
  }

  for (const list of groups.values()) {
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
    lateMinutes,
    suggestedServeAt: lateMinutes && end !== null ? iso(Math.ceil(end / 60000) * 60000) : null,
    partial,
    conflicts,
  };
}
