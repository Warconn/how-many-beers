import {describe,it,expect} from "vitest";
import {createDish, newMeal, presets} from "../src/domain/meal";
import {buildTimeline} from "../src/domain/schedule";
import {templateSteps} from "../src/data/cookTemplates";

describe("researched starter templates",()=>{
  for(const preset of ["brisket","wings","brats","turkey"] as const){
    it(preset+" has sourced, ordered stages with a verified finish check",()=>{
      const meal=newMeal();
      meal.serveAt="2026-11-25T15:00";
      const dish=createDish(preset);
      meal.dishes=[dish];
      const plan=buildTimeline(meal);
      expect(presets[preset].sources?.length).toBeGreaterThan(0);
      expect(plan.length).toBeGreaterThanOrEqual(6);
      expect(plan.find(t=>t.id.endsWith(":start"))).toBeDefined();
      expect(plan.find(t=>t.id.endsWith(preset==="wings" ? ":check" : ":finish"))?.isCondition).toBe(true);
      expect(plan.at(-1)?.title.toLowerCase()).toContain("serve");
      expect(plan.every(t=>t.scheduledAt && Number.isFinite(new Date(t.scheduledAt).getTime()))).toBe(true);
      expect(plan.map(t=>new Date(t.scheduledAt!).getTime())).toEqual([...plan].map(t=>new Date(t.scheduledAt!).getTime()).sort((a,b)=>a-b));
      expect(templateSteps[preset]?.every(s=>!!s.instructions)).toBe(true);
    });
  }
  it("brisket includes staged bark, wrap, tenderness and safe hold steps",()=>{
    const meal=newMeal();meal.dishes=[createDish("brisket")];
    const steps=buildTimeline(meal);
    const descriptions=steps.map(t=>t.title+" "+t.instructions).join(" ").toLowerCase();
    for(const word of ["bark","wrap","203","tender","140"])expect(descriptions).toContain(word);
  });
  it("wings include 165°F completion before finishing fry",()=>{
    const meal=newMeal();meal.dishes=[createDish("wings")];
    const steps=buildTimeline(meal);
    expect(steps.findIndex(t=>t.id.endsWith(":check"))).toBeLessThan(steps.findIndex(t=>t.id.endsWith(":fry")));
    expect(steps.find(t=>t.id.endsWith(":check"))?.instructions).toContain("165°F");
  });
  it("smoked wings reach checked safe temperature before heating fryer and frying",()=>{
    const meal=newMeal();meal.dishes=[createDish("wings")];
    const ids=buildTimeline(meal).map(t=>t.id.split(":").at(-1));
    expect(ids.indexOf("check")).toBeLessThan(ids.indexOf("oil"));
    expect(ids.indexOf("oil")).toBeLessThan(ids.indexOf("fry"));
  });
  it("grilled brats reach their checked safe temperature before the beer bath",()=>{
    const meal=newMeal();meal.dishes=[createDish("brats")];
    const ids=buildTimeline(meal).map(t=>t.id.split(":").at(-1));
    expect(ids.indexOf("check")).toBeLessThan(ids.indexOf("bath"));
    expect(buildTimeline(meal).find(t=>t.id.endsWith(":check"))?.instructions).toContain("160°F");
  });
  it("turkey shows verified 165°F rather than a timer-only endpoint",()=>{
    const meal=newMeal();meal.dishes=[createDish("turkey")];
    const steps=buildTimeline(meal);
    expect(steps.find(t=>t.id.endsWith(":finish"))?.instructions).toContain("165°F");
    expect(steps.find(t=>t.id.endsWith(":finish"))?.isCondition).toBe(true);
  });
  it("pit settings change instructions but not existing logged task identities",()=>{
    const meal=newMeal();const dish=createDish("wings");meal.dishes=[dish];
    const original=buildTimeline(meal);
    dish.pitTempF=250;
    const adjusted=buildTimeline(meal);
    expect(adjusted.some(t=>t.title.includes("250°F"))).toBe(true);
    expect(original.map(t=>t.id)).toEqual(adjusted.map(t=>t.id));
  });
  it("multiple dishes belong to one meal and create no clashing task IDs",()=>{
    const meal=newMeal();
    meal.dishes=[createDish("brisket"),createDish("brats"),createDish("wings"),createDish("turkey")];
    const timeline=buildTimeline(meal);
    expect(new Set(timeline.map(t=>t.id)).size).toBe(timeline.length);
    expect(new Set(timeline.map(t=>t.dishId)).size).toBe(4);
  });
});
