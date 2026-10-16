import {describe, it, expect} from "vitest";
import {addStep, cookTimeline, editStep, migrateMeal, moveStep, recordEvent, removeStep} from "../src/domain/cookState";
import type {ExtendedMeal} from "../src/domain/cookState";
import {createDish, newMeal} from "../src/domain/meal";

function seed(){
  const meal = newMeal();
  meal.serveAt = "2026-11-25T15:00";
  meal.dishes=[createDish("brisket")];
  return meal;
}

describe("cooking checklist and history",()=>{
  it("migrates an old cook's completion timestamps into an immutable event",()=>{
    const old=seed();
    const task=cookTimeline(old)[0];
    old.completed[task.id]="2026-11-25T08:05:00.000Z";
    const migrated=migrateMeal(old);
    expect(migrated.events).toContainEqual(expect.objectContaining({taskId:task.id,kind:"completed",occurredAt:"2026-11-25T08:05:00.000Z"}));
    expect(cookTimeline(migrated)).toHaveLength(cookTimeline(old).length);
  });

  it("adds and edits a step without disturbing the generated brisket template",()=>{
    const meal=seed();
    const count=cookTimeline(meal).length;
    const updated=addStep(meal,"Mix glaze","Use a small bowl",null);
    expect(cookTimeline(updated)).toHaveLength(count+1);
    const custom=cookTimeline(updated).find(t=>t.title==="Mix glaze")!;
    const edited=editStep(updated,custom.id,"Make glaze","Whisk together");
    expect(cookTimeline(edited).find(t=>t.id===custom.id)).toMatchObject({title:"Make glaze",instructions:"Whisk together"});
    expect(cookTimeline(edited).filter(t=>t.dishName==="Smoked brisket")).toHaveLength(count);
  });

  it("reorders tasks without changing their immutable IDs or deleting events",()=>{
    const meal=seed();
    const first=cookTimeline(meal)[0],second=cookTimeline(meal)[1];
    const withLog=recordEvent(meal,first.id,"started","2026-11-25T05:00:00.000Z");
    const moved=moveStep(withLog,second.id,"up");
    expect(cookTimeline(moved)[0].id).toBe(second.id);
    expect(moved.events).toEqual(withLog.events);
    expect(cookTimeline(moved).map(t=>t.id).sort()).toEqual(cookTimeline(meal).map(t=>t.id).sort());
  });

  it("retains completion timestamps and activity logs after serving-time edits",()=>{
    let meal:ExtendedMeal=seed();
    const task=cookTimeline(meal)[0];
    meal=recordEvent(meal,task.id,"started","2026-11-25T04:00:00.000Z");
    meal=recordEvent(meal,task.id,"temperature","2026-11-25T04:25:00.000Z",165,"°F","flat");
    meal=recordEvent(meal,task.id,"equipment","2026-11-25T04:30:00.000Z",250,"°F","pellet smoker");
    meal=recordEvent(meal,task.id,"completed","2026-11-25T05:00:00.000Z");
    const before=cookTimeline(meal).find(t=>t.id===task.id)!.scheduledAt;
    const changed={...meal,serveAt:"2026-11-25T17:00"};
    const after=cookTimeline(changed).find(t=>t.id===task.id)!.scheduledAt;
    expect(after).not.toBe(before);
    expect(changed.completed[task.id]).toBe("2026-11-25T05:00:00.000Z");
    expect(changed.events?.map(e=>e.occurredAt)).toEqual(meal.events?.map(e=>e.occurredAt));
    expect(changed.events?.filter(e=>e.kind==="equipment")[0]).toMatchObject({value:250,unit:"°F"});
    const switched=recordEvent(changed,task.id,"equipment","2026-11-25T05:10:00.000Z",undefined,undefined,"Switched to smoke mode");
    expect(switched.events?.at(-1)).toMatchObject({kind:"equipment",note:"Switched to smoke mode"});

  });

  it("can reopen tasks and preserves both the completion and reopening events",()=>{
    const meal=seed(), task=cookTimeline(meal)[0];
    const done=recordEvent(meal,task.id,"completed","2026-11-25T05:00:00.000Z");
    const reopened=recordEvent(done,task.id,"reopened","2026-11-25T05:05:00.000Z");
    expect(reopened.completed[task.id]).toBeUndefined();
    expect(reopened.events?.filter(e=>e.taskId===task.id).map(e=>e.kind)).toEqual(["completed","reopened"]);
  });

  it("hides deleted steps but keeps their historical completion and temperature readings",()=>{
    const meal=seed(), task=cookTimeline(meal)[0];
    const completed=recordEvent(meal,task.id,"completed","2026-11-25T05:00:00.000Z");
    const removed=removeStep(completed,task.id,"2026-11-25T05:30:00.000Z");
    expect(cookTimeline(removed).some(t=>t.id===task.id)).toBe(false);
    expect(removed.completed[task.id]).toBe("2026-11-25T05:00:00.000Z");
    expect(removed.events?.filter(e=>e.taskId===task.id).map(e=>e.kind)).toEqual(["completed","removed"]);
  });

  it("rejects empty task names, invalid temperature values, and cycles of bad editing",()=>{
    const meal=seed(), task=cookTimeline(meal)[0];
    expect(()=>addStep(meal,"  ")).toThrow("title");
    expect(()=>editStep(meal,task.id,"","")).toThrow("title");
    expect(()=>recordEvent(meal,task.id,"temperature","2026-11-25T05:00:00.000Z",900,"°F")).toThrow("valid food temperature");
    expect(()=>recordEvent(meal,task.id,"started","not-a-date")).toThrow("timestamp");
  });
});
