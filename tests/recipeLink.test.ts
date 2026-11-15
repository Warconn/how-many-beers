import {it,expect} from 'vitest';
import {newMeal,createDish} from '../src/domain/meal';
import {cookTimeline,editStep,recordEvent,startCookSession} from '../src/domain/cookState';
import {recipeFingerprint,recipeContent,documentFingerprint,withRecipeLink,copyRecipeName} from '../src/domain/recipeLink';
import {convertRecipeReview,instantiateRecipeReview,restoreRecipeReview} from '../src/domain/documents/reviewAdapter';
import {convertMeal,restoreMeal} from '../src/domain/documents/mealAdapter';
import {reorderPlannedStep} from '../src/domain/stepReorder';
const fixture=()=>({...newMeal(),serveAt:'2026-11-15T13:00:00Z',dishes:[createDish('wings')]});
it('content ignores calendar edits, activity and unchanged step forms but detects reusable changes',async()=>{
 const m=fixture(),before=structuredClone(m),task=cookTimeline(m)[0],hash=await recipeFingerprint(m);
 const dated=editStep(m,task.id,task.title,task.instructions,{plannedTimeOnly:true,timingMode:'fixed',scheduledAt:'2026-11-14T01:00:00Z',equipment:'',targetTempF:null});expect(await recipeFingerprint(dated)).toBe(hash);
 const same=editStep(m,task.id,task.title,task.instructions,{timingMode:'plan',scheduledAt:null,equipment:task.equipment??m.dishes[0].equipment,targetTempF:task.targetTempF??null});expect(await recipeFingerprint(same)).toBe(hash);
 const changed=editStep(m,task.id,'Dry my way','Changed');expect(await recipeFingerprint(changed)).not.toBe(hash);
 const active=recordEvent(startCookSession(m,'2026-11-14T01:00Z'),task.id,'completed','2026-11-14T01:10Z');expect(await recipeFingerprint(active)).toBe(hash);expect(m).toEqual(before);
});
it('links survive native review/meal round trips without entering reusable documents',async()=>{
 let m=fixture();const link={ownerId:'owner',id:crypto.randomUUID(),revision:1,name:m.dishes[0].name,fingerprint:await recipeFingerprint(m)};
 m=withRecipeLink(m,m.dishes[0].id,link);const r=convertRecipeReview(m,link.id);expect(r.status).toBe('converted');if(r.status!=='converted')throw Error(r.reason);expect(restoreRecipeReview(r)).toEqual(m);expect(JSON.stringify(r.document)).not.toContain('owner');
 const copy=instantiateRecipeReview(r.document,'2026-12-25T13:00Z');expect(copy.dishes[0].recipeLink).toBeUndefined();expect(await recipeFingerprint(copy)).toBe(link.fingerprint);expect(await documentFingerprint(r.document)).toBe(link.fingerprint);
 const meal=convertMeal(m,{timeZone:'UTC',serveInstant:m.serveAt});expect(meal.status).toBe('converted');if(meal.status==='skipped')throw Error(meal.reason);expect(restoreMeal(meal.conversion)).toEqual(m);expect(meal.conversion.document.dishes[0].sourceRecipe).toEqual({id:link.id,revision:1});
});
it('order changes including wings rest are reusable and stable through reload/reuse',async()=>{
 let m=fixture();const d=m.dishes[0],before=recipeContent(m);m=reorderPlannedStep(m,d.id+':oil',d.id+':check',false);expect(recipeContent(m)).not.toBe(before);expect(recipeContent(JSON.parse(JSON.stringify(m)))).toBe(recipeContent(m));
 const r=convertRecipeReview(m,'wings');if(r.status!=='converted')throw Error(r.reason);expect(await documentFingerprint(r.document)).toBe(await recipeFingerprint(m));
});
it('copy names are distinct and case insensitive; linking touches no other dish or event',async()=>{
 const m=fixture();m.dishes.push(createDish('brats'));const before=structuredClone(m);expect(copyRecipeName('Wings',['Wings_1','WINGS_2'])).toBe('Wings_3');const link={ownerId:'owner',id:'saved',revision:1,name:'Wings_1',fingerprint:await recipeFingerprint(m,m.dishes[0].id)};const updated=withRecipeLink(m,m.dishes[0].id,link,m.dishes[0].name);expect(updated.dishes[1]).toEqual(before.dishes[1]);expect(updated.dishes[0].name).toBe('Wings_1');expect(m).toEqual(before);
});
it('preserves pending associations and rejects malformed native metadata without changing canonical recipe JSON',async()=>{
 const m=fixture(),fingerprint=await recipeFingerprint(m),id=crypto.randomUUID();const linked=withRecipeLink(m,m.dishes[0].id,{ownerId:'owner',id,revision:0,name:m.dishes[0].name,fingerprint,pending:{id,revision:0,name:m.dishes[0].name,fingerprint,renameFrom:m.dishes[0].name}});
 const converted=convertMeal(linked,{timeZone:'UTC',serveInstant:m.serveAt});expect(converted.status).toBe('converted');if(converted.status==='skipped')throw Error(converted.reason);expect(converted.conversion.document.dishes[0].sourceRecipe).toBeUndefined();expect(restoreMeal(converted.conversion)).toEqual(linked);
 const invalid=structuredClone(linked);invalid.dishes[0].recipeLink!.fingerprint='broken';expect(convertMeal(invalid,{timeZone:'UTC',serveInstant:m.serveAt}).status).toBe('skipped');
});
