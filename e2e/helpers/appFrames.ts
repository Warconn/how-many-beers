import type {Page} from '@playwright/test';

/** Hold application animation frames at a user-interaction boundary, without
 * sleeps or delaying network acknowledgements. Playwright's isolated world is
 * unaffected. Release before typing so a late focus transfer is observable. */
export async function holdAppFrames(page:Page){
 await page.evaluate(()=>{
  const request=window.requestAnimationFrame.bind(window),cancel=window.cancelAnimationFrame.bind(window);
  const pending=new Map<number,FrameRequestCallback>();let id=0;
  window.requestAnimationFrame=callback=>{const key=--id;pending.set(key,callback);return key;};
  window.cancelAnimationFrame=key=>{if(key<0)pending.delete(key);else cancel(key);};
  (window as typeof window&{releaseAppFrames?:()=>number}).releaseAppFrames=()=>{
   window.requestAnimationFrame=request;window.cancelAnimationFrame=cancel;
   const callbacks=[...pending.values()];pending.clear();
   callbacks.forEach(callback=>callback(performance.now()));return callbacks.length;
  };
 });
}
export async function releaseAppFrames(page:Page){
 return page.evaluate(()=>(window as typeof window&{releaseAppFrames?:()=>number}).releaseAppFrames?.()??0);
}
