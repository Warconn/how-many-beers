import { describe, expect, it } from 'vitest';
import { createDish, newMeal } from '../src/domain/meal';
import { addStep, cookTimeline, editStep, migrateMeal, moveStep, recordEvent, type StepPlanEdit } from '../src/domain/cookState';
import { chronologicalTasks, estimatedFinish, formatLocalDateTime, localTimeCandidates, resolvePlannedTime } from '../src/domain/stepTiming';
import { parseRecipeText } from '../src/domain/recipe';
import { archiveCook, emptyHistory, exportBackup, repeatArchivedCook, validateBackup } from '../src/domain/cookHistory';

function seed() { return { ...newMeal(), serveAt: '2026-11-25T18:00', dishes: [createDish('brisket'), createDish('brats')] }; }
function plan(overrides: Partial<StepPlanEdit> = {}): StepPlanEdit {
  return { timingMode: 'fixed', scheduledAt: '2026-11-26T05:30:00.000Z', durationMinutes: 90, equipment: 'Patio smoker', targetTempF: 165, ...overrides };
}

describe('planned step overrides', () => {
  it('edits only planned metadata, preserving IDs, historical actuals and other dishes', () => {
    const meal=seed(), task=cookTimeline(meal)[0];
    const active=recordEvent(recordEvent(meal,task.id,'completed','2026-10-25T12:00:00.000Z'),task.id,'temperature','2026-10-25T12:01:00.000Z',165,'°F');
    const before=JSON.stringify(active);
    const edited=editStep(active,task.id,task.title,task.instructions,plan());
    const after=cookTimeline(edited).find(t=>t.id===task.id)!;
    expect(after).toMatchObject({id:task.id,scheduledAt:'2026-11-26T05:30:00.000Z',durationMinutes:90,equipment:'Patio smoker',targetTempF:165});
    expect(estimatedFinish(after)).toBe('2026-11-26T07:00:00.000Z');
    expect(edited.events).toEqual(active.events);
    expect(edited.completed).toEqual(active.completed);
    expect(edited.dishes).toEqual(active.dishes);
    expect(cookTimeline(edited).filter(t=>t.dishId!==task.dishId)).toEqual(cookTimeline(active).filter(t=>t.dishId!==task.dishId));
    expect(JSON.stringify(active)).toBe(before);
  });
  it('keeps fixed dates through serving-time changes and resets only timing overrides', () => {
    const meal=seed(), task=cookTimeline(meal)[0];
    const edited=editStep(meal,task.id,'My title',task.instructions,plan());
    const changed={...edited,serveAt:'2026-11-26T18:00'};
    const fixed=cookTimeline(changed).find(t=>t.id===task.id)!;
    expect(fixed.scheduledAt).toBe('2026-11-26T05:30:00.000Z');
    const reset=editStep(changed,task.id,fixed.title,fixed.instructions,plan({timingMode:'plan',scheduledAt:null,durationMinutes:null}));
    const derived=cookTimeline({...meal,serveAt:changed.serveAt}).find(t=>t.id===task.id)!;
    expect(cookTimeline(reset).find(t=>t.id===task.id)).toMatchObject({title:'My title',scheduledAt:derived.scheduledAt,equipment:'Patio smoker'});
    expect(reset.taskOverrides![task.id].scheduledAt).toBeUndefined();
  });
  it('does not invent template durations; a duration that fits existing spacing leaves later starts unchanged', () => {
    const meal=seed(), task=cookTimeline(meal)[0];
    expect(task.durationMinutes).toBeNull();
    expect(estimatedFinish(task)).toBeNull();
    const edited=editStep(meal,task.id,task.title,task.instructions,plan({timingMode:'plan',durationMinutes:30}));
    expect(cookTimeline(edited).map(t=>t.scheduledAt)).toEqual(cookTimeline(meal).map(t=>t.scheduledAt));
    expect(estimatedFinish(cookTimeline(edited).find(t=>t.id===task.id)!)).not.toBeNull();
  });
  it('supports imported durations, custom steps, unknown durations and zero-duration milestones', () => {
    const recipe=parseRecipeText('Soup','Chop\nSimmer'); recipe.steps![0].minutes=10;
    const meal={...newMeal(),dishes:[recipe]};
    const imported=cookTimeline(meal).find(t=>t.title==='Chop')!;
    expect(imported.durationMinutes).toBe(10);
    const custom=addStep(meal,'Set table');
    const task=custom.customTasks![0];
    const edited=editStep(custom,task.id,task.title,task.instructions,plan({durationMinutes:0}));
    expect(estimatedFinish(cookTimeline(edited).find(t=>t.id===task.id)!)).toBe('2026-11-26T05:30:00.000Z');
    const untimed=editStep(edited,task.id,task.title,task.instructions,plan({timingMode:'unscheduled',scheduledAt:null,durationMinutes:null}));
    expect(cookTimeline(untimed).find(t=>t.id===task.id)).toMatchObject({scheduledAt:null,durationMinutes:null});
    expect(estimatedFinish(cookTimeline(untimed).find(t=>t.id===task.id)!)).toBeNull();
  });
  it('retains timing metadata when older callers edit text only', () => {
    const meal=seed(),task=cookTimeline(meal)[0];
    const edited=editStep(meal,task.id,task.title,task.instructions,plan());
    expect(editStep(edited,task.id,'Renamed','Changed').taskOverrides![task.id]).toMatchObject({title:'Renamed',scheduledAt:plan().scheduledAt,durationMinutes:90});
    expect(migrateMeal(meal).taskOverrides).toEqual({});
  });
  it('rejects invalid data without mutating the saved cook', () => {
    const meal=seed(), task=cookTimeline(meal)[0], before=JSON.stringify(meal);
    for(const details of [plan({scheduledAt:'bad'}),plan({durationMinutes:-1}),plan({durationMinutes:Infinity}),plan({durationMinutes:43201}),plan({targetTempF:999}),plan({equipment:'x'.repeat(81)})]) {
      expect(()=>editStep(meal,task.id,task.title,task.instructions,details)).toThrow();
    }
    expect(JSON.stringify(meal)).toBe(before);
  });
  it('sorts the live schedule chronologically regardless of checklist order, with untimed steps last', () => {
    const meal=seed(), tasks=cookTimeline(meal);
    const moved=moveStep(meal,tasks[1].id,'up');
    expect(cookTimeline(moved)[0].id).toBe(tasks[1].id);
    expect(chronologicalTasks(cookTimeline(moved)).map(t=>t.id)).toEqual(tasks.map(t=>t.id));
    const withPrep=addStep(moved,'Prep');
    expect(chronologicalTasks(cookTimeline(withPrep)).at(-1)!.title).toBe('Prep');
    expect(withPrep.taskOrder![0]).toBe(tasks[1].id);
  });
  it('round trips metadata through backup and keeps archived snapshots frozen', () => {
    const meal=seed(),task=cookTimeline(meal)[0];
    const edited=editStep(meal,task.id,task.title,task.instructions,plan());
    const history=archiveCook(edited,emptyHistory(),'','2026-10-25T12:00:00.000Z');
    const restored=validateBackup(exportBackup(edited,history,'2026-10-25T13:00:00.000Z'));
    expect(restored.active.taskOverrides).toEqual(edited.taskOverrides);
    expect(history.cooks[0].plannedTimeline.find(t=>t.id===task.id)!.durationMinutes).toBe(90);
    editStep(edited,task.id,task.title,task.instructions,plan({durationMinutes:120}));
    expect(history.cooks[0].plannedTimeline.find(t=>t.id===task.id)!.durationMinutes).toBe(90);
  });
  it('repeats a cook with new IDs and rebases fixed plans relative to its new serving time', () => {
    const meal=seed(),task=cookTimeline(meal)[0];
    const edited=editStep(meal,task.id,task.title,task.instructions,plan());
    const entry=archiveCook(edited,emptyHistory(),'','2026-10-25T12:00:00.000Z').cooks[0];
    const repeated=repeatArchivedCook(entry);
    const repeatedTask=cookTimeline(repeated).find(t=>t.title===task.title)!;
    expect(repeatedTask.id).not.toBe(task.id);
    expect(Date.parse(repeatedTask.scheduledAt!)-Date.parse(repeated.serveAt)).toBe(Date.parse(plan().scheduledAt!)-Date.parse(meal.serveAt));
    expect(entry.meal.taskOverrides![task.id].scheduledAt).toBe(plan().scheduledAt);
    expect(repeated.events).toEqual([]);
  });
});

describe('local calendar timing and DST', () => {
  const zone='America/New_York';
  it('resolves overnight dates in the selected timezone', () => {
    expect(resolvePlannedTime('2026-11-26T00:30',zone)).toBe('2026-11-26T05:30:00.000Z');
    expect(formatLocalDateTime('2026-11-26T05:30:00.000Z',zone)).toBe('2026-11-26T00:30');
  });
  it('rejects nonexistent spring-forward times and invalid calendar dates', () => {
    expect(localTimeCandidates('2026-03-08T02:30',zone)).toEqual([]);
    expect(()=>resolvePlannedTime('2026-03-08T02:30',zone)).toThrow('does not exist');
    expect(()=>resolvePlannedTime('2026-02-30T12:00',zone)).toThrow('valid date');
  });
  it('requires a deliberate choice for the two fall-back occurrences', () => {
    expect(localTimeCandidates('2026-11-01T01:30',zone)).toEqual(['2026-11-01T05:30:00.000Z','2026-11-01T06:30:00.000Z']);
    expect(()=>resolvePlannedTime('2026-11-01T01:30',zone)).toThrow('UTC offset');
    expect(resolvePlannedTime('2026-11-01T01:30',zone,'2026-11-01T06:30:00.000Z')).toBe('2026-11-01T06:30:00.000Z');
  });
  it('preserves seconds and the saved ambiguous offset when the date field is unchanged', () => {
    const previous='2026-11-01T06:30:27.123Z';
    expect(resolvePlannedTime('2026-11-01T01:30',zone,undefined,previous)).toBe(previous);
  });
  it('handles fractional-hour offsets and elapsed duration across a DST transition', () => {
    expect(resolvePlannedTime('2026-11-26T00:30','Asia/Kathmandu')).toBe('2026-11-25T18:45:00.000Z');
    expect(estimatedFinish({scheduledAt:'2026-11-01T05:30:00.000Z',durationMinutes:90})).toBe('2026-11-01T07:00:00.000Z');
  });
});
