import {describe,it,expect} from "vitest";
import {archiveCook,emptyHistory,exportBackup,removeArchivedCook,repeatArchivedCook,validateBackup} from "../src/domain/cookHistory";
import {cookTimeline,editStep,recordEvent,addStep,removeStep} from "../src/domain/cookState";
import {createDish,newMeal} from "../src/domain/meal";

const TIMESTAMP="2026-10-16T16:00:00.000Z";
function example(){
  const meal=newMeal();
  meal.name="Saturday brisket";
  meal.serveAt="2026-10-17T18:00";
  meal.dishes=[createDish("brisket"),createDish("brats")];
  const task=cookTimeline(meal).find(t=>t.id.endsWith(":start"))!;
  let active=recordEvent(meal,task.id,"completed","2026-10-17T06:00:00.000Z");
  active=recordEvent(active,task.id,"temperature","2026-10-17T07:00:00.000Z",165,"°F","flat");
  active=editStep(active,task.id,"Brisket placed in smoker","Started at low pit temp");
  const customized=addStep(active,"Prepare serving table","Bring out plates");
  return {active:customized,task};
}
describe("saved session history",()=>{
  it("archives a full snapshot, including actual events and the checklist at finish",()=>{
    const {active,task}=example();
    const history=archiveCook(active,emptyHistory(),"Great bark, a little dry",TIMESTAMP);
    expect(history.cooks).toHaveLength(1);
    const entry=history.cooks[0];
    expect(entry.meal.events?.some(e=>e.kind==="temperature"&&e.value===165)).toBe(true);
    expect(entry.meal.completed[task.id]).toBe("2026-10-17T06:00:00.000Z");
    expect(entry.plannedTimeline.find(t=>t.id===task.id)?.title).toBe("Brisket placed in smoker");
    expect(entry.feedback).toContain("Great bark");
  });
  it("never mutates a saved timeline after editing the live meal",()=>{
    const {active,task}=example();
    const history=archiveCook(active,emptyHistory(),"",TIMESTAMP);
    active.dishes[0].cookMinutes=440;
    active.completed[task.id]="2026-11-01T18:00:00.000Z";
    expect(history.cooks[0].meal.dishes[0].cookMinutes).not.toBe(440);
    expect(history.cooks[0].meal.completed[task.id]).toBe("2026-10-17T06:00:00.000Z");
  });
  it("clones recipes and custom task edits but resets all actual events and note states",()=>{
    const {active}=example();
    const archive=archiveCook(active,emptyHistory(),"",TIMESTAMP);
    const duplicate=repeatArchivedCook(archive.cooks[0]);
    expect(duplicate.id).not.toBe(active.id);
    expect(duplicate.dishes).toHaveLength(2);
    expect(duplicate.dishes[0].id).not.toBe(active.dishes[0].id);
    expect(duplicate.events).toEqual([]);
    expect(duplicate.completed).toEqual({});
    expect(duplicate.notes).toEqual({});
    expect(duplicate.startedAt).toBeUndefined();
    expect(duplicate.mode).toBe("planning");
    expect(cookTimeline(duplicate).find(t=>t.title==="Brisket placed in smoker")).toBeTruthy();
    expect(cookTimeline(duplicate).find(t=>t.title==="Prepare serving table")).toBeTruthy();
    expect(duplicate.taskOrder?.every(id=>cookTimeline(duplicate).some(t=>t.id===id))).toBe(true);
  });
  it("retains deleted step activity in original archive",()=>{
    const {active,task}=example();
    const removed=removeStep(active,task.id,TIMESTAMP);
    const saved=archiveCook(removed,emptyHistory(),"",TIMESTAMP);
    expect(saved.cooks[0].meal.events?.some(e=>e.taskId===task.id && e.kind==="removed")).toBe(true);
    expect(saved.cooks[0].plannedTimeline.some(t=>t.id===task.id)).toBe(false);
  });
  it("exports and restores active cook plus full history",()=>{
    const {active}=example();
    const h=archiveCook(active,emptyHistory(),"Delicious",TIMESTAMP);
    const backup=exportBackup(active,h,TIMESTAMP);
    const restored=validateBackup(backup);
    expect(restored.history.cooks[0].feedback).toBe("Delicious");
    expect(restored.active.dishes).toHaveLength(2);
    expect(restored.active.events).toEqual(active.events);
  });
  it("rejects malformed or unsupported backup files",()=>{
    expect(()=>validateBackup('{"version":0}')).toThrow();
    expect(()=>validateBackup(JSON.stringify({format:"other",version:1}))).toThrow();
    expect(()=>validateBackup("not json")).toThrow();
  });
  it("only removes the requested archived cook and de-duplicates repeated saves",()=>{
    const {active}=example();
    const once=archiveCook(active,emptyHistory(),"",TIMESTAMP);
    const twice=archiveCook(active,once,"Update",TIMESTAMP);
    expect(twice.cooks).toHaveLength(1);
    expect(twice.cooks[0].feedback).toBe("Update");
    expect(removeArchivedCook(twice,active.id).cooks).toHaveLength(0);
  });
});
